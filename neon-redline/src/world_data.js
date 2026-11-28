/* NEON REDLINE – world_data.js : Gelände, Straßennetz, Profile, Kreuzungsgraph, Routen */
(function (G) {
'use strict';
const U = G.U; const { clamp, lerp, sstep, noise2, fbm, ridged } = U;
const HALF = 3000, CH = 250;

/* ------------------------------------------------------------------ Straßentypen */
const RT = {
  hw:  { w: 26, half: 13, lane: 3.7, lanes: 3, median: 1.2, core: 16, blend: 46, grade: 0.07, smooth: 90, spd: 40, rank: 3, name: 'Autobahn' },
  ar:  { w: 22, half: 11, lane: 3.4, lanes: 2, median: 0.4, core: 13, blend: 22, grade: 0.07, smooth: 40, spd: 22, rank: 2, name: 'Avenue' },
  st:  { w: 16, half: 8,  lane: 3.3, lanes: 1, median: 0.3, core: 9.5, blend: 14, grade: 0.08, smooth: 30, spd: 15, rank: 1, name: 'Straße' },
  ind: { w: 14, half: 7,  lane: 3.3, lanes: 1, median: 0.2, core: 8.5, blend: 14, grade: 0.08, smooth: 30, spd: 14, rank: 1, name: 'Werksstraße' },
  co:  { w: 9.6, half: 4.8, lane: 3.2, lanes: 1, median: 0.1, core: 6.5, blend: 22, grade: 0.10, smooth: 30, spd: 20, rank: 1, name: 'Landstraße' },
  mt:  { w: 9.8, half: 4.9, lane: 3.2, lanes: 1, median: 0.1, core: 6.6, blend: 28, grade: 0.12, smooth: 28, spd: 18, rank: 1, name: 'Passstraße' },
};

/* ------------------------------------------------------------------ Gelände (analytisch) */
function capsule(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz; let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}
const KAL = { x: 1650, z: -1950, R: 1000, H: 520 };
function kalmarH(r) { const t = 1 - sstep(0, KAL.R, r); return Math.pow(t, 1.15) * KAL.H; }
function kalmarSlope(r) { const t = 1 - r / KAL.R; return KAL.H * 1.15 * Math.pow(Math.max(t, 0.02), 0.15) / KAL.R; }

function plainH(x, z) {
  const r = Math.hypot(x, z);
  let h = 15 + 7 * fbm(x / 1100 + 11.3, z / 1100 - 4.7, 3);
  const rural = sstep(1000, 1800, r);
  h += rural * (fbm(x / 430 + 3.1, z / 430 + 8.8, 4) * 20 + fbm(x / 110, z / 110, 2) * 2);
  h = lerp(14, h, sstep(1100, 1500, r));
  const di = Math.hypot((x - 950) / 720, (z - 1500) / 460);
  h = lerp(9, h, sstep(1.0, 1.5, di));
  const hm = sstep(-1450, -1720, x) * (1 - sstep(750, 1150, Math.abs(z)));
  h = lerp(h, 4, hm);
  return h;
}
function massifs(x, z) {
  let m = 0;
  const dk = Math.hypot(x - KAL.x, z - KAL.z);
  if (dk < KAL.R) m = Math.max(m, kalmarH(dk) * (1 + 0.05 * noise2(x / 260, z / 260)) + 14 * Math.max(0, fbm(x / 140, z / 140, 2)) * (1 - dk / KAL.R));
  const dO = capsule(x, z, 2250, -1000, 2250, 1000); if (dO < 520) m = Math.max(m, Math.pow(1 - sstep(0, 520, dO), 1.1) * (400 + 120 * ridged(x / 400, z / 400, 3)));
  const dN = capsule(x, z, -800, -2150, 500, -2150); if (dN < 520) m = Math.max(m, Math.pow(1 - sstep(0, 520, dN), 1.1) * (430 + 140 * ridged(x / 400 + 9, z / 400, 3)));
  // allgemeines Bergland im Nordosten / Osten, Küstenhügel im Nordwesten
  const mn = sstep(-1500, -2300, z + 100 * noise2(x / 700, 0.5)), me = sstep(1700, 2500, x + 100 * noise2(0.5, z / 700));
  const mm = Math.max(mn, me) * (1 - sstep(950, 1100, dk) * 0 );
  if (mm > 0) m = Math.max(m, Math.pow(mm, 1.4) * (190 + 260 * ridged(x / 700 + 5, z / 700 + 9, 4)) + mm * fbm(x / 300, z / 300, 3) * 30);
  const e = Math.max(Math.abs(x), Math.abs(z)); m = Math.max(m, sstep(2700, 2990, e) * (330 + 120 * ridged(x / 500, z / 500, 3)));
  return m;
}
let valleyField = null; const VF_CELL = 60, VF_N = Math.ceil(HALF * 2 / VF_CELL) + 1;
function valleyAt(x, z) {
  if (!valleyField) return 400;
  const fx = (x + HALF) / VF_CELL, fz = (z + HALF) / VF_CELL; let ix = Math.floor(fx), iz = Math.floor(fz); if (ix < 0 || iz < 0 || ix >= VF_N - 1 || iz >= VF_N - 1) return 400;
  const tx = fx - ix, tz = fz - iz; const a = valleyField[iz * VF_N + ix], b = valleyField[iz * VF_N + ix + 1], c = valleyField[(iz + 1) * VF_N + ix], d = valleyField[(iz + 1) * VF_N + ix + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}
function baseB(x, z) {
  let m = massifs(x, z);
  if (m > 1) { const v = valleyAt(x, z); m *= 1 - 0.88 * (1 - sstep(60, 380, v)); }
  return plainH(x, z) + m;
}
function coastX(z) { return -2000 + (140 * noise2(z / 600, 3.1) + 60 * noise2(z / 200, 7.7)) * sstep(800, 1200, Math.abs(z)); }
function seaDepth(x, z) {
  const cx = coastX(z); const tw = lerp(15, 140, sstep(800, 1200, Math.abs(z)));
  let d = sstep(cx + tw * 0.2, cx - tw, x);
  const q = Math.hypot(x / 520, (z - 2150) / 450); d = Math.max(d, sstep(1.0, 0.7, q));
  return d * 40;
}

/* ------------------------------------------------------------------ Straßen */
const roads = []; const segGrid = new U.Grid(64);
const tunnels = [];
let stampCtr = 0;

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)];
}
/* def: {name,type,wp:[[x,z]..],straight,closed,ds,tun:[[wpA,wpB]],bridge:[[wpA,wpB]],valley,flat} */
function makeRoad(def) {
  const T = RT[def.type]; const r = { id: roads.length, name: def.name || ('Road' + roads.length), type: def.type, T, def, closed: !!def.closed };
  const wp = def.wp; const ds = def.ds || (def.straight ? 40 : (def.type === 'hw' ? 14 : 9)); const pts = []; const wpS = [];
  if (def.straight) {
    for (let k = 0; k < wp.length - 1; k++) { const a = wp[k], b = wp[k + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(L / ds)); for (let j = 0; j < n; j++) { if (j === 0) wpS[k] = pts.length; pts.push([lerp(a[0], b[0], j / n), lerp(a[1], b[1], j / n)]); } }
    wpS[wp.length - 1] = pts.length; pts.push([wp[wp.length - 1][0], wp[wp.length - 1][1]]);
  } else {
    const n = wp.length; const cl = def.closed; const get = i => cl ? wp[(i + n) % n] : wp[clamp(i, 0, n - 1)];
    const segs = cl ? n : n - 1;
    for (let k = 0; k < segs; k++) {
      const p0 = get(k - 1), p1 = get(k), p2 = get(k + 1), p3 = get(k + 2); const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); const m = Math.max(2, Math.round(L / ds));
      wpS[k] = pts.length; for (let j = 0; j < m; j++) pts.push(catmull(p0, p1, p2, p3, j / m));
    }
    if (cl) { wpS[n] = pts.length; pts.push([pts[0][0], pts[0][1]]); } else { wpS[n - 1] = pts.length; pts.push([wp[n - 1][0], wp[n - 1][1]]); }
  }
  const n = pts.length; r.n = n; r.x = new Float64Array(n); r.z = new Float64Array(n); r.s = new Float64Array(n); r.h = new Float64Array(n); r.flags = new Uint8Array(n);
  for (let i = 0; i < n; i++) { r.x[i] = pts[i][0]; r.z[i] = pts[i][1]; if (i > 0) r.s[i] = r.s[i - 1] + Math.hypot(r.x[i] - r.x[i - 1], r.z[i] - r.z[i - 1]); }
  r.len = r.s[n - 1]; r.tx = new Float64Array(n); r.tz = new Float64Array(n);
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); let dx = r.x[b] - r.x[a], dz = r.z[b] - r.z[a]; const l = Math.hypot(dx, dz) || 1; r.tx[i] = dx / l; r.tz[i] = dz / l; }
  r.wpIdx = wpS; r.stamp = 0; r.bestW = 0; r.bestH = 0;
  // Tunnel / Brücke Bereiche (Waypoint-Indizes)
  r.tun = (def.tun || []).map(([a, b]) => [wpS[a], wpS[b]]); r.bridge = (def.bridge || []).map(([a, b]) => [wpS[a], wpS[b]]);
  roads.push(r); return r;
}

