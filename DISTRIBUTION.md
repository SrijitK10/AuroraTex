# Distribution Guide: How People Download Your App

## 🎯 Distribution Strategy Overview

There are several ways people can download and install your Offline Overleaf app from GitHub:

### 1. GitHub Releases (Primary Method)
- **Best for**: General users, official distribution
- **Process**: Upload built packages to GitHub Releases
- **Benefits**: Automatic download URLs, version tracking, release notes

### 2. GitHub Pages (Optional)
- **Best for**: Professional download page
- **Process**: Host a custom download page at `yourusername.github.io/repo-name`
- **Benefits**: Better UX, automatic platform detection

### 3. Direct Repository (Development)
- **Best for**: Developers, contributors
- **Process**: Clone repo and build from source
- **Benefits**: Latest changes, customization

## 📦 What Happens with DMG Files on macOS

### DMG Installation Process:
1. **User downloads DMG** from GitHub releases
2. **Double-clicks DMG file** → mounts as disk image
3. **Drag app to Applications** → installs to `/Applications/Offline Overleaf.app`
4. **App appears in**: 
   - Applications folder
   - Spotlight search
   - Launchpad
   - Dock (if pinned)

### First Launch Experience:
```
User double-clicks app →
  ↓
macOS Gatekeeper check →
  ↓
"App from unidentified developer" warning →
  ↓ 
User right-clicks → "Open" → "Open anyway" →
  ↓
App launches and performs first-run setup →
  ↓
Ready to use!
```

## 🚀 Setting Up GitHub Releases

### Step 1: Create a Release
```bash
# Using GitHub CLI (recommended)
gh release create v1.0.0 \
    --title "Offline Overleaf v1.0.0" \
    --notes-file release-notes.md \
    dist-electron/*.dmg \
    dist-electron/*.pkg \
    dist-electron/*.AppImage
```

### Step 2: Manual Upload (Alternative)
1. Go to `https://github.com/SrijitK10/Overleaf-offline/releases`
2. Click "Create a new release"
3. Tag: `v1.0.0`
4. Title: `Offline Overleaf v1.0.0`
5. Upload files:
   - `Offline Overleaf-1.0.0.dmg` (Intel Mac)
   - `Offline Overleaf-1.0.0-arm64.dmg` (Apple Silicon)
   - `Offline Overleaf-1.0.0.AppImage` (Linux)
   - `Offline-Overleaf-1.0.0-Windows-x64.zip` (Windows)

## 📝 User Download Instructions

### For README.md:
```markdown
## 📥 Download

### Quick Install
- **macOS**: [Download DMG](https://github.com/SrijitK10/Overleaf-offline/releases/latest/download/Offline%20Overleaf-1.0.0-arm64.dmg)
- **Linux**: [Download AppImage](https://github.com/SrijitK10/Overleaf-offline/releases/latest/download/Offline%20Overleaf-1.0.0.AppImage)  
- **Windows**: [Download ZIP](https://github.com/SrijitK10/Overleaf-offline/releases/latest/download/Offline-Overleaf-1.0.0-Windows-x64.zip)

### Installation
#### macOS
1. Download DMG → Double-click → Drag to Applications
2. First run: Right-click app → "Open" → "Open"

#### Linux  
1. Download AppImage → `chmod +x filename.AppImage` → Run

#### Windows
1. Download ZIP → Extract → Run `Offline Overleaf.exe`
```

## 🔗 Download URLs Structure

Once you create a GitHub release, people can download using these patterns:

### Latest Release (Auto-updating URLs):
```
https://github.com/SrijitK10/Overleaf-offline/releases/latest/download/Offline%20Overleaf-1.0.0-arm64.dmg
https://github.com/SrijitK10/Overleaf-offline/releases/latest/download/Offline%20Overleaf-1.0.0.dmg
https://github.com/SrijitK10/Overleaf-offline/releases/latest/download/Offline%20Overleaf-1.0.0.AppImage
```

### Specific Version:
```
https://github.com/SrijitK10/Overleaf-offline/releases/download/v1.0.0/Offline%20Overleaf-1.0.0-arm64.dmg
```

## 🛡️ Code Signing & Security

### Current Status (Unsigned):
- **macOS**: Users get Gatekeeper warning → need to right-click "Open"
- **Windows**: Antivirus may flag → users need to allow
- **Linux**: No issues with AppImage

### To Fix (Optional):
```bash
# macOS Developer Certificate
# 1. Get Apple Developer ID certificate ($99/year)
# 2. Configure in package.json:
"build": {
  "mac": {
    "identity": "Developer ID Application: Your Name"
  }
}

# Windows Code Signing
# 1. Get code signing certificate
# 2. Configure in package.json:
"build": {
  "win": {
    "certificateFile": "path/to/cert.p12",
    "certificatePassword": "password"
  }
}
```

## 📊 Analytics & Tracking

### GitHub Release Downloads:
- GitHub automatically tracks download counts
- View at: `https://github.com/SrijitK10/Overleaf-offline/releases`
- API: `https://api.github.com/repos/SrijitK10/Overleaf-offline/releases`

### Optional: Download Analytics
```html
<!-- Add to download page for tracking -->
<script>
  // Track downloads with Google Analytics, etc.
  function trackDownload(platform) {
    gtag('event', 'download', {
      'app_platform': platform,
      'app_version': '1.0.0'
    });
  }
</script>
```

## 🚀 Promotion & Discovery

### README Badges:
```markdown
![Downloads](https://img.shields.io/github/downloads/SrijitK10/Overleaf-offline/total)
![Latest Release](https://img.shields.io/github/v/release/SrijitK10/Overleaf-offline)
![License](https://img.shields.io/github/license/SrijitK10/Overleaf-offline)
```

### Social Media:
- Share release announcements
- Include screenshots/demos
- Tag relevant communities (#LaTeX, #Electron, etc.)

### Communities:
- r/LaTeX subreddit
- LaTeX Stack Exchange
- Electron Discord
- Academic Twitter

## 🔄 Auto-Updates (Future)

### Current: Manual Updates
Users need to:
1. Check for new releases
2. Download new version
3. Replace old installation

### Future: Auto-Updater
```javascript
// Using electron-updater
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();
```

## 📋 Launch Checklist

Before public release:
- [ ] Test all download links work
- [ ] Verify installations on fresh systems
- [ ] Add screenshots to README
- [ ] Create release notes
- [ ] Test first-run experience
- [ ] Update version numbers
- [ ] Create GitHub release
- [ ] Share in communities

---

**Ready to distribute!** Your users will have a smooth download and install experience across all platforms. 🎉
