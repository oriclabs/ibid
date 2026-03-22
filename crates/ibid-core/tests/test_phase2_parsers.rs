// Test: Phase 2 parsers — EndNote XML, MEDLINE, CSV/TSV

use ibid_core::parsers::{endnote_xml, medline, csv};
use ibid_core::types::ItemType;

// =============================================================================
// EndNote XML
// =============================================================================

#[test]
fn test_endnote_empty() {
    let r = endnote_xml::parse_endnote_xml("");
    assert_eq!(r.entries.len(), 0);
}

#[test]
fn test_endnote_single_record() {
    let xml = r#"<?xml version="1.0"?><xml><records><record>
        <ref-type>Journal Article</ref-type>
        <contributors><authors><author>Smith, John</author></authors></contributors>
        <titles><title>Test Article</title><secondary-title>Nature</secondary-title></titles>
        <dates><year>2024</year></dates>
        <volume>42</volume>
        <pages>100-120</pages>
        <electronic-resource-num>10.1038/test</electronic-resource-num>
    </record></records></xml>"#;
    let r = endnote_xml::parse_endnote_xml(xml);
    assert_eq!(r.entries.len(), 1);
    assert_eq!(r.entries[0].title.as_deref(), Some("Test Article"));
    assert_eq!(r.entries[0].container_title.as_deref(), Some("Nature"));
    assert_eq!(r.entries[0].doi.as_deref(), Some("10.1038/test"));
    assert!(matches!(r.entries[0].item_type, ItemType::ArticleJournal));
}

#[test]
fn test_endnote_multiple_authors() {
    let xml = r#"<xml><records><record>
        <contributors><authors>
            <author>Smith, John</author>
            <author>Doe, Jane</author>
            <author>Wilson, Bob</author>
        </authors></contributors>
        <titles><title>Multi Author</title></titles>
    </record></records></xml>"#;
    let r = endnote_xml::parse_endnote_xml(xml);
    assert_eq!(r.entries[0].author.as_ref().unwrap().len(), 3);
}

#[test]
fn test_endnote_book_type() {
    let xml = r#"<xml><records><record>
        <ref-type>Book</ref-type>
        <titles><title>A Book</title></titles>
        <publisher>Pub</publisher>
        <dates><year>2020</year></dates>
    </record></records></xml>"#;
    let r = endnote_xml::parse_endnote_xml(xml);
    assert!(matches!(r.entries[0].item_type, ItemType::Book));
    assert_eq!(r.entries[0].publisher.as_deref(), Some("Pub"));
}

#[test]
fn test_endnote_keywords() {
    let xml = r#"<xml><records><record>
        <titles><title>T</title></titles>
        <keywords><keyword>climate</keyword><keyword>ecology</keyword></keywords>
    </record></records></xml>"#;
    let r = endnote_xml::parse_endnote_xml(xml);
    let kw = r.entries[0].keyword.as_ref().unwrap();
    assert!(kw.contains("climate"));
    assert!(kw.contains("ecology"));
}

#[test]
fn test_endnote_multiple_records() {
    let xml = r#"<xml><records>
        <record><titles><title>First</title></titles></record>
        <record><titles><title>Second</title></titles></record>
        <record><titles><title>Third</title></titles></record>
    </records></xml>"#;
    let r = endnote_xml::parse_endnote_xml(xml);
    assert_eq!(r.entries.len(), 3);
}

// =============================================================================
// MEDLINE / NBIB
// =============================================================================

#[test]
fn test_medline_empty() {
    let r = medline::parse_medline("");
    assert_eq!(r.entries.len(), 0);
}

#[test]
fn test_medline_single_article() {
    let nbib = "PMID- 12345\nTI  - Test Article\nAU  - Smith JA\nAU  - Doe JB\nTA  - Nature\nDP  - 2024 Mar 15\nVI  - 614\nIP  - 3\nPG  - 245-260\nAID - 10.1038/test [doi]\nPT  - Journal Article\n";
    let r = medline::parse_medline(nbib);
    assert_eq!(r.entries.len(), 1);
    assert_eq!(r.entries[0].title.as_deref(), Some("Test Article"));
    assert_eq!(r.entries[0].pmid.as_deref(), Some("12345"));
    assert_eq!(r.entries[0].doi.as_deref(), Some("10.1038/test"));
    assert_eq!(r.entries[0].author.as_ref().unwrap().len(), 2);
    assert_eq!(r.entries[0].author.as_ref().unwrap()[0].family.as_deref(), Some("Smith"));
    assert_eq!(r.entries[0].author.as_ref().unwrap()[0].given.as_deref(), Some("J. A."));
}

#[test]
fn test_medline_date_parsing() {
    // Year only
    let r = medline::parse_medline("PMID- 1\nDP  - 2024\nTI  - T\n");
    assert_eq!(r.entries[0].issued.as_ref().unwrap().date_parts.as_ref().unwrap()[0], vec![2024]);

    // Year + month
    let r = medline::parse_medline("PMID- 1\nDP  - 2024 Jun\nTI  - T\n");
    assert_eq!(r.entries[0].issued.as_ref().unwrap().date_parts.as_ref().unwrap()[0], vec![2024, 6]);

    // Year + month + day
    let r = medline::parse_medline("PMID- 1\nDP  - 2024 Mar 15\nTI  - T\n");
    assert_eq!(r.entries[0].issued.as_ref().unwrap().date_parts.as_ref().unwrap()[0], vec![2024, 3, 15]);
}