function buildRoadsDef() {
  const R = [];
  const add = d => R.push(d);
  // --- Stadtraster
  for (let i = -6; i <= 6; i++) {
    const main = (i === 0 || Math.abs(i) === 6);
    add({ name: 'Nord-Süd ' + i, type: main ? 'ar' : 'st', wp: [[i * 120, -720], [i * 120, 720]], straight: true, flat: true, grid: 'ns' });
    add({ name: 'Ost-West ' + i, type: main ? 'ar' : 'st', wp: [[-720, i * 120], [720, i * 120]], straight: true, flat: true, grid: 'ew' });
  }
  // --- Ring (Autobahn), geschlossen
  const ring = []; for (let k = 0; k < 24; k++) { const a = k / 24 * U.TAU; const rr = 1250 + 55 * noise2(k * 0.7, 4.2); ring.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  add({ name: 'Ring A0', type: 'hw', wp: ring, closed: true, valley: true });
  // --- Radiale
  add({ name: 'A1 Ost', type: 'hw', wp: [[720, 0], [1250, 0], [1700, 20], [1960, 10], [2540, 10]], tun: [[3, 4]], valley: true });
  add({ name: 'Hochwald-Schleife', type: 'co', wp: [[2540, 10], [2640, 55], [2700, 0], [2640, -55], [2540, 10]], valley: true });
  add({ name: 'A2 West', type: 'hw', wp: [[-720, 0], [-1250, 0], [-1600, 30], [-1850, 40]], valley: true });
  add({ name: 'A3 Süd (Meridian-Brücke)', type: 'hw', wp: [[0, 720], [0, 1250], [0, 1700], [0, 2150], [0, 2600], [0, 2700]], bridge: [[2, 4]], valley: false });
  add({ name: 'Kap-Schleife', type: 'co', wp: [[0, 2700], [90, 2740], [160, 2700], [120, 2660], [0, 2700]] });
  add({ name: 'A4 Nord', type: 'hw', wp: [[0, -720], [0, -1250], [0, -1600], [0, -1880], [0, -2420]], tun: [[3, 4]], valley: true });
  // --- Diagonalen (Avenues) zum Ring
  const dg = (sx, sz, nm) => add({ name: nm, type: 'ar', wp: [[sx * 720, sz * 720], [sx * 1000, sz * 1000]], straight: true, ds: 30 });
  dg(1, -1, 'Diagonale NO'); dg(-1, -1, 'Diagonale NW'); dg(1, 1, 'Diagonale SO'); dg(-1, 1, 'Diagonale SW');
  // --- Hafen
  add({ name: 'Kai-Straße', type: 'ind', wp: [[-1850, -700], [-1850, 800]], straight: true, flat: true });
  add({ name: 'Küstenstraße', type: 'co', wp: [[-1850, -700], [-1840, -1000], [-1800, -1400], [-1750, -1800], [-1600, -2100], [-1300, -2300], [-950, -2400], [-600, -2440], [-250, -2460], [0, -2420]], valley: true });
  for (const z of [-500, -250, 250, 500]) add({ name: 'Hafenquer ' + z, type: 'ind', wp: [[-1990, z], [-1850, z], [-1700, z]], straight: true, flat: true });
  // --- Industriegebiet
  for (let j = 0; j < 5; j++) add({ name: 'Werk-OW ' + j, type: 'ind', wp: [[600, 1200 + j * 150], [1350, 1200 + j * 150]], straight: true, flat: true });
  for (let i = 0; i < 6; i++) add({ name: 'Werk-NS ' + i, type: 'ind', wp: [[600 + i * 150, 1200], [600 + i * 150, 1800]], straight: true, flat: true });
  add({ name: 'Industrie-Zubringer', type: 'ar', wp: [[800, 800], [860, 1000], [900, 1200]], valley: false });
  // --- Land
  add({ name: 'Südwest-Hügelstraße', type: 'co', wp: [[-884, 884], [-1100, 1150], [-1350, 1400], [-1500, 1700], [-1380, 2000], [-1150, 2200]], valley: true });
  add({ name: 'Ostlandstraße', type: 'co', wp: [[1350, 1800], [1650, 1900], [1950, 1800], [2200, 1500], [2350, 1100]], valley: true });
  // --- Kalmar-Passstraße (Spirale)
  const ang0 = Math.atan2(-884 - KAL.z, 884 - KAL.x); let r_ = 985, th = ang0; const wps = []; const g = 0.072, dsS = 36; let guard = 0;
  while (r_ > 150 && guard++ < 400) { wps.push([KAL.x + Math.cos(th) * r_, KAL.z + Math.sin(th) * r_]); const dr = g / kalmarSlope(r_) * dsS; th += (dsS / r_) * -1; r_ -= dr; }
  const st = wps[0];
  add({ name: 'Kalmar-Zubringer', type: 'co', wp: [[884, -884], [980, -1000], [st[0], st[1]]], valley: true });
  add({ name: 'Kalmar-Passstraße', type: 'mt', wp: wps, ds: 12, pass: true });
  return R;
}

/* ------------------------------------------------------------------ Profile & Carve */
function boxBlur(h, win, closed) { const n = h.length; const o = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -win; k <= win; k++) { let j = i + k; if (closed) j = (j + n) % n; else if (j < 0 || j >= n) continue; s += h[j]; c++; } o[i] = s / c; } return o; }
function gradeLimit(h, dsArr, g) {
  const n = h.length;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < n; i++) { const m = g * dsArr[i]; h[i] = clamp(h[i], h[i - 1] - m, h[i - 1] + m); }
    for (let i = n - 2; i >= 0; i--) { const m = g * dsArr[i + 1]; h[i] = clamp(h[i], h[i + 1] - m, h[i + 1] + m); }
  }
}
function computeProfile(r) {
  const n = r.n, T = r.T; let h = new Float64Array(n);
  for (let i = 0; i < n; i++) h[i] = baseB(r.x[i], r.z[i]);
  const dsa = new Float64Array(n); for (let i = 1; i < n; i++) dsa[i] = r.s[i] - r.s[i - 1]; dsa[0] = dsa[1] || 1;
  if (!r.def.flat) { const win = Math.max(1, Math.round(T.smooth / (r.len / (n - 1)))); h = boxBlur(h, win, false); h = boxBlur(h, win, false); }
  // Tunnel: linear zwischen Portalen
  for (const [a, b] of r.tun) {
    const L = r.s[b] - r.s[a]; let h0 = h[a], h1 = h[b]; h1 = clamp(h1, h0 - T.grade * 0.9 * L, h0 + T.grade * 0.9 * L);
    for (let i = a; i <= b; i++) { const t = (r.s[i] - r.s[a]) / L; h[i] = lerp(h0, h1, t); r.flags[i] |= 1; }
    for (let i = b + 1; i < n; i++) h[i] += (h1 - h[b + 0]) * 0; // Glättung folgt unten
  }
  for (const [a, b] of r.bridge) {
    const L = r.s[b] - r.s[a]; const ha = h[a], hb = h[b];
    for (let i = a; i <= b; i++) { const t = (r.s[i] - r.s[a]) / L; h[i] = lerp(ha, hb, t) + 17 * sstep(0, 0.34, t) * sstep(1, 0.66, t); r.flags[i] |= 2; }
  }
  if (!r.def.flat) gradeLimit(h, dsa, T.grade);
  for (let i = 0; i < n; i++) r.h[i] = h[i];
}
function harmonize() {
  // gleiche Höhen an Kreuzungen angleichen
  for (const nd of nodes) {
    if (nd.links.length < 2) continue; let sum = 0, flatH = null; for (const l of nd.links) { const hh = heightAtS(l.road, l.s); sum += hh; if (l.road.def.flat) flatH = hh; } const avg = flatH !== null ? flatH : sum / nd.links.length; nd.h = avg;
    for (const l of nd.links) {
      const r = l.road; if (r.def.flat) continue; const cur = heightAtS(r, l.s); const dlt = avg - cur; if (Math.abs(dlt) < 0.005) continue;
      const rad = clamp(Math.abs(dlt) * 25, Math.max(40, r.T.blend * 1.6), 280);
      for (let i = 0; i < r.n; i++) { const d = Math.abs(r.s[i] - l.s); if (d < rad) r.h[i] += dlt * (1 - sstep(0, rad, d)); }
    }
  }
}
function regrade() { for (const r of roads) { if (r.def.flat) continue; const dsa = new Float64Array(r.n); for (let i = 1; i < r.n; i++) dsa[i] = r.s[i] - r.s[i - 1]; dsa[0] = dsa[1] || 1; gradeLimit(r.h, dsa, r.T.grade); } }
function heightAtS(r, s) { const i = idxAtS(r, s); const f = (s - r.s[i]) / Math.max(1e-6, r.s[i + 1] - r.s[i]); return lerp(r.h[i], r.h[i + 1], f); }
function idxAtS(r, s) { let lo = 0, hi = r.n - 2; if (s <= 0) return 0; if (s >= r.len) return hi; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (r.s[mid] <= s) lo = mid; else hi = mid - 1; } return lo; }
function posAtS(r, s, out) {
  out = out || {}; s = clamp(s, 0, r.len); const i = idxAtS(r, s); const L = r.s[i + 1] - r.s[i]; const f = L > 0 ? (s - r.s[i]) / L : 0;
  out.x = lerp(r.x[i], r.x[i + 1], f); out.z = lerp(r.z[i], r.z[i + 1], f); out.h = lerp(r.h[i], r.h[i + 1], f);
  let tx = lerp(r.tx[i], r.tx[i + 1], f), tz = lerp(r.tz[i], r.tz[i + 1], f); const l = Math.hypot(tx, tz) || 1; out.tx = tx / l; out.tz = tz / l; out.i = i; out.f = f; out.flags = r.flags[i]; return out;
}

