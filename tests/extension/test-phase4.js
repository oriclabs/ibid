// Test: Phase 4 features — site detection, NER patterns, custom styles, PDF, omnibox

const { describe, it, assert, assertEqual, assertLength, assertContains } = require('./test-runner');

// =============================================================================
// Site-specific extractor detection
// =============================================================================

function detectSiteType(hostname) {
  const host = hostname.toLowerCase();
  if (host.includes('scholar.google')) return 'article-journal';
  if (host.includes('researchgate.net')) return 'article-journal';
  if (host.includes('scopus.com')) return 'article-journal';
  if (host.includes('ssrn.com')) return 'report';
  if (host.includes('arxiv.org')) return 'article';
  if (host.includes('pubmed.ncbi.nlm.nih.gov')) return 'article-journal';
  if (host.includes('semanticscholar.org')) return 'article-journal';
  if (host.includes('jstor.org')) return 'article-journal';
  if (host.includes('ieeexplore.ieee.org')) return 'article-journal';
  if (host.includes('sciencedirect.com')) return 'article-journal';
  if (host.includes('link.springer.com')) return 'article-journal';
  if (host.includes('onlinelibrary.wiley.com')) return 'article-journal';
  if (host.includes('tandfonline.com')) return 'article-journal';
  // Generic journal hosting patterns
  const journalHostPattern = /\b(journals\.|journal\.|asm\.org|acs\.org|pubs\.acs|academic\.oup|cambridge\.org|sagepub\.com|bmj\.com|frontiersin\.org|mdpi\.com|plos\.org|biomedcentral\.com|nature\.com|cell\.com|thelancet\.com|nejm\.org|annualreviews\.org|pnas\.org|science\.org)\b/;
  if (journalHostPattern.test(host)) return 'article-journal';
  if (/\b(nytimes|washingtonpost|theguardian|bbc\.com|reuters|cnn\.com)\b/.test(host)) return 'article-newspaper';
  return 'webpage';
}

function detectTypeFromUrl(url) {
  if (/\/doi\/(abs\/|full\/|pdf\/)?10\.\d{4,}/.test(url)) return 'article-journal';
  return null;
}

describe('Site-specific type detection', () => {
  it('Google Scholar → journal', () => assertEqual(detectSiteType('scholar.google.com'), 'article-journal'));
  it('ResearchGate → journal', () => assertEqual(detectSiteType('www.researchgate.net'), 'article-journal'));
  it('Scopus → journal', () => assertEqual(detectSiteType('www.scopus.com'), 'article-journal'));
  it('SSRN → report', () => assertEqual(detectSiteType('papers.ssrn.com'), 'report'));
  it('arXiv → article', () => assertEqual(detectSiteType('arxiv.org'), 'article'));
  it('PubMed → journal', () => assertEqual(detectSiteType('pubmed.ncbi.nlm.nih.gov'), 'article-journal'));
  it('Semantic Scholar → journal', () => assertEqual(detectSiteType('www.semanticscholar.org'), 'article-journal'));
  it('JSTOR → journal', () => assertEqual(detectSiteType('www.jstor.org'), 'article-journal'));
  it('IEEE → journal', () => assertEqual(detectSiteType('ieeexplore.ieee.org'), 'article-journal'));
  it('ScienceDirect → journal', () => assertEqual(detectSiteType('www.sciencedirect.com'), 'article-journal'));
  it('Springer → journal', () => assertEqual(detectSiteType('link.springer.com'), 'article-journal'));
  it('Wiley → journal', () => assertEqual(detectSiteType('onlinelibrary.wiley.com'), 'article-journal'));
  it('T&F → journal', () => assertEqual(detectSiteType('www.tandfonline.com'), 'article-journal'));
  it('NYT → newspaper', () => assertEqual(detectSiteType('www.nytimes.com'), 'article-newspaper'));
  it('BBC → newspaper', () => assertEqual(detectSiteType('www.bbc.com'), 'article-newspaper'));
  it('Guardian → newspaper', () => assertEqual(detectSiteType('www.theguardian.com'), 'article-newspaper'));
  it('Reuters → newspaper', () => assertEqual(detectSiteType('www.reuters.com'), 'article-newspaper'));
  it('CNN → newspaper', () => assertEqual(detectSiteType('www.cnn.com'), 'article-newspaper'));
  it('ASM Journals → journal', () => assertEqual(detectSiteType('journals.asm.org'), 'article-journal'));
  it('ACS Pubs → journal', () => assertEqual(detectSiteType('pubs.acs.org'), 'article-journal'));
  it('Oxford Academic → journal', () => assertEqual(detectSiteType('academic.oup.com'), 'article-journal'));
  it('SAGE → journal', () => assertEqual(detectSiteType('journals.sagepub.com'), 'article-journal'));
  it('Frontiers → journal', () => assertEqual(detectSiteType('www.frontiersin.org'), 'article-journal'));
  it('MDPI → journal', () => assertEqual(detectSiteType('www.mdpi.com'), 'article-journal'));
  it('BMJ → journal', () => assertEqual(detectSiteType('www.bmj.com'), 'article-journal'));
  it('PLOS → journal', () => assertEqual(detectSiteType('journals.plos.org'), 'article-journal'));
  it('BioMed Central → journal', () => assertEqual(detectSiteType('bmcbiol.biomedcentral.com'), 'article-journal'));
  it('Nature → journal', () => assertEqual(detectSiteType('www.nature.com'), 'article-journal'));
  it('Cell → journal', () => assertEqual(detectSiteType('www.cell.com'), 'article-journal'));
  it('Lancet → journal', () => assertEqual(detectSiteType('www.thelancet.com'), 'article-journal'));
  it('NEJM → journal', () => assertEqual(detectSiteType('www.nejm.org'), 'article-journal'));
  it('PNAS → journal', () => assertEqual(detectSiteType('www.pnas.org'), 'article-journal'));
  it('Science/AAAS → journal', () => assertEqual(detectSiteType('www.science.org'), 'article-journal'));
  it('DOI URL → journal', () => assertEqual(detectTypeFromUrl('https://journals.asm.org/doi/abs/10.1128/mr.59.3.423-450.1995'), 'article-journal'));
  it('DOI full URL → journal', () => assertEqual(detectTypeFromUrl('https://example.com/doi/full/10.1234/test'), 'article-journal'));
  it('Non-DOI URL → null', () => assertEqual(detectTypeFromUrl('https://example.com/page'), null));
  it('Unknown site → webpage', () => assertEqual(detectSiteType('example.com'), 'webpage'));
  it('GitHub → webpage', () => assertEqual(detectSiteType('github.com'), 'webpage'));
});

