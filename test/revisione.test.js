// Visual check (app/revisione.js): statici in una prima schermata, schermate degli slot senza doppioni, avanzamento e righe Error dalle risposte.
const test = require('node:test');
const assert = require('node:assert/strict');
const { schermate, avanzamento, esitiVisivi, testoAvanzamento, testoDaFare, doveGruppo, tuttoCorretto } = require('../app/revisione.js');

const voce = ({ feed = 'EU', segmento = '1st Half', slot = 1, id, gruppo = 'First row', colonna = 'F · EUROPE – First row', atteso = 'ALFA', nota = '', zone = [['GL_SX_1', 'a.mp4']] } = {}) => ({
  feed, segmento, slot, id: id === undefined ? slot : id, gruppo, colonna, atteso, nota, zone: zone.map(([zona, file]) => ({ zona, file })),
});
const statico = (slot, zona, file, atteso, colonna, extra = {}) => voce({ slot, gruppo: 'Statics', zona, colonna, atteso, zone: [[zona, file]], ...extra });
const zona = (slot, nome, file, atteso, extra = {}) => voce({ slot, gruppo: 'Zone', colonna: `F · ${nome} – File name`, atteso, zone: [[nome, file]], ...extra });
const risposte = (...coppie) => new Map(coppie.map(([chiave, esito, nota = '']) => [chiave, { esito, nota }]));
const forma = (lista) => lista.map((s) => [s.tipo, s.gruppi.map((g) => g.atteso)]);

