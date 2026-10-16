// Aiuti comuni ai test: librerie di lib/ e cartella delle coppie reali (solo in locale).
const path = require('node:path');
const os = require('node:os');

const LIB = path.join(__dirname, '..', 'lib');

function librerie() {
  return { XLSX: require(path.join(LIB, 'xlsx.full.min.js')), JSZip: require(path.join(LIB, 'jszip.min.js')) };
}

// Cartella con una sottocartella per squadra (Excel + AIR package); null = test sulle coppie reali saltati.
function coppieReali() {
  const v = process.env.PC_COPPIE;
  if (!v) return null;
  return v.startsWith('~') ? path.join(os.homedir(), v.slice(1)) : v;
}

// Legge una coppia (Excel + AIR package) di una squadra, ignorando i file temporanei di Excel (~$…).
async function leggiCoppia(dir) {
  const fs = require('node:fs');
  const { XLSX, JSZip } = librerie();
  const { leggiExcel } = require('../app/lettura-excel.js');
  const { leggiAir } = require('../app/lettura-air.js');
  const file = fs.readdirSync(dir);
  const xlsx = file.find((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$'));
  const zip = file.find((f) => /\.zip$/i.test(f));
  return { excel: leggiExcel(fs.readFileSync(path.join(dir, xlsx)), XLSX), air: await leggiAir(fs.readFileSync(path.join(dir, zip)), JSZip) };
}

module.exports = { librerie, coppieReali, leggiCoppia };
