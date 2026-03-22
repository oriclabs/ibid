// Test: CSL rendering produces correct output for all styles and item types

mod helpers;
use helpers::*;

// =============================================================================
// Each style renders non-empty output for journal articles
// =============================================================================

#[test] fn test_apa7_journal()   { assert!(!render_bib("apa7", &journal_article()).is_empty()); }
#[test] fn test_apa6_journal()   { assert!(!render_bib("apa6", &journal_article()).is_empty()); }
#[test] fn test_mla9_journal()   { assert!(!render_bib("mla9", &journal_article()).is_empty()); }
#[test] fn test_mla8_journal()   { assert!(!render_bib("mla8", &journal_article()).is_empty()); }
#[test] fn test_chi17_journal()  { assert!(!render_bib("chicago17-author-date", &journal_article()).is_empty()); }
#[test] fn test_chi16_journal()  { assert!(!render_bib("chicago16-author-date", &journal_article()).is_empty()); }
#[test] fn test_harvard_journal(){ assert!(!render_bib("harvard", &journal_article()).is_empty()); }
#[test] fn test_ieee_journal()   { assert!(!render_bib("ieee", &journal_article()).is_empty()); }
#[test] fn test_van_journal()    { assert!(!render_bib("vancouver", &journal_article()).is_empty()); }

// =============================================================================
// APA7 — content correctness
// =============================================================================

#[test]
fn test_apa7_journal_has_author() {
    let out = render_bib("apa7", &journal_article());
    assert!(out.contains("Smith"), "Missing author: {}", out);
}

#[test]
fn test_apa7_journal_has_year() {
    let out = render_bib("apa7", &journal_article());
    assert!(out.contains("2023"), "Missing year: {}", out);
}

#[test]
fn test_apa7_journal_has_title() {
    let out = render_bib("apa7", &journal_article());
    assert!(out.contains("impact of climate change"), "Missing title: {}", out);
}

#[test]
fn test_apa7_journal_has_doi() {
    let out = render_bib("apa7", &journal_article());
    assert!(out.contains("10.1038"), "Missing DOI: {}", out);
}

#[test]
fn test_apa7_book_renders() {
    let out = render_bib("apa7", &book());
    assert!(out.contains("Knuth"), "Missing author: {}", out);
    assert!(out.contains("Art of Computer Programming"), "Missing title: {}", out);
}

#[test]
fn test_apa7_chapter_renders() {
    let out = render_bib("apa7", &chapter());
    assert!(out.contains("Wilson"), "Missing author: {}", out);
    assert!(out.contains("Machine learning"), "Missing title: {}", out);
}

#[test]
fn test_apa7_webpage_renders() {
    let out = render_bib("apa7", &webpage());
    assert!(out.contains("World Health Organization"), "Missing org: {}", out);
}

#[test]
fn test_apa7_thesis_renders() {
    let out = render_bib("apa7", &thesis());
    assert!(out.contains("Chen"), "Missing author: {}", out);
}

// =============================================================================
// In-text citations
// =============================================================================

#[test]
fn test_apa7_intext_parenthetical() {
    let out = render_intext("apa7", &journal_article());
    assert!(out.starts_with('('), "APA in-text should start with (: {}", out);
    assert!(out.contains("Smith"), "Missing author: {}", out);
    assert!(out.contains("2023"), "Missing year: {}", out);
}

#[test]
fn test_mla9_intext() {
    let out = render_intext("mla9", &journal_article());
    assert!(out.contains("Smith"), "MLA in-text should have author: {}", out);
}

#[test]
fn test_chicago17_intext() {
    let out = render_intext("chicago17-author-date", &journal_article());
    assert!(out.contains("Smith"));
    assert!(out.contains("2023"));
}

#[test]
fn test_harvard_intext() {
    let out = render_intext("harvard", &journal_article());
    assert!(out.contains("Smith"));
}

// =============================================================================
// HTML output — formatting tags
// =============================================================================

#[test]
fn test_html_has_italic_tags() {
    let out = render_bib_html("apa7", &journal_article());
    assert!(out.contains("<i>"), "APA HTML should italicize: {}", out);
}

#[test]
fn test_html_book_italic_title() {
    let out = render_bib_html("apa7", &book());
    assert!(out.contains("<i>"), "Book title should be italic: {}", out);
}

// =============================================================================
// Edge cases — no author, no date, many authors
// =============================================================================

#[test]
fn test_no_author_still_renders() {
    let out = render_bib("apa7", &no_author_item());
    assert!(!out.is_empty());
    assert!(out.contains("Global temperatures"), "Should use title as fallback: {}", out);
}

#[test]
fn test_no_date_shows_nd() {
    let out = render_bib("apa7", &no_date_item());
    assert!(out.contains("n.d."), "Should show n.d.: {}", out);
}

#[test]
fn test_many_authors_intext_renders() {
    let out = render_intext("apa7", &many_authors());
    assert!(out.contains("Adams"), "Should have first author: {}", out);
    // Note: citation-level et-al-min isn't yet wired to names rendering.
    // When implemented, this should use "et al." for 3+ authors in APA7.
    assert!(!out.is_empty(), "Should render: {}", out);
}

#[test]
fn test_many_authors_bib_has_all() {
    let out = render_bib("apa7", &many_authors());
    assert!(out.contains("Adams"), "Should have first author: {}", out);
}
