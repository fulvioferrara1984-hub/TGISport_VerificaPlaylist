// Confronto dei nomi dei brand (app/nomi.js), con nomi di fantasia.
const test = require('node:test');
const assert = require('node:assert/strict');
const { k, vuoto, senzaCodici, chiaveBrand, distanza, confronta } = require('../app/nomi.js');

const ctx = { alias: { ALFAES: ['ALFAESP', 'ALFASPA'], GAMMA: ['GM'] }, casa: new Set(['CASA']) };
const art = (ad, advertiser = null, file = '1_x.mp4') => ({ ad, advertiser, file });

test('k e codici di modalità', () => {
  assert.equal(k('Gamma Kola_J'), 'GAMMAKOLAJ');
  assert.equal(k(senzaCodici('GAMMA KOLA_J')), 'GAMMAKOLA');
  assert.equal(k(senzaCodici('SIGMA OVERLAY (D)')), 'SIGMAOVERLAY');
  assert.equal(vuoto('Transparent'), null);
  assert.equal(vuoto('  '), null);
  assert.equal(vuoto('ALFA'), 'ALFA');
});

test('chiaveBrand toglie le posizioni in coda', () => {
  assert.equal(chiaveBrand('ALFA_TL2_B-C').chiave, 'ALFA');
  assert.equal(chiaveBrand('ALFA_SOLO_GL_1').chiave, 'ALFA');
  assert.equal(chiaveBrand('MAGLIA_GL1_10_SEC').chiave, 'MAGLIA');
  assert.equal(chiaveBrand('BETA_RSX').chiave, 'BETA');
  assert.deepEqual(chiaveBrand('ZETA_999XYZ_GL1').parole, ['ZETA', '999XYZ']);
});

test('distanza OSA conta lo scambio di due lettere come 1', () => {
  assert.equal(distanza('BXTPORT', 'XBTPORT'), 1);
  assert.equal(distanza('BELTA', 'MELTA'), 1);
  assert.equal(distanza('', 'ABC'), 3);
});

test('livelli di confronto', () => {
  assert.equal(confronta('ALFA', art('ALFA_GC1'), ctx), 'ok');
  assert.equal(confronta('ALFA ES', art('ALFA_SPA_GL2'), ctx), 'ok');
  assert.equal(confronta('ALFA OVERLAY (J)', art('ALFA_GL1'), ctx), 'variante');
  assert.equal(confronta('DELTAPLUS', art('DELTPLUS_GC1', null, '../advertisements/9_x_deltaplus_1.mp4'), ctx), 'variante');
  assert.equal(confronta('Delta News', art('DELTX_LSX', 'CASA_DELTA_LSX'), ctx), 'variante');
  assert.equal(confronta('belta', art('MELTA_GL2'), ctx), 'refuso');
  assert.equal(confronta('ALFA ES', art('ALFX_SPA_GL2'), ctx), 'refuso');
  assert.equal(confronta('ALFA', art('OMEGA_GC1'), ctx), 'errore');
  assert.equal(confronta(null, art('ALFA_GC1'), ctx), 'errore');
  assert.equal(confronta('ALFA', null, ctx), 'errore');
  assert.equal(confronta(null, null, ctx), 'ok');
});

test('varianti solo a confini di parola: un nome corto dentro un altro brand non basta', () => {
  assert.equal(confronta('MELTAX', art('TAX_GL1'), ctx), 'errore'); // parola AIR dentro una parola Excel
  assert.equal(confronta('TAX', art('MELTAX_GL1'), ctx), 'errore'); // nome Excel dentro una parola AIR
  assert.equal(confronta('LTAX', art('ZZ_GL1', null, '../advertisements/9_meltax_1.mp4'), ctx), 'errore'); // dentro il nome del file
  assert.equal(confronta('MELTAX', art('ZZ_LSX', 'CASA_TAX_LSX'), ctx), 'errore'); // advertiser senza il prefisso di casa
  assert.equal(confronta('OMEGAMMA', art('GM_GL1'), ctx), 'errore'); // alias ufficiale dentro un'altra parola
  // restano varianti: parole intere, o parole AIR che insieme compongono una parola Excel
  assert.equal(confronta('ALFA BETA', art('ALFA_GL1'), ctx), 'variante');
  assert.equal(confronta('ALFA', art('ALFA_BETA_GL1'), ctx), 'variante');
  assert.equal(confronta('ALFABETA', art('ALFA_BETA_PROMO_GL1'), ctx), 'variante');
  assert.equal(confronta('ALFABETA', art('BETA_ALFA_GL1'), ctx), 'variante');
  assert.equal(confronta('GAMMA NEWS', art('GM_GL1'), ctx), 'ok');
});

test('abbreviazioni: l’inizio di una parola vale se è abbastanza lungo', () => {
  assert.equal(confronta('ALFABETICO', art('ALFABET_GL1'), ctx), 'variante'); // 7 lettere su 10
  assert.equal(confronta('ALFABET', art('ALFABETICO_GL1'), ctx), 'variante');
  assert.equal(confronta('#ALFABETICO', art('ALFABET_USX'), ctx), 'variante');
  assert.equal(confronta('MELTAX', art('MEL_GL1'), ctx), 'errore'); // 3 lettere: troppo poco
  assert.equal(confronta('BETASSON', art('BETA_GL1'), ctx), 'errore'); // 4 su 8: meno del 60%
});

test('confini: una parola intera basta anche se le stesse lettere compaiono dentro un’altra; cifre e lettere si separano', () => {
  assert.equal(confronta('JALFA J', art('J_TL'), ctx), 'variante'); // J è una parola dell'Excel, anche se c'è una J dentro JALFA
  assert.equal(confronta('ZETA 150_J', art('ZETA-150XYZ_GL2'), ctx), 'variante'); // 150 e XYZ sono parole diverse
  assert.equal(confronta('B_', art('BETAX_CHINA_GC1'), ctx), 'errore'); // una lettera sola non è un brand
});
