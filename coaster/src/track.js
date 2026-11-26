// ============================================================================
//  track.js – Streckengeometrie aus einer kompakten Layout-Sprache (DSL)
//  Reine Mathematik (kein DOM / kein three.js) -> läuft auch in Node (Validierung)
//
//  Koordinaten: x = Ost, y = oben, z = Süd. Fahrtrichtung am Start: +x.
//  Winkel: th = Neigung (Pitch), psi = Kurs (+ = Rechtskurve), phi = Querneigung.
//
//  DSL-Elemente (Zahlen in Metern / Grad, Trennzeichen: Leerzeichen, Komma, Zeilenumbruch):
//    ST[:L]                      Station
//    S:L                         Gerade
//    LIFT:H[:A[:V]]              Kettenlift, H Höhe, A Winkel (°), V m/s
//    CLIMB:H[:A[:R]]             freier Anstieg
//    DROP:H[:A[:Rout[:Rin]]]     Abfahrt
//    PIT:A[:R]                   Neigung auf A° bringen
//    HILL:h:L                    Airtime-Hügel (h<0 = Senke)
//    TR|TL:deg:R[:bank]          Kurve rechts/links
//    HELR|HELL:turns:R:bank:dh   Helix (dh = Höhenverlust)
//    LOOP:H[:dir]                Looping (Tropfenform)
//    CORK:L:R[:dir]              Korkenzieher
//    BARREL:L:h[:dir]            Fassrolle / Zero-G-Roll
//    IMM:H  /  DIVE:H            Immelmann / Dive-Loop (drehen die Fahrtrichtung um)
//    COBRA:H                     Immelmann + Dive-Loop (Richtung bleibt gleich)
//    TOPHAT:H[:R]                Senkrechter Top-Hat
//    LAUNCH:L:V[:A]              Katapult (V km/h)
//    BRAKE:L[:V]                 Bremsstrecke (V m/s)
//    DRV:V                       Reifenantrieb mit V m/s für alle folgenden Elemente (DRV:0 = aus)
//    ROLL:bank[:L]               Querneigung ändern
//    HOME[:bank[:brake]]         Rückfahrt: Gerade, Wendekurve, Bremse (Kurs muss nach Westen zeigen)
//  Am Ende wird die Strecke automatisch zur Station zurückgeführt (Hermite-Verbinder).
// ============================================================================

export const PI = Math.PI, TAU = Math.PI * 2, D2R = Math.PI / 180, G = 9.81;
export const ZONE = { NORMAL: 0, STATION: 1, LIFT: 2, LAUNCH: 3, BRAKE: 4, DRIVE: 5 };

const sstep = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function frameOf(th, psi, phi) {
  const ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(psi), sp = Math.sin(psi);
  const f = [ct * cp, st, ct * sp];
  const u0 = [-st * cp, ct, -st * sp];
  const r0 = [f[1] * u0[2] - f[2] * u0[1], f[2] * u0[0] - f[0] * u0[2], f[0] * u0[1] - f[1] * u0[0]];
  const c = Math.cos(phi), s = Math.sin(phi);
  return {
    f,
    u: [u0[0] * c + r0[0] * s, u0[1] * c + r0[1] * s, u0[2] * c + r0[2] * s],
    r: [r0[0] * c - u0[0] * s, r0[1] * c - u0[1] * s, r0[2] * c - u0[2] * s],
  };
}

// Tabelle für Bögen mit veränderlichem Radius: Winkel th0..th1, Radius r(t)
function arcTable(th0, th1, rFn, N = 360) {
  const cum = [0], dth = (th1 - th0) / N;
  let gain = [0];
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N, ds = Math.abs(dth) * rFn(t);
    cum.push(cum[i] + ds);
    gain.push(gain[i] + Math.sin(th0 + dth * (i + 0.5)) * ds);
  }
  return { cum, gain, N, th0, th1, L: cum[N] };
}
function tableAt(tb, s) {
  s = clamp(s, 0, tb.L);
  let lo = 0, hi = tb.N;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tb.cum[m] <= s) lo = m; else hi = m; }
  const seg = tb.cum[hi] - tb.cum[lo] || 1e-9;
  const t = (lo + (s - tb.cum[lo]) / seg) / tb.N;
  return t;
}
function scaledTable(th0, th1, rFn, targetGain, atFrac = 1) {
  // skaliert den Radius so, dass die Höhenänderung (bis atFrac) = targetGain
  const t1 = arcTable(th0, th1, rFn);
  const idx = Math.round(t1.N * atFrac);
  const g = t1.gain[idx] || 1;
  const k = targetGain / g;
  return arcTable(th0, th1, t => rFn(t) * k);
}
// Höhengewinn eines S-förmigen Neigungsübergangs
function easeGain(a0, a1, L) {
  let g = 0; const n = 60;
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; g += Math.sin(a0 + (a1 - a0) * sstep(t)) * L / n; }
  return g;
}

