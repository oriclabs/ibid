// Ibid — Custom dialog system (replaces native confirm/alert)
// Usage:
//   const ok = await ibidConfirm('Delete 3 citations?', 'This cannot be undone.', { confirmText: 'Delete', danger: true });
//   await ibidAlert('Imported 5 citations!', 'success');

let dialogContainer = null;

function ensureContainer() {
  if (dialogContainer) return;
  dialogContainer = document.createElement('div');
  dialogContainer.id = 'ibid-dialog-container';
  document.body.appendChild(dialogContainer);
}

/**
 * Custom confirm dialog — returns Promise<boolean>
 * @param {string} title - Main message
 * @param {string} [detail] - Secondary detail text
 * @param {object} [opts] - { confirmText, cancelText, danger }
 */
window.ibidConfirm = function(title, detail, opts = {}) {
  ensureContainer();
  return new Promise((resolve) => {
    const confirmText = opts.confirmText || 'Confirm';
    const cancelText = opts.cancelText || 'Cancel';
    const danger = opts.danger || false;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:99999;display:flex;align-items:center;justify-content:center;animation:ibidFadeIn 0.1s ease;';

    const btnColor = danger
      ? 'background:#ef4444;color:white;'
      : 'background:#f49707;color:white;';

    overlay.innerHTML = `
      <div style="background:white;border-radius:12px;padding:20px;max-width:320px;width:90%;box-shadow:0 20px 40px rgba(0,0,0,0.15);font-family:Inter,system-ui,sans-serif;animation:ibidScaleIn 0.15s ease;">
        <p style="font-size:14px;font-weight:600;color:#18181b;margin:0 0 ${detail ? '6px' : '16px'};">${title}</p>
        ${detail ? `<p style="font-size:12px;color:#71717a;margin:0 0 16px;line-height:1.5;">${detail}</p>` : ''}
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="ibid-dlg-cancel" style="padding:6px 16px;border-radius:6px;border:1px solid #e4e4e7;background:white;font-size:12px;font-weight:500;cursor:pointer;color:#52525b;">${cancelText}</button>
          <button id="ibid-dlg-confirm" style="padding:6px 16px;border-radius:6px;border:none;${btnColor}font-size:12px;font-weight:600;cursor:pointer;">${confirmText}</button>
        </div>
      </div>
    `;

    const cleanup = (result) => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 100);
      resolve(result);
    };

    overlay.querySelector('#ibid-dlg-cancel').addEventListener('click', () => cleanup(false));
    overlay.querySelector('#ibid-dlg-confirm').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });

    // Escape key cancels
    const onKey = (e) => { if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    dialogContainer.appendChild(overlay);

    // Focus confirm button
    overlay.querySelector('#ibid-dlg-confirm').focus();
  });
};

/**
 * Custom alert dialog — returns Promise<void>
 * @param {string} message
 * @param {string} [type] - 'success' | 'error' | 'info' | 'warning'
 */
window.ibidAlert = function(message, type = 'info') {
  ensureContainer();
  return new Promise((resolve) => {
    const colors = {
      success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: '✓' },
      error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '✕' },
      warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '!' },
      info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: 'i' },
    };
    const c = colors[type] || colors.info;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:99999;display:flex;align-items:center;justify-content:center;animation:ibidFadeIn 0.1s ease;';

    overlay.innerHTML = `
      <div style="background:white;border-radius:12px;padding:20px;max-width:320px;width:90%;box-shadow:0 20px 40px rgba(0,0,0,0.15);font-family:Inter,system-ui,sans-serif;text-align:center;animation:ibidScaleIn 0.15s ease;">
        <div style="width:36px;height:36px;border-radius:50%;background:${c.bg};border:1px solid ${c.border};color:${c.text};display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-weight:700;font-size:16px;">${c.icon}</div>
        <p style="font-size:13px;color:#3f3f46;margin:0 0 16px;line-height:1.5;">${message}</p>
        <button id="ibid-dlg-ok" style="padding:6px 24px;border-radius:6px;border:none;background:#f49707;color:white;font-size:12px;font-weight:600;cursor:pointer;">OK</button>
      </div>
    `;

    const cleanup = () => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 100);
      resolve();
    };

    overlay.querySelector('#ibid-dlg-ok').addEventListener('click', cleanup);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { cleanup(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    dialogContainer.appendChild(overlay);
    overlay.querySelector('#ibid-dlg-ok').focus();
  });
};

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes ibidFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ibidScaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
`;
document.head.appendChild(style);
