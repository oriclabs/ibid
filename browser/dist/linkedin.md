# LinkedIn Launch Posts

---

## Main announcement

**Introducing Ibid — A Privacy-First Citation Manager for Chrome, Edge & Firefox**

I'm excited to share Ibid, a citation manager browser extension built for students, researchers, and academics who need accurate references without compromising their privacy.

The name comes from Latin "ibidem" — meaning "in the same place" — the standard abbreviation used in academic citations to refer to a previously cited source.

**What makes it different:**

Every citation tool I tried either got the formatting wrong, sent my browsing data to external servers, or locked basic features behind a paywall. Ibid solves all three:

- All citation processing runs locally in your browser via WebAssembly — no data leaves your device
- Powered by Hayagriva, the same CSL engine that powers Typst, supporting 2,600+ official citation styles
- Completely free, no account required, no tracking

**Key features:**

- One-click citations from any webpage — metadata auto-extracted from academic publishers, news sites, and more
- 74 citation styles bundled offline: APA, MLA, Chicago, Harvard, and IEEE plus dozens more
- 2,600+ additional styles downloadable on demand from the official CSL repository
- Multi-source resolver: DOI, ISBN, PMID, arXiv, and URL auto-lookup with automatic fallback across multiple academic APIs
- PDF metadata extraction via Rust/WASM — reads DOI, authors, and title directly from PDF text and document properties
- Title-based search when no identifier is found — works even for PDFs without DOIs
- Full library management with projects, tags, search, inline preview, and bulk operations
- Import and export in common academic formats (BibTeX, RIS, CSL-JSON, and more)
- Optional scholarly API access for enhanced metadata from arXiv and other sources — you choose whether to enable it

**Technical foundation:**

The core engine is written in Rust and compiled to WebAssembly, using the Hayagriva library from the Typst project for CSL rendering, the pdf-extract crate for PDF text extraction, and citationberg for style parsing. The WASM binary (2.8MB) includes a full CSL processor, PDF text extractor, format parsers, and an embedded English locale — all running locally in your browser.

The metadata extraction uses a data-driven architecture: meta tag sources, DOM keywords, and URL patterns are defined as structured data, making it easy to extend support for new sites and standards without changing the extraction logic.

**Available on all major browsers:**
- Chrome: https://chrome.google.com/webstore/detail/ibid
- Edge: https://microsoftedge.microsoft.com/addons/detail/ibid
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/ibid
- Website: https://ibid.tools
- GitHub: https://github.com/oriclabs/ibid

I'd love to hear from researchers and students — what's your biggest frustration with current citation tools?

#AcademicWriting #Research #Citations #BrowserExtension #Rust #WebAssembly #OpenSource #PhD #GradSchool

---

## Short post (for feed)

Built something for the academic community: Ibid, a citation manager that runs entirely in your browser.

No servers. No accounts. No tracking. Just accurate citations in 2,600+ styles.

Now available on Chrome, Edge, and Firefox.

From Latin "ibidem" — in the same place.

Powered by Rust/WebAssembly. Free and open source.

https://ibid.tools

#Research #AcademicWriting #Citations #Privacy

---

## Technical post (for developer audience)

Shipped a browser extension (Chrome, Edge, Firefox) with a Rust/WebAssembly core engine for citation processing and PDF text extraction.

Tech stack:
- Hayagriva (Typst's CSL processor) compiled to WASM
- pdf-extract crate for PDF text extraction in WASM
- citationberg for CSL XML parsing
- wasm-pack targeting web
- Tailwind CSS + vanilla JS (no framework, no bundler)
- Chrome/Firefox Manifest V3 with optional host permissions

The 2.8MB WASM binary includes a full CSL processor, PDF text extractor, BibTeX/RIS/CSV parsers, and an embedded en-US locale for offline citation term resolution.

Architecture highlights:
- Data-driven meta tag extraction (Highwire, Dublin Core, OpenGraph, PRISM, Eprints, COinS)
- Generic DOM key-value extractor with XPath + TreeWalker and Unicode property escapes
- Multi-source API resolver with per-host request queue and rate limiting
- Cross-browser manifest generation script (Chrome → Firefox)
- Optional host permissions for CORS-restricted scholarly APIs

- Chrome: https://chrome.google.com/webstore/detail/ibid
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/ibid
- GitHub: https://github.com/oriclabs/ibid

#Rust #WebAssembly #BrowserExtension #OpenSource