export class Builder {
  constructor(opts = {}) {
    this.trainLen = opts.trainLen || 20;
    this.ds = 1.0;
    this.x = 0; this.y = 0; this.z = 0;
    this.th = 0; this.psi = 0; this.phi = 0;
    this.s = 0;
    this.pts = []; // [x,y,z,th,psi,phi,zone,zv,za,(frame optional)]
    this.pts.push([0, 0, 0, 0, 0, 0, ZONE.STATION, 3.5, 0]);
    this.stationLen = 0;
    this.warn = [];
    this.invCount = 0;
    this.log = [];
  }

  seg(L, fn, zone = 0, zv = 0, za = 0) {
    if (!(L > 0.05)) return;
    if (!zone && this.curZone) { zone = this.curZone; zv = this.curZv; }
    const n = Math.max(1, Math.round(L / this.ds)), h = L / n;
    let last = fn(0);
    for (let i = 1; i <= n; i++) {
      const mid = fn((i - 0.5) * h);
      const c = Math.cos(mid[0]);
      this.x += h * c * Math.cos(mid[1]);
      this.y += h * Math.sin(mid[0]);
      this.z += h * c * Math.sin(mid[1]);
      last = fn(i * h);
      this.pts.push([this.x, this.y, this.z, last[0], last[1], last[2], zone, zv, za]);
    }
    this.th = last[0]; this.psi = last[1]; this.phi = last[2];
    this.s += L;
    this.norm();
  }

  // Winkel so normalisieren, dass |th| <= 90°
  norm() {
    let { th, psi, phi } = this;
    while (th > PI) th -= TAU; while (th <= -PI) th += TAU;
    if (Math.abs(th) > PI / 2 + 1e-6) { th = PI - th; psi += PI; phi += PI; if (th > PI) th -= TAU; }
    while (phi > PI) phi -= TAU; while (phi <= -PI) phi += TAU;
    while (psi > 2 * TAU) psi -= TAU; while (psi < -2 * TAU) psi += TAU;
    this.th = th; this.psi = psi; this.phi = phi;
  }

  straight(L, zone = 0, zv = 0, za = 0) {
    const { th, psi, phi } = this;
    this.seg(L, () => [th, psi, phi], zone, zv, za);
  }
  straightDy(dy) { const s = Math.sin(this.th); if (Math.abs(s) > 0.02) this.straight(Math.abs(dy / s)); }

  pitchTo(th1, R = 25, zone = 0, zv = 0, za = 0) {
    const { th: th0, psi, phi } = this;
    const L = Math.abs(th1 - th0) * R;
    this.seg(L, s => [th0 + (th1 - th0) * sstep(s / L), psi, phi], zone, zv, za);
  }

  rollTo(phi1, L = 20, zone = 0, zv = 0, za = 0) {
    const { th, psi, phi: p0 } = this;
    this.seg(L, s => [th, psi, p0 + (phi1 - p0) * sstep(s / L)], zone, zv, za);
  }

  climb(H, A, R, zone = 0, zv = 0, flat = 0) {
    A *= D2R;
    R = R || clamp(H * 0.35, 12, 45);
    let g = 2 * easeGain(0, A, A * R), it = 0;
    while (g > H * 0.98 && it++ < 40) { R *= 0.85; if (R < 4) { A *= 0.9; } g = 2 * easeGain(0, A, A * R); }
    this.pitchTo(A, R, zone, zv);
    this.straight(Math.max(0, (H - g) / Math.sin(A)), zone, zv);
    this.pitchTo(0, R, zone, zv);
    if (flat) this.straight(flat, zone, zv);
  }