test('statici in una prima schermata; lo slot mostra solo le file; statici dello stesso brand fusi', () => {
  const s = schermate([
    statico(1, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE'),
    voce({ atteso: 'ALFA' }),
    voce({ gruppo: 'Second row', colonna: 'G · EUROPE – Second row', atteso: 'BETA', zone: [['GL_SX_2', 'b.mp4']] }),
    statico(1, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1'),
    statico(1, 'CLUB_USX', 'g2.png', 'GAMMA', 'STATIC B6 · CLUB MAT 2'),
  ]);
  assert.deepEqual(forma(s), [['statici', ['DELTA', 'GAMMA']], ['slot', ['ALFA', 'BETA']]]);
  assert.deepEqual(s[0].dove, []);
  const gamma = s[0].gruppi[1];
  assert.equal(gamma.statico, true);
  assert.deepEqual(gamma.zone.map((z) => z.zona), ['CLUB_LSX', 'CLUB_USX']);
  assert.deepEqual(gamma.usi.map((u) => u.colonna), ['STATIC B5 · CLUB MAT 1', 'STATIC B6 · CLUB MAT 2']);
  assert.equal(s[1].gruppi[0].statico, false);
  assert.deepEqual(s[1].dove, [{ feed: 'EU', segmento: '1st Half', ids: [1] }]);
});

test('uno statico che va in onda in molti slot e feed compare una volta, con tutti i suoi usi; slot con soli statici: nessuna schermata', () => {
  const s = schermate([
    statico(0, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE', { segmento: 'Pre-match' }),
    ...[1, 2].flatMap((slot) => [voce({ slot }), statico(slot, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1')]),
    statico(1, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1', { feed: 'ASIA' }),
  ]);
  assert.deepEqual(forma(s), [['statici', ['DELTA', 'GAMMA']], ['slot', ['ALFA']]]);
  assert.equal(s[0].gruppi[1].usi.length, 3);
  assert.deepEqual(s[1].dove, [{ feed: 'EU', segmento: '1st Half', ids: [1, 2] }]);
});

test('solo statici: una sola schermata; nessuno statico: solo slot', () => {
  assert.deepEqual(forma(schermate([statico(1, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE')])), [['statici', ['DELTA']]]);
  assert.deepEqual(forma(schermate([voce({ slot: 1 }), voce({ slot: 2, atteso: 'BETA' })])), [['slot', ['ALFA']], ['slot', ['BETA']]]);
});

test('slot identici in feed diversi: una schermata, dove con tutti gli ID', () => {
  const s = schermate([voce({ slot: 1 }), voce({ slot: 2 }), voce({ feed: 'ASIA', slot: 1, colonna: 'H · ASIA – First row' })]);
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].dove, [{ feed: 'EU', segmento: '1st Half', ids: [1, 2] }, { feed: 'ASIA', segmento: '1st Half', ids: [1] }]);
  assert.equal(s[0].gruppi[0].usi.length, 3);
});

test('ID diversi dallo slot: lo slot si mostra con l\'ID delle sue file', () => {
  const s = schermate([statico(1, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE', { id: 1 }), voce({ slot: 1, id: 2 })]);
  assert.deepEqual(forma(s), [['statici', ['DELTA']], ['slot', ['ALFA']]]);
  assert.deepEqual(s[1].dove, [{ feed: 'EU', segmento: '1st Half', ids: [2] }]);
});

test('gruppo uguale in schermate diverse: stesso oggetto, usi di tutte', () => {
  const s = schermate([voce({ slot: 1 }), voce({ slot: 2 }), voce({ slot: 2, gruppo: 'Second row', colonna: 'G · EUROPE – Second row', atteso: 'BETA', zone: [['GL_SX_2', 'b.mp4']] })]);
  assert.equal(s.length, 2);
  assert.equal(s[0].gruppi[0], s[1].gruppi[0]);
  assert.equal(s[0].gruppi[0].usi.length, 2);
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
  const s = schermate([voce({ slot: 1 }), voce({ slot: 2 }), voce({ slot: 2, gruppo: 'Second row', colonna: 'G · EUROPE – Second row', atteso: 'BETA', zone: [['GL_SX_2', 'b.mp4']] })]);
  const righe = esitiVisivi(s, risposte([s[0].gruppi[0].chiave, 'wrong']));
  assert.deepEqual(righe.map((r) => r.id), [1, 2]);
});

test('avanzamento e testi: statici contati a parte dagli slot', () => {
  const s = schermate([
    voce({ slot: 1, atteso: 'ALFA' }), statico(1, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE'), statico(1, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1'),
    voce({ slot: 2, atteso: 'BETA', zone: [['GL_SX_1', 'b.mp4']] }), statico(2, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE'),
  ]);
  const [delta, gamma] = s[0].gruppi;
  const alfa = s[1].gruppi[0];
  const beta = s[2].gruppi[0];
  const vuoto = avanzamento(s, new Map());
  assert.deepEqual(vuoto, { totale: 2, riviste: 0, sbagliati: 0, risposti: 0, automatici: 0, gruppi: 4, statici: 2, staticiRisposti: 0 });
  assert.equal(testoAvanzamento(vuoto), 'not started');
  assert.equal(testoDaFare(vuoto), '2 slots and 2 static assets to review');
  const parte = avanzamento(s, risposte([delta.chiave, 'correct'], [gamma.chiave, 'wrong'], [alfa.chiave, 'correct']));
  assert.deepEqual(parte, { totale: 2, riviste: 1, sbagliati: 1, risposti: 3, automatici: 0, gruppi: 4, statici: 2, staticiRisposti: 2 });
  assert.equal(testoAvanzamento(parte), 'static assets 2 of 2 · 1 of 2 slots reviewed · 1 wrong');
  assert.equal(testoAvanzamento(avanzamento(s, risposte([beta.chiave, 'correct']))), 'static assets 0 of 2 · 1 of 2 slots reviewed · 0 wrong');
  const soloStatici = schermate([statico(1, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE')]);
  assert.equal(testoDaFare(avanzamento(soloStatici, new Map())), '1 static asset to review');
  assert.equal(testoAvanzamento(avanzamento(soloStatici, risposte([soloStatici[0].gruppi[0].chiave, 'correct']))), 'static assets 1 of 1 · 0 wrong');
  const soloSlot = schermate([voce({ slot: 1 })]);
  assert.equal(testoDaFare(avanzamento(soloSlot, new Map())), '1 slot to review');
  assert.equal(testoAvanzamento(avanzamento(soloSlot, risposte([soloSlot[0].gruppi[0].chiave, 'wrong']))), '1 of 1 slots reviewed · 1 wrong');
  assert.deepEqual(schermate([]), []);
  assert.equal(testoAvanzamento(avanzamento([], new Map())), 'nothing to review');
  assert.equal(testoDaFare(avanzamento([], new Map())), 'nothing to review');
});

test('tutto corretto: ogni gruppo, statici e slot, ha una risposta e nessuna è Wrong (anche se letta in automatico)', () => {
  const s = schermate([
    voce({ slot: 1, atteso: 'ALFA' }), statico(1, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE'),
    voce({ slot: 2, atteso: 'BETA', zone: [['GL_SX_1', 'b.mp4']] }),
  ]);
  const [delta] = s[0].gruppi;
  const alfa = s[1].gruppi[0];
  const beta = s[2].gruppi[0];
  const auto = { esito: 'correct', nota: '', auto: 'ALFA' };
  const conta = (r) => tuttoCorretto(avanzamento(s, r));
  assert.equal(conta(new Map()), false, 'niente risposte');
  assert.equal(conta(risposte([delta.chiave, 'correct'], [alfa.chiave, 'correct'])), false, 'manca uno slot');
  assert.equal(conta(risposte([delta.chiave, 'correct'], [alfa.chiave, 'correct'], [beta.chiave, 'correct'])), true, 'tutto a mano');
  assert.equal(conta(new Map([[delta.chiave, { esito: 'correct', nota: '' }], [alfa.chiave, auto], [beta.chiave, { esito: 'correct', nota: '' }]])), true, 'con una lettura automatica');
  assert.equal(conta(risposte([delta.chiave, 'correct'], [alfa.chiave, 'wrong'], [beta.chiave, 'correct'])), false, 'un Wrong');
  assert.equal(tuttoCorretto(avanzamento([], new Map())), false, 'niente da rivedere');
});

test('risposte automatiche (marchio letto): contate a parte, dette nel testo, nessuna riga Error', () => {
  const s = schermate([
    voce({ slot: 1, atteso: 'ALFA' }), statico(1, 'CC', 'cc.png', 'DELTA', 'STATIC B3 · CENTRE CIRCLE'), statico(1, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1'),
    voce({ slot: 2, atteso: 'BETA', zone: [['GL_SX_1', 'b.mp4']] }),
  ]);
  const [delta, gamma] = s[0].gruppi;
  const alfa = s[1].gruppi[0];
  const auto = (parola) => ({ esito: 'correct', nota: '', auto: parola });
  const r = new Map([[delta.chiave, auto('DELTA')], [alfa.chiave, auto('ALFA')], [gamma.chiave, { esito: 'wrong', nota: '' }]]);
  const av = avanzamento(s, r);
  assert.equal(av.automatici, 2);
  assert.equal(testoAvanzamento(av), 'static assets 2 of 2 · 1 of 2 slots reviewed · 2 read automatically · 1 wrong');
  assert.equal(testoAvanzamento(avanzamento(s, new Map([[alfa.chiave, auto('ALFA')]]))), 'static assets 0 of 2 · 1 of 2 slots reviewed · 1 read automatically · 0 wrong');
  assert.equal(esitiVisivi(s, r).length, gamma.usi.length);
});

test('doveGruppo: feed con gli stessi segmenti insieme, in ordine di apparizione', () => {
  const s = schermate([
    statico(1, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1'),
    statico(1, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1', { feed: 'ASIA' }),
    statico(1, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1', { feed: 'ASIA', segmento: 'Highlights' }),
    statico(1, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1', { feed: 'MENA' }),
  ]);
  assert.deepEqual(doveGruppo(s[0].gruppi[0]), [{ feed: ['EU', 'MENA'], segmenti: ['1st Half'] }, { feed: ['ASIA'], segmenti: ['1st Half', 'Highlights'] }]);
});

test('Vault: zone dello stesso Partner in un gruppo, ordine di prima apparizione della zona', () => {
  const s = schermate([zona(1, 'Left', 'l.mov', 'ALFA'), zona(1, 'Center', 'c.png', 'CENTRE'), zona(1, 'Right', 'r.mov', 'ALFA')]);
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].gruppi.map((g) => g.zone.map((x) => x.zona)), [['Left', 'Right'], ['Center']]);
});

test('Vault: una zona con lo stesso file in tutto il feed va negli statici, senza fondersi con le zone dello stesso Partner', () => {
  const s = schermate([
    zona(1, 'Left', 'l1.mov', 'ALFA'), zona(1, 'Center', 'c.png', 'ALFA'), zona(1, 'Right', 'r1.mov', 'ALFA'),
    zona(2, 'Left', 'l2.mov', 'BETA'), zona(2, 'Center', 'c.png', 'ALFA'), zona(2, 'Right', 'r2.mov', 'BETA'),
  ]);
  assert.deepEqual(forma(s), [['statici', ['ALFA']], ['slot', ['ALFA']], ['slot', ['BETA']]]);
  assert.deepEqual(s[0].gruppi[0].zone.map((z) => z.zona), ['Center']);
  assert.equal(s[0].gruppi[0].usi.length, 2);
  assert.deepEqual(s[1].gruppi[0].zone.map((z) => z.zona), ['Left', 'Right']);
});

test('Vault: una zona usata in un solo slot resta nello slot', () => {
  const s = schermate([zona(1, 'Left', 'l1.mov', 'ALFA'), zona(1, 'Center', 'c.png', 'CENTRE')]);
  assert.deepEqual(forma(s), [['slot', ['ALFA', 'CENTRE']]]);
});

test('ogni uso delle voci finisce in una schermata', () => {
  const voci = [
    ...[1, 2, 3].flatMap((slot) => [voce({ slot, atteso: slot === 3 ? 'BETA' : 'ALFA' }), statico(slot, 'CLUB_LSX', 'g1.png', 'GAMMA', 'STATIC B5 · CLUB MAT 1')]),
    zona(1, 'Left', 'l.mov', 'ALFA', { feed: 'V' }), zona(1, 'Center', 'c.png', 'C', { feed: 'V' }), zona(2, 'Center', 'c.png', 'C', { feed: 'V' }),
  ];
  const unici = [...new Map(schermate(voci).flatMap((s) => s.gruppi).map((g) => [g.chiave, g])).values()];
  assert.equal(unici.reduce((n, g) => n + g.usi.length, 0), voci.reduce((n, v) => n + v.zone.length, 0));
});
