// Ibid — Background Service Worker (Manifest V3)
// Initializes WASM engine, handles messages, context menus, commands

import init, { IbidEngine, version } from '../wasm/ibid_core.js';
import { resolveIdentifier } from './resolver.js';
import { BUNDLED_STYLES, STYLE_INDEX } from '../styles/bundled-styles.js';
import { initDB, getAllCitations, putCitation, putCitations, deleteCitation, deleteCitations, clearAllCitations, migrateFromChromeStorage } from './db.js';
import * as fallback from './fallback-parsers.js';

let engine = null;
let wasmReady = false;
let wasmError = null;
let styleCache = {};

// ---------------------------------------------------------------------------
// WASM Initialization
// ---------------------------------------------------------------------------

async function initWasm() {
  try {
    const wasmUrl = chrome.runtime.getURL('wasm/ibid_core_bg.wasm');
    await init(wasmUrl);
    engine = new IbidEngine();
    wasmReady = true;
    wasmError = null;
    console.log(`[Ibid] WASM engine v${version()} ready`);
  } catch (err) {
    wasmError = err.message || 'Unknown WASM initialization error';
    console.error('[Ibid] WASM init failed:', err);
  }
}

initWasm();

// Initialize IndexedDB (ready for future use, not primary storage yet)
initDB().catch(err => {
  console.error('[Ibid] DB init failed:', err);
});

// ---------------------------------------------------------------------------
// Style loading — 74 styles bundled offline, more downloadable from CSL repo
// ---------------------------------------------------------------------------

// Map legacy style IDs to current ones
const STYLE_ALIASES = {
  'apa7': 'apa', 'apa6': 'apa-6th-edition',
  'mla9': 'modern-language-association', 'mla8': 'modern-language-association',
  'chicago17-author-date': 'chicago-author-date',
  'chicago16-author-date': 'chicago-author-date-16th-edition',
  'harvard': 'harvard-cite-them-right',
};

