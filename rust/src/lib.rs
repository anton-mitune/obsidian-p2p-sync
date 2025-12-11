use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

// Module declarations
pub mod crypto;

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

/// Discovered peer information
#[wasm_bindgen]
pub struct DiscoveredPeer {
    id: String,
    name: String,
    device_id: String,
    last_seen_timestamp: u64,
}

#[wasm_bindgen]
impl DiscoveredPeer {
    #[wasm_bindgen(constructor)]
    pub fn new(
        id: String,
        name: String,
        device_id: String,
        last_seen_timestamp: u64,
    ) -> DiscoveredPeer {
        DiscoveredPeer {
            id,
            name,
            device_id,
            last_seen_timestamp,
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
    peer_count: usize,
    is_discovering: bool,
}

#[wasm_bindgen]
impl P2PNode {
    /// Create a new P2P node with device configuration
    #[wasm_bindgen(constructor)]
    pub fn new(device_name: String) -> P2PNode {
        let peer_id = Uuid::new_v4().to_string();
        let device_id = Uuid::new_v4().to_string();

        P2PNode {
            peer_id: peer_id.clone(),
            device_name,
            device_id,
            peer_count: 0,
            is_discovering: false,
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

    /// Add a discovered peer
    pub fn add_discovered_peer(&mut self, _peer: &DiscoveredPeer) -> Result<(), JsValue> {
        self.peer_count += 1;
        Ok(())
    }

    /// Get list of discovered peers as JSON
    pub fn get_discovered_peers_json(&self) -> String {
        "[]".to_string() // Placeholder - would return actual peer list
    }

    /// Remove a discovered peer by ID
    pub fn remove_peer(&mut self, _peer_id: &str) -> Result<(), JsValue> {
        if self.peer_count > 0 {
            self.peer_count -= 1;
        }
        Ok(())
    }

    /// Clear all discovered peers
    pub fn clear_peers(&mut self) -> Result<(), JsValue> {
        self.peer_count = 0;
        Ok(())
    }

    /// Get the number of discovered peers
    pub fn get_peer_count(&self) -> usize {
        self.peer_count
    }

    /// Node status
    pub fn status(&self) -> String {
        format!(
            "P2P Node [{}] on {}: {} peers discovered, discovering={}",
            self.device_name, self.device_id, self.peer_count, self.is_discovering
        )
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
        let node = P2PNode::new("Device A".to_string());
        assert!(!node.get_peer_id().is_empty());
        assert_eq!(node.get_device_name(), "Device A");
        assert!(!node.get_device_id().is_empty());
    }

    #[test]
    fn test_peer_discovery() {
        let mut node = P2PNode::new("Device A".to_string());

        // Start discovery
        assert!(node.start_discovery().is_ok());
        assert_eq!(node.get_peer_count(), 0);

        // Add a peer
        let peer = DiscoveredPeer::new(
            "peer-1".to_string(),
            "Device B".to_string(),
            "device-b-id".to_string(),
            1000u64,
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
