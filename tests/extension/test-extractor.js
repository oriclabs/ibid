// Test: Content script metadata extraction logic
// Tests the pure functions from extractor.js (name parsing, date parsing)

const { describe, it, assertEqual, assertLength, assert, assertContains } = require('./test-runner');

// =============================================================================
// Replicate the pure functions from extractor.js for testing
// =============================================================================

function parseName(str) {
  if (!str) return { literal: '' };
  str = str.trim().replace(/^by\s+/i, '');
  if (str.includes(',')) {
    const [family, given] = str.split(',', 2).map((s) => s.trim());
    return { family, given };
  }
  const parts = str.split(/\s+/);
  if (parts.length === 1) return { literal: parts[0] };
  const family = parts.pop();
  const given = parts.join(' ');
  return { family, given };
}

function parseDate(str) {
  if (!str) return null;
  str = str.trim();
  const isoMatch = str.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/);
  if (isoMatch) {
    const parts = [parseInt(isoMatch[1], 10)];
    if (isoMatch[2]) parts.push(parseInt(isoMatch[2], 10));
    if (isoMatch[3]) parts.push(parseInt(isoMatch[3], 10));
    return { 'date-parts': [parts] };
  }
  const ts = Date.parse(str);
  if (!isNaN(ts)) {
    const d = new Date(ts);
    return { 'date-parts': [[d.getFullYear(), d.getMonth() + 1, d.getDate()]] };
  }
  return { literal: str };
}

// =============================================================================
// Name parsing tests
// =============================================================================

describe('Name parsing', () => {
  it('parses "Last, First" format', () => {
    const n = parseName('Smith, John');
    assertEqual(n.family, 'Smith');
    assertEqual(n.given, 'John');
  });

  it('parses "First Last" format', () => {
    const n = parseName('John Smith');
    assertEqual(n.family, 'Smith');
    assertEqual(n.given, 'John');
  });

  it('parses "First Middle Last" format', () => {
    const n = parseName('John Andrew Smith');
    assertEqual(n.family, 'Smith');
    assertEqual(n.given, 'John Andrew');
  });

  it('strips "by" prefix', () => {
    const n = parseName('by Jane Doe');
    assertEqual(n.family, 'Doe');
    assertEqual(n.given, 'Jane');
  });

  it('strips "By" prefix (case-insensitive)', () => {
    const n = parseName('By Jane Doe');
    assertEqual(n.family, 'Doe');
    assertEqual(n.given, 'Jane');
  });

  it('handles single name as literal', () => {
    const n = parseName('Madonna');
    assertEqual(n.literal, 'Madonna');
  });

  it('handles empty string', () => {
    const n = parseName('');
    assertEqual(n.literal, '');
  });

  it('handles null', () => {
    const n = parseName(null);
    assertEqual(n.literal, '');
  });

  it('trims whitespace', () => {
    const n = parseName('  Smith ,  John  ');
    assertEqual(n.family, 'Smith');
    assertEqual(n.given, 'John');
  });
});

// =============================================================================
// Date parsing tests
// =============================================================================

describe('Date parsing', () => {
  it('parses ISO YYYY-MM-DD', () => {
    const d = parseDate('2023-06-15');
    assertEqual(d['date-parts'][0][0], 2023);
    assertEqual(d['date-parts'][0][1], 6);
    assertEqual(d['date-parts'][0][2], 15);
  });

  it('parses ISO YYYY-MM', () => {
    const d = parseDate('2023-06');
    assertEqual(d['date-parts'][0][0], 2023);
    assertEqual(d['date-parts'][0][1], 6);
    assertLength(d['date-parts'][0], 2);
  });

  it('parses ISO YYYY', () => {
    const d = parseDate('2023');
    assertEqual(d['date-parts'][0][0], 2023);
    assertLength(d['date-parts'][0], 1);
  });

  it('parses natural date string', () => {
    const d = parseDate('June 15, 2023');
    assertEqual(d['date-parts'][0][0], 2023);
  });

  it('returns literal for unparseable string', () => {
    const d = parseDate('ca. 350 BCE');
    assertEqual(d.literal, 'ca. 350 BCE');
  });

  it('returns null for empty string', () => {
    assertEqual(parseDate(''), null);
  });

  it('returns null for null', () => {
    assertEqual(parseDate(null), null);
  });

  it('trims whitespace', () => {
    const d = parseDate('  2023-01-01  ');
    assertEqual(d['date-parts'][0][0], 2023);
  });
});
