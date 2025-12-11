import { WasmBridge } from './wasm-bridge';
import { DeviceIdentityInstance, KeyExchangeInstance, PairingRequestMessage, PairingResponseMessage, DiscoveredPeerData } from './types';
import { Notice } from 'obsidian';
import { UdpTransport } from './transport/udp-transport';
import { EventEmitter } from 'events';

export class SecurityService extends EventEmitter {
    private wasmBridge: WasmBridge;
    private identity: DeviceIdentityInstance | null = null;
    private deviceId: string;
    private transport: UdpTransport | null = null;
    private pendingRequests: Map<string, { resolve: Function, reject: Function }> = new Map();
    private activePairingCode: string | null = null;

    constructor(wasmBridge: WasmBridge, deviceId: string) {
        super();
        this.wasmBridge = wasmBridge;
        this.deviceId = deviceId;
    }

    setTransport(transport: UdpTransport) {
        this.transport = transport;
        // Listen for messages
        this.transport.on('message', (msg: string, senderIp: string) => {
            try {
                const parsed = JSON.parse(msg);
                if (parsed.type === 'pairing_request') {
                    this.handlePairingRequest(parsed as PairingRequestMessage, senderIp);
                } else if (parsed.type === 'pairing_response') {
                    this.handlePairingResponse(parsed as PairingResponseMessage, senderIp);
                }
            } catch (e) {
                // Ignore non-JSON or irrelevant messages
            }
        });
    }

    /**
     * Initialize the security service.
     * Loads existing identity or generates a new one.
     * @param savedSecretKey Optional base64 secret key from storage
     * @returns The secret key (base64) to be saved if it was generated or loaded
     */
    async initialize(savedSecretKey?: string): Promise<string> {
        const wasm = this.wasmBridge.getModule();
        if (!wasm) throw new Error("WASM not initialized");

        if (savedSecretKey) {
            try {
                this.identity = wasm.DeviceIdentity.from_secret_key(this.deviceId, savedSecretKey);
                console.log("Loaded device identity");
            } catch (e) {
                console.error("Failed to load identity, generating new one", e);
                new Notice("Failed to load device identity. Generating new one.");
            }
        }

        if (!this.identity) {
            this.identity = new wasm.DeviceIdentity(this.deviceId);
            console.log("Generated new device identity");
        }

        return this.identity.get_secret_key();
    }

    getPublicKey(): string {
        if (!this.identity) throw new Error("Identity not initialized");
        return this.identity.get_public_key();
    }

    getFingerprint(): string {
        const wasm = this.wasmBridge.getModule();
        if (!wasm || !this.identity) return "Unknown";
        return wasm.generate_fingerprint(this.identity.get_public_key());
    }

    generatePairingCode(): string {
        const wasm = this.wasmBridge.getModule();
        if (!wasm) throw new Error("WASM not initialized");
        const code = wasm.generate_pairing_code();
        this.activePairingCode = code;
        // Code expires after 60 seconds
        setTimeout(() => {
            if (this.activePairingCode === code) {
                this.activePairingCode = null;
            }
        }, 60000);
        return code;
    }

    verifyPairingCodeFormat(code: string): boolean {
        const wasm = this.wasmBridge.getModule();
        if (!wasm) return false;
        return wasm.verify_pairing_code_format(code);
    }

    // --- Handshake Logic ---

    async initiatePairing(peer: DiscoveredPeerData, code: string): Promise<boolean> {
        if (!this.transport || !this.identity) {
            throw new Error("Service not ready");
        }

        const requestId = Math.random().toString(36).substring(7);
        const request: PairingRequestMessage = {
            type: 'pairing_request',
            payload: {
                requestId,
                initiatorDeviceId: this.deviceId,
                initiatorName: "My Device", // TODO: Get from settings
                initiatorPublicKey: this.identity.get_public_key(),
                pairingCode: code
            }
        };

        // Send to peer (assuming we have their IP from discovery)
        // In a real scenario, DiscoveredPeerData should have the IP.
        // For now, let's assume we can get it or broadcast (bad for privacy but works for MVP)
        // But wait, DiscoveredPeerData DOES have addresses?
        // Let's check types.ts. Yes: addresses: string[]

        const targetIp = peer.addresses[0]; // Naive: pick first
        if (!targetIp) throw new Error("Peer has no address");

        console.log(`Sending pairing request to ${targetIp}`);
        this.transport.send(JSON.stringify(request), targetIp);

        // Wait for response
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error("Pairing timed out"));
            }, 10000);

            this.pendingRequests.set(requestId, {
                resolve: (val: boolean) => { clearTimeout(timeout); resolve(val); },
                reject: (err: Error) => { clearTimeout(timeout); reject(err); }
            });
        });
    }

    private handlePairingRequest(msg: PairingRequestMessage, senderIp: string) {
        console.log(`Received pairing request from ${msg.payload.initiatorName}`);

        // Verify code
        if (!this.activePairingCode || this.activePairingCode !== msg.payload.pairingCode) {
            console.warn("Invalid pairing code received");
            // Optionally send rejection
            return;
        }

        if (!this.identity || !this.transport) return;

        // Sign the request ID + initiator public key to prove identity
        const dataToSign = new TextEncoder().encode(msg.payload.requestId + msg.payload.initiatorPublicKey);
        const signature = this.identity.sign(dataToSign);

        const response: PairingResponseMessage = {
            type: 'pairing_response',
            payload: {
                requestId: msg.payload.requestId,
                responderDeviceId: this.deviceId,
                responderName: "My Device", // TODO
                responderPublicKey: this.identity.get_public_key(),
                signature,
                status: 'accepted'
            }
        };

        this.transport.send(JSON.stringify(response), senderIp);

        // Emit success event so UI can update
        this.emit('pairing_success', {
            deviceId: msg.payload.initiatorDeviceId,
            name: msg.payload.initiatorName
        });
    }

    private handlePairingResponse(msg: PairingResponseMessage, senderIp: string) {
        const pending = this.pendingRequests.get(msg.payload.requestId);
        if (!pending) return;

        if (msg.payload.status === 'accepted') {
            // Verify signature
            const wasm = this.wasmBridge.getModule();
            if (wasm) {
                // Reconstruct data
                // We need the original request data, but for now let's trust the requestId mapping
                // Ideally we should store the initiatorPublicKey we sent, but here we are the initiator.
                // Wait, the signature is over (requestId + initiatorPublicKey).
                // We are the initiator. We know our public key.
                if (this.identity) {
                     const dataToVerify = new TextEncoder().encode(msg.payload.requestId + this.identity.get_public_key());
                     const isValid = wasm.verify_signature(msg.payload.responderPublicKey, dataToVerify, msg.payload.signature);

                     if (isValid) {
                         pending.resolve(true);
                         this.emit('pairing_success', {
                             deviceId: msg.payload.responderDeviceId,
                             name: msg.payload.responderName
                         });
                     } else {
                         pending.reject(new Error("Invalid signature from peer"));
                     }
                }
            }
        } else {
            pending.reject(new Error("Pairing rejected by peer"));
        }
        this.pendingRequests.delete(msg.payload.requestId);
    }

    // Helper to check if a device is paired
    isPaired(deviceId: string, pairedDevices: string[]): boolean {
        return pairedDevices.includes(deviceId);
    }

    // Helper to add a device to paired list
    addPairedDevice(deviceId: string, pairedDevices: string[]): string[] {
        if (!pairedDevices.includes(deviceId)) {
            return [...pairedDevices, deviceId];
        }
        return pairedDevices;
    }
}


