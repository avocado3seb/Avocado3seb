// Aktivitäten: Rennen, Taxi, Kurier, Bürgerwehr, Stuntsprünge, Flugparcours, VIP-Events, Schatzsuche
import * as THREE from 'three';
import { G } from './state.js';
import { clamp, lerp, angDiff, RNG, fmtMoney, hash2 } from './util.js';
import { byKey } from './vehicledata.js';
import { RouteDriver } from './ai.js';
import { VIP_EVENTS, PACKS } from './data.js';
import { ISLANDS, terrainH } from './world.js';
import { hwV, hwH } from './city.js';

export const RACES = [
  { name: 'Downtown Dash', kind: 'car', model: 'falcon_rs', laps: 1, opp: 3, fee: 500, reward: [10000, 5000, 2000], cps: [[2, 0], [2, -3], [5, -3], [5, 0], [8, 0], [8, 3], [4, 3], [4, 0], [0, 0], [0, 4], [3, 4]] },
  { name: 'Küstenhatz', kind: 'car', model: 'nitro_gtr', laps: 1, opp: 3, fee: 1000, reward: [18000, 9000, 4000], cps: [[10, 5], [10, 1], [10, -3], [10, -6], [7, -6], [7, -3], [7, 0], [7, 4], [9, 6], [10, 5]] },
];
const CP = (i, j) => ({ x: i * 100 + (i % 4 === 0 ? 0 : 0), z: j * 100 });

export class Activities {
  constructor(G) {
    this.G = G; this.race = null; this.job = null; this.vipRun = null; this.stuntFound = {}; this.stuntState = null; this.chests = []; this.timeTrial = null;
    this.helpers = []; this.ev = null; this.evT = 80;
  }
  init() {
    const G = this.G, W = G.world;
    // Stuntrampen (Paare: Absprung / Landung) an den Highways
    const pairs = [[-400, -1160, 0], [0, -1180, 0], [400, -1200, 0], [800, 1260, Math.PI], [-800, 1300, Math.PI], [0, 1340, Math.PI]];
    pairs.forEach(([x, z, yaw], i) => {
      const dir = yaw === 0 ? -1 : 1; // Fahrtrichtung entlang z
      const zz = z; const heading = yaw === 0 ? Math.PI : 0; // Spieler fährt Richtung Norden (-z) bei yaw=π
      W.addRamp({ x: x + 5.5, z: zz, yaw: heading, len: 14, w: 7, h: 3.8, dir: 1 });
      W.addRamp({ x: x + 5.5, z: zz + (yaw === 0 ? -46 : 46), yaw: heading, len: 18, w: 8, h: 3.2, dir: -1 });
      W.pois.push({ id: 'stunt' + i, kind: 'landmark', name: 'Stuntsprung', x: x + 5.5, z: zz, r: 0 });
    });
    // Schatztruhen auf Inseln (Insel-Pack)
    const rng = new RNG(777);
    ISLANDS.slice(0, 3).forEach((I, k) => { for (let q = 0; q < 2; q++) { const a = rng.range(0, 6.28), r = rng.range(40, I.r * 0.55); const x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r; if (terrainH(x, z) > 1.5) this.chests.push({ id: `${k}_${q}`, x, z, found: false }); } });
    this.chestPick = G.pickups;
    this.refreshChests();
  }
  refreshChests() {
    const G = this.G;
    for (const it of [...G.pickups.list]) if (it.kind === 'chest') G.pickups.removeItem(it);
    if (!G.eco.packs.insel) return;
    for (const c of this.chests) if (!G.found.chests?.[c.id]) G.pickups.addItem('chest', c.x, c.z, { onPick: () => { (G.found.chests ||= {})[c.id] = true; G.player.addMoney(7500, 'Schatz'); G.ui.toast('Schatztruhe gefunden! +$7.500'); G.audio?.cash(); } });
  }
  serialize() { return { stunts: this.stuntFound }; }
  deserialize(d) { this.stuntFound = d?.stunts || {}; this.refreshChests(); }

