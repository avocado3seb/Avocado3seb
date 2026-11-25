// Das "echte Leben": Läden, Schule, Fitness, YouTube, Gaming-Setup, Handy/WLAN, Reisen, Hausbau, Upgrades, Packs, Geschäfte
import { h } from './ui.js';
import { G } from './state.js';
import { fmtMoney, clamp } from './util.js';
import { PACKS, WEAPONS, FOOD, MENUS, PROPERTIES } from './data.js';
import { PACK_GRANTS } from './packdefs.js';
import { CATALOG, byKey, find } from './vehicledata.js';
import { POI_COLORS, POI_ICONS } from './game.js';
import { SKI_VILLAGE } from './consts.js';

Object.assign(POI_COLORS, { supermarket: 0x66bb6a, pharmacy: 0x26a69a, electronics: 0x5c6bc0, furniture: 0xa1887f, hardware: 0xffa726, gym: 0xef5350, cinema: 0xab47bc, school: 0xfdd835, flea: 0xbcaaa4, travel: 0x29b6f6, builder: 0xff9800, mcd: 0xffc107, yt: 0xff5252, gaming: 0x7c4dff, tattoo: 0x90a4ae, phone: 0x00bcd4, pets: 0x9ccc65, lift: 0xffffff, skirent: 0x40c4ff, skirace: 0x00e5ff, safari: 0xffd54f, secret: 0x7c4dff, workout: 0xff7043, bake: 0xd7a86e });
Object.assign(POI_ICONS, { supermarket: '🛒', pharmacy: '💊', electronics: '📱', furniture: '🛋️', hardware: '🔨', gym: '🏋️', cinema: '🎬', school: '🎓', flea: '🧺', travel: '✈️', builder: '🏗️', mcd: '🍟', yt: '📺', gaming: '🎮', tattoo: '🖋️', phone: '📱', pets: '🐶', lift: '🚡', skirent: '⛷️', skirace: '🏁', safari: '🦁', secret: '❓', workout: '🏋️' });

