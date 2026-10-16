// Controllo dei virtual (app/confronto-virtual.js) su modelli sintetici.
const test = require('node:test');
const assert = require('node:assert/strict');
const { art, BLANK, segmento, tabella, contesto, stream, breve } = require('./fixture-modello.js');
const { controllaVirtual } = require('../app/confronto-virtual.js');

const R1 = art('ALFA_GC1', 'CASA_ALFA_1');
const R2 = art('ALFA_GL2', 'CASA_ALFA_2');
const vuotoLed = { 0: BLANK, 1: BLANK };
const pieno = { 0: R1, 1: R2 };
const ALFA = { 'NA|1': 'ALFA', 'NA|2': 'ALFA' };

function prova({ slot, righe, regioni = ['NA'], colonne, tipo = 'MATCH', zone }) {
  const c = contesto({ zone });
  const seg = segmento(tipo === 'HL' ? 'Highlights' : '1st Half - 2nd Half', tipo === 'HL' ? slot : [{ mappe: vuotoLed }].concat(slot));
  controllaVirtual(c, stream('North America', regioni), seg, tipo, tabella({ righe, colonne }));
  return c;
}

test('brand giusto in entrambe le file: nessun esito, celle contate', () => {
  const c = prova({ slot: [{ mappe: pieno }, { mappe: pieno }, { mappe: pieno }], righe: [{ valori: ALFA }, { valori: ALFA }, { valori: ALFA }] });
  assert.deepEqual(c.esiti, []);
  assert.equal(c.celle.n, 9);
  assert.ok(c.giusti.has('ALFA|ALFA'));
});

test('brand sbagliato in prima fila', () => {
  const c = prova({ slot: [{ mappe: pieno }, { mappe: { 0: art('OMEGA_GC1', 'CASA_OMEGA_1'), 1: R2 } }], righe: [{ valori: ALFA }, { valori: ALFA }] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 2, colonna: 'F · NORTH AMERICA – First row', zona: 'FULL PERIMETER', atteso: 'ALFA', trovato: 'OMEGA_GC1' }]);
});

test('Excel vuoto e artwork nello zip (non in coda): Error', () => {
  const c = prova({ slot: [{ mappe: pieno }, { mappe: { 0: R1, 1: BLANK } }, { mappe: pieno }], righe: [{ valori: ALFA }, {}, { valori: ALFA }] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 2, colonna: 'F · NORTH AMERICA – First row', zona: 'FULL PERIMETER', atteso: 'Blank', trovato: 'ALFA_GC1' }]);
});

test('file di prima fila sulle zone di seconda', () => {
  const c = prova({ slot: [{ mappe: { 0: art('SIGMA_GC1', 'CASA_SIGMA_1_J'), 1: art('SIGMA_JUMBO', 'CASA_SIGMA_1_J') } }], righe: [{ valori: { 'NA|1': 'SIGMA', 'NA|2': 'SIGMA' } }] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 1, colonna: 'G · NORTH AMERICA – Second row', zona: 'GL_SX_2', atteso: 'SIGMA', trovato: 'SIGMA_JUMBO (first-row file)' }]);
});

test('durata diversa', () => {
  const c = prova({ slot: [{ mappe: pieno }, { mappe: pieno }], righe: [{ valori: ALFA }, { valori: ALFA, durataMs: 30000, durataTesto: '00:00:30' }] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 2, colonna: 'C7 · Duration', zona: '-', atteso: '00:00:30', trovato: '15 s' }]);
});

test('feed condiviso con colonne diverse', () => {
  const colonne = { 'NA|1': 5, 'NA|2': 6, 'CSA|1': 7, 'CSA|2': 8 };
  const c = prova({ regioni: ['CSA', 'NA'], colonne, slot: [{ mappe: pieno }], righe: [{ valori: { 'NA|1': 'ALFA', 'NA|2': 'ALFA', 'CSA|1': 'BETA', 'CSA|2': 'ALFA' } }] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 1, colonna: 'PLAYLIST · NORTH AMERICA/CENTRAL & SOUTH AMERICA', zona: '-', atteso: 'same value (shared feed)', trovato: 'ALFA | BETA' }]);
});

test('recupero: il brand dell’ultima riga piena ripetuto fino alla fine', () => {
  const c = prova({ slot: [{ mappe: pieno }, { mappe: pieno }, { mappe: pieno }], righe: [{ valori: ALFA }, { valori: ALFA }, {}] });
  assert.deepEqual(breve(c.esiti), [
    { tipo: 'Recovery', id: 3, colonna: 'F · NORTH AMERICA – First row', zona: '-', atteso: 'repeat of ID 2', trovato: 'ALFA' },
    { tipo: 'Recovery', id: 3, colonna: 'G · NORTH AMERICA – Second row', zona: '-', atteso: 'repeat of ID 2', trovato: 'ALFA' },
  ]);
});

test('recupero con un brand diverso resta Error', () => {
  const c = prova({ slot: [{ mappe: pieno }, { mappe: { 0: art('OMEGA_GC1', 'CASA_OMEGA_1'), 1: BLANK } }], righe: [{ valori: ALFA }, {}] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 2, colonna: 'F · NORTH AMERICA – First row', zona: 'FULL PERIMETER', atteso: 'Blank', trovato: 'OMEGA_GC1' }]);
});

