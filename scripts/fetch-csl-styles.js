// Fetch top 100 CSL styles from the official citation-style-language GitHub repo
// Usage: node scripts/fetch-csl-styles.js
//
// Downloads real, validated CSL files and generates the bundled styles registry.

const fs = require('fs');
const path = require('path');
const https = require('https');

const CSL_DIR = path.resolve(__dirname, '..', 'browser', 'chrome', 'styles', 'csl');
const REGISTRY_OUT = path.resolve(__dirname, '..', 'browser', 'chrome', 'styles', 'csl-registry.json');

// Top 100 styles: id → display name, grouped by field
// IDs match filenames in https://github.com/citation-style-language/styles
const STYLES = [
  // === APA ===
  { id: 'apa', name: 'APA 7th Edition', group: 'APA', field: 'psychology' },
  { id: 'apa-6th-edition', name: 'APA 6th Edition', group: 'APA', field: 'psychology' },
  { id: 'apa-5th-edition', name: 'APA 5th Edition', group: 'APA', field: 'psychology' },
  { id: 'apa-cv', name: 'APA (Curriculum Vitae)', group: 'APA', field: 'psychology' },
  { id: 'apa-no-doi-no-issue', name: 'APA (No DOI, No Issue)', group: 'APA', field: 'psychology' },
  // === MLA ===
  { id: 'modern-language-association', name: 'MLA 9th Edition', group: 'MLA', field: 'humanities' },
  { id: 'modern-language-association-8th-edition', name: 'MLA 8th Edition', group: 'MLA', field: 'humanities' },
  { id: 'modern-language-association-7th-edition', name: 'MLA 7th Edition', group: 'MLA', field: 'humanities' },
  // === Chicago ===
  { id: 'chicago-author-date', name: 'Chicago 17th (Author-Date)', group: 'Chicago', field: 'generic' },
  { id: 'chicago-fullnote-bibliography', name: 'Chicago 17th (Full Note)', group: 'Chicago', field: 'generic' },
  { id: 'chicago-note-bibliography', name: 'Chicago 17th (Note)', group: 'Chicago', field: 'generic' },
  { id: 'chicago-author-date-16th-edition', name: 'Chicago 16th (Author-Date)', group: 'Chicago', field: 'generic' },
  // === Harvard ===
  { id: 'harvard-cite-them-right', name: 'Harvard - Cite Them Right', group: 'Harvard', field: 'generic' },
  { id: 'elsevier-harvard', name: 'Elsevier Harvard', group: 'Harvard', field: 'generic' },
  { id: 'harvard-anglia-ruskin-university', name: 'Harvard - Anglia Ruskin', group: 'Harvard', field: 'generic' },
  { id: 'harvard-university-of-technology-sydney', name: 'Harvard - UTS', group: 'Harvard', field: 'generic' },
  { id: 'harvard-imperial-college-london', name: 'Harvard - Imperial College', group: 'Harvard', field: 'generic' },
  // === IEEE / Engineering ===
  { id: 'ieee', name: 'IEEE', group: 'IEEE', field: 'engineering' },
  { id: 'ieee-with-url', name: 'IEEE (with URL)', group: 'IEEE', field: 'engineering' },
  // === Vancouver / Medicine ===
  { id: 'vancouver', name: 'Vancouver', group: 'Vancouver', field: 'medicine' },
  { id: 'vancouver-superscript', name: 'Vancouver (Superscript)', group: 'Vancouver', field: 'medicine' },
  // === AMA / Medicine ===
  { id: 'american-medical-association', name: 'AMA 11th Edition', group: 'AMA', field: 'medicine' },
  { id: 'american-medical-association-10th-edition', name: 'AMA 10th Edition', group: 'AMA', field: 'medicine' },
  // === Turabian ===
  { id: 'turabian-fullnote-bibliography', name: 'Turabian 9th (Full Note)', group: 'Turabian', field: 'humanities' },
  { id: 'turabian-author-date', name: 'Turabian 9th (Author-Date)', group: 'Turabian', field: 'humanities' },
  // === Science Journals ===
  { id: 'nature', name: 'Nature', group: 'Nature', field: 'science' },
  { id: 'science', name: 'Science (AAAS)', group: 'Science', field: 'science' },
  { id: 'cell', name: 'Cell', group: 'Cell', field: 'biology' },
  { id: 'plos-one', name: 'PLOS ONE', group: 'PLOS', field: 'science' },
  { id: 'plos-biology', name: 'PLOS Biology', group: 'PLOS', field: 'biology' },
  { id: 'proceedings-of-the-national-academy-of-sciences', name: 'PNAS', group: 'PNAS', field: 'science' },
  // === Medical Journals ===
  { id: 'the-lancet', name: 'The Lancet', group: 'Lancet', field: 'medicine' },
  { id: 'the-bmj', name: 'The BMJ', group: 'BMJ', field: 'medicine' },
  { id: 'the-new-england-journal-of-medicine', name: 'NEJM', group: 'NEJM', field: 'medicine' },
  { id: 'jama', name: 'JAMA', group: 'JAMA', field: 'medicine' },
  { id: 'national-library-of-medicine', name: 'NLM', group: 'NLM', field: 'medicine' },
  // === Chemistry ===
  { id: 'american-chemical-society', name: 'ACS', group: 'ACS', field: 'chemistry' },
  { id: 'royal-society-of-chemistry', name: 'RSC', group: 'RSC', field: 'chemistry' },
  { id: 'angewandte-chemie', name: 'Angewandte Chemie', group: 'Chemistry', field: 'chemistry' },
  // === Computer Science ===
  { id: 'acm-sig-proceedings', name: 'ACM SIG Proceedings', group: 'ACM', field: 'computer science' },
  { id: 'acm-computing-surveys', name: 'ACM Computing Surveys', group: 'ACM', field: 'computer science' },
  { id: 'association-for-computing-machinery', name: 'ACM (General)', group: 'ACM', field: 'computer science' },
  { id: 'springer-lecture-notes-in-computer-science', name: 'Springer LNCS', group: 'Springer', field: 'computer science' },
  // === Springer ===
  { id: 'springer-basic-author-date', name: 'Springer (Author-Date)', group: 'Springer', field: 'science' },
  { id: 'springer-basic-brackets', name: 'Springer (Brackets)', group: 'Springer', field: 'science' },
  { id: 'springer-vancouver', name: 'Springer Vancouver', group: 'Springer', field: 'science' },
  // === Elsevier ===
  { id: 'elsevier-with-titles', name: 'Elsevier (with Titles)', group: 'Elsevier', field: 'science' },
  { id: 'elsevier-vancouver', name: 'Elsevier Vancouver', group: 'Elsevier', field: 'science' },
  // === Taylor & Francis ===
  { id: 'taylor-and-francis-harvard-x', name: 'Taylor & Francis Harvard', group: 'T&F', field: 'generic' },
  { id: 'taylor-and-francis-chicago-author-date', name: 'Taylor & Francis Chicago', group: 'T&F', field: 'generic' },
  // === Law ===
  { id: 'oscola', name: 'OSCOLA', group: 'Law', field: 'law' },
  { id: 'bluebook-law-review', name: 'Bluebook (Law Review)', group: 'Law', field: 'law' },
  { id: 'bluebook-inline', name: 'Bluebook (Inline)', group: 'Law', field: 'law' },
  { id: 'mcgill-en', name: 'McGill (English)', group: 'Law', field: 'law' },
  // === Social Sciences ===
  { id: 'american-sociological-association', name: 'ASA', group: 'ASA', field: 'sociology' },
  { id: 'american-political-science-association', name: 'APSA', group: 'APSA', field: 'politics' },
  { id: 'council-of-science-editors', name: 'CSE (Name-Year)', group: 'CSE', field: 'science' },
  { id: 'council-of-science-editors-author-date', name: 'CSE (Author-Date)', group: 'CSE', field: 'science' },
  { id: 'annual-reviews', name: 'Annual Reviews', group: 'Annual Reviews', field: 'science' },
  // === Education ===
  { id: 'sage-harvard', name: 'SAGE Harvard', group: 'SAGE', field: 'social science' },
  { id: 'sage-vancouver', name: 'SAGE Vancouver', group: 'SAGE', field: 'social science' },
  // === Business ===
  { id: 'harvard-business-school', name: 'Harvard Business School', group: 'Harvard', field: 'business' },
  // === Humanities ===
  { id: 'modern-humanities-research-association', name: 'MHRA', group: 'MHRA', field: 'humanities' },
  { id: 'society-of-biblical-literature-fullnote-bibliography', name: 'SBL (Full Note)', group: 'SBL', field: 'humanities' },
  // === Geography / Environment ===
  { id: 'american-geophysical-union', name: 'AGU', group: 'AGU', field: 'earth science' },
  { id: 'ecological-society-of-america', name: 'ESA', group: 'ESA', field: 'ecology' },
  // === Physics ===
  { id: 'american-institute-of-physics', name: 'AIP', group: 'AIP', field: 'physics' },
  { id: 'american-physical-society', name: 'APS', group: 'APS', field: 'physics' },
  // === Math ===
  { id: 'american-mathematical-society', name: 'AMS', group: 'AMS', field: 'mathematics' },
  // === ISO / Standards ===
  { id: 'iso690-author-date-en', name: 'ISO 690 (Author-Date, EN)', group: 'ISO', field: 'generic' },
  { id: 'iso690-numeric-en', name: 'ISO 690 (Numeric, EN)', group: 'ISO', field: 'generic' },
  // === Regional ===
  { id: 'associacao-brasileira-de-normas-tecnicas', name: 'ABNT (Brazil)', group: 'Regional', field: 'generic' },
  { id: 'gost-r-7-0-5-2008', name: 'GOST R 7.0.5 (Russia)', group: 'Regional', field: 'generic' },
  { id: 'din-1505-2', name: 'DIN 1505-2 (Germany)', group: 'Regional', field: 'generic' },
  { id: 'norma-portuguesa-405', name: 'NP 405 (Portugal)', group: 'Regional', field: 'generic' },
  { id: 'infoclio-fr', name: 'Infoclio (Switzerland, FR)', group: 'Regional', field: 'generic' },
  // === Nursing / Health ===
  { id: 'nursing-standard', name: 'Nursing Standard', group: 'Nursing', field: 'nursing' },
  // === Engineering ===
  { id: 'american-society-of-civil-engineers', name: 'ASCE', group: 'ASCE', field: 'engineering' },
  { id: 'american-society-of-mechanical-engineers', name: 'ASME', group: 'ASME', field: 'engineering' },
  // === Library ===
  { id: 'apa-annotated-bibliography', name: 'APA (Annotated Bibliography)', group: 'APA', field: 'psychology' },
  // === Misc popular ===
  { id: 'bibtex', name: 'BibTeX Standard', group: 'BibTeX', field: 'generic' },
  { id: 'vancouver-brackets', name: 'Vancouver (Brackets)', group: 'Vancouver', field: 'medicine' },
  { id: 'elsevier-with-titles-alphabetical', name: 'Elsevier (Alphabetical)', group: 'Elsevier', field: 'science' },
  { id: 'multidisciplinary-digital-publishing-institute', name: 'MDPI', group: 'MDPI', field: 'science' },
  { id: 'frontiers', name: 'Frontiers', group: 'Frontiers', field: 'science' },
  { id: 'copernicus-publications', name: 'Copernicus', group: 'Copernicus', field: 'earth science' },
  { id: 'mary-ann-liebert-vancouver', name: 'Mary Ann Liebert', group: 'Liebert', field: 'medicine' },
  { id: 'taylor-and-francis-national-library-of-medicine', name: 'T&F NLM', group: 'T&F', field: 'medicine' },
  { id: 'unified-style-sheet-for-linguistics', name: 'Unified Linguistics', group: 'Linguistics', field: 'linguistics' },
  { id: 'the-journal-of-finance', name: 'Journal of Finance', group: 'Finance', field: 'finance' },
  { id: 'oxford-university-press-note', name: 'Oxford University Press (Note)', group: 'OUP', field: 'humanities' },
  { id: 'cambridge-university-press-numeric', name: 'Cambridge UP (Numeric)', group: 'CUP', field: 'generic' },
  { id: 'wiley-vch-books', name: 'Wiley-VCH Books', group: 'Wiley', field: 'science' },
  { id: 'pensoft-journals', name: 'Pensoft', group: 'Pensoft', field: 'biology' },
  { id: 'journal-of-clinical-epidemiology', name: 'J Clinical Epidemiology', group: 'Epidemiology', field: 'medicine' },
  { id: 'current-opinion', name: 'Current Opinion', group: 'Current Opinion', field: 'science' },
  { id: 'trends-journals', name: 'Trends Journals', group: 'Trends', field: 'science' },
  { id: 'sist02', name: 'SIST02 (Japan)', group: 'Regional', field: 'generic' },
];

