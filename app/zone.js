/* Playlist Check — ruolo delle zone dell'AIR package e fila (prima/seconda) degli artwork. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const MAT_ZONA = { CLUB_LSX: 'MAT1', CLUB_USX: 'MAT2', CLUB_UDX: 'MAT3', CLUB_LDX: 'MAT4' };

  // angoliStatici: l'Excel ha la riga LOWER CORNER, quindi LC_SX_1 / LC_DX_1 sono statiche (alcuni stadi).
  // prefissoSponsor: prefisso delle zone a regola fissa (dalle regole cifrate), es. "XYZ_" → XYZ_LSX, XYZ_USX…
  function ruoloZona(nome, angoliStatici, prefissoSponsor) {
    const u = String(nome).toUpperCase();
    if (u === 'CC') return 'CC';
    if (u === 'RSX' || u === 'RDX') return 'ADD';
    if (angoliStatici && /^LC_(SX|DX)_1$/.test(u)) return 'LC';
    if (prefissoSponsor && u.startsWith(String(prefissoSponsor).toUpperCase())) return 'SPONSOR';
    if (u.startsWith('CLUB_')) return 'CLUB';
    if (u.startsWith('ADD_')) return 'ADD';
    if (/(^|_)2($|_)/.test(u) && !u.includes('FULL')) return 'LED2';
    return 'LED1';
  }

  const SECONDA = /(^|_)2($|_)|2FILA|GL2|TL2/;
  const PRIMA = /(^|_)(1|J)($|_)|1FILA|_1FI|GC1|GL1|TL1|GC_1/;

  // Fila dell'artwork dal suffisso (_2 seconda; _1 o _J prima) cercato nel nome advertiser, poi dell'ad, poi del file;
  // se non c'è, decide la zona. Con un Excel a una sola fila tutto è prima fila.
  function filaArtwork(art, nomeZona, soloPrimaFila) {
    if (soloPrimaFila) return 1;
    const file = String(art.file || '').split('/').pop().replace(/\.[^.]*$/, '').replace(/^\d+_/, '');
    for (const s of [art.advertiser, art.ad, file]) {
      if (!s) continue;
      const u = s.toUpperCase();
      if (SECONDA.test(u)) return 2;
      if (PRIMA.test(u)) return 1;
    }
    return ruoloZona(nomeZona, false) === 'LED1' ? 1 : 2;
  }

  return { NOME: 'zone', MAT_ZONA, ruoloZona, filaArtwork };
});
