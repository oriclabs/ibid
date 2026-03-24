// Ibid — Identifier Resolver
// Resolves DOI, ISBN, PMID, arXiv to CSL-JSON metadata via public APIs

const REQUEST_TIMEOUT = 15000; // 15 seconds (arXiv API is slow)

// ---------------------------------------------------------------------------
// Fetch with timeout and error context
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url, options = {}, context = '') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      if (res.status === 404) throw new Error(`${context}: Not found (404)`);
      if (res.status === 429) throw new Error(`${context}: Rate limited. Try again in a moment.`);
      if (res.status >= 500) throw new Error(`${context}: Server error (${res.status}). Try again later.`);
      throw new Error(`${context}: Request failed (${res.status})`);
    }
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`${context}: Request timed out after ${REQUEST_TIMEOUT / 1000}s. Check your connection.`);
    }
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error(`${context}: Network error. Are you offline?`);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// DOI → CrossRef
// ---------------------------------------------------------------------------

export async function resolveDoi(doi) {
  // Normalize DOI — strip URL prefix, query strings, fragments, trailing punctuation
  doi = doi.replace(/^https?:\/\/doi\.org\//, '').trim();
  doi = doi.replace(/[?#].*$/, '');           // strip ?query and #fragment
  doi = doi.replace(/[.,;:)\]}>]+$/, '');     // strip trailing punctuation
  doi = doi.trim();
  if (!doi.match(/^10\.\d{4,}/)) throw new Error('Invalid DOI format');

  const res = await fetchWithTimeout(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    { headers: { 'User-Agent': 'Ibid/0.1.0 (citation-manager; mailto:support@ibid.tools)' } },
    'CrossRef'
  );

  const data = await res.json();
  const item = data.message;
  if (!item) throw new Error('CrossRef: No data returned for this DOI');

  return {
    type: mapCrossrefType(item.type),
    title: item.title?.[0] || null,
    author: (item.author || []).map((a) => ({
      family: a.family || null,
      given: a.given || null,
    })),
    issued: item.issued?.['date-parts']?.[0]
      ? { 'date-parts': [item.issued['date-parts'][0]] }
      : null,
    'container-title': item['container-title']?.[0] || null,
    volume: item.volume || null,
    issue: item.issue || null,
    page: item.page || null,
    publisher: item.publisher || null,
    DOI: item.DOI || doi,
    ISSN: item.ISSN?.[0] || null,
    ISBN: item.ISBN?.[0] || null,
    URL: item.URL || `https://doi.org/${doi}`,
    abstract: item.abstract || null,
    language: item.language || null,
    _source: 'crossref',
  };
}

function mapCrossrefType(type) {
  const map = {
    'journal-article': 'article-journal',
    'book-chapter': 'chapter',
    'proceedings-article': 'paper-conference',
    'book': 'book',
    'monograph': 'book',
    'report': 'report',
    'dataset': 'dataset',
    'posted-content': 'article',
    'dissertation': 'thesis',
  };
  return map[type] || 'article';
}

// ---------------------------------------------------------------------------
// ISBN → Open Library
// ---------------------------------------------------------------------------

export async function resolveIsbn(isbn) {
  isbn = isbn.replace(/[-\s]/g, '').trim();
  if (!isbn.match(/^(97[89])?\d{9}[\dXx]$/)) throw new Error('Invalid ISBN format');

  const res = await fetchWithTimeout(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    {},
    'Open Library'
  );

  const data = await res.json();
  const key = `ISBN:${isbn}`;
  const book = data[key];
  if (!book) throw new Error('Open Library: ISBN not found in database');

  return {
    type: 'book',
    title: book.title || null,
    author: (book.authors || []).map((a) => {
      const parts = (a.name || '').split(' ');
      if (parts.length === 1) return { literal: parts[0] };
      const family = parts.pop();
      return { family, given: parts.join(' ') };
    }),
    issued: book.publish_date ? parseFuzzyDate(book.publish_date) : null,
    publisher: book.publishers?.[0]?.name || null,
    'publisher-place': book.publish_places?.[0]?.name || null,
    'number-of-pages': book.number_of_pages?.toString() || null,
    ISBN: isbn,
    URL: book.url || null,
    _source: 'openlibrary',
  };
}

// ---------------------------------------------------------------------------
// PMID → NCBI E-utilities
// ---------------------------------------------------------------------------

export async function resolvePmid(pmid) {
  pmid = pmid.replace(/^pmid:\s*/i, '').trim();
  if (!pmid.match(/^\d+$/)) throw new Error('Invalid PMID format');

  const res = await fetchWithTimeout(
    `https://api.ncbi.nlm.nih.gov/lit/ctxp/v1/pubmed/?format=csl&id=${pmid}`,
    {},
    'NCBI/PubMed'
  );

  const item = await res.json();
  if (!item || item.error) throw new Error('NCBI: PMID not found');

  // NCBI returns CSL-JSON directly
  return {
    ...item,
    _source: 'ncbi',
  };
}

// ---------------------------------------------------------------------------
// arXiv ID → arXiv API
// ---------------------------------------------------------------------------

