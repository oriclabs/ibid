// Ibid — Identifier Resolver
// Resolves DOI, ISBN, PMID, arXiv to CSL-JSON metadata via public APIs
// Uses multiple sources with fallback chains:
//   DOI:   OpenAlex → CrossRef
//   arXiv: Semantic Scholar → arXiv abstract page
//   ISBN:  Open Library → Google Books
//   PMID:  NCBI E-utilities
//   URL:   Citoid (Wikipedia's Zotero-based resolver)

const REQUEST_TIMEOUT = 15000;

// ---------------------------------------------------------------------------
// Request queue — rate-limited, sequential per host
// ---------------------------------------------------------------------------

const _queues = {};     // host → Promise chain
const _lastCall = {};   // host → timestamp

async function queuedFetch(url, options = {}, context = '', minDelay = 200) {
  const host = new URL(url).hostname;

  // Chain requests per host
  const prev = _queues[host] || Promise.resolve();
  const task = prev.then(async () => {
    // Rate limit: wait if last call to this host was recent
    const elapsed = Date.now() - (_lastCall[host] || 0);
    if (elapsed < minDelay) {
      await new Promise(r => setTimeout(r, minDelay - elapsed));
    }
    _lastCall[host] = Date.now();

    return fetchWithTimeout(url, options, context);
  });

  _queues[host] = task.catch(() => {}); // prevent chain break on error
  return task;
}

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

// Try multiple resolvers in order, return first success
async function tryResolvers(resolvers) {
  let lastError = null;
  for (const { name, fn } of resolvers) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (e) {
      lastError = e;
      console.log(`[Ibid] ${name} failed:`, e.message);
    }
  }
  if (lastError) throw lastError;
  throw new Error('All resolvers failed');
}

// ---------------------------------------------------------------------------
// DOI → CrossRef
// ---------------------------------------------------------------------------

export async function resolveDoi(doi) {
  // Normalize DOI
  doi = doi.replace(/^https?:\/\/doi\.org\//, '').trim();
  doi = doi.replace(/[?#].*$/, '');
  doi = doi.replace(/[.,;:)\]}>]+$/, '');
  doi = doi.trim();
  if (!doi.match(/^10\.\d{4,}/)) throw new Error('Invalid DOI format');

  return tryResolvers([
    { name: 'OpenAlex', fn: () => resolveDoiViaOpenAlex(doi) },
    { name: 'CrossRef', fn: () => resolveDoiViaCrossRef(doi) },
  ]);
}

async function resolveDoiViaOpenAlex(doi) {
  const res = await queuedFetch(
    `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`,
    { headers: { 'User-Agent': 'Ibid/0.1.0 (citation-manager; mailto:support@ibid.tools)' } },
    'OpenAlex'
  );

  const item = await res.json();
  if (!item || item.error) return null;

  const authorship = item.authorships || [];
  return {
    type: mapOpenAlexType(item.type),
    title: item.title || null,
    author: authorship.map(a => {
      const name = a.author?.display_name || '';
      const parts = name.split(' ');
      if (parts.length === 1) return { literal: parts[0] };
      const family = parts.pop();
      return { family, given: parts.join(' ') };
    }),
    issued: item.publication_date
      ? { 'date-parts': [item.publication_date.split('-').map(Number)] }
      : item.publication_year ? { 'date-parts': [[item.publication_year]] } : null,
    'container-title': item.primary_location?.source?.display_name || null,
    volume: item.biblio?.volume || null,
    issue: item.biblio?.issue || null,
    page: item.biblio?.first_page
      ? (item.biblio.last_page ? `${item.biblio.first_page}-${item.biblio.last_page}` : item.biblio.first_page)
      : null,
    publisher: item.primary_location?.source?.host_organization_name || null,
    DOI: item.doi?.replace('https://doi.org/', '') || doi,
    ISSN: item.primary_location?.source?.issn_l || null,
    URL: item.primary_location?.landing_page_url || `https://doi.org/${doi}`,
    abstract: item.abstract_inverted_index ? reconstructAbstract(item.abstract_inverted_index) : null,
    language: item.language || null,
    _source: 'openalex',
  };
}

function reconstructAbstract(invertedIndex) {
  // OpenAlex stores abstracts as inverted index: { "word": [positions] }
  if (!invertedIndex || typeof invertedIndex !== 'object') return null;
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) words[pos] = word;
  }
  return words.filter(Boolean).join(' ');
}

function mapOpenAlexType(type) {
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
    'article': 'article-journal',
    'review': 'article-journal',
    'paratext': 'webpage',
  };
  return map[type] || 'article';
}

