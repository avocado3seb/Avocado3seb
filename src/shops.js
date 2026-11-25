// Läden, Menüs und Interaktionen an Orten
import { h } from './ui.js';
import { G } from './state.js';
import { fmtMoney, clamp } from './util.js';
import { FOOD, MENUS, TOPS, BOTTOMS, SHOES, HATS, GLASSES, HAIR, HAIRCOL, WATCHES, WEAPONS, WEAPON_SKINS, PACKS, PROPERTIES, VIP_EVENTS, PALETTE } from './data.js';
import { CATALOG, byKey, PALETTE_CARS } from './vehicledata.js';
import { WEATHER } from './environment.js';

const owned = (arr, i) => arr.includes(i);

export function openPOI(ui, poi) {
  const P = G.player, eco = G.eco;
  G.audio?.click();
  switch (poi.kind) {
    case 'food': return foodShop(ui, poi.name, MENUS[poi.menu] || MENUS.burger);
    case 'store': return storeShop(ui, poi);
    case 'clothes': return clothesShop(ui, poi);
    case 'barber': return barberShop(ui, poi);
    case 'guns': return gunShop(ui, poi);
    case 'jewel': return jewelShop(ui, poi);
    case 'atm': return atm(ui, poi);
    case 'fuel': case 'tune': return garageShop(ui, poi);
    case 'job': return G.activities?.startJob(poi.job);
    case 'raceStart': return G.activities?.startRace(poi.race, poi);
    case 'property': return property(ui, poi);
    case 'spray': return spray(ui, poi);
    case 'hospital': return hospital(ui, poi);
    case 'police': return ui.modal('Polizeipräsidium', h('div', { class: 'body' }, h('p', {}, 'Hier landest du, wenn du festgenommen wirst. Fahndungsstufen verschwinden, wenn du außer Sichtweite der Polizei bleibst oder ein Pay \'n\' Spray besuchst.')));
    case 'bank': return bank(ui, poi);
    case 'casino': return casino(ui, poi);
    case 'arcade': return arcade(ui, poi);
    case 'dealer': return dealer(ui, poi, ['car', 'bike'], 'Premium Deluxe Motorsport');
    case 'boats': return dealer(ui, poi, ['boat'], 'Marina – Boote & Yachten');
    case 'aircraft': return dealer(ui, poi, ['plane', 'heli'], 'Vice Air Charter');
    case 'club': return club(ui, poi);
    case 'mall': return clothesShop(ui, { ...poi, name: poi.name });
    default: return ui.toast(poi.name);
  }
}

// ---------- Essen ----------
export function eat(id) {
  const P = G.player, f = FOOD[id], [name, price, hp, kind, buff] = f;
  if (P.money < price) { G.ui.toast('Nicht genug Geld!'); return false; }
  P.addMoney(-price, 'Essen'); G.audio?.cash?.();
  P.hunger = clamp(P.hunger + hp * 1.1, 0, 100); P.health = clamp(P.health + hp * 0.6, 0, 100);
  if (buff === 'speed') P.buff.speed = 90; if (buff === 'regen') P.buff.regen = 60; if (buff === 'satisfied') { P.buff.regen = 120; P.buff.strong = 120; } if (buff === 'vip') { P.buff.regen = 240; P.buff.strong = 240; P.buff.speed = 240; P.prestige = (P.prestige || 0) + 1; }
  if (buff === 'drunk') { P.buff.drunk = 60; P.char.state.drunk = true; setTimeout(() => (P.char.state.drunk = false), 60000); }
  G.ui.toast(`${name} – lecker! ${buff === 'regen' ? '(Regeneration)' : buff === 'speed' ? '(Schneller)' : buff === 'satisfied' ? '(Gut gesättigt)' : buff === 'drunk' ? '(Angetrunken…)' : ''}`);
  G.ui.refreshCash();
  return true;
}
function foodShop(ui, name, ids) {
  const body = h('div', { class: 'body' });
  const render = () => { body.replaceChildren(...ids.map((id) => { const [n, p, hp] = FOOD[id]; return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, n), h('div', { class: 'd' }, `+${hp} Sättigung`)), h('div', { class: 'price' }, fmtMoney(p)), h('button', { class: 'btn small', onClick: () => { eat(id); } }, 'Essen')); }), h('div', { class: 'd' }, `Hunger: ${Math.round(G.player.hunger)}%`)); };
  render(); ui.modal(name, body);
}
function storeShop(ui, poi) {
  const P = G.player;
  const body = h('div', { class: 'body' });
  const items = [['Verbandskasten', 80, 'medkit'], ['Schutzweste', 300, 'armorkit']];
  const render = () => {
    body.replaceChildren(...items.map(([n, p, k]) => h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, n), h('div', { class: 'd' }, `Im Besitz: ${P.inv[k] || 0}`)), h('div', { class: 'price' }, fmtMoney(p)), h('button', { class: 'btn small', onClick: () => { if (P.money < p) return ui.toast('Nicht genug Geld!'); P.addMoney(-p); P.inv[k] = (P.inv[k] || 0) + 1; G.audio?.cash(); ui.refreshCash(); render(); } }, 'Kaufen'))),
      h('h3', {}, 'Snacks'), ...MENUS.store.map((id) => { const [n, p, hp] = FOOD[id]; return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, n)), h('div', { class: 'price' }, fmtMoney(p)), h('button', { class: 'btn small', onClick: () => eat(id) }, 'Essen')); }));
  };
  render(); ui.modal(poi.name, body);
}

