/* Playlist Check — lettura del pacchetto (zip) e della playlist Excel generati dal Vault. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  // in Node il file app/<nome>.js, nel browser PC.<nomeInCamelCase> (es. 'lettura-excel' → PC.letturaExcel)
  const dip = (nome) => (typeof module === 'object' && module.exports ? require('./' + nome + '.js')
    : radice.PC[nome.replace(/-(\w)/g, (_, c) => c.toUpperCase())]);
  const { k } = dip('nomi');

  const spazi = (t) => String(t == null ? '' : t).replace(/_/g, ' ').trim();
  const VIDEO = /\.(mp4|mov|m4v)$/i;

  // Pacchetto del Vault: project.json + playlists/<feed>_<fase>.json + assets/. null se lo zip non è del Vault.
  async function leggiZipVault(dati, JSZip) {
    let zip;
    try {
      zip = await JSZip.loadAsync(dati);
    } catch (e) {
      throw new Error('This file could not be read as a zip archive.');
    }
    const nomi = Object.keys(zip.files);
    const percorso = nomi.find((n) => /(^|\/)project\.json$/.test(n) && !zip.files[n].dir);
    if (!percorso) return null;
    const radiceZip = percorso.slice(0, percorso.length - 'project.json'.length);
    let p;
    try {
      p = JSON.parse(await zip.files[percorso].async('string'));
    } catch (e) {
      throw new Error('This Vault package has an unreadable project.json.');
    }
    const zone = new Map((p.zones || []).map((z) => [z.id, String(z.name)]));
    const m = /^(\d\d)-(\d\d)-(\d{4})$/.exec(String(p.project && p.project.date || ''));
    const progetto = {
      nome: String(p.project && p.project.name || ''), data: m ? `${m[3]}-${m[2]}-${m[1]}` : String(p.project && p.project.date || ''),
      venue: spazi(p.venue && p.venue.name), luogo: String(p.venue && p.venue.location || ''),
    };
    const stream = [];
    for (const s of p.streams || []) {
      const fasi = [];
      for (const file of s.playlists || []) {
        const voce = zip.files[radiceZip + 'playlists/' + file];
        if (!voce || voce.dir) { fasi.push({ nome: file.replace(/\.json$/i, '').split('_').slice(1).join('_') || file, file, intervalli: null }); continue; }
        const pl = JSON.parse(await voce.async('string'));
        const partner = new Map((pl.publishers || []).map((x) => [x.id, String(x.name)]));
        const asset = new Map((pl.assets || []).map((a) => [a.id, { file: String(a.file), nome: String(a.name), partner: partner.get(a.publisher_id) || '' }]));
        const intervalli = (pl.intervals || []).map((iv) => {
          const perZona = new Map([...zone.values()].map((n) => [n, []]));
          (iv.impressions || []).forEach((im) => (im.zone_ids || []).forEach((z) => {
            const n = zone.get(z);
            if (!perZona.has(n)) perZona.set(n, []);
            (im.asset_ids || []).forEach((id) => perZona.get(n).push(asset.get(id) || { file: `asset ${id}`, nome: '', partner: '' }));
          }));
          return { inizio: iv.start, durata: iv.duration, zone: perZona };
        });
        fasi.push({ nome: String(pl.playlist && pl.playlist.name || file), file, intervalli });
      }
      stream.push({ nome: String(s.name), fasi });
    }
    const media = new Set(nomi.filter((n) => n.startsWith(radiceZip + 'assets/') && !zip.files[n].dir).map((n) => n.slice((radiceZip + 'assets/').length)));
    // durata e fotogrammi al secondo dei video usati (le immagini e i video non usati non si leggono)
    const usati = new Set();
    stream.forEach((s) => s.fasi.forEach((f) => (f.intervalli || []).forEach((iv) => iv.zone.forEach((lista) => lista.forEach((a) => usati.add(a.file))))));
    const durateMedia = new Map();
    for (const nome of usati) {
      const voce = zip.files[radiceZip + 'assets/' + nome];
      if (!VIDEO.test(nome) || !voce || voce.dir) continue;
      const info = dip('video').infoVideo(await voce.async('uint8array'));
      if (info) durateMedia.set(nome, info);
    }
    return { sistema: 'Vault', progetto, zone, stream, media, durateMedia };
  }

  // Playlist Excel del Vault: un foglio per feed con l'intestazione "Slot | Clock | Time Phase | Time Phase Slot | Duration | <zone>…"
  // e sotto ogni zona le colonne File Name e Partner/Shared. null se nessun foglio ha questa intestazione (Excel dell'Hub).
  function leggiExcelVault(dati, XLSX) {
    const b = new Uint8Array(dati);
    if (b.length < 4 || b[0] !== 0x50 || b[1] !== 0x4b) throw new Error('This file could not be read as an Excel workbook.');
    let wb;
    try {
      wb = XLSX.read(b, { type: 'array' });
    } catch (e) {
      throw new Error('This file could not be read as an Excel workbook.');
    }
    const { durata } = dip('lettura-excel');
    const out = { sistema: 'Vault', partita: '', stadio: '', matchday: '', feed: [] };
    for (const nome of wb.SheetNames) {
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null });
      const testa = aoa.slice(0, 20).findIndex((r) => r && k(r[0]) === 'SLOT' && r.some((x) => k(x) === 'TIMEPHASE'));
      if (testa < 0) continue;
      const h = aoa[testa];
      const col = (nomeCol) => h.findIndex((x) => k(x) === nomeCol);
      const colFase = col('TIMEPHASE');
      const colSlotFase = col('TIMEPHASESLOT');
      const colDurata = col('DURATION');
      const sotto = aoa[testa + 1] || [];
      const zone = [];
      h.forEach((x, c) => {
        if (c <= colDurata || x == null || String(x).trim() === '') return;
        const partner = sotto.findIndex((y, j) => j > c && /PARTNER/.test(k(y)));
        zone.push({ nome: String(x).trim(), colFile: c, colPartner: partner > c ? partner : c + 1 });
      });
      const righe = [];
      for (let r = testa + 2; r < aoa.length; r++) {
        const riga = aoa[r];
        if (!riga || riga[colFase] == null || String(riga[colFase]).trim() === '') continue;
        const valori = new Map(zone.map((z) => [z.nome, { file: String(riga[z.colFile] == null ? '' : riga[z.colFile]).trim(), partner: String(riga[z.colPartner] == null ? '' : riga[z.colPartner]).trim() }]));
        righe.push({ riga: r + 1, slot: riga[0], fase: String(riga[colFase]).trim(), slotFase: Number(riga[colSlotFase]), ...durata(riga[colDurata]), zone: valori });
      }
      // intestazione del foglio: "Match:", "Stadium:", "MatchDay:" con il valore nella prima cella piena a destra
      for (const r of aoa.slice(0, testa)) {
        if (!r) continue;
        const valore = r.slice(1).find((x) => x != null && String(x).trim() !== '');
        if (valore == null) continue;
        if (k(r[0]) === 'MATCH' && !out.partita) out.partita = String(valore).trim();
        if (k(r[0]) === 'STADIUM' && !out.stadio) out.stadio = String(valore).trim();
        if (k(r[0]) === 'MATCHDAY' && !out.matchday) out.matchday = String(valore).trim();
      }
      out.feed.push({ nome, colDurata, zone, righe });
    }
    return out.feed.length ? out : null;
  }

  return { NOME: 'letturaVault', leggiZipVault, leggiExcelVault };
});
