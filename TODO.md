# Global Project TODO List

## Project Phases

### Phase 1: MVP (LAN-First Secure Sync)

---

## US-001: Local Peer Discovery

**Status:** Completed

- [x] **Rust Engine**: Implement mDNS service advertisement
  - [x] Set up libp2p discovery or mdns-sd crate (Implemented via UDP broadcast + Rust state)
  - [x] Advertise device identity and service on LAN
  - [x] Emit discovery events with peer name, ID, last-seen timestamp
- [x] **Rust Engine**: Implement peer scanning/listening
  - [x] Listen for peer announcements on the network
  - [x] Cache discovered peers with TTL
  - [x] Implement UDP broadcast fallback if mDNS unavailable
- [x] **IPC Bridge**: Expose discovery events to JS plugin
  - [x] Define IPC message schema for peer discovery
  - [x] Stream discovered peers to plugin in real-time
- [x] **JS Plugin**: Build peer discovery UI
  - [x] Create "Available Devices" list view
  - [x] Show device name, ID, last-seen timestamp
  - [x] Display "No peers found" state with actionable help text
  - [x] Add manual refresh button for discovery
- [x] **Testing**: Integration test with two devices
  - [x] Verify peer discovery within 30 seconds
  - [x] Test TTL expiration and peer removal
  - [x] Test fallback discovery mechanism

---

## US-002: Secure Pairing Flow

**Status:** Not Started

- [ ] **Rust Engine**: Generate and store per-device keypairs
  - [ ] Generate Ed25519 keypair on first run
  - [ ] Generate X25519 keypair for key exchange
  - [ ] Encrypt private keys at rest (OS-specific secure storage or encrypted local file)
  - [ ] Persist public keys and device ID
- [ ] **Rust Engine**: Implement authenticated key exchange
  - [ ] Implement Noise protocol or X25519+HKDF for session key derivation
  - [ ] Generate ephemeral nonces and exchange public keys
  - [ ] Derive symmetric session keys and cache per connection
- [ ] **Rust Engine**: Implement pairing endpoints
  - [ ] Expose IPC endpoint for initiating pairing
  - [ ] Expose IPC endpoint for responding to pairing requests
  - [ ] Generate pairing codes (short codes and QR data)
  - [ ] Manage pairing state (pending, approved, rejected)
- [ ] **JS Plugin**: Build QR code pairing UI
  - [ ] Generate and display QR code from pairing code
  - [ ] Provide manual short code display and input
  - [ ] Show fingerprint confirmation for user verification
  - [ ] Display pairing status (pending, approved, rejected)
- [ ] **JS Plugin**: Build pairing settings UI
  - [ ] List paired devices with name, ID, date paired
  - [ ] Allow user to revoke paired devices (see US-014)
- [ ] **Testing**: Pairing flow tests
  - [ ] Unit tests for key generation and storage
  - [ ] Integration test: pair two devices via QR code
  - [ ] Integration test: pair two devices via short code
  - [ ] Test pairing rejection and retry

---

## US-003: Full Vault Sync

**Status:** Not Started

- [ ] **Rust Engine**: Implement file watcher and change journal
  - [ ] Watch vault directory for file changes (create, modify, delete)
  - [ ] Compute file hashes (SHA256) for change detection
  - [ ] Maintain change journal with per-file sequence numbers
  - [ ] Detect new files and changes since last sync
- [ ] **Rust Engine**: Implement file transfer protocol
  - [ ] Split files into chunks (configurable, e.g., 64KB per chunk)
  - [ ] Implement chunked transfer with checksums
  - [ ] Support resumable transfers (store manifest of completed chunks)
  - [ ] Compress payloads before encryption (optional, for small files)
- [ ] **Rust Engine**: Implement encryption and transport
  - [ ] Encrypt file chunks with XChaCha20-Poly1305 (authenticated encryption)
  - [ ] Use libp2p streams or TCP with backpressure-aware buffering
  - [ ] Implement acknowledgement and retry logic for failed chunks
  - [ ] Apply received files to destination vault with atomic writes
