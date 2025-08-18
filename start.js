#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Build both main and renderer
console.log('Building application...');

const buildMain = spawn('npm', ['run', 'build:main'], { stdio: 'inherit' });

buildMain.on('close', (code) => {
  if (code !== 0) {
    console.error('Main build failed');
    process.exit(1);
  }

  const buildRenderer = spawn('npm', ['run', 'build:renderer'], { stdio: 'inherit' });
  
  buildRenderer.on('close', (code) => {
    if (code !== 0) {
      console.error('Renderer build failed');
      process.exit(1);
    }

    console.log('Starting Electron app...');
    const electron = spawn('electron', ['dist/main/main.js'], { stdio: 'inherit' });
    
    electron.on('close', (code) => {
      console.log(`Electron exited with code ${code}`);
    });
  });
});
