## US-012: Internet P2P (Optional, Disabled by Default)

Title: Internet P2P (Optional, Disabled by Default)

Summary:
As an advanced user, I want optional internet-based P2P syncing so I can sync across networks while maintaining end-to-end encryption, but I want it disabled by default for safety.

Acceptance Criteria:
- Users can opt into "Internet Sync" mode via an explicit toggle in plugin settings.
- Internet P2P works only between devices that have been previously paired locally.
- Connections are established via NAT traversal (ICE/STUN/TURN) or relays when direct connection fails.
- Same encryption guarantees apply as LAN sync.
- When disabled, the plugin falls back to LAN-only discovery.

High-level Tech Spec:
- Integrate libp2p-WebRTC or ICE transports and support optional relay servers.
- Add UI toggles and settings for NAT traversal and relay configuration.
- Maintain same pairing and key exchange flows with explicit consent and prominent warnings.
- Default state: disabled; activation requires explicit user action.
