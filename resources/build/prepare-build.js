#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[Prepare Build] Starting build preparation...');

// Ensure resources directory exists
const resourcesDir = path.join(__dirname, '..', '..');
const buildResourcesDir = path.join(resourcesDir, 'resources');

if (!fs.existsSync(buildResourcesDir)) {
  console.log('[Prepare Build] Creating resources directory...');
  fs.mkdirSync(buildResourcesDir, { recursive: true });
}

// Check if we have TeX binaries to bundle
const texliveDir = path.join(buildResourcesDir, 'texlive');
if (fs.existsSync(texliveDir)) {
  console.log('[Prepare Build] TeX Live bundle detected - will be included in distribution');
} else {
  console.log('[Prepare Build] No TeX Live bundle - app will use system TeX installation');
}

// Validate templates
const templatesDir = path.join(buildResourcesDir, 'templates');
if (fs.existsSync(templatesDir)) {
  const templates = fs.readdirSync(templatesDir);
  console.log(`[Prepare Build] Found ${templates.length} sample templates`);
} else {
  console.log('[Prepare Build] No sample templates found');
}

// Create app metadata
const appMetadata = {
  buildDate: new Date().toISOString(),
  version: require('../../package.json').version,
  bundledTeX: fs.existsSync(texliveDir),
  features: {
    offlineReady: true,
    bundledTemplates: fs.existsSync(templatesDir),
    autoCompile: true,
    pdfViewer: true,
    syntaxHighlighting: true,
    bibTeXSupport: true,
    snapshotHistory: true
  }
};

fs.writeFileSync(
  path.join(buildResourcesDir, 'app-metadata.json'),
  JSON.stringify(appMetadata, null, 2)
);

console.log('[Prepare Build] Build preparation complete!');
console.log(`[Prepare Build] App version: ${appMetadata.version}`);
console.log(`[Prepare Build] Bundled TeX: ${appMetadata.bundledTeX}`);
console.log(`[Prepare Build] Build date: ${appMetadata.buildDate}`);
