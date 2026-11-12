// Lettura della playlist Excel (app/lettura-excel.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { librerie } = require('./aiuto.js');
const { cartella, cartellaDueTempi } = require('./fixture-excel.js');
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

test('tempi separati riconosciuti dal titolo quando il nome del foglio non lo dice (PLAYLIST = 1° tempo, "G" = 2° tempo)', () => {
  const wb = XLSX.read(cartella({ fogli: ['1ST HALF', '2ND HALF'], righe: [[1, 15, 'ALFA']] }), { type: 'array' });
  [['1ST HALF', 'PLAYLIST'], ['2ND HALF', 'G']].forEach(([vecchio, nuovo]) => {
    wb.SheetNames[wb.SheetNames.indexOf(vecchio)] = nuovo;
    wb.Sheets[nuovo] = wb.Sheets[vecchio];
    delete wb.Sheets[vecchio];
  });
  const x = leggiExcel(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), XLSX);
  assert.deepEqual(Object.keys(x.partite).sort(), ['MATCH1', 'MATCH2']);
  assert.equal(x.partite.MATCH1.foglio, 'PLAYLIST');
  assert.equal(x.partite.MATCH2.foglio, 'G');
  assert.equal(x.hl.foglio, 'HL PLAYLIST');
  assert.equal(x.titolo, 'ALFA - BETA 1ST HALF');
});

test('durata scritta come testo minuti:secondi ("00:15") oltre che ore:minuti:secondi', () => {
  const { durata } = require('../app/lettura-excel.js');
  assert.deepEqual(durata('00:15'), { durataMs: 15000, durataTesto: '00:00:15' });
  assert.deepEqual(durata(' 01:30 '), { durataMs: 90000, durataTesto: '00:01:30' });
  assert.deepEqual(durata('00:00:20'), { durataMs: 20000, durataTesto: '00:00:20' });
});

test('foglio unico con i due tempi affiancati: due tabelle, una colonna di brand, niente statici né highlights', () => {
  const x = leggiExcel(cartellaDueTempi({ righe1: [[1, 30, 'Alfa'], [2, 30, 'Beta']], righe2: [[1, 30, 'Gamma'], [2, 30]] }), XLSX);
  assert.deepEqual(Object.keys(x.partite).sort(), ['MATCH1', 'MATCH2']);
  assert.equal(x.feedUnico, 'UNICO');
  assert.equal(x.hl, null);
  assert.equal(x.statici.size, 0);
  assert.equal(x.titolo, 'ALFA vs BETA');
  const [a, b] = [x.partite.MATCH1, x.partite.MATCH2];
  assert.equal(a.foglio, 'Match Running Order');
  assert.deepEqual([...a.colonne], [['UNICO|1', 4]]);
  assert.deepEqual([...b.colonne], [['UNICO|1', 11]]);
  assert.equal(a.soloPrimaFila, true);
  assert.deepEqual([a.colonnaId, a.colonnaDurata, b.colonnaId, b.colonnaDurata], ['A', 'C', 'H', 'J']);
  assert.deepEqual([a.cicloRecovery, b.cicloRecovery], [2, 2]);
  assert.deepEqual(a.righe.map((r) => [r.id, r.riga, r.durataMs, r.durataTesto, r.valori.get('UNICO|1')]), [[1, 14, 30000, '00:00:30', 'Alfa'], [2, 15, 30000, '00:00:30', 'Beta']]);
  assert.deepEqual(b.righe.map((r) => [r.id, r.valori.get('UNICO|1')]), [[1, 'Gamma'], [2, null]]);
});

test('foglio unico: la nota CB: dice il brand del centreboard; senza nota niente', () => {
  const con = leggiExcel(cartellaDueTempi({ righe1: [[1, 30, 'Alfa']], righe2: [[1, 30, 'Alfa']], nota: 'CB: Omega Sport' }), XLSX);
  assert.deepEqual(con.statici.get('CB|UNICO'), { valore: 'Omega Sport', cella: 'N14', etichetta: 'CENTREBOARD' });
  assert.equal(leggiExcel(cartellaDueTempi({ righe1: [[1, 30, 'Alfa']], righe2: [[1, 30, 'Alfa']], nota: 'Promemoria: controllare' }), XLSX).statici.size, 0);
});

test('foglio unico: gli altri fogli non si guardano e il riconoscimento non dipende dal nome', () => {
  const x = leggiExcel(cartellaDueTempi({ righe1: [[1, 30, 'Alfa']], righe2: [[1, 30, 'Beta']], altriFogli: ['Appunti'], nomeFoglio: 'Foglio1' }), XLSX);
  assert.deepEqual(Object.keys(x.partite).sort(), ['MATCH1', 'MATCH2']);
  assert.equal(x.partite.MATCH1.foglio, 'Foglio1');
});

test('foglio unico: ID non numerico segnalato con la colonna del suo tempo', () => {
  const x = leggiExcel(cartellaDueTempi({ righe1: [[1, 30, 'Alfa']], righe2: [['1a', 30, 'Beta']] }), XLSX);
  assert.deepEqual(x.avvisi, [{ foglio: 'Match Running Order', riga: 14, id: '1a', colonnaId: 'H' }]);
});

test('foglio unico senza colonna VIRTUAL FEED: errore chiaro', () => {
  assert.throws(() => leggiExcel(cartellaDueTempi({ righe1: [[1, 30, 'Alfa']], righe2: [[1, 30, 'Beta']], testaVirtual: 'NOTE' }), XLSX), /no VIRTUAL FEED column/);
});

