// Ibid — JS Fallback Parsers & Serializers
// Used when WASM engine is unavailable (failed to load, CSP issues, etc.)
// Covers the most common formats: BibTeX, RIS, CSL-JSON, CSV

// =============================================================================
// BibTeX Parser (JS fallback)
// =============================================================================

export function parseBibtex(input) {
  const entries = [];
  const errors = [];

  // Match @type{key, ...}
  const entryRe = /@(\w+)\s*[{(]\s*([^,]*),([^@]*?)(?:[})])\s*$/gms;
  let match;

  // Simpler approach: split on @ entries
  const blocks = input.split(/(?=@\w+\s*[{(])/);

  for (const block of blocks) {
    const m = block.match(/^@(\w+)\s*[{(]\s*([^,]*),([\s\S]*?)$/);
    if (!m) continue;

    const type = m[1].toLowerCase();
    const key = m[2].trim();
    if (type === 'string' || type === 'preamble' || type === 'comment') continue;

    // Extract fields
    const fields = {};
    const fieldRe = /(\w+)\s*=\s*(?:\{([^}]*)\}|"([^"]*)"|(\w+))/g;
    let fm;
    const body = m[3];
    while ((fm = fieldRe.exec(body)) !== null) {
      fields[fm[1].toLowerCase()] = (fm[2] ?? fm[3] ?? fm[4] ?? '').trim();
    }

    const item = {
      id: key,
      type: mapBibType(type),
      title: stripBraces(fields.title),
      author: fields.author ? parseNames(fields.author) : undefined,
      editor: fields.editor ? parseNames(fields.editor) : undefined,
      issued: parseYear(fields.year, fields.month, fields.date),
      'container-title': stripBraces(fields.journal || fields.journaltitle || fields.booktitle),
      volume: fields.volume || undefined,
      issue: fields.number || fields.issue || undefined,
      page: fields.pages ? fields.pages.replace(/--/g, '\u2013') : undefined,
      publisher: stripBraces(fields.publisher),
      DOI: fields.doi || undefined,
      ISBN: fields.isbn || undefined,
      ISSN: fields.issn || undefined,
      URL: fields.url || (fields.howpublished?.startsWith('http') ? fields.howpublished : undefined),
      abstract: fields.abstract || undefined,
      note: fields.note || undefined,
      keyword: fields.keywords || fields.keyword || undefined,
      language: fields.language || undefined,
    };

    // Clean undefined
    entries.push(JSON.parse(JSON.stringify(item)));
  }

  return { entries, errors, count: entries.length };
}

// =============================================================================
// RIS Parser (JS fallback)
// =============================================================================

export function parseRis(input) {
  const entries = [];
  const errors = [];
  let current = null;
  let authors = [];
  let editors = [];
  let keywords = [];
  let sp = '', ep = '';
  let count = 0;

  const flush = () => {
    if (!current) return;
    if (authors.length) current.author = authors;
    if (editors.length) current.editor = editors;
    if (keywords.length) current.keyword = keywords.join(', ');
    if (sp) current.page = ep ? `${sp}\u2013${ep}` : sp;
    entries.push(JSON.parse(JSON.stringify(current)));
    current = null;
    authors = []; editors = []; keywords = [];
    sp = ''; ep = '';
  };

  for (const line of input.split('\n')) {
    const l = line.trimEnd();
    if (l.length < 5 || l[2] !== ' ' || l[3] !== ' ' || l[4] !== '-') continue;

    const tag = l.substring(0, 2).trim().toUpperCase();
    const val = l.length > 6 ? l.substring(6).trim() : '';

    switch (tag) {
      case 'TY':
        flush();
        count++;
        current = { id: `ris-${count}`, type: mapRisType(val) };
        break;
      case 'ER': flush(); break;
      case 'TI': case 'T1': if (current) current.title = val; break;
      case 'AU': case 'A1': authors.push(parseRisName(val)); break;
      case 'A2': case 'ED': editors.push(parseRisName(val)); break;
      case 'T2': case 'JO': case 'JF': case 'BT':
        if (current && !current['container-title']) current['container-title'] = val; break;
      case 'PY': case 'Y1':
        if (current) {
          const parts = val.split('/').filter(Boolean).map(Number).filter(n => !isNaN(n));
          if (parts.length) current.issued = { 'date-parts': [parts] };
        }
        break;
      case 'DA':
        if (current && !current.issued) {
          const parts = val.split('/').filter(Boolean).map(Number).filter(n => !isNaN(n));
          if (parts.length) current.issued = { 'date-parts': [parts] };
        }
        break;
      case 'VL': if (current) current.volume = val; break;
      case 'IS': case 'CP': if (current) current.issue = val; break;
      case 'SP': sp = val; break;
      case 'EP': ep = val; break;
      case 'DO': if (current) current.DOI = val; break;
      case 'UR': case 'L1': if (current && !current.URL) current.URL = val; break;
      case 'PB': if (current) current.publisher = val; break;
      case 'AB': case 'N2': if (current) current.abstract = val; break;
      case 'KW': keywords.push(val); break;
      case 'SN':
        if (current) {
          if (val.includes('978') || val.includes('979') || val.length > 10) current.ISBN = val;
          else current.ISSN = val;
        }
        break;
      case 'LA': if (current) current.language = val; break;
      case 'N1': if (current) current.note = val; break;
    }
  }
  flush();

  return { entries, errors, count: entries.length };
}

// =============================================================================
// CSL-JSON Parser (JS fallback — trivial)
// =============================================================================

export function parseCslJson(input) {
  try {
    const data = JSON.parse(input.trim());
    const entries = Array.isArray(data) ? data : [data];
    return { entries, errors: [], count: entries.length };
  } catch (e) {
    return { entries: [], errors: [e.message], count: 0 };
  }
}

// =============================================================================
// BibTeX Serializer (JS fallback)
// =============================================================================

export function exportBibtex(items) {
  return items.map(item => {
    const type = revMapBibType(item.type);
    const key = item.id || 'ref';
    const fields = [];

    if (item.author?.length) fields.push(`  author = {${item.author.map(fmtName).join(' and ')}}`);
    if (item.title) fields.push(`  title = {${item.title}}`);
    if (item['container-title']) {
      fields.push(`  ${item.type === 'chapter' ? 'booktitle' : 'journal'} = {${item['container-title']}}`);
    }
    const year = item.issued?.['date-parts']?.[0]?.[0];
    if (year) fields.push(`  year = {${year}}`);
    if (item.volume) fields.push(`  volume = {${item.volume}}`);
    if (item.issue) fields.push(`  number = {${item.issue}}`);
    if (item.page) fields.push(`  pages = {${item.page.replace('\u2013', '--')}}`);
    if (item.publisher) fields.push(`  publisher = {${item.publisher}}`);
    if (item.DOI) fields.push(`  doi = {${item.DOI}}`);
    if (item.URL) fields.push(`  url = {${item.URL}}`);
    if (item.ISBN) fields.push(`  isbn = {${item.ISBN}}`);

    return `@${type}{${key},\n${fields.join(',\n')}\n}`;
  }).join('\n\n');
}

// =============================================================================
// RIS Serializer (JS fallback)
// =============================================================================

export function exportRis(items) {
  return items.map(item => {
    const lines = [`TY  - ${revMapRisType(item.type)}`];
    if (item.author) item.author.forEach(a => lines.push(`AU  - ${fmtName(a)}`));
    if (item.title) lines.push(`TI  - ${item.title}`);
    if (item['container-title']) lines.push(`JO  - ${item['container-title']}`);
    const year = item.issued?.['date-parts']?.[0]?.[0];
    if (year) lines.push(`PY  - ${year}`);
    if (item.volume) lines.push(`VL  - ${item.volume}`);
    if (item.issue) lines.push(`IS  - ${item.issue}`);
    if (item.page) {
      const [sp, ep] = item.page.split('\u2013');
      lines.push(`SP  - ${sp}`);
      if (ep) lines.push(`EP  - ${ep}`);
    }
    if (item.DOI) lines.push(`DO  - ${item.DOI}`);
    if (item.URL) lines.push(`UR  - ${item.URL}`);
    if (item.publisher) lines.push(`PB  - ${item.publisher}`);
    lines.push('ER  - ');
    return lines.join('\n');
  }).join('\n');
}

// =============================================================================
// CSV Serializer (JS fallback)
// =============================================================================

export function exportCsv(items, delimiter = ',') {
  const headers = ['type','title','author','year','container-title','volume','issue','pages','DOI','URL','publisher'];
  let out = headers.join(delimiter) + '\n';

  for (const item of items) {
    const authors = (item.author || []).map(a => a.literal || `${a.family || ''}, ${a.given || ''}`.trim()).join('; ');
    const year = item.issued?.['date-parts']?.[0]?.[0] || '';
    const row = [
      item.type || '', item.title || '', authors, year,
      item['container-title'] || '', item.volume || '', item.issue || '',
      item.page || '', item.DOI || '', item.URL || '', item.publisher || ''
    ].map(f => f.toString().includes(delimiter) || f.includes('"') ? `"${f.replace(/"/g, '""')}"` : f);
    out += row.join(delimiter) + '\n';
  }
  return out;
}

// =============================================================================
// Auto-detect format
// =============================================================================

export function autoDetectAndParse(text) {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('@')) return parseBibtex(text);
  if (/^TY\s\s-/.test(trimmed) || /^[A-Z][A-Z0-9]\s\s-/.test(trimmed)) return parseRis(text);
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return parseCslJson(text);
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<xml') || trimmed.startsWith('<records')) {
    return { entries: [], errors: ['EndNote XML requires the WASM engine. Please reload the extension.'], count: 0 };
  }
  if (/^PMID- /.test(trimmed)) {
    return { entries: [], errors: ['MEDLINE format requires the WASM engine. Please reload the extension.'], count: 0 };
  }
  // Try CSV
  const firstLine = trimmed.split('\n')[0];
  if (firstLine.includes('\t') && firstLine.split('\t').length >= 3) {
    return { entries: [], errors: ['TSV import requires the WASM engine. Please reload the extension.'], count: 0 };
  }
  if (firstLine.split(',').length >= 3) {
    return { entries: [], errors: ['CSV import requires the WASM engine. Please reload the extension.'], count: 0 };
  }
  // Try extracting DOIs and ISBNs from plain text
  const cleaned = text.replace(/[\r\n]+/g, ' ').replace(/(10\.\d{4,}\/)\s+/g, '$1').replace(/\/\s+/g, '/');
  const doiMatches = [...cleaned.matchAll(/10\.\d{4,}\/[^\s"'<>)\]},;]{3,}/g)]
    .map(m => m[0].replace(/[.,;:)\]}>]+$/, ''));
  const isbnMatches = [...cleaned.matchAll(/(?:97[89][\s-]?\d[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d)/g)]
    .map(m => m[0].replace(/[\s-]/g, ''));
  const uniqueDois = [...new Set(doiMatches)];
  const uniqueIsbns = [...new Set(isbnMatches)];
  const entries = [
    ...uniqueDois.map(doi => ({ id: doi, type: 'article-journal', DOI: doi, title: `DOI: ${doi}`, _needsEnhance: true })),
    ...uniqueIsbns.map(isbn => ({ id: isbn, type: 'book', ISBN: isbn, title: `ISBN: ${isbn}`, _needsEnhance: true })),
  ];
  if (entries.length > 0) {
    return { entries, errors: [], count: entries.length, _doiList: true };
  }

  return { entries: [], errors: ['Could not detect format. Supported: BibTeX, RIS, CSL-JSON, or text with DOIs/ISBNs.'], count: 0 };
}

// =============================================================================
// Helpers
// =============================================================================

function stripBraces(s) {
  if (!s) return undefined;
  return s.replace(/[{}]/g, '').trim() || undefined;
}

function parseNames(str) {
  if (!str) return undefined;
  return str.replace(/[{}]/g, '').split(' and ').map(n => {
    n = n.trim();
    if (n.includes(',')) {
      const [family, given] = n.split(',', 2).map(s => s.trim());
      return { family, given };
    }
    const parts = n.split(/\s+/);
    if (parts.length === 1) return { literal: parts[0] };
    const family = parts.pop();
    return { family, given: parts.join(' ') };
  }).filter(n => n.family || n.literal);
}

function parseRisName(str) {
  str = str.trim();
  if (str.includes(',')) {
    const [family, given] = str.split(',', 2).map(s => s.trim());
    return { family, given: given || undefined };
  }
  return { literal: str };
}

function parseYear(year, month, date) {
  if (date) {
    const parts = date.split('-').map(Number).filter(n => !isNaN(n));
    if (parts.length) return { 'date-parts': [parts] };
  }
  if (year) {
    const y = parseInt(year);
    if (!isNaN(y)) {
      const parts = [y];
      if (month) {
        const m = parseMonthStr(month);
        if (m) parts.push(m);
      }
      return { 'date-parts': [parts] };
    }
  }
  return undefined;
}

function parseMonthStr(s) {
  const m = (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
  return months[m.slice(0, 3)] || parseInt(m) || null;
}

function fmtName(a) {
  if (a.literal) return a.literal;
  return `${a.family || ''}${a.given ? ', ' + a.given : ''}`;
}

function mapBibType(t) {
  const map = { article:'article-journal', book:'book', inbook:'chapter', incollection:'chapter',
    inproceedings:'paper-conference', conference:'paper-conference', phdthesis:'thesis',
    mastersthesis:'thesis', thesis:'thesis', techreport:'report', report:'report',
    misc:'document', online:'webpage', unpublished:'manuscript' };
  return map[t] || 'document';
}

function revMapBibType(t) {
  const map = { 'article-journal':'article', 'book':'book', 'chapter':'incollection',
    'paper-conference':'inproceedings', 'thesis':'phdthesis', 'report':'techreport',
    'webpage':'online', 'manuscript':'unpublished' };
  return map[t] || 'misc';
}

function mapRisType(t) {
  const map = { JOUR:'article-journal', BOOK:'book', CHAP:'chapter', CONF:'paper-conference',
    THES:'thesis', RPRT:'report', NEWS:'article-newspaper', ELEC:'webpage', BLOG:'post-weblog',
    PAT:'patent', COMP:'software' };
  return map[t?.trim()] || 'document';
}

function revMapRisType(t) {
  const map = { 'article-journal':'JOUR', 'book':'BOOK', 'chapter':'CHAP',
    'paper-conference':'CPAPER', 'thesis':'THES', 'report':'RPRT', 'webpage':'ELEC' };
  return map[t] || 'GEN';
}