// ---------- Mode ----------
function clothesShop(ui, poi) {
  const P = G.player, O = P.owned, luxe = !!poi.luxe;
  const prev = h('img', { alt: '', style: { width: '240px', height: '360px', background: 'radial-gradient(ellipse at 50% 80%,rgba(0,229,255,.25),rgba(0,0,0,.3))', borderRadius: '10px' } });
  const cats = [['top', 'Oberteile', TOPS, 'tops'], ['bottom', 'Hosen', BOTTOMS, 'bottoms'], ['shoe', 'Schuhe', SHOES, 'shoes'], ['hat', 'Kopfbedeckung', HATS, 'hats'], ['glasses', 'Brillen', GLASSES, 'glasses']];
  let cat = cats[0]; let tryOn = { ...P.outfit };
  const list = h('div'); const tabs = h('div', { class: 'sel', style: { marginBottom: '10px' } });
  const upd = () => { prev.src = ui.thumbs.character({ ...P.outfit, ...tryOn }); };
  const render = () => {
    tabs.replaceChildren(...cats.map((c) => h('button', { class: c === cat ? 'on' : '', onClick: () => { cat = c; render(); } }, c[1])));
    const [key, , arr, ok] = cat;
    list.replaceChildren(...arr.map((it, i) => {
      const [name, price, , pack] = it; const pk = Array.isArray(it) ? it[3] : null;
      const itemPack = typeof pk === 'string' ? pk : (key === 'top' ? it[3] : null);
      const designer = (itemPack === 'luxus') || price >= 900;
      if (luxe ? !(designer || itemPack) : designer && itemPack === 'luxus') return null;
      if (!luxe && itemPack === 'luxus') return null;
      const locked = itemPack && !G.eco.packs[itemPack];
      const has = owned(O[ok], i);
      return h('div', { class: 'row' + (locked ? ' locked' : '') }, h('div', { class: 'grow' }, h('div', { class: 't' }, name, itemPack && h('span', { class: 'pill pack' }, PACKS[itemPack].name)), h('div', { class: 'd' }, has ? 'Im Besitz' : '')),
        !has && h('div', { class: 'price' }, price ? fmtMoney(price) : 'gratis'),
        h('button', { class: 'btn small', onClick: () => { tryOn[key] = i; upd(); } }, 'Anprobieren'),
        h('button', { class: 'btn small primary', disabled: locked, onClick: () => {
          if (!has) { if (locked) return ui.toast(`Benötigt: ${PACKS[itemPack].name}`); if (P.money < price) return ui.toast('Nicht genug Geld!'); P.addMoney(-price, 'Kleidung'); O[ok].push(i); G.audio?.cash(); }
          P.outfit[key] = i; P.refreshOutfit(); tryOn = { ...P.outfit }; upd(); ui.refreshCash(); ui.toast(has ? 'Angezogen' : 'Gekauft & angezogen'); render();
        } }, has ? 'Anziehen' : 'Kaufen'));
    }));
  };
  const swatch = (key, arr) => h('div', { class: 'swatches', style: { margin: '8px 0' } }, arr.map((c) => h('div', { class: 'sw', style: { background: '#' + c.toString(16).padStart(6, '0') }, onClick: () => { P.outfit[key] = c; tryOn[key] = c; P.refreshOutfit(); upd(); } })));
  const body = h('div', { class: 'body' }, h('div', { class: 'two' }, h('div', { class: 'prev' }, prev, h('h3', {}, 'Farben (gratis)'), swatch('topColor', PALETTE), swatch('bottomColor', PALETTE), swatch('shoeColor', PALETTE)), h('div', { style: { flex: 1, minWidth: 0 } }, tabs, list)));
  render(); upd(); ui.modal(poi.name, body, { wide: true });
}
function barberShop(ui, poi) {
  const P = G.player, O = P.owned;
  const prev = h('img', { style: { width: '220px', height: '330px', borderRadius: '10px', background: 'rgba(255,255,255,.04)' } });
  const upd = () => { prev.src = ui.thumbs.character({ ...P.outfit }); };
  const body = h('div', { class: 'body' });
  const render = () => {
    body.replaceChildren(h('div', { class: 'two' }, h('div', { class: 'prev' }, prev), h('div', { style: { flex: 1 } }, h('h3', {}, 'Frisuren'),
      ...HAIR.map((n, i) => h('div', { class: 'row' }, h('div', { class: 'grow t' }, n), !owned(O.hair, i) && h('div', { class: 'price' }, '$40'), h('button', { class: 'btn small', onClick: () => { if (!owned(O.hair, i)) { if (P.money < 40) return ui.toast('Nicht genug Geld!'); P.addMoney(-40); O.hair.push(i); } P.outfit.hairStyle = i; P.refreshOutfit(); upd(); ui.refreshCash(); render(); } }, P.outfit.hairStyle === i ? 'Aktiv' : 'Wählen'))),
      h('h3', {}, 'Haarfarbe (gratis)'), h('div', { class: 'swatches' }, HAIRCOL.map((c) => h('div', { class: 'sw', style: { background: '#' + c.toString(16).padStart(6, '0') }, onClick: () => { P.outfit.hairColor = c; P.refreshOutfit(); upd(); } }))))));
  };
  render(); upd(); ui.modal(poi.name, body, { wide: true });
}

