// Wirtschaft, Immobilien, Packs, Garage, Speichern/Laden
import { G } from './state.js';
import { PROPERTIES, PACKS, WEAPON_SKINS, WATCHES } from './data.js';
import { byKey, CATALOG } from './vehicledata.js';
import { fmtMoney } from './util.js';

const SAVE_VERSION = 2;
export class Economy {
  constructor(G) {
    this.G = G; this.props = {}; this.packs = {}; this.garage = []; this.nextId = 1; this.lastDay = -1; this.incomeLog = 0;
    this.bank = 0;
  }
  hasPack(id) { return !id || !!this.packs[id]; }
  owns(id) { return !!this.props[id]; }
  propDef(id) { return PROPERTIES.find((p) => p.id === id); }
  slots() { let s = 0; for (const id of Object.keys(this.props)) s += this.propDef(id)?.slots || 0; return s; }
  income() { let s = 0; for (const id of Object.keys(this.props)) s += this.propDef(id)?.income || 0; return s; }
  prestige() {
    const P = this.G.player; let pr = 0;
    const w = WATCHES.find((x) => x.id === 'w' + (P.watch || 0)); pr += w?.prestige || 0;
    if (P.outfit.top === 7 || P.outfit.top === 8) pr += 5; if (P.outfit.hat === 5) pr += 2; if (P.outfit.glasses === 3) pr += 2; if (P.outfit.bottom === 5) pr += 3;
    for (const id of Object.keys(this.props)) { const p = this.propDef(id); pr += p.price > 5e6 ? 6 : p.price > 5e5 ? 3 : 1; }
    for (const e of this.garage) { const s = byKey.get(e.key); if (s && s.price > 300000) pr += 1; }
    return pr;
  }
  buyPack(id) {
    const P = this.G.player, pk = PACKS[id];
    if (this.packs[id]) return false;
    if (P.money < pk.price) { this.G.ui.toast('Nicht genug Geld!'); return false; }
    P.addMoney(-pk.price, 'Pack'); this.packs[id] = true;
    this.G.ui.toast(`${pk.name} freigeschaltet!`); this.G.audio?.cash?.();
    this.G.mission?.refreshAvailable?.(); this.G.activities?.refreshChests?.();
    this.applyToWorld();
    return true;
  }
  buyProperty(p) {
    const P = this.G.player;
    if (this.props[p.id]) return false;
    if (p.pack && !this.packs[p.pack]) { this.G.ui.toast(`Benötigt: ${PACKS[p.pack].name}`); return false; }
    if (P.money < p.price) { this.G.ui.toast('Nicht genug Geld!'); return false; }
    P.addMoney(-p.price, 'Immobilie'); this.props[p.id] = true;
    this.G.ui.toast(`Gekauft: ${p.name}`); this.G.audio?.cash?.();
    this.applyToWorld(); this.autosave();
    return true;
  }
  applyToWorld() {
    for (const poi of this.G.world.pois) {
      if (poi.kind !== 'property' || !poi.marker) continue;
      const own = this.props[poi.id];
      poi.marker.group.children.forEach((c) => { if (c.material && c.material.color) c.material = this.G.markers.mat(own ? 0x00e676 : 0x69f0ae, c === poi.marker.group.children[0] ? 0.2 : 0.9); });
    }
  }
  // Fahrzeug kaufen → in Garage oder vor Ort
  buyVehicle(spec, color, spawnAt = null) {
    const P = this.G.player;
    if (spec.pack && !this.packs[spec.pack]) { this.G.ui.toast(`Benötigt: ${PACKS[spec.pack].name}`); return null; }
    if (!spec.buyable) return null;
    if (P.money < spec.price) { this.G.ui.toast('Nicht genug Geld!'); return null; }
    P.addMoney(-spec.price, 'Fahrzeug'); this.G.audio?.cash?.();
    const e = { id: this.nextId++, key: spec.key, color, dmg: 0, health: 1000 };
    const at = spawnAt || this.spawnPoint(spec);
    const v = this.G.vehicles.spawn(spec, at.x, at.z, at.yaw, { color, sleep: false });
    v.owned = true; v.entry = e; v.keep = true; v.tag = 'owned';
    this.garage.push(e); e.inWorld = true;
    this.G.ui.toast(`${spec.name} gekauft und geliefert!`);
    this.autosave();
    return v;
  }
  spawnPoint(spec) {
    const G = this.G, W = G.world, P = G.player;
    if (spec.kind === 'boat') { const s = W.boatSpots[Math.floor(Math.random() * W.boatSpots.length)]; return { x: s.x + 30, z: s.z + 20, yaw: Math.PI }; }
    if (spec.kind === 'plane' || spec.kind === 'heli') { return { x: -980, z: 770, yaw: Math.PI / 2 }; }
    const pos = P.position, yaw = P.vehicle ? P.vehicle.yaw : P.yaw;
    // Auf der nächsten Straße vor dem Spieler
    const n = W.nearestNode(pos.x + Math.sin(yaw) * 14, pos.z + Math.cos(yaw) * 14, 120);
    if (n) return { x: n.x + 5, z: n.z + 14, yaw: Math.PI / 2 };
    return { x: pos.x + Math.sin(yaw) * 7, z: pos.z + Math.cos(yaw) * 7, yaw };
  }
  ownedInWorld() { return this.G.vehicles.list.filter((v) => v.owned && !v.exploded); }
  storeVehicle(v) {
    if (!v.owned) { this.G.ui.toast('Das ist nicht dein Fahrzeug.'); return false; }
    if (v.entry) { v.entry.health = v.health; v.entry.dmg = v.dmg; v.entry.color = v.color; v.entry.inWorld = false; }
    if (this.G.player.vehicle === v) this.G.player.exitVehicle(true);
    this.G.vehicles.despawn(v); this.G.ui.toast('Fahrzeug in der Garage geparkt.');
    return true;
  }
  takeOut(entry, at = null) {
    const spec = byKey.get(entry.key); if (!spec) return null;
    if (this.G.vehicles.list.some((v) => v.entry === entry && !v.dead)) { this.G.ui.toast('Fahrzeug steht bereits draußen.'); return null; }
    const pt = at || this.spawnPoint(spec);
    const v = this.G.vehicles.spawn(spec, pt.x, pt.z, pt.yaw, { color: entry.color, health: entry.health, dmg: entry.dmg, sleep: false });
    v.owned = true; v.entry = entry; v.keep = true; v.tag = 'owned'; entry.inWorld = true;
    if (entry.tune) { v.tune = { ...entry.tune }; v.applyTune(); }
    return v;
  }
  update(dt) {
    const G = this.G;
    const day = G.day;
    // Tageswechsel um 06:00
    const t = G.env.time;
    if (this.lastDay < 0) this.lastDay = Math.floor(G.dayCounter || 0);
    if (t >= 6 && t < 6.2 && !this._paid) {
      this._paid = true; G.day++;
      const inc = this.income();
      if (inc > 0) { G.player.addMoney(inc, 'Einnahmen'); G.ui.toast(`Tageseinnahmen aus Geschäften: ${fmtMoney(inc)}`); }
    } else if (t > 7) this._paid = false;
    // Besitz aus der Welt verwalten (zerstörte Fahrzeuge gehen verloren)
    for (const e of this.garage) { if (e.inWorld) { const v = G.vehicles.list.find((q) => q.entry === e); if (!v || v.exploded) { if (v?.exploded && !e.lost) { e.lost = true; } if (!v) e.inWorld = false; } } }
    this.garage = this.garage.filter((e) => !(e.lost && !G.vehicles.list.some((q) => q.entry === e && !q.exploded)));
  }

