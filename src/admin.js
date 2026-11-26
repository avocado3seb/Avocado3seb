// Admin-Panel – nur für den Spieler „Avocado3seb“ (Name + Admin-Code)
import { G } from './state.js';
import { h } from './ui.js';
import { fmtMoney } from './util.js';
import { CATALOG, byKey } from './vehicledata.js';
import { PACKS, PROPERTIES, WEAPONS } from './data.js';
import { WEATHER } from './environment.js';

export const ADMIN_NAME = 'Avocado3seb';
// SHA-256 von „vice-city-admin|<Admin-Code>“. Der Code selbst steht nicht im Quelltext.
const ADMIN_HASH = 'f7177d99ef4d95a72c4e1d9675d26f77986c88649c41e10a4cc0c3bb9a2d3013';
export const MAX_GIFT = 500_000_000_000;

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const isAdminName = (n) => (n || '').trim().toLowerCase() === ADMIN_NAME.toLowerCase();

export class Admin {
  constructor(G) { this.G = G; this.on = false; this.fly = false; this.invisible = false; G.admin = false; this.restore(); }
  async restore() {
    try { const t = localStorage.getItem('vc_admin'); if (t === ADMIN_HASH && isAdminName(this.G.settings.name)) this.grant(true); } catch (e) { /* ignore */ }
  }
  async login(name, code) {
    if (!isAdminName(name)) return false;
    const hsh = await sha256('vice-city-admin|' + (code || '').trim().toUpperCase());
    if (hsh !== ADMIN_HASH) return false;
    try { localStorage.setItem('vc_admin', ADMIN_HASH); } catch (e) { /* ignore */ }
    this.G.settings.name = ADMIN_NAME; this.G.applySettings(); this.grant(false); return true;
  }
  grant(silent) {
    this.on = true; this.G.admin = true;
    if (!silent) this.G.ui?.toast('🔑 Admin-Modus aktiviert – willkommen, Avocado3seb!', 6000);
    // Avocado-Pack gehört dem Admin
    if (this.G.eco) this.G.eco.packs.avocado = true;
    this.G.ui?.updateProfile?.();
  }
  logout() { this.on = false; this.G.admin = false; this.fly = false; try { localStorage.removeItem('vc_admin'); } catch (e) { /* ignore */ } this.G.ui?.updateProfile?.(); }