  // ---------------- Rennen ----------------
  startRace(idx, poi, def = null) {
    const G = this.G, P = G.player;
    if (this.race || G.mission?.current && G.mission.current.blocking) return G.ui.toast('Beende zuerst deine aktuelle Aufgabe.');
    const d = def || RACES[idx % RACES.length];
    if (P.money < d.fee) return G.ui.toast(`Startgebühr: ${fmtMoney(d.fee)}`);
    G.ui.modal(`Rennen: ${d.name}`, (() => { const b = document.createElement('div'); b.className = 'body'; b.innerHTML = `<p>Gegner: ${d.opp} · ${d.laps} Runde(n) · Startgebühr ${fmtMoney(d.fee)}</p><p class="d">Gewinn: 1. ${fmtMoney(d.reward[0])} · 2. ${fmtMoney(d.reward[1])} · 3. ${fmtMoney(d.reward[2])}</p><p class="d">Du erhältst ein Rennfahrzeug (${byKey.get(d.model).name}).</p>`; const btn = document.createElement('button'); btn.className = 'btn primary'; btn.textContent = 'Rennen starten'; btn.onclick = () => { G.ui.closeModal(); P.addMoney(-d.fee, 'Startgebühr'); this.beginRace(d); }; b.append(btn); return b; })());
  }
  beginRace(d, onEnd = null) {
    const G = this.G, W = G.world, P = G.player;
    const cps = d.cps.map((c) => Array.isArray(c) && c.length === 2 && Math.abs(c[0]) < 40 ? { x: c[0] * 100, z: c[1] * 100, y: c[2] } : { x: c.x, z: c.z, y: c.y });
    const n0 = cps[0], n1 = cps[1];
    const dx = n1.x - n0.x, dz = n1.z - n0.z, l = Math.hypot(dx, dz) || 1, yaw = Math.atan2(dx, dz);
    const sx = n0.x - dx / l * 25, sz = n0.z - dz / l * 25;
    const spec = byKey.get(d.model);
    const R = { d, cps, lap: 0, idx: 0, state: 'count', t: 3.2, time: 0, onEnd, markers: [], opps: [], car: null, finished: false };
    // Spielerfahrzeug
    if (d.kind === 'car' || d.kind === 'boat' || d.kind === 'air') {
      if (P.vehicle && d.useOwn) R.car = P.vehicle; else {
        const v = G.vehicles.spawn(spec, sx, sz, yaw, { sleep: false }); v.missionVehicle = true; v.keep = true; v.tag = 'race'; R.car = v; if (P.vehicle) P.exitVehicle(true); P.pos.set(sx + 3, 0, sz); P.enterVehicle(v);
      }
      if (d.kind === 'air') { R.car.pos.y += 0; }
    }
    // Gegner
    const side = [-4, 4, -8, 8, -12, 12];
    for (let i = 0; i < d.opp; i++) {
      const ox = sx - dx / l * (6 + i * 7) + (-dz / l) * side[i % 2] * 1.0, oz = sz - dz / l * (6 + i * 7) + (dx / l) * side[i % 2] * 1.0;
      const m = byKey.get(d.oppModels?.[i % d.oppModels.length] || ['falcon_rs', 'viper_x_380', 'stratos_turbo', 'kestrel_s', 'torque_rt'][i % 5]);
      const v = G.vehicles.spawn(d.kind === 'boat' ? byKey.get('speedster_30') : m, ox, oz, yaw, { sleep: false }); v.missionVehicle = true; v.keep = true; v.tag = 'race';
      const drv = { v, idx: 0, lap: 0, speedMul: 0.92 + Math.random() * 0.12, pts: null };
      v.driver = drv; v.ctrl = (dt) => this.oppDrive(R, drv, dt);
      R.opps.push(drv);
    }
    // Pfade für Gegner (Auto)
    if (d.kind === 'car') for (const o of R.opps) o.route = this.buildRoute(cps, d.laps);
    this.race = R; G.police.suppress = true;
    G.ui.setObjective('RENNEN', `${d.name} – mache dich bereit`);
    if (P.vehicle) { P.vehicle.in.brake = 1; }
    this.updateRaceMarkers(R);
    return R;
  }
  buildRoute(cps, laps) {
    const W = this.G.world, pts = [];
    const seq = []; for (let l = 0; l < laps; l++) for (const c of cps) seq.push(c);
    let prev = null;
    for (const c of seq) { const n = W.nearestNode(c.x, c.z, 300); if (!n) continue; if (prev) { const path = W.findPath(prev, n, 2000); if (path) for (const q of path.slice(1)) pts.push({ x: q.x, z: q.z, lim: 22, cp: false }); } else pts.push({ x: n.x, z: n.z, lim: 22 }); prev = n; }
    return pts;
  }
  oppDrive(R, o, dt) {
    const G = this.G, v = o.v; const d = R.d;
    if (R.state !== 'go') { v.in.throttle = 0; v.in.brake = 1; v.in.hand = true; return; }
    v.in.hand = false;
    const cp = R.cps[o.idx % R.cps.length];
    const target = d.kind === 'boat' ? cp : null;
    if (d.kind === 'boat') {
      const a = angDiff(v.yaw, Math.atan2(cp.x - v.pos.x, cp.z - v.pos.z)); v.in.steer = clamp(a * 1.6, -1, 1); v.in.throttle = 1; v.in.brake = 0;
    } else {
      if (!o.drv) { o.drv = new RouteDriver(G, v, {}); o.drv.pts = o.route || []; o.drv.i = 0; }
      const drv = o.drv; const lim = drv.follow(dt, v.vtop * 0.82 * o.speedMul) ?? 20;
      // Gummiband
      const pl = G.player.vehicle; let rb = 1; if (pl) { const dl = Math.hypot(pl.pos.x - v.pos.x, pl.pos.z - v.pos.z); const ahead = (v.pos.x - pl.pos.x) * Math.sin(pl.yaw) + (v.pos.z - pl.pos.z) * Math.cos(pl.yaw); if (dl > 60 && ahead > 0) rb = 0.82; else if (dl > 60) rb = 1.12; }
      const ob = drv.obstacle(12 + v.speed); drv.speedControl(dt, Math.min(lim * 1.25 * rb, ob < 3 ? 2 : 99, 60));
      if (v.speed < 0.6) { o.stuck = (o.stuck || 0) + dt; if (o.stuck > 3) { v.in.throttle = -1; v.in.steer *= -1; if (o.stuck > 4.5) o.stuck = 0; } } else o.stuck = 0;
    }
    // Checkpoint-Fortschritt
    if (Math.hypot(cp.x - v.pos.x, cp.z - v.pos.z) < (d.kind === 'boat' ? 30 : 32)) { o.idx++; if (o.idx >= R.cps.length * d.laps) { o.finished = true; o.time = R.time; } }
  }
  updateRaceMarkers(R) {
    const G = this.G;
    for (const m of R.markers) G.markers.remove(m); R.markers = [];
    const i = R.idx % R.cps.length, c = R.cps[i], n = R.cps[(i + 1) % R.cps.length];
    const last = R.idx >= R.cps.length * R.d.laps - 1;
    if (R.d.kind === 'air') { R.markers.push(this.ring(c, last ? 0x00e5ff : 0xffd54f, R.cps[(i + 1) % R.cps.length])); }
    else { R.markers.push(G.markers.add({ x: c.x, z: c.z, color: last ? 0x00e5ff : 0xffd54f, r: 9, far: 700, big: true, y: terrainH(c.x, c.z) })); if (!last) R.markers.push(G.markers.add({ x: n.x, z: n.z, color: 0xffffff, r: 5, far: 700 })); }
  }
  ring(c, color, next) {
    const G = this.G;
    const grp = new THREE.Group(); const m = new THREE.Mesh(new THREE.TorusGeometry(16, 0.9, 10, 40), new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.9 }));
    grp.add(m); grp.position.set(c.x, c.y, c.z); const dx = next.x - c.x, dz = next.z - c.z; grp.rotation.y = Math.atan2(dx, dz); G.scene.add(grp);
    const fake = { group: grp, hidden: false, x: c.x, z: c.z, ring: true };
    fake.remove = () => G.scene.remove(grp);
    G.markers.list.push({ x: c.x, z: c.z, group: grp, gem: m, ring: m, r: 3, far: 3000, color, fakeRing: true });
    return G.markers.list[G.markers.list.length - 1];
  }
  endRace(win) { const G = this.G; const R = this.race; if (!R) return; for (const m of R.markers) { if (m.fakeRing) { G.scene.remove(m.group); const i = G.markers.list.indexOf(m); if (i >= 0) G.markers.list.splice(i, 1); } else G.markers.remove(m); } R.markers = []; for (const o of R.opps) { o.v.ctrl = null; o.v.driver = null; o.v.keep = false; o.v.missionVehicle = false; o.v.tag = 'abandoned'; } if (R.car && R.car.tag === 'race') { R.car.tag = 'abandoned'; R.car.keep = false; R.car.missionVehicle = false; } G.police.suppress = false; this.race = null; G.ui.setObjective(null); }
  playerPlace(R) {
    const d = R.d, total = R.cps.length * d.laps;
    const score = (idx, v) => { const cp = R.cps[idx % R.cps.length]; return idx * 1000 - Math.hypot(cp.x - v.pos.x, cp.z - v.pos.z); };
    const ps = score(R.idx, R.car);
    let place = 1; for (const o of R.opps) { if (o.finished) { place++; continue; } if (score(o.idx, o.v) > ps) place++; }
    return place;
  }
  updateRace(dt) {
    const R = this.race, G = this.G; if (!R) return;
    const P = G.player;
    if (R.state === 'count') {
      R.t -= dt; if (P.vehicle) { P.vehicle.in.brake = 1; P.vehicle.in.throttle = 0; }
      G.ui.subtitle('', `<span style="font-size:70px">${Math.max(0, Math.ceil(R.t - 0.2)) || 'LOS!'}</span>`, 400);
      if (R.t <= 0) { R.state = 'go'; G.audio?.wantedUp(); }
      return;
    }
    if (R.finished) return;
    R.time += dt;
    const place = this.playerPlace(R);
    G.ui.setObjective('RENNEN', `Position ${place}/${R.opps.length + 1} · Checkpoint ${(R.idx % R.cps.length) + 1}/${R.cps.length}${R.d.laps > 1 ? ' · Runde ' + (Math.floor(R.idx / R.cps.length) + 1) + '/' + R.d.laps : ''}`, null);
    if (R.d.limit && R.time > R.d.limit) { this.finishRace(false, 'Zeit abgelaufen!'); return; }
    if (!P.vehicle || P.vehicle.exploded) { R.out = (R.out || 0) + dt; if (R.out > 12) { this.finishRace(false, 'Du hast das Rennen verlassen.'); return; } G.ui.subtitle('', 'Kehre zum Fahrzeug zurück!', 300); } else R.out = 0;
    const cp = R.cps[R.idx % R.cps.length]; const pv = P.vehicle || R.car;
    const dd = R.d.kind === 'air' ? Math.hypot(cp.x - pv.pos.x, cp.z - pv.pos.z, (cp.y - pv.pos.y) * 0.8) : Math.hypot(cp.x - pv.pos.x, cp.z - pv.pos.z);
    if (dd < (R.d.kind === 'air' ? 24 : R.d.kind === 'boat' ? 24 : 16)) {
      R.idx++; G.audio?.pickup();
      if (R.idx >= R.cps.length * R.d.laps) { R.finished = true; const pl = this.playerPlace(R); this.finishRace(pl <= (R.d.reward.length), null, pl); return; }
      this.updateRaceMarkers(R);
    }
    // Gegner im Ziel? Rennen verloren, wenn alle fertig
    if (R.opps.length && R.opps.every((o) => o.finished) && R.d.kind !== 'air') { this.finishRace(false, 'Alle Gegner sind im Ziel.'); }
  }
  finishRace(win, msg, place = 0) {
    const G = this.G, R = this.race; if (!R) return;
    const done = R.onEnd; const d = R.d;
    if (win && place > 0) { const rw = d.reward[place - 1] || 0; G.player.addMoney(rw, 'Rennen'); G.ui.banner(place === 1 ? 'SIEG!' : `PLATZ ${place}`, '#ffd54f'); G.player.stats.races += place === 1 ? 1 : 0; G.audio?.missionPass(); G.ui.toast(`${d.name}: Platz ${place} – ${fmtMoney(rw)}  (Zeit ${R.time.toFixed(1)} s)`); }
    else { G.ui.banner('VERLOREN', '#ff5252'); G.ui.toast(msg || 'Rennen verloren.'); G.audio?.missionFail(); }
    setTimeout(() => G.ui.banner(null), 2600);
    this.endRace(win); G.eco.autosave();
    done && done(win && place === 1, place);
  }

  // ---------------- Jobs ----------------
  startJob(kind) {
    const G = this.G;
    if (this.job) { this.job.end('Aufgabe abgebrochen'); return; }
    if (G.mission?.current?.blocking) return G.ui.toast('Beende zuerst die Mission.');
    if (kind === 'taxi') this.job = new TaxiJob(G, this); else if (kind === 'delivery') this.job = new DeliveryJob(G, this); else if (kind === 'vigilante') this.job = new VigilanteJob(G, this); else if (kind === 'flight') return this.startFlightSchool();
    this.job?.start();
  }
  // ---------------- Flugschule & Regatta ----------------
  startFlightSchool() {
    const G = this.G, P = G.player;
    if (!G.eco.packs.flug) return G.ui.toast('Benötigt: Flugzeug-Pack');
    const cx = -900, cz = 850, cps = [];
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; cps.push({ x: cx + Math.cos(a) * 700 + 300, z: cz - 700 + Math.sin(a) * 600, y: 90 + 55 * Math.sin(k * 1.3) + 30 }); }
    this.beginRace({ name: 'Flugschule: Ringparcours', kind: 'air', model: 'stunt_falcon', laps: 1, opp: 0, fee: 0, reward: [20000, 10000, 4000], cps, limit: 360 });
    const R = this.race; R.car.place(-1180, 835, Math.PI / 2); R.car.pos.y = terrainH(-1180, 835) + 0.5;
  }
  startRegatta() {
    const G = this.G; if (!G.eco.packs.yacht) return G.ui.toast('Benötigt: Yacht-Pack');
    const cps = [[1500, 1000], [1700, 800], [1800, 400], [1700, 0], [1500, -300], [1400, -700], [1600, -1000], [1900, -800], [2000, -300]].map(([x, z]) => ({ x, z }));
    this.beginRace({ name: 'Vice Hochseeregatta', kind: 'boat', model: 'racer_cigar', laps: 1, opp: 3, fee: 3000, reward: [40000, 20000, 8000], cps });
    const R = this.race; R.car.place(1420, 960, Math.atan2(80, -40));
  }
  // ---------------- VIP-Events ----------------
  vip(id) {
    const G = this.G, e = VIP_EVENTS.find((q) => q.id === id), P = G.player;
    if (!e) return;
    if (!G.eco.packs[e.pack]) return G.ui.toast(`Benötigt: ${PACKS[e.pack].name}`);
    if (G.eco.prestige() < e.minPrestige) return G.ui.toast(`Prestige zu niedrig (${G.eco.prestige()}/${e.minPrestige}). Kaufe Uhren, Designer-Outfits, Immobilien.`);
    if (P.money < e.fee) return G.ui.toast(`Eintritt ${fmtMoney(e.fee)}`);
    P.addMoney(-e.fee, 'VIP-Eintritt');
    // Gäste verteilen: 5 Ziele zum Ansprechen
    const guests = []; const rng = new RNG(Math.floor(G.time * 100));
    for (let i = 0; i < 5; i++) { const a = rng.range(0, 6.28), r = rng.range(8, 30); const x = e.x + Math.cos(a) * r, z = e.z + Math.sin(a) * r + (e.id === 'clubnight' ? 14 : 0); const ped = G.peds.spawnAt(x, z, 'civ', { ...G.peds.randomOutfit(), top: 6, topColor: 0x222222 }); ped.persist = true; ped.state = 'idle'; ped.t = 9999; ped.talkT = 99; ped.vip = true; const m = G.markers.add({ x, z, color: 0xe040fb, r: 1.6, far: 300 }); guests.push({ ped, m, done: false }); }
    this.vipRun = { e, guests, t: 150 };
    G.ui.toast(`${e.name} gestartet – sprich mit allen 5 Gästen (E)!`);
  }
  updateVip(dt) {
    const V = this.vipRun; if (!V) return; const G = this.G, P = G.player;
    V.t -= dt; const left = V.guests.filter((g) => !g.done).length;
    G.ui.setObjective('VIP-EVENT', `${V.e.name}: ${left} Gäste übrig`, V.t);
    for (const g of V.guests) { if (g.done) continue; if (Math.hypot(g.ped.pos.x - P.pos.x, g.ped.pos.z - P.pos.z) < 2.4 && G.input.hit('KeyE')) { g.done = true; g.ped.say = null; G.markers.remove(g.m); G.ui.say(g.ped, ['Schön, dich zu sehen!', 'Einfach grandios, die Party!', 'Wir müssen unbedingt Geschäfte machen.', 'Das Outfit steht dir ausgezeichnet!', 'Prost!'][Math.floor(Math.random() * 5)], 3); G.audio?.pickup(); } }
    if (!left) { P.addMoney(V.e.reward, 'VIP'); G.ui.toast(`VIP-Event gemeistert! +${fmtMoney(V.e.reward)}`); G.ui.banner('VIP-EVENT GESCHAFFT', '#e040fb'); setTimeout(() => G.ui.banner(null), 2400); this.endVip(); }
    else if (V.t <= 0) { G.ui.toast('Das Event ist vorbei – zu langsam.'); this.endVip(); }
  }
  endVip() { const G = this.G, V = this.vipRun; for (const g of V.guests) { G.markers.remove(g.m); g.ped.persist = false; g.ped.t = 1; } this.vipRun = null; G.ui.setObjective(null); }

  // ---------------- Update ----------------
  update(dt) {
    const G = this.G;
    this.updateRace(dt);
    this.job?.update(dt);
    this.updateVip(dt);
    this.updateStunts(dt);
    this.updateEvents(dt);
  }
  updateStunts(dt) {
    const G = this.G, v = G.player.vehicle; if (!v || v.kind === 'plane' || v.kind === 'heli' || v.kind === 'boat') { this.stuntState = null; return; }
    const s = this.stuntState;
    if (v.air && !s) this.stuntState = { t: 0, x: v.pos.x, z: v.pos.z, y: v.pos.y };
    else if (v.air && s) { s.t += dt; s.maxY = Math.max(s.maxY || 0, v.pos.y); }
    else if (!v.air && s) {
      const d = Math.hypot(v.pos.x - s.x, v.pos.z - s.z);
      if (s.t > 0.9 && d > 16) { const bonus = Math.round(d * 40 + s.t * 300); G.player.addMoney(bonus, 'Stunt'); G.player.stats.stunts++; G.ui.toast(`🏆 Stuntsprung! ${Math.round(d)} m · ${s.t.toFixed(1)} s · +${fmtMoney(bonus)}`); G.audio?.pickup(); G.ui.banner('STUNTSPRUNG', '#ffd54f'); setTimeout(() => G.ui.banner(null), 1400); }
      this.stuntState = null;
    }
  }
}

