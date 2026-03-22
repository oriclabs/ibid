// Build script: assembles Chrome extension from shared + chrome-specific files
// Copies WASM, styles, and extension files into browser/dist/chrome/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'browser', 'dist', 'chrome');
const CHROME = path.join(ROOT, 'browser', 'chrome');
const WASM = path.join(ROOT, 'browser', 'shared', 'wasm');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clean dist
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true });
}

// Copy chrome extension files
copyDir(CHROME, DIST);

// Copy WASM files
const wasmDist = path.join(DIST, 'wasm');
fs.mkdirSync(wasmDist, { recursive: true });
for (const file of ['ibid_core_bg.wasm', 'ibid_core.js']) {
  const src = path.join(WASM, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(wasmDist, file));
  }
}

console.log(`[build] Chrome extension assembled in ${DIST}`);
console.log(`[build] Files:`);
let fileCount = 0;
function countFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) countFiles(path.join(dir, entry.name));
    else fileCount++;
  }
}
countFiles(DIST);
console.log(`[build] ${fileCount} files total`);
