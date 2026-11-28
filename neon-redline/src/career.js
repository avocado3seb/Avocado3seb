/* NEON REDLINE – career.js : Karriere, Rennen/Events, Story, Wirtschaft, Erfolge, Speichern */
(function (G) {
'use strict';
const U = G.U, W = G.World, CD = G.CD, AI = G.AI; const { clamp, lerp } = U; const V3 = THREE.Vector3;
const C = { data: null, events: [], garages: [], speedTraps: [], active: null, nearEvent: null, navRoute: null, wp: null };
G.Career = C;

/* ------------------------------------------------------------------ Daten */
const CLS = { D: 0, C: 1, B: 2, A: 3, S: 4, X: 5 };
const PERSONAS = [
  { name: 'Kira "Ghost" Vale', skill: 0.97, aggr: 0.35, drift: 0.2, car: 'evo_tora_x', color: '#e8e8ec' },
  { name: 'Dante Rourke', skill: 0.95, aggr: 0.8, drift: 0.1, car: 'daemon_sc', color: '#8f1d1d' },
  { name: 'Mika Tanabe', skill: 0.9, aggr: 0.3, drift: 0.9, car: 'zephyr_s15', color: '#00b3ff' },
  { name: 'Jonas "Torque" Brandt', skill: 0.92, aggr: 0.5, drift: 0.1, car: 'carrera_rs', color: '#f2c200' },
  { name: 'Luca Moretti', skill: 0.96, aggr: 0.55, drift: 0.1, car: 'corsa_f8', color: '#d40000' },
  { name: 'Rhea Okafor', skill: 0.93, aggr: 0.25, drift: 0.4, car: 'oni_r_spec', color: '#9aa4ae' },
  { name: 'Viktor Hale', skill: 0.98, aggr: 0.7, drift: 0.0, car: 'aventor_v12', color: '#ffd100' },
  { name: 'Nova', skill: 0.99, aggr: 0.4, drift: 0.2, car: 'specter_kappa', color: '#111827' },
];
C.PERSONAS = PERSONAS;
const GARAGE_DEF = [
  { id: 'g1', name: 'Downtown-Garage', x: 0, z: 240, lvl: 1, desc: 'Deine erste Garage im Herzen von Meridian City.', slots: 4 },
  { id: 'g2', name: 'Hafen-Werkstatt', x: -1850, z: 250, lvl: 3, desc: 'Umgebaute Lagerhalle zwischen den Containern.', slots: 8 },
  { id: 'g3', name: 'Industrie-Hangar', x: 900, z: 1500, lvl: 5, desc: 'Großer Hangar mit Prüfstand im Industriegebiet.', slots: 12 },
  { id: 'g4', name: 'Kalmar-Lodge', x: 1075, z: -1150, lvl: 8, desc: 'Luxus-Garage am Fuß des Passes mit Glasfront.', slots: 20 },
];
/* Veranstaltungen */
const EV = [
  { id: 'e1', name: 'Erste Runde', type: 'sprint', desc: 'Sprint von der Innenstadt bis zum Hafentor. Zeig, was in dir steckt.', from: [-240, -120], to: [-1850, 40], opp: 2, cls: 'D', lvl: 1, cash: 4000, xp: 250, diff: 1, ch: 1 },
  { id: 'e2', name: 'Neon-Kreuzung', type: 'circuit', desc: 'Zwei Runden um den Innenstadt-Block. Ampeln beachten – oder nicht.', via: [[-360, -360], [360, -360], [360, 360], [-360, 360]], laps: 2, opp: 3, cls: 'D', lvl: 1, cash: 6000, xp: 350, diff: 1, ch: 1 },
  { id: 'e3', name: 'Hafen-Drag', type: 'drag', desc: 'Gerade Strecke entlang der Kaimauer. Reine Beschleunigung.', from: [-1850, -620], to: [-1850, 720], opp: 1, cls: 'D', lvl: 1, cash: 5000, xp: 300, diff: 1, ch: 1 },
  { id: 'e4', name: 'Industrie-Sprint', type: 'sprint', desc: 'Durch das Werksgelände bis zur Südausfahrt.', from: [600, 1200], to: [1350, 1800], opp: 3, cls: 'D', lvl: 2, cash: 8500, xp: 420, diff: 2, ch: 2 },
  { id: 'e5', name: 'Zeitangriff Küste', type: 'time', desc: 'Schaffe die Küstenstraße innerhalb des Zeitlimits.', from: [-1850, -700], to: [0, -2420], limit: 250, cls: 'C', lvl: 2, cash: 11000, xp: 500, diff: 2, ch: 2 },
  { id: 'e6', name: 'Ring-Jagd', type: 'circuit', desc: 'Eine volle Runde auf der Ring-Autobahn A0 – 8 Kilometer Vollgas.', ring: true, laps: 1, opp: 4, cls: 'C', lvl: 3, cash: 16000, xp: 700, diff: 2, ch: 3 },
  { id: 'e7', name: 'Meridian-Brücke', type: 'sprint', desc: 'Duell über die große Brücke bis zum Kap.', from: [0, 800], to: [0, 2690], opp: 2, cls: 'C', lvl: 3, cash: 14000, xp: 650, diff: 2, ch: 3 },
  { id: 'e8', name: 'Drift-Akademie', type: 'drift', desc: 'Sammle 12.000 Driftpunkte auf der Passstraße. Ketten verdoppeln die Punkte.', zone: 'pass', target: 12000, limit: 150, cls: 'C', lvl: 4, cash: 12000, xp: 600, diff: 2, ch: 3 },
  { id: 'e9', name: 'Tunnelrausch', type: 'sprint', desc: 'Autobahn A1 Ost bis zum Tunnelausgang. Überhol-Chaos garantiert.', from: [720, 0], to: [2540, 10], opp: 4, cls: 'B', lvl: 5, cash: 24000, xp: 900, diff: 3, ch: 4 },
  { id: 'e10', name: 'Nachtfahrt Nord', type: 'sprint', night: true, illegal: true, desc: 'Illegales Nachtrennen durch den Nordtunnel. Die Polizei hört mit.', from: [0, -800], to: [-250, -2460], opp: 4, cls: 'B', lvl: 5, cash: 30000, xp: 1100, diff: 3, ch: 4 },
  { id: 'e11', name: 'Kalmar-Bergrennen', type: 'sprint', desc: 'Der Pass hinauf – enge Kehren, kein Fehler erlaubt.', from: [1075, -1150], to: 'summit', opp: 4, cls: 'B', lvl: 6, cash: 38000, xp: 1400, diff: 3, ch: 5 },
  { id: 'e12', name: 'Flucht aus dem Hafen', type: 'chase', illegal: true, desc: 'Du bist aufgefallen. Entkomme der Polizei (Fahndungsstufe 3).', from: [-1850, 0], heat: 3, limit: 240, cls: 'B', lvl: 6, cash: 35000, xp: 1500, diff: 3, ch: 5 },
  { id: 'e13', name: 'Geisterstunde', type: 'circuit', night: true, illegal: true, desc: 'Zwei Runden Ring bei Nacht gegen die Besten der Szene.', ring: true, laps: 2, opp: 5, cls: 'A', lvl: 8, cash: 60000, xp: 2000, diff: 4, ch: 6 },
  { id: 'e14', name: 'Hochwald-Rekord', type: 'time', desc: 'Von der Innenstadt bis Hochwald durch den Tunnel – Streckenrekord jagen.', from: [720, 0], to: [2640, 55], limit: 105, cls: 'A', lvl: 8, cash: 52000, xp: 1800, diff: 4, ch: 6 },
  { id: 'e15', name: 'Meridian-Finale', type: 'circuit', desc: 'Das letzte Rennen: Dante Rourke fordert dich zum Duell um den Titel.', via: [[0, 240], [1250, 0], [0, 1250], [-1250, 0], [0, -1250]], laps: 1, opp: 3, cls: 'S', lvl: 10, cash: 150000, xp: 5000, diff: 5, ch: 7, finale: true },
];
const TRAPS = [[1900, 15, 280], [-1400, 10, 260], [0, -1500, 270], [0, 1500, 270], [1250, 0, 250], [-1250, 0, 250], [700, -700, 200], [-884, 884, 200]].map((t, i) => ({ id: 't' + i, x: t[0], z: t[1], target: t[2] }));
const STORY = [
  { id: 1, title: 'Kapitel 1 · Namenlos', need: 0, who: 'Hiro (Mechaniker)', text: 'Neu in Meridian City? Dein Zephyr ist ein ehrlicher Wagen. Fahr deine ersten Rennen – Hafen, Innenstadt, und halte dich von der Polizei fern.' },
  { id: 2, title: 'Kapitel 2 · Erste Gerüchte', need: 3, who: 'Lux (Veranstalterin)', text: 'Man spricht über dich. Kira Vale will wissen, wer der Neue ist. Beweise dich im Industriegebiet und an der Küste.' },
  { id: 3, title: 'Kapitel 3 · Auf der Überholspur', need: 5, who: 'Volta Energy (Sponsor)', text: 'Volta Energy bietet dir einen Vertrag an. Oder du bleibst unabhängig und fährst für die Szene. Deine Wahl.', choice: [['Sponsor-Vertrag (+15 % Preisgeld)', 'sponsor'], ['Unabhängig (+25 % Erfahrung)', 'underground']] },
  { id: 4, title: 'Kapitel 4 · Nachtschicht', need: 8, who: 'Captain Reyes (Polizei)', text: 'Captain Reyes hat ein Auge auf dich. Die Nachtrennen werden heißer – und die Streifen zahlreicher.' },
  { id: 5, title: 'Kapitel 5 · Der Pass', need: 10, who: 'Mika Tanabe', text: 'Am Kalmar-Pass trennt sich die Spreu vom Weizen. Wer hier gewinnt, wird Legende.' },
  { id: 6, title: 'Kapitel 6 · Legende', need: 12, who: 'Dante Rourke', text: 'Du hast meine Stadt aufgemischt. Triff mich zum Finale – auf dem Ring, mit allem, was du hast.' },
  { id: 7, title: 'Epilog · Meridian-Legende', need: 15, who: 'Hiro', text: 'Du hast es geschafft. Die Stadt gehört dir – fahr, wohin du willst.' },
];
const ACH = [
  ['first_win', 'Erster Sieg', 'Gewinne dein erstes Rennen', d => d.stats.wins >= 1], ['buy1', 'Neuer Fahrer', 'Kaufe dein erstes weiteres Fahrzeug', d => d.cars.length >= 2], ['tuned', 'Voll getunt', 'Rüste ein Fahrzeug komplett auf (alle Leistungsstufen ≥ 2)', d => d.cars.some(c => Object.values(c.cfg.perf).every(v => v >= 2))],
  ['v300', 'Schallmauer', 'Erreiche 300 km/h', d => d.stats.maxSpeed >= 300], ['v400', 'Rauschen im Ohr', 'Erreiche 400 km/h', d => d.stats.maxSpeed >= 400], ['streak3', 'Siegesserie', 'Gewinne 3 Rennen in Folge', d => d.stats.streak >= 3],
  ['escape1', 'Spurlos', 'Entkomme einer Fahndung', d => d.stats.escapes >= 1], ['escape5', 'Phantom', 'Entkomme 5 Fahndungen', d => d.stats.escapes >= 5], ['drift', 'Quertreiber', 'Erreiche 5000 Driftpunkte in einem Lauf', d => d.stats.bestDrift >= 5000],
  ['traps', 'Blitzer-Jäger', 'Löse 4 Radarfallen aus', d => Object.keys(d.traps).length >= 4], ['garage3', 'Garagenkönig', 'Schalte alle Garagen frei', d => d.garages.length >= 4], ['lvl5', 'Aufsteiger', 'Erreiche Level 5', d => d.level >= 5], ['rich', 'Millionär', 'Besitze 1.000.000 $', d => d.money >= 1e6], ['finale', 'Legende von Meridian', 'Gewinne das Finale', d => d.events.e15 && d.events.e15.wins > 0],
  ['crash', 'Blechschaden', 'Verursache einen schweren Unfall', d => d.stats.bigCrash >= 1], ['dist', 'Weltenbummler', 'Fahre 100 Kilometer', d => d.stats.km >= 100],
];
C.ACH = ACH; C.STORY = STORY; C.EV = EV; C.GARAGES = GARAGE_DEF;

C.newData = function () {
  const car = CD.byId.zephyr_s15; const cfg = CD.defaultCfg(car); return { v: 1, name: 'Fahrer', money: 25000, xp: 0, level: 1, cars: [{ id: car.id, cfg, dmg: { front: 0, rear: 0, left: 0, right: 0, top: 0 }, health: 1, fav: false }], current: 0, garages: ['g1'], events: {}, stats: { races: 0, wins: 0, losses: 0, streak: 0, escapes: 0, maxSpeed: 0, bestDrift: 0, km: 0, crashes: 0, bigCrash: 0, busted: 0 }, flags: {}, chapter: 1, traps: {}, ach: [], seenChapters: [], playtime: 0, slots: 4 };
};
C.init = function () { C.data = C.newData(); C.buildWorldMarkers(); };
C.load = function () { try { const s = localStorage.getItem('nr_save'); if (s) { const d = JSON.parse(s); if (d && d.v === 1 && d.cars && d.cars.length) { C.data = Object.assign(C.newData(), d); C.hasSave = true; } } } catch (e) { } if (!C.data.cars[C.data.current]) C.data.current = 0; };
C.save = function (silent) { try { localStorage.setItem('nr_save', JSON.stringify(C.data)); C.hasSave = true; if (!silent) G.UI.toast('Spielstand gespeichert', '#3dff9a', 1.2); } catch (e) { if (!silent) G.UI.toast('Speichern nicht möglich', '#ff4d4d', 1.5); } };
C.reset = function () { C.data = C.newData(); C.save(true); };
C.currentCar = function () { return C.data.cars[C.data.current]; };
C.garageSpawn = function (i) { const g = GARAGE_DEF[i]; const sn = W.snapToRoad(g.x, g.z, 60); const p = W.posAtS(sn.road, sn.s, {}); return { x: p.x, z: p.z, yaw: Math.atan2(p.tx, p.tz) + (p.tz > 0 ? Math.PI : 0) * 0 }; };
C.xpFor = lv => Math.round(300 * Math.pow(lv, 1.5));
C.addXp = function (n) { const d = C.data; d.xp += n; let up = false; while (d.xp >= C.xpFor(d.level) && d.level < 30) { d.xp -= C.xpFor(d.level); d.level++; up = true; G.UI.bigToast('Level ' + d.level, 'Neue Inhalte freigeschaltet', '#ffc83d'); G.Audio.ui('win'); C.unlockGarages(); } if (up) C.save(true); };
C.unlockGarages = function () { const d = C.data; for (const g of GARAGE_DEF) if (d.level >= g.lvl && !d.garages.includes(g.id)) { d.garages.push(g.id); G.UI.toast('Neue Garage: ' + g.name, '#05d9e8', 2.5); } };
C.addMoney = function (n) { C.data.money += n; };
C.carReq = spec => { const p = spec.price; return p < 60000 ? 1 : p < 120000 ? 3 : p < 260000 ? 5 : p < 450000 ? 8 : p < 1500000 ? 11 : 14; };
C.slots = () => { const d = C.data; let s = 4; for (const g of GARAGE_DEF) if (d.garages.includes(g.id)) s = Math.max(s, g.slots); return s + (d.extraSlots || 0); };
C.buyCar = function (spec) { const d = C.data; if (d.cars.some(c => c.id === spec.id)) return 'Du besitzt dieses Fahrzeug bereits.'; if (d.level < C.carReq(spec)) return 'Erreiche Level ' + C.carReq(spec) + '.'; if (d.money < spec.price) return 'Nicht genug Geld.'; if (d.cars.length >= C.slots()) return 'Garage voll – verkaufe ein Fahrzeug oder erweitere die Plätze.'; d.money -= spec.price; d.cars.push({ id: spec.id, cfg: CD.defaultCfg(spec), dmg: { front: 0, rear: 0, left: 0, right: 0, top: 0 }, health: 1 }); C.save(true); return null; };
C.sellCar = function (idx) { const d = C.data; if (d.cars.length <= 1) return 'Du brauchst mindestens ein Fahrzeug.'; const c = d.cars[idx]; const spec = CD.byId[c.id]; const val = Math.round(CD.cfgValue(spec, c.cfg) * 0.6); d.money += val; d.cars.splice(idx, 1); if (d.current >= d.cars.length) d.current = d.cars.length - 1; else if (d.current > idx) d.current--; C.save(true); return val; };
C.repairCost = function (car) { const spec = CD.byId[car.id]; const dm = car.dmg || {}; const t = (dm.front || 0) + (dm.rear || 0) + (dm.left || 0) + (dm.right || 0) + (dm.top || 0); return Math.round(t * spec.price * 0.012 / 10) * 10; };

/* ------------------------------------------------------------------ Marker in der Welt */
C.buildWorldMarkers = function () {
  C.garages = GARAGE_DEF.map(g => { const sn = W.snapToRoad(g.x, g.z, 80); const p = W.posAtS(sn.road, sn.s, {}); return Object.assign({}, g, { x: p.x, z: p.z, y: p.h, kind: 'garage' }); });
  C.events = EV.map(e => {
    const ev = Object.assign({}, e, { kind: 'event' }); let sx, sz; if (e.ring) { const r = W.Roads.list.find(r => r.name === 'Ring A0'); const p = W.posAtS(r, r.len * 0.77, {}); sx = p.x; sz = p.z; } else if (e.via) { sx = e.via[0][0]; sz = e.via[0][1]; } else if (e.zone === 'pass') { const r = W.Roads.list.find(r => r.name === 'Kalmar-Passstraße'); const p = W.posAtS(r, r.len * 0.55, {}); sx = p.x; sz = p.z; } else { sx = e.from[0]; sz = e.from[1]; }
    const sn = W.snapToRoad(sx, sz, 120); const p = W.posAtS(sn.road, sn.s, {}); ev.x = p.x; ev.z = p.z; ev.y = p.h; ev.tx = p.tx; ev.tz = p.tz; ev.roadId = sn.road.id; ev.s = sn.s; return ev; });
  C.speedTraps = TRAPS.map(t => { const sn = W.snapToRoad(t.x, t.z, 150); const p = W.posAtS(sn.road, sn.s, {}); return Object.assign({}, t, { x: p.x, z: p.z, y: p.h, kind: 'trap' }); });
};
C.worldPOIs = function () { const d = C.data; const L = []; for (const g of C.garages) L.push(g); for (const e of C.events) L.push(e); for (const t of C.speedTraps) L.push(t); return L; };
/* Beam-Marker nur für Nahes */
C.updateMarkers = function (px, pz) {
  const G_ = G.Game; if (!G_.markerPool) return; let k = 0; const d = C.data; const night = G.FX.night; const list = C.worldPOIs(); for (const p of list) { const dist = Math.hypot(p.x - px, p.z - pz); if (dist > 700) continue; if (k >= G_.markerPool.length) { const col = 0xffffff; const b = G_.beamGeo(col); b.visible = false; G_.markers.add(b); G_.markerPool.push(b); } const b = G_.markerPool[k++]; b.visible = true; b.position.set(p.x, p.y + 45, p.z); let color = 0x18e6ff; if (p.kind === 'garage') color = 0x3dff9a; else if (p.kind === 'trap') color = 0xffc83d; else if (p.illegal) color = 0xff2a6d; else if (d.level < p.lvl) color = 0x555a66; else if (d.events[p.id] && d.events[p.id].done) color = 0x3d7fff; b.material.color.setHex(color); b.material.opacity = p.kind === 'trap' ? 0.18 : 0.32; b.scale.set(p.kind === 'trap' ? 0.4 : 1, 1, p.kind === 'trap' ? 0.4 : 1); }
  for (; k < G_.markerPool.length; k++) G_.markerPool[k].visible = false;
};

/* ------------------------------------------------------------------ Nähe / Interaktion */
C.interact = function () { if (C.nearGarage) { G.UI.openGarage(C.nearGarage); } else if (C.nearEvent && !C.active) { G.UI.eventBriefing(C.nearEvent); } };
C.canStart = function (e) { const d = C.data; if (d.level < e.lvl) return 'Benötigt Level ' + e.lvl; const car = C.currentCar(); const st = CD.stats(CD.byId[car.id], car.cfg); if (CLS[st.cls] < CLS[e.cls] - 0) { /* mindestens empfohlene Klasse? weiche Regel */ } if (e.night && !(G.FX.night > 0.5)) return 'Nur nachts (20:00–05:00)'; if (G.Game.player.health < 0.2) return 'Fahrzeug ist zu stark beschädigt'; return null; };
C.toggleNav = function () { if (C.wp) { C.wp = null; C.navRoute = null; G.Game.nav.visible = false; G.UI.toast('Navigation beendet', '#fff', 1); } else G.UI.toast('Ziel auf der Karte (M) setzen', '#fff', 1.5); };
C.setWaypoint = function (x, z) { C.wp = { x, z }; C.routeT = 0; G.UI.toast('Navigation gestartet', '#05d9e8', 1.4); G.Audio.ui('ok'); };
C.updateNav = function (dt, pl) {
  C.routeT = (C.routeT || 0) - dt; if (!C.wp || C.routeT > 0) return; C.routeT = 3; const pcs = W.findRoute(pl.pos.x, pl.pos.z, C.wp.x, C.wp.z); if (!pcs) { C.navRoute = null; return; } const poly = W.routePolyline(pcs, 10); C.navRoute = poly; C.navLen = poly.length ? poly[poly.length - 1].s : 0; const nav = G.Game.nav; // Band
  const pos = [], idx = []; const n = Math.min(poly.length, 90); let vi = 0; for (let i = 0; i < n; i++) { const p = poly[i]; const q = poly[Math.min(i + 1, poly.length - 1)]; let dx = q.x - p.x, dz = q.z - p.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const w = 1.0; pos.push(p.x - dz * w, p.h + 0.25, p.z + dx * w, p.x + dz * w, p.h + 0.25, p.z - dx * w); if (i > 0) { const b = vi * 2 - 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); } vi++; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); nav.geometry.dispose(); nav.geometry = g; nav.visible = true;
  if (Math.hypot(pl.pos.x - C.wp.x, pl.pos.z - C.wp.z) < 40) { C.wp = null; nav.visible = false; G.UI.toast('Ziel erreicht', '#3dff9a', 1.5); }
};

/* ------------------------------------------------------------------ Strecken */
function chainRoute(points, closed) { const pcs = []; for (let i = 0; i < points.length - 1 + (closed ? 1 : 0); i++) { const a = points[i], b = points[(i + 1) % points.length]; const r = W.findRoute(a[0], a[1], b[0], b[1]); if (r) pcs.push(...r); } return pcs; }
C.buildRoute = function (e) {
  let pcs; if (e.ring) { const r = W.Roads.list.find(r => r.name === 'Ring A0'); const s0 = r.len * 0.77; pcs = [{ road: r, s0, s1: s0 + r.len * (e.laps || 1) }]; const pts = []; for (let lap = 0; lap < (e.laps || 1); lap++) { const poly = W.routePolyline([{ road: r, s0: s0 + lap * r.len, s1: s0 + (lap + 1) * r.len }], 8); if (lap > 0) poly.shift(); pts.push(...poly); } return finalizeRoute(pts, e); }
  if (e.via) { const pts = []; for (let lap = 0; lap < (e.laps || 1); lap++) { const pcs2 = chainRoute(e.via, true); const poly = W.routePolyline(pcs2, 8); pts.push(...poly); } return finalizeRoute(pts, e); }
  let to = e.to; if (to === 'summit') { const r = W.Roads.list.find(r => r.name === 'Kalmar-Passstraße'); const p = W.posAtS(r, r.len - 6, {}); to = [p.x, p.z]; }
  pcs = W.findRoute(e.from[0], e.from[1], to[0], to[1]); if (!pcs) return null; return finalizeRoute(W.routePolyline(pcs, 8), e);
};
function finalizeRoute(pts, e) { if (pts.length < 10) return null; let acc = 0; for (let i = 0; i < pts.length; i++) { if (i > 0) acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); pts[i].s = acc; } const cps = []; const step = e.type === 'drag' ? 100000 : Math.max(26, Math.round(pts.length / Math.max(6, Math.min(24, Math.round(acc / 320))))); for (let i = step; i < pts.length - 1; i += step) cps.push(i); cps.push(pts.length - 1); return { pts, cps, length: acc }; }

