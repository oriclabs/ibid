// Test: All 6 citation style families produce correct output
// Tests APA, MLA, Chicago, Harvard, IEEE, Vancouver formatting
// Usage: node tests/real-world/test-all-styles.js

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) { failed++; console.log(`    \x1b[31m✗\x1b[0m ${msg}`); return false; }
  passed++; console.log(`    \x1b[32m✓\x1b[0m ${msg}`); return true;
}

// =============================================================================
// Replicate formatters from popup.js
// =============================================================================

function resolveStyleFamily(styleId) {
  const id = (styleId || '').toLowerCase();
  if (id.includes('apa')) return 'apa';
  if (id.includes('mla') || id.includes('modern-language')) return 'mla';
  if (id.includes('chicago')) return 'chicago';
  if (id.includes('harvard') || id.includes('cite-them-right')) return 'harvard';
  if (id.includes('ieee')) return 'ieee';
  if (id.includes('vancouver') || id.includes('ama') || id.includes('nature') || id.includes('lancet')) return 'vancouver';
  return 'apa';
}

function formatAuthorsBib(authors, style) {
  if (!authors || authors.length === 0) return '';
  const fmt = (a) => {
    if (a.literal) return a.literal;
    const f = a.family || '';
    const g = a.given || '';
    if (style === 'ieee' || style === 'vancouver') {
      const initials = g.split(/[\s.]/).filter(Boolean).map(p => p[0] + '.').join(' ');
      return `${initials} ${f}`.trim();
    }
    const initials = g.split(/[\s.]/).filter(Boolean).map(p => p[0] + '.').join(' ');
    return `${f}, ${initials}`.trim();
  };
  if (authors.length === 1) return fmt(authors[0]);
  if (authors.length === 2) {
    const sep = style === 'apa' ? ' & ' : style === 'mla' ? ', and ' : ' and ';
    return `${fmt(authors[0])}${sep}${fmt(authors[1])}`;
  }
  if (style === 'vancouver' && authors.length > 6) {
    return authors.slice(0, 6).map(fmt).join(', ') + ', et al.';
  }
  const last = authors.length - 1;
  const sep = style === 'apa' ? ', & ' : style === 'mla' ? ', and ' : ', & ';
  return authors.slice(0, last).map(fmt).join(', ') + sep + fmt(authors[last]);
}

function formatBibliography(item, styleId) {
  const style = resolveStyleFamily(styleId);
  const a = formatAuthorsBib(item.author, style);
  const year = item.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
  const title = item.title || 'Untitled';
  const container = item['container-title'] || '';
  const vol = item.volume || '';
  const iss = item.issue || '';
  const pg = item.page || '';
  const doi = item.DOI ? `https://doi.org/${item.DOI}` : '';
  const url = item.URL || '';
  const pub = item.publisher || '';

  switch (style) {
    case 'apa': {
      let parts = [a || title, `(${year})`];
      if (a) parts.push(item.type === 'book' ? `*${title}*` : title);
      if (container) {
        let c = `*${container}*`;
        if (vol) c += `, *${vol}*`;
        if (iss) c += `(${iss})`;
        if (pg) c += `, ${pg}`;
        parts.push(c);
      }
      if (pub) parts.push(pub);
      if (doi || url) parts.push(doi || url);
      return parts.filter(Boolean).join('. ').replace(/\.\./g, '.') + '.';
    }
    case 'mla': {
      let parts = [a || 'Unknown'];
      parts.push(item.type === 'book' ? `*${title}*` : `\u201c${title}.\u201d`);
      if (container) parts.push(`*${container}*`);
      let loc = [];
      if (vol) loc.push(`vol. ${vol}`);
      if (iss) loc.push(`no. ${iss}`);
      if (loc.length) parts.push(loc.join(', '));
      if (pub) parts.push(pub);
      if (year !== 'n.d.') parts.push(year);
      if (pg) parts.push(`pp. ${pg}`);
      if (doi || url) parts.push(doi || url);
      return parts.filter(Boolean).join(', ').replace(/,\./g, '.') + '.';
    }
    case 'chicago': {
      let parts = [a || 'Unknown', year];
      parts.push(item.type === 'book' ? `*${title}*` : `\u201c${title}\u201d`);
      if (container) {
        let c = `*${container}*`;
        if (vol) c += ` ${vol}`;
        if (iss) c += `, no. ${iss}`;
        if (pg) c += `: ${pg}`;
        parts.push(c);
      }
      if (pub) parts.push(pub);
      if (doi || url) parts.push(doi || url);
      return parts.filter(Boolean).join('. ').replace(/\.\./g, '.') + '.';
    }
    case 'harvard': {
      let parts = [a || 'Unknown', `(${year})`];
      parts.push(item.type === 'book' ? `*${title}*` : `\u2018${title}\u2019`);
      if (container) {
        let c = `*${container}*`;
        if (vol) c += `, ${vol}`;
        if (iss) c += `(${iss})`;
        if (pg) c += `, pp. ${pg}`;
        parts.push(c);
      }
      if (pub) parts.push(pub);
      if (doi) parts.push(`doi:${item.DOI}`);
      else if (url) parts.push(`Available at: ${url}`);
      return parts.filter(Boolean).join('. ').replace(/\.\./g, '.') + '.';
    }
    case 'ieee': {
      let parts = [a, `\u201c${title},\u201d`];
      if (container) parts.push(`*${container}*`);
      if (vol) parts.push(`vol. ${vol}`);
      if (iss) parts.push(`no. ${iss}`);
      if (pg) parts.push(`pp. ${pg}`);
      if (year) parts.push(year);
      if (item.DOI) parts.push(`doi: ${item.DOI}`);
      return '[1] ' + parts.filter(Boolean).join(', ') + '.';
    }
    case 'vancouver': {
      let parts = [`${a}.`, `${title}.`];
      if (container) parts.push(`${container}. ${year}${vol ? `;${vol}` : ''}${iss ? `(${iss})` : ''}${pg ? `:${pg}` : ''}.`);
      else if (year) parts.push(`${year}.`);
      if (item.DOI) parts.push(`doi: ${item.DOI}`);
      return '1. ' + parts.filter(Boolean).join(' ');
    }
  }
}

