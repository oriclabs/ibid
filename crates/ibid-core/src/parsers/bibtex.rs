use std::collections::HashMap;

use crate::error::{IbidError, Result};
use crate::types::{CslItem, DateVariable, ItemType, Name, StringOrNumber};

/// Parse result for a single BibTeX entry
#[derive(Debug, Clone)]
pub struct ParsedEntry {
    pub item: CslItem,
    pub warnings: Vec<String>,
}

/// Parse result for a full BibTeX file
#[derive(Debug, Clone)]
pub struct ParseResult {
    pub entries: Vec<ParsedEntry>,
    pub errors: Vec<String>,
}

/// Parse a BibTeX string into CSL-JSON items
pub fn parse_bibtex(input: &str) -> ParseResult {
    let mut result = ParseResult {
        entries: Vec::new(),
        errors: Vec::new(),
    };

    let mut pos = 0;
    let bytes = input.as_bytes();
    let len = bytes.len();

    while pos < len {
        // Skip whitespace and comments
        pos = skip_whitespace_and_comments(input, pos);
        if pos >= len {
            break;
        }

        // Look for @
        if bytes[pos] != b'@' {
            pos += 1;
            continue;
        }
        pos += 1;

        // Read entry type
        let (entry_type, new_pos) = read_identifier(input, pos);
        pos = new_pos;
        let entry_type_lower = entry_type.to_lowercase();

        // Skip @string, @preamble, @comment
        if entry_type_lower == "string" || entry_type_lower == "preamble" || entry_type_lower == "comment" {
            pos = skip_braced_block(input, pos);
            continue;
        }

        // Expect { or (
        pos = skip_ws(input, pos);
        if pos >= len {
            break;
        }
        let (open, close) = if bytes[pos] == b'{' {
            (b'{', b'}')
        } else if bytes[pos] == b'(' {
            (b'(', b')')
        } else {
            result.errors.push(format!("Expected '{{' or '(' after @{}", entry_type));
            pos += 1;
            continue;
        };
        pos += 1;

        // Read citation key
        pos = skip_ws(input, pos);
        let (cite_key, new_pos) = read_until_comma_or_close(input, pos, close);
        pos = new_pos;
        let cite_key = cite_key.trim().to_string();

        // Skip comma after key
        if pos < len && bytes[pos] == b',' {
            pos += 1;
        }

        // Read fields
        let mut fields: HashMap<String, String> = HashMap::new();
        loop {
            pos = skip_ws(input, pos);
            if pos >= len || bytes[pos] == close {
                if pos < len {
                    pos += 1;
                }
                break;
            }

            // Read field name
            let (field_name, new_pos) = read_identifier(input, pos);
            pos = new_pos;
            if field_name.is_empty() {
                // Skip unexpected character
                pos += 1;
                continue;
            }

            // Expect =
            pos = skip_ws(input, pos);
            if pos >= len || bytes[pos] != b'=' {
                continue;
            }
            pos += 1;

            // Read field value
            pos = skip_ws(input, pos);
            let (value, new_pos) = read_field_value(input, pos);
            pos = new_pos;

            fields.insert(field_name.to_lowercase(), clean_latex(&value));

            // Skip comma
            pos = skip_ws(input, pos);
            if pos < len && bytes[pos] == b',' {
                pos += 1;
            }
        }

        // Convert to CslItem
        match convert_to_csl(&entry_type_lower, &cite_key, &fields) {
            Ok(parsed) => result.entries.push(parsed),
            Err(e) => result.errors.push(format!("Error in @{}{{{}}}: {}", entry_type, cite_key, e)),
        }
    }

    result
}

// =============================================================================
// BibTeX → CSL-JSON conversion
// =============================================================================

