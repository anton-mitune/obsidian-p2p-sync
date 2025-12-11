import { App, Modal, Setting, Notice } from 'obsidian';
import { SecurityService } from '../security-service';
import { DiscoveredPeerData } from '../types';

export class PairingModal extends Modal {
    private securityService: SecurityService;
    private deviceName: string;
    private targetPeer: DiscoveredPeerData | null;

    constructor(app: App, securityService: SecurityService, deviceName: string, targetPeer: DiscoveredPeerData | null = null) {
        super(app);
        this.securityService = securityService;
        this.deviceName = deviceName;
        this.targetPeer = targetPeer;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Secure Pairing' });

        if (this.targetPeer) {
            contentEl.createEl('p', { text: `Pairing with: ${this.targetPeer.name}`, cls: 'pairing-target-info' });
        }

        // Device Info Section
        const infoContainer = contentEl.createDiv('pairing-info-container');
        infoContainer.createEl('h3', { text: 'My Device' });

        new Setting(infoContainer)
            .setName('Device Name')
            .setDesc(this.deviceName)
            .addButton(btn => btn.setButtonText('Copy').onClick(() => {
                navigator.clipboard.writeText(this.deviceName);
                new Notice('Copied to clipboard');
            }));

        const fingerprint = this.securityService.getFingerprint();
        new Setting(infoContainer)
            .setName('Device Fingerprint')
            .setDesc(fingerprint)
            .addButton(btn => btn.setButtonText('Copy').onClick(() => {
                navigator.clipboard.writeText(fingerprint);
                new Notice('Copied to clipboard');
            }));

        contentEl.createEl('hr');

        // Pairing Actions
        contentEl.createEl('h3', { text: 'Pair with Device' });

        const actionContainer = contentEl.createDiv('pairing-actions');

        // Generate Code
        new Setting(actionContainer)
            .setName('Generate Pairing Code')
            .setDesc('Show a code to enter on another device')
            .addButton(btn => btn
                .setButtonText('Generate Code')
                .setCta()
                .onClick(() => {
                    const code = this.securityService.generatePairingCode();
                    this.showCode(code);
                }));

        // Enter Code
        let enteredCode = '';
        new Setting(actionContainer)
            .setName('Enter Pairing Code')
            .setDesc('Enter code displayed on another device')
            .addText(text => text
                .setPlaceholder('123456')
                .onChange(value => {
                    enteredCode = value;
                }))
            .addButton(btn => btn
                .setButtonText('Connect')
                .setCta()
                .onClick(async () => {
                    if (this.securityService.verifyPairingCodeFormat(enteredCode)) {
                        if (this.targetPeer) {
                            new Notice(`Connecting to ${this.targetPeer.name}...`);
                            try {
                                await this.securityService.initiatePairing(this.targetPeer, enteredCode);
                                new Notice('Pairing successful!');
                                this.close();
                            } catch (e) {
                                new Notice(`Pairing failed: ${e}`);
                            }
                        } else {
                            new Notice('No target peer selected. Please select a peer from the list.');
                        }
                    } else {
                        new Notice('Invalid code format. Must be 6 digits.');
                    }
                }));
    }

    showCode(code: string) {
        const { contentEl } = this;
        // Clear previous code display if any, or just append
        // For simplicity, let's just show a modal or alert, or replace content
        // Better: Create a subsection

        const existingDisplay = contentEl.querySelector('.code-display');
        if (existingDisplay) existingDisplay.remove();

        const codeDisplay = contentEl.createDiv('code-display');
        codeDisplay.style.textAlign = 'center';
        codeDisplay.style.margin = '20px 0';
        codeDisplay.style.padding = '20px';
        codeDisplay.style.background = 'var(--background-secondary)';
        codeDisplay.style.borderRadius = '8px';

        codeDisplay.createEl('h1', { text: code, cls: 'pairing-code' });
        codeDisplay.createEl('p', { text: 'Enter this code on the other device within 60 seconds.' });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
