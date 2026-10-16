// Client dello script Google (app/servizio.js): corpo in text/plain con il codice, mai eccezioni.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chiama } = require('../app/servizio.js');

const SERVIZIO = { url: 'https://script.esempio.test/exec', codice: 'segreto' };

test('POST text/plain con codice, azione e dati', async () => {
  let visto = null;
  const finto = async (url, opzioni) => { visto = { url, opzioni }; return { ok: true, json: async () => ({ ok: true, indirizzi: ['a@esempio.it'] }) }; };
  const r = await chiama(SERVIZIO, 'destinatari', {}, finto);
  assert.deepEqual(r, { ok: true, indirizzi: ['a@esempio.it'] });
  assert.equal(visto.url, SERVIZIO.url);
  assert.equal(visto.opzioni.method, 'POST');
  assert.equal(visto.opzioni.headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.deepEqual(JSON.parse(visto.opzioni.body), { codice: 'segreto', azione: 'destinatari', dati: {} });
});

test('rete giù: nessuna eccezione, ok false', async () => {
  const r = await chiama(SERVIZIO, 'destinatari', {}, async () => { throw new TypeError('Failed to fetch'); });
  assert.deepEqual(r, { ok: false, errore: 'unreachable' });
});

test('risposta non JSON o errore HTTP: ok false', async () => {
  assert.deepEqual(await chiama(SERVIZIO, 'x', {}, async () => ({ ok: false, status: 500, json: async () => ({}) })), { ok: false, errore: 'unreachable' });
  assert.deepEqual(await chiama(SERVIZIO, 'x', {}, async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } })), { ok: false, errore: 'unreachable' });
});

test('servizio non configurato', async () => {
  assert.deepEqual(await chiama({ url: '', codice: '' }, 'destinatari', {}, async () => { throw new Error('non deve chiamare'); }), { ok: false, errore: 'not configured' });
});

test('timeout', async () => {
  const lento = (url, o) => new Promise((ok, ko) => { o.signal.addEventListener('abort', () => ko(new Error('aborted'))); });
  assert.deepEqual(await chiama(SERVIZIO, 'x', {}, lento, 50), { ok: false, errore: 'unreachable' });
});
