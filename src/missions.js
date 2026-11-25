// Missionssystem: Story, Zwischensequenzen (Cutscenes), Pack-Missionen
import * as THREE from 'three';
import { G } from './state.js';
import { clamp, lerp, angDiff, dampAngle, fmtMoney, RNG } from './util.js';
import { byKey } from './vehicledata.js';
import { RouteDriver } from './ai.js';
import { terrainH, ISLANDS } from './world.js';
import { PACKS, PROPERTIES } from './data.js';
import { RACES } from './activities.js';
import { h } from './ui.js';

const OUT = {
  mia: { skin: 0xe0ac86, hairStyle: 5, hairColor: 0x15110e, top: 3, topColor: 0xe53935, bottom: 0, bottomColor: 0x263238, shoe: 1, shoeColor: 0x111111, hat: 0, glasses: 1, build: 0.9 },
  tony: { skin: 0xc68642, hairStyle: 2, hairColor: 0x15110e, top: 6, topColor: 0xf2f2f2, bottom: 3, bottomColor: 0xf2f2f2, shoe: 2, shoeColor: 0x111111, hat: 0, glasses: 3, watch: 3, build: 1.1 },
  hale: { skin: 0xe0ac86, hairStyle: 1, hairColor: 0x6b6b6b, top: 8, topColor: 0x4e342e, bottom: 3, bottomColor: 0x2d2a26, shoe: 2, shoeColor: 0x111111, hat: 3, hatColor: 0x3a2f28, glasses: 0, build: 1 },
  dex: { skin: 0x8d5524, hairStyle: 4, hairColor: 0x15110e, top: 5, topColor: 0xff5722, bottom: 0, bottomColor: 0x1b1b1f, shoe: 0, shoeColor: 0xf5f5f5, hat: 1, hatColor: 0x222222, glasses: 2, build: 1 },
  rosa: { skin: 0xf1c9a5, hairStyle: 6, hairColor: 0xa0361e, top: 11, topColor: 0x8d6e63, bottom: 0, bottomColor: 0x37474f, shoe: 1, shoeColor: 0x3e2723, hat: 0, glasses: 2, build: 0.92 },
  marco: { skin: 0xe0ac86, hairStyle: 3, hairColor: 0x3b2a1e, top: 2, topColor: 0x00acc1, bottom: 1, bottomColor: 0xf5f5f5, shoe: 0, shoeColor: 0xf5f5f5, hat: 4, glasses: 1, build: 1.05 },
  thug: { skin: 0xc68642, hairStyle: 0, hairColor: 0x15110e, top: 4, topColor: 0x222222, bottom: 0, bottomColor: 0x1b1b1f, shoe: 1, shoeColor: 0x111111, hat: 2, hatColor: 0x111111, glasses: 1, build: 1.08 },
  guard: { skin: 0xe0ac86, hairStyle: 1, hairColor: 0x2a1e14, top: 1, topColor: 0x37474f, bottom: 3, bottomColor: 0x263238, shoe: 2, shoeColor: 0x111111, hat: 1, hatColor: 0x263238, glasses: 1, build: 1.05 },
};
const NAMES = { ray: 'Ray', mia: 'Mia', tony: 'Tony Vega', hale: 'Det. Hale', dex: 'Dex', rosa: 'Rosa', marco: 'Marco' };

// ------------------- Cutscenes -------------------
export class Cutscene {
  constructor(G) { this.G = G; this.active = false; }
  play(def, done) {
    const G = this.G, P = G.player;
    this.def = def; this.done = done; this.active = true; this.i = 0; this.t = 0; this.actors = {};
    if (P.vehicle) P.exitVehicle(true);
    G.mode = 'cutscene'; G.ui.cine(true); G.ui.fadeTo(0, 300);
    const a = def.anchor; const yaw = def.yaw ?? 0, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
    const ids = def.actors; // z.B. ['ray','mia']
    this.saved = { pos: P.pos.clone(), yaw: P.yaw, time: G.env.time };
    ids.forEach((id, k) => {
      const off = (k - (ids.length - 1) / 2) * 2.3;
      const x = a.x + rx * off, z = a.z + rz * off;
      if (id === 'ray') { P.pos.set(x, G.world.groundY(x, z), z); P.vel.set(0, 0, 0); P.yaw = yaw + Math.PI; P.char.root.visible = true; this.actors.ray = { pos: P.pos, char: P.char, p: P }; P.char.setHeld(null); }
      else { const ped = G.peds.spawnAt(x, z, 'civ', OUT[id] || OUT.thug); ped.persist = true; ped.state = 'brain'; ped.brain = () => ({ vx: 0, vz: 0, spd: 0 }); ped.faceTarget = true; ped.noDrop = true; ped.yaw = yaw + Math.PI * (k % 2 ? 0 : 1); this.actors[id] = { pos: ped.pos, char: ped.char, p: ped }; }
    });
    // Blickrichtung zueinander
    const list = Object.values(this.actors);
    list.forEach((ac, k) => { const other = list[(k + 1) % list.length]; if (ac.p === P) P.yaw = Math.atan2(other.pos.x - ac.pos.x, other.pos.z - ac.pos.z); else { ac.p.lookAt = other.pos; } });
    if (def.time !== undefined) G.env.time = def.time;
    this.nextLine();
  }
  nextLine() {
    const G = this.G, L = this.def.lines[this.i];
    for (const ac of Object.values(this.actors)) ac.char.state.talk = false;
    if (!L) return this.end();
    const [who, text] = L; const sp = this.actors[who] || Object.values(this.actors)[0];
    sp.char.state.talk = true;
    this.dur = clamp(1.8 + text.length * 0.052, 2.3, 7); this.t = 0;
    this.speaker = sp; const others = Object.values(this.actors).filter((a) => a !== sp); this.listener = others[0] || sp;
    this.shot = [2, 0, 1, 3, 0, 4, 1][this.i % 7]; this.side = this.i % 2 ? -1 : 1;
    G.ui.subtitle(NAMES[who] || who, text, this.dur * 1000 + 400);
    G.audio?.tone?.(300 + (who.length * 37) % 120, 0.05, 'triangle', 0.04);
  }
  update(dt) {
    if (!this.active) return;
    const G = this.G, I = G.input;
    this.t += dt;
    if (I.hit('Escape')) { this.i = this.def.lines.length; this.end(); return; }
    if ((I.hit('Enter') || I.hit('Space')) && this.t > 0.6) { this.t = this.dur; }
    if (this.t >= this.dur) { this.i++; this.nextLine(); if (!this.active) return; }
    // Kamera
    const A = this.speaker.pos, B = this.listener.pos;
    let dx = A.x - B.x, dz = A.z - B.z; let l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const sx = -dz, sz = dx;
    const k = this.t / this.dur; const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
    let pos, look, fov = 42; const side = this.side;
    switch (this.shot) {
      case 0: pos = [B.x - dx * 1.5 + sx * 0.6 * side, A.y + 1.55, B.z - dz * 1.5 + sz * 0.6 * side]; look = [A.x, A.y + 1.62, A.z]; fov = 38; break;
      case 1: pos = [A.x - dx * 1.9 + sx * 0.9 * side + sx * k * 0.3, A.y + 1.62, A.z - dz * 1.9 + sz * 0.9 * side]; look = [A.x, A.y + 1.66, A.z]; fov = 34; break;
      case 2: pos = [mx + sx * (5.2 - k * 0.8) * side, A.y + 2.2, mz + sz * (5.2 - k * 0.8) * side]; look = [mx, A.y + 1.3, mz]; fov = 46; break;
      case 3: pos = [A.x - dx * 2.4 + sx * -0.5 * side, A.y + 0.55, A.z - dz * 2.4 + sz * -0.5 * side]; look = [A.x, A.y + 1.75, A.z]; fov = 40; break;
      default: pos = [mx + sx * 3.4 * side, A.y + 1.4, mz + sz * 3.4 * side - k * 0.0]; look = [mx, A.y + 1.35, mz]; fov = 36;
    }
    // Kollision der Kamera mit Gebäuden vermeiden
    const hit = G.world.rayHit(look[0], look[1], look[2], pos[0] - look[0], 0, pos[2] - look[2], Math.hypot(pos[0] - look[0], pos[2] - look[2]));
    if (hit !== null) { const dl = Math.hypot(pos[0] - look[0], pos[2] - look[2]); const kk = Math.max(0.35, (hit - 0.3) / dl); pos[0] = look[0] + (pos[0] - look[0]) * kk; pos[2] = look[2] + (pos[2] - look[2]) * kk; }
    G.player.rig.override = { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look), fov };
    // Schauen
    for (const ac of Object.values(this.actors)) if (ac.p === G.player) { const o = Object.values(this.actors).find((q) => q !== ac); if (o) G.player.yaw = dampAngle(G.player.yaw, Math.atan2(o.pos.x - ac.pos.x, o.pos.z - ac.pos.z), 6, dt); }
  }
  end() {
    const G = this.G; if (!this.active) return;
    this.active = false; G.player.rig.override = null; G.ui.cine(false); G.ui.subtitle('', '', 1);
    for (const [id, ac] of Object.entries(this.actors)) { ac.char.state.talk = false; if (ac.p !== G.player) { ac.p.persist = false; ac.p.brain = null; ac.p.state = 'idle'; ac.p.t = 0.5; ac.p.faceTarget = false; G.peds.remove(ac.p); } }
    G.player.refreshWeaponModel();
    G.mode = 'play'; G.input.lock();
    const d = this.done; this.done = null; d && d();
  }
}

