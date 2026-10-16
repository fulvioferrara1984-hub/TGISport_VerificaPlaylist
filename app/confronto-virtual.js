/* Playlist Check — controllo dei virtual (prima e seconda fila) di un segmento di partita o degli highlights. */
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
  const { ruoloZona, filaArtwork } = dip('zone');

  const NOME_REG = {
    NA: 'NORTH AMERICA', CSA: 'CENTRAL & SOUTH AMERICA', EU: 'EUROPE', MENA: 'MENA+SSA', ASIA: 'ASIA', FE: 'FAR EAST', VN: 'VIETNAM', DOM: 'DOMESTIC',
  };

  // Lettera della colonna Excel da un indice 0-based (0 → A, 26 → AA).
  function lettera(c) {
    let s = '';
    for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  }

  // confronta + registrazione delle coppie giuste (servono a riconoscere gli alias probabili)
  function confronta(c, excel, art) {
    const esito = nomi.confronta(excel, art, c.ctxNomi);
    if ((esito === 'ok' || esito === 'variante') && excel && art) {
      c.giusti.add(`${nomi.k(nomi.senzaCodici(excel))}|${nomi.chiaveBrand(art.ad).chiave}`);
    }
    return esito;
  }

  const esito = (tipo, feed, segmento, id, colonna, zona, atteso, trovato) => ({ tipo, feed, segmento, id, colonna, zona, atteso, trovato });
  const secondi = (ms) => `${Number((ms / 1000).toPrecision(6))} s`;

  // tipo: 'MATCH' | 'MATCH1' | 'MATCH2' | 'HL'. La n-esima riga Excel va con lo slot n (lo slot 0 delle partite è il lead-in).
  function controllaVirtual(c, stream, segmento, tipo, tabella) {
    const iv = segmento.intervalli;
    const righe = tabella.righe;
    const regioni = [...stream.regioni];
    const base = tipo === 'HL' ? 0 : 1;
    const nota = (...a) => c.nota(esito(a[0], stream.nome, segmento.nome, ...a.slice(1)));
    const led = (z) => ruoloZona(c.zone.get(z), c.angoliStatici, c.prefissoSponsor).startsWith('LED');
    c.cella = null; // risultati fuori dalle celle (righe senza slot, avvisi): senza numero di cella
    if (righe.length && righe[0].id !== 1) nota('Warning', righe[0].id, `A${righe[0].riga} · ID`, '-', 'IDs start at 1', `starts at ${righe[0].id}`);
    const piena = (r) => regioni.some((g) => r.valori.get(`${g}|1`) || r.valori.get(`${g}|2`));
    const piene = righe.map((r, i) => (piena(r) ? i + 1 : 0)).filter(Boolean);
    const ultima = piene.length ? piene[piene.length - 1] : null;
    const nZip = iv.length - base;
    for (let pos = 1; pos <= Math.max(righe.length, nZip); pos++) {
      c.cella = null;
      const idx = pos - 1 + base;
      const riga = pos <= righe.length ? righe[pos - 1] : null;
      const id = riga ? riga.id : `slot ${pos}`;
      if (idx >= iv.length || !riga) {
        const pienaX = riga && piena(riga);
        const pienoZ = idx < iv.length && [...iv[idx].mappe].some(([z, a]) => a.ad !== 'Blank_Generic' && led(z));
        if (tipo === 'HL' && !riga && !pienoZ) continue; // slot di riserva degli highlights: avviso unico in fondo
        nota(pienaX || pienoZ ? 'Error' : 'Warning', id, '-', '-', riga ? 'AIR slot' : 'Excel row', 'missing');
        continue;
      }
      const { durata, mappe } = iv[idx];
      c.cella = ++c.celle.n;
      if (riga.durataMs !== durata) nota('Error', id, `C${riga.riga} · Duration`, '-', riga.durataTesto, secondi(durata));
      const trovati = { 1: [], 2: [] };
      mappe.forEach((a, z) => {
        if (!led(z)) return;
        const nomeZona = c.zone.get(z);
        if (a.ad !== 'Blank_Generic') trovati[filaArtwork(a, nomeZona, tabella.soloPrimaFila)].push([nomeZona, a]);
        else if (!nomi.k(a.file).includes('BLANK')) nota('Error', id, '-', nomeZona, 'blank file', a.file);
      });
      for (const fila of [1, 2]) {
        const cs = regioni.filter((g) => tabella.colonne.has(`${g}|${fila}`)).sort((x, y) => tabella.colonne.get(`${x}|${fila}`) - tabella.colonne.get(`${y}|${fila}`));
        if (!cs.length) continue;
        c.cella = ++c.celle.n;
        const attesi = [...new Set(cs.map((g) => String(riga.valori.get(`${g}|${fila}`) || '').trim()))];
        if (new Set(attesi.map((x) => nomi.k(nomi.senzaCodici(x)))).size > 1) {
          nota('Error', id, `${tabella.foglio} · ${cs.map((g) => NOME_REG[g]).join('/')}`, '-', 'same value (shared feed)', attesi.sort().join(' | '));
        }
        const r0 = cs[0];
        const etichetta = `${lettera(tabella.colonne.get(`${r0}|${fila}`))} · ${NOME_REG[r0]} – ${fila === 1 ? 'First' : 'Second'} row`;
        const e = riga.valori.get(`${r0}|${fila}`);
        const arts = trovati[fila];
        if (!arts.length) {
          const altri = trovati[3 - fila].filter(([zn]) => ruoloZona(zn, c.angoliStatici, c.prefissoSponsor) === (fila === 1 ? 'LED1' : 'LED2'));
          if (altri.length) {
            const [zn, a] = altri[0];
            nota('Error', id, etichetta, zn, String(e || 'Blank'), `${a.ad} (${fila === 1 ? 'second' : 'first'}-row file)`);
          } else if (e && String(e).trim()) {
            nota('Error', id, etichetta, '-', String(e), 'Blank');
          }
          continue;
        }
        if (!e && ultima && pos > ultima && tipo !== 'HL') {
          const ultimaRiga = righe[ultima - 1];
          const eRec = ultimaRiga.valori.get(`${r0}|${fila}`);
          if (eRec && arts.every(([, a]) => ['ok', 'variante'].includes(confronta(c, eRec, a)))) {
            nota('Recovery', id, etichetta, '-', `repeat of ID ${ultimaRiga.id}`, String(eRec));
            continue;
          }
        }
        for (const [zn, a] of arts) {
          const es = confronta(c, e, a);
          if (es === 'errore') nota('Error', id, etichetta, zn, String(e || 'Blank'), a.ad);
          else if (es === 'refuso') nota('Possible typo', id, etichetta, zn, String(e), a.ad);
          else if (es === 'variante') nota('Variant', id, etichetta, zn, String(e), a.ad);
        }
      }
    }
    c.cella = null;
    if (tipo === 'HL' && iv.length !== righe.length) nota('Warning', '-', '-', '-', `${righe.length} slots (Excel)`, `${iv.length} slots (AIR)`);
  }

  return { NOME: 'confrontoVirtual', NOME_REG, lettera, confronta, controllaVirtual };
});
