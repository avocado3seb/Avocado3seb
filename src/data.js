import { EXTRA_PACKS, EXTRA_WEAPONS, SHOP_TYPES } from './packdefs.js';

// Statische Spielinhalte: Orte, Immobilien, Essen, Kleidung, Uhren, Packs …
// Koordinaten: Gitterindex (i,j) = Knoten (i*100, j*100); c = Ecke (ne/nw/se/sw)

export const SPECIALS = [
  { id: 'police', kind: 'police', name: 'Polizeipräsidium', i: 1, j: 0 },
  { id: 'hospital', kind: 'hospital', name: 'Vice Memorial Hospital', i: -3, j: 3 },
  { id: 'bank', kind: 'bank', name: 'Vice Federal Bank', i: 0, j: -1 },
  { id: 'casino', kind: 'casino', name: 'Golden Palms Casino', i: 9, j: 0 },
  { id: 'dealer', kind: 'dealer', name: 'Premium Deluxe Motorsport', i: 3, j: 2 },
  { id: 'spray', kind: 'spray', name: "Pay 'n' Spray", i: -1, j: 1 },
  { id: 'club', kind: 'club', name: 'Club Neon', i: 8, j: -2 },
  { id: 'mall', kind: 'mall', name: 'Vice Galleria', i: 5, j: -1 },
];