// ------------------- Hilfen -------------------
const L = (s) => {
  if (typeof s === 'function') { const r = s(); return Array.isArray(r) ? { x: r[0], z: r[1], y: r[2] } : r; }
  if (typeof s === 'string') { if (s.startsWith('poi:')) { const p = G.world.pois.find((q) => q.id === s.slice(4)); return p ? { x: p.x, z: p.z } : { x: 0, z: 0 }; } return { x: 0, z: 0 }; }
  if (Array.isArray(s)) return { x: s[0], z: s[1], y: s[2] };
  return s;
};
const off = (s, dx, dz) => () => { const p = L(s); return { x: p.x + dx, z: p.z + dz }; };
const node = (i, j, dx = 0, dz = 0) => ({ x: i * 100 + dx, z: j * 100 + dz });
const car = (id, model, at, yaw, text, o = {}) => ({ t: 'vehicle', id, model, at, yaw, text, ...o });
const go = (at, text, o = {}) => ({ t: 'goto', at, text, r: 9, ...o });
const kill = (grp, n, at, text, o = {}) => ({ t: 'enemies', grp, n, at, text, ...o });
const say = (lines) => ({ t: 'say', lines });
const cut = (actors, at, lines, o = {}) => ({ t: 'cutscene', actors, at, lines, ...o });

