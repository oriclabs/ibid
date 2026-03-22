use crate::error::Result;
use crate::types::{CslItem, DateVariable, ItemType, Name, StringOrNumber};

/// Parse result for a single RIS entry
#[derive(Debug, Clone)]
pub struct ParsedEntry {
    pub item: CslItem,
    pub warnings: Vec<String>,
}

/// Parse result for a full RIS file
#[derive(Debug, Clone)]
pub struct ParseResult {
    pub entries: Vec<ParsedEntry>,
    pub errors: Vec<String>,
}

/// Parse an RIS string into CSL-JSON items
pub fn parse_ris(input: &str) -> ParseResult {
    let mut result = ParseResult {
        entries: Vec::new(),
        errors: Vec::new(),
    };

    let mut current_type: Option<String> = None;
    let mut fields: Vec<(String, String)> = Vec::new();
    let mut entry_count = 0;

    for line in input.lines() {
        let line = line.trim_end();

        // RIS format: TAG  - VALUE (6-char prefix) or TAG  - (5 chars for ER)
        // Check for 2-char tag followed by spaces and dash
        let is_tag_line = line.len() >= 5
            && line.as_bytes().get(2).copied() == Some(b' ')
            && line.as_bytes().get(3).copied() == Some(b' ')
            && line.as_bytes().get(4).copied() == Some(b'-');

        if !is_tag_line {
            // Continuation line or empty — append to last field
            if !line.is_empty() && !fields.is_empty() {
                let last = fields.last_mut().unwrap();
                last.1.push(' ');
                last.1.push_str(line.trim());
            }
            continue;
        }

        let tag = line[..2].trim().to_uppercase();
        let value = if line.len() > 6 {
            line[6..].trim().to_string()
        } else {
            String::new()
        };

        match tag.as_str() {
            "TY" => {
                // Start of new entry
                if current_type.is_some() {
                    // Flush previous entry without ER
                    match convert_ris_to_csl(&current_type.take().unwrap(), &fields, entry_count) {
                        Ok(parsed) => result.entries.push(parsed),
                        Err(e) => result.errors.push(e.to_string()),
                    }
                    fields.clear();
                }
                current_type = Some(value);
                entry_count += 1;
            }
            "ER" => {
                // End of entry
                if let Some(ref ty) = current_type {
                    match convert_ris_to_csl(ty, &fields, entry_count) {
                        Ok(parsed) => result.entries.push(parsed),
                        Err(e) => result.errors.push(e.to_string()),
                    }
                }
                current_type = None;
                fields.clear();
            }
            _ => {
                fields.push((tag, value));
            }
        }
    }

    // Handle unterminated entry
    if let Some(ty) = current_type {
        match convert_ris_to_csl(&ty, &fields, entry_count) {
            Ok(parsed) => result.entries.push(parsed),
            Err(e) => result.errors.push(e.to_string()),
        }
    }

    result
}

