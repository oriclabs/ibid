// Test: CSL-JSON type serialization, Ibid extensions, all item types

use ibid_core::types::*;
use std::collections::HashMap;

// =============================================================================
// All CSL item types serialize/deserialize correctly
// =============================================================================

#[test]
fn test_all_item_types_roundtrip() {
    let types = [
        ItemType::Article, ItemType::ArticleJournal, ItemType::ArticleMagazine,
        ItemType::ArticleNewspaper, ItemType::Bill, ItemType::Book,
        ItemType::Broadcast, ItemType::Chapter, ItemType::Classic,
        ItemType::Collection, ItemType::Dataset, ItemType::Document,
        ItemType::Entry, ItemType::EntryDictionary, ItemType::EntryEncyclopedia,
        ItemType::Event, ItemType::Figure, ItemType::Graphic,
        ItemType::Hearing, ItemType::Interview, ItemType::Legislation,
        ItemType::LegalCase, ItemType::Manuscript, ItemType::Map,
        ItemType::MotionPicture, ItemType::MusicalScore, ItemType::Pamphlet,
        ItemType::PaperConference, ItemType::Patent, ItemType::Performance,
        ItemType::Periodical, ItemType::PersonalCommunication, ItemType::Post,
        ItemType::PostWeblog, ItemType::Regulation, ItemType::Report,
        ItemType::Review, ItemType::ReviewBook, ItemType::Software,
        ItemType::Song, ItemType::Speech, ItemType::Standard,
        ItemType::Thesis, ItemType::Treaty, ItemType::Webpage,
    ];

    for item_type in &types {
        let item = CslItem {
            id: "test".into(),
            item_type: item_type.clone(),
            title: Some("Test".into()),
            ..Default::default()
        };
        let json = serde_json::to_string(&item).unwrap();
        let reparsed: CslItem = serde_json::from_str(&json).unwrap();
        assert_eq!(reparsed.item_type, *item_type, "Failed for {:?}", item_type);
    }
}

// =============================================================================
// Ibid-specific extension fields
// =============================================================================

#[test]
fn test_ibid_extensions_roundtrip() {
    let item = CslItem {
        id: "ext1".into(),
        item_type: ItemType::Webpage,
        title: Some("Test".into()),
        starred: Some(true),
        tags: Some(vec!["climate".into(), "urgent".into()]),
        read_status: Some(ReadStatus::Reading),
        color: Some("#ff0000".into()),
        date_added: Some("2024-01-01T00:00:00Z".into()),
        date_modified: Some("2024-02-01T00:00:00Z".into()),
        source_url: Some("https://example.com".into()),
        sync_status: Some(SyncStatus::Pending),
        import_source: Some("bibtex".into()),
        custom_fields: Some(HashMap::from([("course".into(), "BIO101".into())])),
        project_ids: Some(vec!["proj-1".into(), "proj-2".into()]),
        notes: Some("Important paper".into()),
        quotes: Some(vec![Quote {
            text: "A key finding".into(),
            page: Some("42".into()),
            timestamp: Some("2024-01-15T10:00:00Z".into()),
        }]),
        ..Default::default()
    };

    let json = serde_json::to_string(&item).unwrap();
    let reparsed: CslItem = serde_json::from_str(&json).unwrap();

    assert_eq!(reparsed.starred, Some(true));
    assert_eq!(reparsed.tags.as_ref().unwrap().len(), 2);
    assert!(matches!(reparsed.read_status, Some(ReadStatus::Reading)));
    assert_eq!(reparsed.color.as_deref(), Some("#ff0000"));
    assert_eq!(reparsed.date_added.as_deref(), Some("2024-01-01T00:00:00Z"));
    assert_eq!(reparsed.source_url.as_deref(), Some("https://example.com"));
    assert!(matches!(reparsed.sync_status, Some(SyncStatus::Pending)));
    assert_eq!(reparsed.import_source.as_deref(), Some("bibtex"));
    assert_eq!(reparsed.custom_fields.as_ref().unwrap().get("course").unwrap(), "BIO101");
    assert_eq!(reparsed.project_ids.as_ref().unwrap().len(), 2);
    assert_eq!(reparsed.notes.as_deref(), Some("Important paper"));
    assert_eq!(reparsed.quotes.as_ref().unwrap().len(), 1);
    assert_eq!(reparsed.quotes.as_ref().unwrap()[0].text, "A key finding");
}

// =============================================================================
// JSON field naming (kebab-case and _prefixed)
// =============================================================================

#[test]
fn test_json_field_names() {
    let item = CslItem {
        id: "naming".into(),
        item_type: ItemType::ArticleJournal,
        container_title: Some("Journal".into()),
        title_short: Some("Short".into()),
        publisher_place: Some("NYC".into()),
        starred: Some(true),
        date_added: Some("2024-01-01".into()),
        ..Default::default()
    };
    let json = serde_json::to_string(&item).unwrap();
    assert!(json.contains("\"container-title\""), "Should use kebab-case: {}", json);
    assert!(json.contains("\"title-short\""));
    assert!(json.contains("\"publisher-place\""));
    assert!(json.contains("\"_starred\""), "Extensions should use _ prefix");
    assert!(json.contains("\"_dateAdded\""));
}

// =============================================================================
// Name struct
// =============================================================================

#[test]
fn test_name_all_fields() {
    let name = Name {
        family: Some("Beethoven".into()),
        given: Some("Ludwig".into()),
        non_dropping_particle: Some("van".into()),
        suffix: Some("Jr.".into()),
        ..Default::default()
    };
    let json = serde_json::to_string(&name).unwrap();
    let reparsed: Name = serde_json::from_str(&json).unwrap();
    assert_eq!(reparsed.family.as_deref(), Some("Beethoven"));
    assert_eq!(reparsed.non_dropping_particle.as_deref(), Some("van"));
    assert_eq!(reparsed.suffix.as_deref(), Some("Jr."));
}