// ------------------- Story-Daten -------------------
export const MISSIONS = [
  { id: 'welcome', title: 'Willkommen zurück', who: 'mia', at: 'poi:cafe1', reward: 2000, hint: 'Triff Mia im Café Sol (Ocean Drive).',
    intro: { actors: ['ray', 'mia'], lines: [['mia', 'Ray! Du siehst furchtbar aus. Willkommen zurück in Vice City.'], ['ray', 'Drei Jahre Zelle, Mia. Danach sieht jeder furchtbar aus.'], ['mia', 'Tony weiß, dass du draußen bist. Er will dich sehen – heute Nacht, im Club Neon.'], ['ray', 'Tony Vega? Der Kerl, wegen dem ich überhaupt eingesperrt wurde?'], ['mia', 'Er schuldet dir etwas, und du schuldest ihm eine Menge. Nimm den Wagen dort drüben. Er gehört jetzt dir.']] },
    steps: [car('c1', 'valor_lx', node(7, -1, 3.5, 40), 0, 'Steige in den Wagen', {}), go('poi:club', 'Fahre zum Club Neon', { veh: 'car' }), cut(['ray', 'tony'], 'poi:club', [['tony', 'Da ist mein alter Freund. Setz dich, Ray, wir haben viel zu besprechen.'], ['ray', 'Ich will nur meinen Anteil, Tony. Nichts weiter.'], ['tony', 'Den bekommst du. Aber zuerst brauche ich einen kleinen Gefallen. Komm morgen wieder – ich habe Arbeit für dich.']])] },
  { id: 'car', title: 'Wagen für Tony', who: 'tony', at: 'poi:club', prereq: ['welcome'], reward: 5000, hint: 'Sprich mit Tony im Club Neon.',
    intro: { actors: ['ray', 'tony'], lines: [['tony', 'Im Showroom von Premium Deluxe steht ein Phantom Aureus. Der Besitzer hat zu viel Geld und zu wenig Respekt.'], ['ray', 'Du willst, dass ich ihn klaue?'], ['tony', 'Ich nenne es Umverteilung. Bring ihn zum Hafenloft – ohne die Polizei im Schlepptau.'], ['ray', 'Natürlich, Tony. Ohne Polizei.']] },
    steps: [go('poi:dealer', 'Fahre zum Autohaus', { veh: 'any', r: 22 }), { t: 'vehicle', id: 'sc', display: 'phantom_aureus', text: 'Stiehl den Phantom Aureus', onEnter: () => G.police.setWanted(2) }, { t: 'wanted', text: 'Schüttle die Polizei ab', stars: 0 }, go('poi:loft_harbor', 'Bringe den Wagen zum Hafenloft', { need: 'sc', r: 12 })] },
  { id: 'beach', title: 'Strandgeschäft', who: 'tony', at: 'poi:club', prereq: ['car'], reward: 3500, hint: 'Tony hat neue Aufträge.',
    intro: { actors: ['ray', 'tony'], lines: [['tony', 'Gute Arbeit mit dem Phantom. Jetzt etwas Einfaches: Ein paar Ladenbesitzer an der Ocean Drive haben ihre Schutzgebühr vergessen.'], ['ray', 'Du schickst mich zum Kassieren?'], ['tony', 'Sei freundlich. Aber überzeugend.']] },
    steps: [go('poi:gelato', 'Kassiere bei Gelato Beach', { veh: 'any', r: 6 }), go('poi:juice', 'Kassiere bei Juice Palms', { veh: 'any', r: 6 }), kill('amb', 3, 'poi:juice', 'Überfall! Schalte die Schläger aus', { hostile: true, weapon: 'pistol' }), go('poi:cafe1', 'Kassiere im Café Sol', { r: 6, veh: 'any' }), go('poi:club', 'Bringe das Geld zu Tony', { r: 10, veh: 'any' })] },
  { id: 'chase', title: 'Die Verfolgung', who: 'tony', at: 'poi:club', prereq: ['beach'], reward: 4500, hint: 'Tony wartet im Club.',
    intro: { actors: ['ray', 'tony'], lines: [['tony', 'Ein Rivale lagert Ware im Hafen. Sein Fahrer ist mit einem Lieferwagen unterwegs.'], ['tony', 'Hol ihn dir, bevor er die Ware verkauft. Lass keine Spuren.'], ['ray', 'Ich mache mich auf den Weg.']] },
    steps: [go('poi:harbor', 'Fahre zum Hafen', { veh: 'car', r: 40 }), { t: 'chase', model: 'panel_van', at: node(7, 9, 3.5, 20), text: 'Zerstöre den Lieferwagen des Rivalen', color: 0x7b1fa2 }] },
  { id: 'smuggle', title: 'Hafenschmuggel', who: 'marco', at: 'poi:boatshop', prereq: ['chase'], reward: 6000, hint: 'Marco wartet an der Marina.',
    intro: { actors: ['ray', 'marco'], lines: [['marco', 'Du bist also Tonys Mann. Gut. Ich brauche jemanden, der Kisten von Isla Palmera holt.'], ['marco', 'Nimm das Speedboot. Die Küstenwache schläft nie, also halte dich im Dunkeln.'], ['ray', 'Und die Fracht?'], ['marco', 'Drei Kisten am Strand. Bring sie hierher zurück.']], time: 21 },
    steps: [car('b1', 'speedster_30', [820, 955], Math.PI, 'Steige in das Speedboot', { water: true }), go([1740, 700], 'Fahre zur Isla Palmera', { veh: 'boat', r: 40 }), { t: 'collect', pts: [[1795, 690], [1810, 725], [1830, 700]], text: 'Sammle die drei Kisten ein (zu Fuß)', r: 5 }, go([820, 955], 'Bringe die Fracht zurück zum Hafen', { veh: 'boat', r: 30, need: 'b1', limit: 420 })] },
  { id: 'sky', title: 'Himmelfahrt', who: 'rosa', at: 'poi:airshop', prereq: ['smuggle'], reward: 7500, hint: 'Rosa wartet am Flughafen.',
    intro: { actors: ['ray', 'rosa'], lines: [['rosa', 'Du brauchst eine Lizenz? Vergiss es. Hier ist eine Skyhawk – flieg einen Kreis über der Stadt.'], ['ray', 'Ich bin noch nie geflogen.'], ['rosa', 'Gas geben, Nase hoch, Daumen drücken. Und lande wieder, wenn du heil bleiben willst!']] },
    steps: [car('p1', 'skyhawk', [-1290, 850], Math.PI / 2, 'Steige in die Skyhawk (Start: Shift = Schub)', {}), { t: 'rings', pts: [[-500, 130, 800], [200, 150, 450], [900, 170, 0], [300, 150, -600], [-500, 130, -100], [-900, 90, 450]], text: 'Fliege durch die Ringe' }, go([-1000, 850], 'Lande auf der Landebahn', { veh: 'air', landed: true, r: 60, need: 'p1' })] },
  { id: 'bank', title: 'Bankjob', who: 'tony', at: 'poi:club', prereq: ['sky'], reward: 25000, hint: 'Tony plant den großen Coup.',
    intro: { actors: ['ray', 'tony'], lines: [['tony', 'Die Vice Federal Bank. Der Tresor wird heute entladen – nur ein Fenster von fünfzehn Minuten.'], ['ray', 'Und die Wachen?'], ['tony', 'Sind dein Problem. Nimm die Tasche und fahr. Das Hafenloft ist unser Treffpunkt.']] },
    steps: [go('poi:bank', 'Fahre zur Federal Bank', { veh: 'any', r: 10 }), kill('g', 4, 'poi:bank', 'Wachen ausschalten', { weapon: 'pistol', hostile: true, wanted: 2 }), { t: 'collect', pts: [() => { const p = L('poi:bank'); return [p.x - 8, p.z - 6]; }], text: 'Hole die Tasche im Foyer', r: 5, reward: 150000 }, { t: 'wanted', text: 'Entkomme der Polizei', stars: 3 }, go('poi:loft_harbor', 'Fahre zum Hafenloft', { veh: 'any', r: 14 })] },
  { id: 'traitor', title: 'Verrat', who: 'mia', at: 'poi:cafe1', prereq: ['bank'], reward: 9000, hint: 'Mia hat einen Verdacht.',
    intro: { actors: ['ray', 'mia'], lines: [['mia', 'Jemand hat der Polizei einen Tipp gegeben. Ich habe den Verräter gesehen – er fährt gleich los.'], ['ray', 'Wer ist es?'], ['mia', 'Folge ihm. Er trifft sich mit Hale in den Lagerhallen.']] },
    steps: [{ t: 'follow', model: 'vice_cab', at: node(7, -1, 3.5, 60), to: node(5, 8, 3.5, 40), text: 'Folge dem Taxi – bleibe unauffällig', max: 70 }, kill('w', 5, node(5, 8, 20, 10), 'Schalte die Männer an den Lagerhallen aus', { hostile: true, weapon: 'smg' })] },
  { id: 'race', title: 'Rennen um Vice', who: 'dex', at: 'poi:race1', prereq: ['traitor'], reward: 12000, hint: 'Dex organisiert ein Straßenrennen.',
    intro: { actors: ['ray', 'dex'], lines: [['dex', 'Tony hat mir erzählt, dass du schnell bist. Beweis es.'], ['dex', 'Drei Fahrer, eine Runde, der Sieger kassiert.'], ['ray', 'Dann los.']] },
    steps: [{ t: 'race', race: 0, text: 'Gewinne das Straßenrennen' }] },
  { id: 'rooftop', title: 'Rooftop-Rettung', who: 'tony', at: 'poi:club', prereq: ['race'], reward: 15000, hint: 'Tony braucht einen Piloten.',
    intro: { actors: ['ray', 'tony'], lines: [['tony', 'Mia sitzt auf dem Dach des Krankenhauses fest – die Polizei ist hinter ihr her.'], ['ray', 'Ich hole sie mit einem Helikopter raus.'], ['tony', 'Genau. Schweb über dem Dach, sie klettert hoch.']] },
    steps: [car('h1', 'ranger_heli', [-760, 735], Math.PI, 'Steige in den Helikopter (Space = steigen)', {}), { t: 'hover', at: 'poi:hospital', text: 'Schwebe über dem Krankenhausdach (30–60 m)', r: 38, min: 26, max: 70, time: 5 }, { t: 'wanted', text: 'Die Polizei verfolgt dich! Entkomme!', stars: 3 }, go([-1000, 800], 'Lande am Flughafen', { veh: 'air', landed: true, r: 70 })] },
  { id: 'coup', title: 'Der große Coup', who: 'tony', at: 'poi:club', prereq: ['rooftop'], reward: 50000, hint: 'Tony hat das letzte große Ding geplant.',
    intro: { actors: ['ray', 'tony', 'mia'], lines: [['tony', 'Hillcrest Mansion. Der Besitzer ist ein Kartellboss. Wir räumen seine Tresore leer.'], ['mia', 'Es sind acht Männer im Haus. Und die Polizei wird kommen.'], ['ray', 'Dann machen wir es schnell.']] },
    steps: [go('poi:hillcrest', 'Fahre nach Sunset Hills (Hillcrest Mansion)', { veh: 'any', r: 40 }), kill('v', 8, 'poi:hillcrest', 'Besiege die Leibwächter', { weapon: 'smg', hostile: true, wanted: 3, spread: 28 }), { t: 'wanted', text: 'Entkomme der Polizei – 4 Sterne!', stars: 4 }, go('poi:loft_harbor', 'Treffpunkt: Hafenloft', { veh: 'any', r: 16 })] },
  { id: 'finale', title: 'Abrechnung', who: 'tony', at: 'poi:club', prereq: ['coup'], reward: 100000, hint: 'Das Finale auf Isla Azul.',
    intro: { actors: ['ray', 'tony'], lines: [['tony', 'Du hast mehr Mut, als ich dachte, Ray.'], ['ray', 'Und du hast mich drei Jahre sitzen lassen.'], ['tony', 'Das ist Vergangenheit. Triff mich auf meiner Insel – ich zahle dir alles aus.'], ['ray', 'Ich glaube dir kein Wort. Aber ich komme.']] },
    steps: [car('f1', 'cruiser_45', [1290, -940], 0.9, 'Steige in die Yacht (oder fliege mit Heli/Flugzeug) – Ziel: Isla Azul', { water: true }), go([1640, -1500], 'Fahre nach Isla Azul', { veh: 'any', r: 70 }), kill('t', 7, [1740, -1500], 'Besiege Tonys Leibwache', { weapon: 'rifle', hostile: true, spread: 30 }), { t: 'boss', at: [1750, -1520], text: 'Besiege Tony Vega' }, cut(['ray', 'tony'], [1740, -1500], [['tony', 'Du ... hast gewonnen. Wie ... ironisch.'], ['ray', 'Vice City gehört denen, die bleiben, Tony. Nicht denen, die verraten.']], { time: 7 })] },
  // ---- Pack-Missionen ----
  { id: 'lux1', title: 'Hypercar-Lieferung', who: 'tony', at: 'poi:dealer', pack: 'luxus', reward: 30000, hint: 'Luxus-Pack: Liefere einen Hypercar ohne Kratzer.', steps: [car('z', 'zenith_x', node(3, 3, 3.5, 40), 0, 'Steige in den Zenith X', {}), go('poi:penthouse', 'Liefere ihn zum Skyline Penthouse – er darf nicht beschädigt werden!', { need: 'z', r: 12, keepHealth: 700 })] },
  { id: 'lux2', title: 'Juwelenraub', who: 'tony', at: 'poi:jewel', pack: 'luxus', reward: 40000, hint: 'Luxus-Pack: Chrono Luxe.', steps: [go('poi:jewel', 'Gehe zu Chrono Luxe', { r: 6, veh: 'foot' }), { t: 'wait', time: 8, text: 'Vitrinen werden geleert …' }, { t: 'wanted', text: 'Entkomme der Polizei', stars: 3 }, go('poi:loft_harbor', 'Fahre zum Hafenloft', { veh: 'any', r: 14 })] },
  { id: 'isl1', title: 'Schatzsuche', who: 'marco', at: 'poi:boatshop', pack: 'insel', reward: 20000, hint: 'Insel-Pack: Piratenschatz auf Isla Esmeralda.', steps: [car('b2', 'dinghy', [760, 960], Math.PI, 'Steige ins Schlauchboot', { water: true }), go([1860, -500], 'Fahre nach Isla Esmeralda', { veh: 'boat', r: 80 }), { t: 'collect', pts: [[1960, -520], [1930, -450], [1980, -560]], text: 'Finde die drei Schatztruhen', r: 6, reward: 4000 }] },
  { id: 'isl2', title: 'Inselparty-Fähre', who: 'marco', at: 'poi:boatshop', pack: 'insel', reward: 18000, hint: 'Insel-Pack: Gäste nach Isla Palmera bringen.', steps: [car('b3', 'jetski_splash', [830, 950], Math.PI, 'Steige auf den Jetski', { water: true }), go([1745, 705], 'Fahre nach Isla Palmera', { veh: 'boat', r: 40, limit: 240 }), go([830, 950], 'Zurück zur Marina', { veh: 'boat', r: 30 })] },
  { id: 'fly1', title: 'Luftpost', who: 'rosa', at: 'poi:airshop', pack: 'flug', reward: 25000, hint: 'Flugzeug-Pack: Frachtflug.', steps: [car('p2', 'cargo_dash', [-1290, 850], Math.PI / 2, 'Steige in die Cargo Dash', {}), { t: 'rings', pts: [[-400, 150, 800], [700, 190, 600], [1000, 200, 100], [200, 160, -400], [-700, 120, 300]], text: 'Liefere die Fracht durch die Ringe' }, go([-1000, 850], 'Lande am Flughafen', { veh: 'air', landed: true, r: 70 })] },
  { id: 'fly2', title: 'Stunt-Show', who: 'rosa', at: 'poi:airshop', pack: 'flug', reward: 30000, hint: 'Flugzeug-Pack: Kunstflug.', steps: [car('p3', 'stunt_falcon', [-1290, 850], Math.PI / 2, 'Steige in den Stuntflieger', {}), { t: 'rings', pts: [[-600, 60, 700], [-100, 70, 300], [300, 80, 100], [700, 70, -200], [300, 90, -500], [-300, 80, -200]], text: 'Fliege tief durch die Stadt' }, go([-1000, 850], 'Lande auf der Piste', { veh: 'air', landed: true, r: 70 })] },
  { id: 'yac1', title: 'Yachtüberführung', who: 'marco', at: 'poi:boatshop', pack: 'yacht', reward: 45000, hint: 'Yacht-Pack: Überführe die Yacht.', steps: [car('y1', 'yacht_serenity', [900, 1010], Math.PI * 0.5, 'Gehe an Bord der Yacht Serenity', { water: true }), go([1580, 1580], 'Überführe die Yacht zur Isla del Sol', { veh: 'boat', r: 70 })] },
  { id: 'yac2', title: 'Hochseeregatta', who: 'marco', at: 'poi:boatshop', pack: 'yacht', reward: 25000, hint: 'Yacht-Pack: Regatta gewinnen.', steps: [{ t: 'race', def: 'regatta', text: 'Gewinne die Regatta' }] },
  { id: 'rac1', title: 'Zeitfahren', who: 'dex', at: 'poi:race2', pack: 'renn', reward: 15000, hint: 'Rennsport-Pack: Zeitrennen.', steps: [{ t: 'race', def: 'trial', text: 'Schlage die Zeit (150 s)' }] },
  { id: 'rac2', title: 'Grand Prix', who: 'dex', at: 'poi:race1', pack: 'renn', reward: 35000, hint: 'Rennsport-Pack: 3 Runden.', steps: [{ t: 'race', def: 'gp', text: 'Gewinne den Grand Prix' }] },
  { id: 'nit1', title: 'Club-Promoter', who: 'tony', at: 'poi:club', pack: 'nacht', reward: 10000, hint: 'Nachtleben-Pack: Verteile VIP-Bänder.', steps: [{ t: 'talk', n: 3, at: 'poi:club', text: 'Sprich 3 Partygäste an und verteile VIP-Bänder (E)' }] },
  { id: 'nit2', title: 'Nachtfahrt', who: 'tony', at: 'poi:club', pack: 'nacht', reward: 16000, hint: 'Nachtleben-Pack: VIP-Fahrgäste.', steps: [{ t: 'time', from: 20, to: 5 }, go('poi:casino', 'Bringe die VIP-Gäste zum Casino', { veh: 'car', r: 12 }), go('poi:mall', 'Weiter zur Galleria', { veh: 'car', r: 12 }), go('poi:club', 'Zurück zum Club Neon', { veh: 'car', r: 12 })] },
];

