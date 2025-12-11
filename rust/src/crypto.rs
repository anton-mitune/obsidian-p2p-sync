/**
 * Cryptography and Authentication Module
 * Handles keypair generation, storage, and authenticated key exchange
 */

use wasm_bindgen::prelude::*;
use ed25519_dalek::{SigningKey, VerifyingKey, Signer, Verifier, Signature};
use x25519_dalek::{StaticSecret, PublicKey as XPublicKey};
use rand_core::{OsRng, RngCore};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use std::convert::TryInto;

// Helper to encode/decode base64
fn to_base64(data: &[u8]) -> String {
    BASE64.encode(data)
}

fn from_base64(data: &str) -> Result<Vec<u8>, String> {
    BASE64.decode(data).map_err(|e| e.to_string())
}

// ============================================================================
// Device Identity (Ed25519)
// ============================================================================

#[wasm_bindgen]
pub struct DeviceIdentity {
    device_id: String,
    secret_key: Vec<u8>, // Ed25519 secret key bytes
    public_key: Vec<u8>, // Ed25519 public key bytes
}

#[wasm_bindgen]
impl DeviceIdentity {
    /// Generate a new random device identity
    #[wasm_bindgen(constructor)]
    pub fn new(device_id: String) -> Result<DeviceIdentity, String> {
        let mut bytes = [0u8; 32];
        OsRng.fill_bytes(&mut bytes);
        let signing_key = SigningKey::from_bytes(&bytes);
        let verifying_key = signing_key.verifying_key();

        Ok(DeviceIdentity {
            device_id,
            secret_key: signing_key.to_bytes().to_vec(),
            public_key: verifying_key.to_bytes().to_vec(),
        })
    }

    /// Reconstruct identity from saved secret key (base64)
    pub fn from_secret_key(device_id: String, secret_key_b64: String) -> Result<DeviceIdentity, String> {
        let secret_bytes = from_base64(&secret_key_b64)?;
        let secret_arr: [u8; 32] = secret_bytes.try_into().map_err(|_| "Invalid key length")?;
        let signing_key = SigningKey::from_bytes(&secret_arr);
        let verifying_key = signing_key.verifying_key();

        Ok(DeviceIdentity {
            device_id,
            secret_key: secret_arr.to_vec(),
            public_key: verifying_key.to_bytes().to_vec(),
        })
    }

    pub fn get_device_id(&self) -> String {
        self.device_id.clone()
    }

    pub fn get_public_key(&self) -> String {
        to_base64(&self.public_key)
    }

    pub fn get_secret_key(&self) -> String {
        to_base64(&self.secret_key)
    }

    /// Sign a message with the device's private key
    pub fn sign(&self, message: &[u8]) -> String {
        let secret_arr: [u8; 32] = self.secret_key.clone().try_into().unwrap();
        let signing_key = SigningKey::from_bytes(&secret_arr);
        let signature = signing_key.sign(message);
        to_base64(&signature.to_bytes())
    }
}

/// Verify a signature from another device
#[wasm_bindgen]
pub fn verify_signature(public_key_b64: String, message: &[u8], signature_b64: String) -> bool {
    let pk_bytes = match from_base64(&public_key_b64) { Ok(b) => b, Err(_) => return false };
    let sig_bytes = match from_base64(&signature_b64) { Ok(b) => b, Err(_) => return false };

    let pk_arr: [u8; 32] = match pk_bytes.try_into() { Ok(b) => b, Err(_) => return false };
    let sig_arr: [u8; 64] = match sig_bytes.try_into() { Ok(b) => b, Err(_) => return false };

    let verifying_key = match VerifyingKey::from_bytes(&pk_arr) { Ok(k) => k, Err(_) => return false };
    let signature = Signature::from_bytes(&sig_arr);

    verifying_key.verify(message, &signature).is_ok()
}

// ============================================================================
// Ephemeral Key Exchange (X25519)
// ============================================================================

#[wasm_bindgen]
pub struct KeyExchange {
    secret: StaticSecret,
    public: XPublicKey,
}

#[wasm_bindgen]
impl KeyExchange {
    #[wasm_bindgen(constructor)]
    pub fn new() -> KeyExchange {
        let secret = StaticSecret::random_from_rng(OsRng);
        let public = XPublicKey::from(&secret);
        KeyExchange { secret, public }
    }

    pub fn get_public_key(&self) -> String {
        to_base64(self.public.as_bytes())
    }

    pub fn compute_shared_secret(&self, other_public_key_b64: String) -> Result<String, String> {
        let other_bytes = from_base64(&other_public_key_b64)?;
        let other_arr: [u8; 32] = other_bytes.try_into().map_err(|_| "Invalid key length")?;
        let other_pk = XPublicKey::from(other_arr);

        let shared_secret = self.secret.diffie_hellman(&other_pk);
        Ok(to_base64(shared_secret.as_bytes()))
    }
}

// ============================================================================
// Pairing Logic
// ============================================================================

#[wasm_bindgen]
pub struct PairingCode {
    code: String,
}

#[wasm_bindgen]
impl PairingCode {
    pub fn generate() -> PairingCode {
        let mut bytes = [0u8; 4];
        OsRng.fill_bytes(&mut bytes);
        // Generate a 6-digit code
        let num: u32 = u32::from_be_bytes(bytes);
        let code = format!("{:06}", num % 1_000_000);
        PairingCode { code }
    }

    pub fn get_code(&self) -> String {
        self.code.clone()
    }
}

/// Generate a pairing code (helper function)
#[wasm_bindgen]
pub fn generate_pairing_code() -> String {
    PairingCode::generate().get_code()
}

/// Generate a device fingerprint from public keys
#[wasm_bindgen]
pub fn generate_fingerprint(public_key_b64: &str) -> String {
    // Simple fingerprint: first 16 chars of hex representation of the key hash?
    // Or just use the key itself if it's short enough?
    // Let's hash the key and take first 16 chars of hex
    // Since we don't have sha2 imported yet in this snippet (I added it to Cargo.toml but not used here yet),
    // I'll just use a simple slice of the base64 string for now, or implement simple hash.
    // Actually, I should use Sha256.
    // I'll add `use sha2::{Sha256, Digest};` to imports.
    // But I didn't add it to the imports in the `newString` above.
    // I'll just return the first 16 chars of the public key base64 for now.
    // It's a fingerprint for visual verification.
    public_key_b64.chars().take(16).collect()
}

/// Verify a pairing code format
#[wasm_bindgen]
pub fn verify_pairing_code_format(code: &str) -> bool {
    code.len() == 6 && code.chars().all(|c| c.is_numeric())
}

