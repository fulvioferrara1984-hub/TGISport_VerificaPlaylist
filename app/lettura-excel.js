/* Playlist Check — lettura della playlist Excel: fogli PLAYLIST / 1ST HALF / 2ND HALF, STATIC ASSETS e highlights,
   oppure un solo foglio con primo e secondo tempo affiancati e una sola colonna di brand (feed unico). */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  // in Node il file app/<nome>.js, nel browser PC.<nomeInCamelCase> (es. 'confronto-virtual' → PC.confrontoVirtual)
  const dip = (nome) => (typeof module === 'object' && module.exports ? require('./' + nome + '.js')
    : radice.PC[nome.replace(/-(\w)/g, (_, c) => c.toUpperCase())]);
  const { k, vuoto } = dip('nomi');

  const REGIONE_UNICA = 'UNICO'; // playlist a feed unico: la colonna dei brand non è di una regione e vale per ogni feed del pacchetto

  // Intestazioni delle regioni (si ignorano "VIRTUAL", maiuscole, spazi e punteggiatura) → sigla.
  const REG = {
    NORTHAMERICA: 'NA', NORDAMERICA: 'NA', CENTRALSOUTHAMERICA: 'CSA', CENTROSUDAMERICA: 'CSA', EUROPE: 'EU', EUROPA: 'EU',
    MENASSA: 'MENA', MENA: 'MENA', ASIA: 'ASIA', ASIAFAREAST: 'FE', FAREAST: 'FE', VIETNAM: 'VN', DOMESTIC: 'DOM',
  };

  function regione(intestazione) {
    return REG[k(String(intestazione).replace(/VIRTUAL/gi, ''))] || null;
  }

  function tipoFoglio(nome) {
    const t = k(nome);
    if (t === 'PLAYLIST') return 'MATCH';
    if (t.includes('HALF') && t.startsWith('1')) return 'MATCH1';
    if (t.includes('HALF') && t.startsWith('2')) return 'MATCH2';
    return null;
  }

  // Tempo scritto nel titolo del foglio (cella A3): "… 1ST HALF" → MATCH1, "… 2ND HALF" → MATCH2; null se non lo dice.
  function tempoDalTitolo(titolo) {
    const t = k(titolo);
    if (/(1ST|FIRST)HALF/.test(t)) return 'MATCH1';
    if (/(2ND|SECOND)HALF/.test(t)) return 'MATCH2';
    return null;
  }

  const due = (n) => String(n).padStart(2, '0');

  // Durata della colonna C: valore Excel (frazione di giorno) o testo hh:mm:ss / mm:ss → ms, e testo hh:mm:ss (senza i giorni).
  function durata(v) {
    if (typeof v === 'number') {
      const ms = Math.round(v * 86400000);
      const s = Math.round(ms / 1000) % 86400;
      return { durataMs: ms, durataTesto: `${due(Math.floor(s / 3600))}:${due(Math.floor(s / 60) % 60)}:${due(s % 60)}` };
    }
    const m = /^(\d+):(\d\d):(\d\d)$/.exec(String(v == null ? '' : v).trim());
    if (m) return { durataMs: (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000, durataTesto: `${due(m[1])}:${m[2]}:${m[3]}` };
    // testo minuti:secondi ("00:15", come la colonna MINUTO GARA accanto)
    const ms = /^(\d+):(\d\d)$/.exec(String(v == null ? '' : v).trim());
    if (ms) {
      const s = Number(ms[1]) * 60 + Number(ms[2]);
      return { durataMs: s * 1000, durataTesto: `${due(Math.floor(s / 3600))}:${due(Math.floor(s / 60) % 60)}:${due(s % 60)}` };
    }
    return { durataMs: null, durataTesto: v == null ? '' : String(v) };
  }

  function lettore(ws, XLSX) {
    const area = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { e: { r: -1, c: -1 } };
    // r e c sono 0-based; null per le celle vuote
    const valore = (r, c) => {
      const cella = ws[XLSX.utils.encode_cell({ r, c })];
      return cella && cella.v !== undefined && cella.v !== '' ? cella.v : null;
    };
    return { valore, righe: area.e.r + 1, colonne: area.e.c + 1 };
  }

  // Riga (0-based) dell'intestazione "ID" nelle prime 14 righe della colonna A; -1 se non c'è.
  function rigaID(valore) {
    for (let r = 0; r < 14; r++) if (k(valore(r, 0)) === 'ID') return r;
    return -1;
  }

  // avvisi: elenco in cui annotare le righe con un ID non numerico ({ foglio, riga, id }).
  function tabella(nome, ws, XLSX, avvisi = []) {
    const { valore, righe: nRighe, colonne: nColonne } = lettore(ws, XLSX);
    const testa = rigaID(valore);
    if (testa < 0) throw new Error(`The sheet "${nome}" has no ID column header.`);
    const colonne = new Map();
    let ultima = null;
    for (let c = 3; c < nColonne; c++) {
      const h = valore(testa, c);
      if (h !== null) ultima = String(h).toUpperCase().startsWith('LED') ? 'LED' : regione(h);
      const sotto = k(valore(testa + 1, c));
      if (ultima && ultima !== 'LED' && (sotto === 'PRIMAFILA' || sotto === 'SECONDAFILA')) colonne.set(`${ultima}|${sotto === 'PRIMAFILA' ? 1 : 2}`, c);
    }
    const righe = leggiRighe({ nome, valore, da: testa + 2, a: nRighe, colonne, avvisi });
    const soloPrimaFila = ![...colonne.keys()].some((c) => c.endsWith('|2'));
    return { foglio: nome, colonne, soloPrimaFila, righe };
  }

  // Colonna ID ("letteraId": cella da citare negli avvisi se non è la A) e colonna della durata; colonne: Map(chiave → colonna dei brand).
  function leggiRighe({ nome, valore, da, a, colonne, avvisi, colId = 0, colDurata = 2, letteraId = null }) {
    const righe = [];
    for (let r = da; r < a; r++) {
      const grezzo = valore(r, colId);
      if (grezzo === null) continue;
      const testo = String(grezzo).trim();
      const valori = new Map();
      colonne.forEach((c, chiave) => valori.set(chiave, vuoto(valore(r, c))));
      let id;
      if (typeof grezzo === 'number' || /^\d+$/.test(testo)) id = Math.trunc(Number(grezzo));
      else {
        // testo nella colonna ID: è una riga della playlist (resta al suo posto, con un avviso) se ha una durata o dei valori;
        // altrimenti è una nota e si salta
        if (valore(r, colDurata) === null && ![...valori.values()].some(Boolean)) continue;
        id = testo;
        avvisi.push(letteraId ? { foglio: nome, riga: r + 1, id, colonnaId: letteraId } : { foglio: nome, riga: r + 1, id });
      }
      righe.push({ id, riga: r + 1, ...durata(valore(r, colDurata)), valori });
    }
    return righe;
  }

  // Due colonne ID nella stessa riga, sotto "FIRST HALF" e "SECOND HALF": { testa, blocchi: [{ tempo, c }] }; null se non è questo tipo di foglio.
  function blocchiAffiancati(valore, nColonne) {
    for (let r = 1; r < 24; r++) {
      const blocchi = [];
      for (let c = 0; c < nColonne; c++) {
        const tempo = k(valore(r, c)) === 'ID' ? tempoDalTitolo(valore(r - 1, c)) : null;
        if (tempo) blocchi.push({ tempo, c });
      }
      if (blocchi.some((b) => b.tempo === 'MATCH1') && blocchi.some((b) => b.tempo === 'MATCH2')) return { testa: r, blocchi };
    }
    return null;
  }

  // Un tempo del foglio affiancato: le sue colonne stanno tra la sua colonna ID e quella del tempo dopo.
  function tabellaDiUnTempo(nome, foglio, XLSX, testa, inizio, fine, avvisi) {
    const cerca = (prova) => {
      for (let c = inizio + 1; c < fine; c++) if (prova(k(foglio.valore(testa, c)))) return c;
      return -1;
    };
    const colDurata = cerca((h) => h.includes('DURATION'));
    const colBrand = cerca((h) => h.startsWith('VIRTUALFEED'));
    if (colDurata < 0) throw new Error(`The sheet "${nome}" has no artwork duration column.`);
    if (colBrand < 0) throw new Error(`The sheet "${nome}" has no VIRTUAL FEED column.`);
    const letteraId = XLSX.utils.encode_col(inizio);
    const colonne = new Map([[`${REGIONE_UNICA}|1`, colBrand]]);
    const righe = leggiRighe({ nome, valore: foglio.valore, da: testa + 1, a: foglio.righe, colonne, avvisi, colId: inizio, colDurata, letteraId: inizio ? letteraId : null });
    // cicloRecovery: dopo l'ultima riga compilata il pacchetto ripete in alternanza le ultime due
    return { foglio: nome, colonne, soloPrimaFila: true, colonnaId: letteraId, colonnaDurata: XLSX.utils.encode_col(colDurata), cicloRecovery: 2, righe };
  }

  // Cella "CB: <brand>" in qualunque punto del foglio: il brand del centreboard per tutta la partita.
  function notaCentreboard(foglio, XLSX) {
    for (let r = 0; r < foglio.righe; r++) {
      for (let c = 0; c < foglio.colonne; c++) {
        const v = foglio.valore(r, c);
        const m = typeof v === 'string' ? /^\s*CB\s*:\s*(.+?)\s*$/i.exec(v) : null;
        if (m) return { valore: m[1], cella: XLSX.utils.encode_cell({ r, c }), etichetta: 'CENTREBOARD' };
      }
    }
    return null;
  }

  // Foglio unico con i due tempi affiancati: si guarda solo il primo foglio; niente statici né highlights. null se non è questo tipo di file.
  function leggiDueTempi(wb, XLSX) {
    const nome = wb.SheetNames[0];
    const foglio = lettore(wb.Sheets[nome], XLSX);
    const trovati = blocchiAffiancati(foglio.valore, foglio.colonne);
    if (!trovati) return null;
    const avvisi = [];
    const partite = {};
    trovati.blocchi.forEach(({ tempo, c }, i) => {
      const dopo = trovati.blocchi[i + 1];
      if (!partite[tempo]) partite[tempo] = tabellaDiUnTempo(nome, foglio, XLSX, trovati.testa, c, dopo ? dopo.c : foglio.colonne, avvisi);
    });
    const titolo = [0, 1, 2].map((c) => foglio.valore(0, c)).find((v) => v !== null);
    const nota = notaCentreboard(foglio, XLSX);
    return { titolo: titolo === undefined ? '' : String(titolo), partite, hl: null, feedUnico: REGIONE_UNICA, avvisi,
      statici: new Map(nota ? [[`CB|${REGIONE_UNICA}`, nota]] : []) };
  }

  function statici(ws, XLSX) {
    const { valore, righe: nRighe, colonne: nColonne } = lettore(ws, XLSX);
    const regioni = new Map();
    for (let c = 1; c < nColonne; c++) {
      const r = regione(valore(1, c) || '');
      if (r) regioni.set(c, r);
    }
    const out = new Map();
    for (let r = 2; r < nRighe; r++) {
      const a = k(valore(r, 0));
      const m = /^(CLUBMAT|MATSCLUB)(\d)/.exec(a);
      const voce = m ? 'MAT' + m[2] : { CENTRECIRCLE: 'CC', ADDITIONAL: 'ADD', LOWERCORNER: 'LC' }[a];
      if (!voce) continue;
      regioni.forEach((reg, c) => {
        const v = valore(r, c);
        out.set(`${voce}|${reg}`, { valore: v === null ? null : String(v), cella: XLSX.utils.encode_col(c) + (r + 1), etichetta: String(valore(r, 0)).trim() });
      });
    }
    return out;
  }

  // dati: ArrayBuffer del file .xlsx / .xlsm
  function leggiExcel(dati, XLSX) {
    const b = new Uint8Array(dati);
    if (b.length < 4 || b[0] !== 0x50 || b[1] !== 0x4b) throw new Error('This file could not be read as an Excel workbook.');
    let wb;
    try {
      wb = XLSX.read(b, { type: 'array' });
    } catch (e) {
      throw new Error('This file could not be read as an Excel workbook.');
    }
    const dueTempi = leggiDueTempi(wb, XLSX);
    if (dueTempi) return dueTempi;
    const partite = {};
    for (const n of wb.SheetNames) {
      let t = tipoFoglio(n);
      // un foglio PLAYLIST, o con un nome che non dice niente (es. "G"), con la colonna ID e il tempo nel titolo è quel tempo
      const altro = !t && !k(n).includes('STATIC') && !k(n).startsWith('HL') && !k(n).includes('HIGHLIGHT');
      if (t === 'MATCH' || altro) {
        const { valore } = lettore(wb.Sheets[n], XLSX);
        const tempo = rigaID(valore) >= 0 ? tempoDalTitolo(valore(2, 0)) : null;
        if (tempo) t = tempo;
      }
      if (t && !partite[t]) partite[t] = { nome: n };
    }
    if (!Object.keys(partite).length) throw new Error('This Excel file has no PLAYLIST sheet.');
    const nomeStatici = wb.SheetNames.find((n) => k(n).includes('STATIC'));
    if (!nomeStatici) throw new Error('This Excel file has no STATIC ASSETS sheet.');
    const usati = new Set(Object.values(partite).map((p) => p.nome).concat(nomeStatici));
    // highlights: il foglio che si chiama HL… o …HIGHLIGHT…, altrimenti il primo rimasto con la colonna ID (le note si saltano)
    const rimasti = wb.SheetNames.filter((n) => !usati.has(n));
    const nomeHL = rimasti.find((n) => k(n).startsWith('HL') || k(n).includes('HIGHLIGHT'))
      || rimasti.find((n) => rigaID(lettore(wb.Sheets[n], XLSX).valore) >= 0);
    if (!nomeHL) throw new Error('This Excel file has no highlights sheet.');
    const primo = Object.values(partite)[0].nome;
    const avvisi = [];
    const out = { titolo: '', partite: {}, hl: null, statici: statici(wb.Sheets[nomeStatici], XLSX), avvisi };
    Object.entries(partite).forEach(([t, p]) => { out.partite[t] = tabella(p.nome, wb.Sheets[p.nome], XLSX, avvisi); });
    out.hl = tabella(nomeHL, wb.Sheets[nomeHL], XLSX, avvisi);
    const titolo = lettore(wb.Sheets[primo], XLSX).valore(2, 0);
    out.titolo = titolo === null ? '' : String(titolo);
    return out;
  }

  return { NOME: 'letturaExcel', regione, tipoFoglio, durata, leggiExcel };
});