// ------------------- Missionssystem -------------------
export class MissionSys {
  constructor(G) {
    this.G = G; this.done = {}; this.current = null; this.cut = new Cutscene(G); this.markers = new Map(); this.contacts = new Map(); this.defs = MISSIONS; this.promptDef = null; this.promptList = []; this._blips = [];
  }
  init() { this.refreshAvailable(); }
  def(id) { return this.defs.find((d) => d.id === id); }
  doneCount() { return Object.keys(this.done).length; }
  available(d) { return !this.done[d.id] && (!d.pack || this.G.eco.packs[d.pack]) && (!d.prereq || d.prereq.every((p) => this.done[p])) && !(this.current && this.current.def === d); }
  refreshAvailable() {
    const G = this.G;
    for (const [id, m] of this.markers) { G.markers.remove(m); } this.markers.clear();
    for (const d of this.defs) {
      if (!this.available(d)) continue;
      const p = L(d.at); const m = G.markers.add({ x: p.x, z: p.z, color: d.pack ? 0xffd54f : 0xffffff, r: 2.6, far: 700, y: terrainH(p.x, p.z) });
      this.markers.set(d.id, m);
    }
  }
  blips() {
    const out = [];
    for (const d of this.defs) if (this.available(d) && !this.current) { const p = L(d.at); out.push({ x: p.x, z: p.z, icon: d.pack ? '★' : d.who === 'tony' ? 'T' : 'M', color: d.pack ? '#c79a1a' : '#e0e0e0' }); }
    if (this.current) for (const b of this.current.blips) out.push({ x: b.x, z: b.z, icon: '◎', color: '#ffc107' });
    return out;
  }
  prompt() { return this.promptDef ? `<kbd>E</kbd> ${this.promptList.length > 1 ? 'Missionen (' + this.promptList.length + ')' : 'Mission starten: ' + this.promptDef.title}` : ''; }
  serialize() { return { done: this.done }; }
  deserialize(d) { this.done = d?.done || {}; if (this.current) this.abort(true); this.refreshAvailable(); }
  logRows(ui) {
    const rows = [];
    const cur = this.current;
    if (cur) rows.push(h('div', { class: 'row', style: { borderColor: '#ffd54f' } }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'Aktiv: ' + cur.def.title), h('div', { class: 'd' }, cur.step?.text || '')), h('button', { class: 'btn small', onClick: () => { const b = cur.blips[0]; if (b) { this.G.waypoint = { x: b.x, z: b.z }; ui.toast('GPS gesetzt'); } } }, 'GPS')));
    for (const d of this.defs) {
      const done = this.done[d.id], av = this.available(d);
      if (!done && !av && !(d.pack && !this.G.eco.packs[d.pack])) continue;
      const locked = d.pack && !this.G.eco.packs[d.pack];
      rows.push(h('div', { class: 'row' + (locked ? ' locked' : '') }, h('div', { class: 'grow' }, h('div', { class: 't' }, d.title, d.pack && h('span', { class: 'pill pack' }, PACKS[d.pack].name), done && h('span', { class: 'pill' }, '✓ abgeschlossen')), h('div', { class: 'd' }, `${d.hint} · Belohnung ${fmtMoney(d.reward * (G.cfg?.reward ?? 1))}`)), av && h('button', { class: 'btn small', onClick: () => { const p = L(d.at); this.G.waypoint = { x: p.x, z: p.z }; ui.toast('GPS gesetzt: ' + d.title); ui.routeT = 0; } }, 'GPS')));
    }
    rows.push(h('h3', {}, 'Aktivitäten'), h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'Taxi, Kurier, Bürgerwehr, Straßenrennen'), h('div', { class: 'd' }, 'Symbole auf der Karte (💼 🏁). Stuntsprünge: ' + Object.keys(this.G.activities.stuntFound).length + ' · Pakete: ' + Object.keys(this.G.found.packages).length + '/' + this.G.packagePts.length))));
    return rows;
  }
  // ---- Ablauf ----
  start(d) {
    const G = this.G;
    if (this.current || G.activities.race || G.activities.job) return G.ui.toast('Beende zuerst deine aktuelle Aufgabe.');
    this.current = { def: d, idx: -1, ctx: { ents: {}, mk: [], enemies: [], tmp: [] }, blips: [], blocking: true, step: null, t: 0 };
    const m = this.markers.get(d.id); if (m) m.hidden = true;
    G.ui.setObjective(d.title, '');
    const begin = () => this.nextStep();
    if (d.intro) { G.police.suppress = true; this.cut.play({ actors: d.intro.actors, anchor: this.anchorFor(d), yaw: this.anchorYaw(d), lines: d.intro.lines, time: d.intro.time }, () => { G.police.suppress = false; begin(); }); }
    else begin();
  }
  anchorFor(d) { const p = L(d.at); return { x: p.x + 0, z: p.z + 0 }; }
  anchorYaw(d) { const p = L(d.at); const W = this.G.world; // Blick von der Straße weg zum Gebäude hin
    const b = W.blocks.find((q) => p.x > q.x0 - 12 && p.x < q.x1 + 12 && p.z > q.z0 - 12 && p.z < q.z1 + 12); if (!b) return 0; const dx = b.cx - p.x, dz = b.cz - p.z; return Math.atan2(-dz, dx) * 0 + (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? Math.PI / 2 + Math.PI / 2 : -Math.PI / 2 + Math.PI / 2) : 0); }
  nextStep() {
    const G = this.G, m = this.current; if (!m) return;
    if (m.step) this.endStep(m.step);
    m.idx++;
    if (m.idx >= m.def.steps.length) return this.pass();
    const S = m.def.steps[m.idx]; m.step = S; m.t = 0; m.blips.length = 0; S._st = {};
    G.ui.setObjective(m.def.title, S.text || '');
    G.audio?.pickup();
    const H = HANDLERS[S.t]; H.start?.(this, S, m);
  }
  endStep(S) { HANDLERS[S.t]?.end?.(this, S, this.current); }
  update(dt) {
    const G = this.G; this.cut.update(dt);
    const m = this.current;
    if (!m) { this.proximity(dt); return; }
    this.promptDef = null;
    if (!G.player.alive) return;
    if (m.step) {
      m.t += dt; const S = m.step;
      if (S.limit) { S._st.left = (S._st.left ?? S.limit) - dt; if (S._st.left <= 0) return this.fail('Zeit abgelaufen!'); }
      if (HANDLERS[S.t].update?.(this, S, m, dt)) this.nextStep();
    }
    // Missionsfahrzeug zerstört?
    for (const [id, v] of Object.entries(m.ctx.ents)) { if (v && v.spec && v.exploded && m.step?.need === id) return this.fail('Das Missionsfahrzeug wurde zerstört.'); }
  }
  hud(ui) { const m = this.current; if (!m || !m.step) return; const S = m.step; const left = S._st?.left; ui.setObjective(m.def.title, S.text || '', left !== undefined ? left : null); }
  proximity(dt) {
    const G = this.G, P = G.player; this.promptDef = null;
    if (G.mode !== 'play' || !P.alive || P.vehicle || G.activities.race || G.activities.job || G.ui.blocking) { this.contactUpdate(); return; }
    this.promptList = [];
    for (const d of this.defs) { if (!this.available(d)) continue; const p = L(d.at); if (Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < 3.4) this.promptList.push(d); }
    this.promptDef = this.promptList[0] || null;
    if (this.promptDef && G.input.hit('KeyE')) {
      if (this.promptList.length === 1) this.start(this.promptDef);
      else { const body = h('div', { class: 'body' }, ...this.promptList.map((d) => h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, d.title, d.pack && h('span', { class: 'pill pack' }, PACKS[d.pack].name)), h('div', { class: 'd' }, `${d.hint} · Belohnung ${fmtMoney(d.reward * (G.cfg?.reward ?? 1))}`)), h('button', { class: 'btn small primary', onClick: () => { G.ui.closeModal(); this.start(d); } }, 'Starten')))); G.ui.modal('Missionen verfügbar', body, { cash: false }); }
    }
    this.contactUpdate();
  }
  contactUpdate() {
    const G = this.G, pp = G.player.position;
    for (const d of this.defs) {
      const has = this.contacts.get(d.id); const near = this.available(d) && !this.current && Math.hypot(L(d.at).x - pp.x, L(d.at).z - pp.z) < 90;
      if (near && !has) { const p = L(d.at); const o = OUT[d.who] || OUT.thug; const ped = G.peds.spawnAt(p.x + 1.6, p.z, 'civ', o); ped.persist = true; ped.noDrop = true; ped.state = 'brain'; ped.brain = () => ({ vx: 0, vz: 0, spd: 0 }); ped.faceTarget = true; ped.lookAt = G.player.pos; this.contacts.set(d.id, ped); }
      else if (!near && has) { has.persist = false; G.peds.remove(has); this.contacts.delete(d.id); }
    }
  }
  abort(silent = false) { const m = this.current; if (!m) return; this.cleanup(); this.current = null; this.G.police.suppress = false; this.G.ui.setObjective(null); this.refreshAvailable(); }
  cleanup() {
    const G = this.G, m = this.current; if (!m) return;
    if (m.step) this.endStep(m.step);
    for (const k of m.ctx.mk) G.markers.remove(k);
    for (const p of m.ctx.enemies) { p.persist = false; if (p.alive) { G.peds.remove(p); } }
    for (const v of Object.values(m.ctx.ents)) if (v && v.spec) { v.missionVehicle = false; v.keep = false; v.ctrl = v.ai ? v.ctrl : null; if (!v.player && v.tag !== 'owned') v.tag = 'abandoned'; if (v.ai && v.ai.mission) { v.ctrl = null; v.ai = null; v.driver = null; } }
    G.waypoint = null;
  }
  fail(reason) {
    const G = this.G; if (!this.current) return;
    G.ui.banner('MISSION GESCHEITERT', '#ff5252'); G.ui.toast(reason || 'Mission gescheitert'); G.audio?.missionFail(); setTimeout(() => G.ui.banner(null), 2600);
    this.abort();
  }
  onPlayerFail(why) { if (this.current) this.fail(why === 'busted' ? 'Du wurdest festgenommen.' : 'Du bist gestorben.'); }
  pass() {
    const G = this.G, m = this.current, d = m.def;
    this.cleanup(); const done = () => {
      this.current = null; this.done[d.id] = true; G.player.addMoney(d.reward, 'Mission'); G.player.stats.missions++; G.police.suppress = false;
      G.ui.banner('MISSION ERFOLGREICH', '#ffd54f'); G.ui.toast(`${d.title}: +${fmtMoney(d.reward * (G.cfg?.reward ?? 1))}`); G.audio?.missionPass(); setTimeout(() => G.ui.banner(null), 3000);
      G.ui.setObjective(null); this.refreshAvailable(); G.eco.save('auto');
      if (d.id === 'finale') setTimeout(() => G.ui.toast('🎉 Die Hauptgeschichte ist abgeschlossen! Erkunde weiter, kaufe Packs und Inseln.', 8000), 3500);
    };
    done();
  }
}

