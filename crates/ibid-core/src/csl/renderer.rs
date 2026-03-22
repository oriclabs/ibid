use crate::csl::locale::{Locale, TermForm};
use crate::csl::style::*;
use crate::error::{IbidError, Result};
use crate::types::{CslItem, DateVariable, Name};

// =============================================================================
// Output format
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OutputFormat {
    PlainText,
    Html,
}

// =============================================================================
// Renderer — takes Style + Locale + Items → formatted output
// =============================================================================

pub struct Renderer {
    style: Style,
    locale: Locale,
    format: OutputFormat,
    /// Context-specific et-al overrides (from <bibliography> or <citation> elements)
    ctx_et_al_min: Option<u32>,
    ctx_et_al_use_first: Option<u32>,
    ctx_et_al_use_last: bool,
}

impl Renderer {
    pub fn new(style: Style, locale: Locale, format: OutputFormat) -> Self {
        Self {
            style,
            locale,
            format,
            ctx_et_al_min: None,
            ctx_et_al_use_first: None,
            ctx_et_al_use_last: false,
        }
    }

    pub fn set_format(&mut self, format: OutputFormat) {
        self.format = format;
    }

    /// Render a single bibliography entry
    pub fn render_bibliography_entry(&mut self, item: &CslItem) -> Result<String> {
        let bib = self
            .style
            .bibliography
            .as_ref()
            .ok_or_else(|| IbidError::CslRender("No bibliography element in style".into()))?;

        // Set context et-al from <bibliography> element
        self.ctx_et_al_min = bib.et_al_min;
        self.ctx_et_al_use_first = bib.et_al_use_first;
        self.ctx_et_al_use_last = bib.et_al_use_last;

        let mut parts: Vec<String> = Vec::new();
        for element in &bib.layout.elements {
            let rendered = self.render_element(element, item)?;
            if !rendered.is_empty() {
                parts.push(rendered);
            }
        }

        let mut result = join_with_punct_dedup(&parts, bib.layout.delimiter.as_deref().unwrap_or(""));

        // Apply layout prefix/suffix
        if let Some(ref prefix) = bib.layout.prefix {
            result = format!("{}{}", prefix, result);
        }
        if let Some(ref suffix) = bib.layout.suffix {
            result = format!("{}{}", result, suffix);
        }

        // Apply layout formatting
        result = self.apply_formatting(&result, &bib.layout.formatting);

        Ok(result)
    }

    /// Render a full bibliography (sorted, formatted)
    pub fn render_bibliography(&mut self, items: &[CslItem]) -> Result<Vec<String>> {
        let mut entries: Vec<String> = Vec::new();
        // TODO: implement sorting based on style.bibliography.sort
        for item in items {
            entries.push(self.render_bibliography_entry(item)?);
        }
        Ok(entries)
    }

    /// Render an in-text citation (parenthetical)
    pub fn render_citation(&mut self, items: &[&CslItem]) -> Result<String> {
        let cit = self
            .style
            .citation
            .as_ref()
            .ok_or_else(|| IbidError::CslRender("No citation element in style".into()))?;

        // Set context et-al from <citation> element
        self.ctx_et_al_min = cit.et_al_min;
        self.ctx_et_al_use_first = cit.et_al_use_first;
        self.ctx_et_al_use_last = cit.et_al_use_last;

        let mut cite_parts: Vec<String> = Vec::new();
        for item in items {
            let mut parts: Vec<String> = Vec::new();
            for element in &cit.layout.elements {
                let rendered = self.render_element(element, item)?;
                if !rendered.is_empty() {
                    parts.push(rendered);
                }
            }
            cite_parts.push(parts.join(cit.layout.delimiter.as_deref().unwrap_or("")));
        }

        let delimiter = cit.layout.delimiter.as_deref().unwrap_or("; ");
        let mut result = cite_parts.join(delimiter);

        if let Some(ref prefix) = cit.layout.prefix {
            result = format!("{}{}", prefix, result);
        }
        if let Some(ref suffix) = cit.layout.suffix {
            result = format!("{}{}", result, suffix);
        }

        result = self.apply_formatting(&result, &cit.layout.formatting);

        Ok(result)
    }

    // =========================================================================
    // Element rendering dispatch
    // =========================================================================

    fn render_element(&self, element: &Element, item: &CslItem) -> Result<String> {
        match element {
            Element::Text(te) => self.render_text(te, item),
            Element::Number(ne) => self.render_number(ne, item),
            Element::Names(ne) => self.render_names(ne, item),
            Element::Date(de) => self.render_date(de, item),
            Element::Label(le) => self.render_label(le, item),
            Element::Group(ge) => self.render_group(ge, item),
            Element::Choose(ce) => self.render_choose(ce, item),
        }
    }

    // =========================================================================
    // cs:text
    // =========================================================================

    fn render_text(&self, te: &TextElement, item: &CslItem) -> Result<String> {
        let value = match &te.source {
            TextSource::Variable(var) => self.get_variable(var, item).unwrap_or_default(),
            TextSource::Macro(name) => self.render_macro(name, item)?,
            TextSource::Term(name) => self
                .locale
                .get_term(name, &TermForm::Long)
                .unwrap_or("")
                .to_string(),
            TextSource::ValueStr(val) => val.clone(),
            TextSource::Value => String::new(),
        };

        if value.is_empty() {
            return Ok(String::new());
        }

        let mut result = value;

        // Apply text-case
        if let Some(ref tc) = te.text_case {
            result = self.apply_text_case(&result, tc);
        }

        // Strip periods
        if te.strip_periods {
            result = result.replace('.', "");
        }

        // Quotes
        if te.quotes {
            result = format!("\u{201c}{}\u{201d}", result);
        }

        // Formatting
        result = self.apply_formatting(&result, &te.formatting);

        // Prefix/suffix
        result = self.apply_affixes(&result, &te.prefix, &te.suffix);

        Ok(result)
    }

