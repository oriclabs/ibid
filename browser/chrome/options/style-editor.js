const $ = (s) => document.querySelector(s);

// Sample data for preview
const samples = {
  journal: {
    author: [{ family: 'Smith', given: 'John A.' }, { family: 'Doe', given: 'Jane B.' }, { family: 'Wilson', given: 'Robert C.' }],
    title: 'The impact of climate change on marine biodiversity',
    'container-title': 'Nature Climate Change',
    issued: { 'date-parts': [[2024, 3]] },
    volume: '14', issue: '3', page: '245-260',
    DOI: '10.1038/s41558-024-01234-5',
    URL: 'https://doi.org/10.1038/s41558-024-01234-5',
    publisher: 'Nature Publishing Group',
  },
  book: {
    author: [{ family: 'Knuth', given: 'Donald E.' }],
    title: 'The Art of Computer Programming',
    issued: { 'date-parts': [[1997]] },
    publisher: 'Addison-Wesley',
  },
  webpage: {
    author: [{ literal: 'World Health Organization' }],
    title: 'Climate change and health',
    issued: { 'date-parts': [[2024, 1]] },
    URL: 'https://www.who.int/health-topics/climate-change',
  },
};

function formatAuthors(authors, opts) {
  if (!authors?.length) return '';
  const fmt = (a) => {
    if (a.literal) return a.literal;
    const f = a.family || '';
    const g = a.given || '';
    const initials = opts.initials ? g.split(/[\s.]/).filter(Boolean).map(p => p[0] + '.').join(' ') : g;
    return opts.order === 'last-first' ? `${f}, ${initials}`.trim() : `${initials} ${f}`.trim();
  };
  const etAlMin = parseInt(opts.etal);
  if (authors.length >= etAlMin) {
    return fmt(authors[0]) + ' et al.';
  }
  if (authors.length === 1) return fmt(authors[0]);
  if (authors.length === 2) return `${fmt(authors[0])} ${opts.connector} ${fmt(authors[1])}`;
  return authors.slice(0, -1).map(fmt).join(', ') + `, ${opts.connector} ` + fmt(authors[authors.length - 1]);
}

function applyTemplate(template, data, opts) {
  const author = formatAuthors(data.author, opts);
  const authorShort = data.author?.[0]?.family || data.author?.[0]?.literal || '';
  const year = data.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
  const doi = data.DOI ? `https://doi.org/${data.DOI}` : '';

  return template
    .replace('{author}', author)
    .replace('{author-short}', authorShort)
    .replace('{year}', year)
    .replace('{title}', data.title || '')
    .replace('{container}', data['container-title'] || '')
    .replace('{volume}', data.volume || '')
    .replace('{issue}', data.issue || '')
    .replace('{page}', data.page || '')
    .replace('{doi}', doi)
    .replace('{url}', data.URL || '')
    .replace('{publisher}', data.publisher || '')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\(\)/g, '')
    .replace(/, ,/g, ',')
    .replace(/\.\./g, '.')
    .replace(/,\s*\./g, '.');
}

function updatePreview() {
  const opts = {
    order: $('#cs-name-order').value,
    etal: $('#cs-etal').value,
    connector: $('#cs-connector').value,
    initials: $('#cs-initials').value === 'true',
  };

  $('#preview-journal').innerHTML = applyTemplate($('#cs-journal').value, samples.journal, opts);
  $('#preview-book').innerHTML = applyTemplate($('#cs-book').value, samples.book, opts);
  $('#preview-webpage').innerHTML = applyTemplate($('#cs-webpage').value, samples.webpage, opts);
  $('#preview-intext').innerHTML = applyTemplate($('#cs-intext').value, samples.journal, opts);
}

// Live update
for (const el of document.querySelectorAll('input, select')) {
  el.addEventListener('input', updatePreview);
  el.addEventListener('change', updatePreview);
}

// Save
$('#btn-save-style').addEventListener('click', async () => {
  const name = $('#cs-name').value.trim() || 'My Custom Style';
  const style = {
    id: 'custom-' + name.toLowerCase().replace(/\s+/g, '-'),
    name,
    templates: {
      'article-journal': $('#cs-journal').value,
      'book': $('#cs-book').value,
      'webpage': $('#cs-webpage').value,
      'default': $('#cs-default').value,
    },
    intext: $('#cs-intext').value,
    authorFormat: {
      order: $('#cs-name-order').value,
      etal: parseInt($('#cs-etal').value),
      connector: $('#cs-connector').value,
      initials: $('#cs-initials').value === 'true',
    },
  };

  const { customStyles = [] } = await chrome.storage.local.get(['customStyles']);
  const existing = customStyles.findIndex(s => s.id === style.id);
  if (existing >= 0) customStyles[existing] = style;
  else customStyles.push(style);
  await chrome.storage.local.set({ customStyles });

  const status = $('#style-save-status');
  status.className = 'mt-3 text-xs rounded px-3 py-2 bg-emerald-50 text-emerald-700';
  status.textContent = `Style "${name}" saved! It will appear in the style picker.`;
  status.classList.remove('hidden');
  setTimeout(() => status.classList.add('hidden'), 3000);
});

// Export
$('#btn-export-style').addEventListener('click', () => {
  const style = {
    name: $('#cs-name').value.trim() || 'My Custom Style',
    templates: {
      'article-journal': $('#cs-journal').value,
      'book': $('#cs-book').value,
      'webpage': $('#cs-webpage').value,
      'default': $('#cs-default').value,
    },
    intext: $('#cs-intext').value,
    authorFormat: {
      order: $('#cs-name-order').value,
      etal: parseInt($('#cs-etal').value),
      connector: $('#cs-connector').value,
      initials: $('#cs-initials').value === 'true',
    },
  };
  const blob = new Blob([JSON.stringify(style, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${style.name.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Initial preview
updatePreview();
