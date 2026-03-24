document.getElementById('btn-start').addEventListener('click', () => {
  window.close();
});

// Optional scholarly API permissions
const SCHOLARLY_ORIGINS = [
  'https://arxiv.org/*',
  'https://export.arxiv.org/*',
  'https://api.semanticscholar.org/*',
  'https://en.wikipedia.org/*',
  'https://doi.org/*',
];

const grantBtn = document.getElementById('btn-grant-api');
if (grantBtn) {
  // Check if already granted
  chrome.permissions.contains({ origins: SCHOLARLY_ORIGINS }, (granted) => {
    if (granted) {
      grantBtn.textContent = 'Access granted';
      grantBtn.disabled = true;
      grantBtn.classList.add('opacity-50');
    }
  });

  grantBtn.addEventListener('click', async () => {
    const granted = await chrome.permissions.request({ origins: SCHOLARLY_ORIGINS });
    if (granted) {
      grantBtn.textContent = 'Access granted';
      grantBtn.disabled = true;
      grantBtn.classList.add('opacity-50');
    }
  });
}
