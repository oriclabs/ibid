// Test: BibTeX and RIS serializer correctness and roundtrips

mod helpers;
use helpers::*;
use ibid_core::parsers::{bibtex, ris};
use ibid_core::serializers;
use ibid_core::types::*;

// =============================================================================
// BibTeX serializer
// =============================================================================

#[test]
fn test_bib_ser_article_format() {
    let bib = serializers::bibtex::serialize_item(&journal_article(), &serializers::bibtex::BibtexOptions::default());
    assert!(bib.starts_with("@article{"));
    assert!(bib.contains("author ="));
    assert!(bib.contains("title ="));
    assert!(bib.contains("journal ="));
    assert!(bib.contains("year ="));
    assert!(bib.contains("doi ="));
}

#[test]
fn test_bib_ser_chapter_booktitle() {
    let bib = serializers::bibtex::serialize_item(&chapter(), &serializers::bibtex::BibtexOptions::default());
    assert!(bib.starts_with("@incollection{"));
    assert!(bib.contains("booktitle ="));
    assert!(!bib.contains("journal ="));
}

#[test]
fn test_bib_ser_endash_to_double_hyphen() {
    let bib = serializers::bibtex::serialize_item(&journal_article(), &serializers::bibtex::BibtexOptions::default());
    assert!(!bib.contains('\u{2013}'), "BibTeX should use -- not en-dash");
}

#[test]
fn test_bib_ser_multiple_count() {
    let items = vec![journal_article(), book(), chapter()];
    let bib = serializers::bibtex::serialize_items(&items, &serializers::bibtex::BibtexOptions::default());
    assert_eq!(bib.matches('@').count(), 3);
}

#[test]
fn test_bib_ser_with_abstract() {
    let opts = serializers::bibtex::BibtexOptions { include_abstract: true, include_keywords: true };
    let mut item = journal_article();
    item.abstract_ = Some("This is an abstract.".into());
    let bib = serializers::bibtex::serialize_item(&item, &opts);
    assert!(bib.contains("abstract ="));
}

#[test]
fn test_bib_ser_without_abstract() {
    let opts = serializers::bibtex::BibtexOptions { include_abstract: false, include_keywords: true };
    let mut item = journal_article();
    item.abstract_ = Some("This is an abstract.".into());
    let bib = serializers::bibtex::serialize_item(&item, &opts);
    assert!(!bib.contains("abstract ="));
}

// =============================================================================
// RIS serializer
// =============================================================================

#[test]
fn test_ris_ser_article_format() {
    let ris = serializers::ris::serialize_item(&journal_article());
    assert!(ris.starts_with("TY  - JOUR"));
    assert!(ris.contains("AU  -"));
    assert!(ris.contains("TI  -"));
    assert!(ris.contains("JO  -"));
    assert!(ris.contains("DO  -"));
    assert!(ris.ends_with("ER  - "));
}

#[test]
fn test_ris_ser_chapter_bt() {
    let ris = serializers::ris::serialize_item(&chapter());
    assert!(ris.starts_with("TY  - CHAP"));
    assert!(ris.contains("BT  -"));
}

#[test]
fn test_ris_ser_page_split() {
    let ris = serializers::ris::serialize_item(&journal_article());
    assert!(ris.contains("SP  -"));
    assert!(ris.contains("EP  -"));
}

#[test]
fn test_ris_ser_multiple_count() {
    let items = vec![journal_article(), book()];
    let ris = serializers::ris::serialize_items(&items);
    assert_eq!(ris.matches("TY  -").count(), 2);
    assert_eq!(ris.matches("ER  -").count(), 2);
}

// =============================================================================
// Roundtrips: parse → serialize → parse
// =============================================================================

#[test]
fn test_roundtrip_bib_article() {
    let original = journal_article();
    let bib = serializers::bibtex::serialize_item(&original, &serializers::bibtex::BibtexOptions::default());
    let parsed = bibtex::parse_bibtex(&bib);
    assert_eq!(parsed.entries.len(), 1);
    assert_eq!(parsed.entries[0].item.title.as_deref(), original.title.as_deref());
    assert_eq!(parsed.entries[0].item.doi.as_deref(), original.doi.as_deref());
    assert_eq!(parsed.entries[0].item.author.as_ref().unwrap().len(), 2);
}

#[test]
fn test_roundtrip_bib_book() {
    let original = book();
    let bib = serializers::bibtex::serialize_item(&original, &serializers::bibtex::BibtexOptions::default());
    let parsed = bibtex::parse_bibtex(&bib);
    assert_eq!(parsed.entries[0].item.title.as_deref(), original.title.as_deref());
    assert_eq!(parsed.entries[0].item.isbn.as_deref(), original.isbn.as_deref());
}

#[test]
fn test_roundtrip_ris_article() {
    let original = journal_article();
    let ris_text = serializers::ris::serialize_item(&original);
    let parsed = ris::parse_ris(&ris_text);
    assert_eq!(parsed.entries.len(), 1);
    assert_eq!(parsed.entries[0].item.title.as_deref(), original.title.as_deref());
    assert_eq!(parsed.entries[0].item.doi.as_deref(), original.doi.as_deref());
}

#[test]
fn test_roundtrip_ris_book() {
    let original = book();
    let ris_text = serializers::ris::serialize_item(&original);
    let parsed = ris::parse_ris(&ris_text);
    assert_eq!(parsed.entries[0].item.title.as_deref(), original.title.as_deref());
}

#[test]
fn test_roundtrip_csl_json() {
    let original = journal_article();
    let json = serde_json::to_string(&original).unwrap();
    let reparsed: CslItem = serde_json::from_str(&json).unwrap();
    assert_eq!(reparsed.id, original.id);
    assert_eq!(reparsed.title, original.title);
    assert_eq!(reparsed.doi, original.doi);
}

#[test]
fn test_roundtrip_csl_json_array() {
    let items = vec![journal_article(), book(), chapter()];
    let json = serde_json::to_string(&items).unwrap();
    let reparsed: Vec<CslItem> = serde_json::from_str(&json).unwrap();
    assert_eq!(reparsed.len(), 3);
}

// =============================================================================
// Cross-format: BibTeX → CSL → RIS → CSL
// =============================================================================

#[test]
fn test_cross_format_bib_to_ris() {
    let bib = r#"@article{cf, author={Smith, John and Doe, Jane}, title={Cross Format}, journal={Nature}, year={2024}, volume={42}, pages={1--10}, doi={10.1234/cf}}"#;
    let parsed_bib = bibtex::parse_bibtex(bib);
    let item = &parsed_bib.entries[0].item;
    let ris_text = serializers::ris::serialize_item(item);
    let parsed_ris = ris::parse_ris(&ris_text);
    let reparsed = &parsed_ris.entries[0].item;
    assert_eq!(reparsed.title.as_deref(), Some("Cross Format"));
    assert_eq!(reparsed.doi.as_deref(), Some("10.1234/cf"));
    assert_eq!(reparsed.author.as_ref().unwrap().len(), 2);
}
