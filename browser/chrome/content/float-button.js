// Ibid — Float button
// Injects a small cite button on web pages
// Configurable: can be disabled globally or per-site

if (!window.__ibidFloatLoaded) {
  window.__ibidFloatLoaded = true;

  (async () => {
    // Check if float button is enabled
    const settings = await chrome.storage.local.get(['floatButtonEnabled', 'floatButtonPosition']);
    if (!settings.floatButtonEnabled) return;

    const pos = settings.floatButtonPosition || 'bottom-right';

    // Create button
    const btn = document.createElement('div');
    btn.id = 'ibid-float-btn';
    btn.title = 'Cite this page with Ibid';
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 128 128" fill="none"><rect width="128" height="128" rx="28" fill="#f49707"/><rect x="19" y="28" width="90" height="6" rx="3" fill="white" fill-opacity="0.85"/><circle cx="42" cy="49" r="12" fill="white" fill-opacity="0.9"/><path d="M38 55 Q40 60 35 68 L42 63 Z" fill="white" fill-opacity="0.9"/><circle cx="78" cy="49" r="12" fill="white" fill-opacity="0.85"/><path d="M74 55 Q76 60 71 68 L78 63 Z" fill="white" fill-opacity="0.85"/><rect x="19" y="98" width="90" height="5" rx="2.5" fill="white" fill-opacity="0.5"/><rect x="19" y="109" width="58" height="5" rx="2.5" fill="white" fill-opacity="0.35"/></svg>`;

    // Styles
    const positions = {
      'bottom-right': 'bottom: 20px; right: 20px;',
      'bottom-left': 'bottom: 20px; left: 20px;',
      'top-right': 'top: 20px; right: 20px;',
      'top-left': 'top: 20px; left: 20px;',
    };

    btn.setAttribute('style', `
      position: fixed;
      ${positions[pos] || positions['bottom-right']}
      z-index: 2147483647;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s, box-shadow 0.15s;
      opacity: 0.7;
    `);

    btn.addEventListener('mouseenter', () => {
      btn.style.opacity = '1';
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 4px 12px rgba(244,151,7,0.3)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.opacity = '0.7';
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    });

    btn.addEventListener('click', () => {
      // Trigger the extension popup via action click
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });

    document.body.appendChild(btn);
  })();
}
