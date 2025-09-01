# AuroraTex v1.0.0 - Professional Offline LaTeX Editor

A fully offline LaTeX editor inspired by Overleaf, built with Electron. Write, compile, and preview LaTeX documents without an internet connection.

> **🎉 Rebranded**: Now **AuroraTex** with professional branding, enhanced features, and improved user experience.

## ✨ New in v1.0.0

### 🔥 Core Features
- **Offline First**: Complete LaTeX environment that works without internet
- **Real-time PDF Preview**: See your document as you type with smooth scrolling
- **Auto-compile**: Automatic compilation on file save with background processing
- **Smart TeX Detection**: Auto-detects TeX Live 2025 and other distributions
- **Sample Templates**: Includes 4 built-in templates (article, thesis, presentation, minimal)
- **First-Run Setup**: Comprehensive system check and guided configuration
- **Professional UI**: Clean, modern interface with VS Code-inspired design

### 🛡️ Advanced Features
- **Security Controls**: Shell-escape management and compilation sandboxing
- **Cross-platform**: Native installers for macOS (Intel & Apple Silicon), Linux, Windows
- **Robust Error Handling**: Click errors to jump to source location
- **System Health**: Real-time status monitoring and diagnostics
- **Auto-save**: Never lose your work with automatic saving

## 📥 Downloads

### macOS
- **Apple Silicon (M1/M2/M3)**: [AuroraTex-1.0.0-arm64.dmg](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.0.0/AuroraTex-1.0.0-arm64.dmg) (96MB)
- **Intel**: [AuroraTex-1.0.0.dmg](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.0.0/AuroraTex-1.0.0.dmg) (101MB)
- **PKG Format**: Available for enterprise deployment

### Linux
- **Universal**: [AuroraTex-1.0.0.AppImage](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.0.0/AuroraTex-1.0.0.AppImage) (104MB)
- Make executable: `chmod +x AuroraTex-1.0.0.AppImage`

### Windows
- **64-bit**: Available on request (requires signing certificate setup)

## 🚀 Installation

### macOS
1. Download the appropriate DMG file for your Mac
2. Double-click to open the disk image
3. Drag **"AuroraTex"** to your Applications folder
4. Launch from Applications or Spotlight search
5. On first run, you may need to right-click → "Open" due to Gatekeeper

### Linux (AppImage)
1. Download the AppImage file
2. Make it executable: `chmod +x AuroraTex-1.0.0.AppImage`
3. Run directly: `./AuroraTex-1.0.0.AppImage`
4. Optionally integrate with your desktop environment

## 🛠️ System Requirements

- **macOS**: 10.14 Mojave or later (both Intel and Apple Silicon supported)
- **Windows**: Windows 10 or later (64-bit)
- **Linux**: Any modern distribution with glibc 2.17+ (tested on Ubuntu, Fedora, Arch)

## 📝 TeX Requirements

AuroraTex works in multiple modes:
- **Auto-Detection**: Automatically finds and configures TeX Live 2025, 2024, 2023
- **System TeX**: Works with existing TeX installations (TeX Live, MiKTeX, TinyTeX)
- **Guided Setup**: First-run wizard helps configure your environment

**Recommended**: TeX Live 2025 (automatically detected and configured)

## 🎯 First Run Experience

When you launch AuroraTex for the first time:
1. ✅ **System Check**: Validates installation and permissions
2. ✅ **TeX Detection**: Automatically finds and configures TeX distributions
3. ✅ **Template Setup**: Provides 4 sample templates to get started
4. ✅ **Settings Init**: Creates optimal default configuration
5. ✅ **Health Monitor**: Ongoing system status monitoring

Check **Settings → System Status** to see your complete setup.

## 🐛 Troubleshooting

### macOS: "App can't be opened"
- Right-click the app → "Open" → "Open" again
- Or run: `sudo xattr -rd com.apple.quarantine "/Applications/AuroraTex.app"`

### Linux: Permission denied
- Ensure the AppImage is executable: `chmod +x AuroraTex-1.0.0.AppImage`

### TeX not found after installation
- The app auto-detects TeX Live 2025 - install from [tug.org/texlive](https://tug.org/texlive)
- Check Settings → TeX Distribution → "Redetect" button
- Verify your TeX installation with: `which pdflatex`

### Compilation errors
- Check the compilation log panel for detailed error information
- Ensure all required packages are installed in your TeX distribution
- Use the built-in sample templates to verify your setup

## 💻 Building from Source

```bash
git clone https://github.com/SrijitK10/Overleaf-offline.git
cd Overleaf-offline
npm install
npm run dev        # Development
npm run build      # Production build
npm run package    # Create installer
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **Issues**: [GitHub Issues](https://github.com/SrijitK10/Overleaf-offline/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SrijitK10/Overleaf-offline/discussions)
- **Documentation**: Check the [README](README.md) for complete usage guide

---

**Note**: AuroraTex is an independent project inspired by Overleaf but not affiliated with Overleaf or ShareLaTeX.