#[test]
fn test_medline_multiple_records() {
    let nbib = "PMID- 111\nTI  - First\n\nPMID- 222\nTI  - Second\n";
    let r = medline::parse_medline(nbib);
    assert_eq!(r.entries.len(), 2);
    assert_eq!(r.entries[0].title.as_deref(), Some("First"));
    assert_eq!(r.entries[1].title.as_deref(), Some("Second"));
}

#[test]
fn test_medline_abstract_and_keywords() {
    let nbib = "PMID- 1\nTI  - T\nAB  - This is the abstract.\nMH  - climate\nMH  - change\n";
    let r = medline::parse_medline(nbib);
    assert_eq!(r.entries[0].abstract_.as_deref(), Some("This is the abstract."));
    let kw = r.entries[0].keyword.as_ref().unwrap();
    assert!(kw.contains("climate") && kw.contains("change"));
}

#[test]
fn test_medline_pmcid() {
    let nbib = "PMID- 1\nTI  - T\nPMC - PMC12345\n";
    let r = medline::parse_medline(nbib);
    assert_eq!(r.entries[0].pmcid.as_deref(), Some("PMC12345"));
}

// =============================================================================
// CSV / TSV
// =============================================================================

#[test]
fn test_csv_basic() {
    let csv_text = "title,author,year,journal,doi\nTest Article,\"Smith, John\",2024,Nature,10.1038/test\n";
    let map = csv::default_column_map();
    let r = csv::parse_csv(csv_text, ',', &map);
    assert_eq!(r.entries.len(), 1);
    assert_eq!(r.entries[0].title.as_deref(), Some("Test Article"));
    assert_eq!(r.entries[0].doi.as_deref(), Some("10.1038/test"));
}

#[test]
fn test_csv_multiple_rows() {
    let csv_text = "title,year\nFirst,2020\nSecond,2021\nThird,2022\n";
    let map = csv::default_column_map();
    let r = csv::parse_csv(csv_text, ',', &map);
    assert_eq!(r.entries.len(), 3);
}

#[test]
fn test_csv_quoted_fields() {
    let csv_text = "title,author\n\"Title, with comma\",\"Smith, John\"\n";
    let map = csv::default_column_map();
    let r = csv::parse_csv(csv_text, ',', &map);
    assert_eq!(r.entries[0].title.as_deref(), Some("Title, with comma"));
}

#[test]
fn test_tsv() {
    let tsv = "Title\tAuthor\tYear\nTest\tSmith, John\t2024\n";
    let map = csv::default_column_map();
    let r = csv::parse_csv(tsv, '\t', &map);
    assert_eq!(r.entries.len(), 1);
    assert_eq!(r.entries[0].title.as_deref(), Some("Test"));
}

#[test]
fn test_csv_unknown_columns_error() {
    let csv_text = "foo,bar,baz\n1,2,3\n";
    let map = csv::default_column_map();
    let r = csv::parse_csv(csv_text, ',', &map);
    assert_eq!(r.entries.len(), 0);
    assert!(!r.errors.is_empty());
}

#[test]
fn test_csv_empty_rows_skipped() {
    let csv_text = "title,year\nFirst,2020\n\n\nSecond,2021\n";
    let map = csv::default_column_map();
    let r = csv::parse_csv(csv_text, ',', &map);
    assert_eq!(r.entries.len(), 2);
}

#[test]
fn test_csv_author_parsing() {
    // Semicolon-separated
    let csv_text = "title,author\nT,\"Smith, John; Doe, Jane\"\n";
    let map = csv::default_column_map();
    let r = csv::parse_csv(csv_text, ',', &map);
    assert_eq!(r.entries[0].author.as_ref().unwrap().len(), 2);
}

#[test]
fn test_csv_varied_header_names() {
    // Test that alternate header names map correctly
    let csv_text = "Article Title,Author(s),Publication Year,Source Title,DOI\nTest,Smith,2024,Nature,10.1038/x\n";
    let map = csv::default_column_map();
    let r = csv::parse_csv(csv_text, ',', &map);
    assert_eq!(r.entries.len(), 1);
    assert_eq!(r.entries[0].title.as_deref(), Some("Test"));
    assert_eq!(r.entries[0].doi.as_deref(), Some("10.1038/x"));
}

#[test]
fn test_default_column_map_coverage() {
    let map = csv::default_column_map();
    // Verify common headers are mapped
    assert!(map.contains_key("title"));
    assert!(map.contains_key("Title"));
    assert!(map.contains_key("author"));
    assert!(map.contains_key("Author"));
    assert!(map.contains_key("year"));
    assert!(map.contains_key("Year"));
    assert!(map.contains_key("doi"));
    assert!(map.contains_key("DOI"));
    assert!(map.contains_key("journal"));
    assert!(map.contains_key("Journal"));
    assert!(map.contains_key("url"));
    assert!(map.contains_key("URL"));
}
