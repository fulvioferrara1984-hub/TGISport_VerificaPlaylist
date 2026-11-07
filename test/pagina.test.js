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

test('Content-Security-Policy: video e immagini del visual check (blob: creati dalla pagina)', () => {
  const p = politica();
  assert.deepEqual(p.get('media-src'), ["'self'", 'blob:']);
  assert.ok(p.get('img-src').includes('blob:'));
});

test('visual check: scheda, pannello e script nella pagina', () => {
  assert.ok(HTML.includes('id="check-visivo"'));
  assert.ok(HTML.includes('id="revisione"'));
  assert.ok(HTML.indexOf('app/revisione.js') > HTML.indexOf('app/report.js'));
  assert.ok(HTML.indexOf('app/revisione-ui.js') < HTML.indexOf('app/check.js'));
  assert.equal(/\?v=(?!22")/.test(HTML), false, 'versione diversa da 22');
});

test('grafica della Piattaforma: tema applicato nel <head> prima del CSS', () => {
  const testa = HTML.slice(0, HTML.indexOf('</head>'));
  assert.ok(testa.includes('<script src="app/tema.js?v=22"></script>'), 'tema.js nel head');
  assert.ok(testa.indexOf('app/tema.js') < testa.indexOf('app/stile.css'), 'tema.js prima del CSS');
});

test('menu laterale: Workspace con Check e Statistics, More con Settings; cassetto e percorso', () => {
  const voci = [...HTML.matchAll(/<button type="button" class="voce-menu" data-vista="([a-z]+)">/g)].map((m) => m[1]);
  assert.deepEqual(voci, ['check', 'statistics', 'settings']);
  const sezioni = [...HTML.matchAll(/<p class="sezione-menu">([^<]+)<\/p>/g)].map((m) => m[1]);
  assert.deepEqual(sezioni, ['Workspace', 'More']);
  assert.ok(HTML.includes('<aside class="lato" id="menu-laterale">'));
  assert.match(HTML, /<button type="button" class="bottone leggero apri-menu" id="apri-menu" aria-label="Open menu" aria-controls="menu-laterale" aria-expanded="false">/);
  assert.ok(HTML.includes('id="velo-lato"'));
  assert.ok(HTML.includes('id="percorso-vista"'));
  assert.ok(HTML.includes('id="oggi"'));
  ['vista-check', 'vista-statistics', 'vista-settings', 'btn-esci', 'avvisi'].forEach((id) => assert.ok(HTML.includes(`id="${id}"`), id));
});

test('interruttore del tema nel menu e nella pagina di accesso; logo bianco e nero', () => {
  assert.equal((HTML.match(/class="bottone leggero interruttore-tema"/g) || []).length, 2);
  const accesso = HTML.slice(HTML.indexOf('id="accesso"'), HTML.indexOf('class="guscio"'));
  assert.ok(accesso.includes('interruttore-tema'), 'interruttore nella pagina di accesso');
  assert.ok(HTML.includes('src="Logo/TGI-Sport_white.png"') && HTML.includes('src="Logo/TGI-Sport_black.png"'));
  assert.ok(!/class="schede"/.test(HTML), 'le vecchie schede in alto non ci sono più');
});

test('font e logo della grafica sono nel sito', () => {
  const radice = path.join(__dirname, '..');
  ['app/font/montserrat-latin.woff2', 'app/font/OFL.txt', 'Logo/TGI-Sport_white.png', 'Logo/TGI-Sport_black.png'].forEach((f) => assert.ok(fs.existsSync(path.join(radice, f)), f));
});

test('lettura automatica del marchio: moduli nella pagina, libreria caricata solo quando serve, worker dal sito', () => {
  assert.ok(HTML.indexOf('app/lettura-automatica.js') > HTML.indexOf('app/nomi.js'));
  assert.ok(HTML.indexOf('app/lettura-automatica.js') < HTML.indexOf('app/lettura-automatica-ui.js'));
  assert.ok(HTML.indexOf('app/lettura-automatica-ui.js') < HTML.indexOf('app/check.js'));
  assert.equal(/<script src="lib\/tesseract/.test(HTML), false, 'tesseract non si carica all\'apertura');
  assert.deepEqual(politica().get('worker-src'), ["'self'"]);
});

test('lettura automatica: i file della libreria che lo script chiede sono nel sito, con licenza e origine', () => {
  const radice = path.join(__dirname, '..');
  const ui = fs.readFileSync(path.join(radice, 'app/lettura-automatica-ui.js'), 'utf8');
  const chiesti = [...ui.matchAll(/'([a-z0-9.-]+\.(?:js|gz))'/g)].map((m) => m[1]);
  assert.deepEqual(chiesti.sort(), ['tesseract-core-simd-lstm.wasm.js', 'tesseract.min.js', 'worker.min.js']);
  chiesti.concat(['eng.traineddata.gz', 'LICENSE.md', 'ORIGINE.txt']).forEach((f) => assert.ok(fs.existsSync(path.join(radice, 'lib/tesseract', f)), f));
});

test('visual check tutto Correct: la scheda si segna verde quando si ridisegna e quando arriva una lettura automatica', () => {
  const ui = fs.readFileSync(path.join(__dirname, '..', 'app', 'revisione-ui.js'), 'utf8');
  const check = fs.readFileSync(path.join(__dirname, '..', 'app', 'check.js'), 'utf8');
  const segna = /function segnaScheda\(box, ultimo\) \{([\s\S]*?)\n  \}/.exec(ui);
  assert.ok(segna, 'segnaScheda mancante');
  assert.match(segna[1], /PC\.revisione\.tuttoCorretto\(avanzamento\(ultimo\)\)/);
  assert.match(segna[1], /classList\.toggle\('visivo-fatto', /);
  assert.match(segna[1], /\.visivo-esito/);
  assert.match(ui, /PC\.revisioneUi = \{[^}]*\bsegnaScheda\b[^}]*\}/);
  assert.match(/function aggiornaLettura\(ultimo\) \{([\s\S]*?)\n  \}/.exec(ui)[1], /segnaScheda\(box, ultimo\)/);
  assert.match(/function disegnaVisivo\(\) \{([\s\S]*?)\n  \}/.exec(check)[1], /PC\.revisioneUi\.segnaScheda\(box, ultimo\)/);
});
