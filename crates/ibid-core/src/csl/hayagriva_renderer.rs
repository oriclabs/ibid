use crate::error::{IbidError, Result};
use crate::types::{CslItem, DateVariable, ItemType, Name, StringOrNumber};

use hayagriva::citationberg::{self, LocaleFile};
use hayagriva::types::{
    Date, EntryType, FormatString, MaybeTyped, Numeric, PageRanges,
    Person, PersonRole, PersonsWithRoles, Publisher, QualifiedUrl, SerialNumber,
};
use hayagriva::{
    BibliographyDriver, BibliographyRequest, CitationItem, CitationRequest, Entry,
};
use std::collections::BTreeMap;

// Embedded en-US locale (32KB) — the only locale needed for an English-only app
const EN_US_LOCALE_XML: &str = include_str!("locales-en-US.xml");

fn en_us_locale() -> Vec<citationberg::Locale> {
    match LocaleFile::from_xml(EN_US_LOCALE_XML) {
        Ok(lf) => vec![lf.into()],
        Err(_) => Vec::new(),
    }
}

// =============================================================================
// CSL-JSON ItemType → Hayagriva EntryType mapping
// =============================================================================

fn map_item_type(item_type: &ItemType) -> EntryType {
    match item_type {
        ItemType::Article | ItemType::ArticleJournal | ItemType::ArticleMagazine => {
            EntryType::Article
        }
        ItemType::ArticleNewspaper => EntryType::Newspaper,
        ItemType::Book => EntryType::Book,
        ItemType::Chapter | ItemType::PaperConference => EntryType::Chapter,
        ItemType::Dataset | ItemType::Document | ItemType::Pamphlet
        | ItemType::PersonalCommunication | ItemType::Standard
        | ItemType::Interview | ItemType::Map => EntryType::Misc,
        ItemType::Collection => EntryType::Anthology,
        ItemType::EntryEncyclopedia | ItemType::EntryDictionary | ItemType::Entry => {
            EntryType::Entry
        }
        ItemType::Event => EntryType::Misc,
        ItemType::Figure | ItemType::Graphic => EntryType::Artwork,
        ItemType::Legislation | ItemType::Bill | ItemType::Regulation
        | ItemType::Treaty => EntryType::Legislation,
        ItemType::LegalCase | ItemType::Hearing => EntryType::Case,
        ItemType::MotionPicture | ItemType::Broadcast => EntryType::Video,
        ItemType::Song | ItemType::MusicalScore => EntryType::Audio,
        ItemType::Patent => EntryType::Patent,
        ItemType::Periodical => EntryType::Periodical,
        ItemType::Post | ItemType::PostWeblog => EntryType::Post,
        ItemType::Report => EntryType::Report,
        ItemType::Review | ItemType::ReviewBook => EntryType::Article,
        ItemType::Software => EntryType::Web,
        ItemType::Speech | ItemType::Performance => EntryType::Performance,
        ItemType::Thesis => EntryType::Thesis,
        ItemType::Webpage => EntryType::Web,
        ItemType::Manuscript => EntryType::Manuscript,
        ItemType::Classic => EntryType::Original,
    }
}

// =============================================================================
// Conversions
// =============================================================================

fn convert_name(name: &Name) -> Person {
    if let Some(ref literal) = name.literal {
        Person {
            name: literal.clone(),
            given_name: None,
            prefix: None,
            suffix: None,
            alias: None,
        }
    } else {
        Person {
            name: name.family.clone().unwrap_or_default(),
            given_name: name.given.clone(),
            prefix: name.non_dropping_particle.clone(),
            suffix: name.suffix.clone(),
            alias: None,
        }
    }
}

fn convert_names(names: &Option<Vec<Name>>) -> Vec<Person> {
    names
        .as_ref()
        .map(|ns| ns.iter().map(convert_name).collect())
        .unwrap_or_default()
}

fn convert_date(date: &Option<DateVariable>) -> Option<Date> {
    let dv = date.as_ref()?;
    let parts = dv.date_parts.as_ref()?;
    if parts.is_empty() || parts[0].is_empty() {
        return None;
    }
    let dp = &parts[0];
    Some(Date {
        year: dp[0] as i32,
        month: dp.get(1).copied().map(|m| m as u8),
        day: dp.get(2).copied().map(|d| d as u8),
        approximate: false,
        season: None,
    })
}

fn convert_number(v: &Option<StringOrNumber>) -> Option<MaybeTyped<Numeric>> {
    v.as_ref().map(|sn| match sn {
        StringOrNumber::String(s) => {
            if let Ok(n) = s.parse::<i32>() {
                MaybeTyped::Typed(Numeric::new(n))
            } else {
                MaybeTyped::String(s.clone())
            }
        }
        StringOrNumber::Number(n) => MaybeTyped::Typed(Numeric::new(*n as i32)),
    })
}