// ---------- Waffen ----------
function gunShop(ui, poi) {
  const P = G.player; const body = h('div', { class: 'body' });
  const render = () => {
    const rows = [];
    rows.push(h('h3', {}, 'Waffen'));
    for (const [k, w] of Object.entries(WEAPONS)) { if (w.melee) continue; const e = P.weapons[k]; const has = e?.owned;
      rows.push(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, w.name, has && h('span', { class: 'pill' }, `Munition ${e.loaded ?? 0}/${e.ammo ?? 0}`)), h('div', { class: 'd' }, `Schaden ${w.dmg} · ${w.auto ? 'Automatik' : 'Halbautomatik'} · Mag ${w.mag || 1}`)),
        !has && h('div', { class: 'price' }, fmtMoney(w.price)), !has && h('button', { class: 'btn small primary', onClick: () => { if (P.money < w.price) return ui.toast('Nicht genug Geld!'); P.addMoney(-w.price); P.addWeapon(k, w.ammoPack); P.selectWeapon(k); G.audio?.cash(); ui.refreshCash(); render(); } }, 'Kaufen'),
        has && h('div', { class: 'price' }, `${fmtMoney(w.ammoPrice)} / ${w.ammoPack} Schuss`), has && h('button', { class: 'btn small', onClick: () => { if (P.money < w.ammoPrice) return ui.toast('Nicht genug Geld!'); P.addMoney(-w.ammoPrice); e.ammo = (e.ammo || 0) + w.ammoPack; if (k === 'grenade') { e.loaded = 1; } G.audio?.cash(); ui.refreshCash(); render(); } }, 'Munition')));
    }
    rows.push(h('h3', {}, 'Schutzweste'), h('div', { class: 'row' }, h('div', { class: 'grow t' }, 'Schutzweste (sofort)'), h('div', { class: 'price' }, '$500'), h('button', { class: 'btn small', onClick: () => { if (P.money < 500) return ui.toast('Nicht genug Geld!'); P.addMoney(-500); P.armor = 100; ui.refreshCash(); ui.toast('Weste angelegt'); } }, 'Kaufen')));
    rows.push(h('h3', {}, 'Waffen-Skins'));
    for (const s of WEAPON_SKINS) { const has = P.skins[s.id] || s.price === 0; const locked = s.pack && !G.eco.packs[s.pack];
      rows.push(h('div', { class: 'row' + (locked ? ' locked' : '') }, h('div', { class: 'sw', style: { background: '#' + s.color.toString(16).padStart(6, '0') } }), h('div', { class: 'grow' }, h('div', { class: 't' }, s.name, s.pack && h('span', { class: 'pill pack' }, PACKS[s.pack].name))), !has && h('div', { class: 'price' }, fmtMoney(s.price)),
        h('button', { class: 'btn small', disabled: locked, onClick: () => { if (!has) { if (P.money < s.price) return ui.toast('Nicht genug Geld!'); P.addMoney(-s.price); P.skins[s.id] = true; G.audio?.cash(); } P.skinSel = s.id; P.skinSelColor = s.id === 'default' ? 0 : s.color; P.refreshWeaponModel(); ui.refreshCash(); render(); } }, has ? (P.skinSel === s.id ? 'Aktiv' : 'Ausrüsten') : 'Kaufen')));
    }
    body.replaceChildren(...rows);
  };
  render(); ui.modal(poi.name, body);
}
function jewelShop(ui, poi) {
  const P = G.player; const body = h('div', { class: 'body' });
  const render = () => body.replaceChildren(h('p', { class: 'd' }, 'Edle Uhren erhöhen dein Prestige – wichtig für VIP-Events.'), ...WATCHES.filter((w) => w.price > 0).map((w, i) => { const idx = WATCHES.indexOf(w); const has = P.owned.watches.includes(idx); const locked = w.pack && !G.eco.packs[w.pack];
    return h('div', { class: 'row' + (locked ? ' locked' : '') }, h('div', { class: 'grow' }, h('div', { class: 't' }, w.name, w.pack && h('span', { class: 'pill pack' }, PACKS[w.pack].name)), h('div', { class: 'd' }, `Prestige +${w.prestige}`)), !has && h('div', { class: 'price' }, fmtMoney(w.price)),
      h('button', { class: 'btn small primary', disabled: locked, onClick: () => { if (!has) { if (P.money < w.price) return ui.toast('Nicht genug Geld!'); P.addMoney(-w.price); P.owned.watches.push(idx); G.audio?.cash(); } P.watch = idx; P.refreshOutfit(); ui.refreshCash(); render(); } }, has ? (P.watch === idx ? 'Getragen' : 'Anlegen') : 'Kaufen')); }));
  render(); ui.modal(poi.name, body);
}
function atm(ui, poi) {
  const P = G.player, eco = G.eco; const body = h('div', { class: 'body' });
  const render = () => body.replaceChildren(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'Kontostand'), h('div', { class: 'd' }, 'Geld auf dem Konto geht beim Tod nicht verloren.')), h('div', { class: 'price' }, fmtMoney(eco.bank))), h('div', { class: 'row' }, h('div', { class: 'grow t' }, 'Bargeld'), h('div', { class: 'price' }, fmtMoney(P.money))),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' } },
      ...[1000, 10000, 100000].map((n) => h('button', { class: 'btn small', onClick: () => { if (P.money < n) return ui.toast('Zu wenig Bargeld'); P.addMoney(-n); eco.bank += n; ui.refreshCash(); render(); } }, `Einzahlen ${fmtMoney(n)}`)),
      ...[1000, 10000, 100000].map((n) => h('button', { class: 'btn small', onClick: () => { if (eco.bank < n) return ui.toast('Zu wenig Guthaben'); eco.bank -= n; P.addMoney(n); ui.refreshCash(); render(); } }, `Abheben ${fmtMoney(n)}`)),
      h('button', { class: 'btn small', onClick: () => { eco.bank += P.money; P.money = 0; P.addMoney(0); ui.refreshCash(); render(); } }, 'Alles einzahlen'), h('button', { class: 'btn small', onClick: () => { P.addMoney(eco.bank); eco.bank = 0; ui.refreshCash(); render(); } }, 'Alles abheben')));
  render(); ui.modal('Geldautomat', body);
}