export const KIOSKS = [
  // Essen
  { id: 'burger', kind: 'food', menu: 'burger', name: 'Big Smash Burger', i: 2, j: 0, c: 'ne', color: 0xe53935 },
  { id: 'pizza', kind: 'food', menu: 'pizza', name: 'Pizza Napoli', i: -2, j: -2, c: 'sw', color: 0x2e7d32 },
  { id: 'tacos', kind: 'food', menu: 'tacos', name: 'El Fuego Tacos', i: 5, j: 2, c: 'nw', color: 0xff9800 },
  { id: 'sushi', kind: 'food', menu: 'sushi', name: 'Sakura Sushi', i: 3, j: -2, c: 'se', color: 0xd81b60 },
  { id: 'cafe1', kind: 'food', menu: 'cafe', name: 'Café Sol', i: 7, j: -1, c: 'ne', color: 0x6d4c41 },
  { id: 'gelato', kind: 'food', menu: 'icecream', name: 'Gelato Beach', i: 10, j: -1, c: 'se', color: 0xf48fb1 },
  { id: 'hotdog', kind: 'food', menu: 'hotdog', name: 'Dog Corner', i: -6, j: 2, c: 'ne', color: 0xfdd835 },
  { id: 'steak', kind: 'food', menu: 'fine', name: 'Prime Cut Steakhouse (Fine Dining)', i: 4, j: -3, c: 'nw', color: 0x212121 },
  { id: 'noodle', kind: 'food', menu: 'noodles', name: 'Wok Express', i: -9, j: -3, c: 'se', color: 0xc62828 },
  { id: 'seafood', kind: 'food', menu: 'fine', name: 'Marisco del Puerto', i: 3, j: 8, c: 'ne', color: 0x0277bd },
  { id: 'cafe2', kind: 'food', menu: 'cafe', name: 'Morning Brew', i: -4, j: 5, c: 'sw', color: 0x8d6e63 },
  { id: 'juice', kind: 'food', menu: 'juice', name: 'Juice Palms', i: 9, j: 3, c: 'nw', color: 0x7cb342 },
  { id: 'rooftop', kind: 'food', menu: 'fine', name: 'Skyline Rooftop Lounge', i: 1, j: -4, c: 'se', color: 0x6a1b9a },
  // Läden
  { id: 'clothes1', kind: 'clothes', name: 'Moda Vice', i: 1, j: 2, c: 'ne', color: 0x1e88e5 },
  { id: 'clothes2', kind: 'clothes', name: 'Urban Threads', i: -7, j: -1, c: 'se', color: 0x43a047 },
  { id: 'couture', kind: 'clothes', luxe: true, name: 'Haute Couture Vice (Designer)', i: -1, j: -3, c: 'ne', color: 0xd4af37 },
  { id: 'barber1', kind: 'barber', name: 'Vice Cuts Barber', i: 6, j: 0, c: 'sw', color: 0x8e24aa },
  { id: 'barber2', kind: 'barber', name: 'Salon Chic', i: -5, j: -3, c: 'nw', color: 0xec407a },
  { id: 'gun1', kind: 'guns', name: 'Ammu-Vice', i: -2, j: 5, c: 'ne', color: 0x455a64 },
  { id: 'gun2', kind: 'guns', name: 'Gunhaus', i: 9, j: -4, c: 'se', color: 0x37474f },
  { id: 'jewel', kind: 'jewel', name: 'Chrono Luxe Uhren & Schmuck', i: 2, j: -1, c: 'sw', color: 0xffd54f },
  { id: 'mini1', kind: 'store', name: '24/7 Mini Market', i: 0, j: 3, c: 'ne', color: 0x00acc1 },
  { id: 'mini2', kind: 'store', name: '24/7 Mini Market', i: 7, j: 5, c: 'sw', color: 0x00acc1 },
  { id: 'mini3', kind: 'store', name: '24/7 Mini Market', i: -10, j: 1, c: 'ne', color: 0x00acc1 },
  // Geldautomaten
  { id: 'atm1', kind: 'atm', name: 'Geldautomat', i: 4, j: 0, c: 'se', color: 0x00c853 },
  { id: 'atm2', kind: 'atm', name: 'Geldautomat', i: -1, j: 0, c: 'ne', color: 0x00c853 },
  { id: 'atm3', kind: 'atm', name: 'Geldautomat', i: 8, j: 1, c: 'sw', color: 0x00c853 },
  { id: 'atm4', kind: 'atm', name: 'Geldautomat', i: -8, j: 4, c: 'nw', color: 0x00c853 },
  // Tankstellen
  { id: 'fuel1', kind: 'fuel', name: 'Tankstelle (Reparatur & Tuning)', i: -5, j: 8, c: 'ne', color: 0xff7043 },
  { id: 'fuel2', kind: 'fuel', name: 'Tankstelle (Reparatur & Tuning)', i: 0, j: 9, c: 'nw', color: 0xff7043 },
  { id: 'tune', kind: 'tune', name: 'Turbo Garage Tuning', i: 6, j: 6, c: 'ne', color: 0xff1744 },
  // Jobs
  { id: 'taxi', kind: 'job', job: 'taxi', name: 'Vice Taxi Zentrale', i: -2, j: 2, c: 'se', color: 0xffc107 },
  { id: 'cargo', kind: 'job', job: 'delivery', name: 'Rapid Cargo Kurier', i: 4, j: 7, c: 'nw', color: 0x5c6bc0 },
  { id: 'vigil', kind: 'job', job: 'vigilante', name: 'Streifendienst (Bürgerwehr)', i: -6, j: 6, c: 'ne', color: 0x1976d2 },
  { id: 'race1', kind: 'raceStart', race: 0, name: 'Straßenrennen: Downtown Dash', i: 4, j: 4, c: 'sw', color: 0xff5722 },
  { id: 'race2', kind: 'raceStart', race: 1, name: 'Straßenrennen: Küstenhatz', i: 10, j: 5, c: 'ne', color: 0xff5722 },
];

