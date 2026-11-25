// Reine Daten: neue Content-Packs (je 1 Waffe, 1 Yacht, 1 Auto, 1 Flugzeug, 1 Skin), Geheimwaffen, zusätzliche Läden & Immobilien.
// Keine Imports – wird von data.js und vehicledata.js eingebunden.
const S = (top, topColor, bottom, bottomColor, shoe, shoeColor, hat = 0, hatColor = 0x333333, glasses = 0) => ({ top, topColor, bottom, bottomColor, shoe, shoeColor, hat, hatColor, glasses });

// Fahrzeuge der neuen Packs: [Name, Klasse, Optionen]
export const PACK_VEHICLES = [
  // Wüste
  ['Sandstorm Raider', 'offroad', { pack: 'wueste', color: 0xc9a25c }], ['Dhau Royal', 'boat', { sub: 'cruiser', pack: 'wueste', color: 0xe8d9a8 }], ['Wüstenfalke', 'plane', { sub: 'prop', pack: 'wueste', color: 0xd9b36b }],
  // Arktis
  ['Frostbite Snowcat', 'offroad', { pack: 'arktis', color: 0xe3f2fd }], ['Eisbrecher Polaris', 'boat', { sub: 'yacht', pack: 'arktis', color: 0xe3f2fd }], ['Polar Skyhawk', 'plane', { sub: 'prop', pack: 'arktis', color: 0xeaf6ff }],
  // Dschungel
  ['Jungle Warlord', 'offroad', { pack: 'dschungel', color: 0x2e5a2e }], ['Amazonas Queen', 'boat', { sub: 'cruiser', pack: 'dschungel', color: 0x2e7d32 }], ['Seaplane Tukan', 'plane', { sub: 'sea', pack: 'dschungel', color: 0xf9a825 }],
  // Cyber
  ['Cyber Volt', 'super', { pack: 'cyber', color: 0x00e5ff }], ['Neon Hydrofoil', 'boat', { sub: 'cigar', pack: 'cyber', color: 0xe040fb }], ['Drone Wing', 'plane', { sub: 'stunt', pack: 'cyber', color: 0x00e5ff }],
  // Retro
  ['Retro Rocket 55', 'classic', { pack: 'retro', color: 0xff8a80 }], ['Gatsby Steam Yacht', 'boat', { sub: 'yacht', pack: 'retro', color: 0xf5f0e0 }], ['Biplane Barnstormer', 'plane', { sub: 'prop', pack: 'retro', color: 0xd32f2f }],
  // Militär
  ['Warthog Assault', 'offroad', { pack: 'militaer', color: 0x4b5320 }], ['Navy Patrol 90', 'boat', { sub: 'cruiser', pack: 'militaer', color: 0x607d8b }], ['Falcon Fighter', 'plane', { sub: 'jet', pack: 'militaer', color: 0x78909c }],
  // Piraten
  ['Buccaneer Hotrod', 'muscle', { pack: 'pirat', color: 0x212121 }], ['Schwarze Perle', 'boat', { sub: 'sail', pack: 'pirat', color: 0x212121 }], ['Kraken Wasserflieger', 'plane', { sub: 'sea', pack: 'pirat', color: 0x5d4037 }],
  // Weltraum
  ['Nebula S', 'super', { pack: 'weltraum', color: 0x7c4dff }], ['Orbit Yacht', 'boat', { sub: 'mega', pack: 'weltraum', color: 0xeceff1 }], ['Starhopper', 'plane', { sub: 'jet', pack: 'weltraum', color: 0xeceff1 }],
  // Samurai
  ['Ronin Drift', 'sport', { pack: 'samurai', color: 0xd50000 }], ['Sakura Maru', 'boat', { sub: 'yacht', pack: 'samurai', color: 0xf8bbd0 }], ['Kamikaze Zero', 'plane', { sub: 'stunt', pack: 'samurai', color: 0xeeeeee }],
  // Royal
  ['Royal Phantom', 'limo', { pack: 'royal', color: 0x1a1a2e }], ['Britannia Majestic', 'boat', { sub: 'mega', pack: 'royal', color: 0xf5f5f5 }], ['Royal Jet One', 'plane', { sub: 'jet', pack: 'royal', color: 0xfafafa }],
  // Gangster
  ['Don Corleone 8', 'classic', { pack: 'gangster', color: 0x111111 }], ['Mafia Express', 'boat', { sub: 'cigar', pack: 'gangster', color: 0x263238 }], ['Capone Prop', 'plane', { sub: 'prop', pack: 'gangster', color: 0x37474f }],
  // Tropen
  ['Palm Cruiser', 'coupe', { pack: 'tropen', color: 0x26c6da, conv: true }], ['Sunset Catamaran', 'boat', { sub: 'sail', pack: 'tropen', color: 0xff7043 }], ['Aloha Seaplane', 'plane', { sub: 'sea', pack: 'tropen', color: 0x26c6da }],
  // Drachen / Feuer
  ['Inferno GT', 'super', { pack: 'drache', color: 0xff3d00 }], ['Drachenboot Ryu', 'boat', { sub: 'cigar', pack: 'drache', color: 0xd50000 }], ['Phoenix Heli', 'heli', { sub: 'light', pack: 'drache', color: 0xff6d00 }],
  // Avocado (Admin)
  ['Avocado Hypercar', 'super', { pack: 'avocado', color: 0x4caf50 }], ['Avocado Mega-Yacht', 'boat', { sub: 'mega', pack: 'avocado', color: 0x2e7d32 }], ['Avocado Jet', 'plane', { sub: 'jet', pack: 'avocado', color: 0x66bb6a }], ['Avocado Heli', 'heli', { sub: 'military', pack: 'avocado', color: 0x388e3c }],
];

