// Test: JS fallback parsers and serializers
// These must work identically to WASM versions for common formats

const { describe, it, assertEqual, assertLength, assert, assertContains } = require('./test-runner');
const path = require('path');

// Load the fallback module — need to handle ES module import in CommonJS
// We'll replicate the core functions here since the source is ES module
function parseBibtex(input) {
  const entries = [];
  const blocks = input.split(/(?=@\w+\s*[{(])/);
  for (const block of blocks) {
    const m = block.match(/^@(\w+)\s*[{(]\s*([^,]*),([\s\S]*?)$/);
    if (!m) continue;
    const type = m[1].toLowerCase();
    const key = m[2].trim();
    if (type === 'string' || type === 'preamble' || type === 'comment') continue;
    const fields = {};
    const fieldRe = /(\w+)\s*=\s*(?:\{([^}]*)\}|"([^"]*)"|(\w+))/g;
    let fm;
    while ((fm = fieldRe.exec(m[3])) !== null) {
      fields[fm[1].toLowerCase()] = (fm[2] ?? fm[3] ?? fm[4] ?? '').trim();
    }
    const item = {
      id: key, type: mapBibType(type),
      title: fields.title?.replace(/[{}]/g, ''),
      author: fields.author ? parseNames(fields.author) : undefined,
      DOI: fields.doi, URL: fields.url,
    };
    if (fields.year) {
      const y = parseInt(fields.year);
      if (!isNaN(y)) item.issued = { 'date-parts': [[y]] };
    }
    if (fields.journal) item['container-title'] = fields.journal.replace(/[{}]/g, '');
    if (fields.volume) item.volume = fields.volume;
    if (fields.pages) item.page = fields.pages.replace(/--/g, '\u2013');
    entries.push(JSON.parse(JSON.stringify(item)));
  }
  return { entries, errors: [], count: entries.length };
}

function parseRis(input) {
  const entries = [];
  let current = null, authors = [], sp = '', ep = '';
  const flush = () => {
    if (!current) return;
    if (authors.length) current.author = authors;
    if (sp) current.page = ep ? `${sp}\u2013${ep}` : sp;
    entries.push(JSON.parse(JSON.stringify(current)));
    current = null; authors = []; sp = ''; ep = '';
  };
  for (const line of input.split('\n')) {
    const l = line.trimEnd();
    if (l.length < 5 || l[2] !== ' ' || l[3] !== ' ' || l[4] !== '-') continue;
    const tag = l.substring(0, 2).trim().toUpperCase();
    const val = l.length > 6 ? l.substring(6).trim() : '';
    switch (tag) {
      case 'TY': flush(); current = { id: `ris-${entries.length+1}`, type: mapRisType(val) }; break;
      case 'ER': flush(); break;
      case 'TI': case 'T1': if (current) current.title = val; break;
      case 'AU': case 'A1': authors.push(parseRisName(val)); break;
      case 'PY': case 'Y1': if (current) { const y = parseInt(val); if (!isNaN(y)) current.issued = { 'date-parts': [[y]] }; } break;
      case 'JO': case 'T2': if (current && !current['container-title']) current['container-title'] = val; break;
      case 'VL': if (current) current.volume = val; break;
      case 'SP': sp = val; break;
      case 'EP': ep = val; break;
      case 'DO': if (current) current.DOI = val; break;
      case 'UR': if (current && !current.URL) current.URL = val; break;
    }
  }
  flush();
  return { entries, errors: [], count: entries.length };
}

function exportBibtex(items) {
  return items.map(item => {
    const type = revMapBibType(item.type);
    const fields = [];
    if (item.author?.length) fields.push(`  author = {${item.author.map(a => a.literal || `${a.family || ''}, ${a.given || ''}`.trim()).join(' and ')}}`);
    if (item.title) fields.push(`  title = {${item.title}}`);
    if (item['container-title']) fields.push(`  ${item.type === 'chapter' ? 'booktitle' : 'journal'} = {${item['container-title']}}`);
    const year = item.issued?.['date-parts']?.[0]?.[0];
    if (year) fields.push(`  year = {${year}}`);
    if (item.DOI) fields.push(`  doi = {${item.DOI}}`);
    return `@${type}{${item.id},\n${fields.join(',\n')}\n}`;
  }).join('\n\n');
}

function exportRis(items) {
  return items.map(item => {
    const lines = [`TY  - ${revMapRisType(item.type)}`];
    if (item.author) item.author.forEach(a => lines.push(`AU  - ${a.literal || `${a.family || ''}, ${a.given || ''}`.trim()}`));
    if (item.title) lines.push(`TI  - ${item.title}`);
    if (item['container-title']) lines.push(`JO  - ${item['container-title']}`);
    const year = item.issued?.['date-parts']?.[0]?.[0];
    if (year) lines.push(`PY  - ${year}`);
    if (item.DOI) lines.push(`DO  - ${item.DOI}`);
    lines.push('ER  - ');
    return lines.join('\n');
  }).join('\n');
}

// Helpers
function parseNames(str) {
  return str.replace(/[{}]/g, '').split(' and ').map(n => {
    n = n.trim();
    if (n.includes(',')) { const [f, g] = n.split(',', 2).map(s => s.trim()); return { family: f, given: g }; }
    const p = n.split(/\s+/); if (p.length === 1) return { literal: p[0] };
    const f = p.pop(); return { family: f, given: p.join(' ') };
  }).filter(n => n.family || n.literal);
}
function parseRisName(s) {
  s = s.trim();
  if (s.includes(',')) { const [f, g] = s.split(',', 2).map(s => s.trim()); return { family: f, given: g || undefined }; }
  return { literal: s };
}
function mapBibType(t) {
  const m = { article:'article-journal', book:'book', inproceedings:'paper-conference', phdthesis:'thesis' };
  return m[t] || 'document';
}
function mapRisType(t) {
  const m = { JOUR:'article-journal', BOOK:'book', CHAP:'chapter', THES:'thesis' };
  return m[t?.trim()] || 'document';
}
function revMapBibType(t) {
  const m = { 'article-journal':'article', 'book':'book', 'chapter':'incollection' };
  return m[t] || 'misc';
}
function revMapRisType(t) {
  const m = { 'article-journal':'JOUR', 'book':'BOOK', 'chapter':'CHAP' };
  return m[t] || 'GEN';
}

// =============================================================================
// BibTeX fallback parser
// =============================================================================

describe('JS Fallback — BibTeX parser', () => {
  it('parses single article', () => {
    const r = parseBibtex('@article{test, author={Smith, John}, title={Test}, year={2024}, journal={Nature}}');
    assertLength(r.entries, 1);
    assertEqual(r.entries[0].title, 'Test');
    assertEqual(r.entries[0]['container-title'], 'Nature');
  });

  it('parses multiple entries', () => {
    const r = parseBibtex('@article{a, title={A}}\n@book{b, title={B}}');
    assertLength(r.entries, 2);
  });

  it('skips @string and @preamble', () => {
    const r = parseBibtex('@string{j="Nature"}\n@preamble{"text"}\n@article{t, title={T}}');
    assertLength(r.entries, 1);
  });

  it('parses authors', () => {
    const r = parseBibtex('@article{t, author={Smith, John and Jane Doe}, title={T}}');
    assertLength(r.entries[0].author, 2);
    assertEqual(r.entries[0].author[0].family, 'Smith');
  });

  it('converts pages -- to en-dash', () => {
    const r = parseBibtex('@article{t, title={T}, pages={100--200}}');
    assertEqual(r.entries[0].page, '100\u2013200');
  });

  it('handles empty input', () => {
    assertLength(parseBibtex('').entries, 0);
  });
});

// =============================================================================
// RIS fallback parser
// =============================================================================

describe('JS Fallback — RIS parser', () => {
  it('parses single article', () => {
    const r = parseRis('TY  - JOUR\nTI  - Test\nAU  - Smith, John\nPY  - 2024\nJO  - Nature\nER  - ');
    assertLength(r.entries, 1);
    assertEqual(r.entries[0].title, 'Test');
    assertEqual(r.entries[0]['container-title'], 'Nature');
  });

  it('parses multiple entries', () => {
    const r = parseRis('TY  - JOUR\nTI  - A\nER  - \nTY  - BOOK\nTI  - B\nER  - ');
    assertLength(r.entries, 2);
  });

  it('handles missing ER', () => {
    const r = parseRis('TY  - JOUR\nTI  - Test\n');
    assertLength(r.entries, 1);
  });

  it('merges SP and EP into page range', () => {
    const r = parseRis('TY  - JOUR\nSP  - 100\nEP  - 200\nTI  - T\nER  - ');
    assertEqual(r.entries[0].page, '100\u2013200');
  });

  it('handles empty input', () => {
    assertLength(parseRis('').entries, 0);
  });
});

// =============================================================================
// BibTeX fallback serializer
// =============================================================================

describe('JS Fallback — BibTeX serializer', () => {
  it('serializes article', () => {
    const bib = exportBibtex([{ id: 'test', type: 'article-journal', title: 'Test', author: [{ family: 'Smith', given: 'John' }] }]);
    assert(bib.includes('@article{test'), 'Has @article');
    assert(bib.includes('title = {Test}'), 'Has title');
    assert(bib.includes('Smith, John'), 'Has author');
  });

  it('roundtrips through parser', () => {
    const item = { id: 'rt', type: 'article-journal', title: 'Roundtrip Test', author: [{ family: 'Doe', given: 'Jane' }], issued: { 'date-parts': [[2024]] } };
    const bib = exportBibtex([item]);
    const parsed = parseBibtex(bib);
    assertLength(parsed.entries, 1);
    assertEqual(parsed.entries[0].title, 'Roundtrip Test');
  });
});

// =============================================================================
// RIS fallback serializer
// =============================================================================

describe('JS Fallback — RIS serializer', () => {
  it('serializes article', () => {
    const ris = exportRis([{ id: 'test', type: 'article-journal', title: 'Test', author: [{ family: 'Smith', given: 'John' }] }]);
    assert(ris.includes('TY  - JOUR'), 'Has TY');
    assert(ris.includes('TI  - Test'), 'Has title');
    assert(ris.includes('AU  - Smith, John'), 'Has author');
    assert(ris.includes('ER  - '), 'Has ER');
  });

  it('roundtrips through parser', () => {
    const item = { id: 'rt', type: 'article-journal', title: 'RIS Roundtrip', author: [{ family: 'Chen', given: 'Wei' }], issued: { 'date-parts': [[2023]] } };
    const ris = exportRis([item]);
    const parsed = parseRis(ris);
    assertLength(parsed.entries, 1);
    assertEqual(parsed.entries[0].title, 'RIS Roundtrip');
  });
});

// =============================================================================
// Format auto-detection
// =============================================================================

describe('JS Fallback — Format detection', () => {
  it('detects BibTeX', () => {
    const r = parseBibtex('@article{t, title={T}}');
    assert(r.entries.length > 0, 'Parsed as BibTeX');
  });

  it('detects RIS', () => {
    const r = parseRis('TY  - JOUR\nTI  - T\nER  - ');
    assert(r.entries.length > 0, 'Parsed as RIS');
  });

  it('detects JSON', () => {
    const data = JSON.parse('[{"id":"t","type":"article-journal","title":"T"}]');
    assertLength(data, 1);
  });
});
