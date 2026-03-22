// Test: Real-world URL metadata extraction and citation formatting
// Usage: node tests/real-world/test-real-urls.js
//
// Fetches real pages, extracts metadata using the same patterns as extractor.js,
// formats citations, and verifies output quality.

const https = require('https');
const http = require('http');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) { failed++; console.log(`    \x1b[31m✗\x1b[0m ${msg}`); return false; }
  passed++; console.log(`    \x1b[32m✓\x1b[0m ${msg}`); return true;
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 Ibid-Test/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Replicate extractor.js parsing functions
function getMeta(html, name, attr = 'name') {
  const re = new RegExp(`<meta\\s+[^>]*${attr}=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${name}["']`, 'i');
  const m = html.match(re) || html.match(re2);
  return m ? m[1].trim() : null;
}

function extractMeta(html, url) {
  const meta = {
    type: 'webpage', title: null, author: [], issued: null,
    'container-title': null, publisher: null, URL: url,
    DOI: null, volume: null, issue: null, page: null,
  };

  // Highwire Press
  meta.title = meta.title || getMeta(html, 'citation_title');
  meta.DOI = meta.DOI || getMeta(html, 'citation_doi');
  const cJournal = getMeta(html, 'citation_journal_title');
  if (cJournal) { meta['container-title'] = cJournal; meta.type = 'article-journal'; }
  meta.volume = getMeta(html, 'citation_volume');
  meta.issue = getMeta(html, 'citation_issue');
  const fp = getMeta(html, 'citation_firstpage');
  const lp = getMeta(html, 'citation_lastpage');
  if (fp) meta.page = lp ? `${fp}-${lp}` : fp;
  const cDate = getMeta(html, 'citation_publication_date') || getMeta(html, 'citation_date');
  if (cDate) {
    const parts = cDate.split(/[\/\-]/).map(Number).filter(n => !isNaN(n));
    if (parts.length) meta.issued = { 'date-parts': [parts] };
  }
  // Citation authors
  const authorRe = /<meta\s+[^>]*name=["']citation_author["'][^>]*content=["']([^"']*)["']/gi;
  let am;
  while ((am = authorRe.exec(html)) !== null) {
    const name = am[1].trim();
    if (name.includes(',')) {
      const [family, given] = name.split(',', 2).map(s => s.trim());
      meta.author.push({ family, given });
    } else {
      const parts = name.split(/\s+/);
      if (parts.length === 1) meta.author.push({ literal: parts[0] });
      else { const family = parts.pop(); meta.author.push({ family, given: parts.join(' ') }); }
    }
  }

  // OpenGraph
  meta.title = meta.title || getMeta(html, 'og:title', 'property');
  const siteName = getMeta(html, 'og:site_name', 'property');
  const genericSites = /^(Google|Google Drive|Facebook|Twitter|YouTube|LinkedIn|Reddit|Medium|Wikipedia|GitHub)$/i;
  if (siteName && !genericSites.test(siteName)) {
    meta['container-title'] = meta['container-title'] || siteName;
  }

  // Dublin Core
  meta.title = meta.title || getMeta(html, 'DC.title') || getMeta(html, 'dc.title');

  // Standard
  meta.title = meta.title || (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim();
  const stdAuthor = getMeta(html, 'author');
  if (stdAuthor && meta.author.length === 0) {
    const parts = stdAuthor.split(/\s+/);
    if (parts.length === 1) meta.author.push({ literal: parts[0] });
    else { const family = parts.pop(); meta.author.push({ family, given: parts.join(' ') }); }
  }

  return meta;
}

// JS formatter (same as popup.js)
function formatApa(item) {
  const authors = (item.author || [])
    .map(a => {
      if (a.literal) return a.literal;
      const f = a.family || '';
      const g = a.given || '';
      const initials = g.split(/[\s.]/).filter(Boolean).map(p => p[0] + '.').join(' ');
      return `${f}, ${initials}`.trim();
    });
  const authorStr = authors.length === 0 ? '' :
    authors.length === 1 ? authors[0] :
    authors.length === 2 ? `${authors[0]} & ${authors[1]}` :
    authors.slice(0, -1).join(', ') + ', & ' + authors[authors.length - 1];

  const year = item.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
  const title = item.title || 'Untitled';
  const container = item['container-title'] || '';
  const vol = item.volume || '';
  const iss = item.issue || '';
  const pg = item.page || '';
  const doi = item.DOI ? `https://doi.org/${item.DOI}` : '';
  const url = item.URL || '';

  let parts = [authorStr || title, `(${year})`];
  if (authorStr) parts.push(item.type === 'book' ? `*${title}*` : title);
  if (container) {
    let c = `*${container}*`;
    if (vol) c += `, *${vol}*`;
    if (iss) c += `(${iss})`;
    if (pg) c += `, ${pg}`;
    parts.push(c);
  }
  parts.push(doi || url);
  return parts.filter(Boolean).join('. ').replace(/\.\./g, '.') + '.';
}

// DOI resolver test
async function testDoiResolve(doi) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { 'User-Agent': 'Ibid-Test/1.0 (mailto:test@ibid.tools)' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.message);
        } catch { resolve(null); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// =============================================================================
// Test cases
// =============================================================================

async function runTests() {
  console.log('\n\x1b[1mIbid — Real-World URL Tests\x1b[0m');
  console.log('='.repeat(50));

  // --- Test 1: Wikipedia article ---
  console.log('\n  Wikipedia article:');
  try {
    const html = await fetchPage('https://en.wikipedia.org/wiki/Citation');
    const meta = extractMeta(html, 'https://en.wikipedia.org/wiki/Citation');
    assert(meta.title && meta.title.includes('Citation'), `Title extracted: "${meta.title}"`);
    assert(meta.type === 'webpage', `Type is webpage: ${meta.type}`);
    const cite = formatApa(meta);
    assert(cite.includes('Citation'), `APA citation contains title: ${cite.slice(0, 80)}...`);
    assert(!cite.includes('undefined'), 'No "undefined" in citation');
    assert(!cite.includes('null'), 'No "null" in citation');
  } catch (e) { console.log(`    \x1b[31m✗\x1b[0m Wikipedia fetch failed: ${e.message}`); failed++; }

  // --- Test 2: DOI resolution (Nature article) ---
  console.log('\n  DOI resolution (CrossRef):');
  try {
    const item = await testDoiResolve('10.1038/nature12373');
    assert(item !== null, 'CrossRef returned data');
    assert(item.title?.[0]?.length > 0, `Title: "${item.title?.[0]?.slice(0, 60)}..."`);
    assert(item.author?.length > 0, `Authors: ${item.author?.length} found`);
    assert(item.author?.[0]?.family, `First author: ${item.author?.[0]?.family}`);
    assert(item['container-title']?.[0], `Journal: ${item['container-title']?.[0]}`);
    assert(item.volume, `Volume: ${item.volume}`);
    assert(item.page, `Pages: ${item.page}`);
  } catch (e) { console.log(`    \x1b[31m✗\x1b[0m CrossRef test failed: ${e.message}`); failed++; }

  // --- Test 3: PubMed page ---
  console.log('\n  PubMed article page:');
  try {
    const html = await fetchPage('https://pubmed.ncbi.nlm.nih.gov/33782455/');
    const meta = extractMeta(html, 'https://pubmed.ncbi.nlm.nih.gov/33782455/');
    assert(meta.title && meta.title.length > 10, `Title extracted: "${(meta.title || '').slice(0, 60)}..."`);
    // PubMed uses citation_authors (plural) not citation_author — test what we get
    const hasAuthorsOrDoi = meta.author.length > 0 || meta.DOI;
    assert(hasAuthorsOrDoi, `Authors (${meta.author.length}) or DOI found`);
    const cite = formatApa(meta);
    assert(!cite.includes('undefined'), 'No undefined in APA citation');
    assert(cite.length > 30, `Citation length ok: ${cite.length} chars`);
  } catch (e) { console.log(`    \x1b[31m✗\x1b[0m PubMed test failed: ${e.message}`); failed++; }

  // --- Test 4: News site (Reuters) ---
  console.log('\n  News article (Reuters):');
  try {
    const html = await fetchPage('https://www.reuters.com/technology/');
    const meta = extractMeta(html, 'https://www.reuters.com/technology/');
    assert(meta.title && meta.title.length > 3, `Title: "${(meta.title || '').slice(0, 60)}..."`);
    const cite = formatApa(meta);
    assert(cite.length > 20, 'Citation has content');
    assert(!cite.includes('undefined'), 'No undefined');
  } catch (e) { console.log(`    \x1b[31m✗\x1b[0m Reuters test failed: ${e.message}`); failed++; }

  // --- Test 5: DOI resolution (PLOS ONE) ---
  console.log('\n  DOI resolution (PLOS ONE):');
  try {
    const item = await testDoiResolve('10.1371/journal.pone.0185809');
    assert(item !== null, 'CrossRef returned data');
    assert(item.title?.[0], `Title found`);
    assert(item.author?.length >= 2, `Multiple authors: ${item.author?.length}`);
    assert(item['container-title']?.[0]?.includes('PLOS') || item['container-title']?.[0]?.includes('PLoS'), `Journal: ${item['container-title']?.[0]}`);
  } catch (e) { console.log(`    \x1b[31m✗\x1b[0m PLOS DOI test failed: ${e.message}`); failed++; }

  // --- Test 6: Citation formatting quality ---
  console.log('\n  Citation formatting quality:');
  const testItem = {
    type: 'article-journal',
    title: 'Machine learning for climate prediction',
    author: [
      { family: 'Smith', given: 'John A.' },
      { family: 'Doe', given: 'Jane B.' },
      { family: 'Wilson', given: 'Robert' },
    ],
    issued: { 'date-parts': [[2024, 3]] },
    'container-title': 'Nature Climate Change',
    volume: '14',
    issue: '3',
    page: '245-260',
    DOI: '10.1038/s41558-024-01234-5',
  };
  const apa = formatApa(testItem);
  assert(apa.includes('Smith, J. A.'), `APA author format: ${apa.slice(0, 40)}...`);
  assert(apa.includes('& Wilson, R.'), 'APA 3-author format with &');
  assert(apa.includes('(2024)'), 'APA year in parens');
  assert(apa.includes('Machine learning'), 'Title present');
  assert(apa.includes('*Nature Climate Change*'), 'Journal italicized (markdown)');
  assert(apa.includes('*14*'), 'Volume italicized');
  assert(apa.includes('(3)'), 'Issue in parens');
  assert(apa.includes('245-260'), 'Pages present');
  assert(apa.includes('https://doi.org/10.1038'), 'DOI URL present');
  assert(apa.endsWith('.'), 'Ends with period');

  // --- Test 7: Edge case - no author ---
  console.log('\n  Edge case - no author:');
  const noAuthor = {
    type: 'webpage', title: 'Climate Change FAQ',
    URL: 'https://example.com/faq',
    issued: { 'date-parts': [[2023]] },
  };
  const noAuthorCite = formatApa(noAuthor);
  assert(!noAuthorCite.includes('undefined'), 'No undefined without author');
  assert(noAuthorCite.includes('Climate Change FAQ'), 'Title used as lead');
  assert(noAuthorCite.includes('2023'), 'Year present');

  // --- Test 8: Edge case - no date ---
  console.log('\n  Edge case - no date:');
  const noDate = {
    type: 'webpage', title: 'About Us',
    author: [{ literal: 'Example Corp' }],
    URL: 'https://example.com/about',
  };
  const noDateCite = formatApa(noDate);
  assert(noDateCite.includes('n.d.'), 'Shows n.d.');
  assert(noDateCite.includes('Example Corp'), 'Author present');

  // --- Summary ---
  console.log(`\n  \x1b[32m${passed} passing\x1b[0m`);
  if (failed > 0) {
    console.log(`  \x1b[31m${failed} failing\x1b[0m`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
