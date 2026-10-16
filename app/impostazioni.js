/* Playlist Check — scheda Settings: destinatari della mail dei refusi (visibili a tutti, modificabili con la password admin). */
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
    const MOTIVI = { 'wrong admin password': 'Wrong admin password.', 'rate limit': 'Too many emails this hour: try again later.',
      'no recipients': 'There are no recipients yet.', 'not configured': 'The email service is not set up yet.', unreachable: "Couldn't reach the email service." };

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

    $('imp-apri').addEventListener('click', () => { $('imp-modifica').hidden = false; $('imp-apri').hidden = true; $('imp-testo').focus(); });
    $('imp-annulla').addEventListener('click', () => { $('imp-modifica').hidden = true; $('imp-apri').hidden = false; $('imp-password').value = ''; messaggio(''); });
    $('imp-salva').addEventListener('click', salva);
    $('imp-prova').addEventListener('click', prova);
    document.addEventListener('pc:vista', (e) => { if (e.detail === 'settings') carica(); });
  }

  if (typeof document !== 'undefined' && !(typeof module === 'object' && module.exports)) document.addEventListener('DOMContentLoaded', interfaccia);

  return { NOME: 'impostazioni', validaIndirizzi };
});
