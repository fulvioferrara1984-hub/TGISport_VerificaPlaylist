// Statistiche (app/statistiche.js): filtri, primo controllo per partita, totali, export.
const test = require('node:test');
const assert = require('node:assert/strict');
const { librerie } = require('./aiuto.js');
const { filtra, totali, esporta } = require('../app/statistiche.js');

const { XLSX } = librerie();
const r = (id, dataControllo, partita, dataEvento, errori, extra = {}) => {
  const [casa, ospite] = partita.split(' - ');
  return { idControllo: id, dataControllo, dataEvento, partita, casa, ospite, venue: 'Stadio', fileExcel: 'p.xlsx', fileAir: 'a.zip',
    celle: 100, corrette: 100 - errori, errori, refusiTrovati: 1, confermati: 1, respinti: 0, avvisi: 2, ...extra };
};
const RIGHE = [
  r('a2', '2026-10-12T12:00:00Z', 'ALFA - BETA', '2026-10-12', 3),
  r('a1', '2026-10-12T09:00:00Z', 'ALFA - BETA', '2026-10-12', 10),
  r('g1', '2026-10-17T09:00:00Z', 'GAMMA - ALFA', '2026-10-18', 5),
  r('d1', '2026-10-20T09:00:00Z', 'DELTA - EPSILON', '2026-10-21', 0),
];

test('primo controllo per partita: il più vecchio per partita e data', () => {
  assert.deepEqual(filtra(RIGHE, { soloPrimo: true }).map((x) => x.idControllo), ['a1', 'g1', 'd1']);
  assert.deepEqual(filtra(RIGHE, { soloPrimo: false }).map((x) => x.idControllo), ['a2', 'a1', 'g1', 'd1']);
});

test('filtro squadra su casa e ospite, partita e periodo (data della partita, estremi inclusi)', () => {
  assert.deepEqual(filtra(RIGHE, { squadra: 'alfa' }).map((x) => x.idControllo), ['a2', 'a1', 'g1']);
  assert.deepEqual(filtra(RIGHE, { partita: 'delta' }).map((x) => x.idControllo), ['d1']);
  assert.deepEqual(filtra(RIGHE, { da: '2026-10-18', a: '2026-10-21' }).map((x) => x.idControllo), ['g1', 'd1']);
});

test('totali', () => {
  assert.deepEqual(totali(filtra(RIGHE, { soloPrimo: true })), { controlli: 3, celle: 300, corrette: 285, errori: 15, refusi: 3 });
  assert.deepEqual(totali([]), { controlli: 0, celle: 0, corrette: 0, errori: 0, refusi: 0 });
});

test('export Excel delle righe filtrate', () => {
  const wb = XLSX.read(esporta(filtra(RIGHE, { soloPrimo: true }), XLSX), { type: 'array' });
  const righe = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  assert.deepEqual(righe[0], ['Checked on', 'Match date', 'Match', 'Home', 'Away', 'Venue', 'Excel playlist', 'Package', 'Cells', 'Correct', 'Errors', 'Typos/aliases found', 'Confirmed', 'Rejected', 'Warnings', 'System']);
  assert.equal(righe[1][15], 'Hub');
  assert.equal(righe.length, 4);
  assert.deepEqual(righe[1].slice(0, 3), ['2026-10-12 11:00', '2026-10-12', 'ALFA - BETA']); // ora italiana
});

test('statistiche separate per sistema: i controlli senza sistema (precedenti al Vault) sono dell\'Hub', () => {
  const tutte = RIGHE.concat([r('v1', '2026-10-19T09:00:00Z', 'ZETA - ETA', '2026-10-21', 0, { sistema: 'Vault' }), r('h9', '2026-10-19T10:00:00Z', 'ETA - ZETA', '2026-10-22', 1, { sistema: 'Hub' })]);
  assert.deepEqual(filtra(tutte, { sistema: 'Vault' }).map((x) => x.idControllo), ['v1']);
  assert.deepEqual(filtra(tutte, { sistema: 'Hub' }).map((x) => x.idControllo), ['a2', 'a1', 'g1', 'd1', 'h9']);
  assert.equal(filtra(tutte, {}).length, 6);
});