- [ ] **Rust Engine**: Implement metadata tracking
  - [ ] Store per-file metadata: hash, mtime, device ID, sequence number
  - [ ] Validate file completeness by comparing hashes
  - [ ] Maintain state for resumable transfers
- [ ] **Rust Engine**: Implement performance optimizations
  - [ ] Configurable concurrency limits (default: 2-4 parallel transfers)
  - [ ] Backpressure-aware streaming to prevent memory overflow
  - [ ] Bandwidth limiting (optional, configurable)
- [ ] **JS Plugin**: Build sync UI
  - [ ] Show list of files to sync with progress
  - [ ] Display progress indicators (files transferred / total, ETA)
  - [ ] Show transfer speed and remaining time
  - [ ] Allow pause/resume of sync
- [ ] **JS Plugin**: Build error handling UI
  - [ ] Show transfer errors with clear messages
  - [ ] Provide retry button for failed transfers
  - [ ] Log errors for debugging
- [ ] **Testing**: Full vault sync tests
  - [ ] Unit tests for file hashing and change detection
  - [ ] Unit tests for chunking and resumable transfers
  - [ ] Integration test: sync small vault (< 100 files)
  - [ ] Integration test: sync large vault (1000+ files)
  - [ ] Integration test: resume interrupted transfer
  - [ ] Performance test: measure transfer speed for large files

---

## US-004: Incremental File Sync (Watch + Push)

**Status:** Not Started

- [ ] **Rust Engine**: Implement continuous file watching
  - [ ] Use `notify` crate to watch vault directory
  - [ ] Debounce rapid file changes (e.g., batch changes within 1 second)
  - [ ] Detect file creation, modification, and deletion
  - [ ] Compute hashes for modified files
- [ ] **Rust Engine**: Implement incremental sync logic
  - [ ] Prioritize syncing changed files to connected peers
  - [ ] Use change journal to determine what to send
  - [ ] Update change vectors/sequence numbers on sync
  - [ ] Handle peer-specific sync state (track what each peer has)
- [ ] **Rust Engine**: Implement push mechanism
  - [ ] Automatically push changes to all connected, paired peers
  - [ ] Queue changes for offline peers; deliver on reconnection
  - [ ] Provide hooks for the plugin to trigger manual sync
- [ ] **JS Plugin**: Build watch/auto-sync UI
  - [ ] Display current sync status (Idle, Syncing, Last synced at X)
  - [ ] Show per-device sync status and last-synced timestamp
  - [ ] Provide button to manually trigger sync
  - [ ] Add toggle for auto-sync enable/disable
- [ ] **Testing**: Incremental sync tests
  - [ ] Unit tests for file watcher and debouncing
  - [ ] Integration test: edit a file and verify sync to peer
  - [ ] Integration test: sync multiple file changes in sequence
  - [ ] Integration test: handle offline peer and deliver on reconnect

---

## US-005: Conflict Detection (Keep Both)

**Status:** Not Started

- [ ] **Rust Engine**: Implement conflict detection logic
  - [ ] Track per-file metadata: last-synced hash, device ID, sequence number
  - [ ] On receiving a file change, detect divergence (both devices edited)
  - [ ] Compare hashes and sequence numbers to identify conflicts
  - [ ] Generate conflict signal/event
- [ ] **Rust Engine**: Implement conflict resolution (keep both)
  - [ ] Write remote version to conflict copy (e.g., `filename.conflict.TIMESTAMP.md`)
  - [ ] Preserve local version unchanged
  - [ ] Keep both files in vault for user review
  - [ ] Update metadata to mark conflict state
- [ ] **JS Plugin**: Build conflict notification UI
  - [ ] Display list of conflicting files
  - [ ] Show file location and conflict timestamp
  - [ ] Provide preview of both versions (local vs remote)
  - [ ] Link to conflict files in vault for manual review
