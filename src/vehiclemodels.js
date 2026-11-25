// Prozedurale 3D-Modelle für Autos, Motorräder, Boote, Flugzeuge, Helikopter
import * as THREE from 'three';
import { MB, colorOf } from './builder.js';
import { RNG, lerp } from './util.js';

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3();
const _geoCache = new Map();
function geo(key, make) { let g = _geoCache.get(key); if (!g) { g = make(); _geoCache.set(key, g); } return g; }
function put(mb, g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, col = [1, 1, 1]) {
  E.set(rx, ry, rz); Q.setFromEuler(E); V3.set(x, y, z); S3.set(sx, sy, sz);
  M4.compose(V3, Q, S3); mb.append(g, M4, colorOf(col));
}
const CYL = (n) => geo('cyl' + n, () => new THREE.CylinderGeometry(1, 1, 1, n));
const SPH = geo('sph', () => new THREE.SphereGeometry(1, 12, 8));
const TOR = geo('tor', () => new THREE.TorusGeometry(1, 0.12, 6, 14));

export const BODY = {
  hatch: { ws: 0.62, rf: 0.5, rr: 0.18, rg: 0.08, hood: 0.6, deck: 0.75, wc: 0.88 },
  sedan: { ws: 0.66, rf: 0.53, rr: 0.27, rg: 0.2, hood: 0.57, deck: 0.62, wc: 0.88 },
  coupe: { ws: 0.62, rf: 0.5, rr: 0.27, rg: 0.12, hood: 0.55, deck: 0.6, wc: 0.86 },
  wedge: { ws: 0.56, rf: 0.44, rr: 0.22, rg: 0.08, hood: 0.46, deck: 0.55, wc: 0.84 },
  muscle: { ws: 0.6, rf: 0.5, rr: 0.24, rg: 0.16, hood: 0.6, deck: 0.62, wc: 0.86 },
  classic: { ws: 0.62, rf: 0.54, rr: 0.26, rg: 0.19, hood: 0.58, deck: 0.62, wc: 0.84 },
  suv: { ws: 0.7, rf: 0.64, rr: 0.1, rg: 0.04, hood: 0.6, deck: 0.88, wc: 0.93 },
  jeep: { ws: 0.66, rf: 0.62, rr: 0.12, rg: 0.1, hood: 0.52, deck: 0.9, wc: 0.95 },
  pickup: { ws: 0.58, rf: 0.5, rr: 0.3, rg: 0.28, hood: 0.62, deck: 0.58, wc: 0.9, bed: true },
  van: { ws: 0.86, rf: 0.82, rr: 0.06, rg: 0.03, hood: 0.52, deck: 0.92, wc: 0.97 },
  limo: { ws: 0.82, rf: 0.75, rr: 0.16, rg: 0.1, hood: 0.57, deck: 0.6, wc: 0.9 },
};

function extrudeProfile(mb, pts, width, bevel, col) {
  const sh = new THREE.Shape();
  pts.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y)));
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  M4.identity(); mb.append(g, M4, colorOf(col)); g.dispose();
}
function glassQuad(mb, a, b, c, d, off = 0.012) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx = nx / l * off; ny = ny / l * off; nz = nz / l * off;
  const sh = (p) => [p[0] + nx, p[1] + ny, p[2] + nz];
  mb.quad(sh(a), sh(b), sh(c), sh(d), [1, 1, 1]);
}
function box(mb, x, y0, z, w, h, d, col, rot = 0) { mb.box(x, y0, z, w, h, d, { col, rot, uvs: 1 }); }

// Rad: Reifen + Felge (Achse = x)
export function wheelGeometry(r, w, style = 0) {
  return geo(`wheel${r.toFixed(2)}_${w.toFixed(2)}_${style}`, () => {
    const mb = new MB();
    const dark = [0.04, 0.04, 0.045], rim = style === 1 ? [0.85, 0.7, 0.2] : style === 2 ? [0.1, 0.1, 0.12] : [0.78, 0.8, 0.84];
    put(mb, CYL(18), 0, 0, 0, 0, 0, Math.PI / 2, r, w, r, dark);
    put(mb, CYL(12), 0, 0, 0, 0, 0, Math.PI / 2, r * 0.66, w * 1.02, r * 0.66, rim);
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; put(mb, geo('b1', () => new THREE.BoxGeometry(1, 1, 1)), w * 0.52, Math.cos(a) * r * 0.33, Math.sin(a) * r * 0.33, a, 0, 0, 0.03, r * 0.1, r * 0.6, rim.map((v) => v * 0.8)); }
    put(mb, CYL(8), w * 0.53, 0, 0, 0, 0, Math.PI / 2, r * 0.14, 0.03, r * 0.14, [0.3, 0.3, 0.32]);
    return mb.build();
  });
}

