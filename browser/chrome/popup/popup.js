// Ibid — Popup Script
// Extracts metadata from active tab and renders via WASM engine

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Cross-browser sidebar/sidepanel open
async function openSidePanel() {
  try {
    if (chrome.sidePanel?.open) {
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id });
    } else if (typeof browser !== 'undefined' && browser.sidebarAction?.open) {
      await browser.sidebarAction.open();
    }
  } catch { /* ignore — may fail if already open or unsupported */ }
}

// State
let currentMetadata = null;
let currentStyle = 'apa7';
let globalStyle = 'apa7';
let projects = [];
let intextMode = 'parenthetical';
let currentProjectId = 'default';
let existingCitationId = null; // set when page already in library

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  // Check WASM status
  chrome.runtime.sendMessage({ action: 'getVersion' }, (res) => {
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
  $('#btn-view-in-library')?.addEventListener('click', () => openSidePanel());
  $('#btn-update-existing')?.addEventListener('click', () => {
    if (existingCitationId) addToProject();
  });
  // Tags toggle — icon button toggles input row + highlight
  const TAG_OFF = 'px-1.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-saffron-500 hover:border-saffron-300 transition-colors';
  const TAG_ON = 'px-1.5 py-1.5 rounded border border-saffron-300 dark:border-saffron-700 bg-saffron-100 dark:bg-saffron-900/30 text-saffron-500 transition-colors';
  $('#btn-show-tags')?.addEventListener('click', () => {
    const input = $('#field-tags');
    const btn = $('#btn-show-tags');
    const opening = input.classList.contains('hidden');
    input.classList.toggle('hidden');
    btn.setAttribute('class', opening ? TAG_ON : TAG_OFF);
    if (opening) input.focus();
  });

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
  // n.d. toggle — disables date input when active
  let noDateActive = false;
  $('#btn-no-date').addEventListener('click', () => {
    noDateActive = !noDateActive;
    const dateInput = $('#field-date');
    const precision = $('#date-precision');
    const btn = $('#btn-no-date');

    if (noDateActive) {
      dateInput.value = '';
      dateInput.disabled = true;
      dateInput.classList.add('opacity-40');
      precision.disabled = true;
      precision.classList.add('opacity-40');
      btn.classList.add('bg-saffron-500', 'text-white', 'border-saffron-500');
      btn.classList.remove('text-zinc-400', 'bg-zinc-50', 'dark:bg-zinc-800');
      setDateHint('info', 'No date — citation will show "n.d."');
    } else {
      dateInput.disabled = false;
      dateInput.classList.remove('opacity-40');
      precision.disabled = false;
      precision.classList.remove('opacity-40');
      btn.classList.remove('bg-saffron-500', 'text-white', 'border-saffron-500');
      btn.classList.add('text-zinc-400', 'bg-zinc-50', 'dark:bg-zinc-800');
      clearDateHint();
    }
    updatePreview();
  });

  // Project management
  $('#project-selector').addEventListener('change', onProjectChange);
  const BTN_OFF = 'px-1.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-saffron-600 hover:border-saffron-300 transition-colors';
  const BTN_ON = 'px-1.5 py-1.5 rounded border border-saffron-300 dark:border-saffron-700 bg-saffron-100 dark:bg-saffron-900/30 text-saffron-500 transition-colors';

  $('#btn-new-project').addEventListener('click', () => {
    const form = $('#new-project-form');
    const opening = form.classList.contains('hidden');
    form.classList.toggle('hidden');
    $('#btn-new-project').setAttribute('class', opening ? BTN_ON : BTN_OFF);
    // Hide Add button while project form is open to avoid confusion
    $('#btn-add-project').classList.toggle('hidden', opening);
    if (opening) $('#new-project-name').focus();
  });
  $('#btn-cancel-project').addEventListener('click', () => {
    $('#new-project-form').classList.add('hidden');
    $('#new-project-name').value = '';
    $('#new-project-style').value = '';
    $('#btn-add-project').classList.remove('hidden');
    $('#btn-new-project').setAttribute('class', BTN_OFF);
  });
  $('#btn-create-project').addEventListener('click', createProject);
  $('#new-project-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createProject();
  });
  // Quick settings dropdown toggle
  $('#btn-settings').addEventListener('click', (e) => {
    e.stopPropagation();
    // Close style picker if open
    $('#style-picker-dropdown').classList.add('hidden');
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

  $('#btn-sidepanel').addEventListener('click', () => openSidePanel());

  // Open sidepanel for import — used by bulk import banner
  $('#btn-open-library-import')?.addEventListener('click', () => openSidePanel());
  $('#style-selector').addEventListener('change', onStyleChange);
  $('#source-type').addEventListener('change', onSourceTypeChange);

  // In-text toggle — P (parenthetical) / N (narrative)
  $('#btn-parenthetical').addEventListener('click', async () => {
    intextMode = 'parenthetical';
    $('#btn-parenthetical').setAttribute('class', 'text-[9px] px-1.5 py-0.5 bg-saffron-500 text-white');
    $('#btn-narrative').setAttribute('class', 'text-[9px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300');
    const item = buildCslItem();
    const intext = await CitationFormatter.formatIntext(item, currentStyle, false);
    if (intext) $('#intext-preview').textContent = intext;
  });
  $('#btn-narrative').addEventListener('click', async () => {
    intextMode = 'narrative';
    $('#btn-narrative').setAttribute('class', 'text-[9px] px-1.5 py-0.5 bg-saffron-500 text-white');
    $('#btn-parenthetical').setAttribute('class', 'text-[9px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300');
    const item = buildCslItem();
    const intext = await CitationFormatter.formatIntext(item, currentStyle, true);
    if (intext) $('#intext-preview').textContent = intext;
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

  // Check for pending bulk imports (separate banner, not overwritten by hints)
  try {
    const { ibid_bulk_import } = await chrome.storage.session.get(['ibid_bulk_import']);
    if (ibid_bulk_import) {
      const banner = $('#bulk-import-banner');
      const text = $('#bulk-import-text');
      try {
        const parsed = JSON.parse(ibid_bulk_import);
        if (parsed._loading) {
          text.textContent = `${parsed.count} DOI(s) resolving...`;
        } else if (Array.isArray(parsed)) {
          text.textContent = `${parsed.length} DOI(s) ready to import.`;
        } else {
          text.textContent = 'Pending imports.';
        }
      } catch {
        text.textContent = 'Pending imports.';
      }
      banner.classList.remove('hidden');
    }
  } catch {}

  // Check if opened via "Cite linked page" context menu
  try {
    const linkCite = await chrome.storage.session.get(['ibid_link_cite']);
    if (linkCite.ibid_link_cite) {
      const data = linkCite.ibid_link_cite;
      await chrome.storage.session.remove(['ibid_link_cite']);
      if (data._error) {
        showState('ready');
        showHint('sparse', data._error);
        return;
      }
      if (data._bulkReady) {
        // Show via the persistent bulk banner instead
        const banner = $('#bulk-import-banner');
        const text = $('#bulk-import-text');
        text.textContent = `${data._count} DOI(s) resolved and ready to import.`;
        banner.classList.remove('hidden');
        await chrome.storage.session.remove(['ibid_link_cite']);
        showState('ready');
        return;
      }
      currentMetadata = data;
      populateFields(currentMetadata);
      showState('ready');
      showHint('info', 'Citation loaded from linked page. Review and click Add.');
      updatePreview();
      checkIfInLibrary(currentMetadata);
      return;
    }
  } catch {}

  // Extract metadata from current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isFileUrl = tab?.url?.startsWith('file://');
    const isRestricted = !tab?.url || tab.url.startsWith('chrome://') ||
      tab.url.startsWith('edge://') || tab.url.startsWith('about:') ||
      tab.url.startsWith('chrome-extension://');

    if (isRestricted) {
      currentMetadata = { URL: tab?.url || '', type: 'webpage' };
      showState('ready');
      showHint('restricted', 'This page can\'t be auto-cited. Enter details manually or paste a DOI/ISBN below and click Enhance.');
    } else if (isFileUrl) {
      // Local file — try to extract what we can from the filename/title
      const meta = extractLocalFileMeta(tab);
      currentMetadata = meta;
      populateFields(meta);
      showState('ready');
      // Try injection (works only if user enabled "Allow access to file URLs")
      let injected = false;
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['shared/identifiers.js', 'content/extractor.js'] });
        if (tab.url?.toLowerCase().match(/\.pdf(\?|#|$)/) || tab.url?.match(/\/pdf\/[\d.]/) || tab.url?.includes('application/pdf')) {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['shared/identifiers.js', 'content/pdfParser.js', 'content/pdf-extractor.js'] });
        }
        injected = true;
      } catch {}
      if (injected) {
        chrome.tabs.sendMessage(tab.id, { action: 'extractMetadata' }, (response) => {
          if (chrome.runtime.lastError || !response?.metadata) return;
          // Merge: prefer extracted metadata over filename-derived
          const extracted = response.metadata;
          if (extracted.title && extracted.title !== meta.title) currentMetadata.title = extracted.title;
          if (extracted.DOI) currentMetadata.DOI = extracted.DOI;
          if (extracted.author?.length) currentMetadata.author = extracted.author;
          populateFields(currentMetadata);
        });
        showHint('info', 'Local file detected. Metadata extracted from filename. Paste a DOI and click Enhance for full details.');
      } else {
        showHint('info', 'Local file detected. To auto-extract, enable "Allow access to file URLs" in chrome://extensions. Or paste a DOI below and click Enhance.');
      }
    } else if (tab?.id) {
      // Programmatically inject content scripts (no <all_urls> permission needed)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['shared/identifiers.js', 'content/extractor.js'],
        });
        // Also inject PDF extractor for PDF pages
        if (tab.url?.toLowerCase().match(/\.pdf(\?|#|$)/) || tab.url?.match(/\/pdf\/[\d.]/) || tab.url?.includes('application/pdf')) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['shared/identifiers.js', 'content/pdfParser.js', 'content/pdf-extractor.js'],
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
        showHint('info', 'Restored from previous session. Click "Rescan Page" for fresh extraction.');
      } else {
        // Detect PDF from URL
        const isPdfUrl = tab.url?.toLowerCase().match(/\.pdf(\?|#|$)/) ||
          tab.url?.includes('pdf.sciencedirectassets') ||
          tab.url?.match(/\/pdf\/[\d.]/) ||
          tab.url?.includes('application/pdf');

        // Fresh extraction with timeout fallback
        let responded = false;
        const extractionTimeout = setTimeout(() => {
          if (responded) return;
          responded = true;
          // Timeout — show fallback with tab info
          currentMetadata = {
            title: tab.title?.replace(/\.pdf$/i, '').trim() || '',
            URL: tab.url || '',
            type: isPdfUrl ? 'document' : 'webpage',
          };
          populateFields(currentMetadata);
          showState('ready');
          showHint('sparse', isPdfUrl
            ? 'PDF extraction timed out. Paste a DOI below and click Enhance for full metadata.'
            : 'Extraction timed out. Fields pre-filled from tab info — review and complete manually.');
          tryAutoEnhance();
        }, 8000); // 8s timeout — auto-enhance fills gaps if extraction is slow

        chrome.tabs.sendMessage(tab.id, { action: 'extractMetadata' }, (response) => {
          if (responded) return;
          responded = true;
          clearTimeout(extractionTimeout);

          if (chrome.runtime.lastError || !response?.metadata) {
            // Extract DOI from URL if possible
            const urlDoi = tab.url?.match(/10\.\d{4,}\/[^\s&?#]+/);
            currentMetadata = {
              title: tab.title || '',
              URL: tab.url || '',
              DOI: urlDoi ? urlDoi[0].replace(/[.,;:)\]}>]+$/, '') : null,
              type: isPdfUrl ? 'document' : 'webpage',
            };
            populateFields(currentMetadata);
            if (isPdfUrl) {
              showHint('sparse', 'PDF detected — limited metadata. Paste a DOI below and click Enhance. Or right-click: DOI link → <strong>"Cite linked page"</strong>.');
            } else if (currentMetadata.DOI) {
              showHint('enhancing', 'Extracting metadata via DOI...');
            } else if (currentMetadata.title && currentMetadata.title.length > 15) {
              showHint('enhancing', 'Limited extraction — searching by title...');
            } else {
              showHint('sparse', 'Could not read this page. Paste a DOI or ISBN below and click Enhance, or enter details manually.');
            }
          } else {
            currentMetadata = response.metadata;
            populateFields(currentMetadata);

            const hasAuthor = currentMetadata.author?.length > 0;
            const hasDate = !!currentMetadata.issued;
            const hasDoi = !!currentMetadata.DOI;
            const hasTitle = !!currentMetadata.title;

            if (currentMetadata._isPdf || isPdfUrl) {
              if (hasTitle && hasAuthor && hasDoi) {
                showHint('info', 'PDF metadata extracted. Review fields and click Enhance for complete details.');
              } else if (hasDoi) {
                showHint('info', 'PDF detected — DOI found. Click Enhance to fill all fields.');
              } else {
                showHint('sparse', 'PDF detected — limited metadata. Paste a DOI below and click Enhance. Or right-click: DOI link → <strong>"Cite linked page"</strong>, select a DOI → <strong>"Look up selected DOI"</strong>, select multiple → <strong>"Import DOIs from selection"</strong>.');
              }
            } else if (hasTitle && hasAuthor && hasDate) {
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
  // DOI field: prefer DOI, then ISBN, then short URL
  const doiVal = meta.DOI || '';
  if (doiVal) {
    $('#field-doi').value = doiVal;
  } else if (meta.ISBN) {
    $('#field-doi').value = meta.ISBN;
  } else if (meta.URL && meta.URL.length < 200 && /^https?:\/\//i.test(meta.URL)) {
    $('#field-doi').value = meta.URL;
  } else {
    $('#field-doi').value = '';
  }
  $('#source-type').value = meta.type || 'webpage';
  const tags = (meta._tags || []).join(', ');
  $('#field-tags').value = tags;
  // Auto-show tags input only if entry has tags
  if (tags) {
    $('#field-tags').classList.remove('hidden');
    $('#btn-show-tags')?.setAttribute('class', 'px-1.5 py-1.5 rounded border border-saffron-300 dark:border-saffron-700 bg-saffron-100 dark:bg-saffron-900/30 text-saffron-500 transition-colors');
  } else {
    $('#field-tags').classList.add('hidden');
    $('#btn-show-tags')?.setAttribute('class', 'px-1.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-saffron-500 hover:border-saffron-300 transition-colors');
  }

  // Delay type validation — auto-enhance may fill missing fields shortly
  clearTimeout(window._validateTimer);
  window._validateTimer = setTimeout(() => validateSourceType(), 1500);
  updateFieldRelevance();
  updatePreview();
  checkIfInLibrary(meta);
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

let _previewTimer = null;
async function updatePreview() {
  // Debounce rapid calls (typing, field changes)
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(() => _doUpdatePreview(), 120);
}

async function _doUpdatePreview() {
  const item = buildCslItem();
  const bib = $('#citation-preview');
  const intext = $('#intext-preview');

  const hasContent = item.title || (item.author && item.author.length > 0) || item.DOI || item.URL;
  if (!hasContent) {
    bib.innerHTML = '<span class="text-zinc-400 italic">Fill in fields above to see citation preview</span>';
    intext.innerHTML = '<span class="text-zinc-400 italic">(Author, Year)</span>';
    bib.style.opacity = '1';
    intext.style.opacity = '1';
    return;
  }

  // Dim slightly while rendering (not invisible — smooth)
  bib.style.opacity = '0.5';
  intext.style.opacity = '0.5';

  try {
    const both = await CitationFormatter.formatBoth(item, currentStyle, { html: true, narrative: intextMode === 'narrative' });
    if (both.bib) bib.textContent = both.bib;
    if (both.intext) intext.textContent = both.intext;
  } catch {
    bib.innerHTML = CitationFormatter.formatBibSync(item, currentStyle, { html: true });
    intext.textContent = CitationFormatter.formatIntextSync(item, currentStyle, intextMode === 'narrative');
  }

  // Fade back in
  bib.style.opacity = '1';
  intext.style.opacity = '1';
}

// ---------------------------------------------------------------------------
// Citation formatting — delegated to shared CitationFormatter module
// (WASM-first with JS fallback, supports all 74 bundled styles)
// ---------------------------------------------------------------------------

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
      // Update precision to match
      if (resolved.issued['date-parts']?.[0]) {
        const len = resolved.issued['date-parts'][0].length;
        $('#date-precision').value = len >= 3 ? 'day' : len === 2 ? 'month' : 'year';
      }
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

    if (resolved.DOI) {
      $('#field-doi').value = resolved.DOI;
    }

    if (resolved.type) {
      const typeSelect = $('#source-type');
      const option = typeSelect.querySelector(`option[value="${resolved.type}"]`);
      if (option) {
        typeSelect.value = resolved.type;
        filled.push('type');
      }
    }

    highlightFields(filled);

    if (filled.length > 0) {
      showEnhanceResult('success',
        `Enhanced ${filled.length} field${filled.length > 1 ? 's' : ''} via ${res.source}: ${filled.join(', ')}`
      );
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
// Optional host permissions — for scholarly API access (arXiv, Semantic Scholar, etc.)
// ---------------------------------------------------------------------------

const SCHOLARLY_ORIGINS = [
  'https://arxiv.org/*',
  'https://export.arxiv.org/*',
  'https://api.semanticscholar.org/*',
  'https://en.wikipedia.org/*',
  'https://doi.org/*',
];

async function hasScholarlyPermissions() {
  try {
    return await chrome.permissions.contains({ origins: SCHOLARLY_ORIGINS });
  } catch { return false; }
}

async function requestScholarlyPermissions() {
  try {
    return await chrome.permissions.request({ origins: SCHOLARLY_ORIGINS });
  } catch { return false; }
}

async function ensureScholarlyPermissions(forcedHint = false) {
  if (!forcedHint && await hasScholarlyPermissions()) return true;

  // Show a non-blocking hint — permissions should be granted from options page
  const settingsUrl = chrome.runtime.getURL('options/options.html');
  const link = `<a href="${settingsUrl}" target="_blank" class="underline text-saffron-600 hover:text-saffron-800">Grant API access in settings</a>`;
  showHint('info',
    forcedHint
      ? `Scholarly API access may need to be re-granted after extension reload. ${link}.`
      : `Missing authors or incomplete data? ${link} to fetch complete metadata from arXiv and other scholarly APIs.`
  );
  return false;
}

// ---------------------------------------------------------------------------
// Auto-enhance — silently resolve if identifier found and fields missing
// ---------------------------------------------------------------------------

async function tryAutoEnhance() {
  // Check if we have an identifier to resolve
  const doiField = $('#field-doi').value.trim();
  if (!doiField) return;

  // Detect if there's a resolvable identifier (DOI, PMID, arXiv, ISBN, or URL)
  const hasResolvable =
    doiField.match(/^10\.\d{4,}/) ||
    doiField.match(/doi\.org\/10\./) ||
    doiField.match(/^pmid:\s*\d+$/i) ||
    doiField.match(/pubmed.*\/\d+/) ||
    doiField.match(/arxiv\.org\/abs\//) ||
    doiField.match(/^arxiv:\s*\d{4}\./i) ||
    doiField.match(/^(97[89])?\d{9}[\dXx]$/) ||
    doiField.match(/^https?:\/\//i);

  if (!hasResolvable) {
    // No resolvable ID — try title search as last resort
    const title = $('#field-title').value.trim();
    if (title && title.length > 15 && !$('#field-authors').value.trim()) {
      try {
        const res = await chrome.runtime.sendMessage({ action: 'resolveByTitle', title });
        if (res?.resolved) {
          applyResolved(res.resolved, res.source);
          if (res.resolved._needsPermissions && !(await hasScholarlyPermissions())) {
            ensureScholarlyPermissions();
          }
        }
      } catch {}
    }
    return;
  }

  // Resolve silently — DOI metadata is authoritative, always worth trying
  let resolved = false;
  let resolveError = null;
  try {
    const res = await chrome.runtime.sendMessage({
      action: 'resolve',
      identifier: doiField,
    });

    if (res?.resolved) {
      applyResolved(res.resolved, res.source);
      resolved = true;
      // If resolver signals that permissions would improve results, show hint
      if (res.resolved._needsPermissions && !(await hasScholarlyPermissions())) {
        ensureScholarlyPermissions();
      }
    }
    if (res?.error) resolveError = res.error;
  } catch (e) {
    resolveError = e.message || String(e);
  }

  // If failed and looks like CORS or needs scholarly API, prompt for permissions
  const needsScholarlyApi =
    doiField.match(/arxiv/i) || doiField.match(/^https?:\/\//i) ||
    doiField.match(/10\.48550/);
  const isCorsError = resolveError && /CORS|blocked|Failed to fetch|Network error/i.test(resolveError);
  if (!resolved && (needsScholarlyApi || isCorsError)) {
    const hasPerms = await hasScholarlyPermissions();
    if (!hasPerms || isCorsError) {
      // Show hint — forcedHint when permissions exist but CORS still fails (extension reload)
      const granted = await ensureScholarlyPermissions(hasPerms && isCorsError);
      if (granted) {
        // Retry with permissions
        try {
          const res = await chrome.runtime.sendMessage({
            action: 'resolve',
            identifier: doiField,
          });
          if (res?.resolved) {
            applyResolved(res.resolved, res.source);
            resolved = true;
          }
        } catch {}
      }
    }
  }

  // Fallback: title search when primary resolution fails (e.g. PDF URL with no DOI)
  if (!resolved) {
    const title = $('#field-title').value.trim();
    if (title && title.length > 15 && !$('#field-authors').value.trim()) {
      // Title search via OpenAlex may need permissions for arXiv fallback
      if (!(await hasScholarlyPermissions())) {
        await ensureScholarlyPermissions();
      }
      try {
        const res = await chrome.runtime.sendMessage({ action: 'resolveByTitle', title });
        if (res?.resolved) {
          applyResolved(res.resolved, res.source);
          if (res.resolved._needsPermissions) {
            ensureScholarlyPermissions();
          }
        }
      } catch {
        // Silent fail
      }
    }
  }
}

function applyResolved(resolved, source) {
  const filled = [];
  const current = (sel) => $(sel).value.trim();
  const set = (sel, val, label) => {
    if (current(sel) !== val) { $(sel).value = val; filled.push(label); }
  };

  if (resolved.title) {
    const cur = current('#field-title');
    if (!cur || (resolved.title.length > cur.length && !cur.includes(resolved.title))) {
      set('#field-title', resolved.title, 'title');
    }
  }

  if (resolved.author?.length) {
    const curAuthors = current('#field-authors');
    const curCount = curAuthors ? curAuthors.split(/\s*;\s*/).length : 0;
    if (resolved.author.length > curCount) {
      set('#field-authors', formatAuthorsForInput(resolved.author), 'authors');
    }
  }

  if (resolved.issued) {
    const curDate = current('#field-date');
    const resolvedDate = formatDateForInput(resolved.issued);
    if (!curDate || (resolvedDate.length > curDate.length)) {
      set('#field-date', resolvedDate, 'date');
      if (resolved.issued['date-parts']?.[0]) {
        const len = resolved.issued['date-parts'][0].length;
        $('#date-precision').value = len >= 3 ? 'day' : len === 2 ? 'month' : 'year';
      }
    }
  }

  if (resolved['container-title']) {
    set('#field-container', resolved['container-title'], 'journal');
  }

  if (resolved.publisher && !current('#field-publisher')) {
    set('#field-publisher', resolved.publisher, 'publisher');
  }

  if (resolved.volume) set('#field-volume', resolved.volume, 'vol');
  if (resolved.issue) set('#field-issue', resolved.issue, 'issue');
  if (resolved.page) set('#field-pages', resolved.page, 'pages');

  if (resolved.DOI) {
    $('#field-doi').value = resolved.DOI;
  }
  if (resolved.type) {
    const opt = $('#source-type').querySelector(`option[value="${resolved.type}"]`);
    if (opt) $('#source-type').value = resolved.type;
  }

  if (filled.length > 0) {
    highlightFields(filled);
    dismissHint();
    showEnhanceResult('success',
      `Auto-enhanced ${filled.length} field${filled.length > 1 ? 's' : ''} via ${source || 'API'}`
    );
    validateSourceType();
    updateFieldRelevance();
    updatePreview();
    cacheCurrentFields();
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
  item._sourceUrl = currentMetadata?.URL || '';

  // Parse tags from input
  const tagsInput = $('#field-tags').value.trim();
  if (tagsInput) {
    item._tags = [...new Set(tagsInput.split(',').map(t => t.trim()).filter(Boolean))];
  }

  const projectId = $('#project-selector').value;
  if (projectId !== 'new') {
    item._projectIds = [projectId];
  }

  const stored = await chrome.storage.local.get(['citations']);
  const citations = stored.citations || [];

  // If updating existing entry
  if (existingCitationId) {
    const idx = citations.findIndex(c => c.id === existingCitationId);
    if (idx >= 0) {
      item.id = existingCitationId;
      item._dateAdded = citations[idx]._dateAdded;
      item._dateModified = new Date().toISOString();
      // Merge tags: keep existing + add new from input
      const existingTags = citations[idx]._tags || [];
      const newTags = item._tags || [];
      item._tags = [...new Set([...existingTags, ...newTags])];
      item._notes = citations[idx]._notes;
      item._quotes = citations[idx]._quotes;
      item._starred = citations[idx]._starred;
      if (projectId !== 'new') item._projectIds = [projectId];
      citations[idx] = item;
      await chrome.storage.local.set({ citations });
      flashButton('#btn-add-project', 'Updated!', true);
      cacheCurrentFields();
      return;
    }
  }

  // New entry
  item.id = crypto.randomUUID();
  item._dateAdded = new Date().toISOString();

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
  checkIfInLibrary(currentMetadata);
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
  // Close settings dropdown if open
  $('#quick-settings').classList.add('hidden');
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
      html += `<div class="px-3 py-2 text-center text-xs text-zinc-400">No bundled styles match "${query}"</div>`;
      html += `<div id="popup-remote-results"><div class="px-3 py-2 text-[10px] text-zinc-400 text-center">Searching 2600+ CSL styles online...</div></div>`;
      // Async remote search
      searchRemotePopup(query);
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

  // Download buttons (from remote search results)
  bindPopupDownloadButtons();
}

function bindPopupDownloadButtons() {
  const list = $('#style-picker-list');
  for (const dlBtn of list.querySelectorAll('.download-style-btn')) {
    dlBtn.addEventListener('click', async () => {
      const styleId = dlBtn.dataset.id;
      dlBtn.querySelector('.dl-label')?.remove();
      dlBtn.textContent = 'Downloading...';
      dlBtn.disabled = true;
      try {
        const res = await chrome.runtime.sendMessage({ action: 'downloadStyle', styleId });
        if (res?.success) {
          allStyles.push({ id: styleId, name: res.name, group: 'Downloaded', field: 'generic' });
          selectStyle(styleId, res.name);
        } else {
          dlBtn.textContent = res?.error || 'Not found';
          setTimeout(() => { dlBtn.textContent = dlBtn.dataset.name || styleId; dlBtn.disabled = false; }, 2000);
        }
      } catch {
        dlBtn.textContent = 'Download failed';
      }
    });
  }
}

async function searchRemotePopup(query) {
  try {
    const res = await chrome.runtime.sendMessage({ action: 'searchRemoteStyles', query });
    const container = $('#popup-remote-results');
    if (!container) return;
    if (!res?.styles?.length) {
      container.innerHTML = `<div class="px-3 py-3 text-center text-xs text-zinc-400">No styles found for "${query}"</div>`;
      return;
    }
    let html = `<div class="px-2.5 py-1 text-[9px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-900/50">Online (${res.styles.length} results)</div>`;
    for (const s of res.styles) {
      if (allStyles.find(ls => ls.id === s.id)) continue;
      html += `<button class="download-style-btn w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-1 hover:bg-saffron-50 dark:hover:bg-saffron-900/10 text-zinc-700 dark:text-zinc-300 transition-colors" data-id="${s.id}" data-name="${s.name}">
        <span class="truncate">${s.name}</span>
        <span class="text-[9px] px-1 py-0.5 rounded bg-saffron-100 dark:bg-saffron-900/30 text-saffron-600 dark:text-saffron-400 shrink-0">download</span>
      </button>`;
    }
    container.innerHTML = html;
    bindPopupDownloadButtons();
  } catch {
    const container = $('#popup-remote-results');
    if (container) container.innerHTML = `<div class="px-3 py-3 text-center text-xs text-zinc-400">Search unavailable offline</div>`;
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

// Extract metadata from local file URL (file:///) using filename and title
function extractLocalFileMeta(tab) {
  const url = tab.url || '';
  const meta = { URL: url, type: 'document' };

  // Extract filename from path
  let filename = '';
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    filename = path.split('/').pop() || '';
  } catch {
    filename = url.split('/').pop() || '';
  }

  // Strip extension
  const nameNoExt = filename.replace(/\.\w{1,5}$/, '');

  // Use document title if available and different from filename
  if (tab.title && tab.title !== filename && !tab.title.startsWith('file:')) {
    meta.title = tab.title.replace(/\.pdf$/i, '').trim();
  } else if (nameNoExt) {
    // Clean up filename: replace hyphens/underscores with spaces
    meta.title = nameNoExt.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Try to find DOI pattern in filename (e.g., s44187-026-00833-z)
  const doiMatch = filename.match(/(10\.\d{4,}[^\s]+)/);
  if (doiMatch) meta.DOI = doiMatch[1];

  // Detect if PDF
  if (url.toLowerCase().endsWith('.pdf')) meta._isPdf = true;

  return meta;
}

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
    info: {
      bar: 'bg-blue-50 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
      icon: 'text-blue-500',
    },
  };

  const s = styles[type] || styles.sparse;
  bar.setAttribute('class', `px-4 py-2 text-xs flex items-start gap-2 border-b ${s.bar}`);
  icon.setAttribute('class', `w-4 h-4 shrink-0 mt-0.5 ${s.icon}`);
  text.innerHTML = message;
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
    if (!tab?.id) {
      showHint('restricted', 'Cannot rescan this page.');
      return;
    }

    // Allow http, https, and file:// URLs
    const isValidUrl = tab.url?.match(/^(https?|file):\/\//);
    if (!isValidUrl) {
      showHint('restricted', 'Cannot rescan this page (restricted URL).');
      return;
    }

    // Clear cache for this tab — force fresh extraction
    const cacheKey = `ibid_cache_${tab.id}`;
    await chrome.storage.session.remove([cacheKey]);

    const isPdf = tab.url?.toLowerCase().match(/\.pdf(\?|#|$)/) || tab.url?.match(/\/pdf\/[\d.]/) || tab.url?.includes('application/pdf');

    // Re-inject content scripts
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['shared/identifiers.js', 'content/extractor.js'],
      });
      if (isPdf) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/pdfParser.js', 'content/pdf-extractor.js'],
        });
      }
    } catch (e) { /* may already be injected or restricted page */ }

    // Wait briefly for content script to be ready after re-injection
    await new Promise(r => setTimeout(r, 300));

    const sendExtract = () => new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: 'extractMetadata' }, (response) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response?.metadata || null);
      });
    });

    let metadata = await sendExtract();

    // PDF pages: async extraction takes time, retry after delay
    if (!metadata && isPdf) {
      showHint('info', 'Rescanning PDF — this may take a moment...');
      await new Promise(r => setTimeout(r, 3000));
      metadata = await sendExtract();
    }

    if (metadata) {
      currentMetadata = metadata;
      populateFields(currentMetadata);
      dismissHint();
      showEnhanceResult('success', 'Page rescanned — fields refreshed');
      tryAutoEnhance();
    } else {
      // Extraction failed — keep current fields, re-run auto-enhance
      const hasDoi = $('#field-doi').value.trim();
      if (hasDoi) {
        dismissHint();
        showEnhanceResult('info', 'Re-enhancing from identifier...');
        tryAutoEnhance();
      } else {
        showHint('sparse', 'Could not rescan. Try reloading the page first, then click the Ibid icon again.');
      }
    }
  } catch (err) {
    showHint('sparse', `Rescan failed: ${err.message}`);
  }
}

// Cache current field values for this tab (survives popup close/reopen)
// Check if current page's citation already exists in library
async function checkIfInLibrary(meta) {
  existingCitationId = null;
  const badge = $('#in-library-badge');
  const addBtn = $('#btn-add-project');
  const addLabel = $('#add-label');
  const addIcon = $('#add-icon');

  try {
    const { citations = [] } = await chrome.storage.local.get(['citations']);
    const url = meta?.URL || meta?.DOI || '';
    const doi = meta?.DOI || '';

    const match = citations.find(c => {
      if (doi && c.DOI && doi.toLowerCase() === c.DOI.toLowerCase()) return true;
      if (url && c.URL && url === c.URL) return true;
      if (url && c._sourceUrl && url === c._sourceUrl) return true;
      return false;
    });

    if (match) {
      existingCitationId = match.id;
      if (badge) badge.classList.remove('hidden');
      // Show which project it's in
      const projectLabel = $('#in-library-project');
      if (projectLabel) {
        const projId = match._projectIds?.[0] || match._project || 'default';
        const { projects = [] } = await chrome.storage.local.get(['projects']);
        const proj = projects.find(p => p.id === projId);
        projectLabel.textContent = proj ? `In "${proj.name}"` : 'In library';
      }
      // Keep Add button as "Add" so user can still add to a different project
      // The Update button in the badge handles updating the existing entry
      if (addLabel) addLabel.textContent = 'Add';
      if (addIcon) addIcon.innerHTML = '<path d="M12 5v14M5 12h14"/>';
    } else {
      existingCitationId = null;
      if (badge) badge.classList.add('hidden');
      if (addLabel) addLabel.textContent = 'Add';
      if (addIcon) addIcon.innerHTML = '<path d="M12 5v14M5 12h14"/>';
      addBtn?.classList.remove('bg-emerald-500', 'hover:bg-emerald-600');
      addBtn?.classList.add('bg-saffron-500', 'hover:bg-saffron-600');
    }
  } catch {
    // Storage error — ignore
  }
}

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
  $('#btn-add-project').classList.remove('hidden');
  $('#btn-new-project').setAttribute('class', 'px-1.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-saffron-600 hover:border-saffron-300 transition-colors');
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
