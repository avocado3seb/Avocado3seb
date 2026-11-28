/* NEON REDLINE – car_model.js : parametrischer Karosserie-Generator (Loft), Räder, Kits, Innenraum, Schaden */
(function (G) {
'use strict';
const U = G.U, CD = G.CD; const CM = { envTex: null, mats: new Set(), cache: new Map() };
const V3 = THREE.Vector3, M4 = THREE.Matrix4, Q = THREE.Quaternion, E = THREE.Euler;
const C = U.colRGB;

function pchip(pts) {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const h = [], d = []; for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  const m = new Array(n); m[0] = d[0]; m[n - 1] = d[n - 2]; for (let i = 1; i < n - 1; i++) { if (d[i - 1] * d[i] <= 0) m[i] = 0; else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); } }
  return x => { if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1]; let i = 0; while (x > xs[i + 1]) i++; const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1]; };
}
const sgnpow = (v, e) => (v < 0 ? -1 : 1) * Math.pow(Math.abs(v), e);
const _q = new Q(), _e = new E(), _s = new V3(), _p = new V3();
function mat(px, py, pz, sx, sy, sz, rx, ry, rz) { _e.set(rx || 0, ry || 0, rz || 0, 'XYZ'); _q.setFromEuler(_e); return new M4().compose(_p.set(px, py, pz), _q, _s.set(sx, sy, sz)); }
function basis(p, n, sx, sy, sz) { const up = Math.abs(n.y) > 0.9 ? new V3(0, 0, 1) : new V3(0, 1, 0); const x = new V3().crossVectors(up, n).normalize(); const y = new V3().crossVectors(n, x); const m = new M4().makeBasis(x, y, n); m.scale(new V3(sx, sy, sz)); m.setPosition(p.x, p.y, p.z); return m; }
const PRIM = { box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(0.5, 10, 7), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8), tor: new THREE.TorusGeometry(0.5, 0.06, 6, 24), cone: new THREE.CylinderGeometry(0.0, 0.5, 1, 10) };
class Acc {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; this.v = 0; }
  add(geo, m4, color) {
    const g = geo.clone(); g.applyMatrix4(m4); const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv; const n = pos.count; color = color || [1, 1, 1];
    for (let i = 0; i < n; i++) { this.p.push(pos.getX(i), pos.getY(i), pos.getZ(i)); this.n.push(nor.getX(i), nor.getY(i), nor.getZ(i)); this.u.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0); this.c.push(color[0], color[1], color[2]); }
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) this.i.push(a[i] + this.v); } else for (let i = 0; i < n; i++) this.i.push(i + this.v); this.v += n; g.dispose();
  }
  box(px, py, pz, sx, sy, sz, rx, ry, rz, color) { this.add(PRIM.box, mat(px, py, pz, sx, sy, sz, rx, ry, rz), color); }
  build() { if (!this.v) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setIndex(this.i); g.computeBoundingSphere(); return g; }
}

/* ------------------------------------------------------------------ Lackierung */
const carbonTex = (function () { const c = U.canvas(64, 64); const g = c.getContext('2d'); g.fillStyle = '#16171a'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x += 8) { g.fillStyle = ((x + y) / 8) % 2 ? '#25272c' : '#0d0e10'; g.fillRect(x, y, 8, 8); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, y, 8, 2); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
function liveryCanvas(cfg, spec) {
  const W_ = 1024, H_ = 512; const c = U.canvas(W_, H_); const g = c.getContext('2d'); const p = cfg.paint; const col = p.finish === 'chrome' ? '#dfe3e8' : p.color; const c2 = p.color2 || '#101012';
  if (p.finish === 'carbon') { const pat = g.createPattern(carbonTex.image, 'repeat'); g.fillStyle = pat; g.fillRect(0, 0, W_, H_); } else { g.fillStyle = col; g.fillRect(0, 0, W_, H_); }
  const band = (u, w, color) => { g.fillStyle = color; g.fillRect((u - w / 2) * W_, 0, w * W_, H_); };
  const lv = cfg.livery | 0; const light = '#f2f2f2';
  if (lv === 1) band(0.5, 0.10, c2);
  else if (lv === 2) { band(0.5 - 0.075, 0.035, c2); band(0.5 + 0.075, 0.035, c2); band(0.5, 0.02, light); }
  else if (lv === 3) { for (const u of [0.27, 0.73]) { band(u, 0.05, c2); band(u + (u < .5 ? .045 : -.045), 0.012, light); } }
  else if (lv === 4) { band(0.5, 0.26, c2); band(0.5, 0.012, light); g.fillStyle = c2; g.fillRect(0, 0, W_, H_ * 0.0); }
  else if (lv === 5) { for (const u of [0.3, 0.7]) { const bw = 0.04 * W_, sz = 16; for (let y = 0; y < H_; y += sz) for (let k = 0; k < 3; k++) { g.fillStyle = ((y / sz + k) % 2) ? c2 : light; g.fillRect(u * W_ - bw * 0.75 + k * (bw * 0.5), y, bw * 0.5, sz); } } }
  else if (lv === 6) { for (const [u0, dir] of [[0.12, 1], [0.88, -1]]) for (let k = 0; k < 7; k++) { const y0 = H_ * (0.35 + k * 0.08); g.fillStyle = k % 2 ? '#ffb000' : c2 === '#101012' ? '#ff4a00' : c2; g.beginPath(); const x0 = u0 * W_; g.moveTo(x0, y0); g.bezierCurveTo(x0 + dir * 90, y0 - 24, x0 + dir * 160, y0 + 8, x0 + dir * 250, y0 - 40); g.bezierCurveTo(x0 + dir * 170, y0 + 26, x0 + dir * 110, y0 + 30, x0, y0 + 36); g.fill(); } }
  else if (lv === 7) { for (const [u, ] of [[0.27], [0.73]]) { g.fillStyle = light; g.beginPath(); g.arc(u * W_, H_ * 0.5, 62, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = 'bold 74px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(cfg.number || 7), u * W_, H_ * 0.5 + 4); } g.fillStyle = light; g.beginPath(); g.arc(0.5 * W_, H_ * 0.82, 50, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = 'bold 60px Arial'; g.fillText(String(cfg.number || 7), 0.5 * W_, H_ * 0.82 + 3); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
function paintMaterial(cfg, spec, police) {
  const f = cfg.paint.finish; const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, map: liveryCanvas(cfg, spec), roughness: .3, metalness: .5, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.0 });
  if (f === 'gloss') { m.metalness = .12; m.roughness = .26; } else if (f === 'metal') { m.metalness = .78; m.roughness = .34; } else if (f === 'pearl') { m.metalness = .45; m.roughness = .22; m.clearcoatRoughness = .02; } else if (f === 'matte') { m.metalness = .15; m.roughness = .78; m.clearcoat = 0; } else if (f === 'chrome') { m.metalness = 1; m.roughness = .05; m.clearcoat = 0; m.envMapIntensity = 1.6; } else if (f === 'carbon') { m.metalness = .25; m.roughness = .3; }
  m.envMap = CM.envTex; CM.mats.add(m); return m;
}
function std(color, o) { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .6, metalness: .1, envMapIntensity: .8 }, o || {})); m.envMap = CM.envTex; CM.mats.add(m); return m; }

