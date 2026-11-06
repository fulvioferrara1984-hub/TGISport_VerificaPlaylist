/* Playlist Check — visual check: statici in una prima schermata, schermate degli slot senza doppioni, avanzamento e righe Error dalle risposte. */
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

  // Zone del Vault con lo stesso file in tutto il feed (usate in almeno 2 slot): non cambiano durante la partita, come gli statici.
  function zoneFisse(animazioni) {
    const uso = new Map(); // feed|zona → { file, slot }
    animazioni.filter((v) => v.gruppo === 'Zone').forEach((v) => v.zone.forEach((z) => {
      const chiave = v.feed + '\u0001' + z.zona;
      if (!uso.has(chiave)) uso.set(chiave, { file: new Set(), slot: new Set() });
      uso.get(chiave).file.add(z.file);
      uso.get(chiave).slot.add(v.segmento + '\u0001' + v.slot);
    }));
    return new Set([...uso].filter(([, u]) => u.file.size === 1 && u.slot.size >= 2).map(([chiave]) => chiave));
  }

  // animazioni: voci del motore { feed, segmento, slot, id, gruppo, colonna, atteso, nota, zone: [{ zona, file }] }.
  // Prima schermata (tipo 'statici'): gli asset che non cambiano durante la partita (statici dell'Hub, zone fisse del Vault),
  // ognuno una volta sola. Poi una schermata (tipo 'slot') per ogni slot diverso, con le sole file / zone che cambiano.
  // Uno slot è feed + segmento + posizione nel pacchetto (mai l'ID, che nell'Excel può partire da un altro numero).
  // Un gruppo (tipo, brand, nota, zone e file) è unico nel pacchetto: compare con lo stesso oggetto in ogni schermata.
  function schermate(animazioni) {
    const fisse = zoneFisse(animazioni);
    const statica = (v) => v.gruppo === 'Statics' || (v.gruppo === 'Zone' && v.zone.every((z) => fisse.has(v.feed + '\u0001' + z.zona)));
    const slot = new Map(); // feed|segmento|slot → { feed, segmento, id, voci }
    for (const v of animazioni) {
      const chiave = [v.feed, v.segmento, v.slot].join('\u0001');
      if (!slot.has(chiave)) slot.set(chiave, { feed: v.feed, segmento: v.segmento, id: null, voci: [] });
      const s = slot.get(chiave);
      s.voci.push(v);
      if (s.id === null && !statica(v)) s.id = v.id; // lo slot si mostra con l'ID delle sue file
    }
    const ordineZona = new Map(); // prima apparizione di ogni zona, per ordinare i gruppi dello stesso tipo
    animazioni.forEach((v) => v.zone.forEach((z) => { if (!ordineZona.has(z.zona)) ordineZona.set(z.zona, ordineZona.size); }));
    const ordina = (lista) => lista.sort((a, b) => ORDINE.indexOf(a.gruppo) - ORDINE.indexOf(b.gruppo)
      || Math.min(...a.zone.map((z) => ordineZona.get(z.zona))) - Math.min(...b.zone.map((z) => ordineZona.get(z.zona))));

    const gruppi = new Map();
    const statici = new Map();
    const elenco = new Map();
    for (const s of slot.values()) {
      // dentro lo slot: statici e zone del Vault fusi per brand, le file restano una voce ciascuna
      const locali = new Map();
      s.voci.forEach((v, i) => {
        const fisso = statica(v);
        const chiaveLocale = FUSI.includes(v.gruppo) ? `${v.gruppo}|${fisso}|${k(v.atteso)}|${v.nota}` : `#${i}`;
        if (!locali.has(chiaveLocale)) locali.set(chiaveLocale, { gruppo: v.gruppo, statico: fisso, atteso: v.atteso, nota: v.nota, zone: [], usi: [] });
        const l = locali.get(chiaveLocale);
        v.zone.forEach((z) => {
          l.zone.push(z);
          l.usi.push({ feed: v.feed, segmento: v.segmento, id: v.id, colonna: v.colonna, zona: z.zona });
        });
      });
      const qui = [...locali.values()].map((l) => {
        const chiave = [l.gruppo, l.statico ? 'fisso' : '', k(l.atteso), l.nota, l.zone.map((z) => `${z.zona}=${z.file}`).sort().join(',')].join('\u0001');
        if (!gruppi.has(chiave)) gruppi.set(chiave, { chiave, gruppo: l.gruppo, statico: l.statico, atteso: l.atteso, nota: l.nota, zone: l.zone, usi: [] });
        const g = gruppi.get(chiave);
        g.usi.push(...l.usi);
        return g;
      });
      qui.filter((g) => g.statico).forEach((g) => statici.set(g.chiave, g));
      const variabili = ordina(qui.filter((g) => !g.statico));
      if (!variabili.length) continue; // slot con soli statici: già tutto nella prima schermata
      const chiaveSlot = variabili.map((g) => g.chiave).sort().join('\n');
      if (!elenco.has(chiaveSlot)) elenco.set(chiaveSlot, { chiave: chiaveSlot, tipo: 'slot', gruppi: variabili, dove: [] });
      const sc = elenco.get(chiaveSlot);
      let d = sc.dove.find((x) => x.feed === s.feed && x.segmento === s.segmento);
      if (!d) sc.dove.push(d = { feed: s.feed, segmento: s.segmento, ids: [] });
      if (!d.ids.includes(s.id)) d.ids.push(s.id);
    }
    const lista = [...elenco.values()];
    lista.forEach((sc) => sc.dove.forEach((d) => d.ids.sort(perId)));
    return statici.size ? [{ chiave: '\u0000statici', tipo: 'statici', gruppi: ordina([...statici.values()]), dove: [] }, ...lista] : lista;
  }

  // Dove va in onda un gruppo: i feed con gli stessi segmenti insieme, in ordine di apparizione.
  function doveGruppo(g) {
    const perFeed = new Map();
    g.usi.forEach((u) => {
      if (!perFeed.has(u.feed)) perFeed.set(u.feed, []);
      if (!perFeed.get(u.feed).includes(u.segmento)) perFeed.get(u.feed).push(u.segmento);
    });
    const righe = [];
    perFeed.forEach((segmenti, feed) => {
      const r = righe.find((x) => x.segmenti.join('\u0001') === segmenti.join('\u0001'));
      if (r) r.feed.push(feed); else righe.push({ feed: [feed], segmenti });
    });
    return righe;
  }

  // gruppi unici di tutte le schermate
  const gruppiUnici = (lista) => [...new Map(lista.flatMap((s) => s.gruppi).map((g) => [g.chiave, g])).values()];

  // risposte: Map(chiave gruppo → { esito: 'correct' | 'wrong', nota }).
  // totale / riviste contano le schermate degli slot; statici / staticiRisposti i gruppi della prima schermata.
  function avanzamento(lista, risposte) {
    const unici = gruppiUnici(lista);
    const slot = lista.filter((s) => s.tipo !== 'statici');
    const statici = (lista.find((s) => s.tipo === 'statici') || { gruppi: [] }).gruppi;
    return {
      totale: slot.length,
      riviste: slot.filter((s) => s.gruppi.every((g) => risposte.has(g.chiave))).length,
      sbagliati: unici.filter((g) => (risposte.get(g.chiave) || {}).esito === 'wrong').length,
      risposti: unici.filter((g) => risposte.has(g.chiave)).length,
      statici: statici.length,
      staticiRisposti: statici.filter((g) => risposte.has(g.chiave)).length,
    };
  }

  const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

  // prima di iniziare: "22 slots and 7 static assets to review"
  function testoDaFare(av) {
    const parti = [];
    if (av.totale) parti.push(plurale(av.totale, 'slot', 'slots'));
    if (av.statici) parti.push(plurale(av.statici, 'static asset', 'static assets'));
    return parti.length ? `${parti.join(' and ')} to review` : 'nothing to review';
  }

  function testoAvanzamento(av) {
    if (!av.totale && !av.statici) return 'nothing to review';
    if (!av.risposti) return 'not started';
    const parti = [];
    if (av.statici) parti.push(`static assets ${av.staticiRisposti} of ${av.statici}`);
    if (av.totale) parti.push(`${av.riviste} of ${av.totale} slots reviewed`);
    parti.push(`${av.sbagliati} wrong`);
    return parti.join(' · ');
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

  return { NOME: 'revisione', schermate, doveGruppo, avanzamento, testoAvanzamento, testoDaFare, esitiVisivi };
});
