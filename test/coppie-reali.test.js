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
      const d = differenze(r.esiti.map(riga), attesi[squadra].esiti.map((e) => e.join(' ¦ ')));
      assert.equal(d.totale, 0, `in più nella pagina:\n${d.piu.join('\n')}\nmancanti nella pagina:\n${d.meno.join('\n')}`);
      assert.equal(r.celle, attesi[squadra].celle);
    });
  }
});

