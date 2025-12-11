import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const vaultDir = path.join(rootDir, 'p2p-sync-demo-vault');
const pluginDir = path.join(vaultDir, '.obsidian', 'plugins', 'obsidian-p2p-sync');

console.log('🔄 Setting up demo vault...');

// 1. Prune existing vault
if (fs.existsSync(vaultDir)) {
    console.log('  🗑️  Pruning existing vault...');
    fs.rmSync(vaultDir, { recursive: true, force: true });
}

// 2. Create vault structure
console.log('  📂 Creating vault structure...');
fs.mkdirSync(pluginDir, { recursive: true });

// 3. Create sample content
console.log('  📝 Creating sample notes...');
fs.writeFileSync(path.join(vaultDir, 'README.md'), '# P2P Sync Demo Vault\n\nThis is a generated test vault for the Obsidian P2P Sync plugin.\n');
fs.writeFileSync(path.join(vaultDir, 'Note A.md'), '# Note A\n\nThis is a sample note.\n');
fs.writeFileSync(path.join(vaultDir, 'Note B.md'), '# Note B\n\nAnother sample note.\n');

// 4. Create plugin config (data.json)
console.log('  ⚙️  Generating initial plugin configuration...');
// Leave identity empty so it's generated/set on first load
const deviceName = "";
const deviceId = "";

const config = {
    deviceName: deviceName,
    deviceId: deviceId,
    pairedDevices: [],
    enableLanDiscovery: true,
    discoveryTimeoutSeconds: 30,
    enableEncryption: true,
    autoSync: false,
    syncIntervalSeconds: 60,
    logLevel: 'info'
};

fs.writeFileSync(path.join(pluginDir, 'data.json'), JSON.stringify(config, null, 2));

// 5. Enable plugin
console.log('  🔌 Enabling plugin...');
const communityPluginsPath = path.join(vaultDir, '.obsidian', 'community-plugins.json');
fs.writeFileSync(communityPluginsPath, JSON.stringify(['obsidian-p2p-sync'], null, 2));

console.log(`  ✅ Configured with empty identity (will generate on load)`);
console.log('✨ Demo vault setup complete!');
