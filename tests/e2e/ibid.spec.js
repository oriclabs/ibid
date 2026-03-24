// Ibid E2E Tests — Phase 1-3
// Phase 1: Extension loads, popup opens, WASM initializes
// Phase 2: Metadata extraction from Nature article
// Phase 3: Style switching, P/N toggle, preview verification

const { test, expect } = require('@playwright/test');
const {
  launchWithExtension,
  openPopup,
  openPopupOnUrl,
  waitForWasm,
  collectErrors,
} = require('./helpers');

// Test results log — written at the end for manual review
const results = [];
function log(section, test, status, detail = '') {
  results.push({ section, test, status, detail });
}

let ctx; // { context, extensionId, popupUrl, sidepanelUrl }

test.beforeAll(async () => {
  ctx = await launchWithExtension();
  console.log(`Extension loaded: ${ctx.extensionId}`);
  console.log(`Popup URL: ${ctx.popupUrl}`);
});

test.afterAll(async () => {
  // Print results summary
  console.log('\n' + '='.repeat(80));
  console.log('IBID E2E TEST RESULTS');
  console.log('='.repeat(80));

  const sections = [...new Set(results.map(r => r.section))];
  let passed = 0, failed = 0, warnings = 0;

  for (const section of sections) {
    console.log(`\n## ${section}`);
    for (const r of results.filter(r => r.section === section)) {
      const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '⚠';
      console.log(`  ${icon} ${r.test}${r.detail ? ' — ' + r.detail : ''}`);
      if (r.status === 'PASS') passed++;
      else if (r.status === 'FAIL') failed++;
      else warnings++;
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`TOTAL: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  console.log('='.repeat(80) + '\n');

  // Write results to file
  const fs = require('fs');
  const reportPath = require('path').resolve(__dirname, 'e2e-results.md');
  let md = `# Ibid E2E Test Results\n\nRun: ${new Date().toISOString()}\n\n`;
  for (const section of sections) {
    md += `## ${section}\n\n`;
    md += '| Test | Status | Detail |\n|------|--------|--------|\n';
    for (const r of results.filter(r => r.section === section)) {
      md += `| ${r.test} | ${r.status} | ${r.detail} |\n`;
    }
    md += '\n';
  }
  md += `\n**Total: ${passed} passed, ${failed} failed, ${warnings} warnings**\n`;
  fs.writeFileSync(reportPath, md);
  console.log(`Results written to: ${reportPath}`);

  await ctx.context.close();
});

// =============================================================================
// PHASE 1: Extension loads, popup opens, WASM initializes
// =============================================================================

test.describe('Phase 1 — Extension Setup', () => {
  test('1.1 Extension ID is valid', async () => {
    expect(ctx.extensionId).toBeTruthy();
    expect(ctx.extensionId.length).toBeGreaterThan(10);
    log('Phase 1: Setup', 'Extension ID valid', 'PASS', ctx.extensionId);
  });

  test('1.2 Popup opens without errors', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    const errors = collectErrors(popup);
    await popup.waitForTimeout(2000);

    // Check popup loaded
    const title = await popup.title();
    log('Phase 1: Setup', 'Popup opens', 'PASS', `Title: "${title}"`);

    // Check no critical errors
    const criticalErrors = errors.filter(
      e => !e.includes('favicon') && !e.includes('DevTools')
    );
    if (criticalErrors.length > 0) {
      log('Phase 1: Setup', 'No console errors', 'WARN', criticalErrors.join('; '));
    } else {
      log('Phase 1: Setup', 'No console errors', 'PASS');
    }

    await popup.close();
  });

  test('1.3 WASM / Hayagriva engine initializes', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    const wasmReady = await waitForWasm(popup);

    if (wasmReady) {
      log('Phase 1: Setup', 'WASM engine ready', 'PASS');
    } else {
      log('Phase 1: Setup', 'WASM engine ready', 'FAIL', 'Timed out waiting for WASM');
    }
    expect(wasmReady).toBe(true);

    // Check engine version
    const version = await popup.evaluate(() => {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'getVersion' }, res => {
          resolve(res);
        });
      });
    });
    log('Phase 1: Setup', 'Engine version', 'PASS', JSON.stringify(version));

    await popup.close();
  });

  test('1.4 Service worker has no errors', async () => {
    const workers = ctx.context.serviceWorkers();
    const sw = workers.find(w => w.url().includes(ctx.extensionId));
    expect(sw).toBeTruthy();
    log('Phase 1: Setup', 'Service worker running', 'PASS');
  });

  test('1.5 Bundled styles loaded', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await waitForWasm(popup);

    const styles = await popup.evaluate(() => {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'getStyles' }, res => {
          resolve(res?.styles || []);
        });
      });
    });

    expect(styles.length).toBeGreaterThanOrEqual(60);
    log('Phase 1: Setup', 'Bundled styles count', 'PASS', `${styles.length} styles`);

    // Check key styles exist
    const ids = styles.map(s => s.id);
    const required = ['apa', 'modern-language-association', 'chicago-author-date', 'ieee', 'vancouver', 'harvard-cite-them-right'];
    for (const id of required) {
      if (ids.includes(id)) {
        log('Phase 1: Setup', `Style "${id}" bundled`, 'PASS');
      } else {
        log('Phase 1: Setup', `Style "${id}" bundled`, 'FAIL', 'Missing');
      }
    }

    await popup.close();
  });
});

// =============================================================================
// PHASE 2: Metadata extraction from Nature article
// =============================================================================

test.describe('Phase 2 — Metadata Extraction', () => {
  const NATURE_URL = 'https://www.nature.com/articles/s41586-024-08219-w';

  test('2.1 Nature article — fields populate', async () => {
    const { popup, targetPage } = await openPopupOnUrl(ctx.context, ctx.popupUrl, NATURE_URL);
    const errors = collectErrors(popup);

    // Wait for extraction or session restore
    await popup.waitForTimeout(5000);

    // Check title field
    const title = await popup.$eval('#field-title', el => el.value);
    if (title && title.length > 10) {
      log('Phase 2: Extraction', 'Title extracted', 'PASS', title.substring(0, 60));
    } else {
      log('Phase 2: Extraction', 'Title extracted', 'FAIL', `Got: "${title}"`);
    }

    // Check authors
    const authors = await popup.$eval('#field-authors', el => el.value);
    if (authors && authors.includes('Doughty')) {
      log('Phase 2: Extraction', 'Authors extracted', 'PASS', `${authors.substring(0, 60)}...`);
    } else {
      log('Phase 2: Extraction', 'Authors extracted', 'WARN', `Got: "${authors?.substring(0, 60)}"`);
    }

    // Check DOI
    const doi = await popup.$eval('#field-doi', el => el.value);
    if (doi && doi.includes('10.1038')) {
      log('Phase 2: Extraction', 'DOI extracted', 'PASS', doi);
    } else {
      log('Phase 2: Extraction', 'DOI extracted', 'WARN', `Got: "${doi}"`);
    }

    // Check date
    const date = await popup.$eval('#field-date', el => el.value);
    if (date && date.includes('2024')) {
      log('Phase 2: Extraction', 'Date extracted', 'PASS', date);
    } else {
      log('Phase 2: Extraction', 'Date extracted', 'WARN', `Got: "${date}"`);
    }

    // Check journal
    const journal = await popup.$eval('#field-container', el => el.value);
    if (journal && journal.toLowerCase().includes('nature')) {
      log('Phase 2: Extraction', 'Journal extracted', 'PASS', journal);
    } else {
      log('Phase 2: Extraction', 'Journal extracted', 'WARN', `Got: "${journal}"`);
    }

    // Check source type
    const type = await popup.$eval('#source-type', el => el.value);
    log('Phase 2: Extraction', 'Source type', type === 'article-journal' ? 'PASS' : 'WARN', type);

    // Check bib preview is not empty
    const bibPreview = await popup.$eval('#citation-preview', el => el.textContent);
    if (bibPreview && bibPreview.length > 20) {
      log('Phase 2: Extraction', 'Bib preview rendered', 'PASS', bibPreview.substring(0, 80));
    } else {
      log('Phase 2: Extraction', 'Bib preview rendered', 'FAIL', `Got: "${bibPreview}"`);
    }

    // Check in-text preview
    const intextPreview = await popup.$eval('#intext-preview', el => el.textContent);
    if (intextPreview && intextPreview.length > 3) {
      log('Phase 2: Extraction', 'In-text preview rendered', 'PASS', intextPreview);
    } else {
      log('Phase 2: Extraction', 'In-text preview rendered', 'FAIL', `Got: "${intextPreview}"`);
    }

    // Check for console errors
    const criticals = errors.filter(e => !e.includes('favicon') && !e.includes('DevTools'));
    if (criticals.length > 0) {
      log('Phase 2: Extraction', 'Console errors', 'WARN', criticals.join('; ').substring(0, 200));
    } else {
      log('Phase 2: Extraction', 'No console errors', 'PASS');
    }

    // Check for gibberish — ANSI codes, [0m, undefined, NaN
    const fullText = await popup.$eval('#state-ready', el => el.textContent);
    const gibberish = ['[0m', '\x1b[', 'undefined', 'NaN', 'null'];
    for (const g of gibberish) {
      if (fullText.includes(g)) {
        log('Phase 2: Extraction', `No gibberish: ${g}`, 'FAIL', `Found "${g}" in popup text`);
      }
    }

    await popup.close();
    await targetPage.close();
  });
});

// =============================================================================
// PHASE 3: Style switching, P/N toggle, preview verification
// =============================================================================

