/* Playlist Check — cifratura con la password del team (AES-GCM 256, chiave PBKDF2-SHA256), come Mockup Studio. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  const ITERAZIONI = 600000;
  const CONTROLLO = 'playlist-check';
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const subtle = () => radice.crypto.subtle;

  function aBase64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  function daBase64(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function casuali(n) {
    const b = new Uint8Array(n);
    radice.crypto.getRandomValues(b);
    return b;
  }

  function disponibile() {
    return !!(radice.crypto && radice.crypto.subtle);
  }

  async function derivaChiave(password, sale, iterazioni) {
    const base = await subtle().importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: daBase64(sale), iterations: iterazioni || ITERAZIONI },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  async function cifraTesto(chiave, testo) {
    const iv = casuali(12);
    const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, chiave, enc.encode(testo)));
    return { iv: aBase64(iv), ct: aBase64(ct) };
  }

  async function decifraTesto(chiave, pacchetto) {
    return dec.decode(await subtle().decrypt({ name: 'AES-GCM', iv: daBase64(pacchetto.iv) }, chiave, daBase64(pacchetto.ct)));
  }

  // Nuova password: sale casuale + controllo cifrato (serve a riconoscere la password giusta).
  async function nuovaProtezione(password, iterazioni = ITERAZIONI) {
    const sale = aBase64(casuali(16));
    const chiave = await derivaChiave(password, sale, iterazioni);
    return { protezione: { v: 1, iterazioni, sale, controllo: await cifraTesto(chiave, CONTROLLO) }, chiave };
  }

  async function chiaveValida(chiave, protezione) {
    try {
      return (await decifraTesto(chiave, protezione.controllo)) === CONTROLLO;
    } catch (e) {
      return false;
    }
  }

  return { NOME: 'cifratura', ITERAZIONI, disponibile, derivaChiave, cifraTesto, decifraTesto, nuovaProtezione, chiaveValida };
});
