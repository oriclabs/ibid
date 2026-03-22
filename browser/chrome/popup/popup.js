// Ibid — Popup Script
// Extracts metadata from active tab and renders via WASM engine

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// State
let currentMetadata = null;
let currentStyle = 'apa7';
let globalStyle = 'apa7';
let projects = [];
let intextMode = 'parenthetical';
let currentProjectId = 'default';

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  // Get version and WASM status from background
  chrome.runtime.sendMessage({ action: 'getVersion' }, (res) => {
    if (res?.version) {
      $('#engine-version').textContent = `v${res.version}`;
    }
    if (res?.wasmError) {
      showHint('restricted', `Citation engine failed to load. Citations will use basic formatting. Try reloading the extension.`);
    }
  });

  // Load saved preferences
  const prefs = await chrome.storage.local.get(['defaultStyle', 'lastProject']);
  if (prefs.defaultStyle) {
    currentStyle = prefs.defaultStyle;
    $('#style-selector').value = currentStyle;
  }

  // Load projects
  await loadProjects();

  // Event listeners (bind BEFORE async extraction so they always work)
  $('#btn-copy-bib').addEventListener('click', copyBibliography);
  $('#btn-copy-intext').addEventListener('click', copyInText);
  $('#btn-add-project').addEventListener('click', addToProject);
  $('#btn-retry').addEventListener('click', () => location.reload());
  $('#btn-enhance').addEventListener('click', enhanceMetadata);
  $('#btn-rescan').addEventListener('click', rescanPage);
  const openHelp = () => chrome.tabs.create({ url: chrome.runtime.getURL('help/help.html') });
  $('#btn-help').addEventListener('click', openHelp);
  $('#btn-help-header').addEventListener('click', openHelp);

  // Style info toggle
  $('#style-info-btn').addEventListener('click', () => {
    const tip = $('#style-info-tip');
    if (!tip.classList.contains('hidden')) {
      tip.classList.add('hidden');
      return;
    }
    const type = $('#source-type').value;
    const info = STYLE_REQUIRED_FIELDS[type] || { required: ['title'], recommended: [] };
    const typeName = $('#source-type').selectedOptions[0]?.textContent || type;
    const req = info.required.map(f => f.replace(/-/g, ' ')).join(', ');
    const rec = info.recommended.map(f => f.replace(/-/g, ' ')).join(', ');
    tip.innerHTML = `<strong>${typeName}</strong> requires: ${req}.${rec ? ` Recommended: ${rec}.` : ''} Fields marked with <span class="text-saffron-500">*</span> are required.`;
    tip.classList.remove('hidden');
  });

  // Smart date input
  $('#field-date').addEventListener('input', onDateInput);
  $('#date-precision').addEventListener('change', onDatePrecisionChange);
  $('#btn-no-date').addEventListener('click', () => {
    $('#field-date').value = '';
    setDateHint('info', 'No date — will show as "n.d." in citation');
    updatePreview();
  });

  // Project management
  $('#project-selector').addEventListener('change', onProjectChange);
  $('#btn-new-project').addEventListener('click', () => {
    $('#new-project-form').classList.toggle('hidden');
    if (!$('#new-project-form').classList.contains('hidden')) {
      $('#new-project-name').focus();
    }
  });
  $('#btn-cancel-project').addEventListener('click', () => {
    $('#new-project-form').classList.add('hidden');
    $('#new-project-name').value = '';
    $('#new-project-style').value = '';
  });
  $('#btn-create-project').addEventListener('click', createProject);
  $('#new-project-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createProject();
  });
  // Quick settings dropdown toggle
  $('#btn-settings').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#quick-settings').classList.toggle('hidden');
  });
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const qs = $('#quick-settings');
    if (!qs.classList.contains('hidden') && !qs.contains(e.target) && e.target !== $('#btn-settings')) {
      qs.classList.add('hidden');
    }
  });
  // Advanced settings → full options page
  $('#btn-advanced-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

  // Quick settings: default style
  loadQuickSettings();
  $('#qs-style').addEventListener('change', () => {
    globalStyle = $('#qs-style').value;
    chrome.storage.local.set({ defaultStyle: globalStyle });
    resolveStyle(); // re-resolve: project style takes priority if set
    updatePreview();
  });
  // Quick settings: locale
  $('#qs-locale').addEventListener('change', () => {
    chrome.storage.local.set({ defaultLocale: $('#qs-locale').value });
  });
  // Quick settings: theme
  for (const btn of $$('.qs-theme')) {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      chrome.storage.local.set({ theme });
      applyTheme(theme);
      for (const b of $$('.qs-theme')) {
        b.className = 'qs-theme flex-1 text-[10px] py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors';
      }
      btn.className = 'qs-theme flex-1 text-[10px] py-1 bg-saffron-500 text-white';
    });
  }

  $('#btn-sidepanel').addEventListener('click', async () => {
    const win = await chrome.windows.getCurrent();
    chrome.sidePanel.open({ windowId: win.id });
  });
  $('#style-selector').addEventListener('change', onStyleChange);
  $('#source-type').addEventListener('change', onSourceTypeChange);

  // In-text toggle — P (parenthetical) / N (narrative)
  $('#btn-parenthetical').addEventListener('click', () => {
    intextMode = 'parenthetical';
    $('#btn-parenthetical').setAttribute('class', 'text-[9px] px-1.5 py-0.5 bg-saffron-500 text-white');
    $('#btn-narrative').setAttribute('class', 'text-[9px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300');
    updatePreview();
  });
  $('#btn-narrative').addEventListener('click', () => {
    intextMode = 'narrative';
    $('#btn-narrative').setAttribute('class', 'text-[9px] px-1.5 py-0.5 bg-saffron-500 text-white');
    $('#btn-parenthetical').setAttribute('class', 'text-[9px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300');
    updatePreview();
  });

  // Auto-update citation on field change
  for (const input of $$('input, select')) {
    input.addEventListener('input', debounce(updatePreview, 300));
  }

  // Enter key copies bibliography (when not focused on a text field)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.target.matches('input, textarea, select, button')) {
      e.preventDefault();
      copyBibliography();
    }
    // Ctrl+Enter copies from anywhere
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      copyBibliography();
    }
  });

  // Extract metadata from current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isRestricted = !tab?.url || tab.url.startsWith('chrome://') ||
      tab.url.startsWith('edge://') || tab.url.startsWith('about:') ||
      tab.url.startsWith('chrome-extension://');

    if (isRestricted) {
      currentMetadata = { URL: tab?.url || '', type: 'webpage' };
      showState('ready');
      showHint('restricted', 'This page can\'t be auto-cited. Enter details manually or paste a DOI/ISBN below and click Enhance.');
    } else if (tab?.id) {
      // Programmatically inject content scripts (no <all_urls> permission needed)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/extractor.js'],
        });
        // Also inject PDF extractor for PDF pages
        if (tab.url?.toLowerCase().endsWith('.pdf') || tab.url?.includes('pdf')) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/pdf-extractor.js'],
          });
        }
      } catch (e) {
        // Injection failed — restricted page or already injected
      }

      // Check if we have cached enhanced data for this URL
      const cacheKey = `ibid_cache_${tab.id}`;
      const cached = await chrome.storage.session.get([cacheKey]);
      const cachedData = cached[cacheKey];

      if (cachedData && cachedData.url === tab.url) {
        // Restore cached fields — user reopened popup on same page
        currentMetadata = cachedData.metadata;
        populateFields(currentMetadata);
        showState('ready');
        showHint('info', 'Restored from previous session on this page.');
      } else {
        // Fresh extraction
        chrome.tabs.sendMessage(tab.id, { action: 'extractMetadata' }, (response) => {
          if (chrome.runtime.lastError || !response?.metadata) {
            currentMetadata = {
              title: tab.title || '',
              URL: tab.url || '',
              type: 'webpage',
            };
            populateFields(currentMetadata);
            showHint('sparse', 'Could not read this page. Fields pre-filled from tab info — review and complete manually.');
          } else {
            currentMetadata = response.metadata;
            populateFields(currentMetadata);

            const hasAuthor = currentMetadata.author?.length > 0;
            const hasDate = !!currentMetadata.issued;
            const hasDoi = !!currentMetadata.DOI;
            const hasTitle = !!currentMetadata.title;

            if (hasTitle && hasAuthor && hasDate) {
              // Good extraction — no hint
            } else if (hasTitle && !hasAuthor && !hasDoi) {
              showHint('sparse', 'Limited metadata found (missing author). If you have a DOI, paste it below and click Enhance.');
            } else if (hasTitle && !hasAuthor && hasDoi) {
              showHint('enhancing', 'Author not found on page — looking up via DOI...');
            }
          }
          showState('ready');
          tryAutoEnhance();
        });
      }
    } else {
      showState('ready');
      showHint('restricted', 'No active tab found. Enter citation details manually.');
    }
  } catch (err) {
    currentMetadata = { type: 'webpage' };
    showState('ready');
    showHint('restricted', 'Enter citation details manually or paste a DOI/ISBN below.');
  }
});