fn convert_ris_to_csl(
    ris_type: &str,
    fields: &[(String, String)],
    entry_num: usize,
) -> Result<ParsedEntry> {
    let warnings = Vec::new();
    let item_type = map_ris_type(ris_type);

    let mut item = CslItem {
        id: format!("ris-{}", entry_num),
        item_type,
        ..Default::default()
    };

    let mut authors: Vec<Name> = Vec::new();
    let mut editors: Vec<Name> = Vec::new();
    let mut keywords: Vec<String> = Vec::new();
    let mut year: Option<String> = None;
    let mut start_page: Option<String> = None;
    let mut end_page: Option<String> = None;

    for (tag, value) in fields {
        match tag.as_str() {
            // Titles
            "TI" | "T1" => item.title = Some(value.clone()),
            "T2" | "JO" | "JF" | "JA" | "J1" | "J2" | "BT" => {
                if item.container_title.is_none() {
                    item.container_title = Some(value.clone());
                }
            }
            "T3" => item.collection_title = Some(value.clone()),

            // Authors
            "AU" | "A1" => authors.push(parse_ris_name(value)),
            "A2" | "ED" => editors.push(parse_ris_name(value)),

            // Date
            "PY" | "Y1" => year = Some(value.clone()),
            "DA" => {
                // Format: YYYY/MM/DD/other
                let parts: Vec<&str> = value.split('/').collect();
                let mut date_parts: Vec<i32> = Vec::new();
                if let Some(y) = parts.first().and_then(|p| p.parse().ok()) {
                    date_parts.push(y);
                }
                if let Some(m) = parts.get(1).and_then(|p| p.parse().ok()) {
                    date_parts.push(m);
                }
                if let Some(d) = parts.get(2).and_then(|p| p.parse().ok()) {
                    date_parts.push(d);
                }
                if !date_parts.is_empty() {
                    item.issued = Some(DateVariable {
                        date_parts: Some(vec![date_parts]),
                        ..Default::default()
                    });
                }
            }

            // Numbers
            "VL" => item.volume = Some(StringOrNumber::String(value.clone())),
            "IS" | "CP" => item.issue = Some(StringOrNumber::String(value.clone())),
            "SP" => start_page = Some(value.clone()),
            "EP" => end_page = Some(value.clone()),
            "SN" => {
                // Could be ISBN or ISSN
                if value.len() > 10 || value.contains("978") || value.contains("979") {
                    item.isbn = Some(value.clone());
                } else {
                    item.issn = Some(value.clone());
                }
            }

            // Identifiers
            "DO" => item.doi = Some(value.clone()),
            "UR" | "L1" | "L2" => {
                if item.url.is_none() {
                    item.url = Some(value.clone());
                }
            }
            "AN" => item.call_number = Some(value.clone()),

            // Publisher
            "PB" => item.publisher = Some(value.clone()),
            "CY" | "PP" => item.publisher_place = Some(value.clone()),

            // Other
            "AB" | "N2" => item.abstract_ = Some(value.clone()),
            "N1" => item.note = Some(value.clone()),
            "KW" => keywords.push(value.clone()),
            "LA" => item.language = Some(value.clone()),
            "ET" => item.edition = Some(StringOrNumber::String(value.clone())),
            "ID" => item.id = value.clone(),

            _ => {} // Skip unknown tags
        }
    }

    // Set authors/editors
    if !authors.is_empty() {
        item.author = Some(authors);
    }
    if !editors.is_empty() {
        item.editor = Some(editors);
    }

    // Set date from PY if DA wasn't set
    if item.issued.is_none() {
        if let Some(ref y) = year {
            // PY format: YYYY or YYYY/MM/DD/
            let parts: Vec<&str> = y.split('/').collect();
            let mut date_parts: Vec<i32> = Vec::new();
            if let Some(yr) = parts.first().and_then(|p| p.trim().parse().ok()) {
                date_parts.push(yr);
            }
            if let Some(m) = parts.get(1).and_then(|p| p.trim().parse().ok()) {
                date_parts.push(m);
            }
            if let Some(d) = parts.get(2).and_then(|p| p.trim().parse().ok()) {
                date_parts.push(d);
            }
            if !date_parts.is_empty() {
                item.issued = Some(DateVariable {
                    date_parts: Some(vec![date_parts]),
                    ..Default::default()
                });
            }
        }
    }

    // Pages
    match (start_page, end_page) {
        (Some(sp), Some(ep)) if !ep.is_empty() => item.page = Some(format!("{}\u{2013}{}", sp, ep)),
        (Some(sp), _) => item.page = Some(sp),
        _ => {}
    }

    // Keywords
    if !keywords.is_empty() {
        item.keyword = Some(keywords.join(", "));
    }

    Ok(ParsedEntry { item, warnings })
}

