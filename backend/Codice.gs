/**
 * Playlist Check — script Google: storico dei controlli, mail dei refusi/alias confermati, destinatari.
 *
 * Va incollato nell'editor Apps Script di un Google Sheet (Estensioni → Apps Script) e pubblicato come
 * applicazione web ("Esegui come: me", "Chi ha accesso: chiunque"). Proprietà dello script:
 *   CODICE          codice segreto, lo stesso delle regole cifrate della pagina
 *   ADMIN_PASSWORD  password admin per Settings: alla prima chiamata diventa ADMIN_HASH + ADMIN_SALE e sparisce
 * Nessun file della pagina arriva qui: solo numeri del controllo e coppie di nomi confermate.
 */

var LIMITE_MAIL_ORA = 20;
var LIMITE_TENTATIVI_ADMIN = 5; // password admin sbagliate…
var FINESTRA_TENTATIVI_MS = 15 * 60 * 1000; // …in 15 minuti, poi si aspetta
var CAMPI_CONTROLLO = ['idControllo', 'dataControllo', 'dataEvento', 'partita', 'casa', 'ospite', 'venue', 'fileExcel', 'fileAir',
  'celle', 'corrette', 'errori', 'refusiTrovati', 'confermati', 'respinti', 'avvisi'];
var EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
// Campi testo che Google Sheets trasformerebbe in date (con lo slittamento del fuso orario): si salvano con l'apostrofo.
var CAMPI_DATA = ['dataControllo', 'dataEvento'];

function doPost(e) {
  var risposta;
  var richiesta;
  try {
    richiesta = JSON.parse(e.postData.contents);
  } catch (err) {
    richiesta = null;
  }
  // Le richieste arrivano anche insieme (es. due salvataggi dello stesso controllo): una alla volta, sotto il blocco dello script.
  var blocco = LockService.getScriptLock();
  try {
    blocco.waitLock(20000);
  } catch (err) {
    return risposta_({ ok: false, errore: 'busy' });
  }
  try {
    risposta = richiesta ? gestisci(richiesta) : { ok: false, errore: 'bad request' };
  } catch (err) {
    // il motivo serve per capire i problemi di configurazione (es. script non creato dal foglio Google)
    console.error(err);
    risposta = { ok: false, errore: 'bad request', dettaglio: String((err && err.message) || err) };
  } finally {
    blocco.releaseLock();
  }
  return risposta_(risposta);
}

function risposta_(r) {
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

function gestisci(r) {
  var p = PropertiesService.getScriptProperties();
  proteggiPasswordAdmin(p);
  if (!r || !p.getProperty('CODICE') || r.codice !== p.getProperty('CODICE')) return { ok: false, errore: 'unauthorised' };
  var dati = r.dati || {};
  switch (r.azione) {
    case 'salvaControllo': return salvaControllo(dati);
    case 'elencoControlli': return { ok: true, righe: elencoControlli() };
    case 'destinatari': return { ok: true, indirizzi: destinatari() };
    case 'salvaDestinatari': return verificaAdmin(p, dati.password) || salvaDestinatari(dati.indirizzi);
    case 'inviaRefusi': return inviaRefusi(p, dati);
    case 'mailDiProva': return verificaAdmin(p, dati.password) || mailDiProva(p);
    default: return { ok: false, errore: 'unknown action' };
  }
}

// ---------- password admin: in chiaro solo finché non arriva la prima chiamata ----------
function impronta(sale, testo) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sale + testo)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function proteggiPasswordAdmin(p) {
  var chiara = p.getProperty('ADMIN_PASSWORD');
  if (!chiara) return;
  var sale = Utilities.getUuid();
  p.setProperties({ ADMIN_SALE: sale, ADMIN_HASH: impronta(sale, chiara) });
  p.deleteProperty('ADMIN_PASSWORD');
}

function adminOk(p, password) {
  var sale = p.getProperty('ADMIN_SALE');
  return Boolean(password && sale && impronta(sale, String(password)) === p.getProperty('ADMIN_HASH'));
}

// null se la password admin va bene, altrimenti la risposta d'errore. Dopo LIMITE_TENTATIVI_ADMIN tentativi sbagliati
// nella finestra si aspetta, anche con la password giusta; un accesso giusto azzera il conto.
function verificaAdmin(p, password) {
  var adesso = new Date().getTime();
  var stato = JSON.parse(p.getProperty('ADMIN_ERRORI') || '{"n":0,"da":0}');
  if (adesso - stato.da > FINESTRA_TENTATIVI_MS) stato = { n: 0, da: adesso };
  if (stato.n >= LIMITE_TENTATIVI_ADMIN) return { ok: false, errore: 'too many attempts' };
  if (adminOk(p, password)) {
    if (stato.n) p.deleteProperty('ADMIN_ERRORI');
    return null;
  }
  stato.n++;
  p.setProperty('ADMIN_ERRORI', JSON.stringify(stato));
  return { ok: false, errore: 'wrong admin password' };
}

