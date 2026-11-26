// ============================================================================
//  pl_bridges.js – Brücken über bodennahe Schienen: wo ein Weg Gleise kreuzt, führt eine begehbare
//  Treppenbrücke mit Geländer darüber (Fahrzeuge fahren darunter durch).
// ============================================================================
import * as THREE from 'three';
import * as A from './pl_assets.js';

export function buildTrackBridges(world) {
  const out = world.out, G = world.group;
  const stone = new THREE.MeshStandardMaterial({ map: A.tex.stone(), color: 0xd8d0c0, roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ map: A.tex.planks('#6a4a2a'), roughness: 0.95 });
  const rail = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.8, metalness: 0.3 });
  const keep = [...world.rides.map(r => [r.entrance.x, r.entrance.z]), ...(world.stations || [])];
  const nearKeep = (x, z) => keep.some(k => Math.hypot(k[0] - x, k[1] - z) < 24);
  const CLEAR = 4.6, DY = 0.46, SL = 1.15; let count = 0; const spans = [];
  for (const e of world.edges) {
    const A_ = world.nodes[e[0]], B_ = world.nodes[e[1]], L = Math.hypot(B_.x - A_.x, B_.z - A_.z), w = Math.min(6, Math.max(3.6, e[2]));
    if (L < 40) continue;
    const ux = (B_.x - A_.x) / L, uz = (B_.z - A_.z) / L, flags = [];
    for (let t = 0; t <= L; t += 1) { const x = A_.x + ux * t, z = A_.z + uz * t; flags.push(!nearKeep(x, z) && world.nearTrackFast(x, z, 2.2, 2.8)); }
    let i = 0;
    while (i < flags.length) {
      if (!flags[i]) { i++; continue; }
      let j = i; while (j + 1 < flags.length && (flags[j + 1] || (() => { for (let k = 1; k <= 8; k++) if (flags[j + k]) return true; return false; })())) j++;
      const n = Math.ceil(CLEAR / DY), ramp = n * SL, t0 = i - 1.5 - ramp, t1 = j + 1.5 + ramp;
      i = j + 1;
      if (t0 < 3 || t1 > L - 3) continue; // kein Platz auf diesem Wegstück
      const h0 = world.h(A_.x + ux * t0, A_.z + uz * t0), h1 = world.h(A_.x + ux * t1, A_.z + uz * t1), hMid = Math.max(world.h(A_.x + ux * (t0 + ramp), A_.z + uz * (t0 + ramp)), world.h(A_.x + ux * (t1 - ramp), A_.z + uz * (t1 - ramp)));
      if (Math.abs(h0 - h1) > 1.2) continue;
      if (spans.some(s => Math.hypot(s[0] - (A_.x + ux * (t0 + t1) / 2), s[1] - (A_.z + uz * (t0 + t1) / 2)) < 26)) continue;
      spans.push([A_.x + ux * (t0 + t1) / 2, A_.z + uz * (t0 + t1) / 2]);
      const yTop = Math.max(h0, h1, hMid) + CLEAR, rot = Math.atan2(-uz, ux), g = new THREE.Group(); G.add(g);
      const place = (s0, s1, top, mat, thick) => { // Segment von s0..s1 (entlang des Wegs), Oberkante top
        const len = s1 - s0, cx = A_.x + ux * (t0 + (s0 + s1) / 2), cz = A_.z + uz * (t0 + (s0 + s1) / 2), base = Math.min(h0, h1) - 0.6, hh = top - base;
        const m = new THREE.Mesh(new THREE.BoxGeometry(len, thick ?? hh, w), mat); m.position.set(cx, thick ? top - thick / 2 : base + hh / 2, cz); m.rotation.y = rot; m.castShadow = m.receiveShadow = true; g.add(m);
        out.platforms.push({ flat: true, cx, cz, hx: len / 2 + 0.02, hz: w / 2, rot, yTop: top });
      };
      for (let k = 0; k < n; k++) { place(k * SL, (k + 1) * SL, h0 + (yTop - h0) * (k + 1) / n, stone); }                  // Stufen hinauf
      const deckS0 = n * SL, deckS1 = (t1 - t0) - n * SL;
      place(deckS0, deckS1, yTop, wood, 0.3);                                                                                // Brückendeck
      for (const sx of [0.4, 0.8]) { for (const sz of [-1, 1]) { const pier = new THREE.Mesh(new THREE.BoxGeometry(0.5, yTop - Math.min(h0, h1) + 0.6, 0.5), rail); const s = deckS0 + (deckS1 - deckS0) * sx * (sx === 0.4 ? 1 : 1) * (sx === 0.4 ? 0.5 : 1.0) * 0 + (deckS1 - deckS0) * (sx === 0.4 ? 0.1 : 0.9); pier.position.set(A_.x + ux * (t0 + s) - uz * sz * (w / 2 - 0.3), (yTop + Math.min(h0, h1) - 0.6) / 2, A_.z + uz * (t0 + s) + ux * sz * (w / 2 - 0.3)); g.add(pier); } }
      for (let k = 0; k < n; k++) { const y1 = h0 + (yTop - h0) * (k + 1) / n, y2 = h1 + (yTop - h1) * (k + 1) / n; place((t1 - t0) - (k + 1) * SL, (t1 - t0) - k * SL, Math.min(y1, y2), stone); } // Stufen hinab
      // Geländer (Optik + Kollision)
      const total = t1 - t0, mx = A_.x + ux * (t0 + total / 2), mz = A_.z + uz * (t0 + total / 2);
      for (const sz of [-1, 1]) {
        const ox = -uz * sz * (w / 2 + 0.06), oz = ux * sz * (w / 2 + 0.06);
        const dl = deckS1 - deckS0, dcx = A_.x + ux * (t0 + (deckS0 + deckS1) / 2) + ox, dcz = A_.z + uz * (t0 + (deckS0 + deckS1) / 2) + oz;
        const r1 = new THREE.Mesh(new THREE.BoxGeometry(dl, 0.1, 0.1), rail); r1.position.set(dcx, yTop + 1.05, dcz); r1.rotation.y = rot; g.add(r1);
        const r2 = new THREE.Mesh(new THREE.BoxGeometry(dl, 0.07, 0.07), rail); r2.position.set(dcx, yTop + 0.55, dcz); r2.rotation.y = rot; g.add(r2);
        for (let q = 0; q <= dl; q += 2.5) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), rail); p.position.set(A_.x + ux * (t0 + deckS0 + q) + ox, yTop + 0.55, A_.z + uz * (t0 + deckS0 + q) + oz); g.add(p); }
        out.colliders.push({ x: mx + ox, z: mz + oz, hx: total / 2, hz: 0.12, rot, y0: Math.min(h0, h1) - 0.5, y1: yTop + 1.4 });
      }
      world.bridgeMarkers = (world.bridgeMarkers || []); world.bridgeMarkers.push({ x: mx, z: mz }); count++;
    }
  }
  world.trackBridges = count;
}

