import { Plugin, Notice, PluginSettingTab, App, Setting, FileSystemAdapter } from 'obsidian';
import { WasmBridge } from './src/wasm-bridge';
import { P2PDiscoveryService } from './src/discovery-service';
import { SecurityService } from './src/security-service';
import { PairingModal } from './src/ui/pairing-modal';
import { P2PSyncSettings } from './src/types';
import './src/ui/peer-list-view.css';
import * as fs from 'fs';
import * as path from 'path';

/**
 * P2P Vault Sync Plugin
 *
 * Secure, private peer-to-peer vault sync across devices without cloud services.
 *
 * Phase 1: LAN-first secure sync (MVP)
 * - Local peer discovery
 * - End-to-end encrypted sync
 * - File-level conflict detection
 */

// Default settings
const DEFAULT_SETTINGS: P2PSyncSettings = {
  deviceName: 'My Device',
  deviceId: '', // Will be generated on first load
  pairedDevices: [],
  enableLanDiscovery: true,
  discoveryTimeoutSeconds: 30,
  enableEncryption: true,
  autoSync: false,
  syncIntervalSeconds: 60,
  logLevel: 'info',
};

export default class P2PVaultSyncPlugin extends Plugin {
  private wasmBridge: WasmBridge | null = null;
  public discoveryService: P2PDiscoveryService | null = null;
  public securityService: SecurityService | null = null;
  private settings: P2PSyncSettings = { ...DEFAULT_SETTINGS };
  public settingTab: P2PSyncSettingTab | null = null;

  async onload() {
    console.log('Loading P2P Vault Sync plugin...');

    // Load settings
    await this.loadSettings();

    // Initialize Rust WASM module
    this.wasmBridge = new WasmBridge();

    // Construct absolute path to WASM file
    let wasmPath: string;
    const pluginDir = this.manifest.dir || '.';
    if (this.app.vault.adapter instanceof FileSystemAdapter) {
        wasmPath = path.join(this.app.vault.adapter.getBasePath(), pluginDir, 'pkg', 'obsidian_p2p_sync_bg.wasm');
    } else {
        // Fallback for mobile or non-fs adapters (might need different handling)
        wasmPath = path.join(pluginDir, 'pkg', 'obsidian_p2p_sync_bg.wasm');
    }

    try {
        const wasmBuffer = fs.readFileSync(wasmPath);
        const wasmInitialized = await this.wasmBridge.initialize(wasmBuffer);

        if (wasmInitialized) {
            console.log('WASM module initialized');

            let settingsChanged = false;

            // Ensure device ID exists
            if (!this.settings.deviceId) {
                // Generate a random UUID-like string
                this.settings.deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
                settingsChanged = true;
            }

            // Ensure device Name exists (if empty)
            if (!this.settings.deviceName) {
                this.settings.deviceName = this.generateDeviceName();
                settingsChanged = true;
            }

            if (settingsChanged) {
                await this.saveSettings();
            }

            // Initialize Security Service
            this.securityService = new SecurityService(this.wasmBridge, this.settings.deviceId);
            const secretKey = await this.securityService.initialize(this.settings.deviceSecretKey);

            if (secretKey !== this.settings.deviceSecretKey) {
                this.settings.deviceSecretKey = secretKey;
                await this.saveSettings();
            }

            // Create P2P node
            const p2pNode = this.wasmBridge.createOrGetNode(this.settings.deviceName, this.settings.deviceId);
            if (p2pNode) {
                // Initialize discovery service
                this.discoveryService = new P2PDiscoveryService({
                    deviceName: this.settings.deviceName,
                    timeoutMs: this.settings.discoveryTimeoutSeconds * 1000,
                });

                this.discoveryService.initialize(p2pNode);

                // Share transport with Security Service
                // We need to access the transport from discovery service or create a shared one
                // Currently DiscoveryService creates its own UdpTransport.
                // Let's expose it or pass it in.
                // For now, let's assume we can get it from DiscoveryService (I'll add a getter)
                // Or better, let's make DiscoveryService expose the transport.
                // Wait, I can't easily change DiscoveryService constructor without breaking things.
                // I'll add a getter to DiscoveryService.

                // Actually, let's just use the one from DiscoveryService if possible.
                // I need to modify DiscoveryService to expose transport.

                // Temporary hack: cast to any to access private transport (for MVP speed)
                // Ideally refactor to dependency injection.
                const transport = (this.discoveryService as any).transport;
                if (transport && this.securityService) {
                    this.securityService.setTransport(transport);

                    // Listen for pairing success
                    this.securityService.on('pairing_success', async (data: { deviceId: string, name: string }) => {
                        new Notice(`Successfully paired with ${data.name}!`);
                        const paired = this.settings.pairedDevices || [];
                        if (!paired.includes(data.deviceId)) {
                            this.settings.pairedDevices = [...paired, data.deviceId];
                            await this.saveSettings();

                            // Refresh UI if open
                            // We can emit an event or call a method on the setting tab if we had reference
                            // For now, let's just force a re-render if the tab is open
                            // This is a bit hacky but works for MVP
                            const settingTab = (this as any).settingTab;
                            if (settingTab && settingTab.renderPeerList) {
                                settingTab.renderPeerList();
                            }
                        }
                    });
                }

                console.log('Discovery service initialized');
                console.log('P2P Node status:', p2pNode.status());
            }
        }
    } catch (error) {
        console.error('Failed to initialize WASM:', error);
        new Notice('Failed to initialize P2P Sync engine');
    }

    // Add commands
    this.addCommand({
      id: 'pair-device',
      name: 'Pair with Device',
      callback: () => {
        if (this.securityService) {
            new PairingModal(this.app, this.securityService, this.settings.deviceName).open();
        } else {
            new Notice('P2P Engine not initialized');
        }
      },
    });

    this.addCommand({
      id: 'start-discovery',
      name: 'Start Peer Discovery',
      callback: () => {
        this.startDiscovery();
      },
    });

    this.addCommand({
      id: 'stop-discovery',
      name: 'Stop Peer Discovery',
      callback: () => {
        this.stopDiscovery();
      },
    });

    this.addCommand({
      id: 'test-rust-integration',
      name: 'Test Rust Integration',
      callback: () => {
        this.testRustIntegration();
      },
    });

    // Add settings tab
    this.settingTab = new P2PSyncSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);