// Immobilien (x,z absolut oder i,j,c)
export const PROPERTIES = [
  { id: 'garage_ind', name: 'Lagerhalle (Garage)', price: 30000, type: 'garage', slots: 6, i: 4, j: 9, c: 'ne', desc: 'Günstige Garage mit Platz für 6 Fahrzeuge.', income: 0 },
  { id: 'apt_beach', name: 'Strandapartment Ocean Drive', price: 45000, type: 'apartment', slots: 2, i: 9, j: 2, c: 'ne', desc: 'Kleines Apartment direkt am Strand.', income: 0 },
  { id: 'house_west', name: 'Reihenhaus Westside', price: 60000, type: 'house', slots: 3, i: -9, j: 1, c: 'se', desc: 'Ruhige Wohngegend, 3 Stellplätze.', income: 0 },
  { id: 'loft_harbor', name: 'Hafenloft', price: 85000, type: 'apartment', slots: 4, i: 5, j: 9, c: 'nw', desc: 'Industrieller Loft mit Blick auf den Hafen.', income: 0 },
  { id: 'penthouse', name: 'Skyline Penthouse', price: 450000, type: 'penthouse', slots: 8, i: 1, j: -2, c: 'nw', desc: 'Luxus-Penthouse im 60. Stock.', income: 0 },
  { id: 'villa_sunset', name: 'Villa Sunset', price: 950000, type: 'villa', slots: 10, i: 3, j: -9, c: 'se', desc: 'Moderne Villa mit Pool in Sunset Hills.', income: 0 },
  { id: 'hillcrest', name: 'Hillcrest Mansion', price: 2400000, type: 'villa', slots: 14, i: 7, j: -8, c: 'sw', desc: 'Herrschaftliche Villa mit Helipad.', income: 0 },
  { id: 'beach_villa', name: 'Strandvilla Palm Bay', price: 1200000, type: 'beach', slots: 8, i: 10, j: -3, c: 'se', desc: 'Direkt am Wasser, mit Privatsteg für Boote.', income: 0 },
  { id: 'club_neon', name: 'Club Neon (Nachtclub-Geschäft)', price: 1500000, type: 'business', slots: 4, i: 8, j: -2, c: 'ne', desc: 'Der heißeste Club der Stadt – bringt täglich Geld ein.', income: 22000, pack: 'nacht' },
  { id: 'carwash', name: 'Sunshine Car Wash (Geschäft)', price: 140000, type: 'business', slots: 2, i: -4, j: 3, c: 'se', desc: 'Kleines Geschäft mit stabilem Einkommen.', income: 3500 },
  { id: 'esmeralda', name: 'Villa Esmeralda (Privatinsel)', price: 6500000, type: 'island', slots: 16, island: 'esmeralda', dx: -30, dz: 20, desc: 'Eigene Insel mit Villa, Landebahn und Anleger.', income: 0, pack: 'insel' },
  { id: 'palmera', name: 'Palmera Inselresort', price: 9000000, type: 'island', slots: 16, island: 'palmera', dx: 0, dz: 0, desc: 'Luxus-Resort mit Strandbar und Bootssteg.', income: 38000, pack: 'insel' },
  { id: 'azul', name: 'Azul Private Estate', price: 14000000, type: 'island', slots: 20, island: 'azul', dx: 0, dz: 0, desc: 'Die exklusivste Privatinsel von Vice.', income: 0, pack: 'luxus' },
  { id: 'marina_club', name: 'Marina Yachtclub-Penthouse', price: 3000000, type: 'marina', slots: 10, x: 760, z: 880, desc: 'Penthouse mit eigener Yacht-Anlegestelle.', income: 15000, pack: 'yacht' },
  { id: 'hangar', name: 'Privathangar am Flughafen', price: 2000000, type: 'hangar', slots: 8, x: -900, z: 700, desc: 'Hangar für Flugzeuge und Helikopter.', income: 0, pack: 'flug' },
];

// Essen
export const FOOD = {
  burger: ['Smash Burger', 12, 25, 'burger'], fries: ['Pommes', 5, 10, 'fries'], soda: ['Cola', 3, 5, 'drink'],
  pizzaSlice: ['Pizzastück', 6, 15, 'pizza'], pizzaFull: ['Ganze Pizza', 22, 45, 'pizza'],
  taco: ['Tacos (3er)', 9, 22, 'taco'], burrito: ['Burrito', 11, 32, 'taco'],
  sushiS: ['Sushi-Set', 28, 40, 'sushi'], ramen: ['Ramen', 14, 30, 'noodle'], noodles: ['Wok-Nudeln', 10, 26, 'noodle'],
  coffee: ['Kaffee', 4, 3, 'drink', 'speed'], latte: ['Latte', 5, 4, 'drink', 'speed'], croissant: ['Croissant', 4, 10, 'bread'],
  ice: ['Eis (2 Kugeln)', 5, 8, 'ice'], hotdog: ['Hotdog', 5, 16, 'hotdog'], juice: ['Frischer Saft', 6, 8, 'drink', 'regen'], smoothie: ['Smoothie', 8, 10, 'drink', 'regen'],
  steak: ['Rib-Eye Steak', 85, 70, 'fine', 'satisfied'], lobster: ['Hummer Thermidor', 180, 85, 'fine', 'satisfied'], wagyu: ['Wagyu A5 (Luxus)', 420, 100, 'fine', 'vip'],
  champagne: ['Champagner', 500, 5, 'drink', 'drunk'], cocktail: ['Cocktail', 14, 4, 'drink', 'drunk'], cake: ['Torte', 9, 14, 'bread'],
};
export const MENUS = {
  burger: ['burger', 'fries', 'soda'], pizza: ['pizzaSlice', 'pizzaFull', 'soda'], tacos: ['taco', 'burrito', 'soda'],
  sushi: ['sushiS', 'ramen', 'juice'], cafe: ['coffee', 'latte', 'croissant', 'cake'], icecream: ['ice', 'smoothie'],
  hotdog: ['hotdog', 'fries', 'soda'], fine: ['steak', 'lobster', 'wagyu', 'champagne'], noodles: ['noodles', 'ramen', 'soda'], juice: ['juice', 'smoothie', 'cocktail'],
  store: ['burger', 'soda', 'croissant', 'coffee', 'ice'],
};