// =================== Jobs ===================
class JobBase {
  constructor(G, act) { this.G = G; this.act = act; this.marker = null; this.t = 0; this.earned = 0; this.count = 0; this.noCarT = 0; }
  clear() { if (this.marker) { this.G.markers.remove(this.marker); this.marker = null; } this.G.waypoint = null; }
  end(msg) { this.clear(); this.G.ui.toast(msg || 'Aufgabe beendet'); if (this.earned) this.G.ui.toast(`Gesamtverdienst: ${fmtMoney(this.earned)}`); this.G.ui.setObjective(null); this.cleanup?.(); this.act.job = null; }
  randomSidewalk(minD, maxD) {
    const G = this.G, W = G.world, pp = G.player.position;
    for (let i = 0; i < 40; i++) { const n = W.nodeList[Math.floor(Math.random() * W.nodeList.length)]; if (!n.city || n.hwH <= 0) continue; const d = Math.hypot(n.x - pp.x, n.z - pp.z); if (d < minD || d > maxD) continue; return { x: n.x + (Math.random() < 0.5 ? 1 : -1) * (n.hwV + 3), z: n.z + (Math.random() < 0.5 ? 1 : -1) * (n.hwH + 3) + 0 }; }
    return { x: pp.x + 200, z: pp.z };
  }
}
class TaxiJob extends JobBase {
  start() { this.G.ui.toast('Taxi-Dienst gestartet. Fahre mit einem Auto zu den Fahrgästen!'); this.phase = 'pickup'; this.next(); }
  next() { const G = this.G; this.clear(); this.target = this.randomSidewalk(150, 700); this.marker = G.markers.add({ x: this.target.x, z: this.target.z, color: this.phase === 'pickup' ? 0x69f0ae : 0xffd54f, r: 4, far: 900 }); G.waypoint = { x: this.target.x, z: this.target.z }; this.start0 = { x: G.player.position.x, z: G.player.position.z }; this.t = 0; this.limit = null; if (this.phase === 'drop') { this.limit = 40 + Math.hypot(this.target.x - this.fromPos.x, this.target.z - this.fromPos.z) / 9; } }
  update(dt) {
    const G = this.G, P = G.player; this.t += dt;
    const inCar = P.vehicle && P.vehicle.kind === 'car' && P.vehicle.spec.cls !== 'bus';
    if (!inCar) { this.noCarT += dt; if (this.noCarT > 25) return this.end('Taxidienst beendet (kein Fahrzeug).'); } else this.noCarT = 0;
    G.ui.setObjective('TAXI', this.phase === 'pickup' ? 'Hole den Fahrgast ab' : 'Bringe den Fahrgast ans Ziel', this.limit ? Math.max(0, this.limit - this.t) : null);
    const d = Math.hypot(this.target.x - P.position.x, this.target.z - P.position.z);
    if (d < 7 && inCar && P.vehicle.speed < 6) {
      if (this.phase === 'pickup') { this.phase = 'drop'; this.fromPos = { x: this.target.x, z: this.target.z }; G.ui.toast('Fahrgast eingestiegen'); this.next(); }
      else { const dist = Math.hypot(this.target.x - this.fromPos.x, this.target.z - this.fromPos.z); const bonus = Math.max(0, (this.limit - this.t)) * 3; const fare = Math.round(40 + dist * 0.45 + bonus + (P.vehicle.spec.taxi ? 30 : 0)); P.addMoney(fare, 'Taxi'); this.earned += fare; this.count++; G.ui.toast(`Fahrt beendet: ${fmtMoney(fare)}`); G.audio?.cash(); this.phase = 'pickup'; this.next(); }
    }
    if (this.limit && this.t > this.limit + 20) { G.ui.toast('Der Fahrgast ist ausgestiegen – zu langsam!'); this.phase = 'pickup'; this.next(); }
  }
}
class DeliveryJob extends JobBase {
  start() { this.G.ui.toast('Kurier-Auftrag: Hole das Paket ab und liefere es pünktlich aus.'); this.phase = 'pickup'; this.next(); }
  next() { const G = this.G; this.clear(); const here = G.player.position; this.target = this.randomSidewalk(this.phase === 'pickup' ? 120 : 250, this.phase === 'pickup' ? 450 : 900); this.marker = G.markers.add({ x: this.target.x, z: this.target.z, color: this.phase === 'pickup' ? 0x82b1ff : 0xff9800, r: 4, far: 900 }); G.waypoint = { x: this.target.x, z: this.target.z }; this.t = 0; if (this.phase === 'drop') { this.limit = 30 + Math.hypot(this.target.x - this.fromPos.x, this.target.z - this.fromPos.z) / 10; } else this.limit = null; }
  update(dt) {
    const G = this.G, P = G.player; this.t += dt;
    G.ui.setObjective('KURIER', this.phase === 'pickup' ? 'Paket abholen' : 'Paket ausliefern', this.limit ? Math.max(0, this.limit - this.t) : null);
    const d = Math.hypot(this.target.x - P.position.x, this.target.z - P.position.z);
    if (d < 6) {
      if (this.phase === 'pickup') { this.phase = 'drop'; this.fromPos = { x: this.target.x, z: this.target.z }; G.ui.toast('Paket aufgenommen!'); this.next(); }
      else { const dist = Math.hypot(this.target.x - this.fromPos.x, this.target.z - this.fromPos.z); const pay = Math.round(150 + dist * 0.8 + Math.max(0, this.limit - this.t) * 4); P.addMoney(pay, 'Kurier'); this.earned += pay; G.ui.toast(`Paket geliefert: ${fmtMoney(pay)}`); G.audio?.cash(); this.phase = 'pickup'; this.next(); }
    }
    if (this.limit && this.t > this.limit) { G.ui.toast('Zu spät! Das Paket wurde zurückgegeben.'); this.phase = 'pickup'; this.next(); }
  }
}
class VigilanteJob extends JobBase {
  start() { this.kills = 0; this.targets = []; this.G.ui.toast('Bürgerwehr: Stelle die Verbrecher! Zerstöre ihre Fahrzeuge.'); this.spawn(); }
  spawn() {
    const G = this.G, W = G.world, pp = G.player.position; const n = W.nearestNode(pp.x + (Math.random() - 0.5) * 500, pp.z + (Math.random() - 0.5) * 500, 400); if (!n || !n.out.length) return;
    const o = n.out[Math.floor(Math.random() * n.out.length)];
    const v = G.vehicles.spawn(['muscle', 'sport'][Math.floor(Math.random() * 2)] === 'muscle' ? 'brawler_v8' : 'falcon_rs', n.x + 5, n.z + 12, Math.atan2(o.dx, o.dz), { sleep: false, color: 0x1b1b1f }); v.missionVehicle = true; v.keep = true; v.tag = 'crim';
    G.traffic.makeDriver(v, n, o.to); v.ai.pers = 1.35; v.ai.panic = 0;
    const m = G.markers.add({ x: v.pos.x, z: v.pos.z, color: 0xff5252, r: 3, far: 2500, big: true });
    this.targets.push({ v, m, t: 0 });
    G.ui.toast('Ein Verbrecher flieht! Hol ihn dir.');
  }
  update(dt) {
    const G = this.G, P = G.player;
    G.ui.setObjective('BÜRGERWEHR', `Verbrecher gestoppt: ${this.kills}/5`, null);
    for (const t of this.targets) {
      t.t += dt; t.m.x = t.v.pos.x; t.m.z = t.v.pos.z; t.m.group.position.set(t.v.pos.x, t.v.pos.y, t.v.pos.z);
      const d = Math.hypot(t.v.pos.x - P.position.x, t.v.pos.z - P.position.z);
      if (t.v.exploded || (t.v.speed < 1 && t.v.health < 450 && d < 30)) { t.done = true; this.kills++; P.addMoney(1200, 'Bürgerwehr'); this.earned += 1200; G.ui.toast('Verbrecher ausgeschaltet! +$1.200'); G.audio?.cash(); }
      else if (d > 650) { t.done = true; t.fail = true; G.ui.toast('Der Verbrecher ist entkommen.'); }
      // Fahrer weiterfahren lassen (Paniken)
      if (t.v.ai && t.v.ai.panic <= 0 && t.v.health < 900) t.v.ai.panic = 5;
      if (t.done) { G.markers.remove(t.m); t.v.keep = false; t.v.missionVehicle = false; t.v.tag = 'abandoned'; }
    }
    this.targets = this.targets.filter((t) => !t.done);
    if (this.kills >= 5) return this.end('Bürgerwehr abgeschlossen!');
    if (!this.targets.length) this.spawn();
  }
  cleanup() { for (const t of this.targets) { this.G.markers.remove(t.m); t.v.keep = false; t.v.tag = 'abandoned'; } this.targets = []; }
}

