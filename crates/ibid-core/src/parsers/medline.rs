use crate::types::{CslItem, DateVariable, ItemType, Name, StringOrNumber};

#[derive(Debug, Clone)]
pub struct ParseResult {
    pub entries: Vec<CslItem>,
    pub errors: Vec<String>,
}

/// Parse MEDLINE/PubMed NBIB format into CSL-JSON items
/// Format: TAG - Value (similar to RIS but different tags)
pub fn parse_medline(input: &str) -> ParseResult {
    let mut result = ParseResult { entries: Vec::new(), errors: Vec::new() };
    let mut current: Option<CslItem> = None;
    let mut authors: Vec<Name> = Vec::new();
    let mut keywords: Vec<String> = Vec::new();
    let mut current_tag = String::new();
    let mut current_value = String::new();
    let mut entry_count = 0;

    let flush_field = |item: &mut CslItem, tag: &str, val: &str, authors: &mut Vec<Name>, keywords: &mut Vec<String>| {
        let val = val.trim();
        if val.is_empty() { return; }
        match tag {
            "PMID" => item.pmid = Some(val.to_string()),
            "TI" => item.title = Some(val.to_string()),
            "AU" => authors.push(parse_medline_author(val)),
            "FAU" => { /* Full author — AU is sufficient */ }
            "TA" | "JT" => {
                if item.container_title.is_none() {
                    item.container_title = Some(val.to_string());
                }
            }
            "DP" => {
                // Date: "2024 Mar 15" or "2024 Mar" or "2024"
                let parts: Vec<&str> = val.split_whitespace().collect();
                if let Some(y) = parts.first().and_then(|p| p.parse::<i32>().ok()) {
                    let mut date_parts = vec![y];
                    if let Some(m) = parts.get(1).and_then(|p| parse_month_abbr(p)) {
                        date_parts.push(m);
                        if let Some(d) = parts.get(2).and_then(|p| p.parse::<i32>().ok()) {
                            date_parts.push(d);
                        }
                    }
                    item.issued = Some(DateVariable {
                        date_parts: Some(vec![date_parts]),
                        ..Default::default()
                    });
                }
            }
            "VI" => item.volume = Some(StringOrNumber::String(val.to_string())),
            "IP" => item.issue = Some(StringOrNumber::String(val.to_string())),
            "PG" => item.page = Some(val.replace('-', "\u{2013}")),
            "AB" => item.abstract_ = Some(val.to_string()),
            "AID" => {
                if val.contains("[doi]") {
                    let doi = val.replace("[doi]", "").trim().to_string();
                    item.doi = Some(doi);
                } else if val.contains("[pii]") {
                    // Publisher item identifier — skip
                }
            }
            "IS" => {
                if val.len() <= 9 {
                    item.issn = Some(val.to_string());
                }
            }
            "LA" => item.language = Some(val.to_string()),
            "MH" | "OT" => keywords.push(val.to_string()),
            "PT" => {
                match val.to_lowercase().as_str() {
                    "journal article" => item.item_type = ItemType::ArticleJournal,
                    "review" => item.item_type = ItemType::Review,
                    "book" => item.item_type = ItemType::Book,
                    _ => {}
                }
            }
            "PMC" => item.pmcid = Some(val.to_string()),
            _ => {}
        }
    };

    for line in input.lines() {
        // MEDLINE format: 4-char tag, space, dash, space, value
        // Or continuation line (starts with spaces)
        if line.len() >= 6 && &line[4..6] == "- " {
            // Flush previous field
            if !current_tag.is_empty() {
                if let Some(ref mut item) = current {
                    flush_field(item, &current_tag, &current_value, &mut authors, &mut keywords);
                }
            }

            current_tag = line[..4].trim().to_string();
            current_value = line[6..].to_string();

            // PMID starts a new record
            if current_tag == "PMID" {
                // Save previous record
                if let Some(mut item) = current.take() {
                    if !authors.is_empty() { item.author = Some(authors.clone()); }
                    if !keywords.is_empty() { item.keyword = Some(keywords.join(", ")); }
                    result.entries.push(item);
                    authors.clear();
                    keywords.clear();
                }
                entry_count += 1;
                current = Some(CslItem {
                    id: format!("medline-{}", entry_count),
                    item_type: ItemType::ArticleJournal,
                    ..Default::default()
                });
            }
        } else if line.starts_with("      ") {
            // Continuation line
            current_value.push(' ');
            current_value.push_str(line.trim());
        }
    }

    // Flush last field and record
    if !current_tag.is_empty() {
        if let Some(ref mut item) = current {
            flush_field(item, &current_tag, &current_value, &mut authors, &mut keywords);
        }
    }
    if let Some(mut item) = current {
        if !authors.is_empty() { item.author = Some(authors); }
        if !keywords.is_empty() { item.keyword = Some(keywords.join(", ")); }
        result.entries.push(item);
    }

    result
}

fn parse_medline_author(name: &str) -> Name {
    // MEDLINE format: "LastName Initials" e.g., "Smith JA"
    let parts: Vec<&str> = name.trim().split_whitespace().collect();
    if parts.len() >= 2 {
        let family = parts[0].to_string();
        let initials = parts[1..].join(" ");
        // Add dots between initials: "JA" -> "J. A."
        let given = initials.chars()
            .map(|c| format!("{}.", c))
            .collect::<Vec<_>>()
            .join(" ");
        Name { family: Some(family), given: Some(given), ..Default::default() }
    } else {
        Name { literal: Some(name.trim().to_string()), ..Default::default() }
    }
}

fn parse_month_abbr(s: &str) -> Option<i32> {
    match s.to_lowercase().get(..3) {
        Some("jan") => Some(1), Some("feb") => Some(2), Some("mar") => Some(3),
        Some("apr") => Some(4), Some("may") => Some(5), Some("jun") => Some(6),
        Some("jul") => Some(7), Some("aug") => Some(8), Some("sep") => Some(9),
        Some("oct") => Some(10), Some("nov") => Some(11), Some("dec") => Some(12),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_medline() {
        let nbib = "\
PMID- 12345678
TI  - A study of neural networks in climate modeling
AU  - Smith JA
AU  - Doe JB
AU  - Wilson RC
TA  - Nature
DP  - 2024 Mar 15
VI  - 614
IP  - 3
PG  - 245-260
AID - 10.1038/test [doi]
AB  - This is the abstract.
PT  - Journal Article
";
        let result = parse_medline(nbib);
        assert_eq!(result.entries.len(), 1);
        let item = &result.entries[0];
        assert_eq!(item.title.as_deref(), Some("A study of neural networks in climate modeling"));
        assert_eq!(item.container_title.as_deref(), Some("Nature"));
        assert_eq!(item.doi.as_deref(), Some("10.1038/test"));
        assert_eq!(item.pmid.as_deref(), Some("12345678"));
        assert_eq!(item.author.as_ref().unwrap().len(), 3);
        assert_eq!(item.author.as_ref().unwrap()[0].family.as_deref(), Some("Smith"));
        assert_eq!(item.author.as_ref().unwrap()[0].given.as_deref(), Some("J. A."));
    }
}