// ---------------- Autos ----------------
function buildCar(spec) {
  const rng = new RNG(spec.seed);
  const B = BODY[spec.body] || BODY.sedan;
  const L = spec.len, W = spec.wid, H = spec.hgt;
  const paint = new MB(), trim = new MB(), glass = new MB(), head = new MB(), tail = new MB(), barR = new MB(), barB = new MB(), neon = new MB(), signLit = new MB();
  const cl = spec.body === 'jeep' || spec.body === 'suv' ? 0.3 : spec.cls === 'super' || spec.cls === 'sport' ? 0.12 : 0.2;
  const z = (f) => -L / 2 + L * f;
  const yHood = H * B.hood, yDeck = H * B.deck, yBelt = Math.max(yHood, yDeck) * 0.98;
  const dk = [0.05, 0.05, 0.06], chrome = [0.7, 0.72, 0.75];
  const isTruck = spec.body === 'truck', isBus = spec.body === 'bus';
  let seatZ = z(B.rf) - 0.2;
  let roofX = 0;
  if (isBus) {
    paint.box(0, cl + 0.15, 0, W, H - cl - 0.15, L, { col: 0xffffff, uvs: 1 });
    // Fensterband
    const wcol = [0.08, 0.1, 0.14];
    for (const sx of [-1, 1]) glass.box(sx * (W / 2 + 0.01), H * 0.48, 0, 0.03, H * 0.28, L * 0.92, { col: wcol, uvs: 1 });
    glass.box(0, H * 0.5, L / 2 + 0.01, W * 0.92, H * 0.34, 0.03, { col: wcol, uvs: 1 });
    trim.box(0, 0.25, 0, W * 1.005, 0.4, L * 1.002, { col: dk, uvs: 1 });
    trim.box(0, H - 0.05, 0, W * 0.98, 0.08, L * 0.98, { col: [0.7, 0.7, 0.72], uvs: 1 });
    seatZ = L / 2 - 0.9;
  } else if (isTruck) {
    const cabL = L * 0.3;
    extrudeProfile(paint, [[L / 2, cl + 0.1], [L / 2, H * 0.55], [L / 2 - 0.2, H * 0.62], [L / 2 - cabL * 0.9, H * 0.99], [L / 2 - cabL, H * 0.99], [L / 2 - cabL, cl + 0.1]], W * 0.98, 0.05, 0xffffff);
    paint.box(0, cl + 0.2, -L / 2 + (L - cabL) / 2, W, H * 0.95 - cl - 0.2, L - cabL - 0.15, { col: [0.92, 0.92, 0.95], uvs: 1 });
    glass.box(0, H * 0.78, L / 2 - 0.2, W * 0.9, H * 0.28, 0.05, { col: [0.06, 0.08, 0.11], uvs: 1 });
    for (const sx of [-1, 1]) glass.box(sx * (W / 2 * 0.98), H * 0.76, L / 2 - cabL * 0.55, 0.04, H * 0.22, cabL * 0.5, { col: [0.06, 0.08, 0.11], uvs: 1 });
    trim.box(0, 0.2, -L / 2 + (L - cabL) / 2, W * 0.9, 0.3, L - cabL, { col: dk, uvs: 1 });
    seatZ = L / 2 - cabL * 0.55;
  } else {
    const wsz = z(B.ws), rfz = z(B.rf), rrz = z(B.rr), rgz = z(B.rg);
    const bed = B.bed;
    const lower = [
      [z(1), cl + 0.04], [z(1) + 0.0, yHood * 0.78], [z(1) - L * 0.06, yHood * 0.97], [wsz, yHood],
      [rgz, bed ? yDeck - 0.1 : yDeck], [z(0.04), bed ? yDeck - 0.12 : yDeck - 0.02], [z(0), (bed ? yDeck : yDeck) * 0.8], [z(0), cl + 0.04],
    ];
    if (spec.body === 'wedge') { lower[1][1] = yHood * 0.62; lower[2][0] = z(1) - L * 0.09; lower[2][1] = yHood * 0.88; }
    extrudeProfile(paint, lower, W, 0.07, 0xffffff);
    const Wc = W * B.wc;
    const cabin = [[wsz, yHood - 0.04], [rfz, H], [rrz, H], [rgz, (bed ? yDeck - 0.1 : yDeck) - 0.04]];
    if (spec.conv) { cabin[1][1] = yHood + 0.28; cabin[2][1] = yHood + 0.28; cabin[1][0] = wsz - 0.4; cabin[2][0] = rgz + 0.4; }
    extrudeProfile(paint, cabin, Wc, 0.05, 0xffffff);
    const gw = Wc / 2 + 0.012;
    const yTop = (spec.conv ? yHood + 0.28 : H) - 0.1;
    // Seitenfenster
    for (const sx of [1, -1]) {
      const P0 = [sx * gw, yBelt, wsz - 0.18], P1 = [sx * gw, yBelt, rgz + 0.12], P2 = [sx * gw, yTop, rrz + 0.14], P3 = [sx * gw, yTop, rfz - 0.1];
      if (spec.conv) continue;
      if (sx > 0) glassQuad(glass, P0, P1, P2, P3, 0.004); else glassQuad(glass, P1, P0, P3, P2, 0.004);
      // B-Säule
      const bz = (wsz + rgz) / 2;
      trim.box(sx * (gw + 0.015), yBelt, bz, 0.03, yTop - yBelt, 0.1, { col: dk, uvs: 1 });
    }
    // Frontscheibe / Heckscheibe
    const ww = Wc / 2 * 0.97;
    if (!spec.conv) {
      glassQuad(glass, [-ww, yHood + 0.01, wsz - 0.02], [ww, yHood + 0.01, wsz - 0.02], [ww * 0.96, yTop, rfz - 0.04], [-ww * 0.96, yTop, rfz - 0.04], 0.014);
      glassQuad(glass, [ww, (bed ? yDeck - 0.1 : yDeck) + 0.01, rgz + 0.02], [-ww, (bed ? yDeck - 0.1 : yDeck) + 0.01, rgz + 0.02], [-ww * 0.96, yTop, rrz + 0.04], [ww * 0.96, yTop, rrz + 0.04], 0.014);
    } else glassQuad(glass, [-ww, yHood + 0.01, wsz - 0.02], [ww, yHood + 0.01, wsz - 0.02], [ww * 0.96, yHood + 0.28, rfz + 0.1], [-ww * 0.96, yHood + 0.28, rfz + 0.1], 0.014);
    // Heckklappe/Pickup-Ladefläche
    if (bed) {
      const bz0 = z(0.02), bz1 = rgz - 0.04, bl = bz1 - bz0, by = yDeck - 0.1;
      paint.box(0, by - 0.02, (bz0 + bz1) / 2, W, 0.08, bl, { col: 0xffffff, uvs: 1 });
      trim.box(0, by + 0.0, (bz0 + bz1) / 2, W * 0.9, 0.04, bl * 0.96, { col: [0.1, 0.1, 0.11], uvs: 1 });
      for (const sx of [-1, 1]) paint.box(sx * (W / 2 - 0.04), by, (bz0 + bz1) / 2, 0.08, 0.5, bl, { col: 0xffffff, uvs: 1 });
      paint.box(0, by, bz0 + 0.04, W, 0.5, 0.08, { col: 0xffffff, uvs: 1 });
      paint.box(0, by, bz1 - 0.04, W, 0.5, 0.08, { col: 0xffffff, uvs: 1 });
    }
    // Details
    // Stoßstangen
    const bw = W * 0.97;
    trim.box(0, cl + 0.02, z(1) - 0.08, bw, 0.34, 0.3, { col: spec.cls === 'classic' ? chrome : dk, uvs: 1 });
    trim.box(0, cl + 0.02, z(0) + 0.08, bw, 0.34, 0.3, { col: spec.cls === 'classic' ? chrome : dk, uvs: 1 });
    // Grill
    trim.box(0, yHood * 0.5, z(1) - 0.02, W * 0.5, yHood * 0.22, 0.06, { col: spec.cls === 'classic' ? chrome : dk, uvs: 1 });
    // Kennzeichen
    trim.box(0, cl + 0.12, z(1) + 0.045, 0.52, 0.12, 0.03, { col: [0.95, 0.95, 0.9], uvs: 1 });
    trim.box(0, yDeck * 0.7, z(0) - 0.04, 0.52, 0.12, 0.03, { col: [0.95, 0.95, 0.9], uvs: 1 });
    // Spiegel
    for (const sx of [-1, 1]) trim.box(sx * (Wc / 2 + 0.12), yBelt + 0.02, wsz - 0.1, 0.16, 0.1, 0.1, { col: dk, uvs: 1 });
    // Türfugen
    for (const sx of [-1, 1]) { trim.box(sx * (W / 2 + 0.01), cl + 0.3, (wsz + rgz) / 2, 0.012, yBelt - cl - 0.35, 0.02, { col: [0.02, 0.02, 0.03], uvs: 1 }); trim.box(sx * (W / 2 + 0.01), yBelt * 0.6, (wsz + rgz) / 2 + (rgz - wsz) * 0.15, 0.02, 0.025, 0.12, { col: chrome, uvs: 1 }); }
    // Schweller
    for (const sx of [-1, 1]) trim.box(sx * (W / 2 + 0.01), cl, z(0.5), 0.05, 0.1, L * 0.5, { col: dk, uvs: 1 });
    // Spoiler / Heckflügel / Lufthutze
    if (spec.cls === 'sport' || spec.cls === 'super' || (spec.cls === 'muscle' && rng.chance(0.5)) || (spec.cls === 'coupe' && rng.chance(0.4))) {
      const sy = yDeck + (spec.cls === 'super' ? 0.28 : 0.22);
      trim.box(0, sy, z(0.04), W * 0.9, 0.05, 0.38, { col: dk, uvs: 1 });
      for (const sx of [-1, 1]) trim.box(sx * W * 0.32, yDeck - 0.02, z(0.05), 0.06, sy - yDeck + 0.03, 0.2, { col: dk, uvs: 1 });
    }
    if (spec.cls === 'muscle' || spec.cls === 'sport') trim.box(0, yHood + 0.01, z(0.82), W * 0.3, 0.1, 0.5, { col: dk, uvs: 1 });
    // Rennstreifen
    if (rng.chance(0.35) && (spec.cls === 'muscle' || spec.cls === 'sport' || spec.cls === 'coupe')) {
      const sc = rng.chance(0.5) ? [0.95, 0.95, 0.95] : [0.05, 0.05, 0.06];
      trim.box(0, yHood + 0.012, (wsz + z(1)) / 2, W * 0.22, 0.01, z(1) - wsz - 0.4, { col: sc, uvs: 1 });
      trim.box(0, yDeck + 0.012, (rgz + z(0)) / 2, W * 0.22, 0.01, rgz - z(0) - 0.2, { col: sc, uvs: 1 });
    }
    // Dachträger / Rammschutz
    if (spec.body === 'suv' || spec.body === 'jeep') { for (const sx of [-1, 1]) trim.box(sx * Wc * 0.4, H + 0.01, (rfz + rrz) / 2, 0.04, 0.06, rfz - rrz - 0.3, { col: dk, uvs: 1 }); }
    if (spec.body === 'jeep') { trim.box(0, cl + 0.25, z(1) + 0.18, W * 0.9, 0.08, 0.1, { col: chrome, uvs: 1 }); for (const sx of [-1, 1]) trim.box(sx * W * 0.42, cl + 0.3, z(1) + 0.15, 0.08, 0.5, 0.08, { col: chrome, uvs: 1 }); put(trim, CYL(10), 0, cl + 0.9, z(0) - 0.3, Math.PI / 2, 0, 0, 0.3, 0.12, 0.3, dk); }
    // Auspuff
    for (const sx of [-1, 1]) put(trim, CYL(8), sx * W * 0.28, cl + 0.05, z(0) - 0.1, Math.PI / 2, 0, 0, 0.05, 0.2, 0.05, chrome);
    // Scheinwerfer + Rücklichter
    const hw = spec.cls === 'classic' ? 0.12 : 0.15;
    for (const sx of [-1, 1]) {
      if (spec.cls === 'classic' || spec.cls === 'muscle' && rng.chance(0.4)) put(head, CYL(10), sx * W * 0.34, yHood * 0.62, z(1) - 0.04, Math.PI / 2, 0, 0, hw, 0.06, hw, [1, 0.97, 0.85]);
      else head.box(sx * W * 0.34, yHood * 0.62, z(1) - 0.04, W * 0.18, spec.cls === 'super' ? 0.06 : 0.12, 0.08, { col: [1, 0.97, 0.88], uvs: 1 });
      tail.box(sx * W * 0.34, yDeck * 0.85, z(0) + 0.03, W * 0.2, 0.1, 0.06, { col: [1, 0.05, 0.05], uvs: 1 });
    }
    if (spec.cls === 'super' || spec.cls === 'sport') tail.box(0, yDeck * 0.9, z(0) + 0.02, W * 0.5, 0.04, 0.05, { col: [1, 0.05, 0.05], uvs: 1 });
    // Innenraum
    const seatY = Math.max(0.35, yBelt * 0.55);
    for (const sx of [-1, 1]) { trim.box(sx * W * 0.22, seatY - 0.1, seatZ - 0.15, 0.5, 0.08, 0.5, { col: [0.12, 0.1, 0.1], uvs: 1 }); trim.box(sx * W * 0.22, seatY, seatZ - 0.42, 0.5, 0.55, 0.12, { col: [0.12, 0.1, 0.1], uvs: 1 }); }
    trim.box(0, yBelt * 0.75, wsz - 0.15, Wc * 0.92, 0.18, 0.4, { col: [0.08, 0.08, 0.09], uvs: 1 });
    put(trim, TOR, W * 0.22, yBelt * 0.88, wsz - 0.45, -0.9, 0, 0, 0.17, 1, 0.17, [0.05, 0.05, 0.05]);
    // Polizei / Taxi / Rettung
    if (spec.cop) {
      for (const sx of [-1, 1]) trim.box(sx * (W / 2 + 0.015), cl + 0.28, (wsz + rgz) / 2, 0.02, yBelt - cl - 0.4, (wsz - rgz) * 0.9, { col: [0.05, 0.06, 0.1], uvs: 1 });
      barR.box(-0.28, H + 0.01, (rfz + rrz) / 2, 0.5, 0.14, 0.26, { col: [1, 0.05, 0.05], uvs: 1 });
      barB.box(0.28, H + 0.01, (rfz + rrz) / 2, 0.5, 0.14, 0.26, { col: [0.1, 0.2, 1], uvs: 1 });
      trim.box(0, H + 0.0, (rfz + rrz) / 2, 1.2, 0.05, 0.32, { col: dk, uvs: 1 });
    }
    if (spec.taxi) { signLit.box(0, H + 0.02, (rfz + rrz) / 2, 0.6, 0.18, 0.22, { col: [1, 0.9, 0.5], uvs: 1 }); trim.box(0, H + 0.0, (rfz + rrz) / 2, 0.64, 0.03, 0.26, { col: dk, uvs: 1 }); trim.box(0, yBelt * 0.6, (wsz + rgz) / 2 + 0.2, W + 0.02, 0.05, 0.4, { col: [0.05, 0.05, 0.06], uvs: 1 }); }
    if (spec.em === 'amb' || spec.em === 'chief') {
      barR.box(-0.5, H + 0.02, (rfz + rrz) / 2, 0.8, 0.16, 0.3, { col: [1, 0.05, 0.05], uvs: 1 }); barB.box(0.5, H + 0.02, (rfz + rrz) / 2, 0.8, 0.16, 0.3, { col: [0.1, 0.2, 1], uvs: 1 });
      for (const sx of [-1, 1]) trim.box(sx * (W / 2 + 0.015), H * 0.45, (wsz + rgz) / 2, 0.02, 0.22, L * 0.7, { col: [0.9, 0.1, 0.1], uvs: 1 });
    }
    if (spec.em === 'fire') {
      barR.box(-0.5, H + 0.02, (rfz + rrz) / 2 + 0.6, 0.8, 0.16, 0.3, { col: [1, 0.05, 0.05], uvs: 1 }); barB.box(0.5, H + 0.02, (rfz + rrz) / 2 + 0.6, 0.8, 0.16, 0.3, { col: [1, 0.5, 0.05], uvs: 1 });
      for (const sx of [-1, 1]) trim.box(sx * 0.3, H + 0.1, -L / 2 + 1.8, 0.1, 0.1, 3.4, { col: [0.75, 0.75, 0.78], uvs: 1 });
      trim.box(0, H + 0.1, -L / 2 + 1.8, 0.6, 0.06, 3.4, { col: [0.7, 0.7, 0.72], uvs: 1 });
    }
    if (spec.neon) neon.box(0, 0.12, 0, W * 0.92, 0.03, L * 0.92, { col: [1, 0.15, 0.85], uvs: 1 });
    if (spec.cls === 'limo') for (let k = 0; k < 3; k++) trim.box(0, yBelt * 0.55, -L * 0.1 + k * 0.7, W * 0.55, 0.45, 0.5, { col: [0.1, 0.07, 0.07], uvs: 1 });
  }
  if (isBus || isTruck) {
    for (const sx of [-1, 1]) head.box(sx * W * 0.35, H * 0.3, L / 2 + 0.03, 0.3, 0.14, 0.06, { col: [1, 0.97, 0.88], uvs: 1 });
    for (const sx of [-1, 1]) tail.box(sx * W * 0.38, H * 0.3, -L / 2 - 0.02, 0.28, 0.16, 0.05, { col: [1, 0.05, 0.05], uvs: 1 });
    trim.box(0, 0.15, L / 2 - 0.05, W, 0.3, 0.2, { col: dk, uvs: 1 });
    trim.box(0, 0.15, -L / 2 + 0.05, W, 0.3, 0.2, { col: dk, uvs: 1 });
  }
  // Räder
  const r = spec.tire, tw = Math.min(0.34, r * 0.65 + 0.05);
  const wheels = [];
  const az = Math.min(spec.wb / 2 * 1.0, L / 2 - r - 0.1);
  const front = L / 2 - (L - spec.wb) * 0.55, rear = front - spec.wb;
  const wx = W / 2 - tw / 2 + 0.03;
  for (const [zz, steer] of [[front, true], [rear, false]]) for (const sx of [-1, 1]) wheels.push({ x: sx * wx, y: r, z: zz, r, w: tw, steer, side: sx });
  if (isTruck || spec.body === 'bus') for (const sx of [-1, 1]) wheels.push({ x: sx * wx, y: r, z: rear - r * 2.4, r, w: tw, steer: false, side: sx });
  for (const w of wheels) put(trim, CYL(16), Math.sign(w.x) * (W / 2 + 0.008), w.y, w.z, 0, 0, Math.PI / 2, w.r * 1.14, 0.02, w.r * 1.14, [0.02, 0.02, 0.025]);
  const model = {
    spec, kind: 'car', dims: { L, W, H }, wheels, wheelStyle: spec.cls === 'super' || spec.cls === 'sport' ? (rng.chance(0.4) ? 1 : 2) : 0,
    seat: { x: W * 0.22, y: 0.55, z: seatZ - 0.15 }, doorX: W / 2 + 0.55, cl,
    layers: { paint, trim, glass, head, tail, barR, barB, neon, signLit },
    exhaust: { x: W * 0.28, y: cl + 0.05, z: -L / 2 - 0.1 }, tailY: H * 0.5,
  };
  return model;
}

