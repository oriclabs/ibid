// Ibid — Side Panel Script

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// State
let parsedEntries = [];
let selectedIds = new Set();
let activeChips = new Set();
let activeTagFilters = new Set();
let allCitations = []; // cache to avoid repeated storage reads
let allTags = []; // tag definitions
const previewPickers = new Map(); // citeId → picker instance

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

for (const btn of $$('.tab-btn')) {
  btn.addEventListener('click', () => {
    for (const b of $$('.tab-btn')) {
      b.classList.remove('active', 'bg-saffron-100', 'dark:bg-saffron-900/30', 'text-saffron-700', 'dark:text-saffron-400');
      b.classList.add('text-zinc-500');
    }
    for (const c of $$('.tab-content')) c.classList.add('hidden');
    btn.classList.add('active', 'bg-saffron-100', 'dark:bg-saffron-900/30', 'text-saffron-700', 'dark:text-saffron-400');
    btn.classList.remove('text-zinc-500');
    $(`#tab-${btn.dataset.tab}`).classList.remove('hidden');
    // Show/hide search bar and bulk bar — only relevant for Library tab
    const isLibrary = btn.dataset.tab === 'library';
    const searchBar = $('#search').closest('.border-b');
    if (searchBar) searchBar.classList.toggle('hidden', !isLibrary);
    $('#bulk-bar').classList.toggle('hidden', !isLibrary || selectedIds.size === 0);
    // Reload data when switching tabs
    if (btn.dataset.tab === 'library') loadCitations();
    if (btn.dataset.tab === 'export') { populateExportProjects(); updateExportCount(); }
    if (btn.dataset.tab === 'import') populateImportProject();
  });
}

// ---------------------------------------------------------------------------
// Library tab — citation list with star, select, edit, delete
// ---------------------------------------------------------------------------

async function loadCitations() {
  const { citations = [], projects = [], tags = [] } = await chrome.storage.local.get(['citations', 'projects', 'tags']);
  allCitations = citations;
  allTags = tags;
  populateProjectFilter(projects);
  renderTagFilters();
  applyFiltersAndRender();
}

function populateProjectFilter(projects) {
  const sel = $('#lib-project-filter');
  const current = sel.value;
  sel.innerHTML = '<option value="all">All Projects</option><option value="default">My Bibliography</option>';
  for (const p of projects) {
    if (p.id === 'default') continue;
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  }
  sel.innerHTML += '<option value="__new__">+ New Project</option>';
  sel.value = current || 'all';
}

function applyFiltersAndRender() {
  let filtered = [...allCitations];

  // Project filter — handle both _projectIds (array) and _project (legacy singular)
  const projectId = $('#lib-project-filter').value;
  if (projectId !== 'all') {
    filtered = filtered.filter(c =>
      c._projectIds?.includes(projectId) ||
      c._project === projectId ||
      (!c._projectIds && !c._project && projectId === 'default')
    );
  }

  // Search filter
  const query = ($('#search').value || '').toLowerCase();
  if (query) {
    filtered = filtered.filter(c =>
      c.title?.toLowerCase().includes(query) ||
      c.author?.some(a => a.family?.toLowerCase().includes(query) || a.given?.toLowerCase().includes(query)) ||
      c.DOI?.toLowerCase().includes(query) ||
      c.type?.toLowerCase().replace(/-/g, ' ').includes(query) ||
      c['container-title']?.toLowerCase().includes(query) ||
      c.keyword?.toLowerCase().includes(query) ||
      c._tags?.some(t => t.toLowerCase().includes(query)) ||
      c._notes?.toLowerCase().includes(query)
    );
  }

  // Chip filters
  if (activeChips.size > 0) {
    filtered = filtered.filter(c => {
      for (const chip of activeChips) {
        if (chip === 'starred') { if (!c._starred) return false; }
        else { if (c.type !== chip) return false; }
      }
      return true;
    });
  }

  // Tag filters
  if (activeTagFilters.size > 0) {
    filtered = filtered.filter(c => {
      const itemTags = c._tags || [];
      for (const tag of activeTagFilters) {
        if (!itemTags.includes(tag)) return false;
      }
      return true;
    });
  }

  // Sort
  const sort = $('#lib-sort').value;
  filtered = sortCitations(filtered, sort);

  // Update count
  $('#lib-count').textContent = `${filtered.length} of ${allCitations.length}`;

  // Show/hide clear button
  const hasFilters = activeChips.size > 0 || activeTagFilters.size > 0 || projectId !== 'all' || query;
  $('#btn-clear-filters').classList.toggle('hidden', !hasFilters);

  renderCitations(filtered);
}

function sortCitations(list, sortKey) {
  return list.sort((a, b) => {
    switch (sortKey) {
      case 'date-desc':
        return (b._dateAdded || '').localeCompare(a._dateAdded || '');
      case 'date-asc':
        return (a._dateAdded || '').localeCompare(b._dateAdded || '');
      case 'author-asc': {
        const aName = a.author?.[0]?.family || a.author?.[0]?.literal || 'zzz';
        const bName = b.author?.[0]?.family || b.author?.[0]?.literal || 'zzz';
        return aName.localeCompare(bName);
      }
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'year-desc': {
        const aY = a.issued?.['date-parts']?.[0]?.[0] || 0;
        const bY = b.issued?.['date-parts']?.[0]?.[0] || 0;
        return bY - aY;
      }
      case 'year-asc': {
        const aY = a.issued?.['date-parts']?.[0]?.[0] || 9999;
        const bY = b.issued?.['date-parts']?.[0]?.[0] || 9999;
        return aY - bY;
      }
      case 'type':
        return (a.type || '').localeCompare(b.type || '');
      default:
        return 0;
    }
  });
}

const RENDER_BATCH = 50; // render 50 at a time for performance
let currentRenderList = [];
let renderOffset = 0;

function renderCitations(citations) {
  const list = $('#citation-list');
  currentRenderList = citations;
  renderOffset = 0;

  if (citations.length === 0) {
    const hasFilters = activeChips.size > 0 || $('#lib-project-filter').value !== 'all' || $('#search').value;
    list.innerHTML = `
      <div class="px-4 py-8 text-center text-zinc-400">
        <p>${hasFilters ? 'No citations match your filters.' : 'No citations yet.'}</p>
        <p class="text-xs mt-1">${hasFilters ? 'Try clearing some filters.' : 'Click the Ibid icon on any page to start citing.'}</p>
      </div>`;
    return;
  }

  const toRender = citations.slice(0, RENDER_BATCH);
  renderOffset = toRender.length;

  list.innerHTML = toRender.map(renderCitationRow).join('');

  // Show more button if needed
  if (citations.length > RENDER_BATCH) {
    list.insertAdjacentHTML('beforeend', `
      <button id="btn-show-more" class="w-full px-4 py-3 text-center text-xs text-saffron-600 dark:text-saffron-400 font-medium hover:bg-saffron-50 dark:hover:bg-saffron-900/10 transition-colors">
        Show ${Math.min(RENDER_BATCH, citations.length - RENDER_BATCH)} more (${citations.length - RENDER_BATCH} remaining)
      </button>
    `);
    $('#btn-show-more').addEventListener('click', showMoreCitations);
  }

  bindCitationEvents();
}

function showMoreCitations() {
  const list = $('#citation-list');
  // Remove show more button
  const btn = $('#btn-show-more');
  if (btn) btn.remove();

  const next = currentRenderList.slice(renderOffset, renderOffset + RENDER_BATCH);
  renderOffset += next.length;

  list.insertAdjacentHTML('beforeend', next.map(renderCitationRow).join(''));

  // Show more again if still more
  if (renderOffset < currentRenderList.length) {
    list.insertAdjacentHTML('beforeend', `
      <button id="btn-show-more" class="w-full px-4 py-3 text-center text-xs text-saffron-600 dark:text-saffron-400 font-medium hover:bg-saffron-50 dark:hover:bg-saffron-900/10 transition-colors">
        Show ${Math.min(RENDER_BATCH, currentRenderList.length - renderOffset)} more (${currentRenderList.length - renderOffset} remaining)
      </button>
    `);
    $('#btn-show-more').addEventListener('click', showMoreCitations);
  }

  bindCitationEvents();
}

