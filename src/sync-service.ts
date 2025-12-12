import { App, TFile, TAbstractFile, Notice, Events } from 'obsidian';
import { WasmBridge } from './wasm-bridge';
import { TcpTransport } from './transport/tcp-transport';
import { SecurityService } from './security-service';
import { TransferStatus, DiscoveredPeerData } from './types';
import { ConfirmationModal, SyncChange } from './ui/confirmation-modal';
import * as path from 'path';

export class SyncService extends Events {
    private app: App;
    private wasmBridge: WasmBridge;
    private transport: TcpTransport;
    private securityService: SecurityService;
    private isWatching: boolean = false;
    private transferManager: any = null; // Will be initialized from WASM
    private incomingChunks: Map<string, { chunks: Map<number, any>, total: number, path: string }> = new Map();
    private activeTransfers: Map<string, TransferStatus> = new Map();
    private pendingSessionOffers: Map<string, any> = new Map(); // peerId -> keyExchange
    private remoteUpdateInProgress: Set<string> = new Set();
    private lastActivityTime: number = Date.now();
    private inactivityTimeoutMs: number = 5 * 60 * 1000; // 5 minutes
    private checkInactivityInterval: NodeJS.Timeout | null = null;

    constructor(app: App, wasmBridge: WasmBridge, transport: TcpTransport, securityService: SecurityService) {
        super();
        this.app = app;
        this.wasmBridge = wasmBridge;
        this.transport = transport;
        this.securityService = securityService;

        // Initialize TransferManager
        const module = this.wasmBridge.getModule();
        if (module && module.TransferManager) {
            this.transferManager = new module.TransferManager();
        }

        // Listen for incoming messages
        this.transport.on('message', this.handleMessage.bind(this));

        // REMOVED: pairing_success listener.
        // We rely on main.ts to establish connection after pairing,
        // and then trigger initiateSession via the 'connected' event.
        // This prevents race conditions where we try to sync before TCP is ready.
    }

    startWatching() {
        if (this.isWatching) return;

        this.app.vault.on('create', this.handleFileCreate.bind(this));
        this.app.vault.on('modify', this.handleFileModify.bind(this));
        this.app.vault.on('delete', this.handleFileDelete.bind(this));
        this.app.vault.on('rename', this.handleFileRename.bind(this));

        this.isWatching = true;
        console.log('SyncService: Started watching vault changes');

        // Start inactivity check
        this.checkInactivityInterval = setInterval(() => {
            this.checkInactivity();
        }, 60 * 1000); // Check every minute

        // Initial scan
        this.scanVault();
    }

    private updateActivity() {
        this.lastActivityTime = Date.now();
        this.trigger('activity');
    }

    private checkInactivity() {
        if (Date.now() - this.lastActivityTime > this.inactivityTimeoutMs) {
            console.log('SyncService: Inactivity timeout, closing connections');
            this.transport.disconnectAll();
        }
    }

    async scanVault() {
        const files = this.app.vault.getFiles();
        console.log(`SyncService: Scanning ${files.length} files...`);
        for (const file of files) {
            await this.processFile(file);
        }
        console.log('SyncService: Initial scan complete');
    }

    private async handleFileCreate(file: TAbstractFile) {
        this.updateActivity();
        if (this.remoteUpdateInProgress.has(file.path)) return;
        if (file instanceof TFile) {
            await this.processFile(file);
        }
    }

    private async handleFileModify(file: TAbstractFile) {
        this.updateActivity();
        if (this.remoteUpdateInProgress.has(file.path)) return;
        if (file instanceof TFile) {
            await this.processFile(file);
        }
    }

    private async handleFileDelete(file: TAbstractFile) {
        this.updateActivity();
        if (this.remoteUpdateInProgress.has(file.path)) return;
        if (file instanceof TFile) {
            const node = this.wasmBridge.getNode();
            if (node) {
                // Use current time as mtime for deletion
                const mtime = BigInt(Date.now());
                node.mark_file_deleted(file.path, mtime);
                console.log(`SyncService: Marked deleted ${file.path}`);
                this.broadcastDelete(file.path);
            }
        }
    }