// ---------- Daten ----------
export const SKILLS = { drive: ['Fahren', 'Schnellere Fahrzeuge (+3 % Spitze je Stufe)'], shoot: ['Schießen', 'Weniger Streuung (−8 % je Stufe)'], cook: ['Kochen', 'Mehr Umsatz im Restaurant (+15 % je Stufe)'], it: ['Informatik', 'Mehr YouTube- & Streaming-Einnahmen (+12 % je Stufe)'], fit: ['Fitness', 'Mehr Leben & schnellere Regeneration'] };
export const DEST = [
  { id: 'alps', name: 'Alpen & Skidorf', icon: '⛷️', price: 600, x: SKI_VILLAGE.x - 20, z: SKI_VILLAGE.z + 28, desc: 'Skigebiet mit Bergbahn, 430-m-Gipfeln und Chalets.' },
  { id: 'terra', name: 'Terra Mundi – Weltreise', icon: '🌍', price: 1800, x: 2310, z: 700, desc: 'Eiffelturm, Kolosseum, Pyramiden, Taj Mahal, Freiheitsstatue, Sydney-Oper & Fuji.' },
  { id: 'safari', name: 'Afrika-Safari', icon: '🦁', price: 1200, x: -1450, z: 2325, desc: 'Savanne mit Löwen, Zebras, Giraffen & Elefanten.' },
  { id: 'esmeralda', name: 'Insel Esmeralda', icon: '🏝️', price: 900, island: 'esmeralda', desc: 'Private Trauminsel mit Landebahn.' },
  { id: 'palmera', name: 'Palmera Inselresort', icon: '🌴', price: 900, island: 'palmera', desc: 'Strandbar und Bootssteg.' },
  { id: 'home', name: 'Vice City – Flughafen', icon: '🏙️', price: 300, x: -900, z: 668, desc: 'Zurück nach Vice City.' },
];
const GOODS = {
  supermarket: ['Vice Supermarkt', [['Fleisch-Paket (Kühlschrank)', 28, 'Zum Kochen zuhause', () => fridge('meat', 1)], ['Gemüse-Korb (Kühlschrank)', 16, 'Zum Kochen zuhause', () => fridge('veg', 1)], ['Getränke-Kiste', 12, 'Für unterwegs & Kühlschrank', () => fridge('drink', 1)], ['Energy-Drink', 6, 'Tempo-Buff 90 s', () => { G.player.buff.speed = 90; }], ['Taschenlampe', 25, 'Wird für Höhlen & Grabkammern gebraucht', () => inv('torch', 1)]]],
  pharmacy: ['Apotheke Vice', [['Verbandskasten', 60, 'Heilt komplett', () => inv('medkit', 1)], ['Schutzweste', 250, 'Panzerung', () => inv('armorkit', 1)], ['Vitamine (+5 max. Leben)', 1500, 'Dauerhaft, bis 150', () => { const P = G.player; if (P.maxHealth >= 150) return false; P.maxHealth += 5; }], ['Schmerzmittel', 20, 'Sofort +50 Leben', () => { G.player.health = Math.min(G.player.maxHealth, G.player.health + 50); }]]],
  electronics: ['ElektroWelt', null],
  furniture: ['Möbelhaus Casa', [['Kleiderschrank', 900, 'Outfit zuhause wechseln', () => furn('wardrobe')], ['Kühlschrank', 700, 'Lebensmittel lagern & kochen', () => furn('fridge')], ['Waffen- & Geldtresor', 1800, 'Sicherer Tresor', () => furn('safe')], ['Bett (Luxus)', 1200, 'Schlafen regeneriert voll', () => furn('bed')], ['Sofa & Smart-TV', 1600, 'Entspannen zuhause', () => furn('tv')], ['Aquarium', 600, 'Reduziert Stress (+Regeneration)', () => furn('aquarium')]]],
  hardware: ['Baumarkt Bob', [['Werkzeugkiste', 120, 'Wird für Tunnel & Verstecke gebraucht', () => inv('toolbox', 1)], ['Bauplan-Rabatt-Karte', 8000, 'Hausbau −15 %', () => perk('plan')], ['Alarmanlage (Zuhause)', 2500, 'Mehr Sicherheit', () => perk('alarm')], ['Solarpaket', 12000, '+400 $ pro Tag auf all deinen Immobilien', () => perk('solar')]]],
  tattoo: ['Ink Vice Tattoo', [['Drachen-Tattoo', 1200, '+10 max. Leben', () => { if (perk('dragon') === false) return false; G.player.maxHealth += 10; }], ['Anker-Tattoo', 600, '+5 % Belohnung bei Jobs', () => perk('anchor')], ['Tribal-Sleeve', 2400, 'Nahkampf stärker', () => perk('tribal')]]],
  pets: ['Tierhandlung Wuff', [['Hund „Bello“', 800, 'Regeneration +50 %', () => perk('dog')], ['Katze „Luna“', 600, 'Mehr Glück in Kisten & Secrets', () => perk('cat')], ['Papagei „Rio“', 900, 'Plappert lustige Sätze', () => perk('parrot')]]],
  gaming: ["Gamer's Paradise", null],
  cinema: ['Vice Kino', null],
};
const PHONES = [['Vice Phone 2', 1500, 1, 'Bessere Kamera (+25 % YouTube-Views)'], ['Vice Phone Ultra', 6500, 2, 'Profi-Kamera (+60 % YouTube-Views), schnelle Lieferdienste']];
const ROUTERS = [['WLAN-Router Basic', 300, 1, 'Stabiles WLAN zuhause'], ['WLAN 6 Mesh', 1400, 2, 'Schnelles WLAN (+30 % Einnahmen)'], ['Glasfaser 10 Gbit', 4500, 3, 'Ultraschnell (+70 % Einnahmen)']];
const SETUP = [['pc', 'Gaming-PC', 2800, '🖥️'], ['monitor', '4K-Monitor 144 Hz', 900, '🖵'], ['chair', 'Gaming-Stuhl', 450, '🪑'], ['console', 'Konsole', 600, '🎮'], ['vr', 'VR-Brille', 1200, '🥽'], ['mic', 'Studio-Mikrofon', 380, '🎙️'], ['cam', 'Webcam 4K', 320, '📷'], ['light', 'RGB-Beleuchtung', 250, '💡'], ['desk', 'Höhenverstellbarer Tisch', 700, '🗄️']];
const SETUP_PTS = { pc: 4, monitor: 2, chair: 1, console: 2, vr: 2, mic: 1.5, cam: 1.5, light: 0.5, desk: 1 };
const LESSONS = { drive: ['Fahrstunde', 500], shoot: ['Schießtraining', 800], cook: ['Kochkurs', 600], it: ['Informatik-Kurs', 700], fit: ['Sportunterricht', 400] };
const VIDEOS = [['vlog', 'Vlog durch Vice City', 1, 0], ['game', 'Gaming-Stream', 1.4, 3], ['stunt', 'Stunt-Video', 1.8, 0], ['cook', 'Koch-Tutorial', 1.2, 0], ['review', 'Produkt-Review', 1.1, 0]];
const MILESTONES = [[1000, 'Silberner Play-Button', 5000], [10000, 'Goldener Play-Button', 40000], [100000, 'Diamant-Button', 400000], [1000000, 'Rubin-Button', 4000000], [10000000, 'Mega-Star', 40000000]];
const HOUSES = [['bungalow', 'Bungalow', 150000, 2, 0], ['stadthaus', 'Stadthaus', 400000, 4, 0], ['villa', 'Luxus-Villa', 1500000, 8, 0], ['mansion', 'Mega-Mansion mit Hangar', 6000000, 16, 0], ['eco', 'Öko-Haus (Solar)', 800000, 4, 2500]];
const BUILDERS = [['cheap', 'Pfusch & Söhne', 0.8, 3, 'Günstig, dauert 3 Tage'], ['std', 'Hoch & Tief Bau AG', 1, 1, 'Standard, dauert 1 Tag'], ['express', 'Express-Fertighaus', 1.5, 0, 'Sofort fertig, 50 % Aufpreis']];
export const PLOTS = Array.from({ length: 6 }, (_, k) => ({ id: 'plot' + k, x: 2250 + k * 38, z: 365 }));
const UPGRADES = [['ug_garage', 'Tiefgarage', 120000, '+6 Stellplätze', { slots: 6 }], ['ug_hangar', 'Hangar-Anbau', 400000, '+4 Stellplätze für Flugzeuge', { slots: 4 }], ['ug_pool', 'Pool & Spa', 60000, 'Prestige & Regeneration', { income: 300 }], ['ug_cinema', 'Heimkino', 90000, '+500 $/Tag Prestige', { income: 500 }], ['ug_gaming', 'Gaming-Zimmer', 80000, 'Gaming-Setup +50 % Einnahmen', {}], ['ug_solar', 'Solaranlage', 70000, '+800 $/Tag', { income: 800 }], ['ug_wine', 'Weinkeller', 150000, '+1500 $/Tag', { income: 1500 }]];

// ---------- kleine Helfer ----------
const P_ = () => G.player;
function inv(k, n = 1) { const P = P_(); P.inv[k] = (P.inv[k] || 0) + n; }
function fridge(k, n = 1) { G.life.state.fridge[k] = (G.life.state.fridge[k] || 0) + n; }
function furn(k) { if (G.life.state.furn[k]) return false; G.life.state.furn[k] = 1; }
function perk(k) { if (G.life.state.perks[k]) return false; G.life.state.perks[k] = 1; }
const row = (t, d, price, label, fn, disabled = false, extra = null) => h('div', { class: 'row' + (disabled ? ' locked' : '') }, h('div', { class: 'grow' }, h('div', { class: 't' }, t), d ? h('div', { class: 'd' }, d) : null), price != null ? h('div', { class: 'price' }, price === 0 ? 'Gratis' : fmtMoney(price)) : null, extra, label ? h('button', { class: 'btn small', onClick: fn, disabled }, label) : null);
const pay = (n, why = 'Einkauf') => { const P = P_(); if (P.money < n) { G.ui.toast('Nicht genug Geld!'); return false; } P.addMoney(-n, why); G.audio?.cash?.(); return true; };
const dayNow = () => G.day || 1;

