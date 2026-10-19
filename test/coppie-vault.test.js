// Coppie reali del Vault (solo in locale): PC_VAULT=<cartella con una sottocartella per partita, ognuna con un .xlsx e un .zip>
// e i risultati di riferimento in test/dati-locali/attesi-vault.json ({ cartella: { celle, conteggi } }). Poi errori inseriti apposta
// in una coppia pulita: ognuno deve uscire con fase, slot, zona giusti, e niente altro deve cambiare.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { librerie } = require('./aiuto.js');
const { leggiZipVault, leggiExcelVault } = require('../app/lettura-vault.js');
const { verificaVault } = require('../app/confronto-vault.js');

const { JSZip, XLSX } = librerie();
const v = process.env.PC_VAULT;
const CARTELLA = v && (v.startsWith('~') ? path.join(os.homedir(), v.slice(1)) : v);
const ATTESI = path.join(__dirname, 'dati-locali', 'attesi-vault.json');
const pronto = CARTELLA && fs.existsSync(ATTESI);

async function leggi(dir) {
  const file = fs.readdirSync(dir);
  const x = file.find((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$'));
  const z = file.find((f) => /\.zip$/i.test(f));
  return { excel: leggiExcelVault(fs.readFileSync(path.join(dir, x)), XLSX), zip: await leggiZipVault(fs.readFileSync(path.join(dir, z)), JSZip) };
}

test('coppie reali del Vault uguali ai risultati di riferimento', { skip: pronto ? false : 'PC_VAULT o attesi-vault.json non ci sono' }, async (t) => {
  const attesi = JSON.parse(fs.readFileSync(ATTESI, 'utf8'));
  for (const nome of Object.keys(attesi).sort()) {
    await t.test(nome, async () => {
      const { excel, zip } = await leggi(path.join(CARTELLA, nome));
      const r = verificaVault(excel, zip);
      const conteggi = {};
      r.esiti.forEach((e) => { conteggi[e.tipo] = (conteggi[e.tipo] || 0) + 1; });
      assert.deepEqual({ celle: r.celle, conteggi }, attesi[nome]);
    });
  }
});

const chiave = (e) => [e.tipo, e.feed, e.segmento, String(e.id), e.colonna, e.zona, e.atteso, e.trovato].join(' ¦ ');
function nuovi(prima, dopo) {
  const conta = new Map();
  prima.forEach((e) => conta.set(chiave(e), (conta.get(chiave(e)) || 0) + 1));
  return dopo.filter((e) => { const n = conta.get(chiave(e)) || 0; if (n > 0) { conta.set(chiave(e), n - 1); return false; } return true; });
}

test('Vault: errori inseriti apposta in una coppia reale pulita', { skip: pronto ? false : 'PC_VAULT o attesi-vault.json non ci sono' }, async (t) => {
  const attesi = JSON.parse(fs.readFileSync(ATTESI, 'utf8'));
  const pulita = Object.keys(attesi).sort().find((n) => !Object.keys(attesi[n].conteggi).length);
  const originale = await leggi(path.join(CARTELLA, pulita));
  const base = verificaVault(originale.excel, originale.zip).esiti;
  const foglio = originale.excel.feed[0];
  const stream = (m) => m.zip.stream.find((s) => s.nome.replace(/_/g, ' ') === foglio.nome);
  const fase = (m, nome) => stream(m).fasi.find((f) => f.nome.replace(/_/g, ' ') === nome);
  const riga = (m, n) => m.excel.feed[0].righe.find((r) => r.fase === '1st Half' && r.slotFase === n);
  // primo slot del primo tempo con un file a sinistra; un altro slot con un file diverso
  const n = foglio.righe.find((r) => r.fase === '1st Half' && r.zone.get('Left').file !== 'Not Applicable').slotFase;
  const fileSx = (m, k) => fase(m, '1st Half').intervalli[k - 1].zone.get('Left')[0];
  const altro = foglio.righe.find((r) => r.fase === '1st Half' && r.zone.get('Left').file !== foglio.righe.find((x) => x.fase === '1st Half' && x.slotFase === n).zone.get('Left').file
    && r.zone.get('Left').file !== 'Not Applicable').slotFase;

  async function prova(nome, modifica, controlla) {
    await t.test(nome, () => {
      const m = { excel: structuredClone(originale.excel), zip: structuredClone(originale.zip) };
      modifica(m);
      controlla(nuovi(base, verificaVault(m.excel, m.zip).esiti), m);
    });
  }

  await prova('file di un altro slot a sinistra', (m) => {
    fase(m, '1st Half').intervalli[n - 1].zone.set('Left', [fileSx(m, altro)]);
  }, (d, m) => {
    const errori = d.filter((e) => e.tipo === 'Error');
    assert.deepEqual(errori.map((e) => [e.segmento, e.id, e.zona, e.trovato]), [['1st Half', n, 'Left', fileSx(m, altro).file]]);
    assert.ok(d.every((e) => e.tipo === 'Error' || (e.tipo === 'Warning' && /Partner/.test(e.colonna))));
  });

  await prova('slot da 15 s dove l’Excel ne vuole 20', (m) => {
    const iv = fase(m, '1st Half').intervalli;
    iv[n - 1].durata = 15000;
    for (let i = n; i < iv.length; i++) iv[i].inizio -= 5000;
  }, (d) => {
    const durata = d.filter((e) => /Duration/.test(e.colonna));
    assert.deepEqual(durata.map((e) => [e.tipo, e.segmento, e.id, e.atteso, e.trovato]), [['Error', '1st Half', n, riga(originale, n).durataTesto, '15 s']]);
    assert.ok(d.filter((e) => !durata.includes(e)).every((e) => e.tipo === 'Error' && e.id === n && /video fitting a 15 s slot/.test(e.atteso)));
  });

  await prova('asset che manca nello zip', (m) => {
    m.zip.media.delete(fileSx(m, n).file);
  }, (d, m) => {
    assert.ok(d.length >= 1);
    assert.ok(d.every((e) => e.tipo === 'Error' && e.atteso === 'media file' && e.trovato === 'missing ' + fileSx(m, n).file));
    assert.ok(d.some((e) => e.segmento === '1st Half' && e.id === n && e.zona === 'Left'));
  });

  await prova('partner diverso nell’Excel', (m) => {
    riga(m, n).zone.get('Left').partner = 'Altro Partner';
  }, (d) => {
    assert.deepEqual(d.map((e) => [e.tipo, e.segmento, e.id, e.zona, e.atteso]), [['Warning', '1st Half', n, 'Left', 'Altro Partner']]);
  });

  await prova('"Not Applicable" nell’Excel dove lo zip ha un file', (m) => {
    riga(m, n).zone.get('Right').file = 'Not Applicable';
  }, (d) => {
    assert.deepEqual(d.map((e) => [e.tipo, e.segmento, e.id, e.zona, e.atteso]), [['Error', '1st Half', n, 'Right', 'Not Applicable']]);
  });

  await prova('video a 60 fotogrammi al secondo (16,67") in uno slot da 20"', (m) => {
    m.zip.durateMedia.set(fileSx(m, n).file, { secondi: 1000 / 60, fps: 60, fotogrammi: 1000 });
  }, (d) => {
    assert.ok(d.length >= 1);
    assert.ok(d.every((e) => e.tipo === 'Error' && /video fitting a/.test(e.atteso) && /16\.67 s \(60 fps\)$/.test(e.trovato)));
    assert.ok(d.some((e) => e.segmento === '1st Half' && e.id === n && e.zona === 'Left'));
  });
});
