// Ibid — PDF Metadata Extractor
// Extracts metadata from PDF documents viewed in the browser
// Handles: Chrome's built-in PDF viewer, embedded PDFs

if (!window.__ibidPdfExtractorLoaded) {
  window.__ibidPdfExtractorLoaded = true;

  (() => {
    'use strict';

    function isPdfPage() {
      // Chrome PDF viewer
      if (document.contentType === 'application/pdf') return true;
      // URL ends in .pdf
      if (window.location.href.toLowerCase().endsWith('.pdf')) return true;
      // Embedded PDF viewer
      if (document.querySelector('embed[type="application/pdf"]')) return true;
      return false;
    }

    function extractPdfMetadata() {
      const meta = {
        type: 'document',
        title: null,
        author: [],
        issued: null,
        URL: window.location.href,
        DOI: null,
        _isPdf: true,
      };

      // Try to get title from document.title (Chrome PDF viewer sets this)
      const docTitle = document.title;
      if (docTitle && !docTitle.endsWith('.pdf') && docTitle !== 'about:blank') {
        meta.title = docTitle.replace(/\.pdf$/i, '').trim();
      }

      // Try to extract from URL filename
      if (!meta.title) {
        const urlPath = window.location.pathname;
        const filename = urlPath.split('/').pop();
        if (filename && filename.endsWith('.pdf')) {
          meta.title = decodeURIComponent(filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')).trim();
        }
      }

      // Look for DOI in the URL
      const urlDoi = window.location.href.match(/10\.\d{4,}\/[^\s&?#]+/);
      if (urlDoi) meta.DOI = urlDoi[0];

      // Try to get text content from PDF viewer (limited — Chrome PDF viewer doesn't expose text easily)
      // We'll rely on the Enhance button (DOI lookup) for full metadata

      return meta;
    }

    // Listen for extraction requests
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'extractMetadata' && isPdfPage()) {
        sendResponse({ metadata: extractPdfMetadata() });
        return true;
      }
    });
  })();
}