fn fs(s: &str) -> FormatString {
    FormatString::from(s.to_string())
}

// =============================================================================
// CslItem → Hayagriva Entry
// =============================================================================

fn csl_item_to_entry(item: &CslItem) -> Entry {
    let entry_type = map_item_type(&item.item_type);
    let mut entry = Entry::new(&item.id, entry_type);

    if let Some(ref title) = item.title {
        entry.set_title(fs(title));
    }

    let authors = convert_names(&item.author);
    if !authors.is_empty() {
        entry.set_authors(authors);
    }

    let editors = convert_names(&item.editor);
    if !editors.is_empty() {
        entry.set_editors(editors);
    }

    let translators = convert_names(&item.translator);
    if !translators.is_empty() {
        entry.set_affiliated(vec![PersonsWithRoles::new(
            translators,
            PersonRole::Translator,
        )]);
    }

    if let Some(date) = convert_date(&item.issued) {
        entry.set_date(date);
    }

    if let Some(ref pub_name) = item.publisher {
        let location = item.publisher_place.as_ref().map(|p| fs(p));
        entry.set_publisher(Publisher::new(Some(fs(pub_name)), location));
    }

    if let Some(ref url_str) = item.url {
        if let Ok(parsed) = url_str.parse() {
            let access_date = convert_date(&item.accessed);
            entry.set_url(QualifiedUrl::new(parsed, access_date));
        }
    }

    // Serial numbers (DOI, ISBN, ISSN)
    let mut serial = BTreeMap::new();
    if let Some(ref doi) = item.doi {
        serial.insert("doi".to_string(), doi.clone());
    }
    if let Some(ref isbn) = item.isbn {
        serial.insert("isbn".to_string(), isbn.clone());
    }
    if let Some(ref issn) = item.issn {
        serial.insert("issn".to_string(), issn.clone());
    }
    if !serial.is_empty() {
        entry.set_serial_number(SerialNumber(serial));
    }

    if let Some(vol) = convert_number(&item.volume) {
        entry.set_volume(vol);
    }
    if let Some(iss) = convert_number(&item.issue) {
        entry.set_issue(iss);
    }
    if let Some(ed) = convert_number(&item.edition) {
        entry.set_edition(ed);
    }

    // Page range
    if let Some(ref page) = item.page {
        if let Ok(pr) = page.parse::<PageRanges>() {
            entry.set_page_range(MaybeTyped::Typed(pr));
        } else {
            entry.set_page_range(MaybeTyped::String(page.clone()));
        }
    }

    // Container title → parent entry
    if let Some(ref container) = item.container_title {
        let parent_type = match item.item_type {
            ItemType::ArticleJournal | ItemType::Article | ItemType::ArticleMagazine
            | ItemType::Review | ItemType::ReviewBook => EntryType::Periodical,
            ItemType::Chapter | ItemType::PaperConference => EntryType::Book,
            ItemType::ArticleNewspaper => EntryType::Newspaper,
            _ => EntryType::Periodical,
        };
        let mut parent = Entry::new("__parent__", parent_type);
        parent.set_title(fs(container));
        entry.set_parents(vec![parent]);
    }

    if item.publisher.is_none() {
        if let Some(ref place) = item.publisher_place {
            entry.set_location(fs(place));
        }
    }

    if let Some(ref note) = item.note {
        entry.set_note(fs(note));
    }
    if let Some(ref abstract_) = item.abstract_ {
        entry.set_abstract_(fs(abstract_));
    }
    if let Some(ref genre) = item.genre {
        entry.set_genre(fs(genre));
    }

    entry
}

// =============================================================================
// Public rendering API
// =============================================================================

/// Render both bibliography and in-text citation using hayagriva.
/// Returns plain text output (no ANSI codes, no HTML).
pub fn render_both(item: &CslItem, style_xml: &str) -> Result<(String, String)> {
    let style = citationberg::IndependentStyle::from_xml(style_xml)
        .map_err(|e| IbidError::CslParse(format!("{:?}", e)))?;

    let entry = csl_item_to_entry(item);
    let locales = en_us_locale();

    let mut driver = BibliographyDriver::new();
    driver.citation(CitationRequest::from_items(
        vec![CitationItem::with_entry(&entry)],
        &style,
        &locales,
    ));

    let rendered = driver.finish(BibliographyRequest {
        style: &style,
        locale: None,
        locale_files: &locales,
    });

    // Use {:#} (alternate format) for plain text — avoids ANSI escape codes
    let bib = rendered
        .bibliography
        .and_then(|b| b.items.first().map(|i| format!("{:#}", i.content)))
        .unwrap_or_default();

    let intext = rendered
        .citations
        .first()
        .map(|c| format!("{:#}", c.citation))
        .unwrap_or_default();

    Ok((bib, intext))
}

