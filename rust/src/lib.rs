use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// Module declarations
pub mod crypto;
pub mod sync;
pub mod transfer;

use sync::ChangeJournal;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global allocator
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// Initialize panic hook for better error messages in browser console
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

/// Simple greeting function to test WASM integration
#[wasm_bindgen]
pub fn greet_from_rust(name: &str) -> String {
    format!("Hello from Rust/WASM, {}! 🦀", name)
}

/// Get version info
#[wasm_bindgen]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ============================================================================
// P2P Discovery Structures
// ============================================================================

#[derive(Serialize, Deserialize)]
struct PeerAnnouncement {
    #[serde(default = "default_announcement_type")]
    #[serde(rename = "type")]
    msg_type: String,
    peer_id: String,
    device_name: String,
    device_id: String,
    #[serde(default)]
    service_port: u16,
}

fn default_announcement_type() -> String {
    "announcement".to_string()
}

/// Discovered peer information
#[wasm_bindgen]
#[derive(Serialize, Deserialize, Clone)]
pub struct DiscoveredPeer {
    id: String,
    name: String,
    device_id: String,
    last_seen_timestamp: u64,
    address: String, // IP address
    service_port: u16,
}

#[wasm_bindgen]
impl DiscoveredPeer {
    #[wasm_bindgen(constructor)]
    pub fn new(
        id: String,
        name: String,
        device_id: String,
        last_seen_timestamp: u64,
        address: String,
        service_port: u16,
    ) -> DiscoveredPeer {
        DiscoveredPeer {
            id,
            name,
            device_id,
            last_seen_timestamp,
            address,
            service_port,
        }
    }

    pub fn get_id(&self) -> String {
        self.id.clone()
    }

    pub fn get_name(&self) -> String {
        self.name.clone()
    }

    pub fn get_device_id(&self) -> String {
        self.device_id.clone()
    }

    pub fn get_last_seen_timestamp(&self) -> u64 {
        self.last_seen_timestamp
    }

    pub fn get_address(&self) -> String {
        self.address.clone()
    }

    pub fn get_service_port(&self) -> u16 {
        self.service_port
    }
}

// ============================================================================
// P2P Node with Discovery
// ============================================================================

/// Main P2P Node structure
#[wasm_bindgen]
pub struct P2PNode {
    peer_id: String,
    device_name: String,
    device_id: String,
    service_port: u16,
    peers: HashMap<String, DiscoveredPeer>,
    is_discovering: bool,
    change_journal: ChangeJournal,
}

#[wasm_bindgen]
impl P2PNode {
    /// Create a new P2P node with device configuration
    #[wasm_bindgen(constructor)]
    pub fn new(device_name: String, device_id: String, service_port: u16) -> P2PNode {
        let peer_id = Uuid::new_v4().to_string();
        // Use provided device_id

        P2PNode {
            peer_id: peer_id.clone(),
            device_name,
            device_id,
            service_port,
            peers: HashMap::new(),
            is_discovering: false,
            change_journal: ChangeJournal::new(),
        }
    }

    /// Get the peer ID of this node
    pub fn get_peer_id(&self) -> String {
        self.peer_id.clone()
    }

    /// Get the device name
    pub fn get_device_name(&self) -> String {
        self.device_name.clone()
    }

    /// Get the device ID
    pub fn get_device_id(&self) -> String {
        self.device_id.clone()
    }

    /// Start peer discovery
    pub fn start_discovery(&mut self) -> Result<(), JsValue> {
        if self.is_discovering {
            return Err(JsValue::from_str("Discovery already in progress"));
        }

        self.is_discovering = true;
        Ok(())
    }

    /// Stop peer discovery
    pub fn stop_discovery(&mut self) -> Result<(), JsValue> {
        self.is_discovering = false;
        Ok(())
    }

    /// Add a discovered peer (manual/legacy)
    pub fn add_discovered_peer(&mut self, peer: &DiscoveredPeer) -> Result<(), JsValue> {
        self.peers.insert(peer.id.clone(), peer.clone());
        Ok(())
    }

