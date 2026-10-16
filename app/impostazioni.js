/* Playlist Check — scheda Settings: destinatari della mail dei refusi e alias approvati (visibili a tutti, modificabili con la password admin). */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

  // Uno per riga o separati da virgola / punto e virgola; senza doppioni.
  function validaIndirizzi(testo) {
    const indirizzi = [];
    String(testo || '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).forEach((x) => { if (!indirizzi.includes(x)) indirizzi.push(x); });
    return { indirizzi, errati: indirizzi.filter((x) => !EMAIL.test(x)) };
  }

  // ---------- interfaccia (solo nel browser) ----------
  function interfaccia() {
    const PC = radice.PC;
    const $ = (id) => document.getElementById(id);
    const MOTIVI = { 'wrong admin password': 'Wrong admin password.', 'too many attempts': 'Too many wrong admin passwords: try again in 15 minutes.',
      'rate limit': 'Too many emails this hour: try again later.',
      'no recipients': 'There are no recipients yet.', 'not configured': 'The email service is not set up yet.', unreachable: "Couldn't reach the email service.",
      'unknown alias': 'This name is no longer in the list: reload the page.', 'unknown action': 'The Google script needs updating to manage aliases.' };

    function messaggio(testo, classe = '') {
      $('imp-messaggio').hidden = !testo;
      $('imp-messaggio').className = 'nota ' + classe;
      $('imp-messaggio').textContent = testo || '';
    }

    function mostra(indirizzi) {
      $('imp-elenco').replaceChildren(...(indirizzi.length ? indirizzi : ['No recipients yet.']).map((x) => { const li = document.createElement('li'); li.textContent = x; return li; }));
      $('imp-testo').value = indirizzi.join('\n');
    }

    async function carica() {
      messaggio('Loading…');
      const r = await PC.servizio.chiama(PC.app.regole.servizio, 'destinatari');
      if (!r.ok) { messaggio(MOTIVI[r.errore] || "Couldn't load the recipients.", 'male'); return; }
      messaggio('');
      mostra(r.indirizzi);
    }

    async function salva() {
      const { indirizzi, errati } = validaIndirizzi($('imp-testo').value);
      if (errati.length) { messaggio('Not valid: ' + errati.join(', '), 'male'); return; }
      $('imp-salva').disabled = true;
      const r = await PC.servizio.chiama(PC.app.regole.servizio, 'salvaDestinatari', { password: $('imp-password').value, indirizzi });
      $('imp-salva').disabled = false;
      if (!r.ok) { messaggio(r.errati ? 'Not valid: ' + r.errati.join(', ') : MOTIVI[r.errore] || "Couldn't save.", 'male'); return; }
      mostra(r.indirizzi);
      $('imp-modifica').hidden = true;
      $('imp-apri').hidden = false;
      $('imp-password').value = '';
      messaggio('Saved.', 'bene');
    }

    async function prova() {
      $('imp-prova').disabled = true;
      const r = await PC.servizio.chiama(PC.app.regole.servizio, 'mailDiProva', { password: $('imp-password').value });
      $('imp-prova').disabled = false;
      messaggio(r.ok ? `Test email sent to ${r.inviati} recipient${r.inviati === 1 ? '' : 's'}.` : MOTIVI[r.errore] || "Couldn't send the test email.", r.ok ? 'bene' : 'male');
    }

    // ---------- alias ----------
    const TIPI = { 'Possible alias': 'Alias', 'Possible typo': 'Typo' };
    const data = (iso) => (iso ? PC.statistiche.quando(iso) : '');

    function messaggioAlias(testo, classe = '') {
      $('alias-messaggio').hidden = !testo;
      $('alias-messaggio').className = 'nota ' + classe;
      $('alias-messaggio').textContent = testo || '';
    }

    function riga(celle, azioni = []) {
      const tr = document.createElement('tr');
      celle.forEach((t) => { const td = document.createElement('td'); td.textContent = t == null ? '' : String(t); tr.appendChild(td); });
      if (azioni.length) {
        const td = document.createElement('td');
        const box = document.createElement('div');
        box.className = 'alias-azioni';
        azioni.forEach(([testo, classe, azione]) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = classe; b.textContent = testo;
          b.addEventListener('click', () => azione(b));
          box.appendChild(b);
        });
        td.appendChild(box);
        tr.appendChild(td);
      }
      return tr;
    }

    function disegnaAlias() {
      const righe = PC.alias.elenco();
      const proposti = righe.filter((r) => r.stato !== 'official');
      const ufficiali = righe.filter((r) => r.stato === 'official');
      $('alias-proposti').querySelector('tbody').replaceChildren(...proposti.map((r) => riga(
        [r.excel, r.air, TIPI[r.tipo] || r.tipo, `${r.volte}×`, [r.ultimaPartita, data(r.ultimaData)].filter(Boolean).join(' · ')],
        [['Make official', 'primario', (b) => azioneAlias('approvaAlias', r.chiave, b)], ['Dismiss', 'bottone', (b) => azioneAlias('rimuoviAlias', r.chiave, b)]])));
      $('alias-proposti-vuoto').hidden = proposti.length > 0;
      $('alias-ufficiali').querySelector('tbody').replaceChildren(...ufficiali.map((r) => riga(
        [r.excel, r.air, data(r.approvatoIl)], [['Remove', 'bottone', (b) => azioneAlias('rimuoviAlias', r.chiave, b)]])));
      $('alias-ufficiali-vuoto').hidden = ufficiali.length > 0;
      const interni = Object.entries((PC.app.regole && PC.app.regole.alias) || {});
      $('alias-interni-conta').textContent = `(${interni.length})`;
      $('alias-interni').querySelector('tbody').replaceChildren(...interni.map(([e, a]) => riga([e, a.join(', ')])));
    }

    async function caricaAlias() {
      const r = await PC.alias.aggiorna(PC.app.regole.servizio, 15000);
      messaggioAlias(r.ok ? '' : MOTIVI[r.errore] || "Couldn't load the aliases.", r.ok ? '' : 'male');
      disegnaAlias();
    }

    async function azioneAlias(azione, chiave, bottone) {
      const password = $('alias-password').value;
      if (!password) { messaggioAlias('Enter the admin password first.', 'male'); $('alias-password').focus(); return; }
      bottone.disabled = true;
      const r = await PC.servizio.chiama(PC.app.regole.servizio, azione, { password, chiave });
      bottone.disabled = false;
      if (!r.ok) { messaggioAlias(MOTIVI[r.errore] || "Couldn't save.", 'male'); return; }
      PC.alias.imposta(r.righe);
      disegnaAlias();
      messaggioAlias(azione === 'approvaAlias' ? 'Made official: it counts as correct from the next check.' : 'Removed.', 'bene');
    }

    $('imp-apri').addEventListener('click', () => { $('imp-modifica').hidden = false; $('imp-apri').hidden = true; $('imp-testo').focus(); });
    $('imp-annulla').addEventListener('click', () => { $('imp-modifica').hidden = true; $('imp-apri').hidden = false; $('imp-password').value = ''; messaggio(''); });
    $('imp-salva').addEventListener('click', salva);
    $('imp-prova').addEventListener('click', prova);
    document.addEventListener('pc:vista', (e) => { if (e.detail === 'settings') { carica(); caricaAlias(); } });
  }

  if (typeof document !== 'undefined' && !(typeof module === 'object' && module.exports)) document.addEventListener('DOMContentLoaded', interfaccia);

  return { NOME: 'impostazioni', validaIndirizzi };
});