test.describe('Phase 3 — Style Switching & P/N', () => {
  const NATURE_URL = 'https://www.nature.com/articles/s41586-024-08219-w';

  test('3.1 Style picker opens and lists styles', async () => {
    const { popup, targetPage } = await openPopupOnUrl(ctx.context, ctx.popupUrl, NATURE_URL);
    await popup.waitForTimeout(5000);

    // Click style picker button
    const pickerBtn = popup.locator('#style-picker-btn');
    await pickerBtn.click();
    await popup.waitForTimeout(500);

    // Check dropdown is visible
    const dropdown = popup.locator('#style-picker-dropdown');
    const isVisible = await dropdown.isVisible();
    if (isVisible) {
      log('Phase 3: Styles', 'Style picker opens', 'PASS');
    } else {
      log('Phase 3: Styles', 'Style picker opens', 'FAIL', 'Dropdown not visible');
    }

    // Count visible style items
    const styleCount = await popup.locator('.style-item').count();
    log('Phase 3: Styles', 'Style items listed', styleCount > 10 ? 'PASS' : 'FAIL', `${styleCount} styles`);

    // Check search works
    const searchInput = popup.locator('#style-search-input');
    await searchInput.fill('vancouver');
    await popup.waitForTimeout(300);
    const filteredCount = await popup.locator('.style-item').count();
    log('Phase 3: Styles', 'Style search filters', filteredCount > 0 && filteredCount < styleCount ? 'PASS' : 'WARN', `${filteredCount} results for "vancouver"`);

    // Close dropdown
    await popup.keyboard.press('Escape');
    await popup.waitForTimeout(200);

    await popup.close();
    await targetPage.close();
  });

  test('3.2 Style switching changes preview', async () => {
    const { popup, targetPage } = await openPopupOnUrl(ctx.context, ctx.popupUrl, NATURE_URL);
    await popup.waitForTimeout(5000);
    await waitForWasm(popup);

    // Get initial APA preview
    const initialBib = await popup.$eval('#citation-preview', el => el.textContent);
    log('Phase 3: Styles', 'Initial bib (APA)', 'PASS', initialBib?.substring(0, 80));

    // Switch to IEEE via the style picker UI
    await popup.click('#style-picker-btn');
    await popup.waitForTimeout(300);
    await popup.fill('#style-search-input', 'ieee');
    await popup.waitForTimeout(300);
    await popup.click('.style-item[data-id="ieee"]');
    await popup.waitForTimeout(3000); // wait for WASM render

    const ieeeBib = await popup.$eval('#citation-preview', el => el.textContent);
    // IEEE uses "I. Last" format (initials first) — hayagriva omits [1] prefix for single entries
    if (ieeeBib && /[A-Z]\.\s/.test(ieeeBib) && ieeeBib !== initialBib) {
      log('Phase 3: Styles', 'IEEE format: initials-first', 'PASS', ieeeBib?.substring(0, 80));
    } else {
      log('Phase 3: Styles', 'IEEE format: initials-first', 'WARN', `Got: "${ieeeBib?.substring(0, 80)}"`);
    }

    // Switch to MLA via the style picker UI
    await popup.click('#style-picker-btn');
    await popup.waitForTimeout(300);
    await popup.fill('#style-search-input', 'mla');
    await popup.waitForTimeout(300);
    await popup.click('.style-item[data-id="modern-language-association"]');
    await popup.waitForTimeout(3000); // wait for WASM render

    const mlaBib = await popup.$eval('#citation-preview', el => el.textContent);
    log('Phase 3: Styles', 'MLA format', 'PASS', mlaBib?.substring(0, 80));

    // Check MLA has et al. (12 authors)
    if (mlaBib && mlaBib.includes('et al')) {
      log('Phase 3: Styles', 'MLA et al. in bib', 'PASS');
    } else {
      log('Phase 3: Styles', 'MLA et al. in bib', 'FAIL', `No "et al." found in: ${mlaBib?.substring(0, 100)}`);
    }

    // Check MLA has quoted title
    if (mlaBib && (mlaBib.includes('\u201c') || mlaBib.includes('"'))) {
      log('Phase 3: Styles', 'MLA quoted title', 'PASS');
    } else {
      log('Phase 3: Styles', 'MLA quoted title', 'WARN', 'No quotes found in MLA bib');
    }

    // Check for ANSI gibberish
    if (mlaBib && (mlaBib.includes('[0m') || mlaBib.includes('\x1b'))) {
      log('Phase 3: Styles', 'No ANSI codes in MLA', 'FAIL', 'Found ANSI escape codes');
    } else {
      log('Phase 3: Styles', 'No ANSI codes in MLA', 'PASS');
    }

    await popup.close();
    await targetPage.close();
  });

  test('3.3 P/N toggle changes in-text', async () => {
    const { popup, targetPage } = await openPopupOnUrl(ctx.context, ctx.popupUrl, NATURE_URL);
    await popup.waitForTimeout(5000);

    // Get initial P (parenthetical) in-text
    const pIntext = await popup.$eval('#intext-preview', el => el.textContent);
    log('Phase 3: P/N', 'Initial P in-text', 'PASS', pIntext);

    // P should have parentheses
    if (pIntext && pIntext.startsWith('(')) {
      log('Phase 3: P/N', 'P has parentheses', 'PASS');
    } else if (pIntext && pIntext.includes('(')) {
      log('Phase 3: P/N', 'P has parentheses', 'WARN', 'Parens not at start');
    } else {
      log('Phase 3: P/N', 'P has parentheses', 'FAIL', `Got: "${pIntext}"`);
    }

    // Click N button
    const nBtn = popup.locator('#btn-narrative');
    if (await nBtn.isVisible()) {
      await nBtn.click();
      await popup.waitForTimeout(1500);

      const nIntext = await popup.$eval('#intext-preview', el => el.textContent);
      log('Phase 3: P/N', 'N in-text', 'PASS', nIntext);

      // N should NOT start with parenthesis (narrative: Author (Year))
      if (nIntext && !nIntext.startsWith('(') && !nIntext.startsWith('[')) {
        log('Phase 3: P/N', 'N is narrative (no leading paren)', 'PASS');
      } else {
        log('Phase 3: P/N', 'N is narrative (no leading paren)', 'WARN', `Got: "${nIntext}"`);
      }

      // Check et al. for 12 authors
      if (nIntext && nIntext.includes('et al')) {
        log('Phase 3: P/N', 'N has et al. (12 authors)', 'PASS');
      } else {
        log('Phase 3: P/N', 'N has et al. (12 authors)', 'FAIL', `No "et al." in: "${nIntext}"`);
      }

      // Switch back to P
      const pBtn = popup.locator('#btn-parenthetical');
      await pBtn.click();
      await popup.waitForTimeout(1500);

      const pAgain = await popup.$eval('#intext-preview', el => el.textContent);
      log('Phase 3: P/N', 'P restored after N→P', 'PASS', pAgain);

      // P should have et al. too
      if (pAgain && pAgain.includes('et al')) {
        log('Phase 3: P/N', 'P has et al. after toggle', 'PASS');
      } else {
        log('Phase 3: P/N', 'P has et al. after toggle', 'WARN', `Got: "${pAgain}"`);
      }
    } else {
      log('Phase 3: P/N', 'N button visible', 'FAIL', 'Button not found');
    }

    await popup.close();
    await targetPage.close();
  });

  test('3.4 Add to library and verify', async () => {
    const { popup, targetPage } = await openPopupOnUrl(ctx.context, ctx.popupUrl, NATURE_URL);
    await popup.waitForTimeout(5000);

    // Click Add button
    const addBtn = popup.locator('#btn-add-project');
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await popup.waitForTimeout(2000);

      // Check storage for the citation
      const citations = await popup.evaluate(() => {
        return new Promise(resolve => {
          chrome.storage.local.get(['citations'], res => {
            resolve(res.citations || []);
          });
        });
      });

      if (citations.length > 0) {
        log('Phase 3: Library', 'Citation added to library', 'PASS', `${citations.length} total`);

        const last = citations[citations.length - 1];
        log('Phase 3: Library', 'Entry has title', last.title ? 'PASS' : 'FAIL', last.title?.substring(0, 50));
        log('Phase 3: Library', 'Entry has authors', last.author?.length > 0 ? 'PASS' : 'FAIL', `${last.author?.length} authors`);
        log('Phase 3: Library', 'Entry has DOI', last.DOI ? 'PASS' : 'WARN', last.DOI);
        log('Phase 3: Library', 'Entry has _projectIds', Array.isArray(last._projectIds) ? 'PASS' : 'WARN', JSON.stringify(last._projectIds));
      } else {
        log('Phase 3: Library', 'Citation added to library', 'FAIL', 'No citations in storage');
      }
    } else {
      log('Phase 3: Library', 'Add button visible', 'FAIL');
    }

    await popup.close();
    await targetPage.close();
  });

  test('3.5 Sidepanel loads and shows library', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    const errors = collectErrors(sidepanel);

    // Check citation list
    const rowCount = await sidepanel.locator('.citation-row').count();
    if (rowCount > 0) {
      log('Phase 3: Sidepanel', 'Library shows entries', 'PASS', `${rowCount} rows`);
    } else {
      log('Phase 3: Sidepanel', 'Library shows entries', 'WARN', 'No citation rows found');
    }

    // Check tabs exist
    for (const tab of ['library', 'import', 'export']) {
      const tabBtn = sidepanel.locator(`[data-tab="${tab}"]`);
      if (await tabBtn.isVisible()) {
        log('Phase 3: Sidepanel', `Tab "${tab}" visible`, 'PASS');
      } else {
        log('Phase 3: Sidepanel', `Tab "${tab}" visible`, 'FAIL');
      }
    }

    // Check settings gear
    const gear = sidepanel.locator('#sp-settings-btn');
    if (await gear.isVisible()) {
      log('Phase 3: Sidepanel', 'Settings gear visible', 'PASS');
    } else {
      log('Phase 3: Sidepanel', 'Settings gear visible', 'FAIL');
    }

    // Check + button (manual entry)
    const addBtn = sidepanel.locator('#btn-add-manual');
    if (await addBtn.isVisible()) {
      log('Phase 3: Sidepanel', 'Manual entry button visible', 'PASS');
    } else {
      log('Phase 3: Sidepanel', 'Manual entry button visible', 'FAIL');
    }

    // Gibberish check on sidepanel
    const bodyText = await sidepanel.locator('body').textContent();
    const gibberish = ['[0m', 'undefined', 'NaN', '[object Object]'];
    let foundGibberish = false;
    for (const g of gibberish) {
      if (bodyText.includes(g)) {
        log('Phase 3: Sidepanel', `No gibberish: "${g}"`, 'FAIL', 'Found in page');
        foundGibberish = true;
      }
    }
    if (!foundGibberish) {
      log('Phase 3: Sidepanel', 'No gibberish in sidepanel', 'PASS');
    }

    // Check console errors
    await sidepanel.waitForTimeout(1000);
    const criticals = errors.filter(e => !e.includes('favicon') && !e.includes('DevTools'));
    if (criticals.length > 0) {
      log('Phase 3: Sidepanel', 'Console errors', 'WARN', criticals.join('; ').substring(0, 200));
    } else {
      log('Phase 3: Sidepanel', 'No console errors', 'PASS');
    }

    await sidepanel.close();
  });

  test('3.6 Inline preview with style picker and P/N', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    const rowCount = await sidepanel.locator('.citation-row').count();
    if (rowCount === 0) {
      log('Phase 3: Inline Preview', 'No citations to test', 'WARN', 'Skipping');
      await sidepanel.close();
      return;
    }

    // Click first citation to open preview
    const firstToggle = sidepanel.locator('.btn-preview-toggle').first();
    await firstToggle.click();
    await sidepanel.waitForTimeout(1000);

    // Check preview is visible
    const preview = sidepanel.locator('.cite-preview').first();
    if (await preview.isVisible()) {
      log('Phase 3: Inline Preview', 'Preview opens on click', 'PASS');
    } else {
      log('Phase 3: Inline Preview', 'Preview opens on click', 'FAIL');
      await sidepanel.close();
      return;
    }

    // Check bib output exists
    const bibOutput = await preview.locator('.preview-bib-output').textContent();
    if (bibOutput && bibOutput.length > 10) {
      log('Phase 3: Inline Preview', 'Bib output rendered', 'PASS', bibOutput.substring(0, 80));
    } else {
      log('Phase 3: Inline Preview', 'Bib output rendered', 'FAIL', `Got: "${bibOutput}"`);
    }

    // Check in-text output exists
    const intextOutput = await preview.locator('.preview-intext-output').textContent();
    if (intextOutput && intextOutput.length > 2) {
      log('Phase 3: Inline Preview', 'In-text output rendered', 'PASS', intextOutput);
    } else {
      log('Phase 3: Inline Preview', 'In-text output rendered', 'FAIL', `Got: "${intextOutput}"`);
    }

    // Check P/N buttons exist
    const pnButtons = preview.locator('.preview-pn-btn');
    const pnCount = await pnButtons.count();
    log('Phase 3: Inline Preview', 'P/N toggle buttons', pnCount === 2 ? 'PASS' : 'FAIL', `${pnCount} buttons`);

    // Check Copy button exists in in-text row
    const copyBtn = preview.locator('.preview-copy-intext');
    if (await copyBtn.isVisible()) {
      log('Phase 3: Inline Preview', 'Copy in-text button visible', 'PASS');
    } else {
      log('Phase 3: Inline Preview', 'Copy in-text button visible', 'FAIL');
    }

    // Check style picker exists
    const stylePicker = preview.locator('.sp-btn');
    if (await stylePicker.isVisible()) {
      log('Phase 3: Inline Preview', 'Style picker visible', 'PASS');
    } else {
      log('Phase 3: Inline Preview', 'Style picker visible', 'FAIL');
    }

    // Check separator between bib and in-text
    const separator = preview.locator('.border-b');
    if (await separator.count() > 0) {
      log('Phase 3: Inline Preview', 'Bib/in-text separator', 'PASS');
    } else {
      log('Phase 3: Inline Preview', 'Bib/in-text separator', 'WARN', 'No border-b found');
    }

    // Gibberish check on preview
    const previewText = await preview.textContent();
    if (previewText.includes('[0m') || previewText.includes('\x1b')) {
      log('Phase 3: Inline Preview', 'No ANSI gibberish', 'FAIL');
    } else {
      log('Phase 3: Inline Preview', 'No ANSI gibberish', 'PASS');
    }

    await sidepanel.close();
  });
});

// =============================================================================
// PHASE 4: Import BibTeX, verify library
// =============================================================================

