// Lettura automatica del marchio (app/lettura-automatica.js): parola da cercare, confronto con il testo letto, risposte automatiche.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parolaMarchio, parole, trovata, daLeggere, applica, zoneLette } = require('../app/lettura-automatica.js');
const { schermate } = require('../app/revisione.js');

const voce = ({ slot = 1, gruppo = 'First row', atteso = 'ALFA', zone = [['GL_SX_1', 'a.mp4']] } = {}) => ({
  feed: 'EU', segmento: '1st Half', slot, id: slot, gruppo, colonna: 'F', atteso, nota: '', zone: zone.map(([zona, file]) => ({ zona, file })),
});
const letture = (oggetto) => new Map(Object.entries(oggetto).map(([file, trovate]) => [file, new Set(trovate)]));

test('parola da cercare: la più lunga del nome, senza codici, posizioni, numeri e parole corte', () => {
  assert.equal(parolaMarchio('Alfa Betagamma'), 'BETAGAMMA');
  assert.equal(parolaMarchio('ALFA (J)'), 'ALFA');
  assert.equal(parolaMarchio('ALFA_D'), 'ALFA');
  assert.equal(parolaMarchio('ALFA_JUMBO 2026'), 'ALFA');
  assert.equal(parolaMarchio('Alfa Beta'), 'ALFA'); // a pari lunghezza la prima
  assert.equal(parolaMarchio('AB'), null);
  assert.equal(parolaMarchio(''), null);
  assert.equal(parolaMarchio(null), null);
});

test('parola da cercare: senza regioni, lingue, OVERLAY e nomi delle due squadre', () => {
  assert.equal(parolaMarchio('ALFA OVERLAY EUROPA'), 'ALFA');
  assert.equal(parolaMarchio('ALFA AMERICHE'), 'ALFA');
  assert.equal(parolaMarchio('ALFA ENG'), 'ALFA');
  assert.equal(parolaMarchio('CASALUNGA ALFA', ['Casalunga', 'Ospitissimo']), 'ALFA');
  assert.equal(parolaMarchio('OSPITISSIMO', ['Casalunga', 'Ospitissimo']), null);
});

test('parola generica (SPORT, CLUB, HOME…): non si cerca, il gruppo resta da guardare', () => {
  assert.equal(parolaMarchio('ALFA SPORTS'), 'ALFA');
  assert.equal(parolaMarchio('SPORT CLUB'), null);
  assert.equal(parolaMarchio('HOME KIT'), null);
});

test('testo letto → parole di almeno 3 lettere o cifre, in maiuscolo', () => {
  assert.deepEqual(parole('Fly  alfa-beta 12 x\nGAMMA365'), ['FLY', 'ALFA', 'BETA', 'GAMMA365']);
  assert.deepEqual(parole(''), []);
  assert.deepEqual(parole('Più ÉLAN'), ['PIU', 'ELAN']); // accenti come lettere semplici
  assert.equal(parolaMarchio('Alfapiù'), 'ALFAPIU');
});

test('confronto: parola intera; una lettera di differenza solo da 6 lettere in su', () => {
  assert.equal(trovata('ALFA', ['XX', 'ALFA']), true);
  assert.equal(trovata('ALFA', ['ALFAX']), false); // un pezzo di parola non basta
  assert.equal(trovata('ALFA', ['ALFE']), false);
  assert.equal(trovata('BETAGAMMA', ['BETAGAMA']), true);
  assert.equal(trovata('BETAGAMMA', ['BETAGRAMMO']), false);
  assert.equal(trovata('ALFABE', ['ALFBAE']), true); // due lettere vicine scambiate
  assert.equal(trovata('ALFA', []), false);
});

test('confronto: lettere che il lettore confonde per forma (O Q 0, I L 1, S 5) valgono uguali', () => {
  assert.equal(trovata('QUOTA', ['OUOTA']), true);
  assert.equal(trovata('BITOS', ['BLT0S']), true);
  assert.equal(trovata('SIGMA', ['5IGMA']), true);
  assert.equal(trovata('QUOTA', ['OUOTE']), false); // le altre lettere restano diverse
});

test('da leggere: ogni file con le parole dei gruppi ancora senza risposta, nell\'ordine delle schermate', () => {
  const s = schermate([
    voce({ atteso: 'ALFA', zone: [['GL_SX_1', 'a.mp4'], ['JUMBO_1', 'a2.mp4']] }),
    voce({ gruppo: 'Second row', atteso: 'BETA', zone: [['GL_SX_2', 'b.mp4']] }),
    voce({ slot: 2, atteso: 'GAMMA', zone: [['GL_SX_1', 'a.mp4']] }),
    voce({ slot: 2, gruppo: 'Second row', atteso: 'SPORT', zone: [['GL_SX_2', 's.mp4']] }),
    voce({ slot: 3, gruppo: 'Statics', atteso: 'DELTA', zone: [['CC', 'cc.png']] }),
  ]);
  const tutti = daLeggere(s, new Map());
  assert.deepEqual([...tutti.keys()], ['cc.png', 'a.mp4', 'a2.mp4', 'b.mp4']); // statici prima; s.mp4 (parola generica) no
  assert.deepEqual([...tutti.get('a.mp4')], ['ALFA', 'GAMMA']);
  const beta = s.flatMap((x) => x.gruppi).find((g) => g.atteso === 'BETA');
  assert.equal(daLeggere(s, new Map([[beta.chiave, { esito: 'wrong', nota: '' }]])).has('b.mp4'), false);
});

test('risposta automatica solo se il marchio si legge in tutti i file del gruppo, mai sopra una risposta', () => {
  const s = schermate([
    voce({ atteso: 'ALFA', zone: [['GL_SX_1', 'a.mp4'], ['JUMBO_1', 'a2.mp4']] }),
    voce({ gruppo: 'Second row', atteso: 'BETA', zone: [['GL_SX_2', 'b.mp4']] }),
    voce({ slot: 2, atteso: 'GAMMA', zone: [['GL_SX_1', 'g.mp4']] }),
  ]);
  const [alfa, beta, gamma] = s.flatMap((x) => x.gruppi);
  const r = new Map([[gamma.chiave, { esito: 'wrong', nota: 'vedo altro' }]]);
  const l = letture({ 'a.mp4': ['ALFA'], 'b.mp4': ['BETA'], 'g.mp4': ['GAMMA'] });
  assert.equal(applica(s, r, l), 1);
  assert.equal(r.has(alfa.chiave), false); // a2.mp4 non letto
  assert.deepEqual(r.get(beta.chiave), { esito: 'correct', nota: '', auto: 'BETA' });
  assert.deepEqual(r.get(gamma.chiave), { esito: 'wrong', nota: 'vedo altro' });
  assert.deepEqual(zoneLette(alfa, l), [true, false]);
  l.set('a2.mp4', new Set(['ALFA']));
  assert.equal(applica(s, r, l), 1);
  assert.equal(r.get(alfa.chiave).auto, 'ALFA');
  assert.equal(applica(s, r, l), 0);
});

test('nomi delle squadre: valgono anche per le risposte automatiche', () => {
  const s = schermate([voce({ atteso: 'CASALUNGA ALFA', zone: [['GL_SX_1', 'a.mp4']] })]);
  const r = new Map();
  assert.equal(applica(s, r, letture({ 'a.mp4': ['CASALUNGA'] }), ['Casalunga']), 0);
  assert.equal(applica(s, r, letture({ 'a.mp4': ['ALFA'] }), ['Casalunga']), 1);
});
