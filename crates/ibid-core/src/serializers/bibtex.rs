use crate::types::{CslItem, ItemType, Name, StringOrNumber};

/// Options for BibTeX serialization
#[derive(Debug, Clone)]
pub struct BibtexOptions {
    pub include_abstract: bool,
    pub include_keywords: bool,
}

impl Default for BibtexOptions {
    fn default() -> Self {
        Self {
            include_abstract: false,
            include_keywords: true,
        }
    }
}

/// Serialize a single CSL item to BibTeX
pub fn serialize_item(item: &CslItem, opts: &BibtexOptions) -> String {
    let entry_type = map_csl_to_bibtex_type(&item.item_type);
    let cite_key = item
        .citation_key
        .as_deref()
        .unwrap_or(&item.id);

    let mut fields: Vec<(String, String)> = Vec::new();

    // Author
    if let Some(ref authors) = item.author {
        if !authors.is_empty() {
            fields.push(("author".into(), format_bibtex_names(authors)));
        }
    }

    // Editor
    if let Some(ref editors) = item.editor {
        if !editors.is_empty() {
            fields.push(("editor".into(), format_bibtex_names(editors)));
        }
    }

    // Title
    if let Some(ref title) = item.title {
        fields.push(("title".into(), format!("{{{}}}", title)));
    }

    // Journal / booktitle
    if let Some(ref ct) = item.container_title {
        match item.item_type {
            ItemType::Chapter | ItemType::PaperConference => {
                fields.push(("booktitle".into(), format!("{{{}}}", ct)));
            }
            _ => {
                fields.push(("journal".into(), format!("{{{}}}", ct)));
            }
        }
    }

    // Year / date
    if let Some(ref issued) = item.issued {
        if let Some(ref parts) = issued.date_parts {
            if let Some(first) = parts.first() {
                if let Some(&year) = first.first() {
                    fields.push(("year".into(), format!("{{{}}}", year)));
                }
                if let Some(&month) = first.get(1) {
                    fields.push(("month".into(), month_to_bibtex(month)));
                }
            }
        }
    }

    // Volume
    if let Some(ref v) = item.volume {
        fields.push(("volume".into(), format!("{{{}}}", v)));
    }

    // Number / issue
    if let Some(ref n) = item.issue {
        fields.push(("number".into(), format!("{{{}}}", n)));
    }

    // Pages
    if let Some(ref p) = item.page {
        let pages = p.replace('\u{2013}', "--").replace('\u{2014}', "---");
        fields.push(("pages".into(), format!("{{{}}}", pages)));
    }

    // Publisher
    if let Some(ref pub_) = item.publisher {
        fields.push(("publisher".into(), format!("{{{}}}", pub_)));
    }

    // Address / place
    if let Some(ref place) = item.publisher_place {
        fields.push(("address".into(), format!("{{{}}}", place)));
    }

    // Edition
    if let Some(ref ed) = item.edition {
        fields.push(("edition".into(), format!("{{{}}}", ed)));
    }

    // DOI
    if let Some(ref doi) = item.doi {
        fields.push(("doi".into(), format!("{{{}}}", doi)));
    }

    // ISBN
    if let Some(ref isbn) = item.isbn {
        fields.push(("isbn".into(), format!("{{{}}}", isbn)));
    }

    // ISSN
    if let Some(ref issn) = item.issn {
        fields.push(("issn".into(), format!("{{{}}}", issn)));
    }

    // URL
    if let Some(ref url) = item.url {
        fields.push(("url".into(), format!("{{{}}}", url)));
    }

    // Abstract
    if opts.include_abstract {
        if let Some(ref abs) = item.abstract_ {
            fields.push(("abstract".into(), format!("{{{}}}", abs)));
        }
    }

    // Keywords
    if opts.include_keywords {
        if let Some(ref kw) = item.keyword {
            fields.push(("keywords".into(), format!("{{{}}}", kw)));
        }
    }

    // Note
    if let Some(ref note) = item.note {
        fields.push(("note".into(), format!("{{{}}}", note)));
    }

    // Series
    if let Some(ref series) = item.collection_title {
        fields.push(("series".into(), format!("{{{}}}", series)));
    }

    // Language
    if let Some(ref lang) = item.language {
        fields.push(("language".into(), format!("{{{}}}", lang)));
    }

    // Build output
    let mut out = format!("@{}{{{},\n", entry_type, cite_key);
    for (i, (key, val)) in fields.iter().enumerate() {
        out.push_str(&format!("  {} = {}", key, val));
        if i < fields.len() - 1 {
            out.push(',');
        }
        out.push('\n');
    }
    out.push('}');
    out
}

