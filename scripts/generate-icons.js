// Generate Ibid extension icons from SVG using sharp
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ICON_DIR = path.resolve(__dirname, '..', 'browser', 'chrome', 'icons');
const SHARED_DIR = path.resolve(__dirname, '..', 'browser', 'shared', 'icons');
fs.mkdirSync(ICON_DIR, { recursive: true });
fs.mkdirSync(SHARED_DIR, { recursive: true });

// Design: Open book with a saffron bookmark ribbon
// Clean, scholarly, universally recognized as "reference/citation"
function makeSvg(size) {
  const r = Math.round(size * 0.20);
  const s = size; // shorthand

  // Proportional sizing
  const bookL = s * 0.15;           // book left edge
  const bookR = s * 0.85;           // book right edge
  const bookT = s * 0.22;           // book top
  const bookB = s * 0.72;           // book bottom
  const spine = s * 0.50;           // center spine
  const pageInset = s * 0.04;       // page offset from cover

  // Bookmark ribbon
  const bmX = s * 0.58;
  const bmW = s * 0.10;
  const bmTop = s * 0.18;
  const bmBot = s * 0.52;
  const bmNotch = s * 0.45;

  // Text lines on left page
  const lineY1 = bookT + s * 0.14;
  const lineY2 = bookT + s * 0.22;
  const lineY3 = bookT + s * 0.30;
  const lineX1 = bookL + s * 0.06;
  const lineX2 = spine - s * 0.06;

  // Bracket [ ] symbol on right page — represents citation reference
  const bracketY = bookT + s * 0.16;
  const bracketSize = s * 0.22;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffb820"/>
      <stop offset="100%" stop-color="#d87102"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${s}" height="${s}" rx="${r}" ry="${r}" fill="url(#bg)"/>

  <!-- Book - left page -->
  <path d="M ${spine} ${bookT + s*0.02}
           Q ${spine - s*0.03} ${bookT} ${bookL + s*0.03} ${bookT + s*0.01}
           L ${bookL} ${bookT + s*0.03}
           L ${bookL} ${bookB}
           L ${spine} ${bookB - s*0.02}
           Z"
        fill="white" opacity="0.92"/>

  <!-- Book - right page -->
  <path d="M ${spine} ${bookT + s*0.02}
           Q ${spine + s*0.03} ${bookT} ${bookR - s*0.03} ${bookT + s*0.01}
           L ${bookR} ${bookT + s*0.03}
           L ${bookR} ${bookB}
           L ${spine} ${bookB - s*0.02}
           Z"
        fill="white" opacity="0.85"/>

  <!-- Spine line -->
  <line x1="${spine}" y1="${bookT}" x2="${spine}" y2="${bookB}" stroke="#d87102" stroke-width="${Math.max(s*0.015, 0.8)}" opacity="0.3"/>

  <!-- Text lines on left page -->
  <rect x="${lineX1}" y="${lineY1}" width="${(lineX2 - lineX1) * 0.9}" height="${Math.max(s*0.025, 1)}" rx="${s*0.01}" fill="#d87102" opacity="0.25"/>
  <rect x="${lineX1}" y="${lineY2}" width="${(lineX2 - lineX1) * 0.7}" height="${Math.max(s*0.025, 1)}" rx="${s*0.01}" fill="#d87102" opacity="0.20"/>
  <rect x="${lineX1}" y="${lineY3}" width="${(lineX2 - lineX1) * 0.8}" height="${Math.max(s*0.025, 1)}" rx="${s*0.01}" fill="#d87102" opacity="0.20"/>

  <!-- Citation number [1] on right page -->
  <text x="${spine + (bookR - spine) * 0.5}" y="${bracketY + bracketSize * 0.75}"
        text-anchor="middle" font-family="Georgia, serif" font-weight="bold"
        font-size="${bracketSize}" fill="#d87102" opacity="0.5">[1]</text>

  <!-- Bookmark ribbon -->
  <path d="M ${bmX} ${bmTop}
           L ${bmX + bmW} ${bmTop}
           L ${bmX + bmW} ${bmBot}
           L ${bmX + bmW/2} ${bmNotch}
           L ${bmX} ${bmBot}
           Z"
        fill="#d87102" opacity="0.8"/>

  <!-- Bottom label bar -->
  <rect x="${s*0.15}" y="${s*0.78}" width="${s*0.70}" height="${Math.max(s*0.04, 1.5)}" rx="${s*0.02}" fill="white" opacity="0.35"/>
  <rect x="${s*0.15}" y="${s*0.85}" width="${s*0.45}" height="${Math.max(s*0.04, 1.5)}" rx="${s*0.02}" fill="white" opacity="0.22"/>
</svg>`;
}

const sizes = [16, 32, 48, 128];

async function generate() {
  for (const size of sizes) {
    const svg = makeSvg(size);
    const outPath = path.join(ICON_DIR, `icon-${size}.png`);
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
    console.log(`Generated ${outPath} (${size}x${size})`);
  }

  for (const size of sizes) {
    const svg = makeSvg(size);
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(SHARED_DIR, `icon-${size}.png`));
  }

  for (const size of [192, 512]) {
    const svg = makeSvg(size);
    const outPath = path.join(SHARED_DIR, `icon-${size}.png`);
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
    console.log(`Generated ${outPath} (${size}x${size})`);
  }

  fs.writeFileSync(path.join(SHARED_DIR, 'icon.svg'), makeSvg(128));
  console.log('All icons generated.');
}

generate().catch(console.error);
