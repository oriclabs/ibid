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
  sel.innerHTML = '<option value="all">All Projects</option>';
  for (const p of projects) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  }
  sel.value = current || 'all';
}

function applyFiltersAndRender() {
  let filtered = [...allCitations];

  // Project filter
  const projectId = $('#lib-project-filter').value;
  if (projectId !== 'all') {
    filtered = filtered.filter(c => c._projectIds?.includes(projectId));
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
      c.keyword?.toLowerCase().includes(query)
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
        <div class="citation-row px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors ${isSelected ? 'bg-saffron-50 dark:bg-saffron-900/10' : ''}" data-id="${item.id}">
          <div class="flex items-start gap-2">
            <input type="checkbox" class="cite-select mt-1 rounded text-saffron-500 focus:ring-saffron-500 shrink-0" data-id="${item.id}" ${isSelected ? 'checked' : ''}>
            <div class="min-w-0 flex-1" data-action="edit" data-id="${item.id}">
              <div class="flex items-center gap-1.5">
                <span class="text-[9px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase shrink-0">${typeLabel}</span>
                <p class="font-medium text-sm truncate">${item.title || 'Untitled'}</p>
              </div>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">${authors}${authors && year ? ' (' + year + ')' : year}</p>
              ${(item._tags && item._tags.length) ? `<div class="flex gap-0.5 mt-0.5 flex-wrap">${getCitationTags(item)}</div>` : ''}
            </div>
            <div class="flex items-center gap-0.5 shrink-0">
              <button class="btn-star p-1 rounded transition-colors ${isStarred ? 'text-saffron-500' : 'text-zinc-300 dark:text-zinc-600 hover:text-saffron-400'}" data-id="${item.id}" title="${isStarred ? 'Unstar' : 'Star'}">
                <svg class="w-4 h-4" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>
              </button>
              <button class="btn-delete p-1 rounded text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-colors" data-id="${item.id}" title="Delete">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
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

  // Delete
  for (const btn of $$('.btn-delete')) {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const { citations = [] } = await chrome.storage.local.get(['citations']);
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

  // Click row to edit
  for (const el of $$('[data-action="edit"]')) {
    el.addEventListener('click', () => openEditPanel(el.dataset.id));
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
  item._tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : undefined;

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

  await chrome.storage.local.set({ citations });
  $('#edit-panel').classList.add('hidden');
  applyFiltersAndRender();
});

// ---------------------------------------------------------------------------
// Search & filter
// ---------------------------------------------------------------------------

// Search — uses shared filter pipeline
$('#search').addEventListener('input', () => applyFiltersAndRender());

// Sort
$('#lib-sort').addEventListener('change', () => applyFiltersAndRender());

// Project filter
$('#lib-project-filter').addEventListener('change', () => applyFiltersAndRender());

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
      return `
        <label class="flex items-start gap-2 px-2 py-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
          <input type="checkbox" class="import-checkbox mt-0.5 rounded text-saffron-500 focus:ring-saffron-500" data-index="${i}" checked>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate">${item.title || 'Untitled'}</p>
            <p class="text-[10px] text-zinc-500 truncate"><span class="uppercase bg-zinc-100 dark:bg-zinc-800 px-1 rounded">${typeLabel}</span> ${authors}${year ? ` (${year})` : ''}</p>
          </div>
        </label>`;
    })
    .join('');
}

async function importSelected() {
  const indices = Array.from($$('.import-checkbox:checked')).map((cb) => parseInt(cb.dataset.index));
  if (indices.length === 0) { showImportStatus('error', 'No entries selected.'); return; }

  const toImport = indices.map((i) => ({
    ...parsedEntries[i],
    id: parsedEntries[i].id || crypto.randomUUID(),
    _dateAdded: new Date().toISOString(),
    _importSource: 'import',
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
    return;
  }

  citations.push(...newItems);
  await chrome.storage.local.set({ citations });

  const dupMsg = dupCount > 0 ? `, ${dupCount} duplicate${dupCount > 1 ? 's' : ''} skipped` : '';
  showImportStatus('success', `Imported ${newItems.length} entr${newItems.length === 1 ? 'y' : 'ies'}${dupMsg}.`);
  parsedEntries = [];
  $('#import-preview').classList.add('hidden');
  $('#import-text').value = '';
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

async function updateExportCount() {
  const items = await getExportItems();
  $('#export-count').textContent = `${items.length} citation${items.length !== 1 ? 's' : ''} will be exported`;
}

async function getExportItems() {
  const { citations = [] } = await chrome.storage.local.get(['citations']);
  const scope = $('#export-scope').value;
  if (scope === 'starred') return citations.filter((c) => c._starred);
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
// Init
// ---------------------------------------------------------------------------

loadCitations();
updateExportCount();

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
  }
});
