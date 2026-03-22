use crate::types::{CslItem, DateVariable, ItemType, Name, StringOrNumber};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ParseResult {
    pub entries: Vec<CslItem>,
    pub errors: Vec<String>,
}

/// Column mapping: CSV header name → CSL field name
pub type ColumnMap = HashMap<String, String>;

/// Default column mapping — maps common CSV header names to CSL fields
pub fn default_column_map() -> ColumnMap {
    let mut m = HashMap::new();
    // Title variations
    for h in &["title", "Title", "TITLE", "Article Title", "Document Title", "Name"] {
        m.insert(h.to_string(), "title".to_string());
    }
    // Author variations
    for h in &["author", "Author", "AUTHORS", "authors", "Author(s)", "Creator"] {
        m.insert(h.to_string(), "author".to_string());
    }
    // Year/date variations
    for h in &["year", "Year", "YEAR", "date", "Date", "Publication Year", "Pub Year", "Publication Date"] {
        m.insert(h.to_string(), "issued".to_string());
    }
    // Journal/container
    for h in &["journal", "Journal", "Source", "source", "Source Title", "Publication", "Container"] {
        m.insert(h.to_string(), "container-title".to_string());
    }
    // Volume
    for h in &["volume", "Volume", "Vol", "vol"] {
        m.insert(h.to_string(), "volume".to_string());
    }
    // Issue
    for h in &["issue", "Issue", "Number", "number", "No", "no"] {
        m.insert(h.to_string(), "issue".to_string());
    }
    // Pages
    for h in &["pages", "Pages", "Page", "page", "Start Page", "Page Range"] {
        m.insert(h.to_string(), "page".to_string());
    }
    // DOI
    for h in &["doi", "DOI", "Doi", "Digital Object Identifier"] {
        m.insert(h.to_string(), "DOI".to_string());
    }
    // URL
    for h in &["url", "URL", "Url", "Link", "link"] {
        m.insert(h.to_string(), "URL".to_string());
    }
    // Publisher
    for h in &["publisher", "Publisher", "PUBLISHER"] {
        m.insert(h.to_string(), "publisher".to_string());
    }
    // ISBN
    for h in &["isbn", "ISBN"] {
        m.insert(h.to_string(), "ISBN".to_string());
    }
    // ISSN
    for h in &["issn", "ISSN"] {
        m.insert(h.to_string(), "ISSN".to_string());
    }
    // Abstract
    for h in &["abstract", "Abstract", "ABSTRACT", "Description"] {
        m.insert(h.to_string(), "abstract".to_string());
    }
    // Type
    for h in &["type", "Type", "Item Type", "Document Type", "Resource Type"] {
        m.insert(h.to_string(), "type".to_string());
    }
    // Keywords
    for h in &["keywords", "Keywords", "Tags", "tags", "Subjects"] {
        m.insert(h.to_string(), "keyword".to_string());
    }
    // Language
    for h in &["language", "Language", "Lang"] {
        m.insert(h.to_string(), "language".to_string());
    }
    m
}

