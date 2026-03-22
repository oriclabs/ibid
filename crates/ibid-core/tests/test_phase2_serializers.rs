// Test: Phase 2 serializers — CSV, Word XML, YAML

mod helpers;
use helpers::*;
use ibid_core::serializers::{csv, word_xml, yaml};
use ibid_core::types::*;

// =============================================================================
// CSV Serializer
// =============================================================================

#[test]
fn test_csv_has_header() {
    let items = vec![journal_article()];
    let out = csv::serialize_csv(&items, ',', true);
    assert!(out.starts_with("type,title,author"));
}

#[test]
fn test_csv_no_header() {
    let items = vec![journal_article()];
    let out = csv::serialize_csv(&items, ',', false);
    assert!(!out.starts_with("type,title"));
    assert!(out.contains("Smith"));
}

#[test]
fn test_csv_escapes_commas() {
    let item = CslItem {
        id: "t".into(),
        title: Some("Title, with comma".into()),
        ..Default::default()
    };
    let out = csv::serialize_csv(&[item], ',', false);
    assert!(out.contains("\"Title, with comma\""));
}

#[test]
fn test_tsv_uses_tabs() {
    let items = vec![journal_article()];
    let out = csv::serialize_csv(&items, '\t', true);
    assert!(out.contains("type\ttitle\t"));
}

#[test]
fn test_csv_multiple_authors() {
    let items = vec![journal_article()]; // has 2 authors
    let out = csv::serialize_csv(&items, ',', false);
    assert!(out.contains("Smith, John Andrew; Doe, Jane"));
}

#[test]
fn test_csv_roundtrip() {
    let items = vec![journal_article()];
    let csv_text = csv::serialize_csv(&items, ',', true);
    let map = ibid_core::parsers::csv::default_column_map();
    let parsed = ibid_core::parsers::csv::parse_csv(&csv_text, ',', &map);
    assert_eq!(parsed.entries.len(), 1);
    assert!(parsed.entries[0].title.as_ref().unwrap().contains("climate change"));
}

// =============================================================================
// Word XML Serializer
// =============================================================================

#[test]
fn test_word_xml_structure() {
    let items = vec![journal_article()];
    let xml = word_xml::serialize_word_xml(&items);
    assert!(xml.contains("<?xml version"));
    assert!(xml.contains("<b:Sources"));
    assert!(xml.contains("<b:Source>"));
    assert!(xml.contains("</b:Sources>"));
}

#[test]
fn test_word_xml_fields() {
    let items = vec![journal_article()];
    let xml = word_xml::serialize_word_xml(&items);
    assert!(xml.contains("<b:Title>The impact of climate change on biodiversity</b:Title>"));
    assert!(xml.contains("<b:Last>Smith</b:Last>"));
    assert!(xml.contains("<b:First>John Andrew</b:First>"));
    assert!(xml.contains("<b:Year>2023</b:Year>"));
    assert!(xml.contains("<b:SourceType>JournalArticle</b:SourceType>"));
}

#[test]
fn test_word_xml_book_type() {
    let items = vec![book()];
    let xml = word_xml::serialize_word_xml(&items);
    assert!(xml.contains("<b:SourceType>Book</b:SourceType>"));
    assert!(xml.contains("<b:Publisher>Addison-Wesley</b:Publisher>"));
}

#[test]
fn test_word_xml_escapes() {
    let item = CslItem {
        id: "t".into(),
        title: Some("Title with <special> & \"chars\"".into()),
        ..Default::default()
    };
    let xml = word_xml::serialize_word_xml(&[item]);
    assert!(xml.contains("&lt;special&gt;"));
    assert!(xml.contains("&amp;"));
    assert!(xml.contains("&quot;chars&quot;"));
}

#[test]
fn test_word_xml_multiple() {
    let items = vec![journal_article(), book(), chapter()];
    let xml = word_xml::serialize_word_xml(&items);
    let count = xml.matches("<b:Source>").count();
    assert_eq!(count, 3);
}

// =============================================================================
// YAML Serializer
// =============================================================================

#[test]
fn test_yaml_structure() {
    let items = vec![journal_article()];
    let out = yaml::serialize_yaml(&items);
    assert!(out.starts_with("references:"));
    assert!(out.contains("  - id:"));
}

#[test]
fn test_yaml_fields() {
    let items = vec![journal_article()];
    let out = yaml::serialize_yaml(&items);
    assert!(out.contains("title: \"The impact of climate change on biodiversity\""));
    assert!(out.contains("family: \"Smith\""));
    assert!(out.contains("given: \"John Andrew\""));
    assert!(out.contains("type: \"article-journal\""));
    assert!(out.contains("DOI: \"10.1038/"));
}

#[test]
fn test_yaml_date() {
    let items = vec![journal_article()]; // 2023-5-15
    let out = yaml::serialize_yaml(&items);
    assert!(out.contains("issued: \"2023-5-15\""));
}

#[test]
fn test_yaml_escapes_quotes() {
    let item = CslItem {
        id: "t".into(),
        title: Some("Title with \"quotes\"".into()),
        ..Default::default()
    };
    let out = yaml::serialize_yaml(&[item]);
    assert!(out.contains("\\\"quotes\\\""));
}

#[test]
fn test_yaml_literal_author() {
    let item = CslItem {
        id: "t".into(),
        author: Some(vec![Name { literal: Some("WHO".into()), ..Default::default() }]),
        ..Default::default()
    };
    let out = yaml::serialize_yaml(&[item]);
    assert!(out.contains("literal: \"WHO\""));
}

#[test]
fn test_yaml_multiple() {
    let items = vec![journal_article(), book()];
    let out = yaml::serialize_yaml(&items);
    let count = out.matches("  - id:").count();
    assert_eq!(count, 2);
}