  setFly(v) { this.fly = !!v; const P = this.G.player; if (P.vehicle) P.exitVehicle(true); P.fly = this.fly; this.G.ui.toast(this.fly ? 'Flugmodus an – WASD, Leertaste hoch, Strg runter, Shift schnell' : 'Flugmodus aus'); }
  giveMoney(n) { n = Math.min(MAX_GIFT, Math.max(0, Math.floor(n))); this.G.player.addMoney(n, 'Admin'); this.G.ui.toast(`+${fmtMoney(n)}`); }
  spawnVehicle(key, ahead = 9) {
    const G = this.G, P = G.player, spec = byKey.get(key); if (!spec) return null;
    const yaw = P.vehicle ? P.vehicle.yaw : P.yaw; const pos = P.position;
    let x = pos.x + Math.sin(yaw) * ahead, z = pos.z + Math.cos(yaw) * ahead;
    if (spec.kind === 'boat' && !G.world.isWater(x, z)) { const s = G.world.boatSpots?.[0]; if (s) { x = s.x + 30; z = s.z + 20; } }
    const v = G.vehicles.spawn(spec, x, z, yaw, { sleep: false }); v.tag = 'abandoned';
    if (spec.kind === 'plane' || spec.kind === 'heli') v.pos.y = Math.max(v.pos.y, G.world.groundY(x, z) + 0.3);
    return v;
  }
  panel(c) {
    const G = this.G, P = G.player;
    c.replaceChildren(h('h2', {}, '🔑 Admin-Panel'));
    if (!this.on) { c.append(h('p', { class: 'd' }, 'Kein Zugriff.')); return; }
    const btn = (l, fn, cls = '') => h('button', { class: 'btn small ' + cls, onClick: () => { G.audio?.click(); fn(); } }, l);
    const sec = (t) => h('h3', {}, t);
    // Geld
    const amt = h('input', { type: 'number', class: 'mpfield', min: 0, max: MAX_GIFT, value: 1000000, style: { width: '220px' } });
    c.append(sec('Geld'), h('div', { class: 'sel' }, ...[['1 Mio', 1e6], ['100 Mio', 1e8], ['1 Mrd', 1e9], ['50 Mrd', 5e10], ['100 Mrd', 1e11], ['500 Mrd', 5e11]].map(([l, v]) => btn('+ ' + l, () => this.giveMoney(v), 'gold'))),
      h('div', { class: 'field' }, amt, btn('Betrag erhalten', () => this.giveMoney(+amt.value)), btn('Geld auf 0', () => { P.money = 0; P.addMoney(0); })));
    // Spieler
    c.append(sec('Spieler'), h('div', { class: 'sel' },
      btn(`Gottmodus: ${G.cheat.god ? 'AN' : 'AUS'}`, () => { G.cheat.god = !G.cheat.god; G.ui.renderPause(); }),
      btn(`Fliegen: ${this.fly ? 'AN' : 'AUS'}`, () => { this.setFly(!this.fly); G.ui.renderPause(); }),
      btn('Voll heilen', () => { P.health = Math.max(100, P.maxHealth || 100); P.armor = 100; P.hunger = 100; }),
      btn('Fahndung 0', () => G.police.clear()), btn('Fahndung 5★', () => G.police.setWanted(5)),
      btn('Alle Waffen', () => { for (const k of Object.keys(WEAPONS)) if (!WEAPONS[k].melee) P.addWeapon(k, 500); G.ui.toast('Alle Waffen mit Munition'); }),
      btn('Alle Packs', () => { for (const k of Object.keys(PACKS)) G.eco.packs[k] = true; G.eco.applyToWorld(); G.life?.unlockPackItems?.(); G.ui.toast('Alle Packs freigeschaltet'); }),
      btn('Alle Immobilien', () => { for (const p of PROPERTIES) G.eco.props[p.id] = true; G.eco.applyToWorld(); G.ui.toast('Alle Immobilien gehören dir'); }),
      btn('Gefängnis überspringen', () => G.prison?.release?.())));
    // Fahrzeuge
    const sel = h('select', { class: 'mpfield', style: { maxWidth: '320px' } }, CATALOG.map((s) => h('option', { value: s.key }, `${s.name} (${s.label})`)));
    c.append(sec('Fahrzeuge'), h('div', { class: 'sel' }, btn('✈🛥 Flugyacht spawnen', () => { const v = this.spawnVehicle('flugyacht', 22); if (v) { P.teleport(v.pos.x + 12, v.pos.z); G.ui.toast('Avocado-Flugyacht gespawnt – steige ein (F), Leertaste = steigen'); } }, 'gold'), btn('Hypercar', () => this.spawnVehicle('phantom_aureus')), btn('Jet', () => this.spawnVehicle('lear_jet_lj', 20)), btn('Helikopter', () => this.spawnVehicle('ranger_heli', 14)), btn('Mega-Yacht', () => this.spawnVehicle('mega_yacht_opulence', 30)), btn('Repariere mein Fahrzeug', () => P.vehicle?.repair())),
      h('div', { class: 'field' }, sel, btn('Spawnen', () => { const v = this.spawnVehicle(sel.value); if (v) G.ui.toast(v.spec.name + ' gespawnt'); }), btn('In Garage legen', () => { const spec = byKey.get(sel.value); G.eco.garage.push({ id: G.eco.nextId++, key: spec.key, color: spec.color, dmg: 0, health: 1000 }); G.ui.toast('In deiner Garage'); })));
    // Welt
    const places = (G.destinations || []).filter((d) => d.admin !== false);
    c.append(sec('Zeit & Wetter'), h('div', { class: 'sel' }, ...[['Morgen', 7], ['Mittag', 12.5], ['Sonnenuntergang', 19.2], ['Nacht', 0.5]].map(([l, t]) => btn(l, () => { G.env.time = t; })), ...Object.entries(WEATHER).map(([k, w]) => btn(w.label, () => { G.env.setWeather(k); G.env.lockWeather = true; setTimeout(() => (G.env.lockWeather = false), 180000); }))),
      sec('Teleport'), h('div', { class: 'sel' }, ...places.map((d) => btn(d.name, () => { G.ui.closePause(); G.travel?.go(d, true); }))));
    // Mehrspieler
    const mp = G.mp;
    c.append(sec('Mehrspieler – Spielern etwas geben'));
    if (!mp?.active || !mp.remotes.size) c.append(h('p', { class: 'd' }, 'Keine Mitspieler verbunden.'));
    else {
      const gamt = h('input', { type: 'number', class: 'mpfield', min: 0, max: MAX_GIFT, value: 1000000, style: { width: '220px' } });
      c.append(h('div', { class: 'field' }, h('label', {}, 'Betrag (max 500 Mrd)'), gamt));
      for (const r of mp.remotes.values()) c.append(h('div', { class: 'row' }, h('div', { class: 'grow t', style: { color: r.color } }, r.name), btn('💰 Geld geben', () => { mp.gift(r.id, +gamt.value); }), btn('🔫 Waffen', () => mp.sendAdmin(r.id, { weapons: true })), btn('❤ Heilen', () => mp.sendAdmin(r.id, { heal: true })), btn('🚗 Fahrzeug', () => mp.sendAdmin(r.id, { vehicle: 'phantom_aureus' })), btn('✈🛥 Flugyacht', () => mp.sendAdmin(r.id, { vehicle: 'flugyacht' })), btn('👢 Kick', () => mp.kick(r.id))));
      c.append(h('div', { class: 'field' }, btn('Allen Geld geben', () => { for (const r of mp.remotes.values()) mp.gift(r.id, +gamt.value); }), btn('📢 Ansage', () => { const t = prompt('Ansage an alle:'); if (t) mp.announce(t); })));
    }
    c.append(h('div', { style: { marginTop: '16px' } }, btn('Admin abmelden', () => { this.logout(); G.ui.renderPause(); })));
  }
  // Profil-/Anmelde-Dialog
  profileModal() {
    const G = this.G, ui = G.ui;
    const name = h('input', { type: 'text', maxlength: 14, class: 'mpfield', value: G.settings.name || '', placeholder: 'Spielername' });
    const code = h('input', { type: 'password', class: 'mpfield', placeholder: 'Admin-Code', style: { display: isAdminName(name.value) ? '' : 'none', marginTop: '8px' } });
    const msg = h('div', { class: 'd', style: { minHeight: '20px', margin: '8px 0' } }, this.on ? '🔑 Admin aktiv' : '');
    name.addEventListener('input', () => { code.style.display = isAdminName(name.value) ? '' : 'none'; });
    const save = h('button', { class: 'btn primary', onClick: async () => {
      const n = name.value.trim().slice(0, 14);
      if (isAdminName(n) && !this.on) { const ok = await this.login(n, code.value); if (!ok) { msg.textContent = '⚠ Falscher Admin-Code – der Name „Avocado3seb“ ist geschützt.'; return; } }
      else if (isAdminName(n) && this.on) { G.settings.name = n; }
      else { if (this.on) this.logout(); G.settings.name = n; }
      G.applySettings(); ui.updateProfile(); ui.toast('Profil gespeichert – bleibt auch nach dem Neuladen erhalten'); ui.closeModal();
    } }, 'Speichern');
    const out = h('button', { class: 'btn', style: { marginLeft: '8px' }, onClick: () => { this.logout(); G.settings.name = ''; G.applySettings(); ui.updateProfile(); ui.toast('Abgemeldet – Profil gelöscht'); ui.closeModal(); } }, 'Abmelden / Profil löschen');
    ui.modal('Profil', h('div', { class: 'body' }, h('h3', {}, 'Name'), name, code, msg, save, out, h('p', { class: 'd' }, 'Der Name „Avocado3seb“ ist reserviert und braucht den Admin-Code.')), { cash: false });
  }
}
