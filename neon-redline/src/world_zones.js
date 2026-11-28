/* NEON REDLINE – world_zones.js : Stadt, Industrie, Hafen, Vorstadt, Land – Gebäude & Props */
(function (G) {
'use strict';
const U = G.U, W = G.World; const { lerp, sstep, clamp, noise2, fbm } = U; const CH = W.CH; const Gen = G.Gen;
const Z = {}; const C = U.colRGB; const _P = {}; const pal = (h) => _P[h] || (_P[h] = C(h));
const GLASS = ['#8fb5d6', '#7aa6c4', '#9bc2d8', '#6f8fa8', '#a9c4d4', '#86b0b8'], CONCR = ['#e0dcd0', '#d2c9b6', '#c4beb2', '#e6dcc4', '#cbbda8', '#b3aea6', '#d8d8d8'], BRICK = ['#c07a58', '#b06a4c', '#c8906a', '#a8604a'], PASTEL = ['#efe6d2', '#e7d3c0', '#cfd9d0', '#d6d9e6', '#eadacb', '#f2f0e8'];
const ROOF = ['#7a3b2e', '#5d4a40', '#4a4f55', '#6b5a48', '#8a4a38'];
const CONTAINER = ['#c0392b', '#2e6bb3', '#2f8f4e', '#d9822b', '#7b7f85', '#e8e3d5', '#c9a227', '#5b3f8c', '#1d7f8c'];
const isRoadNear = (x, z, d) => { const q = W.queryRoad(x, z, d + 40, {}); return q.r && q.d < q.r.T.half + d; };
function bounds(ch) { return [ch.cx0, ch.cz0, ch.cx0 + CH, ch.cz0 + CH]; }
const inCh = (ch, x, z) => x >= ch.cx0 && x < ch.cx0 + CH && z >= ch.cz0 && z < ch.cz0 + CH;
function pick(rng, a) { return a[Math.floor(rng() * a.length) % a.length]; }
function rot(x, z, ry) { const c = Math.cos(ry), s = Math.sin(ry); return [x * c + z * s, -x * s + z * c]; }

/* Fundament-Höhen */
function groundRange(x, z, w, d, ry) {
  let lo = 1e9, hi = -1e9; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) { const [dx, dz] = rot(a * w / 2, b * d / 2, ry); const h = W.terrainH(x + dx, z + dz); if (h < lo) lo = h; if (h > hi) hi = h; } return [lo, hi];
}

/* UV-Kacheln der Fassaden: [Breite, Höhe] pro Textur-Kachel */
const TILE = { A: [3.6, 3.4], B: [4.2, 3.7], C: [4.0, 4.4] };

function building(ch, x, z, w, d, h, ry, style, tint, rng, opt) {
  opt = opt || {}; const lod = ch.lod; const [lo, hi] = groundRange(x, z, w, d, ry); const base = (opt.y0 !== undefined ? opt.y0 : lo) - 1.2; const top = (opt.y0 !== undefined ? opt.y0 : hi) + h; const H = top - base; const gb = ch.gb[style];
  const uo = Math.floor(rng() * 8) / 8, vo = Math.floor(rng() * 8) / 8;
  gb.box(x, base + H / 2, z, w, H, d, ry, tint, { tile: TILE[style], uo, vo, shade: [1, 0.92, 0.97, 0.9, 1, 0.5] });
  if (opt.collide !== false) Gen.addBoxCol(ch, x, z, w, d, ry, top);
  if (lod === 0 && !opt.noRoof) { // Dachaufbauten
    const n = 1 + Math.floor(rng() * 3); for (let k = 0; k < n; k++) { const bx = (rng() - 0.5) * w * 0.6, bz = (rng() - 0.5) * d * 0.6; const [dx, dz] = rot(bx, bz, ry); const sw = 1.5 + rng() * 3.5, sd = 1.5 + rng() * 3, sh = 1 + rng() * 2.4; ch.gb.solid.box(x + dx, top + sh / 2, z + dz, sw, sh, sd, ry, pal('#7d8085')); }
    if (rng() < 0.3) { const [dx, dz] = rot((rng() - 0.5) * w * 0.4, (rng() - 0.5) * d * 0.4, ry); ch.gb.solid.cyl(x + dx, top, z + dz, 1.6, 1.6, 3.2, 8, pal('#6a5d52'), { base: true }); }
    ch.gb.solid.box(x, top + 0.25, z, w + 0.3, 0.5, d + 0.3, ry, pal('#6e6f72')); // Attika
  }
  if (h > 100 && lod <= 1) { const ax = x, az = z; ch.gb.metal.beam(ax, top, az, ax, top + 22 + rng() * 20, az, 0.5, 0.5, pal('#b0b4b8')); ch.glow(ax, top + 24 + rng() * 14, az, 1.0, 0.1, 0.08, 16, 1.3); }
  return top;
}
function addSign(ch, bx, bz, w, d, ry, y, rng, towardX, towardZ) {
  if (ch.lod > 0) return; const idx = Math.floor(rng() * G.Tex.signCount); const col = U.colRGB(G.Tex.signColors[idx]); const sz = 2.4 + rng() * 1.6;
  // an einer der Seiten
  const side = Math.floor(rng() * 4); const fx = [0, 1, 0, -1][side], fz = [1, 0, -1, 0][side]; const half = (side % 2 === 0 ? d : w) / 2; const [ox, oz] = rot(fx * 0, 0, ry);
  const lx = (side % 2 === 0 ? w : d) * (rng() - 0.5) * 0.6; const px = fx !== 0 ? fx * (w / 2 + 0.5) : lx, pz = fz !== 0 ? fz * (d / 2 + 0.5) : lx; const [dx, dz] = rot(px, pz, ry); const nx = rot(fx, fz, ry);
  const cx = bx + dx, cz = bz + dz; const u0 = (idx % 4) / 4, v0 = 1 - (Math.floor(idx / 4) + 1) / 4; const tx = -nx[1], tz = nx[0]; const hs = sz / 2;
  const p0 = [cx - tx * hs, y - hs, cz - tz * hs], p1 = [cx + tx * hs, y - hs, cz + tz * hs], p2 = [cx + tx * hs, y + hs, cz + tz * hs], p3 = [cx - tx * hs, y + hs, cz - tz * hs];
  ch.gb.sign.quad4(p0, p1, p2, p3, [1.6, 1.6, 1.6], [u0, v0, u0 + 0.25, v0, u0 + 0.25, v0 + 0.25, u0, v0 + 0.25]);
  ch.glow(cx + nx[0] * 0.6, y, cz + nx[1] * 0.6, col[0] * 1.2, col[1] * 1.2, col[2] * 1.2, 9);
}
function tower(ch, x, z, w, d, h, rng, opts) {
  opts = opts || {}; const lod = ch.lod; const glass = opts.style === 'B' || (h > 55 && rng() < 0.65); const style = glass ? 'B' : 'A'; const tint = glass ? C(pick(rng, GLASS)) : C(pick(rng, rng() < 0.3 ? BRICK : CONCR));
  const ry = opts.ry || 0; let y0 = null; const hb = h > 60 ? 9 + rng() * 6 : 0;
  if (hb) { const top = building(ch, x, z, w, d, hb, ry, 'A', C(pick(rng, CONCR)), rng, { noRoof: true }); y0 = top; addSign(ch, x, z, w, d, ry, W.terrainH(x, z) + 5 + rng() * 3, rng); if (rng() < 0.7) addSign(ch, x, z, w, d, ry, W.terrainH(x, z) + 6 + rng() * 3, rng); }
  const sw = hb ? w * 0.84 : w, sd = hb ? d * 0.84 : d; const setback = h > 130 && rng() < 0.7;
  const h1 = setback ? (h - hb) * (0.62 + rng() * 0.12) : (h - hb);
  let top = building(ch, x, z, sw, sd, h1, ry, style, tint, rng, { y0: y0 !== null ? y0 : undefined, noRoof: setback, collide: !hb });
  if (setback) { top = building(ch, x, z, sw * 0.74, sd * 0.74, (h - hb) - h1, ry, style, tint, rng, { y0: top, collide: false }); }
  if (lod === 0 && (glass || h > 40) && opts.neonBand !== false && rng() < 0.55) { const c = pick(rng, [[0.1, 1.6, 2.2], [2.2, 0.2, 1.4], [2.0, 1.0, 0.1], [0.3, 2.0, 0.8]]); ch.gb.neon.box(x, top - 0.4, z, sw + 0.35, 0.5, sd + 0.35, ry, c); }
  return top;
}
function park(ch, xa, za, xb, zb, h0, rng) {
  const cx = (xa + xb) / 2, cz = (za + zb) / 2; ch.gb.solid.box(cx, h0 + 0.1, cz, xb - xa, 0.2, zb - za, 0, pal('#4f7a3a'));
  if (ch.lod > 0) return; for (let k = 0; k < 16; k++) tree(ch, xa + 6 + rng() * (xb - xa - 12), za + 6 + rng() * (zb - za - 12), h0 + 0.2, rng, 0.9 + rng() * 0.5);
  ch.gb.solid.box(cx, h0 + 0.22, cz, 3, 0.06, zb - za - 8, 0, pal('#b9ad94')); ch.gb.solid.box(cx, h0 + 0.22, cz, xb - xa - 8, 0.06, 3, 0, pal('#b9ad94'));
}

/* ------------------------------------------------------------------ Bäume */
const TCOL = [C('#2f5a2a'), C('#3b6b30'), C('#27492a'), C('#4d7a35'), C('#5b8a3a')], AUT = [C('#b8742a'), C('#a8892e'), C('#8a5a2e')], TRUNK = C('#5a4332');
function tree(ch, x, z, y, rng, sc, kind) {
  const gb = ch.gb.solid; sc = sc || 1; kind = kind === undefined ? (rng() < 0.55 ? 0 : 1) : kind; const c = TCOL[Math.floor(rng() * TCOL.length)]; const hh = (kind === 0 ? 9 + rng() * 7 : 6 + rng() * 4) * sc;
  if (kind === 0) { gb.cyl(x, y, z, 0.28 * sc, 0.2 * sc, hh * 0.25, 5, TRUNK, { base: true, cap: false }); for (let k = 0; k < 3; k++) { const f = k / 3; gb.cyl(x, y + hh * (0.15 + f * 0.33), z, (3.1 - k * 0.8) * sc, 0.12, hh * 0.46, 7, [c[0] * (0.85 + k * 0.1), c[1] * (0.85 + k * 0.1), c[2] * (0.85 + k * 0.1)], { base: true, cap: false }); } }
  else { gb.cyl(x, y, z, 0.3 * sc, 0.22 * sc, hh * 0.5, 5, TRUNK, { base: true, cap: false }); const cc = rng() < 0.12 ? AUT[Math.floor(rng() * AUT.length)] : c; for (let k = 0; k < 2; k++) gb.cyl(x + (k ? 0.6 : 0) * sc, y + hh * (0.38 + k * 0.22), z, (3.0 - k * 0.7) * sc, (1.2 - k * 0.4) * sc, hh * 0.42, 7, cc, { base: true }); }
  Gen.addCircCol(ch, x, z, 0.45 * sc, hh, false);
}

/* ------------------------------------------------------------------ Stadt */
const hwx = i => (i === 0 || Math.abs(i) === 6) ? 11 : 8;
function cityBlock(ch, i, j) {
  const lod = ch.lod; const xa = 120 * i + hwx(i), xb = 120 * (i + 1) - hwx(i + 1), za = 120 * j + hwx(j), zb = 120 * (j + 1) - hwx(j + 1); const cx = (xa + xb) / 2, cz = (za + zb) / 2, w = xb - xa, d = zb - za; const r = Math.hypot(cx, cz);
  const rng = U.mulberry((i + 20) * 977 + (j + 20) * 131 + 7); const h0 = 14;
  ch.gb.solid.box(cx, h0 + 0.09, cz, w, 0.18, d, 0, pal('#8e8e8a'), { shade: [1, 1, 1, 1, 1, 1] });
  const lx0 = xa + 4.5, lz0 = za + 4.5, lw = w - 9, ld = d - 9; const y0 = h0 + 0.18;
  if (i === 0 && j === 0) { // Wahrzeichen: Meridian-Turm
    const top = building(ch, cx, cz, 46, 46, 150, 0, 'B', C('#9fc7e0'), rng, { y0 });
    building(ch, cx, cz, 34, 34, 70, 0, 'B', C('#86aecb'), rng, { y0: top, noRoof: true });
    const t2 = top + 70; for (const [yy, c] of [[0.35, [0.1, 1.8, 2.4]], [0.7, [2.4, 0.2, 1.5]]]) ch.gb.neon.box(cx, y0 + 150 * yy, cz, 46.5, 0.8, 46.5, 0, c);
    ch.gb.metal.cyl(cx, t2, cz, 3.5, 0.4, 70, 8, pal('#cfd3d6'), { base: true }); ch.gb.neon.cyl(cx, t2 + 40, cz, 5, 5, 1.2, 12, [0.2, 1.6, 2.4], { base: true }); ch.glow(cx, t2 + 72, cz, 1, 0.1, 0.1, 24, 1.1); ch.glow(cx, t2 + 41, cz, 0.2, 0.9, 1.4, 30);
    return;
  }
  if (rng() < 0.1 && r > 300) { park(ch, xa + 4, za + 4, xb - 4, zb - 4, y0 - 0.1, rng); return; }
  const typ = r < 280 ? 0 : r < 520 ? 1 : 2;
  if (typ === 0) { if (rng() < 0.55) { const hgt = 130 + rng() * 140; tower(ch, cx, cz, lw * (0.62 + rng() * 0.25), ld * (0.62 + rng() * 0.25), hgt, rng); } else { for (const sx of [-1, 1]) tower(ch, cx + sx * lw * 0.26, cz + (rng() - 0.5) * 8, lw * 0.4, ld * 0.62, 90 + rng() * 120, rng); } return; }
  const nx = typ === 1 && rng() < 0.4 ? 1 : 2, nz = 2; const cw = lw / nx, cd = ld / nz;
  for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
    const bx = lx0 + cw * (a + 0.5), bz = lz0 + cd * (b + 0.5); const sw = cw - 3 - rng() * 4, sd = cd - 3 - rng() * 4; let hgt;
    if (typ === 1) hgt = 30 + rng() * rng() * 95 + (r < 400 ? 20 : 0); else hgt = 9 + rng() * 26 + (rng() < 0.12 ? 25 : 0);
    if (lod === 2 && hgt < 50) continue;
    const top = tower(ch, bx, bz, sw, sd, hgt, rng, { style: typ === 2 ? 'A' : undefined, neonBand: typ !== 2 });
    if (typ === 2 && rng() < 0.5) addSign(ch, bx, bz, sw, sd, 0, y0 + 4 + rng() * 3, rng);
    if (typ === 1 && hgt > 70 && rng() < 0.14 && lod === 0) billboard(ch, bx, bz, top, rng);
  }
  if (lod === 0 && typ === 2) for (let k = 0; k < 3; k++) tree(ch, lx0 + rng() * lw, lz0 + rng() * ld, y0, rng, 0.8, 1);
}
function billboard(ch, bx, bz, topY, rng) {
  const idx = Math.floor(rng() * 4); const u0 = (idx % 2) * 0.5, v0 = 1 - (Math.floor(idx / 2) + 1) * 0.5; const ry = Math.floor(rng() * 4) * Math.PI / 2; const nx = Math.sin(ry), nz = Math.cos(ry); const tx = -nz, tz = nx; const hw = 7, hh = 3.5, y = topY + 4 + hh;
  const cx = bx, cz = bz; ch.gb.ad.quad4([cx - tx * hw, y - hh, cz - tz * hw], [cx + tx * hw, y - hh, cz + tz * hw], [cx + tx * hw, y + hh, cz + tz * hw], [cx - tx * hw, y + hh, cz - tz * hw], [1.4, 1.4, 1.4], [u0, v0, u0 + 0.5, v0, u0 + 0.5, v0 + 0.5, u0, v0 + 0.5]);
  ch.gb.metal.box(cx - nx * 0.4, topY + 2, cz - nz * 0.4, 0.5, 4, 0.5, 0, pal('#555a60')); ch.glow(cx + nx * 1.5, y, cz + nz * 1.5, 0.9, 0.9, 1.0, 26);
}

