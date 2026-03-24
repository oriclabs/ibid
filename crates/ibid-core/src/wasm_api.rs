use wasm_bindgen::prelude::*;

use crate::csl::hayagriva_renderer;
use crate::csl::locale::Locale;
use crate::csl::renderer::{OutputFormat, Renderer};
use crate::csl::style::Style;
use crate::types::CslItem;

/// WASM-exposed citation engine
#[wasm_bindgen]
pub struct IbidEngine {
    style: Option<Style>,
    style_xml: Option<String>, // raw XML for hayagriva rendering
    locale: Locale,
    items: Vec<CslItem>,
    format: OutputFormat,
}

#[wasm_bindgen]
impl IbidEngine {
    /// Create a new engine with default English locale
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            style: None,
            style_xml: None,
            locale: Locale::english(),
            items: Vec::new(),
            format: OutputFormat::Html,
        }
    }

    /// Set output format: "html" or "text"
    #[wasm_bindgen(js_name = setFormat)]
    pub fn set_format(&mut self, format: &str) {
        self.format = match format {
            "text" | "plain" | "plaintext" => OutputFormat::PlainText,
            _ => OutputFormat::Html,
        };
    }

    /// Load a CSL style from XML string
    #[wasm_bindgen(js_name = loadStyle)]
    pub fn load_style(&mut self, xml: &str) -> Result<(), JsValue> {
        // Always save raw XML for hayagriva rendering (primary renderer)
        self.style_xml = Some(xml.to_string());
        // Try parsing with our custom parser (used for getStyleInfo only)
        match Style::from_xml(xml) {
            Ok(style) => self.style = Some(style),
            Err(_) => self.style = None, // Custom parser failed, but hayagriva will work
        }
        Ok(())
    }

    /// Load a CSL locale from XML string
    #[wasm_bindgen(js_name = loadLocale)]
    pub fn load_locale(&mut self, xml: &str) -> Result<(), JsValue> {
        let locale = Locale::from_xml(xml)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.locale = locale;
        Ok(())
    }

    /// Set citation items from JSON string (array of CSL-JSON items)
    #[wasm_bindgen(js_name = setItems)]
    pub fn set_items(&mut self, json: &str) -> Result<(), JsValue> {
        let items: Vec<CslItem> = serde_json::from_str(json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.items = items;
        Ok(())
    }

    /// Add a single citation item from JSON string
    #[wasm_bindgen(js_name = addItem)]
    pub fn add_item(&mut self, json: &str) -> Result<(), JsValue> {
        let item: CslItem = serde_json::from_str(json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.items.push(item);
        Ok(())
    }

    /// Clear all items
    #[wasm_bindgen(js_name = clearItems)]
    pub fn clear_items(&mut self) {
        self.items.clear();
    }

    /// Format a single item as a bibliography entry (by item ID)
    #[wasm_bindgen(js_name = formatBibliographyEntry)]
    pub fn format_bibliography_entry(&self, item_json: &str) -> Result<String, JsValue> {
        let xml = self.style_xml.as_ref()
            .ok_or_else(|| JsValue::from_str("No style loaded"))?;
        let item: CslItem = serde_json::from_str(item_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        hayagriva_renderer::render_bibliography(&item, xml)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Format all loaded items as a bibliography, returns JSON array of strings
    #[wasm_bindgen(js_name = formatBibliography)]
    pub fn format_bibliography(&self) -> Result<String, JsValue> {
        let xml = self.style_xml.as_ref()
            .ok_or_else(|| JsValue::from_str("No style loaded"))?;
        let mut entries = Vec::new();
        for item in &self.items {
            let bib = hayagriva_renderer::render_bibliography(item, xml)
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
            entries.push(bib);
        }
        serde_json::to_string(&entries)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Format an in-text citation for given item IDs (JSON array of item JSON objects)
    #[wasm_bindgen(js_name = formatCitation)]
    pub fn format_citation(&self, items_json: &str) -> Result<String, JsValue> {
        let xml = self.style_xml.as_ref()
            .ok_or_else(|| JsValue::from_str("No style loaded"))?;
        let items: Vec<CslItem> = serde_json::from_str(items_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        // Format citation for the first item
        if let Some(item) = items.first() {
            hayagriva_renderer::render_citation(item, xml)
                .map_err(|e| JsValue::from_str(&e.to_string()))
        } else {
            Err(JsValue::from_str("No items provided"))
        }
    }

    /// Get loaded style info as JSON
    #[wasm_bindgen(js_name = getStyleInfo)]
    pub fn get_style_info(&self) -> Result<String, JsValue> {
        if let Some(style) = self.style.as_ref() {
            let info = serde_json::json!({
                "title": style.info.title,
                "id": style.info.id,
                "defaultLocale": style.default_locale,
                "class": match style.class {
                    crate::csl::style::StyleClass::InText => "in-text",
                    crate::csl::style::StyleClass::Note => "note",
                },
                "hasBibliography": style.bibliography.is_some(),
                "hasCitation": style.citation.is_some(),
            });
            serde_json::to_string(&info)
                .map_err(|e| JsValue::from_str(&e.to_string()))
        } else if let Some(ref xml) = self.style_xml {
            // Fallback: extract basic info from raw XML
            let title = xml.split("<title>").nth(1)
                .and_then(|s| s.split("</title>").next())
                .unwrap_or("Unknown");
            let info = serde_json::json!({ "title": title, "id": "", "hasBibliography": true, "hasCitation": true });
            serde_json::to_string(&info)
                .map_err(|e| JsValue::from_str(&e.to_string()))
        } else {
            Err(JsValue::from_str("No style loaded"))
        }
    }

    /// Get item count
    #[wasm_bindgen(js_name = getItemCount)]
    pub fn get_item_count(&self) -> usize {
        self.items.len()
    }

    /// Parse BibTeX string, returns JSON: { entries: [...CSL-JSON], errors: [...] }
    #[wasm_bindgen(js_name = parseBibtex)]
    pub fn parse_bibtex(&self, input: &str) -> Result<String, JsValue> {
        let result = crate::parsers::bibtex::parse_bibtex(input);
        let items: Vec<&CslItem> = result.entries.iter().map(|e| &e.item).collect();
        let warnings: Vec<Vec<&str>> = result.entries.iter()
            .map(|e| e.warnings.iter().map(|w| w.as_str()).collect())
            .collect();

        let json = serde_json::json!({
            "entries": items,
            "warnings": warnings,
            "errors": result.errors,
            "count": items.len(),
        });
        serde_json::to_string(&json)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Parse RIS string, returns JSON: { entries: [...CSL-JSON], errors: [...] }
    #[wasm_bindgen(js_name = parseRis)]
    pub fn parse_ris(&self, input: &str) -> Result<String, JsValue> {
        let result = crate::parsers::ris::parse_ris(input);
        let items: Vec<&CslItem> = result.entries.iter().map(|e| &e.item).collect();
        let warnings: Vec<Vec<&str>> = result.entries.iter()
            .map(|e| e.warnings.iter().map(|w| w.as_str()).collect())
            .collect();

        let json = serde_json::json!({
            "entries": items,
            "warnings": warnings,
            "errors": result.errors,
            "count": items.len(),
        });
        serde_json::to_string(&json)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Parse CSL-JSON string (passthrough with validation), returns JSON
    #[wasm_bindgen(js_name = parseCslJson)]
    pub fn parse_csl_json(&self, input: &str) -> Result<String, JsValue> {
        // Try array first, then single item
        let items: Vec<CslItem> = if input.trim_start().starts_with('[') {
            serde_json::from_str(input)
                .map_err(|e| JsValue::from_str(&format!("CSL-JSON parse error: {}", e)))?
        } else {
            let item: CslItem = serde_json::from_str(input)
                .map_err(|e| JsValue::from_str(&format!("CSL-JSON parse error: {}", e)))?;
            vec![item]
        };

        let json = serde_json::json!({
            "entries": items,
            "warnings": [],
            "errors": [],
            "count": items.len(),
        });
        serde_json::to_string(&json)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Export items as BibTeX. Input: JSON array of CSL-JSON items. Options: JSON { includeAbstract, includeKeywords }
    #[wasm_bindgen(js_name = exportBibtex)]
    pub fn export_bibtex(&self, items_json: &str, options_json: &str) -> Result<String, JsValue> {
        let items: Vec<CslItem> = serde_json::from_str(items_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let opts: serde_json::Value = serde_json::from_str(options_json).unwrap_or_default();
        let bib_opts = crate::serializers::bibtex::BibtexOptions {
            include_abstract: opts.get("includeAbstract").and_then(|v| v.as_bool()).unwrap_or(false),
            include_keywords: opts.get("includeKeywords").and_then(|v| v.as_bool()).unwrap_or(true),
        };

        Ok(crate::serializers::bibtex::serialize_items(&items, &bib_opts))
    }

    /// Export items as RIS. Input: JSON array of CSL-JSON items.
    #[wasm_bindgen(js_name = exportRis)]
    pub fn export_ris(&self, items_json: &str) -> Result<String, JsValue> {
        let items: Vec<CslItem> = serde_json::from_str(items_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(crate::serializers::ris::serialize_items(&items))
    }

    // Phase 2 parsers

    /// Parse EndNote XML
    #[wasm_bindgen(js_name = parseEndnoteXml)]
    pub fn parse_endnote_xml(&self, input: &str) -> Result<String, JsValue> {
        let result = crate::parsers::endnote_xml::parse_endnote_xml(input);
        let json = serde_json::json!({
            "entries": result.entries,
            "errors": result.errors,
            "count": result.entries.len(),
        });
        serde_json::to_string(&json).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Parse MEDLINE/NBIB
    #[wasm_bindgen(js_name = parseMedline)]
    pub fn parse_medline(&self, input: &str) -> Result<String, JsValue> {
        let result = crate::parsers::medline::parse_medline(input);
        let json = serde_json::json!({
            "entries": result.entries,
            "errors": result.errors,
            "count": result.entries.len(),
        });
        serde_json::to_string(&json).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Parse CSV/TSV. delimiter: "," or "\t"
    #[wasm_bindgen(js_name = parseCsv)]
    pub fn parse_csv(&self, input: &str, delimiter: &str) -> Result<String, JsValue> {
        let delim = if delimiter == "\t" || delimiter == "tab" { '\t' } else { ',' };
        let map = crate::parsers::csv::default_column_map();
        let result = crate::parsers::csv::parse_csv(input, delim, &map);
        let json = serde_json::json!({
            "entries": result.entries,
            "errors": result.errors,
            "count": result.entries.len(),
        });
        serde_json::to_string(&json).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    // Phase 2 serializers

    /// Export as CSV
    #[wasm_bindgen(js_name = exportCsv)]
    pub fn export_csv(&self, items_json: &str, delimiter: &str) -> Result<String, JsValue> {
        let items: Vec<CslItem> = serde_json::from_str(items_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let delim = if delimiter == "\t" || delimiter == "tab" { '\t' } else { ',' };
        Ok(crate::serializers::csv::serialize_csv(&items, delim, true))
    }

    /// Export as Word XML Bibliography
    #[wasm_bindgen(js_name = exportWordXml)]
    pub fn export_word_xml(&self, items_json: &str) -> Result<String, JsValue> {
        let items: Vec<CslItem> = serde_json::from_str(items_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(crate::serializers::word_xml::serialize_word_xml(&items))
    }

    /// Export as YAML
    #[wasm_bindgen(js_name = exportYaml)]
    pub fn export_yaml(&self, items_json: &str) -> Result<String, JsValue> {
        let items: Vec<CslItem> = serde_json::from_str(items_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(crate::serializers::yaml::serialize_yaml(&items))
    }

    /// Extract text from PDF bytes
    #[wasm_bindgen(js_name = extractPdfText)]
    pub fn extract_pdf_text(&self, bytes: &[u8]) -> Result<String, JsValue> {
        pdf_extract::extract_text_from_mem(bytes)
            .map_err(|e| JsValue::from_str(&format!("PDF extraction failed: {}", e)))
    }
}
