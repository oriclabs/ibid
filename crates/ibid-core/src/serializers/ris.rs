use crate::types::{CslItem, ItemType, Name};

/// Serialize a single CSL item to RIS format
pub fn serialize_item(item: &CslItem) -> String {
    let mut lines: Vec<String> = Vec::new();

    // Type
    lines.push(format!("TY  - {}", map_csl_to_ris_type(&item.item_type)));

    // Authors
    if let Some(ref authors) = item.author {
        for a in authors {
            lines.push(format!("AU  - {}", format_ris_name(a)));
        }
    }

    // Editors
    if let Some(ref editors) = item.editor {
        for e in editors {
            lines.push(format!("A2  - {}", format_ris_name(e)));
        }
    }

    // Title
    if let Some(ref title) = item.title {
        lines.push(format!("TI  - {}", title));
    }

    // Container title
    if let Some(ref ct) = item.container_title {
        match item.item_type {
            ItemType::Chapter | ItemType::PaperConference => {
                lines.push(format!("BT  - {}", ct));
            }
            _ => {
                lines.push(format!("JO  - {}", ct));
            }
        }
    }

    // Series
    if let Some(ref series) = item.collection_title {
        lines.push(format!("T3  - {}", series));
    }

    // Date
    if let Some(ref issued) = item.issued {
        if let Some(ref parts) = issued.date_parts {
            if let Some(first) = parts.first() {
                let y = first.first().copied().unwrap_or(0);
                let m = first.get(1).copied();
                let d = first.get(2).copied();
                lines.push(format!(
                    "PY  - {}/{}/{}/",
                    y,
                    m.map(|v| format!("{:02}", v)).unwrap_or_default(),
                    d.map(|v| format!("{:02}", v)).unwrap_or_default()
                ));
            }
        }
    }

    // Volume
    if let Some(ref v) = item.volume {
        lines.push(format!("VL  - {}", v));
    }

    // Issue
    if let Some(ref n) = item.issue {
        lines.push(format!("IS  - {}", n));
    }

    // Pages
    if let Some(ref p) = item.page {
        let normalized = p.replace('\u{2013}', "-").replace('\u{2014}', "-");
        if let Some((sp, ep)) = normalized.split_once('-') {
            lines.push(format!("SP  - {}", sp.trim()));
            lines.push(format!("EP  - {}", ep.trim()));
        } else {
            lines.push(format!("SP  - {}", p));
        }
    }

    // Publisher
    if let Some(ref pub_) = item.publisher {
        lines.push(format!("PB  - {}", pub_));
    }

    // Place
    if let Some(ref place) = item.publisher_place {
        lines.push(format!("CY  - {}", place));
    }

    // DOI
    if let Some(ref doi) = item.doi {
        lines.push(format!("DO  - {}", doi));
    }

    // URL
    if let Some(ref url) = item.url {
        lines.push(format!("UR  - {}", url));
    }

    // ISBN / ISSN
    if let Some(ref isbn) = item.isbn {
        lines.push(format!("SN  - {}", isbn));
    } else if let Some(ref issn) = item.issn {
        lines.push(format!("SN  - {}", issn));
    }

    // Abstract
    if let Some(ref abs) = item.abstract_ {
        lines.push(format!("AB  - {}", abs));
    }

    // Notes
    if let Some(ref note) = item.note {
        lines.push(format!("N1  - {}", note));
    }

    // Keywords
    if let Some(ref kw) = item.keyword {
        for k in kw.split(',') {
            let k = k.trim();
            if !k.is_empty() {
                lines.push(format!("KW  - {}", k));
            }
        }
    }

    // Language
    if let Some(ref lang) = item.language {
        lines.push(format!("LA  - {}", lang));
    }

    // Edition
    if let Some(ref ed) = item.edition {
        lines.push(format!("ET  - {}", ed));
    }

    // End
    lines.push("ER  - ".into());

    lines.join("\n")
}

/// Serialize multiple items to RIS
pub fn serialize_items(items: &[CslItem]) -> String {
    items
        .iter()
        .map(|item| serialize_item(item))
        .collect::<Vec<_>>()
        .join("\n")
}

fn map_csl_to_ris_type(item_type: &ItemType) -> &'static str {
    match item_type {
        ItemType::ArticleJournal | ItemType::ArticleMagazine => "JOUR",
        ItemType::ArticleNewspaper => "NEWS",
        ItemType::Book | ItemType::Collection => "BOOK",
        ItemType::Chapter => "CHAP",
        ItemType::PaperConference => "CPAPER",
        ItemType::Thesis => "THES",
        ItemType::Report => "RPRT",
        ItemType::Patent => "PAT",
        ItemType::Webpage => "ELEC",
        ItemType::PostWeblog | ItemType::Post => "BLOG",
        ItemType::Software => "COMP",
        ItemType::Dataset => "DATA",
        ItemType::Map => "MAP",
        ItemType::MotionPicture => "MPCT",
        ItemType::Song => "SOUND",
        ItemType::Bill => "BILL",
        ItemType::LegalCase => "CASE",
        ItemType::Legislation => "STAT",
        ItemType::EntryEncyclopedia => "ENCYC",
        ItemType::EntryDictionary => "DICT",
        ItemType::Manuscript => "UNPB",
        ItemType::Hearing => "HEAR",
        _ => "GEN",
    }
}

fn format_ris_name(name: &Name) -> String {
    if let Some(ref lit) = name.literal {
        return lit.clone();
    }
    let family = name.family.as_deref().unwrap_or("");
    let given = name.given.as_deref().unwrap_or("");
    let suffix = name.suffix.as_deref().unwrap_or("");

    let particle = name.non_dropping_particle.as_deref().unwrap_or("");
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
        format!("{}, {}, {}", family_full, given, suffix)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::DateVariable;

    #[test]
    fn test_serialize_article() {
        let item = CslItem {
            id: "test".into(),
            item_type: ItemType::ArticleJournal,
            title: Some("Test Article".into()),
            author: Some(vec![Name {
                family: Some("Smith".into()),
                given: Some("John".into()),
                ..Default::default()
            }]),
            container_title: Some("Nature".into()),
            issued: Some(DateVariable {
                date_parts: Some(vec![vec![2024, 3, 15]]),
                ..Default::default()
            }),
            doi: Some("10.1038/test".into()),
            ..Default::default()
        };

        let ris = serialize_item(&item);
        assert!(ris.starts_with("TY  - JOUR"));
        assert!(ris.contains("AU  - Smith, John"));
        assert!(ris.contains("TI  - Test Article"));
        assert!(ris.contains("JO  - Nature"));
        assert!(ris.contains("PY  - 2024/03/15/"));
        assert!(ris.contains("DO  - 10.1038/test"));
        assert!(ris.ends_with("ER  - "));
    }

    #[test]
    fn test_roundtrip_ris() {
        let original = "\
TY  - JOUR
AU  - Smith, John
TI  - Test Article
JO  - Nature
PY  - 2024
DO  - 10.1038/test
ER  - ";

        let parsed = crate::parsers::ris::parse_ris(original);
        assert_eq!(parsed.entries.len(), 1);

        let serialized = serialize_item(&parsed.entries[0].item);
        assert!(serialized.contains("Smith, John"));
        assert!(serialized.contains("Test Article"));
        assert!(serialized.contains("Nature"));
    }
}