/* ------------------------------------------------------------------ Industrie */
function industrialBlock(ch, bx, bz, size, rng) {
  const lod = ch.lod; const h0 = 9; const typ = Math.floor(rng() * 6); const inner = size - 22; const x0 = bx - inner / 2, z0 = bz - inner / 2;
  ch.gb.solid.box(bx, h0 + 0.05, bz, size - 14, 0.1, size - 14, 0, pal('#6e6e6c'));
  const grey = ['#b9bcbd', '#a9aeb0', '#c9c2b4', '#9fb0b8', '#c8b9a0'];
  const sodium = (x, z, y) => { ch.gb.metal.cyl(x, h0, z, 0.2, 0.15, 17, 6, pal('#666'), { base: true, cap: false }); ch.gb.neon.box(x, h0 + 17, z, 1.6, 0.25, 0.8, rng() * 3, [3.0, 1.9, 0.7]); ch.glow(x, h0 + 16.8, z, 1.0, 0.65, 0.25, 12); Gen.addCircCol(ch, x, z, 0.3, 17, true); };
  if (lod === 0) { sodium(x0 + 4, z0 + 4); sodium(x0 + inner - 4, z0 + inner - 4); }
  if (typ === 0 || typ === 1) { // Lagerhallen
    const n = typ === 0 ? 1 : 2; for (let k = 0; k < n; k++) { const w = inner * (n === 1 ? 0.8 : 0.9), d = (inner / n) * 0.7; const z = z0 + (k + 0.5) * inner / n; building(ch, bx, z, w, d, 10 + rng() * 5, 0, 'C', C(pick(rng, grey)), rng, { y0: h0 }); }
  } else if (typ === 2) { // Fabrik mit Schornstein
    building(ch, bx - inner * 0.1, bz, inner * 0.6, inner * 0.55, 16, 0, 'C', C(pick(rng, grey)), rng, { y0: h0 }); building(ch, bx + inner * 0.3, bz - inner * 0.2, 24, 24, 30, 0, 'C', C('#a9aeb0'), rng, { y0: h0 });
    const sx = bx + inner * 0.3, sz = bz + inner * 0.25, hgt = 62 + rng() * 25; for (let k = 0; k < 6; k++) ch.gb.solid.cyl(sx, h0 + hgt / 6 * k, sz, 3.6 - k * 0.2, 3.4 - k * 0.2, hgt / 6, 10, k % 2 ? pal('#d8d8d4') : pal('#c8372d'), { base: true, cap: k === 5 }); Gen.addCircCol(ch, sx, sz, 3.7, hgt);
    ch.glow(sx, h0 + hgt + 1, sz, 1, 0.1, 0.08, 20, 1.5); ch.emitters.push({ x: sx, y: h0 + hgt, z: sz });
  } else if (typ === 3) { // Tanks
    for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) { const tx = x0 + inner * (0.25 + a * 0.5), tz = z0 + inner * (0.17 + b * 0.33), r = 9 + rng() * 3, hh = 13 + rng() * 8; ch.gb.metal.cyl(tx, h0, tz, r, r, hh, 16, pal(pick(rng, ['#e3e3e0', '#d5d9dc', '#c8cdd0'])), { base: true }); ch.gb.metal.cyl(tx, h0 + hh, tz, r * 1.02, r * 0.98, 0.8, 16, pal('#8c9094'), { base: true }); Gen.addCircCol(ch, tx, tz, r, hh); }
    ch.gb.metal.beam(x0 + inner * 0.25, h0 + 12, z0 + inner * 0.17, x0 + inner * 0.75, h0 + 12, z0 + inner * 0.83, 0.6, 0.6, pal('#9a9ea2'));
  } else if (typ === 4) { // Container-Hof
    for (let a = 0; a < 6; a++) for (let b = 0; b < 8; b++) { if (rng() < 0.15) continue; const st = 1 + Math.floor(rng() * 3); for (let s = 0; s < st; s++) ch.gb.solid.box(x0 + 6 + a * 11.5, h0 + 1.3 + s * 2.62, z0 + 6 + b * 8.4, 2.5, 2.55, 12, 0, C(pick(rng, CONTAINER))); Gen.addBoxCol(ch, x0 + 6 + a * 11.5, z0 + 6 + b * 8.4, 2.5, 12, 0, st * 2.6); }
  } else { // Silos
    for (let a = 0; a < 4; a++) { const sx = x0 + inner * (0.2 + a * 0.2), sz = bz; ch.gb.metal.cyl(sx, h0, sz, 6, 6, 32, 14, pal('#d4d0c6'), { base: true }); ch.gb.metal.cyl(sx, h0 + 32, sz, 6, 1.5, 4, 14, pal('#9a968c'), { base: true }); Gen.addCircCol(ch, sx, sz, 6, 36); }
    building(ch, bx, bz + inner * 0.3, inner * 0.7, 18, 8, 0, 'C', C('#a9aeb0'), rng, { y0: h0 });
  }
}
function industrialScatter(ch, rng) {
  if (ch.lod > 1) return; const sp = 62; const x0 = ch.cx0, z0 = ch.cz0;
  for (let a = 0; a < CH / sp; a++) for (let b = 0; b < CH / sp; b++) {
    const x = x0 + a * sp + rng() * sp, z = z0 + b * sp + rng() * sp; const di = Math.hypot((x - 950) / 720, (z - 1500) / 460); if (di > 1.12) continue;
    if (x > 560 && x < 1390 && z > 1160 && z < 1840) continue; if (isRoadNear(x, z, 40)) continue; const w = 28 + rng() * 40, d = 22 + rng() * 28; building(ch, x, z, w, d, 8 + rng() * 8, 0, 'C', C(pick(rng, ['#b9bcbd', '#a9aeb0', '#c9c2b4'])), rng, {});
  }
}