    // =========================================================================
    // cs:number
    // =========================================================================

    fn render_number(&self, ne: &NumberElement, item: &CslItem) -> Result<String> {
        let value = self.get_number_variable(&ne.variable, item);
        let value = match value {
            Some(v) => v,
            None => return Ok(String::new()),
        };

        let result = match ne.form.as_ref().unwrap_or(&NumberForm::Numeric) {
            NumberForm::Numeric => value,
            NumberForm::Ordinal => {
                if let Ok(n) = value.parse::<i32>() {
                    let suffix = self.locale.get_ordinal(n);
                    format!("{}{}", n, suffix)
                } else {
                    value
                }
            }
            NumberForm::LongOrdinal => value, // TODO: implement long ordinals
            NumberForm::Roman => {
                if let Ok(n) = value.parse::<i32>() {
                    to_roman(n)
                } else {
                    value
                }
            }
        };

        let mut result = result;
        if let Some(ref tc) = ne.text_case {
            result = self.apply_text_case(&result, tc);
        }
        result = self.apply_formatting(&result, &ne.formatting);
        result = self.apply_affixes(&result, &ne.prefix, &ne.suffix);

        Ok(result)
    }

    // =========================================================================
    // cs:names
    // =========================================================================

    fn render_names(&self, ne: &NamesElement, item: &CslItem) -> Result<String> {
        // Try each variable until we find one with names
        for var in &ne.variables {
            let names = self.get_name_variable(var, item);
            if let Some(names) = names {
                if !names.is_empty() {
                    let rendered = self.format_name_list(&names, ne)?;
                    if !rendered.is_empty() {
                        let mut result = rendered;
                        result = self.apply_formatting(&result, &ne.formatting);
                        result = self.apply_affixes(&result, &ne.prefix, &ne.suffix);
                        return Ok(result);
                    }
                }
            }
        }

        // Try substitute if no names found
        if let Some(ref substitute) = ne.substitute {
            for elem in substitute {
                let rendered = self.render_element(elem, item)?;
                if !rendered.is_empty() {
                    return Ok(rendered);
                }
            }
        }

        Ok(String::new())
    }

    fn format_name_list(&self, names: &[Name], ne: &NamesElement) -> Result<String> {
        let config = ne.name.as_ref();

        // Et-al cascade: per-<names> config > context (bib/citation) > global
        let et_al_min = config
            .and_then(|c| c.et_al_min)
            .or(self.ctx_et_al_min)
            .or(self.style.global_options.et_al_min);
        let et_al_use_first = config
            .and_then(|c| c.et_al_use_first)
            .or(self.ctx_et_al_use_first)
            .or(self.style.global_options.et_al_use_first);
        let et_al_use_last = config
            .and_then(|c| c.et_al_use_last)
            .unwrap_or(self.ctx_et_al_use_last || self.style.global_options.et_al_use_last);

        let use_et_al = et_al_min.is_some_and(|min| names.len() as u32 >= min);
        let display_count = if use_et_al {
            et_al_use_first.unwrap_or(1) as usize
        } else {
            names.len()
        };

        let initialize = config.and_then(|c| c.initialize).unwrap_or(true);
        let initialize_with = config
            .and_then(|c| c.initialize_with.as_deref())
            .or(self.style.global_options.initialize_with.as_deref());
        let name_as_sort_order = config
            .and_then(|c| c.name_as_sort_order.as_ref())
            .or(self.style.global_options.name_as_sort_order.as_ref());
        let sort_separator = config
            .and_then(|c| c.sort_separator.as_deref())
            .unwrap_or(", ");

        let and_term = config
            .and_then(|c| c.and.as_ref())
            .or(self.style.global_options.and.as_ref())
            .map(|a| match a {
                NameAnd::Text => self
                    .locale
                    .get_term("and", &TermForm::Long)
                    .unwrap_or("and"),
                NameAnd::Symbol => "&",
            });

        let delimiter = config
            .and_then(|c| c.delimiter.as_deref())
            .unwrap_or(", ");

        let mut formatted_names: Vec<String> = Vec::new();

        for (i, name) in names.iter().take(display_count).enumerate() {
            let formatted = if let Some(ref literal) = name.literal {
                literal.clone()
            } else {
                let family = name.family.as_deref().unwrap_or("");
                let given = name.given.as_deref().unwrap_or("");
                let particle = name.non_dropping_particle.as_deref().unwrap_or("");
                let suffix = name.suffix.as_deref().unwrap_or("");

                let given_formatted = if initialize && initialize_with.is_some() {
                    let init_with = initialize_with.unwrap();
                    initialize_given(given, init_with)
                } else {
                    given.to_string()
                };

                let use_sort_order = match name_as_sort_order {
                    Some(NameAsSortOrder::All) => true,
                    Some(NameAsSortOrder::First) => i == 0,
                    None => false,
                };

                if use_sort_order {
                    // Last, First
                    let mut parts = Vec::new();
                    let family_with_particle = if particle.is_empty() {
                        family.to_string()
                    } else {
                        format!("{} {}", particle, family)
                    };
                    parts.push(family_with_particle);

                    if !given_formatted.is_empty() {
                        parts.push(given_formatted);
                    }
                    if !suffix.is_empty() {
                        parts.push(suffix.to_string());
                    }
                    parts.join(sort_separator)
                } else {
                    // First Last
                    let mut parts = Vec::new();
                    if !given_formatted.is_empty() {
                        parts.push(given_formatted);
                    }
                    if !particle.is_empty() {
                        parts.push(particle.to_string());
                    }
                    parts.push(family.to_string());
                    if !suffix.is_empty() {
                        parts.push(suffix.to_string());
                    }
                    parts.join(" ")
                }
            };

            formatted_names.push(formatted);
        }

        // Join names with delimiter and "and"
        let result = if formatted_names.len() == 1 {
            formatted_names[0].clone()
        } else if formatted_names.len() == 2 && !use_et_al {
            match and_term {
                Some(and) => format!("{} {} {}", formatted_names[0], and, formatted_names[1]),
                None => formatted_names.join(delimiter),
            }
        } else {
            let last_idx = formatted_names.len() - 1;
            let mut result = String::new();
            for (i, name) in formatted_names.iter().enumerate() {
                if i > 0 {
                    result.push_str(delimiter);
                }
                if i == last_idx && !use_et_al {
                    if let Some(and) = and_term {
                        // Remove trailing delimiter and add "and"
                        result = result.trim_end_matches(delimiter).to_string();
                        result.push_str(delimiter);
                        result.push_str(and);
                        result.push(' ');
                    }
                }
                result.push_str(name);
            }
            result
        };

        // Append et al. if needed
        let result = if use_et_al {
            let et_al_term = self
                .locale
                .get_term("et-al", &TermForm::Long)
                .unwrap_or("et al.");
            if et_al_use_last && names.len() > display_count + 1 {
                // Use "... LastAuthor" format
                let last = &names[names.len() - 1];
                let last_formatted = last
                    .literal
                    .clone()
                    .unwrap_or_else(|| {
                        format!(
                            "{} {}",
                            last.given.as_deref().unwrap_or(""),
                            last.family.as_deref().unwrap_or("")
                        )
                    });
                format!("{}{}\u{2026} {}", result, delimiter, last_formatted)
            } else {
                format!("{}, {}", result, et_al_term)
            }
        } else {
            result
        };

        Ok(result)
    }