// ---------------------------------------------------------------------------
// Field population
// ---------------------------------------------------------------------------

function populateFields(meta) {
  $('#field-title').value = meta.title || '';
  $('#field-authors').value = formatAuthorsForInput(meta.author || []);
  $('#field-date').value = formatDateForInput(meta.issued);
  // Set precision based on extracted date parts
  if (meta.issued?.['date-parts']?.[0]) {
    const len = meta.issued['date-parts'][0].length;
    $('#date-precision').value = len >= 3 ? 'day' : len === 2 ? 'month' : 'year';
    $('#field-date').placeholder = len >= 3 ? 'YYYY-MM-DD' : len === 2 ? 'YYYY-MM' : 'YYYY';
  }
  $('#field-publisher').value = meta.publisher || '';
  $('#field-container').value = meta['container-title'] || '';
  $('#field-volume').value = meta.volume || '';
  $('#field-issue').value = meta.issue || '';
  $('#field-pages').value = meta.page || '';
  $('#field-doi').value = meta.DOI || meta.URL || '';
  $('#source-type').value = meta.type || 'webpage';

  // Delay type validation — auto-enhance may fill missing fields shortly
  clearTimeout(window._validateTimer);
  window._validateTimer = setTimeout(() => validateSourceType(), 1500);
  updateFieldRelevance();
  updatePreview();
}

function formatAuthorsForInput(authors) {
  return authors
    .map((a) => {
      if (a.literal) return a.literal;
      if (a.family && a.given) return `${a.family}, ${a.given}`;
      if (a.family) return a.family;
      return '';
    })
    .filter(Boolean)
    .join('; ');
}

function formatDateForInput(date) {
  if (!date) return '';
  if (date.literal) return date.literal;
  if (date['date-parts']?.[0]) {
    return date['date-parts'][0].join('-');
  }
  return '';
}

// ---------------------------------------------------------------------------
// Build CSL-JSON from current fields
// ---------------------------------------------------------------------------

