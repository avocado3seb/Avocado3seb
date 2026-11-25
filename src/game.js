// Spielkern: verbindet alle Systeme, Hauptschleife, Marker, Pickups
import * as THREE from 'three';
import { G, loadSettings, saveSettings } from './state.js';
import { World, terrainH, HALF, SEA, ISLANDS } from './world.js';
import { Environment, QUALITY } from './environment.js';
import { Input } from './input.js';
import { FX } from './fx.js';
import { VehicleManager } from './vehicles.js';
import { PedManager, TrafficManager, Ped } from './npc.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Player } from './player.js';
import { clamp, lerp, damp, fmtMoney, hash2, RNG } from './util.js';
import { byKey, CATALOG } from './vehicledata.js';

export const POI_COLORS = { food: 0xff9800, clothes: 0x42a5f5, barber: 0xab47bc, guns: 0x90a4ae, jewel: 0xffd54f, store: 0x26c6da, atm: 0x00e676, fuel: 0xff7043, tune: 0xff1744, job: 0xffee58, raceStart: 0xff5722, property: 0x69f0ae, spray: 0xffee58, police: 0x448aff, hospital: 0xff5252, bank: 0xffd740, casino: 0xff4fd8, dealer: 0xffd740, club: 0xe040fb, mall: 0x4dd0e1, arcade: 0x18ffff, aircraft: 0x82b1ff, boats: 0x40c4ff, mission: 0xffffff, checkpoint: 0xffffff };
export const POI_ICONS = { food: '🍔', clothes: '👕', barber: '✂️', guns: '🔫', jewel: '💎', store: '🏪', atm: '💵', fuel: '⛽', tune: '🔧', job: '💼', raceStart: '🏁', property: '🏠', spray: '🎨', police: '🚓', hospital: '🏥', bank: '🏦', casino: '🎰', dealer: '🚘', club: '🎶', mall: '🛍️', arcade: '🕹️', aircraft: '✈️', boats: '⚓', landmark: '📍' };
const VEHICLE_POI = new Set(['spray', 'fuel', 'tune', 'dealer', 'boats', 'aircraft']);

// ---------------- Marker (Lichtsäulen) ----------------
class Markers {
  constructor(G) {
    this.G = G; this.list = []; this.group = new THREE.Group();
    this.cylG = new THREE.CylinderGeometry(1.1, 1.1, 60, 16, 1, true); this.cylG.translate(0, 35, 0);
    this.ringG = new THREE.TorusGeometry(1.6, 0.07, 8, 24); this.ringG.rotateX(Math.PI / 2);
    this.gemG = new THREE.OctahedronGeometry(0.45);
    this.mats = new Map();
  }
  mat(c, a) { const k = c + '_' + a; let m = this.mats.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: a, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); this.mats.set(k, m); } return m; }
  add(o) {
    const m = { x: o.x, z: o.z, color: o.color ?? 0xffffff, r: o.r ?? 3, far: o.far ?? 260, height: o.height ?? 1, big: !!o.big, ...o };
    const g = new THREE.Group();
    const pillar = new THREE.Mesh(this.cylG, this.mat(m.color, 0.1)); pillar.scale.set(m.r > 4 ? m.r / 3 : 1, m.height, m.r > 4 ? m.r / 3 : 1); g.add(pillar);
    const ring = new THREE.Mesh(this.ringG, this.mat(m.color, 0.55)); ring.scale.setScalar(Math.max(1, m.r / 1.8)); ring.position.y = 0.2; g.add(ring);
    const gem = new THREE.Mesh(this.gemG, this.mat(m.color, 0.95)); gem.position.y = 2.3; g.add(gem);
    g.position.set(m.x, o.y ?? terrainH(m.x, m.z), m.z);
    m.group = g; m.gem = gem; m.ring = ring; this.group.add(g); this.list.push(m);
    return m;
  }
  remove(m) { if (!m) return; const i = this.list.indexOf(m); if (i >= 0) this.list.splice(i, 1); this.group.remove(m.group); }
  update(dt, px, pz, t) {
    for (const m of this.list) {
      const d = Math.hypot(m.x - px, m.z - pz);
      m.group.visible = !m.hidden && d < m.far;
      if (m.group.visible) { m.gem.rotation.y = t * 2; m.gem.position.y = 2.3 + Math.sin(t * 2.4) * 0.15; m.ring.scale.setScalar(Math.max(1, m.r / 1.8) * (1 + Math.sin(t * 3) * 0.03)); }
    }
  }
}

