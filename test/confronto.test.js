// Motore completo (app/confronto.js) su modelli sintetici: pacchetto, alias probabili, scambi, riepilogo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { art, BLANK, CIRCLE, segmento, tabella, breve } = require('./fixture-modello.js');
const { verifica, tipoSegmento, squadre } = require('../app/confronto.js');

const REGOLE = { alias: {}, zoneSponsor: { prefisso: 'SPZ_', etichetta: 'SPZ zones', DOM: 'SPZVITA', FE: null, altri: 'OMEGABET' } };
const ZONE = ['FULL PERIMETER', 'CC'];
const statici = () => new Map([['CC|EU', { valore: null, cella: 'E3', etichetta: 'CENTRE CIRCLE' }]]);

// righe: valori Excel per EU prima fila; slot: artwork in FULL PERIMETER (null = Blank), con il lead-in davanti
function modello({ righe, slot, titolo = 'ALFA - BETA V2', evento = 'ALFA-BETA_V3', regioniStream = ['EU'], nomeStream = 'Europa', colonne = { 'EU|1': 4 }, media, segmenti }) {
  const tab = tabella({ colonne, righe: righe.map((v) => ({ valori: typeof v === 'object' && v !== null ? v : { 'EU|1': v } })) });
  const excel = { titolo, partite: { MATCH: tab }, hl: tabella({ colonne, righe: [] }), statici: statici() };
  const iv = [{ mappe: { 0: BLANK, 1: CIRCLE } }].concat(slot.map((a) => ({ mappe: { 0: a || BLANK, 1: CIRCLE } })));
  const tutti = new Set();
  iv.forEach((s) => Object.values(s.mappe).forEach((a) => tutti.add(a.file.split('/').pop())));
  const air = {
    evento: { nome: evento, data: '2026-10-12', venue: 'Stadio Prova' },
    zone: new Map(ZONE.map((z, i) => [i, z])),
    stream: [{ nome: nomeStream, regioni: new Set(regioniStream), segmenti: segmenti || [pre(), segmento('1st Half - 2nd Half', iv), segmento('Highlights', [])] }],
    media: media || tutti,
  };
  return { excel, air };
}
const A = (n) => art(`${n}_GC1`, `CASA_${n}_1`);
// pre-match vuoto: 3 slot con LED Blank e centro campo vuoto
function pre() { return segmento('Pre Match - Post Match', [0, 1, 2].map(() => ({ mappe: { 0: BLANK, 1: CIRCLE } }))); }
const senzaHL = (esiti) => esiti.filter((e) => !(e.tipo === 'Warning' && e.segmento === 'Highlights'));

test('tipo dei segmenti', () => {
  assert.equal(tipoSegmento('Pre Match - Post Match'), 'PRE');
  assert.equal(tipoSegmento('1st - 2nd Half'), 'MATCH');
  assert.equal(tipoSegmento('1st Half - 2nd Half'), 'MATCH');
  assert.equal(tipoSegmento('1st Half'), 'MATCH1');
  assert.equal(tipoSegmento('2 nd Half'), 'MATCH2');
  assert.equal(tipoSegmento('Highlights'), 'HL');
});

test('squadre dal titolo Excel o dal nome evento', () => {
  assert.deepEqual(squadre('ALFA - BETA V2'), ['ALFA', 'BETA']);
  assert.deepEqual(squadre('6 - GAMMA-DELTA'), ['GAMMA', 'DELTA']);
  assert.deepEqual(squadre('MATCH | EPSILON-ZETA'), ['EPSILON', 'ZETA']);
  assert.deepEqual(squadre('ETA VS THETA'), ['ETA', 'THETA']);
  assert.deepEqual(squadre('MATCH NU VS XI'), ['NU', 'XI']);
  assert.deepEqual(squadre('IOTA-KAPPA - SABATO 10 OTTOBRE h. 18:00'), ['IOTA', 'KAPPA']);
  assert.deepEqual(squadre('Lambda - Mu 1ST HALF'), ['LAMBDA', 'MU']);
  assert.deepEqual(squadre('OMICRON-PI_V3'), ['OMICRON', 'PI']);
  assert.equal(squadre('MATCH'), null);
});

test('alias probabile: nome Excel sconosciuto sempre sullo stesso brand', () => {
  const { excel, air } = modello({ righe: ['ZORRO TV', 'ZORRO TV', 'ALFA'], slot: [A('ZTV'), A('ZTV'), A('ALFA')] });
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual(breve(senzaHL(r.esiti)).map((e) => [e.tipo, e.id, e.atteso, e.trovato]), [
    ['Possible alias', 1, 'ZORRO TV', 'ZTV_GC1'], ['Possible alias', 2, 'ZORRO TV', 'ZTV_GC1'],
  ]);
});

