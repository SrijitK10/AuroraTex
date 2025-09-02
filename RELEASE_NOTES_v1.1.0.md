# AuroraTex v1.1.0 - Performance & Reliability Update

🚀 **Major performance improvements and reliability enhancements for a smoother LaTeX editing experience!**

## 🌟 What's New

### ⚡ Lightning-Fast Startup
- **40% faster app launch** with async service initialization
- **Smart window display** - no more blank screens during startup
- **Background TeX detection** - heavy operations no longer block the UI

### 🔧 Rock-Solid PDF Refresh
- **Intelligent retry mechanism** - PDF refresh now works reliably every time
- **File integrity checks** - ensures PDFs are completely copied before display
- **Better error messages** - clear feedback when something goes wrong

### 🧹 Under the Hood
- Cleaned up duplicate code for better maintainability
- Enhanced service architecture for optimal performance
- Improved error handling and debugging capabilities

## 💾 Installation

### 🚀 Quick Downloads
- **macOS (Apple Silicon)**: [Download DMG](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.1.0/AuroraTex-1.1.0-arm64.dmg)
- **macOS (Intel)**: [Download DMG](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.1.0/AuroraTex-1.1.0.dmg)
- **Linux**: [Download AppImage](https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.1.0/AuroraTex-1.1.0.AppImage)

### 📋 Requirements
- TeX Live or TinyTeX for LaTeX compilation
- The app will guide you through TeX setup on first run

## 🔧 Technical Improvements

### Startup Optimizations
- Services now initialize asynchronously in the background
- Window appears only when fully ready
- TeX validation runs without blocking the main thread

### PDF Reliability
- Added `robustFileCopy()` with 3 retry attempts
- File size validation before and after copy operations
- Automatic cleanup of partial copies on failure
- Enhanced error reporting for debugging

### Code Quality
- Removed duplicate `isFirstRun()` method
- Streamlined service initialization
- Better logging for troubleshooting

## 🐛 Bug Fixes
- ✅ Fixed intermittent PDF refresh failures
- ✅ Resolved startup timing issues causing blank windows
- ✅ Eliminated race conditions in file operations
- ✅ Improved overall app stability

## 🔄 Upgrade Notes
- This update maintains full backward compatibility
- All existing projects will work without modification
- Clean installation is recommended for optimal performance

## 🙏 Acknowledgments
Special thanks to users who reported performance and reliability issues. Your feedback drives these improvements!

---

**Full Changelog**: [v1.0.0...v1.1.0](https://github.com/SrijitK10/Overleaf-offline/compare/v1.0.0...v1.1.0)
