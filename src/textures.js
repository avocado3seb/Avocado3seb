// Prozedurale Texturen (Canvas) – keine externen Assets nötig
import * as THREE from 'three';
import { RNG, vnoise, fbm } from './util.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function tex(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}
function noiseFill(ctx, w, h, base, amp, scale = 1, seed = 1, tint = [1, 1, 1]) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // tilebar: Rauschen über Torus
      const n1 = vnoiseTile(x / w * 8 * scale, y / h * 8 * scale, 8 * scale, seed);
      const n2 = vnoiseTile(x / w * 32 * scale, y / h * 32 * scale, 32 * scale, seed + 5);
      const g = (n1 * 0.6 + n2 * 0.4 - 0.5) * amp;
      const i = (y * w + x) * 4;
      d[i] = base[0] * tint[0] + g; d[i + 1] = base[1] * tint[1] + g; d[i + 2] = base[2] * tint[2] + g; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
function vnoiseTile(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const m = (v) => ((v % period) + period) % period;
  const h = (a, b) => { let v = (Math.imul(m(a), 374761393) + Math.imul(m(b), 668265263) + Math.imul(seed, 1274126177)) | 0; v = Math.imul(v ^ (v >>> 13), 1274126177); v ^= v >>> 16; return (v >>> 0) / 4294967296; };
  const u = xf * xf * (3 - 2 * xf), v2 = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return (a + (b - a) * u) * (1 - v2) + (c + (d - c) * u) * v2;
}

