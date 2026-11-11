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

// Zona 0 JUMBO, 1 CC, 2 GL_SX_1: l'Excel chiede lo stesso brand su Jumbo e GL, quindi per il nome è tutto a posto.
function modelloFormati(slotJumbo, slotGL) {
  const { excel, air } = modello({ righe: slotJumbo.map(() => 'ALFA'), slot: slotJumbo });
  air.zone = new Map([[0, 'JUMBO'], [1, 'CC'], [2, 'GL_SX_1']]);
  air.stream[0].segmenti[1].intervalli.forEach((iv, i) => iv.mappe.set(2, i ? slotGL[i - 1] : BLANK));
  air.formatiMedia = new Map([
    ['1_alfa_gl1.mp4', { larghezza: 3100, altezza: 90 }], ['2_alfa_jumbo.mp4', { larghezza: 5130, altezza: 180 }],
    ['1503_blank_generic.png', { larghezza: 2, altezza: 2 }], ['1356_circle_empty.png', { larghezza: 4, altezza: 4 }],
  ]);
  return { excel, air };
}
const G1 = art('ALFA_GL1', 'CASA_ALFA_1_J', '../advertisements/1_alfa_gl1.mp4');
const J = art('ALFA_JUMBO', 'CASA_ALFA_1_J', '../advertisements/2_alfa_jumbo.mp4');
const diFormato = (r) => breve(r.esiti.filter((e) => String(e.atteso).startsWith('artwork sized')));

test('artwork della GL sulla Jumbo: errore anche se il brand è giusto', () => {
  const { excel, air } = modelloFormati([J, J, G1], [G1, G1, G1]);
  assert.deepEqual(diFormato(verifica(excel, air, REGOLE)), [
    { tipo: 'Error', id: 3, colonna: '-', zona: 'JUMBO', atteso: 'artwork sized for JUMBO (5130×180)', trovato: 'ALFA_GL1 · 3100×90' },
  ]);
});

test('artwork della Jumbo sulla GL: errore anche se il brand è giusto', () => {
  const { excel, air } = modelloFormati([J, J, J], [G1, J, G1]);
  assert.deepEqual(diFormato(verifica(excel, air, REGOLE)), [
    { tipo: 'Error', id: 2, colonna: '-', zona: 'GL_SX_1', atteso: 'artwork sized for GL_SX_1 (3100×90)', trovato: 'ALFA_JUMBO · 5130×180' },
  ]);
});

test('ogni artwork nella sua zona: nessun errore di formato, blank e centro campo compresi', () => {
  const { excel, air } = modelloFormati([J, J, J], [G1, G1, G1]);
  assert.deepEqual(diFormato(verifica(excel, air, REGOLE)), []);
});

test('formato che non si legge, o pacchetto senza formati: nessun errore di formato', () => {
  const { excel, air } = modelloFormati([J, J, G1], [G1, G1, G1]);
  air.formatiMedia.delete('1_alfa_gl1.mp4');
  assert.deepEqual(diFormato(verifica(excel, air, REGOLE)), []);
  delete air.formatiMedia;
  assert.deepEqual(diFormato(verifica(excel, air, REGOLE)), []);
});

test('riepilogo dell’Hub: sistema, feed e segmenti (mostrati come quelli del Vault)', () => {
  const { excel, air } = modello({ righe: ['ALFA'], slot: [A('ALFA')] });
  const r = verifica(excel, air, REGOLE).riepilogo;
  assert.deepEqual([r.sistema, r.feed, r.segmenti], ['Hub', ['Europa'], ['Pre Match - Post Match', '1st Half - 2nd Half', 'Highlights']]);
});

test('verifica: animazioni nel risultato, esiti invariati', () => {
  const { excel, air } = modello({ righe: ['ALFA'], slot: [A('ALFA')] });
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual(r.animazioni.map((v) => [v.feed, v.gruppo, v.atteso, v.zone[0].zona]), [['Europa', 'First row', 'ALFA', 'FULL PERIMETER']]);
});