async function resolveDoiViaCrossRef(doi) {
  const res = await queuedFetch(
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

  return tryResolvers([
    { name: 'Open Library', fn: () => resolveIsbnViaOpenLibrary(isbn) },
    { name: 'Google Books', fn: () => resolveIsbnViaGoogleBooks(isbn) },
  ]);
}

async function resolveIsbnViaOpenLibrary(isbn) {
  const res = await queuedFetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    {},
    'Open Library'
  );

  const data = await res.json();
  const key = `ISBN:${isbn}`;
  const book = data[key];
  if (!book) return null;

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

async function resolveIsbnViaGoogleBooks(isbn) {
  const res = await queuedFetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
    {},
    'Google Books',
    1000 // Google rate limits aggressively
  );

  const data = await res.json();
  const item = data.items?.[0]?.volumeInfo;
  if (!item) return null;

  return {
    type: 'book',
    title: item.title || null,
    author: (item.authors || []).map(name => {
      const parts = name.split(' ');
      if (parts.length === 1) return { literal: parts[0] };
      const family = parts.pop();
      return { family, given: parts.join(' ') };
    }),
    issued: item.publishedDate ? parseFuzzyDate(item.publishedDate) : null,
    publisher: item.publisher || null,
    'number-of-pages': item.pageCount?.toString() || null,
    ISBN: isbn,
    abstract: item.description || null,
    language: item.language || null,
    URL: item.infoLink || null,
    _source: 'googlebooks',
  };
}

// ---------------------------------------------------------------------------
// PMID → NCBI E-utilities
// ---------------------------------------------------------------------------