/// Serialize multiple items to BibTeX
pub fn serialize_items(items: &[CslItem], opts: &BibtexOptions) -> String {
    items
        .iter()
        .map(|item| serialize_item(item, opts))
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn map_csl_to_bibtex_type(item_type: &ItemType) -> &'static str {
    match item_type {
        ItemType::ArticleJournal | ItemType::ArticleMagazine | ItemType::ArticleNewspaper => {
            "article"
        }
        ItemType::Book | ItemType::Collection => "book",
        ItemType::Chapter => "incollection",
        ItemType::PaperConference => "inproceedings",
        ItemType::Thesis => "phdthesis",
        ItemType::Report => "techreport",
        ItemType::Patent => "misc",
        ItemType::Webpage | ItemType::PostWeblog | ItemType::Post => "online",
        ItemType::Software => "software",
        ItemType::Dataset => "misc",
        ItemType::Pamphlet => "booklet",
        ItemType::Manuscript => "unpublished",
        _ => "misc",
    }
}

fn format_bibtex_names(names: &[Name]) -> String {
    let formatted: Vec<String> = names
        .iter()
        .map(|n| {
            if let Some(ref lit) = n.literal {
                return format!("{{{}}}", lit);
            }
            let family = n.family.as_deref().unwrap_or("");
            let given = n.given.as_deref().unwrap_or("");
            let particle = n.non_dropping_particle.as_deref().unwrap_or("");
            let suffix = n.suffix.as_deref().unwrap_or("");

            let family_full = if particle.is_empty() {
                family.to_string()
            } else {
                format!("{} {}", particle, family)
            };

            if suffix.is_empty() {
                if given.is_empty() {
                    family_full
                } else {
                    format!("{}, {}", family_full, given)
                }
            } else {
                format!("{}, {}, {}", family_full, suffix, given)
            }
        })
        .collect();

    format!("{{{}}}", formatted.join(" and "))
}

fn month_to_bibtex(month: i32) -> String {
    match month {
        1 => "jan".into(),
        2 => "feb".into(),
        3 => "mar".into(),
        4 => "apr".into(),
        5 => "may".into(),
        6 => "jun".into(),
        7 => "jul".into(),
        8 => "aug".into(),
        9 => "sep".into(),
        10 => "oct".into(),
        11 => "nov".into(),
        12 => "dec".into(),
        _ => format!("{{{}}}", month),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::DateVariable;

    #[test]
    fn test_serialize_article() {
        let item = CslItem {
            id: "smith2023".into(),
            item_type: ItemType::ArticleJournal,
            title: Some("A Study of Things".into()),
            author: Some(vec![
                Name {
                    family: Some("Smith".into()),
                    given: Some("John A.".into()),
                    ..Default::default()
                },
                Name {
                    family: Some("Doe".into()),
                    given: Some("Jane".into()),
                    ..Default::default()
                },
            ]),
            container_title: Some("Nature".into()),
            issued: Some(DateVariable {
                date_parts: Some(vec![vec![2023]]),
                ..Default::default()
            }),
            volume: Some(StringOrNumber::Number(42)),
            page: Some("100\u{2013}120".into()),
            doi: Some("10.1038/nature12345".into()),
            ..Default::default()
        };

        let bib = serialize_item(&item, &BibtexOptions::default());
        assert!(bib.starts_with("@article{smith2023,"));
        assert!(bib.contains("author = {Smith, John A. and Doe, Jane}"));
        assert!(bib.contains("title = {A Study of Things}"));
        assert!(bib.contains("journal = {Nature}"));
        assert!(bib.contains("year = {2023}"));
        assert!(bib.contains("pages = {100--120}"));
        assert!(bib.contains("doi = {10.1038/nature12345}"));
    }

    #[test]
    fn test_roundtrip_bibtex() {
        let original = r#"@article{test2024,
  author = {Smith, John},
  title = {Test Article},
  journal = {Nature},
  year = {2024},
  volume = {1},
  pages = {1--10}
}"#;

        let parsed = crate::parsers::bibtex::parse_bibtex(original);
        assert_eq!(parsed.entries.len(), 1);

        let serialized = serialize_item(&parsed.entries[0].item, &BibtexOptions::default());
        assert!(serialized.contains("Smith, John"));
        assert!(serialized.contains("Test Article"));
        assert!(serialized.contains("Nature"));
        assert!(serialized.contains("2024"));
    }
}
