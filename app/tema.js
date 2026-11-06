/* Playlist Check — tema chiaro / scuro, come la Piattaforma TGI Sport: scuro predefinito, scelta salvata solo in questo browser.
   Si carica nel <head>, prima del CSS: applica il tema salvato prima che la pagina si disegni. */
(function (radice, fabbrica) {
  const m = fabbrica();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else {
    (radice.PC = radice.PC || {})[m.NOME] = m;
    document.documentElement.dataset.tema = m.leggiTema(m.archivioTema());
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const CHIAVE = 'tgi-tema'; // la stessa chiave della Piattaforma

  // un valore salvato sconosciuto o assente vale scuro
  const temaDa = (salvato) => (salvato === 'chiaro' ? 'chiaro' : 'scuro');
  const altroTema = (t) => (t === 'scuro' ? 'chiaro' : 'scuro');

  // ogni accesso all'archivio sta in try/catch: senza archivio (finestra privata bloccata) il tema vale solo per la visita
  function archivioTema() {
    try { return window.localStorage; } catch (e) { return null; }
  }
  function leggiTema(archivio) {
    try { return temaDa(archivio ? archivio.getItem(CHIAVE) : null); } catch (e) { return 'scuro'; }
  }
  function salvaTema(archivio, t) {
    try { if (archivio) archivio.setItem(CHIAVE, t); } catch (e) { /* archivio bloccato: il tema resta per questa visita */ }
  }

  // passa all'altro tema: lo applica alla radice (<html>), lo salva e lo restituisce
  function cambiaTema(radice, archivio) {
    const nuovo = altroTema(temaDa(radice.dataset.tema));
    radice.dataset.tema = nuovo;
    salvaTema(archivio, nuovo);
    return nuovo;
  }

  return { NOME: 'tema', CHIAVE, temaDa, altroTema, archivioTema, leggiTema, salvaTema, cambiaTema };
});