test('non è alias se lo stesso nome Excel altrove corrisponde', () => {
  const { excel, air } = modello({ righe: ['ALFA', 'ALFA', 'ALFA'], slot: [A('ALFA'), A('ALFA'), A('OMEGA')] });
  assert.deepEqual(breve(senzaHL(verifica(excel, air, REGOLE).esiti)).map((e) => [e.tipo, e.id, e.trovato]), [['Error', 3, 'OMEGA_GC1']]);
});

test('scambio tra due nomi dell’Excel: Error, non alias', () => {
  const { excel, air } = modello({ righe: ['ALFA', 'BETA'], slot: [A('BETA'), A('ALFA')] });
  assert.deepEqual(breve(senzaHL(verifica(excel, air, REGOLE).esiti)).map((e) => [e.tipo, e.id]), [['Error', 1], ['Error', 2]]);
});

test('regione con contenuto nell’Excel senza feed nello zip', () => {
  const { excel, air } = modello({ colonne: { 'EU|1': 4, 'VN|1': 5 }, righe: [{ 'EU|1': 'ALFA', 'VN|1': 'BETA' }], slot: [A('ALFA')] });
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual(r.esiti.find((e) => e.feed === 'VIETNAM'), { tipo: 'Error', feed: 'VIETNAM', segmento: '-', id: '-', colonna: '-', zona: '-', atteso: 'AIR feed for VIETNAM', trovato: 'missing' });
});

test('file media mancante e sequenza mancante', () => {
  const { excel, air } = modello({ righe: ['ALFA'], slot: [A('ALFA')], media: new Set(['1503_blank_generic.png', '1356_circle_empty.png']) });
  air.stream[0].segmenti.push({ nome: 'Highlights', file: 'sequences/europa_hl.hdm', intervalli: null });
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual(breve(r.esiti.filter((e) => e.atteso === 'media file')), [{ tipo: 'Error', id: 1, colonna: '-', zona: 'FULL PERIMETER', atteso: 'media file', trovato: 'missing 1000_alfa_gc1.mp4' }]);
  assert.deepEqual(breve(r.esiti.filter((e) => e.atteso === 'sequence file')), [{ tipo: 'Error', id: '-', colonna: '-', zona: '-', atteso: 'sequence file', trovato: 'missing sequences/europa_hl.hdm' }]);
});

test('slot non contigui', () => {
  const { excel, air } = modello({ righe: ['ALFA', 'ALFA'], slot: [A('ALFA'), A('ALFA')] });
  air.stream[0].segmenti[0].intervalli[2].inizio = 40000;
  const r = verifica(excel, air, REGOLE);
  // pre-match: slot numerati da 1, come negli statici (il buco è dopo il secondo slot)
  assert.deepEqual(breve(r.esiti.filter((e) => e.atteso === 'contiguous slots')), [{ tipo: 'Error', id: 2, colonna: '-', zona: '-', atteso: 'contiguous slots', trovato: 'gap at 30000 ms' }]);
});

test('tempi separati: ogni foglio con la sua sequenza', () => {
  const { excel, air } = modello({ righe: ['ALFA'], slot: [A('ALFA')] });
  excel.partite = { MATCH1: tabella({ foglio: '1ST HALF', colonne: { 'EU|1': 4 }, righe: [{ valori: { 'EU|1': 'ALFA' } }] }),
    MATCH2: tabella({ foglio: '2ND HALF', colonne: { 'EU|1': 4 }, righe: [{ valori: { 'EU|1': 'BETA' } }] }) };
  const iv = (a) => [{ mappe: { 0: BLANK, 1: CIRCLE } }, { mappe: { 0: a, 1: CIRCLE } }];
  air.stream[0].segmenti = [pre(), segmento('1st Half', iv(A('ALFA'))), segmento('2 nd Half', iv(A('ALFA'))), segmento('Highlights', [])];
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual(r.esiti.filter((e) => e.tipo === 'Error').map((e) => [e.segmento, e.id, e.atteso, e.trovato]), [['2 nd Half', 1, 'BETA', 'ALFA_GC1']]);
});

test('foglio Excel mancante per un segmento', () => {
  const { excel, air } = modello({ righe: ['ALFA'], slot: [A('ALFA')] });
  air.stream[0].segmenti[0].nome = '1st Half';
  const r = verifica(excel, air, REGOLE);
  assert.ok(r.esiti.some((e) => e.atteso === 'Excel sheet for 1st Half' && e.trovato === 'missing'));
});