/* ------------------------------------------------------------------ Event-Ablauf */
C.startEvent = function (e) {
  const err = C.canStart(e); if (err) { G.UI.toast(err, '#ff4d4d', 2); G.Audio.ui('err'); return false; } const G_ = G.Game, pl = G_.player; const route = e.type === 'drift' ? null : e.type === 'chase' ? null : C.buildRoute(e); if (!route && e.type !== 'drift' && e.type !== 'chase') { G.UI.toast('Strecke konnte nicht erzeugt werden', '#ff4d4d', 2); return false; }
  const a = C.active = { e, route, t: 0, state: 'countdown', cd: 3.99, cp: 0, lap: 0, opp: [], score: 0, mult: 1, chain: 0, chainT: 0, best: 0, offT: 0, progress: 0, started: performance.now(), dist: 0, pos: 1 };
  AI.reset(); G_.eventFreeze = true; AI.heatLocked = false; if (e.type === 'chase') { a.state = 'run'; a.cd = 0; G_.eventFreeze = false; const sn = W.snapToRoad(e.x, e.z, 80); const p = W.posAtS(sn.road, sn.s, {}); G_.respawnAt(p.x, p.z, Math.atan2(p.tx, p.tz)); AI.heat = 0; AI.addHeat(140, 'Event'); AI.heat = Math.max(AI.heat, e.heat || 3); AI.heatPts = Math.max(AI.heatPts, 140); if (AI.onHeat) AI.onHeat(AI.heat, true); a.limit = e.limit; G.UI.toast('Entkomme der Polizei!', '#ff4d4d', 2.5); G.UI.radio('Zentrale', 'Verdächtiger Wagen am Hafen – alle Einheiten verfolgen!'); return true; }
  if (route) { const p0 = route.pts[0], p1 = route.pts[Math.min(route.pts.length - 1, 4)]; const yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z); const rx = Math.cos(yaw), rz = -Math.sin(yaw); G_.respawnAt(p0.x + rx * 0, p0.z + rz * 0, yaw); pl.vel.set(0, 0, 0); a.yaw = yaw;
    // Gegner
    const nOpp = e.opp || 0; const ps = PERSONAS.slice().sort(() => Math.random() - 0.5); if (e.finale) ps.unshift(PERSONAS[1]); const car = C.currentCar(); const myPI = CD.stats(CD.byId[car.id], car.cfg).pi; const target = clamp(myPI * (0.82 + 0.06 * e.diff + (G_.settings.difficulty - 1) * 0.08), 160, 760);
    for (let i = 0; i < nOpp; i++) { const per = ps[i % ps.length]; let spec = CD.byId[per.car]; const cands = CD.PLAYER.slice().sort((x, y) => Math.abs(CD.stats(x, CD.defaultCfg(x)).pi - target) - Math.abs(CD.stats(y, CD.defaultCfg(y)).pi - target)); if (i > 0 || Math.random() < 0.4) spec = cands[Math.floor(Math.random() * 3)]; if (e.finale && i === 0) spec = CD.byId.corsa_f8; const cfg = CD.defaultCfg(spec); cfg.paint.color = per.color; cfg.paint.finish = 'gloss'; cfg.livery = i % 3; cfg.perf.engine = cfg.perf.tires = Math.min(3, Math.floor(e.diff / 2)); const lat = (i % 2 ? 1 : -1) * (3.2 + Math.floor(i / 2) * 3.2); const row = Math.floor(i / 2) + 1; const startI = Math.min(route.pts.length - 2, Math.floor(row * 0.5)); const c = AI.spawnRacer(spec, cfg, route, startI, lat, { skill: per.skill * (0.97 + 0.03 * G_.settings.difficulty) * (1 + (e.diff - 2) * 0.012), aggr: per.aggr, drift: per.drift }); c.pname = per.name; c.rubber = 1; c.place(p0.x - Math.sin(yaw) * row * 7 * 0 + Math.cos(yaw) * lat - Math.sin(yaw) * (-row * 6), p0.z - Math.cos(yaw) * (-row * 6) - Math.sin(yaw) * lat, yaw, 0); c.thr = 0; c.state = 'hold'; a.opp.push(c); } }
  else if (e.type === 'drift') { const r = W.Roads.list.find(r => r.name === 'Kalmar-Passstraße'); const p = W.posAtS(r, r.len * 0.5, {}); G_.respawnAt(p.x, p.z, Math.atan2(p.tx, p.tz)); a.center = { x: p.x, z: p.z }; a.limit = e.limit; }
  if (e.illegal) { AI.heatLocked = false; }
  C.hideBeams(); G.UI.eventHUD(true); G.UI.radio(e.finale ? 'Dante' : 'Lux', e.finale ? 'Das ist unser Rennen. Mach dich bereit, Legende.' : 'Alle auf die Plätze – gleich geht es los!'); G.Audio.ui('count'); return true;
};
C.hideBeams = function () { for (const b of G.Game.cpBeams) b.visible = false; };
C.endEvent = function (result) {
  const a = C.active; if (!a) return; const e = a.e, G_ = G.Game, d = C.data; C.active = null; G_.eventFreeze = false; G.UI.eventHUD(false); C.hideBeams(); const pl = G_.player;
  for (const c of a.opp) { c.dispose(); AI.group_remove(c); const i = AI.cars.indexOf(c); if (i >= 0) AI.cars.splice(i, 1); }
  if (result.status === 'abort') { G.UI.toast('Event abgebrochen', '#ffc83d', 1.5); return; }
  const win = result.status === 'win'; const rec = d.events[e.id] || (d.events[e.id] = { done: false, wins: 0, best: 0, tries: 0 }); rec.tries++; d.stats.races++; let cash = 0, xp = 0; const diff = [0.7, 1, 1.35][G_.settings.difficulty] || 1;
  if (win) { rec.done = true; rec.wins++; const first = rec.wins === 1; const posMul = result.pos === 1 ? 1 : result.pos === 2 ? 0.55 : 0.3; cash = Math.round(e.cash * (first ? 1 : 0.45) * posMul * diff); xp = Math.round(e.xp * (first ? 1 : 0.5) * posMul); if (e.type === 'time' || e.type === 'drift') { cash = Math.round(e.cash * (first ? 1 : 0.45) * diff); xp = Math.round(e.xp * (first ? 1 : 0.5)); } if (d.flags.path === 'sponsor') cash = Math.round(cash * 1.15); if (d.flags.path === 'underground') xp = Math.round(xp * 1.25); if (result.pos === 1 || e.type === 'time' || e.type === 'drift' || e.type === 'chase') { d.stats.wins++; d.stats.streak++; } else { d.stats.streak = 0; } if (result.time && (!rec.best || result.time < rec.best)) { rec.best = result.time; result.record = true; } }
  else { d.stats.losses++; d.stats.streak = 0; cash = Math.round(e.cash * 0.05); xp = Math.round(e.xp * 0.15); }
  C.addMoney(cash); C.addXp(xp); result.cash = cash; result.xp = xp; result.win = win; C.checkStory(); C.checkAch(); C.save(true); G.Audio.ui(win ? 'win' : 'lose'); G.UI.eventResult(e, result);
};
C.update = function (dt) {
  const G_ = G.Game, pl = G_.player, d = C.data; if (!pl) return; d.playtime += dt; d.stats.maxSpeed = Math.max(d.stats.maxSpeed, G_.speedKmh); d.stats.km += pl.speed * dt / 1000; C.updateNav(dt, pl); C.updateMarkers(pl.pos.x, pl.pos.z);
  // Nähe
  C.nearGarage = null; C.nearEvent = null; if (!C.active) { for (const g of C.garages) { if (d.garages.includes(g.id) && Math.hypot(g.x - pl.pos.x, g.z - pl.pos.z) < 22 && pl.speed < 25) C.nearGarage = g; } for (const e of C.events) { if (Math.hypot(e.x - pl.pos.x, e.z - pl.pos.z) < 24 && pl.speed < 30) C.nearEvent = e; } }
  G.UI.hint(C.nearGarage ? `<kbd>F</kbd> Garage betreten: ${C.nearGarage.name}` : C.nearEvent ? `<kbd>F</kbd> ${C.nearEvent.name} – ${C.nearEvent.type.toUpperCase()} · Klasse ${C.nearEvent.cls}${d.level < C.nearEvent.lvl ? ' · Level ' + C.nearEvent.lvl : ''}` : null);
  // Radarfallen
  for (const t of C.speedTraps) { if (Math.hypot(t.x - pl.pos.x, t.z - pl.pos.z) < 14 && pl.speed > 20 && (G_.time - (t.last || -99)) > 8) { t.last = G_.time; const kmh = G_.speedKmh; G.UI.bigToast(Math.round(kmh) + ' km/h', 'Radarfalle · Ziel ' + t.target, kmh >= t.target ? '#3dff9a' : '#ffc83d'); G.Audio.ui('check'); G.Game.flashT = 0.12; if (kmh >= t.target && !d.traps[t.id]) { d.traps[t.id] = Math.round(kmh); C.addMoney(2500); C.addXp(150); G.UI.toast('+2.500 $ Radarfalle geknackt', '#3dff9a', 2); C.checkAch(); } if (!d.traps[t.id] || kmh > d.traps[t.id]) { if (d.traps[t.id]) d.traps[t.id] = Math.round(kmh); } if (kmh > 160) AI.addHeat(kmh > 220 ? 14 : 6, 'Radar'); } }
  // Fahndung durch Raserei in Polizeinähe
  let copNear = false; for (const c of AI.cars) if ((c.kind === 'traffic' && c.spec.police) ) { }
  C.speedHeatT = (C.speedHeatT || 0) - dt; if (C.speedHeatT <= 0 && AI.heat === 0 && G_.speedKmh > 150) { C.speedHeatT = 1; for (const c of AI.cars) { if (c.kind === 'cop' && c.state === 'patrol' && Math.hypot(c.x - pl.pos.x, c.z - pl.pos.z) < 90) { AI.addHeat(40, 'Raserei'); } } }
  // Streife als Verkehr (Patrouille)
  C.patrolT = (C.patrolT || 5) - dt; if (C.patrolT <= 0 && !C.active) { C.patrolT = 30; if (AI.heat === 0 && G_.settings.police > 0) { const n = AI.cars.filter(c => c.kind === 'cop' && c.state === 'patrol').length; if (n < (G.FX.night > 0.5 ? 3 : 2)) C.spawnPatrol(pl); } }
  if (C.active) C.updateEvent(dt);
  // Streckenlänge / Entdeckung
  C.discT = (C.discT || 0) - dt; if (C.discT <= 0) { C.discT = 3; C.checkAch(); if (d.playtime > 8 && C.nextTutorial) C.nextTutorial(); }
};
C.spawnPatrol = function (pl) { for (let t = 0; t < 8; t++) { const a = Math.random() * U.TAU, dd = 260 + Math.random() * 260; const sn = W.snapToRoad(pl.pos.x + Math.cos(a) * dd, pl.pos.z + Math.sin(a) * dd, 50); if (!sn || sn.road.type === 'mt') continue; const p = W.posAtS(sn.road, sn.s, {}); const c = AI.spawnCop('patrol', p.x, p.z, Math.atan2(p.tx, p.tz), 8, 'patrol'); c.kind = 'traffic'; c.spec2 = true; c.road = sn.road; c.s = sn.s; c.dir = 1; c.lane = 0; c.laneOff = sn.road.T.median / 2 + sn.road.T.lane * 0.5; c.limit = sn.road.T.spd * 0.8; c.targetSpeed = c.limit; c.turnCooldown = 0; c.state = 'drive'; c.isPatrol = true; c.model.lightRed && (c.model.lightRed.visible = true); return; } };
C.updateEvent = function (dt) {
  const a = C.active, e = a.e, G_ = G.Game, pl = G_.player; const route = a.route;
  if (a.state === 'countdown') { const prev = Math.ceil(a.cd); a.cd -= dt; const n = Math.ceil(a.cd); pl.input.throttle = 0; if (n !== prev && n >= 1) { G.UI.count(String(n)); G.Audio.ui('count'); } if (a.cd <= 0) { a.state = 'run'; G_.eventFreeze = false; G.UI.count('LOS!'); G.Audio.ui('go'); for (const c of a.opp) c.state = 'race'; if (e.illegal && !e.type !== 'chase') { AI.addHeat(30, 'Illegales Rennen'); } setTimeout(() => G.UI.count(null), 900); } else { pl.vel.multiplyScalar(0.6); if (a.cd > 0.2) { for (const c of a.opp) { c.thr = 0; c.vx = c.vz = 0; } } } G.UI.eventUpdate(a); return; }
  a.t += dt; if (a.state !== 'run') return;
  if (e.type === 'chase') { G.UI.eventUpdate(a); if (a.limit && a.t > a.limit) C.endEvent({ status: 'lose', reason: 'Zeit abgelaufen' }); return; }
  if (e.type === 'drift') { // Driftpunkte
    const v = pl; const f = v.forward(new V3()); const vd = new V3(v.vel.x, 0, v.vel.z); const sp = vd.length(); let ang = 0; if (sp > 8) { ang = Math.acos(clamp(vd.normalize().dot(new V3(f.x, 0, f.z).normalize()), -1, 1)); } const drifting = sp > 9 && ang > 0.2 && ang < 1.45 && v.onGround >= 2 && Math.max(...v.wheels.map(w => w.slide || 0)) > 1.0; if (drifting) { a.chain += dt; a.chainT = 1.2; a.mult = 1 + Math.min(9, Math.floor(a.chain / 1.2)); a.cur = (a.cur || 0) + sp * ang * 14 * a.mult * dt; if (v.speed > 8) v.nitro = Math.min(v.nitroMax, v.nitro + dt * 0.35); } else if (a.chainT > 0) { a.chainT -= dt; if (a.chainT <= 0) { a.score += Math.round(a.cur || 0); a.cur = 0; a.chain = 0; a.mult = 1; } }
    if (Math.hypot(pl.pos.x - a.center.x, pl.pos.z - a.center.z) > 900) { C.endEvent({ status: 'abort' }); return; } a.best = Math.max(a.best, a.score + (a.cur || 0)); C.data.stats.bestDrift = Math.max(C.data.stats.bestDrift, a.best); G.UI.eventUpdate(a);
    if (a.score >= e.target) C.endEvent({ status: 'win', pos: 1, time: a.t, score: a.score }); else if (a.t > a.limit) C.endEvent({ status: 'lose', reason: 'Zeit abgelaufen', score: a.score }); return; }
  // Rennen / Zeit
  const R = route.pts; let bi = a.progress, bd = 1e12; for (let i = Math.max(0, a.progress - 3); i < Math.min(R.length, a.progress + 60); i++) { const dd = (R[i].x - pl.pos.x) ** 2 + (R[i].z - pl.pos.z) ** 2; if (dd < bd) { bd = dd; bi = i; } } if (bi >= a.progress) a.progress = bi; a.offRoute = Math.sqrt(bd);
  const nextCp = route.cps[a.cp]; if (nextCp !== undefined && a.progress >= nextCp - 1 && Math.sqrt((R[nextCp].x - pl.pos.x) ** 2 + (R[nextCp].z - pl.pos.z) ** 2) < 60) { a.cp++; G.Audio.ui('check'); if (a.cp < route.cps.length) G.UI.toast('Checkpoint ' + a.cp + '/' + route.cps.length, '#05d9e8', 0.8); } else if (nextCp !== undefined && a.progress >= nextCp + 12) { a.cp++; }
  // Positionen
  let ahead = 0; for (const c of a.opp) { if (c.state === 'hold') continue; const prog = c.ri; if (prog > a.progress + 0.5) ahead++; c.rubber = clamp(1 + (a.progress - prog) * 0.0016 * (e.diff <= 2 ? 1 : 0.5), 0.92, 1.1) * (e.type === 'drag' ? 1 : 1); if (c.finished && !c.done) { c.done = true; c.fin = a.t; } } a.pos = 1 + ahead; a.finishedOpp = a.opp.filter(c => c.finished).length;
  // Ziel
  const last = route.pts.length - 1; const atEnd = a.progress >= last - 3 && a.cp >= route.cps.length - 0; if (a.progress >= last - 3) { C.endEvent({ status: (e.type === 'time') ? (a.t <= e.limit ? 'win' : 'lose') : (a.pos <= Math.max(1, Math.ceil((e.opp || 1) / 3)) ? 'win' : 'lose'), pos: e.type === 'time' ? 1 : Math.min(a.pos + a.opp.filter(c => c.finished).length * 0, a.pos), time: a.t, reason: e.type === 'time' && a.t > e.limit ? 'Zeitlimit überschritten' : '' }); return; }
  if (e.type === 'time' && a.t > e.limit) { C.endEvent({ status: 'lose', reason: 'Zeit abgelaufen' }); return; }
  if (a.offRoute > 220) { a.offT += dt; G.UI.toast('Zurück auf die Strecke!', '#ff4d4d', 0.5); if (a.offT > 12) C.endEvent({ status: 'abort' }); } else a.offT = Math.max(0, a.offT - dt);
  // Checkpoint-Strahlen
  const cb = G_.cpBeams; for (let i = 0; i < 2; i++) { const idx = route.cps[a.cp + i]; const b = cb[i]; if (idx === undefined) { b.visible = false; continue; } const p = R[idx]; b.visible = true; b.position.set(p.x, p.h + 45, p.z); b.material.color.setHex(i === 0 ? 0x18e6ff : 0x3a6a88); b.scale.set(i === 0 ? 1.3 : 0.7, 1, i === 0 ? 1.3 : 0.7); }
  G.UI.eventUpdate(a);
};
/* Fahndungsereignisse */
AI.onHeat = function (lvl, up) { if (up) { G.UI.bigToast('Fahndungsstufe ' + lvl, AI.lastHeatReason || 'Die Polizei verfolgt dich', '#ff4d4d'); G.Audio.ui('err'); G.UI.radio('Zentrale', ['', 'Einheit 12, verdächtiges Fahrzeug – Verfolgung aufnehmen.', 'Verstärkung angefordert, Fahrzeug flüchtet stadtauswärts.', 'Alle Einheiten: Straßensperren vorbereiten!', 'Hubschrauber ist unterwegs – Tatverdächtiger hochgefährlich.', 'Letzte Warnung: Einsatz aller Mittel genehmigt!'][lvl]); } };
AI.onEscape = function (lvl) { const bounty = 3000 * lvl * lvl; C.addMoney(bounty); C.addXp(300 * lvl); C.data.stats.escapes++; G.UI.bigToast('Entkommen!', '+' + bounty.toLocaleString('de-DE') + ' $ · +' + 300 * lvl + ' XP', '#3dff9a'); G.Audio.ui('win'); G.UI.radio('Zentrale', 'Verdächtiger verloren. Einsatz beenden.'); if (C.active && C.active.e.type === 'chase') C.endEvent({ status: 'win', pos: 1, time: C.active.t }); C.checkAch(); C.save(true); };
AI.onBusted = function () { const G_ = G.Game, d = C.data; const fine = Math.min(d.money, Math.round(1500 * (AI.heat + 1) + d.money * 0.01 * AI.heat)); d.money -= fine; d.stats.busted++; AI.clearHeat(); AI.reset(); G.UI.bigToast('Gefasst!', 'Strafe: ' + fine.toLocaleString('de-DE') + ' $', '#ff4d4d'); G.Audio.ui('lose'); if (C.active) { C.endEvent({ status: 'abort' }); } const sp = C.garageSpawn(0); const g = d.garages.length ? C.garages.find(x => x.id === d.garages[0]) : null; G_.respawnAt(sp.x, sp.z, sp.yaw); C.save(true); };
AI.onSpike = function () { G.UI.toast('Reifen durch Nagelband zerstört!', '#ff4d4d', 1.8); G.Audio.impact(0.4, true); };
AI.onPlayerHit = function (P, n, speed, energy, other) { G.Game.onPlayerHit(P, n, speed, energy, other); };
C.onCrash = function (speed, energy, other, soft) { const d = C.data; d.stats.crashes++; if (energy > 250000) d.stats.bigCrash++; if (!other && !soft && speed > 9) AI.addHeat(Math.min(12, speed * 0.7), 'Sachbeschädigung'); if (soft && speed > 8) AI.addHeat(3, 'Sachbeschädigung'); };
C.onWater = function () { if (G.Game.waterT && G.Game.time - G.Game.waterT < 3) return; G.Game.waterT = G.Game.time; G.UI.toast('Im Wasser gelandet – Fahrzeug wird geborgen', '#ff4d4d', 2); G.Game.resetToRoad(); G.Game.player.vel.set(0, 0, 0); };