function renderCitationRow(item) {
      const authors = (item.author || [])
        .map((a) => a.family || a.literal || '')
        .filter(Boolean)
        .join(', ');
      const year = item.issued?.['date-parts']?.[0]?.[0] || '';
      const typeLabel = (item.type || 'webpage').replace(/-/g, ' ');
      const isSelected = selectedIds.has(item.id);
      const isStarred = item._starred;

      return `
        <div class="citation-row" data-id="${item.id}">
          <div class="px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors ${isSelected ? 'bg-saffron-50 dark:bg-saffron-900/10' : ''}">
            <div class="flex items-start gap-2">
              <input type="checkbox" class="cite-select mt-1 rounded text-saffron-500 focus:ring-saffron-500 shrink-0" data-id="${item.id}" ${isSelected ? 'checked' : ''}>
              <div class="min-w-0 flex-1 btn-preview-toggle" data-id="${item.id}">
                <div class="flex items-center gap-1.5">
                  <span class="text-[9px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase shrink-0">${typeLabel}</span>
                  <p class="font-medium text-sm truncate">${item.title || 'Untitled'}</p>
                </div>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">${authors}${authors && year ? ' (' + year + ')' : year}</p>
                ${(item._tags && item._tags.length) ? `<div class="flex gap-0.5 mt-0.5 flex-wrap">${getCitationTags(item)}</div>` : ''}
              </div>
              <div class="flex items-center gap-0.5 shrink-0">
                ${(item.URL || item.DOI || item._sourceUrl) ? `<button class="btn-visit-source p-1 rounded text-zinc-300 dark:text-zinc-600 hover:text-blue-500 transition-colors" data-url="${item.URL || (item.DOI ? 'https://doi.org/' + item.DOI : '') || item._sourceUrl}" title="Visit source">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>` : ''}
                <button class="btn-edit-cite p-1 rounded text-zinc-300 dark:text-zinc-600 hover:text-saffron-500 transition-colors" data-id="${item.id}" title="Edit">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              <button class="btn-star p-1 rounded transition-colors ${isStarred ? 'text-saffron-500' : 'text-zinc-300 dark:text-zinc-600 hover:text-saffron-400'}" data-id="${item.id}" title="${isStarred ? 'Unstar' : 'Star'}">
                <svg class="w-4 h-4" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>
              </button>
              <button class="btn-delete p-1 rounded text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-colors" data-id="${item.id}" title="Delete">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          </div>
          <!-- Inline preview (hidden, toggles on click) -->
          <div class="cite-preview hidden bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 border-t border-zinc-100 dark:border-zinc-800" data-preview-id="${item.id}">
            <div class="flex items-center gap-2 mb-1.5">
              <div class="preview-style-picker shrink-0" data-id="${item.id}" style="min-width:140px;max-width:180px"></div>
              <span class="text-[9px] text-zinc-400 flex-1">Preview</span>
              <button class="preview-copy-bib text-[9px] text-saffron-600 dark:text-saffron-400 hover:text-saffron-800 font-medium" data-id="${item.id}">Copy Bib</button>
            </div>
            <div class="preview-bib-output text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 mb-1.5 pb-1.5 border-b border-zinc-200 dark:border-zinc-700 select-all"><span class="text-zinc-400 italic">Loading preview...</span></div>
            <div class="flex items-center gap-1.5">
              <span class="text-[8px] text-zinc-400 uppercase tracking-wider shrink-0">In-text</span>
              <div class="inline-flex rounded overflow-hidden border border-zinc-200 dark:border-zinc-600 shrink-0">
                <button class="preview-pn-btn text-[8px] px-1.5 py-0.5 bg-saffron-500 text-white" data-id="${item.id}" data-mode="parenthetical">P</button>
                <button class="preview-pn-btn text-[8px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300" data-id="${item.id}" data-mode="narrative">N</button>
              </div>
              <div class="preview-intext-output text-[11px] text-zinc-500 dark:text-zinc-400 select-all flex-1"><span class="text-zinc-400 italic">...</span></div>
              <button class="preview-copy-intext text-[8px] px-2 py-0.5 rounded bg-saffron-100 dark:bg-saffron-900/30 text-saffron-600 dark:text-saffron-400 hover:bg-saffron-200 dark:hover:bg-saffron-900/50 font-medium shrink-0 transition-colors" data-id="${item.id}">Copy</button>
            </div>
          </div>
        </div>`;
}

