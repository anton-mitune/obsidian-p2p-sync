import { App, Modal, Setting } from 'obsidian';

export interface SyncChange {
    path: string;
    type: 'push' | 'pull' | 'delete';
    reason: string;
}

export class ConfirmationModal extends Modal {
    private changes: SyncChange[];
    private onConfirm: () => void;

    constructor(app: App, changes: SyncChange[], onConfirm: () => void) {
        super(app);
        this.changes = changes;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Confirm Sync Changes' });
        contentEl.createEl('p', { text: `There are ${this.changes.length} changes to sync.` });

        const list = contentEl.createEl('ul');
        // Show first 10 changes
        this.changes.slice(0, 10).forEach(change => {
            const li = list.createEl('li');
            li.setText(`${change.type.toUpperCase()}: ${change.path} (${change.reason})`);
        });

        if (this.changes.length > 10) {
            list.createEl('li', { text: `...and ${this.changes.length - 10} more.` });
        }

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Sync Now')
                .setCta()
                .onClick(() => {
                    this.onConfirm();
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