function indexRoads() {
  for (const r of roads) {
    const reach = r.T.core + r.T.blend + 2;
    for (let i = 0; i < r.n - 1; i++) segGrid.add({ r, i }, Math.min(r.x[i], r.x[i + 1]) - reach, Math.min(r.z[i], r.z[i + 1]) - reach, Math.max(r.x[i], r.x[i + 1]) + reach, Math.max(r.z[i], r.z[i + 1]) + reach);
    for (const [a, b] of r.tun) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = a; i <= b; i++) { x0 = Math.min(x0, r.x[i]); x1 = Math.max(x1, r.x[i]); z0 = Math.min(z0, r.z[i]); z1 = Math.max(z1, r.z[i]); } tunnels.push({ r, a, b, x0: x0 - 90, x1: x1 + 90, z0: z0 - 90, z1: z1 + 90, s0: r.s[a], s1: r.s[b] }); }
  }
}
function computeValley() {
  valleyField = new Float32Array(VF_N * VF_N).fill(400); const nodesV = [];
  for (const r of roads) { if (!r.def.valley) continue; for (let i = 0; i < r.n; i += Math.max(1, Math.round(24 / (r.len / r.n)))) { let skip = false; for (const [a, b] of r.tun) if (i >= a && i <= b) skip = true; if (!skip) nodesV.push([r.x[i], r.z[i]]); } }
  const rad = Math.ceil(400 / VF_CELL);
  for (const [x, z] of nodesV) { const cx = Math.round((x + HALF) / VF_CELL), cz = Math.round((z + HALF) / VF_CELL);
    for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) { const ix = cx + dx, iz = cz + dz; if (ix < 0 || iz < 0 || ix >= VF_N || iz >= VF_N) continue; const d = Math.hypot(ix * VF_CELL - HALF - x, iz * VF_CELL - HALF - z); const k = iz * VF_N + ix; if (d < valleyField[k]) valleyField[k] = d; } }
}

