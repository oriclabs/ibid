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

      // XMP metadata — richer than info dict, embedded as XML in PDF
      const xmpChunk = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, Math.min(bytes.length, 200000)));
      const xmpStart = xmpChunk.indexOf('<x:xmpmeta');
      const xmpEnd = xmpChunk.indexOf('</x:xmpmeta>');
      if (xmpStart > -1 && xmpEnd > xmpStart) {
        const xmp = xmpChunk.substring(xmpStart, xmpEnd + 13);
        const xmpTag = (tag) => {
          const m = xmp.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
          return m ? m[1].trim() : null;
        };
        const xmpAll = (tag) => {
          const re = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'gi');
          const results = []; let m;
          while ((m = re.exec(xmp))) results.push(m[1].trim());
          return results;
        };
        // dc:title, dc:creator, dc:description, dc:date, prism:doi, prism:publicationName
        if (!info.Title) info.Title = xmpTag('dc:title') || xmpTag('rdf:li');
        if (!info.Author) {
          const creators = xmpAll('dc:creator') .length ? xmpAll('dc:creator') : xmpAll('rdf:li');
          if (creators.length) info.Author = creators.join('; ');
        }
        if (!info.Subject) info.Subject = xmpTag('dc:description');
        const xmpDoi = xmpTag('prism:doi') || xmpTag('pdfx:doi') || xmpTag('pdfx:DOI');
        if (xmpDoi) info.DOI = xmpDoi;
        const xmpJournal = xmpTag('prism:publicationName');
        if (xmpJournal) info._journal = xmpJournal;
        const xmpVolume = xmpTag('prism:volume');
        if (xmpVolume) info._volume = xmpVolume;
        const xmpIssue = xmpTag('prism:number') || xmpTag('prism:issueIdentifier');
        if (xmpIssue) info._issue = xmpIssue;
        const xmpStartPage = xmpTag('prism:startingPage');
        const xmpEndPage = xmpTag('prism:endingPage');
        if (xmpStartPage) info._pages = xmpEndPage ? `${xmpStartPage}-${xmpEndPage}` : xmpStartPage;
        const xmpIsbn = xmpTag('prism:isbn');
        if (xmpIsbn) info.ISBN = xmpIsbn;
        const xmpDate = xmpTag('prism:publicationDate') || xmpTag('prism:coverDate') || xmpTag('dc:date');
        if (xmpDate) info._xmpDate = xmpDate;
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

      // 2b. DOI/arXiv from filename (e.g. "10.1038_s41586-024-07386-0.pdf")
      try {
        const filename = decodeURIComponent(window.location.href.split('/').pop() || '')
          .replace(/\.pdf$/i, '');
        // DOI in filename: 10.xxxx_rest or 10.xxxx-rest (slash replaced with _ or -)
        const filenameDoi = filename.match(/\b(10\.\d{4,})[_]([\w.\-]+)/);
        if (filenameDoi && !meta.DOI) meta.DOI = filenameDoi[1] + '/' + filenameDoi[2];
        // arXiv ID in filename: 2303.08774
        if (!meta.DOI) {
          const filenameArxiv = filename.match(/\b(\d{4}\.\d{4,5})\b/);
          if (filenameArxiv) meta.DOI = '10.48550/arXiv.' + filenameArxiv[1];
        }
      } catch {}

      // 3. DOI from URL — uses shared identifier patterns
      const url = window.location.href;
      if (typeof window.IbidIdentifiers !== 'undefined') {
        const urlId = window.IbidIdentifiers.extractDoiFromUrl(url);
        if (urlId) {
          if (urlId.type === 'DOI') meta.DOI = urlId.id;
          else if (urlId.type === 'PMC') meta._pmcId = urlId.id;
        }
      } else {
        // Fallback: inline DOI extraction if identifiers.js not loaded
        const urlDoi = url.match(/10\.\d{4,}\/[^\s&?#]+/);
        if (urlDoi) meta.DOI = urlDoi[0].replace(/[.,;:)\]}>]+$/, '');
        if (!meta.DOI) {
          const arxivMatch = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/);
          if (arxivMatch) meta.DOI = '10.48550/arXiv.' + arxivMatch[1];
        }
      }

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

          // XMP-derived fields
          if (info._journal && !meta['container-title']) meta['container-title'] = info._journal;
          if (info._volume && !meta.volume) meta.volume = info._volume;
          if (info._issue && !meta.issue) meta.issue = info._issue;
          if (info._pages && !meta.page) meta.page = info._pages;
          if (info._xmpDate) {
            const xmpParsed = parsePdfDate(info._xmpDate);
            if (xmpParsed) meta.issued = xmpParsed; // XMP date overrides CreationDate
          }

          // Set type based on identifiers found
          if (meta.ISBN) meta.type = 'book';
          else if (meta.DOI) meta.type = 'article-journal';

          // 5. Try Rust WASM pdf-extract for full text extraction
          try {
            const textResult = await chrome.runtime.sendMessage({
              action: 'extractPdfText',
              url: window.location.href,
            });
            if (textResult?.text) {
              const fullText = textResult.text;

              // Smart header detection — find content before references/bibliography
              const refIndex = fullText.search(/\n\s*(References|Bibliography|Works Cited|Literature Cited|Notes)\s*\n/i);
              const abstractIndex = fullText.search(/\n\s*(Abstract|Summary)\s*\n/i);
              // Header = before abstract or first 3000 chars, whichever is shorter
              const headerEnd = abstractIndex > 100 ? abstractIndex : Math.min(fullText.length, 3000);
              const header = fullText.substring(0, headerEnd);

              // Extract DOI from header area only
              if (!meta.DOI) {
                const doiMatch = header.match(/(?:doi[:\s]*|https?:\/\/(?:dx\.)?doi\.org\/)(10\.\d{4,}\/[^\s<>"{}|\\^~\[\]`]+)/i)
                  || header.match(/\b(10\.\d{4,}\/[^\s<>"{}|\\^~\[\]`]+)/);
                if (doiMatch) meta.DOI = doiMatch[1].replace(/[.,;:)\]}>]+$/, '');
              }

              // Extract ISBN from header only — full text would pick up referenced books
              if (!meta.ISBN) {
                const isbnMatch = header.match(/ISBN(?:-1[03])?[\s:-]*(97[89][\d\s-]{10,})/i);
                if (isbnMatch) meta.ISBN = isbnMatch[1].replace(/[\s-]/g, '');
              }

              // Extract title from first substantial line — overrides filename-derived title
              const lines = header.split('\n').map(l => l.trim()).filter(l => l.length > 10 && l.length < 200);
              if (lines.length > 0) {
                const textTitle = lines[0];
                // Prefer text-extracted title over filename-derived one (e.g. "SAMv1")
                if (!meta.title || meta.title.length < 30) {
                  meta.title = textTitle;
                }
              }

              // Extract author from second line only if it looks like a name/group (not body text)
              if (meta.author.length === 0 && lines.length > 1) {
                const authorLine = lines[1];
                // Must be short, no sentences (no periods mid-text), no common body-text starts
                const isSentence = (authorLine.match(/\.\s+[A-Z]/g) || []).length > 0;
                const isBodyText = /^(we |this |the |in |a |an |abstract|introduction|chapter|section|table of|contents|copyright|doi)/i.test(authorLine);
                const isUrl = /^https?:\/\//i.test(authorLine);
                if (authorLine.length < 100 && !isSentence && !isBodyText && !isUrl) {
                  meta.author = parseAuthorsString(authorLine);
                }
              }

              // Extract publication date from header text (more accurate than PDF CreationDate)
              const datePatterns = [
                /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})/i,
                /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/i,
                /(\d{4}-\d{2}-\d{2})/,
              ];
              for (const rx of datePatterns) {
                const dm = header.match(rx);
                if (dm) {
                  const dateStr = dm[1] || dm[0];
                  const ts = Date.parse(dateStr);
                  if (!isNaN(ts)) {
                    const d = new Date(ts);
                    meta.issued = { 'date-parts': [[d.getFullYear(), d.getMonth() + 1, d.getDate()]] };
                    break;
                  }
                }
              }

              // Only set type from text extraction if not already determined
              if (meta.type === 'document') {
                if (meta.DOI) meta.type = 'article-journal';
              }
            }
          } catch (wasmErr) {
          }
        }
      } catch (fetchErr) {
      }

      // 6. Linked article page — fetch HTML article page for Highwire/DC meta tags
      // Only if we have a DOI but still missing key fields
      if (meta.DOI && (!meta.author?.length || !meta.volume || !meta['container-title'])) {
        try {
          const doiUrl = meta.DOI.startsWith('http') ? meta.DOI : `https://doi.org/${meta.DOI}`;
          const articleResult = await chrome.runtime.sendMessage({
            action: 'fetchArticleMeta',
            url: doiUrl,
          });
          if (articleResult?.meta) {
            const am = articleResult.meta;
            if (am.title && (!meta.title || meta.title.length < 30)) meta.title = am.title;
            if (am.authors?.length > (meta.author?.length || 0)) {
              meta.author = am.authors.map(n => parseAuthorsString(n)[0] || { literal: n });
            }
            if (am.journal) meta['container-title'] = am.journal;
            if (am.volume) meta.volume = am.volume;
            if (am.issue) meta.issue = am.issue;
            if (am.pages) meta.page = am.pages;
            if (am.date && !meta.issued) meta.issued = parsePdfDate(am.date);
            if (am.publisher && !meta.publisher) meta.publisher = am.publisher;
            if (am.issn && !meta.ISSN) meta.ISSN = am.issn;
          }
        } catch {
          // Article page fetch failed — continue with what we have
        }
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
