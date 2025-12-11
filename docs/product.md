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
    
