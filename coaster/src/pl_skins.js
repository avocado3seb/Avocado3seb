// ============================================================================
//  pl_skins.js – Skin-Shop: kaufbare Komplett-Skins (Themen-Outfits mit Zubehör), Einzelteile und Preise.
//  Hinweis: Skin-Namen, Beschreibungen und Preise sind frei erfunden (Spielgeld), keine echten Parkangaben.
//  Die Kleidungsteile (Indizes) stammen aus dem Vice-City-Charaktersystem (/src/data.js, /src/character.js).
// ============================================================================
import { HAIR, HATS, GLASSES, TOPS, BOTTOMS, SHOES, SKINS as SKIN_TONES, PALETTE, HAIRCOL } from '../../src/data.js';
import { DEFAULT_OUTFIT, EXTRAS } from './pl_char.js';

export { HAIR, SKIN_TONES, PALETTE, HAIRCOL };
const O = o => ({ ...DEFAULT_OUTFIT, ...o });

// Preise in € (Spielgeld) je Teil-Index; 0 = frei verfügbar
export const PART_PRICE = {
  top: { 0: 0, 1: 0, 2: 15, 3: 0, 4: 20, 5: 60, 6: 80, 7: 220, 8: 260, 9: 110, 10: 95, 11: 85, 12: 70 },
  bottom: { 0: 0, 1: 0, 2: 15, 3: 45, 4: 12, 5: 140 },
  shoe: { 0: 0, 1: 25, 2: 35, 3: 90 },
  hat: { 0: 0, 1: 10, 2: 10, 3: 35, 4: 15, 5: 70 },
  glasses: { 0: 0, 1: 15, 2: 40, 3: 90 },
  watch: { 0: 0, 1: 15, 2: 60, 3: 150, 4: 400, 5: 900 },
};
export const WATCH_NAMES = ['Keine Uhr', 'Basis-Uhr', 'Taucheruhr', 'Goldene Fliegeruhr', 'Diamant-Uhr', 'Luxus-Chronograph'];
export const EXTRA_PRICE = { cape: 60, helmet: 80, crown: 150, goggles: 35, scarf: 20, backpack: 30, pith: 30, sombrero: 45, horns: 50, tail: 50, wizardhat: 55, santahat: 25, beard: 20, wings: 120, halo: 100 };
export const PART_KINDS = [
  ['top', 'Oberteil', TOPS.map(t => t[0])], ['bottom', 'Hose', BOTTOMS.map(t => t[0])], ['shoe', 'Schuhe', SHOES.map(t => t[0])],
  ['hat', 'Hut/Mütze', HATS.map(t => t[0])], ['glasses', 'Brille', GLASSES.map(t => t[0])], ['watch', 'Uhr', WATCH_NAMES],
];
export const COLORABLE = { top: 'topColor', bottom: 'bottomColor', shoe: 'shoeColor', hat: 'hatColor' };

