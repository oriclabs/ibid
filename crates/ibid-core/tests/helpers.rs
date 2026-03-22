// Shared test helpers and fixtures

use ibid_core::csl::locale::Locale;
use ibid_core::csl::renderer::{OutputFormat, Renderer};
use ibid_core::csl::style::Style;
use ibid_core::types::*;

pub fn journal_article() -> CslItem {
    CslItem {
        id: "smith2023".into(),
        item_type: ItemType::ArticleJournal,
        title: Some("The impact of climate change on biodiversity".into()),
        author: Some(vec![
            Name { family: Some("Smith".into()), given: Some("John Andrew".into()), ..Default::default() },
            Name { family: Some("Doe".into()), given: Some("Jane".into()), ..Default::default() },
        ]),
        container_title: Some("Nature Climate Change".into()),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2023, 5, 15]]), ..Default::default() }),
        volume: Some(StringOrNumber::Number(13)),
        issue: Some(StringOrNumber::Number(3)),
        page: Some("245-260".into()),
        doi: Some("10.1038/s41558-023-01234-5".into()),
        publisher: Some("Nature Publishing Group".into()),
        ..Default::default()
    }
}

pub fn book() -> CslItem {
    CslItem {
        id: "knuth1997".into(),
        item_type: ItemType::Book,
        title: Some("The Art of Computer Programming".into()),
        author: Some(vec![
            Name { family: Some("Knuth".into()), given: Some("Donald E.".into()), ..Default::default() },
        ]),
        publisher: Some("Addison-Wesley".into()),
        publisher_place: Some("Boston, MA".into()),
        issued: Some(DateVariable { date_parts: Some(vec![vec![1997]]), ..Default::default() }),
        volume: Some(StringOrNumber::Number(1)),
        edition: Some(StringOrNumber::String("3rd".into())),
        isbn: Some("978-0-201-89683-1".into()),
        ..Default::default()
    }
}

pub fn chapter() -> CslItem {
    CslItem {
        id: "wilson2020".into(),
        item_type: ItemType::Chapter,
        title: Some("Machine learning in ecology".into()),
        author: Some(vec![
            Name { family: Some("Wilson".into()), given: Some("Sarah".into()), ..Default::default() },
        ]),
        container_title: Some("Handbook of Ecological Modeling".into()),
        editor: Some(vec![
            Name { family: Some("Brown".into()), given: Some("Michael".into()), ..Default::default() },
            Name { family: Some("Taylor".into()), given: Some("Lisa".into()), ..Default::default() },
        ]),
        publisher: Some("Oxford University Press".into()),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2020]]), ..Default::default() }),
        page: Some("123-156".into()),
        ..Default::default()
    }
}

pub fn webpage() -> CslItem {
    CslItem {
        id: "who2024".into(),
        item_type: ItemType::Webpage,
        title: Some("Climate change and health".into()),
        author: Some(vec![
            Name { literal: Some("World Health Organization".into()), ..Default::default() },
        ]),
        url: Some("https://www.who.int/news-room/fact-sheets/detail/climate-change-and-health".into()),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2024, 1, 10]]), ..Default::default() }),
        accessed: Some(DateVariable { date_parts: Some(vec![vec![2024, 3, 20]]), ..Default::default() }),
        ..Default::default()
    }
}

pub fn thesis() -> CslItem {
    CslItem {
        id: "chen2022".into(),
        item_type: ItemType::Thesis,
        title: Some("Neural networks for climate prediction".into()),
        author: Some(vec![
            Name { family: Some("Chen".into()), given: Some("Wei".into()), ..Default::default() },
        ]),
        publisher: Some("Stanford University".into()),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2022]]), ..Default::default() }),
        ..Default::default()
    }
}

pub fn no_author_item() -> CslItem {
    CslItem {
        id: "anon2023".into(),
        item_type: ItemType::ArticleNewspaper,
        title: Some("Global temperatures hit record high".into()),
        container_title: Some("The Guardian".into()),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2023, 7, 4]]), ..Default::default() }),
        url: Some("https://theguardian.com/example".into()),
        ..Default::default()
    }
}

pub fn no_date_item() -> CslItem {
    CslItem {
        id: "nodate1".into(),
        item_type: ItemType::Webpage,
        title: Some("About our organization".into()),
        author: Some(vec![
            Name { literal: Some("Example Corp".into()), ..Default::default() },
        ]),
        url: Some("https://example.com/about".into()),
        ..Default::default()
    }
}

pub fn many_authors() -> CslItem {
    CslItem {
        id: "team2024".into(),
        item_type: ItemType::ArticleJournal,
        title: Some("Collaborative research findings".into()),
        author: Some((0..7).map(|i| Name {
            family: Some(["Adams","Baker","Clark","Davis","Evans","Frank","Grant"][i].into()),
            given: Some(["A.","B.","C.","D.","E.","F.","G."][i].into()),
            ..Default::default()
        }).collect()),
        container_title: Some("Science".into()),
        issued: Some(DateVariable { date_parts: Some(vec![vec![2024]]), ..Default::default() }),
        volume: Some(StringOrNumber::Number(383)),
        page: Some("100-105".into()),
        ..Default::default()
    }
}

pub fn load_style(name: &str) -> Style {
    let path = format!("../../browser/chrome/styles/csl/{}.csl", name);
    let xml = std::fs::read_to_string(&path)
        .unwrap_or_else(|_| panic!("Could not read style file: {}", path));
    Style::from_xml(&xml).unwrap_or_else(|e| panic!("Failed to parse {}: {}", name, e))
}

pub fn render_bib(style_name: &str, item: &CslItem) -> String {
    let style = load_style(style_name);
    let locale = Locale::english();
    Renderer::new(style, locale, OutputFormat::PlainText)
        .render_bibliography_entry(item).unwrap()
}

pub fn render_bib_html(style_name: &str, item: &CslItem) -> String {
    let style = load_style(style_name);
    let locale = Locale::english();
    Renderer::new(style, locale, OutputFormat::Html)
        .render_bibliography_entry(item).unwrap()
}

pub fn render_intext(style_name: &str, item: &CslItem) -> String {
    let style = load_style(style_name);
    let locale = Locale::english();
    Renderer::new(style, locale, OutputFormat::PlainText)
        .render_citation(&[item]).unwrap()
}
