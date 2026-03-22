// Run all extension JS tests
// Usage: node tests/extension/run-all.js

console.log('\n\x1b[1mIbid — Extension JS Tests\x1b[0m');
console.log('='.repeat(40));

require('./test-extractor');
require('./test-popup-logic');
require('./test-resolver');
require('./test-validation');
require('./test-fallback-parsers');
require('./test-phase4');

const { summary } = require('./test-runner');
summary();