export async function resolvePmid(pmid) {
  pmid = pmid.replace(/^pmid:\s*/i, '').trim();
  if (!pmid.match(/^\d+$/)) throw new Error('Invalid PMID format');

  const res = await queuedFetch(
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

  return tryResolvers([
    { name: 'arXiv abstract page', fn: () => resolveArxivViaAbstractPage(arxivId) },
    { name: 'Semantic Scholar', fn: () => resolveArxivViaSemanticScholar(arxivId) },
  ]);
}

async function resolveArxivViaSemanticScholar(arxivId) {
  const res = await queuedFetch(
    `https://api.semanticscholar.org/graph/v1/paper/ArXiv:${arxivId}?fields=title,authors,year,abstract,externalIds,publicationDate`,
    {},
    'Semantic Scholar'
  );
  const data = await res.json();
  if (!data.title) return null;

  const issued = data.publicationDate
    ? { 'date-parts': [data.publicationDate.split('-').map(Number)] }
    : data.year ? { 'date-parts': [[data.year]] } : null;

  return {
    type: 'article',
    title: data.title,
    author: (data.authors || []).map(a => {
      const parts = (a.name || '').split(' ');
      if (parts.length === 1) return { literal: parts[0] };
      const family = parts.pop();
      return { family, given: parts.join(' ') };
    }),
    issued,
    abstract: data.abstract || null,
    DOI: data.externalIds?.DOI || `10.48550/arXiv.${arxivId}`,
    URL: `https://arxiv.org/abs/${arxivId}`,
    number: arxivId,
    _source: 'semantic-scholar',
  };
}

async function resolveArxivViaAbstractPage(arxivId) {
  const res = await queuedFetch(
    `https://arxiv.org/abs/${arxivId}`,
    {},
    'arXiv'
  );

  const html = await res.text();

  const getMeta = (name) => {
    const m = html.match(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i'));
    return m ? m[1].trim() : null;
  };
  const getAllMeta = (name) => {
    const re = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'gi');
    const results = []; let m;
    while ((m = re.exec(html))) results.push(m[1].trim());
    return results;
  };

  const title = getMeta('citation_title');
  const authors = getAllMeta('citation_author');
  const dateStr = getMeta('citation_date') || getMeta('citation_publication_date');
  const doi = getMeta('citation_doi');
  const abstractMatch = html.match(/<blockquote[^>]*class="abstract[^"]*"[^>]*>[\s\S]*?<span class="descriptor">[^<]*<\/span>\s*([\s\S]*?)<\/blockquote>/i);
  const abstract = abstractMatch ? abstractMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null;

  let issued = null;
  if (dateStr) {
    const parts = dateStr.split(/[/-]/);
    issued = { 'date-parts': [[
      parseInt(parts[0]),
      ...(parts[1] ? [parseInt(parts[1])] : []),
      ...(parts[2] ? [parseInt(parts[2])] : []),
    ]] };
  }

  return {
    type: 'article',
    title: title || null,
    author: authors.map(name => {
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

  // arXiv DOI (10.48550/arXiv.XXXX.XXXXX) — try arXiv, fallback to OpenAlex
  const arxivDoiMatch = input.match(/10\.48550\/arXiv\.(\d{4}\.\d{4,5})/i);
  if (arxivDoiMatch) {
    try {
      return await resolveArxiv(arxivDoiMatch[1]);
    } catch {
      // arXiv resolution failed (CORS/permissions) — try OpenAlex as DOI
      try {
        return await resolveDoiViaOpenAlex(input);
      } catch {}
      // Last resort — return minimal data
      return {
        type: 'article',
        title: null,
        author: [],
        DOI: input,
        URL: `https://arxiv.org/abs/${arxivDoiMatch[1]}`,
        _source: 'fallback',
        _needsPermissions: true,
      };
    }
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

  // URL — try Citoid (Wikipedia's Zotero-based resolver)
  if (input.match(/^https?:\/\//)) {
    const result = await resolveUrl(input);
    if (result) return result;
    // URL couldn't be resolved — not an error, caller may try title search
    return null;
  }

  throw new Error('Not a recognized identifier. Supported: DOI, ISBN, PMID, arXiv ID, or URL.');
}

// ---------------------------------------------------------------------------
// URL → Citoid (Wikipedia's Zotero-based citation resolver)
// ---------------------------------------------------------------------------

export async function resolveUrl(url) {
  const isPdf = /\.pdf(\?|#|$)/i.test(url) || /\/pdf\/[\d.]/i.test(url);

  // Citoid doesn't support PDFs (415 Unsupported Media Type)
  if (!isPdf) {
    return tryResolvers([
      { name: 'Citoid', fn: () => resolveUrlViaCitoid(url) },
    ]);
  }

  // PDF URLs: no URL-based resolvers available — caller should try title search
  return null;
}

// Search by title on OpenAlex — useful when we have a title but no DOI
export async function resolveByTitle(title) {
  if (!title || title.length < 10) throw new Error('Title too short to search');

  const res = await queuedFetch(
    `https://api.openalex.org/works?search=${encodeURIComponent(title)}&per_page=1`,
    { headers: { 'User-Agent': 'Ibid/0.1.0 (citation-manager; mailto:support@ibid.tools)' } },
    'OpenAlex search'
  );

  const data = await res.json();
  const item = data.results?.[0];
  if (!item || !item.title) throw new Error('OpenAlex: No results for this title');

  // Verify title similarity (avoid false matches)
  const similarity = titleSimilarity(title, item.title);
  if (similarity < 0.6) throw new Error('OpenAlex: No close title match found');

  // If the result points to arXiv, fetch the abstract page for reliable author data
  const landingUrl = item.primary_location?.landing_page_url || '';
  const arxivMatch = landingUrl.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/);
  if (arxivMatch) {
    console.log('[Ibid] Title search found arXiv link:', arxivMatch[1]);
    try {
      // Fetch abstract page directly (bypass tryResolvers chain)
      const absRes = await queuedFetch(`https://arxiv.org/abs/${arxivMatch[1]}`, {}, 'arXiv');
      const html = await absRes.text();
      const getMeta = (n) => { const m = html.match(new RegExp(`<meta\\s+name="${n}"\\s+content="([^"]*)"`, 'i')); return m ? m[1].trim() : null; };
      const getAllMeta = (n) => { const re = new RegExp(`<meta\\s+name="${n}"\\s+content="([^"]*)"`, 'gi'); const r = []; let m; while ((m = re.exec(html))) r.push(m[1].trim()); return r; };
      const absTitle = getMeta('citation_title');
      const absAuthors = getAllMeta('citation_author');
      if (absTitle && absAuthors.length > 0) {
        console.log('[Ibid] arXiv abstract page: found', absAuthors.length, 'authors');
        const dateStr = getMeta('citation_date') || getMeta('citation_publication_date');
        let issued = null;
        if (dateStr) {
          const parts = dateStr.split(/[/-]/);
          issued = { 'date-parts': [parts.map(Number)] };
        }
        return {
          type: 'article',
          title: absTitle,
          author: absAuthors.map(name => {
            if (name.includes(',')) { const [f, g] = name.split(',', 2).map(s => s.trim()); return { family: f, given: g }; }
            const p = name.split(' '); if (p.length === 1) return { literal: p[0] }; const fam = p.pop(); return { family: fam, given: p.join(' ') };
          }),
          issued,
          DOI: getMeta('citation_doi') || `10.48550/arXiv.${arxivMatch[1]}`,
          URL: `https://arxiv.org/abs/${arxivMatch[1]}`,
          number: arxivMatch[1],
          _source: 'arxiv',
        };
      }
    } catch (e) {
      console.log('[Ibid] arXiv abstract page fetch failed:', e.message);
      // arXiv fetch failed (likely CORS) — return minimal data with arXiv DOI
      // Don't use OpenAlex authors — they're unreliable for arXiv papers
      return {
        type: 'article',
        title: item.title,
        author: [],
        DOI: `10.48550/arXiv.${arxivMatch[1]}`,
        URL: `https://arxiv.org/abs/${arxivMatch[1]}`,
        number: arxivMatch[1],
        _source: 'openalex-search',
        _needsPermissions: true,
      };
    }
  }

  // Use raw_author_name when available (more reliable than display_name for some entries)
  const authorship = item.authorships || [];
  return {
    type: mapOpenAlexType(item.type),
    title: item.title,
    author: authorship.map(a => {
      const name = a.raw_author_name || a.author?.display_name || '';
      if (name.includes(',')) {
        const [family, given] = name.split(',', 2).map(s => s.trim());
        return { family, given };
      }
      const parts = name.split(' ');
      if (parts.length === 1) return { literal: parts[0] };
      const family = parts.pop();
      return { family, given: parts.join(' ') };
    }),
    issued: item.publication_date
      ? { 'date-parts': [item.publication_date.split('-').map(Number)] }
      : item.publication_year ? { 'date-parts': [[item.publication_year]] } : null,
    'container-title': item.primary_location?.source?.display_name || null,
    volume: item.biblio?.volume || null,
    issue: item.biblio?.issue || null,
    page: item.biblio?.first_page
      ? (item.biblio.last_page ? `${item.biblio.first_page}-${item.biblio.last_page}` : item.biblio.first_page)
      : null,
    publisher: item.primary_location?.source?.host_organization_name || null,
    DOI: item.doi?.replace('https://doi.org/', '') || null,
    URL: item.primary_location?.landing_page_url || null,
    abstract: item.abstract_inverted_index ? reconstructAbstract(item.abstract_inverted_index) : null,
    _source: 'openalex-search',
  };
}

function titleSimilarity(a, b) {
  // Simple word overlap ratio
  const wa = new Set(a.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  const wb = new Set(b.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.max(wa.size, wb.size);
}

async function resolveUrlViaCitoid(url) {
  const res = await queuedFetch(
    `https://en.wikipedia.org/api/rest_v1/data/citation/zotero/${encodeURIComponent(url)}`,
    { headers: { 'Api-User-Agent': 'Ibid/0.1.0 (citation-manager; mailto:support@ibid.tools)', 'Accept': 'application/json' } },
    'Citoid',
    500 // rate limit: 500ms between requests
  );

  const items = await res.json();
  const item = Array.isArray(items) ? items[0] : items;
  if (!item) return null;

  // Citoid returns Zotero-format JSON — convert to CSL-JSON
  const typeMap = {
    journalArticle: 'article-journal',
    newspaperArticle: 'article-newspaper',
    magazineArticle: 'article-magazine',
    book: 'book',
    bookSection: 'chapter',
    conferencePaper: 'paper-conference',
    thesis: 'thesis',
    report: 'report',
    blogPost: 'post-weblog',
    webpage: 'webpage',
    patent: 'patent',
    film: 'motion-picture',
    dataset: 'dataset',
    computerProgram: 'software',
    statute: 'legislation',
    case: 'legal-case',
    presentation: 'speech',
    encyclopediaArticle: 'entry-encyclopedia',
    dictionaryEntry: 'entry-dictionary',
  };

  return {
    type: typeMap[item.itemType] || 'webpage',
    title: item.title || null,
    author: (item.creators || [])
      .filter(c => c.creatorType === 'author')
      .map(c => c.lastName
        ? { family: c.lastName, given: c.firstName || '' }
        : { literal: c.name || '' }),
    issued: item.date ? parseFuzzyDate(item.date) : null,
    'container-title': item.publicationTitle || item.websiteTitle || null,
    volume: item.volume || null,
    issue: item.issue || null,
    page: item.pages || null,
    publisher: item.publisher || null,
    DOI: item.DOI || null,
    ISBN: item.ISBN || null,
    ISSN: item.ISSN || null,
    URL: item.url || url,
    abstract: item.abstractNote || null,
    language: item.language || null,
    _source: 'citoid',
  };
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
