// Kategorien: Zugdaten, Schienenstil, Physikparameter, Farben
// style: tube = Doppelrohr + Hauptträger, box = Kastenträger (B&M/Intamin), inv = hängende Bahn,
//        wood = Holzgerüst, small = filigrane Familienbahn
// rider: sit | inv (hängend) | floor (Floorless) | fly (liegend) | wing | spin (rotierende Gondel)
export const CATS = {
  hyper:     { label: 'Hyper Coaster',        style: 'box',  rider: 'sit',   cars: 8, spacing: 3.2, across: 2, crr: 0.007, lift: [40, 3.8], dropA: 64, hmax: 32, clearance: 2.0 },
  launch:    { label: 'Launch Coaster',       style: 'box',  rider: 'sit',   cars: 4, spacing: 3.6, across: 2, crr: 0.008, launch: true, dropA: 55, hmax: 24, clearance: 2.0 },
  sitdown:   { label: 'Stahl-Achterbahn',     style: 'tube', rider: 'sit',   cars: 6, spacing: 3.0, across: 2, crr: 0.009, lift: [38, 3.2], dropA: 55, hmax: 18, clearance: 1.9 },
  inverted:  { label: 'Inverted Coaster',     style: 'inv',  rider: 'inv',   cars: 4, spacing: 3.4, across: 4, crr: 0.009, lift: [35, 3.2], dropA: 52, hmax: 12, clearance: 3.4 },
  floorless: { label: 'Floorless Coaster',    style: 'box',  rider: 'floor', cars: 5, spacing: 3.4, across: 4, crr: 0.008, lift: [40, 3.4], dropA: 58, hmax: 16, clearance: 2.4 },
  dive:      { label: 'Dive Coaster',         style: 'box',  rider: 'floor', cars: 3, spacing: 4.6, across: 6, crr: 0.008, lift: [45, 3.4], dropA: 86, hmax: 12, clearance: 2.4 },
  flying:    { label: 'Flying Coaster',       style: 'inv',  rider: 'fly',   cars: 4, spacing: 3.4, across: 4, crr: 0.009, lift: [40, 3.2], dropA: 55, hmax: 14, clearance: 3.6 },
  wing:      { label: 'Wing Coaster',         style: 'box',  rider: 'wing',  cars: 4, spacing: 3.8, across: 4, crr: 0.009, lift: [40, 3.4], dropA: 60, hmax: 16, clearance: 3.0 },
  wood:      { label: 'Holzachterbahn',       style: 'wood', rider: 'sit',   cars: 3, spacing: 4.1, across: 2, crr: 0.014, lift: [34, 2.8], dropA: 52, hmax: 18, clearance: 1.6, rows: 2 },
  hybrid:    { label: 'Hybrid Coaster',       style: 'wood', rider: 'sit',   cars: 3, spacing: 4.1, across: 2, crr: 0.010, lift: [38, 3.4], dropA: 62, hmax: 22, clearance: 1.6, rows: 2 },
  spinning:  { label: 'Spinning Coaster',     style: 'tube', rider: 'spin',  cars: 3, spacing: 3.0, across: 4, crr: 0.012, lift: [20, 2.4], dropA: 40, hmax: 6,  clearance: 1.5 },
  mouse:     { label: 'Wild Mouse',           style: 'small',rider: 'sit',   cars: 2, spacing: 2.6, across: 2, crr: 0.013, lift: [18, 2.2], dropA: 38, hmax: 4,  clearance: 1.4 },
  minetrain: { label: 'Mine Train / Familie', style: 'small',rider: 'sit',   cars: 5, spacing: 2.6, across: 2, crr: 0.012, lift: [22, 2.4], dropA: 38, hmax: 7,  clearance: 1.4 },
  family:    { label: 'Familien-Achterbahn',  style: 'small',rider: 'sit',   cars: 5, spacing: 2.6, across: 2, crr: 0.012, lift: [16, 2.2], dropA: 34, hmax: 5,  clearance: 1.4 },
  kids:      { label: 'Kinder-Achterbahn',    style: 'small',rider: 'sit',   cars: 4, spacing: 2.2, across: 2, crr: 0.010, lift: [8, 1.8],  dropA: 24, hmax: 3,  clearance: 1.2 },
  darkride:  { label: 'Darkride',             style: 'small',rider: 'sit',   cars: 4, spacing: 2.6, across: 2, crr: 0.012, lift: [8, 2],  dropA: 24, hmax: 3,  clearance: 1.3 },
  water:     { label: 'Wasserachterbahn',     style: 'tube', rider: 'sit',   cars: 3, spacing: 3.4, across: 2, crr: 0.011, lift: [30, 3.0], dropA: 50, hmax: 10, clearance: 1.8 },
};
export const CAT_ORDER = Object.keys(CATS);

export const COUNTRIES = {
  DE: ['Deutschland', '#d4a017'], FR: ['Frankreich', '#2f6fd6'], GB: ['England / UK', '#c2253a'], NL: ['Niederlande', '#e86a17'],
  BE: ['Belgien', '#1c1c1c'], ES: ['Spanien', '#d6322f'], IT: ['Italien', '#2a9a4a'], AT: ['Österreich', '#d62a2a'],
  SE: ['Schweden', '#2a62b0'], DK: ['Dänemark', '#c8283a'], PL: ['Polen', '#d8d8d8'], CH: ['Schweiz', '#d62a2a'],
  FI: ['Finnland', '#2a62b0'], NO: ['Norwegen', '#b82a3a'], CZ: ['Tschechien', '#2a52a0'], HU: ['Ungarn', '#2a8a4a'],
  PT: ['Portugal', '#2a8a4a'], TR: ['Türkei', '#d62a2a'], RU: ['Russland', '#2a52a0'], IE: ['Irland', '#2a9a4a'],
  GR: ['Griechenland', '#2a62b0'], SK: ['Slowakei', '#2a52a0'], LU: ['Luxemburg', '#2a8ad0'], HR: ['Kroatien', '#d62a2a'],
  RO: ['Rumänien', '#e8c81a'], BG: ['Bulgarien', '#2a8a4a'], LT: ['Litauen', '#e8c81a'], EE: ['Estland', '#2a62b0'],
};

// Farbpaletten für Strecken, die keine eigenen Farben haben
export const PALETTES = [
  ['#c8202e', '#e8e8ea'], ['#1f5fd0', '#d8d8dc'], ['#e8a010', '#3a3a40'], ['#18a05a', '#e4e4e4'],
  ['#7b2fbf', '#cfcfd4'], ['#f0f0f2', '#2a6fd0'], ['#1c1c20', '#e02828'], ['#e85a14', '#22252b'],
  ['#12a8c8', '#e8e8e8'], ['#d02080', '#303034'], ['#8a6a3a', '#5a4026'], ['#2c3e50', '#e8b020'],
];
