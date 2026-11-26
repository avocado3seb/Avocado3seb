// ============================================================================
//  coasterMesh.js – Schienen, Träger, Stützen und Station einer Achterbahn
// ============================================================================
import * as THREE from 'three';
import { Batch, hex, shade, circleSection, rectSection } from './batch.js';
import { CATS } from './specs.js';
import { ZONE } from './track.js';
import { textures, signTexture } from './textures.js';

const WOOD = [0.52, 0.36, 0.2], WOOD_D = [0.4, 0.27, 0.15];

export function buildCoasterMesh(tr, coaster, opts = {}) {
  const spec = CATS[coaster.cat] || CATS.sitdown;
  const style = spec.style;
  const col = hex(coaster.trackColor), sup = hex(coaster.supportColor);
  const yOff = opts.yOff || 0;
  const N = tr.N;
  const group = new THREE.Group();
  group.name = 'track:' + coaster.name;

  const P = tr.P, U = tr.U, R = tr.R;
  const frame = (i, offU, offR = 0) => {
    i = ((i % N) + N) % N;
    const j = i * 3;
    return {
      p: [P[j] + U[j] * offU + R[j] * offR, P[j + 1] + U[j + 1] * offU + R[j + 1] * offR + yOff, P[j + 2] + U[j + 2] * offU + R[j + 2] * offR],
      r: [R[j], R[j + 1], R[j + 2]], u: [U[j], U[j + 1], U[j + 2]],
    };
  };

  const trackB = new Batch();   // Schienen + Hauptträger (Streckenfarbe)
  const supB = new Batch();     // Stützen
  const woodB = new Batch();    // Holz
  const darkB = new Batch();    // dunkle Teile (Schwellen, Verbinder)

  // Abstände relativ zum Fahrerpfad p
  let railOff, spineOff, gauge = 0.72, railR = 0.075;
  const inverted = style === 'inv';
  if (inverted) { railOff = spec.clearance - 0.45; spineOff = spec.clearance + 0.1; gauge = 0.55; }
  else if (style === 'small') { railOff = -0.85; spineOff = -1.15; gauge = 0.55; railR = 0.055; }
  else { railOff = -1.0; spineOff = -1.55; }
  if (style === 'box') { gauge = 0.75; }

  // --- Schienen (zwei Rohre) ---
  const rail = circleSection(railR, 6);
  for (const side of [-1, 1]) {
    trackB.sweep(N, i => frame(i, railOff, side * gauge), rail.verts, rail.segs, shade(col, 1.0), 1, true);
  }
  // --- Hauptträger ---
  if (style === 'box') {
    const sec = rectSection(0.55, 0.62, 0, 0);
    trackB.sweep(N, i => frame(i, spineOff + 0.1, 0), sec.verts, sec.segs, shade(col, 0.92), 1, true);
  } else if (style === 'tube') {
    const sec = circleSection(0.2, 7);
    trackB.sweep(N, i => frame(i, spineOff + 0.15, 0), sec.verts, sec.segs, shade(col, 0.85), 1, true);
  } else if (style === 'inv') {
    const sec = rectSection(0.7, 0.55, 0, 0);
    trackB.sweep(N, i => frame(i, spineOff + 0.05, 0), sec.verts, sec.segs, shade(col, 0.9), 1, true);
  } else if (style === 'small') {
    const sec = circleSection(0.14, 6);
    trackB.sweep(N, i => frame(i, spineOff + 0.1, 0), sec.verts, sec.segs, shade(col, 0.85), 1, true);
  } else if (style === 'wood') {
    // zwei Holzbalken unter den Schienen + Schwellen
    const sec = rectSection(0.34, 0.42, 0, 0);
    for (const side of [-1, 1]) woodB.sweep(N, i => frame(i, railOff - 0.3, side * gauge), sec.verts, sec.segs, WOOD, 1, true);
    const mid = rectSection(0.3, 0.5, 0, 0);
    woodB.sweep(N, i => frame(i, railOff - 0.65, 0), mid.verts, mid.segs, WOOD_D, 1, true);
  }

  // --- Verbinder / Schwellen ---
  const tieStride = style === 'wood' ? 1 : style === 'small' ? 2 : 3;
  for (let i = 0; i < N; i += tieStride) {
    const f = frame(i, 0), j = ((i % N) * 3);
    const t = [tr.T[j], tr.T[j + 1], tr.T[j + 2]];
    if (style === 'wood') {
      darkB.obox([f.p[0] + f.u[0] * (railOff - 0.12), f.p[1] + f.u[1] * (railOff - 0.12) - 0 , f.p[2] + f.u[2] * (railOff - 0.12)], t, f.u, f.r, 0.2, 0.1, gauge * 2 + 0.5, [0.3, 0.2, 0.12]);
    } else {
      const o = railOff - 0.1;
      const c = [f.p[0] + f.u[0] * o, f.p[1] + f.u[1] * o, f.p[2] + f.u[2] * o];
      darkB.obox(c, t, f.u, f.r, 0.14, 0.09, gauge * 2 + 0.2, shade(col, 0.7));
      // Verbindung Schiene -> Träger (V-Strebe)
      const ctr = [f.p[0] + f.u[0] * (spineOff + 0.2), f.p[1] + f.u[1] * (spineOff + 0.2), f.p[2] + f.u[2] * (spineOff + 0.2)];
      for (const sd of [-1, 1]) {
        const e = [f.p[0] + f.u[0] * railOff + f.r[0] * gauge * sd, f.p[1] + f.u[1] * railOff + f.r[1] * gauge * sd, f.p[2] + f.u[2] * railOff + f.r[2] * gauge * sd];
        trackB.tube(ctr, e, 0.045, shade(col, 0.8), 4);
      }
    }
  }

  // --- Stützen ---
  const stride = style === 'wood' ? 5 : style === 'small' ? 14 : 11;
  const sample = Math.max(1, Math.round(stride));
  let flip = 1;
  const minTop = 1.2;
  const topOff = inverted ? spineOff + 0.4 : spineOff - 0.35;
  for (let i = 0; i < N; i += sample) {
    const j = i * 3;
    const tx = tr.T[j], ty = tr.T[j + 1], tz = tr.T[j + 2];
    const upY = U[j + 1];
    // Mittelstütze nur wenn die Strecke "aufrecht" liegt, sonst seitlich versetzt
    const side = (upY > 0.6 && !inverted) ? 0 : (inverted ? 2.4 * flip : 2.6 * flip);
    if (Math.abs(ty) > 0.93) continue;
    const f = frame(i, topOff, side);
    const px = f.p[0], py = f.p[1], pz = f.p[2];
    // Stützenkopf: wenn die Strecke steil kopfüber liegt, ist py ggf. die Spitze
    const yTop = py;
    const yTopRail = (() => { const g = frame(i, topOff); return g.p[1]; })();
    if (yTopRail < minTop) continue;
    flip = -flip;
    const h = yTop;
    if (h < 0.8) continue;
    if (style === 'wood') {
      const cr = [f.r[0], 0, f.r[2]]; const ll = Math.hypot(cr[0], cr[2]) || 1; cr[0] /= ll; cr[2] /= ll;
      const tf = [tx, 0, tz]; const tl = Math.hypot(tf[0], tf[2]) || 1; tf[0] /= tl; tf[2] /= tl;
      const w = 1.5;
      const A = [px + cr[0] * w, yTop, pz + cr[2] * w], B = [px - cr[0] * w, yTop, pz - cr[2] * w];
      const A0 = [A[0], 0, A[2]], B0 = [B[0], 0, B[2]];
      woodB.tube(A0, A, 0.17, WOOD_D, 4); woodB.tube(B0, B, 0.17, WOOD_D, 4);
      for (let y = 3.5; y < yTop - 1; y += 3.5) {
        const a = [A[0], y, A[2]], b = [B[0], y, B[2]];
        woodB.tube(a, b, 0.09, WOOD, 4);
        const a2 = [A[0], Math.min(yTop, y + 3.5), A[2]], b2 = [B[0], Math.min(yTop, y + 3.5), B[2]];
        woodB.tube(a, b2, 0.07, WOOD, 4);
      }
      // Längsverstrebung
      if (yTop > 6) {
        const nxt = frame(i + sample, topOff);
        const nx = nxt.p[0], nz = nxt.p[2];
        if (Math.hypot(nx - px, nz - pz) < sample * 1.3) {
          woodB.tube([A[0], yTop * 0.45, A[2]], [nx + cr[0] * w, yTop * 0.05, nz + cr[2] * w], 0.06, WOOD, 4);
        }
      }
      woodB.tube([px, yTop, pz], [px, yTop - 0.9, pz], 0.0, WOOD, 3);
    } else {
      const r = Math.min(0.55, 0.12 + h * 0.0075) * (style === 'small' ? 0.6 : 1);
      supB.tube([px, 0, pz], [px, yTop, pz], r, sup, style === 'small' ? 5 : 8);
      supB.box(px, 0.12, pz, r * 3.2, 0.25, r * 3.2, shade(sup, 0.8));
      if (side !== 0) {
        const g = frame(i, topOff, 0);
        supB.tube([g.p[0], g.p[1] - 0.05, g.p[2]], [px, yTop - 0.05, pz], Math.max(0.1, r * 0.7), sup, 6);
      }
      // Querversteifung bei hohen Stützen
      if (h > 14) {
        for (let y = 10; y < h - 3; y += 12) {
          const nxt = frame(i + sample * 2, topOff, 0);
          if (nxt.p[1] > y + 2 && Math.hypot(nxt.p[0] - px, nxt.p[2] - pz) < 40) supB.tube([px, y, pz], [nxt.p[0], y + 1, nxt.p[2]], r * 0.28, sup, 5);
        }
      }
    }
  }

  const matTrack = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
  const matSup = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25, side: THREE.DoubleSide });
  const matWood = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide, map: textures.wood() });
  const addMesh = (b, m, cast) => { if (b.empty) return; const mesh = new THREE.Mesh(b.build(), m); mesh.castShadow = cast; mesh.receiveShadow = true; mesh.frustumCulled = true; group.add(mesh); return mesh; };
  addMesh(trackB, matTrack, true);
  addMesh(darkB, matTrack, false);
  addMesh(supB, matSup, false);
  addMesh(woodB, matWood, style === 'wood');

  return group;
}

