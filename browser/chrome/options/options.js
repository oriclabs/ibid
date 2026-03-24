// Ibid — Options Page Script

const $ = (sel) => document.querySelector(sel);

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // Save on change
  $('#opt-style').addEventListener('change', () => {
    chrome.storage.local.set({ defaultStyle: $('#opt-style').value });
  });

  $('#opt-locale').addEventListener('change', () => {
    chrome.storage.local.set({ defaultLocale: $('#opt-locale').value });
  });

  $('#opt-float').addEventListener('change', () => {
    chrome.storage.local.set({ floatButtonEnabled: $('#opt-float').checked });
  });

  $('#opt-autoadd').addEventListener('change', () => {
    chrome.storage.local.set({ autoAddToProject: $('#opt-autoadd').checked });
  });

  // Scholarly API permissions
  const SCHOLARLY_ORIGINS = [
    'https://arxiv.org/*',
    'https://export.arxiv.org/*',
    'https://api.semanticscholar.org/*',
    'https://en.wikipedia.org/*',
    'https://doi.org/*',
  ];

  function updateApiStatus(granted) {
    const btn = $('#btn-grant-api');
    const status = $('#api-status');
    if (granted) {
      btn.textContent = 'Granted';
      btn.disabled = true;
      btn.classList.add('opacity-50');
      status.textContent = 'arXiv, DOI.org, Semantic Scholar, Wikipedia';
      status.classList.add('text-green-600');
    } else {
      btn.textContent = 'Grant API access';
      btn.disabled = false;
      status.textContent = 'Not granted — some features limited';
    }
  }

  chrome.permissions.contains({ origins: SCHOLARLY_ORIGINS }, updateApiStatus);

  $('#btn-grant-api').addEventListener('click', async () => {
    const granted = await chrome.permissions.request({ origins: SCHOLARLY_ORIGINS });
    updateApiStatus(granted);
  });

  // Backup
  $('#btn-backup').addEventListener('click', async () => {
    const data = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ibid-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Restore
  $('#btn-restore').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      await chrome.storage.local.set(data);
      loadSettings();
      await ibidAlert('Library restored successfully.', 'success');
    });
    input.click();
  });

  // Clear
  $('#btn-clear').addEventListener('click', async () => {
    const ok = await ibidConfirm(
      'Delete all data?',
      'This will permanently delete all citations, projects, tags, and settings. This cannot be undone.',
      { confirmText: 'Delete Everything', danger: true }
    );
    if (ok) {
      await chrome.storage.local.clear();
      loadSettings();
      await ibidAlert('All data cleared.', 'success');
    }
  });

  // Version and engine status
  chrome.runtime.sendMessage({ action: 'getVersion' }, (res) => {
    if (res?.version) {
      $('#version').textContent = `Citation Manager v${res.version}`;
      const vEl = $('#about-version');
      if (vEl) vEl.textContent = `v${res.version}`;
    }

    const dot = $('#about-engine-dot');
    const text = $('#about-engine-text');
    const parsers = $('#about-parsers');

    if (dot && text) {
      if (res?.wasmReady) {
        dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
        text.textContent = 'Rust/WASM active';
        text.className = 'text-emerald-600 dark:text-emerald-400 font-medium';
        if (parsers) parsers.textContent = 'Rust/WASM (7 formats)';
      } else if (res?.wasmError) {
        dot.className = 'w-2 h-2 rounded-full bg-red-400';
        text.textContent = 'WASM failed — JavaScript fallback';
        text.className = 'text-red-600 dark:text-red-400';
        if (parsers) parsers.textContent = 'JavaScript fallback (3 formats)';
      } else {
        dot.className = 'w-2 h-2 rounded-full bg-amber-400';
        text.textContent = 'Loading...';
        text.className = 'text-amber-600 dark:text-amber-400';
        if (parsers) parsers.textContent = 'Loading...';
      }
    }
  });

  // Storage usage
  chrome.storage.local.getBytesInUse(null, (bytes) => {
    const el = $('#about-storage');
    if (el) {
      if (bytes < 1024) el.textContent = `${bytes} B`;
      else if (bytes < 1048576) el.textContent = `${(bytes / 1024).toFixed(1)} KB`;
      else el.textContent = `${(bytes / 1048576).toFixed(1)} MB`;
    }
  });
});

async function loadSettings() {
  const settings = await chrome.storage.local.get([
    'defaultStyle',
    'defaultLocale',
    'floatButtonEnabled',
    'autoAddToProject',
  ]);

  if (settings.defaultStyle) $('#opt-style').value = settings.defaultStyle;
  if (settings.defaultLocale) $('#opt-locale').value = settings.defaultLocale;
  $('#opt-float').checked = settings.floatButtonEnabled ?? false;
  $('#opt-autoadd').checked = settings.autoAddToProject ?? false;
}
