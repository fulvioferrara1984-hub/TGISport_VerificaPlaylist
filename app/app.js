/* Playlist Check — avvio: accesso, regole, schede. */
(function (PC) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const app = { regole: null, chiave: null };

  // Logo mancante: via l'immagine invece di mostrarla rotta (qui e non con onerror nella pagina, che la policy blocca).
  document.querySelectorAll('.marchio-logo, .accesso-logo').forEach((img) => {
    if (img.complete && !img.naturalWidth) img.remove();
    else img.addEventListener('error', () => img.remove());
  });

  // Messaggio temporaneo in basso (tipo: '' | 'ok' | 'errore').
  function avviso(testo, tipo = '') {
    const a = document.createElement('div');
    a.className = 'avviso ' + tipo;
    a.textContent = testo;
    $('avvisi').appendChild(a);
    setTimeout(() => a.remove(), tipo === 'errore' ? 7000 : 4000);
  }

  function mostraVista(nome) {
    document.querySelectorAll('.schede button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.vista === nome)));
    document.querySelectorAll('.vista').forEach((v) => { v.hidden = v.id !== 'vista-' + nome; });
    document.dispatchEvent(new CustomEvent('pc:vista', { detail: nome }));
  }

  async function avvia() {
    document.querySelectorAll('.schede button').forEach((b) => b.addEventListener('click', () => mostraVista(b.dataset.vista)));
    $('btn-esci').addEventListener('click', () => PC.accesso.esci());
    app.chiave = await PC.accesso.sblocca();
    try {
      app.regole = await PC.regole.carica(app.chiave);
    } catch (e) {
      avviso('The rules could not be opened: ' + e.message, 'errore');
      return;
    }
    $('btn-esci').hidden = false;
    document.body.classList.add('pronto');
    mostraVista('check');
    document.dispatchEvent(new CustomEvent('pc:pronto'));
  }

  app.avviso = avviso;
  app.mostraVista = mostraVista;
  PC.app = app;
  document.addEventListener('DOMContentLoaded', avvia);
})(window.PC = window.PC || {});
