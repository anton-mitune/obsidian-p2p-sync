/**
 * Type definitions for P2P Vault Sync Plugin
 */

// ============================================================================
// WASM Module Bindings
// ============================================================================

export interface WasmModule {
  // Discovery
  P2PNode: new (deviceName: string, deviceId: string) => P2PNodeInstance;

  // Utilities
  greet_from_rust(name: string): string;
  get_version(): string;

  // Crypto
  DeviceIdentity: DeviceIdentityConstructor;
  KeyExchange: new () => KeyExchangeInstance;
  PairingCode: new () => PairingCodeInstance;

  generate_pairing_code(): string;
  generate_fingerprint(publicKeyB64: string): string;
  verify_pairing_code_format(code: string): boolean;
  verify_signature(publicKeyB64: string, message: Uint8Array, signatureB64: string): boolean;

  // Allow additional properties
  [key: string]: unknown;
}

export interface DeviceIdentityConstructor {
  new (deviceId: string): DeviceIdentityInstance;
  from_secret_key(deviceId: string, secretKeyB64: string): DeviceIdentityInstance;
}

export interface DeviceIdentityInstance {
  get_device_id(): string;
  get_public_key(): string;
  get_secret_key(): string;
  sign(message: Uint8Array): string;
  free?(): void;
}

export interface KeyExchangeInstance {
  get_public_key(): string;
  compute_shared_secret(otherPublicKeyB64: string): string;
  free?(): void;
}

export interface PairingCodeInstance {
  get_code(): string;
  free?(): void;
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

  // New methods for UDP discovery
  process_announcement(json: string, senderIp: string, currentTime: BigInt): boolean;
  get_announcement_json(): string;
  prune_peers(currentTime: BigInt, ttlMs: BigInt): number;

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
  deviceId: string; // Unique ID for this device
  deviceSecretKey?: string; // Base64 encoded secret key
  pairedDevices: string[]; // List of paired device IDs
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
  };
}

// ============================================================================
// Protocol Messages
// ============================================================================

export type ProtocolMessage = DiscoveryMessage | PairingRequestMessage | PairingResponseMessage;

export interface DiscoveryMessage {
  type: 'discovery';
  payload: any; // The existing discovery JSON
}

export interface PairingRequestMessage {
  type: 'pairing_request';
  payload: {
    requestId: string;
    initiatorDeviceId: string;
    initiatorName: string;
    initiatorPublicKey: string;
    pairingCode: string; // The code entered by the user
  };
}

export interface PairingResponseMessage {
  type: 'pairing_response';
  payload: {
    requestId: string;
    responderDeviceId: string;
    responderName: string;
    responderPublicKey: string;
    signature: string; // Signature of the request ID + initiator public key
    status: 'accepted' | 'rejected';
  };
}

