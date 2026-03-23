// Ibid — PDF Metadata Extractor
// Extracts metadata from PDF documents viewed in the browser
// Handles: Chrome's built-in PDF viewer, embedded PDFs
// Extracts PDF info dictionary (Title, Author, Subject, Keywords, CreationDate, DOI)

if (!window.__ibidPdfExtractorLoaded) {
  window.__ibidPdfExtractorLoaded = true;

  (() => {
    'use strict';

    function isPdfPage() {
      if (document.contentType === 'application/pdf') return true;
      if (window.location.href.toLowerCase().match(/\.pdf(\?|$)/)) return true;
      if (document.querySelector('embed[type="application/pdf"]')) return true;
      return false;
    }

    // Parse PDF info dictionary from raw bytes (lightweight, no PDF.js)
    function parsePdfInfo(bytes) {
      const info = {};
      // Convert to string for regex searching (only ASCII matters for metadata keys)
      // Search last 4KB and first 4KB where info dict usually lives
      const chunkSize = 8192;
      const head = new TextDecoder('latin1').decode(bytes.slice(0, chunkSize));
      const tail = new TextDecoder('latin1').decode(bytes.slice(Math.max(0, bytes.length - chunkSize)));
      const text = head + tail;

      // Extract /Title, /Author, /Subject, /Keywords, /Creator, /Producer, /CreationDate
      const fields = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'CreationDate'];
      for (const field of fields) {
        // Match /Field (value) or /Field <hex>
        const parenMatch = text.match(new RegExp('/' + field + '\\s*\\(([^)]{1,500})\\)'));
        if (parenMatch) {
          info[field] = cleanPdfString(parenMatch[1]);
          continue;
        }
        // Match /Field <FEFF...> (UTF-16 hex string)
        const hexMatch = text.match(new RegExp('/' + field + '\\s*<([0-9A-Fa-f]+)>'));
        if (hexMatch) {
          info[field] = decodeHexString(hexMatch[1]);
        }
      }

      // Search first 32KB for DOI, ISBN patterns
      const textChunk = new TextDecoder('latin1').decode(bytes.slice(0, 32768));

      // DOI
      const doiMatch = textChunk.match(/10\.\d{4,}\/[^\s)<>\]"]{3,80}/);
      if (doiMatch) {
        info.DOI = doiMatch[0].replace(/[.,;:)\]}>]+$/, '');
      }

      // ISBN-13 (978/979 prefix)
      const isbn13Match = textChunk.match(/(?:ISBN[\s:-]*1?3?[\s:-]*)?(97[89][\s-]?\d[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d)/i);
      if (isbn13Match) {
        info.ISBN = isbn13Match[1].replace(/[\s-]/g, '');
      }

      // ISBN-10 (if no ISBN-13 found)
      if (!info.ISBN) {
        const isbn10Match = textChunk.match(/ISBN[\s:-]*(\d[\s-]?\d{4}[\s-]?\d{4}[\s-]?[\dXx])/i);
        if (isbn10Match) {
          info.ISBN = isbn10Match[1].replace(/[\s-]/g, '');
        }
      }

      return info;
    }

    function cleanPdfString(s) {
      // Unescape PDF string escapes: \n, \r, \t, \\, \(, \), octal
      return s
        .replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\\\\/g, '\\')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .trim();
    }

    function decodeHexString(hex) {
      // Check for UTF-16 BOM (FEFF)
      if (hex.startsWith('FEFF') || hex.startsWith('feff')) {
        const chars = [];
        for (let i = 4; i < hex.length; i += 4) {
          const code = parseInt(hex.substring(i, i + 4), 16);
          if (code > 0) chars.push(String.fromCharCode(code));
        }
        return chars.join('').trim();
      }
      // Plain hex
      const chars = [];
      for (let i = 0; i < hex.length; i += 2) {
        chars.push(String.fromCharCode(parseInt(hex.substring(i, i + 2), 16)));
      }
      return chars.join('').trim();
    }

    function parseAuthorsString(str) {
      if (!str) return [];
      // Common separators: semicolons, " and ", commas between names
      const parts = str.split(/\s*[;]\s*|\s+and\s+/i).filter(Boolean);
      return parts.map(name => {
        name = name.trim();
        if (name.includes(',')) {
          const [family, given] = name.split(',', 2).map(s => s.trim());
          return { family, given };
        }
        const words = name.split(/\s+/);
        if (words.length === 1) return { literal: words[0] };
        const family = words.pop();
        return { family, given: words.join(' ') };
      });
    }

    function parsePdfDate(str) {
      if (!str) return null;
      // PDF dates: D:YYYYMMDDHHmmSS or D:YYYYMMDD or YYYY-MM-DD
      const m = str.match(/D?:?(\d{4})(\d{2})?(\d{2})?/);
      if (m) {
        const parts = [parseInt(m[1], 10)];
        if (m[2]) parts.push(parseInt(m[2], 10));
        if (m[3]) parts.push(parseInt(m[3], 10));
        return { 'date-parts': [parts] };
      }
      return null;
    }

    async function extractPdfMetadata() {
      const meta = {
        type: 'document',
        title: null,
        author: [],
        issued: null,
        URL: window.location.href,
        DOI: null,
        _isPdf: true,
      };

      // 1. Title from document.title
      const docTitle = document.title;
      if (docTitle && !docTitle.endsWith('.pdf') && docTitle !== 'about:blank') {
        meta.title = docTitle.replace(/\.pdf$/i, '').trim();
      }

      // 2. Title from URL filename
      if (!meta.title) {
        try {
          const urlPath = new URL(window.location.href).pathname;
          const filename = urlPath.split('/').pop();
          if (filename && filename.match(/\.pdf$/i)) {
            meta.title = decodeURIComponent(filename.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ')).trim();
          }
        } catch {}
      }

      // 3. DOI from URL
      const urlDoi = window.location.href.match(/10\.\d{4,}\/[^\s&?#]+/);
      if (urlDoi) meta.DOI = urlDoi[0].replace(/[.,;:)\]}>]+$/, '');

      // 4. Try to fetch PDF bytes and parse metadata dictionary
      try {
        const res = await fetch(window.location.href);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const info = parsePdfInfo(bytes);

          if (info.Title && !meta.title) meta.title = info.Title;
          if (info.Author && meta.author.length === 0) {
            meta.author = parseAuthorsString(info.Author);
          }
          if (info.CreationDate && !meta.issued) {
            meta.issued = parsePdfDate(info.CreationDate);
          }
          if (info.DOI && !meta.DOI) meta.DOI = info.DOI;
          if (info.ISBN) meta.ISBN = info.ISBN;
          if (info.Subject) meta.abstract = info.Subject;
          if (info.Keywords) meta.keyword = info.Keywords;

          // Set type based on identifiers found
          if (meta.ISBN) meta.type = 'book';
          else if (meta.DOI) meta.type = 'article-journal';
        }
      } catch {
        // Fetch failed (CORS, expired token, etc.) — continue with what we have
      }

      return meta;
    }

    // Listen for extraction requests
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'extractMetadata' && isPdfPage()) {
        extractPdfMetadata().then(metadata => {
          sendResponse({ metadata });
        });
        return true; // async response
      }
    });
  })();
}