// Neue Waffen. model = Form (pistol|smg|shotgun|rifle|cannon), tint = Farbe, explosive = Explosionsradius
export const EXTRA_WEAPONS = {
  // Packs
  gold_revolver: { name: 'Goldener Revolver', dmg: 70, rate: 2.2, range: 110, mag: 6, auto: false, spread: 0.008, ammoPrice: 40, ammoPack: 24, pack: 'luxus', model: 'pistol', tint: 0xd4af37 },
  harpune: { name: 'Harpunengewehr', dmg: 60, rate: 1.6, range: 90, mag: 4, auto: false, spread: 0.01, ammoPrice: 30, ammoPack: 12, pack: 'insel', model: 'rifle', tint: 0x26c6da },
  bordkanone: { name: 'Bordkanone', dmg: 22, rate: 14, range: 130, mag: 60, auto: true, spread: 0.02, ammoPrice: 40, ammoPack: 120, pack: 'flug', model: 'smg', tint: 0x90caf9 },
  seerauber_flinte: { name: 'Piratenflinte', dmg: 14, rate: 1.4, range: 40, mag: 2, auto: false, spread: 0.07, pellets: 12, ammoPrice: 30, ammoPack: 12, pack: 'pirat', model: 'shotgun', tint: 0x5d4037 },
  yacht_flare: { name: 'Leuchtpistole', dmg: 55, rate: 1.0, range: 120, mag: 1, auto: false, spread: 0.005, explosive: 5, ammoPrice: 60, ammoPack: 6, pack: 'yacht', model: 'pistol', tint: 0xff7043 },
  rennen_gun: { name: 'Carbon-Karabiner', dmg: 34, rate: 10, range: 150, mag: 30, auto: true, spread: 0.012, ammoPrice: 40, ammoPack: 90, pack: 'renn', model: 'rifle', tint: 0x15161a },
  neon_smg: { name: 'Neon-Bassgewehr', dmg: 20, rate: 13, range: 80, mag: 40, auto: true, spread: 0.025, ammoPrice: 40, ammoPack: 120, pack: 'nacht', model: 'smg', tint: 0xff2bd6 },
  wuesten_adler: { name: 'Wüstenadler', dmg: 95, rate: 2.0, range: 130, mag: 7, auto: false, spread: 0.008, ammoPrice: 45, ammoPack: 21, pack: 'wueste', model: 'pistol', tint: 0xc9a25c },
  frost_gewehr: { name: 'Frostgewehr', dmg: 48, rate: 8, range: 170, mag: 30, auto: true, spread: 0.01, ammoPrice: 50, ammoPack: 90, pack: 'arktis', model: 'rifle', tint: 0x81d4fa },
  blasrohr: { name: 'Dschungel-SMG', dmg: 24, rate: 12, range: 85, mag: 36, auto: true, spread: 0.022, ammoPrice: 35, ammoPack: 108, pack: 'dschungel', model: 'smg', tint: 0x558b2f },
  plasma: { name: 'Plasmagewehr', dmg: 62, rate: 7, range: 180, mag: 25, auto: true, spread: 0.008, ammoPrice: 60, ammoPack: 75, pack: 'cyber', model: 'rifle', tint: 0x00e5ff },
  tommy: { name: 'Tommy Gun', dmg: 22, rate: 12, range: 75, mag: 50, auto: true, spread: 0.03, ammoPrice: 30, ammoPack: 100, pack: 'retro', model: 'smg', tint: 0x4e342e },
  raketenwerfer: { name: 'Raketenwerfer', dmg: 200, rate: 0.6, range: 150, mag: 1, auto: false, spread: 0.004, explosive: 9, ammoPrice: 400, ammoPack: 4, pack: 'militaer', model: 'cannon', tint: 0x4b5320 },
  ionenkanone: { name: 'Ionenkanone', dmg: 120, rate: 1.4, range: 220, mag: 6, auto: false, spread: 0.003, explosive: 5, ammoPrice: 300, ammoPack: 12, pack: 'weltraum', model: 'cannon', tint: 0xb388ff },
  shuriken_smg: { name: 'Shuriken-SMG', dmg: 26, rate: 13, range: 70, mag: 40, auto: true, spread: 0.02, ammoPrice: 40, ammoPack: 120, pack: 'samurai', model: 'smg', tint: 0xe91e63 },
  royal_schrot: { name: 'Königliche Schrotflinte', dmg: 18, rate: 1.6, range: 45, mag: 8, auto: false, spread: 0.05, pellets: 10, ammoPrice: 50, ammoPack: 24, pack: 'royal', model: 'shotgun', tint: 0xd4af37 },
  doppellauf: { name: 'Doppelläufer', dmg: 22, rate: 1.8, range: 38, mag: 2, auto: false, spread: 0.06, pellets: 14, ammoPrice: 30, ammoPack: 12, pack: 'gangster', model: 'shotgun', tint: 0x212121 },
  kokos_werfer: { name: 'Kokos-Granatwerfer', dmg: 110, rate: 0.9, range: 90, mag: 3, auto: false, spread: 0.01, explosive: 7, ammoPrice: 250, ammoPack: 9, pack: 'tropen', model: 'cannon', tint: 0x8d6e63 },
  flammenwerfer: { name: 'Flammenwerfer', dmg: 9, rate: 22, range: 20, mag: 200, auto: true, spread: 0.06, ammoPrice: 80, ammoPack: 400, pack: 'drache', model: 'smg', tint: 0xff3d00 },
  avocado_kanone: { name: 'Avocado-Kanone', dmg: 400, rate: 8, range: 400, mag: 100, auto: true, spread: 0.002, explosive: 6, ammoPrice: 0, ammoPack: 200, pack: 'avocado', model: 'cannon', tint: 0x4caf50 },
  // Geheimwaffen (Verstecke)
  railgun: { name: 'Railgun', dmg: 300, rate: 1.0, range: 400, mag: 4, auto: false, spread: 0.001, ammoPrice: 0, ammoPack: 12, secret: true, model: 'rifle', tint: 0x7c4dff },
  minigun: { name: 'Minigun', dmg: 14, rate: 28, range: 110, mag: 200, auto: true, spread: 0.04, ammoPrice: 0, ammoPack: 400, secret: true, model: 'cannon', tint: 0x546e7a },
  pharao_stab: { name: 'Pharaonenstab', dmg: 90, rate: 2.5, range: 80, mag: 8, auto: false, spread: 0.01, explosive: 4, ammoPrice: 0, ammoPack: 24, secret: true, model: 'pistol', tint: 0xffd54f },
  armbrust: { name: 'Armbrust-Sniper', dmg: 180, rate: 0.9, range: 320, mag: 3, auto: false, spread: 0.0008, ammoPrice: 0, ammoPack: 12, secret: true, model: 'rifle', tint: 0x6d4c41 },
  eis_sniper: { name: 'Eishöhlen-Sniper', dmg: 220, rate: 0.8, range: 380, mag: 5, auto: false, spread: 0.0005, ammoPrice: 0, ammoPack: 15, secret: true, model: 'rifle', tint: 0xb3e5fc },
  almond_blaster: { name: 'Mandelwasser-Blaster', dmg: 40, rate: 9, range: 100, mag: 40, auto: true, spread: 0.02, ammoPrice: 0, ammoPack: 120, secret: true, model: 'smg', tint: 0xfff59d },
  tunnel_hammer: { name: 'Tunnelbohrer-Kanone', dmg: 150, rate: 1.2, range: 60, mag: 5, auto: false, spread: 0.03, pellets: 6, explosive: 3, ammoPrice: 0, ammoPack: 15, secret: true, model: 'shotgun', tint: 0xff9100 },
  wasserloch_speer: { name: 'Jäger-Repetierbüchse', dmg: 120, rate: 1.6, range: 260, mag: 6, auto: false, spread: 0.002, ammoPrice: 0, ammoPack: 18, secret: true, model: 'rifle', tint: 0x8d6e63 },
};