// =============================================================================
// NER-based author detection patterns
// =============================================================================

function extractBylineAuthor(text) {
  const patterns = [
    /\b(?:By|Written by|Author|Authors?:)\s+([A-Z][a-z]+ (?:[A-Z]\.?\s+)?[A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+ (?:[A-Z]\.?\s+)?[A-Z][a-z]+)?)/,
    /\b(?:By|Written by)\s+([A-Z][a-z]+ [A-Z][a-z]+(?:\s*(?:,|and)\s*[A-Z][a-z]+ [A-Z][a-z]+)*)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractDateFromText(text) {
  const patterns = [
    /(?:Published|Posted|Updated)\s*:?\s*(\w+ \d{1,2},?\s+\d{4})/i,
    /(?:Published|Posted|Updated)\s+(?:on\s+)?(\d{1,2}\s+\w+\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})T/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

describe('NER — Byline author detection', () => {
  it('detects "By FirstName LastName"', () => {
    assertEqual(extractBylineAuthor('By John Smith'), 'John Smith');
  });
  it('detects "Written by Name"', () => {
    assertEqual(extractBylineAuthor('Written by Jane Doe'), 'Jane Doe');
  });
  it('detects "Author: Name"', () => {
    assertEqual(extractBylineAuthor('Author: Sarah Wilson'), 'Sarah Wilson');
  });
  it('detects two authors with "and"', () => {
    const r = extractBylineAuthor('By John Smith and Jane Doe');
    assert(r !== null, 'Should detect');
    assertContains(r, 'John Smith');
  });
  it('ignores lowercase (not a name)', () => {
    assertEqual(extractBylineAuthor('by the editorial team'), null);
  });
  it('handles middle initial', () => {
    const r = extractBylineAuthor('By John A. Smith');
    assert(r !== null, `Should detect: ${r}`);
    assertContains(r, 'Smith');
  });
});

describe('NER — Date detection from text', () => {
  it('detects "Published March 15, 2024"', () => {
    assertEqual(extractDateFromText('Published March 15, 2024'), 'March 15, 2024');
  });
  it('detects "Posted on 15 March 2024"', () => {
    assertEqual(extractDateFromText('Posted on 15 March 2024'), '15 March 2024');
  });
  it('detects "Updated: January 5, 2023"', () => {
    const r = extractDateFromText('Updated: January 5, 2023');
    assert(r !== null, 'Should detect');
    assertContains(r, '2023');
  });
  it('detects ISO date in text', () => {
    assertEqual(extractDateFromText('timestamp 2024-03-15T10:00:00Z'), '2024-03-15');
  });
  it('returns null for no date', () => {
    assertEqual(extractDateFromText('No date information here'), null);
  });
});

// =============================================================================
// Custom style template rendering
// =============================================================================

function applyTemplate(template, data) {
  const author = data.author || '';
  const year = data.year || 'n.d.';
  return template
    .replace('{author}', author)
    .replace('{year}', year)
    .replace('{title}', data.title || '')
    .replace('{container}', data.container || '')
    .replace('{volume}', data.volume || '')
    .replace('{issue}', data.issue || '')
    .replace('{page}', data.page || '')
    .replace('{doi}', data.doi || '')
    .replace('{url}', data.url || '')
    .replace('{publisher}', data.publisher || '')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\(\)/g, '')
    .replace(/\.\./g, '.');
}

describe('Custom style template rendering', () => {
  const data = { author: 'Smith, J.', year: '2024', title: 'Test Article', container: 'Nature', volume: '42', issue: '3', page: '100-120', doi: 'https://doi.org/10.1038/test' };

  it('renders APA-like template', () => {
    const r = applyTemplate('{author}. ({year}). {title}. *{container}*, *{volume}*({issue}), {page}. {doi}', data);
    assertContains(r, 'Smith, J.');
    assertContains(r, '(2024)');
    assertContains(r, '<i>Nature</i>');
    assertContains(r, '10.1038');
  });

  it('renders MLA-like template', () => {
    const r = applyTemplate('{author}. "{title}." *{container}*, vol. {volume}, no. {issue}, {year}, pp. {page}.', data);
    assertContains(r, '"Test Article."');
    assertContains(r, 'vol. 42');
    assertContains(r, 'pp. 100-120');
  });

  it('handles missing fields gracefully', () => {
    const r = applyTemplate('{author}. ({year}). {title}. {doi}', { author: 'Smith', year: '2024', title: 'T', doi: '' });
    assert(!r.includes('undefined'), 'No undefined');
    assert(!r.includes('{'), 'No unresolved placeholders');
  });

  it('converts *text* to italic', () => {
    const r = applyTemplate('*{title}*', { title: 'Book Title' });
    assertEqual(r, '<i>Book Title</i>');
  });

  it('removes empty parentheses', () => {
    const r = applyTemplate('{author} ({year})', { author: 'Smith', year: '' });
    // year is empty → ({year}) → () → removed
    assert(!r.includes('()'), 'No empty parens');
  });

  it('handles n.d. default', () => {
    const r = applyTemplate('{author}. ({year}).', { author: 'Smith' });
    assertContains(r, 'n.d.');
  });
});

// =============================================================================
// PDF page detection
// =============================================================================

function isPdfUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf')) return true;
  if (lower.includes('/pdf/') || lower.includes('pdf?') || lower.includes('.pdf?')) return true;
  return false;
}

describe('PDF detection', () => {
  it('detects .pdf extension', () => assert(isPdfUrl('https://example.com/paper.pdf')));
  it('detects .pdf with query string', () => assert(isPdfUrl('https://example.com/paper.pdf?dl=1')));
  it('detects /pdf/ in path', () => assert(isPdfUrl('https://arxiv.org/pdf/2301.07041')));
  it('rejects normal webpage', () => assert(!isPdfUrl('https://example.com/page')));
  it('rejects null', () => assert(!isPdfUrl(null)));
  it('rejects empty', () => assert(!isPdfUrl('')));
});

// =============================================================================
// Omnibox identifier detection
// =============================================================================

function detectOmniboxType(input) {
  const t = input.trim();
  if (t.match(/^10\.\d{4,}/) || t.match(/^doi:/i)) return 'doi';
  if (t.match(/^isbn:/i) || t.replace(/[-\s]/g, '').match(/^(97[89])?\d{9}[\dXx]$/)) return 'isbn';
  if (t.match(/^pmid:/i) || t.match(/^\d{6,8}$/)) return 'pmid';
  if (t.match(/^arxiv:/i) || t.match(/^\d{4}\.\d{4,5}/)) return 'arxiv';
  if (t.startsWith('http')) return 'url';
  return 'search';
}

describe('Omnibox input detection', () => {
  it('detects DOI', () => assertEqual(detectOmniboxType('10.1038/nature12373'), 'doi'));
  it('detects doi: prefix', () => assertEqual(detectOmniboxType('doi:10.1038/test'), 'doi'));
  it('detects ISBN', () => assertEqual(detectOmniboxType('isbn:978-0-13-468599-1'), 'isbn'));
  it('detects bare ISBN', () => assertEqual(detectOmniboxType('9780134685991'), 'isbn'));
  it('detects PMID', () => assertEqual(detectOmniboxType('pmid:12345678'), 'pmid'));
  it('detects bare PMID (6+ digits)', () => assertEqual(detectOmniboxType('12345678'), 'pmid'));
  it('detects arXiv', () => assertEqual(detectOmniboxType('arxiv:2301.07041'), 'arxiv'));
  it('detects bare arXiv ID', () => assertEqual(detectOmniboxType('2301.07041'), 'arxiv'));
  it('detects URL', () => assertEqual(detectOmniboxType('https://example.com'), 'url'));
  it('falls back to search', () => assertEqual(detectOmniboxType('climate change'), 'search'));
  it('search for short text', () => assertEqual(detectOmniboxType('smith'), 'search'));
});

// =============================================================================
// Badge count formatting
// =============================================================================

function formatBadgeCount(count) {
  if (count <= 0) return '';
  if (count > 999) return '999+';
  return count.toString();
}

describe('Badge count formatting', () => {
  it('empty for 0', () => assertEqual(formatBadgeCount(0), ''));
  it('shows number for small count', () => assertEqual(formatBadgeCount(5), '5'));
  it('shows number for 999', () => assertEqual(formatBadgeCount(999), '999'));
  it('shows 999+ for large count', () => assertEqual(formatBadgeCount(1000), '999+'));
  it('shows 999+ for very large', () => assertEqual(formatBadgeCount(50000), '999+'));
  it('empty for negative', () => assertEqual(formatBadgeCount(-1), ''));
});

// =============================================================================
// arXiv ID extraction from URL
// =============================================================================

function extractArxivId(url) {
  const m = url.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/);
  return m ? m[1] : null;
}

