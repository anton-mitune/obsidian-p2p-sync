# Architecture Deep Dive: The "Brain & Hands" Model
## A Guide for Web Developers

If you are coming from a web development background (JavaScript, React, Node.js), the architecture of **Obsidian P2P Sync** might look a little strange. We are mixing TypeScript with Rust, compiling to WebAssembly (WASM), and doing networking in a way that may seem "backwards."

This guide explains **why** we made these choices and how the pieces fit together, using simple analogies.

---

## 1. Why Rust? (Why not just use TypeScript?)

You might ask: *"TypeScript is great! It has networking libraries, it's easy to write, and it runs everywhere. Why complicate things with Rust?"*

If we were building a chat app or a simple file copier, TypeScript would be perfect. But for a **Secure, Local-First Sync Engine**, we face three specific challenges where JavaScript struggles:

### A. The "Heavy Math" Problem (Encryption)
To sync files securely, we have to:
1.  Read a file (potentially 50MB+).
2.  Calculate a hash (SHA-256) to check for changes.
3.  Encrypt it (XChaCha20-Poly1305).

**In JavaScript:**
JS is single-threaded. If you try to encrypt a 50MB file in a loop, **the Obsidian UI will freeze**. You won't be able to type, scroll, or click until the loop finishes.

**In Rust:**
Rust is a systems language. It crunches numbers incredibly fast and manages memory efficiently. It can handle heavy encryption without breaking a sweat, keeping the UI buttery smooth.

### B. The "Data Safety" Problem
Sync engines are dangerous. If you have a bug in your logic—like merging two file versions incorrectly—you corrupt the user's data.
*   **JavaScript** is flexible. It lets you pass `null` where you shouldn't, or mutate state unexpectedly.
*   **Rust** is strict. Its compiler forces you to handle every edge case. It simply won't let you compile code that is memory-unsafe. For a tool that touches user data, this safety net is critical.

### C. The "Write Once, Run Anywhere" Factor
Right now, this is an Obsidian plugin. But in the future, we might want a command-line tool, an iOS app, or a background service.
*   **Rust Core:** We write the logic once. We compile it to WASM for Obsidian, a native binary for CLI, or a static library for iOS.

---

## 2. The Networking Twist (The "Sandbox" Problem)

So, we decided to use Rust. We compiled it to WebAssembly (WASM). Now we want to send a message to another computer.

**The Problem:**
Imagine WASM is a person locked in a soundproof room (a **Sandbox**).
*   They can do math.
*   They can write logic.
*   **But there are no windows.** They cannot see the network card. They cannot open a TCP or UDP socket.

If you try to use a standard Rust networking library inside WASM, it will crash because it looks for an Operating System, and WASM doesn't have one.

---

## 3. The Solution: The "Puppeteer" Pattern

To solve this, we use a hybrid architecture. Think of it like a human body:

### 🧠 The Brain (Rust / WASM)
*   **Role:** Logic, Decision Making, Encryption.
*   **Capabilities:** It decides *what* to send. It encrypts the data. It decides how to merge conflicting files.
*   **Limitation:** It cannot touch the outside world directly.

### 🖐️ The Hands (TypeScript / Node.js)
*   **Role:** I/O, Networking, UI.
*   **Capabilities:** It can draw buttons on the screen. Crucially, because Obsidian runs on Electron, **it has access to Node.js**. It can open real UDP/TCP sockets.
*   **Limitation:** It shouldn't do heavy thinking (encryption) or it will freeze.

### How they work together:

1.  **The Brain (Rust)** wants to announce itself to the network.
    *   It creates a JSON packet: `{"id": "DeviceA", "status": "online"}`.
    *   It calls out to the Hands: *"Hey, please broadcast this message."*
2.  **The Hands (TS)** take the message.
    *   They use Node.js (`dgram` module) to open a UDP socket.
    *   They broadcast the packet to the LAN.
3.  **The Hands (TS)** receive a reply from "DeviceB".
    *   They don't try to understand it. They just pass the raw text back to the Brain.
    *   *"Hey Brain, I found this packet."*
4.  **The Brain (Rust)** processes it.
    *   It parses the JSON.
    *   It verifies the data.
    *   It adds "DeviceB" to its internal map of peers.

---

## 4. What about `libp2p`?

You might hear about `libp2p`, a famous P2P networking library for Rust.

*   **Question:** *"If WASM can't open sockets, can we even use libp2p?"*
*   **Answer:** Yes, but we use it for the **Protocol**, not the **Transport**.

We don't use the part of `libp2p` that tries to open raw sockets (the "Truck"). We use the part that handles encryption, handshakes, and stream multiplexing (the "Contents").

We build our own "Truck" using TypeScript sockets, and we load the `libp2p` "Contents" onto it.

---

## Summary

| Feature | Who handles it? | Why? |
| :--- | :--- | :--- |
| **UI / Settings** | **TypeScript** | Easy to build UI in HTML/CSS. |
| **Networking (Sockets)** | **TypeScript** | WASM is sandboxed; Node.js has access to the network card. |
| **Encryption** | **Rust** | Performance. JS is too slow and blocks the UI. |
| **Sync Logic** | **Rust** | Safety. Rust prevents data corruption bugs. |
| **File Access** | **TypeScript** | Obsidian API gives us easy access to the vault. |

We use **TypeScript for the Pipes** and **Rust for the Intelligence**. This gives us the best of both worlds: the ease of Electron networking and the raw power of a systems language.