    /// Process an incoming discovery announcement
    /// Returns true if this is a new peer or an update to an existing one
    pub fn process_announcement(&mut self, json: &str, sender_ip: &str, current_time: u64) -> Result<bool, JsValue> {
        // Parse as generic JSON first to check type
        let v: serde_json::Value = serde_json::from_str(json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse JSON: {}", e)))?;

        // Enforce "type": "announcement"
        if let Some(msg_type) = v.get("type") {
            if msg_type.as_str() != Some("announcement") {
                // Not an announcement (e.g. pairing request), ignore silently
                return Ok(false);
            }
        } else {
            // Missing type field - invalid protocol message
            return Ok(false);
        }

        let announcement: PeerAnnouncement = serde_json::from_value(v)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse announcement: {}", e)))?;

        // Ignore own announcements
        if announcement.peer_id == self.peer_id {
            return Ok(false);
        }

        let peer = DiscoveredPeer {
            id: announcement.peer_id.clone(),
            name: announcement.device_name,
            device_id: announcement.device_id,
            last_seen_timestamp: current_time,
            address: sender_ip.to_string(),
            service_port: announcement.service_port,
        };

        self.peers.insert(announcement.peer_id, peer);
        Ok(true)
    }

    /// Generate an announcement message for this node
    pub fn get_announcement_json(&self) -> String {
        let announcement = PeerAnnouncement {
            msg_type: "announcement".to_string(),
            peer_id: self.peer_id.clone(),
            device_name: self.device_name.clone(),
            device_id: self.device_id.clone(),
            service_port: self.service_port,
        };
        serde_json::to_string(&announcement).unwrap_or_default()
    }

    /// Prune peers that haven't been seen for `ttl_ms`
    pub fn prune_peers(&mut self, current_time: u64, ttl_ms: u64) -> Result<usize, JsValue> {
        let initial_count = self.peers.len();
        self.peers.retain(|_, peer| {
            current_time - peer.last_seen_timestamp < ttl_ms
        });
        Ok(initial_count - self.peers.len())
    }

    /// Get list of discovered peers as JSON
    pub fn get_discovered_peers_json(&self) -> String {
        let peers_vec: Vec<&DiscoveredPeer> = self.peers.values().collect();
        serde_json::to_string(&peers_vec).unwrap_or_default()
    }

    /// Remove a discovered peer by ID
    pub fn remove_peer(&mut self, peer_id: &str) -> Result<(), JsValue> {
        self.peers.remove(peer_id);
        Ok(())
    }

    /// Clear all discovered peers
    pub fn clear_peers(&mut self) -> Result<(), JsValue> {
        self.peers.clear();
        Ok(())
    }

    /// Get the number of discovered peers
    pub fn get_peer_count(&self) -> usize {
        self.peers.len()
    }

    /// Node status
    pub fn status(&self) -> String {
        format!(
            "P2P Node [{}] on {}: {} peers discovered, discovering={}",
            self.device_name, self.device_id, self.peers.len(), self.is_discovering
        )
    }

    /// Update file in change journal
    pub fn update_file(&mut self, path: String, content: &[u8], mtime: u64) -> bool {
        self.change_journal.update_file(path, content, mtime, self.device_id.clone())
    }

    /// Mark file as deleted in change journal
    pub fn mark_file_deleted(&mut self, path: String, mtime: u64) -> bool {
        self.change_journal.mark_deleted(path, mtime, self.device_id.clone())
    }

    /// Get all files metadata
    pub fn get_all_files(&self) -> String {
        self.change_journal.get_all_files()
    }

    /// Export change journal state as JSON
    pub fn get_journal_state(&self) -> String {
        self.change_journal.to_json()
    }

    /// Import change journal state from JSON
    pub fn load_journal_state(&mut self, json: &str) -> Result<(), JsValue> {
        match ChangeJournal::from_json(json) {
            Ok(journal) => {
                self.change_journal = journal;
                Ok(())
            }
            Err(e) => Err(JsValue::from_str(&format!("Failed to load journal: {}", e))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        let result = greet_from_rust("Test");
        assert!(result.contains("Test"));
        assert!(result.contains("Rust/WASM"));
    }

    #[test]
    fn test_p2p_node_creation() {
        let node = P2PNode::new("Device A".to_string(), "device-id".to_string(), 8080);
        assert!(!node.get_peer_id().is_empty());
        assert_eq!(node.get_device_name(), "Device A");
        assert!(!node.get_device_id().is_empty());
    }

    #[test]
    fn test_peer_discovery() {
        let mut node = P2PNode::new("Device A".to_string(), "device-id".to_string(), 8080);

        // Start discovery
        assert!(node.start_discovery().is_ok());
        assert_eq!(node.get_peer_count(), 0);

        // Add a peer
        let peer = DiscoveredPeer::new(
            "peer-1".to_string(),
            "Device B".to_string(),
            "device-b-id".to_string(),
            1000u64,
            "192.168.1.2".to_string(),
            8081,
        );
        assert!(node.add_discovered_peer(&peer).is_ok());
        assert_eq!(node.get_peer_count(), 1);

        // Remove the peer
        assert!(node.remove_peer("peer-1").is_ok());
        assert_eq!(node.get_peer_count(), 0);
    }

    #[test]
    fn test_node_status() {
        let node = P2PNode::new("Test Device".to_string());
        let status = node.status();
        assert!(status.contains("Test Device"));
        assert!(status.contains("0 peers"));
    }
}
