// Alias approvati in Settings (app/alias.js): proposte dai controlli e unione con gli alias cifrati.
const test = require('node:test');
const assert = require('node:assert/strict');
const { proposte, unisci, regoleCon, imposta } = require('../app/alias.js');
const { confronta } = require('../app/nomi.js');

const coppia = (tipo, atteso, trovato) => ({ chiave: `${tipo}|${atteso.replace(/[^A-Z0-9]/g, '')}|${trovato}`, tipo, atteso, trovato });

test('proposte: solo le coppie confermate, una per nome Excel e brand AIR', () => {
  const ultimo = {
    coppie: [coppia('Possible alias', 'ZORRO TV', 'ZTV'), coppia('Possible typo', 'BELTA', 'MELTA'), coppia('Possible alias', 'OMEGA', 'OMG')],
    risposte: new Map([['Possible alias|ZORROTV|ZTV', 'confirm'], ['Possible typo|BELTA|MELTA', 'reject']]),
  };
  assert.deepEqual(proposte(ultimo), [{ chiave: 'ZORROTV|ZTV', excel: 'ZORRO TV', air: 'ZTV', tipo: 'Possible alias' }]);
});

test('unisci: gli alias ufficiali del foglio si aggiungono a quelli cifrati, i proposti no', () => {
  const base = { ALFAES: ['ALFAESP'] };
  const righe = [{ chiave: 'ZORROTV|ZTV', stato: 'official' }, { chiave: 'ALFAES|ALFASPA', stato: 'official' }, { chiave: 'BELTA|MELTA', stato: 'proposed' }];
  assert.deepEqual(unisci(base, righe), { ALFAES: ['ALFAESP', 'ALFASPA'], ZORROTV: ['ZTV'] });
  assert.deepEqual(base, { ALFAES: ['ALFAESP'] }); // le regole cifrate non si toccano
});

test('regoleCon: un alias approvato vale nel confronto successivo', () => {
  const regole = { alias: {}, zoneSponsor: { prefisso: 'SPZ_' } };
  const art = { ad: 'ZTV_GC1', advertiser: null, file: '1_x.mp4' };
  assert.equal(confronta('ZORRO TV', art, { alias: regoleCon(regole).alias, casa: new Set() }), 'errore');
  imposta([{ chiave: 'ZORROTV|ZTV', stato: 'official' }]);
  const r = regoleCon(regole);
  assert.equal(confronta('ZORRO TV', art, { alias: r.alias, casa: new Set() }), 'ok');
  assert.equal(r.zoneSponsor.prefisso, 'SPZ_');
  imposta([]);
});
