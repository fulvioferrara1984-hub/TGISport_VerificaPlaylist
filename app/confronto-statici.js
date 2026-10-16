/* Playlist Check — controllo degli asset statici: centro campo, CLUB MAT, zone a regola fissa, ADDITIONAL, LOWER CORNER. */
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
  const { ruoloZona, MAT_ZONA } = dip('zone');
  const { NOME_REG, confronta } = dip('confronto-virtual');

  const VOCI = ['CC', 'MAT1', 'MAT2', 'MAT3', 'MAT4', 'ADD', 'LC'];

  // Valori di STATIC ASSETS attesi per uno stream: le regioni che copre devono avere gli stessi valori.
  function attesiStatici(statici, regioni, nota, feed) {
    const ordinate = [...regioni].sort();
    const out = {};
    for (const voce of VOCI) {
      const valori = [...new Set(ordinate.map((r) => k((statici.get(`${voce}|${r}`) || {}).valore)))];
      if (valori.length > 1) {
        nota({ tipo: 'Error', feed, segmento: 'Excel', id: '-', colonna: voce, zona: '-',
          atteso: 'same value for ' + ordinate.map((r) => NOME_REG[r]).join(', '), trovato: valori.sort().join('/') });
      }
      out[voce] = statici.get(`${voce}|${ordinate[0]}`) || { valore: null, cella: '', etichetta: voce };
    }
    return out;
  }

  // tipo: 'PRE' | 'MATCH' | 'MATCH1' | 'MATCH2' | 'HL'; sponsor: { etichetta, DOM, FE, altri } (zone a regola fissa, dalle regole cifrate).
  function controllaStatici(c, stream, segmento, tipo, attesi, sponsor) {
    const regioni = stream.regioni;
    const solo = (r) => regioni.size === 1 && regioni.has(r);
    const sponsorAtteso = solo('DOM') ? sponsor.DOM : solo('FE') ? sponsor.FE : sponsor.altri;
    const partita = tipo.startsWith('MATCH');
    const nota = (tipoEsito, id, colonna, zona, atteso, trovato) => c.nota({ tipo: tipoEsito, feed: stream.nome, segmento: segmento.nome, id, colonna, zona, atteso, trovato });
    const etichetta = (voce) => `STATIC ${voce.cella} · ${voce.etichetta}`;
    const sconosciute = new Set(); // zone CLUB che non sono CLUB_LSX/USX/UDX/LDX: un solo avviso per segmento
    segmento.intervalli.forEach((iv, i) => {
      const perZona = new Map();
      iv.mappe.forEach((a, z) => perZona.set(c.zone.get(z), a));
      const leadIn = partita && i === 0;
      const id = partita ? i : i + 1;
      for (const zn of c.zone.values()) {
        const ruolo = ruoloZona(zn, c.angoliStatici, c.prefissoSponsor);
        const a = perZona.get(zn);
        if (ruolo === 'CC') {
          c.cella = ++c.celle.n;
          const voce = attesi.CC;
          const atteso = tipo === 'PRE' && i === 1 ? voce.valore : null;
          if (!a || a.ad === 'Circle_Empty') {
            if (atteso) nota('Error', id, etichetta(voce), zn, String(atteso), 'Circle_Empty');
          } else {
            const es = confronta(c, atteso, a);
            if (es === 'variante') nota('Variant', id, etichetta(voce), zn, String(atteso), a.ad);
            else if (es !== 'ok') nota(es === 'errore' ? 'Error' : 'Possible typo', id, etichetta(voce), zn, String(atteso || 'Circle_Empty'), a.ad);
          }
        } else if (['SPONSOR', 'CLUB', 'ADD', 'LC'].includes(ruolo)) {
          c.cella = ++c.celle.n;
          let atteso; let col;
          if (tipo === 'PRE' || leadIn) { atteso = null; col = '-'; }
          else if (ruolo === 'SPONSOR') { atteso = sponsorAtteso; col = `Rule · ${sponsor.etichetta}`; }
          else if (ruolo === 'ADD' && zn.toUpperCase().startsWith('ADD_') && solo('DOM')) { atteso = null; col = 'Rule · Domestic ADD zones'; }
          else if (ruolo === 'CLUB' && !MAT_ZONA[zn.toUpperCase()]) {
            if (!sconosciute.has(zn)) { sconosciute.add(zn); nota('Warning', '-', '-', zn, 'known CLUB zone', 'unknown zone'); }
            continue;
          } else {
            const voce = ruolo === 'CLUB' ? attesi[MAT_ZONA[zn.toUpperCase()]] : attesi[ruolo];
            atteso = voce.valore; col = etichetta(voce);
          }
          const trovato = !a || a.ad === 'Blank_Generic' ? null : a;
          if (!trovato) {
            if (atteso) nota('Error', id, col, zn, String(atteso), 'nothing');
          } else {
            const es = confronta(c, atteso, trovato);
            if (es === 'errore') nota('Error', id, col, zn, String(atteso || 'nothing'), trovato.ad);
            else if (es === 'refuso') nota('Possible typo', id, col, zn, String(atteso), trovato.ad);
            else if (es === 'variante') nota('Variant', id, col, zn, String(atteso), trovato.ad);
          }
        } else if ((tipo === 'PRE' || leadIn) && ruolo.startsWith('LED')) {
          c.cella = ++c.celle.n;
          if (a && a.ad !== 'Blank_Generic') nota('Error', id, '-', zn, 'Blank', a.ad);
        }
      }
    });
  }

  return { NOME: 'confrontoStatici', attesiStatici, controllaStatici };
});
