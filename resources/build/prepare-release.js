#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparing Offline Overleaf for release...\n');

// Check system requirements
console.log('📋 Checking system requirements...');

try {
  execSync('node --version', { stdio: 'pipe' });
  console.log('✅ Node.js is available');
} catch (error) {
  console.error('❌ Node.js is required but not found');
  process.exit(1);
}

try {
  execSync('npm --version', { stdio: 'pipe' });
  console.log('✅ npm is available');
} catch (error) {
  console.error('❌ npm is required but not found');
  process.exit(1);
}

// Check if we're in the right directory
const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ package.json not found - are you in the right directory?');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
console.log(`✅ Found project: ${packageJson.name} v${packageJson.version}`);

// Check TeX installation
console.log('\n🔍 Checking TeX installation...');

const texCommands = ['pdflatex', 'xelatex', 'lualatex', 'latexmk'];
const foundTeX = [];

for (const cmd of texCommands) {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    foundTeX.push(cmd);
  } catch (error) {
    // Command not found
  }
}

if (foundTeX.length > 0) {
  console.log(`✅ Found TeX binaries: ${foundTeX.join(', ')}`);
} else {
  console.log('⚠️  No TeX binaries found - users will need to install TeX separately');
}

// Prepare build
console.log('\n🔨 Preparing build environment...');

try {
  console.log('Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed');
} catch (error) {
  console.error('❌ Failed to install dependencies');
  process.exit(1);
}

// Run build
console.log('\n🏗️  Building application...');

try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Application built successfully');
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}

// Show packaging options
console.log('\n📦 Ready to package! Use one of these commands:');
console.log('');
console.log('  npm run package:mac    # macOS (dmg + pkg)');
console.log('  npm run package:win    # Windows (nsis + msi)');
console.log('  npm run package:linux  # Linux (AppImage + deb + rpm)');
console.log('  npm run package:all    # All platforms');
console.log('');
console.log('💡 Tip: Set APPLE_ID and APPLE_ID_PASS environment variables for macOS notarization');
console.log('');
console.log('🎉 Offline Overleaf is ready for packaging!');
