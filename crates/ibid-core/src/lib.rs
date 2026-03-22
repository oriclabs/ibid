pub mod csl;
pub mod error;
pub mod parsers;
pub mod serializers;
pub mod types;
pub mod wasm_api;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
