// Le librerie copiate in lib/ si caricano anche in Node (servono ai test del motore).
const test = require('node:test');
const assert = require('node:assert/strict');
const { librerie } = require('./aiuto.js');

test('le librerie copiate si caricano in Node', () => {
  const { XLSX, JSZip } = librerie();
  assert.equal(XLSX.version, '0.20.3');
  assert.equal(typeof JSZip.loadAsync, 'function');
});
