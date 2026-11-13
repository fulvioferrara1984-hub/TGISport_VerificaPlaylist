// Controllo degli asset statici (app/confronto-statici.js) su modelli sintetici.
const test = require('node:test');
const assert = require('node:assert/strict');
const { art, BLANK, CIRCLE, segmento, contesto, stream, breve } = require('./fixture-modello.js');
const { attesiStatici, controllaStatici } = require('../app/confronto-statici.js');

const SPONSOR = { prefisso: 'SPZ_', etichetta: 'SPZ zones', DOM: 'SPZVITA', FE: null, altri: 'OMEGABET' };
const st = (valore, cella, etichetta) => ({ valore, cella, etichetta });

function prova({ zone, regioni = ['EU'], tipo = 'MATCH', slot, attesi = {}, angoliStatici = false, feedUnico = false }) {
  const c = contesto({ zone, angoliStatici, prefissoSponsor: SPONSOR.prefisso });
  c.feedUnico = feedUnico;
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

test('varianti di nome negli statici: registrate come Variant (per l’elenco Name variants)', () => {
  const c = prova({
    zone: ['FULL PERIMETER', 'CLUB_LSX', 'CC'], tipo: 'PRE', attesi: { CC: st('ALFA SPORT', 'B3', 'CENTRE CIRCLE') },
    slot: [{ mappe: { 0: BLANK, 2: CIRCLE } }, { mappe: { 0: BLANK, 2: art('ALFA_CC') } }, { mappe: { 0: BLANK, 2: CIRCLE } }],
  });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Variant', id: 2, colonna: 'STATIC B3 · CENTRE CIRCLE', zona: 'CC', atteso: 'ALFA SPORT', trovato: 'ALFA_CC' }]);
  const m = prova({ zone: ['CLUB_LSX'], attesi: { MAT1: st('BETA GROUP', 'B4', 'CLUB MAT 1') }, slot: [{ mappe: {} }, { mappe: { 0: art('BETA_LSX') } }] });
  assert.deepEqual(breve(m.esiti), [{ tipo: 'Variant', id: 1, colonna: 'STATIC B4 · CLUB MAT 1', zona: 'CLUB_LSX', atteso: 'BETA GROUP', trovato: 'BETA_LSX' }]);
});

test('animazioni: statici con brand atteso (MAT dalla colonna, zone a regola fissa)', () => {
  const c = prova({ zone: ['CLUB_UDX', 'SPZ_LSX'], attesi: { MAT3: st('ALFA', 'B6', 'CLUB MAT 3') },
    slot: [{ mappe: {} }, { mappe: { 0: art('ALFA_UDX'), 1: art('OMEGABET_LSX') } }] });
  assert.deepEqual(c.animazioni, [
    { feed: 'Feed', segmento: '1st Half - 2nd Half', slot: 1, id: 1, gruppo: 'Statics', colonna: 'STATIC B6 · CLUB MAT 3', atteso: 'ALFA', nota: '', zone: [{ zona: 'CLUB_UDX', file: '1000_alfa_udx.mp4' }] },
    { feed: 'Feed', segmento: '1st Half - 2nd Half', slot: 1, id: 1, gruppo: 'Statics', colonna: 'Rule · SPZ zones', atteso: 'OMEGABET', nota: '', zone: [{ zona: 'SPZ_LSX', file: '1000_omegabet_lsx.mp4' }] },
  ]);
});

test('animazioni: centro campo solo dove ha un brand atteso (slot 2 del pre-match)', () => {
  const c = prova({ zone: ['FULL PERIMETER', 'CC'], tipo: 'PRE', attesi: { CC: st('ALFA', 'B3', 'CENTRE CIRCLE') },
    slot: [{ mappe: { 0: BLANK, 1: CIRCLE } }, { mappe: { 0: BLANK, 1: art('ALFA_CC') } }, { mappe: { 0: BLANK, 1: CIRCLE } }] });
  assert.deepEqual(c.animazioni.map((v) => [v.slot, v.id, v.zone[0].zona, v.atteso, v.colonna]), [[1, 2, 'CC', 'ALFA', 'STATIC B3 · CENTRE CIRCLE']]);
});

test('animazioni: lead-in e statici senza brand atteso → nessuna voce', () => {
  const c = prova({ zone: ['CLUB_UDX'], attesi: { MAT3: st('ALFA', 'B6', 'CLUB MAT 3') }, slot: [{ mappe: { 0: art('ALFA_UDX') } }] });
  assert.deepEqual(c.animazioni, []);
});

test('centreboard: il brand della nota in ogni slot della partita, mai nel lead-in', () => {
  const CB = st('ALFA', 'N14', 'CENTREBOARD');
  const bene = prova({ zone: ['LEFT LED', 'CENTREBOARD'], attesi: { CB }, slot: [{ mappe: { 1: BLANK } }, { mappe: { 1: art('ALFA_CENTREBOARD') } }] });
  assert.deepEqual(bene.esiti, []);
  assert.deepEqual(bene.animazioni.map((v) => [v.gruppo, v.atteso, v.zone[0].zona]), [['Statics', 'ALFA', 'CENTREBOARD']]);
  const altro = prova({ zone: ['LEFT LED', 'CENTREBOARD'], attesi: { CB }, slot: [{ mappe: {} }, { mappe: { 1: art('OMEGA_CENTREBOARD') } }, { mappe: { 1: BLANK } }] });
  assert.deepEqual(breve(altro.esiti), [
    { tipo: 'Error', id: 1, colonna: 'STATIC N14 · CENTREBOARD', zona: 'CENTREBOARD', atteso: 'ALFA', trovato: 'OMEGA_CENTREBOARD' },
    { tipo: 'Error', id: 2, colonna: 'STATIC N14 · CENTREBOARD', zona: 'CENTREBOARD', atteso: 'ALFA', trovato: 'nothing' }]);
});

test('centreboard senza nota nell’Excel: non si controlla', () => {
  const c = prova({ zone: ['CENTREBOARD'], attesi: { CB: st(null, '', 'CB') }, slot: [{ mappe: {} }, { mappe: { 0: art('OMEGA_CENTREBOARD') } }] });
  assert.deepEqual(c.esiti, []);
});

test('texture del prato: nessun controllo', () => {
  const c = prova({ zone: ['GRASS_LSX_MEDIUM', 'GRASS_LDX_DARK'], attesi: {}, slot: [{ mappe: { 0: art('GRASS_MEDIUM') } }, { mappe: { 0: art('GRASS_MEDIUM'), 1: art('GRASS_DARK') } }] });
  assert.deepEqual(c.esiti, []);
  const pre = prova({ zone: ['GRASS_LSX_MEDIUM'], tipo: 'PRE', attesi: {}, slot: [{ mappe: { 0: art('GRASS_MEDIUM') } }] });
  assert.deepEqual(pre.esiti, []);
});

test('attesi: il centreboard del feed unico', () => {
  const voce = st('ALFA', 'N14', 'CENTREBOARD');
  const esiti = [];
  const a = attesiStatici(new Map([['CB|UNICO', voce]]), new Set(['UNICO']), (e) => esiti.push(e), 'Feed');
  assert.deepEqual(a.CB, voce);
  assert.deepEqual(esiti, []);
  assert.deepEqual(attesiStatici(new Map(), new Set(['UNICO']), (e) => esiti.push(e), 'Feed').CB, { valore: null, cella: '', etichetta: 'CB' });
});

// Tappeti del foglio unico: il foglio STATIC ASSETS dà il brand di ogni tappeto tempo per tempo (chiave MATS_<lato>@<tempo>)
const TAPPETI = new Map([['MATS_L1@MATCH1', st('ALFA', 'C3', 'CLUB MAT L1 · FIRST HALF')], ['MATS_L1@MATCH2', st('BETA', 'D3', 'CLUB MAT L1 · SECOND HALF')]]);

test('tappeti: il brand del loro tempo in ogni slot, mai nel lead-in; un altro brand è Error', () => {
  const primo = prova({ zone: ['LEFT LED', 'Mats_L1'], tipo: 'MATCH1', attesi: { MATS: TAPPETI },
    slot: [{ mappe: { 0: BLANK } }, { mappe: { 1: art('ALFA_MATS_L1') } }, { mappe: { 1: art('BETA_MATS_L1') } }] });
  assert.deepEqual(breve(primo.esiti), [
    { tipo: 'Error', id: 2, colonna: 'STATIC C3 · CLUB MAT L1 · FIRST HALF', zona: 'Mats_L1', atteso: 'ALFA', trovato: 'BETA_MATS_L1' }]);
  assert.deepEqual([...new Set(primo.animazioni.map((v) => [v.gruppo, v.atteso, v.zone[0].zona].join('|')))], ['Statics|ALFA|Mats_L1']);
  const secondo = prova({ zone: ['LEFT LED', 'Mats_L1'], tipo: 'MATCH2', attesi: { MATS: TAPPETI },
    slot: [{ mappe: {} }, { mappe: { 1: art('BETA_MATS_L1') } }, { mappe: { 1: art('ALFA_MATS_L1') } }] });
  assert.deepEqual(breve(secondo.esiti), [
    { tipo: 'Error', id: 2, colonna: 'STATIC D3 · CLUB MAT L1 · SECOND HALF', zona: 'Mats_L1', atteso: 'BETA', trovato: 'ALFA_MATS_L1' }]);
});

test('tappeti col nome staccato (Mats L1): stessa riga CLUB MAT L1', () => {
  const c = prova({ zone: ['LEFT LED', 'Mats L1'], tipo: 'MATCH1', attesi: { MATS: TAPPETI },
    slot: [{ mappe: {} }, { mappe: { 1: art('ALFA_MATS') } }, { mappe: { 1: art('BETA_MATS') } }] });
  assert.deepEqual(breve(c.esiti), [
    { tipo: 'Error', id: 2, colonna: 'STATIC C3 · CLUB MAT L1 · FIRST HALF', zona: 'Mats L1', atteso: 'ALFA', trovato: 'BETA_MATS' }]);
});

test('tappeto senza riga nel foglio STATIC ASSETS: un avviso per segmento, non si controlla; la riga L1 senza zona è Error', () => {
  const c = prova({ zone: ['Mats_R1'], tipo: 'MATCH1', attesi: { MATS: TAPPETI }, slot: [{ mappe: {} }, { mappe: { 0: art('OMEGA_MATS_R1') } }, { mappe: { 0: art('OMEGA_MATS_R1') } }] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Warning', id: '-', colonna: '-', zona: 'Mats_R1', atteso: 'CLUB MAT in the Excel', trovato: 'not checked' },
    { tipo: 'Error', id: '-', colonna: 'STATIC C3 · CLUB MAT L1 · FIRST HALF', zona: '-', atteso: 'ALFA', trovato: 'no mat zone' }]);
  assert.deepEqual(prova({ zone: ['Mats_R1'], tipo: 'MATCH1', slot: [{ mappe: {} }, { mappe: { 0: art('OMEGA_MATS_R1') } }] }).esiti.length, 1);
});

test('foglio unico: intervallo del tutto vuoto in partita (fine del tempo): tappeti e centreboard non si controllano', () => {
  const c = prova({ feedUnico: true, zone: ['LEFT LED', 'CENTREBOARD', 'Mats_L1'], tipo: 'MATCH1', attesi: { CB: st('OMEGA', 'N12', 'CENTREBOARD'), MATS: TAPPETI },
    slot: [{ mappe: { 0: BLANK, 1: BLANK } }, { mappe: { 0: art('ZETA_LED'), 1: art('OMEGA_CENTREBOARD'), 2: art('ALFA_MATS_L1') } }, { mappe: {} }] });
  assert.deepEqual(c.esiti, []);
  const buco = prova({ feedUnico: true, zone: ['LEFT LED', 'CENTREBOARD', 'Mats_L1'], tipo: 'MATCH1', attesi: { CB: st('OMEGA', 'N12', 'CENTREBOARD'), MATS: TAPPETI },
    slot: [{ mappe: {} }, { mappe: { 0: art('ZETA_LED') } }] });
  assert.deepEqual(breve(buco.esiti).map((e) => [e.zona, e.trovato]), [['CENTREBOARD', 'nothing'], ['Mats_L1', 'nothing']]);
});

test('attesi: i tappeti del feed unico, tempo per tempo', () => {
  const statici = new Map([['MATS_L1@MATCH1|UNICO', st('ALFA', 'C3', 'X')], ['MATS_L1@MATCH2|UNICO', st('BETA', 'D3', 'Y')], ['CB|UNICO', st('OMEGA', 'N12', 'CENTREBOARD')]]);
  const a = attesiStatici(statici, new Set(['UNICO']), () => {}, 'Feed');
  assert.deepEqual([...a.MATS], [['MATS_L1@MATCH1', st('ALFA', 'C3', 'X')], ['MATS_L1@MATCH2', st('BETA', 'D3', 'Y')]]);
  assert.deepEqual([...attesiStatici(new Map(), new Set(['EU']), () => {}, 'Feed').MATS], []);
});

// Tappeti di un lato confrontati per brand, non per numero: l'Excel e il pacchetto possono numerarli da capi opposti
const LATO = new Map([['MATS_L1@MATCH1', st('ALFA', 'C3', 'CLUB MAT L1 · FIRST HALF')], ['MATS_L2@MATCH1', st('BETA', 'C4', 'CLUB MAT L2 · FIRST HALF')]]);
const tappetiLato = (zone, arts) => prova({ zone, tipo: 'MATCH1', attesi: { MATS: LATO },
  slot: [{ mappe: {} }, { mappe: Object.fromEntries(arts.map((a, i) => [i, a]).filter(([, a]) => a)) }] });

test('tappeti per lato: numerati al contrario nel pacchetto, nessun esito; ognuno con la riga del suo brand', () => {
  const c = tappetiLato(['Mats_L1', 'Mats_L2'], [art('BETA_MATS_L1'), art('ALFA_MATS_L2')]);
  assert.deepEqual(c.esiti, []);
  assert.deepEqual(c.animazioni.map((v) => [v.zone[0].zona, v.atteso, v.colonna]), [
    ['Mats_L1', 'BETA', 'STATIC C4 · CLUB MAT L2 · FIRST HALF'], ['Mats_L2', 'ALFA', 'STATIC C3 · CLUB MAT L1 · FIRST HALF']]);
});

test('tappeti per lato: zone col nome dello sponsor (BETA_L1), stesso confronto per brand', () => {
  assert.deepEqual(tappetiLato(['BETA_L1', 'ALFA_L2'], [art('BETA_L1'), art('ALFA_L2')]).esiti, []);
});

test('tappeti per lato: due zone con lo stesso brand, la seconda è Error col brand che manca', () => {
  const c = tappetiLato(['Mats_L1', 'Mats_L2'], [art('ALFA_MATS_L1'), art('ALFA_MATS_L2')]);
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 1, colonna: 'STATIC C4 · CLUB MAT L2 · FIRST HALF', zona: 'Mats_L2', atteso: 'BETA', trovato: 'ALFA_MATS_L2' }]);
});

