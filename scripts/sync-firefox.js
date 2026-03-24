#!/usr/bin/env node
// Syncs browser/chrome/* to browser/firefox/ with Firefox manifest.
// Usage: node scripts/sync-firefox.js
//
// This creates a full Firefox extension directory that can be loaded
// directly in about:debugging for development.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHROME_SRC = path.join(ROOT, 'browser', 'chrome');
const FIREFOX_DIR = path.join(ROOT, 'browser', 'firefox');

// Generate Firefox manifest
console.log('Generating Firefox manifest...');
execSync(`node "${path.join(ROOT, 'scripts', 'build-firefox-manifest.js')}"`, { stdio: 'pipe' });

// Save the manifest before sync
const firefoxManifest = fs.readFileSync(path.join(FIREFOX_DIR, 'manifest.json'), 'utf-8');

// Sync all files from chrome to firefox (except manifest and storelisting)
console.log('Syncing files from chrome/ to firefox/...');
syncDir(CHROME_SRC, FIREFOX_DIR, ['manifest.json', 'storelisting.txt']);

// Restore Firefox manifest
fs.writeFileSync(path.join(FIREFOX_DIR, 'manifest.json'), firefoxManifest);

console.log('Firefox extension synced to:', FIREFOX_DIR);
console.log('Load in Firefox: about:debugging#/runtime/this-firefox → Load Temporary Add-on → browser/firefox/manifest.json');

function syncDir(src, dest, exclude = []) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude.includes(entry.name) || entry.name.startsWith('.')) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      syncDir(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
