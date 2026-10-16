/* Playlist Check — risultati raggruppati, esito del controllo, conferme di refusi/alias ed export Excel. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  // in Node il file app/<nome>.js, nel browser PC.<nomeInCamelCase>
  const dip = (nome) => (typeof module === 'object' && module.exports ? require('./' + nome + '.js')
    : radice.PC[nome.replace(/-(\w)/g, (_, c) => c.toUpperCase())]);
  const nomi = dip('nomi');

  const ORDINE = ['Error', 'Possible typo', 'Possible alias', 'Warning', 'Recovery', 'Variant', 'Correct'];
  const DA_CONFERMARE = ['Possible typo', 'Possible alias'];

  const perId = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b
    : typeof a === 'number' ? -1 : typeof b === 'number' ? 1 : String(a).localeCompare(String(b), 'en', { numeric: true }));

  // Una riga per (tipo, feed, segmento, colonna, atteso, trovato), con ID e zone; prima i tipi più gravi.
  // Le durate sbagliate (colonna "C<riga> · Duration") stanno in un solo gruppo per feed, segmento e durata trovata.
  const DURATA = /^C\d+ · Duration$/;

  function raggruppa(esiti) {
    const gruppi = new Map();
    for (const e of esiti) {
      const durata = DURATA.test(e.colonna);
      const chiave = [e.tipo, e.feed, e.segmento, durata ? 'C · Duration' : e.colonna, durata ? '' : e.atteso, e.trovato].join('\u0001');
      if (!gruppi.has(chiave)) {
        gruppi.set(chiave, { tipo: e.tipo, feed: e.feed, segmento: e.segmento, colonna: e.colonna, atteso: e.atteso, trovato: e.trovato, zone: [], ids: [], conta: 0, attesi: [] });
      }
      const g = gruppi.get(chiave);
      if (!g.zone.includes(e.zona)) g.zone.push(e.zona);
      if (!g.ids.includes(e.id)) g.ids.push(e.id);
      if (!g.attesi.includes(e.atteso)) g.attesi.push(e.atteso);
      if (g.colonna !== e.colonna) g.colonna = 'C · Duration';
      g.conta++;
    }
    const lista = [...gruppi.values()];
    lista.forEach((g) => {
      g.ids.sort(perId);
      if (g.attesi.length > 1) g.atteso = `${g.attesi.length} different values`;
      delete g.attesi;
    });
    return lista.map((g, i) => [g, i]).sort((a, b) => ORDINE.indexOf(a[0].tipo) - ORDINE.indexOf(b[0].tipo) || a[1] - b[1]).map(([g]) => g);
  }

  // [182, 183, 184, 240] → "182–184, 240"
  function idCompatti(ids) {
    const parti = [];
    let i = 0;
    while (i < ids.length) {
      if (typeof ids[i] !== 'number') { parti.push(String(ids[i])); i++; continue; }
      let j = i;
      while (j + 1 < ids.length && typeof ids[j + 1] === 'number' && ids[j + 1] === ids[j] + 1) j++;
      parti.push(j > i ? `${ids[i]}–${ids[j]}` : String(ids[i]));
      i = j + 1;
    }
    return parti.join(', ');
  }

  const chiaveCoppia = (e) => `${e.tipo}|${nomi.k(nomi.senzaCodici(e.atteso))}|${nomi.chiaveBrand(e.trovato).chiave}`;
  const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

  // Una conferma per coppia di nomi (stesso nome Excel, stesso brand AIR), con i suoi gruppi di risultati.
  function coppieDaConfermare(esiti) {
    const coppie = new Map();
    esiti.filter((e) => DA_CONFERMARE.includes(e.tipo)).forEach((e) => {
      const chiave = chiaveCoppia(e);
      if (!coppie.has(chiave)) coppie.set(chiave, { chiave, tipo: e.tipo, atteso: e.atteso, trovato: nomi.chiaveBrand(e.trovato).chiave, esiti: [] });
      coppie.get(chiave).esiti.push(e);
    });
    return [...coppie.values()].map(({ esiti: lista, ...c }) => ({ ...c, gruppi: raggruppa(lista) }));
  }

  // risposte: Map(chiave coppia → 'confirm' | 'reject'). Confirm → Correct, reject → Error.
  function applicaRisposte(esiti, risposte) {
    return esiti.map((e) => {
      if (!DA_CONFERMARE.includes(e.tipo)) return e;
      const r = risposte.get(chiaveCoppia(e));
      return r === 'confirm' ? { ...e, tipo: 'Correct' } : r === 'reject' ? { ...e, tipo: 'Error' } : e;
    });
  }

  // Banner: rosso con errori (celle), giallo se c'è da confermare, altrimenti verde (avvisi contati per gruppo).
  function esito(esiti) {
    const errori = esiti.filter((e) => e.tipo === 'Error').length;
    const conferme = coppieDaConfermare(esiti).length;
    const avvisi = raggruppa(esiti.filter((e) => e.tipo === 'Warning' || e.tipo === 'Recovery')).length;
    if (errori) return { colore: 'rosso', testo: plurale(errori, 'error', 'errors') + (conferme ? ` · ${conferme} to confirm` : '') };
    if (conferme) return { colore: 'giallo', testo: `${conferme} to confirm` };
    return { colore: 'verde', testo: 'All clear' + (avvisi ? ` · ${plurale(avvisi, 'warning', 'warnings')}` : '') };
  }

  // Numeri del controllo per lo storico (§10): ultimo = { risultatoOriginale, risposte, coppie }.
  function conteggiControllo(ultimo) {
    const originali = ultimo.risultatoOriginale.esiti;
    const dopo = applicaRisposte(originali, ultimo.risposte);
    const conta = (lista, tipi) => lista.filter((e) => tipi.includes(e.tipo)).length;
    const refusiTrovati = conta(originali, DA_CONFERMARE);
    const daRisposta = (r) => originali.filter((e) => DA_CONFERMARE.includes(e.tipo) && ultimo.risposte.get(chiaveCoppia(e)) === r).length;
    const confermati = daRisposta('confirm');
    const respinti = daRisposta('reject');
    const errori = conta(dopo, ['Error']);
    const aperti = refusiTrovati - confermati - respinti;
    const celle = ultimo.risultatoOriginale.celle;
    return { celle, corrette: Math.max(0, celle - errori - aperti - conta(dopo, ['Recovery'])), errori, refusiTrovati, confermati, respinti, avvisi: conta(dopo, ['Warning', 'Recovery']) };
  }

  // Riga del foglio Checks dello script Google: solo numeri e nomi, mai i file.
  function rigaControllo(ultimo) {
    const r = ultimo.risultatoOriginale.riepilogo;
    return {
      idControllo: ultimo.idControllo, dataControllo: ultimo.dataControllo, dataEvento: r.dataEvento, partita: r.partita, casa: r.casa, ospite: r.ospite,
      venue: r.venue, fileExcel: ultimo.nomiFile.excel, fileAir: ultimo.nomiFile.air, ...conteggiControllo(ultimo),
    };
  }

  // Righe della mail: una per gruppo delle coppie confermate.
  function coppieConfermate(ultimo) {
    return ultimo.coppie.filter((c) => ultimo.risposte.get(c.chiave) === 'confirm')
      .flatMap((c) => c.gruppi.map((g) => ({ tipo: g.tipo, feed: g.feed, segmento: g.segmento, id: idCompatti(g.ids), colonna: g.colonna, excel: g.atteso, air: g.trovato })));
  }

  const INTESTAZIONE = ['Type', 'Feed', 'Segment', 'ID', 'Column', 'Zone', 'Expected', 'Found'];

  // Excel del report: foglio Summary e foglio Findings (una riga per risultato non corretto, non raggruppata).
  function esportaExcel(risultato, nomiFile, XLSX) {
    const r = risultato.riepilogo;
    const conteggi = r.conteggi || {};
    const riassunto = [['Match', r.partita], ['Venue', r.venue], ['Event date', r.dataEvento], ['Excel playlist', nomiFile.excel], ['AIR package', nomiFile.air],
      ['Cells checked', risultato.celle]].concat(ORDINE.filter((t) => conteggi[t]).map((t) => [t, conteggi[t]]));
    const righe = risultato.esiti.filter((e) => e.tipo !== 'Correct' && e.tipo !== 'Variant')
      .map((e) => [e.tipo, e.feed, e.segmento, e.id, e.colonna, e.zona, e.atteso, e.trovato]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(riassunto), 'Summary');
    const ws = XLSX.utils.aoa_to_sheet([INTESTAZIONE].concat(righe));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: righe.length, c: INTESTAZIONE.length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, 'Findings');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  }

  return {
    NOME: 'report', ORDINE, raggruppa, idCompatti, chiaveCoppia, coppieDaConfermare, applicaRisposte, esito, esportaExcel,
    conteggiControllo, rigaControllo, coppieConfermate,
  };
});