// ---------------- Pickups ----------------
class Pickups {
  constructor(G) { this.G = G; this.list = []; this.group = new THREE.Group(); this.geo = new THREE.BoxGeometry(0.34, 0.03, 0.16); this.mat = new THREE.MeshStandardMaterial({ color: 0x5ec26a, roughness: 0.6, emissive: 0x1e6a2a, emissiveIntensity: 0.6 }); this.pk = new THREE.IcosahedronGeometry(0.4, 0); this.pkMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.3, metalness: 0.6, emissive: 0xaa7a00, emissiveIntensity: 0.5 }); }
  dropCash(x, z, amount) {
    const m = new THREE.Mesh(this.geo, this.mat); m.position.set(x, this.G.world.groundY(x, z) + 0.15, z); m.rotation.y = Math.random() * 6; this.group.add(m);
    this.list.push({ mesh: m, kind: 'cash', amount, t: 60, x, z });
  }
  addPackage(id, x, z) {
    const m = new THREE.Mesh(this.pk, this.pkMat); m.position.set(x, this.G.world.groundY(x, z) + 1.0, z); this.group.add(m);
    const it = { mesh: m, kind: 'package', id, x, z, t: Infinity }; this.list.push(it); return it;
  }
  addItem(kind, x, z, data = {}) {
    const m = new THREE.Mesh(this.pk, new THREE.MeshStandardMaterial({ color: kind === 'health' ? 0xff5252 : kind === 'armor' ? 0x448aff : 0xffee58, emissive: 0x222222, roughness: 0.4 })); m.position.set(x, this.G.world.groundY(x, z) + 0.9, z); this.group.add(m);
    const it = { mesh: m, kind, x, z, t: Infinity, ...data }; this.list.push(it); return it;
  }
  update(dt) {
    const G = this.G, pp = G.player.position, t = G.time;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i]; it.t -= dt;
      if (it.kind !== 'cash') { it.mesh.rotation.y = t * 1.5; it.mesh.position.y += Math.sin(t * 2 + i) * 0.002; }
      const d = Math.hypot(it.x - pp.x, it.z - pp.z);
      it.mesh.visible = d < 200;
      if (it.t <= 0) { this.remove(i); continue; }
      if (d < (it.kind === 'cash' ? 1.8 : 2.2) && G.player.alive && Math.abs(G.player.position.y - it.mesh.position.y) < 4) {
        if (it.kind === 'cash') { G.player.addMoney(it.amount, 'Bargeld'); G.audio?.pickup?.(); }
        else if (it.kind === 'package') { G.collect?.package(it.id); }
        else if (it.kind === 'health') { G.player.health = 100; G.ui?.toast('Gesundheit aufgefüllt'); }
        else if (it.kind === 'armor') { G.player.armor = 100; G.ui?.toast('Schutzweste'); }
        else if (it.onPick) it.onPick(it);
        this.remove(i);
      }
    }
  }
  remove(i) { const it = this.list[i]; this.group.remove(it.mesh); this.list.splice(i, 1); }
  removeItem(it) { const i = this.list.indexOf(it); if (i >= 0) this.remove(i); }
}

