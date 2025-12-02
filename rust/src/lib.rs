use wasm_bindgen::prelude::*;

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

/// Placeholder for future P2P functionality
#[wasm_bindgen]
pub struct P2PNode {
    peer_id: String,
}

#[wasm_bindgen]
impl P2PNode {
    #[wasm_bindgen(constructor)]
    pub fn new() -> P2PNode {
        P2PNode {
            peer_id: "placeholder-peer-id".to_string(),
        }
    }

    pub fn get_peer_id(&self) -> String {
        self.peer_id.clone()
    }

    pub fn status(&self) -> String {
        "P2P node initialized (placeholder)".to_string()
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
    fn test_p2p_node() {
        let node = P2PNode::new();
        assert_eq!(node.get_peer_id(), "placeholder-peer-id");
    }
}
