/* NEON REDLINE – world_gen.js : Chunk-Streaming, Gelände, Straßen, Tunnel, Brücke, Laternen */
(function (G) {
'use strict';
const U = G.U, W = G.World; const { clamp, lerp, sstep, noise2, fbm } = U; const CH = W.CH; const HALF = W.HALF;
const Gen = { chunks: new Map(), root: new THREE.Group(), queue: [], pending: new Set(), colCells: new Map(), stats: { built: 0, ms: 0 } };
const C = hex => U.colRGB(hex); const PAL = {};
function pal(k, hex) { return PAL[k] || (PAL[k] = U.colRGB(hex)); }
const CONC = () => pal('conc', '#9a9a96'), DARK = () => pal('dark', '#2c2e33');
const ckey = (cx, cz) => cx * 1000 + cz;
const TER = { grass1: C('#587a38'), grass2: C('#8a9446'), forest: C('#2c4a2a'), rock: C('#6b645c'), rock2: C('#8a7f72'), snow: C('#e8eef3'), sand: C('#cbb98f'), dirt: C('#6a5840'), city: C('#55565a'), ind: C('#55524c'), harbor: C('#6b6c6e'), seabed: C('#35505a') };
let roadsByChunk = null;

/* ------------------------------------------------------------------ Vorbereitung */
Gen.prepare = function () {
  roadsByChunk = new Map();
  for (const r of W.Roads.list) for (let i = 0; i < r.n - 1; i++) {
    const mx = (r.x[i] + r.x[i + 1]) / 2, mz = (r.z[i] + r.z[i + 1]) / 2; const k = ckey(Math.floor(mx / CH), Math.floor(mz / CH)); let a = roadsByChunk.get(k); if (!a) { a = []; roadsByChunk.set(k, a); } a.push({ r, i });
  }
};
function lampAdd(ch, x, y, z) { ch.lamps.push(x, y, z); }

/* ------------------------------------------------------------------ Kollisionsraster */
const CC = 16; const ccKey = (ix, iz) => ix * 10007 + iz;
function addCollider(ch, c) {
  ch.cols.push(c); const r = c.t ? c.r : Math.hypot(c.hx, c.hz); const x0 = Math.floor((c.x - r) / CC), x1 = Math.floor((c.x + r) / CC), z0 = Math.floor((c.z - r) / CC), z1 = Math.floor((c.z + r) / CC);
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) { const k = ccKey(ix, iz); let a = Gen.colCells.get(k); if (!a) { a = []; Gen.colCells.set(k, a); } a.push(c); }
}
function removeColliders(ch) {
  for (const c of ch.cols) { const r = c.t ? c.r : Math.hypot(c.hx, c.hz); const x0 = Math.floor((c.x - r) / CC), x1 = Math.floor((c.x + r) / CC), z0 = Math.floor((c.z - r) / CC), z1 = Math.floor((c.z + r) / CC);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) { const k = ccKey(ix, iz); const a = Gen.colCells.get(k); if (!a) continue; const p = a.indexOf(c); if (p >= 0) a.splice(p, 1); if (!a.length) Gen.colCells.delete(k); } }
  ch.cols.length = 0;
}
Gen.colliders = function (x, z, rad, out) {
  out.length = 0; const x0 = Math.floor((x - rad) / CC), x1 = Math.floor((x + rad) / CC), z0 = Math.floor((z - rad) / CC), z1 = Math.floor((z + rad) / CC);
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) { const a = Gen.colCells.get(ccKey(ix, iz)); if (a) for (let k = 0; k < a.length; k++) if (!a[k].dead && out.indexOf(a[k]) < 0) out.push(a[k]); }
  return out;
};
Gen.addBoxCol = (ch, x, z, sx, sz, ry, top, soft) => addCollider(ch, { t: 0, x, z, hx: sx / 2, hz: sz / 2, cs: Math.cos(ry || 0), sn: Math.sin(ry || 0), top: top || 10, soft: !!soft });
Gen.addCircCol = (ch, x, z, r, top, soft, brk) => { const c = { t: 1, x, z, r, top: top || 10, soft: !!soft, brk: brk || null }; addCollider(ch, c); return c; };

