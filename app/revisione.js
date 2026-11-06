/* Playlist Check — visual check: schermate da rivedere (slot senza doppioni), avanzamento e righe Error dalle risposte. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  // in Node il file app/<nome>.js, nel browser PC.<nomeInCamelCase>
  const dip = (nome) => (typeof module === 'object' && module.exports ? require('./' + nome + '.js')
    : radice.PC[nome.replace(/-(\w)/g, (_, c) => c.toUpperCase())]);
  const { k } = dip('nomi');

  const ORDINE = ['First row', 'Second row', 'Statics', 'Zone'];
  const FUSI = ['Statics', 'Zone']; // in uno slot, le zone con lo stesso brand atteso formano un solo gruppo
  const perId = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'en', { numeric: true }));

  // animazioni: voci del motore { feed, segmento, slot, id, gruppo, colonna, atteso, nota, zone: [{ zona, file }] }.
  // Uno slot è feed + segmento + posizione nel pacchetto (mai l'ID, che nell'Excel può partire da un altro numero).
  // Un gruppo (tipo, brand, nota, zone e file) è unico nel pacchetto: compare con lo stesso oggetto in ogni schermata.
  function schermate(animazioni) {
    const slot = new Map(); // feed|segmento|slot → { feed, segmento, id, voci }
    for (const v of animazioni) {
      const chiave = [v.feed, v.segmento, v.slot].join('\u0001');
      if (!slot.has(chiave)) slot.set(chiave, { feed: v.feed, segmento: v.segmento, id: v.id, voci: [] });
      slot.get(chiave).voci.push(v);
    }
    const ordineZona = new Map(); // prima apparizione di ogni zona, per ordinare i gruppi dello stesso tipo
    animazioni.forEach((v) => v.zone.forEach((z) => { if (!ordineZona.has(z.zona)) ordineZona.set(z.zona, ordineZona.size); }));

    const gruppi = new Map();
    const elenco = new Map();
    for (const s of slot.values()) {
      // dentro lo slot: statici e zone del Vault fusi per brand, le file restano una voce ciascuna
      const locali = new Map();
      s.voci.forEach((v, i) => {
        const chiaveLocale = FUSI.includes(v.gruppo) ? `${v.gruppo}|${k(v.atteso)}|${v.nota}` : `#${i}`;
        if (!locali.has(chiaveLocale)) locali.set(chiaveLocale, { gruppo: v.gruppo, atteso: v.atteso, nota: v.nota, zone: [], usi: [] });
        const l = locali.get(chiaveLocale);
        v.zone.forEach((z) => {
          l.zone.push(z);
          l.usi.push({ feed: v.feed, segmento: v.segmento, id: v.id, colonna: v.colonna, zona: z.zona });
        });
      });
      const qui = [...locali.values()].map((l) => {
        const chiave = [l.gruppo, k(l.atteso), l.nota, l.zone.map((z) => `${z.zona}=${z.file}`).sort().join(',')].join('\u0001');
        if (!gruppi.has(chiave)) gruppi.set(chiave, { chiave, gruppo: l.gruppo, atteso: l.atteso, nota: l.nota, zone: l.zone, usi: [] });
        const g = gruppi.get(chiave);
        g.usi.push(...l.usi);
        return g;
      });
      qui.sort((a, b) => ORDINE.indexOf(a.gruppo) - ORDINE.indexOf(b.gruppo)
        || Math.min(...a.zone.map((z) => ordineZona.get(z.zona))) - Math.min(...b.zone.map((z) => ordineZona.get(z.zona))));
      const chiaveSlot = qui.map((g) => g.chiave).sort().join('\n');
      if (!elenco.has(chiaveSlot)) elenco.set(chiaveSlot, { chiave: chiaveSlot, gruppi: qui, dove: [] });
      const sc = elenco.get(chiaveSlot);
      let d = sc.dove.find((x) => x.feed === s.feed && x.segmento === s.segmento);
      if (!d) sc.dove.push(d = { feed: s.feed, segmento: s.segmento, ids: [] });
      if (!d.ids.includes(s.id)) d.ids.push(s.id);
    }
    const lista = [...elenco.values()];
    lista.forEach((sc) => sc.dove.forEach((d) => d.ids.sort(perId)));
    return lista;
  }

  // gruppi unici di tutte le schermate
  const gruppiUnici = (lista) => [...new Map(lista.flatMap((s) => s.gruppi).map((g) => [g.chiave, g])).values()];

  // risposte: Map(chiave gruppo → { esito: 'correct' | 'wrong', nota })
  function avanzamento(lista, risposte) {
    const unici = gruppiUnici(lista);
    return {
      totale: lista.length,
      riviste: lista.filter((s) => s.gruppi.every((g) => risposte.has(g.chiave))).length,
      sbagliati: unici.filter((g) => (risposte.get(g.chiave) || {}).esito === 'wrong').length,
      risposti: unici.filter((g) => risposte.has(g.chiave)).length,
    };
  }

  function testoAvanzamento(av) {
    if (!av.totale) return 'nothing to review';
    if (!av.risposti) return 'not started';
    return `${av.riviste} of ${av.totale} slots reviewed · ${av.sbagliati} wrong`;
  }

  // Un gruppo sbagliato → un Error per ogni punto in cui va in onda (feed, segmento, ID, colonna, zona).
  function esitiVisivi(lista, risposte) {
    return gruppiUnici(lista).flatMap((g) => {
      const r = risposte.get(g.chiave);
      if (!r || r.esito !== 'wrong') return [];
      const file = [...new Set(g.zone.map((z) => z.file))].join(' + ');
      const trovato = `wrong animation (visual check): ${file}${r.nota && r.nota.trim() ? ' — ' + r.nota.trim() : ''}`;
      return g.usi.map((u) => ({ tipo: 'Error', feed: u.feed, segmento: u.segmento, id: u.id, colonna: u.colonna, zona: u.zona, atteso: g.atteso, trovato }));
    });
  }

  return { NOME: 'revisione', schermate, avanzamento, testoAvanzamento, esitiVisivi };
});