  drop(H, A, Rout, Rin) {
    A *= D2R;
    Rout = Rout || clamp(H * 0.8, 16, 110);
    Rin = Rin || clamp(H * 0.5, 12, 60);
    const gin = () => easeGain(this.th, -A, A * Rin), gout = () => -easeGain(-A, 0, A * Rout);
    let it = 0;
    while (Math.abs(gin()) + gout() > H * 0.98 && it++ < 40) { Rin *= 0.85; Rout *= 0.85; if (Rout < 4) A *= 0.92; }
    const gi = Math.abs(easeGain(0, -A, A * Rin)), go = -easeGain(-A, 0, A * Rout);
    this.pitchTo(-A, Rin);
    this.straight(Math.max(0, (H - gi - go) / Math.sin(A)));
    this.pitchTo(0, Rout);
  }

  hill(h, L) {
    const { th, psi, phi } = this;
    const A = Math.PI * h / L;
    this.seg(L, s => [th + A * Math.sin(TAU * s / L), psi, phi]);
  }

  turn(deg, R, bank = 30, minLen = 0) {
    const { th, psi, phi } = this;
    const dpsi = deg * D2R, sg = Math.sign(dpsi) || 1;
    const bk = sg * Math.abs(bank) * D2R * (bank < 0 ? -1 : 1);
    const q = 0.22;
    const prof = u => sstep(u / q) * sstep((1 - u) / q);
    // Krümmungsgewichte
    const N = 200, cum = [0];
    for (let i = 0; i < N; i++) cum.push(cum[i] + prof((i + 0.5) / N) / N);
    const avg = cum[N];
    const L = Math.max(minLen, Math.abs(dpsi) * R / avg);
    this.seg(L, s => {
      const u = s / L, k = clamp(u * N, 0, N), i = Math.min(N - 1, Math.floor(k));
      const c = (cum[i] + (cum[i + 1] - cum[i]) * (k - i)) / avg;
      return [th, psi + dpsi * c, phi + (bk - phi) * prof(u)];
    });
  }

  helix(turns, R, bank, dh, sign) {
    const { th, psi, phi } = this;
    const dpsi = sign * turns * TAU;
    const q = 0.12, prof = u => sstep(u / q) * sstep((1 - u) / q);
    const N = 400, cum = [0];
    for (let i = 0; i < N; i++) cum.push(cum[i] + prof((i + 0.5) / N) / N);
    const avg = cum[N];
    const L = Math.abs(dpsi) * R / avg;
    const bk = sign * Math.abs(bank) * D2R;
    // Neigung so wählen, dass Höhenverlust ≈ dh
    const pr = u => sstep(u / 0.1) * sstep((1 - u) / 0.1);
    let thh = -Math.asin(clamp(Math.abs(dh) / (L * 0.9), 0, 0.5));
    if (dh < 0) thh = Math.abs(thh) ; // dh<0 = Anstieg
    this.seg(L, s => {
      const u = s / L, k = clamp(u * N, 0, N), i = Math.min(N - 1, Math.floor(k));
      const c = (cum[i] + (cum[i + 1] - cum[i]) * (k - i)) / avg;
      return [th + thh * pr(u), psi + dpsi * c, phi + (bk - phi) * prof(u)];
    });
  }

  loop(H, dir = 1) {
    const { th, psi, phi } = this;
    const rFn = t => 1 + 1.2 * (1 + Math.cos(TAU * t)) / 2 * 0.9 - 0.0; // Re/Rt ≈ 2.1
    let tb = arcTable(0, TAU, rFn);
    const half = tb.gain[tb.N / 2];
    const k = H / half;
    tb = arcTable(0, TAU, t => rFn(t) * k);
    const L = tb.L, a = (3.6 / (0.637 * L)) * dir;
    this.seg(L, s => {
      const t = tableAt(tb, s);
      return [th + TAU * t, psi + a * Math.sin(PI * s / L), phi];
    });
    this.invCount++;
  }

