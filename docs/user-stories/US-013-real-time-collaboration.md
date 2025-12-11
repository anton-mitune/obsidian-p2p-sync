## US-013: Real-Time Collaboration (Phase 3)

Title: Real-Time Collaboration (Phase 3)

Summary:
As a user, I want near-real-time collaborative editing across devices for specific files so multiple devices can see edits with low latency.

Acceptance Criteria:
- Text edits propagate in near real-time (sub-second to a few seconds, depending on network).
- Conflicts on live edits are handled via CRDT or operational transform without user interruption.
- Users can disable real-time mode per-folder or per-file.
- Real-time collaboration is an opt-in feature and can be toggled off in settings.

High-level Tech Spec:
- Implement CRDT-based sync engine (Yjs/Automerge-like) or custom Rust CRDT for text files.
- Stream deltas over established P2P sessions; provide merging and persistence layer.
- Ensure backwards compatibility with file-level sync for non-collaborative files.
- Settings to control real-time sync per device or globally.
