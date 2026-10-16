// Raggruppamento, esito del controllo, conferme ed export Excel (app/report.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { librerie } = require('./aiuto.js');
const { raggruppa, idCompatti, esito, coppieDaConfermare, applicaRisposte, esportaExcel } = require('../app/report.js');

const { XLSX } = librerie();
const E = (tipo, id, zona = 'FULL PERIMETER', atteso = 'ALFA', trovato = 'OMEGA_GC1', feed = 'Europa', colonna = 'J · EUROPE – First row') =>
  ({ tipo, feed, segmento: '1st - 2nd Half', id, colonna, zona, atteso, trovato });

test('raggruppa per tipo, feed, segmento, colonna, atteso e trovato', () => {
  const g = raggruppa([E('Error', 3), E('Error', 1, 'GL_SX_2'), E('Error', 3, 'GL_DX_2'), E('Warning', '-', '-', 'IDs start at 1', 'starts at 2'), E('Error', 2, 'X', 'BETA')]);
  assert.equal(g.length, 3);
  assert.deepEqual(g[0], { tipo: 'Error', feed: 'Europa', segmento: '1st - 2nd Half', colonna: 'J · EUROPE – First row', atteso: 'ALFA', trovato: 'OMEGA_GC1', zone: ['FULL PERIMETER', 'GL_SX_2', 'GL_DX_2'], ids: [1, 3], conta: 3 });
  assert.equal(g[1].atteso, 'BETA');
  assert.equal(g[2].tipo, 'Warning');
});

test('ID compatti', () => {
  assert.equal(idCompatti([182, 183, 184, 240]), '182–184, 240');
  assert.equal(idCompatti([5]), '5');
  assert.equal(idCompatti(['slot 2', 'slot 3']), 'slot 2, slot 3');
  assert.equal(idCompatti(['-']), '-');
});

test('esito del controllo: rosso, giallo, verde', () => {
  assert.deepEqual(esito([E('Error', 1), E('Error', 2), E('Possible typo', 3)]), { colore: 'rosso', testo: '2 errors · 1 to confirm' });
  assert.deepEqual(esito([E('Error', 1)]), { colore: 'rosso', testo: '1 error' });
  assert.deepEqual(esito([E('Possible typo', 1), E('Possible typo', 2, 'GL_SX_2'), E('Possible alias', 3, 'X', 'ZORRO', 'ZTV_GC1')]), { colore: 'giallo', testo: '2 to confirm' });
  assert.deepEqual(esito([E('Warning', '-'), E('Recovery', 9), E('Variant', 2)]), { colore: 'verde', testo: 'All clear · 2 warnings' });
  assert.deepEqual(esito([E('Variant', 2)]), { colore: 'verde', testo: 'All clear' });
});

test('una conferma per coppia di nomi, e risposte applicate', () => {
  const esiti = [E('Possible typo', 1, 'GL_SX_2', 'belta', 'MELTA_GL2'), E('Possible typo', 1, 'TL_2', 'belta', 'MELTA_TL2'),
    E('Possible typo', 5, 'GL_SX_2', 'belta', 'MELTA_GL2'), E('Possible alias', 2, 'X', 'ZORRO TV', 'ZTV_GC1'), E('Error', 4)];
  const c = coppieDaConfermare(esiti);
  assert.deepEqual(c.map((x) => [x.chiave, x.tipo, x.atteso, x.trovato, x.gruppi.length]), [
    ['Possible typo|BELTA|MELTA', 'Possible typo', 'belta', 'MELTA', 2], ['Possible alias|ZORROTV|ZTV', 'Possible alias', 'ZORRO TV', 'ZTV', 1]]);
  const dopo = applicaRisposte(esiti, new Map([['Possible typo|BELTA|MELTA', 'confirm'], ['Possible alias|ZORROTV|ZTV', 'reject']]));
  assert.deepEqual(dopo.map((e) => e.tipo), ['Correct', 'Correct', 'Correct', 'Error', 'Error']);
  assert.equal(esiti[0].tipo, 'Possible typo');
});