/* ------------------------------------------------------------------ Terrain-Höhe mit Carve */
const _touch = [];
function terrainH(x, z) {
  let b = baseB(x, z);
  const cell = segGrid.at(x, z);
  if (cell) {
    const q = ++stampCtr; _touch.length = 0; const o = {};
    for (let k = 0; k < cell.length; k++) {
      const it = cell[k]; const r = it.r, i = it.i; if (r.flags[i] & 3) continue;
      U.segDist(x, z, r.x[i], r.z[i], r.x[i + 1], r.z[i + 1], o); const core = r.T.core, bl = r.T.blend; if (o.d >= core + bl) continue;
      const w = 1 - sstep(core, core + bl, o.d);
      if (r.stamp !== q) { r.stamp = q; r.bestW = 0; _touch.push(r); }
      if (w > r.bestW) { r.bestW = w; r.bestH = lerp(r.h[i], r.h[i + 1], o.t) - 0.12; }
    }
    if (_touch.length) { let ws = 0, hs = 0, wm = 0; for (let k = 0; k < _touch.length; k++) { const r = _touch[k]; ws += r.bestW; hs += r.bestW * r.bestH; if (r.bestW > wm) wm = r.bestW; } b = lerp(b, hs / ws, wm); }
  }
  for (let t = 0; t < tunnels.length; t++) {
    const tn = tunnels[t]; if (x < tn.x0 || x > tn.x1 || z < tn.z0 || z > tn.z1) continue; const r = tn.r; let best = 1e9, bs = 0, bh = 0; const o = {};
    for (let i = tn.a; i < tn.b; i++) { U.segDist(x, z, r.x[i], r.z[i], r.x[i + 1], r.z[i + 1], o); if (o.d < best) { best = o.d; bs = lerp(r.s[i], r.s[i + 1], o.t); bh = lerp(r.h[i], r.h[i + 1], o.t); } }
    if (best < 62) { const tin = Math.min(bs - tn.s0, tn.s1 - bs); const cover = bh + 17 * sstep(62, 18, best) * sstep(0, 38, tin); if (cover > b) b = cover; }
  }
  return b - seaDepth(x, z);
}