// Kleidung
export const HAIR = ['Kahl', 'Kurz', 'Seitenscheitel', 'Lockig', 'Irokese', 'Lang', 'Pferdeschwanz', 'Afro'];
export const HATS = [['Keine', 0], ['Baseballcap', 40], ['Beanie', 30], ['Fedora', 120], ['Strohhut', 60], ['Designer-Cap', 900]];
export const GLASSES = [['Keine', 0], ['Sonnenbrille', 60], ['Pilotenbrille', 180], ['Designer-Brille', 1500]];
export const TOPS = [['T-Shirt', 0, 'tee'], ['Hemd', 45, 'shirt'], ['Hawaiihemd', 80, 'hawaii'], ['Tank-Top', 25, 'tank'], ['Hoodie', 70, 'hoodie'], ['Lederjacke', 240, 'jacket'], ['Sakko', 380, 'blazer'], ['Smoking (Designer)', 4800, 'tux', 'luxus'], ['Pelzmantel (Designer)', 9500, 'coat', 'luxus'], ['Neon-Bomber (Nachtleben)', 1400, 'jacket', 'nacht'], ['Kapitänsjacke (Yacht)', 1100, 'blazer', 'yacht'], ['Pilotenjacke (Flug)', 900, 'jacket', 'flug'], ['Rennoverall (Rennsport)', 700, 'hoodie', 'renn']];
export const BOTTOMS = [['Jeans', 0, 'long'], ['Shorts', 20, 'short'], ['Chino', 55, 'long'], ['Anzughose', 150, 'long'], ['Cargo-Shorts', 35, 'short'], ['Designer-Hose', 1800, 'long', 'luxus']];
export const SHOES = [['Sneaker', 0], ['Stiefel', 90], ['Lederschuhe', 140], ['Designer-Sneaker', 1200]];
export const SKINS = [0xf1c9a5, 0xe0ac86, 0xc68642, 0x8d5524, 0x5c3a21, 0xffdbac];
export const PALETTE = [0xf5f5f5, 0x1b1b1f, 0x1e88e5, 0xe53935, 0x43a047, 0xfdd835, 0xff7043, 0x8e24aa, 0x00acc1, 0x6d4c41, 0x607d8b, 0xf48fb1, 0xd4af37, 0xb0bec5];
export const HAIRCOL = [0x15110e, 0x3b2a1e, 0x6b4a2b, 0xb98b4a, 0xe8d28c, 0xa0361e, 0xcfcfd4, 0x2a6fdb, 0xd81b60];

export const WATCHES = [
  { id: 'w0', name: 'Keine Uhr', price: 0, prestige: 0 },
  { id: 'w1', name: 'Chrono Basic', price: 200, prestige: 1 },
  { id: 'w2', name: 'Aqua Diver', price: 4500, prestige: 3 },
  { id: 'w3', name: 'Gold Aviator', price: 28000, prestige: 6 },
  { id: 'w4', name: 'Diamond Royale', price: 180000, prestige: 10, pack: 'luxus' },
  { id: 'w5', name: 'Tourbillon One', price: 750000, prestige: 15, pack: 'luxus' },
];
export const WEAPON_SKINS = [
  { id: 'default', name: 'Standard', price: 0, color: 0x2b2b2e },
  { id: 'chrome', name: 'Chrom', price: 1500, color: 0xcfd8dc },
  { id: 'gold', name: 'Gold-Edition', price: 12000, color: 0xd4af37, pack: 'luxus' },
  { id: 'neon', name: 'Neon-Pink', price: 6000, color: 0xff2bd6, pack: 'nacht' },
  { id: 'camo', name: 'Dschungel-Tarn', price: 2500, color: 0x4b5d3a },
  { id: 'carbon', name: 'Carbon Racing', price: 5000, color: 0x15161a, pack: 'renn' },
];