// ---------------- Motorrad / Quad ----------------
function buildBike(spec) {
  const paint = new MB(), trim = new MB(), glass = new MB(), head = new MB(), tail = new MB(), barR = new MB(), barB = new MB(), neon = new MB(), signLit = new MB();
  const L = spec.len, r = spec.tire, dk = [0.06, 0.06, 0.07], chrome = [0.75, 0.77, 0.8];
  const wheels = [];
  const quad = spec.body === 'quad', scooter = spec.style === 'scooter', cruiser = spec.style === 'cruiser', dirt = spec.style === 'dirt';
  if (quad) {
    const tw = 0.24, W = spec.wid;
    for (const zz of [L * 0.32, -L * 0.32]) for (const sx of [-1, 1]) wheels.push({ x: sx * (W / 2 - tw / 2), y: r, z: zz, r, w: tw, steer: zz > 0, side: sx });
    paint.box(0, r + 0.1, 0, W * 0.6, 0.35, L * 0.75, { col: 0xffffff, uvs: 1 });
    paint.box(0, r + 0.42, L * 0.2, W * 0.5, 0.25, 0.5, { col: 0xffffff, uvs: 1 });
    trim.box(0, r + 0.45, -L * 0.12, 0.45, 0.14, 0.7, { col: dk, uvs: 1 });
    trim.box(0, r + 0.6, L * 0.22, W * 0.8, 0.05, 0.06, { col: chrome, uvs: 1 });
    head.box(0, r + 0.4, L / 2 - 0.08, 0.4, 0.14, 0.08, { col: [1, 0.97, 0.85], uvs: 1 }); tail.box(0, r + 0.3, -L / 2 + 0.2, 0.3, 0.1, 0.05, { col: [1, 0.05, 0.05], uvs: 1 });
    return { spec, kind: 'bike', dims: { L, W, H: 1.2 }, wheels, wheelStyle: 2, seat: { x: 0, y: r + 0.55, z: -L * 0.12 }, doorX: 1.1, cl: 0.2, layers: { paint, trim, glass, head, tail, barR, barB, neon, signLit }, exhaust: { x: 0.3, y: 0.4, z: -L / 2 }, tailY: 0.6, quad: true };
  }
  const fz = L * 0.36, rz = -L * 0.36, tw = scooter ? 0.12 : 0.16, rr = scooter ? 0.25 : dirt ? 0.36 : r;
  wheels.push({ x: 0, y: rr, z: fz, r: rr, w: tw, steer: true }, { x: 0, y: rr, z: rz, r: rr, w: tw + 0.04, steer: false });
  // Rahmen / Tank / Sitz
  paint.box(0, rr + 0.35, 0.05, 0.28, 0.28, 0.6, { col: 0xffffff, uvs: 1 });                // Tank
  if (scooter) { paint.box(0, rr + 0.05, -0.1, 0.4, 0.15, 1.0, { col: 0xffffff, uvs: 1 }); paint.box(0, rr + 0.3, rz + 0.1, 0.34, 0.4, 0.7, { col: 0xffffff, uvs: 1 }); paint.box(0, rr + 0.3, fz - 0.15, 0.3, 0.7, 0.2, { col: 0xffffff, uvs: 1 }); }
  else { paint.box(0, rr + 0.1, 0, 0.22, 0.3, 0.9, { col: dk, uvs: 1 }); }
  trim.box(0, rr + 0.55, rz * 0.4, 0.3, 0.1, 0.7, { col: [0.08, 0.07, 0.07], uvs: 1 });  // Sitz
  put(trim, CYL(8), 0, rr + 0.03, 0.1, Math.PI / 2, 0, 0, 0.2, 0.4, 0.2, [0.15, 0.15, 0.17]); // Motor
  for (const sx of [-1, 1]) put(trim, CYL(6), sx * 0.08, rr * 0.8, fz, 0.35 * (dirt ? 1.3 : 1), 0, 0, 0.025, rr * 2, 0.025, chrome); // Gabel
  trim.box(0, rr + 0.9 - (scooter ? 0.05 : 0.12), fz - 0.2, 0.7, 0.05, 0.06, { col: chrome, uvs: 1 });                // Lenker
  put(trim, CYL(8), 0.1, rr * 0.7, rz - 0.15, Math.PI / 2, 0, 0, 0.04, 0.9, 0.04, chrome);              // Auspuff
  if (cruiser) { paint.box(0, rr + 0.3, fz * 0.3, 0.3, 0.34, 0.5, { col: 0xffffff, uvs: 1 }); trim.box(0, rr + 0.75, fz - 0.35, 0.05, 0.28, 0.05, { col: chrome, uvs: 1 }); }
  head.box(0, rr + 0.7, fz + 0.02, 0.2, 0.16, 0.1, { col: [1, 0.97, 0.85], uvs: 1 });
  tail.box(0, rr + 0.5, rz - 0.2, 0.18, 0.08, 0.06, { col: [1, 0.05, 0.05], uvs: 1 });
  if (spec.cop) { barR.box(-0.1, rr + 0.9, rz, 0.16, 0.1, 0.1, { col: [1, 0.05, 0.05], uvs: 1 }); barB.box(0.1, rr + 0.9, rz, 0.16, 0.1, 0.1, { col: [0.1, 0.2, 1], uvs: 1 }); }
  if (spec.neon) neon.box(0, 0.1, 0, 0.3, 0.03, L * 0.8, { col: [1, 0.15, 0.85], uvs: 1 });
  return { spec, kind: 'bike', dims: { L, W: 0.8, H: 1.15 }, wheels, wheelStyle: 0, seat: { x: 0, y: rr + 0.6, z: rz * 0.4 + 0.05 }, doorX: 0.9, cl: 0.1, layers: { paint, trim, glass, head, tail, barR, barB, neon, signLit }, exhaust: { x: 0.1, y: 0.3, z: rz - 0.5 }, tailY: 0.6 };
}