// ------------------- Schritt-Handler -------------------
const mk = (m, o) => { const k = G.markers.add(o); m.ctx.mk.push(k); return k; };
const aim = (m, S, p) => { m.blips[0] = { x: p.x, z: p.z }; G.waypoint = { x: p.x, z: p.z }; };
function spawnEnemy(m, x, z, o) {
  const outfit = [OUT.thug, OUT.guard][Math.floor(Math.random() * 2)];
  const ped = G.peds.spawnAt(x, z, 'civ', outfit); ped.type = 'enemy'; ped.hostile = true; ped.persist = true; ped.noDrop = false; ped.health = o.hp || 70; ped.weapon = o.weapon || 'pistol'; ped.holding = false; ped.cash = 15 + Math.floor(Math.random() * 50);
  ped.brain = (dt, p) => enemyBrain(dt, p, o);
  m.ctx.enemies.push(ped); return ped;
}
function enemyBrain(dt, p, o) {
  const pl = G.player, W = G.world; p.state = 'brain';
  const dx = pl.position.x - p.pos.x, dz = pl.position.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
  if (d > (o.alert || 70)) { p.char.state.aiming = false; return { vx: 0, vz: 0, spd: 0 }; }
  const ox = p.pos.x, oy = p.pos.y + 1.5, oz = p.pos.z;
  const los = W.rayHit(ox, oy, oz, dx / d, ((pl.position.y + 1) - oy) / d, dz / d, d) === null;
  p.faceTarget = true; p.lookAt = { x: pl.position.x, z: pl.position.z };
  p.char.state.aiming = los && d < 45;
  p.cooldown -= 0;
  if (los && d < 50 && p.cooldown <= 0 && !G.cheat?.noShoot) {
    p.cooldown = p.weapon === 'pistol' ? 0.9 : 0.2;
    const m = new THREE.Vector3(p.pos.x + Math.sin(p.yaw) * 0.4, p.pos.y + 1.4, p.pos.z + Math.cos(p.yaw) * 0.4);
    const tgt = new THREE.Vector3(pl.position.x, pl.position.y + (pl.vehicle ? 0.9 : 1.1), pl.position.z);
    G.combat.fire(p, m, tgt.sub(m).normalize(), p.weapon, { spreadMul: 3.2, dmgMul: 0.42 });
  }
  if (los && d < 16) return { vx: 0, vz: 0, spd: 0 };
  const sp = 4.2; return { vx: dx / d * sp, vz: dz / d * sp, spd: sp };
}
const inKind = (v, k) => !k || k === 'any' ? true : k === 'foot' ? !v : k === 'car' ? v && (v.kind === 'car' || v.kind === 'bike') : k === 'boat' ? v && v.kind === 'boat' : k === 'air' ? v && (v.kind === 'plane' || v.kind === 'heli') : true;
const HANDLERS = {
  goto: {
    start(M, S, m) { const p = L(S.at); S._p = p; S._m = mk(m, { x: p.x, z: p.z, color: 0xffd54f, r: Math.max(2.5, S.r * 0.6), far: 3000, big: true, y: terrainH(p.x, p.z) + (p.y ? 0 : 0) }); aim(m, S, p); },
    update(M, S, m) {
      const P = G.player, v = P.vehicle, p = S._p;
      if (S.need) { const nv = m.ctx.ents[S.need]; if (nv && v !== nv) { S._st.warn = true; G.ui.subtitle('', 'Steige wieder in das Missionsfahrzeug!', 400); return false; } }
      if (S.keepHealth) { const nv = m.ctx.ents[S.need]; if (nv && nv.health < S.keepHealth) { M.fail('Das Fahrzeug wurde zu stark beschädigt.'); return false; } }
      const pos = P.position; const d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (!inKind(v, S.veh)) return false;
      if (d > S.r) return false;
      if (S.landed) { if (!(v && (v.pos.y - v.gnd) < 3.5 && v.speed < 14)) return false; }
      return true;
    },
  },
  vehicle: {
    start(M, S, m) {
      let v = null;
      if (S.display) { v = G.vehicles.list.find((q) => q.display && q.spec.key === S.display); if (!v) { const dp = G.world.displaySpots[0]; v = G.vehicles.spawn(S.display, dp.x, dp.z, dp.yaw, { sleep: false }); } v.display = false; v.locked = false; v.keep = true; }
      else { const p = L(S.at); const y = terrainH(p.x, p.z); v = G.vehicles.spawn(S.model, p.x, p.z, S.yaw ?? 0, { sleep: false }); if (S.water) { v.pos.y = -0.3; } }
      v.missionVehicle = true; v.keep = true; v.tag = 'mission'; v.sleeping = false; if (S.color) v.setColor(S.color);
      m.ctx.ents[S.id] = v; S._v = v; S._m = mk(m, { x: v.pos.x, z: v.pos.z, color: 0x69f0ae, r: 2, far: 3000, y: v.pos.y, big: true }); aim(m, S, v.pos);
      if (S.display) v.in.brake = 0;
    },
    update(M, S, m) { const v = S._v; if (!v) return true; S._m.x = v.pos.x; S._m.z = v.pos.z; S._m.group.position.set(v.pos.x, v.pos.y, v.pos.z); aim(m, S, v.pos); if (G.player.vehicle === v) { S.onEnter && S.onEnter(); return true; } if (v.exploded) { M.fail('Das Fahrzeug wurde zerstört.'); return false; } return false; },
  },
  collect: {
    start(M, S, m) { S._pts = S.pts.map((q) => { const p = L(q); return { x: p.x, z: p.z, m: mk(m, { x: p.x, z: p.z, color: 0xffd54f, r: 2, far: 1500, y: terrainH(p.x, p.z) }), got: false }; }); aim(m, S, S._pts[0]); },
    update(M, S, m) { const P = G.player.position; let left = 0; for (const q of S._pts) { if (q.got) continue; if (Math.hypot(q.x - P.x, q.z - P.z) < S.r) { q.got = true; G.markers.remove(q.m); G.audio?.pickup(); if (S.reward) { G.player.addMoney(S.reward / S._pts.length); } G.ui.toast('Eingesammelt'); } else left++; } const nx = S._pts.find((q) => !q.got); if (nx) aim(m, S, nx); return left === 0; },
  },
  enemies: {
    start(M, S, m) {
      const p = L(S.at); S._p = p; const rng = new RNG(S.grp.length * 7 + 3);
      for (let i = 0; i < S.n; i++) { const a = rng.range(0, 6.28), r = rng.range(6, S.spread || 20); let x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (G.world.pushCircle(x, z, 0.5, 0.5).hit) { x = p.x + Math.cos(a) * 4; z = p.z + Math.sin(a) * 4; } spawnEnemy(m, x, z, { weapon: S.weapon, hp: S.hp }); }
      if (S.wanted) G.police.setWanted(S.wanted); aim(m, S, p);
    },
    update(M, S, m) { const alive = m.ctx.enemies.filter((e) => e.alive && !e._tag); const n = alive.length; S.text = S.text.replace(/ \(\d+\)$/, '') + ` (${n})`; m.blips.length = 0; for (const e of alive.slice(0, 6)) m.blips.push({ x: e.pos.x, z: e.pos.z }); if (alive[0]) G.waypoint = { x: alive[0].pos.x, z: alive[0].pos.z }; return n === 0; },
    end(M, S, m) { for (const e of m.ctx.enemies) e._tag = true; },
  },
  boss: {
    start(M, S, m) { const p = L(S.at); const ped = spawnEnemy(m, p.x, p.z, { weapon: 'rifle', hp: 450, alert: 120 }); ped.char.setOutfit(OUT.tony); ped.maxHp = 450; S._b = ped; aim(m, S, p); G.ui.toast('Tony Vega ist bewaffnet!'); },
    update(M, S, m) { const b = S._b; if (b) { aim(m, S, b.pos); m.blips[0] = { x: b.pos.x, z: b.pos.z }; } return !b || !b.alive; },
  },
  wanted: {
    start(M, S, m) { if (S.stars) G.police.setWanted(S.stars); S._st.armed = false; S._t = 0; },
    update(M, S, m, dt) { S._t += dt; if (S._t < 1.5) return false; return G.police.stars === 0; },
  },
  wait: { update(M, S, m, dt) { S._st.t = (S._st.t || 0) + dt; S.text = `${S.text.replace(/ \(\d+\)$/, '')} (${Math.max(0, Math.ceil(S.time - S._st.t))})`; return S._st.t >= S.time; } },
  say: { start(M, S, m) { S._i = 0; S._t = 0; const [w, t] = S.lines[0]; G.ui.subtitle(NAMES[w] || w, t, 3200); }, update(M, S, m, dt) { S._t += dt; if (S._t > 3.4) { S._t = 0; S._i++; if (S._i >= S.lines.length) return true; const [w, t] = S.lines[S._i]; G.ui.subtitle(NAMES[w] || w, t, 3200); } return false; } },
  cutscene: { start(M, S, m) { G.police.suppress = true; S._done = false; const p = L(S.at); M.cut.play({ actors: S.actors, anchor: p, yaw: S.yaw ?? 0, lines: S.lines, time: S.time }, () => { S._done = true; G.police.suppress = false; }); }, update(M, S) { return S._done; } },
  chase: {
    start(M, S, m) {
      const p = L(S.at); const n = G.world.nearestNode(p.x, p.z, 200); const o = n.out[0];
      const v = G.vehicles.spawn(S.model, n.x + 3.5, n.z + 8, Math.atan2(o.dx, o.dz), { sleep: false, color: S.color }); v.missionVehicle = true; v.keep = true; v.tag = 'target';
      G.traffic.makeDriver(v, n, o.to); v.ai.pers = 1.5; v.ai.mission = true; v.health = 1000; S._v = v; m.ctx.ents.target = v; S._m = mk(m, { x: v.pos.x, z: v.pos.z, color: 0xff5252, r: 3, far: 3000, big: true });
      S._fleeT = 0; v.ai.panic = 0;
    },
    update(M, S, m, dt) {
      const v = S._v, P = G.player.position; if (!v) return true;
      S._m.x = v.pos.x; S._m.z = v.pos.z; S._m.group.position.set(v.pos.x, v.pos.y, v.pos.z); aim(m, S, v.pos);
      if (v.ai) { if (v.health < 800 && v.ai.panic <= 0) v.ai.panic = 3; }
      if (v.exploded || (v.speed < 1.5 && v.health < 520 && Math.hypot(v.pos.x - P.x, v.pos.z - P.z) < 25)) { if (!v.exploded) G.vehicles.explode(v, G.player); return true; }
      const d = Math.hypot(v.pos.x - P.x, v.pos.z - P.z);
      if (d > 360) { S._fleeT += dt; if (S._fleeT > 12) M.fail('Das Ziel ist entkommen.'); } else S._fleeT = 0;
      return false;
    },
  },
  follow: {
    start(M, S, m) {
      const p = L(S.at), W = G.world; const a = W.nearestNode(p.x, p.z, 200), tp = L(S.to), b = W.nearestNode(tp.x, tp.z, 300); const o = a.out[0];
      const v = G.vehicles.spawn(S.model, a.x + 3.5, a.z + 10, Math.atan2(o.dx, o.dz), { sleep: false, color: 0xffc107 }); v.missionVehicle = true; v.keep = true; v.tag = 'target';
      const path = W.findPath(a, b, 3000) || [a, b]; const drv = new RouteDriver(G, v, { pers: 0.8 }); drv.pts = path.map((n) => ({ x: n.x + 3.5, z: n.z, lim: 13 })); drv.i = 0; drv.mission = true; v.ai = drv; v.driver = drv;
      v.ctrl = (dt) => { if (v.exploded) return; const ob = drv.obstacle(15 + v.speed); const sg = drv.signalLimit(); const l2 = drv.follow(dt, 13); drv.speedControl(dt, Math.min(l2 ?? 13, ob, 99)); };
      S._v = v; m.ctx.ents.target = v; S._dest = b; S._m = mk(m, { x: v.pos.x, z: v.pos.z, color: 0xffd54f, r: 3, far: 3000, big: true }); S._far = 0;
    },
    update(M, S, m, dt) { const v = S._v, P = G.player.position; S._m.x = v.pos.x; S._m.z = v.pos.z; S._m.group.position.set(v.pos.x, v.pos.y, v.pos.z); aim(m, S, v.pos); const d = Math.hypot(v.pos.x - P.x, v.pos.z - P.z); if (d > (S.max || 70)) { S._far += dt; G.ui.subtitle('', 'Bleib dem Ziel auf den Fersen!', 300); if (S._far > 8) M.fail('Du hast das Ziel verloren.'); } else S._far = 0; if (v.exploded) { M.fail('Das Ziel wurde zerstört.'); return false; } const dd = Math.hypot(v.pos.x - S._dest.x, v.pos.z - S._dest.z); if (dd < 16) { v.ctrl = null; v.in.brake = 1; v.in.throttle = 0; return true; } return false; },
  },
  rings: {
    start(M, S, m) { S._i = 0; HANDLERS.rings.mkRing(M, S, m); },
    mkRing(M, S, m) { const q = S.pts[S._i]; const next = S.pts[S._i + 1] || S.pts[S._i]; if (S._rg) { G.scene.remove(S._rg.group); const ix = G.markers.list.indexOf(S._rg); if (ix >= 0) G.markers.list.splice(ix, 1); } S._rg = G.activities.ring({ x: q[0], y: q[1], z: q[2] }, S._i === S.pts.length - 1 ? 0x00e5ff : 0xffd54f, { x: next[0], z: next[2] }); S.text = `${S.text.split(' (')[0]} (${S._i + 1}/${S.pts.length})`; G.ui.setObjective(M.current.def.title, S.text); m.blips[0] = { x: q[0], z: q[2] }; },
    update(M, S, m) { const v = G.player.vehicle; if (!v || (v.kind !== 'plane' && v.kind !== 'heli')) return false; const q = S.pts[S._i]; if (Math.hypot(q[0] - v.pos.x, q[2] - v.pos.z, (q[1] - v.pos.y) * 0.8) < 24) { G.audio?.pickup(); S._i++; if (S._i >= S.pts.length) return true; HANDLERS.rings.mkRing(M, S, m); } return false; },
    end(M, S) { if (S._rg) { G.scene.remove(S._rg.group); const ix = G.markers.list.indexOf(S._rg); if (ix >= 0) G.markers.list.splice(ix, 1); S._rg = null; } },
  },
  hover: {
    start(M, S, m) { const p = L(S.at); S._p = p; S._m = mk(m, { x: p.x, z: p.z, color: 0x00e5ff, r: 12, far: 3000, big: true, height: 3 }); aim(m, S, p); S._st.t = 0; },
    update(M, S, m, dt) { const v = G.player.vehicle, p = S._p; if (!v || v.kind !== 'heli') return false; const alt = v.pos.y - v.gnd; const ok = Math.hypot(p.x - v.pos.x, p.z - v.pos.z) < S.r && alt > S.min && alt < S.max && v.speed < 9; if (ok) S._st.t += dt; else S._st.t = Math.max(0, S._st.t - dt * 2); S.text = `${S.text.split(' [')[0]} [${Math.max(0, S.time - S._st.t).toFixed(0)} s]`; return S._st.t >= S.time; },
  },
  race: {
    start(M, S, m) {
      const defs = { regatta: null, trial: { name: 'Zeitfahren Küstenhatz', kind: 'car', model: 'bolide_sp', laps: 1, opp: 0, fee: 0, reward: [15000, 0, 0], cps: RACES[1].cps, limit: 150 }, gp: { name: 'Grand Prix', kind: 'car', model: 'nitro_gtr', laps: 3, opp: 3, fee: 0, reward: [35000, 15000, 5000], cps: RACES[0].cps } };
      S._done = false; G.police.suppress = true;
      const cb = (win) => { S._done = true; S._win = win; };
      if (S.def === 'regatta') { G.activities.startRegatta(); G.activities.race.onEnd = cb; return; }
      const d = S.def ? defs[S.def] : { ...RACES[S.race], fee: 0 };
      G.activities.beginRace(d, cb);
    },
    update(M, S) { if (!S._done) return false; if (!S._win) { M.fail('Rennen verloren.'); return false; } return true; },
    end() { G.police.suppress = false; },
  },
  talk: {
    start(M, S, m) { const p = L(S.at); S._got = 0; S._peds = []; for (let i = 0; i < S.n; i++) { const a = i / S.n * 6.28, x = p.x + Math.cos(a) * 12, z = p.z + 14 + Math.sin(a) * 6; const ped = G.peds.spawnAt(x, z, 'civ', { ...G.peds.randomOutfit(), top: 6, topColor: 0x111111 }); ped.persist = true; ped.state = 'idle'; ped.t = 9999; ped.noDrop = true; const k = mk(m, { x, z, color: 0xe040fb, r: 1.6, far: 600 }); S._peds.push({ ped, k, done: false }); m.ctx.tmp.push(ped); } aim(m, S, p); },
    update(M, S, m) { const P = G.player; for (const q of S._peds) { if (q.done) continue; if (Math.hypot(q.ped.pos.x - P.pos.x, q.ped.pos.z - P.pos.z) < 2.4 && G.input.hit('KeyE')) { q.done = true; G.markers.remove(q.k); S._got++; G.ui.say(q.ped, 'Danke für das Band!', 2.4); G.audio?.pickup(); } } return S._got >= S.n; },
    end(M, S) { for (const q of S._peds || []) { q.ped.persist = false; q.ped.t = 1; } },
  },
  time: { update(M, S) { const t = G.env.time; return S.from > S.to ? (t >= S.from || t < S.to) : (t >= S.from && t < S.to); }, start(M, S, m) { if (!HANDLERS.time.update(M, S)) { S.text = `Warte bis es dunkel ist (${S.from}:00 – ${S.to}:00 Uhr) – du kannst Zeit im Handy ändern`; } } },
};