// ---------- Werkstatt / Tuning ----------
function garageShop(ui, poi) {
  const v = G.player.vehicle; const P = G.player;
  if (!v) return ui.toast('Fahre mit einem Fahrzeug hierher (ENTER).');
  const body = h('div', { class: 'body' });
  const tune = v.tune || (v.tune = { e: 0, g: 0, a: 0, n: 0 });
  const render = () => {
    const dmg = Math.round((1000 - v.health) / 10);
    const rows = [h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, v.spec.name), h('div', { class: 'd' }, `Zustand ${Math.round(v.health / 10)}%`)), h('div', { class: 'price' }, dmg ? fmtMoney(40 + dmg * 6) : ''), h('button', { class: 'btn small primary', disabled: !dmg, onClick: () => { const c = 40 + dmg * 6; if (P.money < c) return ui.toast('Nicht genug Geld!'); P.addMoney(-c); v.repair(); ui.refreshCash(); ui.toast('Repariert'); render(); } }, 'Reparieren'))];
    if (poi.kind === 'tune') {
      const up = [['e', 'Motor-Tuning', 'Mehr Beschleunigung & Höchstgeschwindigkeit', 6000], ['g', 'Sportreifen & Fahrwerk', 'Mehr Grip', 4000], ['a', 'Panzerung', 'Fahrzeug nimmt weniger Schaden', 8000]];
      up.forEach(([k, n, d, price]) => rows.push(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, `${n} – Stufe ${tune[k]}/3`), h('div', { class: 'd' }, d)), tune[k] < 3 && h('div', { class: 'price' }, fmtMoney(price * (tune[k] + 1))), h('button', { class: 'btn small', disabled: tune[k] >= 3, onClick: () => { const c = price * (tune[k] + 1); if (P.money < c) return ui.toast('Nicht genug Geld!'); P.addMoney(-c); tune[k]++; v.applyTune?.(); if (v.entry) v.entry.tune = { ...tune }; ui.refreshCash(); render(); } }, 'Einbauen'))));
      rows.push(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'Neon-Unterbodenbeleuchtung'), h('div', { class: 'd' }, tune.n ? 'Eingebaut' : '')), !tune.n && h('div', { class: 'price' }, '$2.500'), h('button', { class: 'btn small', onClick: () => { if (!tune.n) { if (P.money < 2500) return ui.toast('Nicht genug Geld!'); P.addMoney(-2500); tune.n = 1; } v.parts.neon && (v.parts.neon.visible = true); ui.refreshCash(); render(); } }, 'Aktivieren')));
      rows.push(h('h3', {}, 'Lackierung ($300)'), h('div', { class: 'swatches' }, PALETTE_CARS.map((c) => h('div', { class: 'sw', style: { background: '#' + c.toString(16).padStart(6, '0') }, onClick: () => { if (P.money < 300) return ui.toast('Nicht genug Geld!'); P.addMoney(-300); v.setColor(c); if (v.entry) v.entry.color = c; ui.refreshCash(); } }))));
    }
    body.replaceChildren(...rows);
  };
  render(); ui.modal(poi.name, body);
}
function spray(ui, poi) {
  const v = G.player.vehicle; if (!v) return;
  const P = G.player; const cost = 200;
  if (P.money < cost) return ui.toast('Nicht genug Geld (200$)');
  const seen = G.police.stars > 0 && G.police.copsSee(v.pos, 60);
  P.addMoney(-cost, 'Pay n Spray');
  ui.fadeTo(1, 400);
  setTimeout(() => { v.repair(); v.setColor(PALETTE_CARS[Math.floor(Math.random() * PALETTE_CARS.length)]); if (G.police.stars > 0) { if (!seen) { G.police.clear(); } else ui.toast('Ein Polizist hat dich gesehen – die Fahndung bleibt!'); } ui.fadeTo(0, 600); ui.toast('Frisch lackiert und repariert!'); }, 700);
}
function hospital(ui, poi) {
  const P = G.player; const body = h('div', { class: 'body' });
  body.append(h('div', { class: 'row' }, h('div', { class: 'grow t' }, 'Behandlung (volle Gesundheit)'), h('div', { class: 'price' }, '$100'), h('button', { class: 'btn small primary', onClick: () => { if (P.money < 100) return ui.toast('Nicht genug Geld!'); P.addMoney(-100); P.health = 100; ui.refreshCash(); ui.toast('Du bist wieder fit.'); } }, 'Behandeln')),
    h('div', { class: 'row' }, h('div', { class: 'grow t' }, 'Schutzweste'), h('div', { class: 'price' }, '$250'), h('button', { class: 'btn small', onClick: () => { if (P.money < 250) return ui.toast('Nicht genug Geld!'); P.addMoney(-250); P.armor = 100; ui.refreshCash(); } }, 'Kaufen')));
  ui.modal(poi.name, body);
}
function bank(ui, poi) {
  const body = h('div', { class: 'body' }, h('p', {}, 'Die Vice Federal Bank – Tresor, Gala-Saal und Ziel großer Coups.'));
  if (G.mission?.onPOI) { const r = G.mission.onPOI(poi, body); }
  body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'Charity Gala'), h('div', { class: 'd' }, 'VIP-Event (Luxus-Pack, Prestige 14, Smoking)')), h('button', { class: 'btn small gold', onClick: () => { ui.closeModal(); G.activities?.vip('gala'); } }, 'Teilnehmen')));
  ui.modal(poi.name, body);
}

