// Allgemeine Hilfsfunktionen
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
export function wrapPI(a) {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}
export const angDiff = (a, b) => wrapPI(b - a);
export const dampAngle = (cur, target, lambda, dt) => cur + angDiff(cur, target) * (1 - Math.exp(-lambda * dt));
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const fwdX = (yaw) => Math.sin(yaw);
export const fwdZ = (yaw) => Math.cos(yaw);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class RNG {
  constructor(seed = 1) { this.f = mulberry32(seed); }
  next() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.f()); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length) % arr.length]; }
  chance(p) { return this.f() < p; }
  sign() { return this.f() < 0.5 ? -1 : 1; }
}
export function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function hash2(x, z, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x, z, seed = 0) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, z, oct = 4, seed = 0) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f, seed + i * 17); f *= 2; a *= 0.5; }
  return s;
}
export const fmtMoney = (n) => '$' + Math.round(n).toLocaleString('de-DE');
export function fmtClock(h) {
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
// Punkt in AABB / Kreis-gegen-AABB Hilfen
export function circleAABB(cx, cz, r, minX, minZ, maxX, maxZ) {
  const px = clamp(cx, minX, maxX), pz = clamp(cz, minZ, maxZ);
  let dx = cx - px, dz = cz - pz;
  const d2 = dx * dx + dz * dz;
  if (d2 > r * r) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, nz: dz / d, pen: r - d };
  }
  // Mittelpunkt im Inneren: kürzesten Weg nach außen
  const l = cx - minX, rr = maxX - cx, t = cz - minZ, b = maxZ - cz;
  const m = Math.min(l, rr, t, b);
  if (m === l) return { nx: -1, nz: 0, pen: l + r };
  if (m === rr) return { nx: 1, nz: 0, pen: rr + r };
  if (m === t) return { nx: 0, nz: -1, pen: t + r };
  return { nx: 0, nz: 1, pen: b + r };
}
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
