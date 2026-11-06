/* Playlist Check — lettura automatica del marchio nel browser, in sottofondo dopo il controllo.
   tesseract.js (lib/tesseract, caricato solo qui e solo quando serve) legge il testo di alcuni fotogrammi delle animazioni:
   i file restano nel browser. Quale parola cercare e quando un gruppo è letto: lettura-automatica.js. */
(function (PC) {
  'use strict';

  const CARTELLA = 'lib/tesseract';
  const FOTOGRAMMI = 6; // per un video: a 1/12, 3/12 … 11/12 della durata
  const ATTESA = 8000; // un video che non si apre o non si sposta entro 8 s si salta
  const ERRORI = 3; // tre file di fila che non si leggono: la lettura in questo browser non va
  const LARGO = 8000; // la versione in grigio non supera questa larghezza: ×2 per i fotogrammi normali, ridotta per le strisce
  // lunghe del Vault (11.720 px), dove ingrandire costa secondi e il grigio con più contrasto basta a leggere
  const IMMAGINE = /\.(png|jpe?g|gif|webp)$/i;
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

  let lettore = null; // Promise del worker di tesseract: si crea alla prima lettura e serve anche ai controlli dopo
  let giro = 0; // ogni lettura ha il suo numero: ferma() e una nuova avvia() fermano quella in corso

  // indirizzi interi: il worker li apre dalla sua cartella, non da quella della pagina
  const indirizzo = (file) => new URL(`${CARTELLA}/${file}`, document.baseURI).href;

  function caricaScript(src) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => ko(new Error('library not loaded'));
      document.head.appendChild(s);
    });
  }

  // worker dal sito (non da un blob), dati inglesi dalla stessa cartella (eng.traineddata.gz), niente copia in IndexedDB
  function preparaLettore() {
    if (!lettore) {
      lettore = (async () => {
        if (!window.Tesseract) await caricaScript(indirizzo('tesseract.min.js'));
        const w = await window.Tesseract.createWorker('eng', 1, {
          workerPath: indirizzo('worker.min.js'),
          corePath: indirizzo('tesseract-core-simd-lstm.wasm.js'),
          langPath: new URL(CARTELLA, document.baseURI).href,
          workerBlobURL: false,
          cacheMethod: 'none',
          gzip: true,
        });
        // testo sparso (scritte sparse nel fotogramma); i messaggi di servizio di tesseract non vanno nella console
        await w.setParameters({ tessedit_pageseg_mode: window.Tesseract.PSM.SPARSE_TEXT, debug_file: '/dev/null' });
        return w;
      })();
      lettore.catch(() => { lettore = null; });
    }
    return lettore;
  }

  function attendi(el, evento) {
    return new Promise((ok, ko) => {
      const bene = () => fine(null);
      const male = () => fine(new Error('media'));
      const t = setTimeout(() => fine(new Error('timeout')), ATTESA);
      function fine(errore) {
        clearTimeout(t);
        el.removeEventListener(evento, bene);
        el.removeEventListener('error', male);
        if (errore) ko(errore); else ok();
      }
      el.addEventListener(evento, bene);
      el.addEventListener('error', male);
    });
  }

  function tela(sorgente, larghezza, altezza, scala = 1) {
    const c = document.createElement('canvas');
    c.width = Math.round(larghezza * scala);
    c.height = Math.round(altezza * scala);
    const ctx = c.getContext('2d', { willReadFrequently: scala !== 1 });
    // fondo nero come i LED spenti: le parti trasparenti dei png non diventano bianche (scritte bianche illeggibili)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sorgente, 0, 0, c.width, c.height);
    return c;
  }

  // Lo stesso fotogramma in grigio, contrasto 1,3, ingrandito ×2 (fino a LARGO): si leggono scritte piccole o su fondi colorati.
  function grigio(originale) {
    const c = tela(originale, originale.width, originale.height, Math.min(2, LARGO / originale.width));
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data; // Uint8ClampedArray: i valori fuori da 0–255 si fermano ai bordi
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = (y - 128) * 1.3 + 128;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Fotogrammi del file, uno alla volta: 1 per un'immagine, FOTOGRAMMI per un video.
  // Un file che il browser non apre (es. video FFV1) non dà fotogrammi: non è un errore del lettore.
  async function* fotogrammi(byte, file) {
    const est = ((/\.([a-z0-9]+)$/i.exec(file) || [])[1] || '').toLowerCase();
    const immagine = IMMAGINE.test(file);
    const url = URL.createObjectURL(new Blob([byte], { type: immagine ? MIME[est] : 'video/mp4' }));
    let v = null;
    try {
      if (immagine) {
        const img = new Image();
        const caricata = attendi(img, 'load'); // non img.decode(): in alcuni browser non finisce per un'immagine fuori dalla pagina
        img.src = url;
        try { await caricata; } catch (e) { return; }
        yield tela(img, img.naturalWidth, img.naturalHeight);
        return;
      }
      v = document.createElement('video');
      v.muted = true;
      v.preload = 'auto';
      const aperto = attendi(v, 'loadeddata');
      v.src = url;
      try { await aperto; } catch (e) { return; }
      const durata = v.duration;
      if (!(durata > 0) || !Number.isFinite(durata) || !v.videoWidth) return;
      for (let i = 0; i < FOTOGRAMMI; i++) {
        const spostato = attendi(v, 'seeked');
        v.currentTime = (durata * (i + 0.5)) / FOTOGRAMMI;
        try { await spostato; } catch (e) { return; }
        yield tela(v, v.videoWidth, v.videoHeight);
      }
    } finally {
      if (v) { v.removeAttribute('src'); v.load(); }
      URL.revokeObjectURL(url);
    }
  }

  // Legge il file finché non ha trovato tutte le parole cercate o finito i fotogrammi; ogni fotogramma com'è e, se serve, in grigio.
  // Restituisce le parole trovate, o null se la lettura è stata fermata.
  async function leggiFile(w, file, cercate, ultimo, mio) {
    const LA = PC.letturaAutomatica;
    const trovate = new Set();
    let byte = null;
    try { byte = await ultimo.media(file); } catch (e) { /* non si legge dallo zip: resta da guardare a occhio */ }
    if (mio !== giro) return null;
    if (!byte) return trovate;
    for await (const fotogramma of fotogrammi(byte, file)) {
      for (const versione of [() => fotogramma, () => grigio(fotogramma)]) {
        if (mio !== giro) return null;
        const { data } = await w.recognize(versione());
        const lette = LA.parole(data.text);
        cercate.forEach((p) => { if (LA.trovata(p, lette)) trovate.add(p); });
        if (trovate.size === cercate.size) return trovate;
      }
    }
    return trovate;
  }

  // Legge in sottofondo i file del controllo, nell'ordine delle schermate; dopo ogni file mette le risposte automatiche
  // (ultimo.risposteVisive) e chiama aggiorna(). Stato in ultimo.lettura: { stato: 'in corso' | 'finita' | 'non disponibile', letti, totale }.
  async function avvia(ultimo, aggiorna) {
    const LA = PC.letturaAutomatica;
    const mio = ++giro;
    const squadre = [ultimo.risultato.casa, ultimo.risultato.ospite].filter(Boolean);
    const letti = new Set();
    const restanti = () => [...LA.daLeggere(ultimo.schermate, ultimo.risposteVisive, squadre)].filter(([file]) => !letti.has(file));
    ultimo.squadre = squadre;
    ultimo.letture = new Map();
    ultimo.lettura = { stato: 'in corso', letti: 0, totale: restanti().length };
    if (!ultimo.lettura.totale) {
      ultimo.lettura.stato = 'finita';
      aggiorna();
      return;
    }
    aggiorna();
    let w;
    try {
      w = await preparaLettore();
    } catch (e) {
      if (mio === giro) { ultimo.lettura.stato = 'non disponibile'; aggiorna(); }
      return;
    }
    let errori = 0;
    for (let r = restanti(); r.length && mio === giro; r = restanti()) {
      const [file, cercate] = r[0];
      letti.add(file);
      let trovate;
      try {
        trovate = await leggiFile(w, file, cercate, ultimo, mio);
        errori = 0;
      } catch (e) {
        trovate = new Set(); // errore del lettore (non del file, vedi fotogrammi): il file resta da guardare a occhio
        if (++errori >= ERRORI && lettore) {
          // tre di fila: il lettore non va più; il prossimo controllo ne crea uno nuovo
          lettore = null;
          w.terminate().catch(() => {});
          if (mio === giro) { ultimo.lettura.stato = 'non disponibile'; aggiorna(); }
          return;
        }
      }
      if (trovate === null || mio !== giro) return;
      ultimo.letture.set(file, trovate);
      LA.applica(ultimo.schermate, ultimo.risposteVisive, ultimo.letture, squadre);
      ultimo.lettura.letti = letti.size;
      ultimo.lettura.totale = letti.size + restanti().length;
      aggiorna();
    }
    if (mio === giro) { ultimo.lettura.stato = 'finita'; aggiorna(); }
  }

  // Ferma la lettura in corso (nuovo controllo o nuova coppia); il worker resta pronto per la prossima.
  function ferma() { giro++; }

  PC.letturaAutomaticaUi = { avvia, ferma };
})(window.PC = window.PC || {});