test('tappeti per lato: una zona vuota è Error col brand rimasto', () => {
  const c = tappetiLato(['Mats_L1', 'Mats_L2'], [null, art('ALFA_MATS_L2')]);
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 1, colonna: 'STATIC C4 · CLUB MAT L2 · FIRST HALF', zona: 'Mats_L1', atteso: 'BETA', trovato: 'nothing' }]);
});

test('tappeti per lato: una riga dell’Excel senza zona nel pacchetto è Error, una volta per segmento', () => {
  const c = prova({ zone: ['Mats_L1'], tipo: 'MATCH1', attesi: { MATS: LATO }, slot: [{ mappe: {} }, { mappe: { 0: art('ALFA_MATS_L1') } }, { mappe: { 0: art('ALFA_MATS_L1') } }] });
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: '-', colonna: 'STATIC C4 · CLUB MAT L2 · FIRST HALF', zona: '-', atteso: 'BETA', trovato: 'no mat zone' }]);
});

test('tappeti per lato: più zone che righe, la zona in più non si controlla (un avviso)', () => {
  const c = tappetiLato(['Mats_L1', 'Mats_L2', 'Mats_L3'], [art('ALFA_MATS_L1'), art('BETA_MATS_L2'), art('OMEGA_MATS_L3')]);
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Warning', id: '-', colonna: '-', zona: 'Mats_L3', atteso: 'CLUB MAT in the Excel', trovato: 'not checked' }]);
});

test('tappeti per lato: col nome dello sponsor, l’errore va sulla zona che mostra il brand sbagliato, non su quella giusta', () => {
  // ALFA_L1 mostra il file di BETA, che è già nella sua zona BETA_L2: sbagliata è ALFA_L1
  const c = tappetiLato(['ALFA_L1', 'BETA_L2'], [art('BETA_L2'), art('BETA_L2')]);
  assert.deepEqual(breve(c.esiti), [{ tipo: 'Error', id: 1, colonna: 'STATIC C3 · CLUB MAT L1 · FIRST HALF', zona: 'ALFA_L1', atteso: 'ALFA', trovato: 'BETA_L2' }]);
});