  // Halbloop nach oben + Halbrolle (Richtungsumkehr)
  imm(H, dir = 1) {
    const { th, psi, phi } = this;
    const rFn = t => 1 + 1.2 * (1 + Math.cos(PI * t)) / 2;
    let tb = arcTable(0, PI, rFn);
    const k = H / tb.gain[tb.N];
    tb = arcTable(0, PI, t => rFn(t) * k);
    const L = tb.L;
    this.seg(L, s => [th + PI * tableAt(tb, s), psi, phi]);
    // Halbrolle während leichtem Sinkflug
    const L2 = 28, dive = 24 * D2R, th2 = this.th, psi2 = this.psi, phi2 = this.phi;
    this.seg(L2, s => { const u = sstep(s / L2); return [th2 - dive * u, psi2 + dir * 0.35 * u * 0, phi2 + PI * u * dir]; });
    this.invCount++;
  }

  dive(H, dir = 1) {
    const L1 = 26, th1 = -22 * D2R;
    const { th, psi, phi } = this;
    this.seg(L1, s => { const u = sstep(s / L1); return [th + th1 * u, psi, phi + PI * u * dir]; });
    const th2 = this.th, psi2 = this.psi, phi2 = this.phi;
    const rFn = t => 1 + 0.7 * t;
    // Dive-Loop: von th2 nach -PI (relativ zur normierten Lage)
    let tb = arcTable(th2, -PI, rFn);
    // Höhenverlust bis th = -PI/2 ... Gesamt = H
    const gAll = Math.abs(tb.gain[tb.N]);
    const k = H / (gAll || 1);
    tb = arcTable(th2, -PI, t => rFn(t) * k);
    const L = tb.L;
    this.seg(L, s => [th2 + (-PI - th2) * tableAt(tb, s), psi2, phi2]);
    this.invCount++;
  }

  cork(L, R, dir = 1) {
    const { th, psi, phi } = this;
    const alpha = Math.atan(TAU * R / L);
    this.seg(L, s => {
      const u = s / L, b = TAU * u, e = sstep(u / 0.2) * sstep((1 - u) / 0.2);
      return [th + alpha * e * Math.sin(b), psi - dir * alpha * e * Math.cos(b), phi + dir * b];
    });
    this.invCount++;
  }

  barrel(L, h, dir = 1) {
    const { th, psi, phi } = this;
    const A = Math.PI * h / L;
    this.seg(L, s => {
      const u = s / L;
      return [th + A * Math.sin(TAU * u), psi + dir * 0.05 * Math.sin(PI * u) , phi + dir * TAU * sstep(u)];
    });
    this.invCount++;
  }

  tophat(H, R = 14) {
    const R1 = Math.max(R, 18), Rt = clamp(R * 0.25, 6, 16);
    // aufwärts 0 -> 90°
    const y0 = this.y;
    this.pitchTo(PI / 2, R1);
    const gUp = this.y - y0;
    // oben: 90° -> 270°
    const top = arcTable(PI / 2, 3 * PI / 2, () => Rt);
    const gTop = top.gain[top.N];
    // unten: 270° -> 360° (gleiche S-Rundung wie oben)
    const Lb = (PI / 2) * R1;
    let gBot = 0;
    for (let i = 0; i < 200; i++) gBot += Math.sin(3 * PI / 2 + (PI / 2) * sstep((i + 0.5) / 200)) * Lb / 200;
    const Lu = Math.max(2, H - gUp - Rt);
    this.straight(Lu);
    const { psi, phi } = this;
    this.seg(top.L, s => [PI / 2 + PI * tableAt(top, s), psi, phi]);
    const Ld = Math.max(2, gUp + Lu + gTop + gBot);
    this.straight(Ld);
    const { psi: p2, phi: f2 } = this;
    this.seg(Lb, s => [3 * PI / 2 + (PI / 2) * sstep(s / Lb), p2, f2]);
  }

  apply(tok) {
    const s0 = this.s;
    this.apply1(tok);
    this.log.push([tok, s0, this.s]);
  }

