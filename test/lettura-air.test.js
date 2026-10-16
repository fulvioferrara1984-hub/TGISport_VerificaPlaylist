// Lettura dell'AIR package (app/lettura-air.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { librerie } = require('./aiuto.js');
const { hdmSequenza, hdmEvento, zipAir, spiaLetture } = require('./fixture-air.js');
const { parseSequenza, parseEvento, regioniStream, leggiAir } = require('../app/lettura-air.js');

const { JSZip } = librerie();
const ADS = { 10: ['ALFA_GC1', 'CASA_ALFA_1', '../advertisements/5_casa_alfa_1.mp4'], 11: ['Blank_Generic', 'Blank_Generic', '../advertisements/1503_blank_generic.png'] };

test('sequenza: intervalli, mappe e artwork', () => {
  const iv = parseSequenza(hdmSequenza([
    { inizio: 0, durata: 15000, mappe: [['11', [0, 1]]] },
    { inizio: 15000, durata: 10000, mappe: [['10', [0, 1]]] },
  ], ADS));
  assert.equal(iv.length, 2);
  assert.equal(iv[1].inizio, 15000);
  assert.equal(iv[1].durata, 10000);
  assert.deepEqual(iv[1].mappe.get(1), { ad: 'ALFA_GC1', advertiser: 'CASA_ALFA_1', file: '../advertisements/5_casa_alfa_1.mp4' });
  assert.equal(iv[0].mappe.get(0).ad, 'Blank_Generic');
});

test('ad senza advertiser', () => {
  const iv = parseSequenza(hdmSequenza([{ inizio: 0, durata: 15000, mappe: [['10', [0]]] }], { 10: ['ALFA_GC1', null, '../advertisements/5_a.mp4'] }));
  assert.equal(iv[0].mappe.get(0).advertiser, null);
});

test('evento: nome, data, venue con entità, zone e stream raggruppati', () => {
  const ev = parseEvento(hdmEvento({
    nome: 'ALFA-BETA', data: '2026-10-17', venue: 'Stadio dell&#39;Esempio', zone: ['FULL PERIMETER', 'GL_SX_2', 'CC'],
    stream: [['Row (North America - Latam)', [['1st Half - 2nd Half', 'sequences/row_1st.hdm'], ['Highlights', 'sequences/row_hl.hdm']]], ['Domestico', [['Pre Match - Post Match', 'sequences/dom_pre.hdm']]]],
  }));
  assert.equal(ev.nome, 'ALFA-BETA');
  assert.equal(ev.data, '2026-10-17');
  assert.equal(ev.venue, "Stadio dell'Esempio");
  assert.equal(ev.zone.get(1), 'GL_SX_2');
  assert.equal(ev.stream.length, 2);
  assert.deepEqual([...ev.stream[0].regioni].sort(), ['CSA', 'NA']);
  assert.deepEqual(ev.stream[0].segmenti, [{ nome: '1st Half - 2nd Half', file: 'sequences/row_1st.hdm' }, { nome: 'Highlights', file: 'sequences/row_hl.hdm' }]);
});

test('regioni degli stream', () => {
  assert.deepEqual([...regioniStream('Row (Europa-Mena-Asia-Vietnam-Latam)')].sort(), ['ASIA', 'CSA', 'EU', 'MENA', 'VN']);
  assert.deepEqual([...regioniStream('Latam')], ['CSA']);
  assert.deepEqual([...regioniStream('Far East')], ['FE']);
  assert.deepEqual([...regioniStream('Domestico')], ['DOM']);
  assert.deepEqual([...regioniStream('North America')], ['NA']);
});

test('leggiAir: sequenze, sequenza mancante e media, leggendo solo i .hdm', async () => {
  const evento = hdmEvento({ stream: [['Europa', [['1st Half - 2nd Half', 'sequences/europa_1st.hdm'], ['Highlights', 'sequences/europa_hl.hdm']]]] });
  const dati = await zipAir(JSZip, {
    evento, sequenze: { 'sequences/europa_1st.hdm': hdmSequenza([{ inizio: 0, durata: 15000, mappe: [['10', [0]]] }], ADS) },
    media: ['5_casa_alfa_1.mp4', '1503_blank_generic.png'],
  });
  const spia = await spiaLetture(JSZip, dati);
  try {
    const air = await leggiAir(dati, JSZip);
    assert.equal(air.evento.nome, 'ALFA-BETA');
    assert.equal(air.stream[0].segmenti[0].intervalli.length, 1);
    assert.equal(air.stream[0].segmenti[1].intervalli, null);
    assert.ok(air.media.has('5_casa_alfa_1.mp4'));
    assert.ok(spia.letti.length > 0);
    assert.ok(spia.letti.every((p) => p.endsWith('.hdm')), spia.letti.join(', '));
  } finally {
    spia.ripristina();
  }
});

test('zip senza event.hdm: errore chiaro', async () => {
  const dati = await zipAir(JSZip, { media: ['x.png'] });
  await assert.rejects(leggiAir(dati, JSZip), /not an AIR package/);
});

test('file che non è uno zip: errore chiaro', async () => {
  await assert.rejects(leggiAir(new TextEncoder().encode('non è uno zip').buffer, JSZip), /could not be read as a zip/);
});

test('file .hdm con a capo di Windows (CRLF), come quelli veri', () => {
  const crlf = (t) => t.replace(/\n/g, '\r\n');
  const ev = parseEvento(crlf(hdmEvento({ venue: 'Stadio Prova', stream: [['Asia', [['Highlights', 'sequences/asia_hl.hdm']]]] })));
  assert.equal(ev.venue, 'Stadio Prova');
  assert.equal(ev.stream.length, 1);
  assert.equal(ev.stream[0].segmenti[0].file, 'sequences/asia_hl.hdm');
  const iv = parseSequenza(crlf(hdmSequenza([{ inizio: 0, durata: 15000, mappe: [['10', [0]]] }], ADS)));
  assert.equal(iv.length, 1);
  assert.equal(iv[0].mappe.get(0).file, '../advertisements/5_casa_alfa_1.mp4');
});
