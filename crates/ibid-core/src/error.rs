use thiserror::Error;

#[derive(Error, Debug)]
pub enum IbidError {
    #[error("CSL parse error: {0}")]
    CslParse(String),

    #[error("CSL render error: {0}")]
    CslRender(String),

    #[error("XML parse error: {0}")]
    XmlParse(#[from] quick_xml::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Unknown source type: {0}")]
    UnknownSourceType(String),

    #[error("Missing required field: {0}")]
    MissingField(String),

    #[error("Invalid date: {0}")]
    InvalidDate(String),

    #[error("Invalid identifier: {0}")]
    InvalidIdentifier(String),
}

pub type Result<T> = std::result::Result<T, IbidError>;
