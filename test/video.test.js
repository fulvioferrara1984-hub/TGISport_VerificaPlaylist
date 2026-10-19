// Durata e fotogrammi al secondo dei video (app/video.js): mp4/mov normali (Hub) e frammentati (Vault).
const test = require('node:test');
const assert = require('node:assert/strict');
const { mp4, mp4Frammentato } = require('./fixture-air.js');
const { infoVideo } = require('../app/video.js');

test('video normale: durata dal box mvhd (anche versione 1 o in fondo al file)', () => {
  assert.equal(infoVideo(mp4(15)).secondi, 15);
  assert.equal(infoVideo(mp4(10, { versione: 1 })).secondi, 10);
  assert.equal(infoVideo(mp4(30, { moovInFondo: true })).secondi, 30);
});

test('video frammentato: durata e fotogrammi al secondo dai frammenti', () => {
  assert.deepEqual(infoVideo(mp4Frammentato(1000, 50)), { secondi: 20, fps: 50, fotogrammi: 1000 });
  const v = infoVideo(mp4Frammentato(1000, 60));
  assert.equal(v.fps, 60);
  assert.equal(Number(v.secondi.toFixed(2)), 16.67);
});

test('file che non è un video: null', () => {
  assert.equal(infoVideo(new Uint8Array([1, 2, 3])), null);
  assert.equal(infoVideo(new Uint8Array(64)), null);
});
