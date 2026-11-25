// Fahrzeugkatalog: 130+ Typen, prozedural aus Klassen + Namen erzeugt
import { strHash, RNG } from './util.js';

// Klassen-Basiswerte: len/wid/hgt (m), mass (kg), top (km/h), t100 (s 0-100), grip (Reibung), price
export const CLASSES = {
  compact: { kind: 'car', body: 'hatch', len: 3.75, wid: 1.68, hgt: 1.47, wb: 2.4, mass: 1000, top: 165, t100: 11, grip: 1.05, price: 9000, tire: 0.29, label: 'Kleinwagen' },
  sedan: { kind: 'car', body: 'sedan', len: 4.75, wid: 1.84, hgt: 1.45, wb: 2.85, mass: 1450, top: 205, t100: 8.5, grip: 1.05, price: 24000, tire: 0.33, label: 'Limousine' },
  coupe: { kind: 'car', body: 'coupe', len: 4.5, wid: 1.82, hgt: 1.32, wb: 2.65, mass: 1380, top: 235, t100: 6.5, grip: 1.15, price: 52000, tire: 0.33, label: 'Coupé' },
  sport: { kind: 'car', body: 'wedge', len: 4.45, wid: 1.9, hgt: 1.2, wb: 2.6, mass: 1320, top: 285, t100: 4.4, grip: 1.3, price: 110000, tire: 0.34, label: 'Sportwagen' },
  super: { kind: 'car', body: 'wedge', len: 4.55, wid: 2.02, hgt: 1.12, wb: 2.7, mass: 1380, top: 345, t100: 2.9, grip: 1.45, price: 650000, tire: 0.35, label: 'Hypercar' },
  muscle: { kind: 'car', body: 'muscle', len: 5.0, wid: 1.9, hgt: 1.3, wb: 2.9, mass: 1650, top: 250, t100: 5.3, grip: 1.05, price: 68000, tire: 0.35, label: 'Muscle Car' },
  classic: { kind: 'car', body: 'classic', len: 5.2, wid: 1.9, hgt: 1.42, wb: 3.0, mass: 1650, top: 175, t100: 11, grip: 0.9, price: 38000, tire: 0.35, label: 'Oldtimer' },
  suv: { kind: 'car', body: 'suv', len: 4.8, wid: 1.95, hgt: 1.78, wb: 2.9, mass: 2100, top: 200, t100: 8, grip: 1.0, price: 55000, tire: 0.38, label: 'SUV' },
  offroad: { kind: 'car', body: 'jeep', len: 4.2, wid: 1.9, hgt: 1.95, wb: 2.6, mass: 1900, top: 150, t100: 11, grip: 1.05, price: 45000, tire: 0.45, label: 'Geländewagen' },
  pickup: { kind: 'car', body: 'pickup', len: 5.4, wid: 2.0, hgt: 1.85, wb: 3.3, mass: 2200, top: 185, t100: 9.5, grip: 1.0, price: 38000, tire: 0.4, label: 'Pickup' },
  van: { kind: 'car', body: 'van', len: 5.2, wid: 1.99, hgt: 2.2, wb: 3.2, mass: 2300, top: 160, t100: 13, grip: 0.95, price: 28000, tire: 0.36, label: 'Van' },
  truck: { kind: 'car', body: 'truck', len: 7.2, wid: 2.35, hgt: 3.1, wb: 4.2, mass: 5500, top: 120, t100: 19, grip: 0.9, price: 60000, tire: 0.5, label: 'Lkw' },
  bus: { kind: 'car', body: 'bus', len: 11.5, wid: 2.55, hgt: 3.2, wb: 6, mass: 11000, top: 105, t100: 25, grip: 0.85, price: 140000, tire: 0.5, label: 'Bus' },
  limo: { kind: 'car', body: 'limo', len: 7.4, wid: 1.95, hgt: 1.5, wb: 4.8, mass: 2600, top: 190, t100: 10, grip: 0.95, price: 180000, tire: 0.34, label: 'Limousine (Stretch)' },
  taxi: { kind: 'car', body: 'sedan', len: 4.8, wid: 1.85, hgt: 1.5, wb: 2.85, mass: 1500, top: 180, t100: 10, grip: 1.0, price: 22000, tire: 0.33, label: 'Taxi' },
  police: { kind: 'car', body: 'sedan', len: 4.85, wid: 1.88, hgt: 1.48, wb: 2.9, mass: 1700, top: 220, t100: 7, grip: 1.1, price: 0, tire: 0.34, label: 'Polizei' },
  emergency: { kind: 'car', body: 'van', len: 5.9, wid: 2.1, hgt: 2.5, wb: 3.6, mass: 3200, top: 150, t100: 12, grip: 0.95, price: 0, tire: 0.4, label: 'Einsatzfahrzeug' },
  army: { kind: 'car', body: 'jeep', len: 4.9, wid: 2.1, hgt: 2.0, wb: 3.0, mass: 2800, top: 130, t100: 13, grip: 1.05, price: 0, tire: 0.48, label: 'Militär' },
  moto: { kind: 'bike', body: 'bike', len: 2.1, wid: 0.8, hgt: 1.15, wb: 1.4, mass: 220, top: 200, t100: 3.6, grip: 1.25, price: 18000, tire: 0.32, label: 'Motorrad' },
  quad: { kind: 'bike', body: 'quad', len: 2.0, wid: 1.2, hgt: 1.2, wb: 1.3, mass: 350, top: 110, t100: 5, grip: 1.1, price: 12000, tire: 0.3, label: 'Quad' },
  boat: { kind: 'boat', body: 'boat', len: 7, wid: 2.4, hgt: 1.6, wb: 5, mass: 1500, top: 120, t100: 8, grip: 1, price: 60000, tire: 0, label: 'Boot' },
  plane: { kind: 'plane', body: 'plane', len: 8.3, wid: 11, hgt: 2.8, wb: 4, mass: 1100, top: 260, t100: 0, grip: 1, price: 250000, tire: 0.22, label: 'Flugzeug' },
  heli: { kind: 'heli', body: 'heli', len: 9, wid: 2.4, hgt: 3.3, wb: 4, mass: 1500, top: 250, t100: 0, grip: 1, price: 420000, tire: 0, label: 'Helikopter' },
};

