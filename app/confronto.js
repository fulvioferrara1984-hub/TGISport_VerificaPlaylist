/* Playlist Check — motore del confronto: Excel (comanda) contro AIR package. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  // in Node il file app/<nome>.js, nel browser PC.<nomeInCamelCase> (es. 'confronto-virtual' → PC.confrontoVirtual)
  const dip = (nome) => (typeof module === 'object' && module.exports ? require('./' + nome + '.js')
    : radice.PC[nome.replace(/-(\w)/g, (_, c) => c.toUpperCase())]);
  const nomi = dip('nomi');
  const { NOME_REG, controllaVirtual } = dip('confronto-virtual');
  const { attesiStatici, controllaStatici } = dip('confronto-statici');
  const { ruoloZona, fileDelleZone } = dip('zone');

  const NOMI_SEGMENTO = { PRE: 'Pre Match - Post Match', MATCH: '1st - 2nd Half', MATCH1: '1st Half', MATCH2: '2nd Half', HL: 'Highlights' };

  // null per un nome che non si riconosce: quel segmento non si controlla (avviso), invece di indovinarne il tipo.
  function tipoSegmento(nome) {
    const s = nomi.k(nome);
    if (s.includes('HIGHLIGHT')) return 'HL';
    if (s.includes('PRE')) return 'PRE';
    const primo = s.includes('1ST') || s.includes('FIRST');
    const secondo = s.includes('2ND') || s.includes('SECOND');
    if ((s.includes('1ST') && s.replace('1ST', '').includes('2')) || (primo && secondo)) return 'MATCH';
    if (primo) return 'MATCH1';
    if (secondo) return 'MATCH2';
    return null;
  }

  // Squadre di casa e ospite da un titolo ("6 - ALFA-BETA", "MATCH | ALFA-BETA", "ALFA VS BETA", "ALFA-BETA_V3"…); null se non ci sono.
  function squadre(testo) {
    let t = String(testo || '').toUpperCase().trim()
      .replace(/^MATCH\b\s*\|?\s*/, '').replace(/^\d+\s*-\s*/, '');
    const parti = (/\sVS\s/.test(t) ? t.split(/\sVS\s/) : t.split('-')).map((p) => p.trim()).filter(Boolean);
    if (parti.length < 2) return null;
    const prima = (p) => p.split(/[\s_]+/)[0].replace(/[^A-Z0-9]/g, '');
    const s = [prima(parti[0]), prima(parti[1])];
    return s[0] && s[1] ? s : null;
  }

  const contenuto = (tabelle) => {
    const regioni = new Set();
    tabelle.forEach((t) => t.righe.forEach((r) => r.valori.forEach((v, chiave) => { if (v) regioni.add(chiave.split('|')[0]); })));
    return regioni;
  };

  // Un nome Excel che non corrisponde mai a niente nel pacchetto e punta sempre allo stesso brand AIR (che a sua volta non
  // corrisponde a nessun altro nome) è un probabile alias da confermare; se il brand trovato è un altro nome dell'Excel è uno scambio.
  const VUOTI = ['Blank', 'nothing', 'Circle_Empty']; // "nessun brand": un errore con questi valori non è mai un alias

  function aliasProbabili(esiti, giusti, nomiExcel, ctxNomi) {
    const chiaveTrovato = (t) => nomi.chiaveBrand(String(t).replace(/ \(.*\)$/, '')).chiave;
    const giustiE = new Set([...giusti].map((g) => g.split('|')[0]));
    const giustiZ = new Set([...giusti].map((g) => g.split('|')[1]));
    const candidato = (e) => e.tipo === 'Error' && (String(e.colonna).includes('row') || String(e.colonna).startsWith('STATIC'))
      && !VUOTI.includes(e.atteso) && !VUOTI.includes(e.trovato) && !String(e.trovato).includes('-row file');
    const coppie = new Map();
    esiti.filter(candidato).forEach((e) => {
      const ek = nomi.k(nomi.senzaCodici(e.atteso));
      if (!coppie.has(ek)) coppie.set(ek, new Set());
      coppie.get(ek).add(chiaveTrovato(e.trovato));
    });
    const probabili = new Set();
    coppie.forEach((zs, ek) => { if (zs.size === 1 && !giustiE.has(ek) && ![...zs].some((z) => giustiZ.has(z))) probabili.add(ek); });
    const diAltroNome = (e) => {
      const art = { ad: String(e.trovato).replace(/ \(.*\)$/, ''), advertiser: null, file: '' };
      const ck = nomi.chiaveBrand(art.ad).chiave;
      return [...nomiExcel].some((x) => {
        if (x === e.atteso) return false;
        const es = nomi.confronta(x, art, ctxNomi);
        return es === 'ok' || (es === 'variante' && nomi.k(nomi.senzaCodici(x)).length <= ck.length + 8);
      });
    };
    esiti.filter((e) => candidato(e) && diAltroNome(e)).forEach((e) => probabili.delete(nomi.k(nomi.senzaCodici(e.atteso))));
    return esiti.map((e) => (candidato(e) && probabili.has(nomi.k(nomi.senzaCodici(e.atteso))) ? { ...e, tipo: 'Possible alias' } : e));
  }

  const { staNelloSlot } = dip('video');
  const secondi = (x) => `${Number(x.toFixed(2))} s`;

  // excel: da letturaExcel.leggiExcel; air: da letturaAir.leggiAir; regole: { alias, zoneSponsor: { prefisso, etichetta, DOM, FE, altri } }.
  function verifica(excel, air, regole) {
    const ev = air.evento;
    const sqEv = squadre(ev.nome);
    const ctxNomi = { alias: regole.alias || {}, casa: new Set(sqEv ? [sqEv[0]] : [nomi.k(String(ev.nome).split(/[-_ ]/)[0])]) };
    const angoliStatici = [...excel.statici.keys()].some((c) => c.startsWith('LC|'));
    let esiti = [];
    const c = { zone: air.zone, angoliStatici, prefissoSponsor: regole.zoneSponsor && regole.zoneSponsor.prefisso, ctxNomi, giusti: new Set(), celle: { n: 0 }, cella: null };
    // fila delle zone LED in uso, dal pacchetto intero: una zona dimenticata per tutto un segmento resta da controllare
    c.filaZona = fileDelleZone(air.stream.flatMap((s) => s.segmenti), (z) => air.zone.get(z),
      (z) => ruoloZona(air.zone.get(z), angoliStatici, c.prefissoSponsor).startsWith('LED'));
    // ogni risultato prende il numero della cella in controllo (null fuori dalle celle): serve a contare le celle corrette
    c.nota = (e) => esiti.push(c.cella ? { ...e, cella: c.cella } : e);
    const tabelle = Object.values(excel.partite).concat([excel.hl]);
    const nomiExcel = new Set();
    tabelle.forEach((t) => t.righe.forEach((r) => r.valori.forEach((v) => { if (v) nomiExcel.add(String(v).trim()); })));
    excel.statici.forEach((s) => { if (s.valore) nomiExcel.add(String(s.valore).trim()); });

    const coperte = new Set();
    air.stream.forEach((s) => s.regioni.forEach((r) => coperte.add(r)));
    // regioni che devono avere un feed: quelle con virtual nell'Excel, più il Domestico se ha asset statici
    // (gli statici delle altre regioni sono spesso compilati dal template anche per feed che non esistono)
    const conContenuto = contenuto(tabelle);
    if ([...excel.statici].some(([chiave, s]) => chiave.endsWith('|DOM') && s.valore)) conContenuto.add('DOM');
    [...conContenuto].filter((r) => !coperte.has(r)).sort().forEach((r) => {
      esiti.push({ tipo: 'Error', feed: NOME_REG[r], segmento: '-', id: '-', colonna: '-', zona: '-', atteso: 'AIR feed for ' + NOME_REG[r], trovato: 'missing' });
    });

    // righe dell'Excel con un ID non numerico: restano al loro posto, ma vanno sistemate
    (excel.avvisi || []).forEach((a) => esiti.push({ tipo: 'Warning', feed: '-', segmento: '-', id: a.id, colonna: `${a.foglio} · A${a.riga}`, zona: '-', atteso: 'numeric ID', trovato: a.id }));
    // pacchetto senza file media: un solo errore invece di uno per artwork
    if (air.media instanceof Set && air.media.size === 0) {
      esiti.push({ tipo: 'Error', feed: '-', segmento: '-', id: '-', colonna: '-', zona: '-', atteso: 'media files in advertisements/', trovato: 'none' });
    }

    // ogni feed deve avere il pre-match, la partita (intera o i due tempi, come nell'Excel) e gli highlights
    const richiesti = ['PRE'].concat(Object.keys(excel.partite), ['HL']);
    for (const stream of air.stream) {
      const presenti = new Set(stream.segmenti.map((g) => tipoSegmento(g.nome)));
      richiesti.filter((t) => !presenti.has(t)).forEach((t) => {
        esiti.push({ tipo: 'Error', feed: stream.nome, segmento: NOMI_SEGMENTO[t], id: '-', colonna: '-', zona: '-', atteso: 'AIR sequence', trovato: 'missing' });
      });
    }

    for (const stream of air.stream) {
      c.cella = null;
      const attesi = attesiStatici(excel.statici, stream.regioni, c.nota, stream.nome);
      for (const seg of stream.segmenti) {
        c.cella = null;
        const nota = (tipo, id, colonna, zona, atteso, trovato) => c.nota({ tipo, feed: stream.nome, segmento: seg.nome, id, colonna, zona, atteso, trovato });
        if (!seg.intervalli) { nota('Error', '-', '-', '-', 'sequence file', 'missing ' + seg.file); continue; }
        const tipo = tipoSegmento(seg.nome);
        if (!tipo) { nota('Warning', '-', '-', '-', 'known segment', 'not checked'); continue; }
        if (tipo.startsWith('MATCH') && !excel.partite[tipo]) { nota('Error', '-', '-', '-', `Excel sheet for ${seg.nome}`, 'missing'); continue; }
        seg.intervalli.forEach((iv, i) => {
          const id = tipo.startsWith('MATCH') ? i : i + 1; // come negli statici: lo slot 0 delle partite è il lead-in
          const dopo = seg.intervalli[i + 1];
          if (dopo && dopo.inizio !== iv.inizio + iv.durata) nota('Error', id, '-', '-', 'contiguous slots', `gap at ${iv.inizio + iv.durata} ms`);
          iv.mappe.forEach((a, z) => {
            const file = String(a.file).split('/').pop();
            if (air.media && air.media.size && !air.media.has(file)) nota('Error', id, '-', air.zone.get(z), 'media file', 'missing ' + file);
            const video = air.durateMedia && air.durateMedia.get(file);
            if (video && !staNelloSlot(video, iv.durata / 1000)) nota('Error', id, '-', air.zone.get(z), `video fitting a ${secondi(iv.durata / 1000)} slot`, `${a.ad} · ${secondi(video)}`);
          });
        });
        if (tipo !== 'PRE') controllaVirtual(c, stream, seg, tipo, tipo === 'HL' ? excel.hl : excel.partite[tipo]);
        controllaStatici(c, stream, seg, tipo, attesi, regole.zoneSponsor);
      }
    }
    esiti = aliasProbabili(esiti, c.giusti, nomiExcel, ctxNomi);

    const sqExcel = squadre(excel.titolo);
    const sq = sqExcel || sqEv;
    const conteggi = {};
    esiti.forEach((e) => { conteggi[e.tipo] = (conteggi[e.tipo] || 0) + 1; });
    return {
      celle: c.celle.n,
      esiti,
      riepilogo: {
        partita: sq ? sq.join(' - ') : String(excel.titolo || ev.nome),
        casa: sq ? sq[0] : '', ospite: sq ? sq[1] : '',
        venue: ev.venue, dataEvento: ev.data, evento: ev.nome,
        partiteDiverse: Boolean(sqExcel && sqEv && (sqExcel[0] !== sqEv[0] || sqExcel[1] !== sqEv[1])),
        conteggi,
        sistema: 'Hub',
        feed: air.stream.map((s) => s.nome),
        segmenti: [...new Set(air.stream.flatMap((s) => s.segmenti.map((g) => g.nome)))],
      },
    };
  }

  return { NOME: 'confronto', tipoSegmento, squadre, aliasProbabili, verifica };
});
