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
  const nomi = dip('nomi');
  const { k } = nomi;
  const { ruoloZona, MAT_ZONA } = dip('zone');
  const { NOME_REG, confronta } = dip('confronto-virtual');

  const VOCI = ['CC', 'MAT1', 'MAT2', 'MAT3', 'MAT4', 'ADD', 'LC', 'CB'];

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
    // tappeti del foglio unico: un brand per tempo, chiave 'MATS_<lato>@<tempo>'
    out.MATS = new Map([...statici].filter(([chiave]) => chiave.startsWith('MATS_') && chiave.endsWith(`|${ordinate[0]}`))
      .map(([chiave, v]) => [chiave.slice(0, chiave.lastIndexOf('|')), v]));
    return out;
  }

  // Lato e numero di un tappeto dal nome della zona (Mats_L1, Mats L1, ALFA_L4 → { lato: 'L', numero: 4 }); null se non ci sono.
  function posizioneTappeto(nome) {
    const m = /[_ ]([A-Z]*)(\d+)$/.exec(String(nome).toUpperCase());
    return m ? { lato: m[1], numero: Number(m[2]) } : null;
  }

  // Tappeti di un lato confrontati per brand, non per numero (l'Excel e il pacchetto possono numerarli da capi opposti).
  // Ogni zona prende la riga libera col suo brand (a parità quella col suo numero), prima le zone il cui nome dice quello stesso
  // brand (ALFA_R4 che mostra ALFA: se un'altra zona mostra ALFA per sbaglio, l'errore va su quella); le zone rimaste prendono
  // le righe rimaste (prima quella col loro numero), così un errore dice un brand atteso preciso.
  // zone: [{ zona, numero, art|null }] in ordine, righe: [{ numero, voce }]; uguale(voce, art).
  // → Map zona → voce, oppure null se per quella zona non resta nessuna riga.
  function abbinaTappeti(zone, righe, uguale) {
    const libere = new Set(righe);
    const out = new Map();
    const perNumero = (n) => [...libere].sort((x, y) => (y.numero === n) - (x.numero === n) || x.numero - y.numero);
    const prendi = (z, r) => { if (r) libere.delete(r); out.set(z.zona, r ? r.voce : null); };
    const diNome = (z, x) => uguale(x.voce, { ad: z.zona, advertiser: null, file: '' });
    zone.forEach((z) => { const r = z.art && perNumero(z.numero).find((x) => uguale(x.voce, z.art) && diNome(z, x)); if (r) prendi(z, r); });
    zone.forEach((z) => { const r = !out.has(z.zona) && z.art && perNumero(z.numero).find((x) => uguale(x.voce, z.art)); if (r) prendi(z, r); });
    zone.forEach((z) => { if (!out.has(z.zona)) prendi(z, perNumero(z.numero)[0]); });
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
    // per il visual check: una zona statica con un artwork e il brand atteso (aggancio facoltativo)
    const vista = (slot, id, colonna, zona, atteso, a) => {
      if (c.vista && atteso && String(atteso).trim()) {
        c.vista({ feed: stream.nome, segmento: segmento.nome, slot, id, gruppo: 'Statics', colonna, atteso: String(atteso).trim(), nota: '',
          zone: [{ zona, file: String(a.file).split('/').pop() }] });
      }
    };
    const sconosciute = new Set(); // zone CLUB che non sono CLUB_LSX/USX/UDX/LDX e tappeti senza riga nell'Excel: un solo avviso per segmento
    const tappeti = attesi.MATS || new Map();
    // righe CLUB MAT di questo tempo e zone tappeto del pacchetto, per lato
    const righeTappeto = [];
    tappeti.forEach((voce, chiave) => {
      const m = /^MATS_([A-Z]*)(\d+)@(.+)$/.exec(chiave);
      if (m && m[3] === tipo) righeTappeto.push({ lato: m[1], numero: Number(m[2]), voce });
    });
    const zoneTappeto = [...c.zone.values()].filter((zn) => ruoloZona(zn, c.angoliStatici, c.prefissoSponsor) === 'MATS')
      .map((zn) => ({ zona: zn, ...(posizioneTappeto(zn) || { lato: null, numero: 0 }) })).sort((x, y) => x.numero - y.numero);
    const uguale = (voce, a) => ['ok', 'variante'].includes(nomi.confronta(voce.valore, a, c.ctxNomi));
    const mostrate = new Set(); // righe CLUB MAT abbinate a una zona in almeno uno slot controllato
    let tappetiControllati = false;
    segmento.intervalli.forEach((iv, i) => {
      const perZona = new Map();
      iv.mappe.forEach((a, z) => perZona.set(c.zone.get(z), a));
      const leadIn = partita && i === 0;
      const id = partita ? i : i + 1;
      // foglio unico: un intervallo senza nessuna zona in onda (l'ultimo di ogni tempo) non ha statici da vedere; i LED dentro le righe
      // dell'Excel restano controllati dalla colonna dei brand
      const vuoto = c.feedUnico && partita && iv.mappe.size === 0;
      const conTappeti = !(tipo === 'PRE' || leadIn || vuoto);
      const abbinati = new Map();
      if (conTappeti) {
        tappetiControllati = true;
        for (const lato of new Set(zoneTappeto.map((z) => z.lato))) {
          const righe = righeTappeto.filter((r) => r.lato === lato);
          if (!righe.length) continue;
          const zone = zoneTappeto.filter((z) => z.lato === lato).map((z) => {
            const a = perZona.get(z.zona);
            return { ...z, art: a && a.ad !== 'Blank_Generic' ? a : null };
          });
          abbinaTappeti(zone, righe, uguale).forEach((voce, zn) => { abbinati.set(zn, voce); if (voce) mostrate.add(voce); });
        }
      }
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
            vista(i, id, etichetta(voce), zn, atteso, a);
            const es = confronta(c, atteso, a);
            if (es === 'variante') nota('Variant', id, etichetta(voce), zn, String(atteso), a.ad);
            else if (es !== 'ok') nota(es === 'errore' ? 'Error' : 'Possible typo', id, etichetta(voce), zn, String(atteso || 'Circle_Empty'), a.ad);
          }
        } else if (['SPONSOR', 'CLUB', 'ADD', 'LC', 'CB', 'MATS'].includes(ruolo)) {
          if (ruolo === 'CB' && !attesi.CB.valore) continue; // senza la nota nell'Excel il centreboard non si controlla
          if (vuoto) continue;
          const tappeto = ruolo === 'MATS' && conTappeti ? abbinati.get(zn) : null;
          if (ruolo === 'MATS' && conTappeti && !tappeto) {
            if (!sconosciute.has(zn)) { sconosciute.add(zn); nota('Warning', '-', '-', zn, 'CLUB MAT in the Excel', 'not checked'); }
            continue;
          }
          c.cella = ++c.celle.n;
          let atteso; let col;
          if (tipo === 'PRE' || leadIn) { atteso = null; col = '-'; }
          else if (ruolo === 'SPONSOR') { atteso = sponsorAtteso; col = `Rule · ${sponsor.etichetta}`; }
          else if (ruolo === 'MATS') { atteso = tappeto.valore; col = etichetta(tappeto); }
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
            vista(i, id, col, zn, atteso, trovato);
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
    // una riga CLUB MAT di questo tempo che nessuna zona del pacchetto mostra: il tappeto manca
    c.cella = null;
    if (tappetiControllati) {
      righeTappeto.filter((r) => !mostrate.has(r.voce) && r.voce.valore).forEach((r) => nota('Error', '-', etichetta(r.voce), '-', String(r.voce.valore), 'no mat zone'));
    }
  }

  return { NOME: 'confrontoStatici', attesiStatici, controllaStatici };
});
