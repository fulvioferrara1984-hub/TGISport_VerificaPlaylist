// Lettura del pacchetto e della playlist Excel del Vault (app/lettura-vault.js), con file sintetici.
const test = require('node:test');
const assert = require('node:assert/strict');
const { librerie } = require('./aiuto.js');
const { zipVault, excelVault } = require('./fixture-vault.js');
const { mp4Frammentato } = require('./fixture-air.js');
const { leggiZipVault, leggiExcelVault } = require('../app/lettura-vault.js');

const { JSZip, XLSX } = librerie();
const SX = 'Alfa_C1_X_VBR_-_Alfa_Left.mov';
const DX = 'Alfa_C1_X_VBR_-_Alfa_Right.mov';
const CE = 'Centro_C2_Y_VBR_-_Alfa_Center.png';

test('zip Vault: progetto, zone, feed, fasi, intervalli, asset e durata dei video', async () => {
  const dati = await zipVault(JSZip, {
    feed: { Dark_Market: { 'Pre-match': [{ durata: 20000 }], '1st_Half': [{ durata: 20000, zone: { Left: [SX, 'Alfa'], Center: [CE, 'Centre Boards'], Right: [DX, 'Alfa'] } }] } },
    assets: [[SX, mp4Frammentato(1000, 50)], [DX, mp4Frammentato(1000, 60)], CE],
  });
  const z = await leggiZipVault(dati, JSZip);
  assert.equal(z.sistema, 'Vault');
  assert.deepEqual(z.progetto, { nome: 'Alfa_v_Beta', data: '2026-10-21', venue: 'Stadio Prova', luogo: 'Città' });
  assert.deepEqual([...z.zone.values()], ['Left', 'Center', 'Right']);
  assert.equal(z.stream[0].nome, 'Dark_Market');
  assert.deepEqual(z.stream[0].fasi.map((f) => [f.nome, f.intervalli.length]), [['Pre-match', 1], ['1st_Half', 1]]);
  const iv = z.stream[0].fasi[1].intervalli[0];
  assert.deepEqual([iv.inizio, iv.durata], [0, 20000]);
  assert.deepEqual(iv.zone.get('Left'), [{ file: SX, nome: 'SO_C1', partner: 'Alfa' }]);
  assert.deepEqual(z.stream[0].fasi[0].intervalli[0].zone.get('Center'), []);
  assert.ok(z.media.has(CE));
  assert.deepEqual(z.durateMedia.get(SX), { secondi: 20, fps: 50, fotogrammi: 1000 });
  assert.equal(z.durateMedia.get(DX).fps, 60);
});

test('zip Vault: playlist mancante → intervalli null; uno zip non Vault → null', async () => {
  const dati = await zipVault(JSZip, { feed: { Dark_Market: { '1st_Half': [{ durata: 20000 }] } }, senzaFile: ['1st_Half'] });
  assert.equal((await leggiZipVault(dati, JSZip)).stream[0].fasi[0].intervalli, null);
  const hub = new JSZip();
  hub.file('20261012_x/event.hdm', 'x');
  assert.equal(await leggiZipVault(await hub.generateAsync({ type: 'arraybuffer' }), JSZip), null);
});

test('Excel Vault: partita, stadio, un feed per foglio, zone e righe (durata scritta come testo)', () => {
  const x = leggiExcelVault(excelVault({ feed: {
    'Dark Market': [['Pre-match', 1, '00:00:20', 'NA', 'NA', 'NA'], ['1st Half', 1, '00:00:20', [SX, 'Alfa'], [CE, 'Centre Boards'], [DX, 'Alfa']], ['1st Half', 2, '00:10:00', 'NA', 'NA', 'NA']],
    'Other Feed': [['1st Half', 1, '00:00:20', 'NA', 'NA', 'NA']],
  } }), XLSX);
  assert.equal(x.sistema, 'Vault');
  assert.deepEqual([x.partita, x.stadio], ['Alfa v Beta', 'Stadio Prova']);
  assert.deepEqual(x.feed.map((f) => f.nome), ['Dark Market', 'Other Feed']);
  const f = x.feed[0];
  assert.deepEqual(f.zone, [{ nome: 'Left', colFile: 5, colPartner: 6 }, { nome: 'Center', colFile: 7, colPartner: 8 }, { nome: 'Right', colFile: 9, colPartner: 10 }]);
  assert.equal(f.colDurata, 4);
  assert.deepEqual(f.righe.map((r) => [r.riga, r.fase, r.slotFase, r.durataMs, r.durataTesto]),
    [[8, 'Pre-match', 1, 20000, '00:00:20'], [9, '1st Half', 1, 20000, '00:00:20'], [10, '1st Half', 2, 600000, '00:10:00']]);
  assert.deepEqual(f.righe[1].zone.get('Center'), { file: CE, partner: 'Centre Boards' });
  assert.deepEqual(f.righe[0].zone.get('Left'), { file: 'Not Applicable', partner: 'NA' });
});

test('Excel non Vault (Hub): null', () => {
  const { cartella } = require('./fixture-excel.js');
  assert.equal(leggiExcelVault(cartella({ righe: [[1, 15, 'ALFA']] }), XLSX), null);
});
