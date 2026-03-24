(function () {
  "use strict";

  function extractStructuredSourceDataFromHtml(doc) {
    doc = doc || document;

    var SOURCE_TYPES = {
      WEBPAGE: "webpage",
      JOURNAL_ARTICLE: "article-journal",
      NEWS_ARTICLE: "article-newspaper",
      MAGAZINE_ARTICLE: "article-magazine",
      BOOK: "book",
      CHAPTER: "chapter",
      CONFERENCE_PAPER: "paper-conference",
      THESIS: "thesis",
      REPORT: "report",
      BLOG_POST: "post-weblog",
      LEGISLATION: "legislation",
      LEGAL_CASE: "legal-case",
      PATENT: "patent",
      DATASET: "dataset",
      SOFTWARE: "software",
      MOTION_PICTURE: "motion-picture",
      BROADCAST: "broadcast",
      UNKNOWN: "unknown"
    };

    var RX = {
      doi: /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i,
      doiUrl: /https?:\/\/(?:dx\.)?doi\.org\/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i,
      isbn: /\bISBN(?:-1[03])?:?\s*(97[89][- ]?)?\d{1,5}[- ]?\d+[- ]?\d+[- ]?[\dX]\b/i,
      issn: /\bISSN(?:-1[03])?:?\s*\d{4}-\d{3}[\dX]\b/i,
      arxiv: /\barXiv:\s*\d{4}\.\d{4,5}(?:v\d+)?\b/i,
      year: /\b(19|20)\d{2}\b/,
      fullDate: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+\d{4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b/i,
      isoDate: /\b\d{4}-\d{2}-\d{2}\b/,
      volume: /\bvol\.?\s*(\d+)\b/i,
      issue: /\b(?:issue|no\.?|number)\s*(\d+)\b/i,
      pages: /\bpp?\.?\s*(\d+)\s*[-–—]\s*(\d+)\b/i,
      compactJournal: /\b(\d+)\((\d+)\)\s*:\s*(\d+)\s*[-–—]\s*(\d+)\b/,
      url: /\bhttps?:\/\/[^\s<>()]+|www\.[^\s<>()]+\b/i,
      accessed: /\b(?:accessed|retrieved|available at|viewed on)\b/i,
      edition: /\b(\d+(?:st|nd|rd|th)\s+ed(?:ition)?|revised edition)\b/i,
      proceedings: /\bProceedings of\b/i,
      conference: /\b(?:conference|symposium|workshop|congress|meeting)\b/i,
      thesis: /\b(?:thesis|dissertation)\b/i,
      degree: /\b(?:PhD|MSc|BSc|Master'?s|Doctor of Philosophy)\b/i,
      report: /\b(?:technical report|report(?:\s+no\.?|\s+number)?|white paper|system card)\b/i,
      legislation: /\b(?:Act|Regulations|Statute|Code|Bill|Ordinance)\b/i,
      legalCase: /\b(?:\bv\.\b|\bvs\.\b|\bversus\b)\b/i,
      court: /\b(?:Court|Judge|Justice|Appeal|Circuit|Supreme Court|High Court|Federal Court)\b/i,
      patent: /\b(?:patent|patent application|publication number|grant number|application number|WO\d{4,}|US\d{4,}|EP\d{4,}|JP\d{4,})\b/i,
      datasetAccession: /\b(?:GSE\d+|SRR\d+|PRJNA\d+|ENSG\d+)\b/i,
      datasetRepo: /\b(?:GEO|SRA|ENA|Zenodo|Figshare|Dryad|OSF|GenBank)\b/i,
      software: /\b(?:software|version|release|GitHub|GitLab|npm|PyPI|package|library|tool|toolkit)\b/i,
      motionPicture: /\b(?:film|movie|video|documentary|motion picture|directed by|producer)\b/i,
      broadcast: /\b(?:broadcast|radio|podcast|episode|TV|television|aired on|broadcaster|network|station)\b/i,
      blog: /\b(?:blog|weblog|posted on|posted by|comments)\b/i,
      magazine: /\bmagazine\b/i,
      newsOutlet: /\b(?:Times|Herald|Post|Daily|Guardian|Telegraph|Tribune|Chronicle)\b/i,
      journalCue: /\b(?:Journal of|Review|Quarterly|Transactions|Annals|Letters|Nature Reviews)\b/i,
      publisherCue: /\b(?:Press|Publishing|Publications|Springer|Elsevier|Wiley|Routledge|Cambridge University Press|Oxford University Press|MIT Press|Sage)\b/i,
      chapterIn: /\bIn:\b/i,
      editors: /\b(?:Ed\.|Eds\.|edited by|editor|editors)\b/i,
      jurisdiction: /\b(?:Commonwealth|State of|Province of|Republic of|United States|Australia|United Kingdom|Victoria|New South Wales|Queensland|Canada)\b/i,
      runtime: /\b(?:runtime|running time|duration)\s*:?\s*(\d{1,3})\s*(?:min|minutes)\b/i,
      version: /\bversion\s*v?(\d+(?:\.\d+){0,3})\b/i,
      reportNumber: /\b(?:report no\.?|report number|document number|series number)\s*:?\s*([A-Z0-9\-\/\.]+)/i,
      patentNumber: /\b(?:patent number|publication number|grant number)\s*:?\s*([A-Z0-9\-\/\.]+)/i,
      applicationNumber: /\b(?:application number|application no\.?)\s*:?\s*([A-Z0-9\-\/\.]+)/i,
      courtNeutralCitation: /\[(\d{4})\]\s+[A-Z][A-Za-z]+\s+\d+/
    };

    var FIELD_CONFIG = {};
    FIELD_CONFIG[SOURCE_TYPES.WEBPAGE] = {
      required: ["title", "url"],
      optional: ["author", "websiteTitle", "publicationDate", "updatedDate", "accessedDate", "organization", "description"]
    };
    FIELD_CONFIG[SOURCE_TYPES.JOURNAL_ARTICLE] = {
      required: ["title", "author", "journalTitle", "year"],
      optional: ["volume", "issue", "pages", "doi", "url", "issn", "publicationDate", "abstract"]
    };
    FIELD_CONFIG[SOURCE_TYPES.NEWS_ARTICLE] = {
      required: ["title", "publicationTitle", "publicationDate"],
      optional: ["author", "section", "page", "url", "accessedDate"]
    };
    FIELD_CONFIG[SOURCE_TYPES.MAGAZINE_ARTICLE] = {
      required: ["title", "publicationTitle", "publicationDate"],
      optional: ["author", "volume", "issue", "pages", "url"]
    };
    FIELD_CONFIG[SOURCE_TYPES.BOOK] = {
      required: ["title", "authorOrEditor", "publisher", "year"],
      optional: ["edition", "place", "isbn", "volume", "series", "doi", "url"]
    };
    FIELD_CONFIG[SOURCE_TYPES.CHAPTER] = {
      required: ["title", "author", "bookTitle", "year"],
      optional: ["editor", "publisher", "pages", "edition", "volume", "doi", "url"]
    };
    FIELD_CONFIG[SOURCE_TYPES.CONFERENCE_PAPER] = {
      required: ["title", "author", "conferenceTitle", "year"],
      optional: ["proceedingsTitle", "pages", "publisher", "place", "publicationDate", "doi", "url"]
    };
    FIELD_CONFIG[SOURCE_TYPES.THESIS] = {
      required: ["title", "author", "institution", "year"],
      optional: ["degree", "advisor", "department", "repository", "url"]
    };
    FIELD_CONFIG[SOURCE_TYPES.REPORT] = {
      required: ["title", "authorOrOrganization", "year"],
      optional: ["reportNumber", "institution", "publisher", "url", "place", "doi"]
    };
    FIELD_CONFIG[SOURCE_TYPES.BLOG_POST] = {
      required: ["title", "authorOrBlogName", "publicationDate", "url"],
      optional: ["websiteTitle", "tags", "category", "updatedDate"]
    };
    FIELD_CONFIG[SOURCE_TYPES.LEGISLATION] = {
      required: ["title", "jurisdiction", "year"],
      optional: ["actNumber", "section", "chapter", "code", "dateEnacted", "url"]
    };
    FIELD_CONFIG[SOURCE_TYPES.LEGAL_CASE] = {
      required: ["caseName", "court", "year"],
      optional: ["docketNumber", "reporter", "volume", "pages", "decisionDate", "jurisdiction", "url"]
    };
    FIELD_CONFIG[SOURCE_TYPES.PATENT] = {
      required: ["title", "inventorOrAssignee", "patentNumber"],
      optional: ["applicationNumber", "filingDate", "publicationDate", "jurisdiction", "url", "patentOffice"]
    };
    FIELD_CONFIG[SOURCE_TYPES.DATASET] = {
      required: ["title", "repository", "identifier"],
      optional: ["author", "version", "releaseDate", "doi", "accession", "url", "license"]
    };
    FIELD_CONFIG[SOURCE_TYPES.SOFTWARE] = {
      required: ["title", "version", "authorOrOrganization"],
      optional: ["releaseDate", "repositoryUrl", "doi", "license", "platform"]
    };
    FIELD_CONFIG[SOURCE_TYPES.MOTION_PICTURE] = {
      required: ["title", "directorOrProducer", "year"],
      optional: ["distributor", "runningTime", "format", "url", "studio"]
    };
    FIELD_CONFIG[SOURCE_TYPES.BROADCAST] = {
      required: ["title", "broadcaster", "publicationDate"],
      optional: ["episode", "network", "host", "station", "url"]
    };

    function normalizeText(text) {
      return String(text || "")
        .replace(/\u00A0/g, " ")
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
    }

    function normalizeWhitespacePreserveLines(text) {
      return String(text || "")
        .replace(/\u00A0/g, " ")
        .replace(/[–—]/g, "-")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .trim();
    }

    function safeMatch(text, rx) {
      return String(text || "").match(rx);
    }

    function firstNonEmpty() {
      var i, value;
      for (i = 0; i < arguments.length; i++) {
        value = arguments[i];
        if (value && String(value).trim()) return String(value).trim();
      }
      return "";
    }

    function uniq(arr) {
      var seen = {};
      var out = [];
      var i, v;
      for (i = 0; i < arr.length; i++) {
        v = arr[i];
        if (!v) continue;
        v = String(v).trim();
        if (!v || seen[v]) continue;
        seen[v] = true;
        out.push(v);
      }
      return out;
    }

    function extractYear(text) {
      var m = safeMatch(text, RX.year);
      return m ? m[0] : "";
    }

    function extractDate(text) {
      return firstNonEmpty(
        safeMatch(text, RX.isoDate) && safeMatch(text, RX.isoDate)[0],
        safeMatch(text, RX.fullDate) && safeMatch(text, RX.fullDate)[0]
      );
    }

    function parseJsonLd(documentObj) {
      var scripts = [].slice.call(documentObj.querySelectorAll('script[type="application/ld+json"]'));
      var items = [];
      var i, raw, parsed, j;

      for (i = 0; i < scripts.length; i++) {
        raw = scripts[i].textContent && scripts[i].textContent.trim();
        if (!raw) continue;
        try {
          parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (j = 0; j < parsed.length; j++) items.push(parsed[j]);
          } else if (parsed && parsed["@graph"] && Array.isArray(parsed["@graph"])) {
            for (j = 0; j < parsed["@graph"].length; j++) items.push(parsed["@graph"][j]);
          } else {
            items.push(parsed);
          }
        } catch (e) {}
      }
      return items;
    }

    function getMeta(documentObj, names, attr) {
      var i, name, el;
      attr = attr || "name";
      for (i = 0; i < names.length; i++) {
        name = names[i];
        el = documentObj.querySelector('meta[' + attr + '="' + name + '"]');
        if (el && el.content && el.content.trim()) return el.content.trim();
      }
      return "";
    }

    function collectDocumentData(documentObj) {
      var bodyText = normalizeText(documentObj.body && documentObj.body.innerText || "");
      var rawLines = normalizeWhitespacePreserveLines(documentObj.body && documentObj.body.innerText || "")
        .split("\n")
        .map(function (x) { return x.trim(); })
        .filter(Boolean);

      var meta = {
        title: getMeta(documentObj, ["citation_title", "dc.title", "dcterms.title", "og:title"], "name") ||
          getMeta(documentObj, ["og:title"], "property"),
        author: getMeta(documentObj, ["citation_author", "author", "dc.creator", "parsely-author"], "name"),
        journalTitle: getMeta(documentObj, ["citation_journal_title"], "name"),
        publicationTitle: getMeta(documentObj, ["og:site_name"], "property") ||
          getMeta(documentObj, ["application-name", "dc.publisher"], "name"),
        doi: getMeta(documentObj, ["citation_doi", "dc.identifier"], "name"),
        pdfUrl: getMeta(documentObj, ["citation_pdf_url"], "name"),
        publicationDate: getMeta(documentObj, ["citation_publication_date", "article:published_time"], "name") ||
          getMeta(documentObj, ["article:published_time"], "property"),
        modifiedDate: getMeta(documentObj, ["article:modified_time"], "property") ||
          getMeta(documentObj, ["last-modified"], "http-equiv"),
        description: getMeta(documentObj, ["description", "og:description", "twitter:description"], "name") ||
          getMeta(documentObj, ["og:description"], "property"),
        isbn: getMeta(documentObj, ["citation_isbn"], "name"),
        issn: getMeta(documentObj, ["citation_issn"], "name"),
        volume: getMeta(documentObj, ["citation_volume"], "name"),
        issue: getMeta(documentObj, ["citation_issue"], "name"),
        firstPage: getMeta(documentObj, ["citation_firstpage"], "name"),
        lastPage: getMeta(documentObj, ["citation_lastpage"], "name"),
        conferenceTitle: getMeta(documentObj, ["citation_conference_title"], "name"),
        publisher: getMeta(documentObj, ["citation_publisher", "dc.publisher"], "name"),
        keywords: getMeta(documentObj, ["keywords", "news_keywords"], "name"),
        section: getMeta(documentObj, ["article:section"], "property"),
        type: getMeta(documentObj, ["og:type"], "property")
      };

      var canonical = documentObj.querySelector('link[rel="canonical"]');
      canonical = canonical ? canonical.href : "";
      var title = normalizeText(documentObj.title || meta.title || "");
      var url = location.href;
      var jsonLd = parseJsonLd(documentObj);

      return {
        title: title,
        url: url,
        canonical: canonical,
        bodyText: bodyText,
        rawLines: rawLines,
        meta: meta,
        jsonLd: jsonLd,
        combinedText: normalizeText([
          title,
          url,
          canonical,
          Object.values(meta).join(" "),
          bodyText.slice(0, 50000)
        ].join(" "))
      };
    }

    function addScore(scores, evidence, type, weight, reason, match) {
      scores[type] = (scores[type] || 0) + weight;
      evidence.push({ type: type, weight: weight, reason: reason, match: match || "" });
    }

    function detectSourceType(data) {
      var text = data.combinedText;
      var scores = {};
      var evidence = [];
      var i, item, type;

      if (data.meta.doi || RX.doi.test(text) || RX.doiUrl.test(text)) {
        addScore(scores, evidence, SOURCE_TYPES.JOURNAL_ARTICLE, 8, "doi", data.meta.doi || (safeMatch(text, RX.doi) || [])[0] || "");
      }
      if (data.meta.journalTitle || RX.journalCue.test(text)) {
        addScore(scores, evidence, SOURCE_TYPES.JOURNAL_ARTICLE, 6, "journal_title", data.meta.journalTitle || (safeMatch(text, RX.journalCue) || [])[0] || "");
      }
      if (data.meta.volume || RX.volume.test(text)) {
        addScore(scores, evidence, SOURCE_TYPES.JOURNAL_ARTICLE, 4, "volume", data.meta.volume || (safeMatch(text, RX.volume) || [])[0] || "");
      }
      if (data.meta.issue || RX.issue.test(text)) {
        addScore(scores, evidence, SOURCE_TYPES.JOURNAL_ARTICLE, 4, "issue", data.meta.issue || (safeMatch(text, RX.issue) || [])[0] || "");
      }
      if (data.meta.firstPage || RX.pages.test(text) || RX.compactJournal.test(text)) {
        addScore(scores, evidence, SOURCE_TYPES.JOURNAL_ARTICLE, 3, "pages", (safeMatch(text, RX.pages) || [])[0] || (safeMatch(text, RX.compactJournal) || [])[0] || "");
      }

      if (data.meta.section || RX.newsOutlet.test(text)) {
        addScore(scores, evidence, SOURCE_TYPES.NEWS_ARTICLE, 5, "news_signal", data.meta.section || (safeMatch(text, RX.newsOutlet) || [])[0] || "");
      }
      if (RX.fullDate.test(text) || data.meta.publicationDate) {
        addScore(scores, evidence, SOURCE_TYPES.NEWS_ARTICLE, 2, "date_present", data.meta.publicationDate || (safeMatch(text, RX.fullDate) || [])[0] || "");
      }
      if (/article/i.test(data.meta.type || "")) {
        addScore(scores, evidence, SOURCE_TYPES.NEWS_ARTICLE, 2, "og_type_article", data.meta.type);
      }

      if (RX.magazine.test(text)) addScore(scores, evidence, SOURCE_TYPES.MAGAZINE_ARTICLE, 6, "magazine_word", (safeMatch(text, RX.magazine) || [])[0] || "");
      if (RX.blog.test(text)) addScore(scores, evidence, SOURCE_TYPES.BLOG_POST, 7, "blog_signal", (safeMatch(text, RX.blog) || [])[0] || "");
      if (/blog/i.test(data.meta.type || "")) addScore(scores, evidence, SOURCE_TYPES.BLOG_POST, 5, "og_type_blog", data.meta.type);
      if (data.meta.isbn || RX.isbn.test(text)) addScore(scores, evidence, SOURCE_TYPES.BOOK, 10, "isbn", data.meta.isbn || (safeMatch(text, RX.isbn) || [])[0] || "");
      if (data.meta.publisher || RX.publisherCue.test(text)) addScore(scores, evidence, SOURCE_TYPES.BOOK, 4, "publisher", data.meta.publisher || (safeMatch(text, RX.publisherCue) || [])[0] || "");
      if (RX.edition.test(text)) addScore(scores, evidence, SOURCE_TYPES.BOOK, 4, "edition", (safeMatch(text, RX.edition) || [])[0] || "");
      if (RX.chapterIn.test(text)) addScore(scores, evidence, SOURCE_TYPES.CHAPTER, 8, "in_colon", (safeMatch(text, RX.chapterIn) || [])[0] || "");
      if (RX.editors.test(text)) addScore(scores, evidence, SOURCE_TYPES.CHAPTER, 5, "editors", (safeMatch(text, RX.editors) || [])[0] || "");
      if (data.meta.conferenceTitle || RX.proceedings.test(text)) addScore(scores, evidence, SOURCE_TYPES.CONFERENCE_PAPER, 9, "proceedings_or_conference_title", data.meta.conferenceTitle || (safeMatch(text, RX.proceedings) || [])[0] || "");
      if (RX.conference.test(text)) addScore(scores, evidence, SOURCE_TYPES.CONFERENCE_PAPER, 6, "conference_word", (safeMatch(text, RX.conference) || [])[0] || "");
      if (RX.thesis.test(text)) addScore(scores, evidence, SOURCE_TYPES.THESIS, 10, "thesis_word", (safeMatch(text, RX.thesis) || [])[0] || "");
      if (RX.degree.test(text)) addScore(scores, evidence, SOURCE_TYPES.THESIS, 5, "degree_word", (safeMatch(text, RX.degree) || [])[0] || "");
      if (RX.report.test(text)) addScore(scores, evidence, SOURCE_TYPES.REPORT, 8, "report_word", (safeMatch(text, RX.report) || [])[0] || "");
      if ((safeMatch(text, RX.reportNumber) || [])[1]) addScore(scores, evidence, SOURCE_TYPES.REPORT, 5, "report_number", (safeMatch(text, RX.reportNumber) || [])[1] || "");
      if (RX.legislation.test(text)) addScore(scores, evidence, SOURCE_TYPES.LEGISLATION, 8, "legislation_word", (safeMatch(text, RX.legislation) || [])[0] || "");
      if (RX.jurisdiction.test(text)) addScore(scores, evidence, SOURCE_TYPES.LEGISLATION, 3, "jurisdiction", (safeMatch(text, RX.jurisdiction) || [])[0] || "");
      if (RX.legalCase.test(text)) addScore(scores, evidence, SOURCE_TYPES.LEGAL_CASE, 8, "case_name_pattern", (safeMatch(text, RX.legalCase) || [])[0] || "");
      if (RX.court.test(text)) addScore(scores, evidence, SOURCE_TYPES.LEGAL_CASE, 5, "court_word", (safeMatch(text, RX.court) || [])[0] || "");
      if (RX.courtNeutralCitation.test(text)) addScore(scores, evidence, SOURCE_TYPES.LEGAL_CASE, 6, "neutral_citation", (safeMatch(text, RX.courtNeutralCitation) || [])[0] || "");
      if (RX.patent.test(text)) addScore(scores, evidence, SOURCE_TYPES.PATENT, 10, "patent_word", (safeMatch(text, RX.patent) || [])[0] || "");
      if ((safeMatch(text, RX.patentNumber) || [])[1]) addScore(scores, evidence, SOURCE_TYPES.PATENT, 6, "patent_number", (safeMatch(text, RX.patentNumber) || [])[1] || "");
      if (RX.datasetAccession.test(text)) addScore(scores, evidence, SOURCE_TYPES.DATASET, 10, "dataset_accession", (safeMatch(text, RX.datasetAccession) || [])[0] || "");
      if (RX.datasetRepo.test(text)) addScore(scores, evidence, SOURCE_TYPES.DATASET, 6, "dataset_repository", (safeMatch(text, RX.datasetRepo) || [])[0] || "");
      if (RX.software.test(text)) addScore(scores, evidence, SOURCE_TYPES.SOFTWARE, 7, "software_word", (safeMatch(text, RX.software) || [])[0] || "");
      if ((safeMatch(text, RX.version) || [])[1]) addScore(scores, evidence, SOURCE_TYPES.SOFTWARE, 4, "version", (safeMatch(text, RX.version) || [])[1] || "");
      if (RX.motionPicture.test(text)) addScore(scores, evidence, SOURCE_TYPES.MOTION_PICTURE, 8, "motion_picture_word", (safeMatch(text, RX.motionPicture) || [])[0] || "");
      if ((safeMatch(text, RX.runtime) || [])[1]) addScore(scores, evidence, SOURCE_TYPES.MOTION_PICTURE, 3, "runtime", (safeMatch(text, RX.runtime) || [])[1] || "");
      if (RX.broadcast.test(text)) addScore(scores, evidence, SOURCE_TYPES.BROADCAST, 8, "broadcast_word", (safeMatch(text, RX.broadcast) || [])[0] || "");
      if (data.url || RX.url.test(text)) addScore(scores, evidence, SOURCE_TYPES.WEBPAGE, 3, "url", data.url || (safeMatch(text, RX.url) || [])[0] || "");
      if (RX.accessed.test(text)) addScore(scores, evidence, SOURCE_TYPES.WEBPAGE, 2, "accessed_word", (safeMatch(text, RX.accessed) || [])[0] || "");

      for (i = 0; i < data.jsonLd.length; i++) {
        item = data.jsonLd[i];
        type = String(item && item["@type"] || "").toLowerCase();
        if (type.indexOf("scholarlyarticle") >= 0) addScore(scores, evidence, SOURCE_TYPES.JOURNAL_ARTICLE, 10, "jsonld_scholarlyarticle", type);
        if (type.indexOf("newsarticle") >= 0) addScore(scores, evidence, SOURCE_TYPES.NEWS_ARTICLE, 10, "jsonld_newsarticle", type);
        if (type.indexOf("article") >= 0) addScore(scores, evidence, SOURCE_TYPES.WEBPAGE, 2, "jsonld_article", type);
        if (type.indexOf("blogposting") >= 0) addScore(scores, evidence, SOURCE_TYPES.BLOG_POST, 10, "jsonld_blogposting", type);
        if (type.indexOf("book") >= 0) addScore(scores, evidence, SOURCE_TYPES.BOOK, 10, "jsonld_book", type);
        if (type.indexOf("chapter") >= 0) addScore(scores, evidence, SOURCE_TYPES.CHAPTER, 10, "jsonld_chapter", type);
        if (type.indexOf("report") >= 0) addScore(scores, evidence, SOURCE_TYPES.REPORT, 10, "jsonld_report", type);
        if (type.indexOf("dataset") >= 0) addScore(scores, evidence, SOURCE_TYPES.DATASET, 10, "jsonld_dataset", type);
        if (type.indexOf("softwareapplication") >= 0) addScore(scores, evidence, SOURCE_TYPES.SOFTWARE, 10, "jsonld_softwareapplication", type);
        if (type.indexOf("movie") >= 0 || type.indexOf("videoobject") >= 0) addScore(scores, evidence, SOURCE_TYPES.MOTION_PICTURE, 8, "jsonld_movie_video", type);
        if (type.indexOf("podcastepisode") >= 0 || type.indexOf("radioepisode") >= 0) addScore(scores, evidence, SOURCE_TYPES.BROADCAST, 9, "jsonld_broadcast", type);
      }

      var ranked = Object.keys(scores).map(function (k) { return { type: k, score: scores[k] }; })
        .sort(function (a, b) { return b.score - a.score; });

      var best = ranked[0] || { type: SOURCE_TYPES.UNKNOWN, score: 0 };
      var totalPositive = ranked.filter(function (x) { return x.score > 0; })
        .reduce(function (sum, x) { return sum + x.score; }, 0);
      var confidence = totalPositive > 0 ? best.score / totalPositive : 0;

      return {
        sourceType: best.score > 0 ? best.type : SOURCE_TYPES.UNKNOWN,
        confidence: confidence,
        rankedCandidates: ranked.slice(0, 5),
        evidence: evidence
      };
    }

    function escapeRegex(text) {
      return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function extractByLabel(lines, labels) {
      var lowerLabels = labels.map(function (x) { return x.toLowerCase(); });
      var i, j, line, label, patterns, k, m;
      for (i = 0; i < lines.length; i++) {
        line = lines[i];
        for (j = 0; j < lowerLabels.length; j++) {
          label = lowerLabels[j];
          patterns = [
            new RegExp("^" + escapeRegex(label) + "\\s*[:\\-]\\s*(.+)$", "i"),
            new RegExp("\\b" + escapeRegex(label) + "\\b\\s*[:\\-]\\s*(.+)$", "i"),
            new RegExp("\\b" + escapeRegex(label) + "\\b\\s+(.+)$", "i")
          ];
          for (k = 0; k < patterns.length; k++) {
            m = line.match(patterns[k]);
            if (m && m[1] && m[1].trim()) return m[1].trim();
          }
        }
      }
      return "";
    }

    function extractRegexValue(text, regex, groupIndex) {
      var m = text.match(regex);
      groupIndex = groupIndex || 1;
      return m && m[groupIndex] ? String(m[groupIndex]).trim() : "";
    }

    function getJsonLdValue(obj, path) {
      var parts = path.split(".");
      var current = obj;
      var i;
      for (i = 0; i < parts.length; i++) {
        if (current == null) return undefined;
        current = current[parts[i]];
      }
      return current;
    }

    function normalizeJsonLdLeaf(value) {
      if (!value) return "";
      if (typeof value === "string") return value.trim();
      if (Array.isArray(value)) {
        return value.map(normalizeJsonLdLeaf).filter(Boolean).join("; ");
      }
      if (typeof value === "object") {
        return firstNonEmpty(
          value.name,
          value.headline,
          value.title,
          value["@id"],
          value.url,
          value.familyName && value.givenName ? (value.givenName + " " + value.familyName) : ""
        );
      }
      return String(value).trim();
    }

    function extractMetaOrJsonLd(data, fieldAliases) {
      var out = [];
      var i, alias, value, j, item, normalized;
      fieldAliases = fieldAliases || {};
      for (i = 0; i < (fieldAliases.meta || []).length; i++) {
        alias = fieldAliases.meta[i];
        value = data.meta[alias];
        if (value) out.push(value);
      }
      for (i = 0; i < data.jsonLd.length; i++) {
        item = data.jsonLd[i];
        for (j = 0; j < (fieldAliases.jsonld || []).length; j++) {
          alias = fieldAliases.jsonld[j];
          value = getJsonLdValue(item, alias);
          if (Array.isArray(value)) {
            out = out.concat(value.map(normalizeJsonLdLeaf).filter(Boolean));
          } else {
            normalized = normalizeJsonLdLeaf(value);
            if (normalized) out.push(normalized);
          }
        }
      }
      return uniq(out);
    }

    function extractBookTitleFromInPattern(text) {
      var m = text.match(/\bIn:\s*([^\.]+?)(?:\.\s|,\s(?:Ed\.|Eds\.|edited by))/i);
      return m && m[1] ? m[1].trim() : "";
    }

    function extractConferenceTitle(text) {
      var m = text.match(/\b(?:Proceedings of\s+the\s+)?([^\.]*?(?:conference|symposium|workshop|congress|meeting)[^\.]*)/i);
      return m && m[1] ? m[1].trim() : "";
    }

    function extractCaseName(text, lines) {
      var i, line, m;
      for (i = 0; i < lines.length; i++) {
        line = lines[i];
        if (/\b(?:\w+\s+v\.\s+\w+|\w+\s+vs\.\s+\w+|\w+\s+versus\s+\w+)/i.test(line)) return line.trim();
      }
      m = text.match(/\b([A-Z][A-Za-z0-9&.'\- ]+\s+(?:v\.|vs\.|versus)\s+[A-Z][A-Za-z0-9&.'\- ]+)\b/);
      return m && m[1] ? m[1].trim() : "";
    }

    function extractFieldSetByType(sourceType, data) {
      var text = data.combinedText;
      var lines = data.rawLines;

      var common = {
        title: firstNonEmpty.apply(null, extractMetaOrJsonLd(data, { meta: ["title"], jsonld: ["headline", "name", "title"] }).concat([data.title])),
        url: firstNonEmpty(data.canonical, data.url),
        author: firstNonEmpty.apply(null, extractMetaOrJsonLd(data, { meta: ["author"], jsonld: ["author", "creator"] }).concat([
          extractByLabel(lines, ["author", "authors", "written by", "by", "creator"])
        ])),
        publicationDate: firstNonEmpty.apply(null, extractMetaOrJsonLd(data, { meta: ["publicationDate"], jsonld: ["datePublished", "dateCreated"] }).concat([
          data.meta.publicationDate,
          extractByLabel(lines, ["publication date", "published", "date", "issued"]),
          extractDate(text)
        ])),
        year: firstNonEmpty(extractYear(data.meta.publicationDate), extractYear(text)),
        doi: firstNonEmpty(
          data.meta.doi,
          extractMetaOrJsonLd(data, { meta: ["doi"], jsonld: ["identifier", "sameAs"] }).filter(function (v) { return RX.doi.test(v); })[0],
          (safeMatch(text, RX.doi) || [])[0],
          (safeMatch(text, RX.doiUrl) || [])[0]
        ),
        description: firstNonEmpty(
          data.meta.description,
          extractMetaOrJsonLd(data, { meta: ["description"], jsonld: ["description", "abstract"] })[0]
        )
      };

      switch (sourceType) {
        case SOURCE_TYPES.WEBPAGE:
          return {
            title: common.title,
            url: common.url,
            author: common.author,
            websiteTitle: firstNonEmpty(
              data.meta.publicationTitle,
              extractMetaOrJsonLd(data, { meta: ["publicationTitle"], jsonld: ["publisher.name", "isPartOf.name"] })[0]
            ),
            publicationDate: common.publicationDate,
            updatedDate: firstNonEmpty(
              data.meta.modifiedDate,
              extractMetaOrJsonLd(data, { meta: [], jsonld: ["dateModified"] })[0]
            ),
            accessedDate: "",
            organization: firstNonEmpty(
              extractMetaOrJsonLd(data, { meta: [], jsonld: ["publisher.name", "sourceOrganization.name"] })[0],
              extractByLabel(lines, ["organization", "publisher", "institution", "site owner"])
            ),
            description: common.description
          };

        case SOURCE_TYPES.JOURNAL_ARTICLE:
          return {
            title: common.title,
            author: common.author,
            journalTitle: firstNonEmpty(
              data.meta.journalTitle,
              extractMetaOrJsonLd(data, { meta: ["journalTitle"], jsonld: ["isPartOf.name", "publication.name"] })[0],
              extractByLabel(lines, ["journal", "journal title", "publication", "periodical"])
            ),
            year: common.year,
            volume: firstNonEmpty(data.meta.volume, extractRegexValue(text, RX.volume, 1), extractRegexValue(text, RX.compactJournal, 1)),
            issue: firstNonEmpty(data.meta.issue, extractRegexValue(text, RX.issue, 1), extractRegexValue(text, RX.compactJournal, 2)),
            pages: firstNonEmpty(
              data.meta.firstPage && data.meta.lastPage ? (data.meta.firstPage + "-" + data.meta.lastPage) : "",
              ((safeMatch(text, RX.pages) || [])[0] || "").replace(/^pp?\.?\s*/i, ""),
              extractRegexValue(text, RX.compactJournal, 3) && extractRegexValue(text, RX.compactJournal, 4)
                ? (extractRegexValue(text, RX.compactJournal, 3) + "-" + extractRegexValue(text, RX.compactJournal, 4))
                : ""
            ),
            doi: common.doi,
            url: common.url,
            issn: firstNonEmpty(data.meta.issn, (safeMatch(text, RX.issn) || [])[0]),
            publicationDate: common.publicationDate,
            abstract: firstNonEmpty(
              extractMetaOrJsonLd(data, { meta: [], jsonld: ["description", "abstract"] })[0],
              common.description
            )
          };

        case SOURCE_TYPES.NEWS_ARTICLE:
        case SOURCE_TYPES.MAGAZINE_ARTICLE:
          return {
            title: common.title,
            publicationTitle: firstNonEmpty(
              data.meta.publicationTitle,
              extractMetaOrJsonLd(data, { meta: ["publicationTitle"], jsonld: ["isPartOf.name", "publisher.name"] })[0],
              extractByLabel(lines, ["newspaper", "publication", "magazine", "source"])
            ),
            publicationDate: common.publicationDate,
            author: common.author,
            section: firstNonEmpty(data.meta.section, extractByLabel(lines, ["section", "category", "desk"])),
            page: firstNonEmpty(extractByLabel(lines, ["page", "p.", "pp."])),
            volume: sourceType === SOURCE_TYPES.MAGAZINE_ARTICLE ? firstNonEmpty(data.meta.volume, extractRegexValue(text, RX.volume, 1)) : "",
            issue: sourceType === SOURCE_TYPES.MAGAZINE_ARTICLE ? firstNonEmpty(data.meta.issue, extractRegexValue(text, RX.issue, 1)) : "",
            pages: sourceType === SOURCE_TYPES.MAGAZINE_ARTICLE ? firstNonEmpty(((safeMatch(text, RX.pages) || [])[0] || "").replace(/^pp?\.?\s*/i, "")) : "",
            url: common.url,
            accessedDate: ""
          };

        case SOURCE_TYPES.BOOK:
          return {
            title: common.title,
            authorOrEditor: firstNonEmpty(
              common.author,
              extractMetaOrJsonLd(data, { meta: [], jsonld: ["editor"] })[0],
              extractByLabel(lines, ["editor", "editors", "edited by", "ed.", "eds."])
            ),
            publisher: firstNonEmpty(
              data.meta.publisher,
              extractMetaOrJsonLd(data, { meta: ["publisher"], jsonld: ["publisher.name"] })[0],
              extractByLabel(lines, ["publisher", "published by", "imprint", "press"]),
              (safeMatch(text, RX.publisherCue) || [])[0]
            ),
            year: common.year,
            edition: firstNonEmpty(extractByLabel(lines, ["edition", "ed."]), (safeMatch(text, RX.edition) || [])[1]),
            place: firstNonEmpty(extractByLabel(lines, ["place", "location", "city", "place of publication"])),
            isbn: firstNonEmpty(data.meta.isbn, (safeMatch(text, RX.isbn) || [])[0]),
            volume: firstNonEmpty(extractRegexValue(text, RX.volume, 1)),
            series: firstNonEmpty(extractByLabel(lines, ["series", "series title"])),
            doi: common.doi,
            url: common.url
          };

        case SOURCE_TYPES.CHAPTER:
          return {
            title: common.title,
            author: common.author,
            bookTitle: firstNonEmpty(
              extractMetaOrJsonLd(data, { meta: [], jsonld: ["isPartOf.name"] })[0],
              extractByLabel(lines, ["book title", "container title", "source book"]),
              extractBookTitleFromInPattern(text)
            ),
            year: common.year,
            editor: firstNonEmpty(
              extractMetaOrJsonLd(data, { meta: [], jsonld: ["editor"] })[0],
              extractByLabel(lines, ["editor", "editors", "edited by", "ed.", "eds."])
            ),
            publisher: firstNonEmpty(
              data.meta.publisher,
              extractMetaOrJsonLd(data, { meta: ["publisher"], jsonld: ["publisher.name"] })[0],
              extractByLabel(lines, ["publisher", "published by", "press"])
            ),
            pages: firstNonEmpty(((safeMatch(text, RX.pages) || [])[0] || "").replace(/^pp?\.?\s*/i, "")),
            edition: firstNonEmpty(extractByLabel(lines, ["edition", "ed."]), (safeMatch(text, RX.edition) || [])[1]),
            volume: firstNonEmpty(extractRegexValue(text, RX.volume, 1)),
            doi: common.doi,
            url: common.url
          };

        case SOURCE_TYPES.CONFERENCE_PAPER:
          return {
            title: common.title,
            author: common.author,
            conferenceTitle: firstNonEmpty(
              data.meta.conferenceTitle,
              extractMetaOrJsonLd(data, { meta: ["conferenceTitle"], jsonld: ["event.name"] })[0],
              extractByLabel(lines, ["conference", "conference title", "event", "meeting", "symposium", "workshop"]),
              extractConferenceTitle(text)
            ),
            year: common.year,
            proceedingsTitle: firstNonEmpty(
              extractByLabel(lines, ["proceedings", "proceedings title", "published in"]),
              (safeMatch(text, RX.proceedings) || [])[0]
            ),
            pages: firstNonEmpty(((safeMatch(text, RX.pages) || [])[0] || "").replace(/^pp?\.?\s*/i, "")),
            publisher: firstNonEmpty(
              data.meta.publisher,
              extractMetaOrJsonLd(data, { meta: ["publisher"], jsonld: ["publisher.name"] })[0],
              extractByLabel(lines, ["publisher", "organization", "press"])
            ),
            place: firstNonEmpty(extractByLabel(lines, ["location", "place", "venue", "city"])),
            publicationDate: common.publicationDate,
            doi: common.doi,
            url: common.url
          };

        case SOURCE_TYPES.THESIS:
          return {
            title: common.title,
            author: common.author,
            institution: firstNonEmpty(
              extractMetaOrJsonLd(data, { meta: [], jsonld: ["publisher.name", "sourceOrganization.name"] })[0],
              extractByLabel(lines, ["university", "institution", "school", "college"])
            ),
            year: common.year,
            degree: firstNonEmpty(
              extractByLabel(lines, ["degree", "thesis type", "phd", "msc", "dissertation"]),
              (safeMatch(text, RX.degree) || [])[0],
              (safeMatch(text, RX.thesis) || [])[0]
            ),
            advisor: firstNonEmpty(extractByLabel(lines, ["advisor", "supervisor", "mentor"])),
            department: firstNonEmpty(extractByLabel(lines, ["department", "faculty", "school"])),
            repository: firstNonEmpty(extractByLabel(lines, ["repository", "archive", "database"])),
            url: common.url
          };

        case SOURCE_TYPES.REPORT:
          return {
            title: common.title,
            authorOrOrganization: firstNonEmpty(
              common.author,
              extractMetaOrJsonLd(data, { meta: [], jsonld: ["publisher.name", "sourceOrganization.name"] })[0],
              extractByLabel(lines, ["organization", "institution", "agency", "department", "ministry"])
            ),
            year: common.year,
            reportNumber: firstNonEmpty(
              extractByLabel(lines, ["report no", "report number", "document number", "series number"]),
              extractRegexValue(text, RX.reportNumber, 1)
            ),
            institution: firstNonEmpty(extractByLabel(lines, ["institution", "organization", "agency", "department", "ministry"])),
            publisher: firstNonEmpty(
              data.meta.publisher,
              extractMetaOrJsonLd(data, { meta: ["publisher"], jsonld: ["publisher.name"] })[0],
              extractByLabel(lines, ["publisher", "published by"])
            ),
            url: common.url,
            place: firstNonEmpty(extractByLabel(lines, ["location", "city", "place of publication"])),
            doi: common.doi
          };

        case SOURCE_TYPES.BLOG_POST:
          return {
            title: common.title,
            authorOrBlogName: firstNonEmpty(
              common.author,
              data.meta.publicationTitle,
              extractByLabel(lines, ["blog", "weblog", "site", "publication"])
            ),
            publicationDate: common.publicationDate,
            url: common.url,
            websiteTitle: firstNonEmpty(data.meta.publicationTitle),
            tags: firstNonEmpty(data.meta.keywords, extractByLabel(lines, ["tags", "keywords", "labels"])),
            category: firstNonEmpty(data.meta.section, extractByLabel(lines, ["category", "section", "topic"])),
            updatedDate: firstNonEmpty(
              data.meta.modifiedDate,
              extractMetaOrJsonLd(data, { meta: [], jsonld: ["dateModified"] })[0]
            )
          };

        case SOURCE_TYPES.LEGISLATION:
          return {
            title: common.title,
            jurisdiction: firstNonEmpty(
              extractByLabel(lines, ["jurisdiction", "state", "country", "commonwealth", "province"]),
              (safeMatch(text, RX.jurisdiction) || [])[0]
            ),
            year: common.year,
            actNumber: firstNonEmpty(extractByLabel(lines, ["act no", "number", "no.", "chapter", "c."])),
            section: firstNonEmpty(extractByLabel(lines, ["section", "s.", "ss.", "part", "division"])),
            chapter: firstNonEmpty(extractByLabel(lines, ["chapter", "ch."])),
            code: firstNonEmpty(
              extractByLabel(lines, ["code", "statute", "regulation", "ordinance", "bill"]),
              (safeMatch(text, RX.legislation) || [])[0]
            ),
            dateEnacted: firstNonEmpty(extractByLabel(lines, ["date enacted", "enacted", "assented", "date"]), extractDate(text)),
            url: common.url
          };

        case SOURCE_TYPES.LEGAL_CASE:
          return {
            caseName: firstNonEmpty(
              extractMetaOrJsonLd(data, { meta: [], jsonld: ["name", "headline"] })[0],
              extractCaseName(text, lines),
              common.title
            ),
            court: firstNonEmpty(
              extractByLabel(lines, ["court", "tribunal", "bench", "supreme court", "appeal court"]),
              (safeMatch(text, RX.court) || [])[0]
            ),
            year: firstNonEmpty(extractRegexValue(text, RX.courtNeutralCitation, 1), common.year),
            docketNumber: firstNonEmpty(extractByLabel(lines, ["docket", "case no", "no.", "file number"])),
            reporter: firstNonEmpty(extractByLabel(lines, ["reporter", "citation", "neutral citation"]), (safeMatch(text, RX.courtNeutralCitation) || [])[0]),
            volume: firstNonEmpty(extractRegexValue(text, RX.volume, 1)),
            pages: firstNonEmpty(((safeMatch(text, RX.pages) || [])[0] || "").replace(/^pp?\.?\s*/i, "")),
            decisionDate: firstNonEmpty(extractByLabel(lines, ["judgment date", "decided", "date"]), extractDate(text)),
            jurisdiction: firstNonEmpty(extractByLabel(lines, ["jurisdiction", "state", "federal"]), (safeMatch(text, RX.jurisdiction) || [])[0]),
            url: common.url
          };

        case SOURCE_TYPES.PATENT:
          return {
            title: common.title,
            inventorOrAssignee: firstNonEmpty(extractByLabel(lines, ["inventor", "inventors", "assignee", "applicant", "owner"]), common.author),
            patentNumber: firstNonEmpty(
              extractByLabel(lines, ["patent number", "patent no", "publication number", "grant number"]),
              extractRegexValue(text, RX.patentNumber, 1),
              (safeMatch(text, RX.patent) || [])[0]
            ),
            applicationNumber: firstNonEmpty(extractByLabel(lines, ["application number", "application no"]), extractRegexValue(text, RX.applicationNumber, 1)),
            filingDate: firstNonEmpty(extractByLabel(lines, ["filing date", "filed", "application date"])),
            publicationDate: common.publicationDate,
            jurisdiction: firstNonEmpty(extractByLabel(lines, ["country", "office", "us", "ep", "wo", "jp"])),
            url: common.url,
            patentOffice: firstNonEmpty(extractByLabel(lines, ["patent office", "uspto", "epo", "wipo"]))
          };

        case SOURCE_TYPES.DATASET:
          return {
            title: common.title,
            repository: firstNonEmpty(extractByLabel(lines, ["repository", "archive", "database", "source"]), (safeMatch(text, RX.datasetRepo) || [])[0]),
            identifier: firstNonEmpty(
              extractByLabel(lines, ["identifier", "id", "record id", "dataset id", "accession"]),
              (safeMatch(text, RX.datasetAccession) || [])[0],
              common.doi
            ),
            author: common.author,
            version: firstNonEmpty(extractByLabel(lines, ["version", "release", "edition"]), extractRegexValue(text, RX.version, 1)),
            releaseDate: firstNonEmpty(extractByLabel(lines, ["release date", "published", "date", "deposited"]), common.publicationDate),
            doi: common.doi,
            accession: firstNonEmpty((safeMatch(text, RX.datasetAccession) || [])[0]),
            url: common.url,
            license: firstNonEmpty(extractByLabel(lines, ["license", "usage rights"]))
          };

        case SOURCE_TYPES.SOFTWARE:
          return {
            title: firstNonEmpty(common.title, extractByLabel(lines, ["software", "name", "package", "tool", "library"])),
            version: firstNonEmpty(extractByLabel(lines, ["version", "release", "build", "tag"]), extractRegexValue(text, RX.version, 1)),
            authorOrOrganization: firstNonEmpty(common.author, extractByLabel(lines, ["developer", "organization", "maintainer", "publisher"])),
            releaseDate: firstNonEmpty(extractByLabel(lines, ["released", "release date", "published", "updated"]), common.publicationDate),
            repositoryUrl: firstNonEmpty(extractByLabel(lines, ["github", "gitlab", "source", "repository", "homepage"]), common.url),
            doi: common.doi,
            license: firstNonEmpty(extractByLabel(lines, ["license"])),
            platform: firstNonEmpty(extractByLabel(lines, ["platform", "operating system", "environment"]))
          };

        case SOURCE_TYPES.MOTION_PICTURE:
          return {
            title: common.title,
            directorOrProducer: firstNonEmpty(
              extractByLabel(lines, ["director", "directed by", "producer", "produced by"]),
              extractMetaOrJsonLd(data, { meta: [], jsonld: ["director", "producer"] })[0]
            ),
            year: common.year,
            distributor: firstNonEmpty(extractByLabel(lines, ["distributor", "distributed by"])),
            runningTime: firstNonEmpty(extractByLabel(lines, ["duration", "running time", "runtime"]), extractRegexValue(text, RX.runtime, 1)),
            format: firstNonEmpty(extractByLabel(lines, ["format", "film", "video", "motion picture"])),
            url: common.url,
            studio: firstNonEmpty(extractByLabel(lines, ["studio", "production company"]))
          };

        case SOURCE_TYPES.BROADCAST:
          return {
            title: common.title,
            broadcaster: firstNonEmpty(extractByLabel(lines, ["broadcaster", "network", "station", "channel"])),
            publicationDate: common.publicationDate,
            episode: firstNonEmpty(extractByLabel(lines, ["episode", "episode number", "season", "series"])),
            network: firstNonEmpty(extractByLabel(lines, ["network"])),
            host: firstNonEmpty(extractByLabel(lines, ["host", "presenter", "anchor"])),
            station: firstNonEmpty(extractByLabel(lines, ["station", "radio station", "television channel"])),
            url: common.url
          };

        default:
          return {
            title: common.title,
            url: common.url,
            author: common.author,
            publicationDate: common.publicationDate,
            description: common.description
          };
      }
    }

    function splitRequiredOptional(sourceType, extracted) {
      var config = FIELD_CONFIG[sourceType] || { required: [], optional: [] };
      var required = {};
      var optional = {};
      var i, field;

      for (i = 0; i < config.required.length; i++) {
        field = config.required[i];
        required[field] = extracted[field] || "";
      }
      for (i = 0; i < config.optional.length; i++) {
        field = config.optional[i];
        optional[field] = extracted[field] || "";
      }
      return { required: required, optional: optional };
    }

    function calcCompleteness(sourceType, required) {
      var config = FIELD_CONFIG[sourceType] || { required: [] };
      if (!config.required.length) return 0;
      var filled = config.required.filter(function (key) { return required[key]; }).length;
      return filled / config.required.length;
    }

    var data = collectDocumentData(doc);
    var detection = detectSourceType(data);
    var extracted = extractFieldSetByType(detection.sourceType, data);
    var split = splitRequiredOptional(detection.sourceType, extracted);

    return {
      sourceType: detection.sourceType,
      confidence: detection.confidence,
      completeness: calcCompleteness(detection.sourceType, split.required),
      required: split.required,
      optional: split.optional,
      extracted: extracted,
      candidates: detection.rankedCandidates,
      evidence: detection.evidence,
      regexExpressions: {
        doi: RX.doi.toString(),
        doiUrl: RX.doiUrl.toString(),
        isbn: RX.isbn.toString(),
        issn: RX.issn.toString(),
        year: RX.year.toString(),
        fullDate: RX.fullDate.toString(),
        isoDate: RX.isoDate.toString(),
        volume: RX.volume.toString(),
        issue: RX.issue.toString(),
        pages: RX.pages.toString(),
        compactJournal: RX.compactJournal.toString(),
        url: RX.url.toString(),
        edition: RX.edition.toString(),
        proceedings: RX.proceedings.toString(),
        conference: RX.conference.toString(),
        thesis: RX.thesis.toString(),
        degree: RX.degree.toString(),
        report: RX.report.toString(),
        legislation: RX.legislation.toString(),
        legalCase: RX.legalCase.toString(),
        court: RX.court.toString(),
        patent: RX.patent.toString(),
        datasetAccession: RX.datasetAccession.toString(),
        datasetRepo: RX.datasetRepo.toString(),
        software: RX.software.toString(),
        motionPicture: RX.motionPicture.toString(),
        broadcast: RX.broadcast.toString(),
        blog: RX.blog.toString(),
        magazine: RX.magazine.toString(),
        newsOutlet: RX.newsOutlet.toString(),
        journalCue: RX.journalCue.toString(),
        publisherCue: RX.publisherCue.toString(),
        chapterIn: RX.chapterIn.toString(),
        editors: RX.editors.toString(),
        jurisdiction: RX.jurisdiction.toString(),
        runtime: RX.runtime.toString(),
        version: RX.version.toString(),
        reportNumber: RX.reportNumber.toString(),
        patentNumber: RX.patentNumber.toString(),
        applicationNumber: RX.applicationNumber.toString(),
        courtNeutralCitation: RX.courtNeutralCitation.toString()
      }
    };
  }

  window.extractStructuredSourceDataFromHtml = extractStructuredSourceDataFromHtml;
})();