// Playlist a foglio unico: pacchetto con un feed che non è una regione, Pre Game e due tempi, niente highlights né statici
function modelloUnico({ righe1 = ['ALFA', 'BETA'], righe2 = ['ALFA', 'BETA'], slot1 = righe1, slot2 = righe2, nota = 'OMEGA', segmenti, avvisi = [] } = {}) {
  const tab = (righe, id, durata) => ({ ...tabella({ colonne: { 'UNICO|1': id === 'A' ? 4 : 11 }, righe: righe.map((v) => ({ durataMs: 30000, durataTesto: '00:00:30', valori: { 'UNICO|1': v } })) }), colonnaId: id, colonnaDurata: durata, cicloRecovery: 2 });
  const excel = { titolo: 'ALFA vs BETA', feedUnico: 'UNICO', partite: { MATCH1: tab(righe1, 'A', 'C'), MATCH2: tab(righe2, 'H', 'J') }, hl: null, avvisi,
    statici: new Map(nota ? [['CB|UNICO', { valore: nota, cella: 'N14', etichetta: 'CENTREBOARD' }]] : []) };
  const fondo = { 2: art('GRASS_MEDIUM', 'TEXTURE_GRASS') };
  const pieno = (n) => ({ durata: 30000, mappe: { 0: art(`${n}_LED`), 1: art('OMEGA_CENTREBOARD'), ...fondo } });
  const iv = (lista) => [{ durata: 30000, mappe: { 0: BLANK, 1: BLANK } }].concat(lista.map(pieno));
  const zone = ['LEFT LED', 'CENTREBOARD', 'GRASS_LSX_MEDIUM'];
  const air = { evento: { nome: 'Alfa vs Beta', data: '2026-11-14', venue: 'Stadio Prova' }, zone: new Map(zone.map((z, i) => [i, z])),
    stream: [{ nome: 'Feed Alfa', regioni: new Set(), segmenti: segmenti ? segmenti(iv) : [segmento('Pre Game', [{ durata: 30000, mappe: { 0: BLANK, 1: BLANK } }]), segmento('First Half', iv(slot1)), segmento('Second Half', iv(slot2))] }] };
  return { excel, air };
}

test('foglio unico: tutto giusto, nessun esito, celle davvero controllate', () => {
  const { excel, air } = modelloUnico();
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual(r.esiti, []);
  assert.ok(r.celle > 0);
  assert.deepEqual([r.riepilogo.casa, r.riepilogo.ospite, r.riepilogo.partiteDiverse], ['ALFA', 'BETA', false]);
});

test('foglio unico: un brand sbagliato nel secondo tempo esce col feed del pacchetto', () => {
  const { excel, air } = modelloUnico({ slot2: ['ALFA', 'SIGMA'] });
  assert.deepEqual(verifica(excel, air, REGOLE).esiti.map((e) => [e.tipo, e.feed, e.segmento, e.id, e.colonna, e.zona, e.atteso, e.trovato]),
    [['Error', 'Feed Alfa', 'Second Half', 2, 'L · VIRTUAL FEED – First row', 'LEFT LED', 'BETA', 'SIGMA_LED']]);
});

test('foglio unico: un centreboard diverso dalla nota è Error (o Possible alias se il nome non compare altrove); senza nota non si controlla', () => {
  const scambio = modelloUnico({ nota: 'ALFA' });
  const esiti = verifica(scambio.excel, scambio.air, REGOLE).esiti;
  assert.equal(esiti.length, 4);
  assert.ok(esiti.every((e) => e.tipo === 'Error' && e.zona === 'CENTREBOARD' && e.colonna === 'STATIC N14 · CENTREBOARD' && e.atteso === 'ALFA' && e.trovato === 'OMEGA_CENTREBOARD'));
  const a = modelloUnico({ nota: 'ZETA' });
  assert.ok(verifica(a.excel, a.air, REGOLE).esiti.every((e) => e.tipo === 'Possible alias' && e.atteso === 'ZETA'));
  const b = modelloUnico({ nota: null });
  assert.deepEqual(verifica(b.excel, b.air, REGOLE).esiti, []);
});

test('foglio unico: gli highlights nel pacchetto non hanno una riga da confrontare; ID non numerico citato con la colonna del tempo', () => {
  const { excel, air } = modelloUnico({ avvisi: [{ foglio: 'Foglio', riga: 14, id: '1a', colonnaId: 'H' }],
    segmenti: (iv) => [segmento('Pre Game', [{ durata: 30000, mappe: { 0: BLANK, 1: BLANK } }]), segmento('First Half', iv(['ALFA', 'BETA'])), segmento('Second Half', iv(['ALFA', 'BETA'])), segmento('Highlights', iv(['ALFA']))] });
  assert.deepEqual(verifica(excel, air, REGOLE).esiti.map((e) => [e.tipo, e.segmento, e.colonna, e.atteso, e.trovato]), [
    ['Warning', '-', 'Foglio · H14', 'numeric ID', '1a'],
    ['Warning', 'Highlights', '-', 'Highlights in the Excel', 'not checked']]);
});