/* ------------------------------------------------------------------ Straßenabfrage */
const QR = { r: null, i: 0, t: 0, d: 1e9, h: 0, side: 0, s: 0, flags: 0, tx: 0, tz: 0 };
function queryRoad(x, z, maxD, out) {
  out = out || QR; out.r = null; out.d = 1e9; const cell = segGrid.at(x, z); if (!cell) return out; const o = {}; maxD = maxD || 30;
  for (let k = 0; k < cell.length; k++) {
    const it = cell[k]; const r = it.r, i = it.i; U.segDist(x, z, r.x[i], r.z[i], r.x[i + 1], r.z[i + 1], o); if (o.d < out.d && o.d < maxD) {
      out.d = o.d; out.r = r; out.i = i; out.t = o.t; out.cx = o.cx; out.cz = o.cz; }
  }
  if (out.r) { const r = out.r, i = out.i, t = out.t; out.h = lerp(r.h[i], r.h[i + 1], t); out.s = lerp(r.s[i], r.s[i + 1], t); out.flags = r.flags[i]; out.tx = r.tx[i]; out.tz = r.tz[i];
    const sd = (x - out.cx) * (-out.tz) + (z - out.cz) * (out.tx); out.side = sd; } // >0 = rechts der Fahrtrichtung
  return out;
}
/* Fahrbahnhöhe inkl. Brücke/Tunnel */
const _q = { r: null };
function groundAt(x, z, y) {
  const q = queryRoad(x, z, 18, _q);
  if (q.r && (q.flags & 3)) { const half = q.r.T.half + 0.8; if (q.d < half) { if (q.flags & 2) return q.h; if (q.flags & 1) { if (y === undefined || Math.abs(y - q.h) < 9) return q.h; } } }
  let hh = terrainH(x, z);
  if (x > -722 && x < 722 && z > -722 && z < 722) { const fx = ((x % 120) + 120) % 120, fz = ((z % 120) + 120) % 120; const ix = Math.round(x / 120), iz = Math.round(z / 120); const ax = (ix === 0 || Math.abs(ix) === 6) ? 11 : 8, az = (iz === 0 || Math.abs(iz) === 6) ? 11 : 8; const dx = Math.min(fx, 120 - fx), dz = Math.min(fz, 120 - fz); if (dx > ax && dz > az) hh += 0.18; }
  return hh;
}
function terrainNormal(x, z, out) { const e = 1.2; const hx = terrainH(x + e, z) - terrainH(x - e, z), hz = terrainH(x, z + e) - terrainH(x, z - e); const l = Math.hypot(hx, 2 * e, hz); out.set(-hx / l, 2 * e / l, -hz / l); return out; }

