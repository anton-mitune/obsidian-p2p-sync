import { Plugin, Notice } from 'obsidian';

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
export default class P2PVaultSyncPlugin extends Plugin {

	async onload() {
		console.log('Loading P2P Vault Sync plugin...');

		// Initialize Rust WASM module
		await this.initializeWasm();

		// Add ribbon icon for sync panel
		this.addRibbonIcon('sync', 'P2P Sync', () => {
			new Notice('P2P Vault Sync is ready! 🚀');
		});

		// Add command to test Rust integration
		this.addCommand({
			id: 'test-rust-integration',
			name: 'Test Rust Integration',
			callback: () => {
				this.testRustIntegration();
			}
		});

		new Notice('P2P Vault Sync loaded successfully!');
	}

	async initializeWasm() {
		try {
			// Import the WASM module
			// @ts-ignore - WASM module will be generated
			const wasm = await import('./pkg/obsidian_p2p_sync.js');

			// Load the WASM file manually to avoid import.meta.url issues in Electron/Obsidian
			const wasmPath = this.manifest.dir + '/pkg/obsidian_p2p_sync_bg.wasm';
			const wasmBuffer = await this.app.vault.adapter.readBinary(wasmPath);

			await wasm.default(wasmBuffer);

			// Test the connection
			const greeting = wasm.greet_from_rust('Obsidian');
			console.log('Rust WASM initialized:', greeting);

			// Store reference for later use
			// @ts-ignore
			this.wasm = wasm;
		} catch (error) {
			console.error('Failed to load WASM module:', error);
			new Notice('Warning: Rust WASM module not available. Run npm run build:wasm');
		}
	}

	testRustIntegration() {
		// @ts-ignore
		if (this.wasm) {
			// @ts-ignore
			const message = this.wasm.greet_from_rust('P2P Sync');
			new Notice(message);
			console.log('Rust integration test:', message);
		} else {
			new Notice('Rust WASM module not loaded');
		}
	}

	async onunload() {
		console.log('Unloading P2P Vault Sync plugin...');
	}
}
