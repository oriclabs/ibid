use quick_xml::Reader;
use quick_xml::events::Event;
use std::collections::HashMap;

use crate::error::{IbidError, Result};

// =============================================================================
// Top-level CSL Style
// =============================================================================

#[derive(Debug, Clone, Default)]
pub struct Style {
    pub info: StyleInfo,
    pub default_locale: String,
    pub version: String,
    pub class: StyleClass,
    pub macros: HashMap<String, CslMacro>,
    pub citation: Option<Citation>,
    pub bibliography: Option<Bibliography>,
    pub locale_overrides: Vec<LocaleOverride>,
    pub global_options: GlobalOptions,
}

#[derive(Debug, Clone, Default)]
pub struct StyleInfo {
    pub title: String,
    pub id: String,
    pub summary: Option<String>,
    pub updated: Option<String>,
    pub categories: Vec<String>,
    pub links: Vec<StyleLink>,
}

#[derive(Debug, Clone)]
pub struct StyleLink {
    pub href: String,
    pub rel: String,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub enum StyleClass {
    #[default]
    InText,
    Note,
}

// =============================================================================
// Global formatting options
// =============================================================================

#[derive(Debug, Clone, Default)]
pub struct GlobalOptions {
    pub initialize_with: Option<String>,
    pub initialize_with_hyphen: bool,
    pub name_as_sort_order: Option<NameAsSortOrder>,
    pub and: Option<NameAnd>,
    pub delimiter_precedes_last: Option<DelimiterPrecedesLast>,
    pub delimiter_precedes_et_al: Option<DelimiterPrecedesLast>,
    pub et_al_min: Option<u32>,
    pub et_al_use_first: Option<u32>,
    pub et_al_subsequent_min: Option<u32>,
    pub et_al_subsequent_use_first: Option<u32>,
    pub et_al_use_last: bool,
    pub name_delimiter: Option<String>,
    pub names_delimiter: Option<String>,
    pub demote_non_dropping_particle: Option<DemoteNonDroppingParticle>,
    pub page_range_format: Option<PageRangeFormat>,
    pub second_field_align: Option<SecondFieldAlign>,
    pub subsequent_author_substitute: Option<String>,
    pub subsequent_author_substitute_rule: Option<SubsequentAuthorSubstituteRule>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum NameAsSortOrder {
    First,
    All,
}

#[derive(Debug, Clone, PartialEq)]
pub enum NameAnd {
    Text,
    Symbol,
}

#[derive(Debug, Clone, PartialEq)]
pub enum DelimiterPrecedesLast {
    Contextual,
    AfterInvertedName,
    Always,
    Never,
}

#[derive(Debug, Clone, PartialEq)]
pub enum DemoteNonDroppingParticle {
    Never,
    SortOnly,
    DisplayAndSort,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PageRangeFormat {
    Chicago,
    Expanded,
    Minimal,
    MinimalTwo,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SecondFieldAlign {
    Flush,
    Margin,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SubsequentAuthorSubstituteRule {
    CompleteAll,
    CompleteEach,
    PartialEach,
    PartialFirst,
}

// =============================================================================
// Citation element
// =============================================================================

#[derive(Debug, Clone, Default)]
pub struct Citation {
    pub layout: Layout,
    pub sort: Option<Sort>,
    pub options: CitationOptions,
}

#[derive(Debug, Clone, Default)]
pub struct CitationOptions {
    pub collapse: Option<Collapse>,
    pub cite_group_delimiter: Option<String>,
    pub after_collapse_delimiter: Option<String>,
    pub near_note_distance: Option<u32>,
    pub disambiguate_add_names: bool,
    pub disambiguate_add_givenname: bool,
    pub disambiguate_add_year_suffix: bool,
    pub givenname_disambiguation_rule: Option<GivennameDisambiguationRule>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Collapse {
    CitationNumber,
    Year,
    YearSuffix,
    YearSuffixRanged,
}

#[derive(Debug, Clone, PartialEq)]
pub enum GivennameDisambiguationRule {
    AllNames,
    AllNamesWithInitials,
    PrimaryName,
    PrimaryNameWithInitials,
    ByCite,
}

// =============================================================================
// Bibliography element
// =============================================================================

#[derive(Debug, Clone, Default)]
pub struct Bibliography {
    pub layout: Layout,
    pub sort: Option<Sort>,
    pub options: BibliographyOptions,
}

#[derive(Debug, Clone, Default)]
pub struct BibliographyOptions {
    pub hanging_indent: bool,
    pub line_spacing: Option<u32>,
    pub entry_spacing: Option<u32>,
    pub second_field_align: Option<SecondFieldAlign>,
    pub subsequent_author_substitute: Option<String>,
    pub subsequent_author_substitute_rule: Option<SubsequentAuthorSubstituteRule>,
}

// =============================================================================
// Layout — contains the rendering tree
// =============================================================================

#[derive(Debug, Clone, Default)]
pub struct Layout {
    pub prefix: Option<String>,
    pub suffix: Option<String>,
    pub delimiter: Option<String>,
    pub formatting: Formatting,
    pub elements: Vec<Element>,
}

// =============================================================================
// Rendering elements — the core AST
// =============================================================================

#[derive(Debug, Clone)]
pub enum Element {
    Text(TextElement),
    Number(NumberElement),
    Names(NamesElement),
    Date(DateElement),
    Label(LabelElement),
    Group(GroupElement),
    Choose(ChooseElement),
}

#[derive(Debug, Clone, Default)]
pub struct TextElement {
    pub source: TextSource,
    pub formatting: Formatting,
    pub prefix: Option<String>,
    pub suffix: Option<String>,
    pub display: Option<Display>,
    pub text_case: Option<TextCase>,
    pub strip_periods: bool,
    pub quotes: bool,
}

#[derive(Debug, Clone, Default)]
pub enum TextSource {
    Variable(String),
    Macro(String),
    Term(String),
    #[default]
    Value,
    ValueStr(String),
}

#[derive(Debug, Clone, Default)]
pub struct NumberElement {
    pub variable: String,
    pub form: Option<NumberForm>,
    pub formatting: Formatting,
    pub prefix: Option<String>,
    pub suffix: Option<String>,
    pub text_case: Option<TextCase>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum NumberForm {
    Numeric,
    Ordinal,
    LongOrdinal,
    Roman,
}

#[derive(Debug, Clone, Default)]
pub struct NamesElement {
    pub variables: Vec<String>,
    pub name: Option<NameConfig>,
    pub et_al: Option<EtAl>,
    pub substitute: Option<Vec<Element>>,
    pub label: Option<LabelElement>,
    pub formatting: Formatting,
    pub prefix: Option<String>,
    pub suffix: Option<String>,
    pub delimiter: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct NameConfig {
    pub form: Option<NameForm>,
    pub and: Option<NameAnd>,
    pub delimiter: Option<String>,
    pub delimiter_precedes_last: Option<DelimiterPrecedesLast>,
    pub delimiter_precedes_et_al: Option<DelimiterPrecedesLast>,
    pub et_al_min: Option<u32>,
    pub et_al_use_first: Option<u32>,
    pub et_al_subsequent_min: Option<u32>,
    pub et_al_subsequent_use_first: Option<u32>,
    pub et_al_use_last: Option<bool>,
    pub initialize: Option<bool>,
    pub initialize_with: Option<String>,
    pub name_as_sort_order: Option<NameAsSortOrder>,
    pub sort_separator: Option<String>,
    pub formatting: Formatting,
    pub prefix: Option<String>,
    pub suffix: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum NameForm {
    Long,
    Short,
    Count,
}

#[derive(Debug, Clone, Default)]
pub struct EtAl {
    pub term: String,
    pub formatting: Formatting,
}

#[derive(Debug, Clone, Default)]
pub struct DateElement {
    pub variable: String,
    pub form: Option<DateForm>,
    pub date_parts_attr: Option<DatePartsAttr>,
    pub parts: Vec<DatePart>,
    pub formatting: Formatting,
    pub prefix: Option<String>,
    pub suffix: Option<String>,
    pub delimiter: Option<String>,
    pub text_case: Option<TextCase>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum DateForm {
    NumericDate,
    TextDate,
}

#[derive(Debug, Clone, PartialEq)]
pub enum DatePartsAttr {
    YearMonthDay,
    YearMonth,
    Year,
}

#[derive(Debug, Clone, Default)]
pub struct DatePart {
    pub name: DatePartName,
    pub form: Option<String>,
    pub prefix: Option<String>,
    pub suffix: Option<String>,
    pub formatting: Formatting,
    pub text_case: Option<TextCase>,
    pub range_delimiter: Option<String>,
    pub strip_periods: bool,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub enum DatePartName {
    #[default]
    Year,
    Month,
    Day,
}

#[derive(Debug, Clone, Default)]
pub struct LabelElement {
    pub variable: String,
    pub form: Option<LabelForm>,
    pub plural: Option<LabelPlural>,
    pub formatting: Formatting,
    pub prefix: Option<String>,
    pub suffix: Option<String>,
    pub text_case: Option<TextCase>,
    pub strip_periods: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum LabelForm {
    Long,
    Short,
    Symbol,
    Verb,
    VerbShort,
}

#[derive(Debug, Clone, PartialEq)]
pub enum LabelPlural {
    Contextual,
    Always,
    Never,
}

#[derive(Debug, Clone, Default)]
pub struct GroupElement {
    pub elements: Vec<Element>,
    pub formatting: Formatting,
    pub prefix: Option<String>,
    pub suffix: Option<String>,
    pub delimiter: Option<String>,
    pub display: Option<Display>,
}

// =============================================================================
// Conditional (cs:choose)
// =============================================================================

#[derive(Debug, Clone, Default)]
pub struct ChooseElement {
    pub if_: Condition,
    pub else_if: Vec<Condition>,
    pub else_: Option<Vec<Element>>,
}

#[derive(Debug, Clone, Default)]
pub struct Condition {
    pub match_: ConditionMatch,
    pub tests: Vec<ConditionTest>,
    pub elements: Vec<Element>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub enum ConditionMatch {
    #[default]
    All,
    Any,
    None,
}

#[derive(Debug, Clone)]
pub enum ConditionTest {
    Type(Vec<String>),
    Variable(Vec<String>),
    IsNumeric(Vec<String>),
    IsUncertainDate(Vec<String>),
    Locator(Vec<String>),
    Position(Vec<String>),
}

// =============================================================================
// Sort
// =============================================================================

#[derive(Debug, Clone, Default)]
pub struct Sort {
    pub keys: Vec<SortKey>,
}

#[derive(Debug, Clone)]
pub struct SortKey {
    pub source: SortKeySource,
    pub direction: SortDirection,
    pub names_min: Option<u32>,
    pub names_use_first: Option<u32>,
    pub names_use_last: Option<bool>,
}

#[derive(Debug, Clone)]
pub enum SortKeySource {
    Variable(String),
    Macro(String),
}

#[derive(Debug, Clone, Default, PartialEq)]
pub enum SortDirection {
    #[default]
    Ascending,
    Descending,
}

// =============================================================================
// Locale overrides within a style
// =============================================================================

#[derive(Debug, Clone, Default)]
pub struct LocaleOverride {
    pub lang: String,
    pub terms: HashMap<String, TermDefinition>,
    pub date_formats: HashMap<String, DateElement>,
}

#[derive(Debug, Clone, Default)]
pub struct TermDefinition {
    pub single: Option<String>,
    pub multiple: Option<String>,
    pub form: Option<String>,
    pub gender: Option<String>,
    pub gender_form: Option<String>,
}

// =============================================================================
// Formatting
// =============================================================================

#[derive(Debug, Clone, Default)]
pub struct Formatting {
    pub font_style: Option<FontStyle>,
    pub font_weight: Option<FontWeight>,
    pub font_variant: Option<FontVariant>,
    pub text_decoration: Option<TextDecoration>,
    pub vertical_align: Option<VerticalAlign>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum FontStyle {
    Normal,
    Italic,
    Oblique,
}

#[derive(Debug, Clone, PartialEq)]
pub enum FontWeight {
    Normal,
    Bold,
    Light,
}

#[derive(Debug, Clone, PartialEq)]
pub enum FontVariant {
    Normal,
    SmallCaps,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TextDecoration {
    None,
    Underline,
}

#[derive(Debug, Clone, PartialEq)]
pub enum VerticalAlign {
    Baseline,
    Sup,
    Sub,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TextCase {
    Lowercase,
    Uppercase,
    CapitalizeFirst,
    CapitalizeAll,
    Sentence,
    Title,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Display {
    Block,
    LeftMargin,
    RightInline,
    Indent,
}

// =============================================================================
// CSL Macro
// =============================================================================

#[derive(Debug, Clone, Default)]
pub struct CslMacro {
    pub name: String,
    pub elements: Vec<Element>,
}

// =============================================================================
// Parser: CSL XML → Style struct
// =============================================================================

impl Style {
    pub fn from_xml(xml: &str) -> Result<Self> {
        let mut reader = Reader::from_str(xml);
        reader.config_mut().trim_text(true);

        let mut style = Style::default();
        let mut buf = Vec::new();
        let mut context_stack: Vec<String> = Vec::new();
        let mut current_macro_name: Option<String> = None;
        let mut current_macro_elements: Vec<Element> = Vec::new();
        let mut info_text_target: Option<String> = None;
        let mut current_text = String::new();

        // Element stacks for nested parsing
        let mut element_stack: Vec<Vec<Element>> = Vec::new();
        let mut in_citation_layout = false;
        let mut in_bibliography_layout = false;
        let mut in_macro = false;

        // Stack to track pending NamesElement data from opening tags
        let mut names_stack: Vec<NamesElement> = Vec::new();
        // Stack to track pending NameConfig from <name> child elements
        let mut pending_name_config: Option<NameConfig> = None;

        // Choose/if/else tracking
        #[derive(Default)]
        struct ChooseBuilder {
            if_condition: Option<Condition>,
            else_ifs: Vec<Condition>,
            else_elements: Option<Vec<Element>>,
        }
        let mut choose_stack: Vec<ChooseBuilder> = Vec::new();
        let mut pending_condition_attrs: Vec<HashMap<String, String>> = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    let attrs = parse_attributes(e)?;

                    match tag.as_str() {
                        "style" => {
                            style.default_locale = attrs
                                .get("default-locale")
                                .cloned()
                                .unwrap_or_else(|| "en-US".to_string());
                            style.version = attrs
                                .get("version")
                                .cloned()
                                .unwrap_or_else(|| "1.0".to_string());
                            style.class = match attrs.get("class").map(|s| s.as_str()) {
                                Some("note") => StyleClass::Note,
                                _ => StyleClass::InText,
                            };
                            parse_global_options(&attrs, &mut style.global_options);
                        }
                        "info" => {
                            context_stack.push("info".to_string());
                        }
                        "title" if context_stack.last().map(|s| s.as_str()) == Some("info") => {
                            info_text_target = Some("title".to_string());
                            context_stack.push(tag.clone());
                        }
                        "id" if context_stack.last().map(|s| s.as_str()) == Some("info") => {
                            info_text_target = Some("id".to_string());
                            context_stack.push(tag.clone());
                        }
                        "summary" if context_stack.last().map(|s| s.as_str()) == Some("info") => {
                            info_text_target = Some("summary".to_string());
                            context_stack.push(tag.clone());
                        }
                        "updated" if context_stack.last().map(|s| s.as_str()) == Some("info") => {
                            info_text_target = Some("updated".to_string());
                            context_stack.push(tag.clone());
                        }
                        "link" if context_stack.last().map(|s| s.as_str()) == Some("info") => {
                            if let (Some(href), Some(rel)) = (attrs.get("href"), attrs.get("rel")) {
                                style.info.links.push(StyleLink {
                                    href: href.clone(),
                                    rel: rel.clone(),
                                });
                            }
                        }
                        "macro" => {
                            if let Some(name) = attrs.get("name") {
                                current_macro_name = Some(name.clone());
                                current_macro_elements = Vec::new();
                                element_stack.push(Vec::new());
                                in_macro = true;
                            }
                        }
                        "citation" => {
                            let mut citation = Citation::default();
                            parse_citation_options(&attrs, &mut citation.options);
                            style.citation = Some(citation);
                            context_stack.push("citation".to_string());
                        }
                        "bibliography" => {
                            let mut bib = Bibliography::default();
                            parse_bibliography_options(&attrs, &mut bib.options);
                            style.bibliography = Some(bib);
                            context_stack.push("bibliography".to_string());
                        }
                        "layout" => {
                            let layout = Layout {
                                prefix: attrs.get("prefix").cloned(),
                                suffix: attrs.get("suffix").cloned(),
                                delimiter: attrs.get("delimiter").cloned(),
                                formatting: parse_formatting(&attrs),
                                elements: Vec::new(),
                            };

                            let ctx = context_stack.last().map(|s| s.as_str());
                            if ctx == Some("citation") {
                                if let Some(ref mut c) = style.citation {
                                    c.layout = layout;
                                }
                                in_citation_layout = true;
                            } else if ctx == Some("bibliography") {
                                if let Some(ref mut b) = style.bibliography {
                                    b.layout = layout;
                                }
                                in_bibliography_layout = true;
                            }
                            element_stack.push(Vec::new());
                            context_stack.push("layout".to_string());
                        }
                        "sort" => {
                            context_stack.push("sort".to_string());
                        }
                        "key" if context_stack.last().map(|s| s.as_str()) == Some("sort") => {
                            let sort_key = parse_sort_key(&attrs);
                            // Determine if this sort belongs to citation or bibliography
                            let in_cit = context_stack.iter().any(|s| s == "citation");
                            let in_bib = context_stack.iter().any(|s| s == "bibliography");
                            if in_cit {
                                if let Some(ref mut c) = style.citation {
                                    let sort = c.sort.get_or_insert_with(Sort::default);
                                    sort.keys.push(sort_key);
                                }
                            } else if in_bib {
                                if let Some(ref mut b) = style.bibliography {
                                    let sort = b.sort.get_or_insert_with(Sort::default);
                                    sort.keys.push(sort_key);
                                }
                            }
                        }
                        // Rendering elements
                        "text" | "number" | "names" | "name" | "et-al" | "label" | "date"
                        | "date-part" | "group" | "choose" | "if" | "else-if" | "else"
                        | "substitute" => {
                            // Handle <name> child element inside <names>
                            if tag == "name" && context_stack.last().map(|s| s.as_str()) == Some("names") {
                                pending_name_config = Some(parse_name_config(&attrs));
                                context_stack.push(tag.clone());
                                continue;
                            }

                            // Handle choose/if/else-if/else specially
                            if tag == "choose" {
                                choose_stack.push(ChooseBuilder::default());
                                context_stack.push(tag.clone());
                                continue;
                            }
                            if tag == "if" || tag == "else-if" {
                                element_stack.push(Vec::new());
                                pending_condition_attrs.push(attrs.clone());
                                context_stack.push(tag.clone());
                                continue;
                            }
                            if tag == "else" {
                                element_stack.push(Vec::new());
                                context_stack.push(tag.clone());
                                continue;
                            }
                            if tag == "substitute" {
                                element_stack.push(Vec::new());
                                context_stack.push(tag.clone());
                                continue;
                            }

                            if let Some(elem) =
                                parse_element_start(&tag, &attrs, &mut context_stack)
                            {
                                // For container elements, push new level
                                match &elem {
                                    Element::Group(_) => {
                                        element_stack.push(Vec::new());
                                    }
                                    Element::Names(ne) => {
                                        names_stack.push(ne.clone());
                                        element_stack.push(Vec::new());
                                    }
                                    _ => {}
                                }
                                // Push element to current level for non-containers
                                match &elem {
                                    Element::Group(_)
                                    | Element::Names(_) => {
                                        // These will collect children and be assembled on End
                                    }
                                    _ => {
                                        if let Some(current) = element_stack.last_mut() {
                                            current.push(elem);
                                        }
                                    }
                                }
                            }
                            context_stack.push(tag.clone());
                        }
                        _ => {
                            context_stack.push(tag.clone());
                        }
                    }
                }
                Ok(Event::Empty(ref e)) => {
                    let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    let attrs = parse_attributes(e)?;

                    match tag.as_str() {
                        "link" if context_stack.last().map(|s| s.as_str()) == Some("info") => {
                            if let (Some(href), Some(rel)) = (attrs.get("href"), attrs.get("rel")) {
                                style.info.links.push(StyleLink {
                                    href: href.clone(),
                                    rel: rel.clone(),
                                });
                            }
                        }
                        "category" if context_stack.last().map(|s| s.as_str()) == Some("info") => {
                            if let Some(cat) = attrs.get("citation-format") {
                                style.info.categories.push(cat.clone());
                            }
                            if let Some(field) = attrs.get("field") {
                                style.info.categories.push(field.clone());
                            }
                        }
                        "key" if context_stack.last().map(|s| s.as_str()) == Some("sort") => {
                            let sort_key = parse_sort_key(&attrs);
                            let in_cit = context_stack.iter().any(|s| s == "citation");
                            let in_bib = context_stack.iter().any(|s| s == "bibliography");
                            if in_cit {
                                if let Some(ref mut c) = style.citation {
                                    let sort = c.sort.get_or_insert_with(Sort::default);
                                    sort.keys.push(sort_key);
                                }
                            } else if in_bib {
                                if let Some(ref mut b) = style.bibliography {
                                    let sort = b.sort.get_or_insert_with(Sort::default);
                                    sort.keys.push(sort_key);
                                }
                            }
                        }
                        "names" => {
                            // Self-closing <names variable="author" ... />
                            let ne = NamesElement {
                                variables: attrs.get("variable").map(|v| v.split_whitespace().map(String::from).collect()).unwrap_or_default(),
                                formatting: parse_formatting(&attrs),
                                prefix: attrs.get("prefix").cloned(),
                                suffix: attrs.get("suffix").cloned(),
                                delimiter: attrs.get("delimiter").cloned(),
                                ..Default::default()
                            };
                            if let Some(current) = element_stack.last_mut() {
                                current.push(Element::Names(ne));
                            }
                        }
                        "name" if context_stack.last().map(|s| s.as_str()) == Some("names") => {
                            // Self-closing <name .../> inside <names>
                            pending_name_config = Some(parse_name_config(&attrs));
                        }
                        "text" | "number" | "label" | "date-part" | "et-al" => {
                            if let Some(elem) =
                                parse_element_empty(&tag, &attrs)
                            {
                                if let Some(current) = element_stack.last_mut() {
                                    current.push(elem);
                                }
                            }
                        }
                        _ => {}
                    }
                }
                Ok(Event::Text(ref e)) => {
                    current_text = e.unescape().unwrap_or_default().to_string();
                    if let Some(ref target) = info_text_target {
                        match target.as_str() {
                            "title" => style.info.title = current_text.clone(),
                            "id" => style.info.id = current_text.clone(),
                            "summary" => style.info.summary = Some(current_text.clone()),
                            "updated" => style.info.updated = Some(current_text.clone()),
                            _ => {}
                        }
                        info_text_target = None;
                    }
                }
                Ok(Event::End(ref e)) => {
                    let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();

                    match tag.as_str() {
                        "info" => {
                            context_stack.pop();
                        }
                        "macro" => {
                            if let Some(name) = current_macro_name.take() {
                                let elements = element_stack.pop().unwrap_or_default();
                                style.macros.insert(
                                    name.clone(),
                                    CslMacro {
                                        name: name.clone(),
                                        elements,
                                    },
                                );
                            }
                            in_macro = false;
                        }
                        "layout" => {
                            let elements = element_stack.pop().unwrap_or_default();
                            if in_citation_layout {
                                if let Some(ref mut c) = style.citation {
                                    c.layout.elements = elements;
                                }
                                in_citation_layout = false;
                            } else if in_bibliography_layout {
                                if let Some(ref mut b) = style.bibliography {
                                    b.layout.elements = elements;
                                }
                                in_bibliography_layout = false;
                            }
                            context_stack.pop();
                        }
                        "citation" | "bibliography" | "sort" => {
                            context_stack.pop();
                        }
                        "group" => {
                            let children = element_stack.pop().unwrap_or_default();
                            // Create the group with its children
                            // We need to reconstruct from context
                            let group = Element::Group(GroupElement {
                                elements: children,
                                ..Default::default()
                            });
                            if let Some(current) = element_stack.last_mut() {
                                current.push(group);
                            }
                            context_stack.pop();
                        }
                        "names" => {
                            let _children = element_stack.pop().unwrap_or_default();
                            let mut ne = names_stack.pop().unwrap_or_default();
                            // Wire up child <name> config if found
                            if let Some(nc) = pending_name_config.take() {
                                ne.name = Some(nc);
                            }
                            let names = Element::Names(ne);
                            if let Some(current) = element_stack.last_mut() {
                                current.push(names);
                            }
                            context_stack.pop();
                        }
                        "if" => {
                            let children = element_stack.pop().unwrap_or_default();
                            let cond_attrs = pending_condition_attrs.pop().unwrap_or_default();
                            let condition = parse_condition(&cond_attrs, children);
                            if let Some(builder) = choose_stack.last_mut() {
                                builder.if_condition = Some(condition);
                            }
                            context_stack.pop();
                        }
                        "else-if" => {
                            let children = element_stack.pop().unwrap_or_default();
                            let cond_attrs = pending_condition_attrs.pop().unwrap_or_default();
                            let condition = parse_condition(&cond_attrs, children);
                            if let Some(builder) = choose_stack.last_mut() {
                                builder.else_ifs.push(condition);
                            }
                            context_stack.pop();
                        }
                        "else" => {
                            let children = element_stack.pop().unwrap_or_default();
                            if let Some(builder) = choose_stack.last_mut() {
                                builder.else_elements = Some(children);
                            }
                            context_stack.pop();
                        }
                        "choose" => {
                            if let Some(builder) = choose_stack.pop() {
                                let choose = Element::Choose(ChooseElement {
                                    if_: builder.if_condition.unwrap_or_default(),
                                    else_if: builder.else_ifs,
                                    else_: builder.else_elements,
                                });
                                if let Some(current) = element_stack.last_mut() {
                                    current.push(choose);
                                }
                            }
                            context_stack.pop();
                        }
                        "substitute" => {
                            // Substitute children go into the parent names element
                            let _children = element_stack.pop().unwrap_or_default();
                            // TODO: wire substitute into NamesElement
                            context_stack.pop();
                        }
                        "text" | "number" | "label" | "date" | "date-part" | "name" | "et-al" => {
                            context_stack.pop();
                        }
                        _ => {
                            context_stack.pop();
                        }
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(IbidError::CslParse(format!("XML error: {}", e))),
                _ => {}
            }
            buf.clear();
        }

        Ok(style)
    }
}

// =============================================================================
// Attribute parsing helpers
// =============================================================================

fn parse_attributes(
    e: &quick_xml::events::BytesStart,
) -> Result<HashMap<String, String>> {
    let mut map = HashMap::new();
    for attr in e.attributes() {
        let attr = attr.map_err(|e| IbidError::CslParse(format!("Attribute error: {}", e)))?;
        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
        let val = attr
            .unescape_value()
            .unwrap_or_default()
            .to_string();
        map.insert(key, val);
    }
    Ok(map)
}

fn parse_formatting(attrs: &HashMap<String, String>) -> Formatting {
    Formatting {
        font_style: attrs.get("font-style").and_then(|v| match v.as_str() {
            "italic" => Some(FontStyle::Italic),
            "oblique" => Some(FontStyle::Oblique),
            "normal" => Some(FontStyle::Normal),
            _ => None,
        }),
        font_weight: attrs.get("font-weight").and_then(|v| match v.as_str() {
            "bold" => Some(FontWeight::Bold),
            "light" => Some(FontWeight::Light),
            "normal" => Some(FontWeight::Normal),
            _ => None,
        }),
        font_variant: attrs.get("font-variant").and_then(|v| match v.as_str() {
            "small-caps" => Some(FontVariant::SmallCaps),
            "normal" => Some(FontVariant::Normal),
            _ => None,
        }),
        text_decoration: attrs.get("text-decoration").and_then(|v| match v.as_str() {
            "underline" => Some(TextDecoration::Underline),
            "none" => Some(TextDecoration::None),
            _ => None,
        }),
        vertical_align: attrs.get("vertical-align").and_then(|v| match v.as_str() {
            "sup" => Some(VerticalAlign::Sup),
            "sub" => Some(VerticalAlign::Sub),
            "baseline" => Some(VerticalAlign::Baseline),
            _ => None,
        }),
    }
}

fn parse_text_case(attrs: &HashMap<String, String>) -> Option<TextCase> {
    attrs.get("text-case").and_then(|v| match v.as_str() {
        "lowercase" => Some(TextCase::Lowercase),
        "uppercase" => Some(TextCase::Uppercase),
        "capitalize-first" => Some(TextCase::CapitalizeFirst),
        "capitalize-all" => Some(TextCase::CapitalizeAll),
        "sentence" => Some(TextCase::Sentence),
        "title" => Some(TextCase::Title),
        _ => None,
    })
}

fn parse_display(attrs: &HashMap<String, String>) -> Option<Display> {
    attrs.get("display").and_then(|v| match v.as_str() {
        "block" => Some(Display::Block),
        "left-margin" => Some(Display::LeftMargin),
        "right-inline" => Some(Display::RightInline),
        "indent" => Some(Display::Indent),
        _ => None,
    })
}

fn parse_global_options(attrs: &HashMap<String, String>, opts: &mut GlobalOptions) {
    opts.initialize_with = attrs.get("initialize-with").cloned();
    opts.initialize_with_hyphen = attrs
        .get("initialize-with-hyphen")
        .map(|v| v != "false")
        .unwrap_or(true);
    opts.name_as_sort_order = attrs.get("name-as-sort-order").and_then(|v| match v.as_str() {
        "first" => Some(NameAsSortOrder::First),
        "all" => Some(NameAsSortOrder::All),
        _ => None,
    });
    opts.and = attrs.get("and").and_then(|v| match v.as_str() {
        "text" => Some(NameAnd::Text),
        "symbol" => Some(NameAnd::Symbol),
        _ => None,
    });
    opts.et_al_min = attrs.get("et-al-min").and_then(|v| v.parse().ok());
    opts.et_al_use_first = attrs.get("et-al-use-first").and_then(|v| v.parse().ok());
    opts.et_al_use_last = attrs.get("et-al-use-last").map(|v| v == "true").unwrap_or(false);
    opts.page_range_format = attrs.get("page-range-format").and_then(|v| match v.as_str() {
        "chicago" => Some(PageRangeFormat::Chicago),
        "expanded" => Some(PageRangeFormat::Expanded),
        "minimal" => Some(PageRangeFormat::Minimal),
        "minimal-two" => Some(PageRangeFormat::MinimalTwo),
        _ => None,
    });
    opts.demote_non_dropping_particle = attrs
        .get("demote-non-dropping-particle")
        .and_then(|v| match v.as_str() {
            "never" => Some(DemoteNonDroppingParticle::Never),
            "sort-only" => Some(DemoteNonDroppingParticle::SortOnly),
            "display-and-sort" => Some(DemoteNonDroppingParticle::DisplayAndSort),
            _ => None,
        });
}

fn parse_citation_options(attrs: &HashMap<String, String>, opts: &mut CitationOptions) {
    opts.collapse = attrs.get("collapse").and_then(|v| match v.as_str() {
        "citation-number" => Some(Collapse::CitationNumber),
        "year" => Some(Collapse::Year),
        "year-suffix" => Some(Collapse::YearSuffix),
        "year-suffix-ranged" => Some(Collapse::YearSuffixRanged),
        _ => None,
    });
    opts.cite_group_delimiter = attrs.get("cite-group-delimiter").cloned();
    opts.after_collapse_delimiter = attrs.get("after-collapse-delimiter").cloned();
    opts.near_note_distance = attrs.get("near-note-distance").and_then(|v| v.parse().ok());
    opts.disambiguate_add_names = attrs
        .get("disambiguate-add-names")
        .map(|v| v == "true")
        .unwrap_or(false);
    opts.disambiguate_add_givenname = attrs
        .get("disambiguate-add-givenname")
        .map(|v| v == "true")
        .unwrap_or(false);
    opts.disambiguate_add_year_suffix = attrs
        .get("disambiguate-add-year-suffix")
        .map(|v| v == "true")
        .unwrap_or(false);
}

fn parse_bibliography_options(attrs: &HashMap<String, String>, opts: &mut BibliographyOptions) {
    opts.hanging_indent = attrs.get("hanging-indent").map(|v| v == "true").unwrap_or(false);
    opts.line_spacing = attrs.get("line-spacing").and_then(|v| v.parse().ok());
    opts.entry_spacing = attrs.get("entry-spacing").and_then(|v| v.parse().ok());
    opts.second_field_align = attrs.get("second-field-align").and_then(|v| match v.as_str() {
        "flush" => Some(SecondFieldAlign::Flush),
        "margin" => Some(SecondFieldAlign::Margin),
        _ => None,
    });
    opts.subsequent_author_substitute = attrs.get("subsequent-author-substitute").cloned();
}

fn parse_sort_key(attrs: &HashMap<String, String>) -> SortKey {
    let source = if let Some(var) = attrs.get("variable") {
        SortKeySource::Variable(var.clone())
    } else if let Some(mac) = attrs.get("macro") {
        SortKeySource::Macro(mac.clone())
    } else {
        SortKeySource::Variable("title".to_string())
    };

    let direction = match attrs.get("sort").map(|s| s.as_str()) {
        Some("descending") => SortDirection::Descending,
        _ => SortDirection::Ascending,
    };

    SortKey {
        source,
        direction,
        names_min: attrs.get("names-min").and_then(|v| v.parse().ok()),
        names_use_first: attrs.get("names-use-first").and_then(|v| v.parse().ok()),
        names_use_last: attrs.get("names-use-last").map(|v| v == "true"),
    }
}

fn parse_element_start(
    tag: &str,
    attrs: &HashMap<String, String>,
    _context: &mut Vec<String>,
) -> Option<Element> {
    match tag {
        "text" => Some(Element::Text(parse_text_element(attrs))),
        "number" => Some(Element::Number(parse_number_element(attrs))),
        "group" => Some(Element::Group(GroupElement {
            formatting: parse_formatting(attrs),
            prefix: attrs.get("prefix").cloned(),
            suffix: attrs.get("suffix").cloned(),
            delimiter: attrs.get("delimiter").cloned(),
            display: parse_display(attrs),
            elements: Vec::new(),
        })),
        "names" => Some(Element::Names(NamesElement {
            variables: attrs
                .get("variable")
                .map(|v| v.split_whitespace().map(String::from).collect())
                .unwrap_or_default(),
            formatting: parse_formatting(attrs),
            prefix: attrs.get("prefix").cloned(),
            suffix: attrs.get("suffix").cloned(),
            delimiter: attrs.get("delimiter").cloned(),
            ..Default::default()
        })),
        "date" => Some(Element::Date(DateElement {
            variable: attrs.get("variable").cloned().unwrap_or_default(),
            form: attrs.get("form").and_then(|v| match v.as_str() {
                "numeric" => Some(DateForm::NumericDate),
                "text" => Some(DateForm::TextDate),
                _ => None,
            }),
            date_parts_attr: attrs.get("date-parts").and_then(|v| match v.as_str() {
                "year-month-day" => Some(DatePartsAttr::YearMonthDay),
                "year-month" => Some(DatePartsAttr::YearMonth),
                "year" => Some(DatePartsAttr::Year),
                _ => None,
            }),
            formatting: parse_formatting(attrs),
            prefix: attrs.get("prefix").cloned(),
            suffix: attrs.get("suffix").cloned(),
            delimiter: attrs.get("delimiter").cloned(),
            text_case: parse_text_case(attrs),
            ..Default::default()
        })),
        "choose" => Some(Element::Choose(ChooseElement::default())),
        _ => None,
    }
}

fn parse_element_empty(tag: &str, attrs: &HashMap<String, String>) -> Option<Element> {
    match tag {
        "text" => Some(Element::Text(parse_text_element(attrs))),
        "number" => Some(Element::Number(parse_number_element(attrs))),
        "label" => Some(Element::Label(parse_label_element(attrs))),
        "date-part" => None, // date-parts are children of date, handled separately
        "et-al" | "name" => None, // handled as part of names
        _ => None,
    }
}

fn parse_text_element(attrs: &HashMap<String, String>) -> TextElement {
    let source = if let Some(var) = attrs.get("variable") {
        TextSource::Variable(var.clone())
    } else if let Some(mac) = attrs.get("macro") {
        TextSource::Macro(mac.clone())
    } else if let Some(term) = attrs.get("term") {
        TextSource::Term(term.clone())
    } else if let Some(val) = attrs.get("value") {
        TextSource::ValueStr(val.clone())
    } else {
        TextSource::Value
    };

    TextElement {
        source,
        formatting: parse_formatting(attrs),
        prefix: attrs.get("prefix").cloned(),
        suffix: attrs.get("suffix").cloned(),
        display: parse_display(attrs),
        text_case: parse_text_case(attrs),
        strip_periods: attrs.get("strip-periods").map(|v| v == "true").unwrap_or(false),
        quotes: attrs.get("quotes").map(|v| v == "true").unwrap_or(false),
    }
}

fn parse_number_element(attrs: &HashMap<String, String>) -> NumberElement {
    NumberElement {
        variable: attrs.get("variable").cloned().unwrap_or_default(),
        form: attrs.get("form").and_then(|v| match v.as_str() {
            "numeric" => Some(NumberForm::Numeric),
            "ordinal" => Some(NumberForm::Ordinal),
            "long-ordinal" => Some(NumberForm::LongOrdinal),
            "roman" => Some(NumberForm::Roman),
            _ => None,
        }),
        formatting: parse_formatting(attrs),
        prefix: attrs.get("prefix").cloned(),
        suffix: attrs.get("suffix").cloned(),
        text_case: parse_text_case(attrs),
    }
}

fn parse_condition(attrs: &HashMap<String, String>, elements: Vec<Element>) -> Condition {
    let match_ = match attrs.get("match").map(|s| s.as_str()) {
        Some("any") => ConditionMatch::Any,
        Some("none") => ConditionMatch::None,
        _ => ConditionMatch::All,
    };

    let mut tests = Vec::new();

    if let Some(types) = attrs.get("type") {
        tests.push(ConditionTest::Type(
            types.split_whitespace().map(String::from).collect()
        ));
    }
    if let Some(vars) = attrs.get("variable") {
        tests.push(ConditionTest::Variable(
            vars.split_whitespace().map(String::from).collect()
        ));
    }
    if let Some(vars) = attrs.get("is-numeric") {
        tests.push(ConditionTest::IsNumeric(
            vars.split_whitespace().map(String::from).collect()
        ));
    }
    if let Some(vars) = attrs.get("is-uncertain-date") {
        tests.push(ConditionTest::IsUncertainDate(
            vars.split_whitespace().map(String::from).collect()
        ));
    }
    if let Some(locs) = attrs.get("locator") {
        tests.push(ConditionTest::Locator(
            locs.split_whitespace().map(String::from).collect()
        ));
    }
    if let Some(pos) = attrs.get("position") {
        tests.push(ConditionTest::Position(
            pos.split_whitespace().map(String::from).collect()
        ));
    }

    Condition { match_, tests, elements }
}

fn parse_name_config(attrs: &HashMap<String, String>) -> NameConfig {
    NameConfig {
        form: attrs.get("form").and_then(|v| match v.as_str() {
            "long" => Some(NameForm::Long),
            "short" => Some(NameForm::Short),
            "count" => Some(NameForm::Count),
            _ => None,
        }),
        and: attrs.get("and").and_then(|v| match v.as_str() {
            "text" => Some(NameAnd::Text),
            "symbol" => Some(NameAnd::Symbol),
            _ => None,
        }),
        delimiter: attrs.get("delimiter").cloned(),
        delimiter_precedes_last: attrs.get("delimiter-precedes-last").and_then(|v| match v.as_str() {
            "contextual" => Some(DelimiterPrecedesLast::Contextual),
            "always" => Some(DelimiterPrecedesLast::Always),
            "never" => Some(DelimiterPrecedesLast::Never),
            "after-inverted-name" => Some(DelimiterPrecedesLast::AfterInvertedName),
            _ => None,
        }),
        delimiter_precedes_et_al: None,
        et_al_min: attrs.get("et-al-min").and_then(|v| v.parse().ok()),
        et_al_use_first: attrs.get("et-al-use-first").and_then(|v| v.parse().ok()),
        et_al_subsequent_min: attrs.get("et-al-subsequent-min").and_then(|v| v.parse().ok()),
        et_al_subsequent_use_first: attrs.get("et-al-subsequent-use-first").and_then(|v| v.parse().ok()),
        et_al_use_last: attrs.get("et-al-use-last").map(|v| v == "true"),
        initialize: attrs.get("initialize").map(|v| v != "false"),
        initialize_with: attrs.get("initialize-with").cloned(),
        name_as_sort_order: attrs.get("name-as-sort-order").and_then(|v| match v.as_str() {
            "first" => Some(NameAsSortOrder::First),
            "all" => Some(NameAsSortOrder::All),
            _ => None,
        }),
        sort_separator: attrs.get("sort-separator").cloned(),
        formatting: parse_formatting(attrs),
        prefix: attrs.get("prefix").cloned(),
        suffix: attrs.get("suffix").cloned(),
    }
}

fn parse_label_element(attrs: &HashMap<String, String>) -> LabelElement {
    LabelElement {
        variable: attrs.get("variable").cloned().unwrap_or_default(),
        form: attrs.get("form").and_then(|v| match v.as_str() {
            "long" => Some(LabelForm::Long),
            "short" => Some(LabelForm::Short),
            "symbol" => Some(LabelForm::Symbol),
            "verb" => Some(LabelForm::Verb),
            "verb-short" => Some(LabelForm::VerbShort),
            _ => None,
        }),
        plural: attrs.get("plural").and_then(|v| match v.as_str() {
            "contextual" => Some(LabelPlural::Contextual),
            "always" => Some(LabelPlural::Always),
            "never" => Some(LabelPlural::Never),
            _ => None,
        }),
        formatting: parse_formatting(attrs),
        prefix: attrs.get("prefix").cloned(),
        suffix: attrs.get("suffix").cloned(),
        text_case: parse_text_case(attrs),
        strip_periods: attrs.get("strip-periods").map(|v| v == "true").unwrap_or(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_minimal_style() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0" default-locale="en-US">
  <info>
    <title>Test Style</title>
    <id>test-style</id>
  </info>
  <bibliography>
    <layout>
      <text variable="title" font-style="italic"/>
    </layout>
  </bibliography>
</style>"#;

        let style = Style::from_xml(xml).unwrap();
        assert_eq!(style.info.title, "Test Style");
        assert_eq!(style.info.id, "test-style");
        assert_eq!(style.default_locale, "en-US");
        assert_eq!(style.class, StyleClass::InText);
        assert!(style.bibliography.is_some());
    }
}