export class Life {
  constructor() {
    this.state = this.fresh(); this.hud = null; this.skiRace = null; this.houses = [];
    G.destinations = DEST; G.travel = { go: (d) => this.go(typeof d === 'string' ? DEST.find((x) => x.id === d) : d) };
  }
  fresh() { return { granted: {}, phone: 0, wifi: 0, setup: {}, furn: {}, fridge: {}, perks: {}, ug: {}, yt: { subs: 0, views: 0, videos: 0, earned: 0, cd: 0, ms: {}, daily: 0 }, biz: {}, builds: [], secrets: {}, flea: { day: 0, sold: {} }, safe: 0, skiBest: 0, photos: {}, lessons: {}, gym: 0, members: false, br: 0, trips: 0 }; }
  serialize() { return JSON.parse(JSON.stringify({ ...this.state, skills: G.player.skills, maxHealth: G.player.maxHealth })); }
  deserialize(d) {
    this.state = { ...this.fresh(), ...(d || {}) }; const s = this.state;
    for (const k of ['setup', 'furn', 'fridge', 'perks', 'ug', 'granted', 'secrets', 'photos', 'lessons', 'biz']) s[k] = s[k] || {};
    s.yt = { ...this.fresh().yt, ...(s.yt || {}) }; s.builds = s.builds || [];
    if (d?.skills) G.player.skills = { drive: 0, shoot: 0, cook: 0, it: 0, fit: 0, ...d.skills };
    if (d?.maxHealth) G.player.maxHealth = d.maxHealth;
    this.refreshHouses(); this.world?.refreshSecrets?.();
    if (G.admin) G.eco.packs.avocado = true; this.unlockPackItems();
  }
  reset() { this.state = this.fresh(); this.refreshHouses(); }

  // ---------- Boni ----------
  wifiMul() { return 1 + [0, 0.1, 0.3, 0.7][this.state.wifi] || 1; }
  phoneMul() { return 1 + [0, 0.25, 0.6][this.state.phone]; }
  setupPts() { let s = 0; for (const k of Object.keys(this.state.setup)) s += SETUP_PTS[k] || 0; return s; }
  gamingMul() { const g = this.hasUg('ug_gaming') ? 1.5 : 1; return (1 + this.setupPts() * 0.12) * g; }
  hasUg(id) { return Object.values(this.state.ug).some((u) => u && u[id]); }
  ugSlots(pid) { const u = this.state.ug[pid]; if (!u) return 0; let s = 0; for (const [id, , , , o] of UPGRADES) if (u[id]) s += o.slots || 0; return s; }
  ugIncome(pid) { const u = this.state.ug[pid]; if (!u) return 0; let s = 0; for (const [id, , , , o] of UPGRADES) if (u[id]) s += o.income || 0; if (this.state.perks.solar) s += 400; return s; }
  skill(k) { return G.player.skills?.[k] || 0; }

