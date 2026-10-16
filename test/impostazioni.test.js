// Settings (app/impostazioni.js): elenco degli indirizzi email.
const test = require('node:test');
const assert = require('node:assert/strict');
const { validaIndirizzi } = require('../app/impostazioni.js');

test('uno per riga o separati da virgola/punto e virgola, senza doppioni', () => {
  assert.deepEqual(validaIndirizzi(' a@esempio.it\nb@esempio.it, a@esempio.it ; c@esempio.it\n\n'), { indirizzi: ['a@esempio.it', 'b@esempio.it', 'c@esempio.it'], errati: [] });
});

test('indirizzi non validi', () => {
  assert.deepEqual(validaIndirizzi('a@esempio.it\nnon-valido\nx@y'), { indirizzi: ['a@esempio.it', 'non-valido', 'x@y'], errati: ['non-valido', 'x@y'] });
});