// ---------- Immobilien ----------
function property(ui, poi) {
  const p = poi.prop, eco = G.eco, P = G.player; const own = eco.owns(p.id);
  const body = h('div', { class: 'body' });
  const render = () => {
    const own = eco.owns(p.id);
    body.replaceChildren(h('p', {}, p.desc), h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, `${p.slots} Garagenstellplätze`), h('div', { class: 'd' }, p.income ? `Einkommen: ${fmtMoney(p.income)} pro Tag` : 'Kein Einkommen')), !own && h('div', { class: 'price' }, fmtMoney(p.price)), !own && h('button', { class: 'btn primary small', onClick: () => { if (eco.buyProperty(p)) { ui.refreshCash(); render(); } } }, 'Kaufen')));
    if (own) {
      body.append(
        h('div', { class: 'row' }, h('div', { class: 'grow t' }, '💾 Spiel speichern'), h('button', { class: 'btn small', onClick: () => { ui.closeModal(true); ui.slotsModal('both'); } }, 'Speichern')),
        h('div', { class: 'row' }, h('div', { class: 'grow t' }, '🛏 Schlafen (bis 08:00, Gesundheit)'), h('button', { class: 'btn small', onClick: () => { ui.fadeTo(1, 500); setTimeout(() => { G.env.time = 8; P.health = 100; ui.fadeTo(0, 800); eco.save('auto'); ui.toast('Gut geschlafen. Autosave erstellt.'); }, 700); ui.closeModal(); } }, 'Schlafen')),
        h('div', { class: 'row' }, h('div', { class: 'grow t' }, '👔 Kleiderschrank'), h('button', { class: 'btn small', onClick: () => { ui.closeModal(true); G.mode = 'play'; ui.openPause('character'); } }, 'Öffnen')),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, '🚗 Garage'), h('div', { class: 'd' }, `${eco.garage.length} / ${eco.slots()} belegt`)), h('button', { class: 'btn small', onClick: () => { const near = eco.ownedInWorld().filter((v) => Math.hypot(v.pos.x - poi.x, v.pos.z - poi.z) < 60); if (!near.length) return ui.toast('Kein eigenes Fahrzeug in der Nähe (60 m).'); eco.storeVehicle(near[0]); render(); } }, 'Nächstes Fahrzeug einparken')));
      for (const e of eco.garage) { const spec = byKey.get(e.key); const out = G.vehicles.list.find((v) => v.entry === e && !v.dead); body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, spec.name), h('div', { class: 'd' }, out ? 'steht draußen' : 'in der Garage')), !out && h('button', { class: 'btn small', onClick: () => { const pt = spec.kind === 'car' || spec.kind === 'bike' ? { x: poi.x + 6, z: poi.z + 8, yaw: Math.PI / 2 } : null; eco.takeOut(e, pt); ui.closeModal(); ui.toast(`${spec.name} steht bereit.`); } }, 'Ausparken'))); }
    }
  };
  render(); ui.modal(p.name, body);
}