fn convert_to_csl(
    entry_type: &str,
    cite_key: &str,
    fields: &HashMap<String, String>,
) -> Result<ParsedEntry> {
    let mut warnings: Vec<String> = Vec::new();
    let item_type = map_bibtex_type(entry_type);

    let mut item = CslItem {
        id: cite_key.to_string(),
        item_type,
        citation_key: Some(cite_key.to_string()),
        ..Default::default()
    };

    // Title
    item.title = fields.get("title").map(|t| strip_braces(t));

    // Author
    if let Some(author_str) = fields.get("author") {
        item.author = Some(parse_bibtex_names(author_str));
    }

    // Editor
    if let Some(editor_str) = fields.get("editor") {
        item.editor = Some(parse_bibtex_names(editor_str));
    }

    // Date
    if let Some(year) = fields.get("year") {
        let month = fields.get("month").map(|m| parse_month(m)).flatten();
        let day = fields.get("day").and_then(|d| d.parse::<i32>().ok());
        let mut parts = vec![year.trim().parse::<i32>().unwrap_or(0)];
        if let Some(m) = month {
            parts.push(m);
            if let Some(d) = day {
                parts.push(d);
            }
        }
        item.issued = Some(DateVariable {
            date_parts: Some(vec![parts]),
            ..Default::default()
        });
    } else if let Some(date) = fields.get("date") {
        // BibLaTeX date format: YYYY-MM-DD
        let parts: Vec<i32> = date.split('-').filter_map(|p| p.trim().parse().ok()).collect();
        if !parts.is_empty() {
            item.issued = Some(DateVariable {
                date_parts: Some(vec![parts]),
                ..Default::default()
            });
        }
    }

    // Journal / booktitle → container-title
    item.container_title = fields
        .get("journal")
        .or_else(|| fields.get("journaltitle"))
        .or_else(|| fields.get("booktitle"))
        .map(|s| strip_braces(s));

    // Volume, issue, pages
    item.volume = fields.get("volume").map(|v| StringOrNumber::String(v.clone()));
    item.issue = fields
        .get("number")
        .or_else(|| fields.get("issue"))
        .map(|v| StringOrNumber::String(v.clone()));
    item.page = fields.get("pages").map(|p| p.replace("--", "\u{2013}").replace('-', "\u{2013}"));

    // Publisher
    item.publisher = fields
        .get("publisher")
        .or_else(|| fields.get("organization"))
        .or_else(|| fields.get("institution"))
        .map(|s| strip_braces(s));
    item.publisher_place = fields.get("address").or_else(|| fields.get("location")).cloned();

    // Identifiers
    item.doi = fields.get("doi").cloned();
    item.isbn = fields.get("isbn").cloned();
    item.issn = fields.get("issn").cloned();
    item.url = fields.get("url").or_else(|| fields.get("howpublished")).and_then(|u| {
        if u.starts_with("http") || u.starts_with("\\url{") {
            Some(u.replace("\\url{", "").replace('}', ""))
        } else {
            None
        }
    });

    // Abstract, note, keywords
    item.abstract_ = fields.get("abstract").cloned();
    item.note = fields.get("note").or_else(|| fields.get("annote")).cloned();
    item.keyword = fields.get("keywords").or_else(|| fields.get("keyword")).cloned();

    // Edition
    item.edition = fields.get("edition").map(|e| StringOrNumber::String(e.clone()));

    // Chapter
    item.chapter_number = fields.get("chapter").map(|c| StringOrNumber::String(c.clone()));

    // Series → collection-title
    item.collection_title = fields.get("series").cloned();

    // Language
    item.language = fields.get("language").cloned();

    Ok(ParsedEntry { item, warnings })
}

fn map_bibtex_type(bib_type: &str) -> ItemType {
    match bib_type {
        "article" => ItemType::ArticleJournal,
        "book" => ItemType::Book,
        "booklet" => ItemType::Pamphlet,
        "inbook" | "incollection" => ItemType::Chapter,
        "inproceedings" | "conference" => ItemType::PaperConference,
        "manual" => ItemType::Report,
        "mastersthesis" | "phdthesis" | "thesis" => ItemType::Thesis,
        "misc" | "unpublished" => ItemType::Document,
        "online" | "electronic" => ItemType::Webpage,
        "patent" => ItemType::Patent,
        "proceedings" => ItemType::Book,
        "report" | "techreport" => ItemType::Report,
        "software" => ItemType::Software,
        "dataset" => ItemType::Dataset,
        _ => ItemType::Document,
    }
}

// =============================================================================
// BibTeX name parsing: "Last, First and Last, First" or "First Last and ..."
// =============================================================================

