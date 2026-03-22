// Test: Locale term lookup, month names, plurals, XML parsing

use ibid_core::csl::locale::{Locale, TermForm};

#[test]
fn test_all_long_months() {
    let locale = Locale::english();
    let expected = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
    for (i, name) in expected.iter().enumerate() {
        assert_eq!(locale.get_month((i+1) as i32, &TermForm::Long), Some(*name), "Month {}", i+1);
    }
}

#[test]
fn test_all_short_months() {
    let locale = Locale::english();
    let expected = ["Jan.","Feb.","Mar.","Apr.","May","Jun.","Jul.","Aug.","Sep.","Oct.","Nov.","Dec."];
    for (i, name) in expected.iter().enumerate() {
        assert_eq!(locale.get_month((i+1) as i32, &TermForm::Short), Some(*name), "Short month {}", i+1);
    }
}

#[test]
fn test_role_terms_long() {
    let locale = Locale::english();
    assert_eq!(locale.get_term("editor", &TermForm::Long), Some("editor"));
    assert_eq!(locale.get_term("translator", &TermForm::Long), Some("translator"));
    assert_eq!(locale.get_term("and", &TermForm::Long), Some("and"));
    assert_eq!(locale.get_term("et-al", &TermForm::Long), Some("et al."));
}

#[test]
fn test_role_terms_short() {
    let locale = Locale::english();
    assert_eq!(locale.get_term("editor", &TermForm::Short), Some("ed."));
    assert_eq!(locale.get_term("translator", &TermForm::Short), Some("trans."));
    assert_eq!(locale.get_term("page", &TermForm::Short), Some("p."));
    assert_eq!(locale.get_term("volume", &TermForm::Short), Some("vol."));
}

#[test]
fn test_plurals() {
    let locale = Locale::english();
    assert_eq!(locale.get_term_plural("page", &TermForm::Short, false), Some("p."));
    assert_eq!(locale.get_term_plural("page", &TermForm::Short, true), Some("pp."));
    assert_eq!(locale.get_term_plural("editor", &TermForm::Long, false), Some("editor"));
    assert_eq!(locale.get_term_plural("editor", &TermForm::Long, true), Some("editors"));
    assert_eq!(locale.get_term_plural("editor", &TermForm::Short, false), Some("ed."));
    assert_eq!(locale.get_term_plural("editor", &TermForm::Short, true), Some("eds."));
}

#[test]
fn test_misc_terms() {
    let locale = Locale::english();
    assert_eq!(locale.get_term("no date", &TermForm::Long), Some("n.d."));
    assert_eq!(locale.get_term("in", &TermForm::Long), Some("in"));
    assert_eq!(locale.get_term("retrieved", &TermForm::Long), Some("retrieved"));
    assert_eq!(locale.get_term("from", &TermForm::Long), Some("from"));
    assert_eq!(locale.get_term("accessed", &TermForm::Long), Some("accessed"));
}

#[test]
fn test_fallback_to_long_form() {
    let locale = Locale::english();
    // "and" has no short form — should fall back to long
    assert_eq!(locale.get_term("and", &TermForm::Short), Some("and"));
}

#[test]
fn test_unknown_term_returns_none() {
    let locale = Locale::english();
    assert_eq!(locale.get_term("nonexistent-term", &TermForm::Long), None);
}

#[test]
fn test_month_clamping() {
    let locale = Locale::english();
    // Out-of-range months should clamp
    assert!(locale.get_month(0, &TermForm::Long).is_some()); // clamps to 1
    assert!(locale.get_month(13, &TermForm::Long).is_some()); // clamps to 12
}

#[test]
fn test_parse_locale_xml() {
    let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<locale xml:lang="de-DE" xmlns="http://purl.org/net/xbiblio/csl">
  <terms>
    <term name="and">und</term>
    <term name="et-al">et al.</term>
    <term name="editor">
      <single>Herausgeber</single>
      <multiple>Herausgeber</multiple>
    </term>
  </terms>
</locale>"#;
    let locale = Locale::from_xml(xml).unwrap();
    assert_eq!(locale.lang, "de-DE");
    assert_eq!(locale.get_term("and", &TermForm::Long), Some("und"));
    assert_eq!(locale.get_term("et-al", &TermForm::Long), Some("et al."));
}