// Packs: grants = Inhalt (je Waffe, Yacht, Auto, Flugzeug, Skin)
export const PACK_GRANTS = {
  luxus: { weapon: 'gold_revolver', car: 'Phantom Aureus', yacht: 'Yacht Serenity', plane: 'Lear Jet LJ', skin: { name: 'Luxus-Smoking', outfit: S(7, 0x111118, 3, 0x111118, 2, 0x111111, 3, 0x222222, 3) } },
  insel: { weapon: 'harpune', car: 'Dune Runner', yacht: 'Sailing Breeze', plane: 'Seaplane Albatross', skin: { name: 'Insel-Outfit', outfit: S(2, 0xff7043, 1, 0x26c6da, 0, 0xffffff, 4, 0xe8d28c, 1) } },
  flug: { weapon: 'bordkanone', car: 'Stratos Turbo', yacht: 'Cruiser 45', plane: 'Stunt Falcon', skin: { name: 'Pilotenjacke', outfit: S(4, 0x5d4037, 2, 0x37474f, 1, 0x3e2723, 0, 0x222222, 2) } },
  yacht: { weapon: 'yacht_flare', car: 'Stretch Royal', yacht: 'Mega Yacht Opulence', plane: 'Seaplane Albatross', skin: { name: 'Kapitänsuniform', outfit: S(1, 0xf5f5f5, 3, 0x1a237e, 2, 0x212121, 3, 0xf5f5f5, 1) } },
  renn: { weapon: 'rennen_gun', car: 'Nitro GTR', yacht: 'Racer Cigar', plane: 'Stunt Falcon', skin: { name: 'Rennoverall', outfit: S(4, 0xd50000, 2, 0xd50000, 1, 0x111111, 1, 0xd50000, 1) } },
  nacht: { weapon: 'neon_smg', car: 'Party Bus', yacht: 'Yacht Serenity', plane: 'Cargo Dash', skin: { name: 'Neon-Look', outfit: S(4, 0xe040fb, 2, 0x00e5ff, 3, 0xff2bd6, 0, 0x222222, 1) } },
  wueste: { weapon: 'wuesten_adler', car: 'Sandstorm Raider', yacht: 'Dhau Royal', plane: 'Wüstenfalke', skin: { name: 'Beduine', outfit: S(1, 0xf5ecd0, 2, 0xd9c8a0, 1, 0x8d6e63, 4, 0xf5ecd0, 1) } },
  arktis: { weapon: 'frost_gewehr', car: 'Frostbite Snowcat', yacht: 'Eisbrecher Polaris', plane: 'Polar Skyhawk', skin: { name: 'Polarparka', outfit: S(4, 0xe3f2fd, 2, 0x455a64, 1, 0xeeeeee, 2, 0xe3f2fd, 2) } },
  dschungel: { weapon: 'blasrohr', car: 'Jungle Warlord', yacht: 'Amazonas Queen', plane: 'Seaplane Tukan', skin: { name: 'Dschungel-Tarn', outfit: S(3, 0x4b5d3a, 2, 0x3e4d2e, 1, 0x3e2723, 2, 0x4b5d3a, 0) } },
  cyber: { weapon: 'plasma', car: 'Cyber Volt', yacht: 'Neon Hydrofoil', plane: 'Drone Wing', skin: { name: 'Cyber-Anzug', outfit: S(4, 0x00e5ff, 2, 0x111118, 3, 0x00e5ff, 0, 0x111118, 3) } },
  retro: { weapon: 'tommy', car: 'Retro Rocket 55', yacht: 'Gatsby Steam Yacht', plane: 'Biplane Barnstormer', skin: { name: '20er-Gangster-Anzug', outfit: S(7, 0x4e342e, 3, 0x4e342e, 2, 0x111111, 3, 0x4e342e, 0) } },
  militaer: { weapon: 'raketenwerfer', car: 'Warthog Assault', yacht: 'Navy Patrol 90', plane: 'Falcon Fighter', skin: { name: 'Spezialeinheit', outfit: S(4, 0x4b5320, 2, 0x4b5320, 1, 0x1b1b1b, 2, 0x4b5320, 2) } },
  pirat: { weapon: 'seerauber_flinte', car: 'Buccaneer Hotrod', yacht: 'Schwarze Perle', plane: 'Kraken Wasserflieger', skin: { name: 'Piratenkapitän', outfit: S(1, 0x7b1f1f, 2, 0x212121, 1, 0x3e2723, 3, 0x212121, 0) } },
  weltraum: { weapon: 'ionenkanone', car: 'Nebula S', yacht: 'Orbit Yacht', plane: 'Starhopper', skin: { name: 'Astronautenanzug', outfit: S(4, 0xeceff1, 2, 0xeceff1, 1, 0xb0bec5, 2, 0xeceff1, 3) } },
  samurai: { weapon: 'shuriken_smg', car: 'Ronin Drift', yacht: 'Sakura Maru', plane: 'Kamikaze Zero', skin: { name: 'Ronin-Kimono', outfit: S(1, 0x263238, 2, 0x263238, 0, 0x8d6e63, 0, 0x222222, 0) } },
  royal: { weapon: 'royal_schrot', car: 'Royal Phantom', yacht: 'Britannia Majestic', plane: 'Royal Jet One', skin: { name: 'Königsgewand', outfit: S(7, 0x4a148c, 3, 0x4a148c, 2, 0xd4af37, 3, 0xd4af37, 0) } },
  gangster: { weapon: 'doppellauf', car: 'Don Corleone 8', yacht: 'Mafia Express', plane: 'Capone Prop', skin: { name: 'Pate', outfit: S(7, 0x212121, 3, 0x212121, 2, 0x111111, 3, 0x212121, 1) } },
  tropen: { weapon: 'kokos_werfer', car: 'Palm Cruiser', yacht: 'Sunset Catamaran', plane: 'Aloha Seaplane', skin: { name: 'Aloha-Style', outfit: S(2, 0xff7043, 1, 0xfff59d, 0, 0xffffff, 4, 0xe8d28c, 1) } },
  drache: { weapon: 'flammenwerfer', car: 'Inferno GT', yacht: 'Drachenboot Ryu', plane: 'Phoenix Heli', skin: { name: 'Drachenkrieger', outfit: S(4, 0xd50000, 2, 0x212121, 1, 0xff6d00, 0, 0x222222, 0) } },
  avocado: { weapon: 'avocado_kanone', car: 'Avocado Hypercar', yacht: 'Avocado Mega-Yacht', plane: 'Avocado Jet', extra: ['Avocado Flugyacht', 'Avocado Heli'], skin: { name: 'Avocado-König', outfit: S(7, 0x2e7d32, 3, 0x1b5e20, 2, 0xd4af37, 3, 0x66bb6a, 3) } },
};

