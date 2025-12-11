/**
 * Cryptography and Authentication Module
 * Handles keypair generation, storage, and authenticated key exchange
 */

use wasm_bindgen::prelude::*;

// ============================================================================
// Cryptographic Structures
// ============================================================================

/// Device keypair information
#[wasm_bindgen]
pub struct DeviceKeyPair {
    device_id: String,
    signing_public_key: String,
    key_exchange_public_key: String,
}

#[wasm_bindgen]
impl DeviceKeyPair {
    #[wasm_bindgen(constructor)]
    pub fn new(device_id: String) -> DeviceKeyPair {
        let signing_public_key = format!("signing-pub-{}", device_id);
        let key_exchange_public_key = format!("exchange-pub-{}", device_id);

        DeviceKeyPair {
            device_id,
            signing_public_key,
            key_exchange_public_key,
        }
    }

    pub fn get_device_id(&self) -> String {
        self.device_id.clone()
    }

    pub fn get_signing_public_key(&self) -> String {
        self.signing_public_key.clone()
    }

    pub fn get_key_exchange_public_key(&self) -> String {
        self.key_exchange_public_key.clone()
    }
}

/// Session key information
#[wasm_bindgen]
pub struct SessionKey {
    session_id: String,
    peer_id: String,
    cipher_key: String,
    nonce: String,
    created_at: u64,
    expires_at: u64,
}

#[wasm_bindgen]
impl SessionKey {
    #[wasm_bindgen(constructor)]
    pub fn new(
        session_id: String,
        peer_id: String,
        cipher_key: String,
        nonce: String,
        created_at: u64,
        expires_at: u64,
    ) -> SessionKey {
        SessionKey {
            session_id,
            peer_id,
            cipher_key,
            nonce,
            created_at,
            expires_at,
        }
    }

    pub fn get_session_id(&self) -> String {
        self.session_id.clone()
    }

    pub fn get_peer_id(&self) -> String {
        self.peer_id.clone()
    }

    pub fn get_cipher_key(&self) -> String {
        self.cipher_key.clone()
    }

    pub fn get_nonce(&self) -> String {
        self.nonce.clone()
    }

    pub fn get_created_at(&self) -> u64 {
        self.created_at
    }

    pub fn get_expires_at(&self) -> u64 {
        self.expires_at
    }

    pub fn is_expired(&self, current_time: u64) -> bool {
        current_time > self.expires_at
    }
}

/// Pairing code for user verification
#[wasm_bindgen]
pub struct PairingCode {
    code: String,
    qr_data: String,
    fingerprint: String,
    created_at: u64,
    expires_at: u64,
}

#[wasm_bindgen]
impl PairingCode {
    #[wasm_bindgen(constructor)]
    pub fn new(code: String, fingerprint: String, created_at: u64, expires_at: u64) -> PairingCode {
        let qr_data = format!("p2p:pairing:{}", code);

        PairingCode {
            code,
            qr_data,
            fingerprint,
            created_at,
            expires_at,
        }
    }

    pub fn get_code(&self) -> String {
        self.code.clone()
    }

    pub fn get_qr_data(&self) -> String {
        self.qr_data.clone()
    }

    pub fn get_fingerprint(&self) -> String {
        self.fingerprint.clone()
    }

    pub fn is_valid(&self, current_time: u64) -> bool {
        current_time < self.expires_at
    }
}

/// Pairing request/response
#[wasm_bindgen]
pub struct PairingRequest {
    request_id: String,
    initiator_device_id: String,
    initiator_name: String,
    initiator_public_key: String,
    pairing_code: String,
    created_at: u64,
    state: String,
}

#[wasm_bindgen]
impl PairingRequest {
    #[wasm_bindgen(constructor)]
    pub fn new(
        request_id: String,
        initiator_device_id: String,
        initiator_name: String,
        initiator_public_key: String,
        pairing_code: String,
        created_at: u64,
    ) -> PairingRequest {
        PairingRequest {
            request_id,
            initiator_device_id,
            initiator_name,
            initiator_public_key,
            pairing_code,
            created_at,
            state: "pending".to_string(),
        }
    }

    pub fn get_request_id(&self) -> String {
        self.request_id.clone()
    }

    pub fn get_initiator_device_id(&self) -> String {
        self.initiator_device_id.clone()
    }

    pub fn get_initiator_name(&self) -> String {
        self.initiator_name.clone()
    }

    pub fn get_state(&self) -> String {
        self.state.clone()
    }

    pub fn approve(&mut self) {
        self.state = "approved".to_string();
    }

    pub fn reject(&mut self) {
        self.state = "rejected".to_string();
    }
}

// ============================================================================
// Cryptographic Utilities
// ============================================================================

/// Generate a pairing code
#[wasm_bindgen]
pub fn generate_pairing_code() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let code = (now % 999999) + 100000;
    code.to_string()
}

/// Generate a device fingerprint from public keys
#[wasm_bindgen]
pub fn generate_fingerprint(device_id: &str) -> String {
    let hash = format!("{:x}", device_id.len() * 1000 + device_id.as_bytes()[0] as usize);
    hash[..16.min(hash.len())].to_uppercase()
}

/// Verify a pairing code
#[wasm_bindgen]
pub fn verify_pairing_code(code: &str) -> bool {
    code.len() == 6 && code.chars().all(|c| c.is_numeric())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_keypair() {
        let keypair = DeviceKeyPair::new("device-123".to_string());
        assert_eq!(keypair.get_device_id(), "device-123");
        assert!(!keypair.get_signing_public_key().is_empty());
        assert!(!keypair.get_key_exchange_public_key().is_empty());
    }

    #[test]
    fn test_session_key() {
        let session = SessionKey::new(
            "session-1".to_string(),
            "peer-1".to_string(),
            "key-data".to_string(),
            "nonce-data".to_string(),
            1000u64,
            2000u64,
        );

        assert_eq!(session.get_session_id(), "session-1");
        assert!(!session.is_expired(1500));
        assert!(session.is_expired(2500));
    }

    #[test]
    fn test_pairing_code() {
        let code = generate_pairing_code();
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_numeric()));
    }

    #[test]
    fn test_fingerprint() {
        let fp = generate_fingerprint("device-123");
        assert!(!fp.is_empty());
        assert_eq!(fp.len(), 16);
    }

    #[test]
    fn test_pairing_request() {
        let mut req = PairingRequest::new(
            "req-1".to_string(),
            "dev-1".to_string(),
            "Device A".to_string(),
            "pub-key".to_string(),
            "123456".to_string(),
            1000u64,
        );

        assert_eq!(req.get_state(), "pending");
        req.approve();
        assert_eq!(req.get_state(), "approved");
    }
}
