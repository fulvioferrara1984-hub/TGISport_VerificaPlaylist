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
  // stato della lettura automatica (lettura-automatica-ui.js) in una riga; vuota se non è partita
  function testoLettura(ultimo, av) {
    const l = ultimo.lettura;
    if (!l) return '';
    if (l.stato === 'in corso') return `Reading brand names in the animations… ${l.letti} of ${l.totale} files`;
    if (l.stato === 'non disponibile') return 'Automatic brand reading is not available in this browser: review the groups by eye.';
    return av.automatici
      ? `Brand reading done: ${av.automatici} ${av.automatici === 1 ? 'group' : 'groups'} read automatically.`
      : 'Brand reading done: no brand name could be read, review the groups by eye.';
  }

  // testi della scheda; "Start" finché non c'è una risposta data a mano
  function testiScheda(ultimo) {
    const av = avanzamento(ultimo);
    return {
      avanzamento: av.risposti ? PC.revisione.testoAvanzamento(av) : PC.revisione.testoDaFare(av),
      lettura: testoLettura(ultimo, av),
      bottone: av.risposti > av.automatici ? 'Continue visual check' : 'Start visual check',
    };
  }

  function scheda(ultimo, alCambio) {
    const t = testiScheda(ultimo);
    return el('div', {},
      el('h2', {}, 'Visual check', el('span', { class: 'visivo-esito' })),
      el('p', { class: 'nota' }, 'First the static assets, which stay the same for the whole match, then each slot with its LED rows: watch them next to the brand the Excel asks for and mark each group Correct or Wrong. Wrong groups are added to the results as errors. The files never leave this browser.'),
      el('p', { class: 'nota' }, 'Meanwhile the page reads the brand names written in the animations: when it reads the brand the Excel asks for in every file of a group, the group is marked Correct by itself (read automatically). It confirms the brand, not its version, and you can still change it.'),
      el('div', { class: 'visivo-riga' },
        el('span', { class: 'visivo-avanzamento' }, t.avanzamento),
        bottone(t.bottone, 'primario visivo-apri', () => apri(ultimo, alCambio))),
      el('p', { class: 'piccolo visivo-lettura' }, t.lettura));
  }

  // Ogni gruppo ha una risposta e sono tutte Correct (anche lette in automatico): scheda verde e "all correct" accanto al titolo.
  function segnaScheda(box, ultimo) {
    if (!box) return;
    const fatto = PC.revisione.tuttoCorretto(avanzamento(ultimo));
    box.classList.toggle('visivo-fatto', fatto);
    const esito = box.querySelector('.visivo-esito');
    if (esito) esito.textContent = fatto ? ' · all correct' : '';
  }

  // Dopo ogni file letto: testi della scheda (senza ridisegnarla) e gruppi della schermata aperta.
  function aggiornaLettura(ultimo) {
    const box = $('check-visivo');
    const t = testiScheda(ultimo);
    segnaScheda(box, ultimo);
    [['.visivo-avanzamento', t.avanzamento], ['.visivo-lettura', t.lettura], ['.visivo-apri', t.bottone]].forEach(([sel, testo]) => {
      const n = box && box.querySelector(sel);
      if (n) n.textContent = testo;
    });
    if (stato && stato.ultimo === ultimo) stato.aggiorna.forEach((f) => f());
  }

  // ---------- pannello ----------
  function apri(ultimo, alCambio) {
    if (!ultimo.schermate.length) return;
    chiudi();
    stato = { ultimo, alCambio, indice: 0, url: [], giro: null, aggiorna: [], ferma: [] };
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

  // ferma i video dello slot (e il disegno delle strisce andate a capo) e libera i loro URL
  function libera() {
    stato.ferma.forEach((f) => f());
    stato.ferma = [];
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
    stato.aggiorna = [];
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
    const auto = el('span', { class: 'rev-auto' });
    const sezione = el('section', { class: 'rev-gruppo' }, el('div', { class: 'rev-gruppo-testa' }, titolo(g), auto, giusto, sbagliato));
    const lette = []; // etichetta "X read" di ogni zona, per le zone già lette di un gruppo non ancora deciso
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
      if (document.activeElement !== nota) nota.value = r && r.nota ? r.nota : '';
      auto.hidden = !(r && r.auto);
      auto.textContent = r && r.auto ? `Read automatically · ${r.auto}` : '';
      const squadre = stato.ultimo.squadre || [];
      const parola = PC.letturaAutomatica.parolaMarchio(g.atteso, squadre);
      const zone = PC.letturaAutomatica.zoneLette(g, stato.ultimo.letture || new Map(), squadre);
      lette.forEach((n, i) => { n.hidden = !zone[i] || Boolean(r && r.auto); n.textContent = zone[i] ? `${parola} read` : ''; });
      avanz.textContent = testoTestata();
    }
    stato.aggiorna.push(aggiorna);
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
      const letta = el('span', { class: 'rev-letto' });
      lette.push(letta);
      sezione.appendChild(el('div', { class: 'rev-zona' }, el('span', { class: 'rev-nome' }, z.zona, letta), box));
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
      img.addEventListener('load', () => { if (stato && giro === stato.giro) aCapo(box, img, img.naturalWidth, img.naturalHeight); }, { once: true });
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
    aCapo(box, v, v.videoWidth, v.videoHeight);
    return v;
  }

  const TRA_RIGHE = 6; // px tra le righe di una striscia andata a capo (si vede la scacchiera)
  const PADDING = 16; // padding del media, 8 px per lato

  // Una striscia troppo sottile per il riquadro (PC.revisione.righeStriscia) va a capo su più righe ingrandite, disegnate in un
  // canvas a ogni fotogramma: si vede tutta, senza tagli. Il media resta nel riquadro, nascosto, e continua a girare
  // (Restart e il cambio di slot lo trovano come gli altri). Si decide di nuovo a ogni cambio di larghezza del riquadro:
  // anche un riquadro ancora senza larghezza (finestra nascosta) o una finestra allargata / ristretta dopo.
  function aCapo(box, fonte, larghezza, altezza) {
    let tela = null;
    let spiega = null;
    let schema = null;
    let misurato = -1;
    let fermo = false;
    function disegna() {
      if (!tela || !schema) return;
      const g = tela.getContext('2d');
      g.clearRect(0, 0, tela.width, tela.height);
      for (let i = 0; i < schema.righe; i++) {
        const da = i * schema.passo;
        const largo = Math.min(schema.larghezzaRiga, larghezza - da);
        g.drawImage(fonte, da, 0, largo, altezza, 0, i * (schema.altezzaRiga + TRA_RIGHE) * schema.dpr,
          tela.width * largo / schema.larghezzaRiga, schema.altezzaRiga * schema.dpr);
      }
    }
    function ciclo() {
      if (fermo || !tela) return;
      if (fonte.currentTime !== schema.mostrato) { schema.mostrato = fonte.currentTime; disegna(); }
      requestAnimationFrame(ciclo);
    }
    function misura() {
      const spazio = box.clientWidth - PADDING;
      if (fermo || spazio <= 0 || spazio === misurato) return;
      misurato = spazio;
      const s = PC.revisione.righeStriscia(larghezza, altezza, spazio);
      if (s.righe === 1) { // ci sta su una riga: il media com'è
        if (tela) { tela.remove(); spiega.remove(); tela = null; schema = null; fonte.hidden = false; }
        return;
      }
      const nuova = !tela;
      if (nuova) {
        tela = el('canvas', { role: 'img', 'aria-label': fonte.getAttribute('aria-label') || fonte.getAttribute('alt') || '' });
        spiega = el('p', { class: 'rev-righe' });
        fonte.hidden = true;
        box.append(tela, spiega);
      }
      const dpr = window.devicePixelRatio || 1;
      tela.width = Math.round(spazio * dpr);
      tela.height = Math.round((s.righe * s.altezzaRiga + (s.righe - 1) * TRA_RIGHE) * dpr);
      schema = { ...s, dpr, mostrato: -1 };
      spiega.textContent = `Shown on ${s.righe} rows, left to right: each row starts with the end of the one above.`;
      disegna();
      if (nuova && fonte.tagName === 'VIDEO') requestAnimationFrame(ciclo);
    }
    // misura al fotogramma dopo: cambiare l'altezza del canvas dentro il callback farebbe ripartire l'osservatore
    const osservatore = new ResizeObserver(() => requestAnimationFrame(misura));
    misura();
    osservatore.observe(box);
    stato.ferma.push(() => { fermo = true; osservatore.disconnect(); });
  }

  PC.revisioneUi = { scheda, segnaScheda, apri, chiudi, aggiornaLettura };
})(window.PC = window.PC || {});