function bindCitationEvents() {
  // Star toggle
  for (const btn of $$('.btn-star')) {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = allCitations.find((c) => c.id === id);
      if (item) {
        item._starred = !item._starred;
        await chrome.storage.local.set({ citations: allCitations });
        applyFiltersAndRender();
      }
    });
  }

  // Copy formatted citation
  for (const btn of $$('.btn-copy-cite')) {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = allCitations.find((c) => c.id === id);
      if (!item) return;

      const formatted = await CitationFormatter.formatBib(item, 'apa7') || CitationFormatter.formatBibSync(item, 'apa');
      try {
        await navigator.clipboard.writeText(formatted);
        // Flash the button
        btn.innerHTML = '<svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>';
        setTimeout(() => {
          btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
        }, 1500);
      } catch {}
    });
  }

  // Delete
  for (const btn of $$('.btn-delete')) {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const { citations = [] } = await chrome.storage.local.get(['citations']);
      const item = citations.find(c => c.id === id);
      const title = item?.title || 'this citation';

      const confirmed = await ibidConfirm(
        'Delete Citation',
        `Delete "${title.length > 60 ? title.substring(0, 60) + '...' : title}"?`,
        { confirmText: 'Delete', danger: true }
      );
      if (!confirmed) return;

      const updated = citations.filter((c) => c.id !== id);
      selectedIds.delete(id);
      await chrome.storage.local.set({ citations: updated });
      renderCitations(updated);
      updateBulkBar();
    });
  }

  // Select checkbox
  for (const cb of $$('.cite-select')) {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      if (cb.checked) {
        selectedIds.add(cb.dataset.id);
      } else {
        selectedIds.delete(cb.dataset.id);
      }
      updateBulkBar();
    });
  }

  // Click row to toggle inline preview
  for (const el of $$('.btn-preview-toggle')) {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const preview = $(`[data-preview-id="${id}"]`);
      if (preview) {
        // Close all other previews
        for (const p of $$('.cite-preview')) {
          if (p !== preview) p.classList.add('hidden');
        }
        const wasHidden = preview.classList.contains('hidden');
        preview.classList.toggle('hidden');

        // First open: render via WASM (replaces placeholder)
        if (wasHidden && !preview.dataset.rendered) {
          preview.dataset.rendered = '1';
          const item = allCitations.find(c => c.id === id);
          if (item) {
            const bibEl = preview.querySelector('.preview-bib-output');
            const intextEl = preview.querySelector('.preview-intext-output');
            // Get current style from picker or default
            const picker = previewPickers.get(id);
            const styleId = picker?.getValue?.() || 'apa7';
            CitationFormatter.formatBib(item, styleId, { html: true }).then(bib => {
              if (bibEl) bibEl.innerHTML = bib;
            });
            CitationFormatter.formatIntext(item, styleId, false).then(intext => {
              if (intextEl) intextEl.textContent = intext;
            });
          }
        }
      }
    });
  }

  // Visit source link
  for (const btn of $$('.btn-visit-source')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.dataset.url;
      if (url) chrome.tabs.create({ url });
    });
  }

  // Edit button opens edit panel
  for (const btn of $$('.btn-edit-cite')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditPanel(btn.dataset.id);
    });
  }

  // Clean up old picker instances
  for (const [id, picker] of previewPickers) { picker.destroy(); }
  previewPickers.clear();

  // Initialize searchable style pickers for each inline preview
  for (const container of $$('.preview-style-picker')) {
    const citeId = container.dataset.id;
    CitationFormatter.createStylePicker(container, {
      selectedId: 'apa',
      async onSelect(styleId) {
        const item = allCitations.find(c => c.id === citeId);
        if (!item) return;
        const preview = $(`[data-preview-id="${citeId}"]`);
        if (preview) {
          // Bib: use WASM (hayagriva) for accurate rendering
          const bib = await CitationFormatter.formatBib(item, styleId);
          preview.querySelector('.preview-bib-output').textContent = bib;
          // In-text: respect P/N toggle
          const narrativeBtn = preview.querySelector('.preview-pn-btn[data-mode="narrative"]');
          const isNarrative = narrativeBtn?.classList.contains('bg-saffron-500');
          const intext = await CitationFormatter.formatIntext(item, styleId, isNarrative);
          preview.querySelector('.preview-intext-output').textContent = intext;
        }
      },
    }).then(picker => previewPickers.set(citeId, picker));
  }

  // Preview copy buttons
  for (const btn of $$('.preview-copy-bib')) {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = allCitations.find(c => c.id === id);
      const style = previewPickers.get(id)?.getSelectedId() || 'apa';
      if (item) {
        const copyFormat = $('#sp-pref-copy-format')?.value || 'text';
        if (copyFormat === 'rich') {
          const html = await CitationFormatter.formatBib(item, style, { html: true });
          const text = await CitationFormatter.formatBib(item, style);
          try {
            await navigator.clipboard.write([new ClipboardItem({
              'text/plain': new Blob([text], { type: 'text/plain' }),
              'text/html': new Blob([html], { type: 'text/html' }),
            })]);
          } catch { await navigator.clipboard.writeText(text); }
        } else {
          const text = await CitationFormatter.formatBib(item, style);
          await navigator.clipboard.writeText(text);
        }
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy Bib', 1500);
      }
    });
  }
  for (const btn of $$('.preview-copy-intext')) {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = allCitations.find(c => c.id === id);
      const style = previewPickers.get(id)?.getSelectedId() || 'apa';
      if (item) {
        // Check if narrative mode is active for this preview
        const narrativeBtn = $(`[data-preview-id="${id}"] .preview-pn-btn[data-mode="narrative"]`);
        const isNarrative = narrativeBtn?.classList.contains('bg-saffron-500');
        const text = await CitationFormatter.formatIntext(item, style, isNarrative) || CitationFormatter.formatIntextSync(item, style, isNarrative);
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy In-text', 1500);
      }
    });
  }

  // P/N toggle for inline preview in-text
  for (const btn of $$('.preview-pn-btn')) {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const mode = btn.dataset.mode;
      const item = allCitations.find(c => c.id === id);
      const style = previewPickers.get(id)?.getSelectedId() || 'apa';
      if (!item) return;

      // Toggle button styles
      const preview = $(`[data-preview-id="${id}"]`);
      if (preview) {
        for (const b of preview.querySelectorAll('.preview-pn-btn')) {
          if (b.dataset.mode === mode) {
            b.setAttribute('class', 'preview-pn-btn text-[8px] px-1.5 py-0.5 bg-saffron-500 text-white');
          } else {
            b.setAttribute('class', 'preview-pn-btn text-[8px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300');
          }
        }
        // Re-render in-text: async for parenthetical (WASM), sync for narrative (JS)
        const intext = await CitationFormatter.formatIntext(item, style, mode === 'narrative');
        preview.querySelector('.preview-intext-output').textContent = intext;
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

function updateBulkBar() {
  const bar = $('#bulk-bar');
  if (selectedIds.size > 0) {
    bar.classList.remove('hidden');
    $('#bulk-count').textContent = `${selectedIds.size} selected`;
  } else {
    bar.classList.add('hidden');
  }
}

$('#bulk-star').addEventListener('click', async () => {
  const { citations = [] } = await chrome.storage.local.get(['citations']);
  for (const c of citations) {
    if (selectedIds.has(c.id)) c._starred = true;
  }
  await chrome.storage.local.set({ citations });
  renderCitations(citations);
});

$('#bulk-unstar').addEventListener('click', async () => {
  const { citations = [] } = await chrome.storage.local.get(['citations']);
  for (const c of citations) {
    if (selectedIds.has(c.id)) c._starred = false;
  }
  await chrome.storage.local.set({ citations });
  renderCitations(citations);
});

$('#bulk-delete').addEventListener('click', async () => {
  const ok = await ibidConfirm(
    `Delete ${selectedIds.size} citation${selectedIds.size > 1 ? 's' : ''}?`,
    'This cannot be undone.',
    { confirmText: 'Delete', danger: true }
  );
  if (!ok) return;
  const { citations = [] } = await chrome.storage.local.get(['citations']);
  const updated = citations.filter((c) => !selectedIds.has(c.id));
  selectedIds.clear();
  await chrome.storage.local.set({ citations: updated });
  renderCitations(updated);
  updateBulkBar();
});

$('#bulk-cancel').addEventListener('click', () => {
  selectedIds.clear();
  updateBulkBar();
  loadCitations();
});

// ---------------------------------------------------------------------------
// Inline edit panel
// ---------------------------------------------------------------------------

async function openEditPanel(id) {
  const { citations = [] } = await chrome.storage.local.get(['citations']);
  const item = citations.find((c) => c.id === id);
  if (!item) return;

  $('#edit-id').value = id;
  $('#edit-title').value = item.title || '';
  $('#edit-authors').value = (item.author || [])
    .map((a) => {
      if (a.literal) return a.literal;
      if (a.family && a.given) return `${a.family}, ${a.given}`;
      return a.family || '';
    })
    .filter(Boolean)
    .join('; ');
  $('#edit-date').value = item.issued?.['date-parts']?.[0]?.join('-') || '';
  $('#edit-type').value = item.type || 'webpage';
  $('#edit-container').value = item['container-title'] || '';
  $('#edit-volume').value = item.volume?.toString() || '';
  $('#edit-issue').value = item.issue?.toString() || '';
  $('#edit-pages').value = item.page || '';
  $('#edit-doi').value = item.DOI || item.URL || '';
  $('#edit-tags').value = (item._tags || []).join(', ');
  $('#edit-notes').value = item._notes || '';

  // Populate project selector
  const editProjSel = $('#edit-project');
  const { projects: editProjects = [] } = await chrome.storage.local.get(['projects']);
  editProjSel.innerHTML = '<option value="default">My Bibliography</option>';
  for (const p of editProjects) {
    if (p.id === 'default') continue;
    editProjSel.innerHTML += `<option value="${p.id}">${p.name}</option>`;
  }
  editProjSel.value = item._projectIds?.[0] || item._project || 'default';

  // Quotes
  const quotes = item._quotes || [];
  const quotesSection = $('#edit-quotes-section');
  const quotesList = $('#edit-quotes-list');
  if (quotes.length > 0) {
    quotesSection.classList.remove('hidden');
    quotesList.innerHTML = quotes.map((q, i) => `
      <div class="px-2 py-1.5 rounded bg-zinc-50 dark:bg-zinc-800 text-xs border-l-2 border-saffron-400 flex items-start justify-between gap-1">
        <div class="min-w-0">
          <p class="italic text-zinc-600 dark:text-zinc-300">"${q.text.length > 100 ? q.text.slice(0, 100) + '...' : q.text}"</p>
          <p class="text-[9px] text-zinc-400 mt-0.5">${q.timestamp ? new Date(q.timestamp).toLocaleDateString() : ''}</p>
        </div>
        <button class="btn-delete-quote shrink-0 text-zinc-400 hover:text-red-500" data-index="${i}">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    `).join('');

    // Bind quote delete
    for (const btn of quotesList.querySelectorAll('.btn-delete-quote')) {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.index);
        const { citations = [] } = await chrome.storage.local.get(['citations']);
        const ci = citations.find(c => c.id === id);
        if (ci?._quotes) {
          ci._quotes.splice(idx, 1);
          await chrome.storage.local.set({ citations });
          openEditPanel(id); // refresh
        }
      });
    }
  } else {
    quotesSection.classList.add('hidden');
  }

  $('#edit-panel').classList.remove('hidden');
}

$('#edit-close').addEventListener('click', () => {
  $('#edit-panel').classList.add('hidden');
});

$('#edit-no-date').addEventListener('click', () => {
  $('#edit-date').value = '';
});

$('#edit-panel').addEventListener('click', (e) => {
  if (e.target === $('#edit-panel')) {
    $('#edit-panel').classList.add('hidden');
  }
});