- [ ] **Rust Engine & JS Plugin**: Implement conflict event streaming
  - [ ] Emit conflict events from Rust to JS with file details
  - [ ] Notify user via Obsidian notification API
  - [ ] Log conflicts for audit
- [ ] **Testing**: Conflict detection tests
  - [ ] Unit tests for conflict detection logic
  - [ ] Integration test: create conflict by editing same file on two devices
  - [ ] Integration test: verify both versions preserved
  - [ ] Integration test: multiple simultaneous conflicts

---

## US-010: Status, Logs, and Notifications

**Status:** Not Started

- [ ] **Rust Engine**: Implement logging infrastructure
  - [ ] Set up structured logging (tracing, log crate)
  - [ ] Log sync events: file transfer start/end, errors, conflicts
  - [ ] Log peer discovery, pairing, connection events
  - [ ] Include timestamps and context (device ID, file name, etc.)
- [ ] **Rust Engine**: Expose logs via IPC
  - [ ] Stream recent logs to JS plugin
  - [ ] Provide IPC endpoint to query historical logs
  - [ ] Implement log rotation (keep recent logs in memory)
- [ ] **JS Plugin**: Build status indicator UI
  - [ ] Display overall sync state: Idle, Syncing, Conflict, Error
  - [ ] Show in Obsidian status bar or as a UI component
  - [ ] Update status in real-time
- [ ] **JS Plugin**: Build logs viewer UI
  - [ ] Display recent logs with timestamps and events
  - [ ] Filter logs by event type (Sync, Conflict, Pairing, Error)
  - [ ] Provide export/copy logs button
  - [ ] Show logs in plugin settings panel
- [ ] **JS Plugin**: Build notification system
  - [ ] Use Obsidian's notification API for important events
  - [ ] Notify on conflicts detected
  - [ ] Notify on pairing requests
  - [ ] Notify on transfer failures
  - [ ] Make notifications dismissible
- [ ] **JS Plugin**: Build settings for logging
  - [ ] Log level selector (Debug, Info, Warn, Error)
  - [ ] Toggle for console logging
  - [ ] Clear logs button
  - [ ] Log retention setting (keep last N logs)
- [ ] **Testing**: Logging and notification tests
  - [ ] Unit tests for logging logic
  - [ ] Integration test: verify logs capture sync events
  - [ ] Integration test: verify notifications trigger on events
  - [ ] UI test: logs viewer displays correctly

---

## US-012: Internet P2P (Optional, Disabled by Default)

**Status:** Not Started

- [ ] **Rust Engine**: Implement NAT traversal support
  - [ ] Integrate libp2p-WebRTC or similar for ICE/STUN/TURN
  - [ ] Implement STUN client for NAT detection
  - [ ] Implement TURN relay support (optional relay server config)
  - [ ] Fall back to relay if direct connection not possible
- [ ] **Rust Engine**: Extend pairing for internet mode
  - [ ] Allow pairing with explicit peer address (IP:port or relay)
  - [ ] Store peer connection hints (direct address, relay address)
  - [ ] Reuse existing key exchange for internet connections
- [ ] **Rust Engine**: Implement internet discovery
  - [ ] Support optional peer registry or peer list
  - [ ] Allow manual addition of peers by address
  - [ ] Maintain connection state for internet peers
- [ ] **Rust Engine**: Implement safeguards
  - [ ] Require previous pairing before internet connection
  - [ ] Verify peer identity using existing keypairs
  - [ ] Log all internet connections for audit
- [ ] **JS Plugin**: Build internet sync settings UI
  - [ ] Add toggle for "Internet Sync" mode (default: OFF)
  - [ ] Warn user about internet sync risks
  - [ ] Allow manual peer address entry
  - [ ] Show relay server configuration options
- [ ] **JS Plugin**: Build internet peer management UI
  - [ ] List internet-capable peers separately
  - [ ] Show connection status and latency
  - [ ] Allow removing internet peers
