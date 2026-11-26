// ============================================================================
//  train.js – Zugmodelle für alle Kategorien (Sitz, Inverted, Floorless, Dive, Flying, Wing, Holz …)
// ============================================================================
import * as THREE from 'three';
import { Batch, hex, shade } from './batch.js';
import { CATS } from './specs.js';
import { poseAt, newPose } from './track.js';
import { mulberry32, hashStr } from './gen.js';

const SKIN = [[0.96, 0.78, 0.64], [0.85, 0.65, 0.5], [0.62, 0.42, 0.3], [0.45, 0.3, 0.22]];
const SHIRTS = ['#d83a3a', '#2f6fd6', '#f0c030', '#2fa860', '#f0f0f0', '#e0508a', '#ff8a2a', '#7a4cc0', '#222428', '#18b8c8'].map(hex);

export function seatLayout(spec) {
  const across = spec.across, rows = spec.rows || 1;
  const small = spec.style === 'small';
  const sw = small ? 0.52 : spec.rider === 'wing' ? 0.62 : spec.across >= 6 ? 0.6 : 0.64;
  const seats = [];
  const rowX = rows === 2 ? [spec.spacing * 0.22, -spec.spacing * 0.22] : [0.1];
  for (let r = 0; r < rows; r++) {
    for (let s = 0; s < across; s++) {
      let z;
      if (spec.rider === 'wing') { const side = s < across / 2 ? -1 : 1; const j = s % (across / 2); z = side * (1.05 + j * sw); }
      else z = (s - (across - 1) / 2) * sw;
      seats.push({ row: r, s, x: rowX[r], z, y: 0 });
    }
  }
  return { seats, sw, rowX };
}

function rider(b, seat, spec, rng, armsUp) {
  const shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)], skin = SKIN[Math.floor(rng() * SKIN.length)];
  const hair = [[0.1, 0.07, 0.05], [0.35, 0.2, 0.1], [0.8, 0.65, 0.3], [0.5, 0.5, 0.5]][Math.floor(rng() * 4)];
  const x = seat.x, z = seat.z;
  const sc = spec.style === 'small' ? 0.85 : 1;
  if (spec.rider === 'fly') {
    // liegend in Bauchlage (Kopf nach vorn, Arme am Körper, Beine gestreckt)
    b.box(x, 0.16, z, 0.95 * sc, 0.26, 0.46, shirt);
    b.box(x + 0.62, 0.3, z, 0.24, 0.24, 0.24, skin); b.box(x + 0.62, 0.43, z, 0.26, 0.09, 0.26, hair);
    b.box(x - 0.85, 0.1, z, 0.85, 0.2, 0.36, [0.18, 0.2, 0.3]);
    b.box(x + 0.15, 0.22, z - 0.3, 0.55, 0.12, 0.12, shirt); b.box(x + 0.15, 0.22, z + 0.3, 0.55, 0.12, 0.12, shirt);
    return;
  }
  b.box(x - 0.04, 0.42 * sc, z, 0.3, 0.5 * sc, 0.4, shirt);          // Oberkörper
  b.box(x + 0.02, 0.84 * sc, z, 0.22, 0.24, 0.22, skin);              // Kopf
  b.box(x, 0.97 * sc, z, 0.24, 0.1, 0.24, hair);                       // Haare
  b.box(x + 0.22, 0.05, z, 0.46, 0.18, 0.34, [0.2, 0.22, 0.32]);      // Oberschenkel
  if (spec.rider === 'sit' || spec.rider === 'spin') b.box(x + 0.5, -0.22, z, 0.18, 0.5, 0.3, [0.2, 0.22, 0.32]);
  else b.box(x + 0.4, -0.5, z, 0.2, 0.9, 0.3, [0.2, 0.22, 0.32]);    // baumelnde Beine
  if (armsUp) { b.box(x, 1.1 * sc, z - 0.24, 0.1, 0.5, 0.1, shirt); b.box(x, 1.1 * sc, z + 0.24, 0.1, 0.5, 0.1, shirt); }
  else { b.box(x + 0.18, 0.3, z - 0.24, 0.4, 0.1, 0.1, shirt); b.box(x + 0.18, 0.3, z + 0.24, 0.4, 0.1, 0.1, shirt); }
}

