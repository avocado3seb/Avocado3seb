// Weltkonstanten
export const HALF = 3200;           // halbe Weltgröße (m)
export const CS = 320;              // Chunkgröße
export const NC = (HALF * 2) / CS;  // Chunks pro Achse
export const SEA = -0.3;
export const GX0 = -1400, GX1 = 1100, GZ0 = -1000, GZ1 = 1200, PITCH = 100;
export const RECTS = {
  airport: { x0: -1400, x1: -500, z0: 600, z1: 1100, name: 'Flughafen' },
  park: { x0: -500, x1: -200, z0: -100, z1: 200, name: 'Central Park' },
  golf: { x0: -1100, x1: -800, z0: -700, z1: -400, name: 'Palm Golfclub' },
  stadium: { x0: 100, x1: 300, z0: 300, z1: 500, name: 'Vice Stadion' },
  bay: { x0: 600, x1: 1300, z0: 900, z1: 1400, name: 'Hafenbecken' },
};
export const ROAD_W = { avenue: 22, street: 14, highway: 15, promenade: 16 };
export const FLAT = { x0: -1450, x1: 1160, z0: -1050, z1: 1250 };
export const ISLANDS = [
  { id: 'esmeralda', name: 'Isla Esmeralda', x: 1950, z: -500, r: 230, h: 22 },
  { id: 'palmera', name: 'Isla Palmera', x: 1850, z: 700, r: 170, h: 12 },
  { id: 'azul', name: 'Isla Azul', x: 1750, z: -1500, r: 190, h: 18 },
  { id: 'sol', name: 'Isla del Sol', x: 1650, z: 1650, r: 150, h: 9 },
  { id: 'alcatraz', name: 'Alcatraz (Gefängnisinsel)', x: 1000, z: 1250, r: 80, h: 13, flat: true, skip: true },
  { id: 'terra', name: 'Terra Mundi – Weltreise-Insel', x: 2520, z: 650, r: 470, h: 7, flat: true, skip: true },
];
export const PEAKS = [
  { x: -1700, z: -2550, r: 620, h: 430 }, { x: -1000, z: -2750, r: 560, h: 380 }, { x: -2350, z: -2700, r: 560, h: 400 }, { x: -450, z: -2700, r: 520, h: 330 }, { x: -1500, z: -2950, r: 420, h: 330 },
];
export const SKI_VILLAGE = { x: -1500, z: -2060, r: 150, h: 70 };
export const SAVANNA = { x0: -2800, x1: -250, z0: 2000, z1: 3100 };
export const inSavanna = (x, z) => x > SAVANNA.x0 && x < SAVANNA.x1 && z > SAVANNA.z0 && z < SAVANNA.z1;
export const SNOW_LINE = 150;
export const coastX = (z) => 1235 + 35 * Math.sin(z / 260) + 15 * Math.sin(z / 70 + 1);

export const inRect = (r, x, z, m = 0) => x > r.x0 + m && x < r.x1 - m && z > r.z0 + m && z < r.z1 - m;

// ---------- Brücken & Tunnel ----------
// Brücken verlaufen entlang x (z fest). y(x) = Fahrbahnhöhe.
export const BRIDGES = [
  { id: 'bay', name: 'Vice Bay Bridge', z: -400, x0: 1200, x1: 1800, w: 17, y: (x) => 17 * Math.sin(Math.PI * (x - 1200) / 600), pylons: [1420, 1580] },
  { id: 'lake', name: 'Lakeside Bridge', z: -900, x0: -1900, x1: -1400, w: 17, y: (x) => 34 * (-1400 - x) / 500, pylons: [] },
];
// Tunnel verlaufen entlang z (x = c fest)
export const TUNNELS = [
  { id: 'ridge', name: 'Ridge Tunnel', c: 400, a: -1760, b: -1330, w: 22 },
];
export function deckY(x, z) {
  for (let i = 0; i < BRIDGES.length; i++) { const B = BRIDGES[i]; if (x >= B.x0 && x <= B.x1 && Math.abs(z - B.z) < B.w / 2 + 1.2) return B.y(x); }
  return null;
}