    // =========================================================================
    // cs:date
    // =========================================================================

    fn render_date(&self, de: &DateElement, item: &CslItem) -> Result<String> {
        let date = self.get_date_variable(&de.variable, item);
        let date = match date {
            Some(d) => d,
            None => return Ok(String::new()),
        };

        // If date has a literal value, use it directly
        if let Some(ref literal) = date.literal {
            let mut result = literal.clone();
            result = self.apply_formatting(&result, &de.formatting);
            result = self.apply_affixes(&result, &de.prefix, &de.suffix);
            return Ok(result);
        }

        let date_parts = match &date.date_parts {
            Some(parts) if !parts.is_empty() => &parts[0],
            _ => return Ok(String::new()),
        };

        let year = date_parts.first().copied();
        let month = date_parts.get(1).copied();
        let day = date_parts.get(2).copied();

        // If the date element has child date-part elements, use them
        if !de.parts.is_empty() {
            let mut parts_rendered: Vec<String> = Vec::new();
            for part in &de.parts {
                let rendered = match &part.name {
                    DatePartName::Year => {
                        year.map(|y| format!("{}", y)).unwrap_or_default()
                    }
                    DatePartName::Month => {
                        month.map(|m| {
                            let form = part.form.as_deref().unwrap_or("long");
                            match form {
                                "numeric" => format!("{}", m),
                                "numeric-leading-zeros" => format!("{:02}", m),
                                "short" => self
                                    .locale
                                    .get_month(m, &TermForm::Short)
                                    .unwrap_or("")
                                    .to_string(),
                                _ => self
                                    .locale
                                    .get_month(m, &TermForm::Long)
                                    .unwrap_or("")
                                    .to_string(),
                            }
                        }).unwrap_or_default()
                    }
                    DatePartName::Day => {
                        day.map(|d| {
                            let form = part.form.as_deref().unwrap_or("numeric");
                            match form {
                                "numeric-leading-zeros" => format!("{:02}", d),
                                "ordinal" => {
                                    let suffix = self.locale.get_ordinal(d);
                                    format!("{}{}", d, suffix)
                                }
                                _ => format!("{}", d),
                            }
                        }).unwrap_or_default()
                    }
                };

                if !rendered.is_empty() {
                    let mut r = rendered;
                    r = self.apply_formatting(&r, &part.formatting);
                    r = self.apply_affixes(&r, &part.prefix, &part.suffix);
                    parts_rendered.push(r);
                }
            }

            let delimiter = de.delimiter.as_deref().unwrap_or("");
            let mut result = parts_rendered.join(delimiter);
            result = self.apply_formatting(&result, &de.formatting);
            result = self.apply_affixes(&result, &de.prefix, &de.suffix);
            return Ok(result);
        }

        // Default: use form attribute to determine format
        let result = match de.form {
            Some(DateForm::NumericDate) => {
                let mut parts = Vec::new();
                if let Some(y) = year {
                    parts.push(format!("{}", y));
                }
                if let Some(m) = month {
                    parts.push(format!("{:02}", m));
                }
                if let Some(d) = day {
                    parts.push(format!("{:02}", d));
                }
                parts.join("-")
            }
            Some(DateForm::TextDate) | None => {
                let mut parts = Vec::new();
                if let Some(m) = month {
                    if let Some(name) = self.locale.get_month(m, &TermForm::Long) {
                        parts.push(name.to_string());
                    }
                }
                if let Some(d) = day {
                    parts.push(format!("{}", d));
                }
                if let Some(y) = year {
                    parts.push(format!("{}", y));
                }
                parts.join(" ")
            }
        };

        if result.is_empty() {
            return Ok(String::new());
        }

        let mut result = result;
        result = self.apply_formatting(&result, &de.formatting);
        result = self.apply_affixes(&result, &de.prefix, &de.suffix);

        Ok(result)
    }