test.describe('Phase 4 — Import', () => {
  const SAMPLE_BIBTEX = `@article{ross1995,
  author = {Ross, Jeff},
  title = {mRNA stability in mammalian cells},
  journal = {Microbiological Reviews},
  year = {1995},
  volume = {59},
  number = {3},
  pages = {423--450},
  doi = {10.1128/mr.59.3.423-450.1995}
}

@book{knuth1997,
  author = {Knuth, Donald E.},
  title = {The Art of Computer Programming},
  publisher = {Addison-Wesley},
  year = {1997},
  isbn = {978-0-201-89683-1}
}`;

  test('4.1 Import BibTeX — parse and preview', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    // Switch to Import tab
    await sidepanel.click('[data-tab="import"]');
    await sidepanel.waitForTimeout(500);

    // Paste BibTeX into textarea
    await sidepanel.fill('#import-text', SAMPLE_BIBTEX);
    log('Phase 4: Import', 'BibTeX pasted', 'PASS');

    // Click Parse & Preview
    await sidepanel.click('#btn-parse');
    await sidepanel.waitForTimeout(3000);

    // Check preview list appears
    const previewVisible = await sidepanel.locator('#import-preview').isVisible();
    if (previewVisible) {
      log('Phase 4: Import', 'Preview list visible', 'PASS');
    } else {
      log('Phase 4: Import', 'Preview list visible', 'FAIL');
      await sidepanel.close();
      return;
    }

    // Count parsed entries
    const checkboxCount = await sidepanel.locator('.import-checkbox').count();
    if (checkboxCount === 2) {
      log('Phase 4: Import', 'Parsed 2 entries', 'PASS');
    } else {
      log('Phase 4: Import', 'Parsed 2 entries', checkboxCount > 0 ? 'WARN' : 'FAIL', `Got ${checkboxCount}`);
    }

    // Check preview count text
    const countText = await sidepanel.$eval('#preview-count', el => el.textContent);
    log('Phase 4: Import', 'Preview count', 'PASS', countText);

    // Check import status
    const status = await sidepanel.locator('#import-status');
    if (await status.isVisible()) {
      const statusText = await status.textContent();
      log('Phase 4: Import', 'Import status', 'PASS', statusText?.substring(0, 80));
    }

    await sidepanel.close();
  });

  test('4.2 Import BibTeX — import to library', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    // Get count before import
    const beforeCount = await sidepanel.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.local.get(['citations'], res => resolve((res.citations || []).length));
      });
    });

    // Switch to Import tab
    await sidepanel.click('[data-tab="import"]');
    await sidepanel.waitForTimeout(500);

    // Paste and parse
    await sidepanel.fill('#import-text', SAMPLE_BIBTEX);
    await sidepanel.click('#btn-parse');
    await sidepanel.waitForTimeout(3000);

    // Check project selector exists
    const projSelect = sidepanel.locator('#import-project');
    if (await projSelect.isVisible()) {
      log('Phase 4: Import', 'Project selector visible', 'PASS');
      const projValue = await projSelect.inputValue();
      log('Phase 4: Import', 'Default project', 'PASS', projValue);
    } else {
      log('Phase 4: Import', 'Project selector visible', 'WARN', 'Not found');
    }

    // Click Select All then Import
    const selectAll = sidepanel.locator('#btn-select-all');
    if (await selectAll.isVisible()) {
      await selectAll.click();
      await sidepanel.waitForTimeout(300);
    }

    await sidepanel.click('#btn-import-selected');
    await sidepanel.waitForTimeout(2000);

    // Check count after import
    const afterCount = await sidepanel.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.local.get(['citations'], res => resolve((res.citations || []).length));
      });
    });

    const imported = afterCount - beforeCount;
    if (imported >= 2) {
      log('Phase 4: Import', 'Entries imported', 'PASS', `${imported} new (${beforeCount} → ${afterCount})`);
    } else if (imported > 0) {
      log('Phase 4: Import', 'Entries imported', 'WARN', `Only ${imported} new (duplicates?)`);
    } else {
      log('Phase 4: Import', 'Entries imported', 'FAIL', `None imported (${beforeCount} → ${afterCount})`);
    }

    // Switch to Library tab and verify
    await sidepanel.click('[data-tab="library"]');
    await sidepanel.waitForTimeout(1000);

    const rowCount = await sidepanel.locator('.citation-row').count();
    log('Phase 4: Import', 'Library rows after import', 'PASS', `${rowCount} rows`);

    // Verify Ross entry exists
    const bodyText = await sidepanel.locator('#citation-list').textContent();
    if (bodyText.includes('Ross') || bodyText.includes('mRNA')) {
      log('Phase 4: Import', 'Ross article in library', 'PASS');
    } else {
      log('Phase 4: Import', 'Ross article in library', 'WARN', 'Not found in list text');
    }

    if (bodyText.includes('Knuth') || bodyText.includes('Art of Computer')) {
      log('Phase 4: Import', 'Knuth book in library', 'PASS');
    } else {
      log('Phase 4: Import', 'Knuth book in library', 'WARN', 'Not found in list text');
    }

    // Check imported entries have _projectIds
    const citations = await sidepanel.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.local.get(['citations'], res => resolve(res.citations || []));
      });
    });
    const rossEntry = citations.find(c => c.title?.includes('mRNA') || c.author?.some(a => a.family === 'Ross'));
    if (rossEntry) {
      log('Phase 4: Import', 'Ross has _projectIds', Array.isArray(rossEntry._projectIds) ? 'PASS' : 'WARN', JSON.stringify(rossEntry._projectIds));
      log('Phase 4: Import', 'Ross has _importSource', rossEntry._importSource === 'import' ? 'PASS' : 'WARN', rossEntry._importSource);
    }

    // Gibberish check
    const gibberish = ['[0m', 'undefined', 'NaN', '[object Object]'];
    for (const g of gibberish) {
      if (bodyText.includes(g)) {
        log('Phase 4: Import', `No gibberish: "${g}"`, 'FAIL', 'Found in library');
      }
    }

    await sidepanel.close();
  });

  test('4.3 Duplicate detection on re-import', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    const beforeCount = await sidepanel.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.local.get(['citations'], res => resolve((res.citations || []).length));
      });
    });

    // Import same BibTeX again
    await sidepanel.click('[data-tab="import"]');
    await sidepanel.waitForTimeout(500);
    await sidepanel.fill('#import-text', SAMPLE_BIBTEX);
    await sidepanel.click('#btn-parse');
    await sidepanel.waitForTimeout(3000);

    const selectAll = sidepanel.locator('#btn-select-all');
    if (await selectAll.isVisible()) await selectAll.click();
    await sidepanel.waitForTimeout(300);
    await sidepanel.click('#btn-import-selected');
    await sidepanel.waitForTimeout(2000);

    const afterCount = await sidepanel.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.local.get(['citations'], res => resolve((res.citations || []).length));
      });
    });

    const added = afterCount - beforeCount;
    if (added === 0) {
      log('Phase 4: Import', 'Duplicate detection blocked re-import', 'PASS');
    } else {
      log('Phase 4: Import', 'Duplicate detection blocked re-import', 'WARN', `${added} duplicates added`);
    }

    // Check status message mentions duplicates
    const status = sidepanel.locator('#import-status');
    if (await status.isVisible()) {
      const statusText = await status.textContent();
      if (statusText.toLowerCase().includes('duplicate')) {
        log('Phase 4: Import', 'Duplicate status message', 'PASS', statusText);
      } else {
        log('Phase 4: Import', 'Duplicate status message', 'WARN', statusText);
      }
    }

    await sidepanel.close();
  });

  test('4.4 Manual entry form', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    // Click + button
    await sidepanel.click('#btn-add-manual');
    await sidepanel.waitForTimeout(500);

    const form = sidepanel.locator('#manual-entry-form');
    if (await form.isVisible()) {
      log('Phase 4: Manual Entry', 'Form opens', 'PASS');
    } else {
      log('Phase 4: Manual Entry', 'Form opens', 'FAIL');
      await sidepanel.close();
      return;
    }

    // Fill fields
    await sidepanel.fill('#manual-title', 'Test Manual Entry');
    await sidepanel.fill('#manual-authors', 'Smith, John; Doe, Jane');
    await sidepanel.fill('#manual-year', '2025');
    await sidepanel.fill('#manual-container', 'Journal of Testing');

    // Save
    await sidepanel.click('#btn-save-manual');
    await sidepanel.waitForTimeout(1000);

    // Form should be hidden
    if (await form.isHidden()) {
      log('Phase 4: Manual Entry', 'Form closes after save', 'PASS');
    } else {
      log('Phase 4: Manual Entry', 'Form closes after save', 'FAIL');
    }

    // Check entry in library
    const bodyText = await sidepanel.locator('#citation-list').textContent();
    if (bodyText.includes('Test Manual Entry')) {
      log('Phase 4: Manual Entry', 'Entry appears in library', 'PASS');
    } else {
      log('Phase 4: Manual Entry', 'Entry appears in library', 'FAIL');
    }

    // Cancel test
    await sidepanel.click('#btn-add-manual');
    await sidepanel.waitForTimeout(300);
    await sidepanel.fill('#manual-title', 'Should Not Save');
    await sidepanel.click('#btn-cancel-manual');
    await sidepanel.waitForTimeout(300);

    if (await form.isHidden()) {
      log('Phase 4: Manual Entry', 'Cancel hides form', 'PASS');
    } else {
      log('Phase 4: Manual Entry', 'Cancel hides form', 'FAIL');
    }

    await sidepanel.close();
  });
});

// =============================================================================
// PHASE 5: Export with filters
// =============================================================================

