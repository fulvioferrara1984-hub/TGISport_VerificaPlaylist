// Script Google (backend/Codice.gs): codice segreto, storico, destinatari, mail, password admin, limite orario.
const test = require('node:test');
const assert = require('node:assert/strict');
const { carica } = require('./gs.js');

const BASE = { CODICE: 'segreto', ADMIN_PASSWORD: 'admin-prova' };
const controllo = (id, extra = {}) => ({ idControllo: id, dataControllo: '2026-10-15T10:00:00Z', dataEvento: '2026-10-12', partita: 'ALFA - BETA', casa: 'ALFA', ospite: 'BETA',
  venue: 'Stadio Prova', fileExcel: 'p.xlsx', fileAir: 'a.zip', celle: 100, corrette: 90, errori: 8, refusiTrovati: 2, confermati: 0, respinti: 0, avvisi: 3, ...extra });

test('senza il codice segreto giusto: rifiutato', () => {
  const { post } = carica({ proprieta: BASE });
  assert.deepEqual(post({ codice: 'altro', azione: 'destinatari' }), { ok: false, errore: 'unauthorised' });
  assert.deepEqual(post({ azione: 'destinatari' }), { ok: false, errore: 'unauthorised' });
});

test('la password admin in chiaro diventa impronta alla prima chiamata', () => {
  const { post, prop } = carica({ proprieta: BASE });
  post({ codice: 'segreto', azione: 'destinatari' });
  assert.equal(prop.has('ADMIN_PASSWORD'), false);
  assert.ok(prop.get('ADMIN_HASH') && prop.get('ADMIN_SALE'));
  assert.ok(!prop.get('ADMIN_HASH').includes('admin-prova'));
});

