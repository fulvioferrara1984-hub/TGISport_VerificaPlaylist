// Controllo incrociato sulle coppie reali: il motore della pagina deve dare esattamente i risultati del prototipo Python.
// Solo in locale: PC_COPPIE=<cartella con una sottocartella per squadra> e test/dati-locali/attesi.json (generato dal prototipo).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { coppieReali, leggiCoppia } = require('./aiuto.js');
const { verifica } = require('../app/confronto.js');

const CARTELLA = coppieReali();
const ATTESI = path.join(__dirname, 'dati-locali', 'attesi.json');
const REGOLE = path.join(__dirname, '..', 'regole-sorgente', 'regole.json');
const pronto = CARTELLA && fs.existsSync(ATTESI) && fs.existsSync(REGOLE);

const ATTESI_FORMATI = path.join(__dirname, 'dati-locali', 'attesi-formati.json');
// il prototipo non legge i file media: gli artwork di un'altra zona hanno il loro calcolo indipendente (attesi-formati.json)
const diFormato = (e) => String(e.atteso).startsWith('artwork sized for ');

const riga = (e) => [e.tipo, e.feed, e.segmento, String(e.id), e.colonna, e.zona, e.atteso, e.trovato].join(' ¦ ');

// Differenze tra due multinsiemi di righe: quelle in più e quelle mancanti.
function differenze(js, py) {
  const conta = new Map();
  js.forEach((r) => conta.set(r, (conta.get(r) || 0) + 1));
  py.forEach((r) => conta.set(r, (conta.get(r) || 0) - 1));
  const piu = [], meno = [];
  conta.forEach((n, r) => { if (n > 0) piu.push(`${n}× ${r}`); if (n < 0) meno.push(`${-n}× ${r}`); });
  return { piu: piu.slice(0, 15), meno: meno.slice(0, 15), totale: piu.length + meno.length };
}

test('coppie reali uguali al prototipo Python', { skip: pronto ? false : 'PC_COPPIE o i dati locali non ci sono' }, async (t) => {
  const attesi = JSON.parse(fs.readFileSync(ATTESI, 'utf8'));
  const regole = JSON.parse(fs.readFileSync(REGOLE, 'utf8'));
  for (const squadra of Object.keys(attesi).sort()) {
    await t.test(squadra, async () => {
      const { excel, air } = await leggiCoppia(path.join(CARTELLA, squadra));
      const r = verifica(excel, air, regole);
      const d = differenze(r.esiti.filter((e) => !diFormato(e)).map(riga), attesi[squadra].esiti.map((e) => e.join(' ¦ ')));
      assert.equal(d.totale, 0, `in più nella pagina:\n${d.piu.join('\n')}\nmancanti nella pagina:\n${d.meno.join('\n')}`);
      assert.equal(r.celle, attesi[squadra].celle);
    });
  }
});

test('artwork di un’altra zona: coppie reali uguali al calcolo indipendente', { skip: CARTELLA && fs.existsSync(ATTESI_FORMATI) && fs.existsSync(REGOLE) ? false : 'PC_COPPIE o i dati locali non ci sono' }, async (t) => {
  const attesi = JSON.parse(fs.readFileSync(ATTESI_FORMATI, 'utf8'));
  const regole = JSON.parse(fs.readFileSync(REGOLE, 'utf8'));
  const breve = (x) => x.join(' ¦ ');
  for (const squadra of Object.keys(attesi).sort()) {
    await t.test(squadra, async () => {
      const { excel, air } = await leggiCoppia(path.join(CARTELLA, squadra));
      const trovati = verifica(excel, air, regole).esiti.filter(diFormato);
      assert.ok(trovati.every((e) => e.tipo === 'Error' && e.colonna === '-'));
      const d = differenze(trovati.map((e) => breve([e.feed, e.segmento, String(e.id), e.zona, e.atteso, e.trovato])), attesi[squadra].map(breve));
      assert.equal(d.totale, 0, `in più nella pagina:\n${d.piu.join('\n')}\nmancanti nella pagina:\n${d.meno.join('\n')}`);
    });
  }
});
