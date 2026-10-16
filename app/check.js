/* Playlist Check — scheda Check: caricamento dei due file, controllo, conferme e report. */
(function (PC) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const stato = { excel: null, air: null }; // { file, dati (modello letto) }
  let ultimo = null; // { idControllo, risultatoOriginale, risultato, nomiFile, risposte: Map, coppie }
  // Dopo un controllo concluso la coppia è chiusa: il file successivo ne apre una nuova, così un file nuovo
  // non viene mai confrontato con quello della partita precedente.
  let coppiaChiusa = false;
  const testoIniziale = {}; // testo delle due aree vuote, letto dalla pagina

  const testo = (t) => document.createTextNode(t == null ? '' : String(t));
  function el(tag, attributi = {}, ...figli) {
    const n = document.createElement(tag);
    Object.entries(attributi).forEach(([k, v]) => { if (k === 'class') n.className = v; else n.setAttribute(k, v); });
    figli.flat().forEach((f) => n.appendChild(typeof f === 'string' || typeof f === 'number' ? testo(f) : f));
    return n;
  }

  const tipoDaNome = (nome) => (/\.(xlsx|xlsm)$/i.test(nome) ? 'excel' : /\.zip$/i.test(nome) ? 'air' : null);

  function mostraFile(tipo, messaggio, classe) {
    const box = $(tipo === 'excel' ? 'carica-excel' : 'carica-air');
    box.classList.remove('pronto', 'sbagliato');
    if (classe) box.classList.add(classe);
    box.querySelector('.carica-file').textContent = messaggio;
  }

  function erroreFile(tipo, messaggio) {
    const box = $(tipo === 'excel' ? 'carica-excel' : 'carica-air');
    const e = box.querySelector('.carica-errore');
    e.textContent = messaggio || '';
    e.hidden = !messaggio;
    if (messaggio) box.classList.add('sbagliato');
  }

  // Svuota le due aree e i risultati: si riparte con una coppia nuova.
  function nuovoControllo() {
    stato.excel = null;
    stato.air = null;
    ['excel', 'air'].forEach((tipo) => { mostraFile(tipo, testoIniziale[tipo]); erroreFile(tipo, ''); });
    $('check-risultati').hidden = true;
    $('check-stato').hidden = true;
    ultimo = null;
    PC.check.ultimo = null;
    coppiaChiusa = false;
    $('btn-nuovo').hidden = true;
  }

  // Ogni file va nell'area giusta in base all'estensione, anche se trascinato nell'altra.
  async function carica(files, areaPreferita) {
    if (coppiaChiusa) nuovoControllo();
    // alias approvati in Settings, riletti mentre si leggono i file (al massimo 5 secondi; se lo script non risponde restano quelli di prima)
    const aliasAggiornati = PC.alias.aggiorna(PC.app.regole.servizio);
    // i risultati sullo schermo valgono per la coppia precedente: via finché il nuovo controllo non è finito
    $('check-risultati').hidden = true;
    ultimo = null;
    PC.check.ultimo = null;
    for (const f of files) {
      const tipo = tipoDaNome(f.name) || areaPreferita;
      if (!tipoDaNome(f.name)) {
        erroreFile(areaPreferita, `“${f.name}” is not an Excel workbook (.xlsx) or a zip file.`);
        continue;
      }
      erroreFile(tipo, '');
      mostraFile(tipo, f.name + ' · reading…');
      try {
        const buffer = await f.arrayBuffer();
        const dati = tipo === 'excel' ? PC.letturaExcel.leggiExcel(buffer, window.XLSX) : await PC.letturaAir.leggiAir(buffer, window.JSZip);
        stato[tipo] = { file: f, dati };
        mostraFile(tipo, f.name, 'pronto');
      } catch (e) {
        stato[tipo] = null;
        mostraFile(tipo, f.name);
        erroreFile(tipo, e.message);
      }
    }
    $('btn-nuovo').hidden = !(stato.excel || stato.air);
    await aliasAggiornati;
    if (stato.excel && stato.air) esegui();
  }

  function esegui() {
    $('check-stato').hidden = false;
    $('check-stato').textContent = 'Checking…';
    setTimeout(() => {
      try {
        const risultato = PC.confronto.verifica(stato.excel.dati, stato.air.dati, PC.alias.regoleCon(PC.app.regole));
        ultimo = {
          idControllo: crypto.randomUUID(),
          dataControllo: new Date().toISOString(),
          risultatoOriginale: risultato,
          risultato,
          nomiFile: { excel: stato.excel.file.name, air: stato.air.file.name },
          risposte: new Map(),
          coppie: PC.report.coppieDaConfermare(risultato.esiti),
        };
        PC.check.ultimo = ultimo;
        coppiaChiusa = true;
        $('check-stato').hidden = true;
        disegna();
        document.dispatchEvent(new CustomEvent('pc:controllo-finito', { detail: ultimo }));
        if (!ultimo.coppie.length) document.dispatchEvent(new CustomEvent('pc:risposte-complete', { detail: ultimo }));
      } catch (e) {
        $('check-stato').textContent = 'The check could not be completed: ' + e.message;
      }
    }, 30);
  }

  function disegnaRiepilogo() {
    const r = ultimo.risultato.riepilogo;
    const air = stato.air.dati;
    const feed = air.stream.map((s) => s.nome);
    const segmenti = [...new Set(air.stream.flatMap((s) => s.segmenti.map((g) => g.nome)))];
    const box = $('check-riepilogo');
    box.replaceChildren(el('h2', {}, 'Summary'), el('dl', {},
      el('dt', {}, 'Match'), el('dd', {}, r.partita),
      el('dt', {}, 'AIR event'), el('dd', {}, [r.evento, r.dataEvento, r.venue].filter(Boolean).join(' · ')),
      el('dt', {}, 'Feeds'), el('dd', {}, feed.join(', ')),
      el('dt', {}, 'Segments'), el('dd', {}, segmenti.join(', ')),
      el('dt', {}, 'Cells checked'), el('dd', {}, ultimo.risultato.celle.toLocaleString('en-GB'))));
    if (r.partiteDiverse) box.appendChild(el('p', { class: 'errore' }, 'Excel and AIR package seem to be different matches: check that you loaded the right pair.'));
  }

  function disegnaBanner() {
    const e = PC.report.esito(ultimo.risultato.esiti);
    const b = $('check-banner');
    b.className = 'banner ' + e.colore;
    b.textContent = e.testo;
  }

  const nomeTipo = (t) => (t === 'Possible alias' ? 'alias' : 'typo');

  function disegnaConferme() {
    const box = $('check-conferme');
    box.hidden = !ultimo.coppie.length;
    const elenco = $('check-elenco-conferme');
    elenco.replaceChildren(...ultimo.coppie.map((c) => {
      const risposta = ultimo.risposte.get(c.chiave);
      const celle = c.gruppi.reduce((n, g) => n + g.conta, 0);
      const feed = [...new Set(c.gruppi.map((g) => g.feed))];
      const conferma = el('button', { type: 'button', class: 'bottone' + (risposta === 'confirm' ? ' attivo' : '') }, 'Confirm');
      const respingi = el('button', { type: 'button', class: 'bottone' + (risposta === 'reject' ? ' attivo' : '') }, `Not ${c.tipo === 'Possible alias' ? 'an alias' : 'a typo'}`);
      conferma.addEventListener('click', () => rispondi(c.chiave, 'confirm'));
      respingi.addEventListener('click', () => rispondi(c.chiave, 'reject'));
      return el('div', { class: 'conferma' + (risposta ? ' risposta-' + risposta : '') },
        el('div', { class: 'coppia' }, `Possible ${nomeTipo(c.tipo)}: Excel `, el('b', {}, c.atteso), ' ↔ AIR ', el('b', {}, c.trovato)),
        el('div', { class: 'dove' }, `${celle} cell${celle === 1 ? '' : 's'} · ${feed.join(', ')}`),
        el('div', { class: 'azioni' }, conferma, respingi));
    }));
  }

  function rispondi(chiave, risposta) {
    ultimo.risposte.set(chiave, risposta);
    ultimo.risultato = { ...ultimo.risultatoOriginale, esiti: PC.report.applicaRisposte(ultimo.risultatoOriginale.esiti, ultimo.risposte) };
    disegna();
    if (ultimo.coppie.every((c) => ultimo.risposte.has(c.chiave))) {
      document.dispatchEvent(new CustomEvent('pc:risposte-complete', { detail: ultimo }));
    }
  }

  function opzioni(select, valori, tutti) {
    const scelto = select.value;
    select.replaceChildren(el('option', { value: '' }, tutti), ...valori.map((v) => el('option', { value: v }, v)));
    if (valori.includes(scelto)) select.value = scelto;
  }

  function disegnaTabella() {
    const visibili = ultimo.risultato.esiti.filter((e) => e.tipo !== 'Variant' && e.tipo !== 'Correct');
    const gruppi = PC.report.raggruppa(visibili);
    opzioni($('filtro-feed'), [...new Set(gruppi.map((g) => g.feed))].sort(), 'All feeds');
    opzioni($('filtro-tipo'), PC.report.ORDINE.filter((t) => gruppi.some((g) => g.tipo === t)), 'All types');
    const feed = $('filtro-feed').value, tipo = $('filtro-tipo').value;
    const righe = gruppi.filter((g) => (!feed || g.feed === feed) && (!tipo || g.tipo === tipo));
    $('check-tabella').tBodies[0].replaceChildren(...righe.map((g) => el('tr', {},
      el('td', {}, el('span', { class: 'etichetta ' + g.tipo.split(' ')[0] }, g.tipo)),
      el('td', {}, g.feed), el('td', {}, g.segmento),
      el('td', { class: 'id' }, PC.report.idCompatti(g.ids)),
      el('td', {}, g.colonna), el('td', {}, g.zone.join(', ')),
      el('td', {}, g.atteso), el('td', {}, g.trovato))));
    $('check-vuota').hidden = righe.length > 0;
  }

  function disegnaVarianti() {
    const varianti = PC.report.raggruppa(ultimo.risultato.esiti.filter((e) => e.tipo === 'Variant'));
    const coppie = new Map();
    varianti.forEach((g) => {
      const k = [g.feed, g.colonna, g.atteso, PC.nomi.chiaveBrand(g.trovato).chiave].join('|');
      if (!coppie.has(k)) coppie.set(k, { feed: g.feed, colonna: g.colonna, atteso: g.atteso, trovato: PC.nomi.chiaveBrand(g.trovato).chiave, conta: 0 });
      coppie.get(k).conta += g.conta;
    });
    const box = $('check-varianti');
    box.hidden = !coppie.size;
    $('check-varianti-conta').textContent = `(${coppie.size})`;
    box.querySelector('tbody').replaceChildren(...[...coppie.values()].map((c) => el('tr', {},
      el('td', {}, c.feed), el('td', {}, c.colonna), el('td', {}, c.atteso), el('td', {}, c.trovato), el('td', {}, c.conta))));
  }

  function disegna() {
    $('check-risultati').hidden = false;
    disegnaRiepilogo();
    disegnaBanner();
    disegnaConferme();
    disegnaTabella();
    disegnaVarianti();
  }

  // ---------- script Google: storico e mail (solo numeri e coppie di nomi, mai i file) ----------
  const MOTIVI = {
    'not configured': 'the service is not set up yet',
    'no recipients': 'no recipients are set in Settings',
    'rate limit': 'too many emails this hour, try again later',
    unreachable: 'the service could not be reached',
    'unknown action': 'the Google script needs updating',
  };
  const motivo = (r) => MOTIVI[r.errore] || r.errore || 'unknown error';

  function messaggioServizio(id, testoMsg, classe, riprova) {
    const p = $(id);
    p.hidden = !testoMsg;
    p.classList.remove('male', 'bene');
    if (classe) p.classList.add(classe);
    p.replaceChildren(testo(testoMsg || ''));
    if (riprova) {
      const b = el('button', { type: 'button', class: 'bottone' }, 'Retry');
      b.addEventListener('click', riprova);
      p.appendChild(b);
    }
  }

  const PARTITE_DIVERSE = 'Excel and AIR package seem to be different matches';

  async function salvaStorico() {
    const questo = ultimo;
    if (!PC.report.coppiaGiusta(questo.risultatoOriginale)) {
      messaggioServizio('check-storico', `Not saved to Statistics: ${PARTITE_DIVERSE}.`, 'male');
      return;
    }
    const r = await PC.servizio.chiama(PC.app.regole.servizio, 'salvaControllo', PC.report.rigaControllo(questo));
    if (questo !== ultimo) return;
    if (r.ok) messaggioServizio('check-storico', '');
    else messaggioServizio('check-storico', `Couldn't save statistics: ${motivo(r)}.`, 'male', salvaStorico);
  }

  // Coppie confermate → foglio Aliases dello script come proposte, da rendere ufficiali in Settings (una volta per controllo).
  async function proponiAlias() {
    const questo = ultimo;
    const coppie = PC.alias.proposte(questo);
    if (!coppie.length || questo.aliasProposti || !PC.report.coppiaGiusta(questo.risultatoOriginale)) return;
    const r = await PC.servizio.chiama(PC.app.regole.servizio, 'proponiAlias', { partita: questo.risultatoOriginale.riepilogo.partita, coppie });
    if (questo !== ultimo) return;
    if (r.ok) {
      questo.aliasProposti = true;
      PC.alias.imposta(r.righe);
      messaggioServizio('check-alias', 'Confirmed names saved: an admin can make them official in Settings → Aliases.', 'bene');
    } else {
      messaggioServizio('check-alias', `Couldn't save the confirmed names for Settings: ${motivo(r)}.`, 'male', proponiAlias);
    }
  }

  // La mail parte una sola volta per controllo, quando ogni coppia ha una risposta e almeno una è confermata.
  async function inviaMail() {
    const questo = ultimo;
    const coppie = PC.report.coppieConfermate(questo);
    if (!coppie.length || questo.mailInviata || questo.mailInCorso) return;
    if (!PC.report.coppiaGiusta(questo.risultatoOriginale)) {
      messaggioServizio('check-invio', `No email sent: ${PARTITE_DIVERSE}.`, 'male');
      return;
    }
    questo.mailInCorso = true;
    messaggioServizio('check-invio', 'Sending email…');
    const r = await PC.servizio.chiama(PC.app.regole.servizio, 'inviaRefusi', { partita: questo.risultatoOriginale.riepilogo.partita, coppie });
    questo.mailInCorso = false;
    if (questo !== ultimo) return;
    if (r.ok) {
      questo.mailInviata = true;
      messaggioServizio('check-invio', `Sent to ${r.inviati} recipient${r.inviati === 1 ? '' : 's'}.`, 'bene');
    } else {
      messaggioServizio('check-invio', `Couldn't send email: ${motivo(r)}.`, 'male', inviaMail);
    }
  }

  function scarica() {
    if (!ultimo) return;
    const dati = PC.report.esportaExcel(ultimo.risultato, ultimo.nomiFile, window.XLSX);
    const nome = `Playlist Check – ${ultimo.risultato.riepilogo.partita.replace(/[\\/:*?"<>|]/g, '-')}.xlsx`;
    PC.archivio.scarica(nome, new Blob([dati], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }

  function collega() {
    document.querySelectorAll('.carica').forEach((box) => {
      testoIniziale[box.dataset.tipo] = box.querySelector('.carica-file').textContent;
      const input = box.querySelector('input[type=file]');
      input.addEventListener('change', () => { if (input.files.length) carica([...input.files], box.dataset.tipo); input.value = ''; });
      box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('sopra'); });
      box.addEventListener('dragleave', () => box.classList.remove('sopra'));
      box.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        box.classList.remove('sopra');
        carica([...e.dataTransfer.files], box.dataset.tipo);
      });
    });
    // file lasciati cadere fuori dalle aree: non aprirli nel browser, smistarli per estensione
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length && !$('vista-check').hidden) carica([...e.dataTransfer.files], 'excel');
    });
    $('filtro-feed').addEventListener('change', disegnaTabella);
    $('filtro-tipo').addEventListener('change', disegnaTabella);
    $('btn-scarica').addEventListener('click', scarica);
    $('btn-nuovo').addEventListener('click', nuovoControllo);
    document.addEventListener('pc:controllo-finito', () => { messaggioServizio('check-invio', ''); messaggioServizio('check-alias', ''); salvaStorico(); });
    // senza coppie da confermare lo storico è già stato salvato a fine controllo: si aggiorna solo dopo le risposte
    document.addEventListener('pc:risposte-complete', async () => { if (!ultimo.coppie.length) return; proponiAlias(); await inviaMail(); salvaStorico(); });
  }

  PC.check = { carica, ultimo: null };
  document.addEventListener('DOMContentLoaded', collega);
})(window.PC = window.PC || {});
