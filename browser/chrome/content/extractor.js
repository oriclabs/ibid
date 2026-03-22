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
      const nonAcademic = /(google\.com|youtube\.com|facebook\.com|twitter\.com|instagram\.com|linkedin\.com|reddit\.com|github\.com|stackoverflow\.com|medium\.com|amazon\.com|ebay\.com)/;
      if (!nonAcademic.test(host)) {
        const doiMatch = document.body?.textContent?.match(
          /\b(10\.\d{4,}\/[^\s<>"{}|\\^~\[\]`]+)/
        );
        if (doiMatch) meta.DOI = cleanDoi(doiMatch[1]);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Site-specific extractors
  // -------------------------------------------------------------------------

  function extractSiteSpecific(meta) {
    const host = window.location.hostname.toLowerCase();
    const url = window.location.href;

    // Google Scholar
    if (host.includes('scholar.google')) {
      const titleEl = document.querySelector('#gsc_oci_title_gg a, .gsc_oci_title_link, h3.gs_rt a');
      if (titleEl) meta.title = meta.title || titleEl.textContent.trim();
      // Authors from the citation info line
      const infoEl = document.querySelector('.gs_a, .gsc_oci_value');
      if (infoEl && meta.author.length === 0) {
        const authorText = infoEl.textContent.split('-')[0].trim();
        authorText.split(',').forEach(n => {
          n = n.trim();
          if (n && n.length < 50) meta.author.push(parseName(n));
        });
      }
      if (meta.type === 'webpage') meta.type = 'article-journal';
    }

    // ResearchGate
    if (host.includes('researchgate.net')) {
      const titleEl = document.querySelector('h1.research-detail-header-section__title, h1[itemprop="name"]');
      if (titleEl) meta.title = meta.title || titleEl.textContent.trim();
      const authorEls = document.querySelectorAll('a[itemprop="author"] span, .nova-legacy-v-person-list-item__title a');
      if (authorEls.length && meta.author.length === 0) {
        authorEls.forEach(el => meta.author.push(parseName(el.textContent.trim())));
      }
      if (meta.type === 'webpage') meta.type = 'article-journal';
    }

    // Scopus
    if (host.includes('scopus.com')) {
      const titleEl = document.querySelector('#abstracts h2, .Highlight-module__content');
      if (titleEl) meta.title = meta.title || titleEl.textContent.trim();
      if (meta.type === 'webpage') meta.type = 'article-journal';
    }

    // SSRN
    if (host.includes('ssrn.com')) {
      const titleEl = document.querySelector('h1.title, .abstract-title');
      if (titleEl) meta.title = meta.title || titleEl.textContent.trim();
      const authorEls = document.querySelectorAll('.authors-list a, a[data-abstract-id]');
      if (authorEls.length && meta.author.length === 0) {
        authorEls.forEach(el => {
          const name = el.textContent.trim();
          if (name && name.length < 50 && !name.includes('http')) meta.author.push(parseName(name));
        });
      }
      if (meta.type === 'webpage') meta.type = 'report';
    }

    // arXiv
    if (host.includes('arxiv.org')) {
      const titleEl = document.querySelector('.title.mathjax');
      if (titleEl) meta.title = meta.title || titleEl.textContent.replace('Title:', '').trim();
      const authorEls = document.querySelectorAll('.authors a');
      if (authorEls.length && meta.author.length === 0) {
        authorEls.forEach(el => meta.author.push(parseName(el.textContent.trim())));
      }
      // Extract arXiv ID from URL
      const arxivMatch = url.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/);
      if (arxivMatch && !meta.DOI) {
        meta._arxivId = arxivMatch[1];
      }
      if (meta.type === 'webpage') meta.type = 'article';
    }

    // PubMed
    if (host.includes('pubmed.ncbi.nlm.nih.gov')) {
      // PubMed uses citation_authors (single meta with all names)
      const authorsTag = getMeta('citation_authors');
      if (authorsTag && meta.author.length === 0) {
        authorsTag.split(',').forEach(n => {
          n = n.trim();
          if (n) meta.author.push(parseName(n));
        });
      }
      if (meta.type === 'webpage') meta.type = 'article-journal';
    }

    // Semantic Scholar
    if (host.includes('semanticscholar.org')) {
      const titleEl = document.querySelector('h1[data-test-id="paper-detail-title"]');
      if (titleEl) meta.title = meta.title || titleEl.textContent.trim();
      if (meta.type === 'webpage') meta.type = 'article-journal';
    }

    // JSTOR
    if (host.includes('jstor.org')) {
      if (meta.type === 'webpage') meta.type = 'article-journal';
    }

    // IEEE Xplore
    if (host.includes('ieeexplore.ieee.org')) {
      if (meta.type === 'webpage') meta.type = 'article-journal';
    }

    // ScienceDirect / Elsevier
    if (host.includes('sciencedirect.com')) {
      if (meta.type === 'webpage') meta.type = 'article-journal';
    }

    // SpringerLink
    if (host.includes('link.springer.com')) {
      if (meta.type === 'webpage') meta.type = 'article-journal';
    }

    // Wiley
    if (host.includes('onlinelibrary.wiley.com')) {
      if (meta.type === 'webpage') meta.type = 'article-journal';
    }

    // Taylor & Francis
    if (host.includes('tandfonline.com')) {
      if (meta.type === 'webpage') meta.type = 'article-journal';
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
    str = str.trim().replace(/^by\s+/i, '');

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