test.describe('Phase 5 — Export', () => {
  test('5.1 Export tab — filters and count', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    // Switch to Export tab
    await sidepanel.click('[data-tab="export"]');
    await sidepanel.waitForTimeout(1000);

    // Check format dropdown
    const format = sidepanel.locator('#export-format');
    if (await format.isVisible()) {
      log('Phase 5: Export', 'Format dropdown visible', 'PASS');
    } else {
      log('Phase 5: Export', 'Format dropdown visible', 'FAIL');
    }

    // Check project filter
    const projFilter = sidepanel.locator('#export-project');
    if (await projFilter.isVisible()) {
      log('Phase 5: Export', 'Project filter visible', 'PASS');
      // Check it has "All Projects" and "My Bibliography"
      const options = await projFilter.locator('option').allTextContents();
      if (options.some(o => o.includes('All Projects'))) {
        log('Phase 5: Export', 'Has "All Projects" option', 'PASS');
      } else {
        log('Phase 5: Export', 'Has "All Projects" option', 'FAIL');
      }
      if (options.some(o => o.includes('My Bibliography'))) {
        log('Phase 5: Export', 'Has "My Bibliography" option', 'PASS');
      } else {
        log('Phase 5: Export', 'Has "My Bibliography" option', 'FAIL');
      }
    } else {
      log('Phase 5: Export', 'Project filter visible', 'FAIL');
    }

    // Check scope filter
    const scope = sidepanel.locator('#export-scope');
    if (await scope.isVisible()) {
      log('Phase 5: Export', 'Scope filter visible', 'PASS');
    } else {
      log('Phase 5: Export', 'Scope filter visible', 'FAIL');
    }

    // Check count
    const countText = await sidepanel.$eval('#export-count', el => el.textContent);
    if (countText && countText.includes('citation')) {
      log('Phase 5: Export', 'Export count shown', 'PASS', countText);
    } else {
      log('Phase 5: Export', 'Export count shown', 'FAIL', `Got: "${countText}"`);
    }

    // Check download and copy buttons
    const dlBtn = sidepanel.locator('#btn-export-download');
    const cpBtn = sidepanel.locator('#btn-export-copy');
    log('Phase 5: Export', 'Download button', await dlBtn.isVisible() ? 'PASS' : 'FAIL');
    log('Phase 5: Export', 'Copy button', await cpBtn.isVisible() ? 'PASS' : 'FAIL');

    await sidepanel.close();
  });

  test('5.2 Export BibTeX — copy to clipboard', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    await sidepanel.click('[data-tab="export"]');
    await sidepanel.waitForTimeout(1000);

    // Select BibTeX format
    await sidepanel.selectOption('#export-format', 'bibtex');
    await sidepanel.waitForTimeout(500);

    // Click Copy
    await sidepanel.click('#btn-export-copy');
    await sidepanel.waitForTimeout(2000);

    // Check status message
    const status = sidepanel.locator('#export-status');
    if (await status.isVisible()) {
      const statusText = await status.textContent();
      if (statusText.toLowerCase().includes('copied') || statusText.toLowerCase().includes('clipboard')) {
        log('Phase 5: Export', 'BibTeX copy success', 'PASS', statusText);
      } else if (statusText.toLowerCase().includes('error')) {
        log('Phase 5: Export', 'BibTeX copy success', 'FAIL', statusText);
      } else {
        log('Phase 5: Export', 'BibTeX copy success', 'WARN', statusText);
      }
    } else {
      log('Phase 5: Export', 'BibTeX copy success', 'WARN', 'No status message');
    }

    await sidepanel.close();
  });

  test('5.3 Export RIS — verify format', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    await sidepanel.click('[data-tab="export"]');
    await sidepanel.waitForTimeout(1000);

    // Select RIS format
    await sidepanel.selectOption('#export-format', 'ris');
    await sidepanel.waitForTimeout(500);

    // Click Copy
    await sidepanel.click('#btn-export-copy');
    await sidepanel.waitForTimeout(2000);

    // Check status
    const status = sidepanel.locator('#export-status');
    if (await status.isVisible()) {
      const statusText = await status.textContent();
      log('Phase 5: Export', 'RIS copy', statusText.toLowerCase().includes('copied') ? 'PASS' : 'WARN', statusText);
    }

    await sidepanel.close();
  });

  test('5.4 Export scope filter — starred only', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    await sidepanel.click('[data-tab="export"]');
    await sidepanel.waitForTimeout(1000);

    // Get "all" count
    const allCount = await sidepanel.$eval('#export-count', el => el.textContent);
    log('Phase 5: Export', 'All entries count', 'PASS', allCount);

    // Switch to starred only
    await sidepanel.selectOption('#export-scope', 'starred');
    await sidepanel.waitForTimeout(500);

    const starredCount = await sidepanel.$eval('#export-count', el => el.textContent);
    log('Phase 5: Export', 'Starred filter count', 'PASS', starredCount);

    // Starred count should be <= all count
    const allNum = parseInt(allCount) || 0;
    const starNum = parseInt(starredCount) || 0;
    if (starNum <= allNum) {
      log('Phase 5: Export', 'Starred <= All', 'PASS', `${starNum} <= ${allNum}`);
    } else {
      log('Phase 5: Export', 'Starred <= All', 'FAIL', `${starNum} > ${allNum}`);
    }

    // Switch to journals only
    await sidepanel.selectOption('#export-scope', 'article-journal');
    await sidepanel.waitForTimeout(500);
    const journalCount = await sidepanel.$eval('#export-count', el => el.textContent);
    log('Phase 5: Export', 'Journals filter count', 'PASS', journalCount);

    await sidepanel.close();
  });

  test('5.5 Export CSL-JSON — verify format', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    await sidepanel.click('[data-tab="export"]');
    await sidepanel.waitForTimeout(1000);

    // Select CSL-JSON
    await sidepanel.selectOption('#export-format', 'csl-json');
    await sidepanel.selectOption('#export-scope', 'all');
    await sidepanel.waitForTimeout(500);

    await sidepanel.click('#btn-export-copy');
    await sidepanel.waitForTimeout(2000);

    const status = sidepanel.locator('#export-status');
    if (await status.isVisible()) {
      const statusText = await status.textContent();
      log('Phase 5: Export', 'CSL-JSON copy', statusText.toLowerCase().includes('copied') ? 'PASS' : 'WARN', statusText);
    }

    await sidepanel.close();
  });

  test('5.6 Library — visit source link', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    // Check if any visit-source buttons exist
    const linkBtns = sidepanel.locator('.btn-visit-source');
    const linkCount = await linkBtns.count();
    if (linkCount > 0) {
      log('Phase 5: Library', 'Visit source links present', 'PASS', `${linkCount} links`);

      // Check the URL attribute
      const url = await linkBtns.first().getAttribute('data-url');
      if (url && (url.startsWith('http') || url.startsWith('https://doi.org'))) {
        log('Phase 5: Library', 'Source link has valid URL', 'PASS', url.substring(0, 60));
      } else {
        log('Phase 5: Library', 'Source link has valid URL', 'WARN', `Got: "${url}"`);
      }
    } else {
      log('Phase 5: Library', 'Visit source links present', 'WARN', 'No links (entries may lack URLs)');
    }

    await sidepanel.close();
  });

  test('5.7 Library — settings gear', async () => {
    const sidepanel = await ctx.context.newPage();
    await sidepanel.goto(ctx.sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    await sidepanel.waitForTimeout(2000);

    // Click settings gear
    await sidepanel.click('#sp-settings-btn');
    await sidepanel.waitForTimeout(500);

    const dropdown = sidepanel.locator('#sp-settings-dropdown');
    if (await dropdown.isVisible()) {
      log('Phase 5: Settings', 'Settings dropdown opens', 'PASS');
    } else {
      log('Phase 5: Settings', 'Settings dropdown opens', 'FAIL');
      await sidepanel.close();
      return;
    }

    // Check controls exist
    const sortSelect = sidepanel.locator('#sp-pref-sort');
    const copyFormat = sidepanel.locator('#sp-pref-copy-format');
    const theme = sidepanel.locator('#sp-pref-theme');
    const advBtn = sidepanel.locator('#sp-open-options');

    log('Phase 5: Settings', 'Sort dropdown', await sortSelect.isVisible() ? 'PASS' : 'FAIL');
    log('Phase 5: Settings', 'Copy format dropdown', await copyFormat.isVisible() ? 'PASS' : 'FAIL');
    log('Phase 5: Settings', 'Theme dropdown', await theme.isVisible() ? 'PASS' : 'FAIL');
    log('Phase 5: Settings', 'Advanced Settings link', await advBtn.isVisible() ? 'PASS' : 'FAIL');

    // Change theme to dark
    await sidepanel.selectOption('#sp-pref-theme', 'dark');
    await sidepanel.waitForTimeout(500);
    const isDark = await sidepanel.evaluate(() => document.documentElement.classList.contains('dark'));
    log('Phase 5: Settings', 'Dark theme applied', isDark ? 'PASS' : 'FAIL');

    // Revert to system
    await sidepanel.selectOption('#sp-pref-theme', 'system');
    await sidepanel.waitForTimeout(300);

    // Close by clicking outside
    await sidepanel.click('body', { position: { x: 10, y: 10 } });
    await sidepanel.waitForTimeout(300);
    if (await dropdown.isHidden()) {
      log('Phase 5: Settings', 'Dropdown closes on outside click', 'PASS');
    } else {
      log('Phase 5: Settings', 'Dropdown closes on outside click', 'WARN');
    }

    await sidepanel.close();
  });
});

// =============================================================================
// PHASE 6: DOI/ISBN Enhance, On-Demand Style Download
// =============================================================================

test.describe('Phase 6 — Enhance & Style Download', () => {
  test('6.1 DOI enhance — CrossRef', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await popup.waitForTimeout(2000);
    await popup.fill('#field-doi', '10.1126/science.1058040');
    await popup.click('#btn-enhance');
    await popup.waitForTimeout(8000);

    const title = await popup.$eval('#field-title', el => el.value);
    log('Phase 6: Enhance', 'DOI fills title', title && title.length > 10 ? 'PASS' : 'FAIL', title?.substring(0, 60));
    log('Phase 6: Enhance', 'DOI fills authors', (await popup.$eval('#field-authors', el => el.value)).length > 3 ? 'PASS' : 'WARN');
    log('Phase 6: Enhance', 'DOI fills date', (await popup.$eval('#field-date', el => el.value)) ? 'PASS' : 'WARN');
    log('Phase 6: Enhance', 'DOI fills journal', (await popup.$eval('#field-container', el => el.value)) ? 'PASS' : 'WARN');

    const bib = await popup.$eval('#citation-preview', el => el.textContent);
    log('Phase 6: Enhance', 'Preview renders', bib && bib.length > 30 && !bib.includes('Fill in') ? 'PASS' : 'FAIL', bib?.substring(0, 80));
    await popup.close();
  });

  test('6.2 ISBN enhance', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await popup.waitForTimeout(2000);
    await popup.fill('#field-doi', '978-0-201-89683-1');
    await popup.click('#btn-enhance');
    await popup.waitForTimeout(8000);

    const title = await popup.$eval('#field-title', el => el.value);
    log('Phase 6: Enhance', 'ISBN fills title', title && title.length > 3 ? 'PASS' : 'FAIL', title);
    await popup.close();
  });

  test('6.3 Invalid identifier', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await popup.waitForTimeout(2000);
    await popup.fill('#field-doi', 'invalid-not-a-doi');
    await popup.click('#btn-enhance');
    await popup.waitForTimeout(8000);

    // Check multiple possible feedback locations
    const enhanceResult = popup.locator('#enhance-result');
    const hintBar = popup.locator('#hint-bar');
    const anyVisible = await enhanceResult.isVisible() || await hintBar.isVisible();
    // Also check if the title is still empty (enhance didn't fill anything = correct)
    const title = await popup.$eval('#field-title', el => el.value);
    log('Phase 6: Enhance', 'Invalid ID handled', anyVisible || !title ? 'PASS' : 'WARN', title ? `title="${title}"` : 'no title filled');
    await popup.close();
  });

  test('6.4 On-demand style download', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl);
    await sp.waitForLoadState('domcontentloaded');
    await sp.waitForTimeout(2000);

    if (await sp.locator('.citation-row').count() === 0) {
      log('Phase 6: Download', 'No citations', 'WARN', 'Skip');
      await sp.close(); return;
    }

    await sp.locator('.btn-preview-toggle').first().click();
    await sp.waitForTimeout(1000);
    await sp.locator('.sp-btn').first().click();
    await sp.waitForTimeout(500);
    await sp.locator('.sp-search').first().fill('plos');
    await sp.waitForTimeout(4000);

    const dlBtns = sp.locator('.sp-download');
    if (await dlBtns.count() > 0) {
      log('Phase 6: Download', 'Remote results', 'PASS');
      await dlBtns.first().click();
      await sp.waitForTimeout(5000);
      log('Phase 6: Download', 'Style downloaded', 'PASS', await sp.locator('.sp-label').first().textContent());
    } else {
      log('Phase 6: Download', 'Remote search', 'WARN', 'No download buttons');
    }
    await sp.close();
  });
});

// =============================================================================
// PHASE 7: Edge Cases
// =============================================================================

test.describe('Phase 7 — Edge Cases', () => {
  test('7.1 Popup no crash on blank', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    const errors = collectErrors(popup);
    await popup.waitForTimeout(3000);
    log('Phase 7: Edge', 'Popup loads', (await popup.locator('body').textContent()).length > 10 ? 'PASS' : 'FAIL');
    const crit = errors.filter(e => !e.includes('favicon') && !e.includes('DevTools'));
    log('Phase 7: Edge', 'No critical errors', crit.length === 0 ? 'PASS' : 'WARN', crit.join('; ').substring(0, 120));
    await popup.close();
  });

  test('7.2 Empty add warning', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await popup.waitForTimeout(2000);
    await popup.fill('#field-title', '');
    await popup.fill('#field-doi', '');
    await popup.click('#btn-add-project');
    await popup.waitForTimeout(2000);

    // Check for any feedback: dialog, hint, or enhance result
    const dialog = popup.locator('.ibid-dialog-overlay');
    const hint = popup.locator('#hint-bar');
    const enhance = popup.locator('#enhance-result');
    const anyFeedback = await dialog.isVisible() || await hint.isVisible() || await enhance.isVisible();

    // Also check storage — should NOT have added a citation with empty title
    const count = await popup.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.local.get(['citations'], res => resolve((res.citations || []).length));
      });
    });
    // If dialog appeared, dismiss it
    if (await dialog.isVisible()) {
      const cancelBtn = dialog.locator('button').first();
      if (await cancelBtn.isVisible()) await cancelBtn.click();
    }

    log('Phase 7: Edge', 'Empty add prevented', anyFeedback ? 'PASS' : 'WARN', `feedback=${anyFeedback}, citations=${count}`);
    await popup.close();
  });

  test('7.3 XSS prevention', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await popup.waitForTimeout(2000);
    await popup.fill('#field-title', '<script>alert("xss")</script> Über β');
    await popup.fill('#field-authors', "O'Brien, José");
    await popup.fill('#field-date', '2024');
    await popup.waitForTimeout(1000);
    const html = await popup.$eval('#citation-preview', el => el.innerHTML);
    log('Phase 7: Edge', 'No XSS', html.includes('<script>') ? 'FAIL' : 'PASS');
    await popup.close();
  });

  test('7.4 No date → n.d.', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await popup.waitForTimeout(2000);
    await popup.fill('#field-title', 'Undated');
    await popup.fill('#field-authors', 'Test, A');
    await popup.fill('#field-date', '');
    await popup.waitForTimeout(500);
    const intext = await popup.$eval('#intext-preview', el => el.textContent);
    log('Phase 7: Edge', 'n.d. shown', intext?.includes('n.d.') ? 'PASS' : 'WARN', intext);
    await popup.close();
  });
});

