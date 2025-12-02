#!/bin/bash

# Setup script for P2P Vault Sync Plugin

set -e

echo "🔧 Setting up P2P Vault Sync Plugin..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16+ from https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js found: $(node --version)"

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo ""
    echo "⚠️  Rust is not installed."
    echo "To enable Rust/WASM features, install Rust from: https://rustup.rs/"
    echo "Run: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo ""
    echo "You can continue without Rust, but the P2P features won't work yet."
    read -p "Continue without Rust? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    SKIP_RUST=true
else
    echo "✅ Rust found: $(cargo --version)"
    SKIP_RUST=false
fi

# Check for wasm-pack if Rust is available
if [ "$SKIP_RUST" = false ]; then
    if ! command -v wasm-pack &> /dev/null; then
        echo "📦 Installing wasm-pack..."
        cargo install wasm-pack
    else
        echo "✅ wasm-pack found: $(wasm-pack --version)"
    fi
fi

# Install Node dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Build WASM if Rust is available
if [ "$SKIP_RUST" = false ]; then
    echo "🦀 Building Rust/WASM module..."
    npm run build:wasm
else
    echo "⏭️  Skipping Rust/WASM build (Rust not available)"
fi

# Build TypeScript
echo "📦 Building TypeScript plugin..."
npm run build

echo ""
echo "✨ Setup complete!"
echo ""
if [ "$SKIP_RUST" = true ]; then
    echo "⚠️  Note: Rust/WASM features are disabled. Install Rust to enable P2P functionality."
fi
echo "📖 Next steps:"
echo "   1. Open demo-vault in Obsidian"
echo "   2. Enable the plugin in Settings → Community Plugins"
echo "   3. Run 'npm run dev' for development mode"
echo ""
