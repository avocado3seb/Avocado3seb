// Zusammenführung aller Länderdateien -> Datenbank. Neue Länder/Parks: einfach eine Datei in diesem Ordner
// anlegen, importieren und in SOURCES eintragen (oder im Spiel unter „Eigene Bahn hinzufügen“ per JSON).
import dachBenelux from './c_dach_benelux.js';
import frEsIt from './c_fr_es_it.js';
import gbNordicEast from './c_gb_nordic_east.js';
import { PARK_INFO, THEME_BY_COUNTRY } from './parks.js';
import { LAYOUTS } from './layouts.js';
import { PALETTES, CATS } from '../specs.js';
import { hashStr } from '../gen.js';

const SOURCES = [dachBenelux, frEsIt, gbNordicEast];

export const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function buildDatabase(custom = []) {
  const coasters = [], parks = {};
  const addPark = (name, cc) => {
    if (!parks[name]) {
      const info = PARK_INFO[name] || {};
      parks[name] = { id: slug(name), name, cc, city: info.city || '', theme: info.theme || THEME_BY_COUNTRY[cc] || 'central', lm: info.lm || ['tower'], flats: [], coasters: [] };
    }
    return parks[name];
  };
  const addCoaster = (park, cc, row, custom = false) => {
    const [name, cat, maker, year, h, len, v, dur, inv, ex = {}] = row;
    const id = slug(name) + '-' + slug(park);
    const pal = PALETTES[hashStr(id) % PALETTES.length];
    const c = {
      id, name, park, cc, cat: CATS[cat] ? cat : 'sitdown', maker, year, h, len, v, dur, inv,
      trackColor: ex.tc || pal[0], supportColor: ex.sc || pal[1], trainColor: ex.tr || ex.tc || pal[0], trainAccent: ex.ta || ex.sc || pal[1],
      alias: ((ex.al || '') + ' ' + (/Bolliger/.test(maker) ? 'B&M BM' : '') + (/Great Coasters/.test(maker) ? ' GCI' : '') + (/Rocky Mountain/.test(maker) ? ' RMC' : '') + (/Custom Coasters/.test(maker) ? ' CCI' : '')).trim(), custom,
      layout: ex.layout || LAYOUTS[name + '@' + park] || LAYOUTS[name] || null,
    };
    coasters.push(c);
    addPark(park, cc).coasters.push(c);
  };
  for (const src of SOURCES) for (const p of src) {
    const pk = addPark(p.park, p.cc);
    for (const r of p.rows) addCoaster(p.park, p.cc, r);
    for (const f of (p.flats || [])) pk.flats.push({ kind: f[0], name: f[1] });
  }
  for (const p of custom) {
    addPark(p.park, p.cc || 'DE');
    for (const r of p.rows) addCoaster(p.park, p.cc || 'DE', r, true);
  }
  return { coasters, parks };
}
