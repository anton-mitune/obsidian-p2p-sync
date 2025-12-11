## US-003: Full Vault Sync

Title: Full Vault Sync

Summary:
As a user, I want to sync entire vault files when they change so all my notes and attachments are synchronized across devices in their entirety, ensuring consistency and eliminating partial state.

Acceptance Criteria:
- When a file changes, the entire file content is transferred to paired devices (not incremental patches).
- The sync completes with progress indicators (files transferred / total, ETA).
- Any transfer failures are retried automatically, and the UI shows clear errors for manual resolution.
- After completion, the destination vault matches the source vault's file list and metadata (mod times, hashes).
- Transfers are resumable; interrupted transfers can resume from the last acknowledged chunk.

High-level Tech Spec:
- Use chunked file transfer with resumable transfers; compress and encrypt payloads using authenticated encryption (XChaCha20-Poly1305 or AES-GCM).
- Maintain a change journal and per-file metadata (hash, mtime, device sequence) to verify completeness.
- Rust engine performs file walk and streaming; JS shows progress via IPC events.
- Implement backpressure-aware streaming and configurable concurrency limits for large vaults.