function formatIntext(item, styleId) {
  const style = resolveStyleFamily(styleId);
  const first = (item.author || [])[0];
  const name = first?.family || first?.literal || 'Unknown';
  const year = item.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
  const count = (item.author || []).length;
  switch (style) {
    case 'apa': case 'chicago': case 'harvard':
      if (count >= 3) return `(${name} et al., ${year})`;
      if (count === 2) return `(${name} & ${item.author[1].family}, ${year})`;
      return `(${name}, ${year})`;
    case 'mla':
      if (count >= 3) return `(${name} et al.)`;
      if (count === 2) return `(${name} and ${item.author[1].family})`;
      return `(${name})`;
    case 'ieee': case 'vancouver':
      return '[1]';
  }
}

// =============================================================================
// Test data
// =============================================================================

const journalArticle = {
  type: 'article-journal',
  title: 'The impact of climate change on marine biodiversity',
  author: [
    { family: 'Smith', given: 'John Andrew' },
    { family: 'Doe', given: 'Jane B.' },
    { family: 'Wilson', given: 'Robert C.' },
  ],
  issued: { 'date-parts': [[2024, 3, 15]] },
  'container-title': 'Nature Climate Change',
  volume: '14', issue: '3', page: '245-260',
  DOI: '10.1038/s41558-024-01234-5',
};

const book = {
  type: 'book',
  title: 'The Art of Computer Programming',
  author: [{ family: 'Knuth', given: 'Donald E.' }],
  issued: { 'date-parts': [[1997]] },
  publisher: 'Addison-Wesley',
};

const webpage = {
  type: 'webpage',
  title: 'Climate change and health',
  author: [{ literal: 'World Health Organization' }],
  URL: 'https://www.who.int/health-topics/climate-change',
  issued: { 'date-parts': [[2024, 1, 10]] },
};

const twoAuthors = {
  type: 'article-journal',
  title: 'Collaborative study on neural networks',
  author: [
    { family: 'Chen', given: 'Wei' },
    { family: 'Park', given: 'Soo-Jin' },
  ],
  issued: { 'date-parts': [[2023]] },
  'container-title': 'Science', volume: '380', page: '100-105',
  DOI: '10.1126/science.abc1234',
};

const sevenAuthors = {
  type: 'article-journal',
  title: 'Large collaborative study',
  author: [
    { family: 'Adams', given: 'A.' }, { family: 'Baker', given: 'B.' },
    { family: 'Clark', given: 'C.' }, { family: 'Davis', given: 'D.' },
    { family: 'Evans', given: 'E.' }, { family: 'Frank', given: 'F.' },
    { family: 'Grant', given: 'G.' },
  ],
  issued: { 'date-parts': [[2024]] },
  'container-title': 'PNAS', volume: '121', issue: '5', page: '1-12',
};

const noAuthor = {
  type: 'article-newspaper',
  title: 'Global temperatures hit record high',
  'container-title': 'The Guardian',
  issued: { 'date-parts': [[2023, 7, 4]] },
  URL: 'https://theguardian.com/example',
};

