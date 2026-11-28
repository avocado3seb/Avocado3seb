// ============================================================================
//  pl_tex.js – prozedurale Texturen und Geometrie-Helfer für die Themenwelten (Berlin, Rookburgh, Mexico, China, Fantasy …)
//  Alles wird zur Laufzeit auf Canvas gezeichnet (keine Bilddateien) und zwischengespeichert.
// ============================================================================
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const rnd = seed => { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
export const hashS = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
export const col = c => new THREE.Color(c);
export const shade = (c, k) => { const t = new THREE.Color(c); t.multiplyScalar(k); return t; };

const cache = {};
export const memo = (key, make) => cache[key] || (cache[key] = make());
export function ctex(key, w, h, draw, opts = {}) {
  return memo('t:' + key, () => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  });
}
// Textur-Klone mit eigener Wiederholung (teilen sich die Bilddaten)
export const rep = (t, rx, ry) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };

// ---------------------------------------------------------------- Berlin: Putzfassade mit Fenstern (ein Geschoss, 'bays' Fensterachsen)
function bay(g, cx, lit, trim, glass) {
  const x0 = cx - 24;
  g.fillStyle = trim; g.fillRect(x0 - 6, 18, 60, 92);                       // Fensterrahmen
  g.fillStyle = glass; g.fillRect(x0, 26, 48, 76);                          // Glas (Leuchten kommt aus der Emissiv-Karte)
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x0 + 4, 30, 12, 68);
  g.fillStyle = trim; g.fillRect(cx - 2, 26, 4, 76); g.fillRect(x0, 60, 48, 4); // Sprossen
  g.beginPath(); g.moveTo(x0 - 12, 20); g.lineTo(cx, 4); g.lineTo(x0 + 60, 20); g.closePath(); g.fill(); // Giebelverdachung
  g.fillRect(x0 - 9, 102, 66, 8);                                           // Sohlbank
  g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x0 - 6, 110, 60, 3);
}
export function facadeTile(base, trim, bays, emissive = false) {
  const lits = rnd(hashS(base + bays)); const L = Array.from({ length: bays }, () => lits() < 0.58);
  return ctex(`fac${emissive ? 'e' : ''}:${base}:${trim}:${bays}`, 128 * bays, 128, (g, W, H) => {
    if (emissive) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); for (let b = 0; b < bays; b++) if (L[b]) { g.fillStyle = '#ffe2a8'; g.fillRect(b * 128 + 64 - 24, 26, 48, 76); } return; }
    const r = rnd(hashS(base) + bays);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < W * 2; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.02 + r() * 0.035})`; g.fillRect(r() * W, r() * H, 2 + r() * 3, 2 + r() * 3); }
    g.fillStyle = trim; g.fillRect(0, H - 10, W, 10); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, H - 10, W, 2);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, 0, 6, H); g.fillRect(W - 6, 0, 6, H);                // Lisenen an den Ecken
    for (let b = 0; b < bays; b++) bay(g, b * 128 + 64, L[b], trim, '#3a4658');
  });
}
export const ironRep = (rx) => { const c = ironTex().clone(); c.repeat.set(rx, 1); c.needsUpdate = true; return c; };
export const ironTex = () => ctex('iron', 128, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = '#1a1a1e'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 5); g.lineTo(w, 5); g.moveTo(0, h - 5); g.lineTo(w, h - 5); g.stroke(); g.lineWidth = 3;
  for (let x = 8; x < w; x += 16) { g.beginPath(); g.moveTo(x, 5); g.lineTo(x, h - 5); g.stroke(); g.beginPath(); g.arc(x + 8, h / 2, 8, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x + 8, 8); g.quadraticCurveTo(x + 16, h / 2, x + 8, h - 8); g.stroke(); }
});
export const awningTex = (c1, c2) => ctex(`aw:${c1}${c2}`, 64, 64, g => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * 8, 0, 8, 64); } g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, 56, 64, 8); });

// ---------------------------------------------------------------- Rookburgh: genietete Metallplatten, Zahnrad
export const platesTex = (tint = '#3c3f46') => ctex('plates' + tint, 256, 256, (g, W, H) => {
  const r = rnd(hashS(tint)); g.fillStyle = tint; g.fillRect(0, 0, W, H);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = (r() - 0.5) * 22; g.fillStyle = `rgba(${v > 0 ? '255,235,210' : '0,0,0'},${Math.abs(v) / 100})`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; g.strokeRect(x * 64 + 1.5, y * 64 + 1.5, 61, 61);
    g.fillStyle = 'rgba(190,150,100,.9)'; for (const [ox, oy] of [[8, 8], [56, 8], [8, 56], [56, 56]]) { g.beginPath(); g.arc(x * 64 + ox, y * 64 + oy, 2.6, 0, TAU); g.fill(); }
  }
  for (let i = 0; i < 380; i++) { g.fillStyle = `rgba(${150 + r() * 60},${70 + r() * 30},30,${0.04 + r() * 0.07})`; g.fillRect(r() * W, r() * H, 4 + r() * 8, 2 + r() * 14); } // Rost
});
export const gearTex = () => ctex('gear', 128, 128, (g, W) => {
  g.clearRect(0, 0, W, W); const cx = W / 2, R = 56, teeth = 14; g.fillStyle = '#b87333'; g.strokeStyle = '#4a2a10'; g.lineWidth = 3;
  g.beginPath(); for (let i = 0; i < teeth * 2; i++) { const a = i / (teeth * 2) * TAU, rr = i % 2 ? R - 8 : R; g.lineTo(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#6a4a2a'; g.beginPath(); g.arc(cx, cx, 34, 0, TAU); g.fill(); g.clearRect(cx - 4, cx - 4, 8, 8);
  g.strokeStyle = '#3a2410'; g.lineWidth = 6; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a) * 10, cx + Math.sin(a) * 10); g.lineTo(cx + Math.cos(a) * 33, cx + Math.sin(a) * 33); g.stroke(); }
  g.fillStyle = '#d8a050'; g.beginPath(); g.arc(cx, cx, 9, 0, TAU); g.fill();
});

// ---------------------------------------------------------------- Mexico: Putz in kräftigen Farben, Bodenfliesen, Glyphen
export const plasterTex = color => ctex('pl:' + color, 256, 256, (g, W, H) => {
  const r = rnd(hashS(color)); g.fillStyle = color; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '90,50,20' : '255,240,210'},${0.03 + r() * 0.05})`; g.fillRect(r() * W, r() * H, 2 + r() * 4, 2 + r() * 4); }
  g.fillStyle = 'rgba(60,30,10,.16)'; g.fillRect(0, H - 38, W, 38);                 // Sockel
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, 10, W, 8); g.fillRect(0, H - 40, W, 3);
});
export const tilesTex = () => ctex('mtiles', 256, 256, (g, W) => {
  const cols = ['#c8402a', '#e8a020', '#2a8a9a', '#f0e6c8', '#3a5aa8']; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = cols[(x + y) % 2 ? 3 : (x * 3 + y) % 3]; g.fillRect(x * 32, y * 32, 32, 32); g.strokeStyle = 'rgba(0,0,0,.25)'; g.strokeRect(x * 32 + .5, y * 32 + .5, 31, 31);
    g.fillStyle = cols[(x + 2 * y) % 5]; g.beginPath(); g.arc(x * 32 + 16, y * 32 + 16, 8, 0, TAU); g.fill();
  }
});
export const glyphTex = (tint = '#e0b060', bg = '#6a5a48') => ctex('gl:' + tint + bg, 256, 64, (g, W, H) => {
  g.fillStyle = bg; g.fillRect(0, 0, W, H); const r = rnd(hashS(tint)); g.strokeStyle = tint; g.lineWidth = 4;
  for (let i = 0; i < 8; i++) { const x = i * 32 + 16; g.beginPath(); const k = Math.floor(r() * 4);
    if (k === 0) { g.rect(x - 9, 14, 18, 18); g.moveTo(x - 9, 40); g.lineTo(x + 9, 40); } else if (k === 1) { g.arc(x, 24, 10, 0, TAU); g.moveTo(x, 36); g.lineTo(x, 56); }
    else if (k === 2) { g.moveTo(x - 10, 50); g.lineTo(x, 10); g.lineTo(x + 10, 50); g.moveTo(x - 6, 34); g.lineTo(x + 6, 34); } else { g.moveTo(x - 10, 12); g.lineTo(x + 10, 12); g.lineTo(x - 10, 52); g.lineTo(x + 10, 52); }
    g.stroke(); }
});
export const stoneTintTex = (c = '#8a8070') => ctex('st:' + c, 256, 256, (g, W, H) => {
  const r = rnd(hashS(c)); g.fillStyle = c; g.fillRect(0, 0, W, H);
  for (let y = 0; y < 8; y++) for (let x = -1; x < 5; x++) { const v = (r() - 0.5) * 36; g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 240 : 0},${v > 0 ? 220 : 0},${Math.abs(v) / 120})`; g.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28); g.strokeStyle = 'rgba(0,0,0,.3)'; g.strokeRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28); }
});

// ---------------------------------------------------------------- Mystery: Runen
export const runeTex = (glow = '#7ab0ff') => ctex('rune' + glow, 128, 256, (g, W, H) => {
  g.fillStyle = '#23262c'; g.fillRect(0, 0, W, H); const r = rnd(hashS(glow)); g.strokeStyle = glow; g.lineWidth = 5; g.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const y = 24 + i * 46, k = Math.floor(r() * 5); g.beginPath();
    if (k === 0) { g.moveTo(40, y - 14); g.lineTo(88, y + 14); g.moveTo(88, y - 14); g.lineTo(40, y + 14); } else if (k === 1) { g.arc(64, y, 16, 0, TAU); g.moveTo(64, y - 22); g.lineTo(64, y + 22); }
    else if (k === 2) { g.moveTo(44, y + 16); g.lineTo(64, y - 18); g.lineTo(84, y + 16); g.lineTo(44, y + 16); } else if (k === 3) { g.moveTo(40, y); g.lineTo(88, y); g.moveTo(64, y - 18); g.lineTo(64, y + 18); g.moveTo(48, y - 10); g.lineTo(80, y + 10); }
    else { g.moveTo(48, y - 18); g.quadraticCurveTo(96, y, 48, y + 18); } g.stroke(); }
});
export const runeGlowTex = (glow = '#7ab0ff') => ctex('runeG' + glow, 128, 256, (g, W, H) => { // gleiche Zeichen auf Schwarz (Leuchtkarte)
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); const r = rnd(hashS(glow)); g.strokeStyle = glow; g.lineWidth = 5; g.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const y = 24 + i * 46, k = Math.floor(r() * 5); g.beginPath();
    if (k === 0) { g.moveTo(40, y - 14); g.lineTo(88, y + 14); g.moveTo(88, y - 14); g.lineTo(40, y + 14); } else if (k === 1) { g.arc(64, y, 16, 0, TAU); g.moveTo(64, y - 22); g.lineTo(64, y + 22); }
    else if (k === 2) { g.moveTo(44, y + 16); g.lineTo(64, y - 18); g.lineTo(84, y + 16); g.lineTo(44, y + 16); } else if (k === 3) { g.moveTo(40, y); g.lineTo(88, y); g.moveTo(64, y - 18); g.lineTo(64, y + 18); g.moveTo(48, y - 10); g.lineTo(80, y + 10); }
    else { g.moveTo(48, y - 18); g.quadraticCurveTo(96, y, 48, y + 18); } g.stroke(); }
}, { linear: false });

// ---------------------------------------------------------------- Afrika: Wandmuster
export const muralTex = v => ctex('mur' + v, 256, 128, (g, W, H) => {
  const bases = ['#c98a5a', '#b8703e', '#d8a870'], pal = [['#f4ecd8', '#2a1a10', '#a8301a'], ['#f4ecd8', '#3a2418', '#2a6a3a'], ['#2a1a10', '#e8c060', '#f4ecd8']][v % 3];
  g.fillStyle = bases[v % 3]; g.fillRect(0, 0, W, H); const r = rnd(7 + v);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '70,35,15' : '255,225,190'},.07)`; g.fillRect(r() * W, r() * H, 3, 3); }
  g.fillStyle = pal[1]; g.fillRect(0, 70, W, 26);
  for (let x = 0; x < W; x += 24) { g.fillStyle = pal[0]; g.beginPath(); g.moveTo(x, 96); g.lineTo(x + 12, 72); g.lineTo(x + 24, 96); g.fill(); g.fillStyle = pal[2]; g.beginPath(); g.moveTo(x + 6, 70); g.lineTo(x + 12, 82); g.lineTo(x + 18, 70); g.fill(); }
  g.strokeStyle = pal[0]; g.lineWidth = 4; g.beginPath(); for (let x = 0; x <= W; x += 16) g.lineTo(x, 20 + (x / 16 % 2) * 12); g.stroke();
  g.fillStyle = 'rgba(60,30,10,.2)'; g.fillRect(0, H - 22, W, 22);
});

