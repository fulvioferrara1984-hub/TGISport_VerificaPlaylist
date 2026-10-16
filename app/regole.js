/* Playlist Check — regole del controllo (alias, zone a regola fissa, indirizzo dello script), cifrate in regole/regole.js. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  const dip = (nome) => (typeof module === 'object' && module.exports ? require('./' + nome + '.js') : radice.PC[nome]);
  const cifratura = dip('cifratura');

  // regole/regole.js imposta PC_REGOLE = { protezione, dati }; null se il file manca.
  function protezione() {
    return radice.PC_REGOLE ? radice.PC_REGOLE.protezione : null;
  }

  async function carica(chiave) {
    return JSON.parse(await cifratura.decifraTesto(chiave, radice.PC_REGOLE.dati));
  }

  return { NOME: 'regole', protezione, carica };
});