function buildCslItem() {
  const item = {
    id: 'current',
    type: $('#source-type').value,
    title: $('#field-title').value,
    author: parseAuthorsInput($('#field-authors').value),
    issued: parseDateInput($('#field-date').value),
    publisher: $('#field-publisher').value || undefined,
    'container-title': $('#field-container').value || undefined,
    volume: $('#field-volume').value || undefined,
    issue: $('#field-issue').value || undefined,
    page: $('#field-pages').value || undefined,
    URL: undefined,
    DOI: undefined,
  };

  const doiOrUrl = $('#field-doi').value.trim();
  if (doiOrUrl.match(/^10\./)) {
    // Clean query strings and fragments from DOI
    const cleanDoi = doiOrUrl.replace(/[?#].*$/, '').replace(/[.,;:)\]}>]+$/, '').trim();
    item.DOI = cleanDoi;
    item.URL = `https://doi.org/${cleanDoi}`;
  } else if (doiOrUrl) {
    // If URL contains a DOI, extract and clean it
    const doiInUrl = doiOrUrl.match(/10\.\d{4,}\/[^\s?#]+/);
    if (doiInUrl) {
      item.DOI = doiInUrl[0].replace(/[.,;:)\]}>]+$/, '');
      item.URL = doiOrUrl.replace(/[?#].*$/, '');
    } else {
      item.URL = doiOrUrl;
    }
  }

  return JSON.parse(JSON.stringify(item));
}

function parseAuthorsInput(str) {
  if (!str.trim()) return [];
  return str.split(';').map((part) => {
    part = part.trim();
    if (part.includes(',')) {
      const [family, given] = part.split(',', 2).map((s) => s.trim());
      return { family, given };
    }
    const words = part.split(/\s+/);
    if (words.length === 1) return { literal: words[0] };
    const family = words.pop();
    return { family, given: words.join(' ') };
  });
}

function parseDateInput(str) {
  if (!str.trim()) return undefined;
  const parts = str.split('-').map(Number).filter((n) => !isNaN(n));
  if (parts.length > 0) {
    return { 'date-parts': [parts] };
  }
  return { literal: str };
}

// ---------------------------------------------------------------------------
// Preview update — sends to WASM via background, falls back to JS
// ---------------------------------------------------------------------------

async function updatePreview() {
  const item = buildCslItem();

  const hasContent = item.title || (item.author && item.author.length > 0) || item.DOI || item.URL;
  if (!hasContent) {
    $('#citation-preview').innerHTML = '<span class="text-zinc-400 italic">Fill in fields above to see citation preview</span>';
    $('#intext-preview').innerHTML = '<span class="text-zinc-400 italic">(Author, Year)</span>';
    return;
  }

  // Use JS style-aware formatter (reliable) instead of WASM CSL engine (still maturing)
  const bib = formatBibliography(item, currentStyle);
  const intext = formatIntext(item, currentStyle);
  $('#citation-preview').innerHTML = bib;
  $('#intext-preview').textContent = intext;
}

// ---------------------------------------------------------------------------
// JS Citation Formatter — style-aware, handles all common styles
// ---------------------------------------------------------------------------

function formatBibliography(item, styleId) {
  // Resolve alias to base style family
  const style = resolveStyleFamily(styleId);
  const a = formatAuthorsBib(item.author, style);
  const year = item.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
  const title = item.title || 'Untitled';
  const container = item['container-title'] || '';
  const vol = item.volume || '';
  const iss = item.issue || '';
  const pg = item.page || '';
  const doi = item.DOI ? `https://doi.org/${item.DOI}` : '';
  const url = item.URL || '';
  const pub = item.publisher || '';

  switch (style) {
    case 'apa':
      return formatApa(a, year, title, container, vol, iss, pg, doi, url, pub, item);
    case 'mla':
      return formatMla(a, year, title, container, vol, iss, pg, doi, url, pub, item);
    case 'chicago':
      return formatChicago(a, year, title, container, vol, iss, pg, doi, url, pub, item);
    case 'harvard':
      return formatHarvard(a, year, title, container, vol, iss, pg, doi, url, pub, item);
    case 'ieee':
      return formatIeee(item);
    case 'vancouver':
      return formatVancouver(item);
    default:
      return formatApa(a, year, title, container, vol, iss, pg, doi, url, pub, item);
  }
}

function formatIntext(item, styleId) {
  const style = resolveStyleFamily(styleId);
  const first = (item.author || [])[0];
  const name = first?.family || first?.literal || (item.title ? item.title.split(' ').slice(0, 3).join(' ') : 'Unknown');
  const year = item.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
  const authorCount = (item.author || []).length;
  const narrative = intextMode === 'narrative';

  switch (style) {
    case 'apa':
    case 'chicago':
    case 'harvard':
      if (narrative) {
        if (authorCount >= 3) return `${name} et al. (${year})`;
        if (authorCount === 2) return `${name} & ${item.author[1].family || ''} (${year})`;
        return `${name} (${year})`;
      }
      if (authorCount >= 3) return `(${name} et al., ${year})`;
      if (authorCount === 2) return `(${name} & ${item.author[1].family || ''}, ${year})`;
      return `(${name}, ${year})`;
    case 'mla':
      if (narrative) {
        if (authorCount >= 3) return `${name} et al.`;
        if (authorCount === 2) return `${name} and ${item.author[1].family || ''}`;
        return name;
      }
      if (authorCount >= 3) return `(${name} et al. ${item.page || ''})`.trim();
      if (authorCount === 2) return `(${name} and ${item.author[1].family || ''} ${item.page || ''})`.trim();
      return `(${name} ${item.page || ''})`.trim();
    case 'ieee':
    case 'vancouver':
      return '[1]';
    default:
      return `(${name}, ${year})`;
  }
}

function resolveStyleFamily(styleId) {
  const id = (styleId || '').toLowerCase();
  if (id.includes('apa') || id === 'apa') return 'apa';
  if (id.includes('mla') || id.includes('modern-language')) return 'mla';
  if (id.includes('chicago')) return 'chicago';
  if (id.includes('harvard') || id.includes('cite-them-right') || id.includes('elsevier-harvard')) return 'harvard';
  if (id.includes('ieee')) return 'ieee';
  if (id.includes('vancouver') || id.includes('ama') || id.includes('medical') || id.includes('nlm') || id.includes('lancet') || id.includes('bmj') || id.includes('nejm')) return 'vancouver';
  if (id.includes('nature') || id.includes('science') || id.includes('cell')) return 'vancouver';
  return 'apa'; // default
}

function formatAuthorsBib(authors, style) {
  if (!authors || authors.length === 0) return '';
  const fmt = (a) => {
    if (a.literal) return a.literal;
    const f = a.family || '';
    const g = a.given || '';
    if (style === 'ieee' || style === 'vancouver') {
      // F. Last
      const initials = g.split(/[\s.]/).filter(Boolean).map(p => p[0] + '.').join(' ');
      return `${initials} ${f}`.trim();
    }
    // Last, F.
    const initials = g.split(/[\s.]/).filter(Boolean).map(p => p[0] + '.').join(' ');
    return `${f}, ${initials}`.trim();
  };

  if (authors.length === 1) return fmt(authors[0]);
  if (authors.length === 2) {
    const sep = style === 'apa' ? ' & ' : style === 'mla' ? ', and ' : ' and ';
    return `${fmt(authors[0])}${sep}${fmt(authors[1])}`;
  }
  // 3+ authors
  if (style === 'vancouver' && authors.length > 6) {
    return authors.slice(0, 6).map(fmt).join(', ') + ', et al.';
  }
  const last = authors.length - 1;
  const sep = style === 'apa' ? ', & ' : style === 'mla' ? ', and ' : ', & ';
  return authors.slice(0, last).map(fmt).join(', ') + sep + fmt(authors[last]);
}

function formatApa(a, year, title, container, vol, iss, pg, doi, url, pub, item) {
  let parts = [];
  parts.push(a || title); // author or title as fallback
  parts.push(`(${year})`);
  if (a) parts.push(item.type === 'book' || item.type === 'report' || item.type === 'thesis' ? `<i>${title}</i>` : title);
  if (container) {
    let c = `<i>${container}</i>`;
    if (vol) c += `, <i>${vol}</i>`;
    if (iss) c += `(${iss})`;
    if (pg) c += `, ${pg}`;
    parts.push(c);
  }
  if (pub) parts.push(pub);
  const access = doi || url;
  if (access) parts.push(access);
  return parts.filter(Boolean).join('. ').replace(/\.\./g, '.').replace(/\. \./g, '.') + '.';
}

function formatMla(a, year, title, container, vol, iss, pg, doi, url, pub, item) {
  let parts = [];
  parts.push(a || 'Unknown');
  parts.push(item.type === 'book' ? `<i>${title}</i>` : `\u201c${title}.\u201d`);
  if (container) parts.push(`<i>${container}</i>`);
  let locParts = [];
  if (vol) locParts.push(`vol. ${vol}`);
  if (iss) locParts.push(`no. ${iss}`);
  if (locParts.length) parts.push(locParts.join(', '));
  if (pub) parts.push(pub);
  if (year !== 'n.d.') parts.push(year);
  if (pg) parts.push(`pp. ${pg}`);
  const access = doi || url;
  if (access) parts.push(access);
  return parts.filter(Boolean).join(', ').replace(/,\./g, '.') + '.';
}

function formatChicago(a, year, title, container, vol, iss, pg, doi, url, pub, item) {
  let parts = [];
  parts.push(a || 'Unknown');
  parts.push(year);
  parts.push(item.type === 'book' || item.type === 'thesis' ? `<i>${title}</i>` : `\u201c${title}\u201d`);
  if (container) {
    let c = `<i>${container}</i>`;
    if (vol) c += ` ${vol}`;
    if (iss) c += `, no. ${iss}`;
    if (pg) c += `: ${pg}`;
    parts.push(c);
  }
  if (pub && item.publisher_place) parts.push(`${item.publisher_place}: ${pub}`);
  else if (pub) parts.push(pub);
  const access = doi || url;
  if (access) parts.push(access);
  return parts.filter(Boolean).join('. ').replace(/\.\./g, '.') + '.';
}

function formatHarvard(a, year, title, container, vol, iss, pg, doi, url, pub, item) {
  let parts = [];
  parts.push(a || 'Unknown');
  parts.push(`(${year})`);
  parts.push(item.type === 'book' || item.type === 'thesis' ? `<i>${title}</i>` : `\u2018${title}\u2019`);
  if (container) {
    let c = `<i>${container}</i>`;
    if (vol) c += `, ${vol}`;
    if (iss) c += `(${iss})`;
    if (pg) c += `, pp. ${pg}`;
    parts.push(c);
  }
  if (pub) parts.push(pub);
  if (doi) parts.push(`doi:${item.DOI}`);
  else if (url) parts.push(`Available at: ${url}`);
  return parts.filter(Boolean).join('. ').replace(/\.\./g, '.') + '.';
}

function formatIeee(item) {
  const authors = formatAuthorsBib(item.author, 'ieee');
  const title = item.title || 'Untitled';
  const container = item['container-title'] || '';
  const vol = item.volume ? `vol. ${item.volume}` : '';
  const iss = item.issue ? `no. ${item.issue}` : '';
  const pg = item.page ? `pp. ${item.page}` : '';
  const year = item.issued?.['date-parts']?.[0]?.[0] || '';
  const doi = item.DOI ? `doi: ${item.DOI}` : '';

  let parts = [authors, `\u201c${title},\u201d`];
  if (container) parts.push(`<i>${container}</i>`);
  if (vol) parts.push(vol);
  if (iss) parts.push(iss);
  if (pg) parts.push(pg);
  if (year) parts.push(year);
  if (doi) parts.push(doi);
  return '[1] ' + parts.filter(Boolean).join(', ') + '.';
}

function formatVancouver(item) {
  const authors = formatAuthorsBib(item.author, 'vancouver');
  const title = item.title || 'Untitled';
  const container = item['container-title'] || '';
  const year = item.issued?.['date-parts']?.[0]?.[0] || '';
  const vol = item.volume || '';
  const iss = item.issue ? `(${item.issue})` : '';
  const pg = item.page ? `:${item.page}` : '';
  const doi = item.DOI ? `doi: ${item.DOI}` : '';

  let parts = [`${authors}.`, `${title}.`];
  if (container) parts.push(`${container}. ${year}${vol ? `;${vol}` : ''}${iss}${pg}.`);
  else if (year) parts.push(`${year}.`);
  if (doi) parts.push(doi);
  return '1. ' + parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Enhance — resolve identifiers and fill missing fields
// ---------------------------------------------------------------------------

async function enhanceMetadata() {
  const identifier = $('#field-doi').value.trim();
  if (!identifier) {
    showEnhanceResult('error', 'Enter a DOI, ISBN, PMID, or arXiv ID to enhance.');
    return;
  }

  // Show loading state
  $('#enhance-icon').classList.add('hidden');
  $('#enhance-spinner').classList.remove('hidden');
  $('#btn-enhance').disabled = true;

  try {
    const res = await chrome.runtime.sendMessage({
      action: 'resolve',
      identifier,
    });

    if (res?.error) {
      showEnhanceResult('error', res.error);
      return;
    }

    if (!res?.resolved) {
      showEnhanceResult('error', 'No metadata found for this identifier.');
      return;
    }

    const resolved = res.resolved;
    let filledCount = 0;

    // Merge: only fill empty fields, track what was filled
    const filled = [];

    if (resolved.title && !$('#field-title').value.trim()) {
      $('#field-title').value = resolved.title;
      filled.push('title');
    }

    if (resolved.author?.length && !$('#field-authors').value.trim()) {
      $('#field-authors').value = formatAuthorsForInput(resolved.author);
      filled.push('authors');
    }

    if (resolved.issued && !$('#field-date').value.trim()) {
      $('#field-date').value = formatDateForInput(resolved.issued);
      filled.push('date');
    }

    if (resolved.publisher && !$('#field-publisher').value.trim()) {
      $('#field-publisher').value = resolved.publisher;
      filled.push('publisher');
    }

    if (resolved['container-title'] && !$('#field-container').value.trim()) {
      $('#field-container').value = resolved['container-title'];
      filled.push('journal');
    }

    if (resolved.volume && !$('#field-volume').value.trim()) {
      $('#field-volume').value = resolved.volume;
      filled.push('vol');
    }

    if (resolved.issue && !$('#field-issue').value.trim()) {
      $('#field-issue').value = resolved.issue;
      filled.push('issue');
    }

    if (resolved.page && !$('#field-pages').value.trim()) {
      $('#field-pages').value = resolved.page;
      filled.push('pages');
    }

    // Update DOI field if we got a proper DOI
    if (resolved.DOI) {
      $('#field-doi').value = resolved.DOI;
    }

    // Update source type if detected
    if (resolved.type) {
      const typeSelect = $('#source-type');
      const option = typeSelect.querySelector(`option[value="${resolved.type}"]`);
      if (option) {
        typeSelect.value = resolved.type;
        filled.push('type');
      }
    }

    // Highlight enhanced fields briefly
    highlightFields(filled);

    if (filled.length > 0) {
      showEnhanceResult('success',
        `Enhanced ${filled.length} field${filled.length > 1 ? 's' : ''} via ${res.source}: ${filled.join(', ')}`
      );
      // Re-validate to clear stale warnings
      validateSourceType();
      updateFieldRelevance();
      cacheCurrentFields();
    } else {
      showEnhanceResult('info', `Resolved via ${res.source}, but all fields already filled.`);
    }

    updatePreview();
  } catch (err) {
    showEnhanceResult('error', `Lookup failed: ${err.message}`);
  } finally {
    $('#enhance-icon').classList.remove('hidden');
    $('#enhance-spinner').classList.add('hidden');
    $('#btn-enhance').disabled = false;
  }
}

function showEnhanceResult(type, message) {
  const el = $('#enhance-result');
  el.classList.remove('hidden');
  el.textContent = '';

  const colors = {
    success: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
    error: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  };
  el.className = `px-2.5 py-1.5 rounded text-xs flex items-center gap-1.5 ${colors[type] || colors.info}`;

  const icons = {
    success: '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>',
    error: '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>',
    info: '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  };
  el.innerHTML = `${icons[type] || ''}${message}`;

  // Auto-hide after 5 seconds
  setTimeout(() => {
    el.classList.add('hidden');
  }, 5000);
}

function highlightFields(fieldNames) {
  const fieldMap = {
    title: '#field-title',
    authors: '#field-authors',
    date: '#field-date',
    publisher: '#field-publisher',
    journal: '#field-container',
    vol: '#field-volume',
    issue: '#field-issue',
    pages: '#field-pages',
  };

  for (const name of fieldNames) {
    const sel = fieldMap[name];
    if (!sel) continue;
    const el = $(sel);
    if (!el) continue;

    // Flash saffron border
    el.classList.add('border-saffron-400', 'ring-2', 'ring-saffron-200');
    setTimeout(() => {
      el.classList.remove('border-saffron-400', 'ring-2', 'ring-saffron-200');
    }, 2000);
  }
}

// ---------------------------------------------------------------------------
// Auto-enhance — silently resolve if identifier found and fields missing
// ---------------------------------------------------------------------------

async function tryAutoEnhance() {
  // Check if we have an identifier to resolve
  const doiField = $('#field-doi').value.trim();
  if (!doiField) return;

  // Detect if there's a resolvable identifier
  const hasResolvable =
    doiField.match(/^10\.\d{4,}/) ||
    doiField.match(/doi\.org\/10\./) ||
    doiField.match(/^pmid:\s*\d+$/i) ||
    doiField.match(/pubmed.*\/\d+/) ||
    doiField.match(/arxiv\.org\/abs\//) ||
    doiField.match(/^arxiv:\s*\d{4}\./i);

  if (!hasResolvable) return;

  // Check if key fields are missing (worth enhancing)
  const missingAuthor = !$('#field-authors').value.trim();
  const missingDate = !$('#field-date').value.trim();
  const missingContainer = !$('#field-container').value.trim();
  const missingTitle = !$('#field-title').value.trim();

  if (!missingAuthor && !missingDate && !missingContainer && !missingTitle) return;

  // Resolve silently
  try {
    const res = await chrome.runtime.sendMessage({
      action: 'resolve',
      identifier: doiField,
    });

    if (!res?.resolved) return;

    const resolved = res.resolved;
    const filled = [];

    if (resolved.title && missingTitle) {
      $('#field-title').value = resolved.title;
      filled.push('title');
    }
    if (resolved.author?.length && missingAuthor) {
      $('#field-authors').value = formatAuthorsForInput(resolved.author);
      filled.push('authors');
    }
    if (resolved.issued && missingDate) {
      $('#field-date').value = formatDateForInput(resolved.issued);
      filled.push('date');
    }
    if (resolved['container-title'] && missingContainer) {
      $('#field-container').value = resolved['container-title'];
      filled.push('journal');
    }
    if (resolved.publisher && !$('#field-publisher').value.trim()) {
      $('#field-publisher').value = resolved.publisher;
      filled.push('publisher');
    }
    if (resolved.volume && !$('#field-volume').value.trim()) {
      $('#field-volume').value = resolved.volume;
      filled.push('vol');
    }
    if (resolved.issue && !$('#field-issue').value.trim()) {
      $('#field-issue').value = resolved.issue;
      filled.push('issue');
    }
    if (resolved.page && !$('#field-pages').value.trim()) {
      $('#field-pages').value = resolved.page;
      filled.push('pages');
    }
    if (resolved.DOI) {
      $('#field-doi').value = resolved.DOI;
    }
    if (resolved.type) {
      const opt = $('#source-type').querySelector(`option[value="${resolved.type}"]`);
      if (opt) $('#source-type').value = resolved.type;
    }

    if (filled.length > 0) {
      highlightFields(filled);
      dismissHint(); // Clear the "looking up via DOI" hint
      showEnhanceResult('success',
        `Auto-enhanced ${filled.length} field${filled.length > 1 ? 's' : ''} via ${res.source}`
      );
      // Re-validate now that fields are filled — clears stale warnings
      validateSourceType();
      updateFieldRelevance();
      updatePreview();
      // Cache enhanced data for this tab
      cacheCurrentFields();
    }
  } catch {
    // Silent fail — auto-enhance is best-effort
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function copyBibliography() {
  const text = $('#citation-preview').textContent;
  const html = $('#citation-preview').innerHTML;

  try {
    const item = new ClipboardItem({
      'text/plain': new Blob([text], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    });
    await navigator.clipboard.write([item]);
    flashButton('#btn-copy-bib', 'Copied!');
  } catch {
    await navigator.clipboard.writeText(text);
    flashButton('#btn-copy-bib', 'Copied!');
  }
}

async function copyInText() {
  const text = $('#intext-preview').textContent;
  await navigator.clipboard.writeText(text);
  flashButton('#btn-copy-intext', 'Copied!');
}

async function addToProject() {
  // Minimum validation — need at least a title or URL
  const title = $('#field-title').value.trim();
  const url = $('#field-doi').value.trim();

  if (!title && !url) {
    showEnhanceResult('error', 'Please enter at least a title or URL/DOI before adding.');
    return;
  }

  // Warn if important fields missing
  const authors = $('#field-authors').value.trim();
  const date = $('#field-date').value.trim();
  const missing = [];
  if (!title) missing.push('title');
  if (!authors) missing.push('author');
  if (!date) missing.push('date');

  if (missing.length > 0) {
    const proceed = await ibidConfirm(
      'Incomplete citation',
      `Missing: ${missing.join(', ')}. Citation may be incomplete. Add anyway?`,
      { confirmText: 'Add Anyway' }
    );
    if (!proceed) return;
  }

  const item = buildCslItem();
  item.id = crypto.randomUUID();
  item._dateAdded = new Date().toISOString();
  item._sourceUrl = currentMetadata?.URL || '';

  const projectId = $('#project-selector').value;
  if (projectId !== 'new') {
    item._projectIds = [projectId];
  }

  const stored = await chrome.storage.local.get(['citations']);
  const citations = stored.citations || [];

  // Duplicate detection
  const dup = findDuplicate(item, citations);
  if (dup) {
    const dupInfo = dup.title ? `"${dup.title.slice(0, 50)}..."` : dup.id;
    const proceed = await ibidConfirm(
      'Possible duplicate',
      `${dupInfo} already exists in your library. Add anyway?`,
      { confirmText: 'Add Anyway' }
    );
    if (!proceed) {
      return;
    }
  }

  citations.push(item);
  await chrome.storage.local.set({ citations });

  flashButton('#btn-add-project', 'Added!', true);
}

function findDuplicate(newItem, existing) {
  for (const ex of existing) {
    // Exact DOI match
    if (newItem.DOI && ex.DOI && newItem.DOI.toLowerCase() === ex.DOI.toLowerCase()) {
      return ex;
    }
    // Exact ISBN match
    if (newItem.ISBN && ex.ISBN && newItem.ISBN.replace(/[-\s]/g, '') === ex.ISBN.replace(/[-\s]/g, '')) {
      return ex;
    }
    // Exact URL match (excluding generic URLs)
    if (newItem.URL && ex.URL && newItem.URL === ex.URL && !newItem.URL.match(/^https?:\/\/(www\.)?(google|bing|yahoo)\./)) {
      return ex;
    }
    // Fuzzy title match (normalized, >90% similar)
    if (newItem.title && ex.title) {
      const a = normalizeTitle(newItem.title);
      const b = normalizeTitle(ex.title);
      if (a.length > 10 && b.length > 10 && a === b) {
        return ex;
      }
    }
  }
  return null;
}

function normalizeTitle(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function onStyleChange() {
  currentStyle = $('#style-selector').value;

  // If a project is selected and it has its own style, update the project style
  const project = projects.find((p) => p.id === currentProjectId);
  if (project && currentProjectId !== 'default') {
    project.defaultStyle = currentStyle;
    chrome.storage.local.set({ projects });
    updateStyleSource('Project');
  } else {
    // Update global default
    globalStyle = currentStyle;
    chrome.storage.local.set({ defaultStyle: currentStyle });
    updateStyleSource('Global');
  }

  // Sync quick settings dropdown
  $('#qs-style').value = currentStyle;
  updatePreview();
}

// ---------------------------------------------------------------------------
// Smart date input
// ---------------------------------------------------------------------------

function onDateInput() {
  const raw = $('#field-date').value.trim();
  if (!raw) {
    clearDateHint();
    return;
  }

  // Auto-detect precision from input
  const parts = raw.split('-').filter(Boolean);
  if (parts.length >= 3) {
    $('#date-precision').value = 'day';
  } else if (parts.length === 2) {
    $('#date-precision').value = 'month';
  } else {
    $('#date-precision').value = 'year';
  }

  validateDateInput(raw);
}

function onDatePrecisionChange() {
  const precision = $('#date-precision').value;
  const raw = $('#field-date').value.trim();

  // Update placeholder
  const placeholders = { year: 'YYYY', month: 'YYYY-MM', day: 'YYYY-MM-DD' };
  $('#field-date').placeholder = placeholders[precision] || 'YYYY';

  // If user already typed something, validate/adjust
  if (raw) {
    const parts = raw.split('-').filter(Boolean).map(Number);

    if (precision === 'year' && parts.length > 1) {
      // Truncate to year only
      $('#field-date').value = parts[0].toString();
    } else if (precision === 'month' && parts.length === 1 && parts[0] > 0) {
      // Prompt to add month
      setDateHint('info', 'Add month: YYYY-MM');
    } else if (precision === 'day' && parts.length < 3) {
      setDateHint('info', 'Add full date: YYYY-MM-DD');
    }

    validateDateInput($('#field-date').value.trim());
  }

  updatePreview();
}

function validateDateInput(raw) {
  if (!raw) { clearDateHint(); return; }

  // Check for n.d. or literal
  if (raw.toLowerCase() === 'n.d.' || raw.toLowerCase() === 'nd') {
    setDateHint('info', 'No date');
    return;
  }

  const parts = raw.split('-');
  const year = parseInt(parts[0], 10);

  // Year validation
  if (isNaN(year)) {
    setDateHint('warn', 'Invalid year. Use format: YYYY or YYYY-MM-DD');
    return;
  }
  if (year < 1) {
    setDateHint('warn', 'Year must be positive. For BCE dates, type literally (e.g., "350 BCE")');
    return;
  }
  if (year > new Date().getFullYear() + 5) {
    setDateHint('warn', `Future date: ${year}. Is this correct?`);
    return;
  }

  // Month validation
  if (parts.length >= 2) {
    const month = parseInt(parts[1], 10);
    if (isNaN(month) || month < 1 || month > 12) {
      setDateHint('warn', 'Invalid month (1-12)');
      return;
    }

    // Day validation
    if (parts.length >= 3) {
      const day = parseInt(parts[2], 10);
      if (isNaN(day) || day < 1 || day > 31) {
        setDateHint('warn', 'Invalid day (1-31)');
        return;
      }
    }
  }

  // Valid
  clearDateHint();
}

function setDateHint(type, msg) {
  const el = $('#date-hint');
  el.classList.remove('hidden');
  if (type === 'warn') {
    el.setAttribute('class', 'mt-0.5 text-[10px] text-amber-600 dark:text-amber-400');
  } else {
    el.setAttribute('class', 'mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500');
  }
  el.textContent = msg;
}

function clearDateHint() {
  $('#date-hint').classList.add('hidden');
}

function onSourceTypeChange() {
  validateSourceType();
  updateFieldRelevance();
  updatePreview();
}

// ---------------------------------------------------------------------------
// Field relevance — show/dim fields based on source type
// ---------------------------------------------------------------------------

function updateFieldRelevance() {
  const type = $('#source-type').value;
  const info = STYLE_REQUIRED_FIELDS[type] || { required: ['title'], recommended: [] };
  const allRequired = new Set(info.required);
  const allRecommended = new Set(info.recommended);

  // Map data-field attribute to field names
  for (const el of $$('[data-field]')) {
    const field = el.dataset.field;
    const dot = el.querySelector('.req-dot');
    const label = el.querySelector('.field-label');
    const input = el.querySelector('input, select');

    if (allRequired.has(field)) {
      // Required — show dot, full opacity
      if (dot) dot.classList.remove('hidden');
      if (label) label.classList.remove('text-zinc-300', 'dark:text-zinc-600');
      if (label) label.classList.add('text-zinc-400');
      el.classList.remove('opacity-50');
    } else if (allRecommended.has(field)) {
      // Recommended — no dot, full opacity
      if (dot) dot.classList.add('hidden');
      if (label) label.classList.remove('text-zinc-300', 'dark:text-zinc-600');
      if (label) label.classList.add('text-zinc-400');
      el.classList.remove('opacity-50');
    } else {
      // Irrelevant — no dot, dimmed
      if (dot) dot.classList.add('hidden');
      el.classList.add('opacity-50');
    }
  }

  // URL/DOI is always relevant
  const doiField = $('[data-field="DOI"]');
  if (doiField) doiField.classList.remove('opacity-50');
}

// ---------------------------------------------------------------------------
// Source type validation
// ---------------------------------------------------------------------------

function validateSourceType() {
  const type = $('#source-type').value;
  const title = $('#field-title').value.trim();
  const authors = $('#field-authors').value.trim();
  const date = $('#field-date').value.trim();
  const container = $('#field-container').value.trim();
  const volume = $('#field-volume').value.trim();
  const issue = $('#field-issue').value.trim();
  const pages = $('#field-pages').value.trim();
  const doi = $('#field-doi').value.trim();
  const publisher = $('#field-publisher').value.trim();

  const warnings = [];
  let suggestion = null;

  // Check if selected type matches available metadata
  switch (type) {
    case 'article-journal':
      if (!container) warnings.push('Journal articles usually have a journal name (Container field).');
      if (!volume && !issue) warnings.push('Missing volume/issue — typical for journal articles.');
      if (!doi && !pages) warnings.push('No DOI or page range found.');
      // Suggest webpage if no journal metadata at all
      if (!container && !volume && !issue && !pages && !doi) {
        suggestion = 'webpage';
      }
      break;

    case 'book':
      if (!publisher) warnings.push('Books usually have a publisher.');
      if (container) warnings.push('Books don\'t usually have a container/journal — this might be a chapter.');
      if (volume && issue) {
        warnings.push('Volume + issue suggests a journal article, not a book.');
        suggestion = 'article-journal';
      }
      break;

    case 'chapter':
      if (!container) warnings.push('Book chapters need a container (book title).');
      if (!publisher) warnings.push('Book chapters usually have a publisher.');
      break;

    case 'article-newspaper':
    case 'article-magazine':
      if (!container) warnings.push('News/magazine articles need a publication name (Container field).');
      if (volume && issue && doi) {
        warnings.push('DOI + volume/issue suggests a journal article.');
        suggestion = 'article-journal';
      }
      break;

    case 'thesis':
      if (!publisher) warnings.push('Theses usually list the university (Publisher field).');
      if (container) warnings.push('Theses don\'t usually have a container/journal.');
      break;

    case 'webpage': {
      // Don't suggest journal for non-academic domains
      const url = $('#field-doi').value.trim().toLowerCase();
      const isNonAcademic = /\b(google\.com|drive\.google|docs\.google|youtube\.com|facebook\.com|twitter\.com|instagram\.com|linkedin\.com|reddit\.com|github\.com|stackoverflow\.com|medium\.com|wikipedia\.org|amazon\.com|ebay\.com)\b/.test(url);
      // Container from og:site_name on non-academic sites isn't a journal
      const isGenericContainer = /^(Google|Google Drive|Facebook|Twitter|YouTube|LinkedIn|Reddit|Medium|Wikipedia|GitHub)$/i.test(container);

      if (!isNonAcademic && !isGenericContainer) {
        if (doi && container && (volume || issue)) {
          warnings.push('DOI + journal + volume suggests this is a journal article, not a webpage.');
          suggestion = 'article-journal';
        } else if (doi && container && doi.match(/^10\.\d{4,}/)) {
          // Only suggest if the DOI field actually contains a real DOI, not just a URL
          warnings.push('This has a DOI and container title — it might be a journal article.');
          suggestion = 'article-journal';
        }
      }
      break;
    }

    case 'paper-conference':
      if (!container) warnings.push('Conference papers need a proceedings name (Container field).');
      break;

    case 'report':
      if (!publisher) warnings.push('Reports usually have an issuing organization (Publisher field).');
      break;
  }

  // Show or hide warning
  const warningEl = $('#type-warning');
  const warningText = $('#type-warning-text');

  if (warnings.length > 0) {
    let msg = warnings.join(' ');
    if (suggestion) {
      const label = $('#source-type').querySelector(`option[value="${suggestion}"]`)?.textContent || suggestion;
      msg += ` <button class="underline font-medium" id="btn-type-suggest">Switch to ${label}?</button>`;
    }
    warningText.innerHTML = msg;
    warningEl.classList.remove('hidden');

    // Bind suggestion click
    const suggestBtn = document.getElementById('btn-type-suggest');
    if (suggestBtn && suggestion) {
      suggestBtn.addEventListener('click', () => {
        $('#source-type').value = suggestion;
        validateSourceType();
        updatePreview();
      });
    }
  } else {
    warningEl.classList.add('hidden');
  }

  // Update confidence badge
  updateConfidence(type);
}

function updateConfidence(type) {
  const doi = $('#field-doi').value.trim();
  const container = $('#field-container').value.trim();
  const volume = $('#field-volume').value.trim();
  const authors = $('#field-authors').value.trim();

  let confidence = '';

  // Show auto-detected badge if type matches expectations
  const hasJournalSignals = doi && container && (volume || '');
  const hasBookSignals = !container && !volume;

  if (type === 'article-journal' && hasJournalSignals && authors) {
    confidence = 'auto-detected';
  } else if (type === 'webpage' && !doi && !container) {
    confidence = 'auto-detected';
  } else if (currentMetadata?.type === type) {
    confidence = 'auto-detected';
  }

  const el = $('#confidence');
  if (confidence) {
    el.textContent = confidence;
    el.className = 'text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400';
  } else {
    el.textContent = 'manual';
    el.className = 'text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400';
  }
}

// ---------------------------------------------------------------------------
// Smart style picker — recent on top, searchable, required fields hints
// ---------------------------------------------------------------------------

// Required fields per source type for style guidance
// Field names match data-field attributes in HTML:
// title, author, issued, publisher, container-title, volume, issue, page, DOI
const STYLE_REQUIRED_FIELDS = {
  'article-journal':  { required: ['title', 'author', 'container-title', 'issued'], recommended: ['volume', 'issue', 'page', 'DOI'] },
  'article-magazine': { required: ['title', 'author', 'container-title', 'issued'], recommended: ['volume', 'issue', 'page'] },
  'article-newspaper':{ required: ['title', 'author', 'container-title', 'issued'], recommended: ['DOI', 'page'] },
  'book':             { required: ['title', 'author', 'publisher', 'issued'], recommended: ['DOI'] },
  'chapter':          { required: ['title', 'author', 'container-title', 'publisher', 'issued'], recommended: ['page'] },
  'paper-conference': { required: ['title', 'author', 'container-title', 'issued'], recommended: ['publisher', 'page'] },
  'thesis':           { required: ['title', 'author', 'publisher', 'issued'], recommended: [] },
  'report':           { required: ['title', 'author', 'publisher', 'issued'], recommended: ['DOI'] },
  'webpage':          { required: ['title', 'DOI'], recommended: ['author', 'issued'] },
  'post-weblog':      { required: ['title', 'author', 'DOI'], recommended: ['issued', 'container-title'] },
  'legislation':      { required: ['title', 'issued'], recommended: ['container-title', 'volume', 'page'] },
  'legal-case':       { required: ['title', 'issued'], recommended: ['container-title', 'volume', 'page'] },
  'patent':           { required: ['title', 'author', 'issued'], recommended: ['DOI'] },
  'dataset':          { required: ['title', 'author', 'issued'], recommended: ['DOI', 'publisher'] },
  'software':         { required: ['title', 'author'], recommended: ['issued', 'DOI', 'publisher'] },
  'motion-picture':   { required: ['title', 'issued'], recommended: ['author', 'publisher'] },
  'broadcast':        { required: ['title', 'issued'], recommended: ['container-title', 'author'] },
};

let allStyles = []; // loaded from service worker
let recentStyleIds = []; // from storage

async function initStylePicker() {
  // Load all styles from service worker
  const res = await chrome.runtime.sendMessage({ action: 'getStyles' });
  allStyles = res?.styles || [];

  // Load recent usage from storage
  const stored = await chrome.storage.local.get(['recentStyles']);
  recentStyleIds = stored.recentStyles || ['apa', 'modern-language-association', 'chicago-author-date', 'ieee', 'harvard-cite-them-right'];

  renderStyleList('');
  updatePickerLabel();
}

// Toggle dropdown
$('#style-picker-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const dd = $('#style-picker-dropdown');
  dd.classList.toggle('hidden');
  if (!dd.classList.contains('hidden')) {
    $('#style-search-input').value = '';
    $('#style-search-input').focus();
    renderStyleList('');
  }
});

// Close on outside click
document.addEventListener('click', (e) => {
  const dd = $('#style-picker-dropdown');
  if (!dd.classList.contains('hidden') && !dd.contains(e.target) && e.target !== $('#style-picker-btn')) {
    dd.classList.add('hidden');
  }
});

// Search filter
$('#style-search-input').addEventListener('input', debounce((e) => {
  renderStyleList(e.target.value.trim().toLowerCase());
}, 150));

function renderStyleList(query) {
  const list = $('#style-picker-list');

  // Split into recent and all
  const recent = recentStyleIds
    .map(id => allStyles.find(s => s.id === id))
    .filter(Boolean);

  let filtered = allStyles;
  if (query) {
    filtered = allStyles.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query) ||
      (s.field || '').toLowerCase().includes(query) ||
      (s.group || '').toLowerCase().includes(query)
    );
  }

  let html = '';

  // Recent section (only if no search query)
  if (!query && recent.length > 0) {
    html += `<div class="px-2.5 py-1 text-[9px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">Recent</div>`;
    html += recent.map(s => styleItemHtml(s, true)).join('');
    html += `<div class="border-t border-zinc-100 dark:border-zinc-700"></div>`;
  }

  // Group remaining by group field
  if (!query) {
    const groups = {};
    for (const s of filtered) {
      const g = s.group || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    }
    const sortedGroups = Object.keys(groups).sort();
    html += `<div class="px-2.5 py-1 text-[9px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">All Styles (${allStyles.length})</div>`;
    for (const g of sortedGroups) {
      html += `<div class="px-2.5 py-0.5 text-[9px] font-medium text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/30">${g}</div>`;
      html += groups[g].map(s => styleItemHtml(s, false)).join('');
    }
  } else {
    if (filtered.length === 0) {
      html += `<div class="px-3 py-4 text-center text-xs text-zinc-400">No styles match "${query}"</div>`;
    } else {
      html += `<div class="px-2.5 py-1 text-[9px] text-zinc-400">${filtered.length} result${filtered.length !== 1 ? 's' : ''}</div>`;
      html += filtered.map(s => styleItemHtml(s, false)).join('');
    }
  }

  list.innerHTML = html;

  // Bind clicks
  for (const btn of list.querySelectorAll('.style-item')) {
    btn.addEventListener('click', () => selectStyle(btn.dataset.id, btn.dataset.name));
  }
}

function styleItemHtml(s, isRecent) {
  const isActive = s.id === currentStyle;
  return `<button class="style-item w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-1 transition-colors ${isActive ? 'bg-saffron-50 dark:bg-saffron-900/20 text-saffron-700 dark:text-saffron-400 font-medium' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'}" data-id="${s.id}" data-name="${s.name}">
    <span class="truncate">${s.name}</span>
    <span class="text-[9px] px-1 py-0.5 rounded shrink-0 ${isActive ? 'bg-saffron-200 dark:bg-saffron-800 text-saffron-700 dark:text-saffron-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}">${s.field || 'generic'}</span>
  </button>`;
}

function selectStyle(styleId, styleName) {
  currentStyle = styleId;
  $('#style-selector').value = styleId;
  updatePickerLabel();
  $('#style-picker-dropdown').classList.add('hidden');

  // Track usage
  recentStyleIds = [styleId, ...recentStyleIds.filter(id => id !== styleId)].slice(0, 8);
  chrome.storage.local.set({ recentStyles: recentStyleIds, defaultStyle: currentStyle });

  // Sync quick settings
  const qsStyle = $('#qs-style');
  if (qsStyle.querySelector(`option[value="${styleId}"]`)) {
    qsStyle.value = styleId;
  }

  updatePreview();
  updateFieldRelevance();
}

function updatePickerLabel() {
  const style = allStyles.find(s => s.id === currentStyle);
  $('#style-picker-label').textContent = style?.name || currentStyle;
}

// Initialize on load
initStylePicker();

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function showState(state) {
  $('#state-loading').classList.toggle('hidden', state !== 'loading');
  $('#state-ready').classList.toggle('hidden', state !== 'ready');
  $('#state-error').classList.toggle('hidden', state !== 'error');
}

function showError(msg) {
  $('#error-message').textContent = msg;
  showState('error');
}

function showHint(type, message) {
  const bar = $('#hint-bar');
  const text = $('#hint-text');
  const icon = $('#hint-icon');

  const styles = {
    restricted: {
      bar: 'bg-blue-50 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
      icon: 'text-blue-500',
    },
    sparse: {
      bar: 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
      icon: 'text-amber-500',
    },
    enhancing: {
      bar: 'bg-saffron-50 dark:bg-saffron-900/15 border-saffron-200 dark:border-saffron-800 text-saffron-700 dark:text-saffron-400',
      icon: 'text-saffron-500',
    },
  };

  const s = styles[type] || styles.sparse;
  bar.setAttribute('class', `px-4 py-2 text-xs flex items-start gap-2 border-b ${s.bar}`);
  icon.setAttribute('class', `w-4 h-4 shrink-0 mt-0.5 ${s.icon}`);
  text.textContent = message;
  bar.classList.remove('hidden');

  // Auto-dismiss "enhancing" hints after auto-enhance completes
  if (type === 'enhancing') {
    setTimeout(() => dismissHint(), 5000);
  }
}

function dismissHint() {
  $('#hint-bar').classList.add('hidden');
}

// Bind dismiss button
$('#hint-dismiss')?.addEventListener('click', dismissHint);

async function rescanPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.startsWith('http')) {
      showHint('restricted', 'Cannot rescan this page.');
      return;
    }

    // Clear cache for this tab — force fresh extraction
    const cacheKey = `ibid_cache_${tab.id}`;
    await chrome.storage.session.remove([cacheKey]);

    // Re-inject and re-extract
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/extractor.js'],
      });
    } catch (e) { /* may already be injected */ }

    chrome.tabs.sendMessage(tab.id, { action: 'extractMetadata' }, (response) => {
      if (chrome.runtime.lastError || !response?.metadata) {
        showHint('sparse', 'Could not re-extract metadata from this page.');
        return;
      }
      currentMetadata = response.metadata;
      populateFields(currentMetadata);
      dismissHint();
      showEnhanceResult('success', 'Page rescanned — fields refreshed');
      tryAutoEnhance();
    });
  } catch (err) {
    showHint('sparse', `Rescan failed: ${err.message}`);
  }
}

// Cache current field values for this tab (survives popup close/reopen)
async function cacheCurrentFields() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const cacheKey = `ibid_cache_${tab.id}`;
    const metadata = {
      ...currentMetadata,
      // Capture current field values (may have been edited or enhanced)
      title: $('#field-title').value || currentMetadata?.title,
      author: parseAuthorsInput($('#field-authors').value),
      issued: parseDateInput($('#field-date').value),
      publisher: $('#field-publisher').value || undefined,
      'container-title': $('#field-container').value || undefined,
      volume: $('#field-volume').value || undefined,
      issue: $('#field-issue').value || undefined,
      page: $('#field-pages').value || undefined,
      type: $('#source-type').value,
    };

    // Extract DOI/URL from field
    const doiVal = $('#field-doi').value.trim();
    if (doiVal.match(/^10\./)) {
      metadata.DOI = doiVal.replace(/[?#].*$/, '');
    } else if (doiVal) {
      metadata.URL = doiVal;
    }

    await chrome.storage.session.set({
      [cacheKey]: { url: tab.url, metadata, timestamp: Date.now() }
    });
  } catch {
    // session storage might not be available — silent fail
  }
}

function flashButton(selector, text, success = false) {
  const btn = $(selector);
  const original = btn.textContent;
  btn.textContent = text;
  if (success) {
    btn.classList.add('bg-emerald-500');
    btn.classList.remove('bg-saffron-500');
  }
  setTimeout(() => {
    btn.textContent = original;
    if (success) {
      btn.classList.remove('bg-emerald-500');
      btn.classList.add('bg-saffron-500');
    }
  }, 1500);
}

// ---------------------------------------------------------------------------
// Project management
// ---------------------------------------------------------------------------

async function loadProjects() {
  const stored = await chrome.storage.local.get(['projects', 'lastProjectId', 'defaultStyle']);
  projects = stored.projects || [];
  globalStyle = stored.defaultStyle || 'apa7';
  currentProjectId = stored.lastProjectId || 'default';

  renderProjectSelector();

  // Set style based on selected project
  resolveStyle();
}

function renderProjectSelector() {
  const sel = $('#project-selector');
  sel.innerHTML = '<option value="default">My Bibliography</option>';
  for (const p of projects) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name + (p.defaultStyle ? ` (${styleLabel(p.defaultStyle)})` : '');
    sel.appendChild(opt);
  }
  sel.value = currentProjectId;
  // If the stored project no longer exists, fallback
  if (!sel.value) {
    sel.value = 'default';
    currentProjectId = 'default';
  }
}