describe('arXiv ID extraction', () => {
  it('extracts from abs URL', () => assertEqual(extractArxivId('https://arxiv.org/abs/2301.07041'), '2301.07041'));
  it('extracts 5-digit ID', () => assertEqual(extractArxivId('https://arxiv.org/abs/2301.12345'), '2301.12345'));
  it('returns null for non-arxiv', () => assertEqual(extractArxivId('https://example.com'), null));
  it('returns null for pdf URL', () => assertEqual(extractArxivId('https://arxiv.org/pdf/2301.07041'), null));
});

// =============================================================================
// DOI cleaning
// =============================================================================

function cleanDoi(doi) {
  if (!doi) return null;
  return doi
    .replace(/[?#].*$/, '')
    .replace(/[.,;:)\]}>]+$/, '')
    .replace(/\/+$/, '')
    .trim();
}

describe('DOI cleaning', () => {
  it('strips ?download=true', () => {
    assertEqual(cleanDoi('10.1128/mr.59.3.423-450.1995?download=true'), '10.1128/mr.59.3.423-450.1995');
  });
  it('strips query strings', () => {
    assertEqual(cleanDoi('10.1038/nature12373?ref=pdf'), '10.1038/nature12373');
  });
  it('strips fragments', () => {
    assertEqual(cleanDoi('10.1038/nature12373#section1'), '10.1038/nature12373');
  });
  it('strips trailing period', () => {
    assertEqual(cleanDoi('10.1038/nature12373.'), '10.1038/nature12373');
  });
  it('strips trailing comma', () => {
    assertEqual(cleanDoi('10.1038/nature12373,'), '10.1038/nature12373');
  });
  it('strips trailing parenthesis', () => {
    assertEqual(cleanDoi('10.1038/nature12373)'), '10.1038/nature12373');
  });
  it('strips trailing slash', () => {
    assertEqual(cleanDoi('10.1038/nature12373/'), '10.1038/nature12373');
  });
  it('handles complex query', () => {
    assertEqual(cleanDoi('10.1128/mr.59.3.423-450.1995?download=true&ref=header'), '10.1128/mr.59.3.423-450.1995');
  });
  it('preserves valid DOI', () => {
    assertEqual(cleanDoi('10.1038/s41558-023-01234-5'), '10.1038/s41558-023-01234-5');
  });
  it('handles null', () => {
    assertEqual(cleanDoi(null), null);
  });
});
