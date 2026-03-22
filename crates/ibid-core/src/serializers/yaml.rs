use crate::types::CslItem;

/// Export items as YAML (for Hugo, Jekyll, etc.)
pub fn serialize_yaml(items: &[CslItem]) -> String {
    let mut out = String::from("references:\n");

    for item in items {
        out.push_str(&format!("  - id: \"{}\"\n", yaml_escape(&item.id)));
        let type_str = serde_json::to_string(&item.item_type).unwrap_or_default().trim_matches('"').to_string();
        out.push_str(&format!("    type: \"{}\"\n", type_str));

        if let Some(ref title) = item.title {
            out.push_str(&format!("    title: \"{}\"\n", yaml_escape(title)));
        }

        if let Some(ref authors) = item.author {
            out.push_str("    author:\n");
            for a in authors {
                if let Some(ref lit) = a.literal {
                    out.push_str(&format!("      - literal: \"{}\"\n", yaml_escape(lit)));
                } else {
                    out.push_str("      - ");
                    if let Some(ref f) = a.family { out.push_str(&format!("family: \"{}\"", yaml_escape(f))); }
                    if let Some(ref g) = a.given { out.push_str(&format!(", given: \"{}\"", yaml_escape(g))); }
                    out.push('\n');
                }
            }
        }

        if let Some(ref issued) = item.issued {
            if let Some(ref parts) = issued.date_parts {
                if let Some(first) = parts.first() {
                    let date_str = first.iter().map(|p| p.to_string()).collect::<Vec<_>>().join("-");
                    out.push_str(&format!("    issued: \"{}\"\n", date_str));
                }
            }
        }

        if let Some(ref ct) = item.container_title { out.push_str(&format!("    container-title: \"{}\"\n", yaml_escape(ct))); }
        if let Some(ref v) = item.volume { out.push_str(&format!("    volume: \"{}\"\n", v)); }
        if let Some(ref i) = item.issue { out.push_str(&format!("    issue: \"{}\"\n", i)); }
        if let Some(ref p) = item.page { out.push_str(&format!("    page: \"{}\"\n", yaml_escape(p))); }
        if let Some(ref doi) = item.doi { out.push_str(&format!("    DOI: \"{}\"\n", yaml_escape(doi))); }
        if let Some(ref url) = item.url { out.push_str(&format!("    URL: \"{}\"\n", yaml_escape(url))); }
        if let Some(ref pub_) = item.publisher { out.push_str(&format!("    publisher: \"{}\"\n", yaml_escape(pub_))); }
        if let Some(ref isbn) = item.isbn { out.push_str(&format!("    ISBN: \"{}\"\n", yaml_escape(isbn))); }

        out.push('\n');
    }

    out
}

fn yaml_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;

    #[test]
    fn test_yaml_output() {
        let items = vec![CslItem {
            id: "test".into(),
            item_type: ItemType::ArticleJournal,
            title: Some("Test Article".into()),
            author: Some(vec![Name { family: Some("Smith".into()), given: Some("John".into()), ..Default::default() }]),
            issued: Some(DateVariable { date_parts: Some(vec![vec![2024, 3]]), ..Default::default() }),
            doi: Some("10.1038/test".into()),
            ..Default::default()
        }];
        let yaml = serialize_yaml(&items);
        assert!(yaml.contains("references:"));
        assert!(yaml.contains("title: \"Test Article\""));
        assert!(yaml.contains("family: \"Smith\""));
        assert!(yaml.contains("issued: \"2024-3\""));
        assert!(yaml.contains("DOI: \"10.1038/test\""));
    }
}
