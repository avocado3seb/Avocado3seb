// ============================================================================
//  pl_game.js – Spiellogik für den Phantasialand-Modus: Wallet, Tickets, Käufe, Hotels,
//  Statistik, Erfolge, Speicherstände, Fotos, Navigation, Interaktion
// ============================================================================
import * as THREE from 'three';
import { ACHIEVEMENTS, TICKETS, POIS } from './pl_data.js';
import { ZONES } from './phantasia.js';

let NS = ''; // Namensraum je Konto → mehrere Spieler am selben Browser mischen ihre Spielstände nicht
const KEY = 'ecs_pl_';
const lsGet = (k, d) => { try { const v = localStorage.getItem(KEY + NS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(KEY + NS + k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const COASTERS = ['Taron', 'F.L.Y.', 'Black Mamba', 'Colorado Adventure', "Winja's Fear", "Winja's Force", 'Raik', 'Crazy Bats'];
const ZONE_KEYS = ['klugheim', 'africa', 'rookburgh', 'mexico', 'fantasy', 'china', 'mystery', 'berlin'];

const fresh = () => ({
  v: 1, wallet: 300, ticket: null, mode: 'free',
  stats: { rides: 0, rideBy: {}, km: 0, time: 0, zones: {}, rests: {}, hotels: {}, purchases: 0, bookings: 0, designs: 0, flags: {}, spent: 0, entered: 0 },
  bookings: [], inventory: {}, pos: null, hour: 15.5, weather: 'clear', winter: false, savedAt: 0, name: '',
});

export class PLGame {
  constructor(app) {
    this.app = app; this.S = fresh(); this.lapSeen = new Map(); this.achT = 0; this.autoT = 0; this.navT = 0; this.nav = null; this.hint = null; this.photoReq = null; this.room = null;
    this.unlocked = new Set(lsGet('ach', []));
    this.photos = lsGet('photos', []); this.designs = lsGet('designs', []); this.rides = lsGet('rides', []);
    const auto = lsGet('auto', null); this.hasAuto = !!auto;
  }

  switchUser(name) { // beim Anmelden: lokale Daten dieses Kontos laden
    NS = name ? name.toLowerCase().replace(/[^a-z0-9äöüß_.-]/g, '_') + '_' : '';
    this.unlocked = new Set(lsGet('ach', [])); this.photos = lsGet('photos', []); this.designs = lsGet('designs', []); this.rides = lsGet('rides', []);
    const auto = lsGet('auto', null); this.hasAuto = !!auto; this.S = fresh(); if (auto) { this.S = Object.assign(fresh(), auto); this.S.stats = Object.assign(fresh().stats, auto.stats); }
  }
  // ------------------------------------------------------------------ Speichern / Laden
  slotInfo(i) { const s = lsGet('slot' + i, null); return s ? { savedAt: s.savedAt, name: s.name, wallet: s.wallet, rides: s.stats.rides, km: s.stats.km } : null; }
  autoInfo() { const s = lsGet('auto', null); return s ? { savedAt: s.savedAt, rides: s.stats.rides } : null; }
  snapshot() {
    const a = this.app, S = this.S; S.hour = a.env.hour; S.weather = a.env.weatherName; S.winter = !!(a.park && a.park.winter); S.savedAt = Date.now();
    if (a.park && a.park.def.name === 'Phantasialand' && a.state === 'park') S.pos = [a.pp().x, a.pp().z, a.parkMode === 'walk' ? a.walk.yaw : a.free.yaw, a.parkMode]; else S.pos = null;
    return JSON.parse(JSON.stringify(S));
  }
  save(slot, name) { const s = this.snapshot(); if (name) s.name = name; return lsSet(slot === 'auto' ? 'auto' : 'slot' + slot, s); }
  autosave() { this.save('auto'); this.hasAuto = true; this.app.account && this.app.account.cloudSave(this.cloudData()); }
  cloudData() { return { S: this.snapshot(), ach: [...this.unlocked], designs: this.designs }; }
  applyCloud(d) { // Cloud-Stand übernehmen, wenn er neuer ist als der lokale
    if (!d || !d.S) return; const local = lsGet('auto', null);
    if (local && (local.savedAt || 0) > (d.S.savedAt || 0) && local.name === d.S.name) return;
    this.S = Object.assign(fresh(), d.S); this.S.stats = Object.assign(fresh().stats, d.S.stats);
    this.unlocked = new Set([...(d.ach || []), ...this.unlocked]); lsSet('ach', [...this.unlocked]); if (Array.isArray(d.designs) && d.designs.length >= this.designs.length) { this.designs = d.designs; lsSet('designs', this.designs); }
    lsSet('auto', this.S); this.hasAuto = true;
  }
  load(slot) {
    const s = lsGet(slot === 'auto' ? 'auto' : 'slot' + slot, null); if (!s) return false;
    this.S = Object.assign(fresh(), s); this.S.stats = Object.assign(fresh().stats, s.stats);
    const a = this.app; a.env.setTime(this.S.hour); a.env.setWeather(this.S.weather); a.ui.syncEnv?.();
    this.applyWorld(); return true;
  }
  del(slot) { try { localStorage.removeItem(KEY + 'slot' + slot); } catch (e) { /* */ } }
  newGameState() { this.S = fresh(); this.unlocked = new Set(); lsSet('ach', []); this.photos = []; lsSet('photos', []); lsSet('auto', this.S); this.hasAuto = true; }
  async applyWorld() {
    const a = this.app, S = this.S;
    await a.loadPark('Phantasialand'); a.ui.loading(false);
    if (a.park.setWinter) a.park.setWinter(!!S.winter);
    a.enterPark();
    if (S.pos) { a.camera.position.set(S.pos[0], 60, S.pos[1]); a.free.yaw = S.pos[2]; a.free.pitch = 0; a.setParkMode(S.pos[3] === 'walk' ? 'walk' : 'fly'); }
    else this.spawnGate(S.mode === 'play');
    a.ui.toast('Spielstand geladen');
  }
  spawnGate(parking) {
    const a = this.app, w = a.park; const z = parking ? 488 : w.gate.z - 12;
    a.camera.position.set(parking ? 16 : 0, 3, z); a.free.yaw = 0; a.free.pitch = 0; a.setParkMode('walk'); a.walk.yaw = 0;
  }

  // ------------------------------------------------------------------ Statistik & Erfolge
  derived() {
    const s = this.S.stats;
    return { rides: s.rides, rideBy: s.rideBy, coasterCount: COASTERS.filter(n => s.rideBy[n]).length, zoneCount: ZONE_KEYS.filter(k => s.zones[k]).length,
      restCount: Object.keys(s.rests).length, hotelCount: Object.keys(s.hotels).length, photos: this.photos.length, purchases: s.purchases, bookings: s.bookings,
      designs: this.designs.length, km: s.km, flags: s.flags };
  }
  checkAchievements(silent) {
    const d = this.derived();
    for (const [id, name, desc, test] of ACHIEVEMENTS) {
      if (!this.unlocked.has(id) && test(d)) { this.unlocked.add(id); lsSet('ach', [...this.unlocked]); if (!silent) this.app.ui.toast('🏆 Erfolg: ' + name, 4000); }
    }
  }
  onLap(r) {
    const s = this.S.stats, st = r.sim.lastLapStats; s.rides++; s.rideBy[r.coaster.name] = (s.rideBy[r.coaster.name] || 0) + 1; s.km += r.track.L / 1000; s.time += st ? st.time : 0;
    this.checkAchievements();
  }
  update(dt) {
    const a = this.app, S = this.S, w = a.park;
    if (!w || w.def.name !== 'Phantasialand') return;
    if (a.state !== 'menu') S.stats.playTime = (S.stats.playTime || 0) + dt;
    // Zonenbesuche
    if (a.state === 'park' || a.state === 'ride') { const k = w.zoneOf(a.pp().x, a.pp().z); if (k && !S.stats.zones[k]) { S.stats.zones[k] = 1; if (ZONES[k]) a.ui.toast('📍 ' + ZONES[k].name); this.checkAchievements(); } }
    // Rundenzähler (nur für die Bahn, in der der Spieler sitzt)
    if (a.state === 'ride' && a.ride) {
      const r = a.ride, l = r.sim.lap, k = r.sim, prev = this.lapSeen.get(k);
      if (prev === undefined || l < prev) this.lapSeen.set(k, l);
      else if (l > prev) { this.lapSeen.set(k, l); if (!a.replay) this.onLap(r); }
      if (r.sim.state === 'run' && (a.env.night || 0) > 0.6 && !S.stats.flags.nightRide) { S.stats.flags.nightRide = 1; this.checkAchievements(); }
      // Onride-Foto bei ca. 35 % der Strecke
      const pr = r.sim.progress;
      if (r.sim.state === 'run' && pr > 0.35 && pr < 0.4 && this.photoLap !== r.sim.lap + ':' + r.coaster.id && a.settings.autoPhoto !== false) { this.photoLap = r.sim.lap + ':' + r.coaster.id; this.photoReq = { caption: 'Onride-Foto · ' + r.coaster.name, auto: true }; }
    }
    this.achT -= dt; if (this.achT <= 0) { this.achT = 3; this.checkAchievements(); }
    this.autoT -= dt; if (this.autoT <= 0) { this.autoT = 30; if (a.state !== 'menu') this.autosave(); }
    this.updateInteraction(dt); this.updateNav(dt);
  }

  // ------------------------------------------------------------------ Interaktion (E)
  updateInteraction(dt) {
    const a = this.app, w = a.park; let best = null, bd = 1e9;
    this.hint = null;
    if (a.state === 'park' && a.parkMode === 'walk' && !this.room) {
      const c = a.pp();
      for (const it of w.interactables || []) { const d = Math.hypot(it.x - c.x, it.z - c.z); if (d < it.r + 1 && d < bd) { bd = d; best = it; } }
    } else if (this.room && a.state === 'park' && a.parkMode === 'walk') { best = { type: 'exitroom', name: 'Zimmer verlassen', x: 0, z: 0 }; }
    this.hint = best;
    a.ui.setHint(best ? this.hintText(best) : '');
  }
  hintText(it) {
    const t = { restaurant: 'Speisekarte ansehen', stand: 'Speisekarte ansehen', shop: 'Shop ansehen', hotel: 'Rezeption', stage: 'Showzeiten', wc: 'Toiletten', ride: 'Einsteigen', gate: 'Eintritt / Ticket', exitroom: 'Zimmer verlassen' }[it.kind] || 'Interagieren';
    let extra = ''; if (it.kind === 'ride') extra = ` · Wartezeit ${this.app.park.waitMinutes(it.ride)} Min.`;
    return `E – ${t}: ${it.name}${extra}`;
  }
  interact() {
    const it = this.hint; if (!it) return;
    const a = this.app, S = this.S;
    if (it.type === 'exitroom') return this.exitRoom();
    if (it.type === 'ride') {
      if (S.mode === 'play' && !this.ticketOk()) { a.ui.toast('Fahrten sind kostenlos – du brauchst nur das Eintrittsticket (Ticketscanner am Eingang, E)', 4500); return; }
      a.rideOn(it.ride); return;
    }
    if (it.type === 'gate') { a.ui.openPanel('gate'); return; }
    const p = it.poi; if (!p) return;
    if (p.kind === 'restaurant' && !S.stats.rests[p.id]) { S.stats.rests[p.id] = 1; this.checkAchievements(); }
    if (p.kind === 'hotel' && !S.stats.hotels[p.id]) { S.stats.hotels[p.id] = 1; this.checkAchievements(); }
    a.ui.openPanel('poi', p);
  }
  ticketOk() { const t = this.S.ticket; return !!t && t.day === new Date().toDateString(); }
  money(n) { return n.toFixed(2).replace('.', ',') + ' €'; }

  buyTicket(i) {
    const [name, price] = TICKETS[i]; if (this.S.wallet < price) return this.app.ui.toast('Nicht genug Geld'), false;
    this.S.wallet -= price; this.S.stats.spent += price; this.S.ticket = { type: name, day: new Date().toDateString() }; this.S.stats.entered++; this.autosave();
    this.app.ui.toast('🎟 ' + name + ' gekauft'); return true;
  }
  scanTicket() {
    if (!this.ticketOk()) return this.app.ui.toast('Kein gültiges Ticket'), false;
    const a = this.app; a.camera.position.set(0, 3, a.park.gate.z - 25); a.walk.pos.set(0, 1.75 + 0.2, a.park.gate.z - 25); a.walk.yaw = 0; a.ui.toast('✔ Ticket gültig – Einlass'); return true;
  }
  buy(poi, i) {
    const [name, price] = poi.menu[i]; if (this.S.wallet < price) return this.app.ui.toast('Nicht genug Geld'), false;
    this.S.wallet -= price; this.S.stats.spent += price; this.S.stats.purchases++;
    const cur = this.S.inventory[name], rec = (cur && typeof cur === 'object') ? cur : { n: cur || 0, kind: poi.kind, price }; rec.n++; rec.kind = poi.kind; rec.price = price; rec.from = poi.name; this.S.inventory[name] = rec; this.checkAchievements();
    this.app.ui.toast('Gekauft: ' + name + ' – ' + this.money(price)); return true;
  }
  book(hotel, ri, nights) {
    const [room, price] = hotel.rooms[ri], total = price * nights; if (this.S.wallet < total) return this.app.ui.toast('Nicht genug Geld'), false;
    this.S.wallet -= total; this.S.stats.spent += total; this.S.stats.bookings++;
    this.S.bookings.push({ id: Date.now(), hotel: hotel.id, hotelName: hotel.name, room, nights, total, date: new Date().toLocaleDateString('de-DE') }); this.checkAchievements(); this.autosave();
    this.app.ui.toast('🛏 Gebucht: ' + hotel.name + ' – ' + room); return true;
  }
  inventory() { // normalisierte Liste [{name, n, kind, price, from}]
    return Object.entries(this.S.inventory || {}).map(([name, v]) => (typeof v === 'object' ? { name, ...v } : { name, n: v, kind: 'shop', price: 0, from: '' })).filter(x => x.n > 0);
  }
  consume(name) {
    const v = this.S.inventory[name]; if (!v) return false; const rec = typeof v === 'object' ? v : (this.S.inventory[name] = { n: v, kind: 'shop' });
    if (rec.kind === 'shop') { this.app.ui.toast('Souvenirs behältst du – die kann man nicht essen 😉'); return false; }
    rec.n--; this.S.stats.consumed = (this.S.stats.consumed || 0) + 1; if (rec.n <= 0) delete this.S.inventory[name]; this.app.ui.toast('😋 Guten Appetit: ' + name); return true;
  }
  checkout(id) { const b = this.S.bookings.find(x => x.id === id); if (!b) return; this.S.bookings = this.S.bookings.filter(x => x.id !== id); this.S.wallet += Math.round(b.total * 0.5); this.app.ui.toast('Check-out – 50 % erstattet (virtuell)'); }
  addMoney(n) { this.S.wallet += n; }

  // ------------------------------------------------------------------ Hotelzimmer (virtueller Innenraum)
  enterRoom(hotel, booking) {
    const a = this.app, w = a.park; if (this.room) return;
    if (!this.roomGroup) this.roomGroup = this.buildRoom();
    this.roomGroup.visible = true;
    this.room = { hotel, back: a.pp().clone(), yaw: a.walk.yaw };
    a.walk.pos.set(3000, 1.75, 3000 + 1.2); a.walk.yaw = 0; a.walk.vy = 0; a.camera.position.copy(a.walk.pos); a.ui.closePanel();
    a.ui.toast('Zimmer – E am Ausgang: zurück', 3500);
  }
  exitRoom() {
    const a = this.app; if (!this.room) return; this.roomGroup.visible = false; const b = this.room.back; this.room = null;
    a.walk.pos.set(b.x, b.y, b.z); a.camera.position.copy(b); a.ui.setHint('');
  }
  buildRoom() {
    const a = this.app, g = new THREE.Group(); g.position.set(3000, 0, 3000);
    const mat = (c, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...e });
    const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    box(7, 0.1, 6, mat('#7a5a3a'), 0, 0.05, 0); box(7, 0.1, 6, mat('#e8e0d0'), 0, 3.05, 0);
    box(0.2, 3, 6, mat('#d8cfc0'), -3.5, 1.5, 0); box(0.2, 3, 6, mat('#d8cfc0'), 3.5, 1.5, 0); box(7, 3, 0.2, mat('#d8cfc0'), 0, 1.5, -3); box(7, 3, 0.2, mat('#d8cfc0'), 0, 1.5, 3);
    box(2.2, 0.5, 2.4, mat('#4a3322'), -2, 0.3, -1.4); box(2.0, 0.25, 2.2, mat('#e8e8f0'), -2, 0.65, -1.4); box(2.0, 0.6, 0.3, mat('#4a3322'), -2, 0.9, -2.5);
    box(0.6, 0.6, 0.6, mat('#4a3322'), -0.4, 0.3, -2.6); box(1.2, 2.4, 0.7, mat('#5a4030'), 2.6, 1.2, -2.5);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshBasicMaterial({ color: 0x182848 })); win.position.set(0, 1.7, -2.88); g.add(win);
    for (let k = 0; k < 40; k++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xffe8a0 })); s.position.set(-1.2 + Math.random() * 2.4, 1.0 + Math.random() * 1.4, -2.86); g.add(s); }
    const exit = box(1, 2.1, 0.1, mat('#3a2a1a'), 0, 1.05, 2.9); const lamp = new THREE.PointLight(0xffd8a0, 18, 12, 1.6); lamp.position.set(0, 2.6, 0); g.add(lamp);
    a.scene.add(g); g.visible = false;
    return g;
  }

  // ------------------------------------------------------------------ Navigation
  navigateTo(it) {
    const a = this.app, w = a.park; if (!w || !w.routeTo) return;
    this.nav = { it, route: null }; this.navT = 0; this.updateNav(0, true);
    a.ui.toast('🧭 Navigation zu: ' + it.name);
  }
  stopNav() { this.nav = null; this.app.park?.clearRoute?.(); this.app.ui.setNav(null); }
  updateNav(dt, force) {
    const a = this.app, w = a.park; if (!this.nav || !w || !w.routeTo) return;
    this.navT -= dt; const c = a.pp();
    const tx = this.nav.it.ax ?? this.nav.it.x, tz = this.nav.it.az ?? this.nav.it.z;
    if (force || this.navT <= 0) { this.navT = 2.5; const target = this.nav.it.type === 'ride' ? { ride: this.nav.it.ride } : this.nav.it.poi ? this.nav.it.poi : this.nav.it; this.nav.route = w.routeTo(c.x, c.z, target); w.setRoute(this.nav.route.concat([[tx, tz]])); }
    const d = Math.hypot(tx - c.x, tz - c.z);
    if (d < 7) { this.app.ui.toast('🎯 Ziel erreicht: ' + this.nav.it.name); this.stopNav(); return; }
    let wp = [tx, tz]; if (this.nav.route) for (const p of this.nav.route) if (Math.hypot(p[0] - c.x, p[1] - c.z) > 8) { wp = p; break; }
    const ang = Math.atan2(wp[0] - c.x, wp[1] - c.z); const e = new THREE.Euler().setFromQuaternion(a.camera.quaternion, 'YXZ'); const fwd = Math.atan2(-Math.sin(e.y), -Math.cos(e.y));
    let rel = ang - fwd; while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
    a.ui.setNav({ name: this.nav.it.name, dist: d, rel });
  }

  // ------------------------------------------------------------------ Fotos & gespeicherte Fahrten
  takePhoto(caption) { this.photoReq = { caption: caption || 'Foto' }; }
  capture(renderer) {
    const req = this.photoReq; if (!req) return; this.photoReq = null;
    const src = renderer.domElement, w = 480, h = Math.round(480 * src.height / src.width), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.drawImage(src, 0, 0, w, h);
    const url = cv.toDataURL('image/jpeg', 0.72);
    this.photos.unshift({ id: Date.now(), t: new Date().toLocaleString('de-DE'), caption: req.caption, src: url, auto: !!req.auto }); this.photos.length = Math.min(this.photos.length, 24);
    if (!lsSet('photos', this.photos)) { this.photos.length = Math.min(this.photos.length, 8); lsSet('photos', this.photos); }
    if (!req.auto) { this.app.ui.flash(); this.app.ui.toast('📷 Foto gespeichert (Fotoalbum)'); } this.checkAchievements();
  }
  deletePhoto(id) { this.photos = this.photos.filter(p => p.id !== id); lsSet('photos', this.photos); }
  saveRide(rec, ride) {
    if (!rec || !rec.samples.length) return false;
    const sm = rec.samples.filter((_, i) => i % 3 === 0).map(a => a.map(v => +v.toFixed(2)));
    this.rides.unshift({ id: Date.now(), name: ride.coaster.name, park: ride.coaster.park, ride: ride.coaster.id, t: new Date().toLocaleString('de-DE'), samples: sm }); this.rides.length = Math.min(this.rides.length, 4); lsSet('rides', this.rides); return true;
  }
  deleteRide(id) { this.rides = this.rides.filter(r => r.id !== id); lsSet('rides', this.rides); }
  saveDesigns() { lsSet('designs', this.designs); this.checkAchievements(); }
}