/* ------------------------------------------------------------------ Gelände */
function terrainColor(x, z, h, ny, out) {
  const n1 = fbm(x / 55, z / 55, 2) * 0.5 + 0.5, n2 = noise2(x / 7, z / 7) * 0.5 + 0.5; const v = 0.86 + n2 * 0.28;
  let c = TER.grass1; let r, g, b;
  const ax = Math.abs(x), az = Math.abs(z);
  const di = Math.hypot((x - 950) / 720, (z - 1500) / 460);
  if (ax <= 790 && az <= 790) c = TER.city;
  else if (di < 1.05) c = TER.ind;
  else if (x < -1640 && x > -2030 && Math.abs(z) < 860) c = TER.harbor;
  else {
    r = lerp(TER.grass1[0], TER.grass2[0], n1); g = lerp(TER.grass1[1], TER.grass2[1], n1); b = lerp(TER.grass1[2], TER.grass2[2], n1);
    const forest = sstep(-0.05, 0.25, fbm(x / 280 + 40, z / 280 - 10, 2)) * (1 - sstep(300, 430, h));
    r = lerp(r, TER.forest[0], forest * 0.85); g = lerp(g, TER.forest[1], forest * 0.85); b = lerp(b, TER.forest[2], forest * 0.85);
    const sand = (1 - sstep(1.2, 3.4, h)) * (h > -4 ? 1 : 0); r = lerp(r, TER.sand[0], sand); g = lerp(g, TER.sand[1], sand); b = lerp(b, TER.sand[2], sand);
    const rockK = Math.max(sstep(0.86, 0.68, ny), sstep(300, 420, h + n1 * 60) * 0.7); const rc = n2 > 0.55 ? TER.rock2 : TER.rock; r = lerp(r, rc[0], rockK); g = lerp(g, rc[1], rockK); b = lerp(b, rc[2], rockK);
    const sn = sstep(430 + n1 * 70, 520 + n1 * 70, h) * sstep(0.55, 0.85, ny); r = lerp(r, TER.snow[0], sn); g = lerp(g, TER.snow[1], sn); b = lerp(b, TER.snow[2], sn);
    if (h < -0.5) { const sb = sstep(-0.5, -6, h); r = lerp(r, TER.seabed[0], sb); g = lerp(g, TER.seabed[1], sb); b = lerp(b, TER.seabed[2], sb); }
    out[0] = r * v; out[1] = g * v; out[2] = b * v; return out;
  }
  const q = v * (0.9 + n1 * 0.2); out[0] = c[0] * q; out[1] = c[1] * q; out[2] = c[2] * q; return out;
}
function* terrainMesh(ch) {
  const N = [40, 20, 10][ch.lod]; const step = CH / N; const x0 = ch.cx * CH, z0 = ch.cz * CH; const S = N + 3; const H = new Float32Array(S * S);
  for (let j = -1; j <= N + 1; j++) { for (let i = -1; i <= N + 1; i++) H[(j + 1) * S + i + 1] = W.terrainH(x0 + i * step, z0 + j * step); if (ch.lod === 0 && (j & 7) === 7) yield; }
  const V = (N + 1) * (N + 1); const skirtN = N * 4; const pos = new Float32Array((V + skirtN) * 3), nor = new Float32Array((V + skirtN) * 3), col = new Float32Array((V + skirtN) * 3), uv = new Float32Array((V + skirtN) * 2);
  const tmp = [0, 0, 0]; const hAt = (i, j) => H[(j + 1) * S + i + 1];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = j * (N + 1) + i; const h = hAt(i, j); const hx = hAt(i + 1, j) - hAt(i - 1, j), hz = hAt(i, j + 1) - hAt(i, j - 1); const l = Math.hypot(hx, 2 * step, hz); const nx = -hx / l, ny = 2 * step / l, nz = -hz / l;
    pos[k * 3] = x0 + i * step; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z0 + j * step; nor[k * 3] = nx; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nz;
    terrainColor(x0 + i * step, z0 + j * step, h, ny, tmp); col[k * 3] = tmp[0]; col[k * 3 + 1] = tmp[1]; col[k * 3 + 2] = tmp[2]; uv[k * 2] = (x0 + i * step) / 9; uv[k * 2 + 1] = (z0 + j * step) / 9;
  }
  const idx = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  // Säume gegen Risse zwischen LOD-Stufen
  let sk = V; const border = []; for (let i = 0; i <= N; i++) border.push(i); for (let j = 1; j <= N; j++) border.push(j * (N + 1) + N); for (let i = N - 1; i >= 0; i--) border.push(N * (N + 1) + i); for (let j = N - 1; j >= 1; j--) border.push(j * (N + 1));
  const drop = ch.lod === 0 ? 6 : ch.lod === 1 ? 14 : 30; const sIdx = [];
  for (let q = 0; q < border.length; q++) { const s = border[q]; pos[sk * 3] = pos[s * 3]; pos[sk * 3 + 1] = pos[s * 3 + 1] - drop; pos[sk * 3 + 2] = pos[s * 3 + 2]; nor[sk * 3] = nor[s * 3]; nor[sk * 3 + 1] = nor[s * 3 + 1]; nor[sk * 3 + 2] = nor[s * 3 + 2]; col[sk * 3] = col[s * 3]; col[sk * 3 + 1] = col[s * 3 + 1]; col[sk * 3 + 2] = col[s * 3 + 2]; uv[sk * 2] = uv[s * 2]; uv[sk * 2 + 1] = uv[s * 2 + 1]; sIdx.push(sk); sk++; }
  for (let q = 0; q < border.length; q++) { const q2 = (q + 1) % border.length; const a = border[q], b = border[q2], a2 = sIdx[q], b2 = sIdx[q2]; idx.push(a, b, a2, b, b2, a2); idx.push(a, a2, b, b, a2, b2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, G.Mats.terrain); m.receiveShadow = true; m.frustumCulled = true; ch.add(m, g, 'terrain');
}

