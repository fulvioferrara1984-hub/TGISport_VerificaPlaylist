// Visual check (app/revisione.js): schermate senza doppioni, avanzamento e righe Error dalle risposte.
const test = require('node:test');
const assert = require('node:assert/strict');
const { schermate, avanzamento, esitiVisivi, testoAvanzamento } = require('../app/revisione.js');

const voce = ({ feed = 'EU', segmento = '1st Half', slot = 1, id, gruppo = 'First row', colonna = 'F · EUROPE – First row', atteso = 'ALFA', nota = '', zone = [['GL_SX_1', 'a.mp4']] } = {}) => ({
  feed, segmento, slot, id: id === undefined ? slot : id, gruppo, colonna, atteso, nota, zone: zone.map(([zona, file]) => ({ zona, file })),
});
const statico = (slot, zona, file, atteso, colonna, extra = {}) => voce({ slot, gruppo: 'Statics', zona, colonna, atteso, zone: [[zona, file]], ...extra });
const risposte = (...coppie) => new Map(coppie.map(([chiave, esito, nota = '']) => [chiave, { esito, nota }]));

test('schermate: righe e statici dello stesso slot in una schermata; statici dello stesso brand fusi', () => {
  const s = schermate([
    statico(1, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE'),
    voce({ atteso: 'ALFA' }),
    voce({ gruppo: 'Second row', colonna: 'G · EUROPE – Second row', atteso: 'BETA', zone: [['GL_SX_2', 'b.mp4']] }),
    statico(1, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1'),
    statico(1, 'CLUB_USX', 'g2.png', 'GAMMA', 'STATIC B6 · CLUB MAT 2'),
  ]);
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].gruppi.map((g) => [g.gruppo, g.atteso]), [['First row', 'ALFA'], ['Second row', 'BETA'], ['Statics', 'DELTA'], ['Statics', 'GAMMA']]);
  const gamma = s[0].gruppi[3];
  assert.deepEqual(gamma.zone.map((z) => z.zona), ['CLUB_LSX', 'CLUB_USX']);
  assert.deepEqual(gamma.usi.map((u) => u.colonna), ['STATIC B5 · CLUB MAT 1', 'STATIC B6 · CLUB MAT 2']);
  assert.deepEqual(s[0].dove, [{ feed: 'EU', segmento: '1st Half', ids: [1] }]);
});

test('slot identici in feed diversi: una schermata, dove con tutti gli ID', () => {
  const s = schermate([voce({ slot: 1 }), voce({ slot: 2 }), voce({ feed: 'ASIA', slot: 1, colonna: 'H · ASIA – First row' })]);
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].dove, [{ feed: 'EU', segmento: '1st Half', ids: [1, 2] }, { feed: 'ASIA', segmento: '1st Half', ids: [1] }]);
  assert.equal(s[0].gruppi[0].usi.length, 3);
});