export const WEAPONS = {
  fist: { name: 'Fäuste', dmg: 14, rate: 2.2, range: 1.7, mag: 0, auto: false, melee: true },
  pistol: { name: 'Pistole', dmg: 24, rate: 4.5, range: 90, mag: 12, auto: false, spread: 0.012, price: 150, ammoPrice: 8, ammoPack: 24 },
  smg: { name: 'Maschinenpistole', dmg: 15, rate: 11, range: 70, mag: 30, auto: true, spread: 0.03, price: 600, ammoPrice: 20, ammoPack: 60 },
  shotgun: { name: 'Schrotflinte', dmg: 12, rate: 1.1, range: 35, mag: 6, auto: false, spread: 0.06, pellets: 8, price: 800, ammoPrice: 18, ammoPack: 18 },
  rifle: { name: 'Sturmgewehr', dmg: 28, rate: 9, range: 140, mag: 30, auto: true, spread: 0.015, price: 1800, ammoPrice: 30, ammoPack: 60 },
  grenade: { name: 'Granate', dmg: 120, rate: 0.7, range: 30, mag: 1, auto: false, throw: true, price: 120, ammoPrice: 100, ammoPack: 3 },
};

// Content-Packs
export const PACKS = {
  luxus: { name: 'Luxus-Pack', price: 2500000, color: '#d4af37', desc: 'Hypercars, Limousinen, Designer-Outfits, Luxusuhren, Gold-Waffenskins & die Azul Private Estate.', missions: ['lux1', 'lux2'] },
  insel: { name: 'Insel-Pack', price: 1800000, color: '#26c6da', desc: 'Privatinseln Esmeralda & Palmera, Jetskis, Strandbuggys, Tauchen, Schatzsuche & Inselpartys.', missions: ['isl1', 'isl2'] },
  flug: { name: 'Flugzeug-Pack', price: 2200000, color: '#90caf9', desc: 'Jets, Stuntflieger, Seeflugzeug, Helikopter, Privathangar & Flugschule mit Ringparcours.', missions: ['fly1', 'fly2'] },
  yacht: { name: 'Yacht-Pack', price: 2000000, color: '#4fc3f7', desc: 'Luxusyachten, Rennboote, Marina-Penthouse, VIP-Yachtpartys & Hochseefahrten.', missions: ['yac1', 'yac2'] },
  renn: { name: 'Rennsport-Pack', price: 1500000, color: '#ff5252', desc: 'Rennwagen, Rennserie, Zeitfahren, Carbon-Skins & Rennoverall.', missions: ['rac1', 'rac2'] },
  nacht: { name: 'Nachtleben-Pack', price: 1200000, color: '#e040fb', desc: 'Club Neon, Neon-Outfits, VIP-Events, DJ-Sets, Cocktails & Neon-Waffenskins.', missions: ['nit1', 'nit2'] },
};

export const VIP_EVENTS = [
  { id: 'yachtparty', name: 'VIP Yachtparty', pack: 'yacht', minPrestige: 8, fee: 5000, reward: 25000, x: 700, z: 930, desc: 'Triff 5 Gäste auf der Yacht.' },
  { id: 'clubnight', name: 'VIP Club Night', pack: 'nacht', minPrestige: 4, fee: 2000, reward: 14000, x: 850, z: -150, desc: 'Tanze und knüpfe Kontakte im Club Neon.' },
  { id: 'gala', name: 'Charity Gala', pack: 'luxus', minPrestige: 14, fee: 20000, reward: 90000, x: 50, z: -50, desc: 'Gala in der Federal Bank – Smoking Pflicht.' },
  { id: 'islandparty', name: 'Inselparty Esmeralda', pack: 'insel', minPrestige: 6, fee: 8000, reward: 38000, x: 1950, z: -500, desc: 'Private Party auf deiner Insel.' },
];

// ---------- Erweiterungen ----------
Object.assign(PACKS, EXTRA_PACKS);
Object.assign(WEAPONS, EXTRA_WEAPONS);

