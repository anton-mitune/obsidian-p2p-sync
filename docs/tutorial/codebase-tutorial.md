# Obsidian P2P Vault Sync - Codebase Tutorial

This tutorial provides a comprehensive guide to understanding the Obsidian P2P Vault Sync codebase. It is designed for developers who want to maintain, upgrade, or simply understand how the plugin works under the hood.

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Feature Deep Dive](#3-feature-deep-dive)
    - [3.1. Plugin Initialization & Discovery](#31-plugin-initialization--discovery)
    - [3.2. Secure Pairing](#32-secure-pairing)
    - [3.3. File Synchronization](#33-file-synchronization)

---

## 1. Project Overview

**Obsidian P2P Vault Sync** is a plugin for Obsidian that enables users to synchronize their notes and files directly between devices (e.g., Laptop <-> Desktop) over a local network (LAN) without relying on any third-party cloud servers.

**Problem Solved:**
Standard sync solutions (Obsidian Sync, Dropbox, iCloud) store your data on remote servers. This plugin solves the need for:
- **Privacy:** Data never leaves your local network (or is E2E encrypted if we add internet support later).
- **Ownership:** You own the infrastructure (your devices).
- **Speed:** LAN transfer speeds are typically much faster than internet uploads.

**Key Technologies:**
- **TypeScript/Node.js:** For the Obsidian plugin UI, file system integration, and networking glue.
- **Rust (WASM):** For performance-critical tasks, cryptographic operations, and maintaining the sync state (Change Journal).
- **WebAssembly (WASM):** The bridge that allows the Rust code to run inside the Obsidian (Electron/Mobile) environment.

---

## 2. High-Level Architecture

The project is a hybrid application. The "Brain" is written in Rust and compiled to WebAssembly, while the "Body" (UI, Network I/O, File I/O) is written in TypeScript.

### Core Components

1.  **`main.ts` (The Entry Point):**
    -   Initializes the plugin.
    -   Loads the WASM module.
    -   Sets up the services (`DiscoveryService`, `SecurityService`, `SyncService`).

2.  **`WasmBridge` (`src/wasm-bridge.ts`):**
    -   A wrapper around the raw WASM module.
    -   Handles loading the `.wasm` binary.
    -   Exposes the Rust classes (`P2PNode`, `DeviceIdentity`, `ChangeJournal`) to TypeScript.

3.  **Rust Core (`rust/src/`):**
    -   **`lib.rs`**: The main WASM interface. Defines the `P2PNode` which holds the state.
    -   **`crypto.rs`**: Handles Ed25519 signing (Identity), X25519 key exchange (Session keys), and AES-GCM encryption (File transfer).
    -   **`sync.rs`**: Implements the `ChangeJournal`—a database of file metadata (hashes, mtimes) used to detect changes.
    -   **`transfer.rs`**: Helper for chunking and encrypting files.

4.  **Services (TypeScript):**
    -   **`DiscoveryService`**: Uses UDP broadcast to find other peers on the LAN.
    -   **`SecurityService`**: Manages pairing, keys, and establishing secure sessions.
    -   **`SyncService`**: Watches the file system, triggers transfers, and handles incoming file data.
    -   **`TcpTransport`**: Manages the actual TCP connections for transferring data.

### How they work together

```mermaid
graph TD
    subgraph Obsidian Plugin (TS)
        UI[User Interface] --> Main
        Main --> Discovery[Discovery Service]
        Main --> Security[Security Service]
        Main --> Sync[Sync Service]
        
        Discovery -- UDP --> Network
        Sync -- TCP --> Network
        
        Sync -- File I/O --> Vault[Obsidian Vault]
    end
    
    subgraph Rust Core (WASM)
        Bridge[WasmBridge]
        Node[P2PNode]
        Crypto[Crypto Module]
        Journal[Change Journal]
        
        Main -.-> Bridge
        Bridge -.-> Node
        Security -.-> Crypto
        Sync -.-> Journal
    end
```

---

## 3. Feature Deep Dive

### 3.1. Plugin Initialization & Discovery

**Scenario:** You open Obsidian. The plugin loads. No peers are paired yet.

1.  **Initialization (`main.ts`):**
    -   The plugin reads the `obsidian_p2p_sync_bg.wasm` file and initializes the WASM runtime.
    -   It checks for a stored `deviceId` and `deviceName`. If missing, it generates them.
    -   It creates a `P2PNode` in Rust memory to hold the state.

2.  **Starting Discovery (`discovery-service.ts`):**
    -   The `DiscoveryService` starts a UDP socket on port `19840`.
    -   It begins a loop (every 2s) broadcasting an "Announcement" packet to `255.255.255.255`.
    -   **Packet Content:** JSON containing `peer_id`, `device_name`, `device_id`, and `service_port` (the TCP port for sync).

3.  **Receiving Announcements:**
    -   When a UDP packet arrives, `DiscoveryService` passes it to the Rust `P2PNode`.
    -   Rust parses it. If it's a valid announcement from *another* peer, it adds it to the `DiscoveredPeer` list.
    -   The UI polls this list to display available peers in the settings tab.

**Result:** You see a list of devices on your network in the plugin settings.

---

### 3.2. Secure Pairing

**Concept:** Pairing is the process of exchanging "Identity Cards" (Public Keys) so devices trust each other. We use **Ed25519** keys for identity.

**Why is it needed?**
Without pairing, anyone on the coffee shop Wi-Fi could sync your files. Pairing ensures you only talk to *your* devices.

**The Technical Flow:**

1.  **Identity Generation (`security-service.ts` / `crypto.rs`):**
    -   On first run, Rust generates a persistent **Ed25519 Keypair**.
    -   The **Private Key** is saved in `data.json` (should be encrypted, currently base64).
    -   The **Public Key** is your device's ID card.

2.  **The Handshake (Pairing Request):**
    -   User clicks "Generate Code" on Device A. Device A displays a code (e.g., "123456") and listens.
    -   User enters this code on Device B and clicks "Pair".
    -   Device B sends a `pairing_request` JSON via UDP to Device A, containing the code.
    -   **Crucial Step:** The request includes Device B's Public Key.

3.  **Verification:**
    -   Device A receives the request.
    -   It checks if the received code matches the one it generated.
    -   Device A sends back a `pairing_response`.
    -   **Crucial Step:** The response includes Device A's Public Key and is **Signed** with Device A's Private Key.

4.  **Completion:**
    -   Device A receives the response and verifies the signature using Device B's Public Key.
    -   Both devices now save each other's Public Keys in their `pairedDeviceKeys` list.
    -   They are now "Paired".

---

### 3.3. File Synchronization

**Concept:** Once paired, devices establish a secure session to transfer files.

**Important Distinction: Discovery vs. Connection**
-   **Discovery (UDP):** Devices broadcast their presence. They "see" each other but aren't connected.
-   **Connection (TCP):** Once discovered, the plugin automatically opens a TCP socket to the peer. This is the "pipe" used for data.
-   **Session (Secure):** We perform a handshake over the TCP pipe to encrypt it.

**1. Session Establishment (The Handshake):**
Before sending files, we need a secure tunnel. We don't use TLS; we implement a custom application-level encryption (Noise-like).

-   **Step A (Offer):** Device A generates a temporary **X25519** keypair (Ephemeral Key). It signs the public part with its Identity Key and sends it to B.
-   **Step B (Answer):** Device B verifies the signature (using A's stored Identity Key). B generates its own Ephemeral Key, computes the **Shared Secret** (ECDH), and sends its Ephemeral Public Key back to A.
-   **Step C (Key Derivation):** Device A receives B's key, verifies it, and computes the *same* Shared Secret.
-   **Result:** Both sides now have a `sessionKey` (AES-256-GCM key) that only they know. This key is used to encrypt all file transfers for this session.

**Handling Race Conditions (Simultaneous Handshakes):**
Since both devices might try to initiate a session when they connect, we implement a **Leader/Follower** tie-breaker to prevent stuck states.
-   We compare the `deviceId` strings of both peers.
-   **Leader:** The device with the *smaller* ID (lexicographically). It ignores incoming offers and insists on its own.
-   **Follower:** The device with the *larger* ID. It yields to the Leader, discarding its own pending offer and accepting the Leader's.

**2. Initial Reconciliation (Sync State Exchange):**
When the TCP connection is established and the Secure Session is ready, they need to figure out who has the latest version of each file.
-   **Step A (Request):** Device A sends a `SYNC_REQUEST`.
-   **Step B (Response):** Device B looks at its Vault and its **Change Journal** (to find deleted files) and sends back a `SYNC_RESPONSE` containing a list of all files with their modification times (`mtime`) and deletion status.
-   **Step C (Comparison):** Device A compares this list with its own:
    -   If Remote has a newer file: Device A sends `FILE_REQUEST`.
    -   If Local has a newer file: Device A pushes it immediately.
    -   If Remote says a file is deleted (and it's newer than local): Device A deletes it locally.

**3. The Live Sync Loop (`sync-service.ts`):**
Once reconciled, the plugin watches for real-time changes.
-   **File Watcher:** The plugin watches the Obsidian Vault.
-   **On Change:** When you edit `Note.md`:
    1.  `SyncService` reads the file.
    2.  It updates the Rust `ChangeJournal` (calculates SHA256 hash).
    3.  If the hash changed, it triggers a push to all connected peers.

**4. File Transfer:**
-   **Chunking:** The file is split into 64KB chunks.
-   **Encryption:** Each chunk is encrypted in Rust using the `sessionKey` and a random Nonce.
-   **Transport:** The encrypted chunks are sent over TCP.
-   **Reassembly:**
    -   Receiver gets `FILE_CHUNK` messages.
    -   It buffers them until all chunks arrive.
    -   It passes the encrypted data to Rust.
    -   Rust decrypts it using the `sessionKey`.
    -   The plugin writes the decrypted file to disk.

**5. Deletion:**
-   If a file is deleted locally, a `FILE_DELETE` message is sent.
-   The receiver deletes the file and updates its `ChangeJournal` to mark it as "tombstoned" (deleted) to prevent re-syncing it back.

### 3.4. Connection Lifecycle & Resource Management

To ensure the plugin doesn't waste system resources or keep ports open unnecessarily:

1.  **Inactivity Timeout:**
    -   The `SyncService` tracks the time of the last activity (file change, message received).
    -   If no activity occurs for **5 minutes**, the plugin automatically closes all TCP connections.

2.  **Auto-Reconnect:**
    -   When the user modifies a file locally, the plugin wakes up.
    -   It checks if paired peers are online (via Discovery).
    -   If they are online but not connected, it automatically re-establishes the TCP connection and Secure Session to sync the new change.

---