// [Name, Klasse, Optionen]
const LIST = [
  ['Pico Town', 'compact'], ['Moxy Mini', 'compact'], ['Kuri Spark', 'compact'], ['Dino Zero', 'compact'], ['Fiora Piccolo', 'compact'], ['Nova City', 'compact'], ['Ribo Go', 'compact'], ['Tato Kei', 'compact'],
  ['Valor LX', 'sedan'], ['Cortina Ultra', 'sedan'], ['Savoy 300', 'sedan'], ['Meridian S', 'sedan'], ['Aurelia GT-Line', 'sedan'], ['Brava Eco', 'sedan'], ['Tessera', 'sedan'], ['Lumina 5', 'sedan'], ['Regent Prime', 'sedan'], ['Orion Sedan', 'sedan'],
  ['Ventura Coupé', 'coupe'], ['Corsa SC', 'coupe'], ['Halo RS', 'coupe'], ['Elan 2+2', 'coupe'], ['Vesper', 'coupe'], ['Mirage Cabrio', 'coupe', { pack: 'luxus', conv: true }],
  ['Nitro GTR', 'sport', { pack: 'renn' }], ['Falcon RS', 'sport'], ['Viper-X 380', 'sport'], ['Stratos Turbo', 'sport'], ['Kestrel S', 'sport'], ['Jaguaro F', 'sport'], ['Apex 911S', 'sport', { pack: 'renn' }], ['Torque RT', 'sport'], ['Bolide SP', 'sport', { pack: 'renn' }], ['Raptor Z', 'sport', { pack: 'renn' }],
  ['Phantom Aureus', 'super', { pack: 'luxus' }], ['Veloce Hyper', 'super', { pack: 'luxus' }], ['Titan LM1', 'super', { pack: 'luxus' }], ['Solaris One', 'super', { pack: 'luxus' }], ['Zenith X', 'super', { pack: 'luxus' }], ['Inferna Spyder', 'super', { pack: 'luxus', conv: true }], ['Quasar 900', 'super', { pack: 'luxus' }], ['Lumen Hypercar', 'super', { pack: 'luxus' }], ['Mach Zero', 'super', { pack: 'luxus' }], ['Eclipse R', 'super', { pack: 'luxus' }],
  ['Brawler V8', 'muscle'], ['Stallion GT', 'muscle'], ['Cobra Ridge', 'muscle'], ['Hellion 426', 'muscle'], ['Dominator', 'muscle'], ['Thunderbolt', 'muscle'], ['Bruiser SS', 'muscle'], ['Warlord GTX', 'muscle'],
  ['Duke 57', 'classic'], ['Capri Deluxe', 'classic'], ['Bel Mar', 'classic'], ['Skylark 62', 'classic'], ['Monterey', 'classic'], ['Eldorado Royale', 'classic', { pack: 'luxus', conv: true }], ['Neon Lowrider', 'classic', { pack: 'nacht', neon: true }],
  ['Highlander X', 'suv'], ['Terrano', 'suv'], ['Pathmaker', 'suv'], ['Sierra Estate', 'suv'], ['Cruzer 4x4', 'suv'], ['Atlas XL', 'suv'], ['Bastion', 'suv'], ['Grand Voyager', 'suv'],
  ['Dune Runner', 'offroad', { pack: 'insel' }], ['Rock Crawler', 'offroad'], ['Safari Ranger', 'offroad'], ['Mud King', 'offroad'], ['Bushmaster', 'offroad'],
  ['Ranger F', 'pickup'], ['Lone Star 1500', 'pickup'], ['Workhorse', 'pickup'], ['Ridgeback', 'pickup'], ['Tundra Max', 'pickup'], ['Hauler 250', 'pickup'],
  ['Transporter', 'van'], ['Courier V', 'van'], ['Minibus Vista', 'van'], ['Camper Dreamer', 'van'], ['Panel Van', 'van'],
  ['Box Hauler', 'truck'], ['Flatbed 7', 'truck'], ['Dump Titan', 'truck'], ['Garbage Master', 'truck'], ['Tanker Hauler', 'truck'], ['Semi Cab Volt', 'truck'],
  ['City Bus', 'bus'], ['Coach Premier', 'bus'], ['School Bus', 'bus'], ['Party Bus', 'bus', { pack: 'nacht', neon: true }],
  ['Stretch Royal', 'limo', { pack: 'luxus' }], ['Presidente Limo', 'limo', { pack: 'luxus' }],
  ['Vice Cab', 'taxi', { color: 0xffc107, taxi: true }], ['Checker Classic', 'taxi', { color: 0xffb300, taxi: true }],
  ['Patrol Cruiser', 'police', { cop: 1, color: 0xf2f2f2, npc: true }], ['Interceptor', 'police', { cop: 2, color: 0x1a1d24, npc: true }], ['Police SUV', 'police', { cop: 3, color: 0xf2f2f2, npc: true, body: 'suv' }], ['SWAT Enforcer', 'police', { cop: 4, color: 0x15181c, npc: true, body: 'van' }],
  ['Ambulance', 'emergency', { em: 'amb', color: 0xf5f5f5, npc: true }], ['Fire Engine', 'emergency', { em: 'fire', color: 0xd32f2f, npc: true, body: 'truck' }], ['Fire Chief SUV', 'emergency', { em: 'chief', color: 0xd32f2f, npc: true, body: 'suv' }],
  ['Army Jeep', 'army', { color: 0x4b5d3a, npc: true }], ['Army Truck', 'army', { color: 0x4b5d3a, npc: true, body: 'truck' }],
  ['Sprint 600', 'moto'], ['Cruiser 1200', 'moto', { style: 'cruiser' }], ['Scoot 50', 'moto', { style: 'scooter' }], ['Dirt X', 'moto', { style: 'dirt' }], ['Chopper Evil', 'moto', { style: 'cruiser' }], ['Police Bike', 'moto', { cop: 5, color: 0xf2f2f2, npc: true }], ['Hyper Bike R', 'moto', { pack: 'renn' }], ['Café Racer', 'moto', { style: 'cruiser' }], ['Trail Enduro', 'moto', { style: 'dirt' }], ['Glow Scooter', 'moto', { pack: 'nacht', style: 'scooter', neon: true }],
  ['Quad ATV', 'quad', { pack: 'insel' }], ['Beach Buggy Q', 'quad', { pack: 'insel' }],
  ['Jetski Splash', 'boat', { sub: 'jetski', pack: 'insel' }], ['Dinghy', 'boat', { sub: 'dinghy' }], ['Speedster 30', 'boat', { sub: 'speed' }], ['Marlin Fishing', 'boat', { sub: 'fish' }], ['Cruiser 45', 'boat', { sub: 'cruiser', pack: 'yacht' }], ['Racer Cigar', 'boat', { sub: 'cigar', pack: 'yacht' }], ['Yacht Serenity', 'boat', { sub: 'yacht', pack: 'yacht' }], ['Mega Yacht Opulence', 'boat', { sub: 'mega', pack: 'yacht' }], ['Sailing Breeze', 'boat', { sub: 'sail', pack: 'yacht' }],
  ['Skyhawk', 'plane', { sub: 'prop' }], ['Cargo Dash', 'plane', { sub: 'cargo' }], ['Lear Jet LJ', 'plane', { sub: 'jet', pack: 'flug' }], ['Stunt Falcon', 'plane', { sub: 'stunt', pack: 'flug' }], ['Seaplane Albatross', 'plane', { sub: 'sea', pack: 'flug' }], ['Bush Pilot', 'plane', { sub: 'prop' }],
  ['Ranger Heli', 'heli', { sub: 'light' }], ['Police Hawk', 'heli', { sub: 'police', cop: 6, npc: true }], ['News Chopper', 'heli', { sub: 'news', pack: 'flug' }], ['Sky Crane Military', 'heli', { sub: 'military', pack: 'flug' }],
];