test('riga Excel senza slot: Warning se vuota, Error se piena', () => {
  const vuota = prova({ slot: [{ mappe: pieno }], righe: [{ valori: ALFA }, {}] });
  assert.deepEqual(breve(vuota.esiti), [{ tipo: 'Warning', id: 2, colonna: '-', zona: '-', atteso: 'AIR slot', trovato: 'missing' }]);
  const piena = prova({ slot: [{ mappe: pieno }], righe: [{ valori: ALFA }, { valori: ALFA }] });
  assert.deepEqual(breve(piena.esiti), [{ tipo: 'Error', id: 2, colonna: '-', zona: '-', atteso: 'AIR slot', trovato: 'missing' }]);
});

test('slot senza riga Excel: Warning se vuoto, Error se pieno', () => {
  const c = prova({ slot: [{ mappe: pieno }, { mappe: vuotoLed }, { mappe: { 0: art('OMEGA_GC1', 'CASA_OMEGA_1') } }], righe: [{ valori: ALFA }] });
  assert.deepEqual(breve(c.esiti), [
    { tipo: 'Warning', id: 'slot 2', colonna: '-', zona: '-', atteso: 'Excel row', trovato: 'missing' },
    { tipo: 'Error', id: 'slot 3', colonna: '-', zona: '-', atteso: 'Excel row', trovato: 'missing' },
  ]);
});

test('ID che parte da 2: Warning e ID dell’Excel nei risultati', () => {
  const c = prova({ slot: [{ mappe: pieno }, { mappe: { 0: art('OMEGA_GC1', 'CASA_OMEGA_1'), 1: R2 } }], righe: [{ id: 2, valori: ALFA }, { id: 3, valori: ALFA }] });
  assert.deepEqual(breve(c.esiti), [
    { tipo: 'Warning', id: 2, colonna: 'A6 · ID', zona: '-', atteso: 'IDs start at 1', trovato: 'starts at 2' },
    { tipo: 'Error', id: 3, colonna: 'F · NORTH AMERICA – First row', zona: 'FULL PERIMETER', atteso: 'ALFA', trovato: 'OMEGA_GC1' },
  ]);
});

test('highlights: 6 righe e 9 slot (gli ultimi 3 vuoti) → un solo Warning', () => {
  const slot = Array.from({ length: 9 }, (_, i) => ({ mappe: i < 6 ? pieno : vuotoLed }));
  const c = prova({ tipo: 'HL', slot, righe: Array.from({ length: 6 }, () => ({ valori: ALFA })) });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Warning', id: '-', colonna: '-', zona: '-', atteso: '6 slots (Excel)', trovato: '9 slots (AIR)' }]);
});

test('variante e refuso diventano esiti Variant e Possible typo', () => {
  const c = prova({ slot: [{ mappe: { 0: art('ALFA_GC1', 'CASA_ALFA_1'), 1: art('MELTA_GL2', 'CASA_MELTA_2') } }], righe: [{ valori: { 'NA|1': 'ALFA OVERLAY (J)', 'NA|2': 'belta' } }] });
  assert.deepEqual(breve(c.esiti), [
    { tipo: 'Variant', id: 1, colonna: 'F · NORTH AMERICA – First row', zona: 'FULL PERIMETER', atteso: 'ALFA OVERLAY (J)', trovato: 'ALFA_GC1' },
    { tipo: 'Possible typo', id: 1, colonna: 'G · NORTH AMERICA – Second row', zona: 'GL_SX_2', atteso: 'belta', trovato: 'MELTA_GL2' },
  ]);
});

test('una zona della fila vuota mentre le altre mostrano il brand: Error su quella zona', () => {
  const c = prova({ zone: ['GL_SX_1', 'GL_DX_1', 'GL_SX_2', 'GL_DX_2'],
    slot: [{ mappe: { 0: R1, 1: R1, 2: R2, 3: R2 } }, { mappe: { 0: R1, 1: BLANK, 2: R2, 3: R2 } }],
    righe: [{ valori: ALFA }, { valori: ALFA }] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 2, colonna: 'F · NORTH AMERICA – First row', zona: 'GL_DX_1', atteso: 'ALFA', trovato: 'Blank' }]);
});

test('zone mai usate nel pacchetto (es. angoli non in uso): non devono essere piene', () => {
  const c = prova({ zone: ['GL_SX_1', 'GL_DX_1', 'LC_SX_1'], slot: [{ mappe: { 0: R1, 1: R1, 2: BLANK } }, { mappe: { 0: R1, 1: R1 } }],
    righe: [{ valori: { 'NA|1': 'ALFA' } }, { valori: { 'NA|1': 'ALFA' } }] });
  assert.deepEqual(c.esiti, []);
});

test('fila delle zone ricavata dai file che ospitano (TL_A di seconda fila anche senza _2 nel nome)', () => {
  const B2 = art('BETA_TL2', 'CASA_BETA_2');
  const due = { 'NA|1': 'ALFA', 'NA|2': 'BETA' };
  const c = prova({ zone: ['FULL PERIMETER_1', 'TL_A'],
    slot: [{ mappe: { 0: R1, 1: B2 } }, { mappe: { 0: art('GAMMA_SOLO-1FILA'), 1: BLANK } }, { mappe: { 0: R1, 1: B2 } }, { mappe: { 0: R1, 1: art('ALFA_GC1', 'CASA_ALFA_1') } }],
    righe: [{ valori: due }, { valori: { 'NA|1': 'GAMMA' } }, { valori: due }, { valori: due }] });
  // slot 2: perimetro intero di prima fila, TL_A (seconda fila) vuota e Excel senza seconda fila → nessun errore
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 4, colonna: 'G · NORTH AMERICA – Second row', zona: 'TL_A', atteso: 'BETA', trovato: 'ALFA_GC1 (first-row file)' }]);
});
