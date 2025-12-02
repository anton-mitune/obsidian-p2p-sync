# P2P Vault Sync - Demo Vault

Welcome to the P2P Vault Sync demo vault!

## Testing the Plugin

This vault is set up for testing the P2P Vault Sync plugin during development.

### Quick Test

1. Look for the sync icon (🔄) in the left ribbon
2. Click it to test the basic plugin functionality
3. Use Command Palette (`Cmd/Ctrl + P`) and search for "Test Rust Integration" to verify the Rust/WASM connection

### Sample Files

- [[Device A Notes]] - Simulates notes from first device
- [[Device B Notes]] - Simulates notes from second device
- [[Sync Log]] - Track sync events and conflicts

## Development Notes

The plugin auto-reloads when you run `npm run dev` and make changes to the source code.

### Plugin Features (Roadmap)

**Phase 1 - MVP** (Current)
- ✅ Basic plugin structure
- ✅ Rust/WASM integration
- 🚧 Local peer discovery
- 🚧 File sync engine
- 🚧 Conflict detection

**Phase 2**
- Internet P2P sync
- NAT traversal

**Phase 3**
- Real-time collaborative editing
- CRDT-based merging