/* ------------------------------------------------------------------ Straßen */
function roadNormal3(r, i, out) { // Normale der Fahrbahn
  const j = Math.min(r.n - 1, i + 1), k = Math.max(0, i - 1); const dh = (r.h[j] - r.h[k]) / Math.max(0.1, r.s[j] - r.s[k]); const l = Math.hypot(1, dh); out[0] = -dh * r.tx[i] / l; out[1] = 1 / l; out[2] = -dh * r.tz[i] / l; return out;
}
function ribbon(g, r, i0, i1, yOff, half, uvScale) {
  // g: { p:[], n:[], u:[], i:[], v:0 }
  const nn = [0, 1, 0]; const base = g.v;
  for (let i = i0; i <= i1; i++) {
    const rx = -r.tz[i], rz = r.tx[i]; roadNormal3(r, i, nn); const y = r.h[i] + yOff; const v = r.s[i] / 12;
    g.p.push(r.x[i] - rx * half, y, r.z[i] - rz * half, r.x[i] + rx * half, y, r.z[i] + rz * half); g.n.push(nn[0], nn[1], nn[2], nn[0], nn[1], nn[2]); g.u.push(0, v, 1, v); g.v += 2;
  }
  for (let k = 0; k < i1 - i0; k++) { const a = base + k * 2; g.i.push(a, a + 1, a + 3, a, a + 3, a + 2); }
}
function skirt(g, r, i0, i1, yOff, half, side) {
  const base = g.v; const nn = [0, 1, 0];
  for (let i = i0; i <= i1; i++) { const rx = (-r.tz[i]) * side, rz = r.tx[i] * side; const y = r.h[i] + yOff; const v = r.s[i] / 12; const u = side > 0 ? 1 : 0;
    g.p.push(r.x[i] + rx * half, y, r.z[i] + rz * half, r.x[i] + rx * (half + 0.05), y - 0.45, r.z[i] + rz * (half + 0.05)); g.n.push(rx, 0, rz, rx, 0, rz); g.u.push(u, v, u, v); g.v += 2; }
  for (let k = 0; k < i1 - i0; k++) { const a = base + k * 2; if (side > 0) g.i.push(a, a + 3, a + 1, a, a + 2, a + 3); else g.i.push(a, a + 1, a + 3, a, a + 3, a + 2); }
}
function newRibbon() { return { p: [], n: [], u: [], i: [], v: 0 }; }
function ribbonToMesh(g, mat) { if (!g.v) return null; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2)); geo.setIndex(g.v > 65535 ? new THREE.Uint32BufferAttribute(g.i, 1) : new THREE.Uint16BufferAttribute(g.i, 1)); geo.computeBoundingSphere(); const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; return [m, geo]; }

