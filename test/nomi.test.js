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