/* ------------------------------------------------------------------ Karosserie */
const CAB_HALF = [[1, 0], [.985, .2], [.95, .45], [.88, .70], [.76, .86], [.55, .95], [.25, .99], [0, 1]];
function buildBody(e, tpl, cfg, lod) {
  const L = e.L, H = e.H, W = e.W; const zR = -L / 2, zF = L / 2; const zfa = L / 2 - e.fo, zra = zfa - e.wb; const wr = e.wr; const Ra = wr + 0.05;
  const deck = pchip(tpl.deck.map(([t, y]) => [t, y * H])), bot = pchip(tpl.bot); const tOf = z => (z - zR) / L; const tw = e.tw * (e.twMul || 1); const track = e.track * (e.trackMul || 1); const outer = track / 2 + tw / 2; const wide = cfg.kit >= 3;
  const hwAt = z => { const t = tOf(z); let bump = 0; for (const zw of [zfa, zra]) bump = Math.max(bump, Math.exp(-Math.pow((z - zw) / (Ra * 1.25), 2)));
    let hw = W / 2 * (tpl.waist + (1 - tpl.waist) * bump) + (wide ? 0.07 * bump + 0.015 : 0); hw = Math.max(hw, (outer - 0.012) * Math.min(1, bump * 1.6));
    let f = 1; if (t > 1 - tpl.nf) { const u = (t - (1 - tpl.nf)) / tpl.nf; f = Math.pow(Math.max(0, 1 - Math.pow(u, tpl.pF)), 1 / tpl.pF); } if (t < tpl.nr) { const u = (tpl.nr - t) / tpl.nr; f = Math.min(f, Math.pow(Math.max(0, 1 - Math.pow(u, tpl.pR)), 1 / tpl.pR)); }
    return hw * f; };
  const yBotAt = z => { let b = bot(tOf(z)); for (const zw of [zfa, zra]) { const dz = Math.abs(z - zw); if (dz < Ra) b = Math.max(b, wr + Math.sqrt(Ra * Ra - dz * dz)); } return b; };
  const yTopAt = z => { let d = deck(tOf(z)); for (const zw of [zfa, zra]) { const dz = Math.abs(z - zw); const R2 = Ra + 0.04; if (dz < R2) d = Math.max(d, wr + Math.sqrt(R2 * R2 - dz * dz) * 0.97 + 0.02); } return Math.max(d, yBotAt(z) + 0.1); };
  // Stationen
  const step = lod ? 0.22 : 0.065; const zs = []; for (let z = zR; z < zF - 0.25; z += step) zs.push(z); const endsF = [0.25, 0.2, 0.15, 0.11, 0.08, 0.05, 0.03, 0.015, 0.005, 0]; for (const d of endsF) zs.push(zF - d);
  for (const d of [0.005, 0.015, 0.03, 0.05, 0.08, 0.11, 0.15, 0.2]) zs.unshift(zR + d); zs.unshift(zR); zs.sort((a, b) => a - b); const zsU = zs.filter((z, i) => i === 0 || z - zs[i - 1] > 1e-4);
  const K = lod ? 5 : 11; const RN = 2 * K; const NS = zsU.length; const pos = new Float32Array((NS * RN + 0) * 3), uv = new Float32Array(NS * RN * 2), colr = new Float32Array(NS * RN * 3);
  const crown = tpl.crown; const idxP = []; const stationHw = [], stationTop = [], stationBot = [];
  for (let s = 0; s < NS; s++) { const z = zsU[s]; const hw = hwAt(z), yb = yBotAt(z), yt = yTopAt(z); stationHw.push(hw); stationTop.push(yt); stationBot.push(yb); const yMid = (yb + yt) / 2, hh = (yt - yb) / 2;
    for (let j = 0; j < RN; j++) { const k = j <= K ? j : RN - j; const phi = Math.PI * k / K; const nexp = U.lerp(4.4, 3.0, k / K); const xn = sgnpow(Math.sin(phi), 2 / nexp), yn = sgnpow(-Math.cos(phi), 2 / nexp); const sign = j <= K ? 1 : -1;
      let x = hw * xn * sign; let y = yMid + hh * yn; if (k > K * 0.5) { const dC = Math.max(crown, yt - (deck(tOf(z)) - crown)); y -= Math.min(dC, (yt - yb) * 0.6) * U.sstep(0.5, 1, k / K) * (1 - xn * xn) * Math.min(1, (yt - yb) * 3); } const o = s * RN + j; pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z; uv[o * 2] = j / RN; uv[o * 2 + 1] = (z - zR) / L;
      const dk = k <= 1 ? 0.07 : k === 2 ? 0.35 : 1; colr[o * 3] = colr[o * 3 + 1] = colr[o * 3 + 2] = dk; } }
  for (let s = 0; s < NS - 1; s++) for (let j = 0; j < RN; j++) { const j2 = (j + 1) % RN; const A = s * RN + j, B = s * RN + j2, C_ = (s + 1) * RN + j2, D = (s + 1) * RN + j; idxP.push(A, B, C_, A, C_, D); }
  // Kabine
  const t0 = tpl.t0, t1 = tpl.t1; const roofPts = [[t0, deck(t0)]].concat(tpl.roofMid.map(([t, y]) => [t, y * H])).concat([[t1, deck(t1)]]); const roof = pchip(roofPts); let tPeak = t0, hMax = 0; for (let t = t0; t <= t1; t += 0.005) { const r = roof(t); if (r > hMax) { hMax = r; tPeak = t; } }
  let tA = t0, tB = t1; for (let t = t0; t <= t1; t += 0.005) if (roof(t) >= hMax * 0.965) { tA = t; break; } for (let t = t1; t >= t0; t -= 0.005) if (roof(t) >= hMax * 0.965) { tB = t; break; }
  const cz = []; const cstep = lod ? 0.2 : 0.06; for (let z = zR + t0 * L; z < zR + t1 * L; z += cstep) cz.push(z); cz.push(zR + t1 * L); const CS = cz.length; const nh = CAB_HALF.length; const CR = nh * 2; const cpos = [], cuv = [], ccol = [];
  const cabHw = z => hwAt(z) * tpl.cabW; const cabBase = z => deck(tOf(z)) - 0.07 - crown; const cabTop = z => Math.max(roof(tOf(z)), cabBase(z) + 0.11);
  for (let s = 0; s < CS; s++) { const z = cz[s]; const hw = cabHw(z), yb = cabBase(z), yt = cabTop(z); for (let j = 0; j < CR; j++) { const hIdx = j < nh ? j : CR - 1 - j; const sign = j < nh ? 1 : -1; const [xf, yf] = CAB_HALF[hIdx]; cpos.push(hw * xf * sign, yb + (yt - yb) * yf, z); cuv.push(0.5 + sign * (0.5 - hIdx / (nh - 1) * 0.5) * 0.4 - sign * 0.0, (z - zR) / L); ccol.push(1, 1, 1); } }
  const baseV = NS * RN; const inRange = (t, arr) => arr.some(([a, b]) => t >= a && t <= b); const idxPaint = [], idxGlass = [];
  for (let s = 0; s < CS - 1; s++) { const tm = tOf((cz[s] + cz[s + 1]) / 2); for (let j = 0; j < CR - 1; j++) { const q = j < nh - 1 ? j : (CR - 2 - j); const A = baseV + s * CR + j, B = baseV + s * CR + j + 1, C_ = baseV + (s + 1) * CR + j + 1, D = baseV + (s + 1) * CR + j; let glass;
      if (q <= 3) glass = inRange(tm, tpl.glass); else if (q === 4) glass = false; else if (tm < tA) glass = tpl.rearGlass; else if (tm > tB) glass = true; else glass = false;
      if (q <= 3 && j === nh - 1) { /* Mitte der Naht – nicht vorhanden */ } const arr = glass ? idxGlass : idxPaint; arr.push(A, B, C_, A, C_, D); } }
  const total = baseV + CS * CR; const P = new Float32Array(total * 3), Uv = new Float32Array(total * 2), Cl = new Float32Array(total * 3); P.set(pos); Uv.set(uv); Cl.set(colr); P.set(cpos, baseV * 3); Uv.set(cuv, baseV * 2); Cl.set(ccol, baseV * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.BufferAttribute(Uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(Cl, 3));
  const all = idxP.concat(idxPaint, idxGlass); g.setIndex(all); g.addGroup(0, idxP.length + idxPaint.length, 0); g.addGroup(idxP.length + idxPaint.length, idxGlass.length, 1); g.computeVertexNormals(); g.computeBoundingSphere();
  return { geo: g, hwAt, yBotAt, yTopAt, deck, roof, cabHw, cabBase, cabTop, tOf, zfa, zra, zR, zF, L, H, W, tA, tB, tPeak, wr, Ra, outer, tw, track, K, zsU, NS };
}

/* ------------------------------------------------------------------ Räder */
function buildWheel(e, cfg, lod, caliperColor) {
  const R = e.wr, tw = e.tw * (e.twMul || 1); const sw = tw * (e.hp > 650 ? 0.40 : 0.50) * (1 - (cfg.wheels.size) * 0.06); const Rr = R - sw; const wc = CD.WHEEL_COLORS[cfg.wheels.color] || CD.WHEEL_COLORS[0]; const rc = C(wc.c);
  const seg = lod ? 12 : 30; const prof = [[Rr * 0.995, -tw * .46], [Rr + 0.012, -tw * .5], [Rr + sw * .45, -tw * .53], [R - sw * .12, -tw * .5], [R - 0.012, -tw * .36], [R, -tw * .16], [R, tw * .16], [R - 0.012, tw * .36], [R - sw * .12, tw * .5], [Rr + sw * .45, tw * .53], [Rr + 0.012, tw * .5], [Rr * 0.995, tw * .46]];
  const tp = [], tn = [], tu = [], ti = []; const np = prof.length; for (let a = 0; a <= seg; a++) { const ang = a / seg * U.TAU; const ca = Math.cos(ang), sa = Math.sin(ang); for (let i = 0; i < np; i++) { tp.push(prof[i][1], prof[i][0] * ca, prof[i][0] * sa); tu.push(a / seg * 8, i / (np - 1)); tn.push(0, ca, sa); } }
  for (let a = 0; a < seg; a++) for (let i = 0; i < np - 1; i++) { const A = a * np + i, B = A + 1, C_ = (a + 1) * np + i + 1, D = (a + 1) * np + i; ti.push(A, C_, B, A, D, C_); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tg.setAttribute('normal', new THREE.Float32BufferAttribute(tn, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(tu, 2)); tg.setIndex(ti); tg.computeVertexNormals();
  const tire = new THREE.Mesh(tg, std(0x121214, { roughness: .92, metalness: 0, envMapIntensity: .15 })); const rim = new Acc(); const xo = tw * 0.20;
  rim.add(new THREE.CylinderGeometry(Rr * 1.0, Rr * 1.0, tw * 0.92, lod ? 12 : 28, 1, true), mat(0, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2), [0.5, 0.5, 0.5]);
  rim.add(PRIM.tor, mat(tw * .44, 0, 0, Rr * 2.0, Rr * 2.0, Rr * 2.0 * 0.2, 0, Math.PI / 2, 0), rc); rim.add(PRIM.tor, mat(-tw * .44, 0, 0, Rr * 2.0, Rr * 2.0, Rr * 2.0 * 0.2, 0, Math.PI / 2, 0), [rc[0] * .7, rc[1] * .7, rc[2] * .7]);
  const sp = (n, w, th, len0, len1, tilt, xo2, extraRot) => { for (let k = 0; k < n; k++) { const a = k / n * U.TAU + (extraRot || 0); const rm = (len0 + len1) / 2; rim.add(PRIM.box, mat(xo2, Math.cos(a) * rm, Math.sin(a) * rm, th, len1 - len0, w, a + (tilt || 0), 0, 0), rc); } };
  const st = cfg.wheels.style;
  if (!lod) { if (st === 0) { sp(5, 0.075, 0.03, 0.05, Rr * .95, 0, xo); sp(5, 0.04, 0.02, 0.05, Rr * .8, 0, xo - .01, 0.1); }
    else if (st === 1) sp(10, 0.03, 0.026, 0.05, Rr * .96, 0, xo);
    else if (st === 2) { sp(18, 0.016, 0.02, 0.06, Rr * .98, 0.22, xo); sp(18, 0.016, 0.02, 0.06, Rr * .98, -0.22, xo - .006); }
    else if (st === 3) { sp(7, 0.07, 0.04, 0.05, Rr * .98, 0, xo - tw * .38); rim.add(PRIM.tor, mat(tw * .46, 0, 0, Rr * 2.06, Rr * 2.06, Rr * 2.06 * 0.35, 0, Math.PI / 2, 0), [rc[0] * .85, rc[1] * .85, rc[2] * .85]); }
    else if (st === 4) { for (let k = 0; k < 5; k++) for (const d of [-0.09, 0.09]) { const a = k / 5 * U.TAU + d; const rm = (0.05 + Rr * .95) / 2; rim.add(PRIM.box, mat(xo, Math.cos(a) * rm, Math.sin(a) * rm, 0.026, Rr * .9, 0.035, a, 0, 0), rc); } }
    else { sp(12, 0.09, 0.012, 0.05, Rr * .97, 0.5, xo); rim.add(PRIM.cyl, mat(xo - .02, 0, 0, Rr * 1.8, 0.01, Rr * 1.8, 0, 0, Math.PI / 2), [0.1, 0.1, 0.11]); }
  } else sp(5, 0.08, 0.03, 0.05, Rr * .95, 0, xo);
  rim.add(PRIM.cyl, mat(xo + 0.01, 0, 0, 0.11, 0.05, 0.11, 0, 0, Math.PI / 2), [rc[0] * .8, rc[1] * .8, rc[2] * .8]);
  if (!lod) for (let k = 0; k < 5; k++) { const a = k / 5 * U.TAU; rim.add(PRIM.cyl8, mat(xo + 0.03, Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0.018, 0.02, 0.018, 0, 0, Math.PI / 2), [0.8, 0.8, 0.82]); }
  const rimMat = std(0xffffff, { vertexColors: true, roughness: 0.22, metalness: wc.m * 0.95, envMapIntensity: 1.3, side: THREE.DoubleSide }); const rimMesh = new THREE.Mesh(rim.build(), rimMat);
  const br = new Acc(); br.add(PRIM.cyl, mat(-tw * 0.3, 0, 0, Rr * 1.42, 0.028, Rr * 1.42, 0, 0, Math.PI / 2), [0.34, 0.34, 0.36]); const brakeMesh = new THREE.Mesh(br.build(), std(0xffffff, { vertexColors: true, roughness: 0.5, metalness: 0.8 }));
  const cal = new Acc(); const cc = C(caliperColor || '#c01818'); cal.box(-tw * 0.3, Rr * 0.72, 0.0, 0.07, Rr * 0.4, 0.2, 0, 0, 0, cc); const caliper = new THREE.Mesh(cal.build(), std(0xffffff, { vertexColors: true, roughness: 0.4, metalness: 0.3 }));
  const spin = new THREE.Group(); spin.add(tire, rimMesh, brakeMesh); const pivot = new THREE.Group(); pivot.add(spin); if (!lod) pivot.add(caliper); return { pivot, spin, tire, rimMesh, brakeMesh, caliper, R, tw };
}

/* ------------------------------------------------------------------ Modell */
function rayHit(rc, meshes, o, d) { rc.set(o, d.clone().normalize()); const h = rc.intersectObjects(meshes, false); return h.length ? h[0] : null; }
CM.build = function (spec, cfg, opt) {
  opt = opt || {}; const lod = opt.lod || 0; cfg = cfg || CD.defaultCfg(spec); const e = CD.effective(spec, cfg); if (opt.paint) { cfg = JSON.parse(JSON.stringify(cfg)); cfg.paint.color = opt.paint; }
  const tpl = CD.TPL[spec.tpl]; const B = buildBody(e, tpl, cfg, lod); const { L, H, W } = B; const root = new THREE.Group(); const model = { spec, e, cfg, B, group: root, lod, parts: {}, deformables: [], disposables: [] };
  const paintMat = paintMaterial(cfg, spec); const tint = cfg.tint | 0; const glassMat = std(0x0a1118, { roughness: .06, metalness: .92, transparent: true, opacity: [0.28, 0.5, 0.72, 0.92][tint] || .5, envMapIntensity: 1.25, depthWrite: false });
  const body = new THREE.Mesh(B.geo, [paintMat, glassMat]); body.castShadow = lod === 0 && !opt.noShadow; body.receiveShadow = lod === 0; root.add(body); model.body = body; model.paintMat = paintMat; model.glassMat = glassMat; model.deformables.push(B.geo);
  const wheelOffsetsX = B.track / 2; const wheelZ = [B.zfa, B.zfa, B.zra, B.zra]; model.wheels = []; model.wheelPos = [];
  for (let i = 0; i < 4; i++) { const left = (i % 2) === 0; const front = i < 2; const w = buildWheel(e, cfg, lod, cfg.caliper || (spec.hp > 500 ? '#e8b800' : '#c01818')); if (!left) w.spin.rotation.y = 0; const side = left ? 1 : -1; w.pivot.position.set(side * wheelOffsetsX, e.wr, wheelZ[i]); if (!left) { w.tire.rotation.y = Math.PI; w.rimMesh.rotation.y = Math.PI; w.brakeMesh.rotation.y = Math.PI; w.caliper.rotation.y = Math.PI; } w.tire.castShadow = false; root.add(w.pivot); model.wheels.push(w); model.wheelPos.push({ x: side * wheelOffsetsX, y: e.wr, z: wheelZ[i], front, left }); }
  if (lod === 0 || opt.features) buildFeatures(model, e, tpl, cfg, B, paintMat, opt);
  else { // einfache Lichter
    const acc = new Acc(); acc.box(0, B.yTopAt(B.zF - 0.3) - 0.08, B.zF - 0.08, B.hwAt(B.zF - 0.4) * 1.5, 0.08, 0.06, 0, 0, 0, [1, 1, 1]); const hm = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffee, toneMapped: false }); const headM = new THREE.Mesh(acc.build(), hm); root.add(headM); model.headMat = hm;
    const ac2 = new Acc(); ac2.box(0, B.yTopAt(B.zR + 0.3) - 0.1, B.zR + 0.02, B.hwAt(B.zR + 0.4) * 1.6, 0.07, 0.05, 0, 0, 0, [1, 0.05, 0.03]); const tm = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xff2a1a, toneMapped: false }); root.add(new THREE.Mesh(ac2.build(), tm)); model.tailMat = tm; model.headPos = [new V3(0.6, 0.6, B.zF), new V3(-0.6, 0.6, B.zF)]; model.tailPos = [new V3(0.6, 0.7, B.zR), new V3(-0.6, 0.7, B.zR)]; model.exhaust = []; model.eye = new V3(0.36, 1.1, 0);
  }
  model.dims = { L, H, W, zfa: B.zfa, zra: B.zra, track: B.track };
  return model;
};

