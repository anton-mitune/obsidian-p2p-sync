# Architecture: Obsidian P2P Vault Sync

## Overview

This document expands the technical overview for the Obsidian P2P Vault Sync Plugin. It describes the overall architecture, key components, and implementation considerations for building a secure, local-first peer-to-peer sync solution that integrates into Obsidian.

## High-level Architecture

- Rust-based P2P Engine
  - Responsibilities: peer discovery, encrypted transport, connection management, data streaming, and conflict resolution primitives.
  - Rationale: Rust provides predictable performance, memory safety, and easy cross-compilation for multiple target platforms.
  - Suggested libraries: `libp2p` for networking primitives, `ring` or `rust-crypto` for cryptography, and `sled` or similar for lightweight local storage when needed.

- Obsidian Plugin (JS/Electron layer)
  - Responsibilities: UI integration, settings UI, status notifications, conflict UI, and bridging to the Rust engine.
  - Communication: Use Node.js FFI, native addon, or spawn the Rust binary and use IPC (stdin/stdout or sockets) for command/response and events.

- File Sync Logic
  - Watch vault folders for file changes and compute file metadata and diffs.
  - Transfer incremental changes (patches or file diffs) rather than whole files where possible.
  - Maintain a change journal or lightweight metadata DB to handle conflict detection and history.

- Peer Discovery & Transport
  - Use mDNS, LAN multicast, or libp2p discovery mechanisms for auto-discovery on local networks.
  - Transport: libp2p supports multiple transports (TCP, WebRTC). Choose WebRTC for browser-like contexts or TCP for native.
  - Authentication: Use public/private key pairs with mutual authentication and an optional short-lived pairing code for new peers.

## Data Model & Conflict Resolution

- Metadata
  - Track per-file metadata: last-modified timestamp, device ID, a content hash, and a change vector or a sequence number.

- Conflict Detection
  - Detect conflicts using diverging change vectors or simultaneous edits with differing content hashes and timestamps.

- Conflict Resolution Strategies
  - Automatic merge for plain text using a 3-way merge where possible.
  - Present human-readable conflict UI with options: keep local, keep remote, or open diff/merge editor.

## Security

- End-to-End Encryption
  - Encrypt file contents before transmission using authenticated encryption (e.g., AES-GCM or XChaCha20-Poly1305).
  - Use per-device keypairs and establish symmetric session keys per connection using an authenticated key exchange (e.g., Noise protocols).

- Key Management
  - Keys are generated and stored locally; provide an export or backup option encrypted with a passphrase.
  - For pairing: display a short code or QR that proves possession of a key without sending the private key.

## Integration Approaches (JS ↔ Rust)

- Option A: Native Node Addon (N-API)
  - Pros: Low-latency, direct bindings.
  - Cons: Requires building native binaries per platform and may complicate plugin distribution.

- Option B: Spawned Rust Process + IPC
  - Pros: Simpler distribution (ship precompiled binaries), process isolation, easier debugging.
  - Cons: Cross-platform path and execution handling; more overhead for IPC.

- Option C: WASM via wasm-bindgen
  - Pros: Can run inside the same JS context, portable.
  - Cons: Networking (raw sockets) is limited in WASM; for native Electron apps, additional glue is required.

## Implementation Notes

- Performance
  - Minimize full-file transfers; use diffs or chunking and resumable transfers for large attachments.
  - Use background threads/async tasks in Rust for CPU-heavy work like diffing and crypto.

## Foundational Principles

- End-to-end encryption is integrated from day one: all inter-device traffic is encrypted with authenticated encryption and per-device keypairs.
- Security and minimal data exposure: private keys never leave device storage; pairing requires explicit user consent.
- Performance and scalability are first-class design goals: streaming, chunked and resumable transfers, and backpressure-aware networking.
- Local-first UX: LAN discovery and syncing are the default; optional internet-based connectivity is disabled by default.
- Local logging and diagnostics: basic local logs are available through plugin settings (log level, retention) for troubleshooting.

- Cross-platform packaging
  - Provide pre-built Rust artifacts for major platforms (macOS, Windows, Linux) and consider CI that builds releases.

- Testing
  - Unit tests for conflict and merge logic.
  - Integration tests that simulate multiple peers and network partitions.

## Suggested Tech Stack

- Networking & Sync Engine: Rust + libp2p
- Plugin UI & Integration: JavaScript / Node.js (Obsidian plugin)
- IPC: Native addon (N-API) or spawned binary + IPC
- Storage/Metadata: Local lightweight DB (sled, SQLite) or file-based journal

## Next Steps

- Decide JS ↔ Rust integration approach (N-API vs spawn vs WASM).
- Prototype peer discovery + secure connection with libp2p.
- Implement a basic sync loop for small text files and add conflict handling.