// Hilfe: Lofting (Ringe entlang z)
function loft(mb, stations, seg, col, ref = null) {
  const rings = stations.map((s) => {
    const ring = [];
    for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; ring.push([Math.cos(a) * s.rx, s.cy + Math.sin(a) * s.ry * (Math.sin(a) < 0 ? (s.fl ?? 1) : 1), s.z]); }
    return ring;
  });
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < seg; i++) {
    const a = rings[k][i], b = rings[k][(i + 1) % seg], c = rings[k + 1][(i + 1) % seg], d = rings[k + 1][i];
    mb.quadO(a, b, c, d, col, [0, stations[k].cy, stations[k].z]);
  }
  // Endkappen
  for (const [idx, ring] of [[0, rings[0]], [rings.length - 1, rings[rings.length - 1]]]) {
    const s = stations[idx]; const c = [0, s.cy, s.z];
    for (let i = 0; i < seg; i++) mb.triO(ring[i], ring[(i + 1) % seg], c, col, [0, s.cy, stations[idx === 0 ? 1 : idx - 1].z]);
  }
}

// ---------------- Boote ----------------
function buildBoat(spec) {
  const paint = new MB(), trim = new MB(), glass = new MB(), head = new MB(), tail = new MB(), barR = new MB(), barB = new MB(), neon = new MB(), signLit = new MB();
  const L = spec.len, W = spec.wid, H = spec.hgt, sub = spec.sub, dk = [0.06, 0.07, 0.08];
  const white = [0.95, 0.96, 0.97];
  const jet = sub === 'jetski';
  const ST = 9;
  const hullY = jet ? 0.25 : 0.55, free = jet ? 0.45 : Math.min(1.6, H * 0.38);
  // Rumpf: Stationen von Heck (z=-L/2) bis Bug
  const sts = [];
  for (let i = 0; i <= ST; i++) {
    const t = i / ST, z = -L / 2 + L * t;
    const bow = t > 0.55 ? Math.pow((t - 0.55) / 0.45, 1.6) : 0;
    const hw = (W / 2) * (1 - bow * 0.92), deck = hullY + free + bow * 0.25;
    const keel = Math.max(-0.1, -hullY * 0.15) + bow * 0.5;
    sts.push({ z, hw, deck, keel, chine: hw * 0.8, chineY: 0.12 + bow * 0.5 });
  }
  const hullC = [0.95, 0.96, 0.98], hullBot = sub === 'cigar' ? [0.05, 0.2, 0.45] : [0.07, 0.12, 0.3];
  const ref = [0, hullY, 0];
  for (let k = 0; k < ST; k++) {
    const a = sts[k], b = sts[k + 1];
    // Seiten (oberhalb Chine) + Unterboden
    for (const sx of [-1, 1]) {
      paint.quadO([sx * a.hw, a.deck, a.z], [sx * b.hw, b.deck, b.z], [sx * b.chine, b.chineY, b.z], [sx * a.chine, a.chineY, a.z], hullC, ref);
      paint.quadO([sx * a.chine, a.chineY, a.z], [sx * b.chine, b.chineY, b.z], [0, b.keel, b.z], [0, a.keel, a.z], hullBot, ref);
    }
    // Deck
    paint.quadO([-a.hw, a.deck, a.z], [a.hw, a.deck, a.z], [b.hw, b.deck, b.z], [-b.hw, b.deck, b.z], [0.85, 0.82, 0.74], [0, -5, 0]);
  }
  // Heckspiegel
  const s0 = sts[0];
  paint.quadO([-s0.hw, s0.deck, s0.z], [s0.hw, s0.deck, s0.z], [s0.chine, s0.chineY, s0.z], [-s0.chine, s0.chineY, s0.z], hullC, [0, hullY, 5]);
  if (jet) {
    paint.box(0, hullY + free, -L * 0.1, W * 0.7, 0.3, L * 0.5, { col: 0xffffff, uvs: 1 });
    trim.box(0, hullY + free + 0.28, -L * 0.2, 0.3, 0.1, 0.7, { col: dk, uvs: 1 }); trim.box(0, hullY + free + 0.55, L * 0.12, 0.6, 0.06, 0.06, { col: dk, uvs: 1 });
    glass.box(0, hullY + free + 0.4, L * 0.15, 0.25, 0.3, 0.2, { col: [0.1, 0.15, 0.2], uvs: 1 });
  } else {
    const cabL = sub === 'dinghy' ? 0 : sub === 'mega' || sub === 'yacht' ? L * 0.45 : L * 0.32, cz = -L * (sub === 'fish' ? 0.05 : 0.1), by = hullY + free;
    if (cabL) {
      const ch = sub === 'mega' ? H - by - 0.4 : sub === 'yacht' ? 2.6 : sub === 'fish' ? 1.9 : 1.2;
      paint.box(0, by, cz, W * 0.76, ch, cabL, { col: white, uvs: 1 });
      glass.box(0, by + ch * 0.45, cz + cabL / 2 + 0.01, W * 0.7, ch * 0.4, 0.03, { col: [0.06, 0.09, 0.13], uvs: 1 });
      for (const sx of [-1, 1]) glass.box(sx * (W * 0.38 + 0.01), by + ch * 0.45, cz, 0.03, ch * 0.4, cabL * 0.85, { col: [0.06, 0.09, 0.13], uvs: 1 });
      paint.box(0, by + ch, cz, W * 0.82, 0.12, cabL + 0.4, { col: white, uvs: 1 });
      if (sub === 'mega' || sub === 'yacht') { paint.box(0, by + ch + 0.12, cz - cabL * 0.1, W * 0.6, ch * 0.7, cabL * 0.6, { col: white, uvs: 1 }); glass.box(0, by + ch + 0.5, cz - cabL * 0.1 + cabL * 0.3 + 0.01, W * 0.55, ch * 0.35, 0.03, { col: [0.06, 0.09, 0.13], uvs: 1 }); if (sub === 'mega') { paint.box(0, by + ch * 1.7 + 0.1, cz - cabL * 0.1, W * 0.45, ch * 0.5, cabL * 0.4, { col: white, uvs: 1 }); } }
      if (sub === 'sail') { trim.box(0, by, 0.5, 0.18, H * 3.6, 0.18, { col: [0.8, 0.8, 0.82], uvs: 1 }); paint.quadO([0, by + 1.2, -2.2], [0, by + 1.2, 0.2], [0, by + H * 3.2, 0.3], [0, by + H * 3.0, -2.4], [1, 1, 1], [3, 0, 0]); paint.quadO([0, by + 1.2, -2.2], [0, by + 1.2, 0.2], [0, by + H * 3.2, 0.3], [0, by + H * 3.0, -2.4], [1, 1, 1], [-3, 0, 0]); }
    }
    // Sitze/Steuerstand
    trim.box(W * 0.15, by, L * 0.1, 0.6, 0.5, 0.5, { col: [0.1, 0.1, 0.12], uvs: 1 });
    trim.box(W * 0.05, by + 0.4, L * 0.2, 0.9, 0.5, 0.06, { col: dk, uvs: 1 });
    if (sub === 'fish') { trim.box(0, by + 2.4, cz, 0.08, 1.5, 0.08, { col: [0.7, 0.7, 0.72], uvs: 1 }); trim.box(0, by + 3.9, cz, 0.08, 0.08, 0.08, { col: [0.7, 0.7, 0.72], uvs: 1 }); }
    if (sub === 'cigar' || sub === 'speed') for (const sx of [-1, 1]) neon.box(sx * (W * 0.5 - 0.05), hullY + 0.2, 0, 0.03, 0.03, L * 0.8, { col: sub === 'cigar' ? [0, 0.9, 1] : [0.2, 0.5, 1], uvs: 1 });
  }
  // Außenborder
  put(trim, CYL(8), 0, 0.4, -L / 2 - 0.2, 0, 0, 0, 0.14, 0.8, 0.14, dk);
  trim.box(0, 0.5, -L / 2 - 0.15, 0.25, 0.6, 0.2, { col: dk, uvs: 1 });
  head.box(0, hullY + free + 0.12, L / 2 * 0.62, 0.3, 0.08, 0.08, { col: [1, 0.97, 0.85], uvs: 1 });
  tail.box(0, hullY + free + 0.12, -L / 2 + 0.05, 0.3, 0.08, 0.05, { col: [1, 0.05, 0.05], uvs: 1 });
  const hy = hullY + free;
  return { spec, kind: 'boat', dims: { L, W, H }, wheels: [], seat: { x: W * 0.15, y: hy + 0.35, z: L * 0.08 }, doorX: W / 2 + 0.7, cl: 0, layers: { paint, trim, glass, head, tail, barR, barB, neon, signLit }, exhaust: { x: 0, y: 0.3, z: -L / 2 - 0.4 }, tailY: hy + 0.2, deckY: hy };
}