test('foglio unico con il foglio STATIC ASSETS: i tappeti CLUB MAT con il brand di ogni tempo', () => {
  const x = leggiExcel(cartellaDueTempi({ righe1: [[1, 30, 'Alfa']], righe2: [[1, 30, 'Alfa']], nota: 'CB: Omega',
    statici: [['CLUB MAT L1', 'Kappa', 'Beta'], ['CLUB MAT R1', 'Gamma', 'Gamma'], ['NOTE', 'x', 'y']] }), XLSX);
  assert.deepEqual([...x.statici].sort(([a], [b]) => a.localeCompare(b)), [
    ['CB|UNICO', { valore: 'Omega', cella: 'N14', etichetta: 'CENTREBOARD' }],
    ['MATS_L1@MATCH1|UNICO', { valore: 'Kappa', cella: 'C3', etichetta: 'CLUB MAT L1 · FIRST HALF' }],
    ['MATS_L1@MATCH2|UNICO', { valore: 'Beta', cella: 'D3', etichetta: 'CLUB MAT L1 · SECOND HALF' }],
    ['MATS_R1@MATCH1|UNICO', { valore: 'Gamma', cella: 'C4', etichetta: 'CLUB MAT R1 · FIRST HALF' }],
    ['MATS_R1@MATCH2|UNICO', { valore: 'Gamma', cella: 'D4', etichetta: 'CLUB MAT R1 · SECOND HALF' }],
  ]);
});

// Foglio unico con la colonna dei brand "… FEED …" (non VIRTUAL FEED) e la colonna della seconda fila "2* ROW"
const NAZIONALE = ['AWAY NATIONAL FEED PITCH VBR', '2* ROW'];

test('foglio unico con la colonna … FEED … e la 2* ROW: brand di prima e seconda fila', () => {
  const x = leggiExcel(cartellaDueTempi({ testate: NAZIONALE, righe1: [[1, 30, 'Alfa', 'Kappa'], [2, 30, 'Beta', 'Kappa']], righe2: [[1, 30, 'Gamma', 'Kappa']] }), XLSX);
  const [a, b] = [x.partite.MATCH1, x.partite.MATCH2];
  assert.equal(x.feedUnico, 'UNICO');
  assert.deepEqual([...a.colonne], [['UNICO|1', 3], ['UNICO|2', 4]]);
  assert.deepEqual([...b.colonne], [['UNICO|1', 10], ['UNICO|2', 11]]);
  assert.equal(a.soloPrimaFila, false);
  assert.deepEqual(a.righe.map((r) => [r.id, r.valori.get('UNICO|1'), r.valori.get('UNICO|2')]), [[1, 'Alfa', 'Kappa'], [2, 'Beta', 'Kappa']]);
  assert.deepEqual(b.righe.map((r) => [r.id, r.valori.get('UNICO|1'), r.valori.get('UNICO|2')]), [[1, 'Gamma', 'Kappa']]);
});

test('foglio unico: la riga LOOP chiude la playlist, le righe sotto non contano', () => {
  const x = leggiExcel(cartellaDueTempi({ testate: NAZIONALE,
    righe1: [[1, 30, 'Alfa', 'Kappa'], [2, 30, 'Beta', 'Kappa'], [92, 30, 'LOOP', 'LOOP'], [93, 30], [94, 30]],
    righe2: [[1, 30, 'Gamma', 'Kappa'], [2, 30, ' Loop ', null], [3, 30]] }), XLSX);
  const [a, b] = [x.partite.MATCH1, x.partite.MATCH2];
  assert.deepEqual(a.righe.map((r) => r.id), [1, 2]);
  assert.deepEqual(b.righe.map((r) => r.id), [1]);
  assert.deepEqual([a.giro, b.giro], [true, true]);
});

test('foglio unico senza riga LOOP: nessun giro, resta il recupero', () => {
  const x = leggiExcel(cartellaDueTempi({ testate: NAZIONALE, righe1: [[1, 30, 'Alfa', 'Kappa']], righe2: [[1, 30, 'Beta', 'Kappa']] }), XLSX);
  assert.deepEqual([x.partite.MATCH1.giro, x.partite.MATCH1.cicloRecovery], [false, 2]);
});

test('foglio unico: una tabella pivot a destra del secondo tempo non si scambia per la colonna dei brand', () => {
  const x = leggiExcel(cartellaDueTempi({ testate: NAZIONALE, codaTesta: ['Row Labels', 'Count of AWAY NATIONAL FEED PITCH'],
    righe1: [[1, 30, 'Alfa', 'Kappa']], righe2: [[1, 30, 'Beta', 'Kappa']] }), XLSX);
  assert.deepEqual([...x.partite.MATCH2.colonne], [['UNICO|1', 10], ['UNICO|2', 11]]);
});

test('foglio unico: sotto la riga LOOP un ID non numerico non dà avvisi', () => {
  const x = leggiExcel(cartellaDueTempi({ testate: NAZIONALE, righe1: [[1, 30, 'Alfa', 'Kappa'], ['x', 30, 'LOOP'], ['nota', 30]], righe2: [['1a', 30, 'Beta', 'Kappa']] }), XLSX);
  assert.deepEqual(x.avvisi.map((a) => a.id), ['1a']);
});
