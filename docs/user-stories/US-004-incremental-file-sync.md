## US-004: Incremental File Sync (Watch + Push)

Title: Incremental File Sync (Watch + Push)

Summary:
As a user, I want edits made on one device to be propagated to paired devices so my notes stay in sync automatically without manual action.

Acceptance Criteria:
- Local file changes are detected (create, modify, delete) within a configurable interval (default near-real-time watch).
- The plugin pushes updates to connected peers.
- Updates are applied on peers, preserving file structure and metadata.
- The UI shows sync status and last-synced timestamp per device.

High-level Tech Spec:
- Use a file watcher (Obsidian plugin host or `notify` crate) to detect changes; compute content hashes for validation.
- Use a change journal with per-file sequence numbers to produce ordered sync operations.
- Apply full-file transfer upon change detection; transfers encrypted and acknowledged.
