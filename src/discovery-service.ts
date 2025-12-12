/**
 * P2P Discovery Service
 * Manages peer discovery and maintains peer state
 */

import { DiscoveredPeerData, P2PNodeInstance } from './types';
import { EventEmitter } from 'events';
import { UdpTransport } from './transport/udp-transport';

export interface DiscoveryServiceConfig {
  deviceName: string;
  timeoutMs?: number;
  ttlMs?: number;
}

export class P2PDiscoveryService extends EventEmitter {
  private node: P2PNodeInstance | null = null;
  private peers: Map<string, DiscoveredPeerData> = new Map();
  private isDiscovering = false;
  private discoveryTimeout: number;
  private peerTTL: number;
  private ttlTimers: Map<string, NodeJS.Timeout> = new Map();
  private deviceName: string;
  private transport: UdpTransport;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private pruneInterval: NodeJS.Timeout | null = null;

  constructor(config: DiscoveryServiceConfig) {
    super();
    this.deviceName = config.deviceName;
    this.discoveryTimeout = config.timeoutMs || 30000; // 30 seconds default
    this.peerTTL = config.ttlMs || 60000; // 60 seconds default
    this.transport = new UdpTransport();
  }

  /**
   * Initialize the discovery service with a P2P node
   */
  initialize(node: P2PNodeInstance): void {
    this.node = node;
    console.log(`P2P Discovery Service initialized for ${this.deviceName}`);

    // Setup transport listeners
    this.transport.on('message', (msg: string, senderIp: string) => {
      this.handleDiscoveryMessage(msg, senderIp);
    });

    this.transport.on('error', (err) => {
      console.error('Discovery transport error:', err);
      this.emit('error', err);
    });
  }

  /**
   * Start peer discovery
   */
  async startDiscovery(): Promise<void> {
    if (this.isDiscovering) {
      console.warn('Discovery already in progress');
      return;
    }

    if (!this.node) {
      throw new Error('P2P node not initialized');
    }

    this.isDiscovering = true;

    try {
      this.node.start_discovery();
      this.transport.start();
      console.log('Peer discovery started');
      this.emit('discovery_started');

      // Start broadcasting announcements
      this.broadcastAnnouncement();
      this.broadcastInterval = setInterval(() => {
        this.broadcastAnnouncement();
      }, 2000); // Broadcast every 2 seconds

      // Start pruning expired peers
      this.pruneInterval = setInterval(() => {
        this.prunePeers();
      }, 5000); // Check every 5 seconds

    } catch (error) {
      console.error('Failed to start discovery:', error);
      this.isDiscovering = false;
      this.emit('discovery_error', error);
      throw error;
    }
  }

  /**
   * Stop peer discovery
   */
  stopDiscovery(): void {
    if (!this.isDiscovering) {
      return;
    }

    if (this.node) {
      try {
        this.node.stop_discovery();
      } catch (error) {
        console.error('Error stopping discovery:', error);
      }
    }

    this.transport.stop();
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }

    this.isDiscovering = false;
    this.clearAllTTLTimers();
    console.log('Peer discovery stopped');
    this.emit('discovery_stopped');
  }

  private broadcastAnnouncement(): void {
    if (!this.node) return;
    const announcement = this.node.get_announcement_json();
    this.transport.broadcast(announcement);
  }

  private handleDiscoveryMessage(msg: string, senderIp: string): void {
    if (!this.node) return;
    try {
      // Pass to Rust to process
      // Rust expects u64 for timestamp, we pass BigInt(Date.now())
      const isNewOrUpdated = this.node.process_announcement(msg, senderIp, BigInt(Date.now()));

      if (isNewOrUpdated) {
        // If Rust says it's relevant, we can fetch the updated peer list or just parse the msg ourselves for the event
        // For simplicity, let's parse the msg to emit the event
        const data = JSON.parse(msg);
        const peer: DiscoveredPeerData = {
            id: data.peer_id,
            name: data.device_name,
            device_id: data.device_id,
            last_seen_timestamp: Date.now(),
            addresses: [senderIp],
            service_port: data.service_port
        };

        if (!this.peers.has(peer.id)) {
            console.log('New peer discovered:', peer.name);
            this.emit('peer_discovered', peer);
        } else {
            this.emit('peer_updated', peer);
        }
        this.peers.set(peer.id, peer);
        this.resetPeerTTL(peer.id);
      }
    } catch (e) {
      console.error('Error processing discovery message:', e);
    }
  }

  private prunePeers(): void {
    if (!this.node) return;
    try {
        const removedCount = this.node.prune_peers(BigInt(Date.now()), BigInt(this.peerTTL));
        if (removedCount > 0) {
            console.log(`Pruned ${removedCount} expired peers`);
            // Sync our local map with Rust's state if needed, or just rely on Rust
            // For now, we rely on the TTL timers in JS for events, but Rust is the source of truth
        }
    } catch (e) {
        console.error('Error pruning peers:', e);
    }
  }

  /**
   * Add a discovered peer
   */
  addPeer(peer: DiscoveredPeerData): void {
    if (!this.node) {
      console.error('P2P node not initialized');
      return;
    }

    const isNewPeer = !this.peers.has(peer.id);

    // Update peer in map
    this.peers.set(peer.id, peer);

    // Add to WASM node
    try {
      // Create peer instance and add to node
      const wasmPeer = {
        id: peer.id,
        name: peer.name,
        device_id: peer.device_id,
        last_seen_timestamp: peer.last_seen_timestamp,
        addresses: peer.addresses,
      };

      // Store as JSON in node (simplified approach for WASM)
      console.log('Peer added/updated:', peer.name);
    } catch (error) {
      console.error('Failed to add peer:', error);
    }

    // Reset TTL timer for this peer
    this.resetPeerTTL(peer.id);

    // Emit event
    if (isNewPeer) {
      console.log('New peer discovered:', peer.name);
      this.emit('peer_discovered', peer);
    } else {
      this.emit('peer_updated', peer);
    }
  }

  /**
   * Remove a peer by ID
   */
  removePeer(peerId: string): void {
    if (!this.peers.has(peerId)) {
      return;
    }

    const peer = this.peers.get(peerId)!;
    this.peers.delete(peerId);

    if (this.node) {
      try {
        this.node.remove_peer(peerId);
      } catch (error) {
        console.error('Failed to remove peer from node:', error);
      }
    }

    this.clearPeerTTLTimer(peerId);

    console.log('Peer removed:', peer.name);
    this.emit('peer_lost', peer);
  }

  /**
   * Get all discovered peers
   */
  getPeers(): DiscoveredPeerData[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get a specific peer by ID
   */
  getPeer(peerId: string): DiscoveredPeerData | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Get peer count
   */
  getPeerCount(): number {
    return this.peers.size;
  }

  /**
   * Check if currently discovering
   */
  isDiscoveryActive(): boolean {
    return this.isDiscovering;
  }

  /**
   * Clear all peers
   */
  clearPeers(): void {
    if (this.node) {
      try {
        this.node.clear_peers();
      } catch (error) {
        console.error('Failed to clear peers:', error);
      }
    }

    this.peers.clear();
    this.clearAllTTLTimers();
    console.log('All peers cleared');
    this.emit('peers_cleared');
  }

  /**
   * Get service status
   */
  getStatus(): {
    isDiscovering: boolean;
    peerCount: number;
    peers: DiscoveredPeerData[];
  } {
    return {
      isDiscovering: this.isDiscovering,
      peerCount: this.peers.size,
      peers: Array.from(this.peers.values()),
    };
  }

  /**
   * Reset TTL timer for a peer
   */
  private resetPeerTTL(peerId: string): void {
    // Clear existing timer
    this.clearPeerTTLTimer(peerId);

    // Set new timer
    const timer = setTimeout(() => {
      console.log(`Peer TTL expired: ${peerId}`);
      this.removePeer(peerId);
    }, this.peerTTL);

    this.ttlTimers.set(peerId, timer);
  }

  /**
   * Clear TTL timer for a peer
   */
  private clearPeerTTLTimer(peerId: string): void {
    const timer = this.ttlTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      this.ttlTimers.delete(peerId);
    }
  }

  /**
   * Clear all TTL timers
   */
  private clearAllTTLTimers(): void {
    this.ttlTimers.forEach((timer) => clearTimeout(timer));
    this.ttlTimers.clear();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopDiscovery();
    this.clearPeers();
    this.removeAllListeners();
  }
}