/// Parse CSV/TSV text into CSL-JSON items
/// delimiter: ',' for CSV, '\t' for TSV
pub fn parse_csv(input: &str, delimiter: char, column_map: &ColumnMap) -> ParseResult {
    let mut result = ParseResult { entries: Vec::new(), errors: Vec::new() };

    let mut lines = input.lines();

    // Parse header row
    let header_line = match lines.next() {
        Some(h) => h,
        None => { result.errors.push("Empty CSV".to_string()); return result; }
    };
    let headers: Vec<String> = parse_csv_row(header_line, delimiter);

    // Map header indices to CSL fields
    let field_indices: Vec<(usize, String)> = headers.iter().enumerate()
        .filter_map(|(i, h)| column_map.get(h.trim()).map(|f| (i, f.clone())))
        .collect();

    if field_indices.is_empty() {
        result.errors.push(format!(
            "No recognized columns. Found: {}. Expected: title, author, year, journal, etc.",
            headers.join(", ")
        ));
        return result;
    }

    // Parse data rows
    let mut row_num = 1;
    for line in lines {
        row_num += 1;
        let line = line.trim();
        if line.is_empty() { continue; }

        let values = parse_csv_row(line, delimiter);
        let mut item = CslItem {
            id: format!("csv-{}", row_num),
            ..Default::default()
        };

        for (idx, field) in &field_indices {
            let val = values.get(*idx).map(|s| s.trim()).unwrap_or("");
            if val.is_empty() { continue; }

            match field.as_str() {
                "title" => item.title = Some(val.to_string()),
                "author" => {
                    // Parse "Last, First; Last, First" or "Last, First and Last, First"
                    let authors: Vec<Name> = val.split(|c| c == ';' || (c == '&'))
                        .flat_map(|s| s.split(" and "))
                        .map(|n| {
                            let n = n.trim();
                            if n.contains(',') {
                                let (f, g) = n.split_once(',').unwrap();
                                Name { family: Some(f.trim().to_string()), given: Some(g.trim().to_string()), ..Default::default() }
                            } else {
                                let parts: Vec<&str> = n.split_whitespace().collect();
                                if parts.len() == 1 { Name { literal: Some(parts[0].to_string()), ..Default::default() } }
                                else {
                                    let family = parts.last().unwrap().to_string();
                                    let given = parts[..parts.len()-1].join(" ");
                                    Name { family: Some(family), given: Some(given), ..Default::default() }
                                }
                            }
                        })
                        .filter(|n| n.family.is_some() || n.literal.is_some())
                        .collect();
                    if !authors.is_empty() { item.author = Some(authors); }
                }
                "issued" => {
                    // Try year first, then full date
                    if let Ok(y) = val.parse::<i32>() {
                        item.issued = Some(DateVariable { date_parts: Some(vec![vec![y]]), ..Default::default() });
                    } else {
                        let parts: Vec<i32> = val.split(|c: char| c == '-' || c == '/')
                            .filter_map(|p| p.trim().parse().ok())
                            .collect();
                        if !parts.is_empty() {
                            item.issued = Some(DateVariable { date_parts: Some(vec![parts]), ..Default::default() });
                        }
                    }
                }
                "container-title" => item.container_title = Some(val.to_string()),
                "volume" => item.volume = Some(StringOrNumber::String(val.to_string())),
                "issue" => item.issue = Some(StringOrNumber::String(val.to_string())),
                "page" => item.page = Some(val.to_string()),
                "DOI" => item.doi = Some(val.to_string()),
                "URL" => item.url = Some(val.to_string()),
                "publisher" => item.publisher = Some(val.to_string()),
                "ISBN" => item.isbn = Some(val.to_string()),
                "ISSN" => item.issn = Some(val.to_string()),
                "abstract" => item.abstract_ = Some(val.to_string()),
                "keyword" => item.keyword = Some(val.to_string()),
                "language" => item.language = Some(val.to_string()),
                "type" => {
                    item.item_type = match val.to_lowercase().as_str() {
                        "journal article" | "article" => ItemType::ArticleJournal,
                        "book" => ItemType::Book,
                        "chapter" | "book section" => ItemType::Chapter,
                        "conference" | "conference paper" => ItemType::PaperConference,
                        "thesis" | "dissertation" => ItemType::Thesis,
                        "report" => ItemType::Report,
                        "webpage" | "web page" => ItemType::Webpage,
                        _ => ItemType::Document,
                    };
                }
                _ => {}
            }
        }

        // Only add if it has at least a title
        if item.title.is_some() {
            result.entries.push(item);
        }
    }

    result
}

/// Parse a single CSV row handling quoted fields
fn parse_csv_row(line: &str, delimiter: char) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '"' {
            if in_quotes {
                if chars.peek() == Some(&'"') {
                    // Escaped quote
                    current.push('"');
                    chars.next();
                } else {
                    in_quotes = false;
                }
            } else {
                in_quotes = true;
            }
        } else if c == delimiter && !in_quotes {
            fields.push(current.clone());
            current.clear();
        } else {
            current.push(c);
        }
    }
    fields.push(current);
    fields
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_csv() {
        let csv = "title,author,year,journal,volume,pages,doi\n\
                    Test Article,\"Smith, John; Doe, Jane\",2024,Nature,42,100-120,10.1038/test\n\
                    Another Paper,\"Wilson, Bob\",2023,Science,380,50-55,10.1126/abc";
        let map = default_column_map();
        let result = parse_csv(csv, ',', &map);
        assert_eq!(result.entries.len(), 2);
        assert_eq!(result.entries[0].title.as_deref(), Some("Test Article"));
        assert_eq!(result.entries[0].author.as_ref().unwrap().len(), 2);
        assert_eq!(result.entries[0].doi.as_deref(), Some("10.1038/test"));
        assert_eq!(result.entries[1].title.as_deref(), Some("Another Paper"));
    }

    #[test]
    fn test_parse_tsv() {
        let tsv = "Title\tAuthor\tYear\tJournal\n\
                    Test\tSmith, John\t2024\tNature";
        let map = default_column_map();
        let result = parse_csv(tsv, '\t', &map);
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].title.as_deref(), Some("Test"));
    }

    #[test]
    fn test_quoted_fields() {
        let csv = "title,author\n\"Title with, comma\",\"Smith, John\"";
        let map = default_column_map();
        let result = parse_csv(csv, ',', &map);
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].title.as_deref(), Some("Title with, comma"));
    }

    #[test]
    fn test_unknown_columns() {
        let csv = "foo,bar,baz\n1,2,3";
        let map = default_column_map();
        let result = parse_csv(csv, ',', &map);
        assert_eq!(result.entries.len(), 0);
        assert!(!result.errors.is_empty());
    }
}
