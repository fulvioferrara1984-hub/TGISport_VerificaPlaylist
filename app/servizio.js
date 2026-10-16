/* Playlist Check — chiamate allo script Google. Non lancia mai eccezioni: in caso di problemi { ok: false, errore }. */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function (radice) {
  'use strict';

  // servizio: { url, codice } dalle regole cifrate. Corpo in text/plain: lo script Google lo accetta senza preflight CORS.
  async function chiama(servizio, azione, dati = {}, fetchFn = radice.fetch && radice.fetch.bind(radice), timeoutMs = 15000) {
    if (!servizio || !servizio.url) return { ok: false, errore: 'not configured' };
    const controllo = new AbortController();
    const timer = setTimeout(() => controllo.abort(), timeoutMs);
    try {
      const r = await fetchFn(servizio.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ codice: servizio.codice, azione, dati }),
        signal: controllo.signal,
      });
      if (!r.ok) return { ok: false, errore: 'unreachable' };
      return await r.json();
    } catch (e) {
      return { ok: false, errore: 'unreachable' };
    } finally {
      clearTimeout(timer);
    }
  }

  return { NOME: 'servizio', chiama };
});
