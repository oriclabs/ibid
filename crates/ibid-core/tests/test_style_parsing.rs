// Test: All bundled CSL styles parse without errors and have required sections

mod helpers;
use helpers::load_style;

const ALL_STYLES: &[&str] = &[
    "apa7", "apa6", "mla9", "mla8",
    "chicago17-author-date", "chicago16-author-date",
    "harvard", "ieee", "vancouver",
];

#[test]
fn test_all_styles_parse() {
    for name in ALL_STYLES {
        load_style(name); // panics on failure
    }
}

#[test]
fn test_all_styles_have_bibliography() {
    for name in ALL_STYLES {
        let style = load_style(name);
        assert!(style.bibliography.is_some(), "{} missing bibliography", name);
    }
}

#[test]
fn test_all_styles_have_citation() {
    for name in ALL_STYLES {
        let style = load_style(name);
        assert!(style.citation.is_some(), "{} missing citation", name);
    }
}

#[test]
fn test_style_info_fields() {
    for name in ALL_STYLES {
        let style = load_style(name);
        assert!(!style.info.title.is_empty(), "{} missing title", name);
        assert!(!style.info.id.is_empty(), "{} missing id", name);
    }
}

#[test]
fn test_apa_styles_are_in_text() {
    let style = load_style("apa7");
    assert_eq!(style.class, ibid_core::csl::style::StyleClass::InText);
}

#[test]
fn test_ieee_has_numeric_citation() {
    let style = load_style("ieee");
    // IEEE uses numeric [1] style citations
    assert!(style.citation.is_some());
}
