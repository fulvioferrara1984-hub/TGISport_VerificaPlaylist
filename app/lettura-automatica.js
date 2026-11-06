/* Playlist Check — lettura automatica del marchio per il visual check: quale parola cercare nel testo letto dalle animazioni
   e quando un gruppo diventa Correct da solo (marchio letto in tutti i suoi file). La lettura vera è in lettura-automatica-ui.js. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  const dip = (nome) => (typeof module === 'object' && module.exports ? require('./' + nome + '.js')
    : radice.PC[nome.replace(/-(\w)/g, (_, c) => c.toUpperCase())]);
  const { POS, senzaCodici, distanza } = dip('nomi');

  // parole del nome che non dicono il marchio: overlay, regioni, lingue, mercati
  const VUOTE = new Set(['OVERLAY', 'EUROPA', 'EUROPE', 'ASIA', 'AMERICHE', 'AMERICA', 'AMERICAS', 'LATAM', 'FAR', 'EAST', 'MENA', 'ROW',
    'AFRICA', 'MIDDLE', 'NORTH', 'SOUTH', 'CHINA', 'VIETNAM', 'INDIA', 'ENG', 'ITA', 'ESP', 'NEW', 'DEST', 'MARKET', 'DOMESTIC', 'WORLD',
    'GLOBAL', 'THE', 'AND', 'FOR', 'WITH']);
  // parole che si leggono anche nelle animazioni di altri marchi (scritte sulle maglie, slogan): non bastano per dire "letto"
  const GENERICHE = new Set(['SPORT', 'SPORTS', 'CLUB', 'HOME', 'AWAY', 'THIRD', 'KIT', 'JERSEY', 'BET', 'BETS', 'BETTING', 'OFFICIAL',
    'PARTNER', 'PARTNERS', 'SPONSOR', 'GROUP', 'MATCH', 'MATCHDAY', 'GAME', 'GAMES', 'LIVE', 'FOOTBALL', 'SOCCER', 'CALCIO', 'LEAGUE',
    'CUP', 'TEAM', 'STORE', 'SHOP', 'APP', 'WOMEN', 'ACADEMY', 'STADIUM', 'TICKET', 'TICKETS', 'MEMBERSHIP', 'CAMPAIGN', 'BANK',
    'CASINO', 'ONLINE', 'COM', 'WWW', 'FAN', 'FANS', 'TOUR', 'PRESENTS', 'POWERED', 'NEXT', 'DAY']);

  // lettere accentate come quelle semplici (PIÙ → PIU), poi parole di sole lettere e cifre
  const pezzi = (testo) => String(testo == null ? '' : testo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .split(/[^A-Z0-9]+/).filter(Boolean);

  // Parola da cercare per il nome atteso (brand dell'Excel o Partner): la più lunga che resta, o null se non ce n'è una utile.
  // squadre: nomi della squadra di casa e di quella ospite, che non dicono il marchio.
  function parolaMarchio(atteso, squadre = []) {
    if (atteso == null) return null;
    const via = new Set(squadre.flatMap(pezzi));
    const candidate = pezzi(senzaCodici(atteso)).filter((p) => p.length >= 3 && !/^\d+$/.test(p) && !POS.has(p)
      && !VUOTE.has(p) && !GENERICHE.has(p) && !via.has(p));
    return candidate.length ? candidate.reduce((a, b) => (b.length > a.length ? b : a)) : null;
  }

  // Testo letto → parole di almeno 3 lettere o cifre.
  const parole = (testo) => pezzi(testo).filter((p) => p.length >= 3);

  // lettere che il lettore scambia per la forma (Q letta O, I letta L o 1, S letta 5): si confrontano come una sola
  const forma = (t) => t.replace(/[Q0]/g, 'O').replace(/[L1]/g, 'I').replace(/5/g, 'S');

  // La parola è una delle parole lette; da 6 lettere in su vale anche con una lettera sbagliata, mancante, in più o scambiata.
  function trovata(parola, lette) {
    const p = forma(parola);
    return lette.some((x) => {
      const t = forma(x);
      return t === p || (p.length >= 6 && Math.abs(t.length - p.length) <= 1 && distanza(p, t) <= 1);
    });
  }

  const gruppiUnici = (lista) => [...new Map(lista.flatMap((s) => s.gruppi).map((g) => [g.chiave, g])).values()];

  // File da leggere, nell'ordine delle schermate, con le parole dei gruppi ancora senza risposta che li usano.
  function daLeggere(lista, risposte, squadre = []) {
    const out = new Map();
    for (const g of gruppiUnici(lista)) {
      const p = risposte.has(g.chiave) ? null : parolaMarchio(g.atteso, squadre);
      if (!p) continue;
      g.zone.forEach((z) => {
        if (!out.has(z.file)) out.set(z.file, new Set());
        out.get(z.file).add(p);
      });
    }
    return out;
  }

  // letture: Map(file → Set delle parole trovate nel file). Per ogni zona del gruppo: il suo file mostra la parola?
  function zoneLette(g, letture, squadre = []) {
    const p = parolaMarchio(g.atteso, squadre);
    return g.zone.map((z) => Boolean(p && letture.has(z.file) && letture.get(z.file).has(p)));
  }

  // Gruppi senza risposta con il marchio letto in tutti i file → Correct automatico { esito, nota, auto: parola }.
  // Non tocca mai una risposta che c'è già. Restituisce quante risposte ha aggiunto.
  function applica(lista, risposte, letture, squadre = []) {
    let nuove = 0;
    for (const g of gruppiUnici(lista)) {
      if (risposte.has(g.chiave) || !g.zone.length) continue;
      const p = parolaMarchio(g.atteso, squadre);
      if (!p || !zoneLette(g, letture, squadre).every(Boolean)) continue;
      risposte.set(g.chiave, { esito: 'correct', nota: '', auto: p });
      nuove++;
    }
    return nuove;
  }

  return { NOME: 'letturaAutomatica', parolaMarchio, parole, trovata, daLeggere, zoneLette, applica };
});
