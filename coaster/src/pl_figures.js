// ============================================================================
//  pl_figures.js – detailliertere Besucherfiguren (weiterhin instanziert): Torso mit Armen und Gürtel,
//  zwei Beine mit Schuhen, Kopf mit Haaren, Händen und Nase. Vertexfarben × Instanzfarbe.
// ============================================================================
import * as THREE from 'three';

function merge(parts) {
  const pos = [], nor = [], col = [], idx = []; let off = 0;
  for (const [g0, c] of parts) {
    const g = g0.index ? g0 : g0.toNonIndexed(); const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c[0], c[1], c[2]); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); r.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); r.setIndex(idx); return r;
}
const bx = (w, h, d, x, y, z, rx = 0, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx || rz) g.rotateX(rx), g.rotateZ(rz); g.translate(x, y, z); return g; };
const sp = (r, x, y, z, sx = 1, sy = 1, sz = 1) => { const g = new THREE.SphereGeometry(r, 8, 6); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
const W = [1, 1, 1];

export function visitorGeometries() {
  // Oberkörper: Torso + Schultern + Arme (Ärmel) + Gürtel
  const body = merge([
    [bx(0.44, 0.58, 0.26, 0, 1.06, 0), W], [bx(0.5, 0.1, 0.28, 0, 1.31, 0), W],
    [bx(0.11, 0.5, 0.13, -0.3, 1.05, 0, 0, 0.06), [0.92, 0.92, 0.92]], [bx(0.11, 0.5, 0.13, 0.3, 1.05, 0, 0, -0.06), [0.92, 0.92, 0.92]],
    [bx(0.46, 0.06, 0.28, 0, 0.78, 0), [0.25, 0.2, 0.16]],
  ]);
  // Beine mit Lücke und Schuhen
  const legs = merge([
    [bx(0.16, 0.7, 0.18, -0.1, 0.4, 0), W], [bx(0.16, 0.7, 0.18, 0.1, 0.4, 0), W],
    [bx(0.18, 0.09, 0.3, -0.1, 0.045, 0.05), [0.12, 0.12, 0.13]], [bx(0.18, 0.09, 0.3, 0.1, 0.045, 0.05), [0.12, 0.12, 0.13]],
  ]);
  // Kopf: Hautton (Instanzfarbe) + Hände; Haare und Augen dunkel
  const head = merge([
    [sp(0.15, 0, 1.55, 0, 1, 1.08, 1), W], [sp(0.153, 0, 1.62, -0.015, 1, 0.62, 1), [0.22, 0.16, 0.11]], [bx(0.04, 0.06, 0.06, 0, 1.53, 0.15), [0.96, 0.9, 0.86]],
    [bx(0.025, 0.025, 0.02, -0.055, 1.57, 0.14), [0.05, 0.05, 0.06]], [bx(0.025, 0.025, 0.02, 0.055, 1.57, 0.14), [0.05, 0.05, 0.06]],
    [sp(0.055, -0.31, 0.74, 0), W], [sp(0.055, 0.31, 0.74, 0), W],
    [bx(0.1, 0.07, 0.1, 0, 1.38, 0), W],
  ]);
  return { body, legs, head };
}
