# X (Twitter) Launch Posts

---

## Launch tweet

Just shipped Ibid — a privacy-first citation manager for Chrome, Edge & Firefox.

One click → accurate citations in APA, MLA, Chicago, Harvard, IEEE & 2,600+ styles.

Powered by Rust/WASM. No servers. No accounts. No tracking.

From Latin "ibidem" — in the same place.

Chrome: https://chrome.google.com/webstore/detail/ibid
Edge: https://microsoftedge.microsoft.com/addons/detail/ibid
Firefox: https://addons.mozilla.org/en-US/firefox/addon/ibid

---

## Thread (technical)

1/ Built a citation manager browser extension using Rust compiled to WebAssembly. Available on Chrome, Edge, and Firefox.

The citation engine is Hayagriva (from the @typstapp team) — the same CSL processor that powers Typst. Supports 2,600+ official citation styles.

2/ Tech decisions:
- Rust/WASM for citation rendering + PDF text extraction + BibTeX/RIS parsing
- No React, no bundler — vanilla JS + Tailwind CSS
- Chrome/Firefox MV3 with minimal + optional permissions
- All processing local, zero telemetry

3/ The resolver tries multiple sources with automatic fallback:
- DOI → OpenAlex → CrossRef
- ISBN → Open Library → Google Books
- arXiv → abstract page → Semantic Scholar
- Any URL → Wikipedia's Citoid service
- No DOI? → title-based search on OpenAlex

4/ PDF extraction is all Rust/WASM:
- pdf-extract crate for text extraction
- XMP metadata parsing for DOI, journal, volume
- DOI from URL patterns (Nature, Springer, Wiley, T&F, arXiv)
- DOI from filename (10.1038_s41586-024-07386-0.pdf)

5/ Data-driven architecture:
- META_SOURCES: all meta tag standards in one structure
- DOM_KEYWORDS: field extraction keywords per source type
- URL_DOI_PATTERNS: publisher URL patterns for DOI extraction
- Add new sources/keywords without touching extraction logic

6/ The name: Ibid — from Latin "ibidem," meaning "in the same place."

Chrome: https://chrome.google.com/webstore/detail/ibid
Edge: https://microsoftedge.microsoft.com/addons/detail/ibid
Firefox: https://addons.mozilla.org/en-US/firefox/addon/ibid
Source: https://github.com/oriclabs/ibid

---

## Short post (academic audience)

Tired of citation extensions that get APA wrong or send your data to external servers?

Built Ibid — processes everything locally via WebAssembly. 2,600+ CSL styles. PDF metadata extraction. Multi-source DOI resolution. No account needed.

Chrome, Edge & Firefox.

https://ibid.tools

---

## Short post (developer audience)

Browser extension using Rust/WASM for:
- Full CSL citation processor (Hayagriva)
- PDF text extraction (pdf-extract)
- BibTeX/RIS/CSV parsers

2.8MB WASM binary. No bundler. No framework. Minimal permissions. Chrome + Edge + Firefox.

https://github.com/oriclabs/ibid