fn map_ris_type(ris_type: &str) -> ItemType {
    match ris_type.trim() {
        "JOUR" | "JFULL" | "MGZN" => ItemType::ArticleJournal,
        "BOOK" | "WHOLE" => ItemType::Book,
        "CHAP" | "SECT" => ItemType::Chapter,
        "CONF" | "CPAPER" => ItemType::PaperConference,
        "THES" => ItemType::Thesis,
        "RPRT" => ItemType::Report,
        "NEWS" => ItemType::ArticleNewspaper,
        "ELEC" | "ICOMM" => ItemType::Webpage,
        "BLOG" => ItemType::PostWeblog,
        "PAT" => ItemType::Patent,
        "DATA" => ItemType::Dataset,
        "COMP" => ItemType::Software,
        "MAP" => ItemType::Map,
        "MPCT" | "VIDEO" => ItemType::MotionPicture,
        "SOUND" | "MUSIC" => ItemType::Song,
        "BILL" => ItemType::Bill,
        "CASE" => ItemType::LegalCase,
        "STAT" => ItemType::Legislation,
        "ENCYC" => ItemType::EntryEncyclopedia,
        "DICT" => ItemType::EntryDictionary,
        "SLIDE" | "ART" | "FIGURE" => ItemType::Figure,
        "HEAR" => ItemType::Hearing,
        "UNPB" => ItemType::Manuscript,
        _ => ItemType::Document,
    }
}

fn parse_ris_name(input: &str) -> Name {
    let input = input.trim();
    if input.is_empty() {
        return Name {
            literal: Some(String::new()),
            ..Default::default()
        };
    }

    // RIS name format: Last, First, Suffix
    // or: Last,First
    if let Some(comma_pos) = input.find(',') {
        let family = input[..comma_pos].trim().to_string();
        let rest = input[comma_pos + 1..].trim();

        if let Some(comma2) = rest.find(',') {
            let given = rest[..comma2].trim().to_string();
            let suffix = rest[comma2 + 1..].trim().to_string();
            return Name {
                family: Some(family),
                given: if given.is_empty() { None } else { Some(given) },
                suffix: if suffix.is_empty() { None } else { Some(suffix) },
                ..Default::default()
            };
        }

        return Name {
            family: Some(family),
            given: if rest.is_empty() { None } else { Some(rest.to_string()) },
            ..Default::default()
        };
    }

    // No comma — treat as literal
    Name {
        literal: Some(input.to_string()),
        ..Default::default()
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_journal_article() {
        let ris = "\
TY  - JOUR
AU  - Smith, John A.
AU  - Doe, Jane
TI  - A Study of Things
JO  - Nature
PY  - 2023
VL  - 42
IS  - 3
SP  - 100
EP  - 120
DO  - 10.1038/nature12345
ER  -
";
        let result = parse_ris(ris);
        assert!(result.errors.is_empty(), "Errors: {:?}", result.errors);
        assert_eq!(result.entries.len(), 1);

        let item = &result.entries[0].item;
        assert_eq!(item.title.as_deref(), Some("A Study of Things"));
        assert_eq!(item.container_title.as_deref(), Some("Nature"));
        assert_eq!(item.doi.as_deref(), Some("10.1038/nature12345"));
        assert_eq!(item.page.as_deref(), Some("100\u{2013}120"));

        let authors = item.author.as_ref().unwrap();
        assert_eq!(authors.len(), 2);
        assert_eq!(authors[0].family.as_deref(), Some("Smith"));
        assert_eq!(authors[0].given.as_deref(), Some("John A."));
    }

    #[test]
    fn test_parse_book() {
        let ris = "\
TY  - BOOK
AU  - Knuth, Donald E.
TI  - The Art of Computer Programming
PB  - Addison-Wesley
PY  - 1997
SN  - 978-0-201-89684-8
ER  -
";
        let result = parse_ris(ris);
        assert_eq!(result.entries.len(), 1);

        let item = &result.entries[0].item;
        assert_eq!(item.title.as_deref(), Some("The Art of Computer Programming"));
        assert_eq!(item.publisher.as_deref(), Some("Addison-Wesley"));
        assert_eq!(item.isbn.as_deref(), Some("978-0-201-89684-8"));
    }

    #[test]
    fn test_parse_multiple() {
        let ris = "\
TY  - JOUR
AU  - One, A
TI  - First
ER  -
TY  - BOOK
AU  - Two, B
TI  - Second
ER  -
";
        let result = parse_ris(ris);
        assert_eq!(result.entries.len(), 2);
        assert_eq!(result.entries[0].item.title.as_deref(), Some("First"));
        assert_eq!(result.entries[1].item.title.as_deref(), Some("Second"));
    }
}
