// Infrastruktur: Brücken (Vice Bay Bridge, Lakeside Bridge) und Tunnel (Ridge Tunnel)
import * as THREE from 'three';
import { BRIDGES, TUNNELS } from './consts.js';
import { terrainBase, tunnelFloor } from './world.js';

const CONC = 0xb9b7b0, DARK = 0x5d5f63, STEEL = 0xd7dadf;
export class Infra {
  constructor(lm) { this.lm = lm; this.c = lm.c; this.W = lm.W; }
  all() { for (const B of BRIDGES) this.bridge(B); for (const T of TUNNELS) this.tunnel(T); }

  bridge(B) {
    const W = this.W, c = this.c, hw = B.w / 2 + 0.7, step = 6;
    for (let x = B.x0; x < B.x1; x += step) {
      const xm = x + step / 2, x1 = Math.min(x + step, B.x1), y0 = B.y(x), y1 = B.y(x1), ym = (y0 + y1) / 2;
      const base = terrainBase(xm, B.z);
      const mb = W.mb(xm, B.z, 'concrete'), pl = W.mb(xm, B.z, 'plain');
      if (ym < base - 0.5 && base - ym > 3) continue; // Teil im Gelände (Einschnitt) – keine Brücke nötig
      const ref = [xm, ym - 3, B.z], top = [xm, ym + 3, B.z];
      const P = (xx, yy, zz) => [xx, yy, zz];
      const t = 1.6;
      // Träger: Unterseite + Seiten
      mb.quadO(P(x, y0 - t, B.z - hw), P(x1, y1 - t, B.z - hw), P(x1, y1 - t, B.z + hw), P(x, y0 - t, B.z + hw), [0.62, 0.62, 0.62], top);
      mb.quadO(P(x, y0 - t, B.z - hw), P(x1, y1 - t, B.z - hw), P(x1, y1 + 0.05, B.z - hw), P(x, y0 + 0.05, B.z - hw), [0.8, 0.8, 0.8], [xm, ym, B.z]);
      mb.quadO(P(x, y0 - t, B.z + hw), P(x1, y1 - t, B.z + hw), P(x1, y1 + 0.05, B.z + hw), P(x, y0 + 0.05, B.z + hw), [0.8, 0.8, 0.8], [xm, ym, B.z]);
      // Randstreifen (Gehweg) neben der Fahrbahn
      for (const s of [-1, 1]) {
        mb.quadO(P(x, y0 + 0.1, B.z + s * (B.w / 2 - 0.4)), P(x1, y1 + 0.1, B.z + s * (B.w / 2 - 0.4)), P(x1, y1 + 0.1, B.z + s * hw), P(x, y0 + 0.1, B.z + s * hw), [0.78, 0.78, 0.76], ref);
        // Brüstung
        const pz = B.z + s * (hw - 0.15);
        pl.quadO(P(x, y0 + 0.1, pz - 0.15 * s), P(x1, y1 + 0.1, pz - 0.15 * s), P(x1, y1 + 1.1, pz - 0.15 * s), P(x, y0 + 1.1, pz - 0.15 * s), [0.7, 0.7, 0.72], [xm, ym + 0.5, B.z]);
        pl.quadO(P(x, y0 + 1.1, pz - 0.15 * s), P(x1, y1 + 1.1, pz - 0.15 * s), P(x1, y1 + 1.1, pz + 0.15 * s), P(x, y0 + 1.1, pz + 0.15 * s), [0.82, 0.82, 0.82], ref);
        pl.quadO(P(x, y0 + 0.1, pz + 0.15 * s), P(x1, y1 + 0.1, pz + 0.15 * s), P(x1, y1 + 1.1, pz + 0.15 * s), P(x, y0 + 1.1, pz + 0.15 * s), [0.7, 0.7, 0.72], [xm, ym + 0.5, B.z]);
      }
    }
    // Brüstungs-Kollision (in 12-m-Stücken) + Pfeiler + Laternen
    for (let x = B.x0; x < B.x1; x += 12) {
      const xm = x + 6, ym = B.y(xm);
      if (ym < terrainBase(xm, B.z) - 0.5) continue;
      for (const s of [-1, 1]) W.addBox(xm, B.z + s * (hw - 0.2), 12.4, 0.5, 1.6, 'rail', ym - 0.4);
    }
    for (let x = B.x0 + 30; x < B.x1 - 20; x += 54) {
      const y = B.y(x), g = Math.max(terrainBase(x, B.z), -62);
      if (y - g < 4) continue;
      const pm = W.mb(x, B.z, 'concrete');
      for (const s of [-1, 1]) pm.cyl(x, g, B.z + s * 4.6, 1.5, y - 1.6 - g, 10, CONC);
      pm.box(x, y - 3.2, B.z, 3.2, 1.6, B.w + 1, { col: CONC, uvs: 3 });
      { const c1 = W.addCircle(x, B.z - 4.6, 1.6, y - 2, 'pier'); const c2 = W.addCircle(x, B.z + 4.6, 1.6, y - 2, 'pier'); c1.y0 = c2.y0 = Math.min(0, g); c1.h = c2.h = y - 2 - c1.y0; }
    }
    for (let x = B.x0 + 24; x < B.x1 - 10; x += 40) {
      const y = B.y(x); if (y < terrainBase(x, B.z) - 0.5) continue;
      for (const s of [-1, 1]) {
        W.mb(x, B.z, 'metal').cyl(x, y, B.z + s * (hw - 0.3), 0.12, 7, 6, DARK);
        W.mb(x, B.z, 'lamp').box(x, y + 6.9, B.z + s * (hw - 1.1), 0.5, 0.15, 1.6, { col: [1, 0.92, 0.7], uvs: 1 });
      }
    }
    // Pylone + Schrägseile
    for (const px of B.pylons) {
      const y = B.y(px), g = Math.max(terrainBase(px, B.z), -62), top = y + 46;
      const mb = W.mb(px, B.z, 'concrete');
      for (const s of [-1, 1]) mb.box(px, g, B.z + s * (hw + 0.9), 2.4, top - g, 2.4, { col: STEEL, uvs: 3 });
      mb.box(px, y + 22, B.z, 2.0, 1.8, B.w + 5, { col: STEEL, uvs: 3 }); mb.box(px, top - 2, B.z, 2.0, 1.8, B.w + 5, { col: STEEL, uvs: 3 });
      const pts = [];
      for (let k = 1; k <= 9; k++) for (const dir of [-1, 1]) for (const s of [-1, 1]) {
        const dx = dir * k * 15; const xx = px + dx; if (xx < B.x0 + 4 || xx > B.x1 - 4) continue;
        pts.push(px, top - 3 - (k - 1) * 0.9, B.z + s * (hw + 0.9), xx, B.y(xx) + 1.2, B.z + s * (hw - 0.3));
      }
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const ln = new THREE.LineSegments(g2, new THREE.LineBasicMaterial({ color: 0xeeeeee })); ln.frustumCulled = false; W.addExtra(px, B.z, ln);
      for (const s of [-1, 1]) { const cc = W.addCircle(px, B.z + s * (hw + 0.9), 1.6, top, 'pier'); cc.y0 = Math.min(0, g); cc.h = top - cc.y0; }
    }
    // Schilder an beiden Enden + Kartenbeschriftung
    c.addSign(B.name.toUpperCase(), B.x0 + 14, Math.max(B.y(B.x0 + 14), terrainBase(B.x0 + 14, B.z)) + 6.5, B.z - hw - 1.6, Math.PI / 2, 14, 2.4, '#40c4ff');
    W.pois.push({ id: 'bridge_' + B.id, kind: 'landmark', name: B.name, x: (B.x0 + B.x1) / 2, z: B.z, r: 0 });
  }

