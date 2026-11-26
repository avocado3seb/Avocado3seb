// Welt-Teil des Lebenssystems: Secrets, Backrooms, Safari-Tiere, Skifahren, Häuser, Hinweise
import * as THREE from 'three';
import { h } from './ui.js';
import { G } from './state.js';
import { fmtMoney, clamp } from './util.js';
import { terrainH } from './world.js';
import { ISLANDS, SKI_VILLAGE } from './consts.js';
import { WEAPONS, PROPERTIES } from './data.js';
import { find } from './vehicledata.js';
import { POI_COLORS } from './game.js';
import { PLOTS } from './life.js';

const SECRETS = [
  { id: 'gipfel', name: 'Gipfelbunker', near: () => { const s = G.world.pois.find((p) => p.id === 'summit'); return s ? [s.x + 12, s.z + 8] : [-1700, -2560]; }, weapon: 'railgun', money: 150000, hint: 'Auf dem höchsten Gipfel soll ein alter Bunker stecken.' },
  { id: 'pyramide', name: 'Pyramidenkammer', near: [2480, 940], weapon: 'pharao_stab', money: 100000, need: 'torch', hint: 'Südlich der großen Pyramide liegt ein Eingang – ohne Taschenlampe zu dunkel.' },
  { id: 'inselbunker', name: 'Insel-Bunker Azul', near: () => { const I = ISLANDS.find((q) => q.id === 'azul'); return [I.x + 25, I.z - 25]; }, weapon: 'minigun', money: 200000, hint: 'Auf der teuersten Privatinsel ist etwas vergraben.' },
  { id: 'wasserloch', name: 'Jäger-Hütte am Wasserloch', near: [-1750, 2590], weapon: 'wasserloch_speer', money: 80000, hint: 'Ein Wilderer versteckt sein Gewehr am Wasserloch der Savanne.' },
  { id: 'eishoehle', name: 'Eishöhle', near: [-1470, -2260], weapon: 'eis_sniper', money: 120000, hint: 'Oberhalb des Skidorfs gibt es eine Spalte im Eis.' },
  { id: 'tunnel', name: 'Alcatraz-Fluchttunnel', near: [1057, 1250], weapon: 'tunnel_hammer', money: 90000, need: 'toolbox', hint: 'Ein alter Fluchttunnel an der Ostküste von Alcatraz – du brauchst Werkzeug.' },
  { id: 'dschungel', name: 'Dschungel-Versteck', near: [-1700, 130], weapon: 'armbrust', money: 90000, hint: 'Mitten im Regenwald hängt etwas in den Bäumen.' },
  { id: 'arena', name: 'Geheime Arena-Kasse', near: [2450, 470], weapon: null, money: 500000, hint: 'Im Zentrum des Kolosseums liegt eine Truhe unter dem Sand.' },
];

function freeSpot(cx, cz, maxR = 90) {
  const W = G.world;
  for (let r = 0; r <= maxR; r += 5) for (let a = 0; a < (r ? 12 : 1); a++) {
    const x = cx + Math.cos(a / 12 * 6.283 + r) * r, z = cz + Math.sin(a / 12 * 6.283 + r) * r, y = terrainH(x, z);
    if (y < 1 || y > 600) continue;
    if (W.pushCircle(x, z, 2.5, y + 1).hit) continue;
    return { x, z };
  }
  return { x: cx, z: cz };
}