$('#edit-save').addEventListener('click', async () => {
  const id = $('#edit-id').value;
  const { citations = [] } = await chrome.storage.local.get(['citations']);
  const item = citations.find((c) => c.id === id);
  if (!item) return;

  item.title = $('#edit-title').value || undefined;
  item.type = $('#edit-type').value;
  item['container-title'] = $('#edit-container').value || undefined;
  item.page = $('#edit-pages').value || undefined;
  item._dateModified = new Date().toISOString();

  // Parse authors
  const authStr = $('#edit-authors').value.trim();
  if (authStr) {
    item.author = authStr.split(';').map((part) => {
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
  } else {
    item.author = undefined;
  }

  // Parse date
  const dateStr = $('#edit-date').value.trim();
  if (dateStr) {
    const parts = dateStr.split('-').map(Number).filter((n) => !isNaN(n));
    if (parts.length > 0) {
      item.issued = { 'date-parts': [parts] };
    }
  } else {
    item.issued = undefined;
  }

  // Volume/issue
  item.volume = $('#edit-volume').value || undefined;
  item.issue = $('#edit-issue').value || undefined;

  // DOI/URL
  const doiVal = $('#edit-doi').value.trim();
  if (doiVal.match(/^10\./)) {
    item.DOI = doiVal;
    item.URL = `https://doi.org/${doiVal}`;
  } else if (doiVal) {
    item.URL = doiVal;
    item.DOI = undefined;
  } else {
    item.DOI = undefined;
    item.URL = undefined;
  }

  // Tags
  const tagsStr = $('#edit-tags').value.trim();
  item._tags = tagsStr ? [...new Set(tagsStr.split(',').map(t => t.trim()).filter(Boolean))] : undefined;

  // Notes
  const notesStr = $('#edit-notes').value.trim();
  item._notes = notesStr || undefined;

  // Auto-create tags that don't exist yet
  if (item._tags) {
    let tagsChanged = false;
    for (const t of item._tags) {
      if (!allTags.find(td => td.name === t)) {
        allTags.push({ id: crypto.randomUUID(), name: t, color: '#a1a1aa' });
        tagsChanged = true;
      }
    }
    if (tagsChanged) {
      await chrome.storage.local.set({ tags: allTags });
      renderTagFilters();
    }
  }

  // Project
  const editProjVal = $('#edit-project').value;
  item._projectIds = [editProjVal];

  await chrome.storage.local.set({ citations });

  // Show success
  const status = $('#edit-status');
  status.textContent = 'Saved!';
  status.setAttribute('class', 'mt-1.5 text-xs rounded px-3 py-1.5 text-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400');
  setTimeout(() => {
    status.classList.add('hidden');
    $('#edit-panel').classList.add('hidden');
    applyFiltersAndRender();
  }, 800);
});

// Cancel edit
$('#edit-cancel').addEventListener('click', () => {
  $('#edit-panel').classList.add('hidden');
  $('#edit-status').classList.add('hidden');
});

// ---------------------------------------------------------------------------
// Search & filter
// ---------------------------------------------------------------------------

// Search — uses shared filter pipeline
$('#search').addEventListener('input', () => applyFiltersAndRender());

// Sort
$('#lib-sort').addEventListener('change', () => applyFiltersAndRender());

// Project filter
$('#lib-project-filter').addEventListener('change', () => {
  const val = $('#lib-project-filter').value;
  if (val === '__new__') {
    showNewProjectInput();
  } else {
    applyFiltersAndRender();
  }
  updateProjectActions();
});

function updateProjectActions() {
  const val = $('#lib-project-filter').value;
  const showActions = val !== 'all' && val !== 'default' && val !== '__new__';
  $('#project-actions')?.classList.toggle('hidden', !showActions);
}

// Project actions menu
$('#btn-project-actions')?.addEventListener('click', (e) => {
  e.stopPropagation();
  $('#project-actions-menu').classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  const menu = $('#project-actions-menu');
  if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== $('#btn-project-actions')) {
    menu.classList.add('hidden');
  }
});

$('#btn-rename-project')?.addEventListener('click', async () => {
  $('#project-actions-menu').classList.add('hidden');
  const projId = $('#lib-project-filter').value;
  const { projects = [] } = await chrome.storage.local.get(['projects']);
  const proj = projects.find(p => p.id === projId);
  if (!proj) return;

  const sel = $('#lib-project-filter');
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 50;
  input.value = proj.name;
  input.setAttribute('class', sel.getAttribute('class') + ' text-xs');
  sel.parentNode.insertBefore(input, sel);
  sel.classList.add('hidden');
  $('#project-actions').classList.add('hidden');
  input.focus();
  input.select();

  let saved = false;
  async function save() {
    if (saved) return;
    saved = true;
    const name = input.value.trim().substring(0, 50);
    if (input.parentNode) input.remove();
    sel.classList.remove('hidden');
    $('#project-actions').classList.remove('hidden');

    if (name && name !== proj.name) {
      if (projects.some(p => p.id !== projId && p.name.toLowerCase() === name.toLowerCase())) return;
      proj.name = name;
      await chrome.storage.local.set({ projects });
      populateProjectFilter(projects);
      sel.value = projId;
      updateProjectActions();
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') { input.value = proj.name; save(); }
  });
  input.addEventListener('blur', save);
});

$('#btn-delete-project')?.addEventListener('click', async () => {
  $('#project-actions-menu').classList.add('hidden');
  const projId = $('#lib-project-filter').value;
  const { projects = [] } = await chrome.storage.local.get(['projects']);
  const proj = projects.find(p => p.id === projId);
  if (!proj) return;

  const { citations = [] } = await chrome.storage.local.get(['citations']);
  const affectedCount = citations.filter(c =>
    c._projectIds?.includes(projId) || c._project === projId
  ).length;

  const message = affectedCount > 0
    ? `Delete "${proj.name}"? ${affectedCount} citation${affectedCount !== 1 ? 's' : ''} will be moved to My Bibliography.`
    : `Delete "${proj.name}"? This project has no citations.`;

  const confirmed = await ibidConfirm(
    'Delete Project',
    message,
    { confirmText: 'Delete', danger: true }
  );
  if (!confirmed) return;
  for (const c of citations) {
    if (c._projectIds?.includes(projId)) {
      c._projectIds = c._projectIds.filter(id => id !== projId);
      if (c._projectIds.length === 0) c._projectIds = ['default'];
    }
    if (c._project === projId) c._project = 'default';
  }

  // Remove project
  const updated = projects.filter(p => p.id !== projId);
  await chrome.storage.local.set({ projects: updated, citations });

  populateProjectFilter(updated);
  $('#lib-project-filter').value = 'all';
  $('#project-actions').classList.add('hidden');
  applyFiltersAndRender();
});

function showNewProjectInput() {
  const sel = $('#lib-project-filter');
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 50;
  input.placeholder = 'Project name...';
  input.setAttribute('class', sel.getAttribute('class') + ' text-xs');
  sel.parentNode.insertBefore(input, sel);
  sel.classList.add('hidden');
  input.focus();

  let saved = false;
  async function save() {
    if (saved) return;
    saved = true;
    const name = input.value.trim().substring(0, 50);
    if (input.parentNode) input.remove();
    sel.classList.remove('hidden');

    if (!name) {
      sel.value = 'all';
      applyFiltersAndRender();
      return;
    }

    const { projects = [] } = await chrome.storage.local.get(['projects']);
    if (projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      sel.value = 'all';
      applyFiltersAndRender();
      return;
    }

    const id = 'proj_' + Date.now();
    projects.push({ id, name, defaultStyle: 'apa' });
    await chrome.storage.local.set({ projects });
    populateProjectFilter(projects);
    sel.value = id;
    applyFiltersAndRender();
    updateProjectActions();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') { input.value = ''; save(); }
  });
  input.addEventListener('blur', save);
}

// Filter chips — toggle on click
for (const chip of $$('.lib-chip')) {
  chip.addEventListener('click', () => {
    const val = chip.dataset.chip;
    if (activeChips.has(val)) {
      activeChips.delete(val);
      chip.classList.remove('bg-saffron-100', 'dark:bg-saffron-900/30', 'border-saffron-400', 'text-saffron-600');
      chip.classList.add('border-zinc-200', 'dark:border-zinc-700', 'text-zinc-400');
    } else {
      activeChips.add(val);
      chip.classList.add('bg-saffron-100', 'dark:bg-saffron-900/30', 'border-saffron-400', 'text-saffron-600');
      chip.classList.remove('border-zinc-200', 'dark:border-zinc-700', 'text-zinc-400');
    }
    applyFiltersAndRender();
  });
}