function buildFeatures(model, e, tpl, cfg, B, paintMat, opt) {
  const root = model.group; const L = B.L, H = B.H, W = B.W; const { zF, zR, zfa, zra } = B; const rc = new THREE.Raycaster(); rc.far = 30; const bm = new THREE.Mesh(B.geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); const cloneBody = [bm];
  const trim = new Acc(), headA = new Acc(), tailA = new Acc(), chrome = new Acc(), intr = new Acc(); const dark = [0.03, 0.03, 0.035], black = [0.015, 0.015, 0.018], white = [1, 1, 1], red = [1, 0.1, 0.06];
  const lensAt = (acc, hit, w, h, color, th) => { const n = hit.face.normal.clone().normalize(); acc.add(PRIM.sph, basis(hit.point.clone().addScaledVector(n, 0.004), n, w, h, th || 0.05), color); };
  // Scheinwerfer
  const hd = tpl.head; model.headPos = []; for (const sgn of [1, -1]) { let hit = null; for (let k = 0; k < 6 && !hit; k++) { const x = hd.x * W / 2 * (1 - k * 0.07) * sgn; const dir = hd.dir === 'up' ? new V3(0, -1, 0) : new V3(0, 0, -1); const org = hd.dir === 'up' ? new V3(x, H * 1.5, zF - tpl.nf * L * 0.35) : new V3(x, hd.y * H, zF + 1); hit = rayHit(rc, cloneBody, org, dir); }
    if (hit) { const wlen = hd.w * W / 2; lensAt(headA, hit, wlen, hd.h, white, 0.05); model.headPos.push(hit.point.clone().add(new V3(0, 0, 0.1))); const rimN = hit.face.normal.clone(); lensAt(trim, hit, wlen * 1.18, hd.h * 1.35, black, 0.04); } else model.headPos.push(new V3(sgn * 0.6, 0.6, zF)); }
  // Rückleuchten
  const tl = tpl.tail; model.tailPos = []; for (const sgn of [1, -1]) { const x = tl.x * W / 2 * sgn; const hit = rayHit(rc, cloneBody, new V3(x, tl.y * H, zR - 1), new V3(0, 0, 1)); if (hit) { lensAt(tailA, hit, tl.w * W / 2, tl.h, red, 0.04); model.tailPos.push(hit.point.clone()); } else model.tailPos.push(new V3(sgn * 0.6, 0.7, zR)); }
  { const hit = rayHit(rc, cloneBody, new V3(0, tl.y * H, zR - 1), new V3(0, 0, 1)); if (hit && (spec_hyper(model.spec) || tpl.tail.w > 0.45)) lensAt(tailA, hit, W * 0.62, 0.035, [1, 0.05, 0.03], 0.03); }
  // Kühlergrill / Lufteinlass
  { const g = tpl.grille; let hit = rayHit(rc, cloneBody, new V3(0, g.y * H, zF + 1), new V3(0, 0, -1)); if (!hit) hit = rayHit(rc, cloneBody, new V3(0, H * 1.5, zF - 0.25), new V3(0, -1, 0)); if (hit) { lensAt(trim, hit, g.w * W / 2 * 1.6, g.h, black, 0.06); if (!opt.lite) for (let k = -1; k <= 1; k += 2) { /* Lamellen */ } }
    // untere Lufteinlässe
    for (const sgn of [1, -1]) { const hit2 = rayHit(rc, cloneBody, new V3(sgn * W * 0.32, (g.y * 0.55) * H, zF + 1), new V3(0, 0, -1)); if (hit2) lensAt(trim, hit2, W * 0.22, 0.09, black, 0.05); } }
  // Seitenlufteinlässe bei Mittelmotor
  if (spec_mid(model.spec)) for (const sgn of [1, -1]) { const hit = rayHit(rc, cloneBody, new V3(sgn * W, H * 0.40, zra + 0.95), new V3(-sgn, 0, 0)); if (hit) lensAt(trim, hit, 0.6, 0.2, black, 0.1); }
  // Kennzeichen
  for (const [zz, dz] of [[zF + 1, -1], [zR - 1, 1]]) { const hit = rayHit(rc, cloneBody, new V3(0, 0.46, zz), new V3(0, 0, dz)); if (hit) { const n = hit.face.normal.clone(); trim.add(PRIM.box, basis(hit.point.clone().addScaledVector(n, 0.01), n, 0.5, 0.11, 0.015), [0.85, 0.85, 0.78]); } }
  // Auspuffendrohre
  model.exhaust = []; const zy = B.yBotAt(zR + 0.1) + 0.1; const nT = model.spec.hp > 900 ? 4 : model.spec.hp > 400 ? 2 : 1; const ex = [];
  for (let k = 0; k < nT; k++) { const x = nT === 1 ? 0.35 * W / 2 : nT === 2 ? (k ? -1 : 1) * 0.42 * W / 2 : [0.28, 0.46, -0.28, -0.46][k] * W / 2; const y = nT === 4 ? zy + (k % 2 ? 0.06 : 0.0) : zy; chrome.add(PRIM.cyl, mat(x, y, zR - 0.025, 0.1, 0.18, 0.1, Math.PI / 2, 0, 0), [0.85, 0.86, 0.9]); chrome.add(PRIM.cyl, mat(x, y, zR - 0.1, 0.075, 0.03, 0.075, Math.PI / 2, 0, 0), [0.02, 0.02, 0.02]); model.exhaust.push(new V3(x, y, zR - 0.1)); }
  // Spiegel
  const zm = zR + (tpl.t1 - 0.035) * L; const mxm = B.cabHw(zm) * 1.0 + 0.1; const mirY = B.cabBase(zm) + 0.14; model.mirrors = [];
  for (const sgn of [1, -1]) { const m = new Acc(); m.box(sgn * mxm, mirY, zm, 0.19, 0.12, 0.1, 0, 0, 0, [1, 1, 1]); m.box(sgn * (mxm - 0.1), mirY - 0.05, zm + 0.02, 0.12, 0.03, 0.05, 0, 0, 0, [1, 1, 1]); const mesh = new THREE.Mesh(m.build(), paintMat); mesh.castShadow = false; root.add(mesh); model.mirrors.push(mesh); }
  // Karosserie-Kits
  const kit = cfg.kit | 0; const bodyC = [1, 1, 1]; const kitA = new Acc(); const cf = [0.06, 0.06, 0.07];
  if (kit > 0) { const fw = B.hwAt(zF - 0.45) * 2.0; const yy = B.yBotAt(zF - 0.1) + 0.0; const th = kit === 1 ? 0.03 : 0.05; trim.box(0, yy + 0.03, zF - 0.14 + (kit > 1 ? 0.06 : 0), fw * 0.98, th, 0.34 + kit * 0.06, 0.04, 0, 0, cf);
    if (kit >= 2) for (const sgn of [1, -1]) trim.box(sgn * fw * 0.5, yy + 0.12, zF - 0.4, 0.04, 0.16, 0.26, 0, sgn * 0.2, sgn * 0.12, cf);
    const sk0 = zra + 0.35, sk1 = zfa - 0.35; for (const sgn of [1, -1]) { const hwm = B.hwAt((sk0 + sk1) / 2); trim.box(sgn * (hwm + 0.005), 0.22 + (kit > 2 ? 0.02 : 0), (sk0 + sk1) / 2, kit > 2 ? 0.1 : 0.07, 0.1 + kit * 0.015, sk1 - sk0, 0, 0, 0, cf); }
    const rw = B.hwAt(zR + 0.3) * 1.9; trim.box(0, B.yBotAt(zR + 0.1) + 0.0, zR + 0.2, rw, 0.05, 0.3, -0.18, 0, 0, cf); if (kit >= 2) for (let k = -2; k <= 2; k++) trim.box(k * rw * 0.19, B.yBotAt(zR + 0.1) + 0.06, zR + 0.12, 0.025, 0.14, 0.28, 0, 0, 0, cf);
    if (kit >= 3) for (const zw of [zfa, zra]) for (const sgn of [1, -1]) { const hwz = B.hwAt(zw); for (let k = 0; k < 11; k++) { const a = -0.2 + k / 10 * (Math.PI + 0.4); const r = B.Ra + 0.03; const px = sgn * (hwz + 0.005), py = B.wr + Math.sin(a) * r * 0.95, pz = zw + Math.cos(a) * r; kitA.box(px, py, pz, 0.075, 0.06, 0.06, -a, 0, 0, bodyC); } } }
  // Heckflügel
  const sp = cfg.spoiler | 0; if (sp > 0) { const base = B.deck(0.07 + (sp === 1 ? 0.0 : 0.02)); const zw = zR + 0.34 + (sp >= 3 ? 0.04 : 0); const hwr = B.hwAt(zR + 0.5); const carbon = [0.04, 0.04, 0.045]; const wa = new Acc();
    if (sp === 1) { wa.box(0, base + 0.05, zR + 0.26, hwr * 1.7, 0.04, 0.22, -0.3, 0, 0, bodyC); }
    else { const hgt = sp === 2 ? 0.2 : sp === 3 ? 0.3 : 0.38; const chord = sp === 2 ? 0.3 : sp === 3 ? 0.38 : 0.46; const span = hwr * (sp === 4 ? 2.05 : 1.85);
      for (const sgn of [1, -1]) { wa.box(sgn * span * 0.32, base + hgt / 2 - 0.02, zw, 0.04, hgt + 0.06, 0.1, 0.12, 0, 0, carbon); wa.box(sgn * span * 0.5, base + hgt + 0.05, zw - 0.02, 0.025, 0.2 + sp * 0.03, chord + 0.05, 0, 0, 0, carbon); }
      wa.box(0, base + hgt + 0.02, zw, span, 0.035, chord, -0.1, 0, 0, sp === 2 ? bodyC : carbon); wa.box(0, base + hgt + 0.065, zw - chord * 0.34, span, 0.02, chord * 0.4, -0.35, 0, 0, carbon); }
    const wm = new THREE.Mesh(wa.build(), sp === 1 ? paintMat : std(0xffffff, { vertexColors: true, roughness: 0.35, metalness: 0.2 })); wm.castShadow = true; root.add(wm); model.parts.wing = wm; model.deformables.push(wm.geometry); }
  // Motorhaube
  const hd2 = cfg.hood | 0; if (hd2 > 0) { const z0 = zR + 0.72 * L, z1 = zR + 0.9 * L; const hh = B.deck(0.8); if (hd2 === 1) { kitA.box(0, B.deck(0.74) + 0.045, zR + 0.74 * L, 0.5, 0.1, 0.55, 0.28, 0, 0, bodyC); trim.box(0, B.deck(0.74) + 0.06, zR + 0.74 * L + 0.2, 0.36, 0.05, 0.04, 0.28, 0, 0, black); }
    else { const cc = hd2 === 2 ? [0.05, 0.05, 0.06] : [0.05, 0.05, 0.06]; for (let k = 0; k < 6; k++) { const t0 = 0.64 + k * 0.045; const zc = zR + (t0 + 0.022) * L; const y0 = B.deck(t0), y1 = B.deck(t0 + 0.045); trim.box(0, (y0 + y1) / 2 + 0.012, zc, W * (hd2 === 3 ? 0.58 : 0.62) * (B.hwAt(zc) / (W / 2)) , 0.014, 0.045 * L + 0.01, Math.atan2(y1 - y0, 0.045 * L), 0, 0, cc); } if (hd2 === 3) for (const sgn of [1, -1]) for (let k = 0; k < 4; k++) trim.box(sgn * 0.38, B.deck(0.74) + 0.03, zR + (0.7 + k * 0.03) * L, 0.2, 0.01, 0.015, 0.28, 0.35 * sgn, 0, black); } }
  // Polizei / Taxi Aufsätze
  if (model.spec.police) { const ry = B.cabTop(zR + (tpl.t0 + tpl.t1) / 2 * L); const lb = new Acc(); lb.box(0, ry + 0.06, zR + ((tpl.t0 + tpl.t1) / 2) * L, 1.1, 0.09, 0.32, 0, 0, 0, [0.04, 0.04, 0.05]); const bar = new THREE.Mesh(lb.build(), std(0xffffff, { vertexColors: true, roughness: .4 })); root.add(bar);
    const rl = new Acc(); rl.box(0.28, ry + 0.115, zR + ((tpl.t0 + tpl.t1) / 2) * L, 0.5, 0.06, 0.28, 0, 0, 0, [1, 1, 1]); const bl = new Acc(); bl.box(-0.28, ry + 0.115, zR + ((tpl.t0 + tpl.t1) / 2) * L, 0.5, 0.06, 0.28, 0, 0, 0, [1, 1, 1]);
    model.lightRed = new THREE.MeshBasicMaterial({ color: 0xff1010, toneMapped: false }); model.lightBlue = new THREE.MeshBasicMaterial({ color: 0x1030ff, toneMapped: false }); root.add(new THREE.Mesh(rl.build(), model.lightRed), new THREE.Mesh(bl.build(), model.lightBlue)); model.lightPos = new V3(0, ry + 0.2, zR + ((tpl.t0 + tpl.t1) / 2) * L); }
  if (model.spec.taxi) { const ry = B.cabTop(zR + (tpl.t0 + tpl.t1) / 2 * L); const ta = new Acc(); ta.box(0, ry + 0.09, zR + ((tpl.t0 + tpl.t1) / 2) * L, 0.5, 0.16, 0.2, 0, 0, 0, [1, 0.85, 0.2]); root.add(new THREE.Mesh(ta.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))); }
  // Meshes erzeugen
  const mk = (acc, material, name, cast) => { const g = acc.build(); if (!g) return null; const m = new THREE.Mesh(g, material); m.castShadow = !!cast; root.add(m); model.parts[name] = m; model.deformables.push(g); return m; };
  mk(trim, std(0xffffff, { vertexColors: true, roughness: 0.55, metalness: 0.2, envMapIntensity: .6 }), 'trim', false); mk(kitA, paintMat, 'kit', true);
  model.headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(1, 0.96, 0.85), emissiveIntensity: 0.4, roughness: .1, metalness: .3 }); model.tailMat = new THREE.MeshStandardMaterial({ color: 0x300000, emissive: new THREE.Color(1, 0.04, 0.02), emissiveIntensity: 0.6, roughness: .2, metalness: .2 });
  mk(headA, model.headMat, 'head', false); mk(tailA, model.tailMat, 'tail', false); mk(chrome, std(0xffffff, { vertexColors: true, roughness: .12, metalness: 1 }), 'chrome', false);
  // Unterboden / Underglow
  if (cfg.underglow > 0 && CD.UNDERGLOW[cfg.underglow]) { const c = new THREE.Color(CD.UNDERGLOW[cfg.underglow]); const gm = new THREE.MeshBasicMaterial({ map: G.Tex ? G.Tex.soft : null, color: c.clone().multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: true }); const quad = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.9, L * 1.35), gm); quad.rotation.x = -Math.PI / 2; quad.position.set(0, 0.035, 0); root.add(quad); model.underglow = quad; model.underglowColor = c; }
  buildInterior(model, e, tpl, B, intr);
}
function spec_hyper(s) { return s.hp > 900 || s.cls === 'Super'; }
function spec_mid(s) { return s.tpl === 'wedge'; }

