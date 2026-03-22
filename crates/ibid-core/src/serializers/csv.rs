use crate::types::CslItem;

/// Export items as CSV
pub fn serialize_csv(items: &[CslItem], delimiter: char, include_header: bool) -> String {
    let mut out = String::new();

    if include_header {
        let headers = ["type","title","author","year","container-title","volume","issue","pages","DOI","URL","publisher","ISBN","ISSN","abstract","keywords","language"];
        out.push_str(&headers.join(&delimiter.to_string()));
        out.push('\n');
    }

    for item in items {
        let authors = item.author.as_ref().map(|aa| {
            aa.iter().map(|a| {
                if let Some(ref lit) = a.literal { lit.clone() }
                else {
                    let f = a.family.as_deref().unwrap_or("");
                    let g = a.given.as_deref().unwrap_or("");
                    if g.is_empty() { f.to_string() } else { format!("{}, {}", f, g) }
                }
            }).collect::<Vec<_>>().join("; ")
        }).unwrap_or_default();

        let year = item.issued.as_ref()
            .and_then(|d| d.date_parts.as_ref())
            .and_then(|p| p.first())
            .and_then(|p| p.first())
            .map(|y| y.to_string())
            .unwrap_or_default();

        let type_str = serde_json::to_string(&item.item_type).unwrap_or_default().trim_matches('"').to_string();

        let fields = [
            &type_str,
            item.title.as_deref().unwrap_or(""),
            &authors,
            &year,
            item.container_title.as_deref().unwrap_or(""),
            &item.volume.as_ref().map(|v| v.to_string()).unwrap_or_default(),
            &item.issue.as_ref().map(|v| v.to_string()).unwrap_or_default(),
            item.page.as_deref().unwrap_or(""),
            item.doi.as_deref().unwrap_or(""),
            item.url.as_deref().unwrap_or(""),
            item.publisher.as_deref().unwrap_or(""),
            item.isbn.as_deref().unwrap_or(""),
            item.issn.as_deref().unwrap_or(""),
            item.abstract_.as_deref().unwrap_or(""),
            item.keyword.as_deref().unwrap_or(""),
            item.language.as_deref().unwrap_or(""),
        ];

        let row: Vec<String> = fields.iter().map(|f| csv_escape(f, delimiter)).collect();
        out.push_str(&row.join(&delimiter.to_string()));
        out.push('\n');
    }

    out
}

fn csv_escape(s: &str, delimiter: char) -> String {
    if s.contains(delimiter) || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;

    #[test]
    fn test_serialize_csv() {
        let items = vec![CslItem {
            id: "t".into(),
            item_type: ItemType::ArticleJournal,
            title: Some("Test Article".into()),
            author: Some(vec![Name { family: Some("Smith".into()), given: Some("John".into()), ..Default::default() }]),
            issued: Some(DateVariable { date_parts: Some(vec![vec![2024]]), ..Default::default() }),
            container_title: Some("Nature".into()),
            doi: Some("10.1038/test".into()),
            ..Default::default()
        }];
        let csv = serialize_csv(&items, ',', true);
        assert!(csv.contains("type,title,author"));
        assert!(csv.contains("Test Article"));
        assert!(csv.contains("Smith, John"));
        assert!(csv.contains("2024"));
        assert!(csv.contains("Nature"));
    }

    #[test]
    fn test_csv_escape_comma() {
        let items = vec![CslItem {
            id: "t".into(),
            title: Some("Title with, comma".into()),
            ..Default::default()
        }];
        let csv = serialize_csv(&items, ',', false);
        assert!(csv.contains("\"Title with, comma\""));
    }
}