    // =========================================================================
    // cs:label
    // =========================================================================

    fn render_label(&self, le: &LabelElement, item: &CslItem) -> Result<String> {
        let form = match &le.form {
            Some(LabelForm::Short) => TermForm::Short,
            Some(LabelForm::Symbol) => TermForm::Symbol,
            Some(LabelForm::Verb) => TermForm::Verb,
            Some(LabelForm::VerbShort) => TermForm::VerbShort,
            _ => TermForm::Long,
        };

        let is_plural = match &le.plural {
            Some(LabelPlural::Always) => true,
            Some(LabelPlural::Never) => false,
            _ => {
                // Contextual: check if variable value is plural
                self.is_variable_plural(&le.variable, item)
            }
        };

        let term_name = &le.variable;
        let value = self
            .locale
            .get_term_plural(term_name, &form, is_plural)
            .unwrap_or("");

        if value.is_empty() {
            return Ok(String::new());
        }

        let mut result = value.to_string();

        if le.strip_periods {
            result = result.replace('.', "");
        }

        if let Some(ref tc) = le.text_case {
            result = self.apply_text_case(&result, tc);
        }

        result = self.apply_formatting(&result, &le.formatting);
        result = self.apply_affixes(&result, &le.prefix, &le.suffix);

        Ok(result)
    }

    // =========================================================================
    // cs:group
    // =========================================================================

    fn render_group(&self, ge: &GroupElement, item: &CslItem) -> Result<String> {
        let mut parts: Vec<String> = Vec::new();

        for element in &ge.elements {
            let rendered = self.render_element(element, item)?;
            if !rendered.is_empty() {
                parts.push(rendered);
            }
        }

        // CSL spec: group is suppressed if all child variables are empty
        if parts.is_empty() {
            return Ok(String::new());
        }

        let delimiter = ge.delimiter.as_deref().unwrap_or("");
        let mut result = join_with_punct_dedup(&parts, delimiter);
        result = self.apply_formatting(&result, &ge.formatting);
        result = self.apply_affixes(&result, &ge.prefix, &ge.suffix);

        Ok(result)
    }

    // =========================================================================
    // cs:choose
    // =========================================================================

    fn render_choose(&self, ce: &ChooseElement, item: &CslItem) -> Result<String> {
        // Check if
        if self.evaluate_condition(&ce.if_, item) {
            return self.render_element_list(&ce.if_.elements, item);
        }

        // Check else-if
        for elif in &ce.else_if {
            if self.evaluate_condition(elif, item) {
                return self.render_element_list(&elif.elements, item);
            }
        }

        // Else
        if let Some(ref elements) = ce.else_ {
            return self.render_element_list(elements, item);
        }

        Ok(String::new())
    }

    fn evaluate_condition(&self, cond: &Condition, item: &CslItem) -> bool {
        let results: Vec<bool> = cond
            .tests
            .iter()
            .map(|test| self.evaluate_test(test, item))
            .collect();

        match cond.match_ {
            ConditionMatch::All => results.iter().all(|&r| r),
            ConditionMatch::Any => results.iter().any(|&r| r),
            ConditionMatch::None => results.iter().all(|&r| !r),
        }
    }

    fn evaluate_test(&self, test: &ConditionTest, item: &CslItem) -> bool {
        match test {
            ConditionTest::Type(types) => types.iter().any(|t| {
                let item_type_str = serde_json::to_string(&item.item_type)
                    .unwrap_or_default()
                    .trim_matches('"')
                    .to_string();
                *t == item_type_str
            }),
            ConditionTest::Variable(vars) => vars.iter().any(|v| {
                // Check string variables
                if let Some(val) = self.get_variable(v, item) {
                    return !val.is_empty();
                }
                // Check date variables
                if self.get_date_variable(v, item).is_some() {
                    return true;
                }
                // Check name variables
                if self.get_name_variable(v, item).map(|n| !n.is_empty()).unwrap_or(false) {
                    return true;
                }
                false
            }),
            ConditionTest::IsNumeric(vars) => vars.iter().any(|v| {
                self.get_variable(v, item)
                    .map(|val| val.chars().all(|c| c.is_ascii_digit() || c == '-' || c == ','))
                    .unwrap_or(false)
            }),
            ConditionTest::IsUncertainDate(vars) => vars.iter().any(|v| {
                self.get_date_variable(v, item)
                    .and_then(|d| d.circa)
                    .unwrap_or(false)
            }),
            ConditionTest::Locator(_) => false, // TODO: implement locator position
            ConditionTest::Position(_) => false, // TODO: implement position tracking
        }
    }