test('ID diversi dallo slot: righe e statici restano insieme', () => {
  const s = schermate([voce({ slot: 1, id: 2 }), statico(1, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE', { id: 1 })]);
  assert.equal(s.length, 1);
  assert.equal(s[0].gruppi.length, 2);
  assert.deepEqual(s[0].dove, [{ feed: 'EU', segmento: '1st Half', ids: [2] }]);
});

test('gruppo uguale in schermate diverse: stesso oggetto, usi di tutte', () => {
  const s = schermate([
    voce({ slot: 1, atteso: 'ALFA' }), statico(1, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1'),
    voce({ slot: 2, atteso: 'BETA', zone: [['GL_SX_1', 'b.mp4']] }), statico(2, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1'),
  ]);
  assert.equal(s.length, 2);
  assert.equal(s[0].gruppi[1], s[1].gruppi[1]);
  assert.equal(s[0].gruppi[1].usi.length, 2);
});

test('brand con scritture diverse = stesso gruppo; nota diversa = gruppo diverso', () => {
  const s = schermate([voce({ slot: 1, atteso: 'Alfa ' }), voce({ slot: 2, atteso: 'ALFA' }), voce({ slot: 3, atteso: 'ALFA', nota: 'repeat of ID 2' })]);
  assert.equal(s.length, 2);
  assert.equal(s[0].gruppi[0].usi.length, 2);
  assert.equal(s[1].gruppi[0].nota, 'repeat of ID 2');
  assert.notEqual(s[0].gruppi[0].chiave, s[1].gruppi[0].chiave);
});

test('esitiVisivi: Wrong → un Error per uso e zona, con file e nota; Correct → niente', () => {
  const voci = [1, 2].flatMap((slot) => [statico(slot, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1'), statico(slot, 'CLUB_USX', 'g2.png', 'GAMMA', 'STATIC B6 · CLUB MAT 2')]);
  const s = schermate(voci);
  const chiave = s[0].gruppi[0].chiave;
  const righe = esitiVisivi(s, risposte([chiave, 'wrong', 'shows OMEGA']));
  assert.equal(righe.length, 4);
  assert.deepEqual(righe[0], { tipo: 'Error', feed: 'EU', segmento: '1st Half', id: 1, colonna: 'STATIC B5 · CLUB MAT 1', zona: 'CLUB_LSX', atteso: 'GAMMA', trovato: 'wrong animation (visual check): g1.png + g2.png — shows OMEGA' });
  assert.deepEqual(righe.map((r) => [r.id, r.zona]), [[1, 'CLUB_LSX'], [1, 'CLUB_USX'], [2, 'CLUB_LSX'], [2, 'CLUB_USX']]);
  assert.equal(esitiVisivi(s, risposte([chiave, 'wrong']))[0].trovato, 'wrong animation (visual check): g1.png + g2.png');
  assert.deepEqual(esitiVisivi(s, risposte([chiave, 'correct'])), []);
});

test('esitiVisivi: un gruppo presente in più schermate si conta una volta', () => {
  const s = schermate([
    voce({ slot: 1, atteso: 'ALFA' }), statico(1, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE'),
    voce({ slot: 2, atteso: 'BETA', zone: [['GL_SX_1', 'b.mp4']] }), statico(2, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE'),
  ]);
  const righe = esitiVisivi(s, risposte([s[0].gruppi[1].chiave, 'wrong']));
  assert.deepEqual(righe.map((r) => r.id), [1, 2]);
});

test('avanzamento e testo', () => {
  const s = schermate([
    voce({ slot: 1, atteso: 'ALFA' }), statico(1, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE'),
    voce({ slot: 2, atteso: 'BETA', zone: [['GL_SX_1', 'b.mp4']] }), statico(2, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE'),
  ]);
  const [alfa, delta] = s[0].gruppi;
  const beta = s[1].gruppi[0];
  assert.deepEqual(avanzamento(s, new Map()), { totale: 2, riviste: 0, sbagliati: 0, risposti: 0 });
  assert.equal(testoAvanzamento(avanzamento(s, new Map())), 'not started');
  assert.deepEqual(avanzamento(s, risposte([delta.chiave, 'correct'], [alfa.chiave, 'correct'])), { totale: 2, riviste: 1, sbagliati: 0, risposti: 2 });
  const tutte = risposte([delta.chiave, 'correct'], [alfa.chiave, 'correct'], [beta.chiave, 'wrong']);
  assert.equal(testoAvanzamento(avanzamento(s, tutte)), '2 of 2 slots reviewed · 1 wrong');
  assert.deepEqual(schermate([]), []);
  assert.equal(testoAvanzamento(avanzamento([], new Map())), 'nothing to review');
});

test('Vault: zone dello stesso Partner in un gruppo, ordine di prima apparizione della zona', () => {
  const z = (zona, file, atteso, colonna) => voce({ gruppo: 'Zone', zona, colonna, atteso, zone: [[zona, file]] });
  const s = schermate([z('Left', 'l.mov', 'ALFA', 'F · Left – File name'), z('Center', 'c.png', 'CENTRE', 'H · Center – File name'), z('Right', 'r.mov', 'ALFA', 'J · Right – File name')]);
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].gruppi.map((g) => g.zone.map((x) => x.zona)), [['Left', 'Right'], ['Center']]);
});