  // ---------- Öffnen ----------
  open(ui, poi) {
    const k = poi.shop || poi.kind;
    switch (k) {
      case 'supermarket': case 'pharmacy': case 'furniture': case 'hardware': case 'tattoo': case 'pets': { const [name, items] = GOODS[k]; this.goods(ui, poi.name || name, items); return true; }
      case 'electronics': case 'phone': this.electronics(ui, poi); return true;
      case 'gaming': this.gaming(ui, poi); return true;
      case 'gym': this.gym(ui, poi); return true;
      case 'workout': G.prison?.active ? G.prison.workout() : this.gym(ui, poi); return true;
      case 'cinema': this.cinema(ui, poi); return true;
      case 'school': this.school(ui, poi); return true;
      case 'flea': this.flea(ui, poi); return true;
      case 'travel': this.travel(ui, poi); return true;
      case 'builder': this.builder(ui, poi); return true;
      case 'mcd': this.restaurant(ui, poi, 'mcd'); return true;
      case 'yt': this.youtube(ui); return true;
      case 'mall': this.mall(ui, poi); return true;
      case 'lift': this.world?.lift(poi); return true;
      case 'skirent': this.world?.skiRent(ui, poi); return true;
      case 'skirace': this.world?.skiRaceStart(); return true;
      case 'safari': this.world?.safari(ui, poi); return true;
      case 'secret': this.world?.secret(ui, poi); return true;
      case 'portal': this.world?.backrooms.enter(); return true;
      case 'house': this.houseMenu(ui, poi); return true;
      case 'plot': this.plotMenu(ui, poi); return true;
      default: return false;
    }
  }
  goods(ui, title, items) {
    const body = h('div', { class: 'body' });
    const render = () => body.replaceChildren(...items.map(([n, p, d, fn]) => { const dis = (n.startsWith('Kleiderschrank') && this.state.furn.wardrobe) || (n.startsWith('Kühlschrank') && this.state.furn.fridge) || (n.startsWith('Waffen') && this.state.furn.safe) || (n.startsWith('Bett') && this.state.furn.bed) || (n.startsWith('Sofa') && this.state.furn.tv) || (n.startsWith('Aquarium') && this.state.furn.aquarium) || (n.startsWith('Bauplan') && this.state.perks.plan) || (n.startsWith('Alarm') && this.state.perks.alarm) || (n.startsWith('Solar') && this.state.perks.solar) || (n.includes('Tattoo') && false) || (/Hund|Katze|Papagei/.test(n) && this.state.perks[n.includes('Hund') ? 'dog' : n.includes('Katze') ? 'cat' : 'parrot']) || (n.startsWith('Drachen') && this.state.perks.dragon) || (n.startsWith('Anker') && this.state.perks.anchor) || (n.startsWith('Tribal') && this.state.perks.tribal); return row(n, d, p, dis ? 'Besitzt du' : 'Kaufen', () => { if (P_().money < p) return ui.toast('Nicht genug Geld!'); if (fn() === false) return ui.toast('Nicht möglich / schon vorhanden.'); pay(p); render(); }, !!dis); }));
    render(); ui.modal(title, body);
  }
  electronics(ui, poi) {
    const body = h('div', { class: 'body' }); const S = this.state;
    const render = () => body.replaceChildren(
      h('h3', {}, '📱 Smartphones'), ...PHONES.map(([n, p, t, d]) => row(n, d, p, S.phone >= t ? 'Besitzt du' : 'Kaufen', () => { if (pay(p)) { S.phone = t; render(); ui.toast('Neues Handy – YouTube-Kamera verbessert!'); } }, S.phone >= t)),
      h('h3', {}, '📶 WLAN & Internet'), ...ROUTERS.map(([n, p, t, d]) => row(n, d, p, S.wifi >= t ? 'Besitzt du' : S.wifi === t - 1 ? 'Kaufen' : 'Vorher Stufe ' + (t - 1), () => { if (pay(p)) { S.wifi = t; render(); } }, S.wifi >= t || S.wifi !== t - 1)),
      h('h3', {}, 'Zubehör'), row('Taschenlampe', 'Für Höhlen', 25, 'Kaufen', () => { if (pay(25)) { inv('torch', 1); render(); } }), row('Powerbank', 'Handy-Taxi 20 % billiger', 120, S.perks.power ? 'Besitzt du' : 'Kaufen', () => { if (pay(120)) { S.perks.power = 1; render(); } }, !!S.perks.power));
    render(); ui.modal(poi.name || 'ElektroWelt', body);
  }
  gaming(ui, poi) {
    const body = h('div', { class: 'body' }); const S = this.state;
    const render = () => {
      body.replaceChildren(h('p', { class: 'd' }, `Dein Setup: ${this.setupPts().toFixed(1)} Punkte → Gaming-Bonus ×${this.gamingMul().toFixed(2)}`),
        h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3,1fr)' } }, ...SETUP.map(([k, n, p, ic]) => h('div', { class: 'card' + (S.setup[k] ? ' sel' : ''), style: { padding: '10px', textAlign: 'center', border: '1px solid ' + (S.setup[k] ? '#69f0ae' : '#334') } }, h('div', { style: { fontSize: '34px' } }, ic), h('div', { class: 't' }, n), S.setup[k] ? h('div', { class: 'd' }, '✔ aufgebaut') : h('button', { class: 'btn small', onClick: () => { if (pay(p)) { S.setup[k] = 1; render(); ui.toast(n + ' aufgebaut!'); } } }, fmtMoney(p))))));
    };
    render(); ui.modal(poi.name || "Gamer's Paradise", body);
  }
  gym(ui, poi) {
    const S = this.state, P = P_(); const body = h('div', { class: 'body' });
    const render = () => body.replaceChildren(
      h('p', { class: 'd' }, `Fitness-Stufe ${(P.skills.fit || 0).toFixed(1)} / 5 · Max. Leben ${P.maxHealth}`),
      row('Jahres-Mitgliedschaft', 'Training ohne Tageskarte', 400, S.members ? 'Aktiv' : 'Kaufen', () => { if (pay(400)) { S.members = true; render(); } }, S.members),
      row('Trainieren (1 Std.)', S.members ? 'Kostenlos' : 'Tageskarte $25', S.members ? 0 : 25, 'Trainieren', () => { if (!S.members && !pay(25)) return; if (S.gym > G.time - 20) return ui.toast('Du bist noch erschöpft…'); S.gym = G.time; G.env.time = (G.env.time + 1) % 24; P.skills.fit = Math.min(5, (P.skills.fit || 0) + 0.25); P.maxHealth = Math.max(P.maxHealth, 100 + Math.floor(P.skills.fit * 10)); P.hunger = Math.max(0, P.hunger - 6); ui.toast(`Training! Fitness ${P.skills.fit.toFixed(2)}`); render(); }),
      row('Personal Trainer (Intensiv)', '+1 Fitnessstufe sofort', 2500, 'Buchen', () => { if ((P.skills.fit || 0) >= 5) return ui.toast('Maximale Fitness!'); if (pay(2500)) { P.skills.fit = Math.min(5, Math.floor(P.skills.fit || 0) + 1); P.maxHealth = Math.max(P.maxHealth, 100 + P.skills.fit * 10); render(); } }));
    render(); ui.modal(poi.name || 'Fitnessstudio', body);
  }
  cinema(ui, poi) {
    const P = P_(); const films = ['Neon Nights', 'Der letzte Pilot', 'Wüstenlauf 3', 'Liebe auf Palmen', 'Cyber Samurai'];
    ui.modal(poi.name || 'Vice Kino', h('div', { class: 'body' }, ...films.map((f) => row(f, 'Film (2 Std.) + Popcorn', 18, 'Ansehen', () => { if (!pay(18)) return; ui.closeModal(); ui.fadeTo?.(1, 400); setTimeout(() => { G.env.time = (G.env.time + 2) % 24; P.health = Math.min(P.maxHealth, P.health + 25); P.hunger = Math.min(100, P.hunger + 12); ui.fadeTo?.(0, 700); ui.toast('Toller Film! +Gesundheit'); }, 500); }))));
  }
  school(ui, poi) {
    const P = P_(), S = this.state; const body = h('div', { class: 'body' });
    const render = () => body.replaceChildren(h('p', { class: 'd' }, 'Jeder Kurs dauert 1 Stunde. Bis Stufe 5 – teurer mit jeder Stufe.'), ...Object.entries(LESSONS).map(([k, [n, base]]) => { const lv = Math.floor(P.skills[k] || 0), cost = base * (lv + 1); return row(`${SKILLS[k][0]}: Stufe ${lv}/5`, SKILLS[k][1], lv >= 5 ? null : cost, lv >= 5 ? 'Max' : n, () => { if (lv >= 5) return; if (!pay(cost, 'Schule')) return; P.skills[k] = lv + 1; G.env.time = (G.env.time + 1) % 24; if (k === 'fit') P.maxHealth = Math.max(P.maxHealth, 100 + (lv + 1) * 10); ui.toast(`${SKILLS[k][0]} auf Stufe ${lv + 1}!`); render(); }, lv >= 5); }));
    render(); ui.modal(poi.name || 'Schule & Fahrschule', body);
  }
  // ---------- Flohmarkt ----------
  flea(ui, poi) {
    const P = P_(), S = this.state; const d = dayNow();
    if (S.flea.day !== d) { S.flea = { day: d, sold: {} }; }
    const rnd = (n) => { const x = Math.sin((d * 97 + n * 31) * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const used = CATALOG.filter((c) => c.buyable && (c.kind === 'car' || c.kind === 'bike') && c.price < 120000 && !c.pack);
    const body = h('div', { class: 'body' });
    const render = () => {
      const rows = [];
      for (let k = 0; k < 4; k++) { const spec = used[Math.floor(rnd(k) * used.length)]; const price = Math.round(spec.price * (0.3 + rnd(k + 9) * 0.25) / 50) * 50; const key = 'car' + k; rows.push(row(`🚗 Gebrauchtwagen: ${spec.name}`, `${spec.label} · ${(rnd(k + 3) * 150000 + 20000) | 0} km · ${Math.round(price / spec.price * 100)} % vom Neupreis`, price, S.flea.sold[key] ? 'Verkauft' : 'Kaufen', () => { if (!pay(price, 'Flohmarkt')) return; S.flea.sold[key] = 1; this.giveVehicle(spec); render(); }, !!S.flea.sold[key])); }
      const boxes = [['Kleine Überraschungskiste', 300], ['Mittlere Überraschungskiste', 2000], ['Große Schatzkiste', 12000]];
      boxes.forEach(([n, p], q) => rows.push(row('📦 ' + n, 'Zufälliger Inhalt: Geld, Munition, Kleidung, Waffen …', p, 'Öffnen', () => { if (!pay(p)) return; this.lootBox(q); })));
      rows.push(row('🔫 Munition (Restposten)', 'Alle Waffen +30 Schuss', 250, 'Kaufen', () => { if (!pay(250)) return; for (const [k, e] of Object.entries(P.weapons)) if (e.owned && !WEAPONS[k].melee) e.ammo = (e.ammo || 0) + 30; ui.toast('Munition aufgefüllt'); }));
      rows.push(row('👟 Vintage-Sneaker', 'Sonderpreis – Schuhe', 300, P.owned.shoes.includes(3) ? 'Besitzt du' : 'Kaufen', () => { if (pay(300)) { P.owned.shoes.push(3); P.owned.shoes = [...new Set(P.owned.shoes)]; render(); } }, P.owned.shoes.includes(3)));
      body.replaceChildren(h('p', { class: 'd' }, `Tagesangebote (Tag ${d}) – täglich neu!`), ...rows);
    };
    render(); ui.modal(poi.name || 'Flohmarkt', body);
  }
  lootBox(tier) {
    const P = P_(), luck = this.state.perks.cat ? 1.3 : 1, r = Math.random() * luck;
    const money = [150, 1200, 9000][tier] * (0.3 + Math.random() * 2.2);
    if (r < 0.5) { P.addMoney(Math.round(money), 'Fund'); G.ui.toast(`Du findest ${fmtMoney(Math.round(money))}!`); }
    else if (r < 0.75) { for (const e of Object.values(P.weapons)) if (e.owned) e.ammo = (e.ammo || 0) + 20 * (tier + 1); G.ui.toast('Munition für alle Waffen!'); }
    else if (r < 0.9) { inv('medkit', 1 + tier); inv('armorkit', tier); G.ui.toast('Verbandskästen & Westen!'); }
    else { const list = Object.keys(WEAPONS).filter((k) => WEAPONS[k].pack && !G.player.weapons[k]?.owned && G.eco.packs[WEAPONS[k].pack]); const w = list[Math.floor(Math.random() * list.length)]; if (w) { P.addWeapon(w, 60); G.ui.toast(`Seltener Fund: ${WEAPONS[w].name}!`); } else { P.addMoney(Math.round(money * 3), 'Fund'); G.ui.toast('Jackpot!'); } }
    G.audio?.pickup?.();
  }
  // ---------- Reisen ----------
  travel(ui, poi) {
    const body = h('div', { class: 'body' });
    body.append(h('p', { class: 'd' }, 'Flug buchen und losreisen. Rückreise jederzeit über Handy → Heimreise.'), ...DEST.map((d) => row(`${d.icon} ${d.name}`, d.desc, d.price, 'Buchen', () => { ui.closeModal(); this.go(d, true); })));
    ui.modal(poi.name || 'Reisebüro', body);
  }
  go(d, paid = false) {
    if (!d) return;
    const P = P_(), W = G.world;
    if (paid && !pay(d.price, 'Reise')) return;
    let x = d.x, z = d.z;
    if (d.island) { const I = G.world.islandPos?.(d.island); if (I) { x = I.x; z = I.z; } else return G.ui.toast('Ziel nicht gefunden'); }
    if (G.prison?.active) return G.ui.toast('Im Gefängnis kannst du nicht reisen.');
    G.ui.fadeTo?.(1, 500);
    setTimeout(() => { if (P.vehicle) P.exitVehicle(true); P.teleport(x, z); P.rig.snap?.(P); G.env.time = (G.env.time + 3) % 24; this.state.trips++; G.ui.fadeTo?.(0, 900); G.ui.toast(`Willkommen: ${d.name}!`); G.eco?.autosave?.(); }, 650);
  }
  // ---------- Mall ----------
  mall(ui, poi) {
    const body = h('div', { class: 'body' }); body.append(h('p', { class: 'd' }, 'Die Galleria vereint viele Geschäfte unter einem Dach.'));
    const items = [['👕 Mode-Boutique', () => import('./shops.js').then((m) => m.openPOI(ui, { ...poi, kind: 'clothes', name: 'Galleria Mode' }))], ['📱 Elektronik', () => this.electronics(ui, { name: 'Galleria Elektronik' })], ['🎮 Gaming', () => this.gaming(ui, { name: 'Galleria Gaming' })], ['🛋️ Möbel', () => this.goods(ui, 'Galleria Möbel', GOODS.furniture[1])], ['💊 Drogerie', () => this.goods(ui, 'Galleria Drogerie', GOODS.pharmacy[1])], ['🍔 Food-Court', () => this.restaurant(ui, poi, 'mcd')], ['🎬 Kino', () => this.cinema(ui, { name: 'Galleria Kino' })], ['🖋️ Tattoo', () => this.goods(ui, 'Galleria Tattoo', GOODS.tattoo[1])], ['🐶 Tierhandlung', () => this.goods(ui, 'Galleria Tierhandlung', GOODS.pets[1])]];
    for (const [n, fn] of items) body.append(h('div', { class: 'row' }, h('div', { class: 'grow t' }, n), h('button', { class: 'btn small', onClick: fn }, 'Betreten')));
    ui.modal(poi.name || 'Vice Galleria', body);
  }
  // ---------- Restaurant: Essen + selber arbeiten ----------
  restaurant(ui, poi, kind) {
    const P = P_(), S = this.state; const body = h('div', { class: 'body' });
    const ids = MENUS.burger.concat(['hotdog', 'ice']);
    body.append(h('h3', {}, "Speisekarte"), ...ids.map((id) => { const [n, p, hp] = FOOD[id]; return row(n, `+${hp} Sättigung`, p, 'Essen', () => import('./shops.js').then((m) => m.eat(id))); }));
    body.append(h('h3', {}, 'Arbeiten'), row("Als Aushilfe arbeiten", 'Bediene Bestellungen im Minispiel – verdiene Geld!', null, 'Los!', () => { ui.closeModal(); this.serveGame(ui, 'mcd'); }));
    ui.modal(poi.name || "Mc Donny's", body);
  }
  serveGame(ui, biz, mult = 1) {
    const P = P_(); const ING = ['🍞', '🥬', '🧀', '🥩', '🍅', '🥤', '🍟'];
    const cook = this.skill('cook'); let t = 45, served = 0, wrong = 0, cur = [], prog = 0, over = false;
    const newOrder = () => { const n = 2 + Math.floor(Math.random() * 3); cur = Array.from({ length: n }, () => ING[Math.floor(Math.random() * ING.length)]); prog = 0; };
    const orderEl = h('div', { class: 'big', style: { fontSize: '34px', margin: '8px 0' } }), info = h('div', { class: 'd' }), btns = h('div', { class: 'sel' });
    const upd = () => { orderEl.textContent = cur.map((c, i) => (i < prog ? '✅' : c)).join(' '); info.textContent = `Zeit ${Math.ceil(t)} s · Serviert ${served} · Fehler ${wrong}`; };
    ING.forEach((e) => btns.append(h('button', { class: 'btn', style: { fontSize: '26px', padding: '10px 14px' }, onClick: () => { if (over) return; G.audio?.click?.(); if (cur[prog] === e) { prog++; if (prog >= cur.length) { served++; newOrder(); } } else { wrong++; t = Math.max(0, t - 2); } upd(); } }, e)));
    const body = h('div', { class: 'body', style: { textAlign: 'center' } }, h('p', {}, 'Tippe die Zutaten in der Reihenfolge der Bestellung!'), orderEl, info, btns);
    newOrder(); upd(); ui.modal('Küche: Bestellungen', body);
    const iv = setInterval(() => { if (G.mode !== 'play' && G.mode !== 'pause') { /* pausiert */ } t -= 0.25; upd(); if (t <= 0 || !document.body.contains(body)) { clearInterval(iv); over = true; const pay_ = Math.round(served * 35 * (1 + cook * 0.15) * mult); if (pay_ > 0) { P.addMoney(pay_, 'Job'); ui.toast(`Schicht vorbei: ${served} Bestellungen · +${fmtMoney(pay_)}`); } ui.closeModal?.(); } }, 250);
  }
  // ---------- YouTube ----------
  youtube(ui) {
    const S = this.state, Y = S.yt; const body = h('div', { class: 'body' });
    const hasPC = !!S.setup.pc || S.phone > 0 || true;
    const mul = () => this.phoneMul() * this.wifiMul() * (1 + this.skill('it') * 0.12) * this.gamingMul() * (S.setup.cam ? 1.2 : 1) * (S.setup.mic ? 1.1 : 1);
    const render = () => {
      body.replaceChildren(
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, `📺 Kanal „Avocado Channel“ – ${Y.subs.toLocaleString('de-DE')} Abonnenten`), h('div', { class: 'd' }, `${Y.videos} Videos · ${Y.views.toLocaleString('de-DE')} Aufrufe · verdient ${fmtMoney(Y.earned)}`)), h('div', { class: 'price' }, `Boost ×${mul().toFixed(2)}`)),
        h('p', { class: 'd' }, 'Boost durch Handy-Kamera, WLAN, Informatik-Skill, Gaming-Setup, Mikrofon & Webcam.'),
        h('h3', {}, 'Video aufnehmen'),
        ...VIDEOS.map(([id, n, f, need]) => row(n, need ? `Benötigt Setup ≥ ${need}` : 'Dauert 20 Sekunden', null, G.time < Y.cd ? 'Wartezeit' : 'Aufnehmen', () => this.recordVideo(ui, id, f, need, mul, render), G.time < Y.cd || this.setupPts() < need)),
        h('h3', {}, 'Meilensteine'), ...MILESTONES.map(([n, name, r]) => row(name, `${n.toLocaleString('de-DE')} Abonnenten`, null, Y.ms[n] ? '✔ erhalten' : Y.subs >= n ? 'Belohnung holen' : null, () => { Y.ms[n] = 1; P_().addMoney(r, 'Job'); ui.toast(`${name}! +${fmtMoney(r)}`); render(); }, !!Y.ms[n] || Y.subs < n)));
    };
    render(); ui.modal('YouTube-Studio', body);
  }
  recordVideo(ui, id, f, need, mul, render) {
    const S = this.state, Y = S.yt; Y.cd = G.time + 20;
    const g = G.ui.toast; ui.toast('🎥 Aufnahme läuft…');
    setTimeout(() => {
      const base = 120 + Y.subs * 0.35, rndv = 0.6 + Math.random() * 1.1, trend = Math.random() < 0.08 ? 8 : 1;
      const views = Math.round(base * f * rndv * mul() * trend);
      const subs = Math.round(views * (0.012 + Math.random() * 0.02) * (trend > 1 ? 2 : 1));
      const earn = Math.round(views * 0.03 * (1 + (Y.subs > 1000 ? 0.5 : 0)));
      Y.views += views; Y.subs += subs; Y.videos++; Y.earned += earn; P_().addMoney(earn, 'Job');
      ui.toast(`${trend > 1 ? '🔥 VIRAL! ' : ''}${views.toLocaleString('de-DE')} Aufrufe · +${subs} Abos · +${fmtMoney(earn)}`);
      if (document.body.contains(ui.modalEl)) render();
    }, 1500);
  }
  // ---------- Bauen ----------
  builder(ui, poi) {
    const S = this.state; const body = h('div', { class: 'body' });
    body.append(h('p', { class: 'd' }, 'Plane dein Traumhaus im Neubaugebiet „Palm Estates“ (Terra Mundi). Wähle Haustyp, Grundstück und Bauunternehmen.'));
    const disc = S.perks.plan ? 0.85 : 1; let house = HOUSES[1], builder = BUILDERS[1], plot = PLOTS.find((p) => !S.builds.some((b) => b.plot === p.id));
    const sum = h('div', { class: 'row' }); const render = () => {
      const cost = Math.round(house[2] * builder[2] * disc);
      sum.replaceChildren(h('div', { class: 'grow' }, h('div', { class: 't' }, `${house[1]} · ${builder[1]}`), h('div', { class: 'd' }, plot ? `Grundstück ${plot.id.replace('plot', '#')} · ${house[3]} Stellplätze · ${builder[4]}` : 'Alle Grundstücke belegt')), h('div', { class: 'price' }, fmtMoney(cost)), h('button', { class: 'btn small gold', disabled: !plot, onClick: () => { if (!plot || !pay(cost, 'Bau')) return; const b = { id: 'build_' + Date.now(), plot: plot.id, type: house[0], day: dayNow(), ready: dayNow() + builder[3] }; S.builds.push(b); if (builder[3] === 0) this.finishBuild(b); ui.toast(builder[3] === 0 ? 'Haus sofort fertiggestellt!' : `Baustelle gestartet – fertig an Tag ${b.ready}.`); this.refreshHouses(); ui.closeModal(); } }, 'Bauauftrag erteilen'));
    };
    body.append(h('h3', {}, 'Haustyp'), h('div', { class: 'sel' }, ...HOUSES.map((x) => h('span', { class: 'chip', onClick: (e) => { house = x; [...e.target.parentNode.children].forEach((c) => c.classList.remove('on')); e.target.classList.add('on'); render(); } }, `${x[1]} (${fmtMoney(x[2])})`))), h('h3', {}, 'Bauunternehmen'), h('div', { class: 'sel' }, ...BUILDERS.map((x) => h('span', { class: 'chip', onClick: (e) => { builder = x; [...e.target.parentNode.children].forEach((c) => c.classList.remove('on')); e.target.classList.add('on'); render(); } }, x[1]))), sum);
    render(); ui.modal(poi.name || 'Bauunternehmen', body);
  }
  finishBuild(b) { b.done = true; const hd = HOUSES.find((x) => x[0] === b.type); const id = b.id; const pl = PLOTS.find((p) => p.id === b.plot); if (!PROPERTIES.find((p) => p.id === id)) PROPERTIES.push({ id, name: `Eigenes ${hd[1]}`, price: 0, type: 'house', slots: hd[3], x: pl.x, z: pl.z + 18, desc: `Von dir gebautes ${hd[1]}.`, income: hd[4], built: true }); G.eco.props[id] = true; }
  refreshHouses() { this.world?.refreshHouses?.(); }
  houseMenu() {}
  plotMenu(ui, poi) { ui.toast('Dein Grundstück – beauftrage das Bauunternehmen!'); }
  // ---------- Zuhause (an eigenen Immobilien) ----------
  homeExtras(ui, p, body, render) {
    const S = this.state, P = P_(); const rows = [];
    if (S.furn.fridge) rows.push(row('🧊 Kühlschrank', `Fleisch ${S.fridge.meat || 0} · Gemüse ${S.fridge.veg || 0} · Getränke ${S.fridge.drink || 0}`, null, 'Kochen / Essen', () => {
      const f = S.fridge; if ((f.meat || 0) > 0 && (f.veg || 0) > 0) { f.meat--; f.veg--; const q = 1 + this.skill('cook') * 0.15; P.hunger = clamp(P.hunger + 60 * q, 0, 100); P.health = Math.min(P.maxHealth, P.health + 30 * q); P.buff.regen = 120; ui.toast('Hausmannskost! Lecker.'); } else if ((f.drink || 0) > 0) { f.drink--; P.hunger = clamp(P.hunger + 8, 0, 100); ui.toast('Erfrischend.'); } else ui.toast('Kühlschrank leer – kauf im Supermarkt ein!'); render(); }));
    if (S.furn.safe) rows.push(row('🔐 Tresor', `Inhalt: ${fmtMoney(S.safe)}`, null, null, null, false, h('div', {}, h('button', { class: 'btn small', onClick: () => { const n = Math.floor(P.money * 0.5); if (n > 0) { P.addMoney(-n); S.safe += n; render(); } } }, '50 % einlagern'), ' ', h('button', { class: 'btn small', onClick: () => { P.addMoney(S.safe); S.safe = 0; render(); } }, 'Alles abheben'))));
    if (S.furn.tv) rows.push(row('🛋️ Sofa & TV', 'Entspannen: +25 Leben', null, 'Entspannen', () => { P.health = Math.min(P.maxHealth, P.health + 25); G.env.time = (G.env.time + 1) % 24; ui.toast('Entspannt.'); }));
    if (Object.keys(S.setup).length) rows.push(row('🖥️ Gaming-Setup', `Setup ${this.setupPts().toFixed(1)} Pkt.`, null, 'Streamen / Zocken', () => { ui.closeModal(true); this.stream(ui); }));
    if (S.furn.wardrobe) rows.push(row('👔 Kleiderschrank', 'Outfit wechseln', null, 'Öffnen', () => { ui.closeModal(true); G.mode = 'play'; ui.openPause('character'); }));
    if (p.work) rows.push(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, '👨‍🍳 Selbst arbeiten'), h('div', { class: 'd' }, 'Schicht im eigenen Betrieb – Chef-Bonus ×1,5')), h('button', { class: 'btn small', onClick: () => { ui.closeModal(true); this.serveGame(ui, p.work, 1.5); } }, 'Schicht starten')));
    rows.push(h('h3', {}, 'Upgrades'), ...UPGRADES.map(([id, n, price, d]) => { const u = S.ug[p.id] || (S.ug[p.id] = {}); return row(n, d, price, u[id] ? '✔ gebaut' : 'Ausbauen', () => { if (!pay(price, 'Ausbau')) return; u[id] = 1; ui.toast(n + ' fertiggestellt!'); render(); }, !!u[id]); }));
    body.append(...rows);
  }
  stream(ui) {
    const S = this.state, P = P_(); const income = Math.round(120 * this.gamingMul() * this.wifiMul() * (1 + this.skill('it') * 0.12) * (1 + S.yt.subs / 4000));
    ui.modal('Gaming-Setup', h('div', { class: 'body' }, h('p', {}, `Dein Setup: ${this.setupPts().toFixed(1)} Punkte · WLAN-Stufe ${S.wifi}`), row('Live-Stream (1 Std.)', `ca. ${fmtMoney(income)}`, null, 'Streamen', () => { P.addMoney(income, 'Job'); G.env.time = (G.env.time + 1) % 24; P.hunger = Math.max(0, P.hunger - 8); S.yt.subs += Math.round(income / 40); ui.toast(`Stream beendet: +${fmtMoney(income)}`); }), row('Zocken zum Spaß', 'Entspannung: +10 Leben', null, 'Zocken', () => { P.health = Math.min(P.maxHealth, P.health + 10); G.env.time = (G.env.time + 1) % 24; ui.toast('GG!'); })));
  }
  // ---------- Handy-Apps ----------
  phoneApps(ui, c) {
    const S = this.state, P = P_();
    c.append(h('h3', {}, 'Apps'));
    const dest = (id) => DEST.find((d) => d.id === id);
    const apps = [
      ['📺 YouTube', 'Videos aufnehmen & Abos sammeln', () => this.youtube(ui)],
      ['📶 WLAN & Handy', `Handy-Stufe ${S.phone} · WLAN-Stufe ${S.wifi}`, () => ui.toast(`Handy ${['Basic', 'Pro', 'Ultra'][S.phone]} · WLAN ${['kein', 'Basic', 'Mesh', 'Glasfaser'][S.wifi]}`)],
      ['🧳 Heimreise (Vice City)', 'Zurück zum Flughafen – $300', () => { if (G.prison?.active) return ui.toast('Im Gefängnis nicht möglich.'); this.go(dest('home'), true); ui.closePause?.(); }],
      ['🍕 Lieferdienst', 'Bestelle Essen direkt zu dir (+20 %)', () => this.delivery(ui)],
      ['🏗️ Baustatus', S.builds.length ? S.builds.map((b) => `${b.type}: ${b.done ? 'fertig' : 'fertig an Tag ' + b.ready}`).join(' · ') : 'Keine Bauprojekte', () => {}],
      ['🎓 Fähigkeiten', Object.entries(SKILLS).map(([k, [n]]) => `${n} ${Math.floor(P.skills[k] || 0)}`).join(' · '), () => {}],
      ['🗝️ Geheimtipps', `${Object.keys(S.secrets).length} Verstecke gefunden – Tipp: Zeugen reden von Bunkern, Höhlen und einer flackernden Wand im Park.`, () => this.world?.hints(ui)],
    ];
    for (const [n, d, fn] of apps) c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, n), h('div', { class: 'd' }, d)), h('button', { class: 'btn small', onClick: fn }, 'Öffnen')));
  }
  delivery(ui) {
    const ids = ['burger', 'pizzaFull', 'sushiS', 'taco', 'coffee', 'cake'];
    ui.modal('Lieferdienst', h('div', { class: 'body' }, ...ids.map((id) => { const [n, p, hp] = FOOD[id]; const q = Math.round(p * 1.2); return row(n, `+${hp} Sättigung`, q, 'Bestellen', () => { if (!pay(q, 'Essen')) return; const P = P_(); setTimeout(() => { P.hunger = clamp(P.hunger + hp * 1.1, 0, 100); P.health = Math.min(P.maxHealth, P.health + hp * 0.5); ui.toast(`${n} wurde geliefert!`); }, this.state.phone >= 2 ? 3000 : 8000); ui.toast('Bestellung unterwegs…'); }); })));
  }
  giveVehicle(spec) { const eco = G.eco; eco.garage.push({ id: eco.nextId++, key: spec.key, color: spec.color, dmg: 0, health: 1000, inWorld: false }); G.ui.toast(`${spec.name} liegt in deiner Garage.`); }
  // ---------- Packs ----------
  grantPack(id) {
    const g = PACK_GRANTS[id], pk = PACKS[id]; if (!g || this.state.granted[id]) return;
    const P = P_(), eco = G.eco; this.state.granted[id] = 1;
    if (g.weapon) P.addWeapon(g.weapon, WEAPONS[g.weapon].ammoPack * 3);
    for (const name of [g.car, g.yacht, g.plane, ...(g.extra || [])]) { const spec = find(name); if (!spec) continue; if (eco.garage.some((e) => e.key === spec.key)) continue; eco.garage.push({ id: eco.nextId++, key: spec.key, color: spec.color, dmg: 0, health: 1000, inWorld: false }); }
    if (g.skin) { (P.packSkins = P.packSkins || {})[id] = g.skin; this.state.skins = this.state.skins || {}; this.state.skins[id] = g.skin; }
    G.ui?.toast(`🎁 ${pk.name}: Waffe, Auto, Yacht, Flugzeug & Skin in Garage/Inventar!`, 6000);
  }
  unlockPackItems() { for (const id of Object.keys(G.eco.packs)) if (G.eco.packs[id]) this.grantPack(id); }
  skinList() { return Object.entries(this.state.skins || {}).filter(([id]) => G.eco.packs[id]).map(([id, s]) => ({ id, ...s })); }
  wearSkin(s) { const P = P_(); P.outfit = { ...P.outfit, ...s.outfit }; P.refreshOutfit(); G.ui.toast(`Skin angelegt: ${s.name}`); }
  inventoryExtras(ui, c) {
    const P = P_(), S = this.state;
    const sk = this.skinList();
    if (sk.length) { c.append(h('h3', {}, 'Pack-Skins')); for (const s of sk) c.append(h('div', { class: 'row' }, h('div', { class: 'grow t' }, '🎽 ' + s.name), h('button', { class: 'btn small', onClick: () => this.wearSkin(s) }, 'Anziehen'))); }
    const items = [['torch', 'Taschenlampe'], ['toolbox', 'Werkzeugkiste']].filter(([k]) => P.inv[k] > 0);
    if (items.length) c.append(...items.map(([k, n]) => h('div', { class: 'row' }, h('div', { class: 'grow t' }, `${n} ×${P.inv[k]}`), h('div', { class: 'd' }, 'Wird für Verstecke benötigt'))));
    c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'Fähigkeiten'), h('div', { class: 'd' }, Object.entries(SKILLS).map(([k, [n]]) => `${n} ${(P.skills[k] || 0).toFixed(1)}`).join(' · ')))));
  }
  update(dt) {
    const P = P_(), S = this.state;
    // Fähigkeiten: Fahren / Fitness
    const pv = P.vehicle; if (pv && pv.vtop && pv.spec.kind === 'car') { const dk = Math.floor(this.skill('drive')); if (pv._dk !== dk) { pv.vtop *= (1 + dk * 0.03) / (1 + (pv._dk || 0) * 0.03); pv._dk = dk; } }
    P.maxHealth = Math.max(P.maxHealth || 100, 100);
    if (S.perks.dog && P.health < P.maxHealth && G.time - P.lastHurt > 8) P.health = Math.min(P.maxHealth, P.health + dt * 0.35);
    if (S.furn.aquarium && P.health < P.maxHealth && G.time - P.lastHurt > 10) P.health = Math.min(P.maxHealth, P.health + dt * 0.1);
    this.world?.update(dt);
    // Bauprojekte
    for (const b of S.builds) if (!b.done && dayNow() >= b.ready) { this.finishBuild(b); G.ui.toast('🏠 Dein Haus ist fertig! (Palm Estates, Terra Mundi)'); this.refreshHouses(); }
    // Einnahmen: Gebäude-Upgrades & Solar
    if (this._day !== G.day) { if (this._day !== undefined) { let extra = 0; for (const id of Object.keys(G.eco.props)) extra += this.ugIncome(id) + 0; if (extra > 0) { P.addMoney(extra, 'Einnahmen'); G.ui.toast(`Zusatzeinnahmen aus Upgrades: ${fmtMoney(extra)}`); } } this._day = G.day; }
  }
}