/// Render both as HTML (with <i>, <b>, etc. tags).
pub fn render_both_html(item: &CslItem, style_xml: &str) -> Result<(String, String)> {
    use hayagriva::BufWriteFormat;

    let style = citationberg::IndependentStyle::from_xml(style_xml)
        .map_err(|e| IbidError::CslParse(format!("{:?}", e)))?;

    let entry = csl_item_to_entry(item);
    let locales = en_us_locale();

    let mut driver = BibliographyDriver::new();
    driver.citation(CitationRequest::from_items(
        vec![CitationItem::with_entry(&entry)],
        &style,
        &locales,
    ));

    let rendered = driver.finish(BibliographyRequest {
        style: &style,
        locale: None,
        locale_files: &locales,
    });

    let bib = rendered
        .bibliography
        .and_then(|b| {
            b.items.first().map(|i| {
                let mut buf = String::new();
                let _ = i.content.write_buf(&mut buf, BufWriteFormat::Html);
                buf
            })
        })
        .unwrap_or_default();

    let intext = rendered
        .citations
        .first()
        .map(|c| {
            let mut buf = String::new();
            let _ = c.citation.write_buf(&mut buf, BufWriteFormat::Html);
            buf
        })
        .unwrap_or_default();

    Ok((bib, intext))
}

/// Render a bibliography entry only.
pub fn render_bibliography(item: &CslItem, style_xml: &str) -> Result<String> {
    render_both(item, style_xml).map(|(bib, _)| bib)
}