// ---------- Fahrzeughändler ----------
function dealer(ui, poi, kinds, title) {
  const P = G.player, eco = G.eco; const body = h('div', { class: 'body' });
  const catsAll = [...new Set(CATALOG.filter((c) => kinds.includes(c.kind) && c.buyable).map((c) => c.cls))];
  let cat = 'alle', color = null; const grid = h('div', { class: 'grid' });
  const chips = h('div', { class: 'legend' });
  const labelOf = (c) => CATALOG.find((x) => x.cls === c).label;
  const render = () => {
    chips.replaceChildren(...['alle', ...catsAll].map((c) => h('span', { class: 'chip' + (cat === c ? ' on' : ''), onClick: () => { cat = c; render(); } }, c === 'alle' ? 'Alle' : labelOf(c))));
    const list = CATALOG.filter((c) => kinds.includes(c.kind) && c.buyable && (cat === 'alle' || c.cls === cat)).sort((a, b) => a.price - b.price);
    grid.replaceChildren(...list.map((spec) => {
      const img = h('img'); ui.thumbs.lazyVehicle(img, spec, color ?? spec.color);
      const locked = spec.pack && !eco.packs[spec.pack];
      const bar = (v, max) => h('div', { class: 'stat' }, h('i', { style: { width: clamp(v / max, 0.05, 1) * 100 + '%' } }));
      return h('div', { class: 'card' + (locked ? ' locked' : ''), style: locked ? { opacity: 0.6 } : {} }, img, h('div', { class: 't' }, spec.name, spec.pack && h('span', { class: 'pill pack' }, PACKS[spec.pack].name)), h('div', { class: 'd' }, spec.label),
        h('div', { class: 'statline' }, 'Tempo', bar(spec.top, 400), 'Beschl.', bar(1 / Math.max(2, spec.t100 || 10), 0.4), 'Grip', bar(spec.grip, 1.5)),
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h('span', { class: 'price' }, fmtMoney(spec.price)), h('button', { class: 'btn small primary', onClick: () => { const v = eco.buyVehicle(spec, color ?? spec.color); if (v) { ui.refreshCash(); } } }, 'Kaufen')));
    }));
  };
  if (kinds.includes('plane')) body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, '🛩 Flugschule – Ringparcours', h('span', { class: 'pill pack' }, PACKS.flug.name)), h('div', { class: 'd' }, 'Stuntflieger gestellt, Belohnung bis $20.000')), h('button', { class: 'btn small gold', onClick: () => { ui.closeModal(); G.activities.startJob('flight'); } }, 'Starten')));
  if (kinds.includes('boat')) body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, '⛵ Hochseeregatta', h('span', { class: 'pill pack' }, PACKS.yacht.name)), h('div', { class: 'd' }, 'Rennboot gestellt, Eintritt $3.000, Belohnung bis $40.000')), h('button', { class: 'btn small gold', onClick: () => { ui.closeModal(); G.activities.startRegatta(); } }, 'Starten')));
  body.append(h('div', { class: 'd' }, 'Das Fahrzeug wird direkt geliefert. Parke es in einer Garage, damit es sicher ist.'), chips, h('h3', {}, 'Lackfarbe'), h('div', { class: 'swatches' }, h('div', { class: 'sw', style: { background: 'linear-gradient(135deg,#f33,#33f)' }, title: 'Standard', onClick: () => { color = null; render(); } }), PALETTE_CARS.map((c) => h('div', { class: 'sw', style: { background: '#' + c.toString(16).padStart(6, '0') }, onClick: () => { color = c; render(); } }))), grid);
  render(); ui.modal(title, body, { wide: true });
}

