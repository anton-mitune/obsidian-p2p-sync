## US-002: Secure Pairing Flow

Title: Secure Pairing Flow

Summary:
As a user, I want to securely pair two devices so I can establish a trusted encrypted connection without exposing my private keys.

Acceptance Criteria:
- The pairing flow supports both QR-code scanning and short pairing codes.
- Pairing uses an authenticated key exchange; the devices display a confirmation code or fingerprint for user verification.
- Private keys never leave device storage; only ephemeral session keys are negotiated.
- The UI shows pairing status (pending, approved, rejected) and allows revocation of paired devices.

High-level Tech Spec:
- Generate per-device keypairs (Ed25519/X25519) stored locally (encrypted at rest).
- Exchange public keys + ephemeral nonces over discovery or an out-of-band channel; derive symmetric session keys with Noise protocol or X25519+HKDF.
- Implement QR and code generator in JS UI; Rust engine exposes pairing endpoints via IPC.