export async function initGame(canvas, progress) {
  const settings = G.settings = loadSettings();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.25, 12000);
  scene.add(camera);
  G.renderer = renderer; G.scene = scene; G.camera = camera; G.projectiles = [];
  G.env = new Environment(G);
  G.input = new Input(canvas, G);
  G.world = new World(G);
  await G.world.build(progress);
  scene.add(G.world.group);
  G.env.dayLen = settings.dayLen;
  G.env.init(renderer, scene, camera, settings.quality);
  G.fx = new FX(G); scene.add(G.fx.group);
  G.vehicles = new VehicleManager(G); scene.add(G.vehicles.group);
  G.PedClass = Ped;
  G.peds = new PedManager(G);
  G.combat = new Combat(G);
  G.traffic = new TrafficManager(G);
  G.police = new Police(G);
  G.markers = new Markers(G); scene.add(G.markers.group);
  G.pickups = new Pickups(G); scene.add(G.pickups.group);
  G.player = new Player(G);
  G.player.init();
  G.frustum = new THREE.Frustum(); G._pm = new THREE.Matrix4();
  G.cameraSees = (p) => { const v = G._tv || (G._tv = new THREE.Vector3()); v.set(p.x, p.y ?? 1, p.z); return G.frustum.containsPoint(v); };
  G.cheat = {};
  G.waypoint = null;
  G.poiNear = null;
  G.districtName = '';
  G.day = 1;
  G.timeScale = 1;
  // Resize
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); G.env.resize(innerWidth, innerHeight); });
  G.applySettings = () => {
    saveSettings(G.settings);
    camera.fov = G.settings.fov; camera.updateProjectionMatrix();
    G.env.dayLen = G.settings.dayLen;
    G.env.applyQuality(G.settings.quality);
    G.audio?.setVolumes?.();
  };
  // Marker für alle POIs
  G.poiMarkers = [];
  for (const p of G.world.pois) {
    if (p.kind === 'landmark') continue;
    const c = POI_COLORS[p.kind] ?? 0xffffff;
    const m = G.markers.add({ x: p.x, z: p.z, color: c, r: VEHICLE_POI.has(p.kind) && p.r > 4 ? p.r : 1.8, far: 180, poi: p, y: terrainH(p.x, p.z) });
    p.marker = m; G.poiMarkers.push(m);
  }
  // Parkplätze für Flugzeuge/Schiffe und Händler-Fahrzeuge
  spawnStatic();
  // Pakete
  spawnPackages();
  // Ereignisse
  wireEvents();
  return G;
}