// Komplett-Skins (Themenbereiche des Parks)
export const SKIN_SHOP = [
  { id: 'besucher', name: 'Besucher', zone: 'Park', price: 0, desc: 'Dein Standard-Look.', look: { outfit: O({ top: 0, topColor: 0x1e88e5 }), extras: [] } },
  { id: 'ritter', name: 'Burgritter', zone: 'Klugheim', price: 180, desc: 'Stahlgrauer Wappenrock, Helm und roter Umhang – passend zur Mittelalterwelt.',
    look: { outfit: O({ top: 5, topColor: 0x56616c, bottom: 0, bottomColor: 0x2a2e34, shoe: 1, shoeColor: 0x2a2220, hairStyle: 1 }), extras: [['helmet', 0xaab4bc], ['cape', 0xb71c1c]] } },
  { id: 'pilot', name: 'Luftschiff-Pilot', zone: 'Rookburgh', price: 160, desc: 'Lederjacke, Fliegerbrille und weißer Schal – Pionierzeit der Fliegerei.',
    look: { outfit: O({ top: 11, topColor: 0x6a4a2a, bottom: 2, bottomColor: 0x8a7a5a, shoe: 1, shoeColor: 0x4a3322, glasses: 0 }), extras: [['goggles', 0x6a4a2a], ['scarf', 0xf5f5f5]] } },
  { id: 'safari', name: 'Safari-Forscher', zone: 'Deep in Africa', price: 140, desc: 'Khakihemd, Cargo-Shorts, Tropenhelm und Rucksack.',
    look: { outfit: O({ top: 1, topColor: 0xc8b078, bottom: 4, bottomColor: 0x8a7a50, shoe: 1, shoeColor: 0x5a4030 }), extras: [['pith', 0xe8d8b0], ['backpack', 0x8a7a50]] } },
  { id: 'mariachi', name: 'Mariachi', zone: 'Mexico', price: 150, desc: 'Schwarzer Anzug mit goldenem Sombrero.',
    look: { outfit: O({ top: 6, topColor: 0x15151a, bottom: 3, bottomColor: 0x15151a, shoe: 2, shoeColor: 0x1a1a1c, hairStyle: 2 }), extras: [['sombrero', 0xd9b45a]] } },
  { id: 'prinz', name: 'Märchenprinz', zone: 'Fantasy', price: 190, desc: 'Samtblauer Gehrock, Krone und goldener Umhang.',
    look: { outfit: O({ top: 6, topColor: 0x2a3aa0, bottom: 3, bottomColor: 0x1b1b2f, shoe: 2, shoeColor: 0x2a1a10, hairStyle: 2, hairColor: 0xb98b4a }), extras: [['crown', 0xffd54f], ['cape', 0xd4af37]] } },
  { id: 'fee', name: 'Fee', zone: 'Fantasy', price: 210, desc: 'Schimmernde Flügel und ein Heiligenschein.',
    look: { outfit: O({ top: 3, topColor: 0xe8b8ff, bottom: 1, bottomColor: 0xc8a0f0, shoe: 0, shoeColor: 0xf8e0ff, hairStyle: 5, hairColor: 0xd81b60 }), extras: [['wings', 0xbfe8ff], ['halo', 0xfff3a0]] } },
  { id: 'drache', name: 'Drachenkostüm', zone: 'Klugheim', price: 220, desc: 'Grüner Kapuzenpulli mit Hörnern und langem Schwanz.',
    look: { outfit: O({ top: 4, topColor: 0x2e7d32, bottom: 0, bottomColor: 0x1b5e20, shoe: 0, shoeColor: 0x1b1b1f }), extras: [['horns', 0xe8e0c8], ['tail', 0x2e7d32]] } },
  { id: 'gentleman', name: 'Hotel-Gentleman', zone: 'Hotels', price: 320, desc: 'Smoking, Fedora und goldene Fliegeruhr.',
    look: { outfit: O({ top: 7, topColor: 0x15151a, bottom: 3, bottomColor: 0x15151a, shoe: 2, shoeColor: 0x1a1a1c, hat: 3, hatColor: 0x15151a, watch: 3, hairStyle: 2 }), extras: [] } },
  { id: 'nikolaus', name: 'Winter-Nikolaus', zone: 'Wintertraum', price: 170, desc: 'Roter Mantel, Zipfelmütze und weißer Bart.',
    look: { outfit: O({ top: 8, topColor: 0xc62828, bottom: 0, bottomColor: 0x4e342e, shoe: 1, shoeColor: 0x1a1a1c, hairColor: 0xcfcfd4 }), extras: [['santahat', 0xd32f2f], ['beard', 0xf5f5f5]] } },
  { id: 'neon', name: 'Neon-Nachtschwärmer', zone: 'Nacht', price: 120, desc: 'Neon-Bomber, Sonnenbrille und Designer-Sneaker.',
    look: { outfit: O({ top: 9, topColor: 0x30ff90, bottom: 0, bottomColor: 0x1b1b1f, shoe: 3, shoeColor: 0xff2bd6, glasses: 1, watch: 2, hairStyle: 4, hairColor: 0x2a6fdb }), extras: [] } },
  { id: 'magier', name: 'Zauberer', zone: 'Mystery', price: 200, desc: 'Violetter Mantel, Zauberhut und grauer Bart.',
    look: { outfit: O({ top: 8, topColor: 0x4a2a8a, bottom: 0, bottomColor: 0x2a1a50, shoe: 1, shoeColor: 0x1a1a1c }), extras: [['wizardhat', 0x4a2a8a], ['beard', 0xcfcfd4]] } },
  { id: 'gold', name: 'Goldener Gast', zone: 'Luxus', price: 900, desc: 'Goldener Smoking, Krone und Luxus-Chronograph.',
    look: { outfit: O({ top: 7, topColor: 0xd4af37, bottom: 3, bottomColor: 0x15151a, shoe: 2, shoeColor: 0x15151a, watch: 5, glasses: 3, hairStyle: 2 }), extras: [['crown', 0xffd54f]] } },
];
export const skinById = id => SKIN_SHOP.find(s => s.id === id);

export function defaultWardrobe() { return { skins: { besucher: true }, parts: {}, extras: {}, skinId: 'besucher', look: JSON.parse(JSON.stringify(SKIN_SHOP[0].look)) }; }
export { EXTRAS };
