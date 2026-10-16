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