// Clear all filters
$('#btn-clear-filters').addEventListener('click', () => {
  activeChips.clear();
  activeTagFilters.clear();
  for (const chip of $$('.lib-chip')) {
    chip.classList.remove('bg-saffron-100', 'dark:bg-saffron-900/30', 'border-saffron-400', 'text-saffron-600');
    chip.classList.add('border-zinc-200', 'dark:border-zinc-700', 'text-zinc-400');
  }
  $('#search').value = '';
  $('#lib-project-filter').value = 'all';
  renderTagFilters();
  applyFiltersAndRender();
});

// ---------------------------------------------------------------------------
// Import tab
// ---------------------------------------------------------------------------

const dropZone = $('#drop-zone');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('border-saffron-400', 'bg-saffron-50', 'dark:bg-saffron-900/10');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('border-saffron-400', 'bg-saffron-50', 'dark:bg-saffron-900/10');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('border-saffron-400', 'bg-saffron-50', 'dark:bg-saffron-900/10');
  for (const file of Array.from(e.dataTransfer.files)) {
    const text = await file.text();
    await parseAndPreview(text, detectFormatFromFilename(file.name));
  }
});

$('#btn-browse').addEventListener('click', () => $('#file-input').click());
$('#file-input').addEventListener('change', async (e) => {
  for (const file of Array.from(e.target.files)) {
    const text = await file.text();
    await parseAndPreview(text, detectFormatFromFilename(file.name));
  }
  e.target.value = '';
});

$('#btn-parse').addEventListener('click', async () => {
  const text = $('#import-text').value.trim();
  if (text) await parseAndPreview(text, 'auto');
});

$('#btn-select-all').addEventListener('click', () => {
  for (const cb of $$('.import-checkbox')) cb.checked = true;
});
$('#btn-select-none').addEventListener('click', () => {
  for (const cb of $$('.import-checkbox')) cb.checked = false;
});
$('#btn-import-selected').addEventListener('click', importSelected);
$('#btn-import-cancel').addEventListener('click', () => {
  resetImportForm();
  showImportStatus('', '');
  $('#import-status').classList.add('hidden');
});

function detectFormatFromFilename(name) {
  const n = name.toLowerCase();
  if (n.endsWith('.bib') || n.endsWith('.bibtex')) return 'bibtex';
  if (n.endsWith('.ris') || n.endsWith('.enw')) return 'ris';
  if (n.endsWith('.json')) return 'json';
  if (n.endsWith('.xml')) return 'endnote-xml';
  if (n.endsWith('.nbib') || n.endsWith('.medline')) return 'medline';
  if (n.endsWith('.csv')) return 'csv';
  if (n.endsWith('.tsv')) return 'tsv';
  return 'auto';
}

async function parseAndPreview(text, format) {
  showImportStatus('info', 'Parsing...');
  try {
    const res = await chrome.runtime.sendMessage({ action: 'parseImport', text, format });
    if (res?.error) { showImportStatus('error', res.error); return; }

    parsedEntries = res.entries || [];
    const errCount = (res.errors || []).length;
    if (parsedEntries.length === 0) {
      showImportStatus('error', `No entries found.${errCount ? ` ${errCount} error(s).` : ''}`);
      return;
    }

    // If entries are DOI/ISBN placeholders, resolve them
    if (res._doiList && parsedEntries.some(e => e._needsEnhance)) {
      showImportStatus('info', `Resolving ${parsedEntries.length} identifier(s)...`);
      const resolved = [];
      for (let i = 0; i < parsedEntries.length; i++) {
        const identifier = parsedEntries[i].DOI || parsedEntries[i].ISBN;
        try {
          const r = await chrome.runtime.sendMessage({ action: 'resolve', identifier });
          if (r?.resolved) {
            resolved.push({ id: identifier, ...r.resolved, DOI: parsedEntries[i].DOI, ISBN: parsedEntries[i].ISBN });
          } else {
            resolved.push(parsedEntries[i]); // keep placeholder
          }
        } catch {
          resolved.push(parsedEntries[i]);
        }
        // Rate limit
        if (i < parsedEntries.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
      parsedEntries = resolved;
    }

    showImportStatus('success', `Parsed ${parsedEntries.length} entr${parsedEntries.length === 1 ? 'y' : 'ies'}${errCount ? `, ${errCount} error(s)` : ''}`);
    renderPreviewList(parsedEntries);
  } catch (err) {
    showImportStatus('error', `Parse failed: ${err.message}`);
  }
}

function renderPreviewList(entries) {
  $('#import-preview').classList.remove('hidden');
  $('#preview-count').textContent = entries.length;
  $('#preview-list').innerHTML = entries
    .map((item, i) => {
      const authors = (item.author || []).map((a) => a.family || a.literal || '').filter(Boolean).join(', ');
      const year = item.issued?.['date-parts']?.[0]?.[0] || '';
      const typeLabel = (item.type || 'document').replace(/-/g, ' ');
      const doi = item.DOI || item.doi || '';
      const doiLink = doi ? `<a href="https://doi.org/${doi}" target="_blank" class="text-[9px] text-saffron-500 hover:text-saffron-700 truncate block" title="${doi}">doi:${doi}</a>` : '';
      return `
        <label class="flex items-start gap-2 px-2 py-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
          <input type="checkbox" class="import-checkbox mt-0.5 rounded text-saffron-500 focus:ring-saffron-500" data-index="${i}" checked>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate">${item.title || 'Untitled'}</p>
            <p class="text-[10px] text-zinc-500 truncate"><span class="uppercase bg-zinc-100 dark:bg-zinc-800 px-1 rounded">${typeLabel}</span> ${authors}${year ? ` (${year})` : ''}</p>
            ${doiLink}
          </div>
        </label>`;
    })
    .join('');
}

async function importSelected() {
  const indices = Array.from($$('.import-checkbox:checked')).map((cb) => parseInt(cb.dataset.index));
  if (indices.length === 0) { showImportStatus('error', 'No entries selected.'); return; }

  const importProjectId = $('#import-project')?.value || 'default';
  const toImport = indices.map((i) => ({
    ...parsedEntries[i],
    id: parsedEntries[i].id || crypto.randomUUID(),
    _dateAdded: new Date().toISOString(),
    _importSource: 'import',
    _projectIds: [importProjectId],
  }));

  const { citations = [] } = await chrome.storage.local.get(['citations']);

  // Duplicate detection
  let dupCount = 0;
  const newItems = [];
  for (const item of toImport) {
    const dup = findDuplicate(item, citations);
    if (dup) {
      dupCount++;
    } else {
      newItems.push(item);
    }
  }

  if (newItems.length === 0 && dupCount > 0) {
    showImportStatus('info', `All ${dupCount} entries are duplicates. Nothing imported.`);
    resetImportForm();
    return;
  }

  citations.push(...newItems);
  await chrome.storage.local.set({ citations });

  const dupMsg = dupCount > 0 ? `, ${dupCount} duplicate${dupCount > 1 ? 's' : ''} skipped` : '';
  showImportStatus('success', `Imported ${newItems.length} entr${newItems.length === 1 ? 'y' : 'ies'}${dupMsg}.`);
  resetImportForm();
  loadCitations();
}

function findDuplicate(newItem, existing) {
  for (const ex of existing) {
    if (newItem.DOI && ex.DOI && newItem.DOI.toLowerCase() === ex.DOI.toLowerCase()) return ex;
    if (newItem.ISBN && ex.ISBN && newItem.ISBN.replace(/[-\s]/g, '') === ex.ISBN.replace(/[-\s]/g, '')) return ex;
    if (newItem.title && ex.title) {
      const a = newItem.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const b = ex.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (a.length > 10 && a === b) return ex;
    }
  }
  return null;
}

function resetImportForm() {
  parsedEntries = [];
  $('#import-preview').classList.add('hidden');
  $('#import-text').value = '';
  $('#preview-list').innerHTML = '';
}

function showImportStatus(type, message) {
  const el = $('#import-status');
  el.classList.remove('hidden');
  const colors = {
    success: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
    error: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
    info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  };
  el.className = `text-xs rounded px-3 py-2 ${colors[type] || colors.info}`;
  el.textContent = message;
}

// ---------------------------------------------------------------------------
// Migration wizard
$('#btn-migration-toggle')?.addEventListener('click', () => {
  $('#migration-panel').classList.toggle('hidden');
  $('#migration-chevron').classList.toggle('rotate-180');
});

const MIGRATION_INSTRUCTIONS = {
  zotero: {
    title: 'Import from Zotero',
    steps: [
      'Open Zotero desktop app',
      'Select the library or collection you want to export',
      'Go to File → Export Library (or right-click → Export Collection)',
      'Choose format: <strong>BibTeX</strong> or <strong>CSL JSON</strong>',
      'Click OK and save the file',
      'Drag the saved file onto the drop zone above, or click "browse files"',
    ],
  },
  mendeley: {
    title: 'Import from Mendeley',
    steps: [
      'Open Mendeley Desktop or Mendeley Reference Manager',
      'Select the references you want to export',
      'Go to File → Export (or Tools → Export)',
      'Choose format: <strong>BibTeX (.bib)</strong> or <strong>RIS (.ris)</strong>',
      'Save the file',
      'Drag the saved file onto the drop zone above',
    ],
  },
  endnote: {
    title: 'Import from EndNote',
    steps: [
      'Open EndNote',
      'Select the references you want to export',
      'Go to File → Export',
      'Choose Output style: <strong>Show All Fields</strong>',
      'Save as: <strong>XML (*.xml)</strong> or <strong>RIS</strong>',
      'Drag the saved file onto the drop zone above',
      '<em>Tip: XML export preserves the most data</em>',
    ],
  },
};

for (const btn of $$('.migrate-btn')) {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    const info = MIGRATION_INSTRUCTIONS[tool];
    const el = $('#migration-instructions');
    el.classList.remove('hidden');
    el.innerHTML = `
      <p class="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">${info.title}</p>
      <ol class="list-decimal list-inside space-y-0.5">
        ${info.steps.map(s => `<li>${s}</li>`).join('')}
      </ol>
    `;
  });
}

