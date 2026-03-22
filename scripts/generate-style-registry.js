// Generate the BUNDLED_STYLES JS constant from csl-registry.json + local .csl files
// Usage: node scripts/generate-style-registry.js

const fs = require('fs');
const path = require('path');

const CSL_DIR = path.resolve(__dirname, '..', 'browser', 'chrome', 'styles', 'csl');
const OUT = path.resolve(__dirname, '..', 'browser', 'chrome', 'styles', 'bundled-styles.js');

// Our hand-written simplified styles that actually work with the parser
// Map official repo IDs → our working file IDs
const SIMPLIFIED_OVERRIDES = {
  'apa':                          { useFile: 'apa7', name: 'APA 7th Edition' },
  'apa-6th-edition':              { useFile: 'apa6', name: 'APA 6th Edition' },
  'modern-language-association':  { useFile: 'mla9', name: 'MLA 9th Edition' },
  'chicago-author-date':          { useFile: 'chicago17-author-date', name: 'Chicago 17th (Author-Date)' },
  'chicago-author-date-16th-edition': { useFile: 'chicago16-author-date', name: 'Chicago 16th (Author-Date)' },
  'harvard-cite-them-right':      { useFile: 'harvard', name: 'Harvard - Cite Them Right' },
};

// These are our hand-written files — skip them from the main list since
// they're accessed via the overrides above
const SKIP_IDS = new Set(['apa7', 'apa6', 'mla9', 'mla8', 'chicago17-author-date', 'chicago16-author-date', 'harvard']);

// Get all .csl files
const files = fs.readdirSync(CSL_DIR).filter(f => f.endsWith('.csl'));

// Try to load registry for metadata
let registry = [];
const regPath = path.join(CSL_DIR, '..', 'csl-registry.json');
if (fs.existsSync(regPath)) {
  registry = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
}

const regMap = {};
for (const r of registry) regMap[r.id] = r;

// Build entries
const entries = [];

for (const f of files) {
  const id = f.replace('.csl', '');

  // Skip our simplified files — they're accessed via overrides
  if (SKIP_IDS.has(id)) continue;

  const reg = regMap[id];
  const override = SIMPLIFIED_OVERRIDES[id];

  entries.push({
    id,
    name: override?.name || reg?.name || id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    group: reg?.group || 'Other',
    field: reg?.field || 'generic',
    // If this ID has a simplified override, point to the simplified file
    path: override ? `styles/csl/${override.useFile}.csl` : `styles/csl/${f}`,
  });
}

entries.sort((a, b) => a.name.localeCompare(b.name));

// Generate JS
const js = `// Auto-generated — do not edit. Run: node scripts/generate-style-registry.js
// ${entries.length} bundled styles (complex styles redirect to simplified parser-compatible versions)

export const BUNDLED_STYLES = ${JSON.stringify(
  Object.fromEntries(entries.map(e => [e.id, { path: e.path, name: e.name, group: e.group, field: e.field }])),
  null, 2
)};

export const STYLE_INDEX = ${JSON.stringify(
  entries.map(e => ({ id: e.id, name: e.name, group: e.group, field: e.field, bundled: true })),
  null, 2
)};
`;

fs.writeFileSync(OUT, js);
console.log(`Generated ${OUT}`);
console.log(`${entries.length} bundled styles`);

// Show overrides
for (const [official, info] of Object.entries(SIMPLIFIED_OVERRIDES)) {
  const exists = files.includes(`${official}.csl`);
  console.log(`  ${official} → ${info.useFile}.csl ${exists ? '(official file also exists)' : '(official file missing)'}`);
}
