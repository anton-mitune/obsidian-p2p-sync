## US-014: Device Revocation & Trust Management

Title: Device Revocation & Trust Management

Summary:
As a user, I want to view and manage paired devices and revoke trust so I can keep control over which devices access my vault.

Acceptance Criteria:
- UI lists all paired devices with name, ID, last-seen, and trust status.
- Users can revoke a device; revocation stops future connections and invalidates session keys.
- Revocation does not delete data already transferred on remote devices (explicit separate action if needed).
- Device list shows date paired and last sync timestamp.

High-level Tech Spec:
- Maintain a local device registry with stored public keys and metadata; mark status as trusted/revoked.
- On revocation, broadcast a signed revocation message to peers; new connections from revoked devices are rejected.
- Persist registry in an encrypted local store.