// ---------------------------------------------------------------------------
// Einladende Eingangsplätze an jeder Bahn: gepflasterter Platz, Torbogen im Themenstil, Laternen, Wegweiser
export function buildEntrances(world) {
  const out = world.out, G = world.group; world.plazas = [];
  const paving = new THREE.MeshStandardMaterial({ map: A.tex.stone(), color: 0xe8e0d0, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const trim = { klugheim: 0x3a3a3e, africa: 0x6a4a2a, rookburgh: 0x4a3a30, mexico: 0xa05a2a, fantasy: 0x8a5ac8, china: 0xb02020, mystery: 0x3a4a5a, berlin: 0x5a4a3a };
  for (const r of world.rides) {
    const e = r.entrance, dx = r.dir[0], dz = r.dir[1], px = e.x + dx * 10, pz = e.z + dz * 10, y = world.h(px, pz);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(8.5, 28), paving); disc.rotation.x = -Math.PI / 2; disc.position.set(px, Math.max(0.1, y) + 0.14, pz); disc.receiveShadow = true; G.add(disc);
    world.plazas.push({ x: px, z: pz, r: 9 });
    const col = trim[r.zone] || 0x5a4a3a, m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }), rot = Math.atan2(dx, dz);
    // Torbogen am Beginn der Schlange (zwei Pfosten + Balken + Schild)
    const gx = e.x + dx * 3, gz = e.z + dz * 3, gy = world.h(gx, gz), g = new THREE.Group(); g.position.set(gx, gy, gz); g.rotation.y = rot; G.add(g);
    for (const s of [-1, 1]) { A.box(g, 0.7, 5.2, 0.7, m, s * 3.2, 2.6, 0); const wx = gx + s * 3.2 * Math.cos(rot), wz = gz - s * 3.2 * Math.sin(rot); out.colliders.push({ x: wx, z: wz, r: 0.5, y0: gy - 1, y1: gy + 5 }); out.glow.push([wx, gy + 4.6, wz, 1, 0.7, 0.35, 20]); out.lights.push({ x: wx, y: gy + 4.4, z: wz, color: 0xffa050, int: 4, range: 11, flicker: 0.25 }); }
    A.box(g, 7.6, 0.8, 0.8, m, 0, 5.4, 0);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = '#' + col.toString(16).padStart(6, '0'); c.fillRect(0, 0, 512, 96); c.strokeStyle = '#f0e0b0'; c.lineWidth = 5; c.strokeRect(5, 5, 502, 86); c.fillStyle = '#fff4d0'; c.font = '700 44px Georgia, serif'; c.textAlign = 'center'; c.fillText(r.coaster.name.slice(0, 22), 256, 62);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 1.28), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) })); sign.position.set(0, 6.4, 0.45); g.add(sign); const s2 = sign.clone(); s2.rotation.y = Math.PI; s2.position.z = -0.45; g.add(s2);
  }
}
