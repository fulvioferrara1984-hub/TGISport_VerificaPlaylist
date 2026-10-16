/* Playlist Check — alias approvati in Settings: proposte dai controlli e unione con gli alias cifrati delle regole. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  const dip = (nome) => (typeof module === 'object' && module.exports ? require('./' + nome + '.js') : radice.PC[nome]);

  // Righe del foglio Aliases dello script: { chiave: 'NOMEEXCEL|CHIAVEAIR', excel, air, tipo, stato: 'proposed' | 'official', … }.
  let righe = [];

  // Coppie confermate in un controllo, da proporre come alias: una per nome Excel e brand AIR.
  function proposte(ultimo) {
    const viste = new Map();
    ultimo.coppie.filter((c) => ultimo.risposte.get(c.chiave) === 'confirm').forEach((c) => {
      const [, excelK, airK] = c.chiave.split('|');
      const chiave = `${excelK}|${airK}`;
      if (!viste.has(chiave)) viste.set(chiave, { chiave, excel: c.atteso, air: c.trovato, tipo: c.tipo });
    });
    return [...viste.values()];
  }

  // Alias delle regole cifrate più quelli ufficiali del foglio (stesso formato: { NOMEEXCEL: [CHIAVE AIR, …] }), senza toccare le regole.
  function unisci(alias, lista) {
    const out = {};
    Object.entries(alias || {}).forEach(([e, v]) => { out[e] = v.slice(); });
    lista.filter((r) => r.stato === 'official').forEach((r) => {
      const [e, a] = String(r.chiave).split('|');
      if (!e || !a) return;
      if (!out[e]) out[e] = [];
      if (!out[e].includes(a)) out[e].push(a);
    });
    return out;
  }

  const imposta = (lista) => { righe = Array.isArray(lista) ? lista : []; };
  const elenco = () => righe;
  const regoleCon = (regole) => ({ ...regole, alias: unisci(regole.alias, righe) });

  // Rilegge il foglio Aliases dallo script; se non risponde restano le righe che c'erano.
  async function aggiorna(servizio, timeoutMs = 5000) {
    const r = await dip('servizio').chiama(servizio, 'alias', {}, undefined, timeoutMs);
    if (r.ok) imposta(r.righe);
    return r;
  }

  return { NOME: 'alias', proposte, unisci, imposta, elenco, regoleCon, aggiorna };
});
