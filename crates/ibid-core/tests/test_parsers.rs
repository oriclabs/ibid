// Test: BibTeX and RIS parser edge cases

use ibid_core::parsers::bibtex;
use ibid_core::parsers::ris;

// =============================================================================
// BibTeX — edge cases
// =============================================================================

#[test] fn test_bib_empty()       { assert_eq!(bibtex::parse_bibtex("").entries.len(), 0); }
#[test] fn test_bib_comments()    { assert_eq!(bibtex::parse_bibtex("% comment\n").entries.len(), 0); }

#[test]
fn test_bib_string_preamble_skipped() {
    let bib = r#"@string{j = "Nature"} @preamble{"text"} @article{t, author={A}, title={T}, year={2020}}"#;
    assert_eq!(bibtex::parse_bibtex(bib).entries.len(), 1);
}

#[test]
fn test_bib_quoted_values() {
    let r = bibtex::parse_bibtex(r#"@article{t, author="Smith, John", title="Title", year="2020"}"#);
    assert_eq!(r.entries[0].item.id, "t");
}

#[test]
fn test_bib_bare_numeric() {
    let r = bibtex::parse_bibtex(r#"@article{t, author={A}, title={T}, year=2020, volume=42}"#);
    assert_eq!(r.entries[0].item.issued.as_ref().unwrap().date_parts.as_ref().unwrap()[0], vec![2020]);
}

#[test]
fn test_bib_concat() {
    let r = bibtex::parse_bibtex(r#"@article{t, author={A}, title={Part1} # { Part2}, year={2020}}"#);
    assert!(r.entries[0].item.title.as_ref().unwrap().contains("Part1"));
}

#[test]
fn test_bib_parens() {
    assert_eq!(bibtex::parse_bibtex(r#"@article(t, author={A}, title={T}, year={2020})"#).entries.len(), 1);
}

#[test]
fn test_bib_biblatex_date() {
    let r = bibtex::parse_bibtex(r#"@article{t, author={A}, title={T}, date={2023-06-15}}"#);
    assert_eq!(r.entries[0].item.issued.as_ref().unwrap().date_parts.as_ref().unwrap()[0], vec![2023, 6, 15]);
}

#[test]
fn test_bib_month_names() {
    let r = bibtex::parse_bibtex(r#"@article{t, author={A}, title={T}, year={2023}, month=jun}"#);
    assert_eq!(r.entries[0].item.issued.as_ref().unwrap().date_parts.as_ref().unwrap()[0], vec![2023, 6]);
}

#[test]
fn test_bib_howpublished_url() {
    let r = bibtex::parse_bibtex(r#"@misc{t, author={A}, title={T}, year={2020}, howpublished={https://example.com}}"#);
    assert_eq!(r.entries[0].item.url.as_deref(), Some("https://example.com"));
}

#[test]
fn test_bib_all_entry_types() {
    for ty in &["article","book","inbook","incollection","inproceedings","conference",
                "mastersthesis","phdthesis","misc","online","report","techreport",
                "unpublished","booklet","manual","proceedings","patent","software","dataset"] {
        let bib = format!("@{}{{t, author={{A}}, title={{T}}, year={{2020}}}}", ty);
        assert_eq!(bibtex::parse_bibtex(&bib).entries.len(), 1, "Failed @{}", ty);
    }
}

#[test]
fn test_bib_unicode() {
    let r = bibtex::parse_bibtex(r#"@article{t, author={Müller, Hans}, title={Ökologie}, year={2020}}"#);
    assert!(r.entries[0].item.title.as_ref().unwrap().contains("Ökologie"));
    assert!(r.entries[0].item.author.as_ref().unwrap()[0].family.as_ref().unwrap().contains("Müller"));
}

#[test]
fn test_bib_nested_braces() {
    let r = bibtex::parse_bibtex(r#"@article{t, author={A}, title={The {HIV} Epidemic in {Sub-Saharan Africa}}, year={2020}}"#);
    let title = r.entries[0].item.title.as_ref().unwrap();
    assert!(title.contains("HIV") && title.contains("Sub-Saharan Africa"), "Got: {}", title);
}

#[test]
fn test_bib_last_comma_first() {
    let r = bibtex::parse_bibtex(r#"@article{t, author={Smith, John A.}, title={T}, year={2020}}"#);
    let a = &r.entries[0].item.author.as_ref().unwrap()[0];
    assert_eq!(a.family.as_deref(), Some("Smith"));
    assert_eq!(a.given.as_deref(), Some("John A."));
}

#[test]
fn test_bib_first_last() {
    let r = bibtex::parse_bibtex(r#"@article{t, author={John Smith}, title={T}, year={2020}}"#);
    let a = &r.entries[0].item.author.as_ref().unwrap()[0];
    assert_eq!(a.family.as_deref(), Some("Smith"));
    assert_eq!(a.given.as_deref(), Some("John"));
}

#[test]
fn test_bib_three_authors_and() {
    let r = bibtex::parse_bibtex(r#"@article{t, author={Smith, J and Jane Doe and Bob Wilson}, title={T}, year={2020}}"#);
    assert_eq!(r.entries[0].item.author.as_ref().unwrap().len(), 3);
}

#[test]
fn test_bib_pages_endash() {
    let r = bibtex::parse_bibtex(r#"@article{t, author={A}, title={T}, year={2020}, pages={100--200}}"#);
    assert_eq!(r.entries[0].item.page.as_deref(), Some("100\u{2013}200"));
}

#[test]
fn test_bib_all_fields_populated() {
    let bib = r#"@article{full,
      author={Smith, John}, editor={Ed, Itor}, title={Title}, journal={Journal},
      year={2023}, volume={1}, number={2}, pages={10--20}, doi={10.1234/test},
      isbn={978-0-123-45678-9}, issn={1234-5678}, url={https://example.com},
      abstract={An abstract}, note={A note}, keywords={key1, key2},
      publisher={Pub}, address={City}, edition={2nd}, series={Series},
      language={English}}"#;
    let r = bibtex::parse_bibtex(bib);
    let item = &r.entries[0].item;
    assert!(item.title.is_some());
    assert!(item.author.is_some());
    assert!(item.editor.is_some());
    assert!(item.container_title.is_some());
    assert!(item.doi.is_some());
    assert!(item.isbn.is_some());
    assert!(item.issn.is_some());
    assert!(item.url.is_some());
    assert!(item.abstract_.is_some());
    assert!(item.note.is_some());
    assert!(item.keyword.is_some());
    assert!(item.publisher.is_some());
    assert!(item.publisher_place.is_some());
    assert!(item.edition.is_some());
    assert!(item.collection_title.is_some());
    assert!(item.language.is_some());
}

// =============================================================================
// RIS — edge cases
// =============================================================================

#[test] fn test_ris_empty() { assert_eq!(ris::parse_ris("").entries.len(), 0); }

#[test]
fn test_ris_missing_er() {
    assert_eq!(ris::parse_ris("TY  - JOUR\nTI  - Test\n").entries.len(), 1);
}

#[test]
fn test_ris_all_types() {
    for ty in &["JOUR","BOOK","CHAP","CONF","THES","RPRT","NEWS","ELEC","BLOG",
                "PAT","DATA","COMP","MAP","MPCT","BILL","CASE","STAT","ENCYC","DICT","UNPB","HEAR"] {
        let ris = format!("TY  - {}\nTI  - Test\nER  - ", ty);
        assert_eq!(ris::parse_ris(&ris).entries.len(), 1, "Failed RIS type {}", ty);
    }
}

#[test]
fn test_ris_da_date_format() {
    let r = ris::parse_ris("TY  - JOUR\nDA  - 2023/06/15/\nTI  - T\nER  - ");
    assert_eq!(r.entries[0].item.issued.as_ref().unwrap().date_parts.as_ref().unwrap()[0], vec![2023, 6, 15]);
}

#[test]
fn test_ris_py_year_only() {
    let r = ris::parse_ris("TY  - JOUR\nPY  - 2023\nTI  - T\nER  - ");
    assert_eq!(r.entries[0].item.issued.as_ref().unwrap().date_parts.as_ref().unwrap()[0], vec![2023]);
}

#[test]
fn test_ris_isbn_detection() {
    let r = ris::parse_ris("TY  - BOOK\nSN  - 978-0-123-45678-9\nTI  - T\nER  - ");
    assert!(r.entries[0].item.isbn.is_some());
}

#[test]
fn test_ris_issn_detection() {
    let r = ris::parse_ris("TY  - JOUR\nSN  - 1234-5678\nTI  - T\nER  - ");
    assert!(r.entries[0].item.issn.is_some());
}

#[test]
fn test_ris_page_merge() {
    let r = ris::parse_ris("TY  - JOUR\nSP  - 100\nEP  - 120\nTI  - T\nER  - ");
    assert_eq!(r.entries[0].item.page.as_deref(), Some("100\u{2013}120"));
}

#[test]
fn test_ris_multiple_keywords() {
    let r = ris::parse_ris("TY  - JOUR\nKW  - a\nKW  - b\nKW  - c\nTI  - T\nER  - ");
    let kw = r.entries[0].item.keyword.as_ref().unwrap();
    assert!(kw.contains("a") && kw.contains("b") && kw.contains("c"));
}

#[test]
fn test_ris_multiple_authors() {
    let r = ris::parse_ris("TY  - JOUR\nAU  - A, X\nAU  - B, Y\nAU  - C, Z\nTI  - T\nER  - ");
    assert_eq!(r.entries[0].item.author.as_ref().unwrap().len(), 3);
}

#[test]
fn test_ris_editors() {
    let r = ris::parse_ris("TY  - BOOK\nA2  - Ed, Itor\nTI  - T\nER  - ");
    assert_eq!(r.entries[0].item.editor.as_ref().unwrap().len(), 1);
}