  apply1(tok) {
    const [name, ...a] = tok.split(':');
    const n = a.map(Number);
    const N = (i, d) => (n[i] === undefined || Number.isNaN(n[i]) ? d : n[i]);
    switch (name.toUpperCase()) {
      case 'ST': {
        const L = N(0, 0) || (this.trainLen + 10);
        this.stationLen = L;
        this.straight(L, ZONE.STATION, 3.5);
        break;
      }
      case 'S': this.straight(N(0, 10)); break;
      case 'DRV': this.curZone = N(0, 0) > 0 ? ZONE.DRIVE : 0; this.curZv = N(0, 0); break; // Reifenantrieb (Darkrides, Wasserfahrten)
      case 'LIFT': this.climb(N(0, 30), N(1, 30), 0, ZONE.LIFT, N(2, 3.2), 4); break;
      case 'CLIMB': this.climb(N(0, 20), N(1, 30), N(2, 0)); break;
      case 'DROP': this.drop(N(0, 20), N(1, 55), N(2, 0), N(3, 0)); break;
      case 'PIT': this.pitchTo(N(0, 0) * D2R, N(1, 25)); break;
      case 'HILL': this.hill(N(0, 8), N(1, 70)); break;
      case 'TR': this.turn(N(0, 90), N(1, 40), N(2, 30)); break;
      case 'TL': this.turn(-N(0, 90), N(1, 40), N(2, 30)); break;
      case 'HELR': this.helix(N(0, 1), N(1, 25), N(2, 45), N(3, 8), 1); break;
      case 'HELL': this.helix(N(0, 1), N(1, 25), N(2, 45), N(3, 8), -1); break;
      case 'LOOP': this.loop(N(0, 25), N(1, 1)); break;
      case 'CORK': this.cork(N(0, 50), N(1, 6), N(2, 1)); break;
      case 'BARREL': this.barrel(N(0, 50), N(1, 6), N(2, 1)); break;
      case 'IMM': this.imm(N(0, 25), N(1, 1)); break;
      case 'DIVE': this.dive(N(0, 25), N(1, 1)); break;
      case 'COBRA': this.imm(N(0, 24), 1); this.pitchTo(0, 18); this.straight(6); this.dive(Math.max(8, this.y - 4.9), 1); this.pitchTo(0, 22); break;
      case 'TOPHAT': this.tophat(N(0, 60), N(1, 14)); break;
      case 'LAUNCH': {
        const L = N(0, 40), v = N(1, 90) / 3.6;
        if (N(2, 0)) this.pitchTo(N(2, 0) * D2R, 30);
        this.straight(L, ZONE.LAUNCH, v, v * v / (2 * L) * 1.08);
        break;
      }
      case 'BRAKE': this.straight(N(0, 20), ZONE.BRAKE, N(1, 4)); break;
      case 'ROLL': this.rollTo(N(0, 0) * D2R, N(1, 20)); break;
      case 'HOME': { // Rückweg: Gerade bis hinter die Station, Wendekurve rechts, Bremsstrecke
        const bank = N(0, 45), brake = N(1, 30);
        const xb = -26 - 0.15 * Math.max(10, this.z / 2);
        if (this.x - xb > 1) this.straight(this.x - xb);
        const Rr = Math.max(14, this.z / 2);
        this.turn(180, Rr, bank);
        this.straight(brake, ZONE.BRAKE, 5);
        break;
      }
      default: this.warn.push('Unbekanntes Element: ' + tok);
    }
  }

  applyAll(str) {
    for (const t of tokenize(str)) this.apply(t);
  }
}