    private async handleFileRename(file: TAbstractFile, oldPath: string) {
        this.updateActivity();
        if (this.remoteUpdateInProgress.has(file.path) || this.remoteUpdateInProgress.has(oldPath)) return;
        if (file instanceof TFile) {
            const node = this.wasmBridge.getNode();
            if (node) {
                // Mark old path as deleted
                const mtime = BigInt(Date.now());
                node.mark_file_deleted(oldPath, mtime);
                this.broadcastDelete(oldPath);
                // Add new path
                await this.processFile(file);
            }
        }
    }

    private async broadcastDelete(filePath: string) {
        const node = this.wasmBridge.getNode();
        if (!node) return;

        const peersJson = node.get_discovered_peers_json();
        const peers: DiscoveredPeerData[] = JSON.parse(peersJson);

        for (const peer of peers) {
            if (!this.securityService.isDevicePaired(peer.device_id)) continue;

            // Only send if we have an active connection?
            // For now, try to send. If not connected, it might fail or reconnect.
            // Ideally we check connection status.

            this.transport.send(peer.id, {
                type: 'FILE_DELETE',
                filePath: filePath
            });
        }
    }

    private async processFile(file: TFile) {
        const node = this.wasmBridge.getNode();
        if (!node) return;

        try {
            const content = await this.app.vault.readBinary(file);
            const mtime = BigInt(file.stat.mtime);
            const contentArray = new Uint8Array(content);

            const changed = node.update_file(file.path, contentArray, mtime);
            if (changed) {
                console.log(`SyncService: Updated ${file.path}`);
                // Trigger sync to all peers
                this.syncFileToAllPeers(file);
            }
        } catch (e) {
            console.error(`SyncService: Failed to process ${file.path}`, e);
        }
    }

    private async syncFileToAllPeers(file: TFile) {
        const node = this.wasmBridge.getNode();
        if (!node) return;

        const peersJson = node.get_discovered_peers_json();
        const peers: DiscoveredPeerData[] = JSON.parse(peersJson);

        for (const peer of peers) {
            // Check if paired
            if (!this.securityService.isDevicePaired(peer.device_id)) {
                continue;
            }

            // Get session key
            let sessionKey = this.securityService.getSessionKey(peer.id);
            if (!sessionKey) {
                await this.initiateSession(peer.id);
                continue;
            }

            if (sessionKey) {
                this.transferFile(file, peer.id, sessionKey);
            }
        }
    }

    public async initiateSession(peerId: string) {
        if (this.pendingSessionOffers.has(peerId)) return;

        try {
            console.log(`Initiating session with ${peerId}`);
            const { offer, keyExchange } = await this.securityService.createSessionOffer(peerId);
            this.pendingSessionOffers.set(peerId, keyExchange);
            this.transport.send(peerId, offer);
        } catch (e) {
            console.error(`Failed to initiate session with ${peerId}:`, e);
        }
    }

