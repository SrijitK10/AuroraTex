# AuroraTex v1.1.0 - Auto-Install Edition

> **🎉 Major Feature Release**: Automatic TeX Live installation makes AuroraTex truly plug-and-play!

## ✨ What's New in v1.1.0

### 🚀 **Automatic TeX Live Installation**
- **One-Click Setup**: Install TeX Live 2025 automatically with guided wizard
- **No Manual Configuration**: Zero-setup LaTeX environment for new users
- **Smart Detection**: Automatically detects when TeX Live installation is needed
- **Cross-Platform**: macOS (Intel & Apple Silicon), Windows, Linux support
- **Professional UI**: Beautiful installation progress with real-time updates

### 🛠 **Enhanced First-Run Experience**
- **Intelligent Recommendations**: Only suggests auto-install when appropriate
- **System Readiness Checks**: Validates requirements before installation
- **Multi-Source Detection**: Finds bundled, system, and AuroraTex-installed TeX
- **Post-Install Integration**: Seamlessly activates newly installed TeX Live

### 📊 **Technical Improvements**
- **New Service**: TeXLiveInstaller with progressive download and installation
- **Enhanced Detection**: Improved TeX distribution discovery and validation
- **Better Error Handling**: Comprehensive error reporting and recovery
- **Performance Optimized**: Background installation with non-blocking UI

## 📥 Downloads

### macOS
- **Apple Silicon (M1/M2/M3)**: [AuroraTex-1.1.0-arm64.dmg](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.1.0/AuroraTex-1.1.0-arm64.dmg)
- **Intel**: [AuroraTex-1.1.0.dmg](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.1.0/AuroraTex-1.1.0.dmg)

### Linux
- **Universal**: [AuroraTex-1.1.0.AppImage](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.1.0/AuroraTex-1.1.0.AppImage)

### Windows
- **64-bit**: Available on request (requires signing certificate setup)

## 🎯 **Perfect for New Users**

### **Before v1.1.0**
1. Download AuroraTex
2. Separately download and install TeX Live (4.5GB, 30+ minutes)
3. Configure PATH and environment
4. Troubleshoot installation issues
5. Finally ready to use

### **After v1.1.0**
1. Download and launch AuroraTex
2. Click "Install TeX Live" when prompted
3. Wait 15-30 minutes (automatic)
4. Start writing LaTeX immediately!

## 🔧 **Installation Process**

### **Automatic Detection**
- App detects missing TeX installation on startup
- Shows professional installation dialog
- Only offers installation if system requirements are met

### **One-Click Installation**
1. **Download**: TeX Live 2025 installer from official CTAN mirrors
2. **Install**: Basic scheme with essential packages (~4.5GB)
3. **Configure**: Automatic PATH setup and environment configuration
4. **Ready**: Immediately available for LaTeX compilation

### **Real-Time Progress**
- Download progress with speed and ETA
- Installation stages with detailed descriptions
- Error handling with helpful recovery suggestions
- Cancellation support at any stage

## 🛡️ **Enterprise Ready**

### **Security Features**
- Downloads only from official CTAN mirrors
- Installation sandboxing and validation
- Timeout protection and error recovery
- No external dependencies after installation

### **System Requirements**
- **macOS**: 10.14+ (Intel or Apple Silicon)
- **Windows**: Windows 10+ (64-bit)
- **Linux**: Modern distribution with glibc 2.17+
- **Disk Space**: ~5GB for TeX Live installation

## 🔄 **Upgrade from v1.0.0**

### **Existing Users**
- Automatic update detection in Settings
- Preserves all projects and settings
- Enhanced TeX detection for existing installations
- New auto-install option for additional distributions

### **Migration Notes**
- No breaking changes to existing functionality
- All v1.0.0 projects fully compatible
- Settings and preferences preserved

## 🐛 **Bug Fixes & Improvements**

### **Enhanced TeX Detection**
- Better support for TeX Live 2025
- Improved binary path resolution
- More reliable system TeX discovery
- Enhanced error reporting

### **UI/UX Polish**
- Professional installation wizard
- Better progress indicators
- Improved error messages
- Smoother first-run experience

## 💻 **Building from Source**

```bash
git clone https://github.com/SrijitK10/Overleaf-offline.git
cd Overleaf-offline
npm install
npm run build
npm run package    # Creates installer
```

## 🙋‍♂️ **Support & Feedback**

- **Issues**: [GitHub Issues](https://github.com/SrijitK10/Overleaf-offline/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SrijitK10/Overleaf-offline/discussions)
- **Documentation**: [README](README.md)

---

## 🎉 **Why This Release Matters**

AuroraTex v1.1.0 represents a **major milestone** in making LaTeX accessible to everyone. By eliminating the complex TeX Live installation process, we've removed the biggest barrier to entry for new LaTeX users.

### **Impact**
- **New Users**: Can start writing LaTeX in minutes, not hours
- **Educators**: Can recommend AuroraTex without installation concerns  
- **Students**: Get up and running instantly for assignments
- **Professionals**: Zero-setup LaTeX environment for any machine

### **Technical Achievement**
- **400+ lines** of robust installation code
- **Cross-platform** installer with native UI
- **Production-ready** error handling and recovery
- **Enterprise-grade** security and validation

**AuroraTex is now truly plug-and-play!** 🚀

---

**Note**: AuroraTex is an independent project inspired by Overleaf but not affiliated with Overleaf or ShareLaTeX.