/* ------------------------------------------------------------------ Story & Erfolge */
C.eventsDone = function () { return Object.values(C.data.events).filter(r => r.done).length; };
C.checkStory = function () { const d = C.data; const n = C.eventsDone(); for (const ch of STORY) { if (n >= ch.need && !d.seenChapters.includes(ch.id) && ch.id > 1) { d.seenChapters.push(ch.id); d.chapter = ch.id; G.UI.storyDialog(ch); break; } } };
C.checkAch = function () { const d = C.data; for (const [id, name, desc, fn] of ACH) { if (!d.ach.includes(id) && fn(d)) { d.ach.push(id); G.UI.bigToast('Erfolg: ' + name, desc, '#ffc83d'); G.Audio.ui('buy'); C.addMoney(1000); } } };
C.tutorial = [['Willkommen in Meridian City! Mit <kbd>W</kbd>/<kbd>S</kbd> gibst du Gas und bremst, mit <kbd>A</kbd>/<kbd>D</kbd> lenkst du.', 2], ['Halte <kbd>Shift</kbd> für Lachgas und <kbd>Leertaste</kbd> für die Handbremse. <kbd>C</kbd> wechselt die Kamera.', 14], ['Öffne die Karte mit <kbd>M</kbd> und setze ein Ziel. Die blauen Strahlen sind Rennen, grüne sind Garagen.', 26], ['Fahre in einen Strahl und drücke <kbd>F</kbd>, um ein Event zu starten. Viel Erfolg!', 40]];
C.nextTutorial = function () { const d = C.data; if (d.flags.tutDone || !C.tutIdx && C.tutIdx !== 0) { if (C.tutIdx === undefined) C.tutIdx = 0; } if (d.flags.tutDone) return; const t = C.tutorial[C.tutIdx || 0]; if (!t) { d.flags.tutDone = true; return; } if (d.playtime >= t[1]) { G.UI.radio('Hiro', t[0], 7000); C.tutIdx = (C.tutIdx || 0) + 1; } };

G.Career = C;
})(window.G = window.G || {});
