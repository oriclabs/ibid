// Ibid — Identifier Patterns & URL Extraction
// Centralized patterns for DOI, ISBN, PMID, arXiv, and other scholarly identifiers.
// Used by extractor.js, pdf-extractor.js, service-worker.js, and resolver.js.
//
// To add a new identifier type: add an entry to IDENTIFIERS and URL_DOI_PATTERNS.
// No extraction logic changes needed.

if (!window.__ibidIdentifiersLoaded) {
window.__ibidIdentifiersLoaded = true;

'use strict';

const IDENTIFIERS = {
  // --- DOI ---
  DOI: {
    // Matches raw DOI: 10.xxxx/...
    pattern: /\b(10\.\d{4,}\/[^\s<>"{}|\\^~\[\]`]+)/,
    // Matches DOI with explicit label
    labeled: /(?:doi[:\s]*|https?:\/\/(?:dx\.)?doi\.org\/)(10\.\d{4,}\/[^\s<>"{}|\\^~\[\]`]+)/i,
    // Clean trailing punctuation from extracted DOI
    clean: (doi) => doi.replace(/[.,;:)\]}>]+$/, ''),
    // Validate DOI format
    validate: (doi) => /^10\.\d{4,}\/\S+$/.test(doi),
  },

  // --- ISBN ---
  ISBN: {
    // ISBN-13 (978/979 prefix)
    isbn13: /(?:ISBN[\s:-]*(?:13)?[\s:-]*)?(97[89][\s-]?\d[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d)/i,
    // ISBN-10
    isbn10: /ISBN[\s:-]*(?:10)?[\s:-]*(\d[\s-]?\d{4}[\s-]?\d{4}[\s-]?[\dXx])/i,
    // Generic ISBN (matches either format)
    any: /\bISBN(?:-1[03])?[\s:-]*([\d\s-]{10,17}[\dXx]?)\b/i,
    // Clean ISBN to digits only
    clean: (isbn) => isbn.replace(/[\s-]/g, ''),
    // Validate ISBN-13
    validate13: (isbn) => /^97[89]\d{10}$/.test(isbn),
    // Validate ISBN-10
    validate10: (isbn) => /^\d{9}[\dXx]$/.test(isbn),
  },

  // --- PMID (PubMed) ---
  PMID: {
    pattern: /\bPMID[\s:-]*(\d{6,9})\b/i,
    url: /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/,
    validate: (id) => /^\d{6,9}$/.test(id),
  },

  // --- PMC (PubMed Central) ---
  PMC: {
    pattern: /\bPMC(\d{6,8})\b/i,
    url: /\/pmc\/articles\/(PMC\d+)/,
    validate: (id) => /^PMC\d{6,8}$/.test(id),
  },

  // --- arXiv ---
  arXiv: {
    // Modern format: YYMM.NNNNN
    pattern: /\barXiv[\s:-]*(\d{4}\.\d{4,5}(?:v\d+)?)\b/i,
    url: /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/,
    // Convert arXiv ID to DOI
    toDoi: (id) => '10.48550/arXiv.' + id,
    validate: (id) => /^\d{4}\.\d{4,5}(v\d+)?$/.test(id),
  },

  // --- ISSN ---
  ISSN: {
    pattern: /\bISSN[\s:-]*(\d{4}-\d{3}[\dXx])\b/i,
    validate: (issn) => /^\d{4}-\d{3}[\dXx]$/.test(issn),
  },

  // --- ORCID ---
  ORCID: {
    pattern: /\b(\d{4}-\d{4}-\d{4}-\d{3}[\dXx])\b/,
    url: /orcid\.org\/(\d{4}-\d{4}-\d{4}-\d{3}[\dXx])/,
    validate: (id) => /^\d{4}-\d{4}-\d{4}-\d{3}[\dXx]$/.test(id),
  },
};

// --- URL patterns that contain DOIs ---
// Each: { pattern: RegExp, extract: (match) => DOI string }
const URL_DOI_PATTERNS = [
  // Direct DOI in URL
  { pattern: /\/(10\.\d{4,}\/[^\s&?#]+)/, extract: (m) => m[1] },
  // Nature: nature.com/articles/s41586-024-07386-0.pdf
  { pattern: /nature\.com\/articles\/([^/.?#]+)(?:\.pdf)?/, extract: (m) => '10.1038/' + m[1] },
  // Springer: link.springer.com/content/pdf/10.1007/...
  { pattern: /springer\.com\/content\/pdf\/(10\.\d{4,}\/[^.?#]+)/, extract: (m) => m[1] },
  // Wiley: onlinelibrary.wiley.com/doi/pdfdirect/10.1002/...
  { pattern: /wiley\.com\/doi\/(?:pdfdirect|epdf|pdf|full)\/(10\.\d{4,}\/[^?#]+)/, extract: (m) => decodeURIComponent(m[1]) },
  // Taylor & Francis: tandfonline.com/doi/pdf/10.xxxx/...
  { pattern: /tandfonline\.com\/doi\/(?:pdf|epdf|full)\/(10\.\d{4,}\/[^?#]+)/, extract: (m) => decodeURIComponent(m[1]) },
  // Generic /doi/pdf/ or /doi/full/ pattern (SAGE, ACS, etc.)
  { pattern: /\/doi\/(?:pdf|epdf|pdfdirect|full|abs)\/(10\.\d{4,}\/[^?#]+)/, extract: (m) => decodeURIComponent(m[1]) },
  // ScienceDirect: may have DOI in query param
  { pattern: /sciencedirect\.com.*[?&]doi=(10\.\d{4,}\/[^&#]+)/, extract: (m) => decodeURIComponent(m[1]) },
  // arXiv: arxiv.org/pdf/2303.08774
  { pattern: /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/, extract: (m) => '10.48550/arXiv.' + m[1] },
  // PMC: ncbi.nlm.nih.gov/pmc/articles/PMC1234567/pdf/
  { pattern: /\/pmc\/articles\/(PMC\d+)/, extract: (m) => null, pmcId: (m) => m[1] },
];

// --- Extract identifier from any string (URL, pasted text, etc.) ---
function extractIdentifier(input) {
  if (!input) return null;
  input = input.trim();

  // Try DOI first (most common)
  const doiMatch = input.match(IDENTIFIERS.DOI.labeled) || input.match(IDENTIFIERS.DOI.pattern);
  if (doiMatch) {
    const doi = IDENTIFIERS.DOI.clean(doiMatch[1]);
    // Check if it's an arXiv DOI
    const arxivInDoi = doi.match(/10\.48550\/arXiv\.(\d{4}\.\d{4,5})/i);
    if (arxivInDoi) return { type: 'arXiv', id: arxivInDoi[1], doi };
    return { type: 'DOI', id: doi };
  }

  // arXiv
  const arxivMatch = input.match(IDENTIFIERS.arXiv.pattern) || input.match(IDENTIFIERS.arXiv.url);
  if (arxivMatch) return { type: 'arXiv', id: arxivMatch[1], doi: IDENTIFIERS.arXiv.toDoi(arxivMatch[1]) };

  // PMID
  const pmidMatch = input.match(IDENTIFIERS.PMID.pattern) || input.match(IDENTIFIERS.PMID.url);
  if (pmidMatch) return { type: 'PMID', id: pmidMatch[1] };

  // PMC
  const pmcMatch = input.match(IDENTIFIERS.PMC.pattern) || input.match(IDENTIFIERS.PMC.url);
  if (pmcMatch) return { type: 'PMC', id: pmcMatch[1] };

  // ISBN
  const isbn13Match = input.replace(/[\s-]/g, '').match(/^(97[89]\d{10})$/);
  if (isbn13Match) return { type: 'ISBN', id: isbn13Match[1] };
  const isbn10Match = input.replace(/[\s-]/g, '').match(/^(\d{9}[\dXx])$/);
  if (isbn10Match) return { type: 'ISBN', id: isbn10Match[1] };
  const isbnMatch = input.match(IDENTIFIERS.ISBN.any);
  if (isbnMatch) return { type: 'ISBN', id: IDENTIFIERS.ISBN.clean(isbnMatch[1]) };

  return null;
}

// --- Extract DOI from URL using publisher-specific patterns ---
function extractDoiFromUrl(url) {
  if (!url) return null;
  for (const p of URL_DOI_PATTERNS) {
    const m = url.match(p.pattern);
    if (m) {
      if (p.pmcId) return { type: 'PMC', id: p.pmcId(m) };
      const doi = p.extract(m);
      if (doi) return { type: 'DOI', id: IDENTIFIERS.DOI.clean(doi) };
    }
  }
  return null;
}

// --- Extract all identifiers found in a block of text ---
function extractIdentifiersFromText(text, headerOnly = false) {
  if (!text) return {};
  const chunk = headerOnly ? text.substring(0, 3000) : text;
  const found = {};

  const doiMatch = chunk.match(IDENTIFIERS.DOI.labeled) || chunk.match(IDENTIFIERS.DOI.pattern);
  if (doiMatch) found.DOI = IDENTIFIERS.DOI.clean(doiMatch[1]);

  const isbn13 = chunk.match(IDENTIFIERS.ISBN.isbn13);
  if (isbn13) found.ISBN = IDENTIFIERS.ISBN.clean(isbn13[1]);
  if (!found.ISBN) {
    const isbn10 = chunk.match(IDENTIFIERS.ISBN.isbn10);
    if (isbn10) found.ISBN = IDENTIFIERS.ISBN.clean(isbn10[1]);
  }

  const pmid = chunk.match(IDENTIFIERS.PMID.pattern);
  if (pmid) found.PMID = pmid[1];

  const arxiv = chunk.match(IDENTIFIERS.arXiv.pattern);
  if (arxiv) found.arXiv = arxiv[1];

  const issn = chunk.match(IDENTIFIERS.ISSN.pattern);
  if (issn) found.ISSN = issn[1];

  return found;
}

// Export for use in content scripts (IIFE) and ES modules
if (typeof window !== 'undefined') {
  window.IbidIdentifiers = {
    IDENTIFIERS,
    URL_DOI_PATTERNS,
    extractIdentifier,
    extractDoiFromUrl,
    extractIdentifiersFromText,
  };
}
} // end double-injection guard