// ---------------- Flugzeuge ----------------
function buildPlane(spec) {
  const paint = new MB(), trim = new MB(), glass = new MB(), head = new MB(), tail = new MB(), barR = new MB(), barB = new MB(), neon = new MB(), signLit = new MB();
  const L = spec.len, WS = spec.wid, sub = spec.sub, jet = sub === 'jet', dk = [0.08, 0.08, 0.09], white = [0.96, 0.96, 0.98];
  const r = jet ? 0.95 : sub === 'cargo' ? 1.15 : 0.62, cy = r + 0.35;
  const stations = jet
    ? [{ z: -L / 2, rx: 0.15, ry: 0.15, cy }, { z: -L * 0.32, rx: r * 0.7, ry: r * 0.75, cy }, { z: -L * 0.1, rx: r, ry: r, cy }, { z: L * 0.2, rx: r, ry: r, cy }, { z: L * 0.4, rx: r * 0.6, ry: r * 0.6, cy: cy - 0.1 }, { z: L / 2, rx: 0.08, ry: 0.08, cy: cy - 0.18 }]
    : [{ z: -L / 2, rx: 0.12, ry: 0.12, cy: cy + 0.2 }, { z: -L * 0.38, rx: r * 0.35, ry: r * 0.4, cy: cy + 0.15 }, { z: -L * 0.15, rx: r * 0.85, ry: r * 0.9, cy }, { z: L * 0.1, rx: r, ry: r, cy }, { z: L * 0.36, rx: r * 0.85, ry: r * 0.85, cy: cy - 0.05 }, { z: L / 2, rx: r * 0.5, ry: r * 0.5, cy: cy - 0.08 }];
  loft(paint, stations, 10, [1, 1, 1]);
  // Cockpit-Glas
  const gz = jet ? L * 0.3 : L * 0.2;
  glass.box(0, cy + r * 0.45, gz, r * 1.3, r * 0.6, L * 0.2, { col: [0.1, 0.14, 0.2], uvs: 1 });
  // Tragflächen
  const wy = jet ? cy - 0.2 : cy + (sub === 'sea' || sub === 'cargo' ? r * 0.9 : -r * 0.2);
  const chord = jet ? 2.3 : 1.6;
  for (const sx of [-1, 1]) {
    const pts = [[sx * r * 0.8, wy, -chord / 2 + (jet ? -0.5 : 0)], [sx * WS / 2, wy + 0.2, -chord / 2 + (jet ? -2.2 : 0.2)], [sx * WS / 2, wy + 0.2, chord / 2 * (jet ? 0.2 : 0.4)], [sx * r * 0.8, wy, chord / 2 + (jet ? 0.6 : 0.2)]];
    paint.quadO(pts[0], pts[1], pts[2], pts[3], [0.9, 0.92, 0.95], [0, wy - 3, 0]); paint.quadO(pts[0], pts[1], pts[2], pts[3], [0.8, 0.82, 0.85], [0, wy + 3, 0]);
    trim.box(sx * WS / 2, wy + 0.1, jet ? -L * 0.0 - 1.4 : 0.3, 0.12, 0.3, 0.5, { col: dk, uvs: 1 });
    if (!jet) neon.box(sx * WS / 2, wy + 0.2, 0.15, 0.1, 0.06, 0.1, { col: sx > 0 ? [0.1, 1, 0.2] : [1, 0.1, 0.1], uvs: 1 });
  }
  // Leitwerk
  const ty = cy + (jet ? 0.5 : 0.25);
  paint.box(0, ty, -L / 2 + 0.7, 0.14, r * (jet ? 3 : 2.2), 1.5, { col: white, uvs: 1 });
  for (const sx of [-1, 1]) paint.box(sx * (jet ? 2.4 : 1.7), ty + (jet ? 2.5 : 0.1), -L / 2 + 0.65, jet ? 2.6 : 2.2, 0.12, 1.0, { col: white, uvs: 1 });
  if (jet) for (const sx of [-1, 1]) { put(trim, CYL(12), sx * 1.3, cy + 0.2, -L / 2 + 1.6, Math.PI / 2, 0, 0, 0.55, 2.8, 0.55, [0.7, 0.72, 0.76]); }
  // Streifen
  trim.box(0, cy + 0.02, 0, r * 2.02, 0.12, L * 0.5, { col: sub === 'stunt' ? [1, 0.2, 0.1] : [0.1, 0.3, 0.7], uvs: 1 });
  // Fahrwerk
  const wheels = [];
  const wr = spec.tire || 0.24;
  const gearX = jet ? 1.5 : 1.3, gearZ = jet ? 0.5 : L * 0.1;
  if (sub === 'sea') { for (const sx of [-1, 1]) { put(paint, CYL(10), sx * 1.3, 0.5, 0.2, Math.PI / 2, 0, 0, 0.3, L * 0.55, 0.3, white); trim.box(sx * 1.3, 0.7, 0.2, 0.1, 0.9, 0.2, { col: dk, uvs: 1 }); } }
  else {
    for (const sx of [-1, 1]) { wheels.push({ x: sx * gearX, y: wr, z: gearZ - 1.1, r: wr, w: 0.14, steer: false, side: sx }); trim.box(sx * gearX * 0.75, wr + 0.4, gearZ - 1.1, 0.06, 0.8, 0.06, { col: dk, uvs: 1 }); }
    wheels.push({ x: 0, y: wr * 0.8, z: L * 0.33, r: wr * 0.8, w: 0.12, steer: true }); trim.box(0, wr + 0.45, L * 0.33, 0.06, 0.7, 0.06, { col: dk, uvs: 1 });
  }
  head.box(0, cy - 0.1, L / 2 - 0.1, 0.3, 0.12, 0.06, { col: [1, 0.97, 0.85], uvs: 1 });
  tail.box(0, ty + 0.1, -L / 2 + 0.05, 0.14, 0.14, 0.06, { col: [1, 0.05, 0.05], uvs: 1 });
  const extra = [];
  if (!jet) extra.push({ type: 'prop', pos: [0, cy - 0.05, L / 2 + (sub === 'cargo' ? 0 : 0.15)], r: sub === 'cargo' ? 1.5 : 1.15, blades: sub === 'cargo' ? 4 : 2 });
  return { spec, kind: 'plane', dims: { L, W: WS, H: spec.hgt }, wheels, wheelStyle: 2, seat: { x: 0.35, y: cy + 0.1, z: gz - 0.5 }, doorX: r + 0.9, cl: 0, layers: { paint, trim, glass, head, tail, barR, barB, neon, signLit }, exhaust: { x: 0, y: cy, z: -L / 2 }, tailY: ty, extra, groundY: wr, cy };
}

