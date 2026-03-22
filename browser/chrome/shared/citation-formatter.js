// shared/citation-formatter.js — Unified citation formatting API
// Tries Rust CSL renderer (WASM) first for all 74 styles, falls back to JS 6-family formatter.
// Used by both popup.js and sidepanel.js.

const CitationFormatter = (() => {

  // -------------------------------------------------------------------------
  // Style resolution: map any style ID to one of 6 JS families
  // -------------------------------------------------------------------------

  function resolveStyleFamily(styleId) {
    const id = (styleId || '').toLowerCase();
    if (id.includes('apa')) return 'apa';
    if (id.includes('mla') || id.includes('modern-language')) return 'mla';
    if (id.includes('chicago') || id.includes('turabian')) return 'chicago';
    if (id.includes('harvard') || id.includes('cite-them-right') || id.includes('elsevier-harvard') || id.includes('sage-harvard') || id.includes('taylor-and-francis-harvard')) return 'harvard';
    if (id.includes('ieee')) return 'ieee';
    if (id.includes('vancouver') || id.includes('ama') || id.includes('medical') || id.includes('nlm') ||
        id.includes('lancet') || id.includes('bmj') || id.includes('nejm') || id.includes('nature') ||
        id.includes('science') || id.includes('cell') || id.includes('annual-review') ||
        id.includes('frontiers') || id.includes('copernicus') || id.includes('liebert') ||
        id.includes('sage-vancouver') || id.includes('springer-vancouver') || id.includes('elsevier-vancouver')) return 'vancouver';
    // Numbered styles (ACM, Springer brackets, ISO numeric, etc.)
    if (id.includes('acm') || id.includes('springer-basic-brackets') || id.includes('springer-lncs') ||
        id.includes('iso690-numeric') || id.includes('cambridge-university-press-numeric') ||
        id.includes('din-1505') || id.includes('gost') || id.includes('sist02')) return 'vancouver';
    return 'apa'; // default
  }

  // -------------------------------------------------------------------------
  // JS author formatting
  // -------------------------------------------------------------------------

  function formatAuthors(authors, style) {
    if (!authors || authors.length === 0) return '';
    const fmt = (a) => {
      if (a.literal) return a.literal;
      const f = a.family || '';
      const g = a.given || '';
      const initials = g.split(/[\s.]/).filter(Boolean).map(p => p[0] + '.').join(' ');
      if (style === 'ieee' || style === 'vancouver') return `${initials} ${f}`.trim();
      return `${f}, ${initials}`.trim();
    };
    if (authors.length === 1) return fmt(authors[0]);
    if (authors.length === 2) {
      const sep = style === 'apa' ? ' & ' : style === 'mla' ? ', and ' : ' and ';
      return `${fmt(authors[0])}${sep}${fmt(authors[1])}`;
    }
    if (style === 'vancouver' && authors.length > 6) {
      return authors.slice(0, 6).map(fmt).join(', ') + ', et al.';
    }
    const last = authors.length - 1;
    const sep = style === 'apa' ? ', & ' : style === 'mla' ? ', and ' : ', & ';
    return authors.slice(0, last).map(fmt).join(', ') + sep + fmt(authors[last]);
  }

  // -------------------------------------------------------------------------
  // JS bibliography formatters (HTML output — use textContent to strip tags)
  // -------------------------------------------------------------------------

  function jsBibHtml(item, style) {
    const a = formatAuthors(item.author, style);
    const year = item.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
    const title = item.title || 'Untitled';
    const container = item['container-title'] || '';
    const vol = item.volume || '';
    const iss = item.issue || '';
    const pg = item.page || '';
    const doi = item.DOI ? `https://doi.org/${item.DOI}` : '';
    const url = item.URL || '';
    const pub = item.publisher || '';
    const access = doi || url;

    switch (style) {
      case 'apa': {
        const isBookLike = item.type === 'book' || item.type === 'report' || item.type === 'thesis';
        let parts = [a || title, `(${year})`];
        if (a) parts.push(isBookLike ? `<i>${title}</i>` : title);
        if (container) { let c = `<i>${container}</i>`; if (vol) c += `, <i>${vol}</i>`; if (iss) c += `(${iss})`; if (pg) c += `, ${pg}`; parts.push(c); }
        if (pub) parts.push(pub);
        if (access) parts.push(access);
        return parts.filter(Boolean).join('. ').replace(/\.\./g, '.').replace(/\. \./g, '.') + '.';
      }
      case 'mla': {
        let parts = [a || 'Unknown'];
        parts.push(item.type === 'book' ? `<i>${title}</i>` : `\u201c${title}.\u201d`);
        if (container) parts.push(`<i>${container}</i>`);
        let loc = []; if (vol) loc.push(`vol. ${vol}`); if (iss) loc.push(`no. ${iss}`);
        if (loc.length) parts.push(loc.join(', '));
        if (pub) parts.push(pub);
        if (year !== 'n.d.') parts.push(year);
        if (pg) parts.push(`pp. ${pg}`);
        if (access) parts.push(access);
        return parts.filter(Boolean).join(', ').replace(/,\./g, '.') + '.';
      }
      case 'chicago': {
        let parts = [a || 'Unknown', year];
        parts.push(item.type === 'book' || item.type === 'thesis' ? `<i>${title}</i>` : `\u201c${title}\u201d`);
        if (container) { let c = `<i>${container}</i>`; if (vol) c += ` ${vol}`; if (iss) c += `, no. ${iss}`; if (pg) c += `: ${pg}`; parts.push(c); }
        if (pub && item.publisher_place) parts.push(`${item.publisher_place}: ${pub}`);
        else if (pub) parts.push(pub);
        if (access) parts.push(access);
        return parts.filter(Boolean).join('. ').replace(/\.\./g, '.') + '.';
      }
      case 'harvard': {
        const isBookLike = item.type === 'book' || item.type === 'thesis';
        let parts = [a || 'Unknown', `(${year})`];
        parts.push(isBookLike ? `<i>${title}</i>` : `\u2018${title}\u2019`);
        if (container) { let c = `<i>${container}</i>`; if (vol) c += `, ${vol}`; if (iss) c += `(${iss})`; if (pg) c += `, pp. ${pg}`; parts.push(c); }
        if (pub) parts.push(pub);
        if (doi) parts.push(`doi:${item.DOI}`); else if (url) parts.push(`Available at: ${url}`);
        return parts.filter(Boolean).join('. ').replace(/\.\./g, '.') + '.';
      }
      case 'ieee': {
        let parts = [formatAuthors(item.author, 'ieee'), `\u201c${title},\u201d`];
        if (container) parts.push(`<i>${container}</i>`);
        if (vol) parts.push(`vol. ${vol}`); if (iss) parts.push(`no. ${iss}`);
        if (pg) parts.push(`pp. ${pg}`);
        if (year !== 'n.d.') parts.push(year);
        if (item.DOI) parts.push(`doi: ${item.DOI}`);
        return '[1] ' + parts.filter(Boolean).join(', ') + '.';
      }
      case 'vancouver': {
        const va = formatAuthors(item.author, 'vancouver');
        let parts = [`${va}.`, `${title}.`];
        if (container) parts.push(`${container}. ${year}${vol ? `;${vol}` : ''}${iss ? `(${iss})` : ''}${pg ? `:${pg}` : ''}.`);
        else if (year !== 'n.d.') parts.push(`${year}.`);
        if (item.DOI) parts.push(`doi: ${item.DOI}`);
        return '1. ' + parts.filter(Boolean).join(' ');
      }
      default:
        return jsBibHtml(item, 'apa');
    }
  }

  function jsBibText(item, style) {
    // Strip HTML tags from the HTML version
    const html = jsBibHtml(item, style);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent;
  }

  // -------------------------------------------------------------------------
  // JS in-text formatters
  // -------------------------------------------------------------------------

  function jsIntext(item, style, narrative = false) {
    const first = (item.author || [])[0];
    const name = first?.family || first?.literal || (item.title ? item.title.split(' ').slice(0, 3).join(' ') : 'Unknown');
    const year = item.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
    const count = (item.author || []).length;
    const second = item.author?.[1]?.family || '';

    switch (style) {
      case 'apa': case 'chicago': case 'harvard':
        if (narrative) {
          if (count >= 3) return `${name} et al. (${year})`;
          if (count === 2) return `${name} & ${second} (${year})`;
          return `${name} (${year})`;
        }
        if (count >= 3) return `(${name} et al., ${year})`;
        if (count === 2) return `(${name} & ${second}, ${year})`;
        return `(${name}, ${year})`;
      case 'mla':
        if (narrative) {
          if (count >= 3) return `${name} et al.`;
          if (count === 2) return `${name} and ${second}`;
          return name;
        }
        if (count >= 3) return `(${name} et al. ${item.page || ''})`.trim();
        if (count === 2) return `(${name} and ${second} ${item.page || ''})`.trim();
        return `(${name} ${item.page || ''})`.trim();
      case 'ieee': case 'vancouver':
        return '[1]';
      default:
        return `(${name}, ${year})`;
    }
  }

  // -------------------------------------------------------------------------
  // WASM rendering via service worker
  // -------------------------------------------------------------------------

  // Hayagriva CSL renderer (Typst's battle-tested Rust implementation)
  // Supports 2600+ official CSL styles via WASM. Falls back to JS if unavailable.
  async function wasmFormatBoth(item, styleId) {
    try {
      const res = await chrome.runtime.sendMessage({
        action: 'formatBoth',
        styleId,
        item,
      });
      if (res?.error || !res?.bibliography) return null;
      return { bib: res.bibliography, intext: res.intext };
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Bundled style list cache
  // -------------------------------------------------------------------------

  let _bundledStyles = null;

  async function getStyles() {
    if (_bundledStyles) return _bundledStyles;
    try {
      const res = await chrome.runtime.sendMessage({ action: 'getStyles' });
      if (res?.styles) {
        _bundledStyles = res.styles;
        return _bundledStyles;
      }
    } catch {}
    return [];
  }

  // -------------------------------------------------------------------------
  // Unified API
  // -------------------------------------------------------------------------

  /**
   * Format bibliography. Tries WASM first, falls back to JS.
   * @param {object} item - CSL-JSON item
   * @param {string} styleId - Style ID (e.g., 'apa', 'nature', 'ieee')
   * @param {object} [opts] - { html: true } for HTML output (default: text)
   * @returns {Promise<string>} formatted bibliography
   */
  async function formatBib(item, styleId, opts = {}) {
    // Try WASM first
    const wasm = await wasmFormatBoth(item, styleId);
    if (wasm?.bib) {
      if (opts.html) return wasm.bib;
      // Strip HTML tags for text output
      const tmp = document.createElement('div');
      tmp.innerHTML = wasm.bib;
      return tmp.textContent;
    }
    // JS fallback — resolve to family
    const family = resolveStyleFamily(styleId);
    return opts.html ? jsBibHtml(item, family) : jsBibText(item, family);
  }

  /**
   * Format bibliography synchronously with JS only (no WASM, no async).
   * Use when you need instant rendering (e.g., popup preview).
   */
  function formatBibSync(item, styleId, opts = {}) {
    const family = resolveStyleFamily(styleId);
    return opts.html ? jsBibHtml(item, family) : jsBibText(item, family);
  }

  /**
   * Format in-text citation. WASM (hayagriva) primary, JS fallback.
   * Narrative mode uses JS (WASM only renders parenthetical).
   */
  async function formatIntext(item, styleId, narrative = false) {
    const family = resolveStyleFamily(styleId);
    if (narrative) return jsIntext(item, family, true);
    const wasm = await wasmFormatBoth(item, styleId);
    if (wasm?.intext) return wasm.intext;
    return jsIntext(item, family, false);
  }

  /**
   * Format in-text synchronously with JS only.
   */
  function formatIntextSync(item, styleId, narrative = false) {
    const family = resolveStyleFamily(styleId);
    return jsIntext(item, family, narrative);
  }

  /**
   * Format both bib + in-text. Single WASM call for efficiency.
   */
  async function formatBoth(item, styleId, opts = {}) {
    const wasm = await wasmFormatBoth(item, styleId);
    const family = resolveStyleFamily(styleId);

    // Use WASM bib if available, otherwise JS
    let bib;
    if (wasm?.bib) {
      bib = wasm.bib;
      if (!opts.html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = bib;
        bib = tmp.textContent;
      }
    } else {
      bib = opts.html ? jsBibHtml(item, family) : jsBibText(item, family);
    }

    // In-text: WASM for parenthetical, JS for narrative
    let intext;
    if (opts.narrative) {
      intext = jsIntext(item, family, true);
    } else if (wasm?.intext) {
      intext = wasm.intext;
    } else {
      intext = jsIntext(item, family, false);
    }

    return { bib, intext };
  }

  /**
   * Build <option> elements for a style <select> grouped by category.
   * Returns HTML string.
   */
  async function buildStyleOptions(selectedId) {
    const styles = await getStyles();
    if (!styles.length) {
      // Fallback to 6 basic families
      return ['apa', 'mla', 'chicago', 'harvard', 'ieee', 'vancouver']
        .map(s => `<option value="${s}" ${s === selectedId ? 'selected' : ''}>${s.toUpperCase()}</option>`)
        .join('');
    }

    // Group by group name
    const groups = {};
    for (const s of styles) {
      const g = s.group || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    }

    let html = '';
    for (const [group, items] of Object.entries(groups)) {
      html += `<optgroup label="${group}">`;
      for (const s of items) {
        html += `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.name}</option>`;
      }
      html += '</optgroup>';
    }
    return html;
  }

  /**
   * Populate a <select> element with all bundled styles.
   */
  async function populateStyleSelect(selectEl, selectedId) {
    selectEl.innerHTML = await buildStyleOptions(selectedId || 'apa');
  }

  // -------------------------------------------------------------------------
  // Reusable style picker dropdown (same look as popup)
  // -------------------------------------------------------------------------

  let _recentStyleIds = null;

  async function loadRecentStyles() {
    if (_recentStyleIds) return _recentStyleIds;
    try {
      const stored = await chrome.storage.local.get(['recentStyles']);
      _recentStyleIds = stored.recentStyles || ['apa', 'modern-language-association', 'chicago-author-date', 'ieee', 'harvard-cite-them-right', 'vancouver'];
    } catch {
      _recentStyleIds = ['apa', 'modern-language-association', 'chicago-author-date', 'ieee', 'harvard-cite-them-right', 'vancouver'];
    }
    return _recentStyleIds;
  }

  function trackRecentStyle(styleId) {
    if (!_recentStyleIds) _recentStyleIds = [];
    _recentStyleIds = [styleId, ..._recentStyleIds.filter(id => id !== styleId)].slice(0, 8);
    chrome.storage.local.set({ recentStyles: _recentStyleIds });
  }

  /**
   * Create a searchable style picker dropdown anchored to a container element.
   * @param {HTMLElement} container - element to append the picker into
   * @param {object} opts - { selectedId, onSelect(styleId, styleName), dropUp: bool }
   * @returns {Promise<{ destroy(), setSelected(id), getSelectedId() }>}
   */
  async function createStylePicker(container, opts = {}) {
    const styles = await getStyles();
    const recentIds = await loadRecentStyles();
    let selectedId = opts.selectedId || 'apa';
    const onSelect = opts.onSelect || (() => {});
    const dropUp = opts.dropUp !== false; // default: open upward

    // Find display name
    const getName = (id) => (styles.find(s => s.id === id) || {}).name || id;

    // Dropdown position classes
    const posClass = dropUp ? 'bottom-full mb-1' : 'top-full mt-1';

    // Build DOM
    const wrapper = document.createElement('div');
    wrapper.className = 'relative';
    wrapper.innerHTML = `
      <button class="sp-btn w-full px-2 py-1 rounded border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-[10px] text-left flex items-center justify-between gap-1 hover:border-saffron-400 transition-colors cursor-pointer" type="button">
        <span class="sp-label truncate">${getName(selectedId)}</span>
        <svg class="w-3 h-3 shrink-0 text-zinc-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div class="sp-dropdown hidden absolute left-0 right-0 ${posClass} bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-lg z-[60] overflow-hidden" style="min-width:200px">
        <div class="p-1.5 border-b border-zinc-100 dark:border-zinc-700">
          <input class="sp-search w-full px-2 py-1 rounded border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-[10px] focus:ring-1 focus:ring-saffron-500 outline-none" type="text" placeholder="Search styles or enter CSL ID...">
        </div>
        <div class="sp-list max-h-[220px] overflow-y-auto"></div>
      </div>
    `;
    container.innerHTML = '';
    container.appendChild(wrapper);

    const btn = wrapper.querySelector('.sp-btn');
    const label = wrapper.querySelector('.sp-label');
    const dropdown = wrapper.querySelector('.sp-dropdown');
    const searchInput = wrapper.querySelector('.sp-search');
    const listEl = wrapper.querySelector('.sp-list');

    function renderList(query) {
      const q = (query || '').toLowerCase();
      const recent = recentIds.map(id => styles.find(s => s.id === id)).filter(Boolean);

      let filtered = styles;
      if (q) {
        filtered = styles.filter(s =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (s.field || '').toLowerCase().includes(q) ||
          (s.group || '').toLowerCase().includes(q)
        );
      }

      let html = '';

      // Recent (only without search)
      if (!q && recent.length > 0) {
        html += `<div class="px-2 py-0.5 text-[8px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">Recent</div>`;
        html += recent.map(s => itemHtml(s)).join('');
        html += `<div class="border-t border-zinc-100 dark:border-zinc-700"></div>`;
      }

      if (!q) {
        const groups = {};
        for (const s of filtered) {
          const g = s.group || 'Other';
          if (!groups[g]) groups[g] = [];
          groups[g].push(s);
        }
        html += `<div class="px-2 py-0.5 text-[8px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">All Styles (${styles.length})</div>`;
        for (const g of Object.keys(groups).sort()) {
          html += `<div class="px-2 py-0.5 text-[8px] font-medium text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/30">${g}</div>`;
          html += groups[g].map(s => itemHtml(s)).join('');
        }
      } else if (filtered.length === 0) {
        html += `<div class="px-3 py-2 text-center text-[10px] text-zinc-400">No bundled styles match "${q}"</div>`;
        html += `<div class="sp-remote-results px-1 py-1"><div class="px-2 py-1 text-[9px] text-zinc-400 text-center">Searching 2600+ CSL styles online...</div></div>`;
        // Trigger async remote search
        searchRemote(q);
      } else {
        html += `<div class="px-2 py-0.5 text-[8px] text-zinc-400">${filtered.length} result${filtered.length !== 1 ? 's' : ''}</div>`;
        html += filtered.map(s => itemHtml(s)).join('');
      }

      listEl.innerHTML = html;

      for (const item of listEl.querySelectorAll('.sp-item')) {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedId = item.dataset.id;
          label.textContent = item.dataset.name;
          dropdown.classList.add('hidden');
          trackRecentStyle(selectedId);
          onSelect(selectedId, item.dataset.name);
        });
      }

      // Download button handler (for remote search results)
      bindDownloadButtons();
    }

    function bindDownloadButtons() {
      for (const dlBtn of listEl.querySelectorAll('.sp-download')) {
        dlBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const styleId = dlBtn.dataset.id;
          dlBtn.textContent = 'Downloading...';
          dlBtn.disabled = true;
          try {
            const res = await chrome.runtime.sendMessage({ action: 'downloadStyle', styleId });
            if (res?.success) {
              styles.push({ id: styleId, name: res.name, group: 'Downloaded', field: 'generic', bundled: false });
              selectedId = styleId;
              label.textContent = res.name;
              dropdown.classList.add('hidden');
              trackRecentStyle(styleId);
              onSelect(styleId, res.name);
            } else {
              dlBtn.textContent = res?.error || 'Not found';
              setTimeout(() => { dlBtn.textContent = dlBtn.dataset.name; dlBtn.disabled = false; }, 2000);
            }
          } catch {
            dlBtn.textContent = 'Download failed';
            setTimeout(() => { dlBtn.textContent = dlBtn.dataset.name; dlBtn.disabled = false; }, 2000);
          }
        });
      }
    }

    async function searchRemote(q) {
      try {
        const res = await chrome.runtime.sendMessage({ action: 'searchRemoteStyles', query: q });
        const container = listEl.querySelector('.sp-remote-results');
        if (!container) return;
        if (!res?.styles?.length) {
          container.innerHTML = `<div class="px-2 py-2 text-[9px] text-zinc-400 text-center">No styles found for "${q}"</div>`;
          return;
        }
        let html = `<div class="px-2 py-0.5 text-[8px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-900/50">Online (${res.styles.length} results)</div>`;
        for (const s of res.styles) {
          // Skip styles already in local list
          if (styles.find(ls => ls.id === s.id)) continue;
          html += `<button class="sp-download w-full text-left px-2.5 py-1 text-[10px] flex items-center justify-between gap-1 hover:bg-saffron-50 dark:hover:bg-saffron-900/10 text-zinc-700 dark:text-zinc-300 transition-colors" data-id="${s.id}" data-name="${s.name}" type="button">
            <span class="truncate">${s.name}</span>
            <span class="text-[8px] px-1 py-0.5 rounded bg-saffron-100 dark:bg-saffron-900/30 text-saffron-600 dark:text-saffron-400 shrink-0">download</span>
          </button>`;
        }
        container.innerHTML = html;
        bindDownloadButtons();
      } catch {
        const container = listEl.querySelector('.sp-remote-results');
        if (container) container.innerHTML = `<div class="px-2 py-2 text-[9px] text-zinc-400 text-center">Search unavailable offline</div>`;
      }
    }

    function itemHtml(s) {
      const active = s.id === selectedId;
      return `<button class="sp-item w-full text-left px-2.5 py-1 text-[10px] flex items-center justify-between gap-1 transition-colors ${active ? 'bg-saffron-50 dark:bg-saffron-900/20 text-saffron-700 dark:text-saffron-400 font-medium' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'}" data-id="${s.id}" data-name="${s.name}" type="button">
        <span class="truncate">${s.name}</span>
        <span class="text-[8px] px-1 py-0.5 rounded shrink-0 ${active ? 'bg-saffron-200 dark:bg-saffron-800 text-saffron-700 dark:text-saffron-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}">${s.field || 'generic'}</span>
      </button>`;
    }

    // Toggle
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = dropdown.classList.contains('hidden');
      // Close any other open pickers first
      document.querySelectorAll('.sp-dropdown').forEach(d => d.classList.add('hidden'));
      if (isHidden) {
        dropdown.classList.remove('hidden');
        searchInput.value = '';
        renderList('');
        searchInput.focus();
      }
    });

    searchInput.addEventListener('input', () => renderList(searchInput.value.trim()));
    searchInput.addEventListener('click', (e) => e.stopPropagation());

    // Close on outside click
    const closeHandler = (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    };
    document.addEventListener('click', closeHandler);

    renderList('');

    return {
      destroy() {
        document.removeEventListener('click', closeHandler);
        wrapper.remove();
      },
      setSelected(id) {
        selectedId = id;
        label.textContent = getName(id);
      },
      getSelectedId() { return selectedId; },
    };
  }

  // Public API
  return {
    resolveStyleFamily,
    formatBib,
    formatBibSync,
    formatIntext,
    formatIntextSync,
    formatBoth,
    getStyles,
    buildStyleOptions,
    populateStyleSelect,
    createStylePicker,
    trackRecentStyle,
  };
})();