/* ------------------------------------------------------------------ Innenraum */
function buildInterior(model, e, tpl, B, intr) {
  const root = model.group; const zc0 = B.zR + tpl.t0 * B.L, zc1 = B.zR + tpl.t1 * B.L; const zEye = U.lerp(zc0, zc1, 0.50); const belt = B.deck(tpl.t1 - 0.04); const roofY = B.H; const hwC = B.cabHw(zEye); const ex = Math.min(0.36, hwC * 0.45); const eyeY = U.lerp(belt, roofY, 0.60);
  model.eye = new V3(ex, eyeY, zEye - 0.05); const dk = [0.045, 0.045, 0.05], mid = [0.12, 0.12, 0.13], acc = [0.45, 0.04, 0.04], seatC = [0.07, 0.07, 0.08];
  const zd = zc1 - 0.05; // Armaturenbrett
  intr.box(0, belt - 0.16, zd - 0.2, hwC * 1.9, 0.36, 0.5, 0.0, 0, 0, dk); intr.box(ex, belt + 0.1, zd - 0.42, 0.62, 0.16, 0.26, -0.15, 0, 0, dk); intr.box(0, belt - 0.02, zd - 0.45, hwC * 1.7, 0.05, 0.1, 0, 0, 0, acc);
  intr.box(0, belt - 0.25, zEye - 0.05, 0.22, 0.28, (zd - zEye) * 1.6, 0, 0, 0, mid);
  intr.box(0, roofY - 0.11, (zc0 + zc1) / 2, hwC * 0.95, 0.025, (zc1 - zc0) * 0.62, 0, 0, 0, mid);
  for (const sgn of [1, -1]) { intr.box(sgn * (hwC * 0.93), belt - 0.18, (zc0 + zc1) / 2, 0.05, 0.4, (zc1 - zc0) * 0.78, 0, 0, 0, dk); intr.box(sgn * (hwC * 0.93), belt + 0.03, (zc0 + zc1) / 2, 0.05, 0.06, (zc1 - zc0) * 0.72, 0, 0, 0, mid);
    const zf = B.zR + (B.tB) * B.L; intr.add(PRIM.box, (function () { const a = new V3(sgn * hwC * 0.78, belt + 0.02, zc1 - 0.08), b = new V3(sgn * hwC * 0.62, roofY - 0.1, zf), c = a.clone().add(b).multiplyScalar(0.5); const d = b.clone().sub(a); const m4 = new M4(); m4.lookAt(new V3(0, 0, 0), d.clone().normalize(), new V3(0, 1, 0)); m4.setPosition(c); m4.scale(new V3(0.07, 0.07, d.length())); return m4; })(), dk); }
  const seat = (sx, sz) => { intr.box(sx, belt - 0.33, sz, 0.5, 0.14, 0.5, 0, 0, 0, seatC); intr.box(sx, belt - 0.04, sz - 0.24, 0.5, 0.56, 0.12, -0.18, 0, 0, seatC); const hy = Math.min(belt + 0.27, B.cabTop(sz - 0.3) - 0.16); if (hy > belt + 0.12) intr.box(sx, hy, sz - 0.28, 0.24, 0.16, 0.1, -0.18, 0, 0, seatC); intr.box(sx, belt - 0.04, sz - 0.21, 0.42, 0.3, 0.02, -0.18, 0, 0, acc); };
  seat(ex, zEye - 0.15); seat(-ex, zEye - 0.15); if (tpl.seats === 4 && (zc1 - zc0) > 1.6 && (B.cabTop(zc0 + 0.5) - belt) > 0.62) { for (const sx of [0.3, -0.3]) seat(sx, zc0 + 0.55); }
  intr.box(0, belt - 0.3, zEye - 0.1, 0.18, 0.1, 0.8, 0, 0, 0, mid); intr.add(PRIM.cyl8, mat(0, belt - 0.2, zEye - 0.28, 0.035, 0.18, 0.035, -0.3, 0, 0), [0.6, 0.6, 0.62]);
  intr.box(0, belt - 0.05, zc0 + 0.05, hwC * 1.8, 0.03, 0.5, 0, 0, 0, mid);
  const im = new THREE.Mesh(intr.build(), std(0xffffff, { vertexColors: true, roughness: 0.75, metalness: 0.05, envMapIntensity: .3, side: THREE.DoubleSide })); root.add(im); model.parts.interior = im; im.visible = true;
  // Lenkrad
  const sw = new THREE.Group(); const tor = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.016, 8, 24), std(0x0a0a0c, { roughness: .6 })); sw.add(tor); const spk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.02), std(0x16161a, { roughness: .5, metalness: .4 })); sw.add(spk); const spk2 = spk.clone(); spk2.rotation.z = Math.PI / 2; spk2.scale.x = 0.5; sw.add(spk2);
  sw.position.set(ex, belt + 0.07, zd - 0.62); sw.rotation.x = -0.32; const swp = new THREE.Group(); swp.position.copy(sw.position); sw.position.set(0, 0, 0); swp.add(sw); swp.rotation.x = -0.32; sw.rotation.x = 0; root.add(swp); model.steerWheel = sw;
  // Instrumente (Canvas)
  const gc = U.canvas(512, 256); const gx = gc.getContext('2d'); const gt = new THREE.CanvasTexture(gc); const gm = new THREE.MeshBasicMaterial({ map: gt, toneMapped: false }); const gq = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.2), gm); gq.position.set(ex, belt + 0.12, zd - 0.64); gq.rotation.x = -0.5; gq.rotation.y = Math.PI; root.add(gq); model.gauge = { ctx: gx, tex: gt, canvas: gc }; model.parts.gaugeQuad = gq;
  // Rückspiegel
  const rm = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.07), new THREE.MeshBasicMaterial({ color: 0x1a2028, toneMapped: false })); rm.position.set(0, B.cabBase(zc1 - 0.1) + (roofY - B.cabBase(zc1 - 0.1)) * 0.68, zc1 - 0.3); rm.rotation.y = Math.PI; root.add(rm); model.mirrorQuad = rm;
}