    private async handleMessage(message: any, peerId?: string) {
        if (!peerId) return;

        if (message.type === 'SESSION_OFFER') {
            try {
                console.log(`Received SESSION_OFFER from ${peerId}`);

                // Race Condition Handling:
                // If we also sent an offer (pendingSessionOffers has peerId), we need to decide who wins.
                // Tie-breaker: Lexicographical comparison of device IDs.
                // If myDeviceId < peerDeviceId: I am Leader. I ignore their offer (they will accept mine).
                // If myDeviceId > peerDeviceId: I am Follower. I accept their offer (and discard mine).

                if (this.pendingSessionOffers.has(peerId)) {
                    const myDeviceId = this.securityService.getDeviceId();
                    // We need peer's deviceId. It's in the message.
                    const peerDeviceId = message.deviceId;

                    if (myDeviceId < peerDeviceId) {
                        console.log(`Session Race: I am Leader (${myDeviceId} < ${peerDeviceId}). Ignoring their offer.`);
                        return;
                    } else {
                        console.log(`Session Race: I am Follower (${myDeviceId} > ${peerDeviceId}). Accepting their offer, discarding mine.`);
                        this.pendingSessionOffers.delete(peerId);
                    }
                }

                const answer = await this.securityService.handleSessionOffer(peerId, message);
                if (answer) {
                    this.transport.send(peerId, answer);
                    console.log(`Sent SESSION_ANSWER to ${peerId}`);
                }
            } catch (e) {
                console.error(`Error handling SESSION_OFFER from ${peerId}:`, e);
            }
            return;
        }

        if (message.type === 'SESSION_ANSWER') {
            try {
                console.log(`Received SESSION_ANSWER from ${peerId}`);
                const keyExchange = this.pendingSessionOffers.get(peerId);
                if (keyExchange) {
                    await this.securityService.handleSessionAnswer(peerId, message, keyExchange);
                    this.pendingSessionOffers.delete(peerId);
                    console.log(`Session established with ${peerId}`);

                    // Trigger sync on connect
                    this.syncAllFilesToPeer(peerId);
                } else {
                    console.warn(`Received SESSION_ANSWER from ${peerId} but no pending offer found`);
                }
            } catch (e) {
                console.error(`Error handling SESSION_ANSWER from ${peerId}:`, e);
            }
            return;
        }

        if (message.type === 'SYNC_REQUEST') {
            this.handleSyncRequest(peerId);
            return;
        }

        if (message.type === 'SYNC_RESPONSE') {
            this.handleSyncResponse(peerId, message);
            return;
        }

        if (message.type === 'FILE_REQUEST') {
            const file = this.app.vault.getAbstractFileByPath(message.filePath);
            if (file instanceof TFile) {
                const sessionKey = this.securityService.getSessionKey(peerId);
                if (sessionKey) {
                    this.transferFile(file, peerId, sessionKey);
                }
            }
            return;
        }

        if (message.type === 'FILE_DELETE') {
            console.log(`Received FILE_DELETE for ${message.filePath} from ${peerId}`);
            this.remoteUpdateInProgress.add(message.filePath);
            try {
                const file = this.app.vault.getAbstractFileByPath(message.filePath);
                if (file) {
                    await this.app.vault.delete(file);
                    new Notice(`Deleted ${message.filePath} (synced)`);
                }

                const node = this.wasmBridge.getNode();
                if (node) {
                    const mtime = BigInt(Date.now());
                    node.mark_file_deleted(message.filePath, mtime);
                }
            } catch (e) {
                console.error(`Failed to process remote delete for ${message.filePath}`, e);
            } finally {
                // Small delay to ensure watcher doesn't catch it
                setTimeout(() => {
                    this.remoteUpdateInProgress.delete(message.filePath);
                }, 1000);
            }
            return;
        }

        if (message.type === 'FILE_CHUNK') {
            // console.log(`Received chunk ${message.chunkIndex}/${message.totalChunks} for ${message.filePath} from ${peerId}`);

            const fileKey = `${peerId}:${message.filePath}`;

            // Update status
            const status: TransferStatus = this.activeTransfers.get(fileKey) || {
                id: fileKey,
                filePath: message.filePath,
                peerId: peerId,
                direction: 'incoming',
                progress: 0,
                totalSize: message.totalChunks, // Using chunks count as proxy for size for now
                state: 'transferring'
            };

            status.progress = (message.chunkIndex + 1) / message.totalChunks;
            this.activeTransfers.set(fileKey, status);
            this.trigger('transfer-progress', status);

            // Get session key (ensure we have one)
            let sessionKey = this.securityService.getSessionKey(peerId);
            if (!sessionKey) {
                console.warn(`Received FILE_CHUNK from ${peerId} without active session. Initiating handshake.`);
                await this.initiateSession(peerId);
                return;
            }

            if (!this.incomingChunks.has(fileKey)) {
                this.incomingChunks.set(fileKey, {
                    chunks: new Map(),
                    total: message.totalChunks,
                    path: message.filePath
                });
                this.trigger('transfer-start', status);
            }

            const transfer = this.incomingChunks.get(fileKey)!;
            transfer.chunks.set(message.chunkIndex, message);

            // Check if complete
            if (transfer.chunks.size === transfer.total) {
                console.log(`File transfer complete: ${message.filePath}`);
                status.state = 'completed';
                status.progress = 1;
                this.trigger('transfer-complete', status);

                await this.reassembleAndWrite(transfer, sessionKey);
                this.incomingChunks.delete(fileKey);

                // Remove from active transfers after a delay
                setTimeout(() => {
                    this.activeTransfers.delete(fileKey);
                    this.trigger('transfer-cleared', fileKey);
                }, 5000);
            }
        }
    }