/// Render an in-text citation only.
pub fn render_citation(item: &CslItem, style_xml: &str) -> Result<String> {
    render_both(item, style_xml).map(|(_, intext)| intext)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{DateVariable, ItemType, Name, StringOrNumber};

    fn many_authors_item() -> CslItem {
        CslItem {
            id: "doughty2024".into(),
            item_type: ItemType::ArticleJournal,
            title: Some("Single-molecule states link transcription factor binding to gene expression".into()),
            author: Some(vec![
                Name { family: Some("Doughty".into()), given: Some("Benjamin R.".into()), ..Default::default() },
                Name { family: Some("Hinks".into()), given: Some("Michaela M.".into()), ..Default::default() },
                Name { family: Some("Schaepe".into()), given: Some("Julia M.".into()), ..Default::default() },
                Name { family: Some("Marinov".into()), given: Some("Georgi K.".into()), ..Default::default() },
                Name { family: Some("Thurm".into()), given: Some("Abby R.".into()), ..Default::default() },
                Name { family: Some("Rios-Martinez".into()), given: Some("Carolina".into()), ..Default::default() },
                Name { family: Some("Parks".into()), given: Some("Benjamin E.".into()), ..Default::default() },
                Name { family: Some("Tan".into()), given: Some("Yingxuan".into()), ..Default::default() },
                Name { family: Some("Marklund".into()), given: Some("Emil".into()), ..Default::default() },
                Name { family: Some("Dubocanin".into()), given: Some("Danilo".into()), ..Default::default() },
                Name { family: Some("Bintu".into()), given: Some("Lacramioara".into()), ..Default::default() },
                Name { family: Some("Greenleaf".into()), given: Some("William J.".into()), ..Default::default() },
            ]),
            issued: Some(DateVariable {
                date_parts: Some(vec![vec![2024, 11]]),
                ..Default::default()
            }),
            container_title: Some("Nature".into()),
            volume: Some(StringOrNumber::Number(636)),
            issue: Some(StringOrNumber::Number(8043)),
            page: Some("745-754".into()),
            doi: Some("10.1038/s41586-024-08219-w".into()),
            publisher: Some("Nature Publishing Group".into()),
            ..Default::default()
        }
    }

    #[test]
    fn test_mla_et_al_citation() {
        let mla_xml = std::fs::read_to_string(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../browser/chrome/styles/csl/modern-language-association.csl")
        ).unwrap();

        let item = many_authors_item();
        let (bib, intext) = render_both(&item, &mla_xml).unwrap();

        eprintln!("MLA bib: {}", bib);
        eprintln!("MLA intext: {}", intext);

        // MLA with 12 authors: et-al-min=3, et-al-use-first=1
        // Bib should have "Doughty, Benjamin R., et al."
        assert!(bib.contains("et al"), "Bib should contain 'et al': {}", bib);
        assert!(!bib.contains("Greenleaf"), "Bib should NOT list all authors: {}", bib);

        // In-text should have "(Doughty et al. 745–54)" or similar
        assert!(intext.contains("et al"), "In-text should contain 'et al': {}", intext);
        assert!(!intext.contains("Greenleaf"), "In-text should NOT list all authors: {}", intext);
    }

    fn load_style(name: &str) -> String {
        std::fs::read_to_string(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join(format!("../../browser/chrome/styles/csl/{}.csl", name))
        ).unwrap()
    }

    #[test]
    fn test_apa_et_al_citation() {
        let xml = load_style("apa");
        let item = many_authors_item();
        let (bib, intext) = render_both(&item, &xml).unwrap();
        eprintln!("APA bib: {}", bib);
        eprintln!("APA intext: {}", intext);

        // APA 7: et-al-min=21 for bib (show all 12), et-al-min varies for citation
        // In-text: should use et al. for 3+ authors
        assert!(intext.contains("Doughty"), "In-text should contain first author: {}", intext);
        // Bib should have initials, not full given names
        assert!(bib.contains("Doughty, B. R.") || bib.contains("Doughty, B."),
            "APA bib should have initials: {}", bib);
    }

    #[test]
    fn test_chicago_author_date() {
        let xml = load_style("chicago-author-date");
        let item = many_authors_item();
        let (bib, intext) = render_both(&item, &xml).unwrap();
        eprintln!("Chicago bib: {}", bib);
        eprintln!("Chicago intext: {}", intext);

        assert!(!bib.is_empty(), "Chicago bib should not be empty");
        assert!(!intext.is_empty(), "Chicago intext should not be empty");
        // Chicago uses "et al." for 4+ authors in bib (10+ in some configs)
        assert!(bib.contains("Doughty"), "Bib should contain first author: {}", bib);
    }

    #[test]
    fn test_ieee_numbered_citation() {
        let xml = load_style("ieee");
        let item = many_authors_item();
        let (bib, intext) = render_both(&item, &xml).unwrap();
        eprintln!("IEEE bib: {}", bib);
        eprintln!("IEEE intext: {}", intext);

        // IEEE uses numbered citations [1]
        assert!(intext.contains("[1]") || intext.contains("["),
            "IEEE in-text should be numbered: {}", intext);
    }

    #[test]
    fn test_vancouver_numbered_citation() {
        let xml = load_style("vancouver");
        let item = many_authors_item();
        let (bib, intext) = render_both(&item, &xml).unwrap();
        eprintln!("Vancouver bib: {}", bib);
        eprintln!("Vancouver intext: {}", intext);

        // Vancouver: et al. after 6 authors
        assert!(bib.contains("et al"), "Vancouver bib should have et al. for 12 authors: {}", bib);
    }

    #[test]
    fn test_single_author_no_et_al() {
        let xml = load_style("apa");
        let mut item = many_authors_item();
        item.author = Some(vec![
            Name { family: Some("Smith".into()), given: Some("John".into()), ..Default::default() },
        ]);
        let (bib, intext) = render_both(&item, &xml).unwrap();

        assert!(!bib.contains("et al"), "Single author should NOT have et al: {}", bib);
        assert!(bib.contains("Smith"), "Should contain author name: {}", bib);
        assert!(intext.contains("Smith"), "In-text should contain author: {}", intext);
    }

    #[test]
    fn test_no_ansi_codes_in_output() {
        let xml = load_style("apa");
        let item = many_authors_item();
        let (bib, intext) = render_both(&item, &xml).unwrap();

        assert!(!bib.contains("\x1b["), "Bib should not contain ANSI codes: {}", bib);
        assert!(!bib.contains("[0m"), "Bib should not contain [0m: {}", bib);
        assert!(!intext.contains("\x1b["), "Intext should not contain ANSI codes: {}", intext);
    }

    #[test]
    fn test_locale_terms_present() {
        // Verify the en-US locale provides "et al." and month names
        let locales = en_us_locale();
        assert!(!locales.is_empty(), "en-US locale should load");
    }

    #[test]
    fn test_csl_item_to_entry_conversion() {
        let item = many_authors_item();
        let entry = csl_item_to_entry(&item);

        assert_eq!(entry.key(), "doughty2024");
        assert!(entry.authors().is_some());
        assert_eq!(entry.authors().unwrap().len(), 12);
        assert!(entry.title().is_some());
        assert!(entry.date().is_some());
        assert!(entry.volume().is_some());
        assert!(entry.issue().is_some());
        assert!(entry.page_range().is_some());
        assert!(!entry.parents().is_empty(), "Should have parent (journal)");
    }
}
