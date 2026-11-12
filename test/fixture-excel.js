// Cartelle di lavoro Excel sintetiche con la stessa disposizione del template delle playlist.
const { librerie } = require('./aiuto.js');
const { XLSX } = librerie();

const REGIONI = ['NORTH AMERICA\nVIRTUAL', 'CENTRAL & SOUTH AMERICA\nVIRTUAL', 'EUROPE\nVIRTUAL ', 'MENA+SSA\nVIRTUAL', 'ASIA\nVIRTUAL', 'ASIA FAR EAST\nVIRTUAL', 'VIETNAM\nVIRTUAL'];
const STATICI = ['DOMESTIC', 'NORTH AMERICA', 'CENTRAL & SOUTH AMERICA', 'EUROPE', 'MENA+SSA', 'ASIA', 'FAR EAST', 'VIETNAM'];

// righe: [id, secondi, …valori virtual (regione per regione, fila per fila)]; con led=true c'è anche il LED onsite (colonne D/E).
function foglioPlaylist({ titolo = 'ALFA - BETA', intestazioni = REGIONI, file = 2, righe = [], led = true, primoId }) {
  const aoa = [['CONTATTO OPERATORE LED'], [], [titolo]];
  const testa = ['ID', 'MINUTO DI GARA', 'Durata animazione'];
  const sotto = ['', '', ''];
  if (led) {
    testa.push('LED ONSITE (rettilineo + retroporta)'); sotto.push('PRIMA FILA');
    if (file === 2) { testa.push(''); sotto.push('SECONDA FILA'); }
  }
  intestazioni.forEach((h) => {
    testa.push(h); sotto.push('PRIMA FILA');
    if (file === 2) { testa.push(''); sotto.push('SECONDA FILA'); }
  });
  aoa.push(testa, sotto);
  righe.forEach(([id, secondi, ...valori], i) => {
    const r = [primoId !== undefined ? primoId + i : id, (i * 15) / 86400, secondi / 86400];
    if (led) { r.push('LED'); if (file === 2) r.push('LED'); }
    aoa.push(r.concat(valori.map((v) => (v === '' ? null : v))));
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let i = 0; i < righe.length; i++) {
    const c = ws[XLSX.utils.encode_cell({ r: 5 + i, c: 2 })];
    if (c) c.z = 'hh:mm:ss';
  }
  return ws;
}

// statici: [[etichetta, valore DOMESTIC, valore NORTH AMERICA, …]]; se manca CENTRE CIRCLE la prima riga è un CENTRE CIRCLE vuoto.
function foglioStatici(statici = []) {
  const righe = statici.some((s) => s[0] === 'CENTRE CIRCLE') ? statici : [['CENTRE CIRCLE']].concat(statici);
  return XLSX.utils.aoa_to_sheet([['STATIC ASSETS'], ['ASSET'].concat(STATICI)].concat(righe, [[], ['FIELD LEGEND']]));
}

function cartella({ fogli = ['PLAYLIST'], nomeHL = 'HL PLAYLIST', righeHL = [], statici = [], ...resto } = {}) {
  const wb = XLSX.utils.book_new();
  fogli.forEach((f) => XLSX.utils.book_append_sheet(wb, foglioPlaylist({ ...resto, titolo: resto.titolo || 'ALFA - BETA ' + f }), f));
  XLSX.utils.book_append_sheet(wb, foglioStatici(statici), 'STATIC ASSETS');
  XLSX.utils.book_append_sheet(wb, foglioPlaylist({ ...resto, righe: righeHL, led: false, primoId: undefined, titolo: 'MATCH' }), nomeHL);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

// Playlist a foglio unico: primo e secondo tempo affiancati, una sola colonna VIRTUAL FEED, nessuna regione.
// righe1 / righe2: [id, secondi, brand]; nota: testo della cella N14 (es. 'CB: ALFA'); testaVirtual: intestazione della colonna dei brand.
// testate: colonne dopo la durata (default on-site LED + testaVirtual); con testate ogni riga è [id, secondi, valore di ogni testata].
// codaTesta: celle in più nella riga d'intestazione, a destra del secondo tempo (es. una tabella pivot).
function cartellaDueTempi({ titolo = 'ALFA vs BETA', righe1 = [], righe2 = [], nota = null, altriFogli = [], testaVirtual = 'VIRTUAL FEED', nomeFoglio = 'Match Running Order', statici = null,
  testate = null, codaTesta = [] } = {}) {
  const cols = testate || ['on-site\nLED', testaVirtual];
  const testa2 = testate || ['on-site\nLED', testaVirtual + ' '];
  const aoa = [[null, titolo], ['SEASON', '2026-27'], ['COMPETITION', 'GROUP PHASE'], ['MATCH DAY', 'GROUP PHASE'], ['DATE', 46340], ['KO CET', 0.86], [],
    ['HOW TO FILL IN THE RUNNING ORDER:'], ['Please note'], [],
    ['FIRST HALF'].concat(Array(cols.length + 4).fill(null), ['SECOND HALF']),
    ['ID', 'MATCH TIME', 'Artwork duration', ...cols, null, null, 'ID', 'MATCH TIME', 'Artwork duration', ...testa2, null, ...codaTesta],
    []];
  const n = Math.max(righe1.length, righe2.length);
  const valori = (r) => (testate ? cols.map((_, j) => (r[2 + j] === undefined ? null : r[2 + j])) : [null, r[2] === undefined ? null : r[2]]);
  const blocco = (r) => (r ? [r[0], 0, r[1] / 86400, ...valori(r), null, null] : Array(cols.length + 5).fill(null));
  for (let i = 0; i < n; i++) aoa.push(blocco(righe1[i]).concat(blocco(righe2[i]).slice(0, cols.length + 3), i === 0 && nota ? [null, nota] : []));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nomeFoglio);
  altriFogli.forEach((f) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['APPUNTI']]), f));
  // statici: righe [etichetta, primo tempo, secondo tempo] del foglio STATIC ASSETS (titolo in A1, intestazione in riga 2, valori in C e D)
  if (statici) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['STATIC ASSETS'], ['ASSET', null, 'FIRST HALF', 'SECOND HALF']].concat(statici.map(([e, a, b]) => [e, null, a, b]))), 'STATIC ASSETS');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

module.exports = { cartella, cartellaDueTempi, REGIONI };