  // ----- Speichern -----
  serialize() {
    const G = this.G, P = G.player;
    // draußen stehende eigene Fahrzeuge merken
    const outside = [];
    for (const v of G.vehicles.list) if (v.owned && v.entry && !v.exploded) { v.entry.health = v.health; v.entry.dmg = v.dmg; v.entry.color = v.color; outside.push({ id: v.entry.id, x: v.pos.x, z: v.pos.z, yaw: v.yaw }); }
    return {
      v: SAVE_VERSION, ts: Date.now(),
      player: { x: P.position.x, z: P.position.z, yaw: P.yaw, health: P.health, armor: P.armor, hunger: P.hunger, money: P.money, weapon: P.weapon, weapons: P.weapons, outfit: P.outfit, owned: P.owned, inv: P.inv, skins: P.skins, skinSel: P.skinSel, watch: P.watch || 0, stats: P.stats, prestige: P.prestige },
      inVehicle: P.vehicle && P.vehicle.entry ? P.vehicle.entry.id : null,
      env: { time: G.env.time, weather: G.env.target },
      eco: { props: this.props, packs: this.packs, garage: this.garage.map((e) => ({ ...e })), nextId: this.nextId, outside },
      mission: G.mission?.serialize?.() || null, found: G.found, day: G.day, activities: G.activities?.serialize?.() || null,
    };
  }
  deserialize(d) {
    const G = this.G, P = G.player;
    if (!d) return false;
    const p = d.player;
    P.alive = true; P.vehicle && P.exitVehicle(true);
    P.pos.set(p.x, G.world.groundY(p.x, p.z), p.z); P.yaw = p.yaw; P.health = p.health; P.armor = p.armor; P.hunger = p.hunger; P.money = p.money;
    P.weapons = p.weapons; P.weapon = p.weapon; P.outfit = p.outfit; P.owned = p.owned; P.inv = p.inv; P.skins = p.skins || {}; P.skinSel = p.skinSel || 'default'; P.watch = p.watch || 0; Object.assign(P.stats, p.stats || {});
    P.refreshOutfit(); P.selectWeapon(p.weapon);
    G.env.time = d.env.time; G.env.setWeather(d.env.weather, true);
    this.props = d.eco.props || {}; this.packs = d.eco.packs || {}; this.garage = d.eco.garage || []; this.nextId = d.eco.nextId || 1;
    // eigene Fahrzeuge wieder platzieren
    for (const v of [...G.vehicles.list]) if (v.owned) G.vehicles.despawn(v);
    for (const e of this.garage) e.inWorld = false;
    for (const o of d.eco.outside || []) { const e = this.garage.find((q) => q.id === o.id); if (e) this.takeOut(e, { x: o.x, z: o.z, yaw: o.yaw }); }
    G.found = d.found || { packages: {} }; G.refreshPackages?.(); G.day = d.day || 1;
    G.mission?.deserialize?.(d.mission); G.activities?.deserialize?.(d.activities);
    G.police.reset(); P.rig.snap(P);
    if (d.inVehicle) { const v = G.vehicles.list.find((q) => q.entry && q.entry.id === d.inVehicle); if (v) { v.place(p.x, p.z, p.yaw); P.enterVehicle(v); } }
    this.applyToWorld();
    return true;
  }
  slotKey(i) { return i === 'auto' ? 'vc_save_auto' : 'vc_save_' + i; }
  save(slot = 0) { try { localStorage.setItem(this.slotKey(slot), JSON.stringify(this.serialize())); return true; } catch (e) { console.warn('save failed', e); return false; } }
  load(slot = 0) { try { const raw = localStorage.getItem(this.slotKey(slot)); if (!raw) return false; return this.deserialize(JSON.parse(raw)); } catch (e) { console.warn('load failed', e); return false; } }
  info(slot) { try { const raw = localStorage.getItem(this.slotKey(slot)); if (!raw) return null; const d = JSON.parse(raw); return { ts: d.ts, money: d.player.money, time: d.env.time, missions: d.mission?.done?.length || 0, props: Object.keys(d.eco.props || {}).length }; } catch (e) { return null; } }
  autosave() { if (this.G.mp?.active) return; if (this._as && Date.now() - this._as < 4000) return; this._as = Date.now(); this.save('auto'); }
  hasAnySave() { return [0, 1, 2, 'auto'].some((s) => this.info(s)); }
  latestSlot() { let b = null, bt = 0; for (const s of [0, 1, 2, 'auto']) { const i = this.info(s); if (i && i.ts > bt) { bt = i.ts; b = s; } } return b; }
  deleteSlot(s) { try { localStorage.removeItem(this.slotKey(s)); } catch (e) { /* ignore */ } }
}
