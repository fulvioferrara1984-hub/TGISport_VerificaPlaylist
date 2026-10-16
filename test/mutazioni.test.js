// Errori inseriti apposta in una coppia reale (la prima, in ordine alfabetico, di PC_COPPIE): ognuno deve uscire
// con feed, segmento, ID e colonna giusti, e niente altro deve cambiare. Solo in locale.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { coppieReali, leggiCoppia } = require('./aiuto.js');
const { verifica } = require('../app/confronto.js');
const { lettera } = require('../app/confronto-virtual.js');

const CARTELLA = coppieReali();
const REGOLE = path.join(__dirname, '..', 'regole-sorgente', 'regole.json');
const pronto = CARTELLA && fs.existsSync(REGOLE);

const chiave = (e) => [e.tipo, e.feed, e.segmento, String(e.id), e.colonna, e.zona, e.atteso, e.trovato].join(' ¦ ');
// esiti presenti dopo la modifica e non prima (multinsieme)
function nuovi(prima, dopo) {
  const conta = new Map();
  prima.forEach((e) => conta.set(chiave(e), (conta.get(chiave(e)) || 0) + 1));
  return dopo.filter((e) => {
    const n = conta.get(chiave(e)) || 0;
    if (n > 0) { conta.set(chiave(e), n - 1); return false; }
    return true;
  });
}

