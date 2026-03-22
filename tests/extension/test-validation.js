// Test: Source type validation logic

const { describe, it, assert, assertEqual, assertContains } = require('./test-runner');

// =============================================================================
// Replicate validation logic from popup.js
// =============================================================================

function validateSourceType(type, fields) {
  const { title, authors, date, container, volume, issue, pages, doi, publisher } = fields;
  const warnings = [];
  let suggestion = null;

  switch (type) {
    case 'article-journal':
      if (!container) warnings.push('missing-container');
      if (!volume && !issue) warnings.push('missing-volume-issue');
      if (!doi && !pages) warnings.push('missing-doi-pages');
      if (!container && !volume && !issue && !pages && !doi) suggestion = 'webpage';
      break;
    case 'book':
      if (!publisher) warnings.push('missing-publisher');
      if (container) warnings.push('has-container');
      if (volume && issue) { warnings.push('has-volume-issue'); suggestion = 'article-journal'; }
      break;
    case 'chapter':
      if (!container) warnings.push('missing-container');
      if (!publisher) warnings.push('missing-publisher');
      break;
    case 'article-newspaper':
    case 'article-magazine':
      if (!container) warnings.push('missing-container');
      if (volume && issue && doi) { warnings.push('has-journal-signals'); suggestion = 'article-journal'; }
      break;
    case 'thesis':
      if (!publisher) warnings.push('missing-publisher');
      if (container) warnings.push('has-container');
      break;
    case 'webpage': {
      const url = fields.url || '';
      const isNonAcademic = /\b(google\.com|drive\.google|youtube\.com|facebook\.com|twitter\.com|reddit\.com|github\.com|medium\.com|wikipedia\.org)\b/.test(url);
      const isGenericContainer = /^(Google|Google Drive|Facebook|Twitter|YouTube|LinkedIn|Reddit|Medium|Wikipedia|GitHub)$/i.test(container);
      if (!isNonAcademic && !isGenericContainer) {
        if (doi && container && (volume || issue)) { warnings.push('has-journal-signals'); suggestion = 'article-journal'; }
        else if (doi && container && doi.match && doi.match(/^10\.\d{4,}/)) { warnings.push('has-doi-container'); suggestion = 'article-journal'; }
      }
      break;
    }
    case 'paper-conference':
      if (!container) warnings.push('missing-container');
      break;
    case 'report':
      if (!publisher) warnings.push('missing-publisher');
      break;
  }

  return { warnings, suggestion };
}

// =============================================================================
// Tests
// =============================================================================

describe('Source type validation - Journal Article', () => {
  it('warns when no container for journal', () => {
    const r = validateSourceType('article-journal', { doi: '10.1234/test' });
    assert(r.warnings.includes('missing-container'));
  });

  it('warns when no volume/issue for journal', () => {
    const r = validateSourceType('article-journal', { container: 'Nature', doi: '10.1234/test' });
    assert(r.warnings.includes('missing-volume-issue'));
  });

  it('no warnings for complete journal article', () => {
    const r = validateSourceType('article-journal', {
      container: 'Nature', volume: '42', issue: '3', doi: '10.1234/test'
    });
    assertEqual(r.warnings.length, 0);
  });

  it('suggests webpage when no journal metadata at all', () => {
    const r = validateSourceType('article-journal', { title: 'Just a page' });
    assertEqual(r.suggestion, 'webpage');
  });
});

describe('Source type validation - Book', () => {
  it('warns when no publisher for book', () => {
    const r = validateSourceType('book', { title: 'A Book' });
    assert(r.warnings.includes('missing-publisher'));
  });

  it('warns when container present (might be chapter)', () => {
    const r = validateSourceType('book', { publisher: 'Pub', container: 'Edited Volume' });
    assert(r.warnings.includes('has-container'));
  });

  it('suggests journal when volume+issue present', () => {
    const r = validateSourceType('book', { publisher: 'Pub', volume: '42', issue: '3' });
    assertEqual(r.suggestion, 'article-journal');
  });

  it('no warnings for proper book', () => {
    const r = validateSourceType('book', { publisher: 'Addison-Wesley', title: 'A Book' });
    assertEqual(r.warnings.length, 0);
  });
});