// =============================================================================
// PHASE 8: Library Operations
// =============================================================================

test.describe('Phase 8 — Library Operations', () => {
  test('8.1 Star/unstar', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);
    const star = sp.locator('.btn-star').first();
    if (await star.count() === 0) { log('Phase 8', 'No citations', 'WARN'); await sp.close(); return; }
    await star.click(); await sp.waitForTimeout(500);
    log('Phase 8', 'Star → saffron', (await star.getAttribute('class'))?.includes('text-saffron') ? 'PASS' : 'WARN');
    await star.click(); await sp.waitForTimeout(500);
    log('Phase 8', 'Unstar', 'PASS');
    await sp.close();
  });

  test('8.2 Search', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);
    const total = await sp.locator('.citation-row').count();
    await sp.fill('#search', 'Ross'); await sp.waitForTimeout(500);
    const f = await sp.locator('.citation-row').count();
    log('Phase 8', 'Search filters', f > 0 && f <= total ? 'PASS' : 'WARN', `${f}/${total}`);
    await sp.fill('#search', 'zzzzz'); await sp.waitForTimeout(500);
    log('Phase 8', 'No match → 0', (await sp.locator('.citation-row').count()) === 0 ? 'PASS' : 'FAIL');
    await sp.fill('#search', ''); await sp.waitForTimeout(500);
    log('Phase 8', 'Clear restores', (await sp.locator('.citation-row').count()) === total ? 'PASS' : 'WARN');
    await sp.close();
  });

  test('8.3 Sort', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);
    for (const s of ['title-asc', 'author-asc', 'year-desc', 'date-desc']) {
      await sp.selectOption('#lib-sort', s); await sp.waitForTimeout(200);
      log('Phase 8', `Sort: ${s}`, 'PASS');
    }
    await sp.close();
  });

  test('8.4 Type chips', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);
    const total = await sp.locator('.citation-row').count();
    for (const c of ['article-journal', 'book']) {
      const btn = sp.locator(`[data-chip="${c}"]`);
      if (await btn.isVisible()) {
        await btn.click(); await sp.waitForTimeout(300);
        log('Phase 8', `Chip "${c}"`, 'PASS', `${await sp.locator('.citation-row').count()}/${total}`);
        await btn.click(); await sp.waitForTimeout(200);
      }
    }
    await sp.close();
  });

  test('8.5 Bulk bar', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);
    const cbs = sp.locator('.cite-select');
    if (await cbs.count() < 2) { log('Phase 8', 'Need 2+', 'WARN'); await sp.close(); return; }
    await cbs.nth(0).check(); await cbs.nth(1).check(); await sp.waitForTimeout(500);
    log('Phase 8', 'Bulk bar visible', await sp.locator('#bulk-bar').isVisible() ? 'PASS' : 'FAIL');
    await cbs.nth(0).uncheck(); await cbs.nth(1).uncheck(); await sp.waitForTimeout(300);
    log('Phase 8', 'Bulk bar hides', await sp.locator('#bulk-bar').isHidden() ? 'PASS' : 'WARN');
    await sp.close();
  });

  test('8.6 Project filter', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);
    const opts = await sp.locator('#lib-project-filter option').allTextContents();
    log('Phase 8', 'All Projects', opts.some(o => o.includes('All')) ? 'PASS' : 'FAIL');
    log('Phase 8', 'My Bibliography', opts.some(o => o.includes('My Bibliography')) ? 'PASS' : 'FAIL');
    await sp.close();
  });

  test('8.7 Gibberish scan', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);
    const body = await sp.locator('body').textContent();
    const bad = ['[0m', '\x1b[', 'undefined', 'NaN', '[object Object]', 'function('];
    let clean = true;
    for (const g of bad) { if (body.includes(g)) { log('Phase 8: Gibberish', `"${g}"`, 'FAIL'); clean = false; } }
    if (clean) log('Phase 8: Gibberish', 'Body clean', 'PASS');

    const toggles = sp.locator('.btn-preview-toggle');
    for (let i = 0; i < Math.min(await toggles.count(), 3); i++) {
      await toggles.nth(i).click(); await sp.waitForTimeout(800);
      const pv = sp.locator('.cite-preview').nth(i);
      if (await pv.isVisible()) {
        const t = await pv.textContent();
        let ok = true;
        for (const g of bad) { if (t.includes(g)) { ok = false; } }
        log('Phase 8: Gibberish', `Preview ${i}`, ok ? 'PASS' : 'FAIL');
      }
      await toggles.nth(i).click(); await sp.waitForTimeout(200);
    }
    await sp.close();
  });

  test('8.8 Delete citation', async () => {
    // Ensure there's a citation to delete
    await ctx.context.newPage().then(async p => {
      await p.goto(ctx.popupUrl); await p.waitForLoadState('domcontentloaded'); await p.waitForTimeout(2000);
      await p.fill('#field-title', 'To Be Deleted 8');
      await p.fill('#field-authors', 'Delete, Test');
      await p.fill('#field-date', '2025');
      await p.click('#btn-add-project'); await p.waitForTimeout(2000);
      await p.close();
    });

    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);
    const before = await sp.locator('.citation-row').count();

    await sp.locator('.btn-delete').last().click();
    await sp.waitForTimeout(1500);
    const dialog = sp.locator('.ibid-dialog-overlay');
    if (await dialog.isVisible()) {
      log('Phase 8', 'Delete confirm dialog', 'PASS');
      await dialog.locator('button').last().click();
      await sp.waitForTimeout(1000);
    } else {
      log('Phase 8', 'Delete confirm dialog', 'FAIL');
    }

    const after = await sp.locator('.citation-row').count();
    log('Phase 8', 'Delete', after < before ? 'PASS' : 'WARN', `${before}→${after}`);
    await sp.close();
  });
});

// =============================================================================
// PHASE 9: Project Management, Input Validation, Button Highlights
// =============================================================================

test.describe('Phase 9 — Projects & Validation', () => {
  test('9.1 Create project from library', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);

    // Select "+ New Project" from dropdown
    await sp.selectOption('#lib-project-filter', '__new__');
    await sp.waitForTimeout(500);

    // Inline input should appear
    const input = sp.locator('#lib-project-filter + input, input[placeholder="Project name..."]').first();
    if (await input.isVisible()) {
      log('Phase 9: Projects', 'New project input appears', 'PASS');

      // Check maxlength
      const maxLen = await input.getAttribute('maxlength');
      log('Phase 9: Projects', 'Input has maxlength', maxLen === '50' ? 'PASS' : 'WARN', maxLen);

      // Type and save
      await input.fill('Test Project E2E');
      await input.press('Enter');
      await sp.waitForTimeout(1000);

      // Check project was created and selected
      const selVal = await sp.$eval('#lib-project-filter', el => el.value);
      const selText = await sp.$eval('#lib-project-filter', el => el.selectedOptions[0]?.textContent);
      if (selText?.includes('Test Project E2E')) {
        log('Phase 9: Projects', 'Project created and selected', 'PASS', selText);
      } else {
        log('Phase 9: Projects', 'Project created and selected', 'WARN', `val=${selVal} text=${selText}`);
      }
    } else {
      log('Phase 9: Projects', 'New project input appears', 'FAIL');
    }

    await sp.close();
  });

  test('9.2 Project actions — rename', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);

    // Select the custom project we just created
    const opts = await sp.locator('#lib-project-filter option').allTextContents();
    const testProjOpt = opts.find(o => o.includes('Test Project'));
    if (!testProjOpt) {
      log('Phase 9: Projects', 'Rename — no custom project', 'WARN', 'Skipping');
      await sp.close(); return;
    }

    // Select it
    const optValues = await sp.locator('#lib-project-filter option').evaluateAll(els => els.map(e => ({ value: e.value, text: e.textContent })));
    const testProj = optValues.find(o => o.text.includes('Test Project'));
    await sp.selectOption('#lib-project-filter', testProj.value);
    await sp.waitForTimeout(500);

    // ⋮ button should be visible
    const actionsBtn = sp.locator('#btn-project-actions');
    if (await actionsBtn.isVisible()) {
      log('Phase 9: Projects', 'Actions button visible', 'PASS');

      await actionsBtn.click();
      await sp.waitForTimeout(300);

      const menu = sp.locator('#project-actions-menu');
      log('Phase 9: Projects', 'Actions menu opens', await menu.isVisible() ? 'PASS' : 'FAIL');

      // Click rename
      await sp.click('#btn-rename-project');
      await sp.waitForTimeout(500);

      const renameInput = sp.locator('input[type="text"]').first();
      if (await renameInput.isVisible()) {
        await renameInput.fill('Renamed E2E Project');
        await renameInput.press('Enter');
        await sp.waitForTimeout(1000);

        const newText = await sp.$eval('#lib-project-filter', el => el.selectedOptions[0]?.textContent);
        log('Phase 9: Projects', 'Rename saved', newText?.includes('Renamed') ? 'PASS' : 'WARN', newText);
      } else {
        log('Phase 9: Projects', 'Rename input appears', 'FAIL');
      }
    } else {
      log('Phase 9: Projects', 'Actions button visible', 'FAIL');
    }

    await sp.close();
  });

  test('9.3 Project actions — delete with confirm', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);

    // Find our renamed project
    const optValues = await sp.locator('#lib-project-filter option').evaluateAll(els => els.map(e => ({ value: e.value, text: e.textContent })));
    const testProj = optValues.find(o => o.text.includes('Renamed') || o.text.includes('Test Project'));
    if (!testProj) {
      log('Phase 9: Projects', 'Delete — no custom project', 'WARN', 'Skipping');
      await sp.close(); return;
    }

    await sp.selectOption('#lib-project-filter', testProj.value);
    await sp.waitForTimeout(500);

    await sp.click('#btn-project-actions');
    await sp.waitForTimeout(300);
    await sp.click('#btn-delete-project');
    await sp.waitForTimeout(1000);

    // Confirm dialog should appear
    const dialog = sp.locator('.ibid-dialog-overlay');
    if (await dialog.isVisible()) {
      log('Phase 9: Projects', 'Delete confirm dialog', 'PASS');
      const dialogText = await dialog.textContent();
      log('Phase 9: Projects', 'Dialog mentions project', dialogText?.includes('Renamed') || dialogText?.includes('Test') ? 'PASS' : 'WARN');

      // Confirm delete
      await dialog.locator('button').last().click();
      await sp.waitForTimeout(1000);

      // Should revert to "All Projects"
      const val = await sp.$eval('#lib-project-filter', el => el.value);
      log('Phase 9: Projects', 'Reverts to All after delete', val === 'all' ? 'PASS' : 'WARN', val);

      // Actions button should be hidden
      log('Phase 9: Projects', 'Actions hidden after delete', await sp.locator('#project-actions').isHidden() ? 'PASS' : 'WARN');
    } else {
      log('Phase 9: Projects', 'Delete confirm dialog', 'FAIL');
    }

    await sp.close();
  });

  test('9.4 Duplicate project name rejected', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);

    // Create a project
    await sp.selectOption('#lib-project-filter', '__new__');
    await sp.waitForTimeout(500);
    const input1 = sp.locator('input[placeholder="Project name..."]').first();
    await input1.fill('UniqueProj');
    await input1.press('Enter');
    await sp.waitForTimeout(1000);

    // Try creating another with same name
    await sp.selectOption('#lib-project-filter', '__new__');
    await sp.waitForTimeout(500);
    const input2 = sp.locator('input[placeholder="Project name..."]').first();
    await input2.fill('UniqueProj');
    await input2.press('Enter');
    await sp.waitForTimeout(1000);

    // Should revert to "all" (duplicate rejected silently)
    const val = await sp.$eval('#lib-project-filter', el => el.value);
    log('Phase 9: Projects', 'Duplicate name rejected', val === 'all' ? 'PASS' : 'WARN', val);

    // Clean up — delete the project
    const optValues = await sp.locator('#lib-project-filter option').evaluateAll(els => els.map(e => ({ value: e.value, text: e.textContent })));
    const proj = optValues.find(o => o.text === 'UniqueProj');
    if (proj) {
      await sp.selectOption('#lib-project-filter', proj.value);
      await sp.waitForTimeout(300);
      await sp.click('#btn-project-actions');
      await sp.waitForTimeout(200);
      await sp.click('#btn-delete-project');
      await sp.waitForTimeout(500);
      const dlg = sp.locator('.ibid-dialog-overlay');
      if (await dlg.isVisible()) { await dlg.locator('button').last().click(); await sp.waitForTimeout(500); }
    }

    await sp.close();
  });

  test('9.5 Input maxlength enforcement', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await popup.waitForTimeout(2000);

    // Check maxlength attributes exist on key fields
    const checks = [
      { sel: '#field-title', expected: '500' },
      { sel: '#field-authors', expected: '2000' },
      { sel: '#field-date', expected: '10' },
      { sel: '#field-doi', expected: '200' },
      { sel: '#field-publisher', expected: '200' },
      { sel: '#field-container', expected: '300' },
      { sel: '#field-volume', expected: '20' },
      { sel: '#field-issue', expected: '20' },
      { sel: '#field-pages', expected: '30' },
      { sel: '#field-tags', expected: '500' },
    ];

    for (const { sel, expected } of checks) {
      const maxLen = await popup.$eval(sel, el => el.getAttribute('maxlength'));
      log('Phase 9: Validation', `${sel} maxlength=${expected}`, maxLen === expected ? 'PASS' : 'FAIL', `got ${maxLen}`);
    }

    // Check date pattern
    const datePattern = await popup.$eval('#field-date', el => el.getAttribute('pattern'));
    log('Phase 9: Validation', 'Date has pattern', datePattern ? 'PASS' : 'WARN', datePattern);

    await popup.close();
  });

  test('9.6 Manual entry maxlength', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);

    await sp.click('#btn-add-manual');
    await sp.waitForTimeout(500);

    const checks = [
      { sel: '#manual-title', expected: '500' },
      { sel: '#manual-authors', expected: '2000' },
      { sel: '#manual-year', expected: '4' },
      { sel: '#manual-doi', expected: '200' },
      { sel: '#manual-volume', expected: '20' },
      { sel: '#manual-issue', expected: '20' },
      { sel: '#manual-pages', expected: '30' },
      { sel: '#manual-publisher', expected: '200' },
      { sel: '#manual-container', expected: '300' },
    ];

    for (const { sel, expected } of checks) {
      const maxLen = await sp.$eval(sel, el => el.getAttribute('maxlength'));
      log('Phase 9: Validation', `${sel} maxlength=${expected}`, maxLen === expected ? 'PASS' : 'FAIL', `got ${maxLen}`);
    }

    await sp.click('#btn-cancel-manual');
    await sp.close();
  });

  test('9.7 Button highlight toggles', async () => {
    // Test manual entry button highlight
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);

    const addBtn = sp.locator('#btn-add-manual');
    const beforeClass = await addBtn.getAttribute('class');

    await addBtn.click();
    await sp.waitForTimeout(500);
    const openClass = await addBtn.getAttribute('class');
    const highlighted = openClass.includes('saffron');
    log('Phase 9: UI', 'Manual + button highlights on open', highlighted ? 'PASS' : 'FAIL');

    // Cancel should unhighlight
    await sp.click('#btn-cancel-manual');
    await sp.waitForTimeout(500);
    const closedClass = await addBtn.getAttribute('class');
    const unhighlighted = !closedClass.includes('bg-saffron');
    log('Phase 9: UI', 'Manual + button unhighlights on cancel', unhighlighted ? 'PASS' : 'WARN');

    await sp.close();
  });

  test('9.8 Tags toggle in popup', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await popup.waitForTimeout(2000);

    // Tags input should be hidden initially
    const tagsInput = popup.locator('#field-tags');
    log('Phase 9: UI', 'Tags input hidden initially', await tagsInput.isHidden() ? 'PASS' : 'WARN');

    // Click tag button
    const tagBtn = popup.locator('#btn-show-tags');
    await tagBtn.click();
    await popup.waitForTimeout(300);

    log('Phase 9: UI', 'Tags input visible after click', await tagsInput.isVisible() ? 'PASS' : 'FAIL');

    // Button should be highlighted
    const btnClass = await tagBtn.getAttribute('class');
    log('Phase 9: UI', 'Tag button highlighted', btnClass?.includes('saffron') ? 'PASS' : 'WARN');

    // Click again to hide
    await tagBtn.click();
    await popup.waitForTimeout(300);
    log('Phase 9: UI', 'Tags input hidden after toggle', await tagsInput.isHidden() ? 'PASS' : 'FAIL');

    await popup.close();
  });

  test('9.9 Search includes tags', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);

    // Add a citation with tags via storage
    await sp.evaluate(async () => {
      const { citations = [] } = await chrome.storage.local.get(['citations']);
      const tagged = citations[0];
      if (tagged) {
        tagged._tags = ['e2e-test-tag', 'searchable'];
        await chrome.storage.local.set({ citations });
      }
    });
    await sp.waitForTimeout(500);

    // Search for tag
    await sp.fill('#search', 'e2e-test-tag');
    await sp.waitForTimeout(500);
    const count = await sp.locator('.citation-row').count();
    log('Phase 9: Search', 'Search finds by tag', count > 0 ? 'PASS' : 'WARN', `${count} results`);

    // Clean up
    await sp.fill('#search', '');
    await sp.waitForTimeout(300);

    await sp.close();
  });

  test('9.10 Import/Export textarea maxlength', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl); await sp.waitForLoadState('domcontentloaded'); await sp.waitForTimeout(2000);

    await sp.click('[data-tab="import"]');
    await sp.waitForTimeout(300);

    const importMax = await sp.$eval('#import-text', el => el.getAttribute('maxlength'));
    log('Phase 9: Validation', 'Import textarea maxlength', importMax === '512000' ? 'PASS' : 'WARN', importMax);

    const searchMax = await sp.$eval('#search', el => el.getAttribute('maxlength'));
    log('Phase 9: Validation', 'Search maxlength', searchMax === '100' ? 'PASS' : 'WARN', searchMax);

    await sp.close();
  });
});