/* ------------------------------------------------------------------ Kreuzungen & Graph */
const nodes = []; const roadStops = {};
function segInter(ax, az, bx, bz, cx, cz, dx, dz, tol) {
  const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz; const den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sz - (cz - az) * sx) / den, u = ((cx - ax) * rz - (cz - az) * rx) / den; const lr = Math.hypot(rx, rz), ls = Math.hypot(sx, sz);
  if (t < -tol / lr || t > 1 + tol / lr || u < -tol / ls || u > 1 + tol / ls) return null; return [clamp(t, 0, 1), clamp(u, 0, 1)];
}
function findIntersections() {
  const g = new U.Grid(120); for (const r of roads) for (let i = 0; i < r.n - 1; i++) g.add({ r, i }, Math.min(r.x[i], r.x[i + 1]) - 3, Math.min(r.z[i], r.z[i + 1]) - 3, Math.max(r.x[i], r.x[i + 1]) + 3, Math.max(r.z[i], r.z[i + 1]) + 3);
  const hits = [];
  for (const a of roads) for (let i = 0; i < a.n - 1; i++) {
    const cell = g.at((a.x[i] + a.x[i + 1]) / 2, (a.z[i] + a.z[i + 1]) / 2); const cells = []; if (cell) cells.push(cell);
    const cx0 = Math.floor(a.x[i] / 120), cz0 = Math.floor(a.z[i] / 120), cx1 = Math.floor(a.x[i + 1] / 120), cz1 = Math.floor(a.z[i + 1] / 120);
    const seen = new Set();
    for (let ix = Math.min(cx0, cx1); ix <= Math.max(cx0, cx1); ix++) for (let iz = Math.min(cz0, cz1); iz <= Math.max(cz0, cz1); iz++) { const L = g.cellList(ix, iz); if (!L) continue; for (const it of L) { if (it.r.id <= a.id) continue; const key = it.r.id * 100000 + it.i; if (seen.has(key)) continue; seen.add(key);
      const b = it.r, j = it.i; const res = segInter(a.x[i], a.z[i], a.x[i + 1], a.z[i + 1], b.x[j], b.z[j], b.x[j + 1], b.z[j + 1], 3.5); if (!res) continue;
      const px = lerp(a.x[i], a.x[i + 1], res[0]), pz = lerp(a.z[i], a.z[i + 1], res[0]);
      if ((a.flags[i] & 3) || (b.flags[j] & 3)) continue;
      hits.push({ x: px, z: pz, a, sa: lerp(a.s[i], a.s[i + 1], res[0]), b, sb: lerp(b.s[j], b.s[j + 1], res[1]) }); } }
  }
  // Clustering
  const cl = [];
  for (const h of hits) { let n = null; for (const c of cl) if (Math.hypot(c.x - h.x, c.z - h.z) < 14) { n = c; break; } if (!n) { n = { x: h.x, z: h.z, links: [], id: cl.length }; cl.push(n); }
    for (const [r, s] of [[h.a, h.sa], [h.b, h.sb]]) { if (!n.links.find(l => l.road === r && Math.abs(l.s - s) < 20)) n.links.push({ road: r, s }); } }
  // Straßenenden als Knoten
  for (const r of roads) { if (r.closed) continue; for (const s of [0, r.len]) { const p = posAtS(r, s); let hit = null; for (const c of cl) if (c.links.find(l => l.road === r && Math.abs(l.s - s) < 20)) hit = c; if (hit) continue; for (const c of cl) if (Math.hypot(c.x - p.x, c.z - p.z) < 16) { hit = c; break; } if (hit) hit.links.push({ road: r, s }); else cl.push({ x: p.x, z: p.z, links: [{ road: r, s }], id: cl.length, end: true }); } }
  nodes.length = 0; for (const c of cl) { c.id = nodes.length; c.h = 0; c.light = false; nodes.push(c); }
  // Stopps je Straße
  for (const r of roads) roadStops[r.id] = [];
  for (const nd of nodes) for (const l of nd.links) roadStops[l.road.id].push({ s: l.s, node: nd });
  for (const r of roads) roadStops[r.id].sort((a, b) => a.s - b.s);
  // Ampeln: Kreuzungen im Stadtraster
  for (const nd of nodes) { let n = 0; for (const l of nd.links) if ((l.road.type === 'st' || l.road.type === 'ar') && l.road.def.grid) n++; if (n >= 2) { nd.light = true; nd.phase = ((Math.round(nd.x / 120) + Math.round(nd.z / 120)) & 1); } }
}
function nodeLinksOf(nd) { return nd.links; }

