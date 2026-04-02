# Ibid — Privacy-First Citation Manager

<p align="center">
  <img src="browser/shared/icons/icon-128.png" alt="Ibid" width="80" height="80" style="border-radius: 16px;">
</p>

<p align="center">
  <strong>One-click citations. 74 styles. Zero data collection.</strong><br>
  A browser extension that gets citations right — built with Rust/WASM, Tailwind CSS, and Vanilla JS.
</p>

<p align="center">
  <a href="https://ibid.tools">Website</a> ·
  <a href="https://ibid.tools/privacy.html">Privacy Policy</a> ·
  <a href="#installation">Install</a> ·
  <a href="#features">Features</a> ·
  <a href="#development">Development</a>
</p>

---

## Why Ibid?

Every existing citation extension has the same problems:
- **Wrong citations** — authors missing, dates wrong, formats broken
- **Privacy abuse** — some hijack your bandwidth for scraping networks
- **Paywalls** — basic features locked behind subscriptions
- **Abandoned** — bought out and shut down (RefMe → CiteThisForMe)

Ibid fixes all of these. All processing happens locally in your browser via Rust/WebAssembly. No telemetry. No accounts. No ads. Free forever.

## Features

### Core
- **One-click cite** any webpage — metadata auto-extracted from structured data (JSON-LD, Highwire Press, Dublin Core, OpenGraph)
- **74 citation styles** bundled offline — APA (6th, 7th), MLA (8th, 9th), Chicago (16th, 17th), Harvard, IEEE, Vancouver, Nature, Science, Lancet, OSCOLA, Bluebook, and 60+ more
- **Smart auto-enhance** — paste a DOI, ISBN, PMID, or arXiv ID and Ibid resolves full metadata via CrossRef, Open Library, NCBI, or arXiv
- **15 site-specific extractors** — Google Scholar, PubMed, arXiv, ResearchGate, Scopus, SSRN, JSTOR, IEEE Xplore, ScienceDirect, Springer, Wiley, and more
- **NER-based fallback** — detects author names and dates from page text when structured metadata is missing

### Citation Formatting
- **6 style families** with correct formatting: APA, MLA, Chicago, Harvard, IEEE, Vancouver
- **Parenthetical and narrative** in-text citations (toggle with P/N)
- **Per-project styles** — each project can use a different citation style
- **Custom style editor** — create your own citation format with live preview
- **Source type validation** — warns if selected type doesn't match metadata, suggests corrections

### Library Management
- **Side panel** — manage your library without leaving the page
- **Projects/folders** — organize citations by assignment, paper, or course
- **Tags** — color-coded tags with filtering
- **Star, notes, quotes** — annotate and mark favorites
- **Sort & filter** — by date, author, title, year, type, project, tag, starred
- **Bulk operations** — select multiple, star/unstar/delete in batch
- **Duplicate detection** — on add and import, with merge UI
- **Search** — full-text across all fields

### Import & Export
- **Import 7 formats**: BibTeX, RIS, CSL-JSON, EndNote XML, MEDLINE/NBIB, CSV, TSV
- **Export 10 formats**: BibTeX, RIS, CSL-JSON, CSV, TSV, YAML, Word XML, Formatted Text, HTML, Markdown
- **Auto-detect format** — paste any text and Ibid figures out the format
- **Selective import** — preview entries with checkboxes before importing
- **Migration wizard** — guided import from Zotero, Mendeley, EndNote
- **JS fallback parsers** — BibTeX/RIS/CSL-JSON work even if WASM fails