    private async reassembleAndWrite(transfer: { chunks: Map<number, any>, total: number, path: string }, sessionKey: string) {
        try {
            // Sort chunks
            const sortedChunks = Array.from(transfer.chunks.entries())
                .sort((a, b) => a[0] - b[0])
                .map(entry => entry[1]);

            // Reconstruct JSON for Rust to decrypt
            // We need to reconstruct the array of chunks structure that TransferManager expects
            // But TransferManager.decrypt_chunk takes a single chunk.
            // So we decrypt each chunk and concatenate.

            const decryptedParts: Uint8Array[] = [];
            let totalLength = 0;

            for (const chunkMsg of sortedChunks) {
                // Construct the chunk object expected by Rust
                // We need to pass the data as it was received.
                // The data in message.data is likely an array of numbers (from JSON)
                // We need to ensure it's passed correctly.

                // Actually, `decrypt_chunk` takes a JSON string of the chunk object.
                // Let's reconstruct the object.
                const chunkObj = {
                    file_path: chunkMsg.filePath,
                    chunk_index: chunkMsg.chunkIndex,
                    total_chunks: chunkMsg.totalChunks,
                    data: chunkMsg.data,
                    nonce: chunkMsg.nonce
                };

                const chunkJson = JSON.stringify(chunkObj);
                const decrypted = this.transferManager.decrypt_chunk(chunkJson, sessionKey);
                decryptedParts.push(decrypted);
                totalLength += decrypted.length;
            }

            // Concatenate
            const fileContent = new Uint8Array(totalLength);
            let offset = 0;
            for (const part of decryptedParts) {
                fileContent.set(part, offset);
                offset += part.length;
            }

            // Write to disk
            const filePath = transfer.path;
            const adapter = this.app.vault.adapter;

            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (dir !== '.') {
                if (!(await adapter.exists(dir))) {
                    await adapter.mkdir(dir);
                }
            }

            // Write file
            // We need to convert Uint8Array to ArrayBuffer for Obsidian API
            this.remoteUpdateInProgress.add(filePath);
            await adapter.writeBinary(filePath, fileContent.buffer);

            // Update our journal so we don't sync it back
            const node = this.wasmBridge.getNode();
            if (node) {
                const mtime = BigInt(Date.now()); // We just wrote it
                node.update_file(filePath, fileContent, mtime);
            }

            // Remove from remoteUpdateInProgress after delay
            setTimeout(() => {
                this.remoteUpdateInProgress.delete(filePath);
            }, 1000);

            new Notice(`Received file: ${filePath}`);
            console.log(`Successfully wrote ${filePath}`);

        } catch (e) {
            console.error(`Failed to reassemble ${transfer.path}`, e);
            new Notice(`Failed to save received file: ${transfer.path}`);
        }
    }

