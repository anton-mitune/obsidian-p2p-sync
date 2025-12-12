use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use sha2::{Sha256, Digest};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileMetadata {
    pub path: String,
    pub hash: String, // Hex encoded SHA256
    pub mtime: u64,
    pub size: u64,
    pub version: u64, // Sequence number
    pub is_deleted: bool,
    pub last_modified_by: String,
}

#[derive(Serialize, Deserialize)]
#[wasm_bindgen]
pub struct ChangeJournal {
    files: HashMap<String, FileMetadata>,
    global_sequence: u64,
}

#[wasm_bindgen]
impl ChangeJournal {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ChangeJournal {
        ChangeJournal {
            files: HashMap::new(),
            global_sequence: 0,
        }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }

    pub fn from_json(json: &str) -> Result<ChangeJournal, String> {
        serde_json::from_str(json).map_err(|e| e.to_string())
    }

    pub fn update_file(&mut self, path: String, content: &[u8], mtime: u64, device_id: String) -> bool {
        let mut hasher = Sha256::new();
        hasher.update(content);
        let result = hasher.finalize();
        let hash = hex::encode(result);
        let size = content.len() as u64;

        if let Some(existing) = self.files.get(&path) {
            if existing.hash == hash && !existing.is_deleted {
                return false; // No change
            }
        }

        self.global_sequence += 1;
        let metadata = FileMetadata {
            path: path.clone(),
            hash,
            mtime,
            size,
            version: self.global_sequence,
            is_deleted: false,
            last_modified_by: device_id,
        };

        self.files.insert(path, metadata);
        true
    }

    pub fn mark_deleted(&mut self, path: String, mtime: u64, device_id: String) -> bool {
        if let Some(existing) = self.files.get(&path) {
            if existing.is_deleted {
                return false;
            }
        }

        self.global_sequence += 1;
        let metadata = FileMetadata {
            path: path.clone(),
            hash: String::new(),
            mtime,
            size: 0,
            version: self.global_sequence,
            is_deleted: true,
            last_modified_by: device_id,
        };

        self.files.insert(path, metadata);
        true
    }

    pub fn get_file_metadata(&self, path: &str) -> Option<String> {
        self.files.get(path).map(|m| serde_json::to_string(m).unwrap_or_default())
    }

    pub fn get_all_files(&self) -> String {
        let all: Vec<&FileMetadata> = self.files.values().collect();
        serde_json::to_string(&all).unwrap_or_default()
    }
}