    // =========================================================================
    // Macro rendering
    // =========================================================================

    fn render_macro(&self, name: &str, item: &CslItem) -> Result<String> {
        let mac = self
            .style
            .macros
            .get(name)
            .ok_or_else(|| IbidError::CslRender(format!("Unknown macro: {}", name)))?;

        self.render_element_list(&mac.elements, item)
    }

    fn render_element_list(&self, elements: &[Element], item: &CslItem) -> Result<String> {
        let mut parts: Vec<String> = Vec::new();
        for element in elements {
            let rendered = self.render_element(element, item)?;
            if !rendered.is_empty() {
                parts.push(rendered);
            }
        }
        Ok(parts.join(""))
    }

    // =========================================================================
    // Variable access
    // =========================================================================

    fn get_variable(&self, name: &str, item: &CslItem) -> Option<String> {
        match name {
            "title" => item.title.clone(),
            "title-short" => item.title_short.clone(),
            "container-title" => item.container_title.clone(),
            "container-title-short" => item.container_title_short.clone(),
            "collection-title" => item.collection_title.clone(),
            "volume-title" => item.volume_title.clone(),
            "publisher" => item.publisher.clone(),
            "publisher-place" => item.publisher_place.clone(),
            "page" => item.page.clone(),
            "page-first" => item.page_first.clone(),
            "abstract" => item.abstract_.clone(),
            "annote" => item.annote.clone(),
            "archive" => item.archive.clone(),
            "archive-location" => item.archive_location.clone(),
            "authority" => item.authority.clone(),
            "call-number" => item.call_number.clone(),
            "citation-key" => item.citation_key.clone(),
            "citation-label" => item.citation_label.clone(),
            "dimensions" => item.dimensions.clone(),
            "division" => item.division.clone(),
            "DOI" => item.doi.clone(),
            "event-title" => item.event_title.clone(),
            "event-place" => item.event_place.clone(),
            "genre" => item.genre.clone(),
            "ISBN" => item.isbn.clone(),
            "ISSN" => item.issn.clone(),
            "jurisdiction" => item.jurisdiction.clone(),
            "keyword" => item.keyword.clone(),
            "language" => item.language.clone(),
            "license" => item.license.clone(),
            "medium" => item.medium.clone(),
            "note" => item.note.clone(),
            "original-publisher" => item.original_publisher.clone(),
            "original-publisher-place" => item.original_publisher_place.clone(),
            "original-title" => item.original_title.clone(),
            "PMCID" => item.pmcid.clone(),
            "PMID" => item.pmid.clone(),
            "references" => item.references.clone(),
            "reviewed-title" => item.reviewed_title.clone(),
            "scale" => item.scale.clone(),
            "section" => item.section.clone(),
            "source" => item.source.clone(),
            "status" => item.status.clone(),
            "URL" => item.url.clone(),
            "version" => item.version.clone(),
            "year-suffix" => item.year_suffix.clone(),
            // Number variables as strings
            "volume" => item.volume.as_ref().map(|v| v.to_string()),
            "issue" => item.issue.as_ref().map(|v| v.to_string()),
            "edition" => item.edition.as_ref().map(|v| v.to_string()),
            "number" => item.number.as_ref().map(|v| v.to_string()),
            "number-of-pages" => item.number_of_pages.as_ref().map(|v| v.to_string()),
            "number-of-volumes" => item.number_of_volumes.as_ref().map(|v| v.to_string()),
            "chapter-number" => item.chapter_number.as_ref().map(|v| v.to_string()),
            "collection-number" => item.collection_number.as_ref().map(|v| v.to_string()),
            _ => None,
        }
    }

    fn get_number_variable(&self, name: &str, item: &CslItem) -> Option<String> {
        self.get_variable(name, item)
    }