// ---------- fogli ----------
// Testi che Google Sheets leggerebbe come formule (iniziano con = + - @, tab o a capo): salvati come testo con l'apostrofo.
function comeTesto(v) {
  return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function foglio(nome, intestazione) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('no spreadsheet: create the script from the Google Sheet (Extensions → Apps Script)');
  var f = ss.getSheetByName(nome);
  if (!f) {
    f = ss.insertSheet(nome);
    if (intestazione) { f.appendRow(intestazione); f.setFrozenRows(1); }
  }
  return f;
}

function salvaControllo(d) {
  if (!d || !d.idControllo) return { ok: false, errore: 'missing idControllo' };
  var f = foglio('Checks', CAMPI_CONTROLLO);
  var riga = CAMPI_CONTROLLO.map(function (c) {
    var v = d[c] === undefined || d[c] === null ? '' : d[c];
    return CAMPI_DATA.indexOf(c) >= 0 && v !== '' ? "'" + v : comeTesto(v);
  });
  var valori = f.getDataRange().getValues();
  for (var i = 1; i < valori.length; i++) {
    if (String(valori[i][0]) === String(d.idControllo)) {
      f.getRange(i + 1, 1, 1, riga.length).setValues([riga]);
      return { ok: true };
    }
  }
  f.appendRow(riga);
  return { ok: true };
}

function elencoControlli() {
  var valori = foglio('Checks', CAMPI_CONTROLLO).getDataRange().getValues();
  return valori.slice(1).map(function (r) {
    var o = {};
    CAMPI_CONTROLLO.forEach(function (c, i) {
      var v = r[i] instanceof Date ? r[i].toISOString() : r[i];
      o[c] = typeof v === 'string' && v.charAt(0) === "'" ? v.slice(1) : v;
    });
    return o;
  });
}

function destinatari() {
  return foglio('Recipients').getDataRange().getValues()
    .map(function (r) { return String(r[0] || '').trim().replace(/^'/, ''); }).filter(function (x) { return x; });
}

function salvaDestinatari(indirizzi) {
  var puliti = [];
  (indirizzi || []).forEach(function (x) { x = String(x).trim(); if (x && puliti.indexOf(x) < 0) puliti.push(x); });
  var errati = puliti.filter(function (x) { return !EMAIL.test(x); });
  if (errati.length) return { ok: false, errore: 'invalid address', errati: errati };
  var f = foglio('Recipients');
  f.clearContents();
  if (puliti.length) f.getRange(1, 1, puliti.length, 1).setValues(puliti.map(function (x) { return [comeTesto(x)]; }));
  return { ok: true, indirizzi: puliti };
}

// ---------- mail ----------
// Contatore per ora (UTC) nelle proprietà: al massimo LIMITE_MAIL_ORA mail.
function prendiPermessoMail(p) {
  var ora = new Date().toISOString().slice(0, 13);
  var stato = JSON.parse(p.getProperty('MAIL_ORA') || '{}');
  if (stato.ora !== ora) stato = { ora: ora, n: 0 };
  if (stato.n >= LIMITE_MAIL_ORA) return false;
  stato.n++;
  p.setProperty('MAIL_ORA', JSON.stringify(stato));
  return true;
}

function esc(t) {
  return String(t === undefined || t === null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inviaRefusi(p, d) {
  var a = destinatari();
  if (!a.length) return { ok: false, errore: 'no recipients' };
  if (!prendiPermessoMail(p)) return { ok: false, errore: 'rate limit' };
  var coppie = d.coppie || [];
  var celle = 'style="border:1px solid #cfd3da;padding:6px 8px;text-align:left"';
  var righe = coppie.map(function (c) {
    return '<tr>' + [c.tipo, c.feed, c.segmento, c.id, c.colonna, c.excel, c.air].map(function (v) { return '<td ' + celle + '>' + esc(v) + '</td>'; }).join('') + '</tr>';
  }).join('');
  var html = '<p>These names were confirmed as the same brand during a Playlist Check of <b>' + esc(d.partita) + '</b>. '
    + 'If they are right, ask for them to be added to the official aliases.</p>'
    + '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px"><tr>'
    + ['Type', 'Feed', 'Segment', 'ID', 'Column', 'Excel', 'AIR'].map(function (h) { return '<th ' + celle + '>' + h + '</th>'; }).join('')
    + '</tr>' + righe + '</table>';
  var testo = coppie.map(function (c) { return [c.tipo, c.feed, c.segmento, 'ID ' + c.id, c.colonna, 'Excel: ' + c.excel, 'AIR: ' + c.air].join(' · '); }).join('\n');
  MailApp.sendEmail({ to: a.join(','), subject: 'Playlist Check · possible typos · ' + d.partita, htmlBody: html, body: testo, name: 'Playlist Check' });
  return { ok: true, inviati: a.length };
}

function mailDiProva(p) {
  var a = destinatari();
  if (!a.length) return { ok: false, errore: 'no recipients' };
  if (!prendiPermessoMail(p)) return { ok: false, errore: 'rate limit' };
  MailApp.sendEmail({ to: a.join(','), subject: 'Playlist Check · test email', body: 'This is a test email from Playlist Check: the recipients are set up correctly.', name: 'Playlist Check' });
  return { ok: true, inviati: a.length };
}