test('errori inseriti apposta', { skip: pronto ? false : 'PC_COPPIE o regole-sorgente non ci sono' }, async (t) => {
  const squadra = fs.readdirSync(CARTELLA).filter((d) => fs.statSync(path.join(CARTELLA, d)).isDirectory()).sort()[0];
  const regole = JSON.parse(fs.readFileSync(REGOLE, 'utf8'));
  const originale = await leggiCoppia(path.join(CARTELLA, squadra));
  const base = verifica(originale.excel, originale.air, regole).esiti;
  const tab = originale.excel.partite.MATCH;
  const seg = (air, feed) => air.stream.find((s) => s.nome === feed).segmenti.find((g) => g.nome.includes('1st'));
  const idZona = (air, nome) => [...air.zone].find(([, z]) => z === nome)[0];
  // prima riga con contenuto per Europa (prima fila) e North America
  const pos = tab.righe.findIndex((r) => r.valori.get('EU|1') && r.valori.get('NA|1')) + 1;
  const ID = tab.righe[pos - 1].id;
  const colEU1 = `${lettera(tab.colonne.get('EU|1'))} · EUROPE – First row`;
  const colEU2 = `${lettera(tab.colonne.get('EU|2'))} · EUROPE – Second row`;
  const zone2 = ['GL_SX_2', 'TL_2', 'GL_DX_2'];

  async function prova(nome, modifica, controlla) {
    await t.test(nome, () => {
      const m = structuredClone(originale);
      modifica(m);
      controlla(nuovi(base, verifica(m.excel, m.air, regole).esiti), m);
    });
  }

  // slot dello stesso feed con un altro brand (artwork vero del pacchetto): è lo scambio che si vuole trovare
  const altroSlot = (air) => {
    const ivs = seg(air, 'Europa').intervalli;
    const qui = ivs[pos].mappe.get(0).ad.split('_')[0];
    return ivs.find((iv) => iv.mappe.get(0) && iv.mappe.get(0).ad !== 'Blank_Generic' && iv.mappe.get(0).ad.split('_')[0] !== qui);
  };

  await prova('brand scambiato in prima fila', (m) => {
    const da = altroSlot(m.air);
    seg(m.air, 'Europa').intervalli[pos].mappe.set(0, da.mappe.get(0));
    m.atteso = da.mappe.get(0).ad;
  }, (n, m) => {
    assert.deepEqual(n.map((e) => [e.tipo, e.feed, e.id, e.colonna, e.zona, e.trovato]), [['Error', 'Europa', ID, colEU1, 'FULL PERIMETER', m.atteso]]);
  });

  await prova('brand scambiato in seconda fila', (m) => {
    const da = altroSlot(m.air);
    zone2.forEach((z) => { const id = idZona(m.air, z); seg(m.air, 'Europa').intervalli[pos].mappe.set(id, da.mappe.get(id)); });
    m.attesi = zone2.map((z) => da.mappe.get(idZona(m.air, z)).ad);
  }, (n, m) => {
    assert.deepEqual(n.map((e) => [e.tipo, e.feed, e.id, e.colonna]), zone2.map(() => ['Error', 'Europa', ID, colEU2]));
    assert.deepEqual(n.map((e) => e.zona).sort(), [...zone2].sort());
    assert.deepEqual(n.map((e) => e.trovato).sort(), [...m.attesi].sort());
  });

  await prova('file della fila sbagliata', (m) => {
    const iv = seg(m.air, 'Europa').intervalli[pos];
    zone2.forEach((z) => iv.mappe.set(idZona(m.air, z), iv.mappe.get(0)));
  }, (n) => {
    assert.equal(n.length, 1);
    assert.deepEqual([n[0].tipo, n[0].feed, n[0].id, n[0].colonna], ['Error', 'Europa', ID, colEU2]);
    assert.match(n[0].trovato, /\(first-row file\)$/);
  });

  await prova('durata sbagliata nell’Excel', (m) => {
    Object.assign(m.excel.partite.MATCH.righe[4], { durataMs: 30000, durataTesto: '00:00:30' });
  }, (n, m) => {
    const feed = m.air.stream.length;
    assert.equal(n.length, feed);
    n.forEach((e) => assert.deepEqual([e.tipo, e.id, e.colonna, e.atteso, e.trovato], ['Error', tab.righe[4].id, `C${tab.righe[4].riga} · Duration`, '00:00:30', '15 s']));
  });

  // durata di uno slot: l'Excel dice `excelMs`, lo zip ha `zipMs` solo in Europa (gli altri feed sono giusti);
  // lo zip resta coerente: gli slot successivi si spostano della differenza
  const cambiaDurata = (g, idx, ms) => {
    const delta = ms - g.intervalli[idx].durata;
    g.intervalli[idx].durata = ms;
    for (let i = idx + 1; i < g.intervalli.length; i++) g.intervalli[i].inizio += delta;
  };
  for (const [excelMs, zipMs] of [[20000, 10000], [10000, 20000]]) {
    const testo = `00:00:${String(excelMs / 1000).padStart(2, '0')}`;
    await prova(`slot da ${zipMs / 1000} s dove l'Excel ne vuole ${excelMs / 1000}`, (m) => {
      Object.assign(m.excel.partite.MATCH.righe[pos - 1], { durataMs: excelMs, durataTesto: testo });
      m.air.stream.forEach((s) => s.segmenti.filter((g) => g.nome.includes('1st')).forEach((g) => cambiaDurata(g, pos, s.nome === 'Europa' ? zipMs : excelMs)));
    }, (n) => {
      assert.deepEqual(n.map((e) => [e.tipo, e.feed, e.id, e.colonna, e.atteso, e.trovato]),
        [['Error', 'Europa', ID, `C${tab.righe[pos - 1].riga} · Duration`, testo, `${zipMs / 1000} s`]]);
    });
  }

  await prova('CLUB MAT mancante', (m) => {
    seg(m.air, 'Europa').intervalli[10].mappe.delete(idZona(m.air, 'CLUB_LSX'));
  }, (n) => {
    assert.equal(n.length, 1);
    assert.deepEqual([n[0].tipo, n[0].feed, n[0].id, n[0].zona, n[0].trovato], ['Error', 'Europa', 10, 'CLUB_LSX', 'nothing']);
    assert.match(n[0].colonna, /^STATIC [A-Z]+4 · CLUB MAT 1$/);
  });

  await prova('artwork al posto di Blank', (m) => {
    const posVuota = tab.righe.findIndex((r, i) => i < pos && !r.valori.get('EU|1') && !r.valori.get('EU|2')) + 1;
    const iv = seg(m.air, 'Europa').intervalli[posVuota];
    iv.mappe.set(0, { ...seg(m.air, 'Europa').intervalli[pos].mappe.get(0), ad: 'ZZTEST_GC1', advertiser: 'CASA_ZZTEST_1' });
    m.posVuota = posVuota;
  }, (n, m) => {
    assert.deepEqual(n.map((e) => [e.tipo, e.feed, e.id, e.colonna, e.atteso, e.trovato]), [['Error', 'Europa', tab.righe[m.posVuota - 1].id, colEU1, 'Blank', 'ZZTEST_GC1']]);
  });

  await prova('artwork al posto di Circle_Empty sul centro campo', (m) => {
    const iv = seg(m.air, 'Europa').intervalli[10];
    m.artCC = seg(m.air, 'Europa').intervalli[pos].mappe.get(0);
    iv.mappe.set(idZona(m.air, 'CC'), m.artCC);
  }, (n, m) => {
    assert.deepEqual(n.map((e) => [e.tipo, e.feed, e.id, e.zona, e.atteso, e.trovato]), [['Error', 'Europa', 10, 'CC', 'Circle_Empty', m.artCC.ad]]);
  });

  await prova('file media rimosso', (m) => {
    m.file = seg(m.air, 'Europa').intervalli[pos].mappe.get(0).file.split('/').pop();
    m.air.media.delete(m.file);
  }, (n, m) => {
    let usi = 0;
    m.air.stream.forEach((s) => s.segmenti.forEach((g) => (g.intervalli || []).forEach((iv) => iv.mappe.forEach((a) => { if (a.file.endsWith('/' + m.file)) usi++; }))));
    assert.equal(n.length, usi);
    n.forEach((e) => assert.deepEqual([e.tipo, e.atteso, e.trovato], ['Error', 'media file', 'missing ' + m.file]));
  });

  await prova('refuso nel nome Excel', (m) => {
    const r = m.excel.partite.MATCH.righe[pos - 1];
    const v = r.valori.get('EU|1');
    r.valori.set('EU|1', v.slice(0, -1) + (v.slice(-1) === 'Q' ? 'W' : 'Q'));
    m.refuso = r.valori.get('EU|1');
  }, (n, m) => {
    assert.ok(n.length >= 1);
    n.forEach((e) => assert.deepEqual([e.tipo, e.feed, e.id, e.colonna, e.atteso], ['Possible typo', 'Europa', ID, colEU1, m.refuso]));
  });

  await prova('feed Domestico rimosso (solo asset statici nell’Excel)', (m) => {
    m.air.stream = m.air.stream.filter((s) => s.nome !== 'Domestico');
  }, (n) => {
    assert.deepEqual(n.map((e) => [e.tipo, e.feed, e.atteso, e.trovato]), [['Error', 'DOMESTIC', 'AIR feed for DOMESTIC', 'missing']]);
  });

  for (const tipo of ['Highlights', '1st', 'Pre Match']) {
    await prova(`segmento ${tipo} rimosso da Europa`, (m) => {
      const s = m.air.stream.find((x) => x.nome === 'Europa');
      s.segmenti = s.segmenti.filter((g) => !g.nome.startsWith(tipo));
    }, (n) => {
      assert.equal(n.length, 1);
      assert.deepEqual([n[0].tipo, n[0].feed, n[0].atteso, n[0].trovato], ['Error', 'Europa', 'AIR sequence', 'missing']);
    });
  }

  await prova('feed Mena rimosso', (m) => {
    m.air.stream = m.air.stream.filter((s) => s.nome !== 'Mena');
  }, (n) => {
    assert.deepEqual(n.map((e) => [e.tipo, e.feed, e.atteso, e.trovato]), [['Error', 'MENA+SSA', 'AIR feed for MENA+SSA', 'missing']]);
  });

  await prova('colonne diverse nel feed condiviso', (m) => {
    m.excel.partite.MATCH.righe[pos - 1].valori.set('CSA|1', 'ZZTEST');
  }, (n) => {
    assert.equal(n.length, 1);
    assert.deepEqual([n[0].tipo, n[0].id, n[0].colonna, n[0].atteso], ['Error', ID, 'PLAYLIST · NORTH AMERICA/CENTRAL & SOUTH AMERICA', 'same value (shared feed)']);
    assert.match(n[0].trovato, /ZZTEST/);
  });
});
