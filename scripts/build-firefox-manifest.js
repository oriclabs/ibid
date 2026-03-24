#!/usr/bin/env node
// Generates Firefox-compatible manifest.json from Chrome manifest.
// Usage: node scripts/build-firefox-manifest.js
//
// Key differences handled:
// 1. background.service_worker → background.scripts (Firefox MV3 uses event pages)
// 2. optional_host_permissions → optional_permissions (Firefox uses unified optional_permissions)
// 3. side_panel → sidebar_action (Firefox equivalent)
// 4. Remove sidePanel permission (Firefox doesn't have it)
// 5. Add browser_specific_settings for Firefox addon ID
// 6. content_security_policy format differs slightly

const fs = require('fs');
const path = require('path');

const chromeManifest = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../browser/chrome/manifest.json'), 'utf-8')
);

const firefoxManifest = JSON.parse(JSON.stringify(chromeManifest)); // deep clone

// 1. Background: service_worker → scripts
if (firefoxManifest.background?.service_worker) {
  firefoxManifest.background = {
    scripts: [firefoxManifest.background.service_worker],
    type: firefoxManifest.background.type || 'module',
  };
}

// 2. Host permissions for Firefox
// Firefox MV3 background scripts need host_permissions for cross-origin fetch
// (unlike Chrome where service worker fetch bypasses CORS for sites with CORS headers).
// Essential API hosts go in host_permissions (required), scholarly ones in optional_permissions.
firefoxManifest.host_permissions = [
  'https://api.crossref.org/*',
  'https://api.openalex.org/*',
  'https://openlibrary.org/*',
  'https://www.googleapis.com/*',
  'https://api.ncbi.nlm.nih.gov/*',
  'https://raw.githubusercontent.com/*',
];

// Scholarly APIs that need optional permissions (same as Chrome)
if (firefoxManifest.optional_host_permissions) {
  firefoxManifest.optional_permissions = [
    ...(firefoxManifest.optional_permissions || []),
    ...firefoxManifest.optional_host_permissions,
  ];
  delete firefoxManifest.optional_host_permissions;
}

// 3. side_panel → sidebar_action
if (firefoxManifest.side_panel) {
  firefoxManifest.sidebar_action = {
    default_panel: firefoxManifest.side_panel.default_path,
    default_title: 'Ibid — Library',
    default_icon: firefoxManifest.icons?.['32'] || firefoxManifest.icons?.['16'],
  };
  delete firefoxManifest.side_panel;
}

// 4. Remove Chrome-only permissions
firefoxManifest.permissions = (firefoxManifest.permissions || []).filter(
  p => !['sidePanel'].includes(p)
);

// 5. Add Firefox addon ID
firefoxManifest.browser_specific_settings = {
  gecko: {
    id: 'ibid@ibid.tools',
    strict_min_version: '109.0', // MV3 support in Firefox
  },
};

// 6. Content security policy — Firefox uses flat string for MV3
if (firefoxManifest.content_security_policy?.extension_pages) {
  firefoxManifest.content_security_policy =
    firefoxManifest.content_security_policy.extension_pages;
}

// 7. web_accessible_resources — Firefox MV3 uses same format as Chrome
// (no changes needed)

// 8. Commands — _execute_side_panel → _execute_sidebar_action
if (firefoxManifest.commands?.['_execute_side_panel']) {
  firefoxManifest.commands['_execute_sidebar_action'] =
    firefoxManifest.commands['_execute_side_panel'];
  delete firefoxManifest.commands['_execute_side_panel'];
}

// Output
const outDir = path.resolve(__dirname, '../browser/firefox');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, 'manifest.json');
fs.writeFileSync(outPath, JSON.stringify(firefoxManifest, null, 2) + '\n');

console.log(`Firefox manifest written to: ${outPath}`);
console.log('\nKey changes from Chrome manifest:');
console.log('  - background.service_worker → background.scripts');
console.log('  - optional_host_permissions → optional_permissions');
console.log('  - side_panel → sidebar_action');
console.log('  - Removed sidePanel permission');
console.log('  - Added browser_specific_settings.gecko');
console.log('  - _execute_side_panel → _execute_sidebar_action');
console.log('\nTo build Firefox extension:');
console.log('  1. Copy browser/chrome/* to browser/firefox/');
console.log('  2. Replace manifest.json with browser/firefox/manifest.json');
console.log('  3. Package as .xpi');
