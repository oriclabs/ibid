#!/usr/bin/env node
// Build store-ready ZIP packages for Chrome, Edge, and Firefox.
// Usage: node scripts/build-store-packages.js
//
// Output:
//   browser/dist/chrome/ibid-chrome-v{version}.zip
//   browser/dist/edge/ibid-edge-v{version}.zip
//   browser/dist/firefox/ibid-firefox-v{version}.zip

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHROME_SRC = path.join(ROOT, 'browser', 'chrome');
const DIST = path.join(ROOT, 'browser', 'dist');

// Read version from manifest
const manifest = JSON.parse(fs.readFileSync(path.join(CHROME_SRC, 'manifest.json'), 'utf-8'));
const VERSION = manifest.version;

console.log(`Building store packages for Ibid v${VERSION}\n`);

// Files/dirs to exclude from ZIP
// Create ZIP with forward-slash paths (required by Firefox AMO)
function createZip(sourceDir, zipPath) {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const absZip = path.resolve(zipPath).replace(/\\/g, '/');
  const absSrc = path.resolve(sourceDir).replace(/\\/g, '/');
  const pyFile = path.join(DIST, '_mkzip.py');
  fs.writeFileSync(pyFile, [
    'import zipfile, os, sys',
    `src = "${absSrc}"`,
    `dst = "${absZip}"`,
    'exclude = {"storelisting.txt", ".DS_Store", "Thumbs.db"}',
    'with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zf:',
    '    for root, dirs, files in os.walk(src):',
    '        for f in files:',
    '            if f in exclude or f.endswith(".map"): continue',
    '            full = os.path.join(root, f)',
    '            arc = os.path.relpath(full, src).replace(chr(92), "/")',
    '            zf.write(full, arc)',
  ].join('\n'));
  try { execSync(`python3 "${pyFile}"`, { stdio: 'pipe' }); }
  catch { execSync(`python "${pyFile}"`, { stdio: 'pipe' }); }
  fs.unlinkSync(pyFile);
}

// ---------------------------------------------------------------------------
// 1. Chrome Web Store
// ---------------------------------------------------------------------------
function buildChrome() {
  const outDir = path.join(DIST, 'chrome');
  fs.mkdirSync(outDir, { recursive: true });
  const zipName = `ibid-chrome-v${VERSION}.zip`;
  const zipPath = path.join(outDir, zipName);

  console.log(`[Chrome] Building ${zipName}...`);
  createZip(CHROME_SRC, zipPath);

  const size = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
  console.log(`[Chrome] ${zipPath} (${size} MB)`);
  return zipPath;
}

// ---------------------------------------------------------------------------
// 2. Edge Add-ons (same as Chrome — Edge uses Chromium MV3)
// ---------------------------------------------------------------------------
function buildEdge() {
  const outDir = path.join(DIST, 'edge');
  fs.mkdirSync(outDir, { recursive: true });
  const zipName = `ibid-edge-v${VERSION}.zip`;
  const zipPath = path.join(outDir, zipName);

  console.log(`[Edge] Building ${zipName}...`);
  createZip(CHROME_SRC, zipPath);

  const size = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
  console.log(`[Edge] ${zipPath} (${size} MB)`);
  return zipPath;
}

// ---------------------------------------------------------------------------
// 3. Firefox AMO
// ---------------------------------------------------------------------------
function buildFirefox() {
  const outDir = path.join(DIST, 'firefox');
  fs.mkdirSync(outDir, { recursive: true });
  const zipName = `ibid-firefox-v${VERSION}.zip`;
  const zipPath = path.join(outDir, zipName);

  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  // Generate Firefox manifest
  console.log('[Firefox] Generating manifest...');
  execSync(`node "${path.join(ROOT, 'scripts', 'build-firefox-manifest.js')}"`, { stdio: 'pipe' });

  // Create temp dir with Chrome source + Firefox manifest
  const tmpDir = path.join(DIST, '_firefox_tmp');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });

  // Copy chrome source
  console.log('[Firefox] Copying extension files...');
  copyDirSync(CHROME_SRC, tmpDir, ['storelisting.txt']);

  // Overwrite manifest with Firefox version
  const firefoxManifest = path.join(ROOT, 'browser', 'firefox', 'manifest.json');
  fs.copyFileSync(firefoxManifest, path.join(tmpDir, 'manifest.json'));

  // Create zip with forward-slash paths (Firefox AMO requires this)
  console.log(`[Firefox] Building ${zipName}...`);
  createZip(tmpDir, zipPath);

  // Cleanup temp dir
  fs.rmSync(tmpDir, { recursive: true });

  const size = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
  console.log(`[Firefox] ${zipPath} (${size} MB)`);
  return zipPath;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function copyDirSync(src, dest, excludeFiles = []) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (excludeFiles.includes(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, excludeFiles);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
try {
  const chrome = buildChrome();
  const edge = buildEdge();
  const firefox = buildFirefox();

  console.log('\n' + '='.repeat(60));
  console.log('Store packages ready:');
  console.log(`  Chrome:  ${chrome}`);
  console.log(`  Edge:    ${edge}`);
  console.log(`  Firefox: ${firefox}`);
  console.log('='.repeat(60));
  console.log('\nSubmission URLs:');
  console.log('  Chrome:  https://chrome.google.com/webstore/devconsole');
  console.log('  Edge:    https://partner.microsoft.com/en-us/dashboard/microsoftedge');
  console.log('  Firefox: https://addons.mozilla.org/en-US/developers/');
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}
