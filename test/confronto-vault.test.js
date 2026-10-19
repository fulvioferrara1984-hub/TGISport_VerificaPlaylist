// Confronto Excel ↔ pacchetto del Vault (app/confronto-vault.js), con file sintetici letti dai lettori veri.
const test = require('node:test');
const assert = require('node:assert/strict');
const { librerie } = require('./aiuto.js');
const { zipVault, excelVault } = require('./fixture-vault.js');
const { mp4Frammentato } = require('./fixture-air.js');
const { leggiZipVault, leggiExcelVault } = require('../app/lettura-vault.js');
const { verificaVault } = require('../app/confronto-vault.js');

const { JSZip, XLSX } = librerie();
const F = (brand, lato) => `${brand}_C1_X_VBR_-_Alfa_${lato}.mov`;
const CE = 'Centro_C2_Y_VBR_-_Alfa_Center.png';
const SH = (lato) => `SH_UCL_Stadio_Prova_${lato}.mov`;
// slot della playlist: brand a sinistra e destra, centro fisso
const slot = (brand, durata = 20000) => ({ durata, zone: { Left: [F(brand, 'Left'), brand], Center: [CE, 'Centre Boards'], Right: [F(brand, 'Right'), brand] } });
// riga dell'Excel corrispondente
const riga = (fase, n, brand, durata = '00:00:20') => [fase, n, durata, [F(brand, 'Left'), brand], [CE, 'Centre Boards'], [F(brand, 'Right'), brand]];
const video = (...brand) => brand.flatMap((b) => [[F(b, 'Left'), mp4Frammentato(1000, 50)], [F(b, 'Right'), mp4Frammentato(1000, 50)]]).concat([CE]);

async function prova({ fasi, righe, assets = video('Alfa', 'Beta'), partita, feedZip, feedExcel }) {
  const zip = await leggiZipVault(await zipVault(JSZip, { feed: feedZip || { Dark_Market: fasi }, assets }), JSZip);
  const excel = leggiExcelVault(excelVault({ partita, feed: feedExcel || { 'Dark Market': righe } }), XLSX);
  return verificaVault(excel, zip);
}
const breve = (esiti) => esiti.map(({ tipo, segmento, id, colonna, zona, atteso, trovato }) => ({ tipo, segmento, id, colonna, zona, atteso, trovato }));
const BASE = { 'Pre-match': [{ durata: 20000 }], '1st_Half': [slot('Alfa'), slot('Beta')] };
const RIGHE = [['Pre-match', 1, '00:00:20', 'NA', 'NA', 'NA'], riga('1st Half', 1, 'Alfa'), riga('1st Half', 2, 'Beta')];

test('tutto coerente: nessun risultato; celle = righe × (durata + zone)', async () => {
  const r = await prova({ fasi: BASE, righe: RIGHE });
  assert.deepEqual(r.esiti, []);
  assert.equal(r.celle, 3 * 4);
});

test('file sbagliato in una zona: Error con fase, slot, colonna e zona; Center come le altre zone', async () => {
  const r = await prova({ fasi: { ...BASE, '1st_Half': [slot('Alfa'), { ...slot('Beta'), zone: { ...slot('Beta').zone, Center: ['Altro_Center.png', 'Centre Boards'] } }] }, righe: RIGHE,
    assets: video('Alfa', 'Beta').concat(['Altro_Center.png']) });
  assert.deepEqual(breve(r.esiti), [{ tipo: 'Error', segmento: '1st Half', id: 2, colonna: 'H · Center – File name', zona: 'Center', atteso: CE, trovato: 'Altro_Center.png' }]);
});

test('Not Applicable con un asset nello zip: Error; file atteso e zona vuota: Error', async () => {
  const r = await prova({ fasi: { 'Pre-match': [{ durata: 20000, zone: { Left: [F('Alfa', 'Left'), 'Alfa'] } }], '1st_Half': [slot('Alfa'), { durata: 20000, zone: { ...slot('Beta').zone, Right: null } }] }, righe: RIGHE });
  assert.deepEqual(breve(r.esiti), [
    { tipo: 'Error', segmento: 'Pre-match', id: 1, colonna: 'F · Left – File name', zona: 'Left', atteso: 'Not Applicable', trovato: F('Alfa', 'Left') },
    { tipo: 'Error', segmento: '1st Half', id: 2, colonna: 'J · Right – File name', zona: 'Right', atteso: F('Beta', 'Right'), trovato: 'nothing' },
  ]);
});

test('partner diverso: avviso', async () => {
  const r = await prova({ fasi: BASE, righe: [RIGHE[0], RIGHE[1], ['1st Half', 2, '00:00:20', [F('Beta', 'Left'), 'Gamma'], [CE, 'Centre Boards'], [F('Beta', 'Right'), 'Beta']]] });
  assert.deepEqual(breve(r.esiti), [{ tipo: 'Warning', segmento: '1st Half', id: 2, colonna: 'G · Left – Partner', zona: 'Left', atteso: 'Gamma', trovato: 'Beta' }]);
});

test('durata diversa: Error sulla cella della durata', async () => {
  const r = await prova({ fasi: BASE, righe: [RIGHE[0], riga('1st Half', 1, 'Alfa', '00:00:15'), RIGHE[2]] });
  assert.deepEqual(breve(r.esiti), [{ tipo: 'Error', segmento: '1st Half', id: 1, colonna: 'E9 · Duration', zona: '-', atteso: '00:00:15', trovato: '20 s' }]);
});