/* ------------------------------------------------------------------ Hafen */
function harbor(ch, rng) {
  const lod = ch.lod; const x0 = ch.cx0, z0 = ch.cz0, x1 = x0 + CH, z1 = z0 + CH; if (x1 < -2060 || x0 > -1650 || z1 < -720 || z0 > 880) return; const h0 = 4;
  const zs = [-700, -500, -250, 0, 250, 500, 800];
  // Containerstapel zwischen Kai-Straße und Wasser
  for (let k = 0; k < zs.length - 1; k++) { const za = zs[k] + 14, zb = zs[k + 1] - 14; if ((za + zb) / 2 < z0 - 100 || (za + zb) / 2 > z1 + 100) continue; if (Math.abs((za + zb) / 2) < 30) continue; const r2 = U.mulberry(1000 + k * 17);
    const sx0 = -1985, sx1 = -1862; for (let x = sx0; x < sx1; x += 14) { for (let z = za; z < zb; z += 2.7) { if (r2() < 0.2) continue; const px = x + 6.5, pz = z + 1.35; if (!inCh(ch, px, pz)) continue; const st = 1 + Math.floor(r2() * 4); const c = C(pick(r2, CONTAINER)); if (lod > 0 && st > 1) { ch.gb.solid.box(px, h0 + st * 1.3, pz, 12, st * 2.6, 2.5, 0, c); } else for (let s = 0; s < st; s++) ch.gb.solid.box(px, h0 + 1.3 + s * 2.62, pz, 12, 2.55, 2.5, 0, c); if (z % 3 < 2.7 && r2() < 0.25) Gen.addBoxCol(ch, px, pz, 12, 2.5, 0, st * 2.6); } } }
  // Lagerhallen landseitig
  for (const zc of [-620, -380, -125, 125, 380, 650]) { if (!inCh(ch, -1775, zc)) continue; building(ch, -1775, zc, 70, 120, 13, 0, 'C', C(pick(rng, ['#b9bcbd', '#9fb0b8', '#c8b9a0'])), rng, { y0: h0 }); }
  // Kräne
  for (const zc of [-390, -140, 140, 390]) { if (!inCh(ch, -1996, zc)) continue; const cx = -1996; const col = pal('#d6552b');
    for (const dz of [-8, 8]) for (const dx of [0, 14]) ch.gb.metal.beam(cx + dx, h0, zc + dz, cx + dx, h0 + 38, zc + dz, 1.6, 1.6, col);
    ch.gb.metal.box(cx + 7, h0 + 38.5, zc, 20, 3, 22, 0, col); ch.gb.metal.box(cx - 24, h0 + 40, zc, 70, 2.4, 3.6, 0, col); ch.gb.metal.box(cx - 44, h0 + 37, zc, 8, 4, 6, 0, pal('#4a5057'));
    ch.gb.neon.box(cx - 58, h0 + 40, zc, 0.6, 0.6, 0.6, 0, [2.6, 0.2, 0.2]); ch.glow(cx - 58, h0 + 41, zc, 1, 0.1, 0.1, 18, 1.3); ch.glow(cx + 7, h0 + 41, zc, 1, 0.9, 0.7, 20); Gen.addBoxCol(ch, cx + 7, zc, 24, 20, 0, 40); }
  // Schiffe
  if (lod <= 1) for (const [zc, len] of [[-330, 250], [330, 230]]) { if (zc < z0 - 140 || zc > z1 + 140) continue; const sx = -2050; const hull = pal('#27323b'), red = pal('#8a2a22');
    if (inCh(ch, sx, zc)) { ch.gb.solid.box(sx, 6, zc, 34, 22, len, 0, hull); ch.gb.solid.box(sx, -4.5, zc, 31, 3, len - 6, 0, red); ch.gb.solid.box(sx, 18.4, zc - len * 0.36, 26, 2, len * 0.22, 0, pal('#4a525a')); ch.gb.solid.box(sx, 28, zc + len * 0.41, 24, 22, 20, 0, pal('#e8e8e3')); ch.gb.solid.box(sx, 41, zc + len * 0.41, 26, 3, 22, 0, pal('#d8d8d3'));
      for (let a = -2; a <= 2; a++) for (let b = 0; b < 9; b++) { if (lod > 0 && b % 2) continue; const st = 1 + ((a + b) & 1) + (b > 6 ? 1 : 0); for (let s = 0; s < st; s++) ch.gb.solid.box(sx + a * 5.4, 18.5 + 1.4 + s * 2.62, zc - len * 0.4 + b * (len * 0.5 / 9) * 1.45, 5, 2.55, 12, 0, C(pick(rng, CONTAINER))); }
      ch.gb.neon.box(sx, 44.5, zc + len * 0.41, 1, 1, 1, 0, [2.6, 0.2, 0.2]); ch.glow(sx, 45.5, zc + len * 0.41, 1, 0.1, 0.1, 20, 1.4); Gen.addBoxCol(ch, sx + 0, zc, 34, len, 0, 22); }
  }
  // Flutlichtmasten
  if (lod === 0) for (let z = -660; z < 800; z += 85) { const x = -1930; if (!inCh(ch, x, z)) continue; ch.gb.metal.cyl(x, h0, z, 0.35, 0.25, 26, 6, pal('#666'), { base: true, cap: false }); ch.gb.neon.box(x, h0 + 26.4, z, 4, 0.5, 1.2, 0, [3.2, 2.9, 2.2]); ch.glow(x, h0 + 26, z, 1, 0.92, 0.75, 22); Gen.addCircCol(ch, x, z, 0.4, 26, true); }
}