### Other
- **Omnibox** — type `cite` in the address bar to search or resolve identifiers
- **Context menu** — right-click to cite pages, links, or save selected text as quotes
- **Keyboard shortcuts** — `Ctrl+Shift+C` to cite, `Enter` to copy, `Ctrl+Shift+S` for side panel
- **Citation count badge** — saffron badge on the icon shows your library size
- **Dark mode** — follows system or manual toggle (Light/System/Dark)
- **First-run onboarding** — welcome page with getting started guide
- **Embedded help** — full documentation with sidebar navigation
- **Custom dialogs** — non-blocking confirm/alert (no browser-blocking popups)
- **Backup/restore** — export and import your entire library as JSON
- **PDF detection** — extracts metadata from PDF pages viewed in browser

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Core engine | Rust → WebAssembly (parsers, serializers) |
| UI | Vanilla JS + Tailwind CSS (no frameworks) |
| Extension | Chrome Manifest V3 (service worker, side panel, content scripts) |
| Storage | IndexedDB (citations) + chrome.storage.local (settings) |
| Build | wasm-pack, Tailwind CLI, Node.js scripts |

## Installation

### Browser Stores

- **Chrome / Brave**: [Chrome Web Store](https://chromewebstore.google.com/detail/ldfpipkkpgknnfidnnflpdcdkjbjlbch)
- **Edge**: [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ibid-%E2%80%94-citation-manager/hiocfefpndjnicfcchahjdighckanhmj)
- **Firefox**: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/ibid-citation-manager/)

### From Source (Developer Mode)

```bash
# Clone
git clone https://github.com/oriclabs/ibid.git
cd ibid

# Install dependencies
npm install

# Build WASM (requires Rust + wasm-pack)
npm run wasm:build

# Build CSS
npm run css:build

# Build Chrome extension
node scripts/build-chrome.js

# Load in Chrome:
# 1. Go to chrome://extensions/
# 2. Enable Developer Mode
# 3. Click "Load unpacked"
# 4. Select the browser/dist/chrome/ directory
```

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

## Development

### Project Structure

```
ibid/
├── crates/ibid-core/          # Rust/WASM citation engine
│   ├── src/
│   │   ├── csl/               # CSL parser, locale, renderer
│   │   ├── parsers/           # BibTeX, RIS, EndNote XML, MEDLINE, CSV
│   │   ├── serializers/       # BibTeX, RIS, CSV, Word XML, YAML
│   │   ├── types.rs           # CSL-JSON data model
│   │   └── wasm_api.rs        # WASM bindings
│   └── tests/                 # 182 Rust tests
├── browser/
│   ├── chrome/                # Chrome extension source
│   │   ├── background/        # Service worker, resolver, DB, fallback parsers
│   │   ├── content/           # Metadata extractor, PDF extractor
│   │   ├── popup/             # Citation popup UI
│   │   ├── sidepanel/         # Library management panel
│   │   ├── options/           # Settings, style editor
│   │   ├── help/              # Embedded documentation
│   │   ├── onboarding/        # First-run welcome page
│   │   ├── shared/            # Dialog, toast components
│   │   ├── styles/csl/        # 74 bundled CSL style files
│   │   └── icons/             # Extension icons (16-128px)
│   ├── shared/                # Shared assets (CSS, icons, WASM)
│   ├── edge/                  # Edge store listing
│   └── dist/                  # Built extension (gitignored)
├── website/src/               # Landing page + privacy policy
├── tests/
│   ├── extension/             # 202 JS tests
│   └── real-world/            # 89 style tests + 38 URL tests
└── scripts/                   # Build, icon gen, CSL fetch scripts
```

### Commands

```bash
# Run all tests (Rust + JS + Styles)
npm test

# Run with real-world URL tests (needs network)
npm run test:all

# Individual test suites
npm run test:rust      # 182 Rust tests
npm run test:js        # 202 JS tests
npm run test:styles    # 89 style formatting tests
npm run test:urls      # 38 real-world URL tests

# Build
npm run wasm:build     # Compile Rust to WASM
npm run css:build      # Build Tailwind CSS
npm run chrome:build   # Full build (WASM + CSS + dist)

# Development
npm run css:watch      # Watch Tailwind CSS changes
```

### Test Suite

