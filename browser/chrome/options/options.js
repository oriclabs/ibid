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

  // Version
  chrome.runtime.sendMessage({ action: 'getVersion' }, (res) => {
    if (res?.version) {
      $('#version').textContent = `Citation Manager v${res.version}`;
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