const noDate = {
  type: 'webpage',
  title: 'About our organization',
  author: [{ literal: 'Example Corp' }],
  URL: 'https://example.com/about',
};

// =============================================================================
// Tests
// =============================================================================

console.log('\n\x1b[1mIbid — All Styles Test\x1b[0m');
console.log('='.repeat(50));

// Helper
function testStyle(styleName, styleId, item, checks) {
  const bib = formatBibliography(item, styleId);
  const intext = formatIntext(item, styleId);
  for (const [label, fn] of checks) {
    fn(bib, intext);
  }
}

// --- APA ---
console.log('\n  APA 7th Edition:');
testStyle('APA', 'apa', journalArticle, [
  ['Author format (Last, I.)', (b) => assert(b.includes('Smith, J. A.'), `Author: ${b.slice(0, 50)}`)],
  ['3 authors with &', (b) => assert(b.includes('& Wilson, R. C.'), 'Has & before last author')],
  ['Year in parens', (b) => assert(b.includes('(2024)'), 'Year in parentheses')],
  ['Title not italic', (b) => assert(!b.includes('*The impact*'), 'Article title not italicized')],
  ['Journal italic', (b) => assert(b.includes('*Nature Climate Change*'), 'Journal italicized')],
  ['Volume italic', (b) => assert(b.includes('*14*'), 'Volume italicized')],
  ['Issue in parens', (b) => assert(b.includes('(3)'), 'Issue in parentheses')],
  ['Pages present', (b) => assert(b.includes('245-260'), 'Pages')],
  ['DOI as URL', (b) => assert(b.includes('https://doi.org/'), 'DOI as full URL')],
  ['In-text parenthetical', (b, i) => assert(i === '(Smith et al., 2024)', `In-text: ${i}`)],
  ['Ends with period', (b) => assert(b.endsWith('.'), 'Ends with .')],
]);

console.log('\n  APA — Book:');
testStyle('APA', 'apa', book, [
  ['Book title italic', (b) => assert(b.includes('*The Art of Computer Programming*'), 'Book title italic')],
  ['Publisher present', (b) => assert(b.includes('Addison-Wesley'), 'Publisher')],
  ['Single author', (b) => assert(b.includes('Knuth, D. E.'), 'Author format')],
]);

console.log('\n  APA — No author:');
testStyle('APA', 'apa', noAuthor, [
  ['Title as lead', (b) => assert(b.startsWith('Global temperatures'), `Starts with title: ${b.slice(0, 40)}`)],
  ['No undefined', (b) => assert(!b.includes('undefined'), 'No undefined')],
]);

console.log('\n  APA — No date:');
testStyle('APA', 'apa', noDate, [
  ['Shows n.d.', (b) => assert(b.includes('n.d.'), 'Has n.d.')],
]);

// --- MLA ---
console.log('\n  MLA 9th Edition:');
testStyle('MLA', 'mla', journalArticle, [
  ['Author format', (b) => assert(b.includes('Smith, J. A.'), `Author: ${b.slice(0, 50)}`)],
  ['Title in quotes', (b) => assert(b.includes('\u201c') && b.includes('\u201d'), 'Title in curly quotes')],
  ['Journal italic', (b) => assert(b.includes('*Nature Climate Change*'), 'Journal italic')],
  ['vol/no format', (b) => assert(b.includes('vol. 14') && b.includes('no. 3'), 'vol/no labels')],
  ['Year present', (b) => assert(b.includes('2024'), 'Year')],
  ['pp. prefix', (b) => assert(b.includes('pp. 245-260'), 'Pages with pp.')],
  ['In-text (author)', (b, i) => assert(i === '(Smith et al.)', `In-text: ${i}`)],
]);

console.log('\n  MLA — 2 authors:');
testStyle('MLA', 'mla', twoAuthors, [
  ['"and" between 2', (b) => assert(b.includes(', and Park'), 'Uses "and" not &')],
  ['In-text 2 authors', (b, i) => assert(i === '(Chen and Park)', `In-text: ${i}`)],
]);

// --- Chicago ---
console.log('\n  Chicago 17th (Author-Date):');
testStyle('Chicago', 'chicago', journalArticle, [
  ['Year after author', (b) => assert(b.includes('Wilson, R. C. 2024'), `Year placement: ${b.slice(0, 60)}`)],
  ['Title in quotes', (b) => assert(b.includes('\u201c') && b.includes('\u201d'), 'Title in curly quotes')],
  ['Journal italic', (b) => assert(b.includes('*Nature Climate Change*'), 'Journal italic')],
  ['no. format', (b) => assert(b.includes('no. 3'), 'Issue with no. label')],
  ['Colon before pages', (b) => assert(b.includes(': 245-260'), 'Colon before pages')],
  ['In-text', (b, i) => assert(i === '(Smith et al., 2024)', `In-text: ${i}`)],
]);

