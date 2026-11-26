// Prozedurale Texturen (Canvas) – kein externes Asset nötig
import * as THREE from 'three';

const cache = {};
let rngSeed = 12345;
const rnd = () => { rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0; return rngSeed / 4294967296; };

function mk(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat !== false) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (opts.rep) t.repeat.set(opts.rep[0], opts.rep[1]);
  return t;
}
function cached(key, fn) { return cache[key] || (cache[key] = fn()); }

function speckle(g, w, h, n, c1, c2, size = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rnd() < 0.5 ? c1 : c2;
    g.globalAlpha = 0.08 + rnd() * 0.25;
    g.fillRect(rnd() * w, rnd() * h, size * (0.5 + rnd() * 2), size * (0.5 + rnd() * 2));
  }
  g.globalAlpha = 1;
}

export const textures = {
  grass: () => cached('grass', () => mk(1024, 1024, (g, w, h) => {
    g.fillStyle = '#4c7f2f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * w, y = rnd() * h, l = 3 + rnd() * 9;
      g.strokeStyle = `hsl(${85 + rnd() * 30},${40 + rnd() * 25}%,${22 + rnd() * 24}%)`;
      g.globalAlpha = 0.5; g.lineWidth = 1 + rnd();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y - l); g.stroke();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '30,70,20' : '120,150,60'},0.12)`; g.beginPath(); g.arc(rnd() * w, rnd() * h, 30 + rnd() * 90, 0, 7); g.fill(); }
  })),
  asphalt: () => cached('asphalt', () => mk(512, 512, (g, w, h) => {
    g.fillStyle = '#7d7a73'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 9000, '#4f4d49', '#b3afa6', 2);
    g.strokeStyle = 'rgba(40,40,40,0.25)';
    for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(rnd() * w, rnd() * h); g.lineTo(rnd() * w, rnd() * h); g.stroke(); }
  })),
  paving: () => cached('paving', () => mk(512, 512, (g, w, h) => {
    g.fillStyle = '#b8ad98'; g.fillRect(0, 0, w, h);
    const n = 8, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 150 + rnd() * 40;
      g.fillStyle = `rgb(${v + 10},${v},${v - 18})`; g.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
    }
    speckle(g, w, h, 4000, '#6e6659', '#e8e0cf', 2);
  })),
  concrete: () => cached('concrete', () => mk(256, 256, (g, w, h) => {
    g.fillStyle = '#a7a59e'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, '#77746c', '#d4d1c8', 2);
  })),
  wood: () => cached('wood', () => mk(256, 256, (g, w, h) => {
    g.fillStyle = '#9a6a3a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${60 + rnd() * 50},${35 + rnd() * 30},15,0.18)`; g.fillRect(0, y, w, 1 + rnd() * 2); }
  })),
  plaster: () => cached('plaster', () => mk(256, 256, (g, w, h) => {
    g.fillStyle = '#f0ece2'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2500, '#c9c2b0', '#ffffff', 2);
  })),
  brick: () => cached('brick', () => mk(256, 256, (g, w, h) => {
    g.fillStyle = '#8c4a38'; g.fillRect(0, 0, w, h);
    const bh = 16, bw = 32;
    for (let y = 0; y < h / bh; y++) for (let x = -1; x < w / bw; x++) {
      const ox = (y % 2) * bw / 2, v = rnd() * 40;
      g.fillStyle = `rgb(${150 + v},${72 + v * 0.4},${52 + v * 0.3})`; g.fillRect(x * bw + ox + 1, y * bh + 1, bw - 2, bh - 2);
    }
  })),
  roofTile: () => cached('roofTile', () => mk(256, 256, (g, w, h) => {
    g.fillStyle = '#9b3b2a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 16; y++) for (let x = -1; x < 16; x++) {
      const v = rnd() * 30; g.fillStyle = `rgb(${150 + v},${55 + v * 0.3},${38 + v * 0.2})`;
      g.beginPath(); g.arc(x * 16 + (y % 2) * 8 + 8, y * 16, 9, 0, Math.PI); g.fill();
    }
  })),
  water: () => cached('water', () => mk(256, 256, (g, w, h) => {
    g.fillStyle = '#2a6f94'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(255,255,255,${0.04 + rnd() * 0.08})`; g.beginPath(); const x = rnd() * w, y = rnd() * h; g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 3, x + 22, y); g.stroke(); }
  })),
  cloud: () => cached('cloud', () => mk(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { repeat: false })),
  // Fassade mit Fenstern: Wandfarbe, Fensterreihen
  facade: (wall = '#e8dcc0', trim = '#6a4a30', style = 'plaster') => cached(`facade:${wall}:${trim}:${style}`, () => mk(256, 256, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1800, 'rgba(0,0,0,0.35)', 'rgba(255,255,255,0.4)', 2);
    if (style === 'timber') {
      g.fillStyle = trim;
      for (const x of [0, 126, 250]) g.fillRect(x, 0, 6, h);
      for (const y of [0, 126, 250]) g.fillRect(0, y, w, 6);
      g.strokeStyle = trim; g.lineWidth = 5; g.beginPath(); g.moveTo(6, 126); g.lineTo(126, 6); g.moveTo(130, 250); g.lineTo(250, 130); g.stroke();
    } else if (style === 'brick') {
      for (let y = 0; y < 16; y++) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y * 16, w, 1.5); for (let x = 0; x < 8; x++) g.fillRect(x * 32 + (y % 2) * 16, y * 16, 1.5, 16); }
    }
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const x = 22 + c * 78, y = 26 + r * 118;
      g.fillStyle = trim; g.fillRect(x - 4, y - 4, 44, 68);
      const gr = g.createLinearGradient(x, y, x + 36, y + 60); gr.addColorStop(0, '#9ec8e8'); gr.addColorStop(1, '#3a5f86');
      g.fillStyle = gr; g.fillRect(x, y, 36, 60);
      g.fillStyle = trim; g.fillRect(x + 16, y, 4, 60); g.fillRect(x, y + 28, 36, 4);
    }
  })),
};

// Schild mit Text (Hauptname + Untertitel)
export function signTexture(title, bg = '#c8202e', fg = '#ffffff', sub = '') {
  const key = `sign:${title}:${bg}:${sub}`;
  return cached(key, () => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, bg); gr.addColorStop(1, '#101018');
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(10, 10, 1004, 236);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 120; g.font = `900 ${size}px "Segoe UI", Arial, sans-serif`;
    while (g.measureText(title).width > 940 && size > 30) { size -= 6; g.font = `900 ${size}px "Segoe UI", Arial, sans-serif`; }
    g.fillText(title, 512, sub ? 110 : 128);
    if (sub) { g.font = '600 46px "Segoe UI", Arial, sans-serif'; g.globalAlpha = 0.85; g.fillText(sub, 512, 205); g.globalAlpha = 1; }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  });
}