function buildRoads(ch) {
  const list = roadsByChunk.get(ckey(ch.cx, ch.cz)); if (!list) return; const rib = {}; const gb = ch.gb;
  const lampStep = {};
  for (const { r, i } of list) {
    const T = r.T; const fl = r.flags[i];
    if (!rib[r.type]) rib[r.type] = newRibbon(); const g = rib[r.type]; const yOff = 0.03 + T.rank * 0.014;
    ribbon(g, r, i, i + 1, yOff, T.half);
    if (!(fl & 2)) { skirt(g, r, i, i + 1, yOff, T.half, 1); skirt(g, r, i, i + 1, yOff, T.half, -1); }
    const L = r.s[i + 1] - r.s[i];
    // Brücke: Fahrbahnplatte, Brüstung
    if (fl & 2) {
      const hA = r.h[i], hB = r.h[i + 1]; gb.solid.beam(r.x[i], hA - 0.95, r.z[i], r.x[i + 1], hB - 0.95, r.z[i + 1], T.w + 2.4, 1.5, pal('concd', '#8d8d89'));
      for (const sd of [-1, 1]) { const ox = -r.tz[i] * sd * (T.half + 0.25), oz = r.tx[i] * sd * (T.half + 0.25), ox2 = -r.tz[i + 1] * sd * (T.half + 0.25), oz2 = r.tx[i + 1] * sd * (T.half + 0.25); gb.solid.beam(r.x[i] + ox, hA + 0.6, r.z[i] + oz, r.x[i + 1] + ox2, hB + 0.6, r.z[i + 1] + oz2, 0.5, 1.2, pal('concl', '#b5b5b0')); }
    }
    // Leitplanken
    if ((fl & 12) && !(fl & 3)) for (const sd of [1, -1]) { const bit = sd > 0 ? 8 : 4; if (!(fl & bit)) continue; const off = T.half + 1.1; const ox = -r.tz[i] * sd * off, oz = r.tx[i] * sd * off, ox2 = -r.tz[i + 1] * sd * off, oz2 = r.tx[i + 1] * sd * off;
      gb.metal.beam(r.x[i] + ox, r.h[i] + 0.62, r.z[i] + oz, r.x[i + 1] + ox2, r.h[i + 1] + 0.62, r.z[i + 1] + oz2, 0.12, 0.32, pal('rail', '#b9bcc0')); gb.solid.box(r.x[i] + ox, r.h[i] + 0.3, r.z[i] + oz, 0.14, 0.7, 0.14, 0, pal('post', '#5a5a5a')); }
    // Mittelleitplanke (Autobahn)
    if (r.type === 'hw' && !(fl & 2)) { gb.solid.beam(r.x[i], r.h[i] + 0.42, r.z[i], r.x[i + 1], r.h[i + 1] + 0.42, r.z[i + 1], 0.55, 0.85, pal('jersey', '#a9a9a4')); }
    // Laternen
    if (ch.lod === 0 && L > 0) {
      const spacing = r.type === 'hw' ? 42 : (r.type === 'co' || r.type === 'mt') ? 0 : 38; if (spacing > 0) {
        const s0 = r.s[i], s1 = r.s[i + 1]; const k0 = Math.ceil(s0 / spacing), k1 = Math.floor((s1 - 1e-6) / spacing);
        for (let k = k0; k <= k1; k++) { const f = (k * spacing - s0) / L; const px = lerp(r.x[i], r.x[i + 1], f), pz = lerp(r.z[i], r.z[i + 1], f), ph = lerp(r.h[i], r.h[i + 1], f);
          if (r.type === 'hw') { addLamp(ch, px, ph, pz, r.tz[i], -r.tx[i], 2, true); }
          else if (r.type === 'ar' || r.type === 'st') { const side = (k & 1) ? 1 : -1; const off = T.half + 1.2; const ox = -r.tz[i] * side * off, oz = r.tx[i] * side * off; addLamp(ch, px + ox, ph + 0.2, pz + oz, r.tz[i] * side, -r.tx[i] * side, 0, false); }
          else { const side = (k & 1) ? 1 : -1; const off = T.half + 1.0; addLamp(ch, px - r.tz[i] * side * off, ph, pz + r.tx[i] * side * off, r.tz[i] * side, -r.tx[i] * side, 0, false); }
          if ((fl & 2)) { /* Brückenleuchten */ } } }
    }
    // Tunnel
    if (fl & 1) buildTunnelSeg(ch, r, i);
  }
  for (const t in rib) { const res = ribbonToMesh(rib[t], G.Mats.road[t]); if (res) ch.add(res[0], res[1], 'road'); }
  // Tunnelportale, Brückenaufbauten
  for (const tn of W.tunnels) { for (const [idx, face] of [[tn.a, 1], [tn.b, -1]]) { const r = tn.r; const ci = Math.floor(r.x[idx] / CH), cj = Math.floor(r.z[idx] / CH); if (ci === ch.cx && cj === ch.cz) buildPortal(ch, r, idx, face); } }
  for (const r of W.Roads.list) if (r.bridge.length) for (const [a, b] of r.bridge) buildBridgeExtras(ch, r, a, b);
}
function addLamp(ch, x, y, z, ax, az, mode, dbl) {
  const gb = ch.gb; const h = dbl ? 10 : 8.6; const col = pal('lamp', '#6e7378'); const v0m = gb.metal.vc, v0n = gb.neon.vc;
  gb.metal.cyl(x, y, z, 0.15, 0.1, h, 6, col, { base: true, cap: false });
  const hx = x + ax * 2.6, hz = z + az * 2.6; gb.metal.beam(x, y + h - 0.2, z, hx, y + h + 0.1, hz, 0.12, 0.12, col);
  gb.neon.box(hx, y + h - 0.05, hz, 1.1, 0.14, 0.45, Math.atan2(ax, az), [2.6, 2.0, 1.1]);
  if (dbl) { const hx2 = x - ax * 2.6, hz2 = z - az * 2.6; gb.metal.beam(x, y + h - 0.2, z, hx2, y + h + 0.1, hz2, 0.12, 0.12, col); gb.neon.box(hx2, y + h - 0.05, hz2, 1.1, 0.14, 0.45, Math.atan2(ax, az), [2.6, 2.0, 1.1]); ch.glow(hx2, y + h - 0.3, hz2, 1.0, 0.75, 0.4, 7); }
  ch.glow(hx, y + h - 0.3, hz, 1.0, 0.75, 0.4, 7); lampAdd(ch, hx, y + h - 0.3, hz);
  const c = Gen.addCircCol(ch, x, z, 0.28, h, true, null); c.lampPole = true; c.ch = ch; c.brk = { m: [v0m, gb.metal.vc], n: [v0n, gb.neon.vc] };
}
Gen.breakLamp = function (c) {
  if (!c.brk || c.broken) return; c.broken = true; c.dead = true; const ch = c.ch; if (!ch || ch.dead) return;
  for (const me of ch.meshes) { const tag = me.userData.tag; const rg = tag === 'metal' ? c.brk.m : tag === 'neon' ? c.brk.n : null; if (!rg) continue; const pa = me.geometry.attributes.position; for (let v = rg[0]; v < rg[1]; v++) pa.setY(v, pa.getY(v) - 300); pa.needsUpdate = true; }
};

