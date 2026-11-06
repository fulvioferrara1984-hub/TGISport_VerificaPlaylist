/* Playlist Check — avvio: accesso, regole, schede. */
(function (PC) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const app = { regole: null, chiave: null };

  // Logo mancante: via l'immagine invece di mostrarla rotta (qui e non con onerror nella pagina, che la policy blocca).
  document.querySelectorAll('.logo img').forEach((img) => {
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

  const voci = () => document.querySelectorAll('.voce-menu[data-vista]');

  function mostraVista(nome) {
    voci().forEach((b) => {
      const qui = b.dataset.vista === nome;
      b.classList.toggle('active', qui);
      if (qui) { b.setAttribute('aria-current', 'page'); $('percorso-vista').textContent = b.textContent.trim(); } else b.removeAttribute('aria-current');
    });
    document.querySelectorAll('.vista').forEach((v) => { v.hidden = v.id !== 'vista-' + nome; });
    chiudiMenu(false);
    document.dispatchEvent(new CustomEvent('pc:vista', { detail: nome }));
  }

  // Sotto i 1024 px il menu laterale è un cassetto: ☰ lo apre (fuoco sulla prima voce), Esc o il velo lo chiudono (fuoco di nuovo su ☰).
  function apriMenu() {
    $('menu-laterale').classList.add('aperto');
    $('velo-lato').hidden = false;
    $('apri-menu').setAttribute('aria-expanded', 'true');
    const prima = document.querySelector('.voce-menu');
    if (prima) prima.focus();
  }
  function chiudiMenu(torna) {
    if (!$('menu-laterale').classList.contains('aperto')) return;
    $('menu-laterale').classList.remove('aperto');
    $('velo-lato').hidden = true;
    $('apri-menu').setAttribute('aria-expanded', 'false');
    if (torna) $('apri-menu').focus();
  }

  // Tema chiaro / scuro (app/tema.js): testi e icone dell'interruttore li sceglie il CSS dal tema.
  const cambiaTema = () => PC.tema.cambiaTema(document.documentElement, PC.tema.archivioTema());

  async function avvia() {
    voci().forEach((b) => b.addEventListener('click', () => mostraVista(b.dataset.vista)));
    document.querySelectorAll('.interruttore-tema').forEach((b) => b.addEventListener('click', cambiaTema));
    $('apri-menu').addEventListener('click', apriMenu);
    $('velo-lato').addEventListener('click', () => chiudiMenu(true));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudiMenu(true); });
    $('oggi').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
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
