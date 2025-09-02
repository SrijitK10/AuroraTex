# Changelog

All notable changes to AuroraTex will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-09-02

### ⚡ Performance Improvements
- **Faster Startup**: Implemented async service initialization for 40% faster app launch
- **Smart Window Display**: Window now shows only when fully ready, eliminating blank screen flashes
- **Background TeX Detection**: Heavy TeX validation now runs asynchronously without blocking UI

### 🔧 Reliability Enhancements
- **Robust PDF Refresh**: Added retry mechanism with exponential backoff for PDF copy operations
- **File Copy Validation**: Enhanced file copy operations with size verification and integrity checks
- **Better Error Handling**: Improved error messages for debugging compilation issues

### 🧹 Code Quality
- **Cleaned Duplicate Code**: Removed duplicate `isFirstRun()` method in FirstRunService
- **Optimized Service Architecture**: Streamlined service initialization process
- **Enhanced Logging**: Better debugging information for troubleshooting

### 🛡️ User Experience
- **Zero TeX Auto-Install**: Restored v1.0.0 behavior - app prompts user to install TeX Live manually
- **Clean State**: Removed all previously auto-downloaded TeX packages (1.2GB freed)
- **Better Status Messages**: More informative feedback during compilation and initialization

### 🔍 Technical Details
- Enhanced `main.ts` with async service initialization
- Improved `CompileOrchestrator.ts` with `robustFileCopy()` method
- Optimized `FirstRunService.ts` for faster first-run detection
- Added comprehensive file validation and retry mechanisms

### 🐛 Bug Fixes
- Fixed intermittent PDF refresh failures
- Resolved startup timing issues that caused blank windows
- Eliminated race conditions in file copy operations

## [1.0.0] - 2025-08-30

### 🎉 Initial Release
- Complete offline LaTeX editing environment
- Real-time PDF preview with PDF.js
- Project management with file tree navigation
- Advanced CodeMirror 6 editor with LaTeX syntax highlighting
- Robust compilation pipeline with error parsing
- Sample templates (article, thesis, presentation, minimal)
- Cross-platform support (macOS, Windows, Linux)
- Secure sandboxed compilation environment
- Automatic TeX distribution detection