export function tokenize(str) {
  return String(str).replace(/#[^\n]*/g, ' ').split(/[\s,;]+/).filter(Boolean);
}

// ---------------------------------------------------------------------------
//  Abschluss: Strecke schließen, gleichmäßig neu abtasten, Frames berechnen
// ---------------------------------------------------------------------------
export function buildTrack(layout, opts = {}) {
  const b = new Builder(opts);
  // Start-Station
  const toks = tokenize(layout);
  if (!toks.length || toks[0].split(':')[0].toUpperCase() !== 'ST') toks.unshift('ST');
  for (const t of toks) b.apply(t);

  // Ausrichten
  if (Math.abs(b.th) > 0.01) b.pitchTo(0, 30);
  if (Math.abs(b.phi) > 0.01) b.rollTo(0, 16);

  // Hermite-Verbinder zurück zum Ursprung (Start-Station, Kurs +x)
  const dense = b.pts.map(p => p.slice());
  const endP = [b.x, b.y, b.z];
  const chord = Math.hypot(endP[0], endP[1], endP[2]);
  const dirEnd = frameOf(b.th, b.psi, 0).f;
  const headErr = Math.abs(((b.psi % TAU) + TAU + PI) % TAU - PI);
  let connLen = 0;
  if (chord > 2 || headErr > 0.05) {
    const k = clamp(chord * 1.1, 14, 600);
    const T0 = dirEnd.map(v => v * k), T1 = [k, 0, 0];
    const P0 = endP, P1 = [0, 0, 0];
    const H = t => {
      const t2 = t * t, t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      return [0, 1, 2].map(i => h00 * P0[i] + h10 * T0[i] + h01 * P1[i] + h11 * T1[i]);
    };
    const M = 400, pts = [];
    for (let i = 0; i <= M; i++) pts.push(H(i / M));
    const cum = [0];
    for (let i = 1; i <= M; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
    connLen = cum[M];
    const n = Math.max(2, Math.round(connLen / 1.0));
    let j = 0;
    for (let i = 1; i < n; i++) { // letzten Punkt (= Start) auslassen
      const s = connLen * i / n;
      while (cum[j + 1] < s) j++;
      const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
      const p = [0, 1, 2].map(c => pts[j][c] + (pts[j + 1][c] - pts[j][c]) * f);
      dense.push([p[0], p[1], p[2], NaN, NaN, 0, ZONE.DRIVE, 5, 0]);
    }
  }
  return finalize(dense, b, connLen, opts);
}

function finalize(dense, b, connLen, opts) {
  // dichte Punkte -> Frames
  const n0 = dense.length;
  const pos = new Array(n0), th = new Array(n0), psi = new Array(n0), phi = new Array(n0);
  for (let i = 0; i < n0; i++) { pos[i] = [dense[i][0], dense[i][1], dense[i][2]]; }
  // Verbinder: Winkel aus Tangente
  for (let i = 0; i < n0; i++) {
    const d = dense[i];
    if (Number.isNaN(d[3])) {
      const a = pos[(i + n0 - 1) % n0], c = pos[(i + 1) % n0];
      const t = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], l = Math.hypot(...t) || 1;
      d[3] = Math.asin(clamp(t[1] / l, -1, 1));
      d[4] = Math.atan2(t[2], t[0]);
    }
  }
  // psi entfalten
  let off = 0;
  for (let i = 0; i < n0; i++) {
    if (Number.isNaN(dense[i][3])) continue;
    th[i] = dense[i][3]; psi[i] = dense[i][4]; phi[i] = dense[i][5];
  }
  // Verbinder-Querneigung: aus Kurvenkrümmung
  const conn0 = n0 - Math.round(connLen) ;
  const frames = new Array(n0);
  for (let i = 0; i < n0; i++) {
    let bank = phi[i];
    if (dense[i][6] === ZONE.DRIVE && i >= 1 && i < n0 - 1) {
      let dp = psi[Math.min(n0 - 1, i + 2)] - psi[Math.max(0, i - 2)];
      while (dp > PI) dp -= TAU; while (dp < -PI) dp += TAU;
      bank = clamp(dp / 4 * 28, -0.5, 0.5);
    }
    frames[i] = frameOf(th[i], psi[i], bank);
  }
  // kumulative Länge (geschlossen)
  const cum = [0];
  for (let i = 1; i <= n0; i++) {
    const a = pos[i - 1], c = pos[i % n0];
    cum.push(cum[i - 1] + Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
  }
  const L = cum[n0];
  const N = Math.max(8, Math.round(L)), ds = L / N;
  const P = new Float32Array(N * 3), U = new Float32Array(N * 3), Fd = new Float32Array(N * 3);
  const zone = new Uint8Array(N), zv = new Float32Array(N), za = new Float32Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) {
    const s = i * ds;
    while (j < n0 - 1 && cum[j + 1] <= s) j++;
    const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    const a = j, c = (j + 1) % n0;
    for (let k = 0; k < 3; k++) {
      P[i * 3 + k] = pos[a][k] + (pos[c][k] - pos[a][k]) * f;
      U[i * 3 + k] = frames[a].u[k] + (frames[c].u[k] - frames[a].u[k]) * f;
      Fd[i * 3 + k] = frames[a].f[k] + (frames[c].f[k] - frames[a].f[k]) * f;
    }
    const d = dense[f < 0.5 ? a : c];
    zone[i] = d[6]; zv[i] = d[7]; za[i] = d[8];
  }
  // Tangente aus Positionen (zentrale Differenz), Frame orthonormieren
  const T = new Float32Array(N * 3), R = new Float32Array(N * 3), K = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = (i + N - 1) % N, c = (i + 1) % N;
    let tx = P[c * 3] - P[a * 3], ty = P[c * 3 + 1] - P[a * 3 + 1], tz = P[c * 3 + 2] - P[a * 3 + 2];
    const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
    T[i * 3] = tx; T[i * 3 + 1] = ty; T[i * 3 + 2] = tz;
  }
  // Tangente leicht glätten (3-Punkt)
  const T2 = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = (i + N - 1) % N, c = (i + 1) % N;
    let x = T[a * 3] + 2 * T[i * 3] + T[c * 3], y = T[a * 3 + 1] + 2 * T[i * 3 + 1] + T[c * 3 + 1], z = T[a * 3 + 2] + 2 * T[i * 3 + 2] + T[c * 3 + 2];
    const l = Math.hypot(x, y, z) || 1; T2[i * 3] = x / l; T2[i * 3 + 1] = y / l; T2[i * 3 + 2] = z / l;
  }
  T.set(T2);
  for (let i = 0; i < N; i++) {
    const tx = T[i * 3], ty = T[i * 3 + 1], tz = T[i * 3 + 2];
    let ux = U[i * 3], uy = U[i * 3 + 1], uz = U[i * 3 + 2];
    const d = ux * tx + uy * ty + uz * tz;
    ux -= d * tx; uy -= d * ty; uz -= d * tz;
    const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
    U[i * 3] = ux; U[i * 3 + 1] = uy; U[i * 3 + 2] = uz;
    R[i * 3] = ty * uz - tz * uy; R[i * 3 + 1] = tz * ux - tx * uz; R[i * 3 + 2] = tx * uy - ty * ux;
  }
  for (let i = 0; i < N; i++) {
    const a = (i + N - 2 + N) % N, c = (i + 2) % N;
    for (let k = 0; k < 3; k++) K[i * 3 + k] = (T[c * 3 + k] - T[a * 3 + k]) / (4 * ds);
  }
  // Statistik / Grenzen
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < N; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return {
    N, ds, L, P, T, U, R, K, zone, zv, za,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    stationLen: b.stationLen, connLen, log: b.log, inversions: b.invCount, warn: b.warn,
    sStop: b.stationLen - 1.2,
  };
}

