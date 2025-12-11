/**
 * Peer List View Component
 * Displays discovered peers in the Obsidian UI
 */

import { ItemView, ViewStateResult, WorkspaceLeaf, Notice } from 'obsidian';
import { DiscoveredPeerData } from '../types';
import { P2PDiscoveryService } from '../discovery-service';

export const PEER_LIST_VIEW_TYPE = 'p2p-peer-list';

export class PeerListView extends ItemView {
  private discoveryService: P2PDiscoveryService | null = null;
  private container: HTMLElement | null = null;
  private isRefreshing = false;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return PEER_LIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'P2P Peers';
  }

  getIcon(): string {
    return 'network';
  }

  /**
   * Set the discovery service for this view
   */
  setDiscoveryService(service: P2PDiscoveryService): void {
    this.discoveryService = service;

    // Listen to discovery events
    this.discoveryService.on('peer_discovered', () => this.render());
    this.discoveryService.on('peer_updated', () => this.render());
    this.discoveryService.on('peer_lost', () => this.render());
    this.discoveryService.on('discovery_started', () => this.render());
    this.discoveryService.on('discovery_stopped', () => this.render());

    // Initial render
    this.render();
  }

  async onOpen(): Promise<void> {
    this.container = this.containerEl.children[1] as HTMLElement;
    this.render();
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }

  /**
   * Render the peer list UI
   */
  private render(): void {
    if (!this.container) {
      return;
    }

    this.container.empty();

    if (!this.discoveryService) {
      this.renderEmpty('Discovery service not initialized');
      return;
    }

    const status = this.discoveryService.getStatus();

    // Create main container
    const main = this.container.createDiv('p2p-peer-list-container');

    // Header section
    this.renderHeader(main, status);

    // Peers list or empty state
    if (status.peerCount === 0) {
      this.renderEmptyState(main);
    } else {
      this.renderPeersList(main, status.peers);
    }
  }

  /**
   * Render header with title and controls
   */
  private renderHeader(container: HTMLElement, status: any): void {
    const header = container.createDiv('p2p-header');

    const title = header.createEl('h2', { text: 'Available Devices' });
    title.addClass('p2p-title');

    const controls = header.createDiv('p2p-controls');

    // Peer count badge
    const badge = controls.createEl('span', {
      text: `${status.peerCount} device${status.peerCount !== 1 ? 's' : ''}`,
    });
    badge.addClass('p2p-badge');

    // Discovery status indicator
    const statusIndicator = controls.createDiv('p2p-status-indicator');
    if (status.isDiscovering) {
      statusIndicator.addClass('discovering');
      statusIndicator.title = 'Discovering peers...';
      statusIndicator.createEl('span', { text: '●' });
    } else {
      statusIndicator.addClass('idle');
      statusIndicator.title = 'Not discovering';
      statusIndicator.createEl('span', { text: '○' });
    }

    // Refresh button
    const refreshBtn = controls.createEl('button', { text: '🔄 Refresh' });
    refreshBtn.addClass('p2p-refresh-btn');
    refreshBtn.addEventListener('click', () => this.handleRefresh());

    // Start/Stop discovery button
    const toggleBtn = controls.createEl('button', {
      text: status.isDiscovering ? '⏹ Stop' : '▶ Start',
    });
    toggleBtn.addClass('p2p-toggle-btn');
    toggleBtn.addEventListener('click', () => this.handleToggleDiscovery(status.isDiscovering));
  }

  /**
   * Render empty state
   */
  private renderEmptyState(container: HTMLElement): void {
    const emptyState = container.createDiv('p2p-empty-state');

    emptyState.createEl('p', {
      text: 'No peers found',
      cls: 'p2p-empty-title',
    });

    const helpText = emptyState.createDiv('p2p-empty-help');
    helpText.createEl('p', {
      text: 'Make sure:',
    });

    const list = helpText.createEl('ul');
    list.createEl('li', { text: 'Other devices are connected to the same local network' });
    list.createEl('li', { text: 'P2P Sync is enabled on other devices' });
    list.createEl('li', { text: 'Your firewall allows local network connections' });

    const startBtn = emptyState.createEl('button', {
      text: '🔍 Start Discovery',
    });
    startBtn.addClass('p2p-start-btn');
    startBtn.addEventListener('click', () => {
      if (this.discoveryService && !this.discoveryService.isDiscoveryActive()) {
        this.discoveryService.startDiscovery().catch((error) => {
          console.error('Discovery error:', error);
          new Notice('Failed to start discovery');
        });
      }
    });
  }

  /**
   * Render peers list
   */
  private renderPeersList(container: HTMLElement, peers: DiscoveredPeerData[]): void {
    const list = container.createDiv('p2p-peers-list');

    peers.forEach((peer) => {
      this.renderPeerItem(list, peer);
    });
  }

  /**
   * Render a single peer item
   */
  private renderPeerItem(container: HTMLElement, peer: DiscoveredPeerData): void {
    const item = container.createDiv('p2p-peer-item');

    // Device name and icon
    const nameSection = item.createDiv('p2p-peer-name-section');
    nameSection.createEl('span', { text: '📱 ', cls: 'p2p-peer-icon' });
    nameSection.createEl('span', { text: peer.name, cls: 'p2p-peer-name' });

    // Device ID
    const idSection = item.createDiv('p2p-peer-id');
    idSection.createEl('span', { text: 'ID: ' });
    const idValue = idSection.createEl('code', { text: peer.device_id.substring(0, 8) + '...' });
    idValue.title = peer.device_id;

    // Last seen timestamp
    const lastSeenSection = item.createDiv('p2p-peer-lastseen');
    const now = Date.now();
    const timeDiff = now - peer.last_seen_timestamp;
    const lastSeenText = this.formatTimeDifference(timeDiff);
    lastSeenSection.createEl('span', { text: `Last seen: ${lastSeenText}` });

    // Addresses (if available)
    if (peer.addresses && peer.addresses.length > 0) {
      const addressesSection = item.createDiv('p2p-peer-addresses');
      addressesSection.createEl('span', { text: 'Addresses: ' });
      peer.addresses.forEach((addr, index) => {
        if (index > 0) {
          addressesSection.createEl('span', { text: ', ' });
        }
        const addrEl = addressesSection.createEl('code', { text: addr });
        addrEl.addClass('p2p-peer-address');
      });
    }

    // Action buttons
    const actions = item.createDiv('p2p-peer-actions');
    const syncBtn = actions.createEl('button', { text: '🔄 Sync' });
    syncBtn.addClass('p2p-peer-btn');
    syncBtn.addEventListener('click', () => this.handleSyncPeer(peer));

    const pairBtn = actions.createEl('button', { text: '🔐 Pair' });
    pairBtn.addClass('p2p-peer-btn');
    pairBtn.addEventListener('click', () => this.handlePairPeer(peer));
  }

  /**
   * Format time difference in human-readable format
   */
  private formatTimeDifference(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ago`;
    }
    if (hours > 0) {
      return `${hours}h ago`;
    }
    if (minutes > 0) {
      return `${minutes}m ago`;
    }
    return 'Just now';
  }

  /**
   * Render empty message
   */
  private renderEmpty(message: string): void {
    if (!this.container) {
      return;
    }

    this.container.empty();
    this.container.createEl('p', { text: message, cls: 'p2p-empty' });
  }

  /**
   * Handle refresh button click
   */
  private async handleRefresh(): Promise<void> {
    if (this.isRefreshing) {
      return;
    }

    this.isRefreshing = true;

    try {
      if (this.discoveryService) {
        if (!this.discoveryService.isDiscoveryActive()) {
          await this.discoveryService.startDiscovery();
        } else {
          // If already discovering, just re-render
          this.render();
        }
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Handle discovery toggle
   */
  private async handleToggleDiscovery(isCurrentlyDiscovering: boolean): Promise<void> {
    if (!this.discoveryService) {
      return;
    }

    try {
      if (isCurrentlyDiscovering) {
        this.discoveryService.stopDiscovery();
      } else {
        await this.discoveryService.startDiscovery();
      }
    } catch (error) {
      console.error('Error toggling discovery:', error);
      new Notice('Error toggling discovery');
    }
  }

  /**
   * Handle sync peer button click
   */
  private handleSyncPeer(peer: DiscoveredPeerData): void {
    console.log('Sync peer:', peer.name);
    new Notice(`Syncing with ${peer.name}...`);
    // TODO: Implement sync
  }

  /**
   * Handle pair peer button click
   */
  private handlePairPeer(peer: DiscoveredPeerData): void {
    console.log('Pair peer:', peer.name);
    new Notice(`Pairing with ${peer.name}...`);
    // TODO: Implement pairing
  }
}