test('foglio unico: manca un tempo nel pacchetto: errore; gli highlights assenti no', () => {
  const { excel, air } = modelloUnico({ segmenti: (iv) => [segmento('Pre Game', [{ durata: 30000, mappe: { 0: BLANK, 1: BLANK } }]), segmento('First Half', iv(['ALFA', 'BETA']))] });
  assert.deepEqual(verifica(excel, air, REGOLE).esiti.map((e) => [e.tipo, e.segmento, e.atteso, e.trovato]), [['Error', '2nd Half', 'AIR sequence', 'missing']]);
});

// Foglio unico con il foglio STATIC ASSETS: due LED e due tappeti con un brand per tempo; recupero in fondo e un intervallo vuoto a fine tempo
function modelloTappeti({ tappeto1 = 'KAPPA', tappeto2 = 'SIGMA', mat1 = tappeto1, mat2 = tappeto2, multi = 'ZETA_MULTIBRAND_LED' } = {}) {
  const righe = ['ALFA', 'BETA', 'ZETA PARTNERRING', 'ZETA PARTNERRING'];
  const tab = (id, durata) => ({ ...tabella({ colonne: { 'UNICO|1': id === 'A' ? 4 : 11 }, righe: righe.map((v) => ({ durataMs: 30000, durataTesto: '00:00:30', valori: { 'UNICO|1': v } })) }), colonnaId: id, colonnaDurata: durata, cicloRecovery: 2, soloPrimaFila: true });
  const voce = (valore, cella, etichetta) => ({ valore, cella, etichetta });
  const excel = { titolo: 'ALFA vs BETA', feedUnico: 'UNICO', partite: { MATCH1: tab('A', 'C'), MATCH2: tab('H', 'J') }, hl: null, avvisi: [],
    statici: new Map([['MATS_L1@MATCH1|UNICO', voce(tappeto1, 'C3', 'CLUB MAT L1 · FIRST HALF')], ['MATS_L1@MATCH2|UNICO', voce(tappeto2, 'D3', 'CLUB MAT L1 · SECOND HALF')]]) };
  const led = (n) => (n.includes('PARTNERRING') ? multi : `${n}_LED`);
  const pieno = (n, mat) => ({ durata: 30000, mappe: { 0: art(`${led(n)}_LEFT`), 1: art(`${led(n)}_RIGHT`), 2: art(`${mat}_MATS_L1`) } });
  const tempo = (mat) => [{ durata: 30000, mappe: { 0: BLANK, 1: BLANK } }].concat(righe.concat(['ZETA PARTNERRING', 'ZETA PARTNERRING']).map((n) => pieno(n, mat)), [{ durata: 30000, mappe: {} }]);
  const air = { evento: { nome: 'Alfa vs Beta', data: '2026-11-16', venue: 'Stadio Prova' }, zone: new Map(['Left LED', 'Right LED', 'Mats_L1'].map((z, i) => [i, z])),
    stream: [{ nome: 'Feed Alfa', regioni: new Set(), segmenti: [segmento('Pre Game', [{ durata: 30000, mappe: { 0: BLANK, 1: BLANK } }]), segmento('First Half', tempo(mat1)), segmento('Second Half', tempo(mat2))] }] };
  return { excel, air };
}

test('foglio unico con STATIC ASSETS: tappeti giusti in ogni tempo, nessun errore; il partner ring è un alias da confermare anche nel recupero', () => {
  const { excel, air } = modelloTappeti();
  const r = verifica(excel, air, REGOLE);
  assert.deepEqual([...new Set(r.esiti.map((e) => [e.tipo, e.atteso, e.trovato].join('|')))].sort(), [
    'Possible alias|ZETA PARTNERRING|ZETA_MULTIBRAND_LED_LEFT', 'Possible alias|ZETA PARTNERRING|ZETA_MULTIBRAND_LED_RIGHT']);
  assert.ok(r.esiti.every((e) => e.zona !== 'Mats_L1'));
});

test('foglio unico con STATIC ASSETS: un tappeto sbagliato esce nel suo tempo, con la cella del foglio', () => {
  const { excel, air } = modelloTappeti({ mat2: 'KAPPA' });
  const sbagliati = verifica(excel, air, REGOLE).esiti.filter((e) => e.zona === 'Mats_L1');
  assert.deepEqual([...new Set(sbagliati.map((e) => [e.tipo, e.segmento, e.colonna, e.atteso, e.trovato].join('|')))], ['Error|Second Half|STATIC D3 · CLUB MAT L1 · SECOND HALF|SIGMA|KAPPA_MATS_L1']);
  assert.equal(sbagliati.length, 6);
});