// ---------------------------------------------------------------- China: Gitter, glasierte Ziegel
export const latticeTex = () => ctex('lat', 128, 128, (g, W) => {
  g.clearRect(0, 0, W, W); g.strokeStyle = '#7a1a14'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, W - 6); g.lineWidth = 4;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * 32, 4); g.lineTo(i * 32, W - 4); g.moveTo(4, i * 32); g.lineTo(W - 4, i * 32); g.stroke(); }
  g.beginPath(); g.moveTo(4, 4); g.lineTo(W - 4, W - 4); g.moveTo(W - 4, 4); g.lineTo(4, W - 4); g.stroke(); g.beginPath(); g.arc(W / 2, W / 2, 26, 0, TAU); g.stroke();
});
export const glazedTex = (c1 = '#1f6a4c', c2 = '#2a8a5e') => ctex(`gz${c1}${c2}`, 128, 128, (g, W) => {
  g.fillStyle = c1; g.fillRect(0, 0, W, W); for (let y = 0; y < 8; y++) for (let x = -1; x < 8; x++) { g.fillStyle = (x + y) % 2 ? c2 : c1; g.beginPath(); g.arc(x * 16 + (y % 2) * 8 + 8, y * 16 + 4, 9, 0, Math.PI); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(0, 0, W, 6);
});

// ---------------------------------------------------------------- Fantasy: Pilzpunkte, Zuckerstreifen
export const spotsTex = (base = '#d8405a') => ctex('spots' + base, 256, 256, (g, W) => {
  g.fillStyle = base; g.fillRect(0, 0, W, W); const r = rnd(hashS(base)); g.fillStyle = '#fff6ea';
  for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(r() * W, r() * W, 10 + r() * 16, 0, TAU); g.fill(); }
});
export const candyTex = (c1 = '#e8407a', c2 = '#fff4f0') => ctex(`cand${c1}${c2}`, 64, 128, (g, W, H) => { for (let i = -4; i < 12; i++) { g.fillStyle = i % 2 ? c2 : c1; g.beginPath(); g.moveTo(0, i * 16); g.lineTo(W, i * 16 - 24); g.lineTo(W, i * 16 - 8); g.lineTo(0, i * 16 + 16); g.fill(); } });