export class LifeWorld {
  constructor(life) { this.life = life; this.animals = []; this.houseMeshes = new Map(); this.poiHouse = new Set(); this.tour = null; this.skiRace = null; this.backrooms = new Backrooms(this); }
  addPoi(p, o = {}) {
    G.world.pois.push(p);
    if (p.kind !== 'landmark') {
      const m = G.markers.add({ x: p.x, z: p.z, color: POI_COLORS[p.kind] ?? 0xffffff, r: 1.8, far: o.far ?? 180, poi: p, y: terrainH(p.x, p.z) });
      p.marker = m; G.poiMarkers.push(m);
    }
    return p;
  }
  init() {
    const W = G.world;
    // groundY-Override für Backrooms
    const orig = W.groundY.bind(W); W.groundY = (x, z) => (x > 30000 ? 1.0 : orig(x, z));
    W.islandPos = (id) => { const I = ISLANDS.find((q) => q.id === id); return I ? freeSpot(I.x, I.z, 50) : null; };
    // Skirennen am Gipfel
    if (W.skiStart) this.addPoi({ id: 'skirace', kind: 'skirace', name: 'Ski-Rennen: Gipfel → Dorf', x: W.skiStart.x, z: W.skiStart.z, r: 3.4 });
    // Bauland
    for (const p of PLOTS) this.addPoi({ id: p.id, kind: 'plot', name: 'Bauland Palm Estates', x: p.x, z: p.z, r: 3 }, { far: 60 });
    // Secrets
    for (const s of SECRETS) { const [nx, nz] = typeof s.near === 'function' ? s.near() : s.near; const sp = freeSpot(nx, nz, 70); s.pos = sp; s.poi = this.addPoi({ id: 'sec_' + s.id, kind: 'secret', name: s.name, x: sp.x, z: sp.z, r: 2.8, sid: s.id, hidden: true }, { far: 30 }); }
    // Backrooms-Portal im Central Park
    const pp = freeSpot(-330, 70, 90); this.addPoi({ id: 'portal', kind: 'portal', name: 'Flackernde Wand', x: pp.x, z: pp.z, r: 2.4, hidden: true }, { far: 26 });
    this.portalPos = pp;
    // Safari-Tiere
    this.spawnAnimals();
    this.air = new AirTraffic();
    this.addPoi({ id: 'terminal_travel', kind: 'travel', shop: 'travel', name: 'Flughafen-Terminal: Flug buchen', x: -900, z: 668 + 14, r: 3.2 });
    this.refreshSecrets(); this.refreshHouses();
  }
  refreshSecrets() { for (const s of SECRETS) if (s.poi) { s.poi.disabled = false; const done = this.life.state.secrets[s.id]; if (s.poi.marker) { s.poi.marker.hidden = !!done; } s.poi.name = done ? s.name + ' (geöffnet)' : s.name; } }
  secret(ui, poi) {
    const s = SECRETS.find((x) => x.id === poi.sid), S = this.life.state, P = G.player; if (!s) return;
    if (S.secrets[s.id]) return ui.toast('Hier war schon alles leer.');
    if (s.need && !(P.inv[s.need] > 0)) return ui.toast(s.need === 'torch' ? 'Zu dunkel! Du brauchst eine Taschenlampe (Supermarkt/Elektronik).' : 'Du brauchst eine Werkzeugkiste (Baumarkt).');
    S.secrets[s.id] = 1;
    if (s.weapon) P.addWeapon(s.weapon, WEAPONS[s.weapon].ammoPack * 3);
    P.addMoney(Math.round(s.money * (S.perks.cat ? 1.3 : 1)), 'Fund'); G.audio?.pickup?.();
    ui.toast(`🗝️ Geheimversteck „${s.name}“ gefunden! ${s.weapon ? WEAPONS[s.weapon].name + ' freigeschaltet! ' : ''}+${fmtMoney(s.money)}`, 7000);
    this.refreshSecrets(); G.eco?.autosave?.();
  }
  hints(ui) {
    const S = this.life.state;
    const rows = SECRETS.map((s) => h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, S.secrets[s.id] ? '✔ ' + s.name : '❓ Unbekanntes Versteck'), h('div', { class: 'd' }, s.hint)), h('button', { class: 'btn small', onClick: () => { G.waypoint = { x: s.pos.x, z: s.pos.z }; ui.toast('Ungefähre Richtung im GPS markiert'); } }, 'GPS')));
    rows.push(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, S.br ? '✔ Backrooms' : '❓ Etwas Seltsames im Central Park'), h('div', { class: 'd' }, 'Manchmal flackert dort eine Wand… wer hineingeht, findet vielleicht nicht zurück.')), h('button', { class: 'btn small', onClick: () => { G.waypoint = { x: this.portalPos.x, z: this.portalPos.z }; } }, 'GPS')));
    ui.modal('Geheimtipps', h('div', { class: 'body' }, ...rows));
  }
  // ---------- Ski ----------
  lift(poi) {
    const P = G.player, W = G.world, up = !poi.down; if (P.vehicle) P.exitVehicle(true);
    const dest = up ? W.skiStart : { x: SKI_VILLAGE.x + 10, z: SKI_VILLAGE.z - 50 };
    G.ui.fadeTo(1, 400); G.ui.toast(up ? '🚡 Bergfahrt…' : '🚡 Talfahrt…');
    setTimeout(() => { P.teleport(dest.x, dest.z); P.rig.snap?.(P); G.ui.fadeTo(0, 900); }, 1200);
  }
  skiRent(ui, poi) {
    const P = G.player;
    ui.modal(poi.name, h('div', { class: 'body' }, h('p', { class: 'd' }, 'Ski & Snowboard: Auf Schnee bist du viel schneller – bergab nimmst du Schwung auf. Shift = Carving-Tempo.'), h('div', { class: 'row' }, h('div', { class: 'grow t' }, 'Ski-Ausrüstung mieten (15 Min.)'), h('div', { class: 'price' }, '$150'), h('button', { class: 'btn small', onClick: () => { if (P.money < 150) return ui.toast('Nicht genug Geld!'); P.addMoney(-150, 'Einkauf'); P.skiT = 900; ui.toast('⛷️ Ski an! Los geht’s auf der Piste.'); ui.closeModal(); } }, 'Mieten')), h('div', { class: 'row' }, h('div', { class: 'grow t' }, 'Jahres-Skipass (unbegrenzt)'), h('div', { class: 'price' }, '$1.500'), h('button', { class: 'btn small', onClick: () => { if (P.money < 1500) return ui.toast('Nicht genug Geld!'); P.addMoney(-1500, 'Einkauf'); P.skiT = 1e9; ui.toast('Skipass gekauft – du bist dauerhaft auf Ski!'); ui.closeModal(); } }, 'Kaufen'))));
  }
  skiRaceStart() {
    const P = G.player; if (!(P.skiT > 0)) return G.ui.toast('Du brauchst Ski! Hol sie im Skiverleih im Dorf.');
    this.skiRace = { t: 0, limit: 260, x: SKI_VILLAGE.x, z: SKI_VILLAGE.z - 10 }; G.waypoint = { x: this.skiRace.x, z: this.skiRace.z };
    G.ui.toast('🏁 Rennen gestartet! Fahre ins Dorf – so schnell wie möglich.');
  }
  // ---------- Safari ----------
  safari(ui, poi) {
    const S = this.life.state;
    ui.modal(poi.name, h('div', { class: 'body' }, h('p', { class: 'd' }, 'Fotosafari: Nähere dich allen 5 Tierherden der Savanne auf unter 40 m. Belohnung: $25.000 + Schatzkiste.'), h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'Safari-Jeep mieten & Tour starten'), h('div', { class: 'd' }, `${Object.keys(S.photos).length}/5 Herden fotografiert`)), h('div', { class: 'price' }, '$400'), h('button', { class: 'btn small', onClick: () => { if (G.player.money < 400) return ui.toast('Nicht genug Geld!'); G.player.addMoney(-400, 'Einkauf'); const spec = find('Safari Ranger'); const v = G.vehicles.spawn(spec, poi.x + 6, poi.z + 5, Math.PI / 2, { sleep: false }); v.tag = 'abandoned'; S.photos = {}; this.tour = true; G.waypoint = { ...G.world.safariSpots[0] }; ui.toast('Jeep bereit – folge dem GPS zu den Tieren!'); ui.closeModal(); } }, 'Tour starten'))));
  }
  spawnAnimals() {
    const W = G.world, spots = W.safariSpots || []; const species = [['zebra', 6], ['giraffe', 3], ['elephant', 3], ['lion', 3], ['antelope', 6]];
    spots.forEach((sp, hi) => { const [kind, n] = species[hi % species.length]; for (let k = 0; k < n; k++) { const a = makeAnimal(kind); const x = sp.x + (Math.random() - 0.5) * 30, z = sp.z + (Math.random() - 0.5) * 30; a.position.set(x, terrainH(x, z), z); W.group.add(a); this.animals.push({ obj: a, kind, herd: hi, cx: sp.x, cz: sp.z, tx: x, tz: z, sp: kind === 'lion' ? 2.4 : kind === 'antelope' ? 3 : 1.4 }); } });
  }
  // ---------- Häuser ----------
  refreshHouses() {
    const S = this.life.state;
    for (const b of S.builds) {
      const pl = PLOTS.find((p) => p.id === b.plot); if (!pl) continue;
      const old = this.houseMeshes.get(b.id); if (old && old.done === !!b.done) continue;
      if (old) G.world.group.remove(old.obj);
      const obj = b.done ? makeHouse(b.type) : makeScaffold(); obj.position.set(pl.x, terrainH(pl.x, pl.z), pl.z); G.world.group.add(obj); this.houseMeshes.set(b.id, { obj, done: !!b.done });
      if (b.done && !this.poiHouse.has(b.id)) { const def = PROPERTIES.find((p) => p.id === b.id); if (def) { this.addPoi({ id: b.id, kind: 'property', name: def.name, x: def.x, z: def.z, r: 3.2, prop: def }); this.poiHouse.add(b.id); G.eco.applyToWorld(); } }
      const pp = G.world.pois.find((p) => p.id === pl.id); if (pp) pp.disabled = true; if (pp?.marker) pp.marker.hidden = true;
    }
  }
  update(dt) {
    const P = G.player, S = this.life.state;
    // Tiere
    const px = P.position.x, pz = P.position.z;
    if (pz > 1900 && px < -200) for (const a of this.animals) {
      const o = a.obj, dx = a.tx - o.position.x, dz = a.tz - o.position.z, d = Math.hypot(dx, dz);
      if (d < 1.5) { a.tx = a.cx + (Math.random() - 0.5) * 50; a.tz = a.cz + (Math.random() - 0.5) * 50; a.wait = 1 + Math.random() * 4; }
      if (a.wait > 0) { a.wait -= dt; continue; }
      const pd = Math.hypot(o.position.x - px, o.position.z - pz); let sp = a.sp; if (pd < 12 && a.kind !== 'lion' && a.kind !== 'elephant') { a.tx = o.position.x + (o.position.x - px) * 3; a.tz = o.position.z + (o.position.z - pz) * 3; sp *= 3; }
      o.position.x += dx / d * sp * dt; o.position.z += dz / d * sp * dt; o.position.y = terrainH(o.position.x, o.position.z);
      const yaw = Math.atan2(dx, dz); o.rotation.y += Math.atan2(Math.sin(yaw - o.rotation.y), Math.cos(yaw - o.rotation.y)) * Math.min(1, dt * 4);
    }
    // Fotos
    if (this.tour) { const sp = G.world.safariSpots || []; sp.forEach((s, i) => { if (!S.photos[i] && Math.hypot(px - s.x, pz - s.z) < 40) { S.photos[i] = 1; G.ui.toast(`📸 Herde ${Object.keys(S.photos).length}/5 fotografiert!`); G.audio?.pickup?.(); const n = Object.keys(S.photos).length; if (n >= 5) { this.tour = false; P.addMoney(25000, 'Job'); this.life.lootBox(2); G.ui.toast('🦁 Fotosafari abgeschlossen! +$25.000', 6000); } else G.waypoint = { ...sp[(i + 1) % sp.length] }; } }); }
    // Skirennen
    if (this.skiRace) { const r = this.skiRace; r.t += dt; if (Math.hypot(px - r.x, pz - r.z) < 14) { const reward = Math.round(Math.max(1500, (r.limit - r.t) * 90)); P.addMoney(reward, 'Job'); if (!S.skiBest || r.t < S.skiBest) S.skiBest = r.t; G.ui.toast(`🏁 Ziel! ${r.t.toFixed(1)} s · +${fmtMoney(reward)} (Bestzeit ${S.skiBest.toFixed(1)} s)`, 6000); this.skiRace = null; } else if (r.t > r.limit) { G.ui.toast('Zeit abgelaufen – Rennen verloren.'); this.skiRace = null; } }
    this.backrooms.update(dt); this.air?.update(dt);
  }
}

