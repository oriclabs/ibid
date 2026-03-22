// Test: Popup field parsing, building CSL items, duplicate detection

const { describe, it, assertEqual, assertLength, assert } = require('./test-runner');

// =============================================================================
// Replicate pure functions from popup.js
// =============================================================================

function parseAuthorsInput(str) {
  if (!str.trim()) return [];
  return str.split(';').map((part) => {
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
}

function parseDateInput(str) {
  if (!str.trim()) return undefined;
  const parts = str.split('-').map(Number).filter((n) => !isNaN(n));
  if (parts.length > 0) return { 'date-parts': [parts] };
  return { literal: str };
}

function formatAuthorsForInput(authors) {
  return authors
    .map((a) => {
      if (a.literal) return a.literal;
      if (a.family && a.given) return `${a.family}, ${a.given}`;
      if (a.family) return a.family;
      return '';
    })
    .filter(Boolean)
    .join('; ');
}

function normalizeTitle(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function findDuplicate(newItem, existing) {
  for (const ex of existing) {
    if (newItem.DOI && ex.DOI && newItem.DOI.toLowerCase() === ex.DOI.toLowerCase()) return ex;
    if (newItem.ISBN && ex.ISBN && newItem.ISBN.replace(/[-\s]/g, '') === ex.ISBN.replace(/[-\s]/g, '')) return ex;
    if (newItem.URL && ex.URL && newItem.URL === ex.URL && !newItem.URL.match(/^https?:\/\/(www\.)?(google|bing|yahoo)\./)) return ex;
    if (newItem.title && ex.title) {
      const a = normalizeTitle(newItem.title);
      const b = normalizeTitle(ex.title);
      if (a.length > 10 && b.length > 10 && a === b) return ex;
    }
  }
  return null;
}

// =============================================================================
// Author input parsing
// =============================================================================

describe('Author input parsing', () => {
  it('parses "Last, First" format', () => {
    const authors = parseAuthorsInput('Smith, John');
    assertLength(authors, 1);
    assertEqual(authors[0].family, 'Smith');
    assertEqual(authors[0].given, 'John');
  });

  it('parses multiple authors separated by ;', () => {
    const authors = parseAuthorsInput('Smith, John; Doe, Jane; Wilson, Bob');
    assertLength(authors, 3);
    assertEqual(authors[2].family, 'Wilson');
  });

  it('parses "First Last" format', () => {
    const authors = parseAuthorsInput('John Smith');
    assertLength(authors, 1);
    assertEqual(authors[0].family, 'Smith');
    assertEqual(authors[0].given, 'John');
  });

  it('handles single name as literal', () => {
    const authors = parseAuthorsInput('WHO');
    assertLength(authors, 1);
    assertEqual(authors[0].literal, 'WHO');
  });

  it('returns empty for empty string', () => {
    assertLength(parseAuthorsInput(''), 0);
    assertLength(parseAuthorsInput('   '), 0);
  });

  it('handles mixed formats', () => {
    const authors = parseAuthorsInput('Smith, John; Jane Doe');
    assertLength(authors, 2);
    assertEqual(authors[0].family, 'Smith');
    assertEqual(authors[1].family, 'Doe');
  });
});

// =============================================================================
// Author formatting for display
// =============================================================================

describe('Author formatting for input', () => {
  it('formats family, given', () => {
    const str = formatAuthorsForInput([{ family: 'Smith', given: 'John' }]);
    assertEqual(str, 'Smith, John');
  });

  it('formats multiple authors with ;', () => {
    const str = formatAuthorsForInput([
      { family: 'Smith', given: 'John' },
      { family: 'Doe', given: 'Jane' },
    ]);
    assertEqual(str, 'Smith, John; Doe, Jane');
  });

  it('formats literal name', () => {
    assertEqual(formatAuthorsForInput([{ literal: 'WHO' }]), 'WHO');
  });

  it('handles family-only', () => {
    assertEqual(formatAuthorsForInput([{ family: 'Smith' }]), 'Smith');
  });

  it('skips empty entries', () => {
    assertEqual(formatAuthorsForInput([{}, { family: 'Smith' }]), 'Smith');
  });
});

// =============================================================================
// Date input parsing
// =============================================================================

describe('Date input parsing', () => {
  it('parses YYYY', () => {
    const d = parseDateInput('2023');
    assertEqual(d['date-parts'][0][0], 2023);
    assertLength(d['date-parts'][0], 1);
  });

  it('parses YYYY-MM', () => {
    const d = parseDateInput('2023-06');
    assertEqual(d['date-parts'][0][0], 2023);
    assertEqual(d['date-parts'][0][1], 6);
  });

  it('parses YYYY-MM-DD', () => {
    const d = parseDateInput('2023-06-15');
    assertLength(d['date-parts'][0], 3);
    assertEqual(d['date-parts'][0][2], 15);
  });

  it('returns undefined for empty', () => {
    assertEqual(parseDateInput(''), undefined);
    assertEqual(parseDateInput('   '), undefined);
  });

  it('returns literal for non-numeric', () => {
    const d = parseDateInput('Spring 2023');
    assertEqual(d.literal, 'Spring 2023');
  });
});

// =============================================================================
// Duplicate detection
// =============================================================================

describe('Duplicate detection', () => {
  const existing = [
    { id: '1', title: 'The Impact of Climate Change on Biodiversity', DOI: '10.1038/test' },
    { id: '2', title: 'Short', ISBN: '978-0-123-45678-9' },
    { id: '3', title: 'Web Article', URL: 'https://example.com/article' },
  ];

  it('detects DOI match (case-insensitive)', () => {
    const dup = findDuplicate({ DOI: '10.1038/TEST' }, existing);
    assert(dup !== null, 'Should find DOI match');
    assertEqual(dup.id, '1');
  });

  it('detects ISBN match (ignoring hyphens)', () => {
    const dup = findDuplicate({ ISBN: '9780123456789' }, existing);
    assert(dup !== null, 'Should find ISBN match');
    assertEqual(dup.id, '2');
  });

  it('detects URL match', () => {
    const dup = findDuplicate({ URL: 'https://example.com/article' }, existing);
    assert(dup !== null, 'Should find URL match');
    assertEqual(dup.id, '3');
  });

  it('ignores search engine URLs', () => {
    const dup = findDuplicate({ URL: 'https://www.google.com/search?q=test' }, [
      { URL: 'https://www.google.com/search?q=test' },
    ]);
    assertEqual(dup, null, 'Should ignore Google URLs');
  });

  it('detects normalized title match', () => {
    const dup = findDuplicate(
      { title: 'The Impact of Climate Change on Biodiversity!' },
      existing
    );
    assert(dup !== null, 'Should find title match');
    assertEqual(dup.id, '1');
  });

  it('ignores short title matches', () => {
    const dup = findDuplicate({ title: 'Short' }, existing);
    assertEqual(dup, null, 'Short titles should not match');
  });

  it('returns null when no match', () => {
    const dup = findDuplicate({ title: 'Completely Different Paper About Nothing' }, existing);
    assertEqual(dup, null);
  });

  it('returns null for empty item', () => {
    const dup = findDuplicate({}, existing);
    assertEqual(dup, null);
  });
});

// =============================================================================
// Title normalization
// =============================================================================

describe('Title normalization', () => {
  it('lowercases', () => {
    assertEqual(normalizeTitle('ABC'), 'abc');
  });

  it('strips punctuation', () => {
    assertEqual(normalizeTitle('Hello, World!'), 'helloworld');
  });

  it('strips spaces', () => {
    assertEqual(normalizeTitle('  hello  world  '), 'helloworld');
  });

  it('keeps digits', () => {
    assertEqual(normalizeTitle('COVID-19 Study'), 'covid19study');
  });
});