fn parse_bibtex_names(input: &str) -> Vec<Name> {
    let input = strip_braces(input);
    input
        .split(" and ")
        .map(|name| {
            let name = name.trim();
            if name.is_empty() {
                return Name {
                    literal: Some(String::new()),
                    ..Default::default()
                };
            }

            // Check for "Last, First" format
            if let Some(comma_pos) = name.find(',') {
                let family = name[..comma_pos].trim().to_string();
                let given = name[comma_pos + 1..].trim().to_string();

                // Check for suffix: "Last, Suffix, First" (3-part)
                if let Some(comma2) = given.find(',') {
                    let suffix = given[..comma2].trim().to_string();
                    let actual_given = given[comma2 + 1..].trim().to_string();
                    return Name {
                        family: Some(family),
                        given: Some(actual_given),
                        suffix: Some(suffix),
                        ..Default::default()
                    };
                }

                return Name {
                    family: Some(family),
                    given: if given.is_empty() { None } else { Some(given) },
                    ..Default::default()
                };
            }

            // "First Last" format — check for particles (von, de, van, etc.)
            let parts: Vec<&str> = name.split_whitespace().collect();
            if parts.len() == 1 {
                return Name {
                    literal: Some(parts[0].to_string()),
                    ..Default::default()
                };
            }

            // Find where the family name starts (first lowercase word = particle start)
            let mut family_start = parts.len() - 1;
            for i in (1..parts.len()).rev() {
                let first_char = parts[i].chars().next().unwrap_or('A');
                if first_char.is_uppercase() {
                    family_start = i;
                    break;
                }
            }

            // Check for particles (von, de, van, etc.)
            let mut particle_parts = Vec::new();
            let mut given_end = family_start;
            for i in 1..family_start {
                let first_char = parts[i].chars().next().unwrap_or('A');
                if first_char.is_lowercase() {
                    if particle_parts.is_empty() {
                        given_end = i;
                    }
                    particle_parts.push(parts[i]);
                }
            }

            let given = parts[..given_end].join(" ");
            let particle = if particle_parts.is_empty() {
                None
            } else {
                Some(particle_parts.join(" "))
            };
            let family = parts[family_start..].join(" ");

            Name {
                family: Some(family),
                given: if given.is_empty() { None } else { Some(given) },
                non_dropping_particle: particle,
                ..Default::default()
            }
        })
        .filter(|n| {
            n.family.is_some() || n.given.is_some() || n.literal.as_ref().map(|l| !l.is_empty()).unwrap_or(false)
        })
        .collect()
}

// =============================================================================
// Tokenizer helpers
// =============================================================================

fn skip_ws(input: &str, mut pos: usize) -> usize {
    let bytes = input.as_bytes();
    while pos < bytes.len() && (bytes[pos] == b' ' || bytes[pos] == b'\t' || bytes[pos] == b'\n' || bytes[pos] == b'\r') {
        pos += 1;
    }
    pos
}

fn skip_whitespace_and_comments(input: &str, mut pos: usize) -> usize {
    let bytes = input.as_bytes();
    while pos < bytes.len() {
        if bytes[pos] == b' ' || bytes[pos] == b'\t' || bytes[pos] == b'\n' || bytes[pos] == b'\r' {
            pos += 1;
        } else if bytes[pos] == b'%' {
            // Line comment
            while pos < bytes.len() && bytes[pos] != b'\n' {
                pos += 1;
            }
        } else {
            break;
        }
    }
    pos
}

fn read_identifier(input: &str, mut pos: usize) -> (String, usize) {
    let bytes = input.as_bytes();
    let start = pos;
    while pos < bytes.len() && (bytes[pos].is_ascii_alphanumeric() || bytes[pos] == b'_' || bytes[pos] == b'-' || bytes[pos] == b'.') {
        pos += 1;
    }
    (input[start..pos].to_string(), pos)
}

fn read_until_comma_or_close(input: &str, mut pos: usize, close: u8) -> (String, usize) {
    let bytes = input.as_bytes();
    let start = pos;
    while pos < bytes.len() && bytes[pos] != b',' && bytes[pos] != close {
        pos += 1;
    }
    (input[start..pos].to_string(), pos)
}

fn skip_braced_block(input: &str, mut pos: usize) -> usize {
    let bytes = input.as_bytes();
    pos = skip_ws(input, pos);
    if pos >= bytes.len() {
        return pos;
    }
    let (open, close) = if bytes[pos] == b'{' {
        (b'{', b'}')
    } else if bytes[pos] == b'(' {
        (b'(', b')')
    } else {
        return pos;
    };
    pos += 1;
    let mut depth = 1;
    while pos < bytes.len() && depth > 0 {
        if bytes[pos] == open {
            depth += 1;
        } else if bytes[pos] == close {
            depth -= 1;
        }
        pos += 1;
    }
    pos
}