// ---------- Club / Casino / Arcade ----------
function club(ui, poi) {
  const P = G.player; const body = h('div', { class: 'body' });
  body.append(h('h3', {}, 'Bar'), ...['cocktail', 'champagne', 'juice'].map((id) => { const [n, p] = FOOD[id]; return h('div', { class: 'row' }, h('div', { class: 'grow t' }, n), h('div', { class: 'price' }, fmtMoney(p)), h('button', { class: 'btn small', onClick: () => eat(id) }, 'Bestellen')); }));
  const v = VIP_EVENTS.find((e) => e.id === 'clubnight');
  body.append(h('h3', {}, 'VIP'), h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'VIP Club Night', h('span', { class: 'pill pack' }, PACKS.nacht.name)), h('div', { class: 'd' }, `Prestige ${v.minPrestige} · Eintritt ${fmtMoney(v.fee)} · Belohnung ${fmtMoney(v.reward)}`)), h('button', { class: 'btn small gold', onClick: () => { ui.closeModal(); G.activities?.vip('clubnight'); } }, 'Teilnehmen')));
  ui.modal(poi.name, body);
}
function casino(ui, poi) {
  const body = h('div', { class: 'body' }, h('p', {}, 'Willkommen im Golden Palms – setze dein Glück aufs Spiel.'),
    h('div', { class: 'row' }, h('div', { class: 'grow t' }, '🃏 Blackjack'), h('button', { class: 'btn small primary', onClick: () => import('./minigames.js').then((m) => m.blackjack(ui)) }, 'Spielen')),
    h('div', { class: 'row' }, h('div', { class: 'grow t' }, '🎰 Spielautomat'), h('button', { class: 'btn small primary', onClick: () => import('./minigames.js').then((m) => m.slots(ui)) }, 'Spielen')),
    h('div', { class: 'row' }, h('div', { class: 'grow t' }, '🎡 Roulette (Rot/Schwarz)'), h('button', { class: 'btn small primary', onClick: () => import('./minigames.js').then((m) => m.roulette(ui)) }, 'Spielen')));
  ui.modal(poi.name, body);
}
function arcade(ui, poi) {
  const body = h('div', { class: 'body' }, h('div', { class: 'row' }, h('div', { class: 'grow t' }, '🐍 Neon Snake'), h('button', { class: 'btn small primary', onClick: () => import('./minigames.js').then((m) => m.snake(ui)) }, 'Spielen')),
    h('div', { class: 'row' }, h('div', { class: 'grow t' }, '🎯 Schießbude'), h('button', { class: 'btn small primary', onClick: () => import('./minigames.js').then((m) => m.shooting(ui)) }, 'Spielen')),
    h('div', { class: 'row' }, h('div', { class: 'grow t' }, '🚗 Street Racer'), h('button', { class: 'btn small primary', onClick: () => import('./minigames.js').then((m) => m.racer(ui)) }, 'Spielen')));
  ui.modal(poi.name, body);
}