function onProjectChange() {
  currentProjectId = $('#project-selector').value;
  chrome.storage.local.set({ lastProjectId: currentProjectId });
  resolveStyle();
  updatePreview();
}

function resolveStyle() {
  const project = projects.find((p) => p.id === currentProjectId);
  if (project?.defaultStyle) {
    currentStyle = project.defaultStyle;
    updateStyleSource('Project');
  } else {
    currentStyle = globalStyle;
    updateStyleSource('Global');
  }
  $('#style-selector').value = currentStyle;
  $('#qs-style').value = currentStyle;
  if (typeof updatePickerLabel === 'function') updatePickerLabel();
}

function updateStyleSource(source) {
  const badge = $('#style-source');
  badge.textContent = source;
  badge.classList.remove('hidden');
  if (source === 'Project') {
    badge.className = 'text-[10px] font-medium px-1.5 py-0.5 rounded bg-saffron-100 dark:bg-saffron-900/30 text-saffron-600 dark:text-saffron-400';
  } else {
    badge.className = 'text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400';
  }
}

async function createProject() {
  const name = $('#new-project-name').value.trim();
  if (!name) {
    $('#new-project-name').focus();
    return;
  }

  const style = $('#new-project-style').value || null;
  const project = {
    id: crypto.randomUUID(),
    name,
    defaultStyle: style,
    dateCreated: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    sortOrder: projects.length,
  };

  projects.push(project);
  await chrome.storage.local.set({ projects });

  // Select the new project
  currentProjectId = project.id;
  await chrome.storage.local.set({ lastProjectId: currentProjectId });

  renderProjectSelector();
  resolveStyle();
  updatePreview();

  // Reset form
  $('#new-project-form').classList.add('hidden');
  $('#new-project-name').value = '';
  $('#new-project-style').value = '';
}