#[test]
fn test_name_literal_only() {
    let name = Name { literal: Some("WHO".into()), ..Default::default() };
    let json = serde_json::to_string(&name).unwrap();
    assert!(json.contains("\"literal\":\"WHO\""));
}

// =============================================================================
// DateVariable
// =============================================================================

#[test]
fn test_date_parts_formats() {
    // Year only
    let d = DateVariable { date_parts: Some(vec![vec![2023]]), ..Default::default() };
    let json = serde_json::to_string(&d).unwrap();
    assert!(json.contains("[[2023]]"));

    // Year-month
    let d = DateVariable { date_parts: Some(vec![vec![2023, 6]]), ..Default::default() };
    let json = serde_json::to_string(&d).unwrap();
    assert!(json.contains("[2023,6]"));

    // Full date
    let d = DateVariable { date_parts: Some(vec![vec![2023, 6, 15]]), ..Default::default() };
    let json = serde_json::to_string(&d).unwrap();
    assert!(json.contains("[2023,6,15]"));

    // Date range
    let d = DateVariable { date_parts: Some(vec![vec![2020], vec![2023]]), ..Default::default() };
    let json = serde_json::to_string(&d).unwrap();
    let reparsed: DateVariable = serde_json::from_str(&json).unwrap();
    assert_eq!(reparsed.date_parts.as_ref().unwrap().len(), 2);
}

#[test]
fn test_date_literal() {
    let d = DateVariable { literal: Some("Spring 2023".into()), ..Default::default() };
    let json = serde_json::to_string(&d).unwrap();
    assert!(json.contains("Spring 2023"));
}

#[test]
fn test_date_circa() {
    let d = DateVariable {
        date_parts: Some(vec![vec![1500]]),
        circa: Some(true),
        ..Default::default()
    };
    let json = serde_json::to_string(&d).unwrap();
    assert!(json.contains("\"circa\":true"));
}

// =============================================================================
// StringOrNumber
// =============================================================================

#[test]
fn test_string_or_number() {
    let s = StringOrNumber::String("42".into());
    assert_eq!(s.to_string(), "42");

    let n = StringOrNumber::Number(42);
    assert_eq!(n.to_string(), "42");

    // JSON roundtrip
    let item = CslItem {
        id: "son".into(),
        volume: Some(StringOrNumber::Number(42)),
        issue: Some(StringOrNumber::String("Special Issue".into())),
        ..Default::default()
    };
    let json = serde_json::to_string(&item).unwrap();
    let reparsed: CslItem = serde_json::from_str(&json).unwrap();
    assert!(matches!(reparsed.volume, Some(StringOrNumber::Number(42))));
}

// =============================================================================
// Project and Tag structs
// =============================================================================

#[test]
fn test_project_roundtrip() {
    let proj = Project {
        id: "p1".into(),
        name: "My Paper".into(),
        description: Some("A description".into()),
        parent_id: None,
        color: Some("#ff9900".into()),
        icon: None,
        sort_order: 0,
        date_created: "2024-01-01".into(),
        date_modified: "2024-02-01".into(),
        default_style: Some("apa7".into()),
    };
    let json = serde_json::to_string(&proj).unwrap();
    let reparsed: Project = serde_json::from_str(&json).unwrap();
    assert_eq!(reparsed.name, "My Paper");
    assert_eq!(reparsed.default_style.as_deref(), Some("apa7"));
}

#[test]
fn test_tag_roundtrip() {
    let tag = Tag { id: "t1".into(), name: "urgent".into(), color: Some("#ff0000".into()) };
    let json = serde_json::to_string(&tag).unwrap();
    let reparsed: Tag = serde_json::from_str(&json).unwrap();
    assert_eq!(reparsed.name, "urgent");
}

// =============================================================================
// ReadStatus and SyncStatus enums
// =============================================================================

#[test]
fn test_read_status_values() {
    for (val, expected) in [
        (ReadStatus::Unread, "\"unread\""),
        (ReadStatus::Reading, "\"reading\""),
        (ReadStatus::Read, "\"read\""),
    ] {
        let json = serde_json::to_string(&val).unwrap();
        assert_eq!(json, expected);
    }
}

#[test]
fn test_sync_status_values() {
    for (val, expected) in [
        (SyncStatus::Synced, "\"synced\""),
        (SyncStatus::Pending, "\"pending\""),
        (SyncStatus::Conflict, "\"conflict\""),
        (SyncStatus::Error, "\"error\""),
    ] {
        let json = serde_json::to_string(&val).unwrap();
        assert_eq!(json, expected);
    }
}

// =============================================================================
// Empty / minimal item
// =============================================================================

#[test]
fn test_minimal_item() {
    let item = CslItem { id: "min".into(), ..Default::default() };
    let json = serde_json::to_string(&item).unwrap();
    let reparsed: CslItem = serde_json::from_str(&json).unwrap();
    assert_eq!(reparsed.id, "min");
    assert_eq!(reparsed.item_type, ItemType::Webpage); // default
    assert!(reparsed.title.is_none());
    assert!(reparsed.author.is_none());
}

#[test]
fn test_skip_serializing_none_fields() {
    let item = CslItem { id: "sparse".into(), title: Some("T".into()), ..Default::default() };
    let json = serde_json::to_string(&item).unwrap();
    // Optional None fields should not appear
    assert!(!json.contains("\"author\""));
    assert!(!json.contains("\"DOI\""));
    assert!(!json.contains("\"_starred\""));
}