// =================== Zufällige Ereignisse ===================
Activities.prototype.updateEvents = function (dt) {
  const G = this.G, P = G.player;
  if (this.ev) { const r = this.ev.update(dt); if (r) { this.ev.cleanup(); this.ev = null; this.evT = 100 + Math.random() * 120; } return; }
  if (G.mode !== 'play' || !P.alive || G.mission?.current || this.race || this.job || this.vipRun || G.police.stars > 0 || G.ui.blocking) { this.evT = Math.max(this.evT, 20); return; }
  this.evT -= dt;
  if (this.evT <= 0) { const k = Math.random() < 0.55 ? Mugging : Hitchhiker; this.ev = new k(G); if (!this.ev.start()) { this.ev = null; this.evT = 25; } }
};
class RandomEv {
  constructor(G) { this.G = G; this.t = 0; this.mk = []; this.peds = []; }
  cleanup() { for (const m of this.mk) this.G.markers.remove(m); for (const p of this.peds) { p.persist = false; p.brain = null; } this.G.ui.setObjective(null); this.G.waypoint = null; }
  spot(minD, maxD) {
    const G = this.G, W = G.world, pp = G.player.position;
    for (let i = 0; i < 50; i++) { const n = W.nodeList[Math.floor(Math.random() * W.nodeList.length)]; if (!n.city || n.hwH <= 0 || n.hwV <= 0) continue; const d = Math.hypot(n.x - pp.x, n.z - pp.z); if (d < minD || d > maxD) continue; return { x: n.x + (Math.random() < 0.5 ? 1 : -1) * (n.hwV + 3), z: n.z + (Math.random() < 0.5 ? 1 : -1) * (n.hwH + 3), n }; }
    return null;
  }
}
class Mugging extends RandomEv {
  start() {
    const G = this.G, s = this.spot(60, 160); if (!s) return false;
    const victim = G.peds.spawnAt(s.x, s.z, 'civ'); victim.persist = true; victim.state = 'cower'; victim.t = 30; victim.noDrop = true;
    const thief = G.peds.spawnAt(s.x + 2, s.z + 1, 'civ', { ...G.peds.randomOutfit(), top: 4, topColor: 0x111111, hat: 2, hatColor: 0x111111 }); thief.persist = true; thief.noDrop = true; thief.cash = 700; thief.health = 60;
    thief.state = 'brain'; const tgt = { x: s.x + (Math.random() - 0.5) * 400, z: s.z + (Math.random() - 0.5) * 400 };
    thief.brain = (dt, p) => { let dx = tgt.x - p.pos.x, dz = tgt.z - p.pos.z; const d = Math.hypot(dx, dz); if (d < 6) { tgt.x = p.pos.x + (Math.random() - 0.5) * 500; tgt.z = p.pos.z + (Math.random() - 0.5) * 500; } const w = G.world.pushCircle(p.pos.x + dx / (d || 1) * 1.5, p.pos.z + dz / (d || 1) * 1.5, 0.4, p.pos.y + 0.3); if (w.hit) { tgt.x = p.pos.x + w.nx * 60 + (Math.random() - 0.5) * 60; tgt.z = p.pos.z + w.nz * 60 + (Math.random() - 0.5) * 60; } return { vx: dx / (d || 1) * 5.6, vz: dz / (d || 1) * 5.6, spd: 5.6 }; };
    this.victim = victim; this.thief = thief; this.peds = [victim, thief];
    this.mk.push(G.markers.add({ x: thief.pos.x, z: thief.pos.z, color: 0xff5252, r: 2, far: 400, big: true })); this.m = this.mk[0];
    G.ui.say(victim, 'Hilfe! Mein Geld! Haltet den Dieb!', 5); G.ui.toast('⚠ Raubüberfall in der Nähe – schnapp dir den Dieb!');
    return true;
  }
  update(dt) {
    const G = this.G, t = this.thief; this.t += dt; this.m.x = t.pos.x; this.m.z = t.pos.z; this.m.group.position.set(t.pos.x, t.pos.y, t.pos.z);
    G.ui.setObjective('ZUFALLSEREIGNIS', 'Fange den Dieb (Taschendieb flüchtet)', Math.max(0, 90 - this.t)); G.waypoint = { x: t.pos.x, z: t.pos.z };
    if (!t.alive) { G.player.addMoney(500, 'Dieb gestellt'); G.ui.toast('Dieb erledigt! Beute zurückgegeben +$500'); G.audio?.cash(); return true; }
    const d = Math.hypot(t.pos.x - G.player.position.x, t.pos.z - G.player.position.z);
    if (this.t > 90 || d > 260) { G.ui.toast('Der Dieb ist entkommen.'); return true; }
    return false;
  }
}
class Hitchhiker extends RandomEv {
  start() {
    const G = this.G, s = this.spot(60, 140); if (!s) return false;
    const ped = G.peds.spawnAt(s.x, s.z, 'civ'); ped.persist = true; ped.noDrop = true; ped.state = 'brain'; ped.brain = () => ({ vx: 0, vz: 0, spd: 0 }); ped.faceTarget = true; ped.lookAt = G.player.position;
    this.ped = ped; this.peds = [ped]; this.phase = 'wait';
    this.mk.push(G.markers.add({ x: s.x, z: s.z, color: 0x69f0ae, r: 3, far: 500 })); this.m = this.mk[0];
    G.ui.say(ped, 'Hey! Kannst du mich mitnehmen?!', 5); G.ui.toast('🚗 Ein Anhalter wartet – fahre hin und halte an.');
    return true;
  }
  update(dt) {
    const G = this.G, P = G.player; this.t += dt;
    if (this.phase === 'wait') {
      G.ui.setObjective('ZUFALLSEREIGNIS', 'Hole den Anhalter ab', Math.max(0, 80 - this.t)); G.waypoint = { x: this.m.x, z: this.m.z };
      const v = P.vehicle; const d = Math.hypot(this.m.x - P.position.x, this.m.z - P.position.z);
      if (v && v.kind === 'car' && d < 9 && v.speed < 6) { this.phase = 'ride'; this.t = 0; this.ped.char.root.visible = false; this.ped.state = 'inside'; this.ped.t = 9999; const dest = this.spot(350, 900); this.dest = dest || { x: this.m.x + 400, z: this.m.z }; G.markers.remove(this.m); this.m = G.markers.add({ x: this.dest.x, z: this.dest.z, color: 0xffd54f, r: 5, far: 1500, big: true }); this.mk.push(this.m); this.from = { x: P.position.x, z: P.position.z }; G.ui.toast('Anhalter an Bord – bringe ihn zum Ziel.'); }
      if (this.t > 80 || d > 300) { G.ui.toast('Der Anhalter ist weitergegangen.'); return true; }
    } else {
      G.ui.setObjective('ZUFALLSEREIGNIS', 'Bringe den Anhalter ans Ziel', null); G.waypoint = { x: this.dest.x, z: this.dest.z };
      if (!P.vehicle) { this.leave = (this.leave || 0) + dt; if (this.leave > 12) { G.ui.toast('Der Anhalter ist ausgestiegen.'); return true; } } else this.leave = 0;
      if (P.vehicle && Math.hypot(this.dest.x - P.position.x, this.dest.z - P.position.z) < 10) { const pay = Math.round(80 + Math.hypot(this.dest.x - this.from.x, this.dest.z - this.from.z) * 0.5); P.addMoney(pay, 'Anhalter'); G.ui.toast(`Anhalter abgesetzt: ${fmtMoney(pay)}`); G.audio?.cash(); this.ped.pos.set(this.dest.x + 3, G.world.groundY(this.dest.x, this.dest.z), this.dest.z); this.ped.char.root.visible = true; this.ped.state = 'idle'; this.ped.brain = null; this.ped.t = 2; return true; }
    }
    return false;
  }
}
