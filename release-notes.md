# Offline Overleaf v1.0.0

A fully offline LaTeX editor inspired by Overleaf, built with Electron. Write, compile, and preview LaTeX documents without an internet connection.

## 🎉 Features

- **Offline First**: Complete LaTeX environment that works without internet
- **Real-time PDF Preview**: See your document as you type
- **Auto-compile**: Automatic compilation on file save
- **TeX Distribution Detection**: Works with bundled or system TeX installations
- **Sample Templates**: Includes article, thesis, presentation, and minimal templates
- **Security Controls**: Shell-escape management and compilation limits
- **Cross-platform**: Native installers for macOS, Windows, and Linux

## 📥 Downloads

### macOS
- **Apple Silicon (M1/M2/M3)**: [Offline Overleaf-1.0.0-arm64.dmg](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.0.0/Offline%20Overleaf-1.0.0-arm64.dmg) (93MB)
- **Intel**: [Offline Overleaf-1.0.0.dmg](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.0.0/Offline%20Overleaf-1.0.0.dmg) (98MB)
- **PKG Format**: Available for enterprise deployment

### Linux
- **Universal**: [Offline Overleaf-1.0.0.AppImage](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.0.0/Offline%20Overleaf-1.0.0.AppImage) (102MB)
- Make executable: `chmod +x Offline\ Overleaf-1.0.0.AppImage`

### Windows
- **64-bit**: [Offline-Overleaf-1.0.0-Windows-x64.zip](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.0.0/Offline-Overleaf-1.0.0-Windows-x64.zip)
- Extract and run `Offline Overleaf.exe`

## 🚀 Installation

### macOS
1. Download the appropriate DMG file for your Mac
2. Double-click to open the disk image
3. Drag "Offline Overleaf" to your Applications folder
4. Launch from Applications or Spotlight search
5. On first run, you may need to right-click → "Open" due to Gatekeeper

### Linux (AppImage)
1. Download the AppImage file
2. Make it executable: `chmod +x Offline\ Overleaf-1.0.0.AppImage`
3. Run directly: `./Offline\ Overleaf-1.0.0.AppImage`
4. Optionally integrate with your desktop environment

### Windows
1. Download and extract the ZIP file
2. Run `Offline Overleaf.exe` from the extracted folder
3. Pin to taskbar or create desktop shortcut as needed

## 🛠️ System Requirements

- **macOS**: 10.14 Mojave or later
- **Windows**: Windows 10 or later (64-bit)
- **Linux**: Any modern distribution with glibc 2.17+

## 📝 TeX Requirements

The app works in two modes:
- **Bundled Mode**: Includes everything needed (when TeX Live is bundled)
- **System Mode**: Uses your existing TeX installation (TeX Live, MiKTeX, etc.)

For system mode, you'll need:
- TeX Live 2020+ (recommended)
- Or MiKTeX 2.9+
- Or any distribution with `pdflatex`, `xelatex`, `lualatex`

## 🎯 First Run

When you first launch the app:
1. It performs an automatic system check
2. Detects available TeX distributions
3. Sets up default configuration
4. Provides sample templates to get started

Check **Settings → System Status** to see your setup.

## 🐛 Troubleshooting

### macOS: "App can't be opened"
- Right-click the app → "Open" → "Open" again
- Or run: `sudo xattr -rd com.apple.quarantine "/Applications/Offline Overleaf.app"`

### Linux: Permission denied
- Ensure the AppImage is executable: `chmod +x filename.AppImage`

### Windows: Antivirus warnings
- The app is unsigned, some antivirus may flag it
- Add to exceptions or build from source

### TeX not found
- Install TeX Live from [tug.org/texlive](https://tug.org/texlive)
- Or check Settings → TeX Distribution for system detection

## 🎨 Screenshots

[Add screenshots of the main interface, PDF preview, settings, etc.]

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
- **Documentation**: Check the [README](README.md) and [wiki](https://github.com/SrijitK10/Overleaf-offline/wiki)

---

**Note**: This is an independent project inspired by Overleaf but not affiliated with Overleaf or ShareLaTeX.
