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

test('animazioni: una voce per fila con brand, file della fila, slot del pacchetto', () => {
  const c = prova({ slot: [{ mappe: pieno }], righe: [{ valori: ALFA }] });
  assert.deepEqual(c.animazioni, [
    { feed: 'North America', segmento: '1st Half - 2nd Half', slot: 1, id: 1, gruppo: 'First row', colonna: 'F · NORTH AMERICA – First row', atteso: 'ALFA', nota: '', zone: [{ zona: 'FULL PERIMETER', file: '1000_alfa_gc1.mp4' }] },
    { feed: 'North America', segmento: '1st Half - 2nd Half', slot: 1, id: 1, gruppo: 'Second row', colonna: 'G · NORTH AMERICA – Second row', atteso: 'ALFA', nota: '', zone: [{ zona: 'GL_SX_2', file: '1000_alfa_gl2.mp4' }] },
  ]);
});

test('animazioni: ID Excel che partono da 2, lo slot resta quello del pacchetto', () => {
  const c = prova({ slot: [{ mappe: pieno }], righe: [{ id: 2, valori: ALFA }] });
  assert.deepEqual(c.animazioni.map((v) => [v.slot, v.id]), [[1, 2], [1, 2]]);
});

test('animazioni: recovery con il brand ripetuto e la nota', () => {
  const c = prova({ slot: [{ mappe: pieno }, { mappe: pieno }, { mappe: pieno }], righe: [{ valori: ALFA }, { valori: ALFA }, {}] });
  assert.deepEqual(c.animazioni.filter((v) => v.slot === 3).map((v) => [v.gruppo, v.atteso, v.nota]),
    [['First row', 'ALFA', 'repeat of ID 2'], ['Second row', 'ALFA', 'repeat of ID 2']]);
});

test('animazioni: fila senza brand nell\'Excel (non in coda) → nessuna voce', () => {
  const c = prova({ slot: [{ mappe: pieno }, { mappe: { 0: R1, 1: BLANK } }, { mappe: pieno }], righe: [{ valori: ALFA }, {}, { valori: ALFA }] });
  assert.equal(c.animazioni.filter((v) => v.slot === 2).length, 0);
  assert.equal(c.animazioni.length, 4);
});

test('animazioni: feed condiviso, brand e colonna della prima regione', () => {
  const colonne = { 'NA|1': 5, 'NA|2': 6, 'CSA|1': 7, 'CSA|2': 8 };
  const c = prova({ regioni: ['CSA', 'NA'], colonne, slot: [{ mappe: pieno }], righe: [{ valori: { 'NA|1': 'ALFA', 'NA|2': 'ALFA', 'CSA|1': 'BETA', 'CSA|2': 'ALFA' } }] });
  assert.deepEqual([c.animazioni[0].atteso, c.animazioni[0].colonna], ['ALFA', 'F · NORTH AMERICA – First row']);
});

test('animazioni: gli esiti non cambiano senza l\'aggancio', () => {
  const dati = { slot: [{ mappe: pieno }, { mappe: { 0: art('OMEGA_GC1', 'CASA_OMEGA_1'), 1: R2 } }], righe: [{ valori: ALFA }, { valori: ALFA }] };
  const con = prova(dati);
  const c = contesto({});
  delete c.vista;
  const seg = segmento('1st Half - 2nd Half', [{ mappe: vuotoLed }].concat(dati.slot));
  controllaVirtual(c, stream('North America', ['NA']), seg, 'MATCH', tabella({ righe: dati.righe }));
  assert.deepEqual(c.esiti, con.esiti);
  assert.equal(con.animazioni.length, 4);
});