function buildCar(spec, coaster, idx, count, rng) {
  const body = new Batch(), riders = new Batch(), lights = new Batch();
  const { seats, sw } = seatLayout(spec);
  const tcol = hex(coaster.trainColor || coaster.trackColor), acc = hex(coaster.trainAccent || coaster.supportColor);
  const dark = [0.12, 0.13, 0.15], seatC = [0.1, 0.1, 0.12];
  const L = spec.spacing * 0.93;
  const W = spec.across * sw + 0.45;
  const first = idx === 0, last = idx === count - 1;
  const inv = spec.rider === 'inv' || spec.rider === 'fly';
  const clr = spec.clearance;
  const rows = spec.rows || 1;

  // Fahrwerk
  const railY = inv ? clr - 0.45 : spec.style === 'small' ? -0.85 : -1.0;
  const gauge = spec.style === 'box' ? 0.75 : spec.style === 'small' ? 0.55 : inv ? 0.55 : 0.72;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    body.box(sx * L * 0.33, railY + (inv ? -0.15 : 0.18), sz * gauge, 0.42, 0.3, 0.18, dark);
  }
  if (inv) {
    body.box(0, clr - 0.7, 0, L * 0.7, 0.28, 0.9, shade(tcol, 0.8));
  }
  if (spec.rider === 'wing') {
    body.box(0, -0.35, 0, L * 0.9, 0.4, 1.1, shade(tcol, 0.85));
    for (const sd of [-1, 1]) {
      body.box(0.1, -0.1, sd * 0.85, L * 0.55, 0.12, 0.9, tcol);
      body.box(0.1, -0.5, sd * 0.45, 0.2, 0.5, 0.2, dark);
    }
  } else if (!inv) {
    body.box(0, -0.42, 0, L, 0.3, W * 0.92, shade(tcol, 0.8));
    if (spec.rider !== 'floor' && spec.rider !== 'spin') body.box(0, -0.18, 0, L * 0.98, 0.2, W, tcol);
    // Seitenschalen
    for (const sd of [-1, 1]) body.box(0, 0.02, sd * (W / 2 - 0.03), L * 0.96, 0.52, 0.07, tcol);
    body.box(0, -0.62, 0, L * 0.5, 0.3, W * 0.6, dark);
  } else {
    // Hänger zu den Sitzen
    body.box(0, clr - 1.1, 0, 0.3, clr - 0.5, W * 0.6, shade(tcol, 0.7));
  }
  if (first) {
    if (inv) { body.box(L / 2 + 0.3, 0.2, 0, 0.6, 1.2, W * 0.8, tcol); }
    else { body.box(L / 2 + 0.4, -0.25, 0, 0.9, 0.45, W * 0.85, tcol); body.box(L / 2 + 0.85, -0.38, 0, 0.35, 0.28, W * 0.6, shade(tcol, 0.8)); }
    for (const sz of [-1, 1]) lights.box(L / 2 + 0.88, -0.2, sz * W * 0.28, 0.06, 0.1, 0.22, [1, 0.97, 0.8]);
  }
  if (last) lights.box(-L / 2 - 0.05, -0.2, 0, 0.05, 0.1, W * 0.5, [0.9, 0.12, 0.1]);
  // LED-Streifen
  for (const sd of [-1, 1]) lights.box(0, -0.2, sd * (W / 2 + 0.01), L * 0.8, 0.045, 0.02, shade(acc, 1.4));

  // Sitze + Bügel
  const rowSeats = {};
  for (const st of seats) (rowSeats[st.row] = rowSeats[st.row] || []).push(st);
  for (const r in rowSeats) {
    const rs = rowSeats[r], x = rs[0].x;
    for (const st of rs) {
      body.box(x, -0.02, st.z, 0.6, 0.14, sw * 0.9, seatC);
      body.box(x - 0.3, 0.38, st.z, 0.12, 0.8, sw * 0.9, seatC);
      if (inv) body.box(x - 0.34, 0.9, st.z, 0.1, 0.4, sw * 0.4, dark); // Kopfstütze/Hänger
      if (inv) body.box(x - 0.34, 1.6, st.z, 0.12, 1.4, 0.12, shade(tcol, 0.7));
    }
    // Bügel
    const zmin = rs[0].z - sw / 2, zmax = rs[rs.length - 1].z + sw / 2;
    body.box(x + 0.4, 0.22, (zmin + zmax) / 2, 0.1, 0.1, zmax - zmin, shade(acc, 1.1));
    for (const st of rs) body.box(x + 0.34, 0.1, st.z, 0.08, 0.3, 0.1, shade(acc, 0.9));
  }
  // Fahrgäste
  for (const st of seats) {
    if (rng() < 0.9) rider(riders, st, spec, rng, rng() < 0.55);
  }
  return { body, riders, lights, seats };
}

export function createTrain(tr, coaster, cars, yOff) {
  const spec = CATS[coaster.cat] || CATS.sitdown;
  const rng = mulberry32(hashStr(coaster.id + 'train'));
  const group = new THREE.Group();
  group.position.y = yOff;
  const matBody = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 });
  const matRider = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const matLight = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const carObjs = [];
  let seats = null;
  for (let k = 0; k < cars; k++) {
    const { body, riders, lights, seats: sts } = buildCar(spec, coaster, k, cars, rng);
    seats = sts;
    const g = new THREE.Group();
    g.matrixAutoUpdate = false;
    const mb = new THREE.Mesh(body.build(), matBody); mb.castShadow = true; g.add(mb);
    const mr = new THREE.Mesh(riders.build(), matRider); mr.castShadow = true; g.add(mr);
    if (!lights.empty) g.add(new THREE.Mesh(lights.build(), matLight));
    group.add(g);
    carObjs.push({ g, riders: mr });
  }
  const m = new THREE.Matrix4(), pose = newPose();
  const fv = new THREE.Vector3(), uv = new THREE.Vector3(), rv = new THREE.Vector3();
  return {
    group, cars: carObjs, seats, spec,
    update(sim) {
      for (let k = 0; k < carObjs.length; k++) {
        poseAt(tr, sim.carS(k), pose);
        fv.set(pose.t[0], pose.t[1], pose.t[2]); uv.set(pose.u[0], pose.u[1], pose.u[2]); rv.set(pose.r[0], pose.r[1], pose.r[2]);
        m.makeBasis(fv, uv, rv); m.setPosition(pose.p[0], pose.p[1], pose.p[2]);
        carObjs[k].g.matrix.copy(m); carObjs[k].g.matrixWorldNeedsUpdate = true;
      }
    },
    hideRidersOf(k) { carObjs.forEach((c, i) => { c.riders.visible = i !== k; }); },
    showAll() { carObjs.forEach(c => { c.riders.visible = true; }); },
  };
}