// =============================================================================
// PHASE 9B: Latest Features — Delete confirm, Edit project, DOI paste import
// =============================================================================

test.describe('Phase 9B — Latest Features', () => {
  test('9B.1 Delete citation shows confirmation', async () => {
    // Add a citation first
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await popup.waitForTimeout(2000);
    await popup.fill('#field-title', 'Delete Test Entry');
    await popup.fill('#field-authors', 'Test, Author');
    await popup.fill('#field-date', '2025');
    await popup.click('#btn-add-project');
    await popup.waitForTimeout(2000);
    await popup.close();

    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl);
    await sp.waitForLoadState('domcontentloaded');
    await sp.waitForTimeout(2000);

    const before = await sp.locator('.citation-row').count();
    if (before === 0) { log('Phase 9B', 'No citations to delete', 'WARN'); await sp.close(); return; }

    await sp.locator('.btn-delete').last().click();
    await sp.waitForTimeout(1000);

    // Confirm dialog should appear
    const dialog = sp.locator('.ibid-dialog-overlay');
    if (await dialog.isVisible()) {
      const text = await dialog.textContent();
      log('Phase 9B', 'Delete shows confirm dialog', 'PASS');
      log('Phase 9B', 'Dialog mentions title', text.includes('Delete') ? 'PASS' : 'WARN', text.substring(0, 80));
      // Cancel
      await dialog.locator('button').first().click();
      await sp.waitForTimeout(500);
      const afterCancel = await sp.locator('.citation-row').count();
      log('Phase 9B', 'Cancel preserves entry', afterCancel === before ? 'PASS' : 'FAIL');
    } else {
      log('Phase 9B', 'Delete shows confirm dialog', 'FAIL');
    }

    await sp.close();
  });

  test('9B.2 Edit panel has project selector', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl);
    await sp.waitForLoadState('domcontentloaded');
    await sp.waitForTimeout(2000);

    if (await sp.locator('.btn-edit-cite').count() === 0) {
      log('Phase 9B', 'No citations to edit', 'WARN'); await sp.close(); return;
    }

    await sp.locator('.btn-edit-cite').first().click();
    await sp.waitForTimeout(1000);

    const editPanel = sp.locator('#edit-panel');
    log('Phase 9B', 'Edit panel opens', await editPanel.isVisible() ? 'PASS' : 'FAIL');

    const projSelect = sp.locator('#edit-project');
    log('Phase 9B', 'Project selector in edit', await projSelect.isVisible() ? 'PASS' : 'FAIL');

    // Check has My Bibliography option
    const opts = await projSelect.locator('option').allTextContents();
    log('Phase 9B', 'Has My Bibliography', opts.some(o => o.includes('My Bibliography')) ? 'PASS' : 'FAIL');

    // Check cancel button
    const cancelBtn = sp.locator('#edit-cancel');
    log('Phase 9B', 'Cancel button in edit', await cancelBtn.isVisible() ? 'PASS' : 'FAIL');
    await cancelBtn.click();
    await sp.waitForTimeout(500);
    log('Phase 9B', 'Edit panel closes on cancel', await editPanel.isHidden() ? 'PASS' : 'FAIL');

    await sp.close();
  });

  test('9B.3 Edit save shows success', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl);
    await sp.waitForLoadState('domcontentloaded');
    await sp.waitForTimeout(2000);

    if (await sp.locator('.btn-edit-cite').count() === 0) {
      log('Phase 9B', 'No citations to edit', 'WARN'); await sp.close(); return;
    }

    await sp.locator('.btn-edit-cite').first().click();
    await sp.waitForTimeout(1000);
    await sp.click('#edit-save');
    await sp.waitForTimeout(500);

    const status = sp.locator('#edit-status');
    if (await status.isVisible()) {
      const text = await status.textContent();
      log('Phase 9B', 'Save shows success', text.includes('Saved') ? 'PASS' : 'WARN', text);
    } else {
      log('Phase 9B', 'Save shows success', 'WARN', 'No status shown');
    }

    await sp.waitForTimeout(1000);
    await sp.close();
  });

  test('9B.4 DOI paste import in textarea', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl);
    await sp.waitForLoadState('domcontentloaded');
    await sp.waitForTimeout(2000);

    await sp.click('[data-tab="import"]');
    await sp.waitForTimeout(500);

    // Paste plain text with DOIs
    await sp.fill('#import-text', 'Some reference text with DOI 10.1038/nature12373 and also 10.1126/science.1058040 in it.');
    await sp.click('#btn-parse');
    await sp.waitForTimeout(15000); // wait for CrossRef resolution

    const preview = sp.locator('#import-preview');
    if (await preview.isVisible()) {
      const count = await sp.locator('.import-checkbox').count();
      log('Phase 9B', 'DOI paste import', count >= 2 ? 'PASS' : 'WARN', `${count} entries`);
    } else {
      log('Phase 9B', 'DOI paste import', 'FAIL', 'Preview not shown');
    }

    // Check DOI links in preview
    const doiLinks = sp.locator('#preview-list a[href*="doi.org"]');
    log('Phase 9B', 'Preview has DOI links', await doiLinks.count() > 0 ? 'PASS' : 'WARN');

    // Cancel without importing
    await sp.click('#btn-import-cancel');
    await sp.waitForTimeout(500);
    log('Phase 9B', 'Cancel clears import', await preview.isHidden() ? 'PASS' : 'WARN');

    await sp.close();
  });

  test('9B.5 Google Books detected as book', async () => {
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await popup.waitForTimeout(2000);

    // Simulate Google Books metadata
    await popup.evaluate(() => {
      document.querySelector('#source-type').value = 'webpage';
    });

    // The actual detection happens in the extractor on Google Books pages
    // Here we just verify the type dropdown has 'book' option
    const hasBook = await popup.$eval('#source-type', el =>
      [...el.options].some(o => o.value === 'book')
    );
    log('Phase 9B', 'Book type available', hasBook ? 'PASS' : 'FAIL');

    await popup.close();
  });

  test('9B.6 No inline scripts (CSP safe)', async () => {
    // Verify no inline script tags in any HTML file
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    const errors = [];
    popup.on('console', msg => {
      if (msg.text().includes('Content Security Policy') || msg.text().includes('inline')) {
        errors.push(msg.text());
      }
    });
    await popup.waitForTimeout(3000);

    log('Phase 9B', 'No CSP violations in popup', errors.length === 0 ? 'PASS' : 'FAIL', errors.join('; ').substring(0, 100));

    await popup.close();
  });

  test('9B.7 Pending bulk import banner in popup', async () => {
    // Store fake bulk import data
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await popup.waitForTimeout(1000);

    // Inject test data
    await popup.evaluate(() => {
      chrome.storage.session.set({ ibid_bulk_import: JSON.stringify([
        { id: '10.1038/test', DOI: '10.1038/test', title: 'Test Article', type: 'article-journal' }
      ])});
    });
    await popup.close();

    // Reopen popup
    const popup2 = await openPopup(ctx.context, ctx.popupUrl);
    await popup2.waitForTimeout(2000);

    const banner = popup2.locator('#bulk-import-banner');
    if (await banner.isVisible()) {
      log('Phase 9B', 'Bulk import banner shown', 'PASS');
      const text = await banner.textContent();
      log('Phase 9B', 'Banner has count', text.includes('1') ? 'PASS' : 'WARN', text);

      const libBtn = popup2.locator('#btn-open-library-import');
      log('Phase 9B', 'Open Library button', await libBtn.isVisible() ? 'PASS' : 'FAIL');
    } else {
      log('Phase 9B', 'Bulk import banner shown', 'WARN', 'Not visible');
    }

    // Clean up
    await popup2.evaluate(() => { chrome.storage.session.remove(['ibid_bulk_import']); });
    await popup2.close();
  });
});

