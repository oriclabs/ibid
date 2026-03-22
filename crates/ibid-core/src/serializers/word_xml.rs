use crate::types::CslItem;

/// Export items as Word XML Bibliography format (compatible with Word 2007+)
pub fn serialize_word_xml(items: &[CslItem]) -> String {
    let mut xml = String::from(r#"<?xml version="1.0" encoding="UTF-8"?>
<b:Sources xmlns:b="http://schemas.openxmlformats.org/officeDocument/2006/bibliography"
           xmlns="http://schemas.openxmlformats.org/officeDocument/2006/bibliography"
           SelectedStyle="">
"#);

    for item in items {
        xml.push_str("  <b:Source>\n");
        xml.push_str(&format!("    <b:Tag>{}</b:Tag>\n", xml_escape(&item.id)));
        xml.push_str(&format!("    <b:SourceType>{}</b:SourceType>\n", map_word_type(&item.item_type)));

        if let Some(ref title) = item.title {
            xml.push_str(&format!("    <b:Title>{}</b:Title>\n", xml_escape(title)));
        }

        // Authors
        if let Some(ref authors) = item.author {
            xml.push_str("    <b:Author>\n      <b:Author>\n        <b:NameList>\n");
            for a in authors {
                xml.push_str("          <b:Person>\n");
                if let Some(ref family) = a.family {
                    xml.push_str(&format!("            <b:Last>{}</b:Last>\n", xml_escape(family)));
                }
                if let Some(ref given) = a.given {
                    xml.push_str(&format!("            <b:First>{}</b:First>\n", xml_escape(given)));
                }
                if let Some(ref lit) = a.literal {
                    xml.push_str(&format!("            <b:Last>{}</b:Last>\n", xml_escape(lit)));
                }
                xml.push_str("          </b:Person>\n");
            }
            xml.push_str("        </b:NameList>\n      </b:Author>\n    </b:Author>\n");
        }

        // Date
        if let Some(ref issued) = item.issued {
            if let Some(ref parts) = issued.date_parts {
                if let Some(first) = parts.first() {
                    if let Some(y) = first.first() {
                        xml.push_str(&format!("    <b:Year>{}</b:Year>\n", y));
                    }
                    if let Some(m) = first.get(1) {
                        xml.push_str(&format!("    <b:Month>{}</b:Month>\n", m));
                    }
                    if let Some(d) = first.get(2) {
                        xml.push_str(&format!("    <b:Day>{}</b:Day>\n", d));
                    }
                }
            }
        }

        if let Some(ref ct) = item.container_title {
            xml.push_str(&format!("    <b:JournalName>{}</b:JournalName>\n", xml_escape(ct)));
        }
        if let Some(ref v) = item.volume {
            xml.push_str(&format!("    <b:Volume>{}</b:Volume>\n", v));
        }
        if let Some(ref p) = item.page {
            xml.push_str(&format!("    <b:Pages>{}</b:Pages>\n", xml_escape(p)));
        }
        if let Some(ref pub_) = item.publisher {
            xml.push_str(&format!("    <b:Publisher>{}</b:Publisher>\n", xml_escape(pub_)));
        }
        if let Some(ref doi) = item.doi {
            xml.push_str(&format!("    <b:DOI>{}</b:DOI>\n", xml_escape(doi)));
        }
        if let Some(ref url) = item.url {
            xml.push_str(&format!("    <b:URL>{}</b:URL>\n", xml_escape(url)));
        }
        if let Some(ref isbn) = item.isbn {
            xml.push_str(&format!("    <b:StandardNumber>{}</b:StandardNumber>\n", xml_escape(isbn)));
        }

        xml.push_str("  </b:Source>\n");
    }

    xml.push_str("</b:Sources>\n");
    xml
}

fn map_word_type(item_type: &crate::types::ItemType) -> &'static str {
    use crate::types::ItemType;
    match item_type {
        ItemType::ArticleJournal | ItemType::ArticleMagazine => "JournalArticle",
        ItemType::Book | ItemType::Collection => "Book",
        ItemType::Chapter => "BookSection",
        ItemType::PaperConference => "ConferenceProceedings",
        ItemType::Thesis => "Report",
        ItemType::Report => "Report",
        ItemType::Webpage | ItemType::PostWeblog => "InternetSite",
        ItemType::ArticleNewspaper => "ArticleInAPeriodical",
        ItemType::Patent => "Patent",
        ItemType::MotionPicture => "Film",
        ItemType::Legislation | ItemType::Bill => "Misc",
        _ => "Misc",
    }
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;

    #[test]
    fn test_word_xml() {
        let items = vec![CslItem {
            id: "test".into(),
            item_type: ItemType::ArticleJournal,
            title: Some("Test Article".into()),
            author: Some(vec![Name { family: Some("Smith".into()), given: Some("John".into()), ..Default::default() }]),
            issued: Some(DateVariable { date_parts: Some(vec![vec![2024]]), ..Default::default() }),
            container_title: Some("Nature".into()),
            ..Default::default()
        }];
        let xml = serialize_word_xml(&items);
        assert!(xml.contains("<b:Title>Test Article</b:Title>"));
        assert!(xml.contains("<b:Last>Smith</b:Last>"));
        assert!(xml.contains("<b:SourceType>JournalArticle</b:SourceType>"));
        assert!(xml.contains("<b:Year>2024</b:Year>"));
    }
}
