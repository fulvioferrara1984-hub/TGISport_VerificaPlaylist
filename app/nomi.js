/* Playlist Check — confronto dei nomi dei brand tra Excel e AIR package. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // Suffissi di posizione/servizio che si tolgono in coda al nome di un artwork (es. ALFA_GL1_J → ALFA).
  const POS = new Set(['GC1', 'GC', '1', '2', 'GL1', 'GL2', 'GL', 'TL1', 'TL2', 'TL', 'J', 'D', 'JUMBO', 'CORNER', 'A', 'B', 'C', 'AB', 'BC',
    'LC', 'UC', 'SX', 'DX', 'GLSX', 'GLDX', 'GLSX2', 'GLDX2', 'TLA', 'SOLO', 'SOLO1FILA', 'GL2TL2', 'CC', 'ADD',
    'LSX', 'USX', 'UDX', 'LDX', 'TLB', 'TLBC', 'LCUC', 'TL2A', 'TL2BC', 'TL2AB', '1FILA', '2FILA', 'CX', 'CX2', 'TLCX', 'GLSX1', 'GLDX1',
    'RSX', 'RDX', 'SEC', '10', '15', '30']);

  // Solo lettere maiuscole e cifre: "Alfa Beta_J" → "ALFABETAJ".
  function k(testo) {
    return testo == null ? '' : String(testo).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  // "TRANSPARENT" nell'Excel vuol dire nessun virtual, come la cella vuota.
  function vuoto(valore) {
    const n = k(valore);
    return n === '' || n === 'TRANSPARENT' ? null : valore;
  }

  // Toglie i codici di modalità in coda (Jumbo / Domination): si confrontano solo i brand.
  function senzaCodici(testo) {
    return String(testo).trim().replace(/(\s*\((J|D)\)|_(J|D))\s*$/i, '');
  }

  function chiaveBrand(nomeAd) {
    const parti = String(nomeAd).toUpperCase().split('_');
    while (parti.length > 1 && POS.has(k(parti[parti.length - 1]))) parti.pop();
    return { chiave: k(parti.join('')), parole: parti.map(k).filter(Boolean) };
  }

  // Damerau-Levenshtein, variante OSA: lo scambio di due lettere vicine conta 1.
  function distanza(a, b) {
    const d = [];
    for (let i = 0; i <= a.length; i++) {
      d.push([]);
      for (let j = 0; j <= b.length; j++) d[i].push(i * j === 0 ? i + j : 0);
    }
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  // Quasi uguali: al massimo 2 modifiche e similarità almeno 0,75.
  function vicini(a, b) {
    const d = distanza(a, b);
    return d <= 2 && 1 - d / Math.max(a.length, b.length) >= 0.75;
  }

  // Nome del file senza cartella, estensione e numero iniziale: "../advertisements/9627_casa_alfa_1.mp4" → "casa_alfa_1".
  function nomeFile(file) {
    return String(file || '').split('/').pop().replace(/\.[^.]*$/, '').replace(/^\d+_/, '');
  }

  // excel: testo della cella (o null); art: { ad, advertiser, file } (o null).
  // ctx: { alias: { NOMEEXCEL: [CHIAVE AIR, …] }, casa: Set dei token della squadra di casa }.
  function confronta(excel, art, ctx) {
    const e = excel ? k(senzaCodici(excel)) : '';
    if (!art) return e ? 'errore' : 'ok';
    if (!e) return 'errore';
    const alias = ctx.alias || {};
    const { chiave, parole } = chiaveBrand(art.ad);
    if (e === chiave || Object.keys(alias).some((a) => e.includes(a) && alias[a].includes(chiave))) return 'ok';
    const fk = k(nomeFile(art.file));
    if (parole.every((p) => e.includes(p)) || chiave.includes(e) || (e.length >= 4 && fk.includes(e))) return 'variante';
    // nome advertiser e nome file senza il prefisso della squadra di casa (es. CASA_ALFA_LSX → ALFA)
    for (const altro of [art.advertiser, nomeFile(art.file)]) {
      if (!altro) continue;
      const p2 = chiaveBrand(altro).parole.filter((p) => !(ctx.casa && ctx.casa.has(p)));
      if (p2.length && p2.every((p) => e.includes(p))) return 'variante';
    }
    const inversi = Object.keys(alias).filter((a) => alias[a].includes(chiave));
    if ([chiave].concat(alias[e] || [], inversi).some((c) => vicini(e, c))) return 'refuso';
    // refuso nel nome AIR: il brand trovato è quasi uguale a un alias ufficiale del nome Excel (es. ALAF_PT ~ ALFA_PT)
    if (Object.keys(alias).some((a) => e.includes(a) && alias[a].some((x) => vicini(x, chiave)))) return 'refuso';
    return 'errore';
  }

  return { NOME: 'nomi', POS, k, vuoto, senzaCodici, chiaveBrand, distanza, nomeFile, confronta };
});
