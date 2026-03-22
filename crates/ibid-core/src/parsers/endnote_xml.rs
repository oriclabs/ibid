use quick_xml::Reader;
use quick_xml::events::Event;

use crate::error::{IbidError, Result};
use crate::types::{CslItem, DateVariable, ItemType, Name, StringOrNumber};

#[derive(Debug, Clone)]
pub struct ParseResult {
    pub entries: Vec<CslItem>,
    pub errors: Vec<String>,
}

/// Parse EndNote XML export into CSL-JSON items
pub fn parse_endnote_xml(input: &str) -> ParseResult {
    let mut result = ParseResult { entries: Vec::new(), errors: Vec::new() };
    let mut reader = Reader::from_str(input);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut in_record = false;
    let mut current_item = CslItem::default();
    let mut current_tag = String::new();
    let mut current_text = String::new();
    let mut authors: Vec<Name> = Vec::new();
    let mut entry_count = 0;
    let mut context: Vec<String> = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "record" => {
                        in_record = true;
                        entry_count += 1;
                        current_item = CslItem { id: format!("endnote-{}", entry_count), ..Default::default() };
                        authors = Vec::new();
                    }
                    _ => {}
                }
                context.push(tag);
                current_text.clear();
            }
            Ok(Event::Text(ref e)) => {
                current_text = e.unescape().unwrap_or_default().to_string();
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();

                if in_record {
                    let parent = context.get(context.len().saturating_sub(2)).map(|s| s.as_str()).unwrap_or("");
                    match (tag.as_str(), parent) {
                        ("style", _) => {
                            // <style> inside various fields contains formatted text — use as value
                        }
                        ("title", "titles") => current_item.title = Some(current_text.clone()),
                        ("secondary-title", "titles") => current_item.container_title = Some(current_text.clone()),
                        ("author", "authors") | ("author", _) => {
                            if !current_text.is_empty() {
                                authors.push(parse_endnote_name(&current_text));
                            }
                        }
                        ("year", "dates") | ("year", _) => {
                            if let Ok(y) = current_text.trim().parse::<i32>() {
                                current_item.issued = Some(DateVariable {
                                    date_parts: Some(vec![vec![y]]),
                                    ..Default::default()
                                });
                            }
                        }
                        ("volume", _) => {
                            current_item.volume = Some(StringOrNumber::String(current_text.clone()));
                        }
                        ("number", _) => {
                            current_item.issue = Some(StringOrNumber::String(current_text.clone()));
                        }
                        ("pages", _) => {
                            current_item.page = Some(current_text.replace("--", "\u{2013}").replace('-', "\u{2013}"));
                        }
                        ("isbn", _) | ("issn", _) => {
                            let val = current_text.trim().to_string();
                            if val.contains("978") || val.contains("979") || val.len() > 10 {
                                current_item.isbn = Some(val);
                            } else {
                                current_item.issn = Some(val);
                            }
                        }
                        ("electronic-resource-num", _) => {
                            // Usually DOI
                            if current_text.contains("10.") {
                                current_item.doi = Some(current_text.clone());
                            }
                        }
                        ("url", "urls") | ("url", "related-urls") | ("url", _) => {
                            if current_item.url.is_none() && current_text.starts_with("http") {
                                current_item.url = Some(current_text.clone());
                            }
                        }
                        ("publisher", _) => {
                            current_item.publisher = Some(current_text.clone());
                        }
                        ("pub-location", _) => {
                            current_item.publisher_place = Some(current_text.clone());
                        }
                        ("abstract", _) => {
                            current_item.abstract_ = Some(current_text.clone());
                        }
                        ("notes", _) | ("note", _) => {
                            current_item.note = Some(current_text.clone());
                        }
                        ("keyword", "keywords") => {
                            let existing = current_item.keyword.take().unwrap_or_default();
                            current_item.keyword = Some(if existing.is_empty() {
                                current_text.clone()
                            } else {
                                format!("{}, {}", existing, current_text)
                            });
                        }
                        ("language", _) => {
                            current_item.language = Some(current_text.clone());
                        }
                        ("ref-type", _) => {
                            current_item.item_type = map_endnote_type(&current_text);
                        }
                        ("record", _) => {
                            if !authors.is_empty() {
                                current_item.author = Some(authors.clone());
                            }
                            result.entries.push(current_item.clone());
                            in_record = false;
                        }
                        _ => {}
                    }
                }

                context.pop();
                current_text.clear();
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                result.errors.push(format!("XML error: {}", e));
                break;
            }
            _ => {}
        }
        buf.clear();
    }

    result
}

fn parse_endnote_name(name: &str) -> Name {
    let name = name.trim();
    if name.contains(',') {
        let (family, given) = name.split_once(',').unwrap();
        Name {
            family: Some(family.trim().to_string()),
            given: Some(given.trim().to_string()),
            ..Default::default()
        }
    } else {
        let parts: Vec<&str> = name.split_whitespace().collect();
        if parts.len() == 1 {
            Name { literal: Some(parts[0].to_string()), ..Default::default() }
        } else {
            let family = parts.last().unwrap().to_string();
            let given = parts[..parts.len()-1].join(" ");
            Name { family: Some(family), given: Some(given), ..Default::default() }
        }
    }
}

fn map_endnote_type(name: &str) -> ItemType {
    match name.trim().to_lowercase().as_str() {
        "journal article" | "0" | "17" => ItemType::ArticleJournal,
        "book" | "6" => ItemType::Book,
        "book section" | "5" => ItemType::Chapter,
        "conference paper" | "conference proceedings" | "10" | "47" => ItemType::PaperConference,
        "thesis" | "32" => ItemType::Thesis,
        "report" | "27" => ItemType::Report,
        "web page" | "12" => ItemType::Webpage,
        "newspaper article" | "23" => ItemType::ArticleNewspaper,
        "magazine article" | "19" => ItemType::ArticleMagazine,
        "patent" | "25" => ItemType::Patent,
        "film or broadcast" | "21" => ItemType::MotionPicture,
        "computer program" | "9" => ItemType::Software,
        "map" | "20" => ItemType::Map,
        "bill" | "3" => ItemType::Bill,
        "case" | "7" => ItemType::LegalCase,
        "statute" | "31" => ItemType::Legislation,
        "hearing" | "14" => ItemType::Hearing,
        "edited book" | "28" => ItemType::Book,
        "electronic article" | "43" => ItemType::ArticleJournal,
        _ => ItemType::Document,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_endnote_xml() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<xml><records><record>
  <ref-type>Journal Article</ref-type>
  <contributors><authors>
    <author>Smith, John</author>
    <author>Doe, Jane</author>
  </authors></contributors>
  <titles><title>Test Article</title>
  <secondary-title>Nature</secondary-title></titles>
  <dates><year>2024</year></dates>
  <volume>42</volume>
  <number>3</number>
  <pages>100-120</pages>
  <electronic-resource-num>10.1038/test</electronic-resource-num>
</record></records></xml>"#;

        let result = parse_endnote_xml(xml);
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].title.as_deref(), Some("Test Article"));
        assert_eq!(result.entries[0].container_title.as_deref(), Some("Nature"));
        assert_eq!(result.entries[0].doi.as_deref(), Some("10.1038/test"));
        assert_eq!(result.entries[0].author.as_ref().unwrap().len(), 2);
    }
}