// ---------- Tiere (prozedural) ----------
function makeAnimal(kind) {
  const g = new THREE.Group(); const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  const box = (w, hh, d, x, y, z, mat, p = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mat); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
  const cfg = { zebra: [0xf2f2f2, 1.0, 1.4], giraffe: [0xd9a441, 1.0, 1.0], elephant: [0x8d8f93, 1.0, 1.0], lion: [0xc9953a, 1.0, 1.0], antelope: [0xb98550, 1.0, 1.0] }[kind];
  const body = M(cfg[0]), dark = M(0x2a2a2a);
  if (kind === 'zebra' || kind === 'antelope') { const s = kind === 'zebra' ? 1 : 0.85; box(0.6 * s, 0.7 * s, 1.6 * s, 0, 1.15 * s, 0, body); box(0.28 * s, 0.7 * s, 0.4 * s, 0, 1.55 * s, 0.9 * s, body); box(0.25 * s, 0.25 * s, 0.5 * s, 0, 1.9 * s, 1.15 * s, body); for (const [lx, lz] of [[-0.2, -0.6], [0.2, -0.6], [-0.2, 0.6], [0.2, 0.6]]) box(0.14 * s, 0.9 * s, 0.14 * s, lx * s, 0.45 * s, lz * s, kind === 'zebra' ? dark : body); if (kind === 'zebra') for (let k = 0; k < 5; k++) box(0.62, 0.72, 0.1, 0, 1.15, -0.6 + k * 0.3, dark); }
  else if (kind === 'giraffe') { box(0.7, 0.9, 1.8, 0, 2.5, 0, body); box(0.3, 2.6, 0.3, 0, 3.8, 1.0, body); box(0.32, 0.35, 0.6, 0, 5.2, 1.2, body); for (const [lx, lz] of [[-0.25, -0.7], [0.25, -0.7], [-0.25, 0.7], [0.25, 0.7]]) box(0.16, 2.1, 0.16, lx, 1.05, lz, body); for (let k = 0; k < 6; k++) box(0.35, 0.3, 0.35, ((k % 2) - 0.5) * 0.4, 2.8 + (k % 3) * 0.3, -0.5 + k * 0.4, M(0x7a4a1a)); }
  else if (kind === 'elephant') { box(1.8, 1.8, 3, 0, 2.2, 0, body); box(1.3, 1.3, 1.2, 0, 2.6, 1.9, body); box(0.35, 1.4, 0.35, 0, 1.6, 2.7, body); box(0.12, 0.12, 0.9, 0.5, 1.8, 2.5, M(0xf5f0e0)); box(0.12, 0.12, 0.9, -0.5, 1.8, 2.5, M(0xf5f0e0)); for (const [lx, lz] of [[-0.6, -1], [0.6, -1], [-0.6, 1], [0.6, 1]]) box(0.55, 1.4, 0.55, lx, 0.7, lz, body); box(0.12, 1.1, 0.6, 0.9, 2.5, 1.7, body); box(0.12, 1.1, 0.6, -0.9, 2.5, 1.7, body); }
  else { box(0.7, 0.7, 1.7, 0, 0.9, 0, body); box(0.55, 0.55, 0.55, 0, 1.05, 1.0, body); box(0.7, 0.7, 0.4, 0, 1.0, 1.05, M(0x8a5a1a)); box(0.1, 0.1, 1.0, 0, 0.8, -1.2, body); for (const [lx, lz] of [[-0.25, -0.6], [0.25, -0.6], [-0.25, 0.6], [0.25, 0.6]]) box(0.16, 0.6, 0.16, lx, 0.3, lz, body); }
  return g;
}
function makeHouse(type) {
  const g = new THREE.Group(); const sc = { bungalow: 0.8, stadthaus: 1, villa: 1.4, mansion: 1.9, eco: 1.0 }[type] || 1; const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(14 * sc, 6 * sc * (type === 'stadthaus' ? 1.5 : 1), 10 * sc), m(type === 'eco' ? 0xc8e6c9 : 0xf2ece0)); wall.position.y = 3 * sc * (type === 'stadthaus' ? 1.5 : 1); wall.castShadow = wall.receiveShadow = true; g.add(wall);
  const hh = 6 * sc * (type === 'stadthaus' ? 1.5 : 1);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(9.2 * sc, 3.2 * sc, 4), m(type === 'eco' ? 0x263238 : 0xb5523b)); roof.position.y = hh + 1.6 * sc; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.75; roof.castShadow = true; g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.2), m(0x4e342e)); door.position.set(0, 1.3, 5.1 * sc); g.add(door);
  for (const x of [-4, 4]) { const w = new THREE.Mesh(new THREE.BoxGeometry(2.2 * sc, 1.8 * sc, 0.12), m(0x9fd8f0, { emissive: 0x6a8a99, emissiveIntensity: 0.35, metalness: 0.5 })); w.position.set(x * sc, 3 * sc, 5.05 * sc); g.add(w); }
  if (type === 'eco') for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.6), m(0x1a237e, { metalness: 0.7 })); p.position.set(-4.5 + k * 3, hh + 2.6, 0); p.rotation.x = -0.5; g.add(p); }
  if (type === 'mansion') { const hp = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 10), m(0x555555)); hp.position.set(0, 0.15, 14 * sc); g.add(hp); const hg = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 10), m(0xb0bec5)); hg.position.set(-18 * sc, 3, 0); g.add(hg); }
  return g;
}
function makeScaffold() { const g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color: 0xff9800, roughness: 0.7 }); for (const [x, z] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 0.4), mat); p.position.set(x, 4, z); g.add(p); } const sl = new THREE.Mesh(new THREE.BoxGeometry(13, 0.3, 9), new THREE.MeshStandardMaterial({ color: 0x9e9e9e })); sl.position.y = 0.15; g.add(sl); const cr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 14, 0.4), mat); cr.position.set(9, 7, 0); g.add(cr); const arm = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 0.4), mat); arm.position.set(4, 14, 0); g.add(arm); return g; }

