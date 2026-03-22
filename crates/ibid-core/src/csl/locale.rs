use quick_xml::Reader;
use quick_xml::events::Event;
use std::collections::HashMap;

use crate::csl::style::DateElement;
use crate::error::{IbidError, Result};

// =============================================================================
// CSL Locale — terms, date formats, ordinals for a given language
// =============================================================================

#[derive(Debug, Clone, Default)]
pub struct Locale {
    pub lang: String,
    pub terms: HashMap<String, Vec<TermEntry>>,
    pub date_formats: HashMap<String, DateElement>,
    pub ordinals: OrdinalConfig,
    pub style_options: LocaleStyleOptions,
}

#[derive(Debug, Clone, Default)]
pub struct TermEntry {
    pub value: String,
    pub plural: Option<String>,
    pub form: TermForm,
    pub gender: Option<String>,
    pub gender_form: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub enum TermForm {
    #[default]
    Long,
    Short,
    Symbol,
    Verb,
    VerbShort,
}

#[derive(Debug, Clone, Default)]
pub struct OrdinalConfig {
    pub limit_day_ordinals_to_day_1: bool,
    pub ordinals: Vec<OrdinalRule>,
}

#[derive(Debug, Clone)]
pub struct OrdinalRule {
    pub value: String,
    pub match_: OrdinalMatch,
    pub gender: Option<String>,
    pub gender_form: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub enum OrdinalMatch {
    #[default]
    LastDigit,
    LastTwoDigits,
    WholeNumber,
}

#[derive(Debug, Clone, Default)]
pub struct LocaleStyleOptions {
    pub punctuation_in_quote: Option<bool>,
    pub limit_day_ordinals_to_day_1: Option<bool>,
}

impl Locale {
    pub fn from_xml(xml: &str) -> Result<Self> {
        let mut reader = Reader::from_str(xml);
        reader.config_mut().trim_text(true);

        let mut locale = Locale::default();
        let mut buf = Vec::new();
        let mut context_stack: Vec<String> = Vec::new();
        let mut current_term_name: Option<String> = None;
        let mut current_term_form = TermForm::Long;
        let mut current_term_gender: Option<String> = None;
        let mut current_term_gender_form: Option<String> = None;
        let mut current_single: Option<String> = None;
        let mut current_multiple: Option<String> = None;
        let mut current_text = String::new();
        let mut text_target: Option<String> = None;

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    let attrs = parse_locale_attributes(e)?;

                    match tag.as_str() {
                        "locale" => {
                            locale.lang = attrs
                                .get("xml:lang")
                                .or_else(|| attrs.get("lang"))
                                .cloned()
                                .unwrap_or_else(|| "en-US".to_string());
                        }
                        "terms" => {
                            context_stack.push("terms".to_string());
                        }
                        "term" => {
                            current_term_name = attrs.get("name").cloned();
                            current_term_form = attrs
                                .get("form")
                                .and_then(|v| match v.as_str() {
                                    "short" => Some(TermForm::Short),
                                    "symbol" => Some(TermForm::Symbol),
                                    "verb" => Some(TermForm::Verb),
                                    "verb-short" => Some(TermForm::VerbShort),
                                    "long" => Some(TermForm::Long),
                                    _ => None,
                                })
                                .unwrap_or(TermForm::Long);
                            current_term_gender = attrs.get("gender").cloned();
                            current_term_gender_form = attrs.get("gender-form").cloned();
                            current_single = None;
                            current_multiple = None;
                            context_stack.push("term".to_string());
                        }
                        "single" => {
                            text_target = Some("single".to_string());
                        }
                        "multiple" => {
                            text_target = Some("multiple".to_string());
                        }
                        "date" => {
                            context_stack.push("date".to_string());
                            // Store the form for the date element
                            let _form = attrs.get("form").cloned();
                        }
                        "style-options" => {
                            locale.style_options.punctuation_in_quote = attrs
                                .get("punctuation-in-quote")
                                .map(|v| v == "true");
                            locale.style_options.limit_day_ordinals_to_day_1 = attrs
                                .get("limit-day-ordinals-to-day-1")
                                .map(|v| v == "true");
                        }
                        _ => {
                            context_stack.push(tag);
                        }
                    }
                }
                Ok(Event::Empty(ref e)) => {
                    let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    let attrs = parse_locale_attributes(e)?;

                    match tag.as_str() {
                        "term" => {
                            if let Some(name) = attrs.get("name") {
                                let form = attrs
                                    .get("form")
                                    .and_then(|v| match v.as_str() {
                                        "short" => Some(TermForm::Short),
                                        "symbol" => Some(TermForm::Symbol),
                                        "verb" => Some(TermForm::Verb),
                                        "verb-short" => Some(TermForm::VerbShort),
                                        "long" => Some(TermForm::Long),
                                        _ => None,
                                    })
                                    .unwrap_or(TermForm::Long);
                                let entry = TermEntry {
                                    value: attrs.get("value").cloned().unwrap_or_default(),
                                    plural: None,
                                    form,
                                    gender: attrs.get("gender").cloned(),
                                    gender_form: attrs.get("gender-form").cloned(),
                                };
                                locale
                                    .terms
                                    .entry(name.clone())
                                    .or_default()
                                    .push(entry);
                            }
                        }
                        "style-options" => {
                            locale.style_options.punctuation_in_quote = attrs
                                .get("punctuation-in-quote")
                                .map(|v| v == "true");
                            locale.style_options.limit_day_ordinals_to_day_1 = attrs
                                .get("limit-day-ordinals-to-day-1")
                                .map(|v| v == "true");
                        }
                        _ => {}
                    }
                }
                Ok(Event::Text(ref e)) => {
                    current_text = e.unescape().unwrap_or_default().to_string();
                    if let Some(ref target) = text_target {
                        match target.as_str() {
                            "single" => current_single = Some(current_text.clone()),
                            "multiple" => current_multiple = Some(current_text.clone()),
                            _ => {}
                        }
                        text_target = None;
                    }
                }
                Ok(Event::End(ref e)) => {
                    let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    match tag.as_str() {
                        "term" => {
                            if let Some(ref name) = current_term_name {
                                let value = current_single
                                    .take()
                                    .unwrap_or_else(|| current_text.clone());
                                let entry = TermEntry {
                                    value,
                                    plural: current_multiple.take(),
                                    form: current_term_form.clone(),
                                    gender: current_term_gender.take(),
                                    gender_form: current_term_gender_form.take(),
                                };
                                locale
                                    .terms
                                    .entry(name.clone())
                                    .or_default()
                                    .push(entry);
                            }
                            current_term_name = None;
                            context_stack.pop();
                        }
                        "terms" | "date" => {
                            context_stack.pop();
                        }
                        _ => {
                            context_stack.pop();
                        }
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(IbidError::CslParse(format!("Locale XML error: {}", e))),
                _ => {}
            }
            buf.clear();
        }