// Playlist a foglio unico: la colonna dei brand è una sola, e dopo l'ultima riga compilata il pacchetto alterna le ultime due
function provaUnico({ righe, slot, colonnaId = 'A', colonnaDurata = 'C', tipo = 'MATCH1', nomeSeg = 'First Half', giro = false, durate = [] }) {
  const c = contesto({ zone: ['LEFT LED', 'RIGHT LED'] });
  const tab = { ...tabella({ colonne: { 'UNICO|1': 4 }, righe: righe.map((v, i) => ({ id: i + 1, durataMs: 30000, durataTesto: '00:00:30', valori: v ? { 'UNICO|1': v } : {} })) }), colonnaId, colonnaDurata, cicloRecovery: 2, giro };
  const lato = (n) => (n ? art(`${n}_LED`, `LEGA_${n}`) : BLANK);
  const seg = segmento(nomeSeg, [{ durata: 30000, mappe: { 0: BLANK, 1: BLANK } }].concat(slot.map((n, i) => ({ durata: durate[i] || 30000, mappe: { 0: lato(n), 1: lato(n) } }))));
  controllaVirtual(c, stream('Feed Alfa', ['UNICO']), seg, tipo, tab);
  return c;
}

test('foglio unico: brand giusti nei due lati, nessun esito; un brand sbagliato vale per ogni lato, con la colonna del foglio', () => {
  assert.deepEqual(provaUnico({ righe: ['ALFA', 'BETA'], slot: ['ALFA', 'BETA'] }).esiti, []);
  assert.deepEqual(breve(provaUnico({ righe: ['ALFA', 'BETA'], slot: ['ALFA', 'OMEGA'] }).esiti), ['LEFT LED', 'RIGHT LED'].map((zona) => (
    { tipo: 'Error', id: 2, colonna: 'E · VIRTUAL FEED – First row', zona, atteso: 'BETA', trovato: 'OMEGA_LED' })));
});

test('foglio unico: recupero che alterna le ultime due righe compilate, anche oltre l’ultima riga dell’Excel: Recovery', () => {
  const c = provaUnico({ righe: ['ALFA', 'BETA', null, null], slot: ['ALFA', 'BETA', 'ALFA', 'BETA', 'ALFA', 'BETA'] });
  assert.deepEqual(breve(c.esiti), [[3, 1, 'ALFA'], [4, 2, 'BETA'], ['slot 5', 1, 'ALFA'], ['slot 6', 2, 'BETA']].map(([id, n, trovato]) => (
    { tipo: 'Recovery', id, colonna: 'E · VIRTUAL FEED – First row', zona: '-', atteso: `repeat of ID ${n}`, trovato })));
});

test('foglio unico: nel recupero un brand estraneo o fuori posto è Error, con il brand che il recupero doveva ripetere', () => {
  const altro = provaUnico({ righe: ['ALFA', 'BETA', null], slot: ['ALFA', 'BETA', 'OMEGA'] });
  assert.deepEqual([...new Set(altro.esiti.map((e) => [e.tipo, e.id, e.colonna, e.atteso, e.trovato].join('|')))], ['Error|3|E · VIRTUAL FEED – First row · repeat of ID 1|ALFA|OMEGA_LED']);
  const fuoriPosto = provaUnico({ righe: ['ALFA', 'BETA', null], slot: ['ALFA', 'BETA', 'BETA'] });
  assert.deepEqual([...new Set(fuoriPosto.esiti.map((e) => [e.tipo, e.id, e.atteso, e.trovato].join('|')))], ['Error|3|ALFA|BETA_LED']);
  const oltre = provaUnico({ righe: ['ALFA', 'BETA'], slot: ['ALFA', 'BETA', 'ALFA', 'OMEGA'] });
  assert.deepEqual(oltre.esiti.map((e) => [e.tipo, e.id, e.atteso, e.trovato].join('|')), ['Recovery|slot 3|repeat of ID 1|ALFA',
    'Error|slot 4|BETA|OMEGA_LED', 'Error|slot 4|BETA|OMEGA_LED']);
});

test('foglio unico: durata e ID si citano con le colonne del loro tempo', () => {
  const c = provaUnico({ righe: ['ALFA'], slot: [], colonnaId: 'H', colonnaDurata: 'J', tipo: 'MATCH2', nomeSeg: 'Second Half' });
  const lungo = contesto({ zone: ['LEFT LED'] });
  const tab = { ...tabella({ colonne: { 'UNICO|1': 11 }, righe: [{ id: 7, durataMs: 15000, durataTesto: '00:00:15', valori: { 'UNICO|1': 'ALFA' } }] }), colonnaId: 'H', colonnaDurata: 'J', cicloRecovery: 2 };
  controllaVirtual(lungo, stream('Feed Alfa', ['UNICO']), segmento('Second Half', [{ durata: 30000, mappe: { 0: BLANK } }, { durata: 30000, mappe: { 0: art('ALFA_LED') } }]), 'MATCH2', tab);
  assert.deepEqual(breve(lungo.esiti), [
    { tipo: 'Warning', id: 7, colonna: 'H6 · ID', zona: '-', atteso: 'IDs start at 1', trovato: 'starts at 7' },
    { tipo: 'Error', id: 7, colonna: 'J6 · Duration', zona: '-', atteso: '00:00:15', trovato: '30 s' }]);
  assert.deepEqual(c.esiti.map((e) => e.atteso), ['AIR slot']);
});