// ---------- Backrooms ----------
class Backrooms {
  constructor(lw) { this.lw = lw; this.active = false; this.built = false; this.N = 31; this.C = 3.2; this.ox = 40000; this.oz = 40000; }
  build() {
    if (this.built) return; this.built = true;
    const { N, C, ox, oz } = this;
    // Labyrinth (DFS)
    const solid = Array.from({ length: N }, () => Array(N).fill(true)); const st = [[1, 1]]; solid[1][1] = false; const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    while (st.length) { const [x, z] = st[st.length - 1]; const opts = dirs.filter(([dx, dz]) => { const nx = x + dx, nz = z + dz; return nx > 0 && nz > 0 && nx < N - 1 && nz < N - 1 && solid[nz][nx]; }); if (!opts.length) { st.pop(); continue; } const [dx, dz] = opts[Math.floor(Math.random() * opts.length)]; solid[z + dz / 2][x + dx / 2] = false; solid[z + dz][x + dx] = false; st.push([x + dx, z + dz]); }
    for (let k = 0; k < 90; k++) { const x = 1 + Math.floor(Math.random() * (N - 2)), z = 1 + Math.floor(Math.random() * (N - 2)); if (x % 2 !== z % 2) solid[z][x] = false; }
    for (let x = 4; x < 9; x++) for (let z = 4; z < 9; z++) solid[z][x] = false; // Halle
    this.solid = solid;
    const mk = (draw, rep) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); draw(g); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const wallT = mk((g) => { g.fillStyle = '#c8b447'; g.fillRect(0, 0, 128, 128); for (let x = 0; x < 128; x += 16) { g.fillStyle = x % 32 ? '#bba43a' : '#d3c05a'; g.fillRect(x, 0, 8, 128); } g.fillStyle = 'rgba(80,60,0,.12)'; for (let k = 0; k < 200; k++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }, 1);
    const floorT = mk((g) => { g.fillStyle = '#7a6a2a'; g.fillRect(0, 0, 128, 128); for (let k = 0; k < 1400; k++) { g.fillStyle = `rgba(${60 + Math.random() * 50},${50 + Math.random() * 40},10,.35)`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } }, N);
    const ceilT = mk((g) => { g.fillStyle = '#b9aa6a'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#8f8450'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128); }, N);
    const grp = new THREE.Group(); const y0 = 1.0, hh = 3.2;
    const wallM = new THREE.MeshBasicMaterial({ map: wallT, color: 0xdddddd }); let cnt = 0; for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (solid[z][x]) cnt++;
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(C, hh, C), wallM, cnt); const m4 = new THREE.Matrix4(); let i = 0; for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (solid[z][x]) walls.setMatrixAt(i++, m4.makeTranslation(ox + x * C, y0 + hh / 2, oz + z * C)); grp.add(walls);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(N * C, N * C), new THREE.MeshBasicMaterial({ map: floorT, color: 0xbbbbbb })); fl.rotation.x = -Math.PI / 2; fl.position.set(ox + (N - 1) * C / 2, y0, oz + (N - 1) * C / 2); grp.add(fl);
    const ce = new THREE.Mesh(new THREE.PlaneGeometry(N * C, N * C), new THREE.MeshBasicMaterial({ map: ceilT, color: 0xcccccc })); ce.rotation.x = Math.PI / 2; ce.position.set(fl.position.x, y0 + hh, fl.position.z); grp.add(ce);
    const lights = []; for (let z = 1; z < N; z += 2) for (let x = 1; x < N; x += 2) if (!solid[z][x] && (x + z) % 4 === 0) lights.push([x, z]);
    const lm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.05, 0.5), new THREE.MeshBasicMaterial({ color: 0xfffbe0, toneMapped: false }), lights.length); lights.forEach(([x, z], k) => lm.setMatrixAt(k, m4.makeTranslation(ox + x * C, y0 + hh - 0.04, oz + z * C))); grp.add(lm);
    // Ausgang (weit entfernt)
    let far = null, best = -1; for (let z = 1; z < N; z += 2) for (let x = 1; x < N; x += 2) if (!solid[z][x]) { const d = (x - 1) ** 2 + (z - 1) ** 2; if (d > best) { best = d; far = [x, z]; } }
    this.exit = { x: ox + far[0] * C, z: oz + far[1] * C };
    const ex = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.3), new THREE.MeshBasicMaterial({ color: 0x00e676, toneMapped: false })); ex.position.set(this.exit.x, y0 + 1.2, this.exit.z); grp.add(ex);
    // Mandelwasser
    this.water = []; const free = []; for (let z = 1; z < N; z += 2) for (let x = 1; x < N; x += 2) if (!solid[z][x]) free.push([x, z]);
    for (let k = 0; k < 8; k++) { const [x, z] = free[Math.floor(Math.random() * free.length)]; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xa8f0d0, toneMapped: false })); m.position.set(ox + x * C, y0 + 0.3, oz + z * C); grp.add(m); this.water.push(m); }
    // Wesen
    this.ent = new THREE.Group(); const em = new THREE.MeshBasicMaterial({ color: 0x050505 }); const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.6, 0.5), em); body.position.y = 1.3; this.ent.add(body); for (const x of [-0.15, 0.15]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0xff1a1a, toneMapped: false })); e.position.set(x, 2.3, 0.28); this.ent.add(e); } grp.add(this.ent);
    this.grp = grp; this.free = free; G.scene.add(grp); grp.visible = false;
  }
  enter() {
    const P = G.player, S = this.lw.life.state; if (G.prison?.active) return;
    this.build(); this.ret = { x: P.pos.x, z: P.pos.z }; if (P.vehicle) P.exitVehicle(true);
    G.ui.fadeTo(1, 500); G.ui.toast('Du gehst durch die Wand …');
    setTimeout(() => { this.active = true; this.grp.visible = true; P.teleport(this.ox + 1 * this.C, this.oz + 1 * this.C, 1.0); P.pos.y = 1.0; P.rig.snap?.(P); this.entT = 20; this.ent.position.set(this.exit.x, 1.0, this.exit.z); S.br++; G.ui.fadeTo(0, 1200); G.ui.toast('🟨 THE BACKROOMS – finde den grünen Ausgang. Bleib nicht stehen.', 7000); }, 700);
  }
  leave(reward) {
    const P = G.player, S = this.lw.life.state; G.ui.fadeTo(1, 500);
    setTimeout(() => { this.active = false; this.grp.visible = false; P.teleport(this.ret.x + 3, this.ret.z + 3); P.rig.snap?.(P); G.ui.fadeTo(0, 900); if (reward && !S.secrets.backrooms) { S.secrets.backrooms = 1; P.addWeapon('almond_blaster', 120); P.addMoney(75000, 'Fund'); G.ui.toast('Du bist entkommen! Mandelwasser-Blaster + $75.000', 7000); } else G.ui.toast('Du bist zurück in Vice City.'); G.eco?.autosave?.(); }, 700);
  }
  collide(P) {
    if (!this.active) return; const { C, ox, oz, N, solid } = this; const r = 0.4;
    const cx = Math.round((P.pos.x - ox) / C), cz = Math.round((P.pos.z - oz) / C);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, z = cz + dz; const sol = x < 0 || z < 0 || x >= N || z >= N || solid[z][x]; if (!sol) continue; const minx = ox + x * C - C / 2, maxx = minx + C, minz = oz + z * C - C / 2, maxz = minz + C; const nx = clamp(P.pos.x, minx, maxx), nz = clamp(P.pos.z, minz, maxz); let ddx = P.pos.x - nx, ddz = P.pos.z - nz; const d = Math.hypot(ddx, ddz); if (d < r) { if (d < 1e-4) { ddx = 1; ddz = 0; } else { ddx /= d; ddz /= d; } P.pos.x = nx + ddx * r; P.pos.z = nz + ddz * r; } }
  }
  update(dt) {
    if (!this.active) return; const P = G.player;
    if (G.scene.fog) { G.scene.fog.color.set(0x9a8a30); if (G.scene.fog.density !== undefined) G.scene.fog.density = 0.03; }
    P.pos.y = Math.max(P.pos.y, 1.0);
    // Mandelwasser
    for (let k = this.water.length - 1; k >= 0; k--) { const w = this.water[k]; w.rotation.y += dt * 2; if (Math.hypot(w.position.x - P.pos.x, w.position.z - P.pos.z) < 1.3) { P.health = Math.min(P.maxHealth, P.health + 35); P.hunger = Math.min(100, P.hunger + 10); G.ui.toast('Mandelwasser: +Leben'); G.audio?.pickup?.(); this.grp.remove(w); this.water.splice(k, 1); } }
    // Ausgang
    const nearExit = Math.hypot(this.exit.x - P.pos.x, this.exit.z - P.pos.z) < 2.6; if (nearExit && !this._near) G.ui.toast('Drücke E: Ausgang'); this._near = nearExit; if (nearExit && G.input.hit('KeyE')) this.leave(true);
    // Wesen verfolgt per Sichtlinie auf Gitter
    this.entT = Math.max(0, (this.entT ?? 0) - dt); const e = this.ent.position; const tx = P.pos.x, tz = P.pos.z; const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    if (this.entT <= 0 && d > 0.01) { const sp = Math.min(3.2, 2.2 + (1 - Math.min(1, d / 60))); const step = sp * dt; const nx = e.x + dx / d * step, nz = e.z + dz / d * step; const gx = Math.round((nx - this.ox) / this.C), gz = Math.round((nz - this.oz) / this.C); if (!this.solid[gz]?.[gx]) { e.x = nx; e.z = nz; } else { const alt = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ax, az]) => [e.x + ax * step, e.z + az * step]).filter(([ax, az]) => !this.solid[Math.round((az - this.oz) / this.C)]?.[Math.round((ax - this.ox) / this.C)]).sort((a, b) => Math.hypot(tx - a[0], tz - a[1]) - Math.hypot(tx - b[0], tz - b[1]))[0]; if (alt) { e.x = alt[0]; e.z = alt[1]; } } this.ent.rotation.y = Math.atan2(dx, dz); }
    if (d < 1.2 && this.entT <= 0) { P.hurt(30, null); G.ui.toast('Etwas hat dich erwischt!'); G.audio?.crash?.(0.6, P.pos); const f = this.free[Math.floor(Math.random() * this.free.length)]; e.x = this.ox + f[0] * this.C; e.z = this.oz + f[1] * this.C; this.entT = 8; }
    if (!P.alive) { this.active = false; this.grp.visible = false; }
  }
}
export { freeSpot };


