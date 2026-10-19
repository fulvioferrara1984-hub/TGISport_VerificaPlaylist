/* Playlist Check — confronto della playlist Excel del Vault (comanda) con il pacchetto del Vault. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  // in Node il file app/<nome>.js, nel browser PC.<nomeInCamelCase> (es. 'confronto-virtual' → PC.confrontoVirtual)
  const dip = (nome) => (typeof module === 'object' && module.exports ? require('./' + nome + '.js')
    : radice.PC[nome.replace(/-(\w)/g, (_, c) => c.toUpperCase())]);
  const { k } = dip('nomi');
  const { lettera } = dip('confronto-virtual');
  const { staNelloSlot } = dip('video');

  const spazi = (t) => String(t == null ? '' : t).replace(/_/g, ' ').trim();
  const secondi = (x) => `${Number(x.toFixed(2))} s`;
  const senzaEstensione = (f) => String(f).replace(/\.[a-z0-9]{2,4}$/i, '');
  const VARIANTE = ' (package variant)';

  // "Alfa v Beta" / "Alfa vs Beta" → ['Alfa', 'Beta']
  function squadre(partita) {
    const parti = String(partita || '').split(/\s+vs?\.?\s+/i).map((x) => x.trim()).filter(Boolean);
    return parti.length === 2 ? parti : null;
  }

  // excel: da letturaVault.leggiExcelVault; zip: da letturaVault.leggiZipVault.
  // Fase e slot come ID; un pacchetto con fasi che l'Excel non descrive (es. Half-time, Post-match) è una variante:
  // quelle fasi, il pre-match "Not Applicable" con contenuti e l'ultimo slot con un'altra durata sono avvisi, non errori.
  function verificaVault(excel, zip) {
    const esiti = [];
    let celle = 0;
    let cella = null;
    const nota = (tipo, feed, segmento, id, colonna, zona, atteso, trovato) =>
      esiti.push({ tipo, feed, segmento, id, colonna, zona, atteso, trovato, ...(cella ? { cella } : {}) });

    const fogli = new Set(excel.feed.map((f) => k(f.nome)));
    zip.stream.filter((s) => !fogli.has(k(s.nome))).forEach((s) => nota('Error', spazi(s.nome), '-', '-', '-', '-', `Excel sheet for ${spazi(s.nome)}`, 'missing'));
    const stream = new Map(zip.stream.map((s) => [k(s.nome), s]));

    for (const foglio of excel.feed) {
      cella = null;
      const feed = foglio.nome;
      const s = stream.get(k(feed));
      if (!s) { nota('Error', feed, '-', '-', '-', '-', `Vault stream for ${feed}`, 'missing'); continue; }
      const fasiExcel = [...new Set(foglio.righe.map((r) => r.fase))];
      const extra = s.fasi.filter((f) => !fasiExcel.some((x) => k(x) === k(f.nome)));
      const variante = extra.length > 0;
      extra.forEach((f) => nota('Warning', feed, spazi(f.nome), '-', '-', '-', 'phase in the Excel', `${f.intervalli ? f.intervalli.length : 0} slots not checked${VARIANTE}`));

      for (const nomeFase of fasiExcel) {
        cella = null;
        const fase = s.fasi.find((f) => k(f.nome) === k(nomeFase));
        if (!fase) { nota('Error', feed, nomeFase, '-', '-', '-', `Vault playlist for ${nomeFase}`, 'missing'); continue; }
        if (!fase.intervalli) { nota('Error', feed, nomeFase, '-', '-', '-', 'playlist file', 'missing ' + fase.file); continue; }
        const iv = fase.intervalli;
        iv.forEach((x, i) => { if (iv[i + 1] && iv[i + 1].inizio !== x.inizio + x.durata) nota('Error', feed, nomeFase, i + 1, '-', '-', 'contiguous slots', `gap at ${x.inizio + x.durata} ms`); });
        const righe = foglio.righe.filter((r) => r.fase === nomeFase);
        const ultima = righe[righe.length - 1];

        for (const r of righe) {
          cella = null;
          const slot = iv[r.slotFase - 1];
          const id = r.slotFase;
          if (!slot) { nota('Error', feed, nomeFase, id, '-', '-', 'Vault slot', 'missing'); continue; }
          cella = ++celle;
          if (r.durataMs !== slot.durata) {
            const avviso = variante && r === ultima;
            nota(avviso ? 'Warning' : 'Error', feed, nomeFase, id, `${lettera(foglio.colDurata)}${r.riga} · Duration`, '-', r.durataTesto, secondi(slot.durata / 1000) + (avviso ? VARIANTE : ''));
          }
          for (const z of foglio.zone) {
            cella = ++celle;
            const atteso = r.zone.get(z.nome);
            const chiaveZona = [...slot.zone.keys()].find((n) => k(n) === k(z.nome));
            const assets = chiaveZona ? slot.zone.get(chiaveZona) : [];
            const colFile = `${lettera(z.colFile)} · ${z.nome} – File name`;
            if (!atteso.file || k(atteso.file) === 'NOTAPPLICABLE') {
              if (assets.length) nota(variante ? 'Warning' : 'Error', feed, nomeFase, id, colFile, z.nome, 'Not Applicable', assets.map((a) => a.file).join(' + ') + (variante ? VARIANTE : ''));
              continue;
            }
            if (assets.length !== 1) {
              nota('Error', feed, nomeFase, id, colFile, z.nome, atteso.file, assets.length ? `${assets.length} assets: ${assets.map((a) => a.file).join(' + ')}` : 'nothing');
              continue;
            }
            const a = assets[0];
            if (k(senzaEstensione(a.file)) !== k(senzaEstensione(atteso.file))) nota('Error', feed, nomeFase, id, colFile, z.nome, atteso.file, a.file);
            if (k(atteso.partner) !== k(a.partner)) nota('Warning', feed, nomeFase, id, `${lettera(z.colPartner)} · ${z.nome} – Partner`, z.nome, atteso.partner, a.partner);
            if (zip.media.size && !zip.media.has(a.file)) nota('Error', feed, nomeFase, id, '-', z.nome, 'media file', 'missing ' + a.file);
            const v = zip.durateMedia.get(a.file);
            if (v && !staNelloSlot(v.secondi, slot.durata / 1000)) {
              nota('Error', feed, nomeFase, id, '-', z.nome, `video fitting a ${secondi(slot.durata / 1000)} slot`, `${a.file} · ${secondi(v.secondi)}${v.fps ? ` (${v.fps} fps)` : ''}`);
            }
          }
        }

        // slot del pacchetto oltre le righe dell'Excel
        cella = null;
        const ultimoSlot = Math.max(0, ...righe.map((r) => r.slotFase));
        if (iv.length > ultimoSlot) {
          const pieni = iv.slice(ultimoSlot).some((x) => [...x.zone.values()].some((l) => l.length));
          nota(variante || !pieni ? 'Warning' : 'Error', feed, nomeFase, '-', '-', '-', `${righe.length} slots (Excel)`, `${iv.length} slots (Vault)${variante ? VARIANTE : ''}`);
        }
      }
    }

    const partita = excel.partita || spazi(zip.progetto.nome);
    const sq = squadre(partita);
    const conteggi = {};
    esiti.forEach((e) => { conteggi[e.tipo] = (conteggi[e.tipo] || 0) + 1; });
    return {
      celle,
      esiti,
      riepilogo: {
        sistema: 'Vault',
        partita, casa: sq ? sq[0] : '', ospite: sq ? sq[1] : '',
        venue: excel.stadio || zip.progetto.venue, dataEvento: zip.progetto.data, evento: zip.progetto.nome,
        partiteDiverse: Boolean(excel.partita && zip.progetto.nome && k(excel.partita) !== k(zip.progetto.nome)),
        conteggi,
        feed: excel.feed.map((f) => f.nome),
        segmenti: [...new Set(excel.feed.flatMap((f) => f.righe.map((r) => r.fase)))],
      },
    };
  }

  return { NOME: 'confrontoVault', squadre, verificaVault };
});