// ---------------------------------------------------------------------------
//  Pose entlang der Strecke (periodisch interpoliert)
// ---------------------------------------------------------------------------
export function poseAt(tr, s, out) {
  const N = tr.N, ds = tr.ds;
  let x = s / ds; x = ((x % N) + N) % N;
  const i = Math.floor(x), f = x - i, j = (i + 1) % N;
  const A = i * 3, B = j * 3;
  for (let k = 0; k < 3; k++) {
    out.p[k] = tr.P[A + k] + (tr.P[B + k] - tr.P[A + k]) * f;
    out.t[k] = tr.T[A + k] + (tr.T[B + k] - tr.T[A + k]) * f;
    out.u[k] = tr.U[A + k] + (tr.U[B + k] - tr.U[A + k]) * f;
    out.k[k] = tr.K[A + k] + (tr.K[B + k] - tr.K[A + k]) * f;
  }
  let l = Math.hypot(out.t[0], out.t[1], out.t[2]) || 1; out.t[0] /= l; out.t[1] /= l; out.t[2] /= l;
  const d = out.u[0] * out.t[0] + out.u[1] * out.t[1] + out.u[2] * out.t[2];
  out.u[0] -= d * out.t[0]; out.u[1] -= d * out.t[1]; out.u[2] -= d * out.t[2];
  l = Math.hypot(out.u[0], out.u[1], out.u[2]) || 1; out.u[0] /= l; out.u[1] /= l; out.u[2] /= l;
  out.r[0] = out.t[1] * out.u[2] - out.t[2] * out.u[1];
  out.r[1] = out.t[2] * out.u[0] - out.t[0] * out.u[2];
  out.r[2] = out.t[0] * out.u[1] - out.t[1] * out.u[0];
  out.i = i;
  return out;
}
export const newPose = () => ({ p: [0, 0, 0], t: [1, 0, 0], u: [0, 1, 0], r: [0, 0, 1], k: [0, 0, 0], i: 0 });