function spawnStatic() {
  const W = G.world, V = G.vehicles;
  const planes = ['skyhawk', 'cargo_dash', 'bush_pilot', 'lear_jet_lj', 'stunt_falcon'], helis = ['ranger_heli', 'news_chopper'];
  const rng = new RNG(99);
  for (const s of W.airSpots || []) {
    const key = s.cls === 'jet' ? (rng.chance(0.5) ? 'lear_jet_lj' : 'cargo_dash') : s.cls === 'heli' ? rng.pick(helis) : rng.pick(['skyhawk', 'bush_pilot', 'stunt_falcon']);
    const v = V.spawn(key, s.x, s.z, s.yaw, { tag: 'static' }); v.keep = true; v.tag = 'static';
  }
  for (const s of W.boatSpots || []) {
    const key = rng.pick(['speedster_30', 'marlin_fishing', 'dinghy', 'jetski_splash', 'cruiser_45', 'racer_cigar']);
    const v = V.spawn(key, s.x, s.z, Math.PI / 2 * 0 + Math.PI, { tag: 'static' }); v.keep = true; v.tag = 'static';
  }
  // Händler-Showroom
  const dealer = ['phantom_aureus', 'veloce_hyper', 'nitro_gtr', 'falcon_rs', 'inferna_spyder', 'brawler_v8'];
  (W.displaySpots || []).forEach((s, i) => { const v = V.spawn(dealer[i % dealer.length], s.x, s.z, s.yaw, { tag: 'static' }); v.keep = true; v.locked = true; v.display = true; });
}
function spawnPackages() {
  const W = G.world, rng = new RNG(31337), found = G.found || (G.found = { packages: {} });
  G.packagePts = [];
  for (let i = 0; i < 40; i++) {
    const n = W.nodeList[Math.floor(rng.next() * W.nodeList.length)];
    if (!n.city || n.hwH <= 0) { i--; continue; }
    const sx = rng.chance(0.5) ? 1 : -1, sz = rng.chance(0.5) ? 1 : -1;
    const x = n.x + sx * (n.hwV + 5), z = n.z + sz * (n.hwH + 5);
    G.packagePts.push({ id: i, x, z });
  }
  // Inseln-Pakete und versteckte Orte
  for (let i = 0; i < 6; i++) { const I = ISLANDS[i % 4]; const a = rng.range(0, 6.28), r = rng.range(20, I.r * 0.5); const x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r; if (terrainH(x, z) > 1) G.packagePts.push({ id: 40 + i, x, z }); }
  G.refreshPackages = () => {
    for (const it of [...G.pickups.list]) if (it.kind === 'package') G.pickups.removeItem(it);
    for (const p of G.packagePts) if (!G.found.packages[p.id]) G.pickups.addPackage(p.id, p.x, p.z);
  };
  G.refreshPackages();
  G.collect = {
    package: (id) => {
      G.found.packages[id] = true; G.player.stats.packages++;
      const n = Object.keys(G.found.packages).length; G.player.addMoney(500, 'Paket'); G.audio?.pickup?.();
      G.ui?.toast(`Verstecktes Paket gefunden (${n}/${G.packagePts.length}) +$500`);
      if (n === G.packagePts.length) { G.player.addMoney(50000, 'Alle Pakete'); G.ui?.toast('Alle Pakete gefunden! +$50.000'); }
    },
  };
}

function wireEvents() {
  G.on('playerDied', () => {
    G.timeScale = 0.35; G.ui?.banner('WASTED', '#ff3b3b');
    G.audio?.wasted?.();
    setTimeout(() => G.respawn('wasted'), 3600);
  });
  G.on('busted', () => { if (G.player.alive && G.mode === 'play') { G.timeScale = 0.4; G.ui?.banner('BUSTED', '#4aa8ff'); G.player.stats.busted++; G.mode = 'play'; G.player.alive = false; G.player.char.state.hands = true; setTimeout(() => G.respawn('busted'), 2600); } });
  G.on('unlock', () => { if (G.mode === 'play') G.ui?.openPause?.(); });
  G.on('key', (e) => {
    if (e.code === 'Escape') { if (G.mode === 'play') { G.ui?.openPause?.(); } else if (G.mode === 'pause') G.ui?.closePause?.(); }
    if (G.mode === 'play') {
      if (e.code === 'KeyM') G.ui?.openPause?.('map');
      if (e.code === 'KeyI') G.ui?.openPause?.('inventory');
      if (e.code === 'KeyP') G.ui?.openPause?.('phone');
      if (e.code === 'KeyO') G.ui?.openPause?.('character');
      if (e.code === 'F3') G.settings.fps = !G.settings.fps;
    }
  });
}

G.respawn = (why) => {
  const P = G.player, W = G.world;
  G.timeScale = 1;
  G.mission?.onPlayerFail?.(why);
  G.police.reset();
  const kind = why === 'busted' ? 'police' : 'hospital';
  const poi = W.pois.find((p) => p.kind === kind) || W.pois[0];
  const fee = why === 'busted' ? Math.round(P.money * 0.1) : Math.min(1500, Math.round(P.money * 0.05) + 100);
  P.addMoney(-fee, why);
  if (why === 'busted') { for (const k of Object.keys(P.weapons)) if (k !== 'fist' && k !== 'pistol') { P.weapons[k].ammo = Math.floor((P.weapons[k].ammo || 0) * 0.5); } }
  P.respawn(poi.x, poi.z + 4, 0);
  P.char.state.hands = false;
  G.env.time = (G.env.time + (why === 'wasted' ? 2 : 1)) % 24;
  G.ui?.banner(null);
  G.ui?.toast(why === 'busted' ? `Festgenommen – Kaution $${fee} bezahlt.` : `Krankenhausrechnung: $${fee}`);
  G.ui?.fade?.();
  G.eco?.autosave?.();
};