// ---------------- Helikopter ----------------
function buildHeli(spec) {
  const paint = new MB(), trim = new MB(), glass = new MB(), head = new MB(), tail = new MB(), barR = new MB(), barB = new MB(), neon = new MB(), signLit = new MB();
  const L = spec.len, sub = spec.sub, dk = [0.08, 0.08, 0.09], mil = sub === 'military';
  const big = mil ? 1.3 : 1;
  const cy = 1.3 * big;
  paint.blob(0, cy, 0.8, 1.15 * big, 1.05 * big, 2.1 * big, [1, 1, 1], 12, 8);
  glass.blob(0, cy + 0.15, 1.6 * big, 1.05 * big, 0.85 * big, 1.3 * big, [1, 1, 1], 12, 8);
  paint.box(0, cy - 0.1, -L * 0.3, 0.28, 0.35, L * 0.5, { col: 0xffffff, uvs: 1 });
  paint.box(0, cy - 0.05, -L * 0.5, 0.12, 1.3, 0.8, { col: 0xffffff, uvs: 1 });
  paint.box(0, cy + 0.05, -L * 0.5 + 0.1, 1.6, 0.1, 0.5, { col: 0xffffff, uvs: 1 });
  for (const sx of [-1, 1]) { trim.box(sx * 1.0 * big, 0.12, 0.6, 0.08, 0.1, 3.2 * big, { col: dk, uvs: 1 }); for (const zz of [-0.1, 1.5]) trim.box(sx * 0.9 * big, 0.15, zz * big, 0.06, cy - 0.3, 0.06, { col: dk, uvs: 1 }); }
  trim.cyl(0, cy + 1.0 * big, 0.6, 0.12, 0.5, 6, dk);
  if (sub === 'police') { barR.box(-0.3, cy - 1.0, 1.4, 0.2, 0.14, 0.3, { col: [1, 0.05, 0.05], uvs: 1 }); barB.box(0.3, cy - 1.0, 1.4, 0.2, 0.14, 0.3, { col: [0.1, 0.2, 1], uvs: 1 }); }
  if (mil) { trim.box(0, cy - 0.3, 3.0, 0.2, 0.2, 1.4, { col: [0.1, 0.1, 0.1], uvs: 1 }); }
  if (sub === 'news') trim.box(0, cy + 0.9, 1.8, 0.3, 0.3, 0.5, { col: dk, uvs: 1 });
  head.box(0, cy - 0.5, 2.8 * big, 0.3, 0.12, 0.08, { col: [1, 0.97, 0.85], uvs: 1 });
  tail.box(0, cy + 0.6, -L * 0.5 - 0.35, 0.12, 0.12, 0.06, { col: [1, 0.05, 0.05], uvs: 1 });
  const extra = [{ type: 'rotor', pos: [0, cy + 1.3 * big, 0.6], r: L * 0.55 * (mil ? 1.1 : 1), blades: mil ? 4 : 2 }, { type: 'tailrotor', pos: [0.15, cy + 0.05, -L * 0.5 - 0.1], r: 0.7 }];
  return { spec, kind: 'heli', dims: { L, W: 2.4, H: spec.hgt }, wheels: [], seat: { x: 0.4, y: cy - 0.2, z: 1.5 * big }, doorX: 1.7, cl: 0, layers: { paint, trim, glass, head, tail, barR, barB, neon, signLit }, exhaust: { x: 0, y: cy, z: -L / 2 }, tailY: cy, extra, cy };
}

