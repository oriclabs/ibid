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

    // 2. Highwire Press tags (Google Scholar compatible)
    extractHighwire(meta);

    // 3. Dublin Core
    extractDublinCore(meta);

    // 4. OpenGraph
    extractOpenGraph(meta);

    // 5. Standard meta tags
    extractStandardMeta(meta);

    // 6. Site-specific extractors
    extractSiteSpecific(meta);

    // 6b. Generic type detection from page signals (works on any site)
    detectTypeFromSignals(meta);

    // 7. Heuristic fallbacks
    extractHeuristic(meta);

    // 8. Smart NER-based author/date detection (local, no API)
    extractWithNER(meta);

    // 9. Build accessed date
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
  // Highwire Press tags (citation_*)
  // -------------------------------------------------------------------------

  function extractHighwire(meta) {
    const title = getMeta('citation_title');
    if (title) {
      meta.title = meta.title || title;
      meta.type = 'article-journal'; // Highwire implies academic
    }

    const authors = document.querySelectorAll(
      'meta[name="citation_author"]'
    );
    if (authors.length && meta.author.length === 0) {
      for (const el of authors) {
        const name = el.getAttribute('content');
        if (name) meta.author.push(parseName(name));
      }
    }

    meta.DOI = meta.DOI || cleanDoi(getMeta('citation_doi'));
    meta['container-title'] =
      meta['container-title'] || getMeta('citation_journal_title');
    meta.publisher = meta.publisher || getMeta('citation_publisher');

    const date = getMeta('citation_publication_date') || getMeta('citation_date');
    if (date && !meta.issued) {
      meta.issued = parseDate(date);
    }

    const volume = getMeta('citation_volume');
    if (volume) meta.volume = volume;

    const issue = getMeta('citation_issue');
    if (issue) meta.issue = issue;

    const firstPage = getMeta('citation_firstpage');
    const lastPage = getMeta('citation_lastpage');
    if (firstPage) {
      meta.page = lastPage ? `${firstPage}-${lastPage}` : firstPage;
    }

    const isbn = getMeta('citation_isbn');
    if (isbn) meta.ISBN = isbn;

    const issn = getMeta('citation_issn');
    if (issn) meta.ISSN = issn;

    const pdfUrl = getMeta('citation_pdf_url');
    if (pdfUrl) meta._pdfUrl = pdfUrl;
  }

  // -------------------------------------------------------------------------
  // Dublin Core
  // -------------------------------------------------------------------------

  function extractDublinCore(meta) {
    meta.title =
      meta.title || getMeta('DC.title') || getMeta('dc.title');

    const creator =
      getMeta('DC.creator') ||
      getMeta('dc.creator') ||
      getMeta('DC.Creator');
    if (creator && meta.author.length === 0) {
      meta.author.push(parseName(creator));
    }

    const date = getMeta('DC.date') || getMeta('dc.date');
    if (date && !meta.issued) {
      meta.issued = parseDate(date);
    }

    meta.publisher =
      meta.publisher || getMeta('DC.publisher') || getMeta('dc.publisher');
    meta.abstract =
      meta.abstract || getMeta('DC.description') || getMeta('dc.description');

    const dcType = getMeta('DC.type') || getMeta('dc.type');
    if (dcType) {
      const typeMap = {
        journalarticle: 'article-journal',
        conferencepaper: 'paper-conference',
        bookchapter: 'chapter',
        thesis: 'thesis',
        report: 'report',
        book: 'book',
      };
      const mapped = typeMap[dcType.toLowerCase().replace(/[\s-]/g, '')];
      if (mapped) meta.type = mapped;
    }
  }

  // -------------------------------------------------------------------------
  // OpenGraph
  // -------------------------------------------------------------------------

  function extractOpenGraph(meta) {
    meta.title = meta.title || getMeta('og:title', 'property');
    const siteName = getMeta('og:site_name', 'property');
    // Don't use generic platform names as container titles
    const genericSites = /^(Google|Google Drive|Google Docs|Facebook|Twitter|X|YouTube|LinkedIn|Reddit|Medium|Wikipedia|GitHub|Instagram|TikTok|Pinterest|Dropbox|OneDrive)$/i;
    if (siteName && !genericSites.test(siteName)) {
      meta['container-title'] = meta['container-title'] || siteName;
    }
    meta.abstract =
      meta.abstract || getMeta('og:description', 'property');

    const ogType = getMeta('og:type', 'property');
    if (ogType === 'article' && meta.type === 'webpage') {
      meta.type = 'article';
    }

    const pubDate =
      getMeta('article:published_time', 'property') ||
      getMeta('article:published', 'property');
    if (pubDate && !meta.issued) {
      meta.issued = parseDate(pubDate);
    }

    const ogAuthor =
      getMeta('article:author', 'property') ||
      getMeta('article:author:name', 'property');
    if (ogAuthor && meta.author.length === 0) {
      meta.author.push(parseName(ogAuthor));
    }
  }

  // -------------------------------------------------------------------------
  // Standard meta tags
  // -------------------------------------------------------------------------

  function extractStandardMeta(meta) {
    meta.title = meta.title || document.title;
    meta.abstract = meta.abstract || getMeta('description');

    const author = getMeta('author');
    if (author && meta.author.length === 0) {
      meta.author.push(parseName(author));
    }

    const date = getMeta('date') || getMeta('pubdate');
    if (date && !meta.issued) {
      meta.issued = parseDate(date);
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
      // Find the smallest element whose own text contains the key
      const xpath = `//*[text()[contains(normalize-space(.), "${key}")]]`;
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

    if (meta.type === 'book') {

      // Book-specific fields
      if (!meta.publisher) { const p = v('Publisher'); if (p) meta.publisher = p; }
      if (!meta.issued) { const d = v('Publication date') || v('Published'); if (d) meta.issued = parseDate(d); }
      if (!meta.language) { const l = v('Language'); if (l) meta.language = l; }

      const isbn13 = v('ISBN-13') || v('ISBN 13');
      if (isbn13 && !meta.ISBN) meta.ISBN = isbn13.replace(/[\s-]/g, '').match(/97[89]\d{10}/)?.[0];

      if (!meta.ISBN) {
        const isbn10 = v('ISBN-10') || v('ISBN 10');
        if (isbn10) meta.ISBN = isbn10.replace(/[\s-]/g, '').match(/\d{9}[\dXx]/)?.[0];
      }

      if (!meta.ISBN) {
        const asin = v('ASIN');
        if (asin) meta._asin = asin.match(/[A-Z0-9]{10}/i)?.[0];
      }

      const pages = v('Print length') || v('Pages') || v('Page count');
      if (pages) { const n = pages.match(/(\d+)/); if (n) meta['number-of-pages'] = n[1]; }

      if (!meta.edition) { const e = v('Edition'); if (e) meta.edition = e; }
    }

    // Journal-specific fields
    if (meta.type === 'article-journal') {
      if (!meta['container-title']) { const j = v('Journal') || v('Publication'); if (j) meta['container-title'] = j; }
      if (!meta.volume) { const vol = v('Volume'); if (vol) meta.volume = vol; }
      if (!meta.issue) { const iss = v('Issue') || v('Number'); if (iss) meta.issue = iss; }
      if (!meta.page) { const pg = v('Pages') || v('Page range'); if (pg) meta.page = pg; }
    }

    // Thesis-specific fields
    if (meta.type === 'thesis') {
      if (!meta.publisher) { const u = v('University') || v('Institution') || v('School'); if (u) meta.publisher = u; }
      if (!meta.genre) { const d = v('Degree') || v('Department'); if (d) meta.genre = d; }
    }

    // Common fields for any type — fill gaps
    if (!meta.publisher) { const p = v('Publisher') || v('Published by') || v('Organization'); if (p) meta.publisher = p; }
    if (!meta.issued) { const d = v('Date') || v('Published') || v('Publication date') || v('Year'); if (d) meta.issued = parseDate(d); }
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