        Ok(locale)
    }

    /// Look up a term by name and form, returning the singular value
    pub fn get_term(&self, name: &str, form: &TermForm) -> Option<&str> {
        self.terms.get(name).and_then(|entries| {
            entries
                .iter()
                .find(|e| e.form == *form)
                .or_else(|| entries.iter().find(|e| e.form == TermForm::Long))
                .map(|e| e.value.as_str())
        })
    }

    /// Look up a term, returning plural form if plural is true
    pub fn get_term_plural(&self, name: &str, form: &TermForm, plural: bool) -> Option<&str> {
        self.terms.get(name).and_then(|entries| {
            let entry = entries
                .iter()
                .find(|e| e.form == *form)
                .or_else(|| entries.iter().find(|e| e.form == TermForm::Long));
            entry.and_then(|e| {
                if plural {
                    e.plural.as_deref().or(Some(e.value.as_str()))
                } else {
                    Some(e.value.as_str())
                }
            })
        })
    }

    /// Get ordinal suffix for a number
    pub fn get_ordinal(&self, _number: i32) -> &str {
        // Simplified — full implementation would check ordinal rules
        "th"
    }

    /// Get a month name by number (1-12)
    pub fn get_month(&self, month: i32, form: &TermForm) -> Option<&str> {
        let name = format!(
            "month-{:02}",
            month.clamp(1, 12)
        );
        self.get_term(&name, form)
    }
}

// =============================================================================
// Built-in English locale (fallback)
// =============================================================================

impl Locale {
    pub fn english() -> Self {
        let mut locale = Locale {
            lang: "en-US".to_string(),
            ..Default::default()
        };

        let terms: &[(&str, &str, Option<&str>)] = &[
            ("and", "and", None),
            ("et-al", "et al.", None),
            ("in", "in", None),
            ("retrieved", "retrieved", None),
            ("from", "from", None),
            ("accessed", "accessed", None),
            ("available at", "available at", None),
            ("no date", "n.d.", None),
            ("edition", "edition", Some("editions")),
            ("volume", "volume", Some("volumes")),
            ("issue", "issue", Some("issues")),
            ("page", "page", Some("pages")),
            ("chapter", "chapter", Some("chapters")),
            ("section", "section", Some("sections")),
            ("paragraph", "paragraph", Some("paragraphs")),
            ("part", "part", Some("parts")),
            ("editor", "editor", Some("editors")),
            ("translator", "translator", Some("translators")),
            ("month-01", "January", None),
            ("month-02", "February", None),
            ("month-03", "March", None),
            ("month-04", "April", None),
            ("month-05", "May", None),
            ("month-06", "June", None),
            ("month-07", "July", None),
            ("month-08", "August", None),
            ("month-09", "September", None),
            ("month-10", "October", None),
            ("month-11", "November", None),
            ("month-12", "December", None),
        ];

        for (name, single, plural) in terms {
            locale.terms.entry(name.to_string()).or_default().push(TermEntry {
                value: single.to_string(),
                plural: plural.map(|p| p.to_string()),
                form: TermForm::Long,
                gender: None,
                gender_form: None,
            });
        }

        // Short forms for months
        let short_months: &[(&str, &str)] = &[
            ("month-01", "Jan."),
            ("month-02", "Feb."),
            ("month-03", "Mar."),
            ("month-04", "Apr."),
            ("month-05", "May"),
            ("month-06", "Jun."),
            ("month-07", "Jul."),
            ("month-08", "Aug."),
            ("month-09", "Sep."),
            ("month-10", "Oct."),
            ("month-11", "Nov."),
            ("month-12", "Dec."),
        ];

        for (name, short) in short_months {
            locale.terms.entry(name.to_string()).or_default().push(TermEntry {
                value: short.to_string(),
                plural: None,
                form: TermForm::Short,
                gender: None,
                gender_form: None,
            });
        }

        // Short forms for roles
        let short_roles: &[(&str, &str, Option<&str>)] = &[
            ("editor", "ed.", Some("eds.")),
            ("translator", "trans.", Some("trans.")),
            ("edition", "ed.", Some("eds.")),
            ("volume", "vol.", Some("vols.")),
            ("page", "p.", Some("pp.")),
            ("chapter", "chap.", Some("chaps.")),
            ("section", "sec.", Some("secs.")),
            ("paragraph", "para.", Some("paras.")),
        ];

        for (name, single, plural) in short_roles {
            locale.terms.entry(name.to_string()).or_default().push(TermEntry {
                value: single.to_string(),
                plural: plural.map(|p| p.to_string()),
                form: TermForm::Short,
                gender: None,
                gender_form: None,
            });
        }

        locale
    }
}

fn parse_locale_attributes(
    e: &quick_xml::events::BytesStart,
) -> Result<HashMap<String, String>> {
    let mut map = HashMap::new();
    for attr in e.attributes() {
        let attr = attr.map_err(|e| IbidError::CslParse(format!("Attribute error: {}", e)))?;
        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
        let val = attr.unescape_value().unwrap_or_default().to_string();
        map.insert(key, val);
    }
    Ok(map)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_english_locale_months() {
        let locale = Locale::english();
        assert_eq!(locale.get_month(1, &TermForm::Long), Some("January"));
        assert_eq!(locale.get_month(1, &TermForm::Short), Some("Jan."));
        assert_eq!(locale.get_month(12, &TermForm::Long), Some("December"));
    }

    #[test]
    fn test_english_locale_terms() {
        let locale = Locale::english();
        assert_eq!(locale.get_term("and", &TermForm::Long), Some("and"));
        assert_eq!(locale.get_term("et-al", &TermForm::Long), Some("et al."));
        assert_eq!(
            locale.get_term_plural("page", &TermForm::Short, true),
            Some("pp.")
        );
        assert_eq!(
            locale.get_term_plural("page", &TermForm::Short, false),
            Some("p.")
        );
    }

    #[test]
    fn test_parse_locale_xml() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<locale xml:lang="en-US" xmlns="http://purl.org/net/xbiblio/csl">
  <terms>
    <term name="and">and</term>
    <term name="editor">
      <single>editor</single>
      <multiple>editors</multiple>
    </term>
  </terms>
</locale>"#;

        let locale = Locale::from_xml(xml).unwrap();
        assert_eq!(locale.lang, "en-US");
        assert_eq!(locale.get_term("and", &TermForm::Long), Some("and"));
    }
}