describe('Source type validation - Chapter', () => {
  it('warns when no container for chapter', () => {
    const r = validateSourceType('chapter', { publisher: 'Pub' });
    assert(r.warnings.includes('missing-container'));
  });

  it('no warnings for proper chapter', () => {
    const r = validateSourceType('chapter', { container: 'Book Title', publisher: 'Pub' });
    assertEqual(r.warnings.length, 0);
  });
});

describe('Source type validation - Webpage', () => {
  it('suggests journal when DOI + container + volume present', () => {
    const r = validateSourceType('webpage', {
      doi: '10.1234/test', container: 'Nature', volume: '42'
    });
    assertEqual(r.suggestion, 'article-journal');
  });

  it('suggests journal when DOI + container present', () => {
    const r = validateSourceType('webpage', {
      doi: '10.1234/test', container: 'Nature'
    });
    assertEqual(r.suggestion, 'article-journal');
  });

  it('no warning for plain webpage', () => {
    const r = validateSourceType('webpage', { title: 'A Page', url: 'https://example.com' });
    assertEqual(r.warnings.length, 0);
  });

  it('no suggestion for Google Drive URLs', () => {
    const r = validateSourceType('webpage', {
      doi: '10.1234/test', container: 'Google Drive',
      url: 'https://drive.google.com/drive/folders/abc'
    });
    assertEqual(r.suggestion, null, 'Should not suggest journal for Google Drive');
  });

  it('no suggestion for generic container names', () => {
    const r = validateSourceType('webpage', {
      doi: '10.1234/test', container: 'Google'
    });
    assertEqual(r.suggestion, null, 'Should not suggest journal for generic container');
  });

  it('no suggestion for YouTube URLs', () => {
    const r = validateSourceType('webpage', {
      doi: '10.1234/test', container: 'YouTube',
      url: 'https://youtube.com/watch?v=abc'
    });
    assertEqual(r.suggestion, null);
  });

  it('no suggestion for GitHub URLs', () => {
    const r = validateSourceType('webpage', {
      container: 'GitHub', url: 'https://github.com/repo'
    });
    assertEqual(r.suggestion, null);
  });

  it('still suggests journal for academic sites with DOI', () => {
    const r = validateSourceType('webpage', {
      doi: '10.1038/nature12373', container: 'Nature',
      url: 'https://www.nature.com/articles/nature12373'
    });
    assertEqual(r.suggestion, 'article-journal');
  });
});

describe('Source type validation - Newspaper', () => {
  it('warns when no container for news', () => {
    const r = validateSourceType('article-newspaper', { title: 'News' });
    assert(r.warnings.includes('missing-container'));
  });

  it('suggests journal when journal signals present', () => {
    const r = validateSourceType('article-newspaper', {
      container: 'J', volume: '1', issue: '2', doi: '10.1/x'
    });
    assertEqual(r.suggestion, 'article-journal');
  });
});

describe('Source type validation - Thesis', () => {
  it('warns when no publisher (university)', () => {
    const r = validateSourceType('thesis', { title: 'My Thesis' });
    assert(r.warnings.includes('missing-publisher'));
  });

  it('warns when container present', () => {
    const r = validateSourceType('thesis', { publisher: 'MIT', container: 'Journal' });
    assert(r.warnings.includes('has-container'));
  });
});

describe('Source type validation - Conference', () => {
  it('warns when no container (proceedings)', () => {
    const r = validateSourceType('paper-conference', { title: 'Paper' });
    assert(r.warnings.includes('missing-container'));
  });
});

describe('Source type validation - Report', () => {
  it('warns when no publisher (organization)', () => {
    const r = validateSourceType('report', { title: 'Report' });
    assert(r.warnings.includes('missing-publisher'));
  });
});
