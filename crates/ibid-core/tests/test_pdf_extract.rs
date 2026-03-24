// Test: PDF text extraction via pdf-extract crate

#[test]
fn test_extract_text_from_minimal_pdf() {
    // Minimal valid PDF with text "Hello World"
    let pdf_bytes = create_minimal_pdf("Hello World");
    let result = pdf_extract::extract_text_from_mem(&pdf_bytes);
    assert!(result.is_ok(), "Failed to extract text: {:?}", result.err());
    let text = result.unwrap();
    assert!(text.contains("Hello"), "Expected 'Hello' in extracted text, got: {}", text);
}

#[test]
fn test_extract_text_from_empty_pdf() {
    let pdf_bytes = create_minimal_pdf("");
    let result = pdf_extract::extract_text_from_mem(&pdf_bytes);
    // Should succeed but with empty/whitespace text
    assert!(result.is_ok(), "Failed on empty PDF: {:?}", result.err());
}

#[test]
fn test_extract_text_from_invalid_bytes() {
    let invalid = b"not a pdf file at all";
    let result = pdf_extract::extract_text_from_mem(invalid);
    assert!(result.is_err(), "Should fail on invalid bytes");
}

#[test]
fn test_extract_text_from_truncated_pdf() {
    let pdf_bytes = create_minimal_pdf("Test content");
    // Truncate to half
    let truncated = &pdf_bytes[..pdf_bytes.len() / 2];
    let result = pdf_extract::extract_text_from_mem(truncated);
    // May succeed or fail — just shouldn't panic
    let _ = result;
}

#[test]
fn test_extract_text_with_doi_in_content() {
    let pdf_bytes = create_minimal_pdf("DOI: 10.1038/s41586-024-07386-0");
    let result = pdf_extract::extract_text_from_mem(&pdf_bytes);
    if let Ok(text) = result {
        assert!(text.contains("10.1038"), "DOI not found in extracted text: {}", text);
    }
}

#[test]
fn test_extract_text_with_unicode() {
    let pdf_bytes = create_minimal_pdf("Ünïcödé tëxt with àccénts");
    let result = pdf_extract::extract_text_from_mem(&pdf_bytes);
    // Should not panic on Unicode content
    assert!(result.is_ok(), "Failed on Unicode PDF: {:?}", result.err());
}

// Note: WASM API tests (IbidEngine.extractPdfText) require wasm-bindgen-test
// and a browser/Node environment. They are tested via E2E tests instead.

// Helper: create a minimal valid PDF with given text content
fn create_minimal_pdf(text: &str) -> Vec<u8> {
    // Minimal PDF 1.4 structure
    let escaped = text.replace('\\', "\\\\").replace('(', "\\(").replace(')', "\\)");
    let stream = format!("BT /F1 12 Tf 100 700 Td ({}) Tj ET", escaped);
    let stream_len = stream.len();

    let mut pdf = String::new();
    pdf.push_str("%PDF-1.4\n");

    // Object 1: Catalog
    let obj1_offset = pdf.len();
    pdf.push_str("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    // Object 2: Pages
    let obj2_offset = pdf.len();
    pdf.push_str("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

    // Object 3: Page
    let obj3_offset = pdf.len();
    pdf.push_str("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n");

    // Object 4: Content stream
    let obj4_offset = pdf.len();
    pdf.push_str(&format!(
        "4 0 obj\n<< /Length {} >>\nstream\n{}\nendstream\nendobj\n",
        stream_len, stream
    ));

    // Object 5: Font
    let obj5_offset = pdf.len();
    pdf.push_str("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

    // Cross-reference table
    let xref_offset = pdf.len();
    pdf.push_str("xref\n0 6\n");
    pdf.push_str("0000000000 65535 f \n");
    pdf.push_str(&format!("{:010} 00000 n \n", obj1_offset));
    pdf.push_str(&format!("{:010} 00000 n \n", obj2_offset));
    pdf.push_str(&format!("{:010} 00000 n \n", obj3_offset));
    pdf.push_str(&format!("{:010} 00000 n \n", obj4_offset));
    pdf.push_str(&format!("{:010} 00000 n \n", obj5_offset));

    // Trailer
    pdf.push_str(&format!(
        "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
        xref_offset
    ));

    pdf.into_bytes()
}
