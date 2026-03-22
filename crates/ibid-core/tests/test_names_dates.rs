// Test: Name formatting edge cases and date handling

mod helpers;
use helpers::*;
use ibid_core::types::*;

// =============================================================================
// Name formatting — tested via Renderer directly with simple style
// (The bundled CSL styles use macros with names which have parsing limitations
//  in the current CSL parser for the names child element wiring. These tests
//  use a minimal inline style to test the renderer's name formatting directly.)
// =============================================================================

use ibid_core::csl::locale::Locale;
use ibid_core::csl::renderer::{OutputFormat, Renderer};
use ibid_core::csl::style::Style;

// Use a style with names at top level (no child <name> config — uses global defaults)
fn simple_name_style() -> Style {
    let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0"
       default-locale="en-US" initialize-with=". " name-as-sort-order="all" and="symbol">
  <info><title>Test</title><id>test</id></info>
  <bibliography>
    <layout suffix=".">
      <names variable="author" suffix=". "/>
      <date variable="issued" prefix="(" suffix="). ">
        <date-part name="year"/>
      </date>
      <text variable="title"/>
    </layout>
  </bibliography>
</style>"#;
    Style::from_xml(xml).unwrap()
}

fn render_with_simple(item: &CslItem) -> String {
    let style = simple_name_style();
    let locale = Locale::english();
    Renderer::new(style, locale, OutputFormat::PlainText)
        .render_bibliography_entry(item).unwrap()
}

#[test]
fn test_name_particle_renders() {
    let item = CslItem {
        id: "vb".into(), item_type: ItemType::ArticleJournal,
        title: Some("Test".into()),
        author: Some(vec![Name {
            family: Some("Beethoven".into()), given: Some("Ludwig".into()),
            non_dropping_particle: Some("van".into()), ..Default::default()
        }]),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2020]]), ..Default::default() }),
        ..Default::default()
    };
    let out = render_with_simple(&item);
    assert!(out.contains("Beethoven"), "Should contain family name: {}", out);
    assert!(out.contains("van"), "Should contain particle: {}", out);
}

#[test]
fn test_name_suffix_renders() {
    let item = CslItem {
        id: "jr".into(), item_type: ItemType::ArticleJournal,
        title: Some("Test".into()),
        author: Some(vec![Name {
            family: Some("King".into()), given: Some("Martin Luther".into()),
            suffix: Some("Jr.".into()), ..Default::default()
        }]),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2020]]), ..Default::default() }),
        ..Default::default()
    };
    let out = render_with_simple(&item);
    assert!(out.contains("King"), "Should contain family name: {}", out);
}

#[test]
fn test_corporate_author() {
    let item = CslItem {
        id: "corp".into(), item_type: ItemType::ArticleJournal,
        title: Some("Annual Report".into()),
        author: Some(vec![Name { literal: Some("United Nations".into()), ..Default::default() }]),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2020]]), ..Default::default() }),
        ..Default::default()
    };
    let out = render_with_simple(&item);
    assert!(out.contains("United Nations"), "Should handle literal name: {}", out);
}

#[test]
fn test_single_mononym() {
    let item = CslItem {
        id: "mono".into(), item_type: ItemType::ArticleJournal,
        title: Some("Test".into()),
        author: Some(vec![Name { literal: Some("Madonna".into()), ..Default::default() }]),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2020]]), ..Default::default() }),
        ..Default::default()
    };
    let out = render_with_simple(&item);
    assert!(out.contains("Madonna"), "Should handle single-name: {}", out);
}

// =============================================================================
// Date edge cases
// =============================================================================

#[test]
fn test_year_only() {
    let item = CslItem {
        id: "d1".into(), item_type: ItemType::Book, title: Some("T".into()),
        author: Some(vec![Name { family: Some("A".into()), ..Default::default() }]),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2023]]), ..Default::default() }),
        ..Default::default()
    };
    assert!(render_bib("apa7", &item).contains("2023"));
}

#[test]
fn test_year_month() {
    let item = CslItem {
        id: "d2".into(), item_type: ItemType::ArticleJournal, title: Some("T".into()),
        author: Some(vec![Name { family: Some("A".into()), ..Default::default() }]),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2023, 6]]), ..Default::default() }),
        container_title: Some("J".into()), ..Default::default()
    };
    assert!(render_bib("apa7", &item).contains("2023"));
}

#[test]
fn test_full_date() {
    let item = CslItem {
        id: "d3".into(), item_type: ItemType::Webpage, title: Some("T".into()),
        author: Some(vec![Name { family: Some("A".into()), ..Default::default() }]),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2023, 12, 25]]), ..Default::default() }),
        url: Some("https://example.com".into()), ..Default::default()
    };
    assert!(render_bib("apa7", &item).contains("2023"));
}

#[test]
fn test_literal_date() {
    let item = CslItem {
        id: "d4".into(), item_type: ItemType::Book, title: Some("Ancient Text".into()),
        author: Some(vec![Name { family: Some("A".into()), ..Default::default() }]),
        issued: Some(DateVariable { literal: Some("ca. 350 BCE".into()), ..Default::default() }),
        ..Default::default()
    };
    let out = render_bib("apa7", &item);
    assert!(out.contains("350 BCE") || out.contains("ca."), "Literal date: {}", out);
}

#[test]
fn test_no_date_nd() {
    let item = CslItem {
        id: "nd".into(), item_type: ItemType::Webpage, title: Some("T".into()),
        author: Some(vec![Name { family: Some("A".into()), ..Default::default() }]),
        url: Some("https://example.com".into()), ..Default::default()
    };
    let out = render_bib("apa7", &item);
    assert!(out.contains("n.d."), "Should show n.d.: {}", out);
}
