// Controllo degli asset statici (app/confronto-statici.js) su modelli sintetici.
const test = require('node:test');
const assert = require('node:assert/strict');
const { art, BLANK, CIRCLE, segmento, contesto, stream, breve } = require('./fixture-modello.js');
const { attesiStatici, controllaStatici } = require('../app/confronto-statici.js');

const SPONSOR = { prefisso: 'SPZ_', etichetta: 'SPZ zones', DOM: 'SPZVITA', FE: null, altri: 'OMEGABET' };
const st = (valore, cella, etichetta) => ({ valore, cella, etichetta });

function prova({ zone, regioni = ['EU'], tipo = 'MATCH', slot, attesi = {}, angoliStatici = false }) {
  const c = contesto({ zone, angoliStatici, prefissoSponsor: SPONSOR.prefisso });
  const nomeSeg = { PRE: 'Pre Match - Post Match', HL: 'Highlights' }[tipo] || '1st Half - 2nd Half';
  controllaStatici(c, stream('Feed', regioni), segmento(nomeSeg, slot), tipo, attesi, SPONSOR);
  return c;
}

test('centro campo solo nello slot 2 del pre-match', () => {
  const c = prova({
    zone: ['FULL PERIMETER', 'CC'], tipo: 'PRE', attesi: { CC: st('ALFA', 'B3', 'CENTRE CIRCLE') },
    slot: [{ mappe: { 0: BLANK, 1: art('ALFA_CC') } }, { mappe: { 0: BLANK, 1: CIRCLE } }, { mappe: { 0: BLANK, 1: CIRCLE } }],
  });
  assert.deepEqual(breve(c.esiti), [
    { tipo: 'Error', id: 1, colonna: 'STATIC B3 · CENTRE CIRCLE', zona: 'CC', atteso: 'Circle_Empty', trovato: 'ALFA_CC' },
    { tipo: 'Error', id: 2, colonna: 'STATIC B3 · CENTRE CIRCLE', zona: 'CC', atteso: 'ALFA', trovato: 'Circle_Empty' },
  ]);
  assert.equal(c.celle.n, 6);
});

test('CLUB MAT dalla colonna del feed, con cella ed etichetta', () => {
  const c = prova({
    zone: ['CLUB_UDX'], attesi: { MAT3: st('ALFA', 'B6', 'CLUB MAT 3') },
    slot: [{ mappe: {} }, { mappe: { 0: art('ALFA_UDX') } }, { mappe: { 0: art('OMEGA_UDX') } }],
  });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 2, colonna: 'STATIC B6 · CLUB MAT 3', zona: 'CLUB_UDX', atteso: 'ALFA', trovato: 'OMEGA_UDX' }]);
});

test('zone a regola fissa: Domestico, Far East nessuno, altri feed', () => {
  const zone = ['SPZ_LSX'];
  const dom = prova({ zone, regioni: ['DOM'], slot: [{ mappe: {} }, { mappe: { 0: art('SPZVITA_LSX') } }] });
  assert.deepEqual(dom.esiti, []);
  const fe = prova({ zone, regioni: ['FE'], slot: [{ mappe: {} }, { mappe: { 0: art('OMEGABET_LSX') } }] });
  assert.deepEqual(breve(fe.esiti), [{ tipo: 'Error', id: 1, colonna: 'Rule · SPZ zones', zona: 'SPZ_LSX', atteso: 'nothing', trovato: 'OMEGABET_LSX' }]);
  const eu = prova({ zone, regioni: ['EU'], slot: [{ mappe: {} }, { mappe: {} }] });
  assert.deepEqual(breve(eu.esiti), [{ tipo: 'Error', id: 1, colonna: 'Rule · SPZ zones', zona: 'SPZ_LSX', atteso: 'OMEGABET', trovato: 'nothing' }]);
});

test('ADDITIONAL: su RSX/RDX anche nel Domestico, ADD_n vuote nel Domestico', () => {
  const c = prova({
    zone: ['RSX', 'ADD_1'], regioni: ['DOM'], attesi: { ADD: st('ALFA', 'B8', 'ADDITIONAL') },
    slot: [{ mappe: {} }, { mappe: { 0: art('ALFA_RSX'), 1: art('ALFA_ADD') } }],
  });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 1, colonna: 'Rule · Domestic ADD zones', zona: 'ADD_1', atteso: 'nothing', trovato: 'ALFA_ADD' }]);
  const intl = prova({ zone: ['RSX', 'ADD_1'], attesi: { ADD: st('ALFA', 'E8', 'ADDITIONAL') }, slot: [{ mappe: {} }, { mappe: { 0: art('ALFA_RSX'), 1: art('ALFA_ADD') } }] });
  assert.deepEqual(intl.esiti, []);
});

