// Test: Identifier detection and format auto-detection logic
// (Tests the pattern matching — not actual API calls)

const { describe, it, assert, assertEqual } = require('./test-runner');

// =============================================================================
// Replicate identifier detection from resolver.js
// =============================================================================

function detectIdentifierType(input) {
  input = (input || '').trim();
  if (!input) return null;

  if (input.match(/^10\.\d{4,}/) || input.match(/doi\.org\/10\./i)) return 'doi';
  if (input.match(/^pmid:\s*\d+$/i) || input.match(/pubmed.*\/(\d+)/)) return 'pmid';
  if (input.match(/^arxiv:\s*\d{4}\./i) || input.match(/arxiv\.org\/abs\/(\d{4}\.\d+)/)) return 'arxiv';
  if (input.replace(/[-\s]/g, '').match(/^(97[89])?\d{9}[\dXx]$/)) return 'isbn';
  if (input.match(/10\.\d{4,}\/[^\s]+/)) return 'doi'; // DOI in URL

  return null;
}

function detectImportFormat(text) {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('@')) return 'bibtex';
  if (trimmed.startsWith('TY  -') || trimmed.match(/^[A-Z][A-Z0-9]\s\s-/)) return 'ris';
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json';
  return null;
}

// =============================================================================
// Identifier detection
// =============================================================================

describe('Identifier type detection', () => {
  // DOI
  it('detects plain DOI', () => assertEqual(detectIdentifierType('10.1038/nature12373'), 'doi'));
  it('detects DOI URL', () => assertEqual(detectIdentifierType('https://doi.org/10.1038/nature12373'), 'doi'));
  it('detects DOI with path', () => assertEqual(detectIdentifierType('10.1000/xyz123'), 'doi'));

  // PMID
  it('detects PMID: prefix', () => assertEqual(detectIdentifierType('PMID:12345678'), 'pmid'));
  it('detects pmid: lowercase', () => assertEqual(detectIdentifierType('pmid: 12345'), 'pmid'));
  it('detects PubMed URL', () => assertEqual(detectIdentifierType('https://pubmed.ncbi.nlm.nih.gov/12345678'), 'pmid'));

  // arXiv
  it('detects arxiv: prefix', () => assertEqual(detectIdentifierType('arxiv:2301.07041'), 'arxiv'));
  it('detects arXiv URL', () => assertEqual(detectIdentifierType('https://arxiv.org/abs/2301.07041'), 'arxiv'));
  it('detects arxiv with version', () => assertEqual(detectIdentifierType('arxiv:2301.07041v2'), 'arxiv'));

  // ISBN
  it('detects ISBN-13', () => assertEqual(detectIdentifierType('978-0-13-468599-1'), 'isbn'));
  it('detects ISBN-13 no hyphens', () => assertEqual(detectIdentifierType('9780134685991'), 'isbn'));
  it('detects ISBN-10', () => assertEqual(detectIdentifierType('0-13-468599-X'), 'isbn'));
  it('detects ISBN-10 no hyphens', () => assertEqual(detectIdentifierType('013468599X'), 'isbn'));

  // Not identifiers
  it('returns null for empty', () => assertEqual(detectIdentifierType(''), null));
  it('returns null for plain text', () => assertEqual(detectIdentifierType('just some text'), null));
  it('returns null for URL without DOI', () => assertEqual(detectIdentifierType('https://example.com'), null));
});

// =============================================================================
// Import format detection
// =============================================================================

describe('Import format auto-detection', () => {
  it('detects BibTeX', () => {
    assertEqual(detectImportFormat('@article{test, author={A}, title={T}}'), 'bibtex');
  });

  it('detects BibTeX with leading whitespace', () => {
    assertEqual(detectImportFormat('  \n@article{test}'), 'bibtex');
  });

  it('detects RIS', () => {
    assertEqual(detectImportFormat('TY  - JOUR\nAU  - Smith\n'), 'ris');
  });

  it('detects CSL-JSON array', () => {
    assertEqual(detectImportFormat('[{"id":"test","type":"article"}]'), 'json');
  });

  it('detects CSL-JSON object', () => {
    assertEqual(detectImportFormat('{"id":"test","type":"article"}'), 'json');
  });

  it('returns null for plain text', () => {
    assertEqual(detectImportFormat('This is just a paragraph of text'), null);
  });

  it('returns null for empty', () => {
    assertEqual(detectImportFormat(''), null);
  });
});