function buildSkyYacht(spec) {
  const m = buildBoat({ ...spec, kind: 'boat', sub: 'mega', body: 'boat', key: spec.key + '_hull' });
  // Rotoren an den vier Ecken (spezielles Avocado-Design)
  const extra = [], L = spec.len, W = spec.wid, y = (m.deckY || 3) + 6.5;
  for (const [x, z] of [[-W * 0.9, L * 0.32], [W * 0.9, L * 0.32], [-W * 0.9, -L * 0.28], [W * 0.9, -L * 0.28]]) extra.push({ type: 'rotor', pos: [x, y, z], r: 7.5, blades: 3 });
  // Tragarme + grüne Avocado-Zierstreifen
  const trim = m.layers.trim, paint = m.layers.paint;
  for (const [x, z] of [[-W * 0.9, L * 0.32], [W * 0.9, L * 0.32], [-W * 0.9, -L * 0.28], [W * 0.9, -L * 0.28]]) { trim.box(x * 0.55, y - 3, z, Math.abs(x) * 1.1, 0.5, 0.7, { col: [0.1, 0.12, 0.1], uvs: 1 }); trim.box(x, y - 6, z, 0.9, 6, 0.9, { col: [0.1, 0.12, 0.1], uvs: 1 }); }
  m.layers.neon.box(0, 1.2, 0, W * 0.95, 0.1, L * 0.95, { col: [0.2, 1, 0.4], uvs: 1 });
  return { ...m, spec, kind: 'heli', extra, seat: { x: 0.8, y: (m.deckY || 3) + 4.2, z: L * 0.12 }, doorX: W / 2 + 1.2, cl: 0 };
}

const cache = new Map();
export function getModel(spec) {
  let m = cache.get(spec.key);
  if (m) return m;
  const k = spec.kind;
  m = spec.body === 'skyyacht' ? buildSkyYacht(spec) : k === 'car' ? buildCar(spec) : k === 'bike' ? buildBike(spec) : k === 'boat' ? buildBoat(spec) : k === 'plane' ? buildPlane(spec) : buildHeli(spec);
  m.geos = {};
  for (const [name, mb] of Object.entries(m.layers)) if (mb.count) m.geos[name] = mb.build();
  m.layers = null;
  cache.set(spec.key, m);
  return m;
}