- [ ] **Testing**: Internet P2P tests
  - [ ] Unit tests for NAT traversal logic
  - [ ] Integration test: pair two devices locally, enable internet sync
  - [ ] Integration test: sync over internet with NAT traversal
  - [ ] Security test: verify encryption over internet connection

---

## US-013: Real-Time Collaboration (Phase 3)

**Status:** Not Started

- [ ] **Rust Engine**: Implement CRDT for text files
  - [ ] Evaluate CRDT library (Yjs integration, Automerge, custom Rust CRDT)
  - [ ] Implement insert/delete operations on text
  - [ ] Implement conflict-free merging
  - [ ] Handle concurrent edits from multiple devices
- [ ] **Rust Engine**: Implement delta streaming
  - [ ] Stream text deltas over P2P connection
  - [ ] Apply deltas to local content in real-time
  - [ ] Maintain causality and ordering
- [ ] **Rust Engine**: Implement persistence
  - [ ] Persist CRDT state to disk periodically
  - [ ] On file save, finalize CRDT and write to disk
  - [ ] On file open, load CRDT state
- [ ] **JS Plugin**: Hook editor integration
  - [ ] Detect edits in Obsidian editor
  - [ ] Send deltas to Rust engine
  - [ ] Apply incoming deltas to editor in real-time
  - [ ] Handle editor focus/blur events
- [ ] **JS Plugin**: Build real-time collaboration UI
  - [ ] Show remote cursors/selections (optional)
  - [ ] Display active editors on remote devices
  - [ ] Show real-time sync status per file
  - [ ] Add toggle for real-time mode per-file or per-folder
- [ ] **JS Plugin**: Build settings for collaboration
  - [ ] Enable/disable real-time collaboration globally
  - [ ] Configure per-folder or per-file rules
  - [ ] Set conflicts handling (auto-merge or keep both)
- [ ] **Testing**: Real-time collaboration tests
  - [ ] Unit tests for CRDT operations
  - [ ] Integration test: two devices edit same file simultaneously
  - [ ] Integration test: verify delta streaming and real-time updates
  - [ ] Stress test: 5+ concurrent edits on same file
  - [ ] Performance test: measure latency of delta delivery

---

## US-014: Device Revocation & Trust Management

**Status:** Not Started

- [ ] **Rust Engine**: Implement device registry
  - [ ] Store paired devices: name, public key, device ID, trust status
  - [ ] Encrypt device registry at rest
  - [ ] Persist registry in local storage
- [ ] **Rust Engine**: Implement revocation logic
  - [ ] Mark device as revoked in registry
  - [ ] Reject new connections from revoked devices
  - [ ] Broadcast signed revocation message to peers (if online)
  - [ ] Invalidate cached session keys for revoked device
- [ ] **Rust Engine**: Implement trust verification
  - [ ] Verify peer identity on connection using keypairs
  - [ ] Check revocation status before accepting connection
  - [ ] Log all device authentication attempts
- [ ] **JS Plugin**: Build device management UI
  - [ ] List all paired devices: name, ID, date paired, last-seen
  - [ ] Show trust status (trusted, revoked)
  - [ ] Provide revoke button per device
  - [ ] Show confirmation dialog before revocation
- [ ] **JS Plugin**: Build device details view
  - [ ] Show device fingerprint/key ID
  - [ ] Show connection history (when paired, last synced)
  - [ ] Show data transferred
- [ ] **Testing**: Device revocation tests
  - [ ] Unit tests for registry storage and encryption
  - [ ] Integration test: pair, then revoke device
  - [ ] Integration test: verify revoked device cannot connect
  - [ ] Integration test: revocation broadcast to other peers

---

## US-018: Settings & Onboarding UX

**Status:** Not Started

- [ ] **Rust Engine**: Implement key generation on first run
  - [ ] Generate keypairs if not present
  - [ ] Emit event to plugin when ready
- [ ] **JS Plugin**: Build onboarding wizard
  - [ ] Show welcome screen explaining features
  - [ ] Ask to enable LAN discovery
  - [ ] Show key generation status
  - [ ] Provide "Get Started" next steps
  - [ ] Guide to pair first device
  - [ ] Guide to perform initial sync