test('storico: inserisce e aggiorna per idControllo', () => {
  const { post, fogli } = carica({ proprieta: BASE });
  assert.deepEqual(post({ codice: 'segreto', azione: 'salvaControllo', dati: controllo('c1') }), { ok: true });
  post({ codice: 'segreto', azione: 'salvaControllo', dati: controllo('c2') });
  post({ codice: 'segreto', azione: 'salvaControllo', dati: controllo('c1', { confermati: 2, refusiTrovati: 2 }) });
  assert.equal(fogli.Checks.length, 3); // intestazione + 2 righe
  assert.equal(fogli.Checks[0][0], 'idControllo');
  const r = post({ codice: 'segreto', azione: 'elencoControlli' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.righe.map((x) => [x.idControllo, x.confermati]), [['c1', 2], ['c2', 0]]);
  // le date restano testo (Google Sheets le convertirebbe, con lo slittamento del fuso orario)
  assert.equal(fogli.Checks[1][2], "'2026-10-12");
  assert.deepEqual([r.righe[0].dataEvento, r.righe[0].dataControllo], ['2026-10-12', '2026-10-15T10:00:00Z']);
});

test('destinatari: tutti li vedono, solo l’admin li cambia', () => {
  const { post } = carica({ proprieta: BASE });
  assert.deepEqual(post({ codice: 'segreto', azione: 'destinatari' }), { ok: true, indirizzi: [] });
  assert.deepEqual(post({ codice: 'segreto', azione: 'salvaDestinatari', dati: { password: 'sbagliata', indirizzi: ['a@esempio.it'] } }), { ok: false, errore: 'wrong admin password' });
  assert.deepEqual(post({ codice: 'segreto', azione: 'salvaDestinatari', dati: { password: 'admin-prova', indirizzi: ['a@esempio.it', 'non-valido'] } }),
    { ok: false, errore: 'invalid address', errati: ['non-valido'] });
  assert.deepEqual(post({ codice: 'segreto', azione: 'salvaDestinatari', dati: { password: 'admin-prova', indirizzi: ['a@esempio.it', 'b@esempio.it'] } }),
    { ok: true, indirizzi: ['a@esempio.it', 'b@esempio.it'] });
  assert.deepEqual(post({ codice: 'segreto', azione: 'destinatari' }), { ok: true, indirizzi: ['a@esempio.it', 'b@esempio.it'] });
});

test('mail dei refusi: a tutti i destinatari, con la tabella', () => {
  const { post, email } = carica({ proprieta: BASE });
  post({ codice: 'segreto', azione: 'salvaDestinatari', dati: { password: 'admin-prova', indirizzi: ['a@esempio.it', 'b@esempio.it'] } });
  const r = post({ codice: 'segreto', azione: 'inviaRefusi', dati: { partita: 'ALFA - BETA', coppie: [{ tipo: 'Possible typo', feed: 'Mena', segmento: '1st - 2nd Half', id: '12, 58', colonna: 'M · MENA+SSA – Second row', excel: 'belta', air: 'MELTA' }] } });
  assert.deepEqual(r, { ok: true, inviati: 2 });
  assert.equal(email.length, 1);
  assert.equal(email[0].to, 'a@esempio.it,b@esempio.it');
  assert.equal(email[0].subject, 'Playlist Check · possible typos · ALFA - BETA');
  for (const t of ['Feed', 'Segment', 'ID', 'Column', 'Excel', 'AIR', 'belta', 'MELTA', 'Mena', '12, 58']) assert.ok(email[0].htmlBody.includes(t), t);
});

test('nessun destinatario: nessuna mail', () => {
  const { post, email } = carica({ proprieta: BASE });
  assert.deepEqual(post({ codice: 'segreto', azione: 'inviaRefusi', dati: { partita: 'X', coppie: [] } }), { ok: false, errore: 'no recipients' });
  assert.equal(email.length, 0);
});

test('mail di prova solo con la password admin', () => {
  const { post, email } = carica({ proprieta: BASE });
  post({ codice: 'segreto', azione: 'salvaDestinatari', dati: { password: 'admin-prova', indirizzi: ['a@esempio.it'] } });
  assert.deepEqual(post({ codice: 'segreto', azione: 'mailDiProva', dati: { password: 'no' } }), { ok: false, errore: 'wrong admin password' });
  assert.deepEqual(post({ codice: 'segreto', azione: 'mailDiProva', dati: { password: 'admin-prova' } }), { ok: true, inviati: 1 });
  assert.equal(email[0].subject, 'Playlist Check · test email');
});

test('al massimo 20 mail all’ora', () => {
  const { post, email } = carica({ proprieta: BASE, adesso: new Date('2026-10-15T10:30:00Z') });
  post({ codice: 'segreto', azione: 'salvaDestinatari', dati: { password: 'admin-prova', indirizzi: ['a@esempio.it'] } });
  for (let i = 0; i < 20; i++) assert.equal(post({ codice: 'segreto', azione: 'inviaRefusi', dati: { partita: 'X', coppie: [] } }).ok, true);
  assert.deepEqual(post({ codice: 'segreto', azione: 'inviaRefusi', dati: { partita: 'X', coppie: [] } }), { ok: false, errore: 'rate limit' });
  assert.equal(email.length, 20);
});

test('azione sconosciuta', () => {
  const { post } = carica({ proprieta: BASE });
  assert.deepEqual(post({ codice: 'segreto', azione: 'boh' }), { ok: false, errore: 'unknown action' });
});

test('ogni richiesta lavora sotto il blocco dello script (richieste simultanee)', () => {
  const { post, blocco } = carica({ proprieta: BASE });
  post({ codice: 'segreto', azione: 'salvaControllo', dati: controllo('c1') });
  assert.deepEqual(blocco, ['wait', 'release']);
});

test('blocco occupato troppo a lungo: risposta busy, nessuna scrittura', () => {
  const { post, fogli } = carica({ proprieta: BASE, occupato: true });
  assert.deepEqual(post({ codice: 'segreto', azione: 'salvaControllo', dati: controllo('c1') }), { ok: false, errore: 'busy' });
  assert.equal(fogli.Checks, undefined);
});

test('sale e impronta della password admin scritti insieme', () => {
  const { post, scritturePropieta } = carica({ proprieta: BASE });
  post({ codice: 'segreto', azione: 'destinatari' });
  assert.deepEqual(scritturePropieta, [['ADMIN_HASH', 'ADMIN_SALE']]);
});

test('script non collegato a un foglio Google: errore con il motivo', () => {
  const { post } = carica({ proprieta: BASE, senzaFoglio: true });
  const r = post({ codice: 'segreto', azione: 'destinatari' });
  assert.equal(r.ok, false);
  assert.equal(r.errore, 'bad request');
  assert.match(r.dettaglio, /no spreadsheet/);
});

test('errore imprevisto di Google: il dettaglio arriva alla pagina', () => {
  const { post } = carica({ proprieta: BASE, guastoFoglio: 'Exception: accesso negato' });
  assert.deepEqual(post({ codice: 'segreto', azione: 'elencoControlli' }), { ok: false, errore: 'bad request', dettaglio: 'Exception: accesso negato' });
});

test('testi che sembrano formule: salvati come testo e riletti uguali', () => {
  const { post, fogli } = carica({ proprieta: BASE });
  post({ codice: 'segreto', azione: 'salvaControllo', dati: controllo('f1', { partita: '=HYPERLINK("x")', fileExcel: '+cmd.xlsx', venue: '@Stadio', fileAir: '-a.zip', celle: -1 }) });
  const riga = fogli.Checks[1];
  assert.deepEqual([riga[3], riga[6], riga[7], riga[8], riga[9]], ["'=HYPERLINK(\"x\")", "'@Stadio", "'+cmd.xlsx", "'-a.zip", -1]);
  const letta = post({ codice: 'segreto', azione: 'elencoControlli' }).righe[0];
  assert.deepEqual([letta.partita, letta.venue, letta.fileExcel, letta.fileAir, letta.celle], ['=HYPERLINK("x")', '@Stadio', '+cmd.xlsx', '-a.zip', -1]);
  post({ codice: 'segreto', azione: 'salvaDestinatari', dati: { password: 'admin-prova', indirizzi: ['=x@prova.it', 'a@prova.it'] } });
  assert.deepEqual(fogli.Recipients.map((r) => r[0]), ["'=x@prova.it", 'a@prova.it']);
  assert.deepEqual(post({ codice: 'segreto', azione: 'destinatari' }).indirizzi, ['=x@prova.it', 'a@prova.it']);
});

test('password admin: dopo 5 tentativi sbagliati in 15 minuti è bloccata anche quella giusta', () => {
  const t0 = new Date('2026-10-16T10:00:00Z');
  const { post, prop } = carica({ proprieta: BASE, adesso: t0 });
  const prova = (password, azione = 'salvaDestinatari') => post({ codice: 'segreto', azione, dati: { password, indirizzi: ['a@prova.it'] } });
  for (let i = 0; i < 5; i++) assert.equal(prova('sbagliata', 'mailDiProva').errore, 'wrong admin password');
  assert.equal(prova('admin-prova').errore, 'too many attempts');
  const dopo = carica({ proprieta: Object.fromEntries(prop), adesso: new Date(t0.getTime() + 16 * 60000) });
  assert.equal(dopo.post({ codice: 'segreto', azione: 'salvaDestinatari', dati: { password: 'admin-prova', indirizzi: ['a@prova.it'] } }).ok, true);
});

test('password admin: un accesso giusto azzera i tentativi sbagliati', () => {
  const { post } = carica({ proprieta: BASE });
  const prova = (password) => post({ codice: 'segreto', azione: 'salvaDestinatari', dati: { password, indirizzi: ['a@prova.it'] } });
  for (let i = 0; i < 4; i++) prova('sbagliata');
  assert.equal(prova('admin-prova').ok, true);
  for (let i = 0; i < 4; i++) assert.equal(prova('sbagliata').errore, 'wrong admin password');
  assert.equal(prova('admin-prova').ok, true);
});

const proposta = (chiave, excel, air, tipo = 'Possible alias') => ({ chiave, excel, air, tipo });

test('alias: le coppie confermate diventano proposte, contate se tornano', () => {
  const { post, fogli } = carica({ proprieta: BASE, adesso: new Date('2026-10-16T10:00:00Z') });
  assert.equal(post({ codice: 'segreto', azione: 'proponiAlias', dati: { partita: 'ALFA - BETA', coppie: [proposta('ZORROTV|ZTV', 'ZORRO TV', 'ZTV')] } }).ok, true);
  post({ codice: 'segreto', azione: 'proponiAlias', dati: { partita: 'GAMMA - ALFA', coppie: [proposta('ZORROTV|ZTV', 'ZORRO TV', 'ZTV'), proposta('BELTA|MELTA', 'belta', 'MELTA', 'Possible typo')] } });
  assert.deepEqual([...fogli.Aliases[0]], ['chiave', 'excel', 'air', 'tipo', 'stato', 'volte', 'ultimaData', 'ultimaPartita', 'approvatoIl']);
  const r = post({ codice: 'segreto', azione: 'alias' });
  assert.deepEqual(r.righe.map((x) => [x.chiave, x.stato, x.volte, x.ultimaPartita, x.ultimaData]),
    [['ZORROTV|ZTV', 'proposed', 2, 'GAMMA - ALFA', '2026-10-16T10:00:00.000Z'], ['BELTA|MELTA', 'proposed', 1, 'GAMMA - ALFA', '2026-10-16T10:00:00.000Z']]);
  // chiavi non valide: rifiutate
  assert.equal(post({ codice: 'segreto', azione: 'proponiAlias', dati: { coppie: [proposta('=1+1|X', 'x', 'y')] } }).errore, 'invalid alias');
});

test('alias: approvare e togliere solo con la password admin', () => {
  const { post } = carica({ proprieta: BASE });
  post({ codice: 'segreto', azione: 'proponiAlias', dati: { partita: 'ALFA - BETA', coppie: [proposta('ZORROTV|ZTV', 'ZORRO TV', 'ZTV'), proposta('BELTA|MELTA', 'belta', 'MELTA')] } });
  assert.equal(post({ codice: 'segreto', azione: 'approvaAlias', dati: { password: 'no', chiave: 'ZORROTV|ZTV' } }).errore, 'wrong admin password');
  const ok = post({ codice: 'segreto', azione: 'approvaAlias', dati: { password: 'admin-prova', chiave: 'ZORROTV|ZTV' } });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.righe.map((x) => [x.chiave, x.stato]), [['ZORROTV|ZTV', 'official'], ['BELTA|MELTA', 'proposed']]);
  assert.ok(ok.righe[0].approvatoIl);
  // una nuova conferma di un alias già ufficiale non lo rimette tra i proposti
  post({ codice: 'segreto', azione: 'proponiAlias', dati: { partita: 'X - Y', coppie: [proposta('ZORROTV|ZTV', 'ZORRO TV', 'ZTV')] } });
  assert.equal(post({ codice: 'segreto', azione: 'alias' }).righe[0].stato, 'official');
  const tolto = post({ codice: 'segreto', azione: 'rimuoviAlias', dati: { password: 'admin-prova', chiave: 'BELTA|MELTA' } });
  assert.deepEqual(tolto.righe.map((x) => x.chiave), ['ZORROTV|ZTV']);
  assert.equal(post({ codice: 'segreto', azione: 'approvaAlias', dati: { password: 'admin-prova', chiave: 'NESSUNO|X' } }).errore, 'unknown alias');
});

test('storico: colonna sistema (Hub/Vault); un foglio Checks di prima prende la nuova intestazione', () => {
  const campi = ['idControllo', 'dataControllo', 'dataEvento', 'partita', 'casa', 'ospite', 'venue', 'fileExcel', 'fileAir', 'celle', 'corrette', 'errori', 'refusiTrovati', 'confermati', 'respinti', 'avvisi'];
  const vecchia = campi.map((c) => controllo('h0')[c]);
  const { post, fogli } = carica({ proprieta: BASE, fogli: { Checks: [campi.slice(), vecchia] } });
  post({ codice: 'segreto', azione: 'salvaControllo', dati: controllo('v1', { sistema: 'Vault' }) });
  assert.deepEqual([...fogli.Checks[0]], campi.concat('sistema'));
  const righe = post({ codice: 'segreto', azione: 'elencoControlli' }).righe;
  assert.deepEqual(righe.map((x) => [x.idControllo, x.sistema]), [['h0', ''], ['v1', 'Vault']]);
});