test('riepilogo: partita, squadre, partite diverse, conteggi', () => {
  const { excel, air } = modello({ righe: ['ALFA', 'belta'], slot: [A('ALFA'), A('MELTA')] });
  const r = verifica(excel, air, REGOLE);
  assert.equal(r.riepilogo.partita, 'ALFA - BETA');
  assert.deepEqual([r.riepilogo.casa, r.riepilogo.ospite, r.riepilogo.venue, r.riepilogo.dataEvento], ['ALFA', 'BETA', 'Stadio Prova', '2026-10-12']);
  assert.equal(r.riepilogo.partiteDiverse, false);
  assert.equal(r.riepilogo.conteggi['Possible typo'], 1);
  assert.equal(r.celle, 14); // virtual: 2 righe × (riga + 1 fila); statici: CC in 3 slot + LED nel lead-in; pre-match: 3 × (LED + CC)
  const diverse = modello({ righe: ['ALFA'], slot: [A('ALFA')], evento: 'GAMMA-DELTA' });
  assert.equal(verifica(diverse.excel, diverse.air, REGOLE).riepilogo.partiteDiverse, true);
  const generico = modello({ righe: ['ALFA'], slot: [A('ALFA')], titolo: 'MATCH', evento: 'GAMMA-DELTA' });
  const rg = verifica(generico.excel, generico.air, REGOLE).riepilogo;
  assert.deepEqual([rg.partita, rg.casa, rg.ospite, rg.partiteDiverse], ['GAMMA - DELTA', 'GAMMA', 'DELTA', false]);
});

test('feed mancante anche quando il Domestico ha solo asset statici', () => {
  const { excel, air } = modello({ righe: ['ALFA'], slot: [A('ALFA')] });
  excel.statici.set('MAT1|DOM', { valore: 'GAMMA', cella: 'B4', etichetta: 'CLUB MAT 1' });
  excel.statici.set('MAT1|VN', { valore: 'GAMMA', cella: 'I4', etichetta: 'CLUB MAT 1' });
  const mancanti = verifica(excel, air, REGOLE).esiti.filter((e) => e.trovato === 'missing' && e.segmento === '-');
  // il Domestico ha solo statici: senza il suo feed è un errore; per le altre regioni contano i virtual (statici del template sempre pieni)
  assert.deepEqual(mancanti.map((e) => [e.tipo, e.feed, e.atteso]), [['Error', 'DOMESTIC', 'AIR feed for DOMESTIC']]);
});

test('segmento mancante in un feed', () => {
  const { excel, air } = modello({ righe: ['ALFA'], slot: [A('ALFA')] });
  air.stream[0].segmenti = air.stream[0].segmenti.filter((g) => g.nome !== 'Highlights' && !g.nome.startsWith('Pre'));
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual(breve(r.esiti.filter((e) => e.atteso === 'AIR sequence')).map((e) => [e.tipo, e.id, e.colonna, e.zona, e.trovato]), [['Error', '-', '-', '-', 'missing'], ['Error', '-', '-', '-', 'missing']]);
  assert.deepEqual(r.esiti.filter((e) => e.atteso === 'AIR sequence').map((e) => [e.feed, e.segmento]), [['Europa', 'Pre Match - Post Match'], ['Europa', 'Highlights']]);
});

test('centro campo: errori veri, mai alias', () => {
  // brand sul centro campo durante la partita (atteso vuoto)
  const { excel, air } = modello({ righe: ['ALFA'], slot: [A('ALFA')] });
  air.stream[0].segmenti[1].intervalli[1].mappe.set(1, art('ZZCC_CC'));
  air.media.add('1000_zzcc_cc.mp4');
  const cc = verifica(excel, air, REGOLE).esiti.filter((e) => e.zona === 'CC');
  assert.deepEqual(cc.map((e) => [e.tipo, e.atteso, e.trovato]), [['Error', 'Circle_Empty', 'ZZCC_CC']]);
  // brand atteso nello slot 2 del pre-match ma centro campo vuoto
  const m2 = modello({ righe: ['ALFA'], slot: [A('ALFA')] });
  m2.excel.statici.set('CC|EU', { valore: 'GAMMA', cella: 'E3', etichetta: 'CENTRE CIRCLE' });
  const cc2 = verifica(m2.excel, m2.air, REGOLE).esiti.filter((e) => e.zona === 'CC');
  assert.deepEqual(cc2.map((e) => [e.tipo, e.segmento, e.id, e.atteso, e.trovato]), [['Error', 'Pre Match - Post Match', 2, 'GAMMA', 'Circle_Empty']]);
});

