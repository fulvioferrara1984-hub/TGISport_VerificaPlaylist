// Lo script di Google (backend/Codice.gs) caricato in un contesto vm, con i servizi di Google simulati.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const CODICE = fs.readFileSync(path.join(__dirname, '../backend/Codice.gs'), 'utf8');

// Foglio di calcolo finto: { nome: [[riga], …] }
function foglioFinto(fogli) {
  const foglio = (nome) => ({
    getName: () => nome,
    getDataRange: () => ({ getValues: () => fogli[nome].map((r) => r.slice()) }),
    getLastRow: () => fogli[nome].length,
    appendRow: (r) => { fogli[nome].push(r.slice()); },
    getRange: (riga, col, nRighe = 1, nCol = 1) => ({
      setValues: (v) => { for (let i = 0; i < nRighe; i++) { fogli[nome][riga - 1 + i] = fogli[nome][riga - 1 + i] || []; for (let c = 0; c < nCol; c++) fogli[nome][riga - 1 + i][col - 1 + c] = v[i][c]; } },
    }),
    clearContents: () => { fogli[nome].length = 0; },
    setFrozenRows: () => {},
  });
  return {
    getSheetByName: (n) => (fogli[n] ? foglio(n) : null),
    insertSheet: (n) => { fogli[n] = []; return foglio(n); },
  };
}

// stub: { proprieta: {}, fogli: {}, adesso: Date, occupato: il blocco dello script non si ottiene,
//         senzaFoglio: script non collegato a un foglio, guastoFoglio: messaggio dell'errore di SpreadsheetApp }
function carica(stub = {}) {
  const prop = new Map(Object.entries(stub.proprieta || {}));
  const fogli = stub.fogli || {};
  const email = [];
  const blocco = []; // 'wait' / 'release', in ordine
  const scritturePropieta = []; // chiavi scritte con setProperties in una sola volta
  const gs = {
    console: { log: () => {}, error: () => {} },
    Date: stub.adesso ? class extends Date { constructor(...a) { super(...(a.length ? a : [stub.adesso])); } } : Date,
    JSON,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (prop.has(k) ? prop.get(k) : null),
        setProperty: (k, v) => { prop.set(k, String(v)); },
        setProperties: (o) => { scritturePropieta.push(Object.keys(o).sort()); Object.entries(o).forEach(([k, v]) => prop.set(k, String(v))); },
        deleteProperty: (k) => { prop.delete(k); },
      }),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => {
        if (stub.guastoFoglio) throw new Error(stub.guastoFoglio);
        return stub.senzaFoglio ? null : foglioFinto(fogli);
      },
    },
    MailApp: { sendEmail: (m) => { email.push(m); } },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => { blocco.push('wait'); if (stub.occupato) throw new Error('Lock timeout'); },
        releaseLock: () => { blocco.push('release'); },
      }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, testo) => [...crypto.createHash('sha256').update(testo, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
      getUuid: () => crypto.randomUUID(),
    },
    ContentService: { createTextOutput: (t) => ({ setMimeType: () => t }), MimeType: { JSON: 'json' } },
  };
  vm.createContext(gs);
  vm.runInContext(CODICE, gs);
  // chiamata come dalla pagina: corpo JSON in doPost
  const post = (corpo) => JSON.parse(gs.doPost({ postData: { contents: JSON.stringify(corpo) } }));
  return { gs, prop, fogli, email, post, blocco, scritturePropieta };
}

module.exports = { carica };