// ---------------- Hauptschleife ----------------
let lastT = 0, acc = 0, frames = 0, fpsT = 0, lowT = 0, playT = 0, qCool = 0;
let signalT = 0; const sigCache = new Map();
export function startLoop() {
  lastT = performance.now();
  const loop = (now) => {
    requestAnimationFrame(loop);
    const raw = Math.min(G.maxDt || 0.05, (now - lastT) / 1000); lastT = now;
    frames++; fpsT += raw; if (fpsT > 0.5) { G.fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
    // Automatische Qualitätsanpassung
    if (G.mode === 'play' && !G.noAuto) {
      playT += raw; qCool -= raw;
      if (playT > 12 && G.fps && G.fps < 27 && !G.maxDt) { lowT += raw; if (lowT > 5 && qCool <= 0) { const order = ['ultra', 'high', 'medium', 'low']; const i = order.indexOf(G.settings.quality); if (i >= 0 && i < 3) { G.settings.quality = order[i + 1]; G.applySettings(); G.ui?.toast('Grafik automatisch auf „' + order[i + 1] + '“ gesenkt (zu niedrige Bildrate).'); } lowT = 0; qCool = 15; } } else lowT = Math.max(0, lowT - raw);
    }
    try { frame(raw); } catch (e) { console.error('frame error', e); G.lastError = String(e && e.stack || e); }
  };
  requestAnimationFrame(loop);
}

const PR = { on: false };
G.prof = PR;
const tm = (k, t0) => { if (PR.on) { PR[k] = (PR[k] || 0) * 0.9 + (performance.now() - t0) * 0.1; } return performance.now(); };
function frame(raw) {
  const dt = raw * (G.timeScale || 1);
  G.time += dt;
  const mode = G.mode;
  const W = G.world, env = G.env, P = G.player;
  let t0 = performance.now();
  G._pm.multiplyMatrices(G.camera.projectionMatrix, G.camera.matrixWorldInverse); G.frustum.setFromProjectionMatrix(G._pm);
  const sim = mode === 'play' || mode === 'cutscene' || mode === 'menu' || mode === 'minigame';
  if (mode === 'menu') G.ui?.menuCamera?.(dt);
  if (sim) {
    if (mode === 'play' || mode === 'cutscene') P.update(dt);
    else { P.char.root.visible = false; P.rig.update(0.0001, P, false); }
    t0 = tm('player', t0);
    G.vehicles.update(dt, W, env); t0 = tm('vehicles', t0);
    G.peds.update(dt); t0 = tm('peds', t0);
    G.traffic.update(dt); t0 = tm('traffic', t0);
    G.police.update(dt);
    G.mission?.update(dt);
    G.activities?.update?.(dt);
    G.eco?.update?.(dt); t0 = tm('misc', t0);
    updateProjectiles(dt);
    G.pickups.update(dt);
    updatePOI(dt);
    for (const a of W.animated) { if (a.type === 'spin') a.obj.rotation.y += a.speed * dt; else if (a.type === 'wheel') a.obj.rotation.z += a.speed * dt; else if (a.type === 'spinz') a.obj.rotation.z += a.speed * dt; }
    signalT -= dt; if (signalT <= 0) { signalT = 0.2; updateSignals(); }
    t0 = tm('poi', t0);
  }
  if (mode !== 'pause') { env.update(dt, mode === 'menu' ? G.camera.position : P.position); }
  t0 = tm('env', t0);
  const vp = env.viewDist;
  W.updateVisibility(G.camera.position.x, G.camera.position.z, vp);
  G.markers.update(dt, P.position.x, P.position.z, G.time);
  t0 = tm('vis', t0);
  G.fx.update(dt, G.camera, innerHeight * (G.env.q?.pr || 1)); t0 = tm('fx', t0);
  G.audio?.update(dt); t0 = tm('audio', t0);
  G.ui?.update(dt); t0 = tm('ui', t0);
  env.render(); t0 = tm('render', t0);
  G.input.endFrame();
}

function updateSignals() {
  const W = G.world, mesh = W.signalMesh; if (!mesh) return;
  const t = G.time; let dirty = false;
  W.signals.forEach((n, si) => {
    const sz = W.signalState(n, 'z', t), sx = W.signalState(n, 'x', t);
    const key = sz * 3 + sx;
    if (sigCache.get(si) === key) return; sigCache.set(si, key); dirty = true;
    for (let ci = 0; ci < 4; ci++) {
      const st = ci < 2 ? sz : sx;
      for (let l = 0; l < 3; l++) {
        const on = (l === 0 && st === 0) || (l === 1 && st === 1) || (l === 2 && st === 2);
        const col = l === 0 ? [3, 0.15, 0.1] : l === 1 ? [3, 2, 0.1] : [0.1, 3, 0.4];
        const f = on ? 1 : 0.06;
        mesh.setColorAt((si * 4 + ci) * 3 + l, _c.setRGB(col[0] * f, col[1] * f, col[2] * f));
      }
    }
  });
  if (dirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
const _c = new THREE.Color();

function updateProjectiles(dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i]; p.t -= dt;
    p.vel.y -= 18 * dt; p.pos.addScaledVector(p.vel, dt);
    const gy = G.world.groundY(p.pos.x, p.pos.z);
    if (p.pos.y < gy + 0.08) { p.pos.y = gy + 0.08; p.vel.y *= -0.35; p.vel.x *= 0.6; p.vel.z *= 0.6; }
    const hit = G.world.pushCircle(p.pos.x, p.pos.z, 0.1, p.pos.y);
    if (hit.hit) { p.pos.x += hit.x; p.pos.z += hit.z; const vn = p.vel.x * hit.nx + p.vel.z * hit.nz; p.vel.x -= 1.5 * vn * hit.nx; p.vel.z -= 1.5 * vn * hit.nz; }
    p.mesh.position.copy(p.pos);
    if (p.t <= 0) { G.scene.remove(p.mesh); G.projectiles.splice(i, 1); G.combat.explode(p.pos.x, p.pos.y, p.pos.z, 9, 1, p.src); }
  }
}

// Zeige nächsten POI, Distrikt etc.
function updatePOI(dt) {
  const P = G.player, W = G.world, pp = P.position;
  G.districtName = W.districtAt(pp.x, pp.z);
  let best = null, bd = 1e9;
  const inV = !!P.vehicle;
  for (const p of W.pois) {
    if (p.kind === 'landmark') continue;
    if (p.disabled) continue;
    const d = Math.hypot(p.x - pp.x, p.z - pp.z);
    const rr = (p.r || 3) + (inV ? 2 : 0.7);
    if (d < rr && d < bd) { if (inV && !VEHICLE_POI.has(p.kind)) continue; if (!inV && VEHICLE_POI.has(p.kind) && p.vehicle) continue; bd = d; best = p; }
  }
  if (best && !inV && G.mission?.promptDef) best = null;
  G.poiNear = best;
  if (G.mode === 'play' && best && P.alive && G.ui && !G.ui.blocking) {
    const key = inV ? 'ENTER' : 'E';
    if (G.input.hit(inV ? 'Enter' : 'KeyE') || (inV && G.input.hit('KeyE') && false)) G.ui.openPOI(best);
  }
}