// ---------------------------------------------------------------------------
//  Stationsgebäude (lokale Koordinaten: Station liegt auf x = 0 … stationLen, Gleis bei z = 0)
// ---------------------------------------------------------------------------
export function buildStation(tr, coaster, spec, yOff) {
  const g = new THREE.Group();
  const L = tr.stationLen || 28;
  const col = new THREE.Color(coaster.supportColor), col2 = new THREE.Color(coaster.trackColor);
  const platMat = new THREE.MeshStandardMaterial({ color: 0xb9b4a8, roughness: 0.9, map: textures.concrete() });
  const base = Math.max(0.2, yOff - 0.55);           // Bahnsteighöhe
  // Bahnsteige links/rechts
  for (const sd of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(L + 6, base, 3.4), platMat);
    m.position.set(L / 2 - 1, base / 2, sd * 2.6); m.receiveShadow = true; m.castShadow = true; g.add(m);
  }
  // Dach
  const roofMat = new THREE.MeshStandardMaterial({ color: col2, roughness: 0.6, metalness: 0.2 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(L + 8, 0.35, 10.5), roofMat);
  roof.position.set(L / 2 - 1, base + 4.6 + (spec.style === 'inv' ? 1.2 : 0), 0); roof.castShadow = true; g.add(roof);
  const postMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0.3 });
  for (let x = -2; x <= L + 1; x += (L + 3) / 4) for (const sd of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.7 + (spec.style === 'inv' ? 1.2 : 0), 6), postMat);
    p.position.set(x, base + 2.35 + (spec.style === 'inv' ? 0.6 : 0), sd * 4.6); g.add(p);
  }
  // Rampe/Treppe zum Boden wenn das Gleis erhöht liegt
  // Eingangsgebäude mit Namensschild
  const ent = new THREE.Group();
  ent.position.set(L * 0.5, 0, 17);
  const wall = new THREE.MeshStandardMaterial({ color: col.clone().lerp(new THREE.Color(0xffffff), 0.55), roughness: 0.8, map: textures.plaster() });
  const body = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 8), wall); body.position.y = 2.5; body.castShadow = true; body.receiveShadow = true; ent.add(body);
  const roof2 = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.5, 9.2), roofMat); roof2.position.y = 5.3; roof2.castShadow = true; ent.add(roof2);
  const signMat = new THREE.MeshBasicMaterial({ map: signTexture(coaster.name, coaster.trackColor, '#ffffff', coaster.park), transparent: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), signMat);
  sign.position.set(0, 7.2, 4.4); ent.add(sign);
  const signBack = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), signMat); signBack.position.set(0, 7.2, 4.35); signBack.rotation.y = Math.PI; ent.add(signBack);
  for (const sx of [-5.5, 5.5]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 0.3), postMat); pl.position.set(sx, 6.2, 4.3); ent.add(pl); }
  // Warteschlangen-Geländer
  const rail = new THREE.MeshStandardMaterial({ color: 0x555a60, metalness: 0.6, roughness: 0.4 });
  for (let k = 0; k < 4; k++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 0.08), rail); r.position.set(0, 1.0, -4 - k * 1.6 + 1.6); ent.add(r);
  }
  // Treppe zur Station
  const stairs = new THREE.Mesh(new THREE.BoxGeometry(2.4, base, 7), platMat); stairs.position.set(0, base / 2, -8); ent.add(stairs);
  g.add(ent);
  g.userData.entrance = new THREE.Vector3(L * 0.5, 0, 24);
  return g;
}
