# **Product Brief: Obsidian P2P Vault Sync Plugin**

## **1. Why – Context and Need**

Obsidian is a powerful knowledge management tool that stores notes and files locally. Users often want to access the same vault on multiple devices. Existing solutions (Obsidian Sync, cloud services) either:
- Require a paid subscription (Obsidian Sync) or
- Depend on cloud storage (Google Drive, Dropbox), introducing privacy and security concerns

**Problem:** Users want a **secure, private, local-first way** to sync vaults across devices **without relying on the internet**, while keeping the experience simple for non-technical users.

**Opportunity:** Build an Obsidian plugin that enables seamless **peer-to-peer (P2P) sync** across devices in the same local network (Wi-Fi, Bluetooth, cable), keeping data private and encrypted, and integrated directly within Obsidian.

---

## **2. What – Features and Example Use Cases**

### **Core Features**
1. **Local P2P Sync**
    - Automatically syncs notes, attachments, and metadata between devices on the same network.
    - Supports multiple devices in the same local network or direct connection.
2. **End-to-End Encryption**
    - All data transfers are encrypted before leaving the device.
    - Keys never leave the device; peers authenticate securely.
3. **Automatic Discovery & Connection**
    - Devices detect each other automatically on the local network.
    - Supports direct LAN connection, Bluetooth, or cable (optional).
4. **Conflict Detection & Resolution**
    - Identifies conflicting edits across devices.
    - Provides options to merge, overwrite, or review conflicts.
5. **Cross-Platform Compatibility**
    - Works on all devices that run Obsidian (Windows, macOS, Linux, mobile).
    - No additional app installation required.
6. **Integrated Obsidian UI**
    - Simple settings panel inside Obsidian.
    - Optional notifications for sync status, conflicts, or errors.
        

---

### **Example Use Cases**
- A researcher updates their vault on a laptop in the office; changes automatically appear on their tablet at home over local Wi-Fi.
- A team working on a local network shares an Obsidian vault without sending sensitive files over the internet.
- A solo user edits offline on a mobile device; when the device reconnects to the home LAN, all changes sync seamlessly.
    

---

## **3. How – Technical Overview (Simplified)**

### **Architecture**
1. **Rust-based P2P Engine**
    - Handles low-level networking, encryption, peer discovery, and data transfer.
    - Uses a mature P2P networking library (e.g., **rust-libp2p**) for secure, encrypted connections.
2. **Obsidian Plugin (JS/Electron Layer)**
    - Provides UI integration for settings, status, and conflict resolution.
    - Communicates with Rust engine via **Node.js bindings** or **IPC**        
3. **Local-first File Sync**
    - Watches vault folders for changes.
    - Computes file metadata, diffs, and conflicts.
    - Syncs only changed data across peers, minimizing bandwidth.
4. **Peer Discovery & Connection**
    - Scans local network using secure P2P discovery protocols.
    - Connects directly to other devices over TCP/UDP or WebRTC.
    - Optional fallback to manual device pairing if auto-discovery fails.
5. **Security & Privacy**
    - End-to-end encryption ensures that only authorized devices can read vault contents.
    - No cloud servers required; all data remains within local devices.
        

---

### **Tech Stack**

|Layer|Technology|Role|
|---|---|---|
|Networking & Sync Engine|Rust + libp2p|Handles P2P connections, encrypted transport, data streaming|
|Plugin UI & Integration|JavaScript / Node.js|Obsidian plugin interface, settings, notifications|
|Interprocess Communication|Node.js FFI / Native addon|JS ↔ Rust communication bridge|
|Cross-Platform Support|Precompiled Rust binaries per OS|Ensures the plugin runs on Windows, macOS, Linux, mobile|

---

**Outcome:** Users gain a secure, fast, fully local P2P sync solution for Obsidian vaults. It is simple enough for non-technical users, works across all their devices, and preserves privacy without relying on cloud services.