/* Adjazenz-Liste */
const adj = []; const CF = { hw: 0.72, ar: 0.88, st: 1, ind: 1, co: 1, mt: 1.1 };
function buildAdj() {
  adj.length = 0; for (let i = 0; i < nodes.length; i++) adj.push([]);
  for (const r of roads) { const st = roadStops[r.id];
    for (let k = 0; k < st.length - 1; k++) { const a = st[k], b = st[k + 1]; const c = (b.s - a.s) * (CF[r.type] || 1); if (c < 1 || a.node === b.node) continue; adj[a.node.id].push({ to: b.node.id, cost: c, road: r, s0: a.s, s1: b.s }); adj[b.node.id].push({ to: a.node.id, cost: c, road: r, s0: b.s, s1: a.s }); }
    if (r.closed && st.length > 1) { const a = st[st.length - 1], b = st[0]; const c = (r.len - a.s + b.s) * (CF[r.type] || 1); if (c > 1 && a.node !== b.node) { adj[a.node.id].push({ to: b.node.id, cost: c, road: r, s0: a.s, s1: b.s + r.len }); adj[b.node.id].push({ to: a.node.id, cost: c, road: r, s0: b.s, s1: a.s - r.len }); } } }
}
function snapToRoad(x, z, maxD) {
  maxD = maxD || 200; const c = segGrid.cell; const R = Math.ceil(maxD / c); const cx = Math.floor(x / c), cz = Math.floor(z / c); const o = {}; let best = null, bd = maxD;
  for (let ix = cx - R; ix <= cx + R; ix++) for (let iz = cz - R; iz <= cz + R; iz++) { const L = segGrid.cellList(ix, iz); if (!L) continue;
    for (const it of L) { const r = it.r, i = it.i; U.segDist(x, z, r.x[i], r.z[i], r.x[i + 1], r.z[i + 1], o); if (o.d < bd) { bd = o.d; best = { road: r, s: lerp(r.s[i], r.s[i + 1], o.t), d: o.d, x: o.cx, z: o.cz }; } } }
  return best;
}
/* Nachbarn eines Punktes (road,s): Liste {node,cost,s0,s1} */
function neighborsOf(p) {
  const st = roadStops[p.road.id]; const out = []; if (!st.length) return out; let prev = null, next = null;
  for (const e of st) { if (e.s <= p.s) prev = e; if (e.s >= p.s && !next) next = e; }
  const L = p.road.len;
  if (prev) out.push({ node: prev.node, cost: p.s - prev.s, s0: p.s, s1: prev.s }); else if (p.road.closed) { const l = st[st.length - 1]; out.push({ node: l.node, cost: p.s + L - l.s, s0: p.s, s1: l.s - L }); }
  if (next) out.push({ node: next.node, cost: next.s - p.s, s0: p.s, s1: next.s }); else if (p.road.closed) { const f = st[0]; out.push({ node: f.node, cost: L - p.s + f.s, s0: p.s, s1: f.s + L }); }
  return out;
}
function findRoute(fx, fz, tx, tz) {
  const A = snapToRoad(fx, fz, 600), B = snapToRoad(tx, tz, 600); if (!A || !B) return null;
  if (A.road === B.road) { const st = roadStops[A.road.id]; let between = false; const lo = Math.min(A.s, B.s), hi = Math.max(A.s, B.s); for (const e of st) if (e.s > lo + 1 && e.s < hi - 1) between = true; if (!between) return [{ road: A.road, s0: A.s, s1: B.s }]; }
  const startN = neighborsOf(A), endN = neighborsOf(B); const endMap = new Map(); for (const e of endN) endMap.set(e.node.id, e);
  const key = (n, r) => n * 128 + r; const g = new Map(), came = new Map(), open = new Set(); const h = id => Math.hypot(nodes[id].x - tx, nodes[id].z - tz);
  for (const e of startN) { const k = key(e.node.id, A.road.id); const c = e.cost * (CF[A.road.type] || 1); if (c < (g.get(k) ?? 1e18)) { g.set(k, c); came.set(k, { from: -1, road: A.road, s0: e.s0, s1: e.s1, node: e.node.id }); open.add(k); } }
  let best = Infinity, bestK = -1, it = 0;
  while (open.size && it++ < 40000) {
    let cur = -1, cf = Infinity; for (const k of open) { const f = g.get(k) + h(Math.floor(k / 128)); if (f < cf) { cf = f; cur = k; } }
    if (cf >= best) break; open.delete(cur); const nid = Math.floor(cur / 128), rid = cur % 128; const gc = g.get(cur);
    if (endMap.has(nid)) { const e = endMap.get(nid); const tot = gc + e.cost * (CF[B.road.type] || 1) + (e.road === undefined ? 0 : 0) + (rid === B.road.id ? 0 : 15); if (tot < best) { best = tot; bestK = cur; } }
    for (const e of adj[nid]) { const ng = gc + e.cost + 4 + (e.road.id === rid ? 0 : 18); const k = key(e.to, e.road.id); if (ng < (g.get(k) ?? 1e18)) { g.set(k, ng); came.set(k, { from: cur, road: e.road, s0: e.s0, s1: e.s1, node: e.to }); open.add(k); } }
  }
  if (bestK < 0) return null; const pieces = []; const e = endMap.get(Math.floor(bestK / 128)); pieces.push({ road: B.road, s0: e.s1, s1: B.s });
  let cur = bestK; while (cur >= 0) { const c = came.get(cur); pieces.push({ road: c.road, s0: c.s0, s1: c.s1 }); cur = c.from; }
  pieces.reverse(); return pieces.filter(p => Math.abs(p.s1 - p.s0) > 0.5);
}
/* Stücke → Polylinie [{x,z,h,s}] mit Abstand ds */
function routePolyline(pieces, ds) {
  ds = ds || 8; const out = []; let acc = 0; const tmp = {};
  for (const p of pieces) {
    const r = p.road; const s0 = p.s0, s1 = p.s1; const L = Math.abs(s1 - s0); const n = Math.max(1, Math.ceil(L / ds));
    for (let k = 0; k <= n; k++) { let s = lerp(s0, s1, k / n); if (r.closed) s = ((s % r.len) + r.len) % r.len; posAtS(r, s, tmp); if (out.length) { const l = out[out.length - 1]; const d = Math.hypot(tmp.x - l.x, tmp.z - l.z); if (d < 0.5) continue; acc += d; } out.push({ x: tmp.x, z: tmp.z, h: tmp.h, s: acc, tx: tmp.tx * (s1 >= s0 ? 1 : -1), tz: tmp.tz * (s1 >= s0 ? 1 : -1), flags: tmp.flags, road: r }); }
  }
  return out;
}

