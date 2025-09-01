#!/bin/bash
# GitHub Release Script for Offline Overleaf

set -e

# Configuration
REPO="SrijitK10/Overleaf-offline"
VERSION="v1.0.0"
RELEASE_NAME="Offline Overleaf v1.0.0"
RELEASE_NOTES="release-notes.md"

echo "🚀 Creating GitHub release for $VERSION"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is required. Install it first:"
    echo "   brew install gh"
    exit 1
fi

# Ensure we're logged in
if ! gh auth status &> /dev/null; then
    echo "❌ Please login to GitHub CLI first:"
    echo "   gh auth login"
    exit 1
fi

# Build all platforms
echo "📦 Building packages for all platforms..."
npm run build

echo "📦 Packaging for macOS..."
npm run package:mac

echo "📦 Packaging for Linux..."
npm run package:linux

# Create the release
echo "🏷️ Creating GitHub release..."
gh release create "$VERSION" \
    --repo "$REPO" \
    --title "$RELEASE_NAME" \
    --notes-file "$RELEASE_NOTES" \
    --draft

# Upload assets
echo "⬆️ Uploading release assets..."

# macOS files
gh release upload "$VERSION" \
    "dist-electron/Offline Overleaf-1.0.0.dmg" \
    "dist-electron/Offline Overleaf-1.0.0-arm64.dmg" \
    "dist-electron/Offline Overleaf-1.0.0.pkg" \
    "dist-electron/Offline Overleaf-1.0.0-arm64.pkg" \
    --repo "$REPO"

# Linux files
gh release upload "$VERSION" \
    "dist-electron/Offline Overleaf-1.0.0.AppImage" \
    --repo "$REPO"

# Windows files (if available)
if [ -d "dist-electron/win-unpacked" ]; then
    # Create a zip of the Windows build
    cd dist-electron
    zip -r "Offline-Overleaf-1.0.0-Windows-x64.zip" win-unpacked/
    cd ..
    
    gh release upload "$VERSION" \
        "dist-electron/Offline-Overleaf-1.0.0-Windows-x64.zip" \
        --repo "$REPO"
fi

echo "✅ Release created successfully!"
echo "📝 Don't forget to:"
echo "   1. Review the draft release on GitHub"
echo "   2. Publish when ready"
echo "   3. Update the README with download instructions"

echo ""
echo "🔗 Release URL: https://github.com/$REPO/releases/tag/$VERSION"
