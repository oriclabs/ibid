# Reddit Launch Posts

---

## r/AcademicSoftware, r/GradSchool, r/LaTeX, r/PhD, r/Zotero

**Title:** I built Ibid — a privacy-first citation manager that runs entirely in your browser (no servers, no accounts, 2,600+ styles, Chrome + Edge + Firefox)

**Body:**

Hey everyone,

I got frustrated with existing citation extensions — they get formatting wrong, send your data to external servers, or lock basic features behind paywalls. So I built **Ibid**.

The name comes from Latin *ibidem* — "in the same place."

**What it does:**
- Click the icon on any page → metadata auto-extracted → formatted citation ready to copy
- 74 citation styles bundled offline (APA, MLA, Chicago, Harvard, IEEE, and more)
- 2,600+ additional styles downloadable on demand from the official CSL repository
- Auto-enhance: DOI, ISBN, PMID, arXiv, or any URL → full metadata from multiple academic APIs with automatic fallback
- PDF support: extracts metadata from PDF text, document properties, and DOI patterns in URLs/filenames
- Library with projects, tags, search, and inline preview with per-citation style picker
- Import/export in common academic formats (BibTeX, RIS, CSL-JSON, and more)

**How it works under the hood:**
- Citation rendering powered by Hayagriva (the CSL engine from the Typst project) compiled to WebAssembly
- PDF text extraction also via Rust/WASM — no external PDF libraries
- All processing happens locally — zero telemetry, zero data collection
- Optional scholarly API access (arXiv, doi.org) — you choose whether to grant it
- Multi-source resolver: tries multiple APIs with automatic fallback for reliable results

**Available on:**
- Chrome: https://chrome.google.com/webstore/detail/ibid
- Edge: https://microsoftedge.microsoft.com/addons/detail/ibid
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/ibid
- Website: https://ibid.tools
- GitHub: https://github.com/oriclabs/ibid

I'd love feedback from actual researchers and students. What citation styles do you use most? What features are missing from your current tool?

---

## r/ChromeExtensions, r/firefox, r/MicrosoftEdge

**Title:** Ibid — privacy-first citation manager powered by Rust/WASM (Chrome, Edge, Firefox)

**Body:**

Just released Ibid, a citation manager extension that processes everything locally using WebAssembly.

- One-click cite any webpage with accurate APA, MLA, Chicago, Harvard, IEEE formatting
- 2,600+ official CSL styles supported via Hayagriva (Typst's citation engine)
- PDF metadata extraction via Rust/WASM — reads DOI, authors, title from PDF text
- Multi-source resolver: tries multiple academic APIs for reliable metadata
- Library management in the side panel with inline preview
- Import/export BibTeX, RIS, CSL-JSON
- No account, no servers, no tracking

Built with Rust/WASM core + Tailwind CSS + vanilla JS. Minimal permissions with optional scholarly API access.

- Chrome: https://chrome.google.com/webstore/detail/ibid
- Edge: https://microsoftedge.microsoft.com/addons/detail/ibid
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/ibid
- GitHub: https://github.com/oriclabs/ibid

---

## r/webdev, r/rust

**Title:** Built a browser extension with Rust/WASM — citation manager using Hayagriva for CSL rendering + pdf-extract for PDF text extraction

**Body:**

Sharing a project where Rust compiled to WebAssembly powers the core engine of a browser extension (Chrome, Edge, Firefox).

**Tech stack:**
- **Rust/WASM** — Hayagriva (Typst's CSL processor) for citation rendering, pdf-extract for PDF text extraction, custom parsers for BibTeX/RIS/CSV/MEDLINE/EndNote XML
- **citationberg** — CSL XML parsing (also from the Typst project)
- **wasm-pack** — builds to `web` target, loaded as ES module in service worker
- **Tailwind CSS + vanilla JS** — no framework, no bundler
- **Chrome MV3 / Firefox MV3** — service worker, side panel/sidebar API, programmatic content script injection

**Challenges solved:**
- `wasm-unsafe-eval` CSP for WASM in MV3 extensions
- Embedding en-US locale (32KB) via `include_str!` for offline CSL term resolution
- Converting CSL-JSON items to Hayagriva's `Entry` type (different data models)
- Plain text output via `{:#}` Display format (avoids ANSI escape codes)
- PDF text extraction in WASM — `pdf-extract` crate compiled for `wasm32-unknown-unknown` with `getrandom` wasm_js feature
- Multi-source API resolver with per-host request queue and rate limiting
- Data-driven meta tag extraction (Highwire, Dublin Core, OpenGraph, PRISM, Eprints, COinS) — add new sources without touching extraction logic
- Generic DOM key-value extractor using XPath + TreeWalker with Unicode property escapes for invisible char stripping
- Optional host permissions for CORS-restricted scholarly APIs (arXiv, Semantic Scholar)
- Cross-browser manifest generation (Chrome → Firefox: service_worker→scripts, side_panel→sidebar_action)

WASM binary is 2.8MB (Hayagriva + pdf-extract + parsers + serializers + locale).

- GitHub: https://github.com/oriclabs/ibid
- Chrome: https://chrome.google.com/webstore/detail/ibid
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/ibid
