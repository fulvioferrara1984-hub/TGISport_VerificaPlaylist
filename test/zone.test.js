// Ruolo delle zone e fila degli artwork (app/zone.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { ruoloZona, filaArtwork, MAT_ZONA } = require('../app/zone.js');

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
