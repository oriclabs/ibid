# Ibid — Manual Testing Guide

Comprehensive manual test scenarios with real URLs and expected results.
Run through these before each release.

---

## Table of Contents

1. [Setup & First Run](#1-setup--first-run)
2. [Basic Citation — Journal Article](#2-basic-citation--journal-article)
3. [DOI Enhance](#3-doi-enhance)
4. [ISBN Enhance (Book)](#4-isbn-enhance-book)
5. [PMID Enhance (PubMed)](#5-pmid-enhance-pubmed)
6. [arXiv Enhance](#6-arxiv-enhance)
7. [News Article](#7-news-article)
8. [Wikipedia / Webpage](#8-wikipedia--webpage)
9. [Google Scholar](#9-google-scholar)
10. [PDF Page](#10-pdf-page)
11. [Restricted Pages](#11-restricted-pages)
12. [Style Switching](#12-style-switching)
13. [P/N In-text Toggle](#13-pn-in-text-toggle)
14. [Source Type Validation](#14-source-type-validation)
15. [Field Relevance Highlighting](#15-field-relevance-highlighting)
16. [Session Cache (Popup Reopen)](#16-session-cache-popup-reopen)
17. [Rescan Page](#17-rescan-page)
18. [Add to Project](#18-add-to-project)
19. [Per-Project Styles](#19-per-project-styles)
20. [Duplicate Detection](#20-duplicate-detection)
21. [Import — BibTeX](#21-import--bibtex)
22. [Import — RIS](#22-import--ris)
23. [Import — CSL-JSON](#23-import--csl-json)
24. [Import — File Drop](#24-import--file-drop)
25. [Export — All Formats](#25-export--all-formats)
26. [Library — Sort & Filter](#26-library--sort--filter)
27. [Library — Tags](#27-library--tags)
28. [Library — Star & Bulk Ops](#28-library--star--bulk-ops)
29. [Library — Edit Citation](#29-library--edit-citation)
30. [Library — Duplicate Scan](#30-library--duplicate-scan)
31. [Library — Search](#31-library--search)
32. [Migration Wizard](#32-migration-wizard)
33. [Context Menu — Save Quote](#33-context-menu--save-quote)
34. [Omnibox](#34-omnibox)
35. [Custom Style Editor](#35-custom-style-editor)
36. [Quick Settings](#36-quick-settings)
37. [Options Page](#37-options-page)
38. [Backup & Restore](#38-backup--restore)
39. [Dark Mode](#39-dark-mode)
40. [Keyboard Shortcuts](#40-keyboard-shortcuts)
41. [Error Handling](#41-error-handling)
42. [Badge Count](#42-badge-count)
43. [Help Page](#43-help-page)
44. [Custom Dialogs](#44-custom-dialogs)
45. [Smart Date Input](#45-smart-date-input)
46. [Non-Academic Site Filtering](#46-non-academic-site-filtering)
47. [WASM / Hayagriva CSL Renderer](#47-wasm--hayagriva-csl-renderer)
48. [DOI Cleaning](#48-doi-cleaning)
49. [Library Inline Preview](#49-library-inline-preview)
50. [Library Tab Switching](#50-library-tab-switching)
51. [Dropdown Mutual Exclusion](#51-dropdown-mutual-exclusion)
52. [N.D. Toggle Button](#52-nd-toggle-button)
53. [Engine Status in Settings](#53-engine-status-in-settings)
54. [On-Demand Style Download](#54-on-demand-style-download)
55. [DOI Enhance Field Position](#55-doi-enhance-field-position)
56. [Shared Citation Formatter](#56-shared-citation-formatter)
57. [Local PDF / File URL Handling](#57-local-pdf--file-url-handling)
58. [Library Settings (Sidepanel)](#58-library-settings-sidepanel)
59. [Library Manual Entry](#59-library-manual-entry)
60. [Library Visit Source Link](#60-library-visit-source-link)
61. [In-Library Status Bar](#61-in-library-status-bar)
62. [Import / Export Project Filters](#62-import--export-project-filters)

---

## 1. Setup & First Run

**Steps:**
1. Load extension from `browser/dist/chrome/` in `chrome://extensions/` (Developer Mode)
2. Extension icon should appear in toolbar with book/citation icon

**Expected:**
- [ ] Welcome/onboarding page opens in new tab
- [ ] Onboarding shows 3 steps + pro tips
- [ ] "Start Citing" button closes the tab
- [ ] Extension icon visible in toolbar
- [ ] No console errors in service worker

---

## 2. Basic Citation — Journal Article

**URL:** `https://www.nature.com/articles/nature12373`

**Steps:**
1. Navigate to the URL
2. Click Ibid icon

**Expected:**
- [ ] Source type auto-detected as "Journal Article" with green "auto-detected" badge
- [ ] Title extracted: "Nanometre-scale thermometry in a living cell"
- [ ] Authors extracted (Kucsko et al.)
- [ ] DOI extracted: `10.1038/nature12373`
- [ ] Container: "Nature"
- [ ] Citation preview shows formatted APA output
- [ ] In-text shows `(Kucsko et al., 2013)`
- [ ] No "undefined" or "null" in any output
- [ ] Copy Bib button copies to clipboard
- [ ] Copy in-text button copies to clipboard

---

## 3. DOI Enhance

**Steps:**
1. Open popup on any page (or restricted page)
2. Paste `10.1038/nature12373` in DOI field
3. Click "Enhance"

**Expected:**
- [ ] Spinner appears on Enhance button
- [ ] Fields fill: title, authors, journal, volume, pages, year
- [ ] Enhanced fields flash saffron briefly
- [ ] Green banner: "Enhanced 6 fields via crossref"
- [ ] Source type changes to "Journal Article"
- [ ] Citation preview updates
- [ ] DOI field cleaned (no query strings)

**Also test with:**
- `10.1371/journal.pone.0185809` (PLOS ONE, 12 authors)
- `10.1126/science.1058040` (Science)
- `https://doi.org/10.1016/j.cell.2024.01.005` (DOI URL format)

---

## 4. ISBN Enhance (Book)

**Steps:**
1. Paste `978-0-13-468599-1` in DOI field
2. Click Enhance

**Expected:**
- [ ] Book title fills
- [ ] Author fills
- [ ] Publisher fills
- [ ] Source type changes to "Book"
- [ ] Green banner: "Enhanced via openlibrary"

**Also test:** `978-0-201-89683-1` (Knuth)

---

## 5. PMID Enhance (PubMed)

**URL to test extraction:** `https://pubmed.ncbi.nlm.nih.gov/33782455/`

**Steps for manual enhance:**
1. Paste `PMID:33782455` in DOI field
2. Click Enhance

**Expected:**
- [ ] Title, authors, journal, year fill from NCBI
- [ ] Green banner: "Enhanced via ncbi"

---

## 6. arXiv Enhance

**URL:** `https://arxiv.org/abs/2301.07041`

**Steps:**
1. Navigate to arXiv page, click Ibid icon
2. OR paste `arxiv:2301.07041` and click Enhance

**Expected:**
- [ ] Title, authors extracted
- [ ] Source type: "Article"
- [ ] URL set to arXiv page

---

## 7. News Article

**URLs:**
- `https://www.nytimes.com/` (any article)
- `https://www.bbc.com/news/` (any article)
- `https://www.reuters.com/technology/` (any page)

**Expected:**
- [ ] Source type auto-detected as "News Article"
- [ ] Title extracted
- [ ] Container (publication name) extracted
- [ ] No warning about "might be journal article"

---

## 8. Wikipedia / Webpage

**URL:** `https://en.wikipedia.org/wiki/Citation`

**Expected:**
- [ ] Source type: "Webpage"
- [ ] Title: "Citation - Wikipedia"
- [ ] No DOI extraction (not an academic site)
- [ ] No false "might be journal" warning
- [ ] Citation: `Citation - Wikipedia. (n.d.). https://en.wikipedia.org/...`

---

## 9. Google Scholar

**URL:** `https://scholar.google.com/` (search for any paper, click a result)

**Expected:**
- [ ] Source type auto-detected as "Journal Article"
- [ ] Title extracted from page
- [ ] Authors extracted from citation info line

---

## 10. PDF Page

**URL:** `https://journals.asm.org/doi/epdf/10.1128/mr.59.3.423-450.1995`

**Expected:**
- [ ] PDF extractor injects
- [ ] DOI extracted from URL (cleaned, no `?download=true`)
- [ ] Hint shows "looking up via DOI" or manual enhance available
- [ ] After enhance: title, authors, journal, volume, pages fill

---

## 11. Restricted Pages

**URLs:**
- `chrome://extensions/`
- `chrome://settings/`
- `chrome-extension://` (any extension page)

**Expected:**
- [ ] Popup opens with empty form
- [ ] Blue hint: "This page can't be auto-cited..."
- [ ] All buttons work (settings, help, library)
- [ ] Can manually enter data and copy citation
- [ ] Can paste DOI and enhance

---

## 12. Style Switching

**Steps:**
1. Open popup on any page with extracted metadata
2. Click style picker → search "vancouver"
3. Select Vancouver
4. Switch to IEEE
5. Switch to MLA 9th Edition

**Expected per style (popup preview):**

| Style | Author Format | Year | Title | Journal |
|-------|--------------|------|-------|---------|
| APA 7 | Last, I. | (2024) | plain | *italic* |
| MLA 9 | Last, First | at end | "quoted" | *italic* |
| Chicago | Last, I. | after author | "quoted" | *italic* |
| Harvard | Last, I. | (2024) | 'single quotes' | *italic* |
| IEEE | I. Last | at end | "quoted" | *italic* |
| Vancouver | I. Last | after journal | plain | plain |

- [ ] Style picker shows recent styles at top
- [ ] Search filters by name, ID, field, group
- [ ] Searchable grouped dropdown with field tags (psychology, engineering, etc.)
- [ ] Style source badge shows "Global" or "Project"
- [ ] Standard styles (6 families): JS renders instantly, WASM upgrades
- [ ] Non-standard styles (downloaded): shows "Formatting with..." placeholder, then WASM result
- [ ] WASM (hayagriva) produces correct et al., title case, volume/issue labels
- [ ] 74 bundled styles use official CSL files (not simplified versions)

**Multi-author test (Nature article — 12 authors):**
- URL: `https://www.nature.com/articles/s41586-024-08219-w`
- [ ] APA bib: `Doughty, B. R., Hinks, M. M., ... & Greenleaf, W. J. (2024)...`
- [ ] MLA bib: `Doughty, Benjamin R., et al. "Single-Molecule States..."`
- [ ] APA in-text P: `(Doughty et al., 2024)`
- [ ] MLA in-text P: `(Doughty et al.)`

---

## 13. P/N In-text Toggle

### Popup P/N

**Steps:**
1. Have a citation loaded (e.g., Smith, 2024)
2. Click "P" button — should be active (saffron)
3. Note in-text output
4. Click "N" button
5. Note in-text output changes

**Expected:**
- [ ] **P (Parenthetical):** `(Smith, 2024)` — WASM (hayagriva) renders, JS fallback
- [ ] **N (Narrative):** `Smith (2024)` — JS always (WASM doesn't support narrative)
- [ ] Active button highlighted saffron
- [ ] WASM P result not overwritten when N is selected and back to P
- [ ] IEEE/Vancouver always show `[1]` regardless of P/N
- [ ] 3+ authors: P shows `(Author et al., 2024)`, N shows `Author et al. (2024)`

### Library Inline Preview P/N

**Steps:**
1. Open sidepanel → Library → click a citation to open preview
2. Note P/N toggle buttons between "In-text" label and citation text
3. Click P → parenthetical format
4. Click N → narrative format

**Expected:**
- [ ] P/N toggle visible in each inline preview
- [ ] P: `(Doughty et al., 2024)` for APA with 3+ authors
- [ ] N: `Doughty et al. (2024)` for APA with 3+ authors
- [ ] Toggle state preserved per-citation (each preview independent)
- [ ] Copy In-text button copies the currently selected P/N format
- [ ] Style change resets to P but respects current toggle state

---

## 14. Source Type Validation

**Test 1 — Journal without metadata:**
1. Select "Journal Article" manually on a plain webpage
2. Expected: amber warning "Journal articles usually have a journal name..."
3. Click "Switch to Webpage?" link → type switches

**Test 2 — Webpage with DOI + journal:**
1. Navigate to `https://www.nature.com/articles/nature12373`
2. If detected as webpage → should suggest "Switch to Journal Article?"

**Test 3 — Non-academic sites should NOT suggest journal:**
- `https://drive.google.com/` → no journal suggestion
- `https://www.youtube.com/` → no journal suggestion
- `https://github.com/` → no journal suggestion

---

## 15. Field Relevance Highlighting

**Steps:**
1. Select "Journal Article" → check field labels
2. Select "Book" → check field labels change
3. Select "Webpage" → check field labels change

**Expected:**
| Type | Required (*) | Dimmed (50%) |
|------|-------------|-------------|
| Journal | Title, Author, Date, Container | Publisher |
| Book | Title, Author, Publisher, Date | Container, Vol, Issue, Pages |
| Webpage | Title, DOI/URL | Author, Date recommended; rest dimmed |

---

## 16. Session Cache (Popup Reopen)

**Steps:**
1. Navigate to any journal article
2. Click Ibid icon → popup opens, fields fill
3. Click Enhance → fields update with CrossRef data
4. Click somewhere on the page → popup closes
5. Click Ibid icon again (same page)

**Expected:**
- [ ] Fields show enhanced data (NOT re-extracted from scratch)
- [ ] Blue hint: "Restored from previous session on this page"
- [ ] No "volume missing" warning (volume was filled by enhance)
- [ ] Citation preview correct

**Then:**
6. Navigate to a DIFFERENT page
7. Click Ibid icon

**Expected:**
- [ ] Fresh extraction (different URL, cache doesn't apply)
- [ ] No "restored" hint

---

## 17. Rescan Page

**Steps:**
1. Open popup → fields fill
2. Edit the title manually
3. Click "Rescan Page" button

**Expected:**
- [ ] All fields reset to page-extracted values
- [ ] Manual edits overwritten
- [ ] Cache cleared
- [ ] Green banner: "Page rescanned — fields refreshed"
- [ ] Auto-enhance re-triggers if DOI found

---

## 18. Add to Project

**Test 1 — Normal add:**
1. Fill fields, click "Add"
2. Expected: button flashes "Added!", citation saved

**Test 2 — Missing fields:**
1. Clear title and authors
2. Click Add
3. Expected: custom dialog "Incomplete citation — Missing: title, author. Add anyway?"

**Test 3 — Duplicate:**
1. Add same citation twice
2. Expected: custom dialog "Possible duplicate — [title] already exists. Add anyway?"

**Test 4 — Empty form:**
1. Clear all fields including DOI
2. Click Add
3. Expected: red banner "Please enter at least a title or URL/DOI"

---

## 19. Per-Project Styles

**Steps:**
1. Click "+" next to project selector
2. Enter "Psych 401", select "APA 7th"
3. Click Create
4. Create another: "Law Review", select "Harvard"
5. Switch between projects

**Expected:**
- [ ] Project appears in dropdown with style: "Psych 401 (APA 7)"
- [ ] Selecting "Psych 401" → style auto-switches to APA 7, badge shows "Project"
- [ ] Selecting "Law Review" → style switches to Harvard, badge shows "Project"
- [ ] Selecting "My Bibliography" → falls back to global default, badge shows "Global"

---

## 20. Duplicate Detection

**Steps:**
1. Add a citation with DOI `10.1038/nature12373`
2. Try adding another citation with same DOI

**Expected:**
- [ ] Custom dialog: "Possible duplicate — [title] already exists"
- [ ] "Add Anyway" and "Cancel" buttons (not native browser confirm)

---

## 21. Import — BibTeX

**Steps:**
1. Open Library side panel → Import tab
2. Paste this in the textarea:

```bibtex
@article{smith2024,
  author = {Smith, John A. and Doe, Jane},
  title = {A Study of Things},
  journal = {Nature},
  year = {2024},
  volume = {42},
  number = {3},
  pages = {100--120},
  doi = {10.1038/nature12345}
}

@book{knuth1997,
  author = {Donald E. Knuth},
  title = {The {TeXbook}},
  publisher = {Addison-Wesley},
  year = {1984}
}
```

3. Click "Parse & Preview"

**Expected:**
- [ ] Status: "Parsed 2 entries"
- [ ] Preview shows both entries with checkboxes
- [ ] First entry: title "A Study of Things", 2 authors, 2024
- [ ] Second entry: title "The TeXbook", 1 author, 1984
- [ ] Click "Import Selected" → "Imported 2 entries"
- [ ] Library tab shows both citations

---

## 22. Import — RIS

**Paste:**
```
TY  - JOUR
AU  - Smith, John A.
AU  - Doe, Jane
TI  - A Study of Things
JO  - Nature
PY  - 2024
VL  - 42
IS  - 3
SP  - 100
EP  - 120
DO  - 10.1038/nature12345
ER  -
```

**Expected:**
- [ ] Auto-detected as RIS
- [ ] 1 entry parsed
- [ ] Authors: 2, pages: 100–120 (en-dash)

---

## 23. Import — CSL-JSON

**Paste:**
```json
[{"id":"test","type":"article-journal","title":"JSON Import Test","author":[{"family":"Chen","given":"Wei"}],"issued":{"date-parts":[[2024]]},"container-title":"Science"}]
```

**Expected:**
- [ ] Auto-detected as CSL-JSON
- [ ] 1 entry parsed

---

## 24. Import — File Drop

**Steps:**
1. Create a file `test.bib` with BibTeX content
2. Drag & drop onto the import drop zone

**Expected:**
- [ ] Drop zone highlights saffron on drag over
- [ ] File parsed, preview shown
- [ ] Format auto-detected from extension (.bib → BibTeX)

**Also test:** `.ris`, `.json`, `.xml` (EndNote), `.nbib` (MEDLINE), `.csv`, `.tsv`

---

## 25. Export — All Formats

**Prerequisites:** Have 3+ citations in library

**Steps:** For each format in the Export tab:

| Format | Expected filename | Verify content |
|--------|------------------|---------------|
| BibTeX | bibliography.bib | Starts with `@article{` |
| RIS | bibliography.ris | Starts with `TY  - ` |
| CSL-JSON | bibliography.json | Valid JSON array |
| CSV | bibliography.csv | Has header row, comma-separated |
| TSV | bibliography.tsv | Tab-separated |
| YAML | bibliography.yaml | Starts with `references:` |
| Word XML | bibliography.xml | Contains `<b:Sources` |

- [ ] Download button saves file
- [ ] Copy button copies to clipboard
- [ ] "Starred only" scope filters correctly
- [ ] BibTeX options (abstract, keywords) toggle
- [ ] Export count shows correct number

---

## 26. Library — Sort & Filter

**Prerequisites:** 5+ citations of mixed types

**Test sort options:**
- [ ] Newest First (default) — most recent `_dateAdded` first
- [ ] Oldest First — reverse
- [ ] Author A-Z — alphabetical by first author family name
- [ ] Title A-Z — alphabetical
- [ ] Year (Newest) — by publication year desc
- [ ] Year (Oldest) — by publication year asc
- [ ] By Type — grouped by source type

**Test filter chips:**
- [ ] Click "Starred" → only starred shown
- [ ] Click "Journal" → only journal articles
- [ ] Click both → starred AND journal (AND logic)
- [ ] "Clear" button resets all filters
- [ ] Count updates: "3 of 10"

**Test project filter:**
- [ ] "All Projects" shows everything
- [ ] Selecting a project filters to that project's citations

---

## 27. Library — Tags

**Steps:**
1. Click "+ Manage" next to tag filter row
2. Create tag "urgent" with red color
3. Create tag "review" with blue color
4. Edit a citation → type "urgent, review" in tags field → Save
5. Close edit panel

**Expected:**
- [ ] Tag chips appear on the citation row (color-coded)
- [ ] Tag filter row shows "urgent" and "review" chips
- [ ] Clicking "urgent" chip filters to tagged citations
- [ ] Tags auto-created when typed in edit panel

---

## 28. Library — Star & Bulk Ops

**Steps:**
1. Click star icon on 3 citations
2. Select checkboxes on 2 citations
3. Bulk action bar appears

**Expected:**
- [ ] Star icon toggles (filled/outline)
- [ ] Bulk bar shows "2 selected"
- [ ] "Star" bulk action stars selected
- [ ] "Delete" shows custom confirm dialog (not native)
- [ ] "Cancel" deselects all

---

## 29. Library — Edit Citation

**Steps:**
1. Click a citation title in library
2. Edit panel slides up
3. Change the title
4. Click Save

**Expected:**
- [ ] All fields populated from citation data
- [ ] Tags field shows existing tags
- [ ] Notes textarea available
- [ ] Quotes section shows saved quotes (if any)
- [ ] Save persists changes
- [ ] Library row updates

---

## 30. Library — Duplicate Scan

**Prerequisites:** Add 2 citations with same DOI or very similar titles

**Steps:**
1. Click "Dupes" button in library toolbar
2. Modal opens

**Expected:**
- [ ] Groups shown with reason (Same DOI / Same title)
- [ ] "Keep Best & Merge" removes duplicates
- [ ] Individual "Remove" buttons work
- [ ] If no duplicates: green checkmark "No duplicates found"

---

## 31. Library — Search

**Steps:**
1. Type in search bar: "climate"
2. Then: "smith"
3. Then: "10.1038"
4. Then: "journal"

**Expected:**
- [ ] Filters by title, author, DOI, type, container, keywords
- [ ] Count updates in real time
- [ ] Clear search → shows all

---

## 32. Migration Wizard

**Steps:**
1. Import tab → click "Migrate from another tool"
2. Click "Zotero"

**Expected:**
- [ ] Step-by-step instructions appear
- [ ] Instructions mention File → Export Library
- [ ] Mentions BibTeX and CSL JSON formats
- [ ] Similar for Mendeley (BibTeX/RIS) and EndNote (XML/RIS)

---

## 33. Context Menu — Save Quote

**Steps:**
1. Navigate to any article page
2. Select some text on the page
3. Right-click → "Save quote with citation"

**Expected:**
- [ ] Quote saved to citation (check in Library → edit the citation)
- [ ] If citation for this URL exists, quote added to it
- [ ] If new URL, new citation created with the quote
- [ ] Quotes section in edit panel shows the saved text

---

## 34. Omnibox

**Steps:**
1. Click address bar, type `cite `(with space)
2. Type `10.1038/nature12373`

**Expected:**
- [ ] Default suggestion: "Type a DOI, ISBN, PMID, or search your library"
- [ ] DOI suggestion appears: "Look up DOI: 10.1038/..."
- [ ] Press Enter → navigates to `https://doi.org/10.1038/nature12373`

**Also test:**
- Type `cite smith` → shows library matches
- Type `cite isbn:978-0-13-468599-1` → shows ISBN suggestion

---

## 35. Custom Style Editor

**Steps:**
1. Options page → "Create custom style" link
2. Editor opens in new tab
3. Change journal template to: `{author} — {title}. {container} ({year})`
4. Check live preview updates

**Expected:**
- [ ] Preview shows formatted output with sample data
- [ ] Author format options work (Last, First vs First Last)
- [ ] Et al. threshold works
- [ ] Save button stores to chrome.storage
- [ ] Export JSON downloads a .json file

---

## 36. Quick Settings

**Steps:**
1. Click gear icon in popup header
2. Dropdown appears

**Expected:**
- [ ] Default Style dropdown (all 9 editions)
- [ ] Locale selector
- [ ] Theme toggle (Light/System/Dark)
- [ ] Help & Documentation link → opens help page
- [ ] Advanced Settings → opens options page
- [ ] Click outside → dropdown closes

---

## 37. Options Page

**Steps:**
1. Open via Quick Settings → "Advanced Settings"

**Expected:**
- [ ] Citation Defaults section (style, locale)
- [ ] Interface section (float button toggle, auto-add toggle)
- [ ] Cloud Sync section (6 providers, all "Coming soon")
- [ ] Data Management (Backup, Restore, Clear)
- [ ] About section with help link
- [ ] "Create custom style" link works

---

## 38. Backup & Restore

**Steps:**
1. Add several citations
2. Options → Backup Library → file downloads
3. Options → Clear All Data → custom confirm dialog
4. Confirm → all data cleared
5. Options → Restore → upload the backup file

**Expected:**
- [ ] Backup file is valid JSON
- [ ] Clear shows custom dialog (not native confirm)
- [ ] After clear: library empty, badge shows no count
- [ ] After restore: all citations back, custom alert "Library restored"

---

## 39. Dark Mode

**Steps:**
1. Quick Settings → Theme → Dark
2. Check popup, side panel, options page, help page

**Expected:**
- [ ] All pages switch to dark background
- [ ] Text readable on dark
- [ ] Saffron accents still visible
- [ ] System option follows OS preference

---

## 40. Keyboard Shortcuts

**Test:**
- [ ] `Ctrl+Shift+C` → opens popup (cite current page)
- [ ] `Ctrl+Shift+S` → opens side panel
- [ ] `Enter` (in popup, not in field) → copies bibliography
- [ ] `Ctrl+Enter` → copies bibliography from anywhere
- [ ] `Escape` → closes custom dialogs

---

## 41. Error Handling

**Test network errors:**
1. Disconnect internet
2. Click Enhance with a DOI

**Expected:**
- [ ] Error: "CrossRef: Network error. Are you offline?"
- [ ] Not a generic error or hang

**Test invalid DOI:**
1. Type `10.xxxx/invalid` → Enhance

**Expected:**
- [ ] Error: "CrossRef: Not found (404)"

**Test WASM failure:**
1. (Simulate by checking console for WASM errors)

**Expected:**
- [ ] JS fallback parsers handle BibTeX/RIS/CSL-JSON import
- [ ] Citation formatting uses JS (not garbled WASM output)
- [ ] Blue hint if WASM failed on startup

---

## 42. Badge Count

**Steps:**
1. Start with empty library → no badge
2. Add 1 citation → badge shows "1"
3. Add 5 more → badge shows "6"
4. Delete 2 → badge shows "4"
5. Clear all → badge disappears

**Expected:**
- [ ] Badge color is saffron (#f49707)
- [ ] Updates immediately on add/delete
- [ ] Shows "999+" for 1000+ citations

---

## 43. Help Page

**Steps:**
1. Click "?" in popup header → help page opens

**Expected:**
- [ ] Sidebar navigation (desktop)
- [ ] All 18 sections present
- [ ] Active section highlights on scroll
- [ ] Back to top button appears on scroll
- [ ] Mobile: hamburger menu toggles sidebar
- [ ] Type validation table present
- [ ] Formats reference tables present

---

## 44. Custom Dialogs

**Verify no native `confirm()` or `alert()` anywhere:**
- [ ] Delete citation → custom dialog with "Delete" (red) button
- [ ] Duplicate warning → custom dialog with "Add Anyway" button
- [ ] Bulk delete → custom dialog "Delete X citations? This cannot be undone."
- [ ] Clear all data → custom dialog with "Delete Everything" (red)
- [ ] Restore success → custom alert with green checkmark
- [ ] All dialogs: Escape key closes, click outside closes

---

## 45. Smart Date Input

**Steps:**
1. Type `2024` → precision auto-switches to "Year"
2. Type `2024-06` → auto-switches to "Y-M"
3. Type `2024-06-15` → auto-switches to "Y-M-D"
4. Type `2024-13` → warning "Invalid month (1-12)"
5. Type `2035` → warning "Future date: 2035. Is this correct?"
6. Click "n.d." button → field clears, hint "No date"

**Expected:**
- [ ] Placeholder updates per precision
- [ ] Validation hints in amber
- [ ] n.d. button works

---

## 46. Non-Academic Site Filtering

**These should NOT suggest "might be journal article":**
- [ ] `https://drive.google.com/` — container "Google Drive" ignored
- [ ] `https://www.youtube.com/watch?v=...` — no DOI extraction from body
- [ ] `https://github.com/oriclabs/ibid` — no false suggestion
- [ ] `https://www.reddit.com/` — no false suggestion
- [ ] `https://medium.com/` — container "Medium" ignored

**These SHOULD auto-detect as journal:**
- [ ] `https://journals.asm.org/doi/abs/10.1128/...` — detected by URL pattern
- [ ] `https://www.nature.com/articles/...` — detected by domain
- [ ] `https://pubmed.ncbi.nlm.nih.gov/...` — detected by domain
- [ ] Any URL with `/doi/abs/10.xxxx` or `/doi/full/10.xxxx` path

---

## 47. WASM / Hayagriva CSL Renderer

### Architecture

The WASM engine now uses **hayagriva** (Typst's CSL processor) with en-US locale for rendering.

| Component | Bib (bibliography) | In-text P (parenthetical) | In-text N (narrative) |
|---|---|---|---|
| **Primary** | WASM (hayagriva) | WASM (hayagriva) | JS (6-family) |
| **Fallback** | JS 6-family | JS 6-family | — (JS is primary) |

### WASM rendering tests

**Steps:**
1. Open popup on `https://www.nature.com/articles/s41586-024-08219-w`
2. Select MLA 9th Edition style
3. Check bib preview and in-text P

**Expected:**
- [ ] Bib: `Doughty, Benjamin R., et al. "Single-Molecule States Link Transcription Factor Binding to Gene Expression." Nature, vol. 636, no. 8043, Dec. 2024, pp. 745–54, https://doi.org/10.1038/s41586-024-08219-w.`
- [ ] In-text P: `(Doughty et al.)` — NOT all 12 authors listed
- [ ] In-text N: `Doughty et al.` (JS formatter, narrative)
- [ ] No ANSI escape codes (`[0m`) in output
- [ ] Bundled styles use official CSL files (not simplified hand-written versions)

### Hayagriva-specific checks

- [ ] Et al. works correctly (MLA: 3+, APA: 3+ in-text / 21+ in bib)
- [ ] Title case applied (MLA: "Single-Molecule States..." not "Single-molecule states...")
- [ ] Volume/issue labels correct (MLA: "vol. 636, no. 8043" not "volume 636, issue 8043")
- [ ] Page range compression (MLA: "pp. 745–54" not "pp. 745-754")
- [ ] En-dash in page ranges (745–54 not 745-54)
- [ ] Month names from locale (Nov., Dec., etc.)
- [ ] "et al." term from en-US locale

### WASM fallback (if WASM fails to load)

**Import should still work for:**
- [ ] BibTeX → JS fallback parser
- [ ] RIS → JS fallback parser
- [ ] CSL-JSON → JS JSON.parse

**Export should still work for:**
- [ ] BibTeX → JS fallback serializer
- [ ] RIS → JS fallback serializer
- [ ] CSL-JSON → JSON.stringify
- [ ] CSV → JS fallback serializer

**Citation formatting when WASM unavailable:**
- [ ] JS 6-family formatter renders instantly (sync)
- [ ] No blank/broken preview — JS always available as fallback
- [ ] Standard styles (APA/MLA/Chicago/Harvard/IEEE/Vancouver) mapped correctly
- [ ] Non-standard styles fall back to closest JS family via `resolveStyleFamily()`

---

## 48. DOI Cleaning

**URL:** `https://journals.asm.org/doi/epdf/10.1128/mr.59.3.423-450.1995`

**Steps:**
1. Open popup on the URL above
2. Check the DOI field

**Expected:**
- [ ] DOI shows `10.1128/mr.59.3.423-450.1995` (NOT `10.1128/mr.59.3.423-450.1995?download=true`)
- [ ] No `?query=`, `#fragment`, or trailing punctuation in DOI
- [ ] Enhance works with the cleaned DOI
- [ ] CrossRef returns valid data

**Also test:**
- `10.1038/nature12373?ref=pdf` → cleaned to `10.1038/nature12373`
- `10.1038/nature12373#section1` → cleaned to `10.1038/nature12373`
- `10.1038/nature12373.` → cleaned to `10.1038/nature12373`

---

## 49. Library Inline Preview

**Steps:**
1. Add 2+ citations to library
2. Open side panel → Library tab
3. Click a citation title to expand the inline preview

**Expected:**
- [ ] Preview expands below the citation row
- [ ] Shows: style picker | "Preview" label | Copy Bib | Copy In-text
- [ ] Bib output in top section, separated by border from in-text section
- [ ] In-text section has "In-text" label, P/N toggle, and citation text
- [ ] Default style is APA

### Style picker in preview

- [ ] Searchable dropdown with recent styles, grouped categories, field tags
- [ ] Same look as popup style picker (not a plain `<select>`)
- [ ] Changing style updates both bib and in-text via WASM
- [ ] Downloaded styles (e.g., PLOS) render correctly via hayagriva
- [ ] Only one preview open at a time (others collapse)

### Copy buttons

- [ ] "Copy Bib" copies bibliography in selected style
- [ ] "Copy In-text" copies in-text in selected P/N mode
- [ ] Rich text option: if Settings → Copy format = "Rich text", copies HTML with formatting
- [ ] Button shows "Copied!" flash for 1.5 seconds

### P/N toggle in preview

- [ ] P button active by default (saffron)
- [ ] Click N → narrative in-text shown
- [ ] Click P → parenthetical in-text shown
- [ ] Toggle state independent per citation
- [ ] 3+ authors: P shows `(Author et al., 2024)`, N shows `Author et al. (2024)`

---

## 50. Library Tab Switching

**Steps:**
1. Open side panel → Library tab (shows citations)
2. Switch to Import tab
3. Switch to Export tab
4. Switch back to Library tab

**Expected:**
- [ ] Library shows all citations when switching back (not empty)
- [ ] Search bar hidden on Import/Export tabs
- [ ] Search bar visible on Library tab
- [ ] Export count updates when switching to Export tab

---

## 51. Dropdown Mutual Exclusion

**Steps:**
1. Click gear icon → settings dropdown opens
2. Click style picker button (without closing settings first)

**Expected:**
- [ ] Settings dropdown closes
- [ ] Style picker opens
- [ ] Only one dropdown open at a time

**Also test reverse:**
1. Open style picker
2. Click gear icon

**Expected:**
- [ ] Style picker closes
- [ ] Settings opens

---

## 52. N.D. Toggle Button

**Steps:**
1. Open popup with a citation that has a date
2. Click "n.d." button

**Expected:**
- [ ] Date input clears and becomes **disabled** (grayed out)
- [ ] Precision dropdown becomes **disabled**
- [ ] n.d. button turns saffron (active state)
- [ ] Hint shows: "No date — citation will show n.d."
- [ ] Citation preview shows "n.d." for year

3. Click "n.d." button again (toggle off)

**Expected:**
- [ ] Date input re-enabled
- [ ] Precision dropdown re-enabled
- [ ] n.d. button returns to normal
- [ ] Can type a date again

---

## 53. Engine Status in Settings

**Steps:**
1. Open Options page (via Quick Settings → Advanced Settings)
2. Scroll to About section

**Expected:**
- [ ] Version number shown (e.g., v0.1.0)
- [ ] Citation Engine: green dot + "Rust/WASM active" (or red + "WASM failed" if broken)
- [ ] Formatter: "JavaScript (6 style families)"
- [ ] Import/Export: "Rust/WASM (7 formats)" (or "JavaScript fallback (3 formats)")
- [ ] Styles Bundled: "74 offline"
- [ ] Storage: shows actual usage (e.g., "12.3 KB")
- [ ] Cloud Sync section is **hidden** (not visible)

---

## 54. On-Demand Style Download

**Steps:**
1. Open any style picker (popup or inline preview)
2. Search for "plos" (not in 74 bundled styles)
3. Wait for "Searching 2600+ CSL styles online..." message
4. See online results appear (plos, plos-biology, plos-computational-biology, etc.)
5. Click download on "Public Library of Science"

**Expected:**
- [ ] Remote search fetches GitHub CSL file tree (cached for session)
- [ ] Results show style name + "download" badge
- [ ] Click download → "Downloading..." → style selected
- [ ] Downloaded style renders correctly via hayagriva
- [ ] Style appears in "Downloaded" group on future visits
- [ ] Works offline after first download (cached in chrome.storage.local)
- [ ] No new permissions needed (fetch to public GitHub URL)

**Also test:**
- [ ] Search "jama" → find and download JAMA style
- [ ] Search "turabian" → find Turabian styles
- [ ] Search "nonexistent-style-xyz" → "No styles found" message
- [ ] Offline search → "Search unavailable offline" message
- [ ] Invalid CSL ID → "Style not found" error

**Validation:**
- [ ] Downloaded XML validated: must contain `<style` and `purl.org/net/xbiblio/csl`
- [ ] Style metadata extracted from XML (title, field)
- [ ] 10-second timeout on downloads

---

## 55. DOI Enhance Field Position

**Steps:**
1. Open popup on any page

**Expected:**
- [ ] DOI/Enhance field is at the **top** of the fields section (first field after style picker)
- [ ] Placeholder says "Paste DOI, ISBN, PMID, or URL to auto-fill"
- [ ] Enhance button is inline with DOI field
- [ ] After enhance, fields below populate (title, authors, date, etc.)
- [ ] Natural top-down flow: paste identifier → everything fills below

---

## 56. Third-Party Verification

Compare Ibid's output against known-correct sources for accuracy.
Use [ZoteroBib](https://zbib.org) as the reference — paste each DOI there and compare.

### Paper 1: `10.1128/mr.59.3.423-450.1995` (ASM Microbiology)

**Expected metadata:** Ross, J. (1995). mRNA stability in mammalian cells. Microbiological Reviews, 59(3), 423-450.

| Style | Ibid Output | ZoteroBib Reference | Match? |
|-------|-------------|---------------------|--------|
| APA 7 | | | [ ] |
| MLA 9 | | | [ ] |
| Chicago 17 | | | [ ] |
| Harvard | | | [ ] |
| IEEE | | | [ ] |
| Vancouver | | | [ ] |

**Verify:** Author name, year, title, journal, volume, issue, pages, DOI

### Paper 2: `10.1038/nature12373` (Nature, 8 authors)

**Expected metadata:** Kucsko, G. et al. (2013). Nanometre-scale thermometry in a living cell. Nature, 500, 54-58.

| Style | Ibid Output | ZoteroBib Reference | Match? |
|-------|-------------|---------------------|--------|
| APA 7 | | | [ ] |
| MLA 9 | | | [ ] |
| Chicago 17 | | | [ ] |
| Harvard | | | [ ] |
| IEEE | | | [ ] |
| Vancouver | | | [ ] |

**Verify:** Et al. handling (APA: 3+, Vancouver: 7+), all 8 authors in bibliography

### Paper 3: `10.1371/journal.pone.0185809` (PLOS ONE, 12 authors)

**Expected:** 12 authors — tests et al. rules across all styles.

| Style | Ibid Output | ZoteroBib Reference | Match? |
|-------|-------------|---------------------|--------|
| APA 7 | | | [ ] |
| MLA 9 | | | [ ] |
| Chicago 17 | | | [ ] |
| Harvard | | | [ ] |
| IEEE | | | [ ] |
| Vancouver | | | [ ] |

**Verify:** Et al. in bibliography (Vancouver: after 6), in-text et al. (APA: after 2)

### Paper 4: `10.1126/science.1058040` (Science, book-like DOI)

| Style | Ibid Output | ZoteroBib Reference | Match? |
|-------|-------------|---------------------|--------|
| APA 7 | | | [ ] |
| MLA 9 | | | [ ] |
| IEEE | | | [ ] |

### Paper 5: ISBN `978-0-201-89683-1` (Knuth, Book)

**Expected:** Knuth, D. E. (1997). The Art of Computer Programming. Addison-Wesley.

| Style | Ibid Output | ZoteroBib Reference | Match? |
|-------|-------------|---------------------|--------|
| APA 7 | | | [ ] |
| MLA 9 | | | [ ] |
| Chicago 17 | | | [ ] |

**Verify:** Book title italic (in HTML output), publisher, no journal/volume/issue

### Verification checklist per style

**APA 7:**
- [ ] Author format: Last, I. I.
- [ ] Ampersand (&) before last author
- [ ] Year in parentheses after author
- [ ] Article title in sentence case (not italic)
- [ ] Journal italic, volume italic, issue in parens
- [ ] DOI as https://doi.org/... URL
- [ ] In-text: (Author, Year) or (Author et al., Year)

**MLA 9:**
- [ ] Author format: Last, First
- [ ] "and" between 2 authors (not &)
- [ ] Title in "quotation marks" (articles) or *italic* (books)
- [ ] Journal in italic
- [ ] vol./no. labels
- [ ] pp. before pages
- [ ] In-text: (Author) or (Author pages)

**Chicago 17 (Author-Date):**
- [ ] Year after author name (not in parens in bibliography)
- [ ] Title in "quotation marks" (articles) or *italic* (books)
- [ ] no. for issue
- [ ] Colon before pages
- [ ] In-text: (Author Year)

**Harvard:**
- [ ] Year in parentheses after author
- [ ] Title in 'single quotes' (articles) or *italic* (books)
- [ ] pp. before pages
- [ ] doi: prefix (not full URL)
- [ ] Available at: for URLs

**IEEE:**
- [ ] Numbered: [1]
- [ ] Author format: I. I. Last
- [ ] Title in "quotation marks"
- [ ] vol., no., pp. labels
- [ ] doi: with space

**Vancouver:**
- [ ] Numbered: 1.
- [ ] Author format: I Last (no period after initial in some variants)
- [ ] Title not italic, not quoted
- [ ] Year;Volume(Issue):Pages format
- [ ] Et al. after 6 authors

### Additional verification tools

- **Purdue OWL** (owl.purdue.edu) — authoritative APA/MLA/Chicago format rules
- **CrossRef API** — `https://api.crossref.org/works/{DOI}` — verify raw metadata
- **DOI.org** — `https://doi.org/{DOI}` — verify landing page has correct info
- **JabRef** (free) — open exported .bib files, verify all fields present
- **Zotero** (free) — import exported .ris/.bib, verify data integrity

---

## 56. Shared Citation Formatter

The `shared/citation-formatter.js` module provides a unified API used by both popup and sidepanel.

**API tests:**
- [ ] `CitationFormatter.formatBibSync(item, 'apa')` — instant JS, returns string
- [ ] `CitationFormatter.formatBib(item, 'apa')` — async, WASM primary + JS fallback
- [ ] `CitationFormatter.formatIntextSync(item, 'apa', false)` — instant JS parenthetical
- [ ] `CitationFormatter.formatIntextSync(item, 'apa', true)` — instant JS narrative
- [ ] `CitationFormatter.formatIntext(item, 'apa', false)` — async, WASM for P
- [ ] `CitationFormatter.formatIntext(item, 'apa', true)` — always JS for N
- [ ] `CitationFormatter.formatBoth(item, styleId, {html:true})` — bib+intext, WASM bib + correct intext
- [ ] `CitationFormatter.resolveStyleFamily('nature')` → `'vancouver'`
- [ ] `CitationFormatter.resolveStyleFamily('plos')` → `'vancouver'`
- [ ] `CitationFormatter.resolveStyleFamily('unknown-style')` → `'apa'`

**Style picker component:**
- [ ] `CitationFormatter.createStylePicker(container, opts)` — creates searchable dropdown
- [ ] `dropUp: true` — dropdown opens above button (for inline previews)
- [ ] `dropUp: false` — dropdown opens below button (for toolbars)
- [ ] `onSelect(styleId, name)` callback fires on selection
- [ ] `picker.getSelectedId()` returns current style ID
- [ ] `picker.destroy()` cleans up event listeners

---

## 57. Local PDF / File URL Handling

**Steps:**
1. Open a local PDF in Chrome: `file:///C:/path/to/paper.pdf`
2. Click the Ibid extension icon

**Expected (without file access permission):**
- [ ] Shows hint: "Local file detected. To auto-extract, enable 'Allow access to file URLs'..."
- [ ] Title extracted from filename (hyphens/underscores → spaces)
- [ ] Type set to "document"
- [ ] DOI field empty (user can paste and Enhance)

**Expected (with file access permission enabled):**
- [ ] Shows hint: "Local file detected. Metadata extracted from filename..."
- [ ] PDF extractor injected, tries to get title from Chrome PDF viewer
- [ ] Enhance button works with pasted DOI

**Also test:**
- [ ] `file:///C:/path/s44187-026-00833-z.pdf` → title: "s44187 026 00833 z"
- [ ] `chrome://extensions/` → restricted page hint (not file handling)
- [ ] Regular HTTP URL → normal extraction (no file hints)

---

## 58. Library Settings (Sidepanel)

**Steps:**
1. Open sidepanel → click gear icon in header (next to tabs)

**Expected:**
- [ ] Settings dropdown opens with "Library Settings" header
- [ ] Default sort selector syncs with toolbar sort dropdown
- [ ] Copy format: Plain text / Rich text (HTML)
- [ ] Theme: System / Light / Dark
- [ ] "Advanced Settings" link opens options page
- [ ] Settings persist across sessions (chrome.storage.local)
- [ ] Changing theme applies immediately
- [ ] Dropdown closes on outside click
- [ ] Only one dropdown open at a time (gear vs style pickers)

---

## 59. Library Manual Entry

**Steps:**
1. Click the `+` button in library toolbar
2. Fill in entry form

**Expected:**
- [ ] Form appears below toolbar with type, title, authors, year, etc.
- [ ] Type dropdown: Journal, Book, Chapter, Webpage, Thesis, Report, Conference
- [ ] Title is required (focus on empty submit)
- [ ] Authors format: "Last, First; Last, First"
- [ ] DOI/URL field with Enhance button (auto-fills from CrossRef)
- [ ] Cancel button clears and hides form
- [ ] "Add to Library" saves entry with `_projectIds: ['default']`
- [ ] Entry appears in library immediately after save
- [ ] Form clears after successful save

**Enhance in manual entry:**
- [ ] Paste DOI `10.1038/s41586-024-08219-w` → click Enhance
- [ ] Title, authors, year, journal, volume, issue, pages fill automatically
- [ ] Only empty fields are filled (user edits not overwritten)

---

## 60. Library Visit Source Link

**Steps:**
1. Add a citation from a web page (has URL)
2. Open sidepanel → Library
3. Look for link icon (↗) on the citation row

**Expected:**
- [ ] Link icon visible only for entries with URL, DOI, or source URL
- [ ] Click opens source page in new tab
- [ ] DOI entries open `https://doi.org/{DOI}`
- [ ] Manual entries without URL → no link icon shown
- [ ] Icon is blue on hover, small and unobtrusive

---

## 61. In-Library Status Bar

**Steps:**
1. Add a citation to "My Bibliography" project
2. Visit the same page again → open popup

**Expected:**
- [ ] Compact bar: `✓ In "My Bibliography"  View · Update`
- [ ] Green background, emerald accent
- [ ] "View" opens sidepanel
- [ ] "Update" saves current edits to existing entry
- [ ] Shows which project the entry is in (e.g., `In "Thesis"`)
- [ ] Add button stays as "Add" (for adding to different project)
- [ ] Bar hidden when entry not in library

---

## 62. Import / Export Project Filters

### Export filters

**Steps:**
1. Open sidepanel → Export tab
2. Check project and scope dropdowns

**Expected:**
- [ ] Project dropdown: "All Projects", "My Bibliography", + custom projects
- [ ] Scope dropdown: "All entries", "Starred only", "Journals only", "Books only", "Webpages only"
- [ ] Count updates dynamically: "X citations will be exported"
- [ ] Project filter works with both `_projectIds` (array) and `_project` (legacy)
- [ ] Entries without project field default to "My Bibliography"

### Import project selector

**Steps:**
1. Open sidepanel → Import tab
2. Parse some BibTeX entries
3. Note "Import to:" project dropdown above Import button

**Expected:**
- [ ] Default: "My Bibliography"
- [ ] Custom projects listed
- [ ] Imported entries get `_projectIds: [selectedProject]`
- [ ] Entries appear in correct project after import

---

## Quick Smoke Test (5 minutes)

Run this before every release:

1. [ ] Open `https://www.nature.com/articles/s41586-024-08219-w` → click Ibid → 12 authors fill
2. [ ] Select MLA 9th → bib shows `Doughty, Benjamin R., et al.` (not all 12 authors)
3. [ ] In-text P shows `(Doughty et al.)` — not all 12 names listed
4. [ ] Click N → in-text shows `Doughty et al.` (narrative)
5. [ ] Switch to APA 7 → bib changes, in-text shows `(Doughty et al., 2024)`
6. [ ] Click Add → saved to library
7. [ ] Open Library side panel → citation appears with link icon (↗)
8. [ ] Click citation title → inline preview opens with style picker and P/N toggle
9. [ ] Change preview style to IEEE → output updates via hayagriva
10. [ ] Search "plos" in style picker → remote results appear → download PLOS
11. [ ] PLOS renders correctly (numbered style, no et al. issues)
12. [ ] Click + in toolbar → manual entry form → fill title/DOI → Enhance → Add to Library
13. [ ] Import tab → select project → paste BibTeX → Parse → Import → appears in correct project
14. [ ] Export tab → filter by project → BibTeX → Download → file saves
15. [ ] Close popup → reopen on same page → "In library" bar shows with View · Update
16. [ ] Sidepanel gear → change theme to Dark → applies immediately
17. [ ] `chrome://extensions/` → popup opens → restricted page hint, no crash
18. [ ] Local PDF `file:///` → "Local file detected" hint
19. [ ] All custom dialogs are styled — no native browser confirms

---

## Automated Test Suite

### Rust tests (WASM engine)

```bash
cd crates/ibid-core && cargo test
```

Current counts: **188+ tests**
- CSL parser: style XML parsing, choose/if/else, group delimiters, date-parts
- CSL renderer (custom): names, dates, labels, groups, et-al, initials, punctuation dedup
- Hayagriva integration: MLA et-al (12 authors → "et al."), CSL-JSON → Entry conversion
- Parsers: BibTeX, RIS, CSL-JSON, EndNote XML, MEDLINE, CSV
- Serializers: BibTeX, RIS, CSL-JSON, CSV, TSV, YAML, Word XML
- Types: ItemType roundtrip, Name fields, DateVariable, StringOrNumber

### Key Rust test cases

| Test | What it verifies |
|------|-----------------|
| `test_mla_et_al_citation` | 12-author MLA: bib has "et al.", in-text has "et al." |
| `test_apa_bib_author_initials` | Authors as "Smith, J. A." not "Smith, John Andrew" |
| `test_apa_bib_group_delimiters` | ". " between author/year/title/source groups |
| `test_apa_citation_et_al_many_authors` | 5 authors → "Smith et al." in citation |
| `test_apa_bib_volume_issue_format` | "13(3)" not "volume 13, issue 3" |
| `test_hyphenated_name_initials` | "Jean-Pierre" → "J.-P." |
| `test_initialize_given_name` | "Benjamin Robert" → "B. R." with ". " delimiter |
| `test_roundtrip_bibtex` | BibTeX parse → serialize → parse roundtrip |
| `test_roundtrip_ris` | RIS parse → serialize → parse roundtrip |

### WASM build

```bash
cd crates/ibid-core && wasm-pack build --target web --out-dir ../../browser/chrome/wasm
```

- [ ] Build succeeds without errors
- [ ] WASM size: ~1.8MB (hayagriva + en-US locale, no wasm-opt)
- [ ] `.wasm`, `.js`, `.d.ts` files generated in `browser/chrome/wasm/`

### JS tests (extension)

```bash
npm test        # offline tests
npm run test:all # including network tests
```

- Extractor: metadata extraction from HTML
- Popup: field population, validation, style switching
- Resolver: DOI/ISBN/PMID/arXiv resolution
- Fallback parsers: BibTeX, RIS, CSL-JSON (when WASM unavailable)
- Citation formatter: 6-family JS rendering, style resolution
- Real-world URLs: Wikipedia, CrossRef, PubMed, Reuters
- **Total: 473+ tests**