// --- Harvard ---
console.log('\n  Harvard:');
testStyle('Harvard', 'harvard', journalArticle, [
  ['Year in parens after author', (b) => assert(b.includes('Wilson, R. C. (2024)'), `Format: ${b.slice(0, 60)}`)],
  ['Title in single quotes', (b) => assert(b.includes('\u2018') && b.includes('\u2019'), 'Single curly quotes')],
  ['Journal italic', (b) => assert(b.includes('*Nature Climate Change*'), 'Journal italic')],
  ['pp. prefix', (b) => assert(b.includes('pp. 245-260'), 'Pages with pp.')],
  ['doi: prefix', (b) => assert(b.includes('doi:10.1038'), 'doi: prefix (not full URL)')],
  ['In-text', (b, i) => assert(i === '(Smith et al., 2024)', `In-text: ${i}`)],
]);

console.log('\n  Harvard — Webpage with URL:');
testStyle('Harvard', 'harvard', webpage, [
  ['Available at:', (b) => assert(b.includes('Available at:'), 'URL with "Available at:"')],
]);

// --- IEEE ---
console.log('\n  IEEE:');
testStyle('IEEE', 'ieee', journalArticle, [
  ['Starts with [1]', (b) => assert(b.startsWith('[1]'), 'Numbered reference')],
  ['Author format (I. Last)', (b) => assert(b.includes('J. A. Smith'), `Author: ${b.slice(4, 40)}`)],
  ['Title in quotes', (b) => assert(b.includes('\u201c') && b.includes('\u201d'), 'Title in quotes')],
  ['Journal italic', (b) => assert(b.includes('*Nature Climate Change*'), 'Journal italic')],
  ['vol. label', (b) => assert(b.includes('vol. 14'), 'Volume with vol.')],
  ['no. label', (b) => assert(b.includes('no. 3'), 'Issue with no.')],
  ['pp. label', (b) => assert(b.includes('pp. 245-260'), 'Pages with pp.')],
  ['doi: prefix', (b) => assert(b.includes('doi: 10.1038'), 'doi with space')],
  ['In-text [1]', (b, i) => assert(i === '[1]', `In-text: ${i}`)],
]);

// --- Vancouver ---
console.log('\n  Vancouver:');
testStyle('Vancouver', 'vancouver', journalArticle, [
  ['Starts with 1.', (b) => assert(b.startsWith('1.'), 'Numbered with period')],
  ['Author format (I. Last)', (b) => assert(b.includes('J. A. Smith'), `Author format`)],
  ['No italic title', (b) => assert(!b.includes('*The impact*'), 'Title not italic')],
  ['Journal with semicolon-vol', (b) => assert(b.includes('2024;14'), 'Year;Volume format')],
  ['Issue in parens', (b) => assert(b.includes('(3)'), 'Issue in parens')],
  ['Pages with colon', (b) => assert(b.includes(':245-260'), 'Colon before pages')],
  ['doi:', (b) => assert(b.includes('doi: 10.1038'), 'DOI present')],
  ['In-text [1]', (b, i) => assert(i === '[1]', `In-text: ${i}`)],
]);

console.log('\n  Vancouver — 7 authors (et al. after 6):');
testStyle('Vancouver', 'vancouver', sevenAuthors, [
  ['6 authors + et al.', (b) => assert(b.includes('et al.'), 'Uses et al. after 6')],
  ['Has 6th author', (b) => assert(b.includes('F. Frank'), '6th author present')],
  ['No 7th author', (b) => assert(!b.includes('G. Grant'), '7th author truncated')],
]);

// --- Cross-style comparison ---
console.log('\n  Cross-style consistency (same article, all styles):');
const styles = ['apa', 'mla', 'chicago', 'harvard', 'ieee', 'vancouver'];
for (const s of styles) {
  const bib = formatBibliography(journalArticle, s);
  assert(!bib.includes('undefined'), `${s.toUpperCase()}: no undefined`);
  assert(!bib.includes('null'), `${s.toUpperCase()}: no null`);
  assert(bib.length > 50, `${s.toUpperCase()}: reasonable length (${bib.length} chars)`);
  assert(bib.includes('Smith') || bib.includes('J. A. Smith'), `${s.toUpperCase()}: has author`);
  assert(bib.includes('2024') || bib.includes('n.d.'), `${s.toUpperCase()}: has year`);
}

// --- Summary ---
console.log(`\n  \x1b[32m${passed} passing\x1b[0m`);
if (failed > 0) {
  console.log(`  \x1b[31m${failed} failing\x1b[0m`);
  process.exit(1);
}