const CAR_COLORS = [0xf5f5f5, 0x1b1b1f, 0x8a8f98, 0xb71c1c, 0x1565c0, 0x2e7d32, 0xf9a825, 0xe65100, 0x4e342e, 0x6a1b9a, 0x00838f, 0xc0c4c8, 0x0d47a1, 0xd81b60, 0x263238];
export const PALETTE_CARS = CAR_COLORS;

export const CATALOG = LIST.map(([name, cls, o = {}], idx) => {
  const C = CLASSES[cls];
  const r = new RNG(strHash(name));
  const v = (a, b) => r.range(a, b);
  const sc = 1;
  const spec = {
    id: idx, key: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name, cls, kind: C.kind, body: o.body || C.body, label: C.label, ...o,
    len: C.len * v(0.96, 1.05), wid: C.wid * v(0.97, 1.03), hgt: C.hgt * v(0.96, 1.04), wb: C.wb, mass: C.mass * v(0.92, 1.1),
    top: C.top * v(0.9, 1.1), t100: C.t100 * v(0.88, 1.12), grip: C.grip * v(0.95, 1.06), tire: C.tire,
    seed: strHash(name),
  };
  spec.wb = spec.len * (C.wb / C.len) * v(0.98, 1.02);
  // Preis
  spec.price = o.npc ? 0 : Math.round(C.price * v(0.7, 1.4) / 100) * 100;
  if (cls === 'super') spec.price = Math.round(C.price * v(0.7, 2.6) / 1000) * 1000;
  if (o.sub === 'mega') spec.price = 8500000; else if (o.sub === 'yacht') spec.price = 2400000; else if (o.sub === 'cruiser') spec.price = 480000; else if (o.sub === 'cigar') spec.price = 360000; else if (o.sub === 'sail') spec.price = 650000; else if (o.sub === 'jetski') spec.price = 18000; else if (o.sub === 'dinghy') spec.price = 8000; else if (o.sub === 'speed') spec.price = 95000; else if (o.sub === 'fish') spec.price = 70000;
  if (o.sub === 'jet') spec.price = 4800000; else if (o.sub === 'prop') spec.price = 180000; else if (o.sub === 'cargo') spec.price = 420000; else if (o.sub === 'stunt') spec.price = 650000; else if (o.sub === 'sea') spec.price = 900000;
  if (o.sub === 'light') spec.price = 480000; else if (o.sub === 'news') spec.price = 1200000; else if (o.sub === 'military') spec.price = 3200000;
  // Boote / Flugzeuge: Maße je Unterklasse
  const SUB = {
    jetski: { len: 3.0, wid: 1.2, hgt: 1.0, top: 110, mass: 400 }, dinghy: { len: 4.0, wid: 1.8, hgt: 0.8, top: 60, mass: 400 }, speed: { len: 7.5, wid: 2.5, hgt: 1.5, top: 130, mass: 1400 }, fish: { len: 8.5, wid: 2.9, hgt: 2.6, top: 75, mass: 2400 },
    cruiser: { len: 13, wid: 4, hgt: 3.6, top: 85, mass: 8000 }, cigar: { len: 10, wid: 2.3, hgt: 1.3, top: 190, mass: 2200 }, yacht: { len: 24, wid: 6, hgt: 6.5, top: 55, mass: 40000 }, mega: { len: 42, wid: 9, hgt: 10, top: 45, mass: 150000 }, sail: { len: 14, wid: 4, hgt: 3, top: 55, mass: 9000 },
    prop: { len: 8.3, wid: 11, hgt: 2.8, top: 260, mass: 1100 }, cargo: { len: 11, wid: 16, hgt: 3.6, top: 300, mass: 4500 }, jet: { len: 14, wid: 13, hgt: 4.2, top: 780, mass: 6500 }, stunt: { len: 6.5, wid: 7.8, hgt: 2.4, top: 330, mass: 800 }, sea: { len: 9.4, wid: 12.5, hgt: 3.6, top: 220, mass: 1500 },
    light: { len: 9, wid: 2.4, hgt: 3.3, top: 250, mass: 1400 }, police: { len: 10, wid: 2.4, hgt: 3.4, top: 270, mass: 1800 }, news: { len: 10, wid: 2.5, hgt: 3.4, top: 260, mass: 1900 }, military: { len: 14, wid: 3, hgt: 4.2, top: 300, mass: 5500 },
  };
  if (o.sub && SUB[o.sub]) Object.assign(spec, SUB[o.sub], { wb: SUB[o.sub].len * 0.6 });
  if (cls === 'moto' && o.style === 'scooter') { spec.top = 80; spec.mass = 120; spec.len = 1.8; }
  if (cls === 'moto' && o.style === 'dirt') { spec.top = 125; spec.len = 2.1; }
  spec.color = o.color ?? CAR_COLORS[r.int(0, CAR_COLORS.length - 1)];
  if (cls === 'super' || cls === 'sport') spec.color = [0xd50000, 0xffd600, 0x0d47a1, 0xf5f5f5, 0x1b1b1f, 0xff6d00, 0x00c853, 0x7c4dff][r.int(0, 7)];
  spec.topMS = spec.top / 3.6;
  spec.hp = Math.round(spec.mass * 27.8 * 27.8 / Math.max(2.2, spec.t100 || 10) / 745.7);
  spec.traffic = !o.pack && !o.npc && ['compact', 'sedan', 'coupe', 'suv', 'pickup', 'van', 'muscle', 'classic', 'truck', 'bus', 'taxi', 'moto', 'sport'].includes(cls) && !/School|Garbage|Dump|Tanker|Semi/.test(name) || /Garbage|School/.test(name);
  spec.buyable = !o.npc && spec.price > 0;
  return spec;
});
export const byKey = new Map(CATALOG.map((c) => [c.key, c]));
export const byClass = (cls) => CATALOG.filter((c) => c.cls === cls);
export const TRAFFIC_MODELS = CATALOG.filter((c) => c.traffic && !(c.cls === 'sport' && c.price > 150000));
export const find = (name) => CATALOG.find((c) => c.name === name);