export async function resolveArxiv(arxivId) {
  arxivId = arxivId.replace(/^arxiv:\s*/i, '').trim();
  if (!arxivId.match(/^\d{4}\.\d{4,5}(v\d+)?$/)) throw new Error('Invalid arXiv ID format');

  // Fetch arXiv abstract page and parse Highwire meta tags (CORS-friendly, no API needed)
  const res = await fetchWithTimeout(
    `https://arxiv.org/abs/${arxivId}`,
    {},
    'arXiv'
  );

  const html = await res.text();

  // Extract citation_* meta tags
  const getMeta = (name) => {
    const m = html.match(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i'));
    return m ? m[1].trim() : null;
  };
  const getAllMeta = (name) => {
    const re = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'gi');
    const results = [];
    let m;
    while ((m = re.exec(html))) results.push(m[1].trim());
    return results;
  };

  const title = getMeta('citation_title');
  const authors = getAllMeta('citation_author');
  const dateStr = getMeta('citation_date') || getMeta('citation_publication_date') || getMeta('citation_online_date');
  const doi = getMeta('citation_doi');
  const abstractMatch = html.match(/<blockquote[^>]*class="abstract[^"]*"[^>]*>[\s\S]*?<span class="descriptor">[^<]*<\/span>\s*([\s\S]*?)<\/blockquote>/i);
  const abstract = abstractMatch ? abstractMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null;

  let issued = null;
  if (dateStr) {
    const parts = dateStr.split(/[/-]/);
    if (parts.length >= 1) {
      issued = { 'date-parts': [[
        parseInt(parts[0]),
        ...(parts[1] ? [parseInt(parts[1])] : []),
        ...(parts[2] ? [parseInt(parts[2])] : []),
      ]] };
    }
  }

  return {
    type: 'article',
    title: title || null,
    author: authors.map((name) => {
      // Highwire format: "Last, First"
      if (name.includes(',')) {
        const [family, given] = name.split(',', 2).map(s => s.trim());
        return { family, given };
      }
      const parts = name.split(' ');
      if (parts.length === 1) return { literal: parts[0] };
      const family = parts.pop();
      return { family, given: parts.join(' ') };
    }),
    issued,
    abstract,
    DOI: doi || `10.48550/arXiv.${arxivId}`,
    URL: `https://arxiv.org/abs/${arxivId}`,
    number: arxivId,
    _source: 'arxiv',
  };
}

// ---------------------------------------------------------------------------
// Auto-detect identifier type and resolve
// ---------------------------------------------------------------------------

export async function resolveIdentifier(input) {
  input = (input || '').trim();
  if (!input) throw new Error('No identifier provided');

  // arXiv DOI (10.48550/arXiv.XXXX.XXXXX) — route to arXiv API, not CrossRef
  const arxivDoiMatch = input.match(/10\.48550\/arXiv\.(\d{4}\.\d{4,5})/i);
  if (arxivDoiMatch) {
    return resolveArxiv(arxivDoiMatch[1]);
  }

  // DOI
  if (input.match(/^10\.\d{4,}/) || input.match(/doi\.org\/10\./i)) {
    return resolveDoi(input);
  }

  // PMID
  if (input.match(/^pmid:\s*\d+$/i) || input.match(/pubmed.*\/(\d+)/)) {
    const id = input.match(/(\d+)/)?.[1];
    if (!id) throw new Error('Could not extract PMID number');
    return resolvePmid(id);
  }

  // arXiv
  if (input.match(/^arxiv:\s*\d{4}\./i) || input.match(/arxiv\.org\/abs\/(\d{4}\.\d+)/)) {
    const id = input.match(/(\d{4}\.\d{4,5}(v\d+)?)/)?.[1];
    if (!id) throw new Error('Could not extract arXiv ID');
    return resolveArxiv(id);
  }

  // ISBN
  if (input.replace(/[-\s]/g, '').match(/^(97[89])?\d{9}[\dXx]$/)) {
    return resolveIsbn(input);
  }

  // URL containing DOI
  const doiInUrl = input.match(/10\.\d{4,}\/[^\s]+/);
  if (doiInUrl) {
    return resolveDoi(doiInUrl[0]);
  }

  throw new Error('Not a recognized identifier. Supported: DOI, ISBN, PMID, arXiv ID.');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFuzzyDate(str) {
  if (!str) return null;

  // "2023" or "January 2023" or "Jan 15, 2023" etc.
  const yearMatch = str.match(/\b(1[5-9]\d{2}|2\d{3})\b/);
  if (!yearMatch) return { literal: str };

  const year = parseInt(yearMatch[1]);
  const months = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const monthMatch = str.toLowerCase().match(new RegExp(`(${months.join('|')})`));
  const month = monthMatch ? months.indexOf(monthMatch[1]) + 1 : null;

  const dayMatch = str.match(/\b(\d{1,2})\b/);
  const day = dayMatch && parseInt(dayMatch[1]) <= 31 ? parseInt(dayMatch[1]) : null;

  const parts = [year];
  if (month) parts.push(month);
  if (month && day) parts.push(day);

  return { 'date-parts': [parts] };
}
