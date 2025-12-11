## US-001: Local Peer Discovery

Title: Local Peer Discovery

Summary:
As a user, I want my device to automatically discover other devices running the plugin on the same local network so I can quickly connect and sync vaults without manual configuration.

Acceptance Criteria:
- The plugin scans the local network and lists available peers in the UI within 30 seconds of enabling discovery.
- Discovery works for devices in the same LAN using mDNS or equivalent.
- Each discovered peer shows a device name, device ID, and last-seen timestamp.
- If no peers are found, the UI shows a clear "No peers found" state and actionable next steps (e.g., "Enable LAN", "Open firewall instructions").

High-level Tech Spec:
- Use mDNS for LAN discovery; provide libp2p discovery or UDP broadcast fallback.
- Discovery runs in a background thread/service in the Rust engine and emits events through the JS bridge.
- Cache recent peers with TTL to avoid flicker; UI subscribes to events and updates list.
