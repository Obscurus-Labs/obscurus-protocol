#!/bin/bash

# Setup script for frontend
# Copies circuit files to public folder

echo "🔧 Setting up frontend..."

# Create public/circuits directory
mkdir -p public/circuits

# Copy circuit files
echo "📁 Copying circuit files..."
cp ../circuits/semaphore_js/semaphore.wasm public/circuits/ 2>/dev/null || echo "⚠️  semaphore.wasm not found"
cp ../circuits/semaphore_final.zkey public/circuits/ 2>/dev/null || echo "⚠️  semaphore_final.zkey not found"

if [ -f "public/circuits/semaphore.wasm" ] && [ -f "public/circuits/semaphore_final.zkey" ]; then
  echo "✅ Circuit files copied successfully!"
else
  echo "❌ Some circuit files are missing. Please run circuit setup first."
  echo "   See ../README.md for circuit setup instructions"
fi

echo "✅ Setup complete!"