/* ------------------------------------------------------------------ Zonen */
function zoneAt(x, z) {
  const r = Math.hypot(x, z);
  if (seaDepth(x, z) > 8) return 'sea';
  if (Math.abs(x) <= 790 && Math.abs(z) <= 790) return 'city';
  const di = Math.hypot((x - 950) / 720, (z - 1500) / 460); if (di < 1.05) return 'industrial';
  if (x < -1650 && x > -2030 && Math.abs(z) < 860) return 'harbor';
  if (r < 1120) return 'suburb';
  return 'rural';
}

/* ------------------------------------------------------------------ Initialisierung */
const Roads = { list: roads, nodes, stops: roadStops, RT };
function init() {
  const defs = buildRoadsDef(); for (const d of defs) makeRoad(d);
  computeValley();
  for (const r of roads) computeProfile(r);
  findIntersections(); harmonize(); regrade(); indexRoads();
  // Leitplanken-Flags
  for (const r of roads) for (let i = 0; i < r.n - 1; i++) {
    if (r.flags[i] & 3) { r.flags[i] |= 12; continue; }
    if (r.type === 'st' || r.type === 'ind') continue;
    const off = r.T.half + 7; const nx = -r.tz[i], nz = r.tx[i]; // rechts
    const hr = terrainH(r.x[i] + nx * off, r.z[i] + nz * off), hl = terrainH(r.x[i] - nx * off, r.z[i] - nz * off); const hc = r.h[i];
    if (hr < hc - 3.2 && r.type !== 'co') r.flags[i] |= 8; if (hl < hc - 3.2 && r.type !== 'co') r.flags[i] |= 4;
  }
  buildAdj();
}

G.World = {
  HALF, CH, RT, Roads, tunnels, KAL,
  init, adj, terrainH, baseB, seaDepth, groundAt, queryRoad, terrainNormal, zoneAt, plainH, coastX, massifs,
  posAtS, heightAtS, idxAtS, findRoute, routePolyline, snapToRoad, nodes, roadStops,
};
})(window.G = window.G || {});