/* Tunnel */
const TUN = [[-1, 0], [-1, 3.0], [-0.93, 4.7], [-0.72, 6.1], [-0.4, 6.95], [0, 7.25], [0.4, 6.95], [0.72, 6.1], [0.93, 4.7], [1, 3.0], [1, 0]];
function buildTunnelSeg(ch, r, i) {
  const gb = ch.gb.tunnel; const hw = r.T.half + 1.5; const j = i + 1; const wall = pal('twall', '#aeb0ae'), ceil = pal('tceil', '#8f9190'), low = pal('tlow', '#c9c9c2');
  const ring = (k) => { const rx = -r.tz[k], rz = r.tx[k]; return TUN.map(([a, y]) => [r.x[k] + rx * a * hw, r.h[k] + y, r.z[k] + rz * a * hw]); };
  const A = ring(i), B = ring(j);
  for (let q = 0; q < TUN.length - 1; q++) { const col = q < 1 ? low : q > 3 && q < 7 ? ceil : wall; const y = TUN[q][1]; gb.quad4(A[q], B[q], B[q + 1], A[q + 1], q === 0 || q === 9 ? low : col, [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02]); }
  // Leuchtbänder & Glow
  for (const sd of [-1, 1]) { const off = hw - 0.9; const rx = -r.tz[i] * sd * off, rz = r.tx[i] * sd * off; const rx2 = -r.tz[j] * sd * off, rz2 = r.tx[j] * sd * off; const L = r.s[j] - r.s[i];
    if (ch.lod === 0) { const sMid = ((r.s[i] / 11) | 0); if (((i + (sd > 0 ? 0 : 1)) & 0) === 0) { ch.gb.neon.beam(r.x[i] + rx, r.h[i] + 5.55, r.z[i] + rz, lerp(r.x[i], r.x[j], 0.55) + lerp(rx, rx2, 0.55), lerp(r.h[i], r.h[j], 0.55) + 5.55, lerp(r.z[i], r.z[j], 0.55) + lerp(rz, rz2, 0.55), 0.35, 0.16, [2.4, 1.7, 0.8]); ch.glow(r.x[i] + rx, r.h[i] + 5.2, r.z[i] + rz, 1.0, 0.7, 0.3, 11); } } }
  const mx = (r.x[i] + r.x[j]) / 2, mz = (r.z[i] + r.z[j]) / 2; if ((i % 6) === 0) lampAdd(ch, mx, r.h[i] + 5.3, mz);
}
function buildPortal(ch, r, idx, face) {
  const gb = ch.gb; const hw = r.T.half + 1.5; const rx = -r.tz[idx], rz = r.tx[idx]; const tx = r.tx[idx] * face, tz = r.tz[idx] * face; const h = r.h[idx]; const col = pal('portal', '#9fa09b'); const ry = Math.atan2(r.tx[idx], r.tz[idx]);
  const side = hw + 5.5; // seitliche Pfeiler
  for (const sd of [-1, 1]) { const cx = r.x[idx] + rx * sd * (hw + side / 2 - 0.0 + 0.0) * 1.0, cz = r.z[idx] + rz * sd * (hw + side / 2); gb.solid.box(cx - tx * 1.2, h + 7, cz - tz * 1.2, side, 14, 3.0, ry, col); }
  gb.solid.box(r.x[idx] - tx * 1.2, h + 9.6 + 3, r.z[idx] - tz * 1.2, hw * 2 + 0.2, 6.4, 3.0, ry, col);
  gb.neon.box(r.x[idx] - tx * 2.8, h + 11.6, r.z[idx] - tz * 2.8, hw * 1.2, 1.0, 0.2, ry, [0.2, 1.8, 1.0]);
  Gen.addBoxCol(ch, r.x[idx] + rx * (hw + side / 2), r.z[idx] + rz * (hw + side / 2), side, 3, ry, 14); Gen.addBoxCol(ch, r.x[idx] - rx * (hw + side / 2), r.z[idx] - rz * (hw + side / 2), side, 3, ry, 14);
}
function buildBridgeExtras(ch, r, a, b) {
  const gb = ch.gb; const L = r.s[b] - r.s[a]; const half = r.T.half;
  // Pfeiler
  for (let s = r.s[a] + 30; s < r.s[b] - 20; s += 70) { const p = W.posAtS(r, s, {}); const ci = Math.floor(p.x / CH), cj = Math.floor(p.z / CH); if (ci !== ch.cx || cj !== ch.cz) continue;
    const ry = Math.atan2(p.tx, p.tz); const hBase = -38; const hh = p.h - 1.7 - hBase; gb.solid.box(p.x, hBase + hh / 2, p.z, 7.5, hh, 4, ry, pal('pier', '#9c9c96')); Gen.addBoxCol(ch, p.x, p.z, 7.5, 4, ry, p.h); }
  // Pylone bei 1/3 und 2/3
  for (const f of [0.33, 0.67]) { const s = r.s[a] + L * f; const p = W.posAtS(r, s, {}); const ci = Math.floor(p.x / CH), cj = Math.floor(p.z / CH); if (ci !== ch.cx || cj !== ch.cz) continue; const ry = Math.atan2(p.tx, p.tz); const rx = -p.tz, rz = p.tx; const top = p.h + 92; const col = pal('pylon', '#d8452c');
    for (const sd of [-1, 1]) { const px = p.x + rx * sd * (half + 2.2), pz = p.z + rz * sd * (half + 2.2); gb.solid.box(px, (-38 + top) / 2, pz, 3.6, top + 38, 5, ry, col); gb.neon.box(px, top + 0.8, pz, 1, 1.6, 1, 0, [2.6, 0.2, 0.2]); ch.glow(px, top + 1.5, pz, 1, 0.1, 0.1, 18, 1.2); Gen.addBoxCol(ch, px, pz, 3.6, 5, ry, p.h + 90); }
    for (const yy of [p.h + 30, p.h + 62, top - 4]) gb.solid.box(p.x, yy, p.z, (half + 2.2) * 2 + 3.6, 3, 4, ry, col);
    // Tragseile: von den Pylonen zu Fahrbahnpunkten
    const cols = pal('cable', '#e8ddd0');
    for (const sd of [-1, 1]) { const px = p.x + rx * sd * (half + 2.2), pz = p.z + rz * sd * (half + 2.2);
      for (let k = -9; k <= 9; k++) { if (k === 0) continue; const s2 = s + k * 22; if (s2 < r.s[a] || s2 > r.s[b]) continue; const q = W.posAtS(r, s2, {}); const qx = q.x + (-q.tz) * sd * (half + 0.5), qz = q.z + q.tx * sd * (half + 0.5); const t = Math.abs(k) / 9; const ty = top - 6 - t * 4; gb.metal.beam(px, ty + 0, pz, qx, q.h + 0.9, qz, 0.28, 0.28, cols); } }
  }
}

