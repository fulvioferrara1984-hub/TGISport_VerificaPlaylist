// Modelli sintetici di AIR package ed Excel, già letti (stessa forma prodotta da lettura-air.js e lettura-excel.js).

const art = (ad, advertiser = null, file) => ({ ad, advertiser, file: file || `../advertisements/1000_${ad.toLowerCase()}.mp4` });
const BLANK = art('Blank_Generic', 'Blank_Generic', '../advertisements/1503_blank_generic.png');
const CIRCLE = art('Circle_Empty', 'Circle_Empty', '../advertisements/1356_circle_empty.png');

// slot: [{ durata?, mappe: { idZona: artwork } }] → Segmento con intervalli contigui
function segmento(nome, slot, file = 'sequences/prova.hdm') {
  let inizio = 0;
  const intervalli = slot.map((s) => {
    const iv = { inizio, durata: s.durata || 15000, mappe: new Map(Object.entries(s.mappe || {}).map(([z, a]) => [Number(z), a])) };
    inizio += iv.durata;
    return iv;
  });
  return { nome, file, intervalli };
}

// righe: [{ id, valori: { 'NA|1': 'ALFA' }, durataMs?, durataTesto? }]; la prima riga Excel è la 6, come nel template
function tabella({ foglio = 'PLAYLIST', colonne = { 'NA|1': 5, 'NA|2': 6 }, righe = [] }) {
  const mappaColonne = new Map(Object.entries(colonne));
  return {
    foglio,
    colonne: mappaColonne,
    soloPrimaFila: ![...mappaColonne.keys()].some((c) => c.endsWith('|2')),
    righe: righe.map((r, i) => ({
      id: r.id !== undefined ? r.id : i + 1,
      riga: 6 + i,
      durataMs: r.durataMs !== undefined ? r.durataMs : 15000,
      durataTesto: r.durataTesto || '00:00:15',
      valori: new Map([...mappaColonne.keys()].map((c) => [c, r.valori && r.valori[c] ? r.valori[c] : null])),
    })),
  };
}

// zone: nomi in ordine di id
function contesto({ zone = ['FULL PERIMETER', 'GL_SX_2', 'CC'], angoliStatici = false, alias = {}, casa = ['CASA'], prefissoSponsor = 'SPZ_' } = {}) {
  const esiti = [];
  return {
    zone: new Map(zone.map((z, i) => [i, z])),
    angoliStatici,
    prefissoSponsor,
    ctxNomi: { alias, casa: new Set(casa) },
    nota: (e) => esiti.push(e),
    giusti: new Set(),
    celle: { n: 0 },
    esiti,
  };
}

const stream = (nome, regioni, segmenti = []) => ({ nome, regioni: new Set(regioni), segmenti });

// solo i campi che i test confrontano
const breve = (esiti) => esiti.map(({ tipo, id, colonna, zona, atteso, trovato }) => ({ tipo, id, colonna, zona, atteso, trovato }));

module.exports = { art, BLANK, CIRCLE, segmento, tabella, contesto, stream, breve };
