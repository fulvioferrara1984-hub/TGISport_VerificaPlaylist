/* Playlist Check — durata e fotogrammi al secondo dei video mp4/mov, letti dai box del file (senza riprodurlo). */
(function (radice, fabbrica) {
  const m = fabbrica(radice);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else (radice.PC = radice.PC || {})[m.NOME] = m;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // { secondi, fps?, fotogrammi? } oppure null se il file non è un video leggibile.
  // Video normale (Hub): durata dal box mvhd. Video frammentato (Vault): mvhd ha durata 0 e i fotogrammi stanno nei frammenti
  // moof → traf → trun, con la durata di ciascuno in trun, in tfhd o in trex; si conta la traccia video.
  function infoVideo(b) {
    try {
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      const tipo = (i) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
      const figli = (da, a) => {
        const out = [];
        for (let i = da; i + 8 <= a;) {
          let dim = dv.getUint32(i);
          let testa = 8;
          if (dim === 1) { dim = dv.getUint32(i + 8) * 2 ** 32 + dv.getUint32(i + 12); testa = 16; } else if (dim === 0) dim = a - i;
          if (dim < testa) break;
          out.push({ t: tipo(i + 4), p: i + testa, fine: Math.min(i + dim, a) });
          i += dim;
        }
        return out;
      };
      const uno = (lista, t) => lista.find((x) => x.t === t);
      const tempo = (p, v0, v1) => (b[p] === 1 ? dv.getUint32(p + v1) : dv.getUint32(p + v0)); // campo a 32 bit, posizione per versione 0/1
      const lungo = (p, v0, v1) => (b[p] === 1 ? dv.getUint32(p + v1) * 2 ** 32 + dv.getUint32(p + v1 + 4) : dv.getUint32(p + v0));

      const cima = figli(0, b.length);
      const moov = uno(cima, 'moov');
      if (!moov) return null;
      const dentroMoov = figli(moov.p, moov.fine);
      const mvhd = uno(dentroMoov, 'mvhd');
      if (mvhd) {
        const ts = tempo(mvhd.p, 12, 20);
        const durata = lungo(mvhd.p, 16, 24);
        if (ts && durata) return { secondi: durata / ts };
      }

      // video frammentato
      const tracce = new Map(); // id → { ts, video, predefinita, somma, fotogrammi }
      dentroMoov.filter((x) => x.t === 'trak').forEach((trak) => {
        const f = figli(trak.p, trak.fine);
        const tkhd = uno(f, 'tkhd');
        const mdia = uno(f, 'mdia');
        if (!tkhd || !mdia) return;
        const fm = figli(mdia.p, mdia.fine);
        const mdhd = uno(fm, 'mdhd');
        const hdlr = uno(fm, 'hdlr');
        if (!mdhd) return;
        tracce.set(tempo(tkhd.p, 12, 20), { ts: tempo(mdhd.p, 12, 20), video: Boolean(hdlr) && tipo(hdlr.p + 8) === 'vide', predefinita: 0, somma: 0, fotogrammi: 0 });
      });
      const mvex = uno(dentroMoov, 'mvex');
      if (mvex) figli(mvex.p, mvex.fine).filter((x) => x.t === 'trex').forEach((trex) => {
        const t = tracce.get(dv.getUint32(trex.p + 4));
        if (t) t.predefinita = dv.getUint32(trex.p + 12);
      });
      cima.filter((x) => x.t === 'moof').forEach((moof) => figli(moof.p, moof.fine).filter((x) => x.t === 'traf').forEach((traf) => {
        const f = figli(traf.p, traf.fine);
        const tfhd = uno(f, 'tfhd');
        if (!tfhd) return;
        const flagH = dv.getUint32(tfhd.p) & 0xffffff;
        const t = tracce.get(dv.getUint32(tfhd.p + 4));
        if (!t) return;
        let q = tfhd.p + 8;
        if (flagH & 0x01) q += 8;
        if (flagH & 0x02) q += 4;
        const predefinita = flagH & 0x08 ? dv.getUint32(q) : t.predefinita;
        f.filter((x) => x.t === 'trun').forEach((trun) => {
          const flag = dv.getUint32(trun.p) & 0xffffff;
          const n = dv.getUint32(trun.p + 4);
          let r = trun.p + 8;
          if (flag & 0x01) r += 4;
          if (flag & 0x04) r += 4;
          t.fotogrammi += n;
          if (!(flag & 0x100)) { t.somma += n * predefinita; return; }
          const passo = [0x100, 0x200, 0x400, 0x800].filter((x) => flag & x).length * 4;
          for (let s = 0; s < n; s++, r += passo) t.somma += dv.getUint32(r);
        });
      }));
      const scelta = [...tracce.values()].find((t) => t.video && t.somma) || [...tracce.values()].find((t) => t.somma);
      if (!scelta || !scelta.ts) return null;
      const secondi = scelta.somma / scelta.ts;
      return { secondi, fps: Math.round((scelta.fotogrammi / secondi) * 100) / 100, fotogrammi: scelta.fotogrammi };
    } catch (e) {
      return null;
    }
  }

  // Un video sta nello slot se lo slot dura un numero intero di volte il video (gira 1, 2… volte), con mezzo secondo di tolleranza:
  // un 15" in uno slot da 30 va bene, in uno da 10 no; un 10" in uno slot da 15 no.
  function staNelloSlot(video, slot) {
    const volte = Math.round(slot / video);
    return volte >= 1 && Math.abs(slot - volte * video) <= 0.5;
  }

  return { NOME: 'video', infoVideo, staNelloSlot };
});