const BASE_URL = 'https://raw.githubusercontent.com/citation-style-language/styles/master/';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Ibid-CSL-Fetcher/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(CSL_DIR, { recursive: true });

  let succeeded = 0;
  let failed = 0;
  const registry = [];

  for (const style of STYLES) {
    const url = `${BASE_URL}${style.id}.csl`;
    const outPath = path.join(CSL_DIR, `${style.id}.csl`);

    // Skip if already exists (don't re-download)
    if (fs.existsSync(outPath)) {
      console.log(`  [skip] ${style.id} (exists)`);
      registry.push({ ...style, bundled: true });
      succeeded++;
      continue;
    }

    try {
      process.stdout.write(`  [fetch] ${style.id}...`);
      const xml = await fetchUrl(url);
      fs.writeFileSync(outPath, xml);
      registry.push({ ...style, bundled: true });
      succeeded++;
      console.log(` ok (${(xml.length / 1024).toFixed(1)}KB)`);
    } catch (err) {
      failed++;
      console.log(` FAILED: ${err.message}`);
      registry.push({ ...style, bundled: false, error: err.message });
    }

    // Tiny delay to be polite to GitHub
    await new Promise(r => setTimeout(r, 100));
  }

  // Write registry
  fs.writeFileSync(REGISTRY_OUT, JSON.stringify(registry, null, 2));

  // Calculate total size
  let totalSize = 0;
  for (const f of fs.readdirSync(CSL_DIR)) {
    if (f.endsWith('.csl')) {
      totalSize += fs.statSync(path.join(CSL_DIR, f)).size;
    }
  }

  console.log(`\nDone: ${succeeded} succeeded, ${failed} failed`);
  console.log(`Total CSL bundle size: ${(totalSize / 1024).toFixed(0)}KB`);
  console.log(`Registry written to: ${REGISTRY_OUT}`);
}

main().catch(console.error);
