/**
 * Type definitions for P2P Vault Sync Plugin
 */

// ============================================================================
// WASM Module Bindings
// ============================================================================

export interface WasmModule {
  // Discovery
  P2PNode: new (deviceName: string, deviceId: string, servicePort: number) => P2PNodeInstance;

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

  // Transfer
  TransferManager: new () => TransferManagerInstance;
  encrypt_data(keyB64: string, plaintext: Uint8Array): EncryptedChunkInstance;
  decrypt_data(keyB64: string, ciphertext: Uint8Array, nonce: Uint8Array): Uint8Array;

  // Allow additional properties
  [key: string]: unknown;
}

export interface TransferManagerInstance {
  prepare_transfer(filePath: string, content: Uint8Array, sessionKey: string): string; // Returns JSON string of chunks
  decrypt_chunk(chunkJson: string, sessionKey: string): Uint8Array;
  free?(): void;
}

export interface EncryptedChunkInstance {
  get_data(): Uint8Array;
  get_nonce(): Uint8Array;
  free?(): void;
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

  // File Sync
  update_file(path: string, content: Uint8Array, mtime: BigInt): boolean;
  mark_file_deleted(path: string, mtime: BigInt): boolean;
  get_all_files(): string;
  get_journal_state(): string;
  load_journal_state(json: string): void;

  free?(): void;
}

export interface DiscoveredPeerInstance {
  get_id(): string;
  get_name(): string;
  get_device_id(): string;
  get_last_seen_timestamp(): number;
  get_address(): string;
  get_service_port(): number;
  free?(): void;
}

export type TransferDirection = 'incoming' | 'outgoing';

export interface TransferStatus {
    id: string; // Unique ID for the transfer (e.g., peerId + filePath)
    filePath: string;
    peerId: string;
    direction: TransferDirection;
    progress: number; // 0 to 1
    totalSize?: number;
    state: 'pending' | 'transferring' | 'completed' | 'failed';
    error?: string;
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
  service_port?: number;
}

export interface P2PSyncSettings {
  deviceName: string;
  deviceId: string; // Unique ID for this device
  deviceSecretKey?: string; // Base64 encoded secret key
  pairedDevices: string[]; // List of paired device IDs
  pairedDeviceKeys: Record<string, string>; // deviceId -> publicKey
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

export interface SessionOfferMessage {
    type: 'SESSION_OFFER';
    deviceId: string;
    ephemeralPublicKey: string; // Base64
    signature: string; // Base64, signed by identity key
}

export interface SessionAnswerMessage {
    type: 'SESSION_ANSWER';
    deviceId: string;
    ephemeralPublicKey: string; // Base64
    signature: string; // Base64, signed by identity key
}

export interface FileDeleteMessage {
    type: 'FILE_DELETE';
    filePath: string;
}

export interface SyncRequestMessage {
    type: 'SYNC_REQUEST';
    // We could send a vector clock or last sync timestamp here.
    // For MVP, we just ask for everything.
}

export interface SyncResponseMessage {
    type: 'SYNC_RESPONSE';
    files: Array<{
        path: string;
        mtime: string; // BigInt serialized as string
        isDeleted: boolean;
    }>;
}

