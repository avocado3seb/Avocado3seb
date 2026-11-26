// ============================================================================
//  pl_quality.js – Materialqualität: Normal Maps aus den prozeduralen Texturen (Relief bei flachem Licht),
//  feines Geländerelief, Anisotropie. Wird einmal nach dem Aufbau einer Welt angewendet.
// ============================================================================
import * as THREE from 'three';

const canvasNrm = new WeakMap(); // Quellcanvas → Normalen-Canvas
const texNrm = new Map();        // Texture.uuid → Normalmap-Textur

function heightToNormal(src) {
  const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data, hf = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) hf[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
  // leicht glätten (Rauschen), dann Sobel
  const sm = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += hf[((y + j + h) % h) * w + ((x + i + w) % w)]; sm[y * w + x] = s / 9; }
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h); let mean = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xl = (x - 1 + w) % w, xr = (x + 1) % w, yu = (y - 1 + h) % h, yd = (y + 1) % h, i = y * w + x;
    gx[i] = (sm[y * w + xr] - sm[y * w + xl]); gy[i] = (sm[yd * w + x] - sm[yu * w + x]); mean += Math.abs(gx[i]) + Math.abs(gy[i]);
  }
  mean /= w * h * 2; const k = Math.min(9, Math.max(1.2, 0.3 / Math.max(mean, 1e-4))); // Stärke so, dass die mittlere Neigung ≈ 17°
  const out = document.createElement('canvas'); out.width = w; out.height = h; const g = out.getContext('2d'), img = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    let nx = -gx[i] * k, ny = gy[i] * k, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    img.data[i * 4] = (nx * 0.5 + 0.5) * 255; img.data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; img.data[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0); return out;
}

function normalFor(tex) {
  let nm = texNrm.get(tex.uuid); if (nm) return nm;
  const src = tex.image; let c = canvasNrm.get(src); if (!c) { c = heightToNormal(src); canvasNrm.set(src, c); }
  nm = new THREE.CanvasTexture(c); nm.wrapS = tex.wrapS; nm.wrapT = tex.wrapT; nm.repeat.copy(tex.repeat); nm.offset.copy(tex.offset); nm.anisotropy = 8; nm.colorSpace = THREE.NoColorSpace;
  texNrm.set(tex.uuid, nm); return nm;
}

// Feines, kachelndes Bodenrelief (Rauschen) – alle ~2,4 m
let detail = null;
function detailNormal(repeat) {
  if (!detail) {
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), img = g.createImageData(N, N);
    const h = new Float32Array(N * N); let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let o = 0; o < 4; o++) { const f = 4 << o, grid = Array.from({ length: f * f }, () => rnd()); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N * f, v = y / N * f, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, s = t => t * t * (3 - 2 * t); const a = grid[(j % f) * f + (i % f)], b = grid[(j % f) * f + ((i + 1) % f)], c2 = grid[((j + 1) % f) * f + (i % f)], d = grid[((j + 1) % f) * f + ((i + 1) % f)]; h[y * N + x] += (a + (b - a) * s(fu) + (c2 - a) * s(fv) + (a - b - c2 + d) * s(fu) * s(fv)) / (1 << o); } }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const xl = (x - 1 + N) % N, xr = (x + 1) % N, yu = (y - 1 + N) % N, yd = (y + 1) % N, gx = h[y * N + xr] - h[y * N + xl], gy = h[yd * N + x] - h[yu * N + x]; let nx = -gx * 5, ny = gy * 5, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; const i = (y * N + x) * 4; img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); detail = new THREE.CanvasTexture(c); detail.wrapS = detail.wrapT = THREE.RepeatWrapping; detail.anisotropy = 8; detail.colorSpace = THREE.NoColorSpace;
  }
  const t = detail.clone(); t.needsUpdate = true; t.repeat.set(repeat, repeat); return t;
}

// root: Szenenteil; opts: { terrain: Mesh, strength: 0..1 }
export function applyMaterialQuality(root, opts = {}) {
  const seen = new Set(); let n = 0; const k = opts.strength ?? 0.8;
  root.traverse(o => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; if (o.isSprite || o.isPoints || o.isLine) return;
    for (const m of ms) {
      if (!m || seen.has(m) || !m.isMeshStandardMaterial) continue; seen.add(m);
      const t = m.map; if (!t || !t.image || !(t.image instanceof HTMLCanvasElement) || m.normalMap || m.emissiveMap || m.transparent || t.image.width > 1024) continue;
      m.normalMap = normalFor(t); m.normalScale.set(k, k); m.needsUpdate = true; n++;
    }
  });
  if (opts.terrain && opts.terrain.material) { const m = opts.terrain.material; m.normalMap = detailNormal(10); m.normalScale.set(0.9, 0.9); m.needsUpdate = true; n++; }
  return n;
}
