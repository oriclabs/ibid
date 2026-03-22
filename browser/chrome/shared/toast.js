// Ibid — Toast notification system
// Usage: showToast('Citation added!', 'success')
// Types: success, error, info, warning

let toastContainer = null;

export function initToasts() {
  if (toastContainer) return;
  toastContainer = document.createElement('div');
  toastContainer.id = 'ibid-toasts';
  toastContainer.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
  document.body.appendChild(toastContainer);
}

export function showToast(message, type = 'info', duration = 3000) {
  if (!toastContainer) initToasts();

  const colors = {
    success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: '<path d="M5 13l4 4L19 7"/>' },
    error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '<path d="M6 18L18 6M6 6l12 12"/>' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '<path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>' },
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>' },
  };

  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.style.cssText = `
    background:${c.bg};border:1px solid ${c.border};color:${c.text};
    padding:8px 12px;border-radius:8px;font-size:12px;font-family:Inter,system-ui,sans-serif;
    display:flex;align-items:center;gap:6px;pointer-events:auto;
    box-shadow:0 4px 12px rgba(0,0,0,0.1);
    transform:translateX(120%);transition:transform 0.2s ease;
    max-width:300px;
  `;
  toast.innerHTML = `
    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0">${c.icon}</svg>
    <span style="flex:1">${message}</span>
    <button style="flex-shrink:0;padding:2px;background:none;border:none;cursor:pointer;color:inherit;opacity:0.5" onclick="this.parentElement.remove()">
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;

  toastContainer.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
  });

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => {
      toast.style.transform = 'translateX(120%)';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  return toast;
}
