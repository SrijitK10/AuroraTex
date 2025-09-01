# AuroraTex - Professional Offline LaTeX Editor

![Downloads](https://img.shields.io/github/downloads/SrijitK10/Overleaf-offline/total)
![Latest Release](https://img.shields.io/github/v/release/SrijitK10/Overleaf-offline)
![License](https://img.shields.io/github/license/SrijitK10/Overleaf-offline)

A fully offline LaTeX editor inspired by Overleaf, built with Electron, React, and Node.js. AuroraTex provides a complete LaTeX editing environment that works entirely offline with no internet connection required.

> **✨ Fully Rebranded**: Formerly "Offline Overleaf", now proudly **AuroraTex** with professional branding and enhanced user experience.

## 📥 Download & Install

### 🚀 Quick Downloads
- **macOS (Apple Silicon)**: [Download DMG](https://github.com/SrijitK10/Overleaf-offline/releases/latest/download/AuroraTex-1.0.0-arm64.dmg) (96MB)
- **macOS (Intel)**: [Download DMG](https://github.com/SrijitK10/Overleaf-offline/releases/latest/download/AuroraTex-1.0.0.dmg) (101MB)
- **Linux**: [Download AppImage](https://github.com/SrijitK10/Overleaf-offline/releases/latest/download/AuroraTex-1.0.0.AppImage) (104MB)

### 💻 Installation Instructions

#### macOS
1. Download the DMG file for your Mac (Apple Silicon or Intel)
2. Double-click to open the disk image
3. Drag **"AuroraTex"** to Applications folder
4. Launch from Applications or Spotlight search
5. **First time**: Right-click app → "Open" → "Open" (bypasses Gatekeeper)

#### Linux  
1. Download the AppImage file
2. Make executable: `chmod +x AuroraTex-1.0.0.AppImage`
3. Run: `./AuroraTex-1.0.0.AppImage`

#### Windows
1. Download and extract the ZIP file (when available)
2. Run `AuroraTex.exe` from extracted folder
3. Pin to taskbar or create shortcut as needed

> **📋 TeX Requirement**: AuroraTex includes 4 sample templates. For full compilation, install [TeX Live](https://tug.org/texlive/) or the app will guide you through setup on first run with automatic TeX detection.

## ✨ Features

### Core Functionality
- **🔧 Project Management**: Create, open, and manage LaTeX projects with ease
- **📁 Smart File Tree**: Intuitive sidebar navigation and file organization
- **✏️ Advanced Editor**: CodeMirror 6 powered LaTeX editing with syntax highlighting
- **📄 Real-time PDF Preview**: Instant compilation and preview with PDF.js
- **🔨 Robust Compilation**: Integrated LaTeX compilation with detailed logs and error handling
- **🎯 Error Navigation**: Click errors to jump directly to source location
- **💾 Auto-save**: Automatic saving of all changes
- **📚 Sample Templates**: Includes 4 built-in LaTeX templates (article, thesis, presentation, minimal)

### Professional Features
- **🛡️ First-Run Setup**: Comprehensive system check and automatic TeX detection
- **🔍 TeX Live Support**: Auto-detects TeX Live 2025 and other distributions
- **⚡ Background Compilation**: Non-blocking compilation with progress tracking
- **📊 System Status**: Real-time status monitoring and health checks
- **🔒 Secure Sandbox**: All operations sandboxed for security
- **🌐 Fully Offline**: Zero internet dependency after installation

## Architecture

### Frontend (React + TypeScript)
- **Topbar**: Project name, compile button, status indicators
- **Sidebar**: File tree with project navigation
- **Main Editor**: CodeMirror 6 based LaTeX editor with tabs
- **PDF Viewer**: PDF.js based preview with zoom and navigation
- **Log Panel**: Compilation logs and error display

### Backend (Electron Main Process)
- **Project Service**: Project CRUD operations and metadata management
- **File Service**: Secure file system operations within project boundaries
- **Compile Orchestrator**: LaTeX compilation pipeline with job queue
- **Settings Service**: Application preferences and TeX binary detection
- **Snapshot Service**: Project history and backup management

### Security Features
- **Context Isolation**: Secure IPC communication between processes
- **Path Validation**: Prevents access outside project directories
- **Shell Escape Protection**: Disabled by default for security
- **Process Timeouts**: Prevents runaway compilations

## Requirements

- Node.js 16+ 
- TeX Live or TinyTeX (for LaTeX compilation)
- macOS, Windows, or Linux

## Installation

1. Clone or download the project files
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the application:
   ```bash
   npm run build
   ```

4. Start the application:
   ```bash
   npm start
   ```

## Development

For development with hot reload:

```bash
# Terminal 1 - Build and watch main process
npm run dev:main

# Terminal 2 - Start renderer dev server
npm run dev:renderer
```

Or use the concurrent command:
```bash
npm run dev
```

## LaTeX Setup

The application will automatically detect your LaTeX installation. Supported engines:
- `pdflatex` (default)
- `xelatex` 
- `lualatex`

### Installing LaTeX

#### macOS
```bash
# Using Homebrew
brew install --cask mactex

# Or install BasicTeX for smaller footprint
brew install --cask basictex
```

#### Windows
Download and install TeX Live from: https://tug.org/texlive/

#### Linux
```bash
# Ubuntu/Debian
sudo apt-get install texlive-full

# Or minimal installation
sudo apt-get install texlive-base texlive-latex-recommended texlive-latex-extra
```

## Usage

### Creating a New Project
1. Launch the application
2. Click "New Project" on the welcome screen
3. Enter a project name
4. Start editing your LaTeX document

### Editing Files
- Click on files in the file tree to open them
- Edit multiple files using tabs
- Changes are automatically saved
- Use Cmd/Ctrl+S to manually save

### Compiling Documents
- Click the "Compile" button in the topbar
- View compilation progress and logs in the bottom panel
- PDF preview updates automatically on successful compilation
- Click on errors in the log to jump to the source location

### Project Structure
```
MyProject/
├── main.tex          # Main LaTeX file
├── project.json      # Project configuration
├── output/           # Generated PDFs and auxiliary files
│   └── main.pdf
└── .history/         # Project snapshots
```

## File Types Supported

- `.tex` - LaTeX source files
- `.bib` - Bibliography files  
- `.cls` - LaTeX class files
- `.sty` - LaTeX style files
- `.png`, `.jpg`, `.pdf` - Images and figures
- All other text files for includes and custom content

## Keyboard Shortcuts

- `Cmd/Ctrl + S` - Save current file
- `Cmd/Ctrl + B` - Compile project
- `Cmd/Ctrl + W` - Close current tab

## Project Configuration

Each project contains a `project.json` file with settings:

```json
{
  "id": "unique-project-id",
  "name": "Project Name",
  "mainFile": "main.tex",
  "settings": {
    "engine": "pdflatex",
    "shellEscape": false,
    "bibTool": "bibtex",
    "timeoutMs": 180000
  }
}
```

## Troubleshooting

### LaTeX Not Found
If the application cannot find your LaTeX installation:
1. Check that `pdflatex` is in your system PATH
2. Restart the application after installing LaTeX
3. Check the application logs for detection attempts

### Compilation Errors
- Check the log panel for detailed error messages
- Ensure all required packages are installed
- Verify file paths and references are correct
- Try compiling with a simpler document to test setup

### Performance Issues
- Large projects may take longer to compile
- Consider splitting large documents into smaller files
- Clear auxiliary files periodically

## Building for Distribution

To create distributable packages:

```bash
npm run package
```

This creates platform-specific installers in the `dist-electron/` directory.

## Technology Stack

- **Electron**: Desktop application framework
- **React**: UI library with TypeScript
- **CodeMirror 6**: Advanced code editor
- **PDF.js**: PDF rendering and display
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Better SQLite3**: Fast, reliable database (when enabled)
- **Node.js**: Backend runtime and file operations

## Architecture Principles

1. **Security First**: All file operations are validated and sandboxed
2. **Offline First**: No external dependencies during runtime
3. **Performance**: Efficient compilation pipeline with job queuing
4. **Reliability**: Robust error handling and recovery
5. **Extensibility**: Modular architecture for future enhancements

## Contributing

This application follows the milestone-based development plan outlined in the original specification. Key areas for contribution:

1. Additional LaTeX language support
2. Enhanced error parsing and display
3. Plugin system for extensions
4. Collaborative editing features
5. Advanced PDF synchronization
6. Template system expansion

## License

This project is provided as-is for educational and personal use. Please ensure compliance with all third-party package licenses.

---

**Note**: This application is designed to work completely offline. No telemetry or external connections are made during normal operation.