test('export Excel: Summary e Findings', () => {
  const risultato = { celle: 120, esiti: [E('Error', 1), E('Variant', 2), E('Correct', 3), E('Warning', '-', '-', '6 slots (Excel)', '9 slots (AIR)')],
    riepilogo: { partita: 'ALFA - BETA', venue: 'Stadio Prova', dataEvento: '2026-10-12', conteggi: { Error: 1, Variant: 1, Warning: 1 } } };
  const wb = XLSX.read(esportaExcel(risultato, { excel: 'playlist.xlsx', air: 'pacchetto.zip' }, XLSX), { type: 'array' });
  assert.deepEqual(wb.SheetNames, ['Summary', 'Findings']);
  const s = XLSX.utils.sheet_to_json(wb.Sheets.Summary, { header: 1 });
  assert.deepEqual(s.slice(0, 6), [['Match', 'ALFA - BETA'], ['Venue', 'Stadio Prova'], ['Event date', '2026-10-12'], ['Excel playlist', 'playlist.xlsx'], ['AIR package', 'pacchetto.zip'], ['Cells checked', 120]]);
  const f = XLSX.utils.sheet_to_json(wb.Sheets.Findings, { header: 1 });
  assert.deepEqual(f[0], ['Type', 'Feed', 'Segment', 'ID', 'Column', 'Zone', 'Expected', 'Found']);
  assert.equal(f.length, 3);
  assert.deepEqual(f[1], ['Error', 'Europa', '1st - 2nd Half', 1, 'J · EUROPE – First row', 'FULL PERIMETER', 'ALFA', 'OMEGA_GC1']);
});

test('durate sbagliate: un gruppo per feed anche con valori attesi diversi', () => {
  const d = (id, atteso, feed = 'Europa') => ({ tipo: 'Error', feed, segmento: '1st - 2nd Half', id, colonna: `C${id + 5} · Duration`, zona: '-', atteso, trovato: '15 s' });
  const g = raggruppa([d(194, '01:00:15'), d(195, '02:00:15'), d(196, '03:00:15'), d(197, '04:00:15'), d(194, '01:00:15', 'Mena')]);
  assert.equal(g.length, 2);
  assert.deepEqual([g[0].feed, g[0].colonna, g[0].atteso, g[0].trovato, g[0].ids, g[0].conta], ['Europa', 'C · Duration', '4 different values', '15 s', [194, 195, 196, 197], 4]);
  assert.deepEqual([g[1].colonna, g[1].atteso], ['C199 · Duration', '01:00:15']);
});

test('conteggi del controllo per lo storico (solo numeri)', () => {
  const { conteggiControllo, rigaControllo, coppieDaConfermare } = require('../app/report.js');
  const esiti = [E('Error', 1), E('Error', 2), E('Possible typo', 3, 'GL_SX_2', 'belta', 'MELTA_GL2'), E('Possible typo', 4, 'GL_SX_2', 'belta', 'MELTA_GL2'),
    E('Possible alias', 5, 'X', 'ZORRO', 'ZTV_GC1'), E('Warning', '-'), E('Recovery', 9), E('Variant', 6)];
  const ultimo = { idControllo: 'c1', dataControllo: '2026-10-15T10:00:00Z', nomiFile: { excel: 'p.xlsx', air: 'a.zip' },
    risultatoOriginale: { celle: 100, esiti, riepilogo: { partita: 'ALFA - BETA', casa: 'ALFA', ospite: 'BETA', venue: 'Stadio Prova', dataEvento: '2026-10-12' } },
    risposte: new Map([['Possible typo|BELTA|MELTA', 'confirm'], ['Possible alias|ZORRO|ZTV', 'reject']]) };
  ultimo.coppie = coppieDaConfermare(esiti);
  assert.deepEqual(conteggiControllo(ultimo), { celle: 100, corrette: 96, errori: 3, refusiTrovati: 3, confermati: 2, respinti: 1, avvisi: 2 });
  assert.deepEqual(rigaControllo(ultimo), { idControllo: 'c1', dataControllo: '2026-10-15T10:00:00Z', dataEvento: '2026-10-12', partita: 'ALFA - BETA', casa: 'ALFA', ospite: 'BETA',
    venue: 'Stadio Prova', fileExcel: 'p.xlsx', fileAir: 'a.zip', celle: 100, corrette: 96, errori: 3, refusiTrovati: 3, confermati: 2, respinti: 1, avvisi: 2 });
});

test('coppie confermate per la mail', () => {
  const { coppieConfermate, coppieDaConfermare } = require('../app/report.js');
  const esiti = [E('Possible typo', 12, 'GL_SX_2', 'belta', 'MELTA_GL2'), E('Possible typo', 58, 'GL_SX_2', 'belta', 'MELTA_GL2'), E('Possible alias', 5, 'X', 'ZORRO', 'ZTV_GC1')];
  const ultimo = { risultatoOriginale: { esiti }, coppie: coppieDaConfermare(esiti), risposte: new Map([['Possible typo|BELTA|MELTA', 'confirm'], ['Possible alias|ZORRO|ZTV', 'reject']]) };
  assert.deepEqual(coppieConfermate(ultimo), [{ tipo: 'Possible typo', feed: 'Europa', segmento: '1st - 2nd Half', id: '12, 58', colonna: 'J · EUROPE – First row', excel: 'belta', air: 'MELTA_GL2' }]);
});