    new Notice('P2P Vault Sync loaded successfully! 🎉');
  }

  async startDiscovery(): Promise<void> {
    if (!this.discoveryService) {
      new Notice('Discovery service not initialized');
      return;
    }

    try {
      if (!this.discoveryService.isDiscoveryActive()) {
        await this.discoveryService.startDiscovery();
        new Notice('🔍 Searching for peers...');
      } else {
        new Notice('Discovery already in progress');
      }
    } catch (error) {
      console.error('Error starting discovery:', error);
      new Notice('Failed to start discovery');
    }
  }

  stopDiscovery(): void {
    if (!this.discoveryService) {
      return;
    }

    this.discoveryService.stopDiscovery();
    new Notice('Discovery stopped');
  }

  testRustIntegration(): void {
    if (!this.wasmBridge) {
      new Notice('WASM bridge not initialized');
      return;
    }

    const message = this.wasmBridge.testIntegration('P2P Sync');
    new Notice(message);
    console.log('Rust integration test:', message);
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data || {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  generateDeviceName(): string {
    const adjectives = ['Red', 'Blue', 'Green', 'Fast', 'Quiet', 'Happy', 'Brave', 'Calm', 'Bright', 'Swift'];
    const nouns = ['Fox', 'Eagle', 'Bear', 'Wolf', 'Tiger', 'Lion', 'Hawk', 'Owl', 'Falcon', 'Badger'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj} ${noun} ${num}`;
  }

  getSettings(): P2PSyncSettings {
    return this.settings;
  }

  setSettings(settings: Partial<P2PSyncSettings>) {
    this.settings = Object.assign(this.settings, settings);
    this.saveSettings();
  }

  async onunload() {
    console.log('Unloading P2P Vault Sync plugin...');

    // Stop discovery
    if (this.discoveryService) {
      this.discoveryService.cleanup();
    }

    // Cleanup WASM
    if (this.wasmBridge) {
      this.wasmBridge.cleanup();
    }
  }
}

// Settings Tab
class P2PSyncSettingTab extends PluginSettingTab {
  plugin: P2PVaultSyncPlugin;
  private peerListContainer: HTMLElement | null = null;

  constructor(app: App, plugin: P2PVaultSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.plugin.getSettings();

    containerEl.empty();

    containerEl.createEl('h2', { text: 'P2P Vault Sync Settings' });

    // --- My Device Info ---
    const infoContainer = containerEl.createDiv('p2p-my-device-info');
    infoContainer.style.marginBottom = '20px';
    infoContainer.style.padding = '15px';
    infoContainer.style.background = 'var(--background-secondary)';
    infoContainer.style.borderRadius = '8px';

    const myDeviceHeader = infoContainer.createEl('h3', { text: 'My Device' });
    myDeviceHeader.style.marginTop = '0';

    const infoGrid = infoContainer.createDiv();
    infoGrid.style.display = 'grid';
    infoGrid.style.gridTemplateColumns = 'auto 1fr';
    infoGrid.style.gap = '10px';
    infoGrid.style.alignItems = 'center';

    const nameLabel = infoGrid.createEl('div', { text: 'Name:' });
    nameLabel.style.fontWeight = 'bold';
    nameLabel.style.color = 'var(--text-muted)';

    const nameValue = infoGrid.createEl('div', { text: settings.deviceName });
    nameValue.style.fontWeight = '600';

    const idLabel = infoGrid.createEl('div', { text: 'ID:' });
    idLabel.style.fontWeight = 'bold';
    idLabel.style.color = 'var(--text-muted)';

    const idContainer = infoGrid.createDiv();
    const idValue = idContainer.createSpan({ text: settings.deviceId });
    idValue.style.fontFamily = 'var(--font-monospace)';
    idValue.style.marginRight = '10px';

    // --- Peer Discovery Section ---
    containerEl.createEl('h3', { text: 'Available Devices' });
    const discoveryContainer = containerEl.createDiv('p2p-discovery-section');
    this.peerListContainer = discoveryContainer.createDiv('p2p-peer-list');

    // Start discovery when settings are opened
    if (this.plugin.discoveryService) {
        this.plugin.startDiscovery().catch(err => console.error(err));

        // Subscribe to events to update the list
        // We need to bind the render function to this instance
        this.plugin.discoveryService.on('peer_discovered', this.onPeerUpdate);
        this.plugin.discoveryService.on('peer_updated', this.onPeerUpdate);
        this.plugin.discoveryService.on('peer_lost', this.onPeerUpdate);
    } else {
        this.peerListContainer.createEl('div', { text: 'Discovery service not initialized', cls: 'p2p-error' });
    }

    this.renderPeerList();

    containerEl.createEl('hr');
    containerEl.createEl('h3', { text: 'Configuration' });

    // Device Name
    new Setting(containerEl)
      .setName('Device Name')
      .setDesc('The name of this device as seen by other peers')
      .addText((text) =>
        text
          .setPlaceholder('My Device')
          .setValue(settings.deviceName)
          .onChange(async (value) => {
            this.plugin.setSettings({ deviceName: value });
          })
      );

    // Enable LAN Discovery
    new Setting(containerEl)
      .setName('LAN Discovery')
      .setDesc('Enable automatic peer discovery on the local network')
      .addToggle((toggle) =>
        toggle
          .setValue(settings.enableLanDiscovery)
          .onChange(async (value) => {
            this.plugin.setSettings({ enableLanDiscovery: value });
          })
      );

    // Discovery Timeout
    new Setting(containerEl)
      .setName('Discovery Timeout')
      .setDesc('Time in seconds to search for peers')
      .addSlider((slider) =>
        slider
          .setLimits(10, 120, 10)
          .setValue(settings.discoveryTimeoutSeconds)
          .onChange(async (value) => {
            this.plugin.setSettings({ discoveryTimeoutSeconds: value });
          })
          .setDynamicTooltip()
      );

    // Enable Encryption
    new Setting(containerEl)
      .setName('End-to-End Encryption')
      .setDesc('Encrypt all data transfers between devices')
      .addToggle((toggle) =>
        toggle
          .setValue(settings.enableEncryption)
          .onChange(async (value) => {
            this.plugin.setSettings({ enableEncryption: value });
          })
      );

    // Auto Sync
    new Setting(containerEl)
      .setName('Auto Sync')
      .setDesc('Automatically sync changes with connected peers')
      .addToggle((toggle) =>
        toggle
          .setValue(settings.autoSync)
          .onChange(async (value) => {
            this.plugin.setSettings({ autoSync: value });
          })
      );

    // Sync Interval
    new Setting(containerEl)
      .setName('Sync Interval')
      .setDesc('Time in seconds between automatic syncs')
      .addSlider((slider) =>
        slider
          .setLimits(10, 300, 10)
          .setValue(settings.syncIntervalSeconds)
          .onChange(async (value) => {
            this.plugin.setSettings({ syncIntervalSeconds: value });
          })
          .setDynamicTooltip()
      );

    // Log Level
    new Setting(containerEl)
      .setName('Log Level')
      .setDesc('Verbosity of plugin logs')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('debug', 'Debug')
          .addOption('info', 'Info')
          .addOption('warn', 'Warn')
          .addOption('error', 'Error')
          .setValue(settings.logLevel)
          .onChange(async (value: any) => {
            this.plugin.setSettings({ logLevel: value });
          })
      );

    containerEl.createEl('hr');

    // About section
    containerEl.createEl('h3', { text: 'About' });
    const aboutEl = containerEl.createEl('div', { cls: 'setting-item' });
    aboutEl.createEl('div', {
      text: 'P2P Vault Sync - Secure peer-to-peer synchronization for Obsidian vaults',
      cls: 'setting-item-description',
    });
  }

  hide(): void {
    if (this.plugin.discoveryService) {
        this.plugin.discoveryService.removeListener('peer_discovered', this.onPeerUpdate);
        this.plugin.discoveryService.removeListener('peer_updated', this.onPeerUpdate);
        this.plugin.discoveryService.removeListener('peer_lost', this.onPeerUpdate);

        // Stop discovery when leaving settings to save resources
        this.plugin.stopDiscovery();
    }
  }

  private onPeerUpdate = () => {
    this.renderPeerList();
  }

  public renderPeerList(): void {
    if (!this.peerListContainer || !this.plugin.discoveryService) return;

    this.peerListContainer.empty();
    const peers = this.plugin.discoveryService.getPeers();

    if (peers.length === 0) {
        const emptyState = this.peerListContainer.createDiv('p2p-empty-state');
        emptyState.createEl('div', { text: 'No peers found yet.', cls: 'p2p-empty-message' });
        emptyState.createEl('div', { text: 'Make sure other devices are on the same Wi-Fi and have this plugin open.', cls: 'p2p-empty-help' });
        return;
    }

    const list = this.peerListContainer.createEl('div', { cls: 'p2p-peers-list' });
    const pairedDevices = this.plugin.getSettings().pairedDevices || [];

    peers.forEach(peer => {
        const item = list.createDiv('p2p-peer-item');

        const infoSection = item.createDiv('p2p-peer-info');
        const nameSection = infoSection.createDiv('p2p-peer-name-section');
        nameSection.createSpan({ cls: 'p2p-peer-icon', text: '🖥️' });
        nameSection.createSpan({ text: peer.name, cls: 'p2p-peer-name' });

        infoSection.createDiv({ cls: 'p2p-peer-id', text: `ID: ${peer.device_id.substring(0, 8)}...` });

        const lastSeen = new Date(peer.last_seen_timestamp).toLocaleTimeString();
        infoSection.createDiv({ cls: 'p2p-peer-lastseen', text: `Last seen: ${lastSeen}` });

        // Action Section
        const actionSection = item.createDiv('p2p-peer-actions');
        const isPaired = this.plugin.securityService?.isPaired(peer.device_id, pairedDevices);

        const pairBtn = actionSection.createEl('button', {
            text: isPaired ? 'Paired' : 'Pair',
            cls: isPaired ? 'mod-success' : 'mod-cta'
        }) as HTMLButtonElement;

        if (isPaired) {
            pairBtn.disabled = true;
            pairBtn.title = "This device is already paired";
        } else {
            pairBtn.onclick = () => {
                if (this.plugin.securityService) {
                    // Pass the target peer to the modal
                    new PairingModal(this.app, this.plugin.securityService, this.plugin.getSettings().deviceName, peer).open();
                }
            };
        }
    });
  }
}
