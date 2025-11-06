#!/bin/bash

# Build script for RP Jump standalone executables
# Creates executables for macOS and Linux

set -e

echo "Building RP Jump standalone executables..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install/upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

# Check if PyInstaller is installed (should be from requirements.txt, but just in case)
if ! command -v pyinstaller &> /dev/null; then
    echo "PyInstaller not found. Installing...
    pip install pyinstaller
fi

# Create dist directory if it doesn't exist
mkdir -p dist

# Detect platform
PLATFORM=$(uname -s)
ARCH=$(uname -m)

echo "Platform: $PLATFORM"
echo "Architecture: $ARCH"

# Build for current platform
if [ "$PLATFORM" == "Darwin" ]; then
    echo "Building for macOS..."
    pyinstaller --clean rpjump.spec
    mv dist/rpjump-server dist/rpjump-server-macos-${ARCH}
    echo "✅ macOS executable created: dist/rpjump-server-macos-${ARCH}"
elif [ "$PLATFORM" == "Linux" ]; then
    echo "Building for Linux..."
    pyinstaller --clean rpjump.spec
    mv dist/rpjump-server dist/rpjump-server-linux-${ARCH}
    echo "✅ Linux executable created: dist/rpjump-server-linux-${ARCH}"
else
    echo "❌ Unsupported platform: $PLATFORM"
    exit 1
fi

# Clean up build artifacts (keep dist/)
rm -rf build/
rm -rf *.spec.bak 2>/dev/null || true

echo ""
echo "Build complete! Executable is in dist/"
echo "To build for other platforms, run this script on that platform."
