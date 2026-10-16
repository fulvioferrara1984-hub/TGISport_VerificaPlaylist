// Cifratura (app/cifratura.js) e caricamento delle regole cifrate (app/regole.js), con una password di prova.
const test = require('node:test');
const assert = require('node:assert/strict');
const cifratura = require('../app/cifratura.js');
const regole = require('../app/regole.js');

const PASSWORD = 'prova-' + Math.random().toString(36).slice(2);
const ITER = 1000; // poche iterazioni: il test deve essere veloce

test('protezione nuova: chiave giusta valida, chiave sbagliata no', async () => {
  const { protezione, chiave } = await cifratura.nuovaProtezione(PASSWORD, ITER);
  assert.equal(protezione.v, 1);
  assert.equal(protezione.iterazioni, ITER);
  assert.equal(await cifratura.chiaveValida(chiave, protezione), true);
  const sbagliata = await cifratura.derivaChiave(PASSWORD + 'x', protezione.sale, protezione.iterazioni);
  assert.equal(await cifratura.chiaveValida(sbagliata, protezione), false);
});

test('di default 600000 iterazioni, come Mockup Studio', () => {
  assert.equal(cifratura.ITERAZIONI, 600000);
});

test('regole cifrate: si leggono solo con la chiave giusta', async () => {
  const dati = { alias: { ALFAES: ['ALFAESP'] }, zoneSponsor: { prefisso: 'SPZ_', etichetta: 'SPZ zones', DOM: 'A', FE: null, altri: 'B' }, servizio: { url: 'https://esempio.test/x', codice: 'c' } };
  const { protezione, chiave } = await cifratura.nuovaProtezione(PASSWORD, ITER);
  globalThis.PC_REGOLE = { protezione, dati: await cifratura.cifraTesto(chiave, JSON.stringify(dati)) };
  assert.deepEqual(regole.protezione(), protezione);
  assert.deepEqual(await regole.carica(chiave), dati);
  const sbagliata = await cifratura.derivaChiave('altra', protezione.sale, ITER);
  await assert.rejects(regole.carica(sbagliata));
  delete globalThis.PC_REGOLE;
  assert.equal(regole.protezione(), null);
});
