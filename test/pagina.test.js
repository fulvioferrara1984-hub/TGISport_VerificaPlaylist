// La pagina (index.html): Content-Security-Policy che limita script, stili e connessioni.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function politica() {
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(HTML);
  if (!m) return null;
  return new Map(m[1].split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([nome, ...valori]) => [nome, valori]));
}

test('Content-Security-Policy: solo file del sito, connessioni solo allo script Google', () => {
  const p = politica();
  assert.ok(p, 'manca la Content-Security-Policy');
  assert.deepEqual(p.get('default-src'), ["'self'"]);
  assert.deepEqual(p.get('script-src'), ["'self'"]);
  assert.deepEqual(p.get('style-src'), ["'self'"]);
  assert.deepEqual(p.get('connect-src'), ["'self'", 'https://script.google.com', 'https://script.googleusercontent.com']);
  assert.deepEqual(p.get('object-src'), ["'none'"]);
  assert.deepEqual(p.get('base-uri'), ["'none'"]);
  assert.ok(HTML.indexOf('Content-Security-Policy') < HTML.indexOf('<script'), 'la policy va prima degli script');
});

test('nessuno script o stile scritto dentro la pagina (la policy li bloccherebbe)', () => {
  assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/.test(HTML), false);
  assert.equal(/<style\b/.test(HTML), false);
  assert.equal(/\sstyle="/.test(HTML), false);
  assert.equal(/\son[a-z]+="/.test(HTML), false);
});