export const EXTRA_PACKS = {
  wueste: { name: 'Wüsten-Pack', price: 1300000, color: '#e0b85c', desc: 'Dünen-Raider, Dhau, Wüstenfalke, Wüstenadler & Beduinen-Skin.' },
  arktis: { name: 'Arktis-Pack', price: 1400000, color: '#81d4fa', desc: 'Snowcat, Eisbrecher-Yacht, Polar-Flieger, Frostgewehr & Polarparka.' },
  dschungel: { name: 'Dschungel-Pack', price: 1300000, color: '#66bb6a', desc: 'Warlord-Geländewagen, Amazonas-Yacht, Seeflieger, Dschungel-SMG & Tarn-Skin.' },
  cyber: { name: 'Cyber-Pack', price: 3200000, color: '#00e5ff', desc: 'Cyber Volt, Neon-Hydrofoil, Drohnenflieger, Plasmagewehr & Cyber-Anzug.' },
  retro: { name: 'Retro-Pack', price: 1600000, color: '#ff8a80', desc: 'Retro Rocket, Dampfyacht, Doppeldecker, Tommy Gun & Zwanziger-Anzug.' },
  militaer: { name: 'Militär-Pack', price: 4200000, color: '#9ccc65', desc: 'Warthog, Marine-Patrouille, Falcon-Kampfjet, Raketenwerfer & Spezialeinheit.' },
  pirat: { name: 'Piraten-Pack', price: 1700000, color: '#bcaaa4', desc: 'Hotrod, Schwarze Perle, Kraken-Wasserflieger, Piratenflinte & Kapitänsoutfit.' },
  weltraum: { name: 'Weltraum-Pack', price: 6500000, color: '#b388ff', desc: 'Nebula S, Orbit-Yacht, Starhopper, Ionenkanone & Astronautenanzug.' },
  samurai: { name: 'Samurai-Pack', price: 2100000, color: '#f06292', desc: 'Ronin Drift, Sakura Maru, Kamikaze Zero, Shuriken-SMG & Ronin-Kimono.' },
  royal: { name: 'Royal-Pack', price: 9000000, color: '#ce93d8', desc: 'Royal Phantom, Britannia-Megayacht, Royal Jet, Königsschrotflinte & Königsgewand.' },
  gangster: { name: 'Gangster-Pack', price: 2300000, color: '#90a4ae', desc: 'Don Corleone, Mafia Express, Capone Prop, Doppelläufer & Pate-Anzug.' },
  tropen: { name: 'Tropen-Pack', price: 1500000, color: '#4dd0e1', desc: 'Palm Cruiser, Sunset Catamaran, Aloha Seaplane, Kokos-Werfer & Aloha-Style.' },
  drache: { name: 'Drachen-Pack', price: 5200000, color: '#ff6e40', desc: 'Inferno GT, Drachenboot, Phoenix-Heli, Flammenwerfer & Drachenkrieger.' },
  avocado: { name: '🥑 AVOCADO-PACK (Admin)', price: 0, color: '#66bb6a', desc: 'Das krasseste Pack der Welt – nur für Avocado3seb: Flugyacht, Hypercar, Mega-Yacht, Jet, Heli, Avocado-Kanone & Avocado-König-Skin.', admin: true },
};