/* ------------------------------------------------------------------ Vorstadt / Land */
function house(ch, x, z, rng) {
  const [lo, hi] = groundRange(x, z, 12, 10, 0); if (hi - lo > 2.5) return; const ry = Math.floor(rng() * 4) * Math.PI / 2 + (rng() - 0.5) * 0.1; const w = 8 + rng() * 6, d = 7 + rng() * 5, h = 4.2 + rng() * 3.5; const wall = C(pick(rng, rng() < 0.3 ? BRICK : PASTEL)); const base = hi;
  ch.gb.A.box(x, base + h / 2 - 0.6, z, w, h + 1.2, d, ry, wall, { tile: TILE.A, uo: Math.floor(rng() * 8) / 8, vo: 0, shade: [1, 0.92, 0.96, 0.9, 1, 0.5] });
  ch.gb.solid.gable(x, base + h - 0.6, z, w + 0.8, d + 0.8, 2.4 + rng() * 1.2, ry + (rng() < 0.5 ? 0 : Math.PI / 2), C(pick(rng, ROOF)), C(pick(rng, ROOF))); Gen.addBoxCol(ch, x, z, w, d, ry, base + h);
  if (rng() < 0.5) { const [dx, dz] = rot(w * 0.2, 0, ry); ch.gb.solid.box(x + dx, base + h + 2.4, z + dz, 0.9, 2.2, 0.9, ry, pal('#6a5a50')); }
  if (ch.lod === 0) { for (let k = 0; k < 2; k++) tree(ch, x + (rng() - 0.5) * 24, z + (rng() - 0.5) * 24 + 12, W.terrainH(x, z), rng, 0.7 + rng() * 0.4, 1); }
}
function barn(ch, x, z, rng) { const ry = rng() * Math.PI; const [lo, hi] = groundRange(x, z, 16, 24, ry); if (hi - lo > 2.5) return; ch.gb.solid.box(x, hi + 3.5, z, 14, 7.4, 22, ry, C(pick(rng, ['#8a3a2a', '#a04a36', '#7a5a44']))); ch.gb.solid.gable(x, hi + 7.2, z, 15, 22.6, 4.5, ry + Math.PI / 2, pal('#5a5a5a')); Gen.addBoxCol(ch, x, z, 14, 22, ry, hi + 8); ch.gb.metal.cyl(x + Math.cos(ry) * 11, hi, z - Math.sin(ry) * 11, 2.4, 2.4, 11, 8, pal('#c9c9c4'), { base: true }); }
function turbine(ch, x, z, rng) { const y = W.terrainH(x, z); const col = pal('#e8ecef'); ch.gb.metal.cyl(x, y, z, 2.2, 1.2, 70, 10, col, { base: true, cap: false }); ch.gb.metal.box(x, y + 71, z, 4, 3.5, 7, 0, col); const a0 = rng() * 6; for (let k = 0; k < 3; k++) { const a = a0 + k * Math.PI * 2 / 3; ch.gb.metal.beam(x, y + 71, z - 4, x, y + 71 + Math.cos(a) * 38, z - 4 + Math.sin(a) * 0.01 + 0, 1.4, 0.4, col); } ch.glow(x, y + 74, z, 1, 0.1, 0.1, 14, 1.2); Gen.addCircCol(ch, x, z, 2.3, 72); }
function scatter(ch, rng) {
  const lod = ch.lod; if (lod > 0) { /* nur LOD0 */ return; } const x0 = ch.cx0, z0 = ch.cz0;
  const nrm = new THREE.Vector3(); const sp = 11;
  for (let a = 0; a < CH / sp; a++) for (let b = 0; b < CH / sp; b++) {
    const x = x0 + a * sp + rng() * sp, z = z0 + b * sp + rng() * sp; const zone = W.zoneAt(x, z); if (zone === 'sea' || zone === 'city' || zone === 'industrial' || zone === 'harbor') continue;
    const h = W.terrainH(x, z); if (h < 2.6 || h > 440) continue; const forest = fbm(x / 280 + 40, z / 280 - 10, 2); const r = Math.hypot(x, z);
    let dens = zone === 'suburb' ? 0.16 : sstep(-0.05, 0.3, forest) * 0.95 * (1 - sstep(300, 440, h)); if (zone === 'suburb') dens += sstep(-0.05, 0.2, forest) * 0.2; if (rng() > dens) continue;
    if (isRoadNear(x, z, 7)) continue; W.terrainNormal(x, z, nrm); if (nrm.y < 0.8) continue; tree(ch, x, z, h - 0.2, rng, 0.9 + rng() * 0.7);
  }
  // Häuser
  const hs = zone => zone === 'suburb' ? 46 : 150; const step = 46;
  for (let a = 0; a < CH / step; a++) for (let b = 0; b < CH / step; b++) {
    const x = x0 + a * step + rng() * step, z = z0 + b * step + rng() * step; const zone = W.zoneAt(x, z); if (zone === 'city' || zone === 'industrial' || zone === 'harbor' || zone === 'sea') continue;
    const h = W.terrainH(x, z); if (h < 3 || h > 260) continue; const p = zone === 'suburb' ? 0.55 : 0.035 * (1 - sstep(80, 260, h)); if (rng() > p) continue; if (isRoadNear(x, z, 16)) continue; if (zone === 'suburb' && rng() < 0.12) { tower(ch, x, z, 24, 18, 18 + rng() * 22, rng, { style: 'A', neonBand: false }); continue; } if (zone !== 'suburb' && rng() < 0.25) barn(ch, x, z, rng); else house(ch, x, z, rng);
  }
  if (rng() < 0.8) for (let k = 0; k < 2; k++) { const x = x0 + rng() * CH, z = z0 + rng() * CH; const h = W.terrainH(x, z); if (h > 40 && h < 240 && W.zoneAt(x, z) === 'rural' && !isRoadNear(x, z, 30)) turbine(ch, x, z, rng); }
}
/* Leuchtreklame/Tafeln an Autobahnen */
function highwayProps(ch, rng) {
  if (ch.lod > 0) return; const list = Gen.roadsByChunkKey ? null : null;
}
function lighthouse(ch) { const x = 150, z = 2745; if (!inCh(ch, x, z)) return; const y = W.terrainH(x, z); ch.gb.solid.cyl(x, y, z, 5, 3, 34, 12, pal('#e9e7e1'), { base: true }); ch.gb.solid.cyl(x, y + 34, z, 3.6, 3.6, 3, 12, pal('#2c3a48'), { base: true }); ch.gb.neon.cyl(x, y + 37, z, 2.6, 2.6, 3, 12, [3.0, 2.6, 1.5], { base: true }); ch.gb.solid.cyl(x, y + 40, z, 4.6, 0.2, 2.5, 12, pal('#8a2a22'), { base: true }); ch.glow(x, y + 38.5, z, 1.4, 1.2, 0.8, 60, 0.4); Gen.addCircCol(ch, x, z, 5, 40); }

