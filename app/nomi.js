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

  // Testo compattato e confini tra le parole: ['ALFA', 'BETA'] → { testo: 'ALFABETA', confini: Set {0, 4, 8} }.
  // Anche il passaggio tra cifre e lettere è un confine (ZETA140DEST → ZETA | 140 | DEST).
  function parole(lista) {
    const confini = new Set([0]);
    let testo = '';
    lista.map(k).filter(Boolean).forEach((p) => {
      for (let i = 1; i < p.length; i++) if (/\d/.test(p[i]) !== /\d/.test(p[i - 1])) confini.add(testo.length + i);
      testo += p;
      confini.add(testo.length);
    });
    return { testo, confini };
  }
  const paroleTesto = (t) => parole(String(t).toUpperCase().split(/[^A-Z0-9]+/));

  // a sta dentro b.testo e inizia e finisce a un confine di parola (TAX non sta dentro MELTAX).
  function allineato(b, a) {
    if (!a) return false;
    for (let i = b.testo.indexOf(a); i >= 0; i = b.testo.indexOf(a, i + 1)) if (b.confini.has(i) && b.confini.has(i + a.length)) return true;
    return false;
  }

  // Una parola toccata solo in parte va bene se è coperto il suo inizio, per almeno 4 lettere e il 60% della parola
  // (abbreviazioni come ALFABET per ALFABETICO, o una lettera accentata persa in fondo).
  const abbreviata = (parola) => {
    const n = parola.indexOf(false);
    return n >= 4 && n >= 0.6 * parola.length && parola.slice(n).every((x) => !x);
  };

  // Ogni pezzo compare in b.testo dentro parole "a posto": coperte per intero dai pezzi, o abbreviate
  // (TAX non copre MELTAX; ALFA e BETA insieme coprono ALFABETA; la J di JALFA non conta se J è anche una parola).
  function coperte(b, pezzi) {
    const posizioni = pezzi.map((p) => {
      const lista = [];
      for (let i = p ? b.testo.indexOf(p) : -1; i >= 0; i = b.testo.indexOf(p, i + 1)) lista.push(i);
      return lista;
    });
    if (posizioni.some((lista) => !lista.length)) return false;
    const coperto = new Array(b.testo.length).fill(false);
    pezzi.forEach((p, n) => posizioni[n].forEach((i) => coperto.fill(true, i, i + p.length)));
    const aPosto = new Array(b.testo.length).fill(false);
    const confini = [...b.confini].sort((x, y) => x - y);
    for (let w = 0; w + 1 < confini.length; w++) {
      const parola = coperto.slice(confini[w], confini[w + 1]);
      if (parola.every(Boolean) || abbreviata(parola)) aPosto.fill(true, confini[w], confini[w + 1]);
    }
    return pezzi.every((p, n) => posizioni[n].some((i) => aPosto.slice(i, i + p.length).every(Boolean)));
  }

  // excel: testo della cella (o null); art: { ad, advertiser, file } (o null).
  // ctx: { alias: { NOMEEXCEL: [CHIAVE AIR, …] }, casa: Set dei token della squadra di casa }.
  function confronta(excel, art, ctx) {
    const e = excel ? k(senzaCodici(excel)) : '';
    if (!art) return e ? 'errore' : 'ok';
    if (!e) return 'errore';
    const ex = paroleTesto(senzaCodici(excel)); // ex.testo è e, con i confini tra le parole
    const alias = ctx.alias || {};
    const aliasExcel = Object.keys(alias).filter((a) => allineato(ex, a));
    const { chiave, parole: paroleAir } = chiaveBrand(art.ad);
    if (e === chiave || aliasExcel.some((a) => alias[a].includes(chiave))) return 'ok';
    if (coperte(ex, paroleAir) || coperte(parole(paroleAir), [e]) || (e.length >= 4 && coperte(paroleTesto(nomeFile(art.file)), [e]))) return 'variante';
    // nome advertiser e nome file senza il prefisso della squadra di casa (es. CASA_ALFA_LSX → ALFA)
    for (const altro of [art.advertiser, nomeFile(art.file)]) {
      if (!altro) continue;
      const p2 = chiaveBrand(altro).parole.filter((p) => !(ctx.casa && ctx.casa.has(p)));
      if (p2.length && coperte(ex, p2)) return 'variante';
    }
    const inversi = Object.keys(alias).filter((a) => alias[a].includes(chiave));
    if ([chiave].concat(alias[e] || [], inversi).some((c) => vicini(e, c))) return 'refuso';
    // refuso nel nome AIR: il brand trovato è quasi uguale a un alias ufficiale del nome Excel (es. ALAF_PT ~ ALFA_PT)
    if (aliasExcel.some((a) => alias[a].some((x) => vicini(x, chiave)))) return 'refuso';
    return 'errore';
  }

  return { NOME: 'nomi', POS, k, vuoto, senzaCodici, chiaveBrand, distanza, nomeFile, confronta };
});