// ---------- Luftverkehr am Flughafen (lebendige Welt) ----------
class AirTraffic {
  constructor() {
    this.t = 0; this.list = [];
    const mk = (name, kind, extra) => { const spec = find(name); if (!spec) return; const v = G.vehicles.spawn(spec, -900, 850, 0, { sleep: false }); v.remote = true; v.kinematic = true; v.keep = true; v.tag = 'ambient'; v.locked = true; v.health = 1e9; v.driver = { ai: true }; v.group.visible = false; this.list.push({ v, kind, ...extra }); };
    mk('Lear Jet LJ', 'dep', { off: 0, per: 140 }); mk('Cargo Dash', 'dep', { off: 70, per: 140 });
    mk('Lear Jet LJ', 'arr', { off: 35, per: 150 }); mk('Cargo Dash', 'arr', { off: 110, per: 150 });
    mk('Skyhawk', 'circle', { r: 1500, alt: 260, sp: 0.055, ph: 0 }); mk('Lear Jet LJ', 'circle', { r: 2100, alt: 420, sp: -0.04, ph: 2 });
  }
  place(a, x, y, z, yaw, pitch = 0, roll = 0) { const v = a.v; v.pos.set(x, y, z); v.yaw = yaw; v.pitch = pitch; v.roll = roll; v.group.visible = true; v.rotor = (v.rotor || 0) + 0.7; v.thr3 = 0.8; v.in && (v.in.throttle = 1); }
  update(dt) {
    this.t += dt; const W = G.world;
    for (const a of this.list) {
      const v = a.v; if (!v || v.dead) continue;
      v.group.visible = false;
      if (a.kind === 'circle') {
        const ang = this.t * a.sp + a.ph, cx = -300, cz = 100;
        this.place(a, cx + Math.cos(ang) * a.r, a.alt, cz + Math.sin(ang) * a.r, Math.atan2(-Math.sin(ang) * Math.sign(a.sp), Math.cos(ang) * Math.sign(a.sp)), 0, 0.2 * Math.sign(a.sp));
      } else if (a.kind === 'dep') {
        const u = (this.t + a.off) % a.per, T1 = 14, acc = 55 / T1;
        if (u < 95) { const x = u < T1 ? -1330 + 0.5 * acc * u * u : -1330 + 0.5 * acc * T1 * T1 + 55 * (u - T1); const y = u < T1 ? 0.35 : 0.35 + (u - T1) * 55 * 0.1; this.place(a, x, y, 852, Math.PI / 2, u < T1 ? 0 : 0.17); }
      } else if (a.kind === 'arr') {
        const u = (this.t + a.off) % a.per, sp = 60, T2 = 60;
        if (u < T2) { const x = 3000 - sp * u; this.place(a, x, Math.max(0.35, (x + 600) * 0.0526), 848, -Math.PI / 2, -0.05); }
        else if (u < T2 + 24) { const k = (u - T2) / 24, x = -600 - 700 * (1 - Math.pow(1 - k, 2)) * 1; this.place(a, x, 0.35, 848, -Math.PI / 2, 0); }
        else if (u < T2 + 30) this.place(a, -1300, 0.35, 848, -Math.PI / 2, 0);
      }
    }
  }
}