// Hinweis: Missionen der alten Packs bleiben unverändert (missions-Feld), neue Packs haben keine Story-Missionen.
for (const p of Object.values(EXTRA_PACKS)) p.missions = [];

// Zusätzliche Kioske (Corners i,j,c werden in data.js auf freie Ecken verteilt)
export const SHOP_TYPES = [
  ['supermarket', 'Vice Supermarkt', 0x43a047, 3], ['pharmacy', 'Apotheke Vice', 0x26a69a, 2], ['electronics', 'ElektroWelt', 0x3949ab, 2], ['furniture', 'Möbelhaus Casa', 0x8d6e63, 2], ['hardware', 'Baumarkt Bob', 0xff8f00, 2],
  ['gym', 'Iron Paradise Gym', 0xd32f2f, 2], ['cinema', 'Vice Kino', 0x6a1b9a, 1], ['school', 'Vice Highschool & Fahrschule', 0xfbc02d, 1], ['flea', 'Flohmarkt', 0xa1887f, 2], ['travel', 'Reisebüro Weltenbummler', 0x29b6f6, 2],
  ['builder', 'Bauunternehmen Hoch & Tief', 0xef6c00, 1], ['mcd', "Mc Donny's", 0xffc107, 3], ['yt', 'YouTube-Studio', 0xe53935, 1], ['gaming', "Gamer's Paradise", 0x7c4dff, 1], ['tattoo', 'Ink Vice Tattoo', 0x37474f, 1],
  ['bakery', 'Bäckerei Goldkruste', 0xd7a86e, 1], ['restaurant', 'Ristorante Bella Vista', 0xb71c1c, 2], ['bistro', 'Bistro Lumière', 0x5d4037, 1], ['phone', 'Handy-Shop Vice Mobile', 0x00acc1, 1], ['pets', 'Tierhandlung Wuff', 0x7cb342, 1],
];