// freie Kioskecken deterministisch verteilen
(function extendCity() {
  const used = new Set(), blk = new Set();
  const cornerBlock = (i, j, c) => `${c.includes('e') ? i : i - 1},${c.includes('n') ? j - 1 : j}`;
  for (const s of SPECIALS) blk.add(`${s.i},${s.j}`);
  for (const k of [...KIOSKS, ...PROPERTIES]) if (k.i !== undefined) { used.add(`${k.i},${k.j},${k.c}`); blk.add(cornerBlock(k.i, k.j, k.c)); }
  const cand = [];
  for (let i = -9; i <= 9; i++) for (let j = -7; j <= 7; j++) for (const c of ['ne', 'nw', 'se', 'sw']) cand.push([i, j, c, ((i * 73856093) ^ (j * 19349663) ^ c.charCodeAt(0) * 83492791) >>> 0]);
  cand.sort((a, b) => a[3] - b[3]);
  const take = () => { for (const [i, j, c] of cand) { const bk = cornerBlock(i, j, c); if (used.has(`${i},${j},${c}`) || blk.has(bk)) continue; used.add(`${i},${j},${c}`); blk.add(bk); return { i, j, c }; } return null; };
  for (const [kind, name, color, n] of SHOP_TYPES) for (let q = 0; q < n; q++) {
    const pos = take(); if (!pos) break;
    const menu = kind === 'mcd' ? 'burger' : kind === 'restaurant' ? 'fine' : kind === 'bistro' ? 'cafe' : kind === 'bakery' ? 'cafe' : undefined;
    KIOSKS.push({ id: `${kind}${q + 1}`, kind: ['mcd', 'restaurant', 'bistro', 'bakery'].includes(kind) ? 'food' : kind, shop: kind, menu, name: n > 1 ? `${name}` : name, ...pos, color });
  }
  // Geschäfte zum Besitzen & selbst betreiben
  const biz = [
    ['mcd_biz', "Mc Donny's Franchise (selbst betreiben)", 400000, 6500, 'mcd', 'Dein eigenes Fast-Food-Restaurant – bediene Kunden selbst oder lass es laufen.'],
    ['resto_biz', 'Restaurant „Zur Goldenen Gabel“', 350000, 5200, 'restaurant', 'Gehobenes Restaurant. Koch-Minispiel und Tageseinnahmen.'],
    ['super_biz', 'Supermarkt-Kette Vice Fresh', 700000, 10000, null, 'Großer Supermarkt mit zuverlässigem Tageseinkommen.'],
    ['gamecafe_biz', 'Gaming-Café Lag-Frei', 250000, 3600, null, 'LAN-Café mit Highspeed-WLAN.'],
    ['fuel_biz', 'Tankstellen-Imperium', 950000, 14000, null, 'Drei Tankstellen in bester Lage.'],
    ['hotel_biz', 'Vice Grand Hotel', 3200000, 42000, null, 'Fünf-Sterne-Hotel am Ocean Drive.'],
    ['mall_biz', 'Einkaufszentrum-Anteile', 8000000, 120000, null, 'Beteiligung an der Vice Galleria.'],
  ];
  for (const [id, name, price, income, work, desc] of biz) { const pos = take(); if (pos) PROPERTIES.push({ id, name, price, type: 'business', slots: 2, ...pos, desc, income, work }); }
  const gar = take(); if (gar) PROPERTIES.push({ id: 'tiefgarage', name: 'Tiefgarage Downtown', price: 250000, type: 'garage', slots: 20, ...gar, desc: 'Riesige Tiefgarage mit 20 Stellplätzen.', income: 0 });
  PROPERTIES.push(
    { id: 'chalet_alps', name: 'Ski-Chalet Alpendorf', price: 1800000, type: 'house', slots: 4, x: -1500, z: -2030, desc: 'Gemütliches Chalet direkt an der Piste.', income: 0 },
    { id: 'terra_villa', name: 'Weltvilla Terra Mundi', price: 4500000, type: 'villa', slots: 10, x: 2560, z: 700, desc: 'Prachtvolle Villa auf der Weltreise-Insel.', income: 0 },
    { id: 'safari_house', name: 'Safari-Villa', price: 1200000, type: 'house', slots: 4, x: -1400, z: 2335, desc: 'Villa am Rand der Savanne.', income: 0 },
  );
})();