    async transferFile(file: TFile, peerId: string, sessionKey: string) {
        if (!this.transferManager) {
            console.error('TransferManager not initialized');
            return;
        }

        const fileKey = `${peerId}:${file.path}`;
        const status: TransferStatus = {
            id: fileKey,
            filePath: file.path,
            peerId: peerId,
            direction: 'outgoing',
            progress: 0,
            state: 'pending'
        };
        this.activeTransfers.set(fileKey, status);
        this.trigger('transfer-start', status);

        try {
            const content = await this.app.vault.readBinary(file);
            const contentArray = new Uint8Array(content);

            // Prepare chunks
            const chunksJson = this.transferManager.prepare_transfer(file.path, contentArray, sessionKey);
            const chunks = JSON.parse(chunksJson);

            status.totalSize = chunks.length;
            status.state = 'transferring';
            console.log(`Transferring ${file.path} to ${peerId} in ${chunks.length} chunks`);

            if (chunks.length === 0) {
                // Handle empty file
                // We need to send at least one chunk to signal the file exists but is empty
                // Or we can send a special chunk with empty data
                // But wait, if chunks is empty, prepare_transfer might have returned empty array.
                // Let's see if we can force a chunk.
                // Actually, if contentArray is empty, prepare_transfer should probably return 1 chunk with empty data.
                // If it returns 0 chunks, we have a problem.
                // Let's manually construct a chunk if needed.

                // NOTE: This assumes the Rust side can handle a chunk with empty data.
                // If prepare_transfer returns empty for empty file, we need to fix Rust or handle here.
                // Let's assume we need to send a "dummy" chunk that decrypts to empty.
                // But we can't easily encrypt without Rust.

                // Alternative: Send a FILE_CHUNK with totalChunks=1, data=[], and handle it on receiver.
                // But receiver expects encrypted data.

                // Let's try to send a chunk with empty data if chunks is empty.
                // But we need a nonce and encryption.
                // If prepare_transfer returns empty, it means it didn't encrypt anything.

                // Let's check if content is empty.
                if (contentArray.length === 0) {
                     // We can't easily encrypt here without exposing encrypt_data.
                     // Let's assume for now that we skip empty files or that Rust handles it.
                     // If the user says "it is not being overwritten", it means 0 chunks are sent.

                     // Workaround: Send a special "FILE_EMPTY" message? Or just skip?
                     // User requirement: "when a change results in a file being empty... it is not being overwritten".

                     // Let's try to use encrypt_data from wasm if available.
                     // It is available in WasmModule interface: encrypt_data(keyB64, plaintext)

                     const module = this.wasmBridge.getModule();
                     if (module) {
                         const encrypted = module.encrypt_data(sessionKey, new Uint8Array(0));
                         const chunk = {
                             file_path: file.path,
                             chunk_index: 0,
                             total_chunks: 1,
                             data: Array.from(encrypted.get_data()),
                             nonce: Array.from(encrypted.get_nonce())
                         };

                         this.transport.send(peerId, {
                            type: 'FILE_CHUNK',
                            filePath: chunk.file_path,
                            chunkIndex: chunk.chunk_index,
                            totalChunks: chunk.total_chunks,
                            data: chunk.data,
                            nonce: chunk.nonce
                        });
                     }
                }
            }

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                this.transport.send(peerId, {
                    type: 'FILE_CHUNK',
                    filePath: chunk.file_path,
                    chunkIndex: chunk.chunk_index,
                    totalChunks: chunk.total_chunks,
                    data: chunk.data, // Array of numbers (bytes)
                    nonce: chunk.nonce
                });

                status.progress = (i + 1) / chunks.length;
                this.trigger('transfer-progress', status);

                // Simple backpressure/throttling
                await new Promise(r => setTimeout(r, 10));
            }

            status.state = 'completed';
            status.progress = 1;
            this.trigger('transfer-complete', status);
            new Notice(`Sent ${file.path} to peer`);

            // Remove from active transfers after a delay
            setTimeout(() => {
                this.activeTransfers.delete(fileKey);
                this.trigger('transfer-cleared', fileKey);
            }, 5000);

        } catch (e) {
            console.error(`Failed to transfer ${file.path}`, e);
            status.state = 'failed';
            status.error = String(e);
            this.trigger('transfer-error', status);
            new Notice(`Transfer failed: ${e}`);
        }
    }

    getTransfers(): TransferStatus[] {
        return Array.from(this.activeTransfers.values());
    }

    async syncAllFilesToPeer(peerId: string) {
        // Check if we have a session key first
        const sessionKey = this.securityService.getSessionKey(peerId);
        if (!sessionKey) {
            console.log(`Cannot sync with ${peerId} yet - no secure session. Initiating handshake.`);
            await this.initiateSession(peerId);
            return;
        }

        // Instead of pushing all files blindly, let's request a sync state exchange.
        // This allows us to handle deletions and updates more intelligently.
        console.log(`Initiating sync state exchange with ${peerId}`);
        this.transport.send(peerId, { type: 'SYNC_REQUEST' });
    }

    private async handleSyncRequest(peerId: string) {
        const node = this.wasmBridge.getNode();
        if (!node) return;

        // Get journal state to find deleted files
        const journalJson = node.get_journal_state();
        let journalFiles: Record<string, any> = {};

        try {
            const journal = JSON.parse(journalJson);
            // Rust ChangeJournal structure: { files: { "path": FileMetadata }, global_sequence: number }
            if (journal.files) {
                journalFiles = journal.files;
            }
        } catch (e) {
            console.warn("Failed to parse journal for sync response", e);
        }

        const files = this.app.vault.getFiles();
        const responseFiles = files.map(f => ({
            path: f.path,
            mtime: String(f.stat.mtime),
            isDeleted: false
        }));

        // Add deleted files from journal
        // We need to iterate the journal and find entries where is_deleted is true
        for (const [path, metadata] of Object.entries(journalFiles)) {
            if (metadata.is_deleted) {
                // Check if it's already in responseFiles (meaning it exists locally, so journal is outdated or conflict)
                // If it exists locally, we trust the local file existence over the journal's deletion marker
                // UNLESS the journal deletion is newer? No, if it exists, it exists.
                // But wait, if we deleted it, it shouldn't exist.
                // So if it's in journal as deleted, it shouldn't be in `files`.

                const existsLocally = responseFiles.some(f => f.path === path);
                if (!existsLocally) {
                    responseFiles.push({
                        path: path,
                        mtime: String(metadata.mtime),
                        isDeleted: true
                    });
                }
            }
        }

        this.transport.send(peerId, {
            type: 'SYNC_RESPONSE',
            files: responseFiles
        });
    }

    private async handleSyncResponse(peerId: string, message: any) {
        const remoteFiles = message.files as Array<{ path: string, mtime: string, isDeleted: boolean }>;
        console.log(`Received SYNC_RESPONSE from ${peerId} with ${remoteFiles.length} entries`);

        const node = this.wasmBridge.getNode();
        if (!node) return;

        // Get session key
        let sessionKey = this.securityService.getSessionKey(peerId);
        if (!sessionKey) {
             console.warn("No session key for sync response processing");
             return;
        }

        const remotePaths = new Set<string>();
        const journalJson = node.get_journal_state();
        let myDeletedFiles: Record<string, any> = {};

        try {
            const journal = JSON.parse(journalJson);
            // Rust ChangeJournal structure: { files: { "path": FileMetadata }, ... }
            if (journal.files) {
                for (const [path, metadata] of Object.entries(journal.files)) {
                    if ((metadata as any).is_deleted) {
                        myDeletedFiles[path] = (metadata as any).mtime;
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to parse journal in handleSyncResponse", e);
        }

        const changes: SyncChange[] = [];

        for (const remoteFile of remoteFiles) {
            remotePaths.add(remoteFile.path);
            const localFile = this.app.vault.getAbstractFileByPath(remoteFile.path);
            const remoteMtime = BigInt(remoteFile.mtime);

            if (remoteFile.isDeleted) {
                // Remote says deleted.
                if (localFile) {
                    // We have it. Check if our version is newer.
                    const localMtime = localFile instanceof TFile ? BigInt(localFile.stat.mtime) : BigInt(0);

                    // If local mtime < remote deletion time, we should delete it.
                    if (localMtime < remoteMtime) {
                        changes.push({
                            path: remoteFile.path,
                            type: 'delete',
                            reason: 'Remote deletion is newer'
                        });
                    }
                }
            } else {
                // Remote has file.
                if (!localFile) {
                    // We don't have it. Check if we deleted it recently.
                    const myDeletionTime = myDeletedFiles[remoteFile.path];

                    if (myDeletionTime && BigInt(myDeletionTime) > remoteMtime) {
                        // We deleted it AFTER they modified it. Keep deleted.
                        // PROACTIVE: Tell them to delete it too.
                        changes.push({
                            path: remoteFile.path,
                            type: 'push', // We push a delete command
                            reason: 'Local deletion is newer'
                        });
                    } else {
                        // We want it. Request it.
                        changes.push({
                            path: remoteFile.path,
                            type: 'pull',
                            reason: 'New remote file'
                        });
                    }
                } else if (localFile instanceof TFile) {
                    // We have it. Compare mtimes with tolerance.
                    const localMtime = BigInt(localFile.stat.mtime);
                    const diff = Number(remoteMtime - localMtime);

                    if (diff > 2000) {
                        // They have newer (by > 2s). Request it.
                        changes.push({
                            path: remoteFile.path,
                            type: 'pull',
                            reason: 'Remote is newer'
                        });
                    } else if (diff < -2000) {
                        // We have newer (by > 2s). Push it.
                        changes.push({
                            path: remoteFile.path,
                            type: 'push',
                            reason: 'Local is newer'
                        });
                    }
                }
            }
        }

        // Check for files we have that they don't
        const localFiles = this.app.vault.getFiles();
        for (const file of localFiles) {
            if (!remotePaths.has(file.path)) {
                // We have a file they don't mention.
                // Check if they deleted it?
                // If they deleted it, it would be in remoteFiles with isDeleted=true.
                // So if it's not in remoteFiles at all, they've never seen it (or their journal expired).
                // We should push it.
                changes.push({
                    path: file.path,
                    type: 'push',
                    reason: 'Remote missing file'
                });
            }
        }

        // Process Plan
        if (changes.length === 0) {
            new Notice("All files are up to date.");
            return;
        }

        const pushCount = changes.filter(c => c.type === 'push').length;
        const pullCount = changes.filter(c => c.type === 'pull').length;
        const delCount = changes.filter(c => c.type === 'delete').length;

        new Notice(`Sync Plan: ${pushCount} push, ${pullCount} pull, ${delCount} delete`);

        const executeSync = async () => {
            new Notice(`Syncing ${changes.length} files...`);
            for (const change of changes) {
                if (change.type === 'delete') {
                    console.log(`Applying remote deletion for ${change.path}`);
                    this.remoteUpdateInProgress.add(change.path);
                    const file = this.app.vault.getAbstractFileByPath(change.path);
                    if (file) {
                        await this.app.vault.delete(file);
                        node.mark_file_deleted(change.path, BigInt(Date.now()));
                    }
                    setTimeout(() => {
                        this.remoteUpdateInProgress.delete(change.path);
                    }, 1000);
                } else if (change.type === 'pull') {
                    this.transport.send(peerId, {
                        type: 'FILE_REQUEST',
                        filePath: change.path
                    });
                } else if (change.type === 'push') {
                    if (change.reason === 'Local deletion is newer') {
                         console.log(`Proactively sending delete for ${change.path} to ${peerId}`);
                        this.transport.send(peerId, {
                            type: 'FILE_DELETE',
                            filePath: change.path
                        });
                    } else {
                        const file = this.app.vault.getAbstractFileByPath(change.path);
                        if (file instanceof TFile) {
                            this.transferFile(file, peerId, sessionKey!);
                        }
                    }
                }
            }
        };

        if (changes.length > 10) {
            new ConfirmationModal(this.app, changes, executeSync).open();
        } else {
            executeSync();
        }
    }
}
