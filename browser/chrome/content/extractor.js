// Ibid — Content Script: Metadata Extractor
// Extracts citation metadata from the current page using structured data

// Guard against double-injection
if (window.__ibidExtractorLoaded) { /* already loaded */ } else {
window.__ibidExtractorLoaded = true;

(() => {
  'use strict';

  // -------------------------------------------------------------------------
  // Metadata extraction
  // -------------------------------------------------------------------------

  function extractMetadata() {
    const meta = {
      type: 'webpage',
      title: null,
      author: [],
      issued: null,
      accessed: null,
      'container-title': null,
      publisher: null,
      URL: window.location.href,
      DOI: null,
      abstract: null,
      language: document.documentElement.lang || null,
    };

    // 1. JSON-LD (Schema.org)
    extractJsonLd(meta);

    // 2. Meta tags — Highwire, Dublin Core, OpenGraph, Standard (data-driven)
    extractMetaTags(meta);

    // 6. Site-specific extractors
    extractSiteSpecific(meta);

    // 6b. Generic type detection from page signals (works on any site)
    detectTypeFromSignals(meta);

    // 7. Heuristic fallbacks
    extractHeuristic(meta);

    // 8. Smart NER-based author/date detection (local, no API)
    extractWithNER(meta);

    // 9. Clean title — strip site name suffix using generic heuristic
    if (meta.title) {
      const siteName = document.querySelector('meta[property="og:site_name"]')?.content;
      if (siteName) {
        // Remove " - SiteName", " | SiteName", " : SiteName" from end
        const escaped = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        meta.title = meta.title.replace(new RegExp('\\s*[-–—|:]\\s*' + escaped + '\\s*$', 'i'), '').trim();
      }
      // Remove trailing " : Author : domain : Category" chains (3+ colon-separated segments at end)
      meta.title = meta.title.replace(/(?:\s*:\s*[^:]{1,50}){2,}\s*$/, (match) => {
        // Only strip if the last segment looks like a domain or generic category
        return /\.\w{2,}|books|articles|blog/i.test(match) ? '' : match;
      }).trim();
    }

    // 10. Build accessed date
    const now = new Date();
    meta.accessed = {
      'date-parts': [[now.getFullYear(), now.getMonth() + 1, now.getDate()]],
    };

    return meta;
  }

  // -------------------------------------------------------------------------
  // JSON-LD
  // -------------------------------------------------------------------------

  function extractJsonLd(meta) {
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    for (const script of scripts) {
      try {
        let data = JSON.parse(script.textContent);
        if (Array.isArray(data)) data = data[0];
        if (data['@graph']) data = data['@graph'][0];

        const type = data['@type'];
        if (
          type === 'ScholarlyArticle' ||
          type === 'Article' ||
          type === 'NewsArticle' ||
          type === 'BlogPosting' ||
          type === 'WebPage'
        ) {
          meta.title = meta.title || data.headline || data.name;
          meta['container-title'] =
            meta['container-title'] ||
            data.publisher?.name ||
            data.isPartOf?.name;
          meta.DOI = meta.DOI || data.sameAs?.match?.(/10\.\d{4,}/)?.[0];

          if (data.datePublished) {
            meta.issued = meta.issued || parseDate(data.datePublished);
          }

          if (data.author) {
            const authors = Array.isArray(data.author)
              ? data.author
              : [data.author];
            for (const a of authors) {
              if (typeof a === 'string') {
                meta.author.push(parseName(a));
              } else if (a.name) {
                meta.author.push(parseName(a.name));
              } else if (a.givenName || a.familyName) {
                meta.author.push({
                  given: a.givenName || null,
                  family: a.familyName || null,
                });
              }
            }
          }

          if (data.description) {
            meta.abstract = meta.abstract || data.description;
          }

          // Detect source type from schema type
          if (type === 'ScholarlyArticle') meta.type = 'article-journal';
          else if (type === 'NewsArticle') meta.type = 'article-newspaper';
          else if (type === 'BlogPosting') meta.type = 'post-weblog';
        }
      } catch (e) {
        // Ignore malformed JSON-LD
      }
    }
  }

  // -------------------------------------------------------------------------
  // Meta tag sources — data-driven lookup table
  // -------------------------------------------------------------------------
  // To add/update meta tag sources: edit this structure, no extraction logic changes needed.
  //
  // Each entry: { tags: [...], attr?, mode?, transform?, override? }
  //   tags:      meta tag names to try (first match wins)
  //   attr:      'property' for og/article tags, default is 'name'
  //   mode:      'all' to collect all matching tags (e.g. multiple authors)
  //   transform: function(value) to convert raw value before assignment
  //   override:  true to overwrite existing value (e.g. Highwire journal > og:site_name)

  const META_SOURCES = {
    // --- Highwire Press (Google Scholar compatible) — highest priority for academic ---
    highwire: {
      title:              { tags: ['citation_title'] },
      author:             { tags: ['citation_author'], mode: 'all' },
      DOI:                { tags: ['citation_doi'], transform: cleanDoi },
      'container-title':  { tags: ['citation_journal_title', 'citation_conference_title'], override: true },
      publisher:          { tags: ['citation_publisher'] },
      issued:             { tags: ['citation_publication_date', 'citation_date'], transform: parseDate },
      volume:             { tags: ['citation_volume'] },
      issue:              { tags: ['citation_issue'] },
      _firstPage:         { tags: ['citation_firstpage'] },
      _lastPage:          { tags: ['citation_lastpage'] },
      ISBN:               { tags: ['citation_isbn'] },
      ISSN:               { tags: ['citation_issn'] },
      _pdfUrl:            { tags: ['citation_pdf_url'] },
      _type:              { tags: ['citation_title'], transform: () => 'article-journal' },
    },

    // --- Dublin Core ---
    dublinCore: {
      title:              { tags: ['DC.title', 'dc.title'] },
      author:             { tags: ['DC.creator', 'dc.creator', 'DC.Creator'], mode: 'all' },
      issued:             { tags: ['DC.date', 'dc.date'], transform: parseDate },
      publisher:          { tags: ['DC.publisher', 'dc.publisher'] },
      abstract:           { tags: ['DC.description', 'dc.description'] },
      DOI:                { tags: ['DC.identifier', 'dc.identifier'], transform: (v) => { const m = v.match(/^10\.\d{4,}\/.+/); return m ? m[0] : null; } },
      _dcType:            { tags: ['DC.type', 'dc.type'] },
    },

    // --- OpenGraph ---
    openGraph: {
      title:              { tags: ['og:title'], attr: 'property' },
      'container-title':  { tags: ['og:site_name'], attr: 'property' },
      abstract:           { tags: ['og:description'], attr: 'property' },
      issued:             { tags: ['article:published_time', 'article:published'], attr: 'property', transform: parseDate },
      author:             { tags: ['article:author', 'article:author:name'], attr: 'property' },
      _ogType:            { tags: ['og:type'], attr: 'property' },
    },

    // --- PRISM (Publisher Requirements for Industry Standard Metadata) ---
    // Used by Elsevier, Wiley, Springer, Taylor & Francis
    prism: {
      'container-title':  { tags: ['prism.publicationName'] },
      volume:             { tags: ['prism.volume'] },
      issue:              { tags: ['prism.number', 'prism.issueIdentifier'] },
      _prismStartPage:    { tags: ['prism.startingPage'] },
      _prismEndPage:      { tags: ['prism.endingPage'] },
      ISSN:               { tags: ['prism.issn', 'prism.eIssn'] },
      DOI:                { tags: ['prism.doi'], transform: cleanDoi },
      issued:             { tags: ['prism.publicationDate', 'prism.coverDate'], transform: parseDate },
    },

    // --- Eprints (Institutional repositories: DSpace, EPrints, etc.) ---
    eprints: {
      title:              { tags: ['eprints.title'] },
      author:             { tags: ['eprints.creators_name'], mode: 'all' },
      abstract:           { tags: ['eprints.abstract'] },
      issued:             { tags: ['eprints.date'], transform: parseDate },
      publisher:          { tags: ['eprints.publisher'] },
      'container-title':  { tags: ['eprints.publication'] },
      _eprintsType:       { tags: ['eprints.type'] },
    },

    // --- BIBO (Bibliographic Ontology) — some academic sites ---
    bibo: {
      volume:             { tags: ['bibo.volume'] },
      issue:              { tags: ['bibo.issue'] },
      page:               { tags: ['bibo.pages', 'bibo.pageStart'] },
      DOI:                { tags: ['bibo.doi'], transform: cleanDoi },
    },

    // --- Standard HTML meta (lowest priority) ---
    standard: {
      title:              { tags: ['_document_title'] }, // special: uses document.title
      abstract:           { tags: ['description'] },
      author:             { tags: ['author'] },
      issued:             { tags: ['date', 'pubdate'], transform: parseDate },
    },
  };

  // Generic sites to exclude from container-title (og:site_name)
  const GENERIC_SITE_NAMES = /^(Google|Google Drive|Google Docs|Facebook|Twitter|X|YouTube|LinkedIn|Reddit|Medium|Wikipedia|GitHub|Instagram|TikTok|Pinterest|Dropbox|OneDrive)$/i;

  // Dublin Core type → CSL type mapping
  const DC_TYPE_MAP = {
    journalarticle: 'article-journal',
    reviewarticle: 'article-journal',
    researcharticle: 'article-journal',
    article: 'article-journal',
    conferencepaper: 'paper-conference',
    bookchapter: 'chapter',
    chapter: 'chapter',
    thesis: 'thesis',
    dissertation: 'thesis',
    report: 'report',
    technicalreport: 'report',
    book: 'book',
    newsarticle: 'article-newspaper',
    blogpost: 'post-weblog',
    dataset: 'dataset',
    patent: 'patent',
    legislation: 'legislation',
  };

  // -------------------------------------------------------------------------
  // Meta tag extraction engine
  // -------------------------------------------------------------------------

  function extractMetaTags(meta) {
    for (const [sourceName, fields] of Object.entries(META_SOURCES)) {
      for (const [field, config] of Object.entries(fields)) {
        // Skip internal fields (prefixed with _) during normal assignment
        const isInternal = field.startsWith('_');

        // Resolve raw value from tags
        let raw = null;
        const attrType = config.attr || 'name';

        if (config.mode === 'all') {
          // Collect all matching tags (e.g. multiple citation_author)
          const values = [];
          for (const tag of config.tags) {
            const els = document.querySelectorAll(`meta[${attrType}="${tag}"]`);
            for (const el of els) {
              const content = el.getAttribute('content')?.trim();
              if (content) values.push(content);
            }
          }
          if (values.length === 0) continue;

          // For author fields: Highwire with multiple authors overrides single-author from JSON-LD
          if (field === 'author' && meta.author.length >= values.length) continue;
          meta.author = values.map(n => parseName(n));
          continue;
        }

        // Single value mode
        for (const tag of config.tags) {
          if (tag === '_document_title') {
            raw = document.title || null;
          } else {
            raw = getMeta(tag, attrType);
          }
          if (raw) break;
        }
        if (!raw) continue;

        // Apply transform
        const value = config.transform ? config.transform(raw) : raw;
        if (!value) continue;

        // Handle special internal fields
        if (isInternal) {
          if (field === '_type' && meta.type === 'webpage') meta.type = value;
          if (field === '_dcType' || field === '_eprintsType') {
            const mapped = DC_TYPE_MAP[raw.toLowerCase().replace(/[\s-]/g, '')];
            if (mapped) meta.type = mapped;
          }
          if (field === '_ogType' && raw === 'article' && meta.type === 'webpage') meta.type = 'article';
          if (field === '_firstPage' || field === '_lastPage' || field === '_pdfUrl' ||
              field === '_prismStartPage' || field === '_prismEndPage') {
            meta[field] = value;
          }
          continue;
        }

        // Special handling for container-title from og:site_name
        if (field === 'container-title' && sourceName === 'openGraph') {
          if (GENERIC_SITE_NAMES.test(raw)) continue;
          if (meta['container-title']) continue; // don't overwrite
        }

        // Assign: override mode or fill-if-empty
        if (field === 'author') {
          if (meta.author.length === 0) meta.author.push(parseName(value));
        } else if (field === 'issued') {
          if (!meta.issued) meta.issued = value;
        } else if (config.override) {
          meta[field] = value;
        } else {
          meta[field] = meta[field] || value;
        }
      }
    }

    // Compose page from firstPage/lastPage (Highwire or PRISM)
    const fp = meta._firstPage || meta._prismStartPage;
    const lp = meta._lastPage || meta._prismEndPage;
    if (!meta.page && fp) {
      meta.page = lp ? `${fp}-${lp}` : fp;
    }
    delete meta._firstPage;
    delete meta._lastPage;
    delete meta._prismStartPage;
    delete meta._prismEndPage;

    // --- COinS (OpenURL) — Wikipedia, library catalogs ---
    // <span class="Z3988" title="ctx_ver=Z39.88-2004&rft.atitle=...">
    const coins = document.querySelector('span.Z3988[title*="ctx_ver"]');
    if (coins) {
      const params = new URLSearchParams(coins.getAttribute('title'));
      meta.title = meta.title || params.get('rft.atitle') || params.get('rft.btitle') || params.get('rft.title');
      meta['container-title'] = meta['container-title'] || params.get('rft.jtitle') || params.get('rft.stitle');
      if (!meta.author?.length) {
        // COinS: rft.au, rft.aulast/rft.aufirst
        const au = params.get('rft.au');
        const aulast = params.get('rft.aulast');
        const aufirst = params.get('rft.aufirst');
        if (au) meta.author.push(parseName(au));
        else if (aulast) meta.author.push({ family: aulast, given: aufirst || '' });
      }
      if (!meta.issued) {
        const date = params.get('rft.date');
        if (date) meta.issued = parseDate(date);
      }
      meta.volume = meta.volume || params.get('rft.volume');
      meta.issue = meta.issue || params.get('rft.issue');
      meta.page = meta.page || params.get('rft.pages') || params.get('rft.spage');
      meta.ISBN = meta.ISBN || params.get('rft.isbn');
      meta.ISSN = meta.ISSN || params.get('rft.issn');
      meta.publisher = meta.publisher || params.get('rft.pub');
      const genre = params.get('rft.genre');
      if (genre && meta.type === 'webpage') {
        const genreMap = { article: 'article-journal', book: 'book', bookitem: 'chapter',
          conference: 'paper-conference', proceeding: 'paper-conference', report: 'report' };
        if (genreMap[genre]) meta.type = genreMap[genre];
      }
    }
  }

  // -------------------------------------------------------------------------
  // Heuristic fallback
  // -------------------------------------------------------------------------

  function extractHeuristic(meta) {
    // Title from h1 if not yet found
    if (!meta.title) {
      const h1 = document.querySelector('h1');
      if (h1) meta.title = h1.textContent.trim();
    }

    // Author from common selectors
    if (meta.author.length === 0) {
      const authorSelectors = [
        '[rel="author"]',
        '.author-name',
        '.byline__name',
        '.author',
        '[itemprop="author"]',
        '.post-author',
        '.article-author',
      ];
      for (const sel of authorSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.textContent.trim();
          if (text && text.length < 100) {
            meta.author.push(parseName(text));
            break;
          }
        }
      }
    }

    // Date from <time> element
    if (!meta.issued) {
      const timeEl = document.querySelector(
        'time[datetime], time[pubdate]'
      );
      if (timeEl) {
        const dt = timeEl.getAttribute('datetime') || timeEl.textContent;
        meta.issued = parseDate(dt);
      }
    }

    // DOI from page content (first match) — only on likely academic pages
    if (!meta.DOI) {
      const host = window.location.hostname.toLowerCase();
      const nonAcademic = /(youtube\.com|facebook\.com|twitter\.com|instagram\.com|linkedin\.com|reddit\.com|github\.com|stackoverflow\.com|medium\.com|amazon\.com|ebay\.com)/;
      const isGoogleNonBooks = host.includes('google.') && !host.includes('books.google') && !host.includes('scholar.google');
      if (!nonAcademic.test(host) && !isGoogleNonBooks) {
        const doiMatch = document.body?.textContent?.match(
          /\b(10\.\d{4,}\/[^\s<>"{}|\\^~\[\]`]+)/
        );
        if (doiMatch) meta.DOI = cleanDoi(doiMatch[1]);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Generic type detection from page signals
  // -------------------------------------------------------------------------

  function detectTypeFromSignals(meta) {
    console.log('[Ibid v3] detectTypeFromSignals called, current type:', meta.type);

    const pageText = (document.body?.textContent || '').substring(0, 5000).toLowerCase();
    const url = window.location.href.toLowerCase();

    // --- Type detection (only if not already set) ---
    if (meta.type === 'webpage') {
      const ogType = getMeta('og:type', 'property');
      if (ogType === 'book' || ogType === 'books.book') meta.type = 'book';
      else if (ogType === 'video.movie' || ogType === 'video.other') meta.type = 'motion_picture';
      else if (ogType === 'music.song') meta.type = 'song';

      const isbnMeta = getMeta('book:isbn') || getMeta('isbn') || getMeta('citation_isbn');
      if (isbnMeta) { meta.type = 'book'; meta.ISBN = meta.ISBN || isbnMeta; }

      const isbnInPage = pageText.match(/isbn[\s:-]*(97[89][\s-]?\d[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d)/i);
      if (isbnInPage) { meta.type = 'book'; if (!meta.ISBN) meta.ISBN = isbnInPage[1].replace(/[\s-]/g, ''); }

      const isbn10InPage = pageText.match(/isbn[\s:-]*(\d{9}[\dxX])/i);
      if (isbn10InPage && meta.type === 'webpage') { meta.type = 'book'; if (!meta.ISBN) meta.ISBN = isbn10InPage[1]; }

      if (url.includes('/book/') || url.includes('/books/') || url.includes('/isbn/') || url.includes('/works/')) meta.type = 'book';
      if (url.includes('/thesis') || url.includes('/dissertation') || url.includes('/etd/')) meta.type = 'thesis';
      if (url.includes('/patent/') || url.includes('patents.')) meta.type = 'patent';

      const hasBookKeywords = /\b(hardcover|paperback|kindle|print length|pages)\b/i.test(pageText);
      const hasBookIds = /\b(publisher|asin|isbn)\b/i.test(pageText);
      if (hasBookKeywords && hasBookIds) meta.type = 'book';
    }

    // --- DOM key-value extraction (last resort, fills gaps for any type) ---
    const strip = (s) => (s || '').replace(/[\u200e\u200f\u200b-\u200d\u2060\ufeff]/g, '').trim();

    const v = (key) => {
      const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'META', 'LINK', 'TITLE']);
      // Find the smallest element whose own text contains the key (case-insensitive)
      const lk = key.toLowerCase();
      const xpath = `//*[text()[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "${lk}")]]`;
      const results = document.evaluate(xpath, document.body, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      let best = null, bestLen = Infinity;
      for (let i = 0; i < results.snapshotLength; i++) {
        const node = results.snapshotItem(i);
        if (skip.has(node.tagName)) continue;
        const text = strip(node.textContent);
        if (text.length < key.length + 30 && text.length < bestLen) {
          best = node; bestLen = text.length;
        }
      }
      if (!best) return null;

      // Helper: extract short text value from an element (direct text nodes preferred)
      const getText = (el) => {
        if (!el || skip.has(el.tagName)) return null;
        const t = strip(el.textContent);
        // Skip if empty, too long, or contains the key itself
        if (!t || t.length > 200 || t.toLowerCase().includes(key.toLowerCase())) return null;
        return t;
      };

      // Walk outward from the key element: self → parent → grandparent → ...
      // At each level, check siblings that come AFTER the key-containing element
      let anchor = best;
      for (let depth = 0; depth < 4; depth++) {
        // 1. Next sibling elements of the anchor
        let sib = anchor.nextElementSibling;
        while (sib) {
          const val = getText(sib);
          if (val) return val;
          // Check first-level children of the sibling
          for (const child of sib.children) {
            const cv = getText(child);
            if (cv) return cv;
          }
          sib = sib.nextElementSibling;
        }

        // 2. Adjacent text node after the anchor
        let next = anchor.nextSibling;
        while (next && next.nodeType !== 3 && next.nodeType !== 1) next = next.nextSibling;
        if (next?.nodeType === 3) {
          const t = strip(next.textContent);
          if (t.length > 0 && t.length < 200) return t;
        }

        // Walk up one level
        const parent = anchor.parentElement;
        if (!parent || parent === document.body) break;
        anchor = parent;
      }

      return null;
    };

    // --- DOM keyword lookup table ---
    // To add/update keywords: edit this structure, no need to touch extraction logic.
    // Each field: { keys: [...], validate?, transform? }
    //   validate(val): return true to accept the raw value
    //   transform(val, meta): return the value to assign (or mutate meta directly)
    const DOM_KEYWORDS = {
      book: {
        publisher:          { keys: ['Publisher', 'Published by', 'Imprint', 'Publishing House'] },
        issued:             { keys: ['Publication date', 'Published', 'Date published', 'Publish date', 'Release date', 'First published'],
                              transform: (val) => parseDate(val) },
        language:           { keys: ['Language'] },
        ISBN:               { keys: ['ISBN-13', 'ISBN 13', 'EAN', 'ISBN-10', 'ISBN 10', 'ISBN'],
                              transform: (val) => {
                                const clean = val.replace(/[\s-]/g, '');
                                return (clean.match(/97[89]\d{10}/) || clean.match(/\d{9}[\dXx]/) || [])[0] || null;
                              }},
        _asin:              { keys: ['ASIN'],
                              transform: (val) => (val.match(/[A-Z0-9]{10}/i) || [])[0] || null },
        'number-of-pages':  { keys: ['Print length', 'Pages', 'Page count', 'Number of pages'],
                              transform: (val) => (val.match(/(\d+)/) || [])[1] || null },
        edition:            { keys: ['Edition', 'Printing'] },
        'collection-title': { keys: ['Series', 'Book series'] },
        author:             { keys: ['Author', 'Authors', 'Written by', 'By'],
                              transform: (val) => val.split(/\s*[,;]\s*|\s+and\s+/i).map(n => parseName(n.trim())).filter(n => n.family || n.literal),
                              check: (meta) => !meta.author?.length },
        editor:             { keys: ['Editor', 'Editors', 'Edited by'],
                              transform: (val) => val.split(/\s*[,;]\s*|\s+and\s+/i).map(n => parseName(n.trim())).filter(n => n.family || n.literal) },
      },
      'article-journal': {
        'container-title':  { keys: ['Journal', 'Publication', 'Published in'] },
        volume:             { keys: ['Volume', 'Vol'],
                              validate: (val) => /^\d{1,4}$/.test(val.trim()),
                              transform: (val) => val.trim() },
        issue:              { keys: ['Issue', 'Number', 'No'],
                              validate: (val) => /^\d{1,4}$/.test(val.trim()),
                              transform: (val) => val.trim() },
        page:               { keys: ['Pages', 'Page range'],
                              validate: (val) => /^[\d\s,–—-]+$/.test(val.trim()),
                              transform: (val) => val.trim() },
      },
      thesis: {
        publisher:          { keys: ['University', 'Institution', 'School'] },
        genre:              { keys: ['Degree', 'Department'] },
      },
      _common: {
        publisher:          { keys: ['Publisher', 'Published by', 'Organization'] },
        issued:             { keys: ['Date', 'Published', 'Publication date', 'Year'],
                              transform: (val) => parseDate(val) },
      },
    };

    // --- Generic DOM extraction using keyword table ---
    const typeKeywords = DOM_KEYWORDS[meta.type] || {};
    const commonKeywords = DOM_KEYWORDS._common || {};

    for (const [field, config] of Object.entries(typeKeywords)) {
      // Check if field already has a value (custom check or default)
      if (config.check ? !config.check(meta) : meta[field]) continue;
      for (const key of config.keys) {
        const raw = v(key);
        if (!raw) continue;
        if (config.validate && !config.validate(raw)) continue;
        meta[field] = config.transform ? config.transform(raw, meta) : raw;
        if (meta[field]) break;
      }
    }

    // Common fields — fill remaining gaps for any type
    for (const [field, config] of Object.entries(commonKeywords)) {
      if (meta[field]) continue;
      for (const key of config.keys) {
        const raw = v(key);
        if (!raw) continue;
        if (config.validate && !config.validate(raw)) continue;
        meta[field] = config.transform ? config.transform(raw, meta) : raw;
        if (meta[field]) break;
      }
    }
  }

  // Site-specific extractors
  // -------------------------------------------------------------------------

  function extractSiteSpecific(meta) {
    const host = window.location.hostname.toLowerCase();
    const url = window.location.href;

    // --- Type detection from known academic/book hosts (no content parsing) ---
    const academicHosts = [
      'scholar.google', 'researchgate.net', 'scopus.com', 'pubmed.ncbi.nlm.nih.gov',
      'semanticscholar.org', 'jstor.org', 'ieeexplore.ieee.org', 'sciencedirect.com',
      'link.springer.com', 'onlinelibrary.wiley.com', 'tandfonline.com',
    ];
    if (meta.type === 'webpage' && academicHosts.some(h => host.includes(h))) {
      meta.type = 'article-journal';
    }
    if (host.includes('ssrn.com') && meta.type === 'webpage') meta.type = 'report';
    if (host.includes('arxiv.org') && meta.type === 'webpage') meta.type = 'article';
    if (host.includes('amazon.') && meta.type === 'webpage') meta.type = 'book';
    if ((host.includes('openlibrary.org') || host.includes('isbnsearch.org') ||
         host.includes('worldcat.org') || host.includes('goodreads.com') ||
         host.includes('books.google')) && meta.type === 'webpage') {
      meta.type = 'book';
    }

    // Generic academic journal hosting patterns — auto-detect as journal article
    // Covers: ASM journals, ACS pubs, Oxford Academic, Cambridge UP, SAGE, BMJ, Frontiers, MDPI, etc.
    if (meta.type === 'webpage') {
      const journalHostPattern = /\b(journals\.|journal\.|asm\.org|acs\.org|pubs\.acs|academic\.oup|cambridge\.org\/core|sagepub\.com|bmj\.com|frontiersin\.org|mdpi\.com|plos\.org|biomedcentral\.com|nature\.com|cell\.com|thelancet\.com|nejm\.org|annualreviews\.org|karger\.com|degruyter\.com|emerald\.com|ingentaconnect|muse\.jhu\.edu|projecteuclid|iopscience\.iop|royalsocietypublishing|pnas\.org|science\.org|aaas\.org)\b/;
      if (journalHostPattern.test(host)) {
        meta.type = 'article-journal';
      }
    }

    // Also detect journal from URL containing /doi/ path
    if (meta.type === 'webpage' && /\/doi\/(abs\/|full\/|pdf\/)?10\.\d{4,}/.test(url)) {
      meta.type = 'article-journal';
    }

    // News sites — set type to newspaper
    if (/\b(nytimes|washingtonpost|theguardian|bbc\.com\/news|reuters|apnews|cnn\.com)\b/.test(host)) {
      if (meta.type === 'webpage' || meta.type === 'article') meta.type = 'article-newspaper';
    }
  }

  // -------------------------------------------------------------------------
  // Smart NER-based detection (local, no API)
  // -------------------------------------------------------------------------

  function extractWithNER(meta) {
    // Only run if author is still missing
    if (meta.author.length > 0) return;

    // Try to find author from visible page text using patterns
    const bodyText = document.body?.innerText || '';
    if (!bodyText || bodyText.length < 50) return;

    // Look for "By FirstName LastName" patterns in first 2000 chars
    const headerText = bodyText.slice(0, 2000);

    // Pattern: "By Name" or "Written by Name" or "Author: Name"
    const bylinePatterns = [
      /\b(?:By|Written by|Author|Authors?:)\s+([A-Z][a-z]+ (?:[A-Z]\.?\s+)?[A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+ (?:[A-Z]\.?\s+)?[A-Z][a-z]+)?)/g,
      /\b(?:By|Written by)\s+([A-Z][a-z]+ [A-Z][a-z]+(?:\s*(?:,|and)\s*[A-Z][a-z]+ [A-Z][a-z]+)*)/g,
    ];

    for (const pattern of bylinePatterns) {
      const match = pattern.exec(headerText);
      if (match) {
        const names = match[1].split(/\s*(?:,\s*and|,|and)\s*/);
        for (const name of names) {
          const trimmed = name.trim();
          if (trimmed && trimmed.split(/\s+/).length >= 2 && trimmed.length < 40) {
            meta.author.push(parseName(trimmed));
          }
        }
        if (meta.author.length > 0) break;
      }
    }

    // Smart date detection if still missing
    if (!meta.issued) {
      // Look for date patterns in first 3000 chars
      const dateText = bodyText.slice(0, 3000);

      // Pattern: "Published March 15, 2024" or "Posted on Jan 5, 2024"
      const datePatterns = [
        /(?:Published|Posted|Updated|Date|Modified)\s*:?\s*(\w+ \d{1,2},?\s+\d{4})/i,
        /(?:Published|Posted|Updated)\s+(?:on\s+)?(\d{1,2}\s+\w+\s+\d{4})/i,
        /(?:Published|Posted|Updated)\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+\d{4})/i,
        /(\d{4}-\d{2}-\d{2})T/,  // ISO date in text
      ];

      for (const pattern of datePatterns) {
        const match = dateText.match(pattern);
        if (match) {
          meta.issued = parseDate(match[1]);
          if (meta.issued) break;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  function cleanDoi(doi) {
    if (!doi) return null;
    // Remove query strings, fragments, trailing punctuation
    return doi
      .replace(/[?#].*$/, '')       // strip ?query and #fragment
      .replace(/[.,;:)\]}>]+$/, '') // strip trailing punctuation
      .replace(/\/+$/, '')          // strip trailing slashes
      .trim();
  }

  function getMeta(name, attr = 'name') {
    const el = document.querySelector(
      `meta[${attr}="${name}" i]`
    );
    return el ? el.getAttribute('content')?.trim() || null : null;
  }

  function parseName(str) {
    if (!str) return { literal: '' };
    str = str.trim()
      .replace(/^by\s+/i, '')
      .replace(/\s*\((Author|Editor|Contributor|Translator|Illustrator|Narrator|Creator|Compiler)\)\s*/gi, '')
      .replace(/\s*\(ed\.?\)\s*/gi, '')
      .replace(/\s*\(eds\.?\)\s*/gi, '')
      .trim();

    // "Last, First" format
    if (str.includes(',')) {
      const [family, given] = str.split(',', 2).map((s) => s.trim());
      return { family, given };
    }

    // "First Last" format
    const parts = str.split(/\s+/);
    if (parts.length === 1) {
      return { literal: parts[0] };
    }
    const family = parts.pop();
    const given = parts.join(' ');
    return { family, given };
  }

  function parseDate(str) {
    if (!str) return null;
    str = str.trim();

    // ISO 8601: 2023-05-15, 2023-05, 2023
    const isoMatch = str.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/);
    if (isoMatch) {
      const parts = [parseInt(isoMatch[1], 10)];
      if (isoMatch[2]) parts.push(parseInt(isoMatch[2], 10));
      if (isoMatch[3]) parts.push(parseInt(isoMatch[3], 10));
      return { 'date-parts': [parts] };
    }

    // Try Date.parse as fallback
    const ts = Date.parse(str);
    if (!isNaN(ts)) {
      const d = new Date(ts);
      return {
        'date-parts': [
          [d.getFullYear(), d.getMonth() + 1, d.getDate()],
        ],
      };
    }

    return { literal: str };
  }

  // -------------------------------------------------------------------------
  // Message listener
  // -------------------------------------------------------------------------

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractMetadata') {
      // On PDF pages, let pdf-extractor.js handle it
      if (document.contentType === 'application/pdf' ||
          window.location.href.toLowerCase().match(/\.pdf(\?|$)/)) {
        return false; // don't handle — pdf-extractor will respond
      }
      const metadata = extractMetadata();
      sendResponse({ metadata });
    } else if (message.action === 'saveQuote') {
      const metadata = extractMetadata();
      sendResponse({
        quote: {
          text: message.text,
          metadata,
          timestamp: new Date().toISOString(),
        },
      });
    }
    return true;
  });
})();
} // end double-injection guard