export function makeAsphalt() {
  const c = canvas(512), x = c.getContext('2d');
  noiseFill(x, 512, 512, [58, 58, 62], 46, 1, 3);
  const r = new RNG(7);
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${r.int(90, 160)},${r.int(90, 160)},${r.int(90, 160)},${r.range(0.1, 0.35)})`; x.fillRect(r.range(0, 512), r.range(0, 512), r.range(1, 2.2), r.range(1, 2.2)); }
  x.strokeStyle = 'rgba(20,20,22,0.5)'; x.lineWidth = 1;
  for (let i = 0; i < 6; i++) { x.beginPath(); let px = r.range(0, 512), py = r.range(0, 512); x.moveTo(px, py); for (let k = 0; k < 8; k++) { px += r.range(-30, 30); py += r.range(-30, 30); x.lineTo(px, py); } x.stroke(); }
  return tex(c);
}
export function makeSidewalk() {
  const c = canvas(256), x = c.getContext('2d');
  noiseFill(x, 256, 256, [168, 166, 160], 26, 1, 11);
  x.strokeStyle = 'rgba(70,70,70,0.55)'; x.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
  return tex(c);
}
export function makeConcrete() {
  const c = canvas(256), x = c.getContext('2d');
  noiseFill(x, 256, 256, [150, 148, 144], 34, 1, 21);
  return tex(c);
}
export function makeGrass() {
  const c = canvas(512), x = c.getContext('2d');
  noiseFill(x, 512, 512, [86, 120, 52], 50, 1.4, 31, [1, 1.05, 0.85]);
  const r = new RNG(5);
  for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(${r.int(50, 120)},${r.int(110, 170)},${r.int(30, 70)},0.35)`; x.fillRect(r.range(0, 512), r.range(0, 512), 1, r.range(2, 5)); }
  return tex(c);
}
export function makeSand() {
  const c = canvas(512), x = c.getContext('2d');
  noiseFill(x, 512, 512, [226, 208, 160], 22, 1.5, 41);
  const r = new RNG(3);
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${r.int(180, 255)},${r.int(160, 230)},${r.int(110, 190)},0.4)`; x.fillRect(r.range(0, 512), r.range(0, 512), 1, 1); }
  return tex(c);
}
export function makeDirt() {
  const c = canvas(256), x = c.getContext('2d');
  noiseFill(x, 256, 256, [112, 88, 62], 50, 1.2, 51);
  return tex(c);
}
export function makeTerrainDetail() {
  const c = canvas(512), x = c.getContext('2d');
  noiseFill(x, 512, 512, [200, 200, 200], 70, 1.8, 61);
  return tex(c);
}
export function makeWood() {
  const c = canvas(256), x = c.getContext('2d');
  noiseFill(x, 256, 256, [150, 108, 70], 30, 1, 71);
  x.strokeStyle = 'rgba(40,25,15,0.7)'; x.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) { x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
  const r = new RNG(9);
  x.strokeStyle = 'rgba(60,40,25,0.35)'; x.lineWidth = 1;
  for (let i = 0; i < 80; i++) { const y = r.range(0, 256); x.beginPath(); x.moveTo(r.range(0, 256), y); x.lineTo(r.range(0, 256), y + r.range(-2, 2)); x.stroke(); }
  return tex(c);
}
export function makeMetal() {
  const c = canvas(256), x = c.getContext('2d');
  noiseFill(x, 256, 256, [150, 154, 160], 22, 1, 81);
  x.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 256; i += 16) { x.fillRect(i, 0, 3, 256); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(i + 3, 0, 2, 256); x.fillStyle = 'rgba(0,0,0,0.25)'; }
  return tex(c);
}
export function makeRoof() {
  const c = canvas(256), x = c.getContext('2d');
  noiseFill(x, 256, 256, [92, 90, 88], 40, 1.5, 91);
  return tex(c);
}
export function makeTiles() {
  const c = canvas(256), x = c.getContext('2d');
  noiseFill(x, 256, 256, [168, 84, 56], 30, 1, 101);
  x.strokeStyle = 'rgba(60,20,10,0.55)'; x.lineWidth = 2;
  for (let i = 0; i <= 256; i += 16) { x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { x.beginPath(); const ox = (j % 2) * 8; x.moveTo(i * 16 + ox, j * 16); x.lineTo(i * 16 + ox, j * 16 + 16); x.stroke(); }
  return tex(c);
}
export function makeRunway() {
  const c = canvas(512), x = c.getContext('2d');
  noiseFill(x, 512, 512, [48, 48, 52], 30, 1, 111);
  return tex(c);
}
export function makePlaza() {
  const c = canvas(256), x = c.getContext('2d');
  noiseFill(x, 256, 256, [196, 186, 168], 18, 1, 121);
  x.strokeStyle = 'rgba(100,90,80,0.6)'; x.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
  x.fillStyle = 'rgba(120,70,60,0.12)';
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if ((i + j) % 2 === 0) x.fillRect(i * 32 + 1, j * 32 + 1, 30, 30);
  return tex(c);
}
export function makePitch() {
  const c = canvas(256), x = c.getContext('2d');
  noiseFill(x, 256, 256, [70, 130, 60], 24, 1, 131);
  for (let i = 0; i < 256; i += 64) { x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(i, 0, 32, 256); }
  return tex(c);
}
export function makeWaterNormal() {
  const N = 256, c = canvas(N), x = c.getContext('2d');
  const h = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    h[j * N + i] = vnoiseTile(i / N * 6, j / N * 6, 6, 1) * 0.6 + vnoiseTile(i / N * 14, j / N * 14, 14, 2) * 0.3 + vnoiseTile(i / N * 40, j / N * 40, 40, 3) * 0.1;
  }
  const img = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const hx = h[j * N + ((i + 1) % N)] - h[j * N + ((i + N - 1) % N)];
    const hy = h[((j + 1) % N) * N + i] - h[((j + N - 1) % N) * N + i];
    const nx = -hx * 6, ny = -hy * 6, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    const k = (j * N + i) * 4;
    img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[k + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}
export function makeGlow() {
  const c = canvas(128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return tex(c, { repeat: false });
}
export function makeSmoke() {
  const c = canvas(128), x = c.getContext('2d');
  const img = x.createImageData(128, 128);
  for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) {
    const dx = (i - 64) / 64, dy = (j - 64) / 64, d = Math.sqrt(dx * dx + dy * dy);
    const n = fbm(i / 18, j / 18, 3, 9);
    const a = Math.max(0, 1 - d) * (0.55 + n * 0.9);
    const k = (j * 128 + i) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.min(255, a * a * 255);
  }
  x.putImageData(img, 0, 0);
  return tex(c, { repeat: false });
}
export function makeLeaf() {
  const c = canvas(128, 256), x = c.getContext('2d');
  x.clearRect(0, 0, 128, 256);
  x.translate(64, 250);
  x.strokeStyle = '#3d5a22'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -240); x.stroke();
  for (let i = 0; i < 26; i++) {
    const y = -10 - i * 9, len = 60 * Math.sin((i / 26) * Math.PI * 0.9 + 0.3);
    for (const s of [-1, 1]) {
      x.fillStyle = i % 2 ? '#4f7d2a' : '#5e9232';
      x.beginPath(); x.moveTo(0, y); x.quadraticCurveTo(s * len * 0.6, y - 10, s * len, y + 26); x.quadraticCurveTo(s * len * 0.6, y + 2, 0, y - 2); x.fill();
    }
  }
  return tex(c, { repeat: false });
}
export function makeCrack() {
  const c = canvas(128), x = c.getContext('2d');
  x.clearRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(220,230,240,0.85)'; x.lineWidth = 1.2;
  const r = new RNG(77);
  for (let k = 0; k < 4; k++) {
    let px = r.range(30, 100), py = r.range(30, 100);
    for (let a = 0; a < 9; a++) {
      const ang = (a / 9) * Math.PI * 2 + r.range(-0.2, 0.2);
      x.beginPath(); x.moveTo(px, py);
      let qx = px, qy = py;
      for (let s = 0; s < 4; s++) { qx += Math.cos(ang) * r.range(8, 20); qy += Math.sin(ang) * r.range(8, 20); x.lineTo(qx, qy); }
      x.stroke();
    }
  }
  return tex(c, { repeat: false });
}
export function makeMoon() {
  const c = canvas(256), x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,245,1)'); g.addColorStop(0.5, 'rgba(240,240,225,1)'); g.addColorStop(0.52, 'rgba(230,235,255,0.35)'); g.addColorStop(1, 'rgba(200,220,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.fillStyle = 'rgba(150,150,140,0.35)';
  const r = new RNG(4);
  for (let i = 0; i < 14; i++) { const a = r.range(0, 6.28), d = r.range(0, 55); x.beginPath(); x.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r.range(4, 14), 0, 6.28); x.fill(); }
  return tex(c, { repeat: false });
}

// --- Fassaden-Atlanten: 8x8 Zellen, jede Zelle ein Fenster-Modul ---
const ATLAS = 8, CELL = 64;
export function makeFacade(kind) {
  const c = canvas(ATLAS * CELL), x = c.getContext('2d');
  const e = canvas(ATLAS * CELL), ex = e.getContext('2d');
  ex.fillStyle = '#000'; ex.fillRect(0, 0, e.width, e.height);
  const r = new RNG(kind.length * 131 + kind.charCodeAt(0));
  const warm = ['#ffd58a', '#ffe0a8', '#ffc870', '#fff0c8', '#cfe6ff', '#ffb870'];
  for (let j = 0; j < ATLAS; j++) for (let i = 0; i < ATLAS; i++) {
    const ox = i * CELL, oy = j * CELL;
    const lit = r.chance(kind === 'shop' ? 0.85 : kind === 'warehouse' ? 0.15 : 0.42);
    const lc = r.pick(warm);
    switch (kind) {
      case 'office': {
        x.fillStyle = '#d8d5cc'; x.fillRect(ox, oy, CELL, CELL);
        x.fillStyle = 'rgba(0,0,0,0.05)'; for (let k = 0; k < 40; k++) x.fillRect(ox + r.range(0, 64), oy + r.range(0, 64), 2, 2);
        const gr = x.createLinearGradient(ox, oy + 8, ox, oy + 52); gr.addColorStop(0, '#5a7088'); gr.addColorStop(1, '#1f2c3a');
        x.fillStyle = '#a7a39a'; x.fillRect(ox + 6, oy + 9, 52, 44);
        x.fillStyle = gr; x.fillRect(ox + 9, oy + 12, 46, 38);
        x.fillStyle = 'rgba(255,255,255,0.14)'; x.beginPath(); x.moveTo(ox + 9, oy + 12); x.lineTo(ox + 30, oy + 12); x.lineTo(ox + 9, oy + 40); x.fill();
        x.fillStyle = '#b9b5ab'; x.fillRect(ox + 31, oy + 12, 2, 38);
        if (lit) { ex.fillStyle = lc; ex.fillRect(ox + 9, oy + 12, 46, 38); ex.fillStyle = '#000'; ex.fillRect(ox + 31, oy + 12, 2, 38); }
        break;
      }
      case 'glass': {
        const gr = x.createLinearGradient(ox, oy, ox + 64, oy + 64);
        const t = r.range(0, 1);
        gr.addColorStop(0, `rgb(${120 + t * 40},${165 + t * 40},${195 + t * 30})`); gr.addColorStop(1, `rgb(${58 + t * 30},${95 + t * 30},${130 + t * 30})`);
        x.fillStyle = gr; x.fillRect(ox, oy, CELL, CELL);
        x.fillStyle = 'rgba(255,255,255,0.12)'; x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + 40, oy); x.lineTo(ox, oy + 50); x.fill();
        x.fillStyle = '#22272c'; x.fillRect(ox, oy, CELL, 3); x.fillRect(ox, oy, 2, CELL); x.fillStyle = '#6c747c'; x.fillRect(ox, oy + CELL - 6, CELL, 6);
        if (lit && r.chance(0.8)) { ex.fillStyle = lc; ex.globalAlpha = 0.85; ex.fillRect(ox + 2, oy + 3, 62, 54); ex.globalAlpha = 1; }
        break;
      }
      case 'brick': {
        x.fillStyle = '#8c4d3a'; x.fillRect(ox, oy, CELL, CELL);
        for (let by = 0; by < 16; by++) for (let bx = 0; bx < 8; bx++) { const o = (by % 2) * 4; x.fillStyle = `rgb(${130 + r.range(-15, 15)},${70 + r.range(-10, 10)},${52 + r.range(-8, 8)})`; x.fillRect(ox + bx * 8 + o - 4, oy + by * 4, 7, 3); }
        x.fillStyle = '#e8e2d4'; x.fillRect(ox + 14, oy + 10, 36, 44);
        x.fillStyle = '#25303c'; x.fillRect(ox + 17, oy + 13, 30, 38);
        x.fillStyle = '#e8e2d4'; x.fillRect(ox + 31, oy + 13, 2, 38); x.fillRect(ox + 17, oy + 30, 30, 2);
        x.fillStyle = '#6d6a64'; x.fillRect(ox + 12, oy + 54, 40, 4);
        if (lit) { ex.fillStyle = lc; ex.fillRect(ox + 17, oy + 13, 30, 38); ex.fillStyle = '#000'; ex.fillRect(ox + 31, oy + 13, 2, 38); ex.fillRect(ox + 17, oy + 30, 30, 2); }
        break;
      }
      case 'deco': {
        x.fillStyle = '#f4efe6'; x.fillRect(ox, oy, CELL, CELL);
        x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(ox, oy + 58, CELL, 6);
        x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(ox, oy, CELL, 2);
        x.fillStyle = '#d9d2c4'; x.fillRect(ox + 16, oy + 8, 32, 46);
        x.fillStyle = '#2a4660'; x.fillRect(ox + 19, oy + 11, 26, 40);
        x.fillStyle = '#f4efe6'; x.fillRect(ox + 31, oy + 11, 2, 40);
        x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(ox + 19, oy + 11, 8, 40);
        if (lit) { ex.fillStyle = lc; ex.fillRect(ox + 19, oy + 11, 26, 40); ex.fillStyle = '#000'; ex.fillRect(ox + 31, oy + 11, 2, 40); }
        break;
      }
      case 'house': {
        x.fillStyle = '#f2ece0'; x.fillRect(ox, oy, CELL, CELL);
        noiseSpeck(x, ox, oy, r);
        x.fillStyle = '#ffffff'; x.fillRect(ox + 14, oy + 10, 36, 40);
        x.fillStyle = '#2d3b4a'; x.fillRect(ox + 17, oy + 13, 30, 34);
        x.fillStyle = '#ffffff'; x.fillRect(ox + 31, oy + 13, 2, 34);
        x.fillStyle = '#5b7a5c'; x.fillRect(ox + 6, oy + 10, 7, 40); x.fillRect(ox + 51, oy + 10, 7, 40);
        if (lit) { ex.fillStyle = lc; ex.fillRect(ox + 17, oy + 13, 30, 34); ex.fillStyle = '#000'; ex.fillRect(ox + 31, oy + 13, 2, 34); }
        break;
      }
      case 'shop': {
        x.fillStyle = '#35373b'; x.fillRect(ox, oy, CELL, CELL);
        const gr = x.createLinearGradient(ox, oy, ox, oy + 64); gr.addColorStop(0, '#6b8196'); gr.addColorStop(1, '#2c3743');
        x.fillStyle = gr; x.fillRect(ox + 3, oy + 8, 58, 52);
        x.fillStyle = '#25272a'; x.fillRect(ox + 31, oy + 8, 2, 52);
        x.fillStyle = 'rgba(255,255,255,0.15)'; x.beginPath(); x.moveTo(ox + 3, oy + 8); x.lineTo(ox + 28, oy + 8); x.lineTo(ox + 3, oy + 40); x.fill();
        if (lit) { ex.fillStyle = lc; ex.fillRect(ox + 3, oy + 8, 58, 52); ex.fillStyle = '#000'; ex.fillRect(ox + 31, oy + 8, 2, 52); }
        break;
      }
      case 'warehouse': {
        x.fillStyle = '#a5a8ad'; x.fillRect(ox, oy, CELL, CELL);
        for (let k = 0; k < 64; k += 8) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(ox + k, oy, 2, CELL); x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(ox + k + 2, oy, 2, CELL); }
        if (j % 4 === 1) { x.fillStyle = '#3a4048'; x.fillRect(ox + 8, oy + 20, 48, 14); if (lit) { ex.fillStyle = lc; ex.fillRect(ox + 8, oy + 20, 48, 14); } }
        break;
      }
    }
  }
  const t = tex(c), et = tex(e);
  return { map: t, emissive: et };
}
function noiseSpeck(x, ox, oy, r) { for (let k = 0; k < 50; k++) { x.fillStyle = `rgba(0,0,0,${r.range(0.02, 0.07)})`; x.fillRect(ox + r.range(0, 64), oy + r.range(0, 64), 2, 2); } }
export const ATLAS_N = ATLAS;

// Auto-Kennzeichen/Leuchtreklame: Text-Textur
export function makeSignTexture(text, fg = '#ff4fd8', bg = 'rgba(10,0,20,0.9)', w = 256, h = 96) {
  const c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.strokeStyle = fg; x.lineWidth = 4; x.strokeRect(5, 5, w - 10, h - 10);
  x.fillStyle = fg; x.font = `bold ${Math.floor(h * 0.5)}px Impact, Arial Black, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = fg; x.shadowBlur = 12;
  x.fillText(text, w / 2, h / 2 + 3);
  return tex(c, { repeat: false });
}