fn read_field_value(input: &str, mut pos: usize) -> (String, usize) {
    let bytes = input.as_bytes();
    if pos >= bytes.len() {
        return (String::new(), pos);
    }

    let mut parts: Vec<String> = Vec::new();

    loop {
        pos = skip_ws(input, pos);
        if pos >= bytes.len() {
            break;
        }

        if bytes[pos] == b'{' {
            // Braced value
            let (val, new_pos) = read_braced(input, pos);
            parts.push(val);
            pos = new_pos;
        } else if bytes[pos] == b'"' {
            // Quoted value
            let (val, new_pos) = read_quoted(input, pos);
            parts.push(val);
            pos = new_pos;
        } else if bytes[pos].is_ascii_digit() {
            // Bare number
            let start = pos;
            while pos < bytes.len() && bytes[pos].is_ascii_digit() {
                pos += 1;
            }
            parts.push(input[start..pos].to_string());
        } else if bytes[pos].is_ascii_alphabetic() {
            // Bare identifier (macro reference — we just keep the name)
            let (ident, new_pos) = read_identifier(input, pos);
            parts.push(ident);
            pos = new_pos;
        } else {
            break;
        }

        // Check for # concatenation
        pos = skip_ws(input, pos);
        if pos < bytes.len() && bytes[pos] == b'#' {
            pos += 1;
        } else {
            break;
        }
    }

    (parts.join(""), pos)
}

fn read_braced(input: &str, mut pos: usize) -> (String, usize) {
    let bytes = input.as_bytes();
    if pos >= bytes.len() || bytes[pos] != b'{' {
        return (String::new(), pos);
    }
    pos += 1;
    let start = pos;
    let mut depth = 1;
    while pos < bytes.len() && depth > 0 {
        if bytes[pos] == b'{' {
            depth += 1;
        } else if bytes[pos] == b'}' {
            depth -= 1;
        }
        if depth > 0 {
            pos += 1;
        }
    }
    let val = input[start..pos].to_string();
    if pos < bytes.len() {
        pos += 1; // skip closing }
    }
    (val, pos)
}

fn read_quoted(input: &str, mut pos: usize) -> (String, usize) {
    let bytes = input.as_bytes();
    if pos >= bytes.len() || bytes[pos] != b'"' {
        return (String::new(), pos);
    }
    pos += 1;
    let start = pos;
    let mut depth = 0;
    while pos < bytes.len() {
        if bytes[pos] == b'{' {
            depth += 1;
        } else if bytes[pos] == b'}' {
            depth -= 1;
        } else if bytes[pos] == b'"' && depth == 0 {
            break;
        }
        pos += 1;
    }
    let val = input[start..pos].to_string();
    if pos < bytes.len() {
        pos += 1; // skip closing "
    }
    (val, pos)
}

// =============================================================================
// LaTeX cleanup
// =============================================================================

fn strip_braces(s: &str) -> String {
    let s = s.trim();
    // Remove outer braces if present
    if s.starts_with('{') && s.ends_with('}') {
        strip_braces(&s[1..s.len() - 1])
    } else {
        // Remove remaining inner braces
        s.replace('{', "").replace('}', "")
    }
}