async function loadStyleXml(styleId) {
  // Resolve aliases
  styleId = STYLE_ALIASES[styleId] || styleId;

  if (styleCache[styleId]) return styleCache[styleId];

  // 1. Try bundled styles (74 offline, no network needed)
  const bundled = BUNDLED_STYLES[styleId];
  if (bundled) {
    const url = chrome.runtime.getURL(bundled.path);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load style: ${res.status}`);
    const xml = await res.text();
    styleCache[styleId] = xml;
    return xml;
  }

  // 2. Try previously downloaded styles (cached in chrome.storage.local)
  const cacheKey = `csl_cache_${styleId}`;
  const cached = await chrome.storage.local.get([cacheKey]);
  if (cached[cacheKey]) {
    styleCache[styleId] = cached[cacheKey];
    return cached[cacheKey];
  }

  // 3. Download from official CSL repository on GitHub
  const githubUrl = `https://raw.githubusercontent.com/citation-style-language/styles/master/${styleId}.csl`;
  try {
    const res = await fetch(githubUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Style not found: ${styleId}`);
    const xml = await res.text();
    // Validate it's actual CSL XML
    if (!xml.includes('<style') || !xml.includes('purl.org/net/xbiblio/csl')) {
      throw new Error('Invalid CSL style file');
    }
    // Cache in memory and storage
    styleCache[styleId] = xml;
    await chrome.storage.local.set({ [cacheKey]: xml });
    return xml;
  } catch (e) {
    throw new Error(`Style "${styleId}" not available. ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Context Menus
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener((details) => {
  // Show welcome page on first install
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/welcome.html') });
  }

  chrome.contextMenus.create({
    id: 'ibid-cite-page',
    title: 'Cite this page',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'ibid-cite-link',
    title: 'Cite linked page',
    contexts: ['link'],
  });

  chrome.contextMenus.create({
    id: 'ibid-lookup-selection',
    title: 'Look up selected DOI/ISBN',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'ibid-import-dois',
    title: 'Import DOIs from selection',
    contexts: ['selection'],
  });
});

// Badge: show citation count on extension icon
async function updateBadge() {
  // Use chrome.storage.local as single source of truth (consistent with popup + side panel)
  const { citations = [] } = await chrome.storage.local.get(['citations']);
  if (citations.length > 0) {
    chrome.action.setBadgeText({ text: citations.length > 999 ? '999+' : citations.length.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#f49707' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Update badge on startup and when citations change
updateBadge();
chrome.storage.onChanged.addListener((changes) => {
  if (changes.citations) updateBadge();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Inject content script on demand
  if (tab?.id > 0) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['shared/identifiers.js', 'content/extractor.js'],
      });
    } catch (e) { /* may already be injected or restricted page */ }
  }

  if (info.menuItemId === 'ibid-cite-page') {
    if (tab?.id > 0) chrome.tabs.sendMessage(tab.id, { action: 'extractMetadata' });
  } else if (info.menuItemId === 'ibid-cite-link') {
    // Extract DOI or ISBN from the linked URL and resolve metadata
    if (info.linkUrl) {
      const doiMatch = info.linkUrl.match(/10\.\d{4,}\/[^\s&?#]+/);
      const isbnMatch = info.linkUrl.match(/(97[89]\d{10}|\d{9}[\dXx])/);
      const identifier = doiMatch
        ? doiMatch[0].replace(/[.,;:)\]}>]+$/, '')
        : isbnMatch ? isbnMatch[1] : null;

      if (identifier) {
        try {
          const res = await resolveIdentifier(identifier);
          if (res) {
            const meta = { ...res, _sourceUrl: info.linkUrl };
            if (doiMatch) meta.DOI = identifier;
            else if (isbnMatch) meta.ISBN = identifier;
            await chrome.storage.session.set({ ibid_link_cite: meta });
            // Try to open popup programmatically
            try { await chrome.action.openPopup(); } catch {}
          }
        } catch {}
      } else {
        // No DOI in link — open the page so user can cite it with full extraction
        chrome.tabs.create({ url: info.linkUrl });
      }
    }
  } else if (info.menuItemId === 'ibid-lookup-selection') {
    // Look up selected text as a DOI/ISBN/PMID — extract identifier from messy text
    let text = (info.selectionText || '').trim();
    // Extract DOI from anywhere in the selection (handles prefixes, URLs, garbage chars)
    const doiInText = text.match(/10\.\d{4,}\/[^\s"'<>)\]},;]{3,}/);
    if (doiInText) {
      text = doiInText[0].replace(/[.,;:)\]}>]+$/, '');
    } else {
      // Try ISBN, PMID patterns
      const isbnMatch = text.match(/(?:978|979)[\d-]{10,}/);
      const pmidMatch = text.match(/(?:pmid:?\s*)(\d{5,})/i);
      if (isbnMatch) text = isbnMatch[0];
      else if (pmidMatch) text = `PMID:${pmidMatch[1]}`;
    }
    if (text) {
      try {
        const res = await resolveIdentifier(text);
        if (res) {
          await chrome.storage.session.set({ ibid_link_cite: { ...res, _sourceUrl: tab?.url } });
          try { await chrome.action.openPopup(); } catch {}
        } else {
          await chrome.storage.session.set({ ibid_link_cite: { _error: `Could not resolve "${text.substring(0, 50)}". Not a valid DOI, ISBN, or PMID.` } });
          try { await chrome.action.openPopup(); } catch {}
        }
      } catch (e) {
        await chrome.storage.session.set({ ibid_link_cite: { _error: `Lookup failed: ${e.message || 'network error'}` } });
        try { await chrome.action.openPopup(); } catch {}
      }
    }
  } else if (info.menuItemId === 'ibid-import-dois') {
    // Extract all DOIs from selected text
    // Chrome's selectionText replaces newlines with spaces, breaking DOIs that wrap across lines
    // e.g. "10.5172/ conu.2009" → rejoin by removing spaces after /
    const text = (info.selectionText || '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/(10\.\d{4,}\/)\s+/g, '$1')
      .replace(/(doi\.org\/)\s+/g, '$1')
      .replace(/(\d)\s+(\.)/g, '$1$2')
      .replace(/\/\s+/g, '/');
    const dois = [...text.matchAll(/10\.\d{4,}\/[^\s"'<>)\]},;]{3,}/g)]
      .map(m => m[0].replace(/[.,;:)\]}>]+$/, ''));
    const unique = [...new Set(dois)];

    if (unique.length === 0) {
      // Flash badge red briefly
      chrome.action.setBadgeText({ text: '✗' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      chrome.action.setTitle({ title: 'Ibid — No DOIs found in selection' });
      setTimeout(() => { updateBadge(); chrome.action.setTitle({ title: 'Ibid — Cite this page' }); }, 5000);
      return;
    }

    // Get existing pending imports and library citations to skip duplicates
    let pending = [];
    try {
      const { ibid_bulk_import: prev } = await chrome.storage.session.get(['ibid_bulk_import']);
      if (prev) {
        const parsed = JSON.parse(prev);
        if (Array.isArray(parsed)) pending = parsed;
      }
    } catch {}
    const { citations: libCitations = [] } = await chrome.storage.local.get(['citations']);

    const alreadyHave = new Set([
      ...pending.map(e => e.DOI).filter(Boolean),
      ...libCitations.map(c => c.DOI).filter(Boolean),
    ]);

    // Filter out DOIs we already have
    const toResolve = unique.filter(doi => !alreadyHave.has(doi));

    if (toResolve.length === 0 && pending.length > 0) {
      // All DOIs already pending or in library
      chrome.action.setBadgeText({ text: `+${pending.length}` });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      chrome.action.setTitle({ title: `Ibid — All DOIs already pending or in library.` });
      setTimeout(() => { updateBadge(); chrome.action.setTitle({ title: 'Ibid — Cite this page' }); }, 5000);
      return;
    }

    // Signal "loading" immediately so sidepanel can show progress
    if (toResolve.length > 0) {
      await chrome.storage.session.set({
        ibid_bulk_import: JSON.stringify({ _loading: true, count: toResolve.length })
      });
    }

    // Resolve only new DOIs sequentially with rate limiting
    const resolved = [];
    for (let i = 0; i < toResolve.length; i++) {
      try {
        const res = await resolveIdentifier(toResolve[i]);
        if (res) resolved.push({ id: toResolve[i], ...res, DOI: toResolve[i] });
      } catch {}
      if (i < toResolve.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Merge with pending
    const merged = [...pending, ...resolved];
    if (merged.length > 0) {
      await chrome.storage.session.set({ ibid_bulk_import: JSON.stringify(merged, null, 2) });
    }

    // Flash badge green with total pending count
    chrome.action.setBadgeText({ text: `+${merged.length}` });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    chrome.action.setTitle({ title: `Ibid — ${merged.length} DOI(s) ready. Open Library (Ctrl+Shift+S) to import.` });
    setTimeout(() => { updateBadge(); chrome.action.setTitle({ title: 'Ibid — Cite this page' }); }, 10000);
  }
});

// ---------------------------------------------------------------------------
// Commands (keyboard shortcuts)
// ---------------------------------------------------------------------------

chrome.commands.onCommand.addListener((command) => {
  if (command === 'cite-page') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'extractMetadata' });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Omnibox: type "cite" in address bar
// ---------------------------------------------------------------------------

chrome.omnibox.onInputStarted.addListener(() => {
  chrome.omnibox.setDefaultSuggestion({
    description: 'Type a DOI, ISBN, PMID, or search your library'
  });
});

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const query = text.trim().toLowerCase();
  if (!query) return;

  const suggestions = [];

  // Check if it's an identifier
  if (query.match(/^10\.\d{4,}/) || query.match(/^doi:/i)) {
    suggestions.push({ content: `doi:${query.replace(/^doi:/i, '')}`, description: `Look up DOI: ${query}` });
  }
  if (query.match(/^isbn:/i) || query.replace(/[-\s]/g, '').match(/^(97[89])?\d{9}[\dXx]$/)) {
    suggestions.push({ content: `isbn:${query.replace(/^isbn:/i, '')}`, description: `Look up ISBN: ${query}` });
  }
  if (query.match(/^pmid:/i) || query.match(/^\d{6,}$/)) {
    suggestions.push({ content: `pmid:${query.replace(/^pmid:/i, '')}`, description: `Look up PMID: ${query}` });
  }

  // Search library
  try {
    const { citations = [] } = await chrome.storage.local.get(['citations']);
    const matches = citations.filter(c =>
      c.title?.toLowerCase().includes(query) ||
      c.author?.some(a => a.family?.toLowerCase().includes(query))
    ).slice(0, 5);

    for (const c of matches) {
      const author = c.author?.[0]?.family || '';
      const year = c.issued?.['date-parts']?.[0]?.[0] || '';
      suggestions.push({
        content: c.DOI || c.URL || c.title || c.id,
        description: `${author}${year ? ` (${year})` : ''} — ${(c.title || '').slice(0, 60)}`
      });
    }
  } catch {}

  suggest(suggestions);
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const t = text.trim();

  // If it's an identifier, open popup or resolve
  if (t.match(/^doi:|^10\.\d/i)) {
    const doi = t.replace(/^doi:/i, '').trim();
    // Open a new tab with the DOI URL for now
    chrome.tabs.create({ url: `https://doi.org/${doi}` });
    return;
  }

  // If it's a URL, navigate to it
  if (t.startsWith('http')) {
    chrome.tabs.update({ url: t });
    return;
  }

  // Otherwise, open the side panel to show search results
  const win = await chrome.windows.getCurrent();
  chrome.sidePanel.open({ windowId: win.id });
});

// ---------------------------------------------------------------------------
// Message handling
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async responses
  handleMessage(message).then(sendResponse).catch((err) => {
    sendResponse({ error: err.toString() });
  });
  return true; // keep channel open for async
});

async function handleMessage(message) {
  if (message.action === 'getVersion') {
    return {
      version: wasmReady ? version() : '(loading...)',
      wasmReady,
      wasmError,
    };
  }

  if (message.action === 'getStyles') {
    // Return bundled styles + any previously downloaded styles from the registry
    const bundled = Object.entries(BUNDLED_STYLES).map(([id, info]) => ({
      id, name: info.name, group: info.group, field: info.field, bundled: true,
    }));
    // Check for cached downloaded style IDs
    const { downloaded_style_ids: downloadedIds = [] } = await chrome.storage.local.get(['downloaded_style_ids']);
    const downloaded = downloadedIds.map(s => ({
      id: s.id, name: s.name, group: s.group || 'Downloaded', field: s.field || 'generic', bundled: false,
    }));
    return { styles: [...bundled, ...downloaded] };
  }

  // Download and cache a style from the official CSL repository
  if (message.action === 'downloadStyle') {
    const styleId = message.styleId;
    if (!styleId) return { error: 'No style ID provided' };
    try {
      const xml = await loadStyleXml(styleId);
      // Extract style name from the XML
      const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
      const name = titleMatch ? titleMatch[1] : styleId;
      const groupMatch = xml.match(/<category\s+field="([^"]+)"/);
      const field = groupMatch ? groupMatch[1] : 'generic';
      // Track in downloaded styles list
      const { downloaded_style_ids: existing = [] } = await chrome.storage.local.get(['downloaded_style_ids']);
      if (!existing.find(s => s.id === styleId)) {
        existing.push({ id: styleId, name, group: 'Downloaded', field });
        await chrome.storage.local.set({ downloaded_style_ids: existing });
      }
      return { success: true, name, styleId };
    } catch (e) {
      return { error: e.message };
    }
  }

  // Search the official CSL repository for styles by name
  if (message.action === 'searchRemoteStyles') {
    const query = (message.query || '').toLowerCase().trim();
    if (!query || query.length < 2) return { styles: [] };
    try {
      // Fetch the file list from GitHub API (cached in memory for the session)
      if (!globalThis._cslFileList) {
        const res = await fetch(
          'https://api.github.com/repos/citation-style-language/styles/git/trees/master',
          { signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) return { styles: [], error: 'GitHub API unavailable' };
        const data = await res.json();
        globalThis._cslFileList = data.tree
          .filter(f => f.path.endsWith('.csl') && f.type === 'blob')
          .map(f => f.path.replace('.csl', ''));
      }
      // Filter by query
      const matches = globalThis._cslFileList
        .filter(id => id.includes(query) || id.replace(/-/g, ' ').includes(query))
        .slice(0, 30)
        .map(id => ({
          id,
          name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          group: 'CSL Repository',
          field: 'generic',
          bundled: false,
          remote: true,
        }));
      return { styles: matches };
    } catch (e) {
      return { styles: [], error: e.message };
    }
  }

  // Search styles — all 74 bundled styles, offline
  if (message.action === 'searchStyles') {
    const query = (message.query || '').toLowerCase();
    const results = STYLE_INDEX.filter((s) =>
      s.name.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query) ||
      s.field.toLowerCase().includes(query)
    );
    return { styles: results };
  }

  // ---------------------------------------------------------------------------
  // Citation CRUD via IndexedDB
  // ---------------------------------------------------------------------------

  if (message.action === 'getCitations') {
    return { citations: await getAllCitations() };
  }

  if (message.action === 'saveCitation') {
    await putCitation(message.item);
    updateBadge();
    return { success: true };
  }

  if (message.action === 'saveCitations') {
    await putCitations(message.items);
    updateBadge();
    return { success: true, count: message.items.length };
  }

  if (message.action === 'deleteCitation') {
    await deleteCitation(message.id);
    updateBadge();
    return { success: true };
  }

  if (message.action === 'deleteCitations') {
    await deleteCitations(message.ids);
    updateBadge();
    return { success: true };
  }

  if (message.action === 'clearCitations') {
    await clearAllCitations();
    updateBadge();
    return { success: true };
  }

  // Resolve identifier — doesn't need WASM
  if (message.action === 'resolve') {
    try {
      const resolved = await resolveIdentifier(message.identifier);
      if (resolved) {
        return { resolved, source: resolved._source || 'unknown' };
      }
      return { error: 'Could not resolve identifier' };
    } catch (err) {
      return { error: err.toString() };
    }
  }

  // ---------------------------------------------------------------------------
  // Import/Export — WASM preferred, JS fallback when unavailable
  // ---------------------------------------------------------------------------

  if (message.action === 'parseImport') {
    const { text, format } = message;

    // Try WASM first
    if (wasmReady) {
      try {
        let resultJson;
        if (format === 'bibtex' || format === 'bib') resultJson = engine.parseBibtex(text);
        else if (format === 'ris') resultJson = engine.parseRis(text);
        else if (format === 'csl-json' || format === 'json') resultJson = engine.parseCslJson(text);
        else if (format === 'endnote-xml' || format === 'endnote') resultJson = engine.parseEndnoteXml(text);
        else if (format === 'medline' || format === 'nbib') resultJson = engine.parseMedline(text);
        else if (format === 'csv') resultJson = engine.parseCsv(text, ',');
        else if (format === 'tsv') resultJson = engine.parseCsv(text, '\t');
        else {
          // Auto-detect
          const t = text.trimStart();
          if (t.startsWith('@')) resultJson = engine.parseBibtex(text);
          else if (t.startsWith('TY  -') || t.match(/^[A-Z]{2}\s\s-/)) resultJson = engine.parseRis(text);
          else if (t.startsWith('[') || t.startsWith('{')) resultJson = engine.parseCslJson(text);
          else if (t.startsWith('<?xml') || t.startsWith('<xml') || t.startsWith('<records')) resultJson = engine.parseEndnoteXml(text);
          else if (t.startsWith('PMID-')) resultJson = engine.parseMedline(text);
          else if (t.includes('\t') && t.split('\n')[0].split('\t').length >= 3) resultJson = engine.parseCsv(text, '\t');
          else if (t.split('\n')[0].split(',').length >= 3) resultJson = engine.parseCsv(text, ',');
          else throw new Error('Unknown format — try JS fallback');
        }
        return JSON.parse(resultJson);
      } catch (err) {
        // WASM parse failed — try JS fallback
        console.warn('[Ibid] WASM parse failed, trying JS fallback:', err);
      }
    }

    // JS fallback
    try {
      if (format === 'bibtex' || format === 'bib') return fallback.parseBibtex(text);
      if (format === 'ris') return fallback.parseRis(text);
      if (format === 'csl-json' || format === 'json') return fallback.parseCslJson(text);
      // Auto-detect for JS fallback
      return fallback.autoDetectAndParse(text);
    } catch (err) {
      return { error: `Parse failed: ${err.message}` };
    }
  }

  if (message.action === 'export') {
    const { items, format, options } = message;

    // Formats that don't need WASM
    if (format === 'csl-json' || format === 'json') {
      return { data: JSON.stringify(items, null, 2), filename: 'bibliography.json', mime: 'application/json' };
    }

    // Try WASM first
    if (wasmReady) {
      try {
        const itemsJson = JSON.stringify(items);
        if (format === 'bibtex' || format === 'bib') {
          return { data: engine.exportBibtex(itemsJson, JSON.stringify(options || {})), filename: 'bibliography.bib', mime: 'application/x-bibtex' };
        } else if (format === 'ris') {
          return { data: engine.exportRis(itemsJson), filename: 'bibliography.ris', mime: 'application/x-research-info-systems' };
        } else if (format === 'csv') {
          return { data: engine.exportCsv(itemsJson, ','), filename: 'bibliography.csv', mime: 'text/csv' };
        } else if (format === 'tsv') {
          return { data: engine.exportCsv(itemsJson, '\t'), filename: 'bibliography.tsv', mime: 'text/tab-separated-values' };
        } else if (format === 'word-xml') {
          return { data: engine.exportWordXml(itemsJson), filename: 'bibliography.xml', mime: 'application/xml' };
        } else if (format === 'yaml') {
          return { data: engine.exportYaml(itemsJson), filename: 'bibliography.yaml', mime: 'text/yaml' };
        }
      } catch (err) {
        console.warn('[Ibid] WASM export failed, trying JS fallback:', err);
      }
    }

    // JS fallback for export
    try {
      if (format === 'bibtex' || format === 'bib') {
        return { data: fallback.exportBibtex(items), filename: 'bibliography.bib', mime: 'application/x-bibtex' };
      } else if (format === 'ris') {
        return { data: fallback.exportRis(items), filename: 'bibliography.ris', mime: 'application/x-research-info-systems' };
      } else if (format === 'csv') {
        return { data: fallback.exportCsv(items, ','), filename: 'bibliography.csv', mime: 'text/csv' };
      } else if (format === 'tsv') {
        return { data: fallback.exportCsv(items, '\t'), filename: 'bibliography.tsv', mime: 'text/tab-separated-values' };
      } else if (format === 'text' || format === 'html' || format === 'markdown') {
        // Formatted output doesn't need WASM — uses JS formatter
        // (handled below in the WASM section but works without it)
      }
    } catch (err) {
      return { error: `Export failed: ${err.message}` };
    }

    // Formatted output (text/html/markdown) — JS-based, no WASM needed
    if (format === 'text' || format === 'html' || format === 'markdown') {
      // This is handled by the popup's JS formatter, not WASM
      // Return items as JSON for the UI to format
      return { error: 'Formatted export uses the popup citation formatter. Export as BibTeX or RIS instead, or copy citations from the popup.' };
    }

    if (format === 'word-xml' || format === 'yaml') {
      return { error: `${format.toUpperCase()} export requires the citation engine. Try reloading the extension.`, wasmRequired: true };
    }

    return { error: `Unknown export format: ${format}` };
  }

  // Everything below strictly needs WASM (CSL rendering)
  if (!wasmReady) {
    if (wasmError) {
      return { error: `Citation engine not available: ${wasmError}`, wasmFailed: true };
    }
    return { error: 'Citation engine loading. Try again in a moment.', wasmLoading: true };
  }

  switch (message.action) {
    case 'formatCitation': {
      const xml = message.styleXml || (await loadStyleXml(message.styleId || 'apa7'));
      engine.loadStyle(xml);
      engine.setFormat(message.format || 'html');
      const result = engine.formatBibliographyEntry(JSON.stringify(message.item));
      return { citation: result };
    }

    case 'formatInText': {
      const xml = message.styleXml || (await loadStyleXml(message.styleId || 'apa7'));
      engine.loadStyle(xml);
      engine.setFormat(message.format || 'text');
      const result = engine.formatCitation(JSON.stringify([message.item]));
      return { citation: result };
    }

    case 'formatBoth': {
      try {
        const xml = message.styleXml || (await loadStyleXml(message.styleId || 'apa7'));
        engine.loadStyle(xml);
        const item = message.item;
        if (!item.type) item.type = 'webpage';
        const itemJson = JSON.stringify(item);
        const bib = engine.formatBibliographyEntry(itemJson);
        const intext = engine.formatCitation(JSON.stringify([item]));
        console.log('[Ibid] formatBoth OK — style:', message.styleId, 'bib length:', bib?.length, 'intext:', intext?.substring(0, 40));
        return { bibliography: bib, intext };
      } catch (e) {
        console.error('[Ibid] formatBoth FAILED — style:', message.styleId, 'error:', e.message || e);
        return { error: `Render failed: ${e.message || e}` };
      }
    }

    case 'fetchArticleMeta': {
      // Fetch article HTML page and extract Highwire/DC meta tags
      try {
        if (!message.url) return { error: 'No URL' };
        const res = await fetch(message.url, { redirect: 'follow' });
        if (!res.ok) return { error: `Fetch failed: ${res.status}` };
        const html = await res.text();

        const getMeta = (name, attr = 'name') => {
          const m = html.match(new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`, 'i'));
          return m ? m[1].trim() : null;
        };
        const getAllMeta = (name, attr = 'name') => {
          const re = new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`, 'gi');
          const results = []; let m;
          while ((m = re.exec(html))) results.push(m[1].trim());
          return results;
        };

        const meta = {};
        meta.title = getMeta('citation_title') || getMeta('DC.title') || getMeta('dc.title');
        meta.authors = getAllMeta('citation_author').length ? getAllMeta('citation_author') :
                       getAllMeta('DC.creator').length ? getAllMeta('DC.creator') : getAllMeta('dc.creator');
        meta.journal = getMeta('citation_journal_title') || getMeta('prism.publicationName');
        meta.volume = getMeta('citation_volume') || getMeta('prism.volume');
        meta.issue = getMeta('citation_issue') || getMeta('prism.number');
        const fp = getMeta('citation_firstpage') || getMeta('prism.startingPage');
        const lp = getMeta('citation_lastpage') || getMeta('prism.endingPage');
        meta.pages = fp ? (lp ? `${fp}-${lp}` : fp) : null;
        meta.date = getMeta('citation_publication_date') || getMeta('citation_date') || getMeta('DC.date') || getMeta('dc.date');
        meta.publisher = getMeta('citation_publisher') || getMeta('DC.publisher') || getMeta('dc.publisher');
        meta.issn = getMeta('citation_issn') || getMeta('prism.issn');

        return { meta };
      } catch (e) {
        return { error: e.message || String(e) };
      }
    }

    case 'extractPdfText': {
      try {
        if (!message.url) return { error: 'No URL provided' };
        const res = await fetch(message.url);
        if (!res.ok) return { error: `Fetch failed: ${res.status}` };
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        console.log('[Ibid] extractPdfText — fetched', bytes.length, 'bytes from', message.url);
        const text = engine.extractPdfText(bytes);
        console.log('[Ibid] extractPdfText — extracted', text.length, 'chars');
        return { text };
      } catch (e) {
        console.error('[Ibid] extractPdfText FAILED:', e.message || e);
        return { error: e.message || String(e) };
      }
    }

    case 'getStyleInfo': {
      const xml = message.styleXml || (await loadStyleXml(message.styleId || 'apa7'));
      engine.loadStyle(xml);
      const info = engine.getStyleInfo();
      return { info: JSON.parse(info) };
    }

    // parseImport and export are handled above with JS fallback

    default:
      return { error: `Unknown action: ${message.action}` };
  }
}