// Export tab
// ---------------------------------------------------------------------------

$('#export-format').addEventListener('change', () => {
  const fmt = $('#export-format').value;
  $('#export-bibtex-opts').classList.toggle('hidden', fmt !== 'bibtex');
  $('#export-style-picker').classList.toggle('hidden', !['text', 'html', 'markdown'].includes(fmt));
  updateExportCount();
});
$('#export-scope').addEventListener('change', updateExportCount);
$('#export-project').addEventListener('change', updateExportCount);

async function updateExportCount() {
  const items = await getExportItems();
  $('#export-count').textContent = `${items.length} citation${items.length !== 1 ? 's' : ''} will be exported`;
}

function populateImportProject() {
  const sel = $('#import-project');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="default">My Bibliography</option>';
  chrome.storage.local.get(['projects']).then(({ projects = [] }) => {
    for (const p of projects) {
      if (p.id === 'default') continue;
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    }
    sel.value = current || 'default';
  });
}

function populateExportProjects() {
  const sel = $('#export-project');
  const current = sel.value;
  sel.innerHTML = '<option value="all">All Projects</option><option value="default">My Bibliography</option>';
  // Reuse projects from storage
  chrome.storage.local.get(['projects']).then(({ projects = [] }) => {
    for (const p of projects) {
      if (p.id === 'default') continue;
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    }
    sel.value = current || 'all';
  });
}

async function getExportItems() {
  // Use cached allCitations first, fall back to storage
  let citations = allCitations;
  if (!citations || citations.length === 0) {
    const stored = await chrome.storage.local.get(['citations']);
    citations = stored.citations || [];
  }

  // Apply project filter
  const projectId = $('#export-project').value;
  if (projectId !== 'all') {
    citations = citations.filter(c =>
      c._projectIds?.includes(projectId) ||
      c._project === projectId ||
      (!c._projectIds && !c._project && projectId === 'default')
    );
  }

  // Apply scope filter
  const scope = $('#export-scope').value;
  if (scope === 'starred') {
    citations = citations.filter(c => c._starred);
  } else if (scope !== 'all') {
    // Type filter (article-journal, book, webpage)
    citations = citations.filter(c => c.type === scope);
  }

  return citations;
}

$('#btn-export-download').addEventListener('click', async () => {
  const items = await getExportItems();
  if (items.length === 0) { showExportStatus('error', 'No citations to export.'); return; }
  const format = $('#export-format').value;
  const options = {
    includeAbstract: $('#export-opt-abstract')?.checked || false,
    includeKeywords: $('#export-opt-keywords')?.checked || true,
  };
  try {
    const res = await chrome.runtime.sendMessage({ action: 'export', items, format, options, styleId: $('#export-style')?.value || 'apa7' });
    if (res?.error) { showExportStatus('error', res.error); return; }
    const blob = new Blob([res.data], { type: res.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
    showExportStatus('success', `Exported ${items.length} citation${items.length !== 1 ? 's' : ''}`);
  } catch (err) {
    showExportStatus('error', `Export failed: ${err.message}`);
  }
});

$('#btn-export-copy').addEventListener('click', async () => {
  const items = await getExportItems();
  if (items.length === 0) { showExportStatus('error', 'No citations to copy.'); return; }
  const format = $('#export-format').value;
  const options = {
    includeAbstract: $('#export-opt-abstract')?.checked || false,
    includeKeywords: $('#export-opt-keywords')?.checked || true,
  };
  try {
    const res = await chrome.runtime.sendMessage({ action: 'export', items, format, options, styleId: $('#export-style')?.value || 'apa7' });
    if (res?.error) { showExportStatus('error', res.error); return; }
    await navigator.clipboard.writeText(res.data);
    showExportStatus('success', 'Copied to clipboard!');
  } catch (err) {
    showExportStatus('error', `Copy failed: ${err.message}`);
  }
});

function showExportStatus(type, message) {
  const el = $('#export-status');
  el.classList.remove('hidden');
  const colors = {
    success: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
    error: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  };
  el.className = `text-xs rounded px-3 py-2 ${colors[type] || colors.success}`;
  el.textContent = message;
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

function renderTagFilters() {
  const row = $('#tag-filter-row');
  const chips = $('#tag-chips');

  if (allTags.length === 0) {
    row.classList.add('hidden');
    return;
  }

  row.classList.remove('hidden');
  chips.innerHTML = allTags.map(t => {
    const active = activeTagFilters.has(t.name);
    return `<button class="tag-filter-chip px-1.5 py-0.5 rounded-full text-[9px] font-medium border transition-colors ${active ? 'border-saffron-400 text-saffron-600 bg-saffron-100 dark:bg-saffron-900/30' : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-saffron-400 hover:text-saffron-500'}" data-tag="${t.name}" style="${t.color ? `border-color:${active ? t.color : ''};color:${active ? t.color : ''}` : ''}">${t.name}</button>`;
  }).join('');

  for (const btn of chips.querySelectorAll('.tag-filter-chip')) {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (activeTagFilters.has(tag)) activeTagFilters.delete(tag);
      else activeTagFilters.add(tag);
      renderTagFilters();
      applyFiltersAndRender();
    });
  }
}

// Tag management modal
$('#btn-manage-tags')?.addEventListener('click', () => {
  $('#tag-modal').classList.remove('hidden');
  renderTagList();
});
$('#tag-modal-close')?.addEventListener('click', () => $('#tag-modal').classList.add('hidden'));
$('#tag-modal')?.addEventListener('click', (e) => {
  if (e.target === $('#tag-modal')) $('#tag-modal').classList.add('hidden');
});

$('#btn-add-tag')?.addEventListener('click', async () => {
  const name = $('#new-tag-name').value.trim();
  if (!name) return;
  const color = $('#new-tag-color').value;
  if (allTags.find(t => t.name === name)) return; // duplicate

  allTags.push({ id: crypto.randomUUID(), name, color });
  await chrome.storage.local.set({ tags: allTags });
  $('#new-tag-name').value = '';
  renderTagList();
  renderTagFilters();
});

$('#new-tag-name')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#btn-add-tag').click();
});