| Suite | Count | Coverage |
|-------|-------|---------|
| Rust — CSL engine | 31 | Parser, locale, renderer |
| Rust — Style parsing | 6 | All 9 bundled styles |
| Rust — Rendering | 27 | All styles, edge cases |
| Rust — Names/Dates | 9 | Particles, suffixes, corporate |
| Rust — Parsers | 50 | BibTeX, RIS, EndNote XML, MEDLINE, CSV |
| Rust — Serializers | 34 | BibTeX, RIS, CSV, Word XML, YAML |
| Rust — Types | 15 | All 44 CSL item types |
| Rust — Locale | 10 | Months, terms, plurals |
| JS — Extractor | 17 | Name/date parsing |
| JS — Popup logic | 33 | Authors, dates, duplicates |
| JS — Resolver | 18 | DOI/ISBN/PMID/arXiv detection |
| JS — Validation | 24 | Type validation, domain filtering |
| JS — Fallback parsers | 18 | WASM-free BibTeX/RIS roundtrips |
| JS — Phase 4 | 82 | Site detection, NER, PDF, omnibox, styles |
| Style formatting | 89 | APA, MLA, Chicago, Harvard, IEEE, Vancouver |
| **Total** | **473** | |

## Privacy

Ibid is designed with privacy as a core principle:

- **Zero telemetry** — no analytics, tracking, or usage data
- **Local processing** — all citation formatting runs in Rust/WASM in your browser
- **No bandwidth abuse** — unlike some competitors, Ibid never uses your connection for scraping
- **Minimal permissions** — `activeTab`, `scripting`, `storage`, `sidePanel`, `contextMenus`
- **No account required** — everything works without signing in
- **Network requests** — only when YOU click Enhance (CrossRef, Open Library, NCBI, arXiv APIs)

Full privacy policy: [ibid.tools/privacy.html](https://ibid.tools/privacy.html)

## Supported Citation Styles

74 styles bundled offline, including:

**By edition:** APA 7th, APA 6th, MLA 9th, MLA 8th, Chicago 17th, Chicago 16th

**By field:**
- Psychology: APA, APA-CV
- Humanities: MLA, Chicago, Turabian, MHRA, SBL
- Medicine: Vancouver, AMA, Lancet, NEJM, BMJ, NLM
- Science: Nature, Science, Cell, PNAS, Annual Reviews
- Engineering: IEEE, ASCE, ASME
- Chemistry: ACS, RSC, Angewandte Chemie
- Computer Science: ACM, Springer LNCS
- Law: OSCOLA, Bluebook, McGill
- Social Science: ASA, APSA, SAGE
- Regional: ABNT (Brazil), GOST (Russia), DIN 1505 (Germany), ISO 690, SIST02 (Japan)
- Publishers: Springer, Elsevier, T&F, Wiley, Cambridge UP, Frontiers, MDPI, Copernicus

## Roadmap

- [x] Phase 1 — Core extension (cite, import/export, library)
- [x] Phase 2 — Additional formats, tags, duplicates, IndexedDB, cloud sync UI
- [x] Phase 3 — Omnibox, annotations, toast notifications
- [x] Phase 4 — Enhanced extraction, custom style editor, PDF support
- [ ] Phase 5 — Google Docs add-on, collaborative bibliographies, citation graph
- [ ] Phase 6 — Firefox/Safari/Edge ports

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE) — free to use, modify, and distribute.

## Acknowledgments

- Citation styles from the [Citation Style Language](https://citationstyles.org/) project
- Identifier resolution via [CrossRef](https://www.crossref.org/), [Open Library](https://openlibrary.org/), [NCBI](https://www.ncbi.nlm.nih.gov/), and [arXiv](https://arxiv.org/)
- Built with [Rust](https://www.rust-lang.org/), [wasm-pack](https://rustwasm.github.io/wasm-pack/), and [Tailwind CSS](https://tailwindcss.com/)
