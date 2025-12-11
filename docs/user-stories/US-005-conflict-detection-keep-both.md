## US-005: Conflict Detection (Keep Both)

Title: Conflict Detection (Keep Both)

Summary:
As a user, I want the system to detect conflicting edits made independently on different devices and keep both versions so I can manually decide what to do without losing work.

Acceptance Criteria:
- A conflict is detected when the same file has diverging content hashes and both versions have local edits since the last common sync point.
- When a conflict is detected, both versions are preserved: the local version and a `.conflict` or timestamped copy of the remote version.
- The system notifies users with a list of conflicting files and their locations.
- No automatic or smart merge is applied; the user decides how to proceed.

High-level Tech Spec:
- Track per-file metadata: last-synced hash, device ID, and sequence numbers.
- On receiving a change, compare change vectors and detect divergence. Mark file as conflict if both local and incoming edits exist.
- Write remote version to a conflict copy (e.g., `filename.conflict.TIMESTAMP.md`); preserve both in the vault.
- Emit conflict events to UI with file locations and timestamps.