function styleLabel(id) {
  const labels = {
    'apa7': 'APA 7',
    'mla9': 'MLA 9',
    'chicago17-author-date': 'Chicago',
    'harvard': 'Harvard',
    'ieee': 'IEEE',
    'vancouver': 'Vancouver',
  };
  return labels[id] || id;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ---------------------------------------------------------------------------
// Quick settings
// ---------------------------------------------------------------------------

async function loadQuickSettings() {
  const settings = await chrome.storage.local.get(['defaultStyle', 'defaultLocale', 'theme']);
  if (settings.defaultStyle) {
    globalStyle = settings.defaultStyle;
    $('#qs-style').value = globalStyle;
    // Don't override currentStyle here — resolveStyle() handles it
  }
  if (settings.defaultLocale) {
    $('#qs-locale').value = settings.defaultLocale;
  }
  const theme = settings.theme || 'system';
  applyTheme(theme);
  for (const btn of $$('.qs-theme')) {
    if (btn.dataset.theme === theme) {
      btn.className = 'qs-theme flex-1 text-[10px] py-1 bg-saffron-500 text-white';
    } else {
      btn.className = 'qs-theme flex-1 text-[10px] py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors';
    }
  }
}

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'dark') {
    html.classList.add('dark');
  } else if (theme === 'light') {
    html.classList.remove('dark');
  } else {
    // system — follow prefers-color-scheme
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }
}