test('LOWER CORNER sulle zone LC_x_1', () => {
  const c = prova({ zone: ['LC_SX_1'], angoliStatici: true, attesi: { LC: st('BETA', 'B9', 'LOWER CORNER') }, slot: [{ mappe: {} }, { mappe: { 0: BLANK } }] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 1, colonna: 'STATIC B9 · LOWER CORNER', zona: 'LC_SX_1', atteso: 'BETA', trovato: 'nothing' }]);
});

test('pre-match e lead-in senza statici e con LED Blank', () => {
  const pre = prova({ zone: ['CLUB_LSX'], tipo: 'PRE', attesi: { MAT1: st('ALFA', 'B4', 'CLUB MAT 1') }, slot: [{ mappe: { 0: art('ALFA_LSX') } }] });
  assert.deepEqual(breve(pre.esiti), [{ tipo: 'Error', id: 1, colonna: '-', zona: 'CLUB_LSX', atteso: 'nothing', trovato: 'ALFA_LSX' }]);
  const lead = prova({ zone: ['FULL PERIMETER'], slot: [{ mappe: { 0: art('ALFA_GC1') } }] });
  assert.deepEqual(breve(lead.esiti), [{ tipo: 'Error', id: 0, colonna: '-', zona: 'FULL PERIMETER', atteso: 'Blank', trovato: 'ALFA_GC1' }]);
});

test('STATIC ASSETS vuoto e brand nello zip: Error', () => {
  const c = prova({ zone: ['CLUB_LSX'], attesi: { MAT1: st(null, 'C4', 'CLUB MAT 1') }, slot: [{ mappe: {} }, { mappe: { 0: art('SIGMA_LSX') } }] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 1, colonna: 'STATIC C4 · CLUB MAT 1', zona: 'CLUB_LSX', atteso: 'nothing', trovato: 'SIGMA_LSX' }]);
});

test('highlights: ID degli statici da 1', () => {
  const c = prova({ zone: ['CLUB_LSX'], tipo: 'HL', attesi: { MAT1: st('ALFA', 'E4', 'CLUB MAT 1') }, slot: [{ mappe: { 0: art('OMEGA_LSX') } }] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 1, colonna: 'STATIC E4 · CLUB MAT 1', zona: 'CLUB_LSX', atteso: 'ALFA', trovato: 'OMEGA_LSX' }]);
});

test('regioni dello stesso feed con statici diversi', () => {
  const esiti = [];
  const statici = new Map([['MAT1|NA', st('ALFA', 'C4', 'CLUB MAT 1')], ['MAT1|CSA', st('BETA', 'D4', 'CLUB MAT 1')]]);
  const attesi = attesiStatici(statici, new Set(['NA', 'CSA']), (e) => esiti.push(e), 'Row (North America - Latam)');
  assert.deepEqual(esiti, [{ tipo: 'Error', feed: 'Row (North America - Latam)', segmento: 'Excel', id: '-', colonna: 'MAT1', zona: '-', atteso: 'same value for CENTRAL & SOUTH AMERICA, NORTH AMERICA', trovato: 'ALFA/BETA' }]);
  assert.deepEqual(attesi.MAT1, st('BETA', 'D4', 'CLUB MAT 1'));
  assert.deepEqual(attesi.CC, { valore: null, cella: '', etichetta: 'CC' });
});

test('zona CLUB con un nome inatteso: un avviso, nessun blocco; maiuscole indifferenti', () => {
  const c = prova({
    zone: ['CLUB_CX', 'club_lsx'], attesi: { MAT1: st('ALFA', 'E4', 'CLUB MAT 1') },
    slot: [{ mappe: {} }, { mappe: { 0: art('ALFA_CX'), 1: art('ALFA_LSX') } }, { mappe: { 0: art('ALFA_CX'), 1: art('ALFA_LSX') } }],
  });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Warning', id: '-', colonna: '-', zona: 'CLUB_CX', atteso: 'known CLUB zone', trovato: 'unknown zone' }]);
});