fn clean_latex(s: &str) -> String {
    let mut result = s.to_string();

    // Common LaTeX accents
    let replacements = [
        (r#"\'{a}"#, "á"), (r#"\'{e}"#, "é"), (r#"\'{i}"#, "í"),
        (r#"\'{o}"#, "ó"), (r#"\'{u}"#, "ú"), (r#"\`{a}"#, "à"),
        (r#"\`{e}"#, "è"), (r#"\`{o}"#, "ò"), (r#"\^{a}"#, "â"),
        (r#"\^{e}"#, "ê"), (r#"\^{o}"#, "ô"), (r#"\"{a}"#, "ä"),
        (r#"\"{o}"#, "ö"), (r#"\"{u}"#, "ü"), (r#"\~{n}"#, "ñ"),
        (r#"\c{c}"#, "ç"), (r#"\ss"#, "ß"),
        (r"\'a", "á"), (r"\'e", "é"), (r"\'i", "í"),
        (r"\'o", "ó"), (r"\'u", "ú"), (r"\`a", "à"),
        (r"\`e", "è"), (r"\`o", "ò"),
        (r"\&", "&"), (r"\%", "%"), (r"\_", "_"),
        (r"\textendash", "\u{2013}"), (r"\textemdash", "\u{2014}"),
        ("--", "\u{2013}"), ("---", "\u{2014}"),
        (r"\textit", ""), (r"\textbf", ""), (r"\emph", ""),
        (r"\url", ""),
    ];

    for (from, to) in &replacements {
        result = result.replace(from, to);
    }

    // Remove remaining \command sequences
    // Keep the content inside braces: \textit{word} → word
    result = result.replace('~', "\u{00A0}"); // non-breaking space

    result
}

fn parse_month(month: &str) -> Option<i32> {
    let m = month.to_lowercase();
    let m = m.trim().trim_matches(|c: char| !c.is_alphanumeric());
    match m.get(..3).unwrap_or(&m) {
        "jan" | "1" => Some(1),
        "feb" | "2" => Some(2),
        "mar" | "3" => Some(3),
        "apr" | "4" => Some(4),
        "may" | "5" => Some(5),
        "jun" | "6" => Some(6),
        "jul" | "7" => Some(7),
        "aug" | "8" => Some(8),
        "sep" | "9" => Some(9),
        "oct" => Some(10),
        "nov" => Some(11),
        "dec" => Some(12),
        "10" => Some(10),
        "11" => Some(11),
        "12" => Some(12),
        _ => None,
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_article() {
        let bib = r#"
@article{smith2023,
  author = {Smith, John A. and Doe, Jane},
  title = {A Study of Things},
  journal = {Nature},
  year = {2023},
  volume = {42},
  number = {3},
  pages = {100--120},
  doi = {10.1038/nature12345}
}
"#;
        let result = parse_bibtex(bib);
        assert!(result.errors.is_empty(), "Errors: {:?}", result.errors);
        assert_eq!(result.entries.len(), 1);

        let item = &result.entries[0].item;
        assert_eq!(item.id, "smith2023");
        assert_eq!(item.title.as_deref(), Some("A Study of Things"));
        assert_eq!(item.container_title.as_deref(), Some("Nature"));
        assert_eq!(item.doi.as_deref(), Some("10.1038/nature12345"));

        let authors = item.author.as_ref().unwrap();
        assert_eq!(authors.len(), 2);
        assert_eq!(authors[0].family.as_deref(), Some("Smith"));
        assert_eq!(authors[0].given.as_deref(), Some("John A."));
        assert_eq!(authors[1].family.as_deref(), Some("Doe"));

        let date = item.issued.as_ref().unwrap();
        assert_eq!(date.date_parts.as_ref().unwrap()[0], vec![2023]);

        assert_eq!(item.page.as_deref(), Some("100\u{2013}120"));
    }

    #[test]
    fn test_parse_book() {
        let bib = r#"
@book{knuth1984,
  author = {Donald E. Knuth},
  title = {The {TeXbook}},
  publisher = {Addison-Wesley},
  year = {1984},
  address = {Reading, MA}
}
"#;
        let result = parse_bibtex(bib);
        assert_eq!(result.entries.len(), 1);

        let item = &result.entries[0].item;
        assert_eq!(item.title.as_deref(), Some("The TeXbook"));
        assert_eq!(item.publisher.as_deref(), Some("Addison-Wesley"));
        assert_eq!(item.publisher_place.as_deref(), Some("Reading, MA"));

        let authors = item.author.as_ref().unwrap();
        assert_eq!(authors[0].given.as_deref(), Some("Donald E."));
        assert_eq!(authors[0].family.as_deref(), Some("Knuth"));
    }

    #[test]
    fn test_parse_multiple_entries() {
        let bib = r#"
@article{one, author={A}, title={T1}, year={2020}, journal={J1}}
@book{two, author={B}, title={T2}, year={2021}, publisher={P}}
@inproceedings{three, author={C}, title={T3}, year={2022}, booktitle={Conf}}
"#;
        let result = parse_bibtex(bib);
        assert_eq!(result.entries.len(), 3);
        assert_eq!(result.entries[0].item.id, "one");
        assert_eq!(result.entries[1].item.id, "two");
        assert_eq!(result.entries[2].item.id, "three");
    }

    #[test]
    fn test_parse_names_particles() {
        let names = parse_bibtex_names("Ludwig van Beethoven and Jean de La Fontaine");
        assert_eq!(names.len(), 2);
        assert_eq!(names[0].family.as_deref(), Some("Beethoven"));
        assert_eq!(names[0].non_dropping_particle.as_deref(), Some("van"));
    }

    #[test]
    fn test_latex_cleanup() {
        assert_eq!(clean_latex(r"Caf\'{e}"), "Caf\u{e9}");
        assert_eq!(clean_latex("100--200"), "100\u{2013}200");
    }
}