function renderTagList() {
  const list = $('#tag-list');
  if (allTags.length === 0) {
    list.innerHTML = '<p class="text-xs text-zinc-400 text-center py-2">No tags yet</p>';
    return;
  }
  list.innerHTML = allTags.map(t => `
    <div class="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full shrink-0" style="background:${t.color || '#a1a1aa'}"></span>
        <span class="text-xs">${t.name}</span>
      </div>
      <button class="btn-delete-tag text-zinc-400 hover:text-red-500 transition-colors" data-id="${t.id}">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  `).join('');

  for (const btn of list.querySelectorAll('.btn-delete-tag')) {
    btn.addEventListener('click', async () => {
      allTags = allTags.filter(t => t.id !== btn.dataset.id);
      await chrome.storage.local.set({ tags: allTags });
      renderTagList();
      renderTagFilters();
    });
  }
}

// Update edit panel to handle tags
const origOpenEditPanel = openEditPanel;

// Add tags to citation row display
function getCitationTags(item) {
  return (item._tags || []).map(t => {
    const tagDef = allTags.find(td => td.name === t);
    const color = tagDef?.color || '#a1a1aa';
    return `<span class="text-[8px] px-1 py-0.5 rounded" style="background:${color}20;color:${color}">${t}</span>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Duplicate scan and merge
// ---------------------------------------------------------------------------

$('#btn-find-dupes')?.addEventListener('click', () => {
  $('#dupe-modal').classList.remove('hidden');
  scanDuplicates();
});
$('#dupe-modal-close')?.addEventListener('click', () => $('#dupe-modal').classList.add('hidden'));
$('#dupe-modal')?.addEventListener('click', (e) => {
  if (e.target === $('#dupe-modal')) $('#dupe-modal').classList.add('hidden');
});

function normalizeForDupe(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function scanDuplicates() {
  const content = $('#dupe-content');
  const groups = [];

  for (let i = 0; i < allCitations.length; i++) {
    for (let j = i + 1; j < allCitations.length; j++) {
      const a = allCitations[i], b = allCitations[j];
      let reason = null;

      if (a.DOI && b.DOI && a.DOI.toLowerCase() === b.DOI.toLowerCase()) {
        reason = 'Same DOI';
      } else if (a.ISBN && b.ISBN && a.ISBN.replace(/[-\s]/g, '') === b.ISBN.replace(/[-\s]/g, '')) {
        reason = 'Same ISBN';
      } else if (a.title && b.title) {
        const na = normalizeForDupe(a.title), nb = normalizeForDupe(b.title);
        if (na.length > 15 && na === nb) reason = 'Same title';
      }

      if (reason) {
        // Check if already in a group
        const existing = groups.find(g => g.ids.has(a.id) || g.ids.has(b.id));
        if (existing) {
          existing.ids.add(a.id);
          existing.ids.add(b.id);
          if (!existing.items.find(x => x.id === a.id)) existing.items.push(a);
          if (!existing.items.find(x => x.id === b.id)) existing.items.push(b);
        } else {
          groups.push({ reason, ids: new Set([a.id, b.id]), items: [a, b] });
        }
      }
    }
  }

  if (groups.length === 0) {
    content.innerHTML = `
      <div class="text-center py-6">
        <svg class="w-10 h-10 mx-auto text-emerald-400 mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p class="text-sm font-medium text-emerald-600">No duplicates found</p>
        <p class="text-xs text-zinc-400 mt-1">${allCitations.length} citations scanned</p>
      </div>`;
    return;
  }

  content.innerHTML = `
    <p class="text-xs text-zinc-500 mb-3">${groups.length} duplicate group${groups.length > 1 ? 's' : ''} found</p>
    ${groups.map((g, gi) => `
      <div class="mb-4 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
        <div class="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/10 text-[10px] font-medium text-amber-700 dark:text-amber-400 flex items-center justify-between">
          <span>Group ${gi + 1}: ${g.reason} (${g.items.length} items)</span>
          <button class="btn-merge-group text-[10px] px-2 py-0.5 rounded bg-saffron-500 text-white hover:bg-saffron-600" data-group="${gi}">Keep Best & Merge</button>
        </div>
        ${g.items.map((item, ii) => {
          const authors = (item.author || []).map(a => a.family || a.literal || '').filter(Boolean).join(', ');
          const year = item.issued?.['date-parts']?.[0]?.[0] || '';
          const fields = [item.title, authors, year, item['container-title'], item.DOI, item.URL].filter(Boolean).length;
          return `
            <div class="px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 flex items-start gap-2 ${ii === 0 ? 'bg-emerald-50/50 dark:bg-emerald-900/5' : ''}">
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium truncate">${item.title || 'Untitled'}</p>
                <p class="text-[10px] text-zinc-500 truncate">${authors}${year ? ` (${year})` : ''}</p>
                <p class="text-[10px] text-zinc-400">${fields}/6 fields filled${ii === 0 ? ' — will keep' : ''}</p>
              </div>
              ${ii > 0 ? `<button class="btn-delete-dupe text-[10px] px-1.5 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50" data-id="${item.id}">Remove</button>` : ''}
            </div>`;
        }).join('')}
      </div>
    `).join('')}
  `;

  // Bind merge buttons
  for (const btn of content.querySelectorAll('.btn-merge-group')) {
    btn.addEventListener('click', async () => {
      const gi = parseInt(btn.dataset.group);
      const group = groups[gi];
      // Keep the first item (most fields), delete the rest
      const keepId = group.items[0].id;
      const removeIds = group.items.slice(1).map(i => i.id);
      allCitations = allCitations.filter(c => !removeIds.includes(c.id));
      await chrome.storage.local.set({ citations: allCitations });
      applyFiltersAndRender();
      scanDuplicates(); // re-scan
    });
  }

  // Bind individual delete buttons
  for (const btn of content.querySelectorAll('.btn-delete-dupe')) {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      allCitations = allCitations.filter(c => c.id !== id);
      await chrome.storage.local.set({ citations: allCitations });
      applyFiltersAndRender();
      scanDuplicates();
    });
  }
}

// ---------------------------------------------------------------------------
// Format citation for copy (uses default toolbar style)
// ---------------------------------------------------------------------------

// Init
// ---------------------------------------------------------------------------

loadCitations();
updateExportCount();
initSidepanelSettings();
initManualEntry();
checkBulkImport();

chrome.storage.onChanged.addListener((changes) => {
  if (changes.citations) {
    allCitations = changes.citations.newValue || [];
    applyFiltersAndRender();
    updateExportCount();
  }
  if (changes.tags) {
    allTags = changes.tags.newValue || [];
    renderTagFilters();
  }
  if (changes.projects) {
    populateProjectFilter(changes.projects.newValue || []);
    updateProjectActions();
  }
  // Sync theme from popup settings
  if (changes.theme) {
    const newTheme = changes.theme.newValue || 'system';
    applyTheme(newTheme);
    const themePicker = document.querySelector('#sp-pref-theme');
    if (themePicker) themePicker.value = newTheme;
  }
});

// Listen for bulk import data arriving (when sidepanel is already open)
chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.ibid_bulk_import?.newValue) {
    const data = changes.ibid_bulk_import.newValue;
    // Check if it's a loading signal or actual data
    try {
      const parsed = JSON.parse(data);
      if (parsed._loading) {
        // Show loading state — switch to import tab with spinner
        _showBulkLoading(parsed.count);
        return; // don't consume — wait for actual data
      }
    } catch {}
    // Actual data arrived
    chrome.storage.session.remove(['ibid_bulk_import']);
    _processBulkImport(data);
  }
});

// ---------------------------------------------------------------------------
// Sidepanel settings
// ---------------------------------------------------------------------------

async function initSidepanelSettings() {
  // Load saved preferences
  const prefs = await chrome.storage.local.get(['spDefaultSort', 'spCopyFormat', 'spTheme', 'theme']);

  if (prefs.spDefaultSort) {
    $('#sp-pref-sort').value = prefs.spDefaultSort;
    $('#lib-sort').value = prefs.spDefaultSort;
  }
  if (prefs.spCopyFormat) {
    $('#sp-pref-copy-format').value = prefs.spCopyFormat;
  }
  // Theme: use sidepanel's own preference, or fall back to popup's global theme
  const activeTheme = prefs.spTheme || prefs.theme || 'system';
  $('#sp-pref-theme').value = activeTheme;
  applyTheme(activeTheme);

  // Toggle dropdown
  $('#sp-settings-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#sp-settings-dropdown').classList.toggle('hidden');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    const dd = $('#sp-settings-dropdown');
    if (!dd.classList.contains('hidden') && !dd.contains(e.target) && e.target !== $('#sp-settings-btn')) {
      dd.classList.add('hidden');
    }
  });

  // Default sort
  $('#sp-pref-sort').addEventListener('change', (e) => {
    const val = e.target.value;
    chrome.storage.local.set({ spDefaultSort: val });
    $('#lib-sort').value = val;
    applyFiltersAndRender();
  });

  // Copy format
  $('#sp-pref-copy-format').addEventListener('change', (e) => {
    chrome.storage.local.set({ spCopyFormat: e.target.value });
  });

  // Theme
  $('#sp-pref-theme').addEventListener('change', (e) => {
    const val = e.target.value;
    chrome.storage.local.set({ spTheme: val, theme: val }); // sync both keys
    applyTheme(val);
  });

  // Open full options page
  $('#sp-open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    $('#sp-settings-dropdown').classList.add('hidden');
  });
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (theme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    // System
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}

// ---------------------------------------------------------------------------
// Manual entry
// ---------------------------------------------------------------------------

function initManualEntry() {
  $('#btn-add-manual').addEventListener('click', () => {
    const form = $('#manual-entry-form');
    const opening = form.classList.contains('hidden');
    form.classList.toggle('hidden');
    const btn = $('#btn-add-manual');
    if (opening) {
      btn.setAttribute('class', 'p-1 rounded border border-saffron-300 dark:border-saffron-700 bg-saffron-100 dark:bg-saffron-900/30 text-saffron-500 transition-colors shrink-0');
    } else {
      btn.setAttribute('class', 'p-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-saffron-600 hover:border-saffron-400 transition-colors shrink-0');
    }
  });

  $('#btn-cancel-manual').addEventListener('click', () => {
    $('#manual-entry-form').classList.add('hidden');
    $('#btn-add-manual').setAttribute('class', 'p-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-saffron-600 hover:border-saffron-400 transition-colors shrink-0');
    clearManualForm();
  });

  // Enhance from DOI
  $('#btn-enhance-manual').addEventListener('click', async () => {
    const doiOrUrl = $('#manual-doi').value.trim();
    if (!doiOrUrl) return;
    $('#btn-enhance-manual').textContent = '...';
    try {
      const res = await chrome.runtime.sendMessage({ action: 'resolve', identifier: doiOrUrl });
      if (res?.resolved) {
        const r = res.resolved;
        if (r.title && !$('#manual-title').value) $('#manual-title').value = r.title;
        if (r.author?.length && !$('#manual-authors').value) {
          $('#manual-authors').value = r.author.map(a =>
            a.literal || `${a.family || ''}, ${a.given || ''}`.trim()
          ).join('; ');
        }
        if (r.issued?.['date-parts']?.[0]?.[0] && !$('#manual-year').value) {
          $('#manual-year').value = r.issued['date-parts'][0][0];
        }
        if (r['container-title'] && !$('#manual-container').value) {
          $('#manual-container').value = r['container-title'];
        }
        if (r.volume && !$('#manual-volume').value) $('#manual-volume').value = r.volume;
        if (r.issue && !$('#manual-issue').value) $('#manual-issue').value = r.issue;
        if (r.page && !$('#manual-pages').value) $('#manual-pages').value = r.page;
        if (r.publisher && !$('#manual-publisher').value) $('#manual-publisher').value = r.publisher;
        if (r.type) $('#manual-type').value = r.type;
      }
    } catch {}
    $('#btn-enhance-manual').textContent = 'Enhance';
  });

  // Save
  $('#btn-save-manual').addEventListener('click', async () => {
    const title = $('#manual-title').value.trim();
    if (!title) { $('#manual-title').focus(); return; }

    const item = {
      id: crypto.randomUUID(),
      type: $('#manual-type').value,
      title,
      'container-title': $('#manual-container').value.trim() || undefined,
      volume: $('#manual-volume').value.trim() || undefined,
      issue: $('#manual-issue').value.trim() || undefined,
      page: $('#manual-pages').value.trim() || undefined,
      publisher: $('#manual-publisher').value.trim() || undefined,
      _addedAt: new Date().toISOString(),
      _projectIds: ['default'],
    };

    // Parse authors
    const authorsStr = $('#manual-authors').value.trim();
    if (authorsStr) {
      item.author = authorsStr.split(';').map(a => {
        a = a.trim();
        if (a.includes(',')) {
          const [family, given] = a.split(',', 2).map(s => s.trim());
          return { family, given };
        }
        const parts = a.split(/\s+/);
        if (parts.length === 1) return { literal: parts[0] };
        const family = parts.pop();
        return { family, given: parts.join(' ') };
      });
    }

    // Parse year
    const year = $('#manual-year').value.trim();
    if (year) {
      const y = parseInt(year, 10);
      if (!isNaN(y)) item.issued = { 'date-parts': [[y]] };
    }

    // DOI or URL
    const doiOrUrl = $('#manual-doi').value.trim();
    if (doiOrUrl) {
      if (doiOrUrl.match(/^10\.\d{4,}/)) {
        item.DOI = doiOrUrl;
      } else if (doiOrUrl.startsWith('http')) {
        item.URL = doiOrUrl;
      } else {
        item.DOI = doiOrUrl;
      }
    }

    // Save
    const { citations = [] } = await chrome.storage.local.get(['citations']);
    citations.push(item);
    await chrome.storage.local.set({ citations });

    // Done
    $('#manual-entry-form').classList.add('hidden');
    $('#btn-add-manual').setAttribute('class', 'p-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-saffron-600 hover:border-saffron-400 transition-colors shrink-0');
    clearManualForm();
  });
}

async function checkBulkImport() {
  const { ibid_bulk_import } = await chrome.storage.session.get(['ibid_bulk_import']);
  if (!ibid_bulk_import) return;
  // Check if still loading
  try {
    const parsed = JSON.parse(ibid_bulk_import);
    if (parsed._loading) {
      _showBulkLoading(parsed.count);
      return; // storage listener will pick up the real data
    }
  } catch {}
  await chrome.storage.session.remove(['ibid_bulk_import']);
  await _processBulkImport(ibid_bulk_import);
}

function _showBulkLoading(count) {
  // Switch to import tab
  for (const b of $$('.tab-btn')) b.classList.remove('active', 'bg-saffron-100', 'dark:bg-saffron-900/30', 'text-saffron-700', 'dark:text-saffron-400');
  $('[data-tab="import"]')?.classList.add('active', 'bg-saffron-100', 'dark:bg-saffron-900/30', 'text-saffron-700', 'dark:text-saffron-400');
  for (const tc of $$('.tab-content')) tc.classList.add('hidden');
  $('#tab-import')?.classList.remove('hidden');
  const searchBar = $('#search')?.closest('.border-b');
  if (searchBar) searchBar.classList.add('hidden');
  showImportStatus('info', `Resolving ${count} DOI(s) via CrossRef... Please wait.`);
}

async function _processBulkImport(ibid_bulk_import) {
  try {

    // Switch to import tab
    for (const b of $$('.tab-btn')) b.classList.remove('active', 'bg-saffron-100', 'dark:bg-saffron-900/30', 'text-saffron-700', 'dark:text-saffron-400');
    const importBtn = $('[data-tab="import"]');
    importBtn?.classList.add('active', 'bg-saffron-100', 'dark:bg-saffron-900/30', 'text-saffron-700', 'dark:text-saffron-400');
    for (const tc of $$('.tab-content')) tc.classList.add('hidden');
    $('#tab-import')?.classList.remove('hidden');
    const searchBar = $('#search')?.closest('.border-b');
    if (searchBar) searchBar.classList.add('hidden');

    // Prefill textarea and auto-parse
    $('#import-text').value = ibid_bulk_import;
    // Detect format — if it starts with [ it's CSL-JSON (resolved DOIs)
    const format = ibid_bulk_import.trimStart().startsWith('[') ? 'json' : 'auto';
    await parseAndPreview(ibid_bulk_import, format);
  } catch {}
}

function clearManualForm() {
  $('#manual-title').value = '';
  $('#manual-authors').value = '';
  $('#manual-year').value = '';
  $('#manual-container').value = '';
  $('#manual-doi').value = '';
  $('#manual-volume').value = '';
  $('#manual-issue').value = '';
  $('#manual-pages').value = '';
  $('#manual-publisher').value = '';
  $('#manual-type').value = 'article-journal';
}
