use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use crate::crypto::{encrypt_data, decrypt_data};

const CHUNK_SIZE: usize = 64 * 1024; // 64KB

#[derive(Serialize, Deserialize, Clone)]
pub struct FileChunk {
    pub file_path: String,
    pub chunk_index: u32,
    pub total_chunks: u32,
    pub data: Vec<u8>, // Encrypted data
    pub nonce: Vec<u8>,
}

#[wasm_bindgen]
pub struct TransferManager {
    // We could store active transfers here if needed
}

#[wasm_bindgen]
impl TransferManager {
    #[wasm_bindgen(constructor)]
    pub fn new() -> TransferManager {
        TransferManager {}
    }

    /// Prepare a file for transfer: split into chunks and encrypt
    pub fn prepare_transfer(&self, file_path: String, content: &[u8], session_key: String) -> Result<String, String> {
        let total_size = content.len();
        let total_chunks = (total_size + CHUNK_SIZE - 1) / CHUNK_SIZE;
        let mut chunks = Vec::new();

        for (i, chunk_slice) in content.chunks(CHUNK_SIZE).enumerate() {
            let encrypted = encrypt_data(session_key.clone(), chunk_slice)?;

            let chunk = FileChunk {
                file_path: file_path.clone(),
                chunk_index: i as u32,
                total_chunks: total_chunks as u32,
                data: encrypted.get_data(),
                nonce: encrypted.get_nonce(),
            };
            chunks.push(chunk);
        }

        serde_json::to_string(&chunks).map_err(|e| e.to_string())
    }

    /// Process a received chunk: decrypt and return data
    /// Note: This is a simple helper. In a real scenario, we might want to buffer chunks
    /// and reassemble the file in Rust, but for now JS handles reassembly.
    pub fn decrypt_chunk(&self, chunk_json: String, session_key: String) -> Result<Vec<u8>, String> {
        let chunk: FileChunk = serde_json::from_str(&chunk_json)
            .map_err(|e| format!("Invalid chunk JSON: {}", e))?;

        decrypt_data(session_key, &chunk.data, &chunk.nonce)
    }
}
