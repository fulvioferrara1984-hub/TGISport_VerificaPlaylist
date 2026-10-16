// Lettura della playlist Excel (app/lettura-excel.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { librerie } = require('./aiuto.js');
const { cartella } = require('./fixture-excel.js');
const { leggiExcel, regione } = require('../app/lettura-excel.js');

const { XLSX } = librerie();

test('sinonimi delle regioni', () => {
  assert.equal(regione('NORD AMERICA\nVIRTUAL'), 'NA');
  assert.equal(regione('CENTRO-SUD AMERICA\nVIRTUAL'), 'CSA');
  assert.equal(regione('EUROPE\nVIRTUAL '), 'EU');
  assert.equal(regione('MENA'), 'MENA');
  assert.equal(regione('ASIA FAR EAST\nVIRTUAL'), 'FE');
  assert.equal(regione('DOMESTIC'), 'DOM');
  assert.equal(regione('Legenda stagionali'), null);
});

test('due file per regione, sinonimi e TRANSPARENT', () => {
  const x = leggiExcel(cartella({ intestazioni: ['NORD AMERICA\nVIRTUAL', 'EUROPA\nVIRTUAL'], file: 2, righe: [[1, 15, 'ALFA', 'TRANSPARENT', 'BETA', '']] }), XLSX);
  const t = x.partite.MATCH;
  assert.equal(t.foglio, 'PLAYLIST');
  assert.equal(t.colonne.get('NA|1'), 5);
  assert.equal(t.colonne.get('EU|2'), 8);
  assert.equal(t.soloPrimaFila, false);
  assert.equal(t.righe.length, 1);
  assert.deepEqual({ id: t.righe[0].id, riga: t.righe[0].riga, durataMs: t.righe[0].durataMs, durataTesto: t.righe[0].durataTesto },
    { id: 1, riga: 6, durataMs: 15000, durataTesto: '00:00:15' });
  assert.equal(t.righe[0].valori.get('NA|1'), 'ALFA');
  assert.equal(t.righe[0].valori.get('NA|2'), null);
  assert.equal(t.righe[0].valori.get('EU|1'), 'BETA');
  assert.equal(t.righe[0].valori.get('EU|2'), null);
});

test('durata oltre il giorno (template rotto): ms e testo come in Excel', () => {
  const x = leggiExcel(cartella({ intestazioni: ['EUROPE\nVIRTUAL'], righe: [[1, 86400 + 17 * 3600 + 15, '', '']] }), XLSX);
  assert.equal(x.partite.MATCH.righe[0].durataMs, (86400 + 17 * 3600 + 15) * 1000);
  assert.equal(x.partite.MATCH.righe[0].durataTesto, '17:00:15');
});

test('solo prima fila e foglio highlights con nome qualsiasi', () => {
  const x = leggiExcel(cartella({ intestazioni: ['EUROPE\nVIRTUAL'], file: 1, nomeHL: 'Foglio1', righe: [[1, 15, 'ALFA']], righeHL: [[1, 15, 'GAMMA']] }), XLSX);
  assert.equal(x.partite.MATCH.soloPrimaFila, true);
  assert.equal(x.partite.MATCH.colonne.get('EU|1'), 4);
  assert.equal(x.hl.foglio, 'Foglio1');
  assert.equal(x.hl.righe[0].valori.get('EU|1'), 'GAMMA');
  assert.equal(x.titolo, 'ALFA - BETA PLAYLIST');
});

test('tempi separati, ID da 2, MATS CLUB e LOWER CORNER', () => {
  const x = leggiExcel(cartella({ fogli: ['1ST HALF', '2ND HALF'], primoId: 2, righe: [[0, 15], [0, 15]], statici: [['MATS CLUB 1', 'ALFA'], ['LOWER CORNER', 'BETA']] }), XLSX);
  assert.ok(x.partite.MATCH1 && x.partite.MATCH2);
  assert.equal(x.partite.MATCH, undefined);
  assert.equal(x.partite.MATCH1.righe[0].id, 2);
  assert.equal(x.partite.MATCH1.righe[1].id, 3);
  assert.deepEqual(x.statici.get('MAT1|DOM'), { valore: 'ALFA', cella: 'B4', etichetta: 'MATS CLUB 1' });
  assert.equal(x.statici.get('LC|DOM').valore, 'BETA');
  assert.equal(x.statici.get('LC|NA').valore, null);
  assert.equal(x.statici.get('CC|DOM').valore, null);
});

test('foglio PLAYLIST mancante: errore chiaro', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Sheet1');
  assert.throws(() => leggiExcel(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), XLSX), /no PLAYLIST sheet/);
});

test('file non Excel: errore chiaro', () => {
  assert.throws(() => leggiExcel(new TextEncoder().encode('zip finto').buffer, XLSX), /could not be read as an Excel workbook/);
});

// Aggiunge un foglio subito prima di "prima" (contenuto: aoa, oppure la copia di un foglio esistente).
function conFoglio(dati, nome, prima, { aoa, copia } = {}) {
  const wb = XLSX.read(dati, { type: 'array' });
  wb.Sheets[nome] = copia ? wb.Sheets[copia] : XLSX.utils.aoa_to_sheet(aoa);
  wb.SheetNames.splice(wb.SheetNames.indexOf(prima), 0, nome);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

test('foglio highlights: per nome, altrimenti il primo rimasto con la colonna ID (i fogli di note si saltano)', () => {
  const base = { intestazioni: ['EUROPE\nVIRTUAL'], file: 1, righe: [[1, 15, 'ALFA']], righeHL: [[1, 15, 'GAMMA']] };
  const note = { aoa: [['Note'], ['da rivedere']] };
  assert.equal(leggiExcel(conFoglio(cartella({ ...base, nomeHL: 'Foglio1' }), 'NOTE', 'Foglio1', note), XLSX).hl.foglio, 'Foglio1');
  assert.equal(leggiExcel(conFoglio(cartella({ ...base, nomeHL: 'HL PLAYLIST' }), 'NOTE', 'STATIC ASSETS', note), XLSX).hl.foglio, 'HL PLAYLIST');
  // una copia della playlist prima del foglio HL: vince il nome
  assert.equal(leggiExcel(conFoglio(cartella({ ...base, nomeHL: 'HL PLAYLIST' }), 'PLAYLIST (2)', 'HL PLAYLIST', { copia: 'PLAYLIST' }), XLSX).hl.foglio, 'HL PLAYLIST');
});

test('ID non numerici: la riga resta al suo posto con un avviso; le righe di note si saltano', () => {
  const wb = XLSX.read(cartella({ intestazioni: ['EUROPE\nVIRTUAL'], file: 1, righe: [[1, 15, 'ALFA'], [' 2 ', 15, 'BETA'], ['3a', 15, 'GAMMA'], [4, 15, 'DELTA']] }), { type: 'array' });
  XLSX.utils.sheet_add_aoa(wb.Sheets.PLAYLIST, [['Nota: da rivedere']], { origin: 'A11' });
  const x = leggiExcel(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), XLSX);
  const righe = x.partite.MATCH.righe;
  assert.deepEqual(righe.map((r) => r.id), [1, 2, '3a', 4]);
  assert.equal(righe[2].valori.get('EU|1'), 'GAMMA');
  assert.deepEqual(x.avvisi, [{ foglio: 'PLAYLIST', riga: 8, id: '3a' }]);
});