/* ------------------------------------------------------------------ Steuerung / Update */
CM.drawGauges = function (model, rpm, red, speedKmh, gear, boost) {
  if (!model.gauge) return; const g = model.gauge.ctx; g.fillStyle = '#05070b'; g.fillRect(0, 0, 512, 256);
  const dial = (cx, cy, r, v, vmax, ticks, label, color) => { g.strokeStyle = '#222a35'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); g.stroke(); const a1 = Math.PI * 0.75 + U.clamp(v / vmax, 0, 1) * Math.PI * 1.5; g.strokeStyle = color; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.75, a1); g.stroke();
    g.fillStyle = '#9fb0c4'; g.font = '14px Arial'; g.textAlign = 'center'; for (let i = 0; i <= ticks; i++) { const a = Math.PI * 0.75 + i / ticks * Math.PI * 1.5; g.fillText(String(Math.round(i / ticks * vmax / (label === 'RPM' ? 1000 : 1))), cx + Math.cos(a) * (r - 20), cy + Math.sin(a) * (r - 20) + 5); }
    g.strokeStyle = '#ff3b3b'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a1) * (r - 8), cy + Math.sin(a1) * (r - 8)); g.stroke(); g.fillStyle = '#d0d8e4'; g.font = '12px Arial'; g.fillText(label, cx, cy + r * 0.55); };
  const rmax = Math.ceil(red / 1000) * 1000; dial(130, 130, 100, rpm, rmax, rmax / 1000, 'RPM', rpm > red * 0.94 ? '#ff2a2a' : '#35c8ff'); dial(382, 130, 100, speedKmh, 360, 9, 'KM/H', '#35c8ff');
  g.fillStyle = '#fff'; g.font = 'bold 44px Arial'; g.textAlign = 'center'; g.fillText(gear === 0 ? 'N' : gear < 0 ? 'R' : String(gear), 256, 150); g.font = '16px Arial'; g.fillStyle = '#8fa0b4'; g.fillText(Math.round(speedKmh) + ' km/h', 256, 190); model.gauge.tex.needsUpdate = true;
};
CM.setLights = function (model, head, brake, reverse, night) { if (model.headMat) { if (model.headMat.emissiveIntensity !== undefined && model.headMat.isMeshStandardMaterial) { model.headMat.emissiveIntensity = head ? 2.4 : 0.15; } else if (model.headMat.color) model.headMat.color.setRGB(head ? 1.6 : 0.5, head ? 1.55 : 0.5, head ? 1.4 : 0.48); }
  if (model.tailMat) { const v = brake ? 3.2 : head ? 1.1 : 0.25; if (model.tailMat.isMeshStandardMaterial) model.tailMat.emissiveIntensity = v; else model.tailMat.color.setRGB(v, v * 0.05, v * 0.03); } };