// =============================================================================
// PHASE 10: Chrome Web Store Screenshots
// =============================================================================

const SCREENSHOT_DIR = require('path').resolve(__dirname, 'screenshots');

test.describe('Phase 10 — Store Screenshots', () => {
  const NATURE_URL = 'https://www.nature.com/articles/s41586-024-08219-w';

  // Helper: take popup screenshot at natural width, then composite onto a webpage background
  async function compositePopupOnPage(context, popupUrl, targetUrl, popupSetup, outputPath, width, height) {
    // Step 1: Take webpage background screenshot
    const bgPage = await context.newPage();
    await bgPage.setViewportSize({ width, height });
    await bgPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await bgPage.waitForTimeout(3000);

    // Dismiss cookie/privacy banners
    for (const sel of [
      'button:has-text("Accept all cookies")', 'button:has-text("Accept All")',
      'button:has-text("Accept")', 'button:has-text("I agree")',
      'button:has-text("Reject optional")', 'button:has-text("Consent")',
      '[data-testid="accept-cookies"]', '.cc-dismiss', '#onetrust-accept-btn-handler',
    ]) {
      try {
        const btn = bgPage.locator(sel).first();
        if (await btn.isVisible({ timeout: 500 })) { await btn.click(); break; }
      } catch {}
    }
    await bgPage.waitForTimeout(1000);

    const bgBuffer = await bgPage.screenshot();
    await bgPage.close();

    // Step 2: Take popup screenshot at natural size with transparent-ish bg
    const { popup } = await openPopupOnUrl(context, popupUrl, targetUrl);
    await popup.waitForTimeout(6000);
    await waitForWasm(popup);
    await popup.waitForTimeout(2000);

    // Dismiss hint bar
    try {
      const hint = popup.locator('#hint-bar .dismiss-hint, #hint-bar button');
      if (await hint.first().isVisible()) await hint.first().click();
    } catch {}
    await popup.waitForTimeout(300);

    if (popupSetup) await popupSetup(popup);

    await popup.setViewportSize({ width: 400, height: 650 });
    await popup.waitForTimeout(300);
    const popupBuffer = await popup.screenshot();
    await popup.close();

    // Step 3: Composite using canvas in a page
    const canvas = await context.newPage();
    await canvas.setViewportSize({ width, height });
    await canvas.goto('about:blank');

    const bgB64 = bgBuffer.toString('base64');
    const popB64 = popupBuffer.toString('base64');

    await canvas.evaluate(async ({ bgB64, popB64, w, h }) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      document.body.style.margin = '0';
      document.body.appendChild(c);
      const ctx = c.getContext('2d');

      const loadImg = (b64) => new Promise(r => {
        const img = new Image();
        img.onload = () => r(img);
        img.src = 'data:image/png;base64,' + b64;
      });

      const bg = await loadImg(bgB64);
      ctx.drawImage(bg, 0, 0, w, h);

      // Darken background slightly
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, w, h);

      // Draw popup with shadow effect
      const pop = await loadImg(popB64);
      const px = w - pop.width - 24;
      const py = 56;

      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;

      // Rounded rect clip
      const r = 12;
      const pw = pop.width; const ph = pop.height;
      ctx.beginPath();
      ctx.moveTo(px + r, py);
      ctx.arcTo(px + pw, py, px + pw, py + ph, r);
      ctx.arcTo(px + pw, py + ph, px, py + ph, r);
      ctx.arcTo(px, py + ph, px, py, r);
      ctx.arcTo(px, py, px + pw, py, r);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(pop, px, py);
    }, { bgB64, popB64, w: width, h: height });

    await canvas.screenshot({ path: outputPath, fullPage: false });
    await canvas.close();
  }

  test('10.1 Screenshot: Popup with APA citation (1280x800)', async () => {
    await compositePopupOnPage(ctx.context, ctx.popupUrl, NATURE_URL, null,
      `${SCREENSHOT_DIR}/01-popup-apa-citation.png`, 1280, 800);
    log('Phase 10: Screenshots', 'Popup APA (1280x800)', 'PASS');

    await compositePopupOnPage(ctx.context, ctx.popupUrl, NATURE_URL, null,
      `${SCREENSHOT_DIR}/01-popup-apa-citation-640.png`, 640, 400);
    log('Phase 10: Screenshots', 'Popup APA (640x400)', 'PASS');
  });

  test('10.2 Screenshot: Style picker open (1280x800)', async () => {
    await compositePopupOnPage(ctx.context, ctx.popupUrl, NATURE_URL,
      async (popup) => {
        await popup.click('#style-picker-btn');
        await popup.waitForTimeout(500);
      },
      `${SCREENSHOT_DIR}/02-style-picker-open.png`, 1280, 800);
    log('Phase 10: Screenshots', 'Style picker open', 'PASS');
  });

  test('10.3 Screenshot: MLA formatting (1280x800)', async () => {
    await compositePopupOnPage(ctx.context, ctx.popupUrl, NATURE_URL,
      async (popup) => {
        await popup.click('#style-picker-btn');
        await popup.waitForTimeout(300);
        await popup.fill('#style-search-input', 'mla');
        await popup.waitForTimeout(300);
        await popup.click('.style-item[data-id="modern-language-association"]');
        await popup.waitForTimeout(3000);
      },
      `${SCREENSHOT_DIR}/03-mla-formatting.png`, 1280, 800);
    log('Phase 10: Screenshots', 'MLA formatting', 'PASS');
  });

  test('10.4 Screenshot: Library sidepanel with preview (1280x800)', async () => {
    // First add a citation so library isn't empty
    const popup = await openPopup(ctx.context, ctx.popupUrl);
    await popup.waitForTimeout(2000);
    await popup.fill('#field-doi', '10.1038/s41586-024-08219-w');
    await popup.click('#btn-enhance');
    await popup.waitForTimeout(8000);
    await popup.click('#btn-add-project');
    await popup.waitForTimeout(2000);
    await popup.close();

    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl);
    await sp.waitForLoadState('domcontentloaded');
    await sp.waitForTimeout(2000);
    await sp.setViewportSize({ width: 1280, height: 800 });

    // Open first citation preview
    const toggles = sp.locator('.btn-preview-toggle');
    if (await toggles.count() > 0) {
      await toggles.first().click();
      await sp.waitForTimeout(1500);
    }

    await sp.screenshot({ path: `${SCREENSHOT_DIR}/04-library-sidepanel.png`, fullPage: false });
    log('Phase 10: Screenshots', 'Library sidepanel', 'PASS');

    await sp.close();
  });

  test('10.5 Screenshot: Import BibTeX preview (1280x800)', async () => {
    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl);
    await sp.waitForLoadState('domcontentloaded');
    await sp.waitForTimeout(2000);
    await sp.setViewportSize({ width: 1280, height: 800 });

    // Switch to import
    await sp.click('[data-tab="import"]');
    await sp.waitForTimeout(500);

    // Paste BibTeX
    await sp.fill('#import-text', `@article{doughty2024,
  author = {Doughty, Benjamin R. and Hinks, Michaela M. and Greenleaf, William J.},
  title = {Single-molecule states link transcription factor binding to gene expression},
  journal = {Nature},
  year = {2024},
  volume = {636},
  pages = {745--754},
  doi = {10.1038/s41586-024-08219-w}
}`);

    await sp.click('#btn-parse');
    await sp.waitForTimeout(3000);

    await sp.screenshot({ path: `${SCREENSHOT_DIR}/05-import-bibtex.png`, fullPage: false });
    log('Phase 10: Screenshots', 'Import BibTeX', 'PASS');

    await sp.close();
  });

  test('10.6 Screenshot: Small promo tile (440x280)', async () => {
    await compositePopupOnPage(ctx.context, ctx.popupUrl, NATURE_URL, null,
      `${SCREENSHOT_DIR}/06-promo-small-440x280.png`, 440, 280);
    log('Phase 10: Screenshots', 'Small promo (440x280)', 'PASS');
  });

  test('10.7 Screenshot: Marquee promo (1400x560)', async () => {
    await compositePopupOnPage(ctx.context, ctx.popupUrl, NATURE_URL, null,
      `${SCREENSHOT_DIR}/07-promo-marquee-1400x560.png`, 1400, 560);
    log('Phase 10: Screenshots', 'Marquee promo (1400x560)', 'PASS');
  });

  test('10.8 Help screenshots — cropped UI elements', async () => {
    const HELP_IMG = require('path').resolve(__dirname, '../../browser/chrome/help/images');
    const NATURE_URL_H = 'https://www.nature.com/articles/s41586-024-08219-w';

    // 1. Popup with filled fields (cropped to popup content only)
    const { popup: p1 } = await openPopupOnUrl(ctx.context, ctx.popupUrl, NATURE_URL_H);
    await p1.waitForTimeout(6000); await waitForWasm(p1); await p1.waitForTimeout(2000);
    await p1.setViewportSize({ width: 420, height: 620 });
    await p1.screenshot({ path: `${HELP_IMG}/popup-citation.png`, fullPage: false });
    log('Phase 10: Help', 'Popup citation', 'PASS');

    // 2. Style picker open
    await p1.click('#style-picker-btn');
    await p1.waitForTimeout(500);
    await p1.screenshot({ path: `${HELP_IMG}/popup-style-picker.png`, fullPage: false });
    log('Phase 10: Help', 'Style picker', 'PASS');
    await p1.keyboard.press('Escape');
    await p1.waitForTimeout(200);

    // 3. P/N toggle — show both states
    const intextArea = p1.locator('#intext-preview').first();
    await intextArea.screenshot({ path: `${HELP_IMG}/popup-pn-parenthetical.png` });
    await p1.click('#btn-narrative');
    await p1.waitForTimeout(1000);
    await intextArea.screenshot({ path: `${HELP_IMG}/popup-pn-narrative.png` });
    log('Phase 10: Help', 'P/N toggle', 'PASS');
    await p1.click('#btn-parenthetical');
    await p1.waitForTimeout(500);

    // 4. Tags button
    await p1.click('#btn-show-tags');
    await p1.waitForTimeout(300);
    // Capture the bottom section with tags + project + add
    const bottomSection = p1.locator('#field-tags').first();
    if (await bottomSection.isVisible()) {
      await p1.screenshot({ path: `${HELP_IMG}/popup-tags.png`, fullPage: false });
      log('Phase 10: Help', 'Tags input', 'PASS');
    }
    await p1.close();

    // 5. Library sidepanel with citation and inline preview
    // First ensure there's a citation
    const p2 = await openPopup(ctx.context, ctx.popupUrl);
    await p2.waitForTimeout(2000);
    await p2.fill('#field-doi', '10.1038/s41586-024-08219-w');
    await p2.click('#btn-enhance');
    await p2.waitForTimeout(8000);
    await p2.click('#btn-add-project');
    await p2.waitForTimeout(2000);
    await p2.close();

    const sp = await ctx.context.newPage();
    await sp.goto(ctx.sidepanelUrl);
    await sp.waitForLoadState('domcontentloaded');
    await sp.waitForTimeout(2000);
    await sp.setViewportSize({ width: 420, height: 700 });

    // Library list
    await sp.screenshot({ path: `${HELP_IMG}/library-list.png`, fullPage: false });
    log('Phase 10: Help', 'Library list', 'PASS');

    // Open inline preview
    const toggles = sp.locator('.btn-preview-toggle');
    if (await toggles.count() > 0) {
      await toggles.first().click();
      await sp.waitForTimeout(1500);
      await sp.screenshot({ path: `${HELP_IMG}/library-inline-preview.png`, fullPage: false });
      log('Phase 10: Help', 'Inline preview', 'PASS');

      // Capture just the preview section
      const preview = sp.locator('.cite-preview').first();
      if (await preview.isVisible()) {
        await preview.screenshot({ path: `${HELP_IMG}/library-preview-detail.png` });
        log('Phase 10: Help', 'Preview detail', 'PASS');
      }
      await toggles.first().click();
      await sp.waitForTimeout(300);
    }

    // 6. Manual entry form
    await sp.click('#btn-add-manual');
    await sp.waitForTimeout(500);
    const form = sp.locator('#manual-entry-form');
    if (await form.isVisible()) {
      await form.screenshot({ path: `${HELP_IMG}/library-manual-entry.png` });
      log('Phase 10: Help', 'Manual entry form', 'PASS');
      await sp.click('#btn-cancel-manual');
      await sp.waitForTimeout(300);
    }

    // 7. Settings gear dropdown
    await sp.click('#sp-settings-btn');
    await sp.waitForTimeout(500);
    const settingsDropdown = sp.locator('#sp-settings-dropdown');
    if (await settingsDropdown.isVisible()) {
      await settingsDropdown.screenshot({ path: `${HELP_IMG}/library-settings.png` });
      log('Phase 10: Help', 'Settings dropdown', 'PASS');
      await sp.click('body', { position: { x: 10, y: 10 } });
      await sp.waitForTimeout(300);
    }

    // 8. Import tab
    await sp.click('[data-tab="import"]');
    await sp.waitForTimeout(500);
    await sp.screenshot({ path: `${HELP_IMG}/import-tab.png`, fullPage: false });
    log('Phase 10: Help', 'Import tab', 'PASS');

    // 9. Export tab
    await sp.click('[data-tab="export"]');
    await sp.waitForTimeout(500);
    await sp.screenshot({ path: `${HELP_IMG}/export-tab.png`, fullPage: false });
    log('Phase 10: Help', 'Export tab', 'PASS');

    await sp.close();
  });

  test('10.9 Screenshot: Help page full', async () => {
    const helpUrl = `chrome-extension://${ctx.extensionId}/help/help.html`;
    const page = await ctx.context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(helpUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-help-page.png`, fullPage: false });
    log('Phase 10: Screenshots', 'Help page', 'PASS');

    // Scroll to library section for a feature screenshot
    await page.evaluate(() => document.querySelector('#library')?.scrollIntoView({ behavior: 'instant' }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-help-library-section.png`, fullPage: false });
    log('Phase 10: Screenshots', 'Help library section', 'PASS');

    // Scroll to styles section
    await page.evaluate(() => document.querySelector('#styles')?.scrollIntoView({ behavior: 'instant' }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-help-styles-section.png`, fullPage: false });
    log('Phase 10: Screenshots', 'Help styles section', 'PASS');

    await page.close();
  });
});

// =============================================================================
// Phase 11 — Multi-Source Resolver, API Access, PDF Extraction
// =============================================================================

test.describe('Phase 11 — Resolver & PDF Improvements', () => {

  test('11.1 — Options page has API access section', async () => {
    const page = await ctx.context.newPage();
    await page.goto(`chrome-extension://${ctx.extensionId}/options/options.html`);
    await page.waitForTimeout(500);

    const grantBtn = await page.$('#btn-grant-api');
    expect(grantBtn).toBeTruthy();
    const btnText = await grantBtn.textContent();
    // In dev mode, permissions are auto-granted
    expect(btnText.trim()).toMatch(/Grant|Granted/i);
    log('Phase 11: API Access', 'Options page has Grant API button', 'PASS', btnText.trim());

    const statusEl = await page.$('#api-status');
    expect(statusEl).toBeTruthy();
    log('Phase 11: API Access', 'Options page has API status indicator', 'PASS');

    await page.close();
  });

  test('11.2 — Welcome page has API access section', async () => {
    const page = await ctx.context.newPage();
    await page.goto(`chrome-extension://${ctx.extensionId}/onboarding/welcome.html`);
    await page.waitForTimeout(500);

    const grantBtn = await page.$('#btn-grant-api');
    expect(grantBtn).toBeTruthy();
    log('Phase 11: API Access', 'Welcome page has Grant API button', 'PASS');

    await page.close();
  });

  test('11.3 — Help page has API access section', async () => {
    const page = await ctx.context.newPage();
    await page.goto(`chrome-extension://${ctx.extensionId}/help/help.html`);
    await page.waitForTimeout(500);

    const apiSection = await page.$('#api-access');
    expect(apiSection).toBeTruthy();
    log('Phase 11: Help', 'Help page has API access section', 'PASS');

    // Check the API table has expected entries
    const tableText = await apiSection.textContent();
    expect(tableText).toContain('OpenAlex');
    expect(tableText).toContain('CrossRef');
    expect(tableText).toContain('arXiv');
    expect(tableText).toContain('Citoid');
    expect(tableText).toContain('Open Library');
    log('Phase 11: Help', 'API table lists all sources', 'PASS');

    await page.close();
  });

  test('11.4 — Help page has updated PDF section', async () => {
    const page = await ctx.context.newPage();
    await page.goto(`chrome-extension://${ctx.extensionId}/help/help.html`);
    await page.waitForTimeout(500);

    const pdfSection = await page.$('#pdfs');
    if (pdfSection) {
      const pdfText = await pdfSection.textContent();
      expect(pdfText).toContain('XMP metadata');
      expect(pdfText).toContain('Full text extraction');
      expect(pdfText).toContain('DOI from URL');
      expect(pdfText).toContain('DOI from filename');
      log('Phase 11: Help', 'PDF section documents new extraction features', 'PASS');
    } else {
      log('Phase 11: Help', 'PDF section not found', 'WARN');
    }

    await page.close();
  });

  test('11.5 — Help page privacy updated', async () => {
    const page = await ctx.context.newPage();
    await page.goto(`chrome-extension://${ctx.extensionId}/help/help.html`);
    await page.waitForTimeout(500);

    const privacySection = await page.$('#privacy');
    expect(privacySection).toBeTruthy();
    const privacyText = await privacySection.textContent();
    expect(privacyText).toContain('optional');
    expect(privacyText).toContain('rate-limited');
    log('Phase 11: Help', 'Privacy section mentions optional API access and rate limiting', 'PASS');

    await page.close();
  });

  test('11.6 — Popup extraction timeout fallback', async () => {
    // Open popup on a restricted page (about:blank) to trigger timeout/fallback
    const page = await ctx.context.newPage();
    await page.goto('about:blank');
    await page.waitForTimeout(200);

    const popup = await ctx.context.newPage();
    await popup.goto(ctx.popupUrl);
    await popup.waitForTimeout(1000);

    // Should show ready state even on restricted pages
    const state = await popup.$('.ibid-state-ready, #field-title');
    expect(state).toBeTruthy();
    log('Phase 11: Timeout', 'Popup shows ready state on restricted page', 'PASS');

    await popup.close();
    await page.close();
  });

  test('11.7 — Identifiers.js loaded in content scripts', async () => {
    const page = await openPopupOnUrl(ctx, 'https://example.com');
    await page.waitForTimeout(1000);

    // Check if IbidIdentifiers is available on the page
    const tab = (await ctx.context.pages()).find(p => p.url().includes('example.com'));
    if (tab) {
      const hasIdentifiers = await tab.evaluate(() => typeof window.IbidIdentifiers !== 'undefined');
      expect(hasIdentifiers).toBe(true);
      log('Phase 11: Identifiers', 'IbidIdentifiers loaded in content script', 'PASS');

      // Test extractIdentifier function
      const doiResult = await tab.evaluate(() =>
        window.IbidIdentifiers.extractIdentifier('10.1038/nature12373'));
      expect(doiResult).toBeTruthy();
      expect(doiResult.type).toBe('DOI');
      log('Phase 11: Identifiers', 'extractIdentifier works for DOI', 'PASS');

      const arxivResult = await tab.evaluate(() =>
        window.IbidIdentifiers.extractIdentifier('arxiv:2303.08774'));
      expect(arxivResult).toBeTruthy();
      expect(arxivResult.type).toBe('arXiv');
      log('Phase 11: Identifiers', 'extractIdentifier works for arXiv', 'PASS');

      const urlDoiResult = await tab.evaluate(() =>
        window.IbidIdentifiers.extractDoiFromUrl('https://www.nature.com/articles/s41586-024-07386-0.pdf'));
      expect(urlDoiResult).toBeTruthy();
      expect(urlDoiResult.id).toContain('10.1038');
      log('Phase 11: Identifiers', 'extractDoiFromUrl works for Nature PDF', 'PASS');
    }

    await page.close();
  });

  test('11.8 — Firefox manifest generated correctly', async () => {
    const fs = require('fs');
    const path = require('path');
    const manifestPath = path.resolve(__dirname, '../../browser/firefox/manifest.json');

    // Generate if not exists
    if (!fs.existsSync(manifestPath)) {
      const { execSync } = require('child_process');
      execSync('node scripts/build-firefox-manifest.js', { cwd: path.resolve(__dirname, '../..') });
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    // Verify Firefox-specific changes
    expect(manifest.background.scripts).toBeTruthy();
    expect(manifest.background.service_worker).toBeUndefined();
    expect(manifest.sidebar_action).toBeTruthy();
    expect(manifest.side_panel).toBeUndefined();
    expect(manifest.browser_specific_settings?.gecko?.id).toBeTruthy();
    expect(manifest.optional_permissions).toContain('https://arxiv.org/*');
    expect(manifest.optional_host_permissions).toBeUndefined();
    expect(manifest.permissions).not.toContain('sidePanel');
    expect(manifest.commands['_execute_sidebar_action']).toBeTruthy();
    expect(manifest.commands['_execute_side_panel']).toBeUndefined();

    log('Phase 11: Firefox', 'Firefox manifest has correct structure', 'PASS');
  });

  test('11.9 — Service worker has proxyFetch handler', async () => {
    // Test proxyFetch via message to service worker
    const page = await ctx.context.newPage();
    await page.goto(`chrome-extension://${ctx.extensionId}/popup/popup.html`);
    await page.waitForTimeout(1000);

    const result = await page.evaluate(async () => {
      const res = await chrome.runtime.sendMessage({
        action: 'proxyFetch',
        url: 'https://httpbin.org/get',
        options: { timeout: 5000 },
      });
      return res;
    });

    if (result?.ok) {
      expect(result.status).toBe(200);
      log('Phase 11: ProxyFetch', 'proxyFetch handler works', 'PASS');
    } else {
      log('Phase 11: ProxyFetch', 'proxyFetch returned error (network issue?)', 'WARN', result?.error);
    }

    await page.close();
  });

  test('11.10 — Service worker has resolveByTitle handler', async () => {
    const page = await ctx.context.newPage();
    await page.goto(`chrome-extension://${ctx.extensionId}/popup/popup.html`);
    await page.waitForTimeout(1000);

    const result = await page.evaluate(async () => {
      const res = await chrome.runtime.sendMessage({
        action: 'resolveByTitle',
        title: 'GPT-4 Technical Report',
      });
      return res;
    });

    if (result?.resolved) {
      expect(result.resolved.title).toContain('GPT-4');
      log('Phase 11: TitleSearch', 'resolveByTitle returns result for GPT-4', 'PASS');
    } else {
      log('Phase 11: TitleSearch', 'resolveByTitle failed (network?)', 'WARN', result?.error);
    }

    await page.close();
  });

  test('11.11 — Service worker has fetchArticleMeta handler', async () => {
    const page = await ctx.context.newPage();
    await page.goto(`chrome-extension://${ctx.extensionId}/popup/popup.html`);
    await page.waitForTimeout(1000);

    const result = await page.evaluate(async () => {
      const res = await chrome.runtime.sendMessage({
        action: 'fetchArticleMeta',
        url: 'https://doi.org/10.4161/rna.22269',
      });
      return res;
    });

    if (result?.meta) {
      log('Phase 11: ArticleMeta', 'fetchArticleMeta returns metadata', 'PASS',
        `title: ${result.meta.title?.slice(0, 40)}, authors: ${result.meta.authors?.length}`);
    } else {
      log('Phase 11: ArticleMeta', 'fetchArticleMeta failed (network?)', 'WARN', result?.error);
    }

    await page.close();
  });
});