/* ------------------------------------------------------------------ Chunk-Objekt */
class Chunk {
  constructor(cx, cz, lod) {
    this.cx = cx; this.cz = cz; this.lod = lod; this.key = ckey(cx, cz); this.group = new THREE.Group(); this.meshes = []; this.geos = []; this.cols = []; this.lamps = []; this.emitters = [];
    this.gb = { solid: new U.GeoBuilder(), metal: new U.GeoBuilder(), A: new U.GeoBuilder(), B: new U.GeoBuilder(), C: new U.GeoBuilder(), neon: new U.GeoBuilder(), sign: new U.GeoBuilder(), ad: new U.GeoBuilder(), tunnel: new U.GeoBuilder() };
    this.gp = { p: [], c: [], s: [], ph: [] }; this.breakables = []; this.dead = false; this.cx0 = cx * CH; this.cz0 = cz * CH;
  }
  glow(x, y, z, r, g, b, size, phase) { this.gp.p.push(x, y, z); this.gp.c.push(r, g, b); this.gp.s.push(size); this.gp.ph.push(phase || 0); }
  add(mesh, geo, tag) { mesh.userData.tag = tag; this.group.add(mesh); this.meshes.push(mesh); this.geos.push(geo); }
  finish() {
    const Mt = G.Mats; const mk = (gb, mat, tag, cast, recv) => { const g = gb.build(); if (!g) return null; const m = new THREE.Mesh(g, mat); m.castShadow = !!cast; m.receiveShadow = recv !== false; this.add(m, g, tag); return m; };
    this.solidMesh = mk(this.gb.solid, Mt.solid, 'solid', true); mk(this.gb.metal, Mt.metal, 'metal', true);
    this.bMeshes = [mk(this.gb.A, Mt.bldg.A, 'bldg', true), mk(this.gb.B, Mt.bldg.B, 'bldg', true), mk(this.gb.C, Mt.bldg.C, 'bldg', true)].filter(Boolean);
    mk(this.gb.neon, Mt.neon, 'neon', false, false); mk(this.gb.sign, Mt.sign, 'sign', false, false); mk(this.gb.ad, Mt.ad, 'ad', false, false); const tm = mk(this.gb.tunnel, Mt.tunnel, 'tunnel', true);
    if (this.gp.p.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.gp.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.gp.c, 3)); g.setAttribute('size', new THREE.Float32BufferAttribute(this.gp.s, 1)); g.setAttribute('phase', new THREE.Float32BufferAttribute(this.gp.ph, 1)); g.computeBoundingSphere(); const p = new THREE.Points(g, Mt.glowPoints); p.frustumCulled = true; this.add(p, g, 'glow'); }
    for (const k in this.gb) this.gb[k] = null; this.gp = null;
  }
  dispose() { removeColliders(this); for (const g of this.geos) g.dispose(); this.dead = true; if (this.group.parent) this.group.parent.remove(this.group); }
}
Gen.Chunk = Chunk;