CM.applyWheels = function (model, spins, steer, comp) {
  for (let i = 0; i < 4; i++) { const w = model.wheels[i]; w.spin.rotation.x = spins[i]; if (i < 2) w.pivot.rotation.y = steer; const wp = model.wheelPos[i]; w.pivot.position.y = model.e.wr + (comp ? comp[i] : 0); }
  if (model.steerWheel) model.steerWheel.rotation.z = -steer * 9;
};
/* Verformung: lokaler Punkt (Modellraum), Richtung nach innen (normalisiert), Radius, Tiefe */
CM.deform = function (model, lp, dir, radius, depth) {
  const r2 = radius * radius; for (const g of model.deformables) { const pa = g.attributes.position; if (!g.userData.orig) g.userData.orig = pa.array.slice(); const orig = g.userData.orig; let changed = false;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); const d2 = (x - lp.x) ** 2 + (y - lp.y) ** 2 + (z - lp.z) ** 2; if (d2 > r2) continue; const f = 1 - Math.sqrt(d2) / radius; const k = f * f * (3 - 2 * f); const noise = 0.7 + 0.6 * Math.sin(x * 37.1 + y * 21.7 + z * 13.3); let nx = x + dir.x * depth * k * noise, ny = y + dir.y * depth * k * noise, nz = z + dir.z * depth * k * noise;
      const ox = orig[i * 3], oy = orig[i * 3 + 1], oz = orig[i * 3 + 2]; const dx = nx - ox, dy = ny - oy, dz = nz - oz; const dl = Math.hypot(dx, dy, dz); if (dl > 0.42) { const s = 0.42 / dl; nx = ox + dx * s; ny = oy + dy * s; nz = oz + dz * s; } pa.setXYZ(i, nx, ny, nz); changed = true; }
    if (changed) { pa.needsUpdate = true; if (g.attributes.normal) g.computeVertexNormals(); } }
};
CM.repair = function (model) { for (const g of model.deformables) { if (g.userData.orig) { g.attributes.position.array.set(g.userData.orig); g.attributes.position.needsUpdate = true; g.computeVertexNormals(); } } };
CM.dispose = function (model) {
  model.group.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { if (m.map && m.map.isCanvasTexture) m.map.dispose(); CM.mats.delete(m); m.dispose(); } }); if (model.group.parent) model.group.parent.remove(model.group);
};
CM.setEnv = function (tex) { CM.envTex = tex; for (const m of CM.mats) m.envMap = tex; };

G.CM = CM;
})(window.G = window.G || {});