// ---------------------------------------------------------------- Geometrie: geschwungenes Walmdach mit hochgezogenen Ecken (chinesischer Stil)
export function curvedRoofGeo(w, d, h, lift = 0.9) {
  const g = new THREE.ConeGeometry(1, 1, 40, 10, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = Math.min(1, Math.hypot(x, z)), th = Math.atan2(z, x), sq = 1 / Math.max(Math.abs(Math.cos(th)), Math.abs(Math.sin(th))), c = (sq - 1) / 0.4142;
    const ny = h * Math.pow(1 - t, 1.75) + lift * Math.pow(t, 5) * (0.35 + 0.65 * c) - lift * 0.35 * Math.pow(t, 5);
    p.setXYZ(i, x * sq * w / 2, ny, z * sq * d / 2);
  }
  g.computeVertexNormals(); return g;
}
// Torbogen-Rahmen (Rechteck mit Rundbogen oben, innen ausgeschnitten)
export function archGeo(w, h, depth = 0.4, frame = 0.28) {
  const s = new THREE.Shape(); const r = w / 2; s.moveTo(-r - frame, 0); s.lineTo(-r - frame, h); s.absarc(0, h, r + frame, Math.PI, 0, true); s.lineTo(r + frame, 0); s.lineTo(r, 0); s.lineTo(r, h); s.absarc(0, h, r, 0, Math.PI, false); s.lineTo(-r, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 14 }); g.translate(0, 0, -depth / 2); return g;
}
export function lathe(points, seg = 18) { const g = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg); g.computeVertexNormals(); return g; }

// Neutrale (graue) Bodentextur: Halme/Körnung ohne eigenen Farbton – die Farbe je Themenwelt kommt über die Vertexfarben des Geländes
export const groundTex = () => ctex('ground', 512, 512, (g, W, H) => {
  const r = rnd(7); g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 7500; i++) { const x = r() * W, y = r() * H, l = 3 + r() * 8, v = 130 + Math.floor(r() * 110); g.strokeStyle = `rgba(${v},${v},${v},.55)`; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - l); g.stroke(); }
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '165,165,165' : '245,245,245'},.16)`; g.beginPath(); g.arc(r() * W, r() * H, 20 + r() * 70, 0, 7); g.fill(); }
});
