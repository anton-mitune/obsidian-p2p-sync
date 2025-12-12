import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import type P2PVaultSyncPlugin from '../../main';

export const SYNC_VIEW_TYPE = 'p2p-sync-view';

export class SyncView extends ItemView {
    plugin: P2PVaultSyncPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: P2PVaultSyncPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return SYNC_VIEW_TYPE;
    }

    getDisplayText() {
        return 'P2P Sync Status';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('h2', { text: 'P2P Sync Status' });

        const statusDiv = container.createDiv({ cls: 'p2p-sync-status' });

        // Overall Status
        const statusHeader = statusDiv.createEl('div', { cls: 'status-header' });
        statusHeader.createEl('span', { text: 'Status: ' });
        const statusText = statusHeader.createEl('span', { text: 'Idle', cls: 'status-text' });

        // Connected Peers
        statusDiv.createEl('h3', { text: 'Connected Peers' });
        const peersList = statusDiv.createEl('ul', { cls: 'peers-list' });

        this.updatePeersList(peersList);

        // Active Transfers
        statusDiv.createEl('h3', { text: 'Active Transfers' });
        const transfersList = statusDiv.createEl('div', { cls: 'transfers-list' });
        transfersList.createEl('p', { text: 'No active transfers', cls: 'empty-state' });

        // Refresh button
        const refreshBtn = container.createEl('button', { text: 'Refresh' });
        refreshBtn.onclick = () => {
            this.updatePeersList(peersList);
            this.updateTransfersList(transfersList);
            new Notice('Refreshed status');
        };

        // Register events
        // We need to bind the update function to preserve 'this' context if we used it,
        // but here we are passing the container.
        const updateTransfers = () => this.updateTransfersList(transfersList);

        // SyncService extends Events, so on() returns EventRef
        if (this.plugin.syncService) {
            this.registerEvent(this.plugin.syncService.on('transfer-start', updateTransfers));
            this.registerEvent(this.plugin.syncService.on('transfer-progress', updateTransfers));
            this.registerEvent(this.plugin.syncService.on('transfer-complete', updateTransfers));
            this.registerEvent(this.plugin.syncService.on('transfer-error', updateTransfers));
            this.registerEvent(this.plugin.syncService.on('transfer-cleared', updateTransfers));
        }
    }

    updatePeersList(container: HTMLElement) {
        container.empty();
        const node = this.plugin.wasmBridge?.getNode();
        if (node) {
            const peersJson = node.get_discovered_peers_json();
            const peers = JSON.parse(peersJson);

            if (peers.length === 0) {
                container.createEl('li', { text: 'No peers connected' });
            } else {
                for (const peer of peers) {
                    const li = container.createEl('li');
                    const portText = peer.service_port ? `:${peer.service_port}` : '';
                    li.createEl('span', { text: `${peer.name} (${peer.address}${portText})`, cls: 'peer-name' });
                    // Add status indicator (green dot)
                    li.createEl('span', { text: '●', cls: 'status-dot online' });
                }
            }
        } else {
            container.createEl('li', { text: 'P2P Node not initialized' });
        }
    }

    updateTransfersList(container: HTMLElement) {
        container.empty();
        if (!this.plugin.syncService) return;

        const transfers = this.plugin.syncService.getTransfers();

        if (transfers.length === 0) {
            container.createEl('p', { text: 'No active transfers', cls: 'empty-state' });
            return;
        }

        for (const transfer of transfers) {
            const item = container.createDiv({ cls: 'transfer-item' });
            const header = item.createDiv({ cls: 'transfer-header' });
            header.createSpan({ text: transfer.filePath, cls: 'transfer-file' });

            const directionIcon = transfer.direction === 'incoming' ? '↓' : '↑';
            const directionClass = transfer.direction === 'incoming' ? 'incoming' : 'outgoing';
            header.createSpan({ text: directionIcon, cls: `transfer-direction ${directionClass}` });

            const progressBar = item.createDiv({ cls: 'transfer-progress-bar' });
            progressBar.createDiv({
                cls: 'transfer-progress-fill',
                attr: { style: `width: ${transfer.progress * 100}%` }
            });

            const statusText = item.createDiv({ cls: 'transfer-status' });
            statusText.setText(`${Math.round(transfer.progress * 100)}% - ${transfer.state}`);
            if (transfer.error) {
                statusText.createSpan({ text: ` (${transfer.error})`, cls: 'error-text' });
            }
        }
    }

    async onClose() {
        // Cleanup
    }
}
