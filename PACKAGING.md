# Offline Overleaf - Packaging & Distribution

## Overview
Offline Overleaf is packaged for multiple platforms using electron-builder, providing native installers and executables for macOS, Windows, and Linux.

## Supported Platforms

### macOS
- **Intel (x64)**: `Offline Overleaf-1.0.0.dmg` (98MB)
- **Apple Silicon (arm64)**: `Offline Overleaf-1.0.0-arm64.dmg` (93MB)
- **PKG Installers**: `Offline Overleaf-1.0.0.pkg` and `Offline Overleaf-1.0.0-arm64.pkg`

### Windows
- **64-bit (x64)**: Windows unpacked directory available
- **MSI Installer**: Supported (requires author email in package.json)
- **NSIS Installer**: Configurable

### Linux
- **AppImage**: `Offline Overleaf-1.0.0.AppImage` (102MB) - Universal Linux package
- **Debian Package**: Available (requires author email configuration)
- **RPM Package**: Configurable

## Build Commands

```bash
# Build for all platforms
npm run build

# Platform-specific builds
npm run package:mac      # macOS (both Intel and ARM64)
npm run package:win      # Windows (x64 and ia32)
npm run package:linux    # Linux (AppImage, deb, rpm)

# Development
npm run dev              # Start development server
```

## First-Run Experience

### System Self-Check
When first launched, the app performs comprehensive checks:
- ✅ **Configuration**: Creates default settings
- ✅ **Templates**: Includes 4 sample LaTeX templates
- ✅ **TeX Distribution**: Detects bundled or system TeX
- ✅ **Write Permissions**: Verifies app data directory access

### Bundled Resources
- **Sample Templates**: article, thesis, presentation, minimal
- **Icons**: Multi-resolution app icons (16px to 1024px)
- **TeX Live**: Placeholder for bundled TeX distribution
- **Licenses**: MIT license and attribution files

### Offline Operation
- **No Internet Required**: Fully functional offline
- **Bundled TeX**: When included, provides complete LaTeX environment
- **System TeX Detection**: Automatically finds existing installations
- **Template Library**: Built-in templates for immediate use

## Security Features

### Code Signing (macOS)
- Developer ID certificate support
- Notarization ready (requires Apple ID credentials)
- Entitlements configured for sandboxing

### Content Security
- PDF rendering with PDF.js (no external dependencies)
- LaTeX compilation sandboxing options
- Shell-escape controls and warnings

## Distribution Size

### Optimized Builds
- **Core App**: ~90-100MB per platform
- **With TeX Bundle**: Size depends on TeX Live subset
- **Compression**: DMG and AppImage provide good compression

### Resource Management
- Icons generated at build time
- Templates packaged efficiently
- Unused binaries excluded

## Installation Notes

### macOS
1. Download the appropriate DMG for your architecture
2. Drag to Applications folder
3. On first run, may need to "Open" from context menu (Gatekeeper)

### Windows
1. Download MSI installer or extract unpacked version
2. Run installer with administrator privileges if needed
3. First run may trigger Windows Defender scan

### Linux
1. Download AppImage for universal compatibility
2. Make executable: `chmod +x Offline\ Overleaf-1.0.0.AppImage`
3. Run directly or integrate with desktop environment

## Development Setup

### Requirements
- Node.js 18+
- npm or yarn
- Platform-specific build tools (Xcode Command Line Tools for macOS)

### First Build
```bash
# Install dependencies
npm install

# Generate icons and prepare resources
npm run prepare-icons

# Build application
npm run build

# Package for current platform
npm run package
```

## Troubleshooting

### Build Issues
- **Author Missing**: Add `"author": "Name <email@domain.com>"` to package.json
- **Code Signing**: Set `CSC_IDENTITY_AUTO_DISCOVERY=false` to skip signing
- **32-bit Windows**: Disable in package.json if not needed

### Runtime Issues
- **TeX Not Found**: Check System Status tab in Settings
- **Permission Errors**: Ensure app data directory is writable
- **PDF Rendering**: Clear cache if PDF viewer shows errors

## Future Enhancements

### Planned Features
- Auto-updater integration
- Enhanced TeX Live bundling
- Additional template categories
- Plugin system for extensions

### Distribution Improvements
- Windows Store package
- Homebrew formula (macOS)
- Snap package (Linux)
- Flatpak support (Linux)

---

## Build Status
✅ **macOS**: Intel and ARM64 DMG/PKG packages ready
✅ **Windows**: x64 unpacked build ready (MSI pending author info)
✅ **Linux**: AppImage ready (deb/rpm pending author info)
✅ **First-Run**: Comprehensive system check and setup
✅ **Resources**: Icons, templates, and licenses included
✅ **Security**: Code signing and sandboxing configured
