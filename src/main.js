import './style.css';
import { G } from './state.js';
import { UI } from './ui.js';
import { initGame, startLoop } from './game.js';
import { AudioSys } from './audio.js';
import { Economy } from './eco.js';
import { MissionSys } from './missions.js';
import { Activities } from './activities.js';
import { DEFAULT_OUTFIT } from './character.js';
import { PACKS } from './data.js';
import { byKey, CATALOG } from './vehicledata.js';
window.__byKey = (k) => byKey.get(k); window.__catalog = CATALOG;

const TALK = {
  clear: ['Was für ein herrlicher Tag!', 'Die Sonne scheint – perfektes Strandwetter.'], rain: ['Mistwetter, was?', 'Ich hasse Regen ...'], storm: ['Bei dem Gewitter geh ich nicht raus!'],
  night: ['Die Nacht ist jung.', 'Such dir einen Club – Club Neon ist heiß!'], tips: ['Im Hafen liegen Boote – und am Flughafen Flugzeuge.', 'Ich hab gehört, auf Isla Esmeralda soll ein Piratenschatz liegen.', 'Tony Vega kontrolliert den Club Neon. Leg dich nicht mit ihm an.', 'Die Pizza bei Napoli ist die beste der Stadt!', 'Das Pay \'n\' Spray schüttelt sogar die Polizei ab.', 'In den Bergen soll es versteckte Pakete geben.'],
};
G.talkLines = (ped) => { const e = G.env; const arr = [...TALK.tips]; if (e.w.rain > 0.4) arr.push(...(e.w.lightning ? TALK.storm : TALK.rain)); else arr.push(...TALK.clear); if (e.night > 0.5) arr.push(...TALK.night); return arr; };

G.newGame = () => {
  const P = G.player;
  P.alive = true; P.health = 100; P.armor = 0; P.hunger = 85; P.money = 5000; P.stun = 0; P.weapons = { fist: { owned: true }, pistol: { owned: true, ammo: 48, loaded: 12 } }; P.weapon = 'pistol';
  P.outfit = { ...DEFAULT_OUTFIT, topColor: 0x1e88e5, bottomColor: 0x2d3a4a }; P.watch = 0; P.owned = { tops: [0], bottoms: [0], shoes: [0], hats: [0], glasses: [0], watches: [0], skins: ['default'], hair: [1] }; P.inv = { medkit: 1, armorkit: 0 }; P.skins = {}; P.skinSel = 'default'; P.skinSelColor = 0;
  Object.assign(P.stats, { distFoot: 0, distCar: 0, kills: 0, cars: 0, stunts: 0, money: 0, timePlayed: 0, wasted: 0, busted: 0, top: 0, packages: 0, missions: 0, races: 0, flights: 0 });
  P.refreshOutfit(); P.selectWeapon('pistol');
  G.eco.props = {}; G.eco.packs = {}; G.eco.garage = []; G.eco.bank = 0; G.eco.nextId = 1;
  for (const v of [...G.vehicles.list]) if (v.owned) G.vehicles.despawn(v);
  G.found = { packages: {}, chests: {} }; G.refreshPackages(); G.day = 1;
  G.mission.done = {}; G.mission.current && G.mission.abort(); G.mission.refreshAvailable(); G.activities.stuntFound = {}; G.activities.refreshChests();
  G.police.reset(); G.eco.applyToWorld();
  const cafe = G.world.pois.find((p) => p.id === 'cafe1');
  P.teleport(cafe.x - 4, cafe.z + 3); P.yaw = Math.PI / 2; P.rig.snap(P); P.rig.yaw = Math.PI / 2; P.rig.pitch = 0.22;
  G.env.time = 18.4; G.env.setWeather('clear', true); G.env.lockWeather = false;
  G.waypoint = { x: cafe.x, z: cafe.z };
  G.ui.toast('Willkommen in Vice City! Gehe zu Mia im Café Sol (leuchtender Marker, GPS aktiv).', 7000);
  setTimeout(() => G.ui.toast('Tipp: M öffnet die Karte, P das Handy (Packs & Cheats), ESC pausiert.', 7000), 4000);
};

async function boot() {
  const canvas = document.getElementById('game');
  G.ui = new UI(G);
  try {
    await initGame(canvas, (p, t) => G.ui.setProgress(p, t));
    G.audio = new AudioSys(G); G.eco = new Economy(G); G.mission = new MissionSys(G); G.activities = new Activities(G);
    G.activities.init(); G.mission.init(); G.eco.applyToWorld();
    G.ui.setProgress(1, 'Bereit');
    G.ui.hideLoading();
    startLoop();
    G.ui.showMenu();
    window.G = G; window.__ready = true;
  } catch (e) { console.error(e); window.__err = String(e && e.stack || e); G.ui.setProgress(0, 'Fehler: ' + e.message); }
}
boot();
