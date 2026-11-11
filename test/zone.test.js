// Ruolo delle zone e fila degli artwork (app/zone.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { ruoloZona, filaArtwork, MAT_ZONA, formatiDelleZone, fattoPerAltraZona } = require('../app/zone.js');

test('ruolo delle zone', () => {
  for (const [z, r] of [['CC', 'CC'], ['SPZ_LSX', 'SPONSOR'], ['CLUB_UDX', 'CLUB'], ['ADD_3', 'ADD'], ['RSX', 'ADD'], ['RDX', 'ADD'],
    ['FULL PERIMETER', 'LED1'], ['FULL PERIMETER_1', 'LED1'], ['JUMBO', 'LED1'], ['GL_SX', 'LED1'], ['TL', 'LED1'], ['TL_A', 'LED1'],
    ['GL_SX_1', 'LED1'], ['GL_SX_2', 'LED2'], ['UC_2_SX', 'LED2'], ['TL_CX_2', 'LED2'], ['LC_SX_2', 'LED2']]) {
    assert.equal(ruoloZona(z, false, 'SPZ_'), r, z);
  }
});

test('LC_x_1 è LOWER CORNER solo se l’Excel ha quella riga', () => {
  assert.equal(ruoloZona('LC_SX_1', true), 'LC');
  assert.equal(ruoloZona('LC_DX_1', true), 'LC');
  assert.equal(ruoloZona('LC_SX_1', false), 'LED1');
  assert.equal(ruoloZona('LC_SX_2', true), 'LED2');
});

test('fila dal suffisso: advertiser, poi ad, poi file, poi zona', () => {
  assert.equal(filaArtwork({ ad: 'SIGMA_JUMBO', advertiser: 'CASA_SIGMA_1_J', file: 'x.mp4' }, 'GL_SX_2', false), 1);
  assert.equal(filaArtwork({ ad: 'SIGMA_GL2', advertiser: 'CASA_SIGMA_2_J', file: 'x.mp4' }, 'GL_SX_2', false), 2);
  assert.equal(filaArtwork({ ad: 'ALFA_SOLO_GL2', advertiser: 'CASA_ALFA_SOLO_2FILA', file: 'x.mp4' }, 'JUMBO', false), 2);
  assert.equal(filaArtwork({ ad: 'ALFA_SOLO-1FILA', advertiser: 'CASA_ALFA_SOLO', file: '../advertisements/9_casa_alfa_1fi.mp4' }, 'FULL PERIMETER', false), 1);
  assert.equal(filaArtwork({ ad: 'ALFA_GC1', advertiser: 'CASA_ALFA', file: '1_casa_alfa.mp4' }, 'FULL PERIMETER', false), 1);
  assert.equal(filaArtwork({ ad: 'ALFA_TL2', advertiser: 'CASA_ALFA_TL2', file: '1_casa_alfa_tl2.mp4' }, 'TL_SX_2', false), 2);
  assert.equal(filaArtwork({ ad: 'ALFA_X', advertiser: 'CASA_ALFA', file: '1_casa_alfa.mp4' }, 'GL_DX_2', false), 2);
  assert.equal(filaArtwork({ ad: 'ALFA_GL2', advertiser: 'CASA_ALFA_2', file: 'x.mp4' }, 'GL_SX_2', true), 1);
});

test('tappeti CLUB MAT 1–4', () => {
  assert.deepEqual(MAT_ZONA, { CLUB_LSX: 'MAT1', CLUB_USX: 'MAT2', CLUB_UDX: 'MAT3', CLUB_LDX: 'MAT4' });
});

test('zone a regola fissa: il prefisso arriva dalle regole', () => {
  assert.equal(ruoloZona('SPZ_UDX', false, 'SPZ_'), 'SPONSOR');
  assert.equal(ruoloZona('SPZ_UDX', false, undefined), 'LED1');
});

test('formato abituale di una zona: quello che occupa più slot nel pacchetto, senza blank e cerchi vuoti', () => {
  const a = (ad, file) => ({ ad, file: `../advertisements/${file}` });
  const formati = new Map([['g.mp4', { larghezza: 3100, altezza: 90 }], ['v.mp4', { larghezza: 3040, altezza: 90 }], ['b.png', { larghezza: 10, altezza: 10 }]]);
  const iv = (...x) => ({ mappe: new Map(x.map((y) => [0, y])) });
  const stream = [
    { segmenti: [{ intervalli: [iv(a('Blank_Generic', 'b.png')), iv(a('Blank_Generic', 'b.png')), iv(a('Blank_Generic', 'b.png')), iv(a('V', 'v.mp4'))] }, { intervalli: null }] },
    { segmenti: [{ intervalli: [iv(a('G', 'g.mp4')), iv(a('G', 'g.mp4')), iv(a('X', 'illeggibile.mp4'))] }] },
  ];
  assert.deepEqual([...formatiDelleZone(stream, formati)], [[0, { larghezza: 3100, altezza: 90 }]]);
});

test('artwork fatto per un’altra zona', () => {
  const GL1 = { larghezza: 3100, altezza: 90 };
  const JUMBO = { larghezza: 5130, altezza: 180 };
  const TL = { larghezza: 3626, altezza: 90 };
  const abituali = new Map([[1, GL1], [2, JUMBO], [3, TL]]);
  // alto il doppio o la metà della zona
  assert.equal(fattoPerAltraZona(GL1, 2, abituali), true);
  assert.equal(fattoPerAltraZona(JUMBO, 1, abituali), true);
  assert.equal(fattoPerAltraZona({ larghezza: 2440, altezza: 180 }, 1, abituali), true);
  // stessa altezza: conta il formato di un'altra zona
  assert.equal(fattoPerAltraZona(GL1, 3, abituali), true);
  // variazioni normali dentro la stessa zona
  assert.equal(fattoPerAltraZona(GL1, 1, abituali), false);
  assert.equal(fattoPerAltraZona({ larghezza: 3040, altezza: 90 }, 1, abituali), false);
  assert.equal(fattoPerAltraZona({ larghezza: 3100, altezza: 96 }, 1, abituali), false);
  assert.equal(fattoPerAltraZona({ larghezza: 5120, altezza: 180 }, 2, abituali), false);
  // zona senza formato noto: non si giudica
  assert.equal(fattoPerAltraZona(GL1, 9, abituali), false);
});

test('due zone con lo stesso formato possono ospitare lo stesso artwork', () => {
  const f = { larghezza: 2430, altezza: 96 };
  assert.equal(fattoPerAltraZona(f, 1, new Map([[1, f], [2, { ...f }]])), false);
});

test('zone del feed unico: lati LED, centreboard e texture del prato', () => {
  assert.equal(ruoloZona('LEFT LED'), 'LED1');
  assert.equal(ruoloZona('RIGHT LED'), 'LED1');
  assert.equal(ruoloZona('CENTREBOARD'), 'CB');
  assert.equal(ruoloZona('Centre Board'), 'CB');
  assert.equal(ruoloZona('GRASS_LSX_MEDIUM'), 'TEXTURE');
  assert.equal(ruoloZona('GRASS_LDX_DARK'), 'TEXTURE');
});

test('tappeti del foglio unico (Mats_L1, MATS_R1, MAT_L2): asset statici, non LED', () => {
  for (const z of ['Mats_L1', 'MATS_R1', 'MAT_L2']) assert.equal(ruoloZona(z, false), 'MATS', z);
  assert.equal(ruoloZona('Left LED', false), 'LED1');
});
