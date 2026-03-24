(function () {
  "use strict";

  function extractStructuredSourceDataFromPdfText(rawPdfText, options) {
    options = options || {};

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
      courtNeutralCitation: /\[(\d{4})\]\s+[A-Z][A-Za-z]+\s+\d+/,
      titleLikeLine: /^(?!abstract$|references$|introduction$|contents$|table of contents$)([A-Z0-9][^\n]{8,220})$/i
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

    function normalizePdfText(text) {
      return String(text || "")
        .replace(/\u00A0/g, " ")
        .replace(/-\n(?=\w)/g, "")
        .replace(/[–—]/g, "-")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    function normalizeFlat(text) {
      return normalizePdfText(text).replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
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

    function escapeRegex(text) {
      return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function extractRegexValue(text, regex, groupIndex) {
      var m = text.match(regex);
      groupIndex = groupIndex || 1;
      return m && m[groupIndex] ? String(m[groupIndex]).trim() : "";
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

    function collectAuthorLines(lines) {
      var authorLines = [];
      var seen = {};
      var i, line, value;

      for (i = 0; i < Math.min(lines.length, 20); i++) {
        line = lines[i];
        if (!line) continue;

        if (/^(by|authors?|author information|written by)\b/i.test(line)) {
          value = line.replace(/^(by|authors?|author information|written by)\s*[:\-]?\s*/i, "").trim();
        } else if (
          /^[A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){1,5}(?:,\s*[A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){0,3})*$/i.test(line) &&
          !/(university|department|journal|press|report|conference|school|institute)/i.test(line)
        ) {
          value = line.trim();
        } else {
          value = "";
        }

        if (value && !seen[value]) {
          seen[value] = true;
          authorLines.push(value);
        }
      }
      return authorLines;
    }

    function guessTitle(lines) {
      var candidates = [];
      var i, line;

      function score(s) {
        var v = 0;
        if (s.length >= 20 && s.length <= 160) v += 4;
        if (!/[.?!]$/.test(s)) v += 2;
        if (/[A-Za-z]/.test(s)) v += 2;
        if (!/^(vol|volume|issue|report|doi|issn|isbn)\b/i.test(s)) v += 2;
        return v;
      }

      for (i = 0; i < Math.min(lines.length, 15); i++) {
        line = lines[i].trim();
        if (!line) continue;
        if (line.length < 8 || line.length > 220) continue;
        if (/^(abstract|references|contents|table of contents|introduction|chapter \d+)$/i.test(line)) continue;
        if (/^(doi|issn|isbn|keywords|author|authors|by)\b/i.test(line)) continue;
        if (/^\d+$/.test(line)) continue;
        candidates.push(line);
      }

      if (!candidates.length) return "";
      candidates.sort(function (a, b) { return score(b) - score(a); });
      return candidates[0];
    }

    function extractAbstract(lines, flatText) {
      var idx = -1;
      var i, collected, line, m;

      for (i = 0; i < lines.length; i++) {
        if (/^abstract\b/i.test(lines[i])) {
          idx = i;
          break;
        }
      }

      if (idx >= 0) {
        collected = [];
        for (i = idx; i < Math.min(lines.length, idx + 12); i++) {
          line = lines[i];
          if (i > idx && /^(keywords|introduction|background|methods|references|1\.|i\.)\b/i.test(line)) {
            break;
          }
          collected.push(line.replace(/^abstract\s*[:\-]?\s*/i, "").trim());
        }
        return normalizeFlat(collected.join(" "));
      }

      m = flatText.match(/\babstract\s*[:\-]?\s*(.{40,1200}?)(?:\bkeywords\b|\bintroduction\b|\breferences\b)/i);
      return m && m[1] ? m[1].trim() : "";
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

    function collectPdfData(rawText) {
      var cleaned = normalizePdfText(rawText);
      var lines = cleaned.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      var flatText = normalizeFlat(cleaned);
      var frontMatterText = normalizeFlat(lines.slice(0, 40).join(" "));
      var title = guessTitle(lines);
      var authors = collectAuthorLines(lines);

      return {
        rawText: cleaned,
        lines: lines,
        flatText: flatText,
        frontMatterText: frontMatterText,
        title: title,
        authors: authors,
        url: options.url || "",
        metadata: {
          title: options.metadata && options.metadata.title || "",
          author: options.metadata && options.metadata.author || "",
          doi: options.metadata && options.metadata.doi || "",
          subject: options.metadata && options.metadata.subject || "",
          keywords: options.metadata && options.metadata.keywords || "",
          creator: options.metadata && options.metadata.creator || "",
          producer: options.metadata && options.metadata.producer || ""
        }
      };
    }

    function addScore(scores, evidence, type, weight, reason, match) {
      scores[type] = (scores[type] || 0) + weight;
      evidence.push({ type: type, weight: weight, reason: reason, match: match || "" });
    }

    function detectSourceType(data) {
      var text = data.flatText;
      var scores = {};
      var evidence = [];

      if (data.metadata.doi || RX.doi.test(text) || RX.doiUrl.test(text)) {
        addScore(scores, evidence, SOURCE_TYPES.JOURNAL_ARTICLE, 8, "doi", data.metadata.doi || (safeMatch(text, RX.doi) || [])[0] || "");
      }
      if (RX.journalCue.test(text)) addScore(scores, evidence, SOURCE_TYPES.JOURNAL_ARTICLE, 6, "journal_title", (safeMatch(text, RX.journalCue) || [])[0] || "");
      if (RX.volume.test(text)) addScore(scores, evidence, SOURCE_TYPES.JOURNAL_ARTICLE, 4, "volume", (safeMatch(text, RX.volume) || [])[0] || "");
      if (RX.issue.test(text)) addScore(scores, evidence, SOURCE_TYPES.JOURNAL_ARTICLE, 4, "issue", (safeMatch(text, RX.issue) || [])[0] || "");
      if (RX.pages.test(text) || RX.compactJournal.test(text)) addScore(scores, evidence, SOURCE_TYPES.JOURNAL_ARTICLE, 3, "pages", (safeMatch(text, RX.pages) || [])[0] || (safeMatch(text, RX.compactJournal) || [])[0] || "");
      if (RX.issn.test(text)) addScore(scores, evidence, SOURCE_TYPES.JOURNAL_ARTICLE, 5, "issn", (safeMatch(text, RX.issn) || [])[0] || "");

      if (RX.newsOutlet.test(text)) addScore(scores, evidence, SOURCE_TYPES.NEWS_ARTICLE, 6, "news_signal", (safeMatch(text, RX.newsOutlet) || [])[0] || "");
      if (RX.fullDate.test(text)) addScore(scores, evidence, SOURCE_TYPES.NEWS_ARTICLE, 2, "date_present", (safeMatch(text, RX.fullDate) || [])[0] || "");
      if (RX.magazine.test(text)) addScore(scores, evidence, SOURCE_TYPES.MAGAZINE_ARTICLE, 6, "magazine_word", (safeMatch(text, RX.magazine) || [])[0] || "");
      if (RX.blog.test(text)) addScore(scores, evidence, SOURCE_TYPES.BLOG_POST, 7, "blog_signal", (safeMatch(text, RX.blog) || [])[0] || "");
      if (RX.isbn.test(text)) addScore(scores, evidence, SOURCE_TYPES.BOOK, 10, "isbn", (safeMatch(text, RX.isbn) || [])[0] || "");
      if (RX.publisherCue.test(text)) addScore(scores, evidence, SOURCE_TYPES.BOOK, 4, "publisher", (safeMatch(text, RX.publisherCue) || [])[0] || "");
      if (RX.edition.test(text)) addScore(scores, evidence, SOURCE_TYPES.BOOK, 4, "edition", (safeMatch(text, RX.edition) || [])[0] || "");
      if (RX.chapterIn.test(text)) addScore(scores, evidence, SOURCE_TYPES.CHAPTER, 8, "in_colon", (safeMatch(text, RX.chapterIn) || [])[0] || "");
      if (RX.editors.test(text)) addScore(scores, evidence, SOURCE_TYPES.CHAPTER, 5, "editors", (safeMatch(text, RX.editors) || [])[0] || "");
      if (RX.proceedings.test(text)) addScore(scores, evidence, SOURCE_TYPES.CONFERENCE_PAPER, 9, "proceedings", (safeMatch(text, RX.proceedings) || [])[0] || "");
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

    function extractFieldSetByType(sourceType, data) {
      var text = data.flatText;
      var lines = data.lines;

      var common = {
        title: firstNonEmpty(data.metadata.title, data.title),
        url: firstNonEmpty(data.url, (safeMatch(text, RX.url) || [])[0]),
        author: firstNonEmpty(
          data.metadata.author,
          data.metadata.creator,
          extractByLabel(lines, ["author", "authors", "written by", "by", "creator"]),
          data.authors.join("; ")
        ),
        publicationDate: firstNonEmpty(
          extractByLabel(lines, ["publication date", "published", "date", "issued"]),
          extractDate(text)
        ),
        year: firstNonEmpty(extractYear(text)),
        doi: firstNonEmpty(data.metadata.doi, (safeMatch(text, RX.doi) || [])[0], (safeMatch(text, RX.doiUrl) || [])[0]),
        description: firstNonEmpty(data.metadata.subject, extractAbstract(lines, text))
      };

      switch (sourceType) {
        case SOURCE_TYPES.WEBPAGE:
          return {
            title: common.title,
            url: common.url,
            author: common.author,
            websiteTitle: firstNonEmpty(extractByLabel(lines, ["website", "site name", "publication", "source"])),
            publicationDate: common.publicationDate,
            updatedDate: firstNonEmpty(extractByLabel(lines, ["updated", "last updated", "modified", "revised"])),
            accessedDate: firstNonEmpty(extractByLabel(lines, ["accessed", "access date", "retrieved", "viewed on"])),
            organization: firstNonEmpty(extractByLabel(lines, ["organization", "publisher", "institution", "site owner"])),
            description: common.description
          };

        case SOURCE_TYPES.JOURNAL_ARTICLE:
          return {
            title: common.title,
            author: common.author,
            journalTitle: firstNonEmpty(
              extractByLabel(lines, ["journal", "journal title", "publication", "periodical"]),
              (safeMatch(text, RX.journalCue) || [])[0]
            ),
            year: common.year,
            volume: firstNonEmpty(extractRegexValue(text, RX.volume, 1), extractRegexValue(text, RX.compactJournal, 1)),
            issue: firstNonEmpty(extractRegexValue(text, RX.issue, 1), extractRegexValue(text, RX.compactJournal, 2)),
            pages: firstNonEmpty(
              ((safeMatch(text, RX.pages) || [])[0] || "").replace(/^pp?\.?\s*/i, ""),
              extractRegexValue(text, RX.compactJournal, 3) && extractRegexValue(text, RX.compactJournal, 4)
                ? (extractRegexValue(text, RX.compactJournal, 3) + "-" + extractRegexValue(text, RX.compactJournal, 4))
                : ""
            ),
            doi: common.doi,
            url: common.url,
            issn: firstNonEmpty((safeMatch(text, RX.issn) || [])[0]),
            publicationDate: common.publicationDate,
            abstract: common.description
          };

        case SOURCE_TYPES.NEWS_ARTICLE:
        case SOURCE_TYPES.MAGAZINE_ARTICLE:
          return {
            title: common.title,
            publicationTitle: firstNonEmpty(
              extractByLabel(lines, ["newspaper", "publication", "magazine", "source"]),
              sourceType === SOURCE_TYPES.NEWS_ARTICLE ? (safeMatch(text, RX.newsOutlet) || [])[0] : "",
              sourceType === SOURCE_TYPES.MAGAZINE_ARTICLE ? (safeMatch(text, RX.magazine) || [])[0] : ""
            ),
            publicationDate: common.publicationDate,
            author: common.author,
            section: firstNonEmpty(extractByLabel(lines, ["section", "category", "desk"])),
            page: firstNonEmpty(extractByLabel(lines, ["page", "p.", "pp."])),
            volume: sourceType === SOURCE_TYPES.MAGAZINE_ARTICLE ? firstNonEmpty(extractRegexValue(text, RX.volume, 1)) : "",
            issue: sourceType === SOURCE_TYPES.MAGAZINE_ARTICLE ? firstNonEmpty(extractRegexValue(text, RX.issue, 1)) : "",
            pages: sourceType === SOURCE_TYPES.MAGAZINE_ARTICLE ? firstNonEmpty(((safeMatch(text, RX.pages) || [])[0] || "").replace(/^pp?\.?\s*/i, "")) : "",
            url: common.url,
            accessedDate: ""
          };

        case SOURCE_TYPES.BOOK:
          return {
            title: common.title,
            authorOrEditor: firstNonEmpty(common.author, extractByLabel(lines, ["editor", "editors", "edited by", "ed.", "eds."])),
            publisher: firstNonEmpty(extractByLabel(lines, ["publisher", "published by", "imprint", "press"]), (safeMatch(text, RX.publisherCue) || [])[0]),
            year: common.year,
            edition: firstNonEmpty(extractByLabel(lines, ["edition", "ed."]), (safeMatch(text, RX.edition) || [])[1]),
            place: firstNonEmpty(extractByLabel(lines, ["place", "location", "city", "place of publication"])),
            isbn: firstNonEmpty((safeMatch(text, RX.isbn) || [])[0]),
            volume: firstNonEmpty(extractRegexValue(text, RX.volume, 1)),
            series: firstNonEmpty(extractByLabel(lines, ["series", "series title"])),
            doi: common.doi,
            url: common.url
          };

        case SOURCE_TYPES.CHAPTER:
          return {
            title: common.title,
            author: common.author,
            bookTitle: firstNonEmpty(extractByLabel(lines, ["book title", "container title", "source book"]), extractBookTitleFromInPattern(text)),
            year: common.year,
            editor: firstNonEmpty(extractByLabel(lines, ["editor", "editors", "edited by", "ed.", "eds."])),
            publisher: firstNonEmpty(extractByLabel(lines, ["publisher", "published by", "press"])),
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
              extractByLabel(lines, ["conference", "conference title", "event", "meeting", "symposium", "workshop"]),
              extractConferenceTitle(text)
            ),
            year: common.year,
            proceedingsTitle: firstNonEmpty(extractByLabel(lines, ["proceedings", "proceedings title", "published in"]), (safeMatch(text, RX.proceedings) || [])[0]),
            pages: firstNonEmpty(((safeMatch(text, RX.pages) || [])[0] || "").replace(/^pp?\.?\s*/i, "")),
            publisher: firstNonEmpty(extractByLabel(lines, ["publisher", "organization", "press"])),
            place: firstNonEmpty(extractByLabel(lines, ["location", "place", "venue", "city"])),
            publicationDate: common.publicationDate,
            doi: common.doi,
            url: common.url
          };

        case SOURCE_TYPES.THESIS:
          return {
            title: common.title,
            author: common.author,
            institution: firstNonEmpty(extractByLabel(lines, ["university", "institution", "school", "college"])),
            year: common.year,
            degree: firstNonEmpty(extractByLabel(lines, ["degree", "thesis type", "phd", "msc", "dissertation"]), (safeMatch(text, RX.degree) || [])[0], (safeMatch(text, RX.thesis) || [])[0]),
            advisor: firstNonEmpty(extractByLabel(lines, ["advisor", "supervisor", "mentor"])),
            department: firstNonEmpty(extractByLabel(lines, ["department", "faculty", "school"])),
            repository: firstNonEmpty(extractByLabel(lines, ["repository", "archive", "database"])),
            url: common.url
          };

        case SOURCE_TYPES.REPORT:
          return {
            title: common.title,
            authorOrOrganization: firstNonEmpty(common.author, extractByLabel(lines, ["organization", "institution", "agency", "department", "ministry"])),
            year: common.year,
            reportNumber: firstNonEmpty(extractByLabel(lines, ["report no", "report number", "document number", "series number"]), extractRegexValue(text, RX.reportNumber, 1)),
            institution: firstNonEmpty(extractByLabel(lines, ["institution", "organization", "agency", "department", "ministry"])),
            publisher: firstNonEmpty(extractByLabel(lines, ["publisher", "published by"])),
            url: common.url,
            place: firstNonEmpty(extractByLabel(lines, ["location", "city", "place of publication"])),
            doi: common.doi
          };

        case SOURCE_TYPES.BLOG_POST:
          return {
            title: common.title,
            authorOrBlogName: firstNonEmpty(common.author, extractByLabel(lines, ["blog", "weblog", "site", "publication"])),
            publicationDate: common.publicationDate,
            url: common.url,
            websiteTitle: firstNonEmpty(extractByLabel(lines, ["website", "site name", "blog", "publication"])),
            tags: firstNonEmpty(extractByLabel(lines, ["tags", "keywords", "labels"])),
            category: firstNonEmpty(extractByLabel(lines, ["category", "section", "topic"])),
            updatedDate: firstNonEmpty(extractByLabel(lines, ["updated", "modified", "last updated"]))
          };

        case SOURCE_TYPES.LEGISLATION:
          return {
            title: common.title,
            jurisdiction: firstNonEmpty(extractByLabel(lines, ["jurisdiction", "state", "country", "commonwealth", "province"]), (safeMatch(text, RX.jurisdiction) || [])[0]),
            year: common.year,
            actNumber: firstNonEmpty(extractByLabel(lines, ["act no", "number", "no.", "chapter", "c."])),
            section: firstNonEmpty(extractByLabel(lines, ["section", "s.", "ss.", "part", "division"])),
            chapter: firstNonEmpty(extractByLabel(lines, ["chapter", "ch."])),
            code: firstNonEmpty(extractByLabel(lines, ["code", "statute", "regulation", "ordinance", "bill"]), (safeMatch(text, RX.legislation) || [])[0]),
            dateEnacted: firstNonEmpty(extractByLabel(lines, ["date enacted", "enacted", "assented", "date"]), extractDate(text)),
            url: common.url
          };

        case SOURCE_TYPES.LEGAL_CASE:
          return {
            caseName: firstNonEmpty(extractCaseName(text, lines), common.title),
            court: firstNonEmpty(extractByLabel(lines, ["court", "tribunal", "bench", "supreme court", "appeal court"]), (safeMatch(text, RX.court) || [])[0]),
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
            identifier: firstNonEmpty(extractByLabel(lines, ["identifier", "id", "record id", "dataset id", "accession"]), (safeMatch(text, RX.datasetAccession) || [])[0], common.doi),
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
            directorOrProducer: firstNonEmpty(extractByLabel(lines, ["director", "directed by", "producer", "produced by"])),
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

    var data = collectPdfData(rawPdfText);
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
        arxiv: RX.arxiv.toString(),
        year: RX.year.toString(),
        fullDate: RX.fullDate.toString(),
        isoDate: RX.isoDate.toString(),
        volume: RX.volume.toString(),
        issue: RX.issue.toString(),
        pages: RX.pages.toString(),
        compactJournal: RX.compactJournal.toString(),
        url: RX.url.toString(),
        accessed: RX.accessed.toString(),
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
        courtNeutralCitation: RX.courtNeutralCitation.toString(),
        titleLikeLine: RX.titleLikeLine.toString()
      }
    };
  }

  function extractStructuredSourceDataFromPdfPages(pages, options) {
    options = options || {};
    var joined = (pages || []).map(function (page) {
      return typeof page === "string" ? page : (page && page.text) || "";
    }).join("\n\n");

    return extractStructuredSourceDataFromPdfText(joined, options);
  }

  window.extractStructuredSourceDataFromPdfText = extractStructuredSourceDataFromPdfText;
  window.extractStructuredSourceDataFromPdfPages = extractStructuredSourceDataFromPdfPages;
})();