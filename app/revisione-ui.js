/* Playlist Check — visual check nella pagina: scheda nei risultati e pannello di revisione slot per slot.
   I media si prendono dallo zip già in memoria (ultimo.media) e restano nel browser. */
(function (PC) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ATTESA = 5000; // un video che non è pronto entro 5 s non si può vedere in questo browser
  const IMMAGINE = /\.(png|jpe?g|gif|webp)$/i;
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

  // { ultimo, alCambio, indice, url: [], giro } finché il pannello è aperto
  let stato = null;
  // numero di ogni slot mostrato, mai azzerato: un caricamento rimasto da uno slot o da un pannello chiuso non tocca quello nuovo
  let giri = 0;

  const testo = (t) => document.createTextNode(t == null ? '' : String(t));
  function el(tag, attributi = {}, ...figli) {
    const n = document.createElement(tag);
    Object.entries(attributi).forEach(([k, v]) => { if (k === 'class') n.className = v; else n.setAttribute(k, v); });
    figli.flat().forEach((f) => n.appendChild(typeof f === 'string' || typeof f === 'number' ? testo(f) : f));
    return n;
  }
  function bottone(etichetta, classe, azione) {
    const b = el('button', { type: 'button', class: classe }, etichetta);
    b.addEventListener('click', azione);
    return b;
  }

  const avanzamento = (u) => PC.revisione.avanzamento(u.schermate, u.risposteVisive);
  const daDecidere = (s) => s.gruppi.some((g) => !stato.ultimo.risposteVisive.has(g.chiave));

  // ---------- scheda nei risultati ----------
  function scheda(ultimo, alCambio) {
    const av = avanzamento(ultimo);
    const iniziato = av.risposti > 0;
    return el('div', {},
      el('h2', {}, 'Visual check'),
      el('p', { class: 'nota' }, 'First the static assets, which stay the same for the whole match, then each slot with its LED rows: watch them next to the brand the Excel asks for and mark each group Correct or Wrong. Wrong groups are added to the results as errors. The files never leave this browser.'),
      el('div', { class: 'visivo-riga' },
        el('span', { class: 'visivo-avanzamento' }, iniziato ? PC.revisione.testoAvanzamento(av) : PC.revisione.testoDaFare(av)),
        bottone(iniziato ? 'Continue visual check' : 'Start visual check', 'primario', () => apri(ultimo, alCambio))));
  }

  // ---------- pannello ----------
  function apri(ultimo, alCambio) {
    if (!ultimo.schermate.length) return;
    chiudi();
    stato = { ultimo, alCambio, indice: 0, url: [], giro: null };
    const primo = ultimo.schermate.findIndex(daDecidere);
    stato.indice = primo >= 0 ? primo : 0;
    const p = $('revisione');
    p.hidden = false;
    document.body.classList.add('con-pannello');
    document.addEventListener('keydown', tasti);
    mostra();
  }

  function chiudi() {
    if (!stato) return;
    libera();
    const p = $('revisione');
    p.replaceChildren();
    p.hidden = true;
    document.body.classList.remove('con-pannello');
    document.removeEventListener('keydown', tasti);
    stato = null;
  }

  // ferma i video dello slot e libera i loro URL
  function libera() {
    $('revisione').querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
    stato.url.forEach((u) => URL.revokeObjectURL(u));
    stato.url = [];
  }

  function tasti(e) {
    if (!stato || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'Escape') chiudi();
    else if (e.key === 'ArrowRight') avanti();
    else if (e.key === 'ArrowLeft') indietro();
  }

  function vai(i) {
    if (!stato || i < 0 || i >= stato.ultimo.schermate.length || i === stato.indice) return;
    stato.indice = i;
    mostra();
  }
  const indietro = () => vai(stato.indice - 1);
  // il primo slot successivo con qualcosa da decidere, altrimenti il successivo
  function avanti() {
    const lista = stato.ultimo.schermate;
    for (let i = stato.indice + 1; i < lista.length; i++) if (daDecidere(lista[i])) return vai(i);
    return vai(stato.indice + 1);
  }

  function riparti() {
    $('revisione').querySelectorAll('video').forEach((v) => { v.currentTime = 0; v.play().catch(() => {}); });
  }

  function testoTestata() {
    const av = avanzamento(stato.ultimo);
    if (av.riviste === av.totale && av.staticiRisposti === av.statici) return 'All reviewed';
    const parti = [];
    if (av.statici) parti.push(`static assets ${av.staticiRisposti} of ${av.statici}`);
    if (av.totale) parti.push(`${av.riviste} of ${av.totale} slots reviewed`);
    return parti.join(' · ');
  }

  // "Static assets" per la prima schermata, "Slot n of N" per le altre (N senza la schermata degli statici)
  function titoloSchermata(lista, indice) {
    if (lista[indice].tipo === 'statici') return 'Static assets';
    const prima = lista[0].tipo === 'statici' ? 1 : 0;
    return `Slot ${indice + 1 - prima} of ${lista.length - prima}`;
  }

  function mostra() {
    libera();
    const giro = ++giri;
    stato.giro = giro;
    const lista = stato.ultimo.schermate;
    const s = lista[stato.indice];
    const avanz = el('span', { class: 'rev-avanzamento' }, testoTestata());
    const testata = el('div', { class: 'rev-testata' },
      el('h2', {}, titoloSchermata(lista, stato.indice)),
      avanz,
      el('span', { class: 'spazio' }),
      bottone('←', 'bottone', indietro),
      bottone('→', 'bottone', avanti),
      bottone('Restart', 'bottone', riparti),
      bottone('Close', 'bottone', chiudi));
    testata.querySelectorAll('button')[0].setAttribute('aria-label', 'Previous slot');
    testata.querySelectorAll('button')[1].setAttribute('aria-label', 'Next slot');
    const dove = s.tipo === 'statici'
      ? el('p', { class: 'nota rev-intro' }, 'These assets stay the same for the whole match: decide them once here, and the slots that follow show only what changes.')
      : el('div', { class: 'rev-dove' }, ...s.dove.map((d) => el('span', {}, `${d.feed} · ${d.segmento} · ID ${PC.report.idCompatti(d.ids)}`)));
    const video = [];
    const gruppi = s.gruppi.map((g) => disegnaGruppo(g, video, giro, avanz));
    const pannello = el('div', { class: 'rev-pannello', tabindex: '-1' }, testata, dove, ...gruppi);
    $('revisione').replaceChildren(pannello);
    $('revisione').scrollTop = 0; // ogni slot si apre in cima, con la prima fila in vista
    pannello.focus({ preventScroll: true });
    Promise.all(video).then((pronti) => {
      if (!stato || giro !== stato.giro) return;
      pronti.filter(Boolean).forEach((v) => { v.currentTime = 0; v.play().catch(() => {}); });
    });
  }

  function titolo(g) {
    const nome = g.statico || g.gruppo === 'Zone' ? g.zone.map((z) => z.zona).join(' · ') : g.gruppo;
    return el('span', { class: 'rev-titolo' }, `${nome} · Excel says `, el('b', {}, g.atteso), g.nota ? ` (${g.nota})` : '');
  }

  function disegnaGruppo(g, video, giro, avanz) {
    const risposte = stato.ultimo.risposteVisive;
    const giusto = bottone('Correct', 'bottone', () => rispondi('correct'));
    const sbagliato = bottone('Wrong', 'bottone', () => rispondi('wrong'));
    const nota = el('input', { type: 'text', class: 'rev-nota', placeholder: 'What do you see? (optional)', 'aria-label': 'What do you see?' });
    const sezione = el('section', { class: 'rev-gruppo' }, el('div', { class: 'rev-gruppo-testa' }, titolo(g), giusto, sbagliato));
    // per uno statico: dove va in onda (feed e segmenti), al posto delle etichette dello slot
    if (g.statico) sezione.appendChild(el('div', { class: 'rev-dove' }, ...PC.revisione.doveGruppo(g).map((d) => el('span', {}, `${d.feed.join(', ')} · ${d.segmenti.join(', ')}`))));
    sezione.appendChild(nota);
    function aggiorna() {
      const r = risposte.get(g.chiave);
      sezione.classList.toggle('giusto', Boolean(r && r.esito === 'correct'));
      sezione.classList.toggle('sbagliato', Boolean(r && r.esito === 'wrong'));
      giusto.classList.toggle('attivo', Boolean(r && r.esito === 'correct'));
      sbagliato.classList.toggle('attivo', Boolean(r && r.esito === 'wrong'));
      nota.hidden = !(r && r.esito === 'wrong');
      nota.value = r && r.nota ? r.nota : '';
      avanz.textContent = testoTestata();
    }
    function rispondi(esito) {
      const prima = risposte.get(g.chiave);
      risposte.set(g.chiave, { esito, nota: esito === 'wrong' && prima ? prima.nota : '' });
      aggiorna();
      stato.alCambio();
      if (esito === 'wrong') nota.focus();
    }
    nota.addEventListener('change', () => {
      const r = risposte.get(g.chiave);
      if (!r || r.esito !== 'wrong') return;
      risposte.set(g.chiave, { esito: 'wrong', nota: nota.value.trim() });
      stato.alCambio();
    });
    g.zone.forEach((z) => {
      const box = el('div', { class: 'rev-media' }, el('span', { class: 'rev-attesa' }, 'Loading…'));
      sezione.appendChild(el('div', { class: 'rev-zona' }, el('span', { class: 'rev-nome' }, z.zona), box));
      video.push(caricaMedia(z.file, box, giro));
    });
    aggiorna();
    return sezione;
  }

  function riquadro(box, file, messaggio, byte) {
    const figli = [el('span', {}, el('b', {}, file), ` · ${messaggio}`)];
    if (byte) figli.push(bottone('Save file', 'bottone', () => PC.archivio.scarica(file, new Blob([byte]))));
    box.replaceChildren(el('div', { class: 'rev-non-disponibile' }, ...figli));
  }

  // Mette il media del file nel riquadro; restituisce il <video> pronto da far partire (o null). Non fallisce mai:
  // un file che non si legge dallo zip diventa un riquadro e gli altri media dello slot partono lo stesso.
  async function caricaMedia(file, box, giro) {
    let byte;
    try {
      byte = await stato.ultimo.media(file);
    } catch (e) {
      if (stato && giro === stato.giro) riquadro(box, file, 'could not be read from the package');
      return null;
    }
    if (!stato || giro !== stato.giro) return null;
    if (!byte) { riquadro(box, file, 'missing from package'); return null; }
    const est = (/\.([a-z0-9]+)$/i.exec(file) || [])[1] || '';
    const immagine = IMMAGINE.test(file);
    const url = URL.createObjectURL(new Blob([byte], { type: immagine ? MIME[est.toLowerCase()] : 'video/mp4' }));
    stato.url.push(url);
    if (immagine) {
      const img = el('img', { alt: file });
      img.src = url;
      box.replaceChildren(img);
      return null;
    }
    const v = el('video', { 'aria-label': file });
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'auto';
    const pronto = new Promise((risolvi) => {
      const fine = (ok) => { clearTimeout(t); risolvi(ok); };
      const t = setTimeout(() => fine(false), ATTESA);
      v.addEventListener('canplay', () => fine(true), { once: true });
      v.addEventListener('error', () => fine(false), { once: true });
    });
    v.src = url;
    box.replaceChildren(v);
    const ok = await pronto;
    if (!stato || giro !== stato.giro) return null;
    if (!ok || !v.videoWidth) {
      v.removeAttribute('src');
      v.load();
      riquadro(box, file, 'preview not available in this browser', byte);
      return null;
    }
    return v;
  }

  PC.revisioneUi = { scheda, apri, chiudi };
})(window.PC = window.PC || {});
