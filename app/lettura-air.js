/* Playlist Check — lettura dell'AIR package (zip generato da DBRLive Inventory Manager). */
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

  // Nome dello stream (o parte di "Row (…)") → sigla della regione.
  const STREAM = { NORTHAMERICA: 'NA', LATAM: 'CSA', EUROPA: 'EU', MENA: 'MENA', ASIA: 'ASIA', FAREAST: 'FE', VIETNAM: 'VN', DOMESTICO: 'DOM' };

  function regioniStream(nome) {
    const dentro = /\((.*)\)/.exec(nome);
    const parti = dentro ? dentro[1].split('-') : [nome];
    return new Set(parti.map((p) => STREAM[k(p)]).filter(Boolean));
  }

  function decodificaEntita(testo) {
    return testo.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  // Intervalli di una sequenza: [{ inizio, durata, mappe: Map(zona → { ad, advertiser, file }) }]
  // I file veri hanno gli a capo di Windows (CRLF).
  const aCapo = (testo) => String(testo).replace(/\r\n?/g, '\n');

  function parseSequenza(grezzo) {
    const testo = aCapo(grezzo);
    const inserzionisti = new Map();
    for (const m of testo.matchAll(/^advertiser = (\d+)\s*\{([\s\S]*?)\}/gm)) {
      const n = /name = (.*)/.exec(m[2]);
      if (n) inserzionisti.set(m[1], n[1].trim());
    }
    const ads = new Map();
    for (const m of testo.matchAll(/^ad = (\d+)\s*\{([\s\S]*?)\}/gm)) {
      const nome = /name = (.*)/.exec(m[2]);
      const a = /advertiser = (\d+)/.exec(m[2]);
      const f = /file = (.*)/.exec(m[2]);
      ads.set(m[1], { ad: nome ? nome[1].trim() : '', advertiser: a ? inserzionisti.get(a[1]) || null : null, file: f ? f[1].trim() : '' });
    }
    const intervalli = [];
    for (const m of testo.matchAll(/^interval = (\d+), (\d+), (.*?)\n\{([\s\S]*?)\}/gm)) {
      const mappe = new Map();
      for (const mm of m[4].matchAll(/map = (\d+) to ([\d, ]+)/g)) {
        const art = ads.get(mm[1]);
        if (!art) continue;
        for (const z of mm[2].split(',')) mappe.set(Number(z.trim()), art);
      }
      intervalli.push({ inizio: Number(m[1]), durata: Number(m[2]), mappe });
    }
    return intervalli;
  }

  function parseEvento(grezzo) {
    const testo = aCapo(grezzo);
    const nome = /^\s*name = (.*)$/m.exec(testo);
    const data = /^\s*date = (.*)$/m.exec(testo);
    const venue = /venue\s*\{[\s\S]*?name = (.*?)\n/.exec(testo);
    const zone = new Map();
    for (const m of testo.matchAll(/zone = (\d+)\s*\{\s*#id = \d+\s*name = (.*)/g)) zone.set(Number(m[1]), m[2].trim());
    const stream = [];
    for (const m of testo.matchAll(/stream\s*\{\s*(?:#id = \d+\s*)?name = (.*?)\n[\s\S]*?sequences\s*\{([\s\S]*?)\n {6}\}/g)) {
      const segmenti = [...m[2].matchAll(/name = (.*?)\n\s*file = (.*)/g)].map((s) => ({ nome: s[1].trim(), file: s[2].trim() }));
      stream.push({ nome: m[1].trim(), regioni: regioniStream(m[1]), segmenti });
    }
    return {
      nome: nome ? nome[1].trim() : '', data: data ? data[1].trim() : '', venue: venue ? decodificaEntita(venue[1].trim()) : '', zone, stream,
    };
  }

  // AIR package completo. Si legge il contenuto dei soli .hdm: dei media (mp4, png, mov) serve solo l'elenco dei nomi.
  // Durata in secondi di un video mp4/mov (normale o frammentato); null se non si legge.
  function durataVideo(b) {
    const v = dip('video').infoVideo(b);
    return v ? v.secondi : null;
  }

  async function leggiAir(dati, JSZip) {
    let zip;
    try {
      zip = await JSZip.loadAsync(dati);
    } catch (e) {
      throw new Error('This file could not be read as a zip archive.');
    }
    const nomi = Object.keys(zip.files);
    const percorsoEvento = nomi.find((n) => /(^|\/)event\.hdm$/.test(n) && !zip.files[n].dir);
    if (!percorsoEvento) throw new Error('This is not an AIR package: event.hdm not found.');
    const radiceZip = percorsoEvento.slice(0, percorsoEvento.length - 'event.hdm'.length);
    const evento = parseEvento(await zip.files[percorsoEvento].async('string'));
    const media = new Set(nomi.filter((n) => n.startsWith(radiceZip + 'advertisements/') && !zip.files[n].dir)
      .map((n) => n.slice((radiceZip + 'advertisements/').length)));
    const stream = [];
    for (const s of evento.stream) {
      const segmenti = [];
      for (const seg of s.segmenti) {
        const voce = zip.files[radiceZip + seg.file];
        segmenti.push({ nome: seg.nome, file: seg.file, intervalli: voce && !voce.dir ? parseSequenza(await voce.async('string')) : null });
      }
      stream.push({ nome: s.nome, regioni: s.regioni, segmenti });
    }
    // durata dei video usati nelle sequenze (servono a controllare che stiano nei loro slot); immagini e video non usati non si leggono
    const usati = new Set();
    stream.forEach((s) => s.segmenti.forEach((g) => (g.intervalli || []).forEach((iv) => iv.mappe.forEach((a) => usati.add(String(a.file).split('/').pop())))));
    const durateMedia = new Map();
    for (const nome of usati) {
      const voce = zip.files[radiceZip + 'advertisements/' + nome];
      if (!/\.(mp4|mov|m4v)$/i.test(nome) || !voce || voce.dir) continue;
      const durata = durataVideo(await voce.async('uint8array'));
      if (durata) durateMedia.set(nome, durata);
    }
    return { evento: { nome: evento.nome, data: evento.data, venue: evento.venue }, zone: evento.zone, stream, media, durateMedia };
  }

  return { NOME: 'letturaAir', regioniStream, parseSequenza, parseEvento, durataVideo, leggiAir };
});