    fn get_name_variable<'a>(&self, name: &str, item: &'a CslItem) -> Option<&'a Vec<Name>> {
        match name {
            "author" => item.author.as_ref(),
            "editor" => item.editor.as_ref(),
            "translator" => item.translator.as_ref(),
            "reviewer" => item.reviewer.as_ref(),
            "collection-editor" => item.collection_editor.as_ref(),
            "composer" => item.composer.as_ref(),
            "container-author" => item.container_author.as_ref(),
            "director" => item.director.as_ref(),
            "editorial-director" => item.editorial_director.as_ref(),
            "illustrator" => item.illustrator.as_ref(),
            "interviewer" => item.interviewer.as_ref(),
            "original-author" => item.original_author.as_ref(),
            "recipient" => item.recipient.as_ref(),
            _ => None,
        }
    }

    fn get_date_variable<'a>(&self, name: &str, item: &'a CslItem) -> Option<&'a DateVariable> {
        match name {
            "issued" => item.issued.as_ref(),
            "accessed" => item.accessed.as_ref(),
            "event-date" => item.event_date.as_ref(),
            "original-date" => item.original_date.as_ref(),
            "submitted" => item.submitted.as_ref(),
            _ => None,
        }
    }

    fn is_variable_plural(&self, name: &str, item: &CslItem) -> bool {
        match name {
            "page" => item
                .page
                .as_ref()
                .map(|p| p.contains('-') || p.contains(',') || p.contains('&'))
                .unwrap_or(false),
            "number-of-pages" | "number-of-volumes" => {
                self.get_variable(name, item)
                    .and_then(|v| v.parse::<i32>().ok())
                    .map(|n| n > 1)
                    .unwrap_or(false)
            }
            "editor" => item.editor.as_ref().map(|e| e.len() > 1).unwrap_or(false),
            "translator" => item
                .translator
                .as_ref()
                .map(|t| t.len() > 1)
                .unwrap_or(false),
            _ => false,
        }
    }

    // =========================================================================
    // Formatting helpers
    // =========================================================================

    fn apply_formatting(&self, text: &str, fmt: &Formatting) -> String {
        if text.is_empty() {
            return String::new();
        }

        match self.format {
            OutputFormat::PlainText => text.to_string(),
            OutputFormat::Html => {
                let mut result = text.to_string();
                if let Some(FontStyle::Italic) = &fmt.font_style {
                    result = format!("<i>{}</i>", result);
                }
                if let Some(FontWeight::Bold) = &fmt.font_weight {
                    result = format!("<b>{}</b>", result);
                }
                if let Some(FontVariant::SmallCaps) = &fmt.font_variant {
                    result =
                        format!("<span style=\"font-variant:small-caps\">{}</span>", result);
                }
                if let Some(TextDecoration::Underline) = &fmt.text_decoration {
                    result = format!("<u>{}</u>", result);
                }
                if let Some(ref va) = fmt.vertical_align {
                    match va {
                        VerticalAlign::Sup => result = format!("<sup>{}</sup>", result),
                        VerticalAlign::Sub => result = format!("<sub>{}</sub>", result),
                        VerticalAlign::Baseline => {}
                    }
                }
                result
            }
        }
    }

    fn apply_affixes(&self, text: &str, prefix: &Option<String>, suffix: &Option<String>) -> String {
        if text.is_empty() {
            return String::new();
        }
        let mut result = String::new();
        if let Some(p) = prefix {
            result.push_str(p);
        }
        result.push_str(text);
        if let Some(s) = suffix {
            // CSL spec: avoid duplicate punctuation at the join point
            // e.g., text ends with "." and suffix starts with "." → skip duplicate
            if let (Some(last_char), Some(first_char)) = (result.chars().last(), s.chars().next()) {
                if last_char == first_char && ".,:;!?".contains(last_char) {
                    // Skip duplicate punctuation
                    result.push_str(&s[first_char.len_utf8()..]);
                } else {
                    result.push_str(s);
                }
            } else {
                result.push_str(s);
            }
        }
        result
    }

    fn apply_text_case(&self, text: &str, tc: &TextCase) -> String {
        match tc {
            TextCase::Lowercase => text.to_lowercase(),
            TextCase::Uppercase => text.to_uppercase(),
            TextCase::CapitalizeFirst => {
                let mut chars = text.chars();
                match chars.next() {
                    None => String::new(),
                    Some(c) => {
                        c.to_uppercase().to_string() + chars.as_str()
                    }
                }
            }
            TextCase::CapitalizeAll => text
                .split_whitespace()
                .map(|word| {
                    let mut chars = word.chars();
                    match chars.next() {
                        None => String::new(),
                        Some(c) => c.to_uppercase().to_string() + chars.as_str(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" "),
            TextCase::Sentence => {
                let lower = text.to_lowercase();
                let mut chars = lower.chars();
                match chars.next() {
                    None => String::new(),
                    Some(c) => c.to_uppercase().to_string() + chars.as_str(),
                }
            }
            TextCase::Title => title_case(text),
        }
    }
}

// =============================================================================
// Helper functions
// =============================================================================

/// Join strings with a delimiter, avoiding duplicate punctuation at boundaries.
/// e.g., joining ["Smith, J.", "Title"] with ". " → "Smith, J. Title" (not "Smith, J.. Title")
fn join_with_punct_dedup(parts: &[String], delimiter: &str) -> String {
    if parts.is_empty() {
        return String::new();
    }
    let mut result = parts[0].clone();
    let delim_first = delimiter.chars().next();

    for part in &parts[1..] {
        if let Some(dc) = delim_first {
            if let Some(last_char) = result.chars().last() {
                if last_char == dc && ".,:;!?".contains(dc) {
                    // Skip duplicate leading punctuation from delimiter
                    result.push_str(&delimiter[dc.len_utf8()..]);
                    result.push_str(part);
                    continue;
                }
            }
        }
        result.push_str(delimiter);
        result.push_str(part);
    }
    result
}

fn initialize_given(given: &str, init_with: &str) -> String {
    let period = init_with.trim_end(); // e.g., "." from ". "

    // Process each whitespace-separated word
    let mut word_results: Vec<String> = Vec::new();
    for word in given.split_whitespace() {
        if word.contains('-') {
            // Hyphenated name: "Jean-Pierre" → "J.-P."
            let hyph_parts: Vec<&str> = word.split('-').collect();
            let initialized: Vec<String> = hyph_parts.iter()
                .filter(|hp| !hp.is_empty())
                .map(|hp| {
                    let ch = hp.chars().next().unwrap().to_uppercase().to_string();
                    format!("{}{}", ch, period)
                })
                .collect();
            word_results.push(initialized.join("-"));
        } else {
            let ch = word.chars().next().unwrap().to_uppercase().to_string();
            word_results.push(format!("{}{}", ch, period));
        }
    }

    // Join words with space (the trailing space from init_with like ". ")
    word_results.join(" ")
}

fn to_roman(mut n: i32) -> String {
    if n <= 0 {
        return n.to_string();
    }
    let numerals = [
        (1000, "m"),
        (900, "cm"),
        (500, "d"),
        (400, "cd"),
        (100, "c"),
        (90, "xc"),
        (50, "l"),
        (40, "xl"),
        (10, "x"),
        (9, "ix"),
        (5, "v"),
        (4, "iv"),
        (1, "i"),
    ];
    let mut result = String::new();
    for &(value, numeral) in &numerals {
        while n >= value {
            result.push_str(numeral);
            n -= value;
        }
    }
    result
}

fn title_case(text: &str) -> String {
    let stop_words = [
        "a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "so",
        "the", "to", "up", "yet",
    ];

    text.split_whitespace()
        .enumerate()
        .map(|(i, word)| {
            if i == 0 || !stop_words.contains(&word.to_lowercase().as_str()) {
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(c) => c.to_uppercase().to_string() + chars.as_str(),
                }
            } else {
                word.to_lowercase()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;

    fn sample_item() -> CslItem {
        CslItem {
            id: "smith2023".to_string(),
            item_type: ItemType::ArticleJournal,
            title: Some("The impact of climate change on biodiversity".to_string()),
            author: Some(vec![
                Name {
                    family: Some("Smith".to_string()),
                    given: Some("John Andrew".to_string()),
                    ..Default::default()
                },
                Name {
                    family: Some("Doe".to_string()),
                    given: Some("Jane".to_string()),
                    ..Default::default()
                },
            ]),
            container_title: Some("Nature Climate Change".to_string()),
            issued: Some(DateVariable {
                date_parts: Some(vec![vec![2023, 5, 15]]),
                ..Default::default()
            }),
            volume: Some(StringOrNumber::Number(13)),
            issue: Some(StringOrNumber::Number(3)),
            page: Some("245-260".to_string()),
            doi: Some("10.1038/s41558-023-01234-5".to_string()),
            url: Some("https://doi.org/10.1038/s41558-023-01234-5".to_string()),
            publisher: Some("Nature Publishing Group".to_string()),
            ..Default::default()
        }
    }

    #[test]
    fn test_initialize_given_name() {
        assert_eq!(initialize_given("John", ". "), "J.");
        assert_eq!(initialize_given("John Andrew", ". "), "J. A.");
        assert_eq!(initialize_given("Benjamin Robert", ". "), "B. R.");
        assert_eq!(initialize_given("Jean-Pierre", ". "), "J.-P.");
    }

    #[test]
    fn test_roman_numerals() {
        assert_eq!(to_roman(1), "i");
        assert_eq!(to_roman(4), "iv");
        assert_eq!(to_roman(9), "ix");
        assert_eq!(to_roman(42), "xlii");
        assert_eq!(to_roman(2024), "mmxxiv");
    }

    #[test]
    fn test_title_case() {
        assert_eq!(
            title_case("the impact of climate change"),
            "The Impact of Climate Change"
        );
    }

    #[test]
    fn test_render_simple_bibliography() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0" default-locale="en-US">
  <info>
    <title>Simple Test</title>
    <id>simple-test</id>
  </info>
  <bibliography>
    <layout suffix=".">
      <text variable="title" font-style="italic"/>
    </layout>
  </bibliography>
</style>"#;

        let style = Style::from_xml(xml).unwrap();
        let locale = Locale::english();
        let mut renderer = Renderer::new(style, locale, OutputFormat::Html);
        let item = sample_item();

        let result = renderer.render_bibliography_entry(&item).unwrap();
        assert_eq!(
            result,
            "<i>The impact of climate change on biodiversity</i>."
        );
    }

    #[test]
    fn test_render_plain_text() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0" default-locale="en-US">
  <info>
    <title>Plain Test</title>
    <id>plain-test</id>
  </info>
  <bibliography>
    <layout suffix=".">
      <text variable="title"/>
    </layout>
  </bibliography>
</style>"#;

        let style = Style::from_xml(xml).unwrap();
        let locale = Locale::english();
        let mut renderer = Renderer::new(style, locale, OutputFormat::PlainText);
        let item = sample_item();

        let result = renderer.render_bibliography_entry(&item).unwrap();
        assert_eq!(result, "The impact of climate change on biodiversity.");
    }

    // =========================================================================
    // APA-style integration tests matching JS formatter output
    // =========================================================================

    fn apa_style_xml() -> &'static str {
        r#"<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0"
       default-locale="en-US" initialize-with=". " name-as-sort-order="all"
       and="symbol" delimiter-precedes-last="always">
  <info>
    <title>APA Test</title>
    <id>apa-test</id>
  </info>
  <citation et-al-min="3" et-al-use-first="1">
    <layout prefix="(" suffix=")" delimiter="; ">
      <group delimiter=", ">
        <names variable="author">
          <name form="short"/>
        </names>
        <date variable="issued">
          <date-part name="year"/>
        </date>
      </group>
    </layout>
  </citation>
  <bibliography et-al-min="21" et-al-use-first="19" et-al-use-last="true">
    <layout suffix=".">
      <group delimiter=". ">
        <names variable="author">
          <name/>
        </names>
        <date variable="issued" prefix="(" suffix=")">
          <date-part name="year"/>
        </date>
        <text variable="title"/>
        <group>
          <text variable="container-title" font-style="italic"/>
          <group prefix=", ">
            <text variable="volume" font-style="italic"/>
            <text variable="issue" prefix="(" suffix=")"/>
          </group>
          <text variable="page" prefix=", "/>
        </group>
        <text variable="DOI" prefix="https://doi.org/"/>
      </group>
    </layout>
  </bibliography>
</style>"#
    }

    #[test]
    fn test_apa_bib_author_initials() {
        // Authors should be "Smith, J., & Doe, J." with initials, not full given names
        let style = Style::from_xml(apa_style_xml()).unwrap();
        let locale = Locale::english();
        let mut renderer = Renderer::new(style, locale, OutputFormat::PlainText);
        let item = sample_item();

        let result = renderer.render_bibliography_entry(&item).unwrap();
        // Should contain initialized names, not full given names
        assert!(result.contains("Smith, J."), "Expected 'Smith, J.' but got: {}", result);
        assert!(result.contains("Doe, J."), "Expected 'Doe, J.' but got: {}", result);
        // Should NOT contain full names
        assert!(!result.contains("John"), "Should not contain full given name 'John': {}", result);
    }

    #[test]
    fn test_apa_bib_group_delimiters() {
        // Parts should be separated by ". " from the group delimiter
        let style = Style::from_xml(apa_style_xml()).unwrap();
        let locale = Locale::english();
        let mut renderer = Renderer::new(style, locale, OutputFormat::PlainText);
        let item = sample_item();

        let result = renderer.render_bibliography_entry(&item).unwrap();
        // Should end with period from layout suffix
        assert!(result.ends_with('.'), "Should end with period: {}", result);
        // Should contain year in parens (date-part only specifies year)
        assert!(result.contains("(2023)"), "Expected '(2023)' in: {}", result);
        // Should NOT contain month name when only year date-part is specified
        assert!(!result.contains("May"), "Should not contain month 'May': {}", result);
        // Should contain title
        assert!(result.contains("The impact of climate change on biodiversity"), "Expected title in: {}", result);
    }

    #[test]
    fn test_apa_citation_et_al() {
        // With 2 authors and et-al-min=3, should show both names
        let style = Style::from_xml(apa_style_xml()).unwrap();
        let locale = Locale::english();
        let mut renderer = Renderer::new(style, locale, OutputFormat::PlainText);
        let item = sample_item(); // has 2 authors

        let items = vec![&item];
        let result = renderer.render_citation(&items).unwrap();
        // 2 authors, et-al-min=3, so both should appear: (Smith & Doe, 2023)
        assert!(result.contains("Smith"), "Expected 'Smith' in: {}", result);
        assert!(result.contains("Doe"), "Expected 'Doe' in: {}", result);
        assert!(result.starts_with('('), "Should start with '(': {}", result);
        assert!(result.ends_with(')'), "Should end with ')': {}", result);
    }

    #[test]
    fn test_apa_citation_et_al_many_authors() {
        // With 5 authors and et-al-min=3, should show "Smith et al., 2023"
        let style = Style::from_xml(apa_style_xml()).unwrap();
        let locale = Locale::english();
        let mut renderer = Renderer::new(style, locale, OutputFormat::PlainText);

        let mut item = sample_item();
        item.author = Some(vec![
            Name { family: Some("Smith".into()), given: Some("John".into()), ..Default::default() },
            Name { family: Some("Doe".into()), given: Some("Jane".into()), ..Default::default() },
            Name { family: Some("Brown".into()), given: Some("Alice".into()), ..Default::default() },
            Name { family: Some("Wilson".into()), given: Some("Bob".into()), ..Default::default() },
            Name { family: Some("Lee".into()), given: Some("Carlos".into()), ..Default::default() },
        ]);

        let items = vec![&item];
        let result = renderer.render_citation(&items).unwrap();
        // et-al-min=3, et-al-use-first=1 → "Smith et al."
        assert!(result.contains("et al."), "Expected 'et al.' in: {}", result);
        assert!(result.contains("Smith"), "Expected 'Smith' in: {}", result);
        assert!(!result.contains("Doe"), "Should NOT contain 'Doe': {}", result);
        assert!(!result.contains("Brown"), "Should NOT contain 'Brown': {}", result);
    }

    #[test]
    fn test_apa_bib_volume_issue_format() {
        // Volume/issue should be compact: "13(3)" not "volume 13, issue 3"
        let style = Style::from_xml(apa_style_xml()).unwrap();
        let locale = Locale::english();
        let mut renderer = Renderer::new(style, locale, OutputFormat::PlainText);
        let item = sample_item();

        let result = renderer.render_bibliography_entry(&item).unwrap();
        assert!(result.contains("13(3)"), "Expected '13(3)' in: {}", result);
        assert!(!result.contains("volume"), "Should NOT contain 'volume': {}", result);
    }

    #[test]
    fn test_hyphenated_name_initials() {
        let style = Style::from_xml(apa_style_xml()).unwrap();
        let locale = Locale::english();
        let mut renderer = Renderer::new(style, locale, OutputFormat::PlainText);

        let mut item = sample_item();
        item.author = Some(vec![
            Name { family: Some("Dupont".into()), given: Some("Jean-Pierre".into()), ..Default::default() },
        ]);

        let result = renderer.render_bibliography_entry(&item).unwrap();
        assert!(result.contains("Dupont, J.-P."), "Expected 'Dupont, J.-P.' in: {}", result);
    }
}
