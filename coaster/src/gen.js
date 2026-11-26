// ============================================================================
//  gen.js – Layout-Generator: erzeugt für jede Bahn ohne handgebautes Layout eine
//  fahrbare Strecke (Lift/Launch, erste Abfahrt, Hügel, Kurven, Inversionen …),
//  skaliert auf Höhe, Länge und Inversionen aus der Datenbank.
//  Der Generator arbeitet energiebewusst (Geschwindigkeit wird beim Bauen mitgerechnet).
// ============================================================================
import { Builder, G, ZONE } from './track.js';
import { CATS } from './specs.js';

export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const f1 = v => (Math.round(v * 10) / 10).toString();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function genLayout(c) {
  const spec = CATS[c.cat] || CATS.sitdown;
  const R = mulberry32(hashStr(c.id || c.name));
  const rr = (a, b) => a + (b - a) * R();
  const trainLen = spec.cars * spec.spacing;
  const b = new Builder({ trainLen });
  const out = [];
  const ap = t => { out.push(t); b.apply(t); };
  const crr = spec.crr, kd = 0.00022;
  const lossPerM = v2 => crr + kd * v2 / G;           // Energiehöhe, die pro Meter verloren geht
  const H = Math.max(4, c.h || 20);
  const T = Math.max(150, c.len || 600);
  let E, vLaunch = 0, hTop2 = 0;
  const small = spec.hmax <= 8;

  ap('ST');
  // --- Antrieb & erste Abfahrt -------------------------------------------------
  if (spec.launch) {
    vLaunch = clamp((c.v || 90) / 3.6, 15, 50);
    const Lq = vLaunch * vLaunch / 20;
    ap(`LAUNCH:${f1(Lq)}:${f1(vLaunch * 3.6)}`);
    const hTop = Math.min(H, vLaunch * vLaunch / (2 * G) * 0.82);
    E = vLaunch * vLaunch / (2 * G);
    const Rl = clamp(vLaunch * vLaunch / (3.0 * G), 16, 95);
    if (hTop > 22 && (hTop >= 55 || R() < 0.45)) {
      ap(`TOPHAT:${f1(hTop * 0.92)}:${f1(Rl)}`);
      E -= 0.1 * hTop + 4; hTop2 = hTop;
    } else {
      ap(`CLIMB:${f1(hTop)}:${f1(rr(35, 50))}:${f1(Rl)}`);
      ap(`DROP:${f1(hTop)}:${spec.dropA}:${f1(Rl)}`);
      E -= 0.05 * hTop + 3;
    }
  } else {
    const [la, lv] = spec.lift;
    ap(`LIFT:${f1(H)}:${la}:${lv}`);
    ap(`DROP:${f1(H)}:${spec.dropA}`);
    E = H - 0.04 * H - 2;
  }
  if (b.y > 1.5) { /* Abfahrt endet auf Stationshöhe */ }

  // --- Planung des Ovals --------------------------------------------------------
  const uR = clamp(small ? H * 1.6 + 8 : H * 0.75 + 12, 14, 62);
  const xbTarget = -(uR * 0.15 + 26);
  const uLen = Math.PI * uR;
  const sStart = b.s;
  const x0 = Math.max(0, b.x);
  const Xtarget = Math.max(x0 + 40, (T - sStart - 2 * uLen - 66 + 1.25 * x0) / 2.5);
  const sOutEnd = sStart + Math.max(60, (T - sStart) * 0.5);
  let invLeft = c.inv || 0;
  const queue = [];
  const mkInv = n => {
    const kinds = c.cat === 'wood' ? [] : ['LOOP', 'CORK', 'BARREL', 'COBRA'];
    while (n > 0) {
      let k = kinds[Math.floor(R() * kinds.length)];
      if (!k) break;
      if (k === 'COBRA' && n < 2) k = 'CORK';
      queue.push(k); n -= k === 'COBRA' ? 2 : 1;
    }
  };
  mkInv(invLeft);
  const qOut = queue.splice(0, Math.ceil(queue.length * 0.55));
  const qBack = queue;

  let guard = 0;
  const snap = () => ({ x: b.x, y: b.y, z: b.z, th: b.th, psi: b.psi, phi: b.phi, s: b.s, n: b.pts.length, inv: b.invCount, o: out.length });
  const restore = sn => { b.x = sn.x; b.y = sn.y; b.z = sn.z; b.th = sn.th; b.psi = sn.psi; b.phi = sn.phi; b.s = sn.s; b.pts.length = sn.n; b.invCount = sn.inv; out.length = sn.o; };

  // prüft ob das neu gebaute Stück energetisch fährbar ist
  const scan = (from, E0, s0, vmin) => {
    let minV2 = 1e9;
    for (let i = from; i < b.pts.length; i++) {
      const p = b.pts[i];
      const ee = E0 - 0.014 * (p[3 + 0] * 0) - lossPerM(900) * (b.pts.length > 0 ? (i - from) : 0);
      const v2 = 2 * G * (ee - p[1]);
      if (v2 < minV2) minV2 = v2;
      if (p[1] < -0.3) { if (globalThis.GEN_DEBUG) console.log('  scan: y<0 at', (i-from), p[1].toFixed(2)); return false; }
    }
    if (globalThis.GEN_DEBUG && minV2 < vmin * vmin) console.log('  scan: vmin', Math.sqrt(Math.max(0, minV2)).toFixed(1), '<', vmin);
    return minV2 >= vmin * vmin;
  };

  const bankFor = (v2, Rr) => clamp(Math.atan(v2 / (G * Rr)) / Math.PI * 180 * 0.85, 14, 68);

  const leg = (isBack) => {
    const queue = isBack ? qBack : qOut;
    let tries = 0, failTotal = 0, bend = 1, boosters = 0;
    while (guard++ < 400) {
      const ah = E - b.y;                           // verfügbare Energiehöhe über aktueller Position
      const reserve = 4 + 0.02 * (Math.max(0, b.x) + 30 + uLen * 2);
      if (!isBack && (b.x >= Xtarget || b.s >= sOutEnd) && queue.length === 0) break;
      if (!isBack && queue.length === 0 && (b.x >= Xtarget + 120 || b.s >= sOutEnd + 200)) break;
      if (!isBack && b.s >= sOutEnd + 450) break;
      if (isBack && b.x <= xbTarget + 10 && queue.length === 0) break;
      if (isBack && b.x <= xbTarget - 200) break;
      const v2 = Math.max(100, 2 * G * ah);
      // Energie knapp -> Zwischenlift / Kicker
      if (ah < reserve * 0.85 + 1 && !small || (small && ah < 2.5)) {
        const hb = clamp(Math.max(H * 0.55, reserve + 3), small ? 3 : 8, small ? 16 : 40);
        if (++boosters > 4) break;
        const sn = snap();
        if (spec.launch && b.y < 2) {
          const vb = clamp(vLaunch * 0.8, 14, 30), Lb = vb * vb / 20;
          ap(`LAUNCH:${f1(Lb)}:${f1(vb * 3.6)}`); E = Math.max(E, vb * vb / (2 * G) + b.y) * 0.97;
        } else if (b.y < 2) { ap(`LIFT:${f1(hb)}:${spec.lift ? spec.lift[0] : 20}:${spec.lift ? spec.lift[1] : 3}`); ap(`DROP:${f1(hb)}:${Math.min(spec.dropA, 50)}`); E = Math.max(E, hb + b.y) * 0.98; }
        if (E - b.y < 3) break;
        continue;
      }
      // Kandidat wählen
      let tok = null, vmin = 8, extra = null, pre = [], post = [];
      const wantInv = queue.length && (R() < (isBack ? 0.75 : 0.85) || (!isBack && b.s < sStart + 40));
      const Rp = clamp(2 * ah / 2.6, 24, 120);               // Radius für ca. 2,6 g Querbeschleunigung
      const upTok = (hh, a) => `CLIMB:${f1(hh)}:${a}:${f1(Rp)}`;
      const downTok = (hh, a, vTop) => `DROP:${f1(hh)}:${a}:${f1(clamp(Rp * 0.9, 16, 120))}:${f1(clamp(vTop * vTop / G, 20, 120))}`;
      if (wantInv) {
        const k = queue[0];
        const Hl = clamp(ah * 0.64, 12, spec.style === 'inv' ? 34 : 42);
        if (k === 'LOOP' && 2 * ah / (0.67 * Hl) + 1 > 6.2 && ah >= 30) { queue[0] = 'CORK'; continue; }
        if ((k === 'CORK' || k === 'BARREL') && ah < 30) { queue[0] = 'LOOP'; continue; }
        if (k === 'LOOP') { tok = `LOOP:${f1(Hl)}`; vmin = 9; }
        else if (k === 'CORK' || k === 'BARREL') {
          // auf einer Kuppe fahren, damit das Tempo (und die G-Kräfte) sinken
          const vTarget = 21, hh = clamp((v2 - vTarget * vTarget) / (2 * G), 11, ah * 0.72);
          const vIn = Math.sqrt(Math.max(100, 2 * G * (ah - hh)));
          const Rh = rr(5.2, 6.4);
          if (k === 'CORK') {
            const kap = 3.0 * G / (vIn * vIn);
            const Lc = clamp(2 * Math.PI * Math.sqrt(Math.max(36, Rh / kap - Rh * Rh)), 44, 110);
            tok = `CORK:${f1(Lc)}:${f1(Rh)}:${R() < 0.5 ? 1 : -1}`;
          } else tok = `BARREL:${f1(clamp(vIn * 3.2, 60, 110))}:${f1(rr(4, 7))}:${R() < 0.5 ? 1 : -1}`;
          pre = [upTok(hh, 28)]; post = [downTok(hh, 28, vIn)]; vmin = 7;
        }
        else if (k === 'COBRA') {
          if (ah < 62 || ah > 90) { queue.splice(0, 1, 'CORK', 'CORK'); continue; }
          tok = `COBRA:${f1(clamp(ah * 0.4, 28, 36))}`; vmin = 9;
        }
      } else {
        const r = R();
        const hMax = Math.min(spec.hmax, ah * 0.6);
        if (r < 0.52 && hMax >= (small ? 1.5 : 4)) {
          const h = rr(Math.min(hMax, small ? 1.2 : 3.5), hMax);
          const Rc = small ? rr(12, 20) : Math.max(spec.style === 'wood' ? rr(30, 45) : rr(40, 56), Rp);
          const Lh = Math.max(small ? 18 : 36, Math.sqrt(2 * Math.PI * Math.PI * h * Rc));
          tok = `HILL:${f1(h)}:${f1(Lh)}`; vmin = small ? 3.5 : 9;
          if (R() < 0.3 && h > 5) extra = `HILL:${f1(h * 0.7)}:${f1(Lh * 0.85)}`;
        } else if (r < 0.72) {
          const Rr = small ? rr(10, 16) : Math.max(rr(28, 48), Rp * 0.8);
          const deg = [30, 45, 60][Math.floor(R() * 3)];
          const bk = bankFor(v2, Rr);
          const a = bend > 0 ? 'TL' : 'TR', b2 = bend > 0 ? 'TR' : 'TL'; bend = -bend;
          tok = `${a}:${deg}:${f1(Rr)}:${f1(bk)}`; extra = `${b2}:${deg}:${f1(Rr)}:${f1(bk)}`; vmin = 6;
        } else if (r < 0.84 && (b.y < 1.5) && !isBack) {
          const Rr = small ? rr(10, 14) : Math.max(rr(22, 34), Rp * 0.7);
          tok = `HELL:1:${f1(Rr)}:${f1(bankFor(v2, Rr))}:0`; vmin = 6;
        } else if (r < 0.92 && !small && spec.style !== 'wood' && invLeft === 0) {
          tok = `S:${f1(rr(20, 40))}`; vmin = 5;
        } else {
          tok = `S:${f1(rr(14, 36))}`; vmin = 4;
        }
      }
      const sn = snap();
      const s0 = b.s;
      for (const t of pre) ap(t); ap(tok); for (const t of post) ap(t); if (extra) ap(extra);
      const okE = scan(sn.n, E, s0, vmin);
      const xOk = !isBack || b.x >= xbTarget - 18 || (queue.length > 0 && b.x >= xbTarget - 220);
      if (!okE || !xOk || !(b.y > -0.5) || b.y > spec.hmax * 2 + 6) {
        if (globalThis.GEN_DEBUG && wantInv) console.log('FAIL', tok, 'okE', okE, 'xOk', xOk, 'y', b.y.toFixed(1), 'ah', ah.toFixed(1), 'x', b.x.toFixed(0), 'pre', pre.join(','));
        restore(sn);
        if (wantInv && ++failTotal > 30) { queue.shift(); failTotal = 0; }
        if (++tries > 8) { ap(`S:${f1(rr(12, 24))}`); E -= lossPerM(v2) * 20; tries = 0; }
        continue;
      }
      tries = 0;
      if (wantInv) { const k = queue.shift(); invLeft -= k === 'COBRA' ? 2 : 1; }
      E -= lossPerM(2 * G * Math.max(5, ah)) * (b.s - s0);
      // Immelmann/Cobra hinterlassen Resthöhe
      if (b.y > 3.5 && tok.startsWith('COBRA')) { ap(`DROP:${f1(b.y)}:30:${f1(Rp)}`); }
    }
  };

  leg(false);
  // Wendekurve 1
  {
    const ah = Math.max(8, E - b.y), v2 = 2 * G * ah;
    if (b.y > 3) ap(`DROP:${f1(b.y)}:32`);
    ap(`TR:180:${f1(uR)}:${f1(bankFor(v2, uR))}`);
    E -= lossPerM(v2) * uLen;
  }
  // Inversionen, die noch übrig sind, in den Rückweg
  leg(true);
  // Stück bis zum Ziel auffüllen
  if (b.x > xbTarget + 6) { ap(`S:${f1(b.x - xbTarget)}`); }
  if (b.y > 3) ap(`DROP:${f1(b.y)}:30`);
  {
    const ah = Math.max(6, E - b.y), v2 = 2 * G * ah;
    ap(`TR:180:${f1(uR)}:${f1(bankFor(v2, uR))}`);
  }
  if (b.x < -29) ap(`S:${f1(-28 - b.x)}`);
  { const vEnd2 = 2 * G * Math.max(2, E - b.y); ap(`BRAKE:${f1(clamp(vEnd2 / 14, 28, 160))}:5`); }
  return out.join(' ');
}
