// Pacchetti e playlist Excel del Vault, sintetici, con la stessa struttura di quelli veri (nomi di fantasia).
const { librerie } = require('./aiuto.js');
const { XLSX } = librerie();

const ZONE = ['Left', 'Center', 'Right'];

// slot: [{ durata (ms), zone: { Left: [file, partner] | null, … } }] → JSON della playlist di una fase
function playlistJson(nome, slot) {
  const publishers = new Map(); // nome partner → id
  const assets = new Map(); // file → asset
  const intervals = [];
  let start = 0;
  slot.forEach((s) => {
    const impressions = ZONE.map((z, i) => {
      const v = s.zone && s.zone[z];
      if (!v) return { zone_ids: [i], asset_ids: [] };
      const [file, partner = 'Partner'] = v;
      if (!publishers.has(partner)) publishers.set(partner, publishers.size + 1);
      if (!assets.has(file)) assets.set(file, { id: 1000 + assets.size, publisher_id: publishers.get(partner), name: 'SO_' + file.split('_')[1], file });
      return { zone_ids: [i], asset_ids: [assets.get(file).id] };
    });
    intervals.push({ name: null, start, duration: s.durata, impressions });
    start += s.durata;
  });
  return { playlist: { id: 1, stream_id: 1, name: nome, stepping: 'auto' }, publishers: [...publishers].map(([name, id]) => ({ id, name })), assets: [...assets.values()], intervals };
}

// fasi: { 'Pre-match': slot, '1st_Half': slot, … } per ciascun feed; assets: [nome | [nome, byte]] in assets/
async function zipVault(JSZip, { nome = 'Alfa_v_Beta', data = '21-10-2026', venue = 'Stadio_Prova', feed = { Dark_Market: {} }, assets = [], senzaFile = [] } = {}) {
  const z = new JSZip();
  const streams = Object.entries(feed).map(([nomeFeed, fasi], i) => {
    const playlists = Object.keys(fasi).map((f) => `${nomeFeed.toLowerCase()}_${f.toLowerCase()}.json`);
    Object.entries(fasi).forEach(([f, slot], j) => { if (!senzaFile.includes(f)) z.file(`playlists/${playlists[j]}`, JSON.stringify(playlistJson(f, slot))); });
    return { id: 100 + i, name: nomeFeed, playlists };
  });
  z.file('project.json', JSON.stringify({
    project: { id: 1, name: nome, description: 'VBR', date: data }, venue: { id: 1, name: venue, location: 'Città' },
    zones: ZONE.map((name, id) => ({ id, specification: 'VBR_-_Alfa', name })), streams,
  }));
  assets.forEach((a) => (Array.isArray(a) ? z.file(`assets/${a[0]}`, a[1]) : z.file(`assets/${a}`, new Uint8Array([1, 2, 3]))));
  return z.generateAsync({ type: 'arraybuffer' });
}

// feed: { 'Dark Market': righe }, righe: [[fase, slotFase, 'hh:mm:ss', [file, partner] | 'NA' per Left, Center, Right]]
function excelVault({ partita = 'Alfa v Beta', stadio = 'Stadio Prova', feed = { 'Dark Market': [] } } = {}) {
  const wb = XLSX.utils.book_new();
  Object.entries(feed).forEach(([nome, righe]) => {
    const aoa = [['MatchDay:', null, 'MD3'], ['Match:', null, partita], ['Stadium:', null, stadio], ['Feed:', null, nome], [],
      ['Slot', 'Clock', 'Time Phase', 'Time Phase Slot', 'Duration', 'Left', null, 'Center', null, 'Right'],
      [null, null, null, null, null, 'File Name', 'Partner/Shared', 'File Name', 'Partner/Shared', 'File Name', 'Partner/Shared']];
    righe.forEach(([fase, n, durata, ...zone], i) => aoa.push([i + 1, '00:00', fase, n, durata,
      ...zone.flatMap((v) => (v === 'NA' ? ['Not Applicable', 'NA'] : v))]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nome);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['MatchDay:', 'MD3'], ['Match:', partita]]), 'Campaign Files');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Feed', 'Comment']]), 'Comments');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

module.exports = { ZONE, playlistJson, zipVault, excelVault };