/* ------------------------------------------------------------------ Streaming */
function* buildChunk(cx, cz, lod) {
  const ch = new Chunk(cx, cz, lod); yield* terrainMesh(ch); yield;
  buildRoads(ch); yield;
  if (G.Zones) { yield* G.Zones.build(ch); }
  ch.finish(); return ch;
}
Gen.__build = buildChunk;
Gen.lodFor = function (d) { return d <= 2 ? 0 : d <= 4 ? 1 : 2; };
Gen.R = 7;
let focusCx = 9999, focusCz = 9999;
Gen.update = function (px, pz, budgetMs, forceAll) {
  const cx = Math.floor(px / CH), cz = Math.floor(pz / CH); const R = Gen.R; const t0 = performance.now();
  if (cx !== focusCx || cz !== focusCz || forceAll) {
    focusCx = cx; focusCz = cz; const need = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { const x = cx + dx, z = cz + dz; if (x < -13 || x > 12 || z < -13 || z > 12) continue; const d = Math.max(Math.abs(dx), Math.abs(dz)); const lod = Gen.lodFor(d); const k = ckey(x, z); const ex = Gen.chunks.get(k);
      if (!ex || (ex.lod > lod && !Gen.pending.has(k))) need.push({ x, z, lod, d, k, dist: Math.hypot(dx, dz) }); else if (ex && ex.lod < lod - 0 && d > (lod === 1 ? 3 : 5) && !Gen.pending.has(k)) { /* Hysterese: nicht herabstufen */ } }
    need.sort((a, b) => a.dist - b.dist); for (const n of need) { Gen.pending.add(n.k); Gen.queue.push({ k: n.k, x: n.x, z: n.z, lod: n.lod, gen: null }); }
    for (const [k, ch] of Gen.chunks) { if (Math.max(Math.abs(ch.cx - cx), Math.abs(ch.cz - cz)) > R + 1) { ch.dispose(); Gen.chunks.delete(k); } }
    Gen.queue.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
  }
  while (Gen.queue.length && (performance.now() - t0) < budgetMs) {
    const job = Gen.queue[0]; if (Math.max(Math.abs(job.x - focusCx), Math.abs(job.z - focusCz)) > R + 1) { Gen.queue.shift(); Gen.pending.delete(job.k); continue; }
    if (!job.gen) job.gen = buildChunk(job.x, job.z, job.lod);
    const r = job.gen.next(); if (r.done) { Gen.queue.shift(); Gen.pending.delete(job.k); const ch = r.value; const old = Gen.chunks.get(job.k); if (old) old.dispose(); Gen.chunks.set(job.k, ch); Gen.root.add(ch.group); Gen.stats.built++; }
  }
  Gen.stats.ms = performance.now() - t0; return Gen.queue.length;
};
Gen.disposeAll = function () { for (const [k, ch] of Gen.chunks) ch.dispose(); Gen.chunks.clear(); Gen.queue.length = 0; Gen.pending.clear(); focusCx = 9999; };
Gen.nearLamps = function (px, pz, n, out) {
  out.length = 0; const cx = Math.floor(px / CH), cz = Math.floor(pz / CH); const cand = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const ch = Gen.chunks.get(ckey(cx + dx, cz + dz)); if (!ch || ch.lod > 0) continue; const L = ch.lamps; for (let i = 0; i < L.length; i += 3) { const d = (L[i] - px) * (L[i] - px) + (L[i + 2] - pz) * (L[i + 2] - pz); cand.push([d, L[i], L[i + 1], L[i + 2]]); } }
  cand.sort((a, b) => a[0] - b[0]); for (let i = 0; i < n && i < cand.length; i++) out.push(cand[i]); return out;
};
Gen.chunkAt = (x, z) => Gen.chunks.get(ckey(Math.floor(x / CH), Math.floor(z / CH)));
Gen.roadsByChunkKey = ckey;

/* ------------------------------------------------------------------ Oberfläche (Grip) */
const _sq = { r: null };
Gen.surfaceAt = function (x, z, out) {
  out = out || {}; const q = W.queryRoad(x, z, 14, _sq);
  if (q.r && q.d < q.r.T.half + 0.6) { out.type = 'asphalt'; out.grip = 1.0; out.road = q.r; out.q = q; return out; }
  out.road = null; const h = W.terrainH(x, z);
  if (h < -0.3) { out.type = 'water'; out.grip = 0.2; return out; }
  if (q.r && q.d < q.r.T.core) { out.type = 'dirt'; out.grip = 0.62; return out; }
  const zone = W.zoneAt(x, z); if (zone === 'city' || zone === 'harbor' || zone === 'industrial') { out.type = 'concrete'; out.grip = 0.92; return out; }
  if (h < 2.4) { out.type = 'sand'; out.grip = 0.5; return out; }
  if (h > 470) { out.type = 'snow'; out.grip = 0.42; return out; }
  out.type = 'grass'; out.grip = 0.55; return out;
};

G.Gen = Gen;
})(window.G = window.G || {});