test('asset che manca nella cartella assets/: Error', async () => {
  const r = await prova({ fasi: BASE, righe: RIGHE, assets: video('Alfa', 'Beta').filter((a) => (Array.isArray(a) ? a[0] : a) !== F('Beta', 'Right')) });
  assert.deepEqual(breve(r.esiti), [{ tipo: 'Error', segmento: '1st Half', id: 2, colonna: '-', zona: 'Right', atteso: 'media file', trovato: 'missing ' + F('Beta', 'Right') }]);
});

test('video che non sta nello slot: Error con i fotogrammi al secondo; un video che gira più volte va bene', async () => {
  const assets = [[F('Alfa', 'Left'), mp4Frammentato(1000, 50)], [F('Alfa', 'Right'), mp4Frammentato(1000, 60)], [F('Beta', 'Left'), mp4Frammentato(1000, 50)], [F('Beta', 'Right'), mp4Frammentato(1000, 50)], CE];
  const r = await prova({ fasi: { ...BASE, '1st_Half': [slot('Alfa'), slot('Beta', 600000)] }, righe: [RIGHE[0], RIGHE[1], riga('1st Half', 2, 'Beta', '00:10:00')], assets });
  assert.deepEqual(breve(r.esiti), [{ tipo: 'Error', segmento: '1st Half', id: 1, colonna: '-', zona: 'Right', atteso: 'video fitting a 20 s slot', trovato: `${F('Alfa', 'Right')} · 16.67 s (60 fps)` }]);
});

test('variante del pacchetto: fasi in più, pre-match con contenuti e ultimo slot più corto sono avvisi, non errori', async () => {
  const sh = { Left: [SH('LS'), 'Global Shared'], Center: [CE, 'Centre Boards'], Right: [SH('RS'), 'Global Shared'] };
  const fasi = { 'Pre-match': [{ durata: 20000, zone: sh }, { durata: 20000, zone: sh }], '1st_Half': [slot('Alfa'), { durata: 20000, zone: sh }], 'Half-time': [{ durata: 20000, zone: sh }] };
  const assets = video('Alfa').concat([[SH('LS'), mp4Frammentato(1000, 50)], [SH('RS'), mp4Frammentato(1000, 50)]]);
  const righe = [['Pre-match', 1, '00:00:20', 'NA', 'NA', 'NA'], riga('1st Half', 1, 'Alfa'), ['1st Half', 2, '00:10:00', [SH('LS'), 'Global Shared'], [CE, 'Centre Boards'], [SH('RS'), 'Global Shared']]];
  const r = await prova({ fasi, righe, assets });
  assert.ok(r.esiti.length > 0);
  assert.ok(r.esiti.every((e) => e.tipo === 'Warning'), JSON.stringify(r.esiti.filter((e) => e.tipo !== 'Warning')));
  assert.ok(r.esiti.some((e) => e.segmento === 'Half-time' && /package variant/.test(e.trovato)));
  assert.ok(r.esiti.some((e) => e.segmento === 'Pre-match' && e.atteso === 'Not Applicable'));
  assert.ok(r.esiti.some((e) => e.segmento === 'Pre-match' && e.atteso === '1 slots (Excel)'));
  assert.ok(r.esiti.some((e) => e.segmento === '1st Half' && e.id === 2 && /Duration/.test(e.colonna)));
});

test('senza variante l’ultimo slot più corto è un errore', async () => {
  const r = await prova({ fasi: BASE, righe: [RIGHE[0], RIGHE[1], riga('1st Half', 2, 'Beta', '00:10:00')] });
  assert.deepEqual(breve(r.esiti).map((e) => [e.tipo, e.id, e.atteso, e.trovato]), [['Error', 2, '00:10:00', '20 s']]);
});

test('feed: un foglio per feed abbinato allo stream con lo stesso nome; foglio o stream senza l’altro: Error', async () => {
  const r = await prova({ feedZip: { Dark_Market: BASE, Second_Feed: BASE }, feedExcel: { 'Dark Market': RIGHE, 'Third Feed': RIGHE } });
  assert.deepEqual(r.esiti.map((e) => [e.tipo, e.feed, e.atteso, e.trovato]), [['Error', 'Second Feed', 'Excel sheet for Second Feed', 'missing'], ['Error', 'Third Feed', 'Vault stream for Third Feed', 'missing']]);
  assert.equal(r.celle, 3 * 4);
});

test('riepilogo: sistema, partita e squadre, data, feed e fasi; partite diverse', async () => {
  const r = await prova({ fasi: BASE, righe: RIGHE });
  const { sistema, partita, casa, ospite, venue, dataEvento, partiteDiverse, feed, segmenti } = r.riepilogo;
  assert.deepEqual({ sistema, partita, casa, ospite, venue, dataEvento, partiteDiverse, feed, segmenti },
    { sistema: 'Vault', partita: 'Alfa v Beta', casa: 'Alfa', ospite: 'Beta', venue: 'Stadio Prova', dataEvento: '2026-10-21', partiteDiverse: false, feed: ['Dark Market'], segmenti: ['Pre-match', '1st Half'] });
  assert.equal((await prova({ fasi: BASE, righe: RIGHE, partita: 'Gamma v Delta' })).riepilogo.partiteDiverse, true);
});
