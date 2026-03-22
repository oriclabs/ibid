use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// =============================================================================
// CSL-JSON Item — the core citation data structure
// Follows CSL-JSON schema: https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub struct CslItem {
    pub id: String,
    #[serde(rename = "type")]
    pub item_type: ItemType,

    // Titles
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title_short: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub container_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub container_title_short: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collection_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub volume_title: Option<String>,

    // Names
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<Vec<Name>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub editor: Option<Vec<Name>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub translator: Option<Vec<Name>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewer: Option<Vec<Name>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collection_editor: Option<Vec<Name>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub composer: Option<Vec<Name>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub container_author: Option<Vec<Name>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub director: Option<Vec<Name>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub editorial_director: Option<Vec<Name>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub illustrator: Option<Vec<Name>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interviewer: Option<Vec<Name>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_author: Option<Vec<Name>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipient: Option<Vec<Name>>,

    // Dates
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issued: Option<DateVariable>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accessed: Option<DateVariable>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_date: Option<DateVariable>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_date: Option<DateVariable>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submitted: Option<DateVariable>,

    // Numbers
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapter_number: Option<StringOrNumber>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collection_number: Option<StringOrNumber>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edition: Option<StringOrNumber>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issue: Option<StringOrNumber>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number: Option<StringOrNumber>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number_of_pages: Option<StringOrNumber>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number_of_volumes: Option<StringOrNumber>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub volume: Option<StringOrNumber>,

    // Strings
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_first: Option<String>,
    #[serde(rename = "abstract", skip_serializing_if = "Option::is_none")]
    pub abstract_: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub annote: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archive: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archive_location: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authority: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub call_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub citation_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub citation_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dimensions: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub division: Option<String>,
    #[serde(rename = "DOI", skip_serializing_if = "Option::is_none")]
    pub doi: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_place: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub genre: Option<String>,
    #[serde(rename = "ISBN", skip_serializing_if = "Option::is_none")]
    pub isbn: Option<String>,
    #[serde(rename = "ISSN", skip_serializing_if = "Option::is_none")]
    pub issn: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jurisdiction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keyword: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub medium: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_publisher: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_publisher_place: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub part_number: Option<String>,
    #[serde(rename = "PMCID", skip_serializing_if = "Option::is_none")]
    pub pmcid: Option<String>,
    #[serde(rename = "PMID", skip_serializing_if = "Option::is_none")]
    pub pmid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub publisher: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub publisher_place: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub references: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewed_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub section: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(rename = "URL", skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year_suffix: Option<String>,

    // Ibid-specific extensions (prefixed with _)
    #[serde(rename = "_projectIds", skip_serializing_if = "Option::is_none")]
    pub project_ids: Option<Vec<String>>,
    #[serde(rename = "_tags", skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(rename = "_notes", skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(rename = "_quotes", skip_serializing_if = "Option::is_none")]
    pub quotes: Option<Vec<Quote>>,
    #[serde(rename = "_color", skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(rename = "_starred", skip_serializing_if = "Option::is_none")]
    pub starred: Option<bool>,
    #[serde(rename = "_dateAdded", skip_serializing_if = "Option::is_none")]
    pub date_added: Option<String>,
    #[serde(rename = "_dateModified", skip_serializing_if = "Option::is_none")]
    pub date_modified: Option<String>,
    #[serde(rename = "_sourceUrl", skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    #[serde(rename = "_readStatus", skip_serializing_if = "Option::is_none")]
    pub read_status: Option<ReadStatus>,
    #[serde(rename = "_syncStatus", skip_serializing_if = "Option::is_none")]
    pub sync_status: Option<SyncStatus>,
    #[serde(rename = "_syncHash", skip_serializing_if = "Option::is_none")]
    pub sync_hash: Option<String>,
    #[serde(rename = "_importSource", skip_serializing_if = "Option::is_none")]
    pub import_source: Option<String>,
    #[serde(rename = "_customFields", skip_serializing_if = "Option::is_none")]
    pub custom_fields: Option<HashMap<String, String>>,
}

// =============================================================================
// CSL Name
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub struct Name {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub given: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dropping_particle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub non_dropping_particle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suffix: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub literal: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comma_suffix: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub static_ordering: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parse_names: Option<bool>,
}

// =============================================================================
// CSL Date
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub struct DateVariable {
    /// Each inner Vec is [year] or [year, month] or [year, month, day]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_parts: Option<Vec<Vec<i32>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub season: Option<StringOrNumber>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub circa: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub literal: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<String>,
}

// =============================================================================
// CSL Item Types
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum ItemType {
    Article,
    ArticleJournal,
    ArticleMagazine,
    ArticleNewspaper,
    Bill,
    Book,
    Broadcast,
    Chapter,
    Classic,
    Collection,
    Dataset,
    Document,
    Entry,
    EntryDictionary,
    EntryEncyclopedia,
    Event,
    Figure,
    Graphic,
    Hearing,
    Interview,
    Legislation,
    LegalCase,
    Manuscript,
    Map,
    MotionPicture,
    MusicalScore,
    Pamphlet,
    PaperConference,
    Patent,
    Performance,
    Periodical,
    PersonalCommunication,
    Post,
    PostWeblog,
    Regulation,
    Report,
    Review,
    ReviewBook,
    Software,
    Song,
    Speech,
    Standard,
    Thesis,
    Treaty,
    #[default]
    Webpage,
}

// =============================================================================
// Supporting types
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum StringOrNumber {
    String(String),
    Number(i64),
}

impl Default for StringOrNumber {
    fn default() -> Self {
        StringOrNumber::String(String::new())
    }
}

impl std::fmt::Display for StringOrNumber {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StringOrNumber::String(s) => write!(f, "{}", s),
            StringOrNumber::Number(n) => write!(f, "{}", n),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quote {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ReadStatus {
    #[default]
    Unread,
    Reading,
    Read,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum SyncStatus {
    #[default]
    Synced,
    Pending,
    Conflict,
    Error,
}

// =============================================================================
// Project / Folder
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default)]
    pub sort_order: i32,
    pub date_created: String,
    pub date_modified: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_style: Option<String>,
}

// =============================================================================
// Tag
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}
