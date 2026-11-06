// Grafica come la Piattaforma TGI Sport: i due temi di app/stile.css sono leggibili (contrasto WCAG)
// e fuori dai loro blocchi non resta nessun colore scritto a mano.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'stile.css'), 'utf8');
const SCURO = ':root {', CHIARO = ':root[data-tema="chiaro"] {';

// il blocco che inizia con l'intestazione data, fino alla sua graffa di chiusura
function blocco(intestazione) {
  const da = css.indexOf(intestazione);
  return da < 0 ? '' : css.slice(da, css.indexOf('\n}', da) + 2);
}
const variabili = (testo) => Object.fromEntries([...testo.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const temi = { scuro: variabili(blocco(SCURO)), chiaro: { ...variabili(blocco(SCURO)), ...variabili(blocco(CHIARO)) } };

function colore(v) {
  assert.ok(v, 'variabile mancante');
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (h) {
    const x = h[1].length === 3 ? [...h[1]].map((c) => c + c).join('') : h[1];
    return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16), 1];
  }
  const r = /^rgba?\(([^)]+)\)$/.exec(v);
  assert.ok(r, 'colore non leggibile: ' + v);
  const [a, b, c, d] = r[1].split(',').map((n) => Number(n.trim()));
  return [a, b, c, d === undefined ? 1 : d];
}
// un colore trasparente si mescola sul fondo che ha sotto
const sopra = (c, fondo) => [0, 1, 2].map((i) => c[i] * c[3] + fondo[i] * (1 - c[3])).concat(1);
const luce = (c) => {
  const f = (x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
function contrasto(t, testo, fondo) {
  const f = sopra(colore(t[fondo]), colore(t['--pannello']));
  const c = sopra(colore(t[testo]), f);
  const [a, b] = [luce(c), luce(f)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const TESTI = [
  ['--inchiostro', ['--sfondo', '--pannello', '--lato', '--campo', '--intestazione-tabella']],
  ['--inchiostro-2', ['--sfondo', '--pannello', '--lato', '--intestazione-tabella']],
  ['--link', ['--pannello', '--sfondo']],
  ['--accento-scuro', ['--accento-tenue']],
  ['--ok', ['--ok-tenue', '--pannello']], ['--attenzione', ['--attenzione-tenue']], ['--errore', ['--errore-tenue', '--pannello']], ['--grigio', ['--grigio-tenue']],
  ['--su-accento', ['--accento', '--accento-sopra']],
];

for (const [nome, t] of Object.entries(temi)) {
  test(`tema ${nome}: testi leggibili, almeno 4,5:1 sopra i loro fondi`, () => {
    for (const [testo, fondi] of TESTI) for (const fondo of fondi) {
      const r = contrasto(t, testo, fondo);
      assert.ok(r >= 4.5, `${testo} su ${fondo}: ${r.toFixed(2)}`);
    }
  });
  test(`tema ${nome}: testi tenui e accento almeno 3:1 sulle schede`, () => {
    assert.ok(contrasto(t, '--inchiostro-3', '--pannello') >= 3);
    assert.ok(contrasto(t, '--accento', '--pannello') >= 3);
  });
  test(`tema ${nome}: dichiara color-scheme, così i comandi del browser seguono il tema`, () => {
    assert.match(blocco(nome === 'scuro' ? SCURO : CHIARO), /color-scheme:\s*(dark|light);/);
  });
}

test('le variabili della Piattaforma hanno gli stessi valori', () => {
  const comuni = { '--sfondo': ['#05070d', '#edf0f5'], '--pannello': ['#0d1322', '#ffffff'], '--lato': ['#080c16', '#ffffff'],
    '--inchiostro': ['#eef1f8', '#0f1830'], '--accento': ['#1f5cff', '#0b2ff0'], '--errore': ['#ff6259', '#c62f28'], '--ok': ['#4cc77a', '#137a41'] };
  for (const [v, [s, c]] of Object.entries(comuni)) {
    assert.equal(temi.scuro[v], s, v + ' nello scuro');
    assert.equal(temi.chiaro[v], c, v + ' nel chiaro');
  }
  assert.equal(temi.scuro['--raggio'], '16px');
});

test('il pulsante principale sotto il mouse usa il suo fondo', () => {
  assert.match(css, /button\.primario:hover[^{]*\{ background: var\(--accento-sopra\); \}/);
});

test('fuori dai due temi non ci sono colori scritti a mano', () => {
  const resto = css.replace(blocco(SCURO), '').replace(blocco(CHIARO), '');
  assert.deepEqual(resto.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|:\s*(white|black|red|blue|green|gr[ae]y|orange|purple|yellow)\b/gi) || [], []);
});
