# P2P Vault Sync

Secure, private peer-to-peer vault synchronization for Obsidian without cloud services.

## 🚀 Features (Roadmap)

### Phase 1 - LAN-First Secure Sync (MVP)
- 🚧 Local peer discovery (Wi-Fi/LAN)
- 🚧 End-to-end encrypted sync
- 🚧 File-level conflict detection & resolution
- 🚧 Cross-platform support (Windows, macOS, Linux)

### Phase 2 - Internet P2P Sync
- 🔜 NAT/firewall traversal
- 🔜 Remote peer connections
- 🔜 Relay server fallback

### Phase 3 - Real-Time Collaboration
- 🔜 Live collaborative editing
- 🔜 CRDT-based conflict-free merging
- 🔜 Character-level synchronization

## 📋 Prerequisites

- **Node.js** (v16+)
- **Rust** (latest stable) - [Install from rustup.rs](https://rustup.rs/)
- **wasm-pack** - `cargo install wasm-pack`

## 🛠️ Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Rust/WASM Module

```bash
npm run build:wasm
```

This compiles the Rust code to WebAssembly and generates JavaScript bindings in the `pkg/` directory.

### 3. Run Development Build

```bash
npm run dev
```

This starts the TypeScript compiler in watch mode and automatically copies changes to the demo vault.

### 4. Test in Obsidian

1. Open the `p2p-sync-demo-vault` folder in Obsidian
2. Go to Settings → Community Plugins
3. Enable "P2P Vault Sync"
4. Click the sync icon in the ribbon or use Command Palette

## 🏗️ Project Structure

```
obsidian-p2p-sync/
├── main.ts                  # Plugin entry point
├── src/                     # TypeScript source (future)
├── rust/                    # Rust/WASM core
│   ├── src/
│   │   └── lib.rs          # WASM bindings & P2P logic
│   └── Cargo.toml
├── pkg/                     # Generated WASM (gitignored)
├── p2p-sync-demo-vault/     # Test vault
│   ├── .obsidian/
│   │   └── plugins/
│   │       └── obsidian-p2p-sync/  # Auto-copied builds
│   └── *.md                # Sample notes
├── esbuild.config.mjs      # Build configuration
└── package.json
```

## 🧪 Testing

### Test Rust Integration

In Obsidian:
1. Open Command Palette (`Cmd/Ctrl + P`)
2. Run "Test Rust Integration"
3. You should see a greeting from Rust/WASM

### Manual Build

```bash
# Build everything
npm run build:all

# Build only WASM
npm run build:wasm

# Build only TypeScript (production)
npm run build
```

## 📚 Technical Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Plugin UI | TypeScript + Obsidian API | User interface, settings, notifications |
| Sync Engine | Rust + WASM | P2P networking, encryption, file sync |
| Transport | libp2p (planned) | Peer discovery, encrypted connections |
| Build | esbuild + wasm-pack | Fast bundling, WASM compilation |

## 🔐 Security

- **End-to-end encryption**: All data encrypted before leaving your device
- **No cloud servers**: Direct peer-to-peer connections only
- **Local-first**: Works offline, syncs when peers available

## 📖 Documentation

See the `docs/` folder for detailed documentation:
- [Product Brief](docs/product.md) - Why this exists
- [Roadmap](docs/roadmap.md) - Development phases

## 🤝 Contributing

This is currently a personal project. Feel free to fork and adapt to your needs.

## 📄 License

MIT License - See LICENSE file for details

## 👨‍💻 Author

Anton Mitune ([@anton-mitune](https://github.com/anton-mitune))

---

**Status**: 🚧 Early Development - Not ready for production use
