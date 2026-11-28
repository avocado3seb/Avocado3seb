/* NEON REDLINE – cars_data.js : Karosserie-Vorlagen, Fahrzeugdaten, Tuning, Leistungsberechnung */
(function (G) {
'use strict';
const U = G.U; const CD = {};

/* ---- Karosserie-Vorlagen: Seitenprofile (t: 0 = Heck, 1 = Front; y als Anteil der Dachhöhe) ---- */
CD.TPL = {
  wedge: { deck: [[0,.52],[.04,.58],[.12,.66],[.25,.71],[.38,.70],[.52,.64],[.66,.58],[.80,.48],[.92,.38],[1,.30]], t0: .30, t1: .66, roofMid: [[.36,.84],[.44,.97],[.52,1.0],[.60,.93]],
    bot: [[0,.34],[.05,.24],[.14,.15],[.30,.13],[.70,.13],[.90,.12],[.97,.14],[1,.2]], nf: .24, pF: 2.5, nr: .15, pR: 3.2, waist: .93, crown: .035, cabW: .84, glass: [[.36,.60]], rearGlass: true, seats: 2,
    head: { x: .62, y: .40, w: .34, h: .15, dir: 'up' }, tail: { x: .55, y: .60, w: .62, h: .06 }, grille: { w: .55, y: .18, h: .12 }, mirror: .60 },
  gt: { deck: [[0,.62],[.04,.67],[.12,.70],[.22,.71],[.34,.72],[.50,.72],[.58,.72],[.66,.66],[.78,.58],[.90,.50],[1,.42]], t0: .20, t1: .58, roofMid: [[.28,.88],[.38,.99],[.48,1.0],[.54,.90]],
    bot: [[0,.40],[.05,.26],[.15,.17],[.30,.15],[.70,.15],[.90,.14],[.97,.16],[1,.24]], nf: .14, pF: 3.6, nr: .12, pR: 3.4, waist: .95, crown: .03, cabW: .86, glass: [[.30,.54]], rearGlass: true, seats: 2,
    head: { x: .66, y: .42, w: .34, h: .15, dir: 'up' }, tail: { x: .58, y: .58, w: .46, h: .075 }, grille: { w: .6, y: .22, h: .13 }, mirror: .57 },
  muscle: { deck: [[0,.64],[.04,.68],[.14,.70],[.22,.71],[.34,.72],[.48,.72],[.55,.72],[.62,.68],[.78,.62],[.90,.58],[1,.52]], t0: .22, t1: .55, roofMid: [[.27,.90],[.32,.99],[.44,1.0],[.50,.88]],
    bot: [[0,.44],[.04,.30],[.12,.19],[.50,.17],[.88,.17],[.97,.20],[1,.28]], nf: .05, pF: 6, nr: .05, pR: 6, waist: .98, crown: .02, cabW: .88, glass: [[.28,.52]], rearGlass: true, seats: 4,
    head: { x: .66, y: .50, w: .24, h: .1, dir: 'front' }, tail: { x: .62, y: .62, w: .5, h: .1 }, grille: { w: .8, y: .30, h: .12 }, mirror: .56 },
  coupe: { deck: [[0,.62],[.04,.66],[.12,.68],[.22,.70],[.34,.71],[.50,.71],[.56,.71],[.66,.64],[.80,.56],[.92,.48],[1,.42]], t0: .22, t1: .56, roofMid: [[.28,.88],[.36,.99],[.46,1.0],[.52,.88]],
    bot: [[0,.42],[.05,.28],[.14,.18],[.30,.16],[.70,.16],[.90,.15],[.97,.17],[1,.25]], nf: .10, pF: 3.9, nr: .08, pR: 4.0, waist: .96, crown: .025, cabW: .88, glass: [[.28,.52]], rearGlass: true, seats: 4,
    head: { x: .66, y: .45, w: .28, h: .08, dir: 'front' }, tail: { x: .6, y: .6, w: .42, h: .08 }, grille: { w: .55, y: .24, h: .11 }, mirror: .56 },
  sedan: { deck: [[0,.66],[.04,.70],[.12,.72],[.22,.72],[.34,.72],[.50,.72],[.56,.72],[.64,.66],[.80,.60],[.92,.55],[1,.48]], t0: .22, t1: .56, roofMid: [[.26,.90],[.33,.99],[.44,1.0],[.50,.90]],
    bot: [[0,.42],[.04,.30],[.14,.19],[.50,.18],[.88,.18],[.97,.20],[1,.30]], nf: .08, pF: 4, nr: .08, pR: 4, waist: .97, crown: .02, cabW: .86, glass: [[.28,.52]], rearGlass: true, seats: 4,
    head: { x: .68, y: .50, w: .26, h: .09, dir: 'front' }, tail: { x: .66, y: .62, w: .36, h: .08 }, grille: { w: .6, y: .30, h: .1 }, mirror: .55 },
  rear: { deck: [[0,.52],[.04,.58],[.10,.64],[.20,.68],[.34,.70],[.50,.70],[.58,.70],[.66,.62],[.78,.54],[.90,.46],[1,.38]], t0: .10, t1: .58, roofMid: [[.16,.84],[.26,.97],[.38,1.0],[.48,.97]],
    bot: [[0,.36],[.05,.24],[.15,.17],[.30,.15],[.70,.15],[.90,.14],[.97,.16],[1,.24]], nf: .17, pF: 2.8, nr: .13, pR: 2.8, waist: .95, crown: .035, cabW: .86, glass: [[.20,.55]], rearGlass: true, seats: 4,
    head: { x: .66, y: .45, w: .24, h: .20, dir: 'up', round: true }, tail: { x: .55, y: .55, w: .62, h: .06 }, grille: { w: .4, y: .15, h: .09 }, mirror: .55 },
  suv: { deck: [[0,.66],[.04,.68],[.12,.68],[.30,.68],[.50,.68],[.58,.68],[.66,.64],[.80,.60],[.92,.56],[1,.52]], t0: .03, t1: .58, roofMid: [[.05,.93],[.10,1.0],[.30,1.0],[.45,1.0],[.52,.93]],
    bot: [[0,.52],[.04,.38],[.12,.30],[.50,.28],[.90,.28],[.98,.32],[1,.40]], nf: .06, pF: 5, nr: .05, pR: 5, waist: .98, crown: .015, cabW: .88, glass: [[.08,.55]], rearGlass: true, seats: 4,
    head: { x: .68, y: .62, w: .26, h: .11, dir: 'front' }, tail: { x: .7, y: .66, w: .24, h: .16 }, grille: { w: .55, y: .42, h: .16 }, mirror: .57 },
  hatch: { deck: [[0,.60],[.04,.64],[.12,.66],[.30,.68],[.50,.68],[.58,.68],[.66,.62],[.80,.54],[.92,.47],[1,.40]], t0: .04, t1: .58, roofMid: [[.07,.92],[.15,1.0],[.34,1.0],[.48,.97]],
    bot: [[0,.42],[.04,.30],[.12,.20],[.50,.19],[.90,.19],[1,.30]], nf: .08, pF: 3.6, nr: .06, pR: 4, waist: .97, crown: .02, cabW: .88, glass: [[.07,.56]], rearGlass: true, seats: 4,
    head: { x: .66, y: .5, w: .26, h: .1, dir: 'front' }, tail: { x: .7, y: .62, w: .24, h: .12 }, grille: { w: .5, y: .28, h: .1 }, mirror: .56 },
  van: { deck: [[0,.62],[.04,.64],[.30,.64],[.60,.64],[.74,.62],[.84,.52],[.92,.46],[1,.40]], t0: .02, t1: .74, roofMid: [[.05,.97],[.10,1.0],[.55,1.0],[.66,.94]],
    bot: [[0,.48],[.04,.36],[.12,.28],[.5,.27],[.9,.27],[1,.36]], nf: .05, pF: 5, nr: .04, pR: 5, waist: .98, crown: .01, cabW: .9, glass: [[.60,.72]], rearGlass: false, seats: 2,
    head: { x: .68, y: .54, w: .24, h: .1, dir: 'front' }, tail: { x: .72, y: .62, w: .2, h: .2 }, grille: { w: .5, y: .35, h: .12 }, mirror: .66 },
  pickup: { deck: [[0,.50],[.06,.50],[.30,.50],[.40,.56],[.46,.66],[.62,.66],[.70,.62],[.82,.58],[.92,.55],[1,.50]], t0: .40, t1: .62, roofMid: [[.43,.94],[.50,1.0],[.56,.95]],
    bot: [[0,.44],[.04,.34],[.12,.28],[.5,.27],[.9,.27],[1,.38]], nf: .06, pF: 5, nr: .04, pR: 5, waist: .98, crown: .01, cabW: .88, glass: [[.42,.60]], rearGlass: true, seats: 2,
    head: { x: .68, y: .62, w: .26, h: .12, dir: 'front' }, tail: { x: .75, y: .52, w: .16, h: .15 }, grille: { w: .6, y: .45, h: .18 }, mirror: .58 },
};

/* ---- Motor-Kennlinien (normalisiert auf Drehzahl/Redline) ---- */
CD.CURVES = {
  na:    [[0, .45], [.1, .55], [.2, .70], [.35, .85], [.5, .95], [.65, 1.0], [.8, .97], [.9, .9], [1, .80]],
  turbo: [[0, .15], [.1, .25], [.2, .45], [.3, .85], [.4, 1.0], [.6, 1.0], [.75, .95], [.9, .82], [1, .70]],
  v8:    [[0, .6], [.1, .7], [.25, .92], [.4, 1.0], [.6, .98], [.8, .88], [1, .72]],
  ev:    [[0, 1], [.3, 1], [.6, .8], [.8, .65], [1, .5]],
  rotary:[[0, .4], [.2, .65], [.4, .85], [.6, .97], [.8, 1.0], [1, .9]],
};

/* ---- Fahrzeuge ---- */
const S = [];
function car(o) { o.id = o.id || o.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'); S.push(o); return o; }
// Länge L, Breite W, Höhe H, Radstand wb, Überhang vorn fo, Spur track, Radradius wr, Reifenbreite tw
car({ name: 'Zephyr S15', brand: 'Sakura', cls: 'JDM', tpl: 'coupe', price: 26000, L: 4.46, W: 1.78, H: 1.28, wb: 2.52, fo: 0.92, track: 1.50, wr: 0.315, tw: 0.225, mass: 1250, hp: 300, red: 7600, idle: 900, kind: 'turbo', cyl: 4, layout: 'I4', drive: 'RWD', fw: .53, cd: .31, area: 1.95, cl: .05, grip: 1.08, fHz: 1.7, color: '#e8e8ea', engineSnd: 'i4t', nitro: 1, boost: 1 });
car({ name: 'Rotor RX-9', brand: 'Hayate', cls: 'JDM', tpl: 'gt', price: 38000, L: 4.28, W: 1.80, H: 1.23, wb: 2.52, fo: 0.88, track: 1.52, wr: 0.318, tw: 0.235, mass: 1260, hp: 285, red: 9000, idle: 1000, kind: 'rotary', cyl: 2, layout: 'R2', drive: 'RWD', fw: .50, cd: .30, area: 1.9, cl: .06, grip: 1.12, fHz: 1.9, color: '#c8102e', engineSnd: 'rotary', nitro: 1, boost: 0 });
car({ name: 'Dragon MK4', brand: 'Raijin', cls: 'JDM', tpl: 'gt', price: 76000, L: 4.51, W: 1.81, H: 1.27, wb: 2.55, fo: 0.95, track: 1.52, wr: 0.322, tw: 0.245, mass: 1520, hp: 460, red: 7400, idle: 850, kind: 'turbo', cyl: 6, layout: 'I6', drive: 'RWD', fw: .54, cd: .32, area: 2.0, cl: .08, grip: 1.14, fHz: 1.8, color: '#ff8a00', engineSnd: 'i6t', nitro: 1, boost: 1.4 });
car({ name: 'Evo Tora X', brand: 'Mikado', cls: 'JDM', tpl: 'sedan', price: 44000, L: 4.51, W: 1.81, H: 1.48, wb: 2.65, fo: 0.92, track: 1.55, wr: 0.328, tw: 0.245, mass: 1560, hp: 410, red: 7500, idle: 900, kind: 'turbo', cyl: 4, layout: 'I4', drive: 'AWD', fw: .58, cd: .33, area: 2.15, cl: .10, grip: 1.16, fHz: 1.8, color: '#1f4dbf', engineSnd: 'i4t', nitro: 1, boost: 1.5 });
car({ name: 'Oni R-Spec', brand: 'Kaiju', cls: 'JDM', tpl: 'gt', price: 108000, L: 4.71, W: 1.89, H: 1.37, wb: 2.78, fo: 0.9, track: 1.58, wr: 0.34, tw: 0.265, mass: 1740, hp: 565, red: 7200, idle: 800, kind: 'turbo', cyl: 6, layout: 'V6', drive: 'AWD', fw: .55, cd: .30, area: 2.2, cl: .12, grip: 1.20, fHz: 1.9, color: '#9aa4ae', engineSnd: 'v6t', nitro: 1, boost: 1.6 });
car({ name: 'NX-R Hybrid', brand: 'Hikari', cls: 'JDM', tpl: 'wedge', price: 176000, L: 4.49, W: 1.94, H: 1.18, wb: 2.63, fo: 0.9, track: 1.64, wr: 0.328, tw: 0.285, mass: 1730, hp: 600, red: 7800, idle: 850, kind: 'turbo', cyl: 6, layout: 'V6', drive: 'AWD', fw: .42, cd: .31, area: 2.0, cl: .18, grip: 1.26, fHz: 2.0, color: '#0d8a6a', engineSnd: 'v6t', nitro: 1, boost: 1.2 });
car({ name: 'Stallion GT', brand: 'Sterling', cls: 'Muscle', tpl: 'muscle', price: 52000, L: 4.78, W: 1.92, H: 1.38, wb: 2.72, fo: 0.96, track: 1.58, wr: 0.338, tw: 0.275, mass: 1720, hp: 460, red: 7400, idle: 750, kind: 'v8', cyl: 8, layout: 'V8', drive: 'RWD', fw: .54, cd: .35, area: 2.2, cl: .05, grip: 1.08, fHz: 1.6, color: '#0a3d91', engineSnd: 'v8', nitro: 1, boost: 0 });
car({ name: 'Marauder 70', brand: 'Bulldog', cls: 'Muscle', tpl: 'muscle', price: 64000, L: 5.10, W: 1.95, H: 1.36, wb: 2.95, fo: 1.0, track: 1.60, wr: 0.345, tw: 0.255, mass: 1660, hp: 425, red: 6200, idle: 700, kind: 'v8', cyl: 8, layout: 'V8', drive: 'RWD', fw: .57, cd: .38, area: 2.25, cl: .02, grip: 0.98, fHz: 1.4, color: '#111111', engineSnd: 'v8big', nitro: 1, boost: 0 });
car({ name: 'Daemon SC', brand: 'Warhawk', cls: 'Muscle', tpl: 'muscle', price: 94000, L: 5.02, W: 1.95, H: 1.45, wb: 2.95, fo: 1.0, track: 1.62, wr: 0.35, tw: 0.305, mass: 2010, hp: 707, red: 6600, idle: 750, kind: 'v8', cyl: 8, layout: 'V8', drive: 'RWD', fw: .56, cd: .37, area: 2.35, cl: .06, grip: 1.12, fHz: 1.6, color: '#8f1d1d', engineSnd: 'v8sc', nitro: 1, boost: 1.6 });
car({ name: 'Reaper V10', brand: 'Titan', cls: 'Muscle', tpl: 'gt', price: 118000, L: 4.46, W: 1.92, H: 1.23, wb: 2.51, fo: 0.88, track: 1.58, wr: 0.335, tw: 0.295, mass: 1520, hp: 645, red: 6400, idle: 800, kind: 'v8', cyl: 10, layout: 'V10', drive: 'RWD', fw: .50, cd: .34, area: 2.0, cl: .14, grip: 1.24, fHz: 1.9, color: '#f2c200', engineSnd: 'v10', nitro: 1, boost: 0 });
car({ name: 'Carrera RS', brand: 'Falke', cls: 'Sport', tpl: 'rear', price: 128000, L: 4.52, W: 1.85, H: 1.29, wb: 2.45, fo: 0.9, track: 1.56, wr: 0.328, tw: 0.285, mass: 1580, hp: 580, red: 7600, idle: 850, kind: 'turbo', cyl: 6, layout: 'F6', drive: 'AWD', fw: .38, cd: .33, area: 2.0, cl: .12, grip: 1.26, fHz: 2.0, color: '#d9d9dc', engineSnd: 'f6t', nitro: 1, boost: 1.5 });
car({ name: 'M-Sport 510', brand: 'Bavaro', cls: 'Sport', tpl: 'sedan', price: 92000, L: 4.79, W: 1.90, H: 1.43, wb: 2.86, fo: 0.88, track: 1.60, wr: 0.335, tw: 0.275, mass: 1670, hp: 510, red: 7200, idle: 850, kind: 'turbo', cyl: 6, layout: 'I6', drive: 'RWD', fw: .52, cd: .30, area: 2.2, cl: .08, grip: 1.20, fHz: 1.8, color: '#1a1a24', engineSnd: 'i6t', nitro: 1, boost: 1.4 });
car({ name: 'Stingray Z', brand: 'Vanguard', cls: 'Sport', tpl: 'gt', price: 99000, L: 4.63, W: 1.94, H: 1.22, wb: 2.72, fo: 0.88, track: 1.60, wr: 0.34, tw: 0.295, mass: 1530, hp: 495, red: 6600, idle: 800, kind: 'v8', cyl: 8, layout: 'V8', drive: 'RWD', fw: .48, cd: .32, area: 2.0, cl: .12, grip: 1.22, fHz: 1.9, color: '#e15a00', engineSnd: 'v8', nitro: 1, boost: 0 });
car({ name: 'R9 Quattro V10', brand: 'Ahrens', cls: 'Super', tpl: 'wedge', price: 212000, L: 4.43, W: 1.94, H: 1.24, wb: 2.65, fo: 0.9, track: 1.64, wr: 0.34, tw: 0.295, mass: 1620, hp: 610, red: 8500, idle: 900, kind: 'na', cyl: 10, layout: 'V10', drive: 'AWD', fw: .43, cd: .33, area: 2.0, cl: .15, grip: 1.28, fHz: 2.0, color: '#b9bcc0', engineSnd: 'v10', nitro: 1, boost: 0 });
car({ name: 'Corsa F8', brand: 'Rosso', cls: 'Super', tpl: 'wedge', price: 298000, L: 4.61, W: 1.98, H: 1.21, wb: 2.65, fo: 0.95, track: 1.68, wr: 0.34, tw: 0.305, mass: 1435, hp: 720, red: 8000, idle: 900, kind: 'turbo', cyl: 8, layout: 'V8', drive: 'RWD', fw: .41, cd: .32, area: 2.0, cl: .22, grip: 1.34, fHz: 2.1, color: '#d40000', engineSnd: 'v8flat', nitro: 1, boost: 1.4 });
car({ name: 'Aventor V12', brand: 'Toro', cls: 'Super', tpl: 'wedge', price: 384000, L: 4.84, W: 2.03, H: 1.14, wb: 2.70, fo: 1.0, track: 1.72, wr: 0.345, tw: 0.315, mass: 1575, hp: 770, red: 8700, idle: 900, kind: 'na', cyl: 12, layout: 'V12', drive: 'AWD', fw: .43, cd: .35, area: 2.0, cl: .24, grip: 1.36, fHz: 2.1, color: '#ffd100', engineSnd: 'v12', nitro: 1, boost: 0 });
car({ name: 'Specter Kappa', brand: 'Vortex', cls: 'Hyper', tpl: 'wedge', price: 1400000, L: 4.70, W: 1.99, H: 1.12, wb: 2.67, fo: 0.95, track: 1.70, wr: 0.345, tw: 0.315, mass: 1400, hp: 1000, red: 9200, idle: 950, kind: 'na', cyl: 8, layout: 'V8', drive: 'AWD', fw: .42, cd: .33, area: 1.95, cl: .30, grip: 1.45, fHz: 2.3, color: '#111827', engineSnd: 'v8flat', nitro: 1, boost: 0 });
car({ name: 'Voltra Zenith', brand: 'Zenith', cls: 'Hyper', tpl: 'wedge', price: 1900000, L: 4.78, W: 2.00, H: 1.10, wb: 2.78, fo: 0.95, track: 1.70, wr: 0.348, tw: 0.325, mass: 2050, hp: 1900, red: 16000, idle: 0, kind: 'ev', cyl: 0, layout: 'EV', drive: 'AWD', fw: .45, cd: .28, area: 1.95, cl: .32, grip: 1.50, fHz: 2.3, color: '#00b3ff', engineSnd: 'ev', nitro: 1, boost: 0 });
car({ name: 'Tempesta W16', brand: 'Ventura', cls: 'Hyper', tpl: 'wedge', price: 2600000, L: 4.54, W: 2.04, H: 1.20, wb: 2.71, fo: 0.93, track: 1.74, wr: 0.355, tw: 0.335, mass: 1995, hp: 1500, red: 7200, idle: 800, kind: 'turbo', cyl: 16, layout: 'W16', drive: 'AWD', fw: .43, cd: .36, area: 2.1, cl: .26, grip: 1.42, fHz: 2.2, color: '#1b1b1d', engineSnd: 'w16', nitro: 1, boost: 2.0 });

// Verkehr
const civ = (o) => { o.civil = true; o.price = 0; return car(o); };
civ({ name: 'Cityhatch', brand: 'Civi', cls: 'Zivil', tpl: 'hatch', L: 3.95, W: 1.72, H: 1.48, wb: 2.50, fo: 0.8, track: 1.48, wr: 0.30, tw: 0.185, mass: 1050, hp: 95, red: 6400, idle: 850, kind: 'na', cyl: 4, layout: 'I4', drive: 'FWD', fw: .6, cd: .32, area: 2.0, cl: 0, grip: 0.95, fHz: 1.3, color: '#cfcfcf', engineSnd: 'i4', nitro: 0, boost: 0 });
civ({ name: 'Familiensedan', brand: 'Civi', cls: 'Zivil', tpl: 'sedan', L: 4.65, W: 1.82, H: 1.45, wb: 2.75, fo: 0.9, track: 1.56, wr: 0.322, tw: 0.205, mass: 1450, hp: 150, red: 6200, idle: 800, kind: 'na', cyl: 4, layout: 'I4', drive: 'FWD', fw: .6, cd: .29, area: 2.2, cl: 0, grip: 0.98, fHz: 1.3, color: '#7d8fa0', engineSnd: 'i4', nitro: 0, boost: 0 });
civ({ name: 'Stadtgeländewagen', brand: 'Civi', cls: 'Zivil', tpl: 'suv', L: 4.85, W: 1.94, H: 1.75, wb: 2.85, fo: 0.95, track: 1.62, wr: 0.36, tw: 0.245, mass: 2000, hp: 230, red: 6000, idle: 800, kind: 'na', cyl: 6, layout: 'V6', drive: 'AWD', fw: .55, cd: .36, area: 2.8, cl: 0, grip: 0.98, fHz: 1.3, color: '#2b2f36', engineSnd: 'v6', nitro: 0, boost: 0 });
civ({ name: 'Lieferwagen', brand: 'Civi', cls: 'Zivil', tpl: 'van', L: 5.2, W: 1.97, H: 2.05, wb: 3.2, fo: 0.95, track: 1.68, wr: 0.34, tw: 0.215, mass: 2100, hp: 130, red: 5400, idle: 780, kind: 'na', cyl: 4, layout: 'I4', drive: 'FWD', fw: .6, cd: .38, area: 3.3, cl: 0, grip: 0.92, fHz: 1.2, color: '#e8e4da', engineSnd: 'diesel', nitro: 0, boost: 0 });
civ({ name: 'Pritschenwagen', brand: 'Civi', cls: 'Zivil', tpl: 'pickup', L: 5.3, W: 1.96, H: 1.78, wb: 3.2, fo: 0.95, track: 1.65, wr: 0.37, tw: 0.255, mass: 2150, hp: 270, red: 5800, idle: 750, kind: 'v8', cyl: 8, layout: 'V8', drive: 'RWD', fw: .55, cd: .40, area: 3.0, cl: 0, grip: 0.95, fHz: 1.25, color: '#7b2e1f', engineSnd: 'v8', nitro: 0, boost: 0 });
civ({ name: 'Taxi', brand: 'Civi', cls: 'Zivil', tpl: 'sedan', L: 4.65, W: 1.82, H: 1.45, wb: 2.75, fo: 0.9, track: 1.56, wr: 0.322, tw: 0.205, mass: 1500, hp: 140, red: 6200, idle: 800, kind: 'na', cyl: 4, layout: 'I4', drive: 'FWD', fw: .6, cd: .29, area: 2.2, cl: 0, grip: 0.98, fHz: 1.3, color: '#f2c200', engineSnd: 'diesel', nitro: 0, boost: 0, taxi: true });
// Polizei
const pol = (o) => { o.civil = true; o.police = true; o.price = 0; return car(o); };
pol({ name: 'Streifenwagen', brand: 'Polizei', cls: 'Polizei', tpl: 'sedan', L: 4.9, W: 1.86, H: 1.46, wb: 2.85, fo: 0.92, track: 1.58, wr: 0.335, tw: 0.245, mass: 1750, hp: 330, red: 6600, idle: 800, kind: 'v8', cyl: 8, layout: 'V8', drive: 'RWD', fw: .55, cd: .31, area: 2.2, cl: .02, grip: 1.12, fHz: 1.5, color: '#f4f6f8', engineSnd: 'v8', nitro: 0, boost: 0, pkind: 'patrol' });
pol({ name: 'Interceptor', brand: 'Polizei', cls: 'Polizei', tpl: 'gt', L: 4.55, W: 1.9, H: 1.3, wb: 2.6, fo: 0.9, track: 1.56, wr: 0.335, tw: 0.265, mass: 1600, hp: 560, red: 7000, idle: 800, kind: 'turbo', cyl: 6, layout: 'V6', drive: 'AWD', fw: .52, cd: .31, area: 2.0, cl: .1, grip: 1.25, fHz: 1.9, color: '#16181d', engineSnd: 'v6t', nitro: 0, boost: 1.4, pkind: 'interceptor' });
pol({ name: 'Polizei-SUV', brand: 'Polizei', cls: 'Polizei', tpl: 'suv', L: 5.0, W: 1.98, H: 1.82, wb: 2.95, fo: 0.95, track: 1.65, wr: 0.375, tw: 0.275, mass: 2500, hp: 480, red: 6400, idle: 800, kind: 'v8', cyl: 8, layout: 'V8', drive: 'AWD', fw: .55, cd: .38, area: 2.9, cl: 0, grip: 1.1, fHz: 1.4, color: '#14161a', engineSnd: 'v8', nitro: 0, boost: 0, pkind: 'suv' });
CD.SPECS = S; CD.byId = {}; for (const s of S) CD.byId[s.id] = s;
CD.PLAYER = S.filter(s => !s.civil); CD.CIVIL = S.filter(s => s.civil && !s.police); CD.POLICE = S.filter(s => s.police);

/* ---- Tuning ---- */
CD.UPG = {
  engine: { name: 'Motor', desc: 'Mehr Leistung durch Kolben, Nockenwellen und Kopfbearbeitung', hp: [1, 1.08, 1.17, 1.28], cost: [0, .035, .08, .17] },
  turbo: { name: 'Turbolader', desc: 'Größerer Lader, mehr Ladedruck, härteres Einsetzen', hp: [1, 1.06, 1.12, 1.20], cost: [0, .03, .07, .15] },
  ecu: { name: 'Motorsteuerung', desc: 'Drehzahlbegrenzer, Kennfeld und Auspuffknallen', rev: [0, 300, 600, 900], hp: [1, 1.02, 1.04, 1.06], cost: [0, .015, .035, .07] },
  trans: { name: 'Getriebe', desc: 'Kürzere Übersetzung und schnellere Schaltvorgänge', gear: [1, 1.04, 1.08, 1.12], shift: [.30, .22, .15, .09], cost: [0, .02, .05, .1] },
  tires: { name: 'Reifen', desc: 'Mehr Grip mit Sport- und Semislick-Mischungen', grip: [1, 1.07, 1.14, 1.22], cost: [0, .02, .05, .11] },
  brakes: { name: 'Bremsen', desc: 'Größere Scheiben und Sportbeläge', brake: [1, 1.1, 1.2, 1.32], cost: [0, .015, .035, .07] },
  susp: { name: 'Fahrwerk', desc: 'Gewindefahrwerk, Stabilisatoren, tiefere Lage', hz: [1, 1.1, 1.2, 1.3], cost: [0, .02, .045, .09] },
  weight: { name: 'Leichtbau', desc: 'Carbon-Teile und ausgeräumter Innenraum', mass: [1, .97, .94, .9], cost: [0, .025, .06, .12] },
  nitro: { name: 'Lachgas', desc: 'Größere Flasche und stärkerer Schub', tank: [1, 1.5, 2.1, 2.9], boost: [1, 1.1, 1.18, 1.25], cost: [0, .015, .04, .08] },
};
CD.UPG_ORDER = ['engine', 'turbo', 'ecu', 'trans', 'tires', 'brakes', 'susp', 'weight', 'nitro'];
CD.KITS = [{ n: 'Serie', c: 0 }, { n: 'Street', c: .02 }, { n: 'Sport', c: .05 }, { n: 'Breitbau', c: .1 }];
CD.SPOILERS = [{ n: 'Serie', c: 0, cl: 0 }, { n: 'Entenbürzel', c: .01, cl: .02 }, { n: 'Heckflügel', c: .025, cl: .08 }, { n: 'GT-Flügel', c: .04, cl: .16 }, { n: 'Zeitangriff-Flügel', c: .06, cl: .26 }];
CD.HOODS = [{ n: 'Serie', c: 0 }, { n: 'Lufthutze', c: .01 }, { n: 'Carbon-Haube', c: .03 }, { n: 'Carbon + Lüftung', c: .04 }];
CD.WHEELS = ['Fünfspeichen', 'Zehnspeichen', 'Gitternetz', 'Tiefbett', 'Doppelspeiche', 'Turbofan'];
CD.WHEEL_COLORS = [{ n: 'Chrom', c: '#d9dde2', m: 1 }, { n: 'Schwarz', c: '#15161a', m: .5 }, { n: 'Gold', c: '#c9a227', m: 1 }, { n: 'Bronze', c: '#8a5a2b', m: .9 }, { n: 'Weiß', c: '#eeeeee', m: .4 }, { n: 'Rot', c: '#c01818', m: .6 }, { n: 'Blau', c: '#1c4fbf', m: .6 }, { n: 'Anthrazit', c: '#4a4e55', m: .8 }];
CD.FINISH = [{ n: 'Hochglanz', id: 'gloss' }, { n: 'Metallic', id: 'metal' }, { n: 'Perlmutt', id: 'pearl' }, { n: 'Matt', id: 'matte' }, { n: 'Chrom', id: 'chrome' }, { n: 'Carbon', id: 'carbon' }];
CD.LIVERY = [{ n: 'Keine' }, { n: 'Rennstreifen' }, { n: 'Doppelstreifen' }, { n: 'Seitenstreifen' }, { n: 'Rallye-Blocker' }, { n: 'Karo-Band' }, { n: 'Flammen' }, { n: 'Racing-Nummer' }];
CD.PAINTS = ['#d40000', '#ff5a00', '#ffb800', '#e8e600', '#2db84d', '#0d8a6a', '#00b3ff', '#1f4dbf', '#6a2fd0', '#e0207a', '#f2f2f4', '#9aa4ae', '#2a2d33', '#0b0b0d', '#8f1d1d', '#0a3d91'];
CD.UNDERGLOW = [null, '#ff1f7a', '#00e5ff', '#7c4dff', '#39ff14', '#ff6a00', '#ffffff', '#ff2020'];
CD.TINT = ['Klar', 'Leicht', 'Dunkel', 'Schwarz'];

CD.defaultCfg = function (spec) {
  return { id: spec.id, paint: { color: spec.color, finish: 'metal', color2: '#101012' }, livery: 0, wheels: { style: 0, size: 0, color: 0 }, kit: 0, spoiler: 0, hood: 0, underglow: 0, tint: 1, perf: { engine: 0, turbo: 0, ecu: 0, trans: 0, tires: 0, brakes: 0, susp: 0, weight: 0, nitro: 0 }, damage: 0, number: 7 };
};

/* Effektive Parameter aus Fahrzeugdaten + Tuning */
CD.effective = function (spec, cfg) {
  cfg = cfg || CD.defaultCfg(spec); const P = cfg.perf, U_ = CD.UPG; const e = Object.assign({}, spec);
  let hpm = U_.engine.hp[P.engine] * U_.turbo.hp[P.turbo] * U_.ecu.hp[P.ecu]; if (!spec.boost && P.turbo > 0) hpm *= 1.0;
  e.hp = spec.hp * hpm; e.red = spec.red + U_.ecu.rev[P.ecu]; e.mass = spec.mass * U_.weight.mass[P.weight] + (cfg.kit >= 3 ? 25 : cfg.kit > 0 ? 8 : 0) + (cfg.spoiler > 1 ? 12 : 0);
  e.grip = spec.grip * U_.tires.grip[P.tires] * (1 + 0.025 * P.susp) * (cfg.kit >= 3 ? 1.04 : 1); e.brake = U_.brakes.brake[P.brakes]; e.fHz = spec.fHz * U_.susp.hz[P.susp]; e.shiftTime = U_.trans.shift[P.trans]; e.gearMul = U_.trans.gear[P.trans];
  e.cl = spec.cl + CD.SPOILERS[cfg.spoiler].cl * 1 + (cfg.kit >= 2 ? .05 : 0) + (cfg.kit === 1 ? .02 : 0); e.cd = spec.cd * (1 + (cfg.spoiler > 2 ? .05 : 0) + (cfg.kit >= 3 ? .04 : 0));
  e.nitroTank = 3.4 * U_.nitro.tank[P.nitro]; e.nitroBoost = 1.3 * U_.nitro.boost[P.nitro]; e.turboLevel = (spec.kind === 'turbo' ? 1 : 0) * (spec.boost || 1) * (1 + P.turbo * 0.25) + (spec.kind !== 'turbo' && P.turbo > 0 ? P.turbo * 0.4 : 0); e.popLevel = P.ecu; e.cfg = cfg; e.trackMul = cfg.kit >= 3 ? 1.07 : 1;
  e.twMul = 1 + (cfg.wheels.size) * 0.04 + (cfg.kit >= 3 ? .1 : 0); e.wr = spec.wr + cfg.wheels.size * 0.012;
  return e;
};
CD.torqueShape = function (kind, x) { const c = CD.CURVES[kind] || CD.CURVES.na; x = U.clamp(x, 0, 1); for (let i = 1; i < c.length; i++) if (x <= c[i][0]) { const a = c[i - 1], b = c[i]; return U.lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1)); } return c[c.length - 1][1]; };
/* Drehmoment-Skalierung (Nm), sodass Maximalleistung = hp */
CD.torqueScale = function (e) { let m = 0; for (let x = 0.05; x <= 1.0; x += 0.01) { const rpm = x * e.red; const v = CD.torqueShape(e.kind, x) * rpm; if (v > m) m = v; } return e.hp * 745.7 / (m * Math.PI / 30) * 1.0; };
CD.engineTorque = function (e, rpm, scale) { const x = rpm / e.red; return CD.torqueShape(e.kind, x) * scale; };
/* Höchstgeschwindigkeit (m/s) aus Leistung und Luftwiderstand */
CD.topSpeed = function (e) { const P = e.hp * 745.7 * 0.86; let v = 40; for (let i = 0; i < 60; i++) { const f = 0.5 * 1.2 * e.cd * e.area * v * v + e.mass * 9.81 * 0.012 + 0.5 * 1.2 * e.cl * e.area * v * v * 0.04; v += (P / Math.max(v, 1) - f) * 0.004; } return Math.min(v, e.vcap || 118); };
CD.gearbox = function (e) {
  const vmax = CD.topSpeed(e); const n = e.layout === 'EV' ? 1 : e.hp > 900 ? 7 : 6; const final = e.layout === 'EV' ? 1 : 3.4; const R = e.wr; const wmax = e.red * Math.PI / 30;
  if (n === 1) { return { ratios: [wmax * R / (vmax * 1.04)], final: 1, n: 1 }; }
  const gTop = wmax * R / (vmax * 1.04) / final; const g1 = Math.max(gTop * 3.9, (wmax * R / (0.26 * vmax)) / final * 0.95); const arr = []; for (let i = 0; i < n; i++) arr.push(g1 * Math.pow(gTop / g1, i / (n - 1)) * e.gearMul);
  return { ratios: arr, final, n };
};
/* Schätzwerte für Anzeige: 0-100, Spitze, Bremsweg, Handling, PI */
CD.stats = function (spec, cfg) {
  const e = CD.effective(spec, cfg); const gb = CD.gearbox(e); const scale = CD.torqueScale(e); const R = e.wr;
  let v = 0, t = 0, g = 0, t100 = 0, rpm; const dt = 0.01; let tshift = 0; const mu = e.grip * 1.0; const fwd = e.drive === 'AWD' ? 1 : e.drive === 'RWD' ? (1 - e.fw) + 0.1 : e.fw + 0.05;
  for (let i = 0; i < 4000 && v < 100 / 3.6; i++) {
    const G_ = gb.ratios[g] * gb.final; rpm = v / R * G_ * 30 / Math.PI; rpm = Math.max(rpm, e.layout === 'EV' ? 0 : Math.max(e.idle, 3500)); if (rpm > e.red * 0.97 && g < gb.n - 1) { g++; tshift = e.shiftTime; }
    const tq = CD.engineTorque(e, Math.min(rpm, e.red), scale); let F = tq * G_ / R * 0.86; if (tshift > 0) { F = 0; tshift -= dt; }
    const Fmax = Math.min(F, mu * 9.81 * e.mass * Math.min(1, fwd + 0.08) * 1.05); const drag = 0.5 * 1.2 * e.cd * e.area * v * v; v += (Fmax - drag) / e.mass * dt; t += dt;
  }
  t100 = t; const vmax = CD.topSpeed(e) * 3.6; const brk = 1.05 * e.grip * e.brake; const bd = Math.pow(100 / 3.6, 2) / (2 * brk * 9.81);
  const handling = U.clamp((e.grip * 1.05 + e.cl * 1.2 + (e.fHz - 1.3) * 0.25 + (e.drive === 'AWD' ? 0.08 : 0)) * 4.2 - 2.4, 1, 10);
  const accel = U.clamp((1 - (t100 - 2.0) / 6.5) * 10, 1, 10), speed = U.clamp((vmax - 150) / 30, 1, 10), brake = U.clamp((brk - 0.9) * 10 + 3, 1, 10);
  const ptw = e.hp / (e.mass / 1000);
  const pi = Math.round(U.clamp(150 + 0.36 * ptw + 150 * (e.grip - 1) + (vmax - 200) * 0.35 + e.cl * 40, 100, 999));
  return { hp: Math.round(e.hp), mass: Math.round(e.mass), t100, vmax, brake: bd, handling, accel, speed, brk: brake, pi, cls: CD.piClass(pi), ptw };
};
CD.piClass = function (pi) { return pi < 300 ? 'D' : pi < 360 ? 'C' : pi < 420 ? 'B' : pi < 500 ? 'A' : pi < 600 ? 'S' : 'X'; };
CD.piColor = function (c) { return { D: '#7aa6c4', C: '#5ad17a', B: '#e8d44d', A: '#ff9a3d', S: '#ff4d6d', X: '#c06bff' }[c]; };
CD.upgradeCost = function (spec, key, level) { return Math.round(spec.price * CD.UPG[key].cost[level] / 50) * 50 + (level > 0 ? 0 : 0); };
CD.cfgValue = function (spec, cfg) { let v = spec.price; for (const k of CD.UPG_ORDER) v += CD.upgradeCost(spec, k, cfg.perf[k]) * 0.6; return Math.round(v * 0.8); };
CD.CLASS_ORDER = ['D', 'C', 'B', 'A', 'S', 'X'];

G.CD = CD;
})(window.G = window.G || {});
