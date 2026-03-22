// Minimal test runner — no dependencies, runs in Node.js
// Usage: node tests/extension/test-runner.js

let passed = 0;
let failed = 0;
let errors = [];

function describe(name, fn) {
  console.log(`\n  ${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    passed++;
    console.log(`    \x1b[32m✓\x1b[0m ${name}`);
  } catch (e) {
    failed++;
    errors.push({ name, error: e.message });
    console.log(`    \x1b[31m✗\x1b[0m ${name}`);
    console.log(`      \x1b[31m${e.message}\x1b[0m`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertContains(str, substr, msg) {
  if (!str.includes(substr)) {
    throw new Error(msg || `Expected "${str}" to contain "${substr}"`);
  }
}

function assertLength(arr, len, msg) {
  if (arr.length !== len) {
    throw new Error(msg || `Expected length ${len}, got ${arr.length}`);
  }
}

// Export for test files
module.exports = { describe, it, assert, assertEqual, assertContains, assertLength, summary };

function summary() {
  console.log(`\n  \x1b[32m${passed} passing\x1b[0m`);
  if (failed > 0) {
    console.log(`  \x1b[31m${failed} failing\x1b[0m`);
    process.exit(1);
  }
}
