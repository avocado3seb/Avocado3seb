// Weltkonstanten
export const HALF = 2400;           // halbe Weltgröße (m)
export const CS = 300;              // Chunkgröße
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
];
export const coastX = (z) => 1235 + 35 * Math.sin(z / 260) + 15 * Math.sin(z / 70 + 1);

export const inRect = (r, x, z, m = 0) => x > r.x0 + m && x < r.x1 - m && z > r.z0 + m && z < r.z1 - m;