test('segmenti con nome sconosciuto: non si indovinano', () => {
  assert.equal(tipoSegmento('2nd Half'), 'MATCH2');
  assert.equal(tipoSegmento('Second Half'), 'MATCH2');
  assert.equal(tipoSegmento('First Half'), 'MATCH1');
  assert.equal(tipoSegmento('Extra Time'), null);
  const { excel, air } = modello({ righe: ['ALFA'], slot: [A('ALFA')] });
  air.stream[0].segmenti.push(segmento('Extra Time', [{ mappe: { 0: A('OMEGA'), 1: CIRCLE } }]));
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual(r.esiti.filter((e) => e.segmento === 'Extra Time'),
    [{ tipo: 'Warning', feed: 'Europa', segmento: 'Extra Time', id: '-', colonna: '-', zona: '-', atteso: 'known segment', trovato: 'not checked' }]);
});

test('cartella advertisements vuota: un errore, non mille', () => {
  const { excel, air } = modello({ righe: ['ALFA'], slot: [A('ALFA')], media: new Set() });
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual(r.esiti.filter((e) => String(e.atteso).startsWith('media')),
    [{ tipo: 'Error', feed: '-', segmento: '-', id: '-', colonna: '-', zona: '-', atteso: 'media files in advertisements/', trovato: 'none' }]);
});

test('righe Excel con ID non numerico: avviso con foglio e cella', () => {
  const { excel, air } = modello({ righe: ['ALFA'], slot: [A('ALFA')] });
  excel.avvisi = [{ foglio: 'PLAYLIST', riga: 8, id: '3a' }];
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual(r.esiti.filter((e) => e.atteso === 'numeric ID'),
    [{ tipo: 'Warning', feed: '-', segmento: '-', id: '3a', colonna: 'PLAYLIST · A8', zona: '-', atteso: 'numeric ID', trovato: '3a' }]);
});

test('i risultati di una cella portano il numero della cella; quelli del pacchetto no', () => {
  const { excel, air } = modello({ righe: ['ALFA', 'BETA'], slot: [A('OMEGA')], media: new Set(['1503_blank_generic.png', '1356_circle_empty.png']) });
  const r = verifica(excel, air, REGOLE);
  const sbagliato = r.esiti.find((e) => e.atteso === 'ALFA');
  assert.ok(Number.isInteger(sbagliato.cella) && sbagliato.cella >= 1 && sbagliato.cella <= r.celle);
  assert.equal(r.esiti.find((e) => e.atteso === 'AIR slot').cella, undefined); // riga Excel senza slot
  assert.equal(r.esiti.find((e) => e.atteso === 'media file').cella, undefined);
});

test('zone in uso dal pacchetto intero: una zona vuota per tutta la partita ma usata negli highlights è un errore', () => {
  const { excel, air } = modello({ righe: ['ALFA'], slot: [A('ALFA')] });
  air.zone = new Map([[0, 'GL_SX_1'], [1, 'CC'], [2, 'GL_DX_1']]);
  excel.hl = tabella({ colonne: { 'EU|1': 4 }, righe: [{ valori: { 'EU|1': 'ALFA' } }] });
  air.stream[0].segmenti[2] = segmento('Highlights', [{ mappe: { 0: A('ALFA'), 1: CIRCLE, 2: A('ALFA') } }]);
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual(breve(r.esiti.filter((e) => e.zona === 'GL_DX_1')), [{ tipo: 'Error', id: 1, colonna: 'E · EUROPE – First row', zona: 'GL_DX_1', atteso: 'ALFA', trovato: 'Blank' }]);
});

test('video che non sta nello slot: errore; se ci sta un numero intero di volte (gira più volte) va bene', () => {
  const { excel, air } = modello({ righe: ['ALFA', 'ALFA', 'BETA', 'BETA'], slot: [A('ALFA'), A('ALFA'), A('BETA'), A('BETA')] });
  const durate = [15000, 10000, 30000, 15000, 30000]; // lead-in, poi gli slot
  air.stream[0].segmenti[1] = segmento('1st Half - 2nd Half', air.stream[0].segmenti[1].intervalli.map((iv, i) => ({ durata: durate[i], mappe: Object.fromEntries(iv.mappe) })));
  air.durateMedia = new Map([['1000_alfa_gc1.mp4', 15], ['1000_beta_gc1.mp4', 10]]);
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual(breve(r.esiti.filter((e) => String(e.atteso).startsWith('video'))), [
    { tipo: 'Error', id: 1, colonna: '-', zona: 'FULL PERIMETER', atteso: 'video fitting a 10 s slot', trovato: 'ALFA_GC1 · 15 s' },
    { tipo: 'Error', id: 3, colonna: '-', zona: 'FULL PERIMETER', atteso: 'video fitting a 15 s slot', trovato: 'BETA_GC1 · 10 s' },
  ]);
});