// ---------- Handy ----------
export function phoneTab(ui, c) {
  const P = G.player, eco = G.eco;
  c.replaceChildren(h('h2', {}, 'Handy'));
  c.append(h('h3', {}, 'Kontakte'));
  c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, '🚕 Taxi (Schnellreise zum GPS-Ziel)'), h('div', { class: 'd' }, 'Setze ein Ziel auf der Karte. Kosten nach Entfernung.')), h('button', { class: 'btn small', onClick: () => { const wp = G.waypoint; if (!wp) return ui.toast('Setze zuerst ein GPS-Ziel (Karte).'); if (G.police.stars > 0) return ui.toast('Das Taxi fährt nicht, solange du gesucht wirst.'); const d = Math.hypot(wp.x - P.position.x, wp.z - P.position.z); const cost = Math.round(15 + d / 12); if (P.money < cost) return ui.toast(`Fahrt kostet ${fmtMoney(cost)}`); P.addMoney(-cost, 'Taxi'); ui.closePause(); ui.fadeTo(1, 500); setTimeout(() => { const n = G.world.nearestNode(wp.x, wp.z, 200); if (P.vehicle) P.exitVehicle(true); P.teleport(n ? n.x + 9 : wp.x, n ? n.z + 9 : wp.z); G.env.time = (G.env.time + d / 3000) % 24; ui.fadeTo(0, 700); ui.toast(`Fahrt beendet (${fmtMoney(cost)})`); }, 700); } }, 'Rufen')));
  c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, '🔧 Mechaniker (Fahrzeug liefern)'), h('div', { class: 'd' }, 'Liefert ein Fahrzeug aus deiner Garage – siehe Tab „Fahrzeuge“.')), h('button', { class: 'btn small', onClick: () => { ui.tab = 'vehicles'; ui.renderPause(); } }, 'Öffnen')));
  c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, '📦 Content-Packs'), h('div', { class: 'd' }, 'Luxus · Insel · Flugzeug · Yacht · Rennsport · Nachtleben')), h('button', { class: 'btn small gold', onClick: () => { ui.tab = 'packs'; ui.renderPause(); } }, 'Shop')));
  // VIP-Events
  c.append(h('h3', {}, 'VIP-Events'));
  for (const e of VIP_EVENTS) c.append(h('div', { class: 'row' + (eco.packs[e.pack] ? '' : ' locked') }, h('div', { class: 'grow' }, h('div', { class: 't' }, e.name, h('span', { class: 'pill pack' }, PACKS[e.pack].name)), h('div', { class: 'd' }, `${e.desc} · Prestige ${e.minPrestige} (du: ${eco.prestige()}) · Eintritt ${fmtMoney(e.fee)} → ${fmtMoney(e.reward)}`)), h('button', { class: 'btn small', onClick: () => { G.waypoint = { x: e.x, z: e.z }; ui.toast('GPS-Ziel gesetzt'); } }, 'GPS'), h('button', { class: 'btn small gold', onClick: () => { ui.closePause(); G.activities?.vip(e.id); } }, 'Start')));
  // Entwickleroptionen
  c.append(h('h3', {}, 'Entwickler-Optionen (Cheats)'));
  const btn = (l, fn) => h('button', { class: 'btn small', onClick: () => { fn(); G.audio?.click(); } }, l);
  c.append(h('div', { class: 'sel' }, btn('+ $100.000', () => P.addMoney(100000, 'Cheat')), btn('Gesundheit/Weste', () => { P.health = 100; P.armor = 100; }), btn('Fahndung 0', () => G.police.clear()), btn('Fahndung +1', () => G.police.addHeat(1, 'cheat')), btn('Fahndung 5★', () => G.police.setWanted(5)), btn(`Gottmodus: ${G.cheat.god ? 'AN' : 'AUS'}`, () => { G.cheat.god = !G.cheat.god; ui.renderPause(); }), btn('Alle Waffen', () => { for (const k of ['smg', 'shotgun', 'rifle', 'grenade']) P.addWeapon(k, 120); }), btn('Alle Packs', () => { for (const k of Object.keys(PACKS)) eco.packs[k] = true; eco.applyToWorld(); ui.toast('Alle Packs freigeschaltet'); })));
  c.append(h('h3', {}, 'Zeit & Wetter'));
  c.append(h('div', { class: 'sel' }, ...[['Morgen 07:00', 7], ['Mittag 12:30', 12.5], ['Sonnenuntergang 18:30', 18.5], ['Mitternacht', 0.2]].map(([l, t]) => btn(l, () => { G.env.time = t; })), ...Object.entries(WEATHER).map(([k, w]) => btn(w.label, () => { G.env.setWeather(k); G.env.lockWeather = true; setTimeout(() => (G.env.lockWeather = false), 120000); }))));
  c.append(h('h3', {}, 'Fahrzeug spawnen'));
  const sel = h('select', { style: { background: '#1a1030', color: '#fff', border: '1px solid rgba(255,255,255,.2)', padding: '6px', borderRadius: '6px', maxWidth: '260px' } }, CATALOG.map((s) => h('option', { value: s.key }, `${s.name} (${s.label})${s.pack ? ' ★' : ''}`)));
  c.append(h('div', { class: 'field' }, sel, btn('Spawnen', () => { const spec = byKey.get(sel.value); const pt = eco.spawnPoint(spec); const pos = P.position; const v = G.vehicles.spawn(spec, spec.kind === 'car' || spec.kind === 'bike' ? pos.x + Math.sin(P.yaw) * 6 : pt.x, spec.kind === 'car' || spec.kind === 'bike' ? pos.z + Math.cos(P.yaw) * 6 : pt.z, P.yaw, { sleep: false }); v.tag = 'abandoned'; ui.toast(`${spec.name} gespawnt${spec.kind === 'plane' || spec.kind === 'heli' || spec.kind === 'boat' ? ' (Flughafen / Hafen)' : ''}`); })));
  c.append(h('h3', {}, 'Teleport'));
  const places = [['Ocean Drive', 940, 110], ['Zentrum', 150, -60], ['Flughafen', -900, 700], ['Hafen', 700, 880], ['Sunset Hills', 400, -850], ['Stadion', 200, 520], ['Strand-Pier', 1160, 100], ['Isla Esmeralda', 1950, -440], ['Berge', 300, -1700]];
  c.append(h('div', { class: 'sel' }, ...places.map(([l, x, z]) => btn(l, () => { ui.closePause(); const n = G.world.nearestNode(x, z, 400); if (P.vehicle && P.vehicle.kind === 'car') { P.vehicle.place(x, z, P.vehicle.yaw); P.vehicle.wake(); } else P.teleport(x, z, G.world.groundY(x, z) + (l.includes('Insel') ? 2 : 0)); }))));
}
