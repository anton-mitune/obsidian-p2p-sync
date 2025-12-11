/**
 * Type definitions for P2P Vault Sync Plugin
 */

// ============================================================================
// WASM Module Bindings
// ============================================================================

export interface WasmModule {
  // Discovery
  P2PNode: new (deviceName: string) => P2PNodeInstance;

  // Utilities
  greet_from_rust(name: string): string;
  get_version(): string;

  // Crypto
  generate_pairing_code(): string;
  generate_fingerprint(deviceId: string): string;
  verify_pairing_code(code: string): boolean;

  // Allow additional properties
  [key: string]: unknown;
}

export interface P2PNodeInstance {
  get_peer_id(): string;
  get_device_name(): string;
  get_device_id(): string;
  start_discovery(): void;
  stop_discovery(): void;
  add_discovered_peer(peer: DiscoveredPeerInstance): void;
  get_discovered_peers_json(): string;
  remove_peer(peerId: string): void;
  clear_peers(): void;
  get_peer_count(): number;
  status(): string;
  free?(): void;
}

export interface DiscoveredPeerInstance {
  get_id(): string;
  get_name(): string;
  get_device_id(): string;
  get_last_seen_timestamp(): number;
  free?(): void;
}

// ============================================================================
// Plugin Data Models
// ============================================================================

export interface DiscoveredPeerData {
  id: string;
  name: string;
  device_id: string;
  last_seen_timestamp: number;
  addresses: string[];
}

export interface P2PSyncSettings {
  deviceName: string;
  enableLanDiscovery: boolean;
  discoveryTimeoutSeconds: number;
  enableEncryption: boolean;
  autoSync: boolean;
  syncIntervalSeconds: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface P2PSyncStatus {
  isConnected: boolean;
  discoveredPeersCount: number;
  syncProgress: number; // 0-100
  lastSyncTime: number;
  errors: string[];
}

export interface IPCMessage {
  type: string;
  payload?: unknown;
  timestamp: number;
}

export interface PeerDiscoveryEvent extends IPCMessage {
  type: 'peer_discovered' | 'peer_updated' | 'peer_lost';
  payload: DiscoveredPeerData;
}

export interface SyncEvent extends IPCMessage {
  type: 'sync_start' | 'sync_progress' | 'sync_complete' | 'sync_error';
  payload: {
    peerId: string;
    fileCount?: number;
    transferredBytes?: number;
    totalBytes?: number;
    error?: string;
  };
}