test('playlist normale: uno slot oltre l’ultima riga dell’Excel resta un errore', () => {
  const c = prova({ slot: [{ mappe: pieno }, { mappe: pieno }], righe: [{ valori: ALFA }] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 'slot 2', colonna: '-', zona: '-', atteso: 'Excel row', trovato: 'missing' }]);
});

// Foglio unico con la riga LOOP: dopo l'ultima riga il pacchetto ripete la playlist da capo, come celle normali
test('LOOP: dopo l’ultima riga il pacchetto riparte dalla prima; slot contati come celle, nessun esito', () => {
  const c = provaUnico({ giro: true, righe: ['ALFA', 'BETA'], slot: ['ALFA', 'BETA', 'ALFA', 'BETA', 'ALFA'] });
  assert.deepEqual(c.esiti, []);
  assert.equal(c.celle.n, 10);
});

test('LOOP: se l’ultima riga è uguale alla prima il giro riprende dalla seconda', () => {
  const c = provaUnico({ giro: true, righe: ['ALFA', 'BETA', 'GAMMA', 'alfa'], slot: ['ALFA', 'BETA', 'GAMMA', 'ALFA', 'BETA', 'GAMMA', 'ALFA', 'BETA'] });
  assert.deepEqual(c.esiti, []);
});

test('LOOP: uno slot che non ripete la riga del suo turno è Error, con il brand atteso e la riga del giro', () => {
  const c = provaUnico({ giro: true, righe: ['ALFA', 'BETA', 'GAMMA', 'ALFA'], slot: ['ALFA', 'BETA', 'GAMMA', 'ALFA', 'ALFA', 'OMEGA'] });
  assert.deepEqual(breve(c.esiti), [['slot 5', 'BETA', 'ALFA_LED', 2], ['slot 6', 'GAMMA', 'OMEGA_LED', 3]].flatMap(([id, atteso, trovato, n]) => ['LEFT LED', 'RIGHT LED'].map((zona) => (
    { tipo: 'Error', id, colonna: `E · VIRTUAL FEED – First row · loop of ID ${n}`, zona, atteso, trovato }))));
});

test('LOOP: la durata di uno slot del giro si confronta con la riga che ripete', () => {
  const c = provaUnico({ giro: true, righe: ['ALFA', 'BETA'], slot: ['ALFA', 'BETA', 'ALFA'], durate: [30000, 30000, 15000] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 'slot 3', colonna: 'C6 · Duration', zona: '-', atteso: '00:00:30', trovato: '15 s' }]);
});

test('LOOP: animazioni degli slot del giro con il brand della riga ripetuta', () => {
  const c = provaUnico({ giro: true, righe: ['ALFA', 'BETA'], slot: ['ALFA', 'BETA', 'ALFA'] });
  assert.deepEqual(c.animazioni.map((v) => [v.slot, v.id, v.atteso, v.colonna]), [[1, 1, 'ALFA', 'E · VIRTUAL FEED – First row'], [2, 2, 'BETA', 'E · VIRTUAL FEED – First row'],
    [3, 'slot 3', 'ALFA', 'E · VIRTUAL FEED – First row · loop of ID 1']]);
});

test('LOOP: una riga vuota prima del LOOP chiede il blank, niente recupero', () => {
  const c = provaUnico({ giro: true, righe: ['ALFA', 'BETA', null], slot: ['ALFA', 'BETA', 'ALFA'] });
  assert.deepEqual([...new Set(c.esiti.map((e) => [e.tipo, e.id, e.atteso, e.trovato].join('|')))], ['Error|3|Blank|ALFA_LED']);
});
