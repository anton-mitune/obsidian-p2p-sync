# **Product Roadmap: Obsidian P2P Vault Sync**

## **Phase 1 – LAN-First Secure Sync (MVP)**

**Goal:** Deliver a private, local-first P2P vault sync solution.

**Key Features:**
- Local peer discovery (Wi-Fi/LAN/Bluetooth/cable).
- End-to-end encrypted sync of vault files and attachments.
- File-level conflict detection and resolution.
- Simple Obsidian UI: plugin settings, sync status, conflict notifications.
- Cross-platform support (Windows, macOS, Linux).

**Tech Implementation:**
- Rust P2P engine using libp2p or litep2p.
- Node/JS plugin interface for UI and Obsidian integration.
- File watcher & metadata tracking for incremental sync.

**Outcome:** Users can securely sync their vault across devices on the same network without cloud services.

---

## **Phase 2 – Optional Internet-Based P2P Sync**

**Goal:** Enable secure P2P sync over the Internet while retaining LAN-first operation.

**Key Features:**
- NAT/firewall traversal with STUN/TURN/ICE.
- Optional manual peer connection for advanced users.
- Toggle in plugin UI for “Internet sync” mode.
- Maintain full end-to-end encryption.

**Tech Implementation:**
- Reuse Rust P2P engine; add internet-capable transport layer.
- Peer discovery over internet with fallback to relay servers.
- No major changes to existing sync logic; only transport layer extended.
**Outcome:** Users can sync vaults across distant devices securely, without changing local LAN behavior.

---

## **Phase 3 – Real-Time Collaborative Editing**
**Goal:** Enable live updates to files across multiple peers, similar to Google Docs.
**Key Features:**
- Fine-grained file sync (line/character level).
- Conflict-free merging with CRDTs or delta-based algorithms.
- Streaming updates over existing P2P connections.
- Plugin integration with Obsidian editor for real-time updates.
**Tech Implementation:**
- Implement CRDT or delta engine in Rust for text files.
- Extend P2P engine to stream incremental updates.
- JS plugin applies live changes to Obsidian editor events.
- Optional: fallback to file-level sync for non-text assets.
**Outcome:** Users experience near real-time collaboration across devices while retaining privacy and offline-first functionality.