/* ------------------------------------------------------------------ Einstieg */
Z.build = function* (ch) {
  const lod = ch.lod; const x0 = ch.cx0, z0 = ch.cz0, x1 = x0 + CH, z1 = z0 + CH; const rngC = U.mulberry((ch.cx + 40) * 7919 + (ch.cz + 40) * 104729);
  // Stadtblöcke
  if (x1 > -722 && x0 < 722 && z1 > -722 && z0 < 722) for (let i = -6; i <= 5; i++) for (let j = -6; j <= 5; j++) { const cx = 120 * i + 60, cz = 120 * j + 60; if (cx >= x0 && cx < x1 && cz >= z0 && cz < z1) { if (lod < 2 || Math.hypot(cx, cz) < 400) cityBlock(ch, i, j); } }
  yield;
  // Industrie
  if (x1 > 560 && x0 < 1390 && z1 > 1160 && z0 < 1840) for (let a = 0; a < 5; a++) for (let b = 0; b < 4; b++) { const bx = 600 + a * 150 + 75, bz = 1200 + b * 150 + 75; if (bx >= x0 && bx < x1 && bz >= z0 && bz < z1 && lod < 2) industrialBlock(ch, bx, bz, 150, U.mulberry(a * 31 + b * 7 + 3)); }
  if (lod < 2) industrialScatter(ch, rngC);
  harbor(ch, U.mulberry((ch.cx + 40) * 31 + (ch.cz + 40) * 17));
  lighthouse(ch);
  yield;
  if (lod === 0) { scatter(ch, rngC); }
  if (lod === 0 && ch.cx === 8 && ch.cz === 0) { /* Hochwald */ }
};
G.Zones = Z;
})(window.G = window.G || {});
