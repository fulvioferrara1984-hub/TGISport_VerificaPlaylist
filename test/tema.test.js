// Tema chiaro / scuro (app/tema.js): scuro predefinito, scelta salvata nel browser con la chiave della Piattaforma.
const test = require('node:test');
const assert = require('node:assert/strict');
const { CHIAVE, temaDa, altroTema, leggiTema, salvaTema, cambiaTema } = require('../app/tema.js');

const archivio = (iniziale = {}) => {
  const dati = { ...iniziale };
  return { dati, getItem: (k) => (k in dati ? dati[k] : null), setItem: (k, v) => { dati[k] = String(v); } };
};
const rotto = { getItem() { throw new Error('bloccato'); }, setItem() { throw new Error('bloccato'); } };

test('temaDa: solo "chiaro" dà il chiaro, tutto il resto lo scuro', () => {
  assert.equal(CHIAVE, 'tgi-tema');
  assert.equal(temaDa('chiaro'), 'chiaro');
  for (const v of ['scuro', null, undefined, '', 'light', 'CHIARO']) assert.equal(temaDa(v), 'scuro');
  assert.equal(altroTema('scuro'), 'chiaro');
  assert.equal(altroTema('chiaro'), 'scuro');
});

test('leggiTema e salvaTema: archivio assente o bloccato non rompe nulla', () => {
  assert.equal(leggiTema(archivio({ 'tgi-tema': 'chiaro' })), 'chiaro');
  assert.equal(leggiTema(archivio()), 'scuro');
  assert.equal(leggiTema(null), 'scuro');
  assert.equal(leggiTema(rotto), 'scuro');
  const a = archivio();
  salvaTema(a, 'chiaro');
  assert.equal(a.dati['tgi-tema'], 'chiaro');
  assert.doesNotThrow(() => salvaTema(rotto, 'chiaro'));
  assert.doesNotThrow(() => salvaTema(null, 'chiaro'));
});

test('cambiaTema: passa all\'altro tema, lo applica alla radice e lo salva', () => {
  const radice = { dataset: { tema: 'scuro' } };
  const a = archivio();
  assert.equal(cambiaTema(radice, a), 'chiaro');
  assert.equal(radice.dataset.tema, 'chiaro');
  assert.equal(a.dati['tgi-tema'], 'chiaro');
  assert.equal(cambiaTema(radice, rotto), 'scuro');
  assert.equal(radice.dataset.tema, 'scuro');
  // radice senza tema: vale lo scuro, quindi si passa al chiaro
  assert.equal(cambiaTema({ dataset: {} }, null), 'chiaro');
});