  tunnel(T) {
    const W = this.W, c = this.c, hw = T.w / 2, H = 7.2, step = 10;
    const flo = (z) => tunnelFloor(T, z);
    // Wände, Decke, Dach, Lampen
    for (let z = T.a; z < T.b; z += step) {
      const z1 = Math.min(z + step, T.b), zm = (z + z1) / 2, f0 = flo(z), f1 = flo(z1), fm = (f0 + f1) / 2;
      const cm = W.mb(T.c, zm, 'concrete');
      for (const s of [-1, 1]) {
        const x = T.c + s * (hw - 0.3);
        cm.quadO([x, f0 - 0.3, z], [x, f0 + H, z], [x, f1 + H, z1], [x, f1 - 0.3, z1], [0.78, 0.78, 0.76], [T.c + s * 30, fm + 3, zm]);
      }
      cm.quadO([T.c - hw, f0 + H, z], [T.c + hw, f0 + H, z], [T.c + hw, f1 + H, z1], [T.c - hw, f1 + H, z1], [0.55, 0.55, 0.55], [T.c, fm + H + 30, zm]);
      // Dach (Außenseite) – folgt dem ursprünglichen Gelände
      const gm = W.mb(T.c, zm, 'grass');
      const RW = hw + 7; const xs = [-RW, -hw, 0, hw, RW];
      for (let i = 0; i < xs.length - 1; i++) {
        const ya = Math.max(f0 + H + 0.4, terrainBase(T.c + xs[i], z)), yb = Math.max(f0 + H + 0.4, terrainBase(T.c + xs[i + 1], z));
        const yc = Math.max(f1 + H + 0.4, terrainBase(T.c + xs[i + 1], z1)), yd = Math.max(f1 + H + 0.4, terrainBase(T.c + xs[i], z1));
        gm.quadO([T.c + xs[i], ya, z], [T.c + xs[i + 1], yb, z], [T.c + xs[i + 1], yc, z1], [T.c + xs[i], yd, z1], [0.42, 0.55, 0.3], [T.c, Math.min(ya, yb, yc, yd) - 40, zm], [0, 0, 1, 0, 1, 1, 0, 1]);
      }
      // Seitenflächen des Dachs bis zum Boden der Röhre
      for (const s of [-1, 1]) {
        const x = T.c + s * (hw + 7);
        const ya = Math.max(f0 + H + 0.4, terrainBase(x, z)), yc = Math.max(f1 + H + 0.4, terrainBase(x, z1));
        gm.quadO([x, f0 - 0.5, z], [x, ya, z], [x, yc, z1], [x, f1 - 0.5, z1], [0.4, 0.38, 0.33], [T.c, fm + 4, zm], [0, 0, 1, 0, 1, 1, 0, 1]);
      }
      if (((z - T.a) / step) % 2 === 0) W.mb(T.c, zm, 'lamp').box(T.c, fm + H - 0.15, zm, 5, 0.12, 0.5, { col: [1, 0.95, 0.8], uvs: 1 });
    }
    // Kollision der Wände + Portale
    const fMin = Math.min(flo(T.a), flo(T.b));
    W.addBox(T.c - hw - 0.3, (T.a + T.b) / 2, 1.2, T.b - T.a, 60, 'wall', fMin - 3);
    W.addBox(T.c + hw + 0.3, (T.a + T.b) / 2, 1.2, T.b - T.a, 60, 'wall', fMin - 3);
    for (const z of [T.a, T.b]) {
      const f = flo(z), cm = W.mb(T.c, z, 'concrete');
      for (const s of [-1, 1]) cm.box(T.c + s * (hw + 0.2), f - 0.3, z, 1.8, H + 2.3, 2.2, { col: CONC, uvs: 3 });
      cm.box(T.c, f + H, z, T.w + 3.8, 2.0, 2.4, { col: CONC, uvs: 3 });
      c.addSign(T.name.toUpperCase(), T.c, f + H + 3.4, z + (z === T.a ? -1 : 1) * 1.4, z === T.a ? Math.PI : 0, 12, 2.2, '#ffd54f');
    }
    W.pois.push({ id: 'tunnel_' + T.id, kind: 'landmark', name: T.name, x: T.c, z: (T.a + T.b) / 2, r: 0 });
  }
}