- [ ] **JS Plugin**: Build settings panel (Connection tab)
  - [ ] Device name configuration
  - [ ] Enable/disable LAN discovery toggle
  - [ ] Show device ID and fingerprint
- [ ] **JS Plugin**: Build settings panel (Sync tab)
  - [ ] Enable/disable auto-sync toggle
  - [ ] Sync interval configuration
  - [ ] File exclusion patterns (future: US-009)
  - [ ] Show sync status and stats
- [ ] **JS Plugin**: Build settings panel (Privacy tab)
  - [ ] Show encryption status (enabled by default)
  - [ ] Show stored keys and data locations
  - [ ] Provide privacy summary
- [ ] **JS Plugin**: Build settings panel (Logging tab)
  - [ ] Log level selector
  - [ ] Show recent logs
  - [ ] Export logs button
  - [ ] Clear logs button
- [ ] **JS Plugin**: Build settings panel (Advanced tab)
  - [ ] Internet sync toggle (default: OFF)
  - [ ] NAT traversal settings
  - [ ] Relay server configuration
- [ ] **Testing**: Onboarding and settings tests
  - [ ] Manual test: fresh install onboarding flow
  - [ ] Manual test: navigate through all settings panels
  - [ ] Verify defaults are safe (E2EE on, internet off, discovery on)

---

## Infrastructure & Cross-Cutting Concerns

- [ ] **Project Setup**: Build system integration
  - [ ] Set up Cargo build for Rust engine
  - [ ] Configure wasm-bindgen for WASM target (if using WASM IPC)
  - [ ] Configure esbuild for TypeScript compilation
  - [ ] Set up hot reload for development
- [ ] **IPC Bridge**: Define and implement communication protocol
  - [ ] Document IPC message schema (JSON or binary)
  - [ ] Implement Rust-to-JS event streaming
  - [ ] Implement JS-to-Rust command sending
  - [ ] Add error handling and timeouts
- [ ] **Testing Infrastructure**: Set up test harness
  - [ ] Unit test framework for Rust (cargo test)
  - [ ] Unit test framework for TypeScript (Jest or Vitest)
  - [ ] Integration test simulator (two mock devices)
  - [ ] CI/CD pipeline (GitHub Actions)
- [ ] **CI/CD**: GitHub Actions workflows
  - [ ] Lint and format checks (Rust: clippy/rustfmt, TS: eslint/prettier)
  - [ ] Build for macOS, Windows, Linux
  - [ ] Run unit and integration tests on each commit
  - [ ] Build release artifacts on tags
- [ ] **Documentation**: Code and API docs
  - [ ] Rust API documentation (cargo doc)
  - [ ] TypeScript JSDoc comments
  - [ ] IPC protocol documentation
  - [ ] Architecture decision records (ADRs)
- [ ] **Security Audit**: Pre-release
  - [ ] Code review of cryptographic implementations
  - [ ] Test key storage and encryption
  - [ ] Test network traffic encryption
  - [ ] Review trust/pairing flow

---

## Known Constraints & Dependencies

- Obsidian Plugin API (v0.x.x) for UI and file access
- libp2p or equivalent for P2P networking
- Ring or equivalent for cryptographic operations
- Rust WASM or native binary for Rust engine
- Node.js IPC for plugin-to-engine communication

---

## Success Criteria (Phase 1 MVP)

- [x] 10 user stories defined
- [ ] All US-001 through US-005 complete and tested
- [ ] US-010, US-012 (disabled), US-013, US-014, US-018 complete and tested
- [ ] Plugin can be installed in Obsidian
- [ ] Two devices can discover, pair, and sync vaults on LAN
- [ ] Conflicts are detected and both versions preserved
- [ ] All transfers are encrypted end-to-end
- [ ] Logs and status visible in plugin UI
- [ ] Code is well-tested with >80% coverage for core sync logic

