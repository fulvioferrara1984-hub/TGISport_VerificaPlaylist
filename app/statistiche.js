/* Playlist Check — scheda Statistics: storico dei controlli (solo numeri) con filtri, totali ed export. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  const dip = (nome) => (typeof module === 'object' && module.exports ? require('./' + nome + '.js') : radice.PC[nome]);
  const { k } = dip('nomi');

  // Data e ora del controllo in ora italiana: "2026-10-12 11:00".
  function quando(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return String(iso || '');
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  }

  const dataPartita = (r) => String(r.dataEvento || r.dataControllo || '').slice(0, 10);

  // filtri: { sistema (Hub | Vault), da, a (YYYY-MM-DD, data della partita, inclusi), squadra, partita, soloPrimo }
  function filtra(righe, filtri = {}) {
    let out = righe.slice();
    if (filtri.sistema) out = out.filter((r) => (r.sistema || 'Hub') === filtri.sistema); // i controlli di prima del Vault sono dell'Hub
    if (filtri.soloPrimo) {
      const primo = new Map();
      out.forEach((r) => {
        const chiave = `${k(r.partita)}|${dataPartita(r)}`;
        const p = primo.get(chiave);
        if (!p || String(r.dataControllo) < String(p.dataControllo)) primo.set(chiave, r);
      });
      const tenuti = new Set(primo.values());
      out = out.filter((r) => tenuti.has(r));
    }
    if (filtri.da) out = out.filter((r) => dataPartita(r) >= filtri.da);
    if (filtri.a) out = out.filter((r) => dataPartita(r) <= filtri.a);
    if (filtri.squadra) out = out.filter((r) => [r.casa, r.ospite].some((s) => k(s) === k(filtri.squadra)));
    if (filtri.partita) out = out.filter((r) => k(r.partita).includes(k(filtri.partita)));
    return out;
  }

  function totali(righe) {
    const somma = (c) => righe.reduce((n, r) => n + (Number(r[c]) || 0), 0);
    return { controlli: righe.length, celle: somma('celle'), corrette: somma('corrette'), errori: somma('errori'), refusi: somma('refusiTrovati') };
  }

  const COLONNE = [
    ['Checked on', (r) => quando(r.dataControllo)], ['Match date', dataPartita], ['Match', (r) => r.partita], ['Home', (r) => r.casa], ['Away', (r) => r.ospite],
    ['Venue', (r) => r.venue], ['Excel playlist', (r) => r.fileExcel], ['Package', (r) => r.fileAir], ['Cells', (r) => Number(r.celle) || 0],
    ['Correct', (r) => Number(r.corrette) || 0], ['Errors', (r) => Number(r.errori) || 0], ['Typos/aliases found', (r) => Number(r.refusiTrovati) || 0],
    ['Confirmed', (r) => Number(r.confermati) || 0], ['Rejected', (r) => Number(r.respinti) || 0], ['Warnings', (r) => Number(r.avvisi) || 0],
    ['System', (r) => r.sistema || 'Hub'],
  ];

  function esporta(righe, XLSX) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([COLONNE.map((c) => c[0])].concat(righe.map((r) => COLONNE.map((c) => c[1](r))))), 'Checks');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  }

  // ---------- interfaccia (solo nel browser) ----------
  function interfaccia() {
    const PC = radice.PC;
    const $ = (id) => document.getElementById(id);
    let righe = null;

    const filtri = () => ({ sistema: $('stat-sistema').value, da: $('stat-da').value, a: $('stat-a').value, squadra: $('stat-squadra').value, partita: $('stat-partita').value.trim(), soloPrimo: $('stat-primo').checked });

    function disegna() {
      if (!righe) return;
      const scelte = filtri();
      const squadre = [...new Set(filtra(righe, { sistema: scelte.sistema }).flatMap((r) => [r.casa, r.ospite]).filter(Boolean))].sort();
      const sel = $('stat-squadra');
      const prima = sel.value;
      sel.replaceChildren(new Option('All teams', ''), ...squadre.map((s) => new Option(s, s)));
      sel.value = squadre.includes(prima) ? prima : '';
      const filtrate = filtra(righe, scelte).sort((x, y) => String(y.dataControllo).localeCompare(String(x.dataControllo)));
      const t = totali(filtrate);
      const numero = (n) => n.toLocaleString('en-GB');
      $('stat-totali').replaceChildren(...[['Checks', t.controlli], ['Cells checked', t.celle], ['Correct', t.corrette], ['Errors', t.errori], ['Typos/aliases', t.refusi]]
        .map(([nome, n]) => { const d = document.createElement('div'); d.className = 'totale'; d.innerHTML = '<b></b><span></span>'; d.firstChild.textContent = numero(n); d.lastChild.textContent = nome; return d; }));
      $('stat-tabella').tBodies[0].replaceChildren(...filtrate.map((r) => {
        const tr = document.createElement('tr');
        [quando(r.dataControllo), dataPartita(r), r.partita, r.venue, numero(Number(r.celle) || 0), numero(Number(r.corrette) || 0), numero(Number(r.errori) || 0),
          `${r.refusiTrovati || 0} / ${r.confermati || 0} / ${r.respinti || 0}`, numero(Number(r.avvisi) || 0)]
          .forEach((v) => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
        return tr;
      }));
      $('stat-vuota').hidden = filtrate.length > 0;
      $('stat-esporta').disabled = !filtrate.length;
      $('stat-esporta').onclick = () => PC.archivio.scarica(`Playlist Check – statistics (${scelte.sistema}).xlsx`,
        new Blob([esporta(filtrate, radice.XLSX)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    }

    async function carica() {
      $('stat-stato').hidden = false;
      $('stat-stato').className = 'nota';
      $('stat-stato').textContent = 'Loading…';
      const r = await PC.servizio.chiama(PC.app.regole.servizio, 'elencoControlli');
      if (!r.ok) {
        $('stat-stato').className = 'nota male';
        $('stat-stato').textContent = r.errore === 'not configured' ? 'The statistics service is not set up yet.' : "Couldn't load the statistics. ";
        if (r.errore !== 'not configured') {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'bottone'; b.textContent = 'Retry'; b.onclick = carica;
          $('stat-stato').appendChild(b);
        }
        return;
      }
      righe = r.righe || [];
      $('stat-stato').hidden = true;
      disegna();
    }

    ['stat-sistema', 'stat-da', 'stat-a', 'stat-squadra', 'stat-partita', 'stat-primo'].forEach((id) => $(id).addEventListener('input', disegna));
    document.addEventListener('pc:vista', (e) => { if (e.detail === 'statistics') carica(); });
  }

  if (typeof document !== 'undefined' && !(typeof module === 'object' && module.exports)) document.addEventListener('DOMContentLoaded', interfaccia);

  return { NOME: 'statistiche', quando, filtra, totali, esporta };
});
