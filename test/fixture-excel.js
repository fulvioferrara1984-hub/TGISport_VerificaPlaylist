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

module.exports = { cartella, REGIONI };
