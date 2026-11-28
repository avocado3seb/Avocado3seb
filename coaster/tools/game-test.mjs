// Spielsystem-Test (Phantasialand): Hub, Interaktion, Kauf, Karte/Navigation, Ticket, Fahrt+Erfolg, Hotel, Winter, Foto, Editor, Speichern/Laden
import { createRequire } from 'module'; import { execSync } from 'child_process';
const require = createRequire(import.meta.url); const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:5173/coaster/index.html';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; let fails = 0;
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const check = (n, ok, x = '') => { console.log((ok ? '✔ ' : '✖ ') + n + (x ? '  ' + x : '')); if (!ok) fails++; };
const ev = (f, a) => page.evaluate(f, a);
await page.goto(BASE);
await page.waitForFunction(() => window.__app && window.__app.park && window.__app.state === 'menu', null, { timeout: 120000 });
check('Start-Hub sichtbar', await ev(() => document.querySelectorAll('.tile').length >= 12));
const r1 = await ev(async () => { const a = __app; await a.ui.hubAction('free'); return [a.state, a.parkMode, a.park.def.name, a.park.pois.length, a.park.interactables.length]; });
check('Freie Erkundung startet (Phantasialand, begehbar)', r1[0] === 'park' && r1[1] === 'walk' && r1[2] === 'Phantasialand', JSON.stringify(r1));
check('POIs platziert (Restaurants/Hotels/Shows …)', r1[3] >= 20, 'n=' + r1[3]);
// Regression: eine riesige, nicht unterteilte Grundplatte überdeckte kurz nach dem Betreten Gelände und Wege (Tiefenwerte zu ungenau).
// Zeitunabhängig und ohne Screenshot (auf langsamen CI-Rechnern dauert ein Bild Sekunden): Kamera per updateCamera in Laufposition bringen,
// direkt rendern und Pixel unter der Figur lesen. Bei 960x540 trat der Fehler reproduzierbar auf (alter Stand: einfarbig, Streuung 0,4).
await page.setViewportSize({ width: 960, height: 540 });
const gp = await ev(() => { const f = __app.park.farPlane, p = f && f.geometry.parameters; return [!!f, p && p.widthSegments]; });
check('Grundplatte ist unterteilt (keine riesigen Dreiecke)', gp[0] && gp[1] >= 32, JSON.stringify(gp));
const gr = await ev(() => {
  const a = __app; for (let i = 0; i < 24; i++) { a.env.update(0.05, a.camera, a.camera.position); a.updateCamera(0.05); }
  a.renderer.render(a.scene, a.camera);
  const gl = a.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, bw = Math.floor(W * 0.25), bh = Math.floor(H * 0.12), buf = new Uint8Array(bw * bh * 4);
  gl.readPixels(Math.floor(W * 0.375), Math.floor(H * 0.17), bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let s = 0, s2 = 0; const n = bw * bh; for (let i = 0; i < buf.length; i += 4) { const l = 0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]; s += l; s2 += l * l; } const m = s / n;
  return [Math.round(m), +Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(1), +a.env.time.toFixed(1), W + 'x' + H];
});
check('Boden/Weg unter der Figur bleibt sichtbar (Textur, keine einfarbige Fläche)', gr[1] > 3, 'Helligkeit/Streuung/Spielzeit/Größe ' + JSON.stringify(gr));
// Leistung: statische Gebäudeteile werden zusammengefasst (pl_merge.js). Ohne das lagen die Draw-Calls je Blick bei über 7000, mit nur etwa 2500–3000.
const dc = await ev(() => { const a = __app, R = a.renderer, out = []; for (const [x, z] of [[0, 190], [-182, 207], [196, 214]]) { a.walk.pos.set(x, 3, z); a.camera.position.set(x, 3, z); a.updateCamera(0.05); a.env.update(0.05, a.camera, a.camera.position); R.render(a.scene, a.camera); out.push(R.info.render.calls); } return [out, a.park.mergeStats]; });
check('Leistung: unter 5000 Draw-Calls je Blick, statische Gebäudeteile zusammengefasst', Math.max(...dc[0]) < 5000 && dc[1] && dc[1].meshesAfter < dc[1].meshesBefore / 2, JSON.stringify(dc));
await page.setViewportSize({ width: 1280, height: 720 });
const look = await ev(async () => { const a = __app; a.settings.look = true; a.settings.ao = true; a.applyQuality(); await new Promise(r => setTimeout(r, 2500)); const on = a.post.enabled, ao = a.post.gtao.enabled; a.settings.look = false; a.settings.ao = false; a.applyQuality(); return [on, ao, a.post.enabled, !!a.env.iblRT]; });
check('Vice-City-Look, Ambient Occlusion und Himmels-Beleuchtung schaltbar', look[0] === true && look[1] === true && look[2] === false && look[3] === true, JSON.stringify(look));
const r2 = await ev(() => { const a = __app, it = a.park.interactables.find(i => i.kind === 'restaurant'); a.camera.position.set(it.x, 3, it.z); a.walk.pos.set(it.x, 3, it.z); a.game.update(0.1); const h = !!a.game.hint; a.game.interact(); const open = !document.querySelector('#panel').classList.contains('hide'); const sp0 = a.game.S.stats.spent; document.querySelector('#pBody [data-i]').click(); return [h, open, a.game.S.stats.spent - sp0, a.game.S.stats.purchases]; });
check('E-Interaktion öffnet Speisekarte, Kauf bucht ab', r2[0] && r2[1] && r2[2] > 0 && r2[3] === 1, JSON.stringify(r2));
const inv = await ev(() => { const a = __app, g = a.game, items = g.inventory(), first = items[0]; const eaten = first && first.kind !== 'shop' ? g.consume(first.name) : null; return [items.length, first && first.name, eaten, a.player.group.visible, a.park.trackBridges]; });
check('Inventar enthält Kauf, Third-Person-Figur sichtbar, Brücken über Schienen', inv[0] >= 1 && inv[1] && inv[3] === true && inv[4] >= 1, JSON.stringify(inv));
const r3 = await ev(() => { const a = __app; a.ui.closePanel(); a.ui.openMap(); const M = a.ui.map; const it = M.items.find(i => i.kind === 'ride'); const cv = document.querySelector('#bmC'); a.ui.mapClick(cv.width / 2 + (it.x - M.x) * M.scale, cv.height / 2 + (it.z - M.z) * M.scale); document.querySelector('#miNav').click(); return [M.items.length, !!a.game.nav, a.game.nav && a.game.nav.route && a.game.nav.route.length]; });
check('Parkkarte: Items, Klick, Navigation mit Route', r3[0] > 20 && r3[1] && r3[2] > 1, JSON.stringify(r3));
await ev(() => { __app.ui.closeMap(); __app.game.stopNav(); });
// Kollision: im Rennen gegen Gebäude-/Felswände laufen – man darf nicht hindurch
const col = await ev(() => { const a = __app, w = a.park; a.ui.closePanel(); a.ui.closeMap(); const c = w.out.colliders.filter(c => c.hx > 3 && c.hz > 0.1 && c.rot !== undefined)[5]; const cs = Math.cos(c.rot), sn = Math.sin(c.rot); const start = [c.x + (-sn) * (c.hx + 0), c.z]; const ang = Math.atan2(-(c.x - (c.x - 7)), 0); a.camera.position.set(c.x - 7, 3, c.z); a.walk.pos.set(c.x - 7, 3, c.z); a.walk.yaw = Math.PI / 2 * -1 + Math.PI; a.setParkMode('walk'); a.walk.pos.set(c.x - 7, w.groundAt(c.x - 7, c.z, 60) + 1.9, c.z); a.walk.yaw = -Math.PI / 2; return { x: c.x, z: c.z, hx: c.hx, hz: c.hz, rot: c.rot, y0: c.y0, y1: c.y1 }; });
await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(3500); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
const inside = await ev(c => { const a = __app, p = a.walk.pos, cs = Math.cos(c.rot), sn = Math.sin(c.rot), dx = p.x - c.x, dz = p.z - c.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return [Math.abs(lx) < c.hx - 0.05 && Math.abs(lz) < c.hz - 0.05, +Math.abs(lx).toFixed(1), +Math.abs(lz).toFixed(1)]; }, col);
check('Kollision: Rennen durch Wand wird gestoppt', !inside[0], JSON.stringify([col.hx, col.hz, inside]));
// Skins: kaufen, anziehen, Zubehör, Persistenz im Spielstand, Panel per Taste U
const sk = await ev(() => { const a = __app, g = a.game; g.S.wallet = 1000; const ok = g.buySkin('ritter'), eq = g.wardrobe().skinId; const extras = g.lookNow().extras.map(e => e[0]); const owned = !!g.wardrobe().skins.ritter; const ok2 = g.buyPart('top', 5) && g.equipPart('top', 5); const snap = g.snapshot(); a.ui.openPanel('wardrobe'); const panel = !document.querySelector('#panel').classList.contains('hide') && document.querySelectorAll('#pBody .skin').length; a.ui.closePanel(); return [ok, eq, extras.join(','), owned, ok2, snap.wardrobe.skins.ritter === true && snap.wardrobe.look.outfit.top === 5, panel, g.S.wallet, a.player.view.extras.length]; });
check('Skin-Shop: kaufen, anziehen (Helm+Umhang), Einzelteil, Spielstand enthält Look, Panel zeigt Skins', sk[0] && sk[1] === null === false && sk[2] === 'helmet,cape' && sk[3] && sk[4] && sk[5] && sk[6] >= 10 && sk[7] < 1000, JSON.stringify(sk));
// ---- Themenwelten: Rundgang-Seite, Banner beim Betreten, Zonenmusik, Adventure Trail, Fassaden, Wuze Town
const wp = await ev(() => { const a = __app; a.ui.hubAction('worlds'); const cards = [...document.querySelectorAll('#wGrid .pcard')]; return [cards.length, cards.reduce((s, c) => s + c.querySelectorAll('[data-ride]').length, 0), cards.reduce((s, c) => s + c.querySelectorAll('[data-poi]').length, 0)]; });
check('Themenwelten-Seite: 8 Karten mit Fahrgeschäften und Orten', wp[0] === 8 && wp[1] >= 18 && wp[2] >= 15, JSON.stringify(wp));
await ev(() => { __app.ui.closePanel(); });
const spots = [['Berlin', 0, 190], ['Kaiserplatz', 0, 60], ['Mexico', 'mexico'], ['Mystery', 'mystery'], ['Klugheim', 'klugheim'], ['Deep in Africa', 'africa'], ['China Town', 'china'], ['Fantasy', 'fantasy'], ['Rookburgh', 'rookburgh'], ['Wuze Town', 80, 300]];
const bn = await ev(sp => { const a = __app, g = a.game, w = a.park, res = []; for (const [exp, x, z] of sp) { const px = typeof x === 'string' ? w.zones[x].x : x, pz = typeof x === 'string' ? w.zones[x].z : z; a.walk.pos.set(px, 3, pz); a.camera.position.set(px, 3, pz); g.worldNow = null; g.worldCand = null; g.update(1.2); g.update(1.2); const el = document.querySelector('#worldBanner'); res.push([exp, el.querySelector('.wbn') && el.querySelector('.wbn').textContent, el.classList.contains('on')]); } return res; }, spots);
check('Themenwelt-Banner beim Betreten (8 Welten + Kaiserplatz + Wuze Town)', bn.every(r => r[0] === r[1] && r[2]), JSON.stringify(bn.filter(r => r[0] !== r[1] || !r[2])));
const mus = await ev(async () => {
  const a = __app, m = a.music; a.audio.start(); await new Promise(r => setTimeout(r, 300)); const out = { ctx: !!a.audio.ctx, scenes: {} }; if (!out.ctx) return out; m.ready();
  for (const k of ['berlin', 'rookburgh', 'mexico', 'mystery', 'klugheim', 'africa', 'china', 'fantasy']) { try { const fn = m.scene(k); let t = a.audio.ctx.currentTime + 0.1; for (let s = 0; s < 64; s++) t += fn(t, s); out.scenes[k] = 'ok'; } catch (e) { out.scenes[k] = 'FEHLER ' + e.message; } }
  m.setVolume(0.6); for (let i = 0; i < 60; i++) m.update(0.05, 'berlin', true); out.a = [m.key, m.level > 0.1];
  for (let i = 0; i < 120; i++) m.update(0.05, 'mexico', true); out.b = [m.key, m.level > 0.1];
  for (let i = 0; i < 160; i++) m.update(0.05, 'mexico', false); out.c = [m.key, m.level < 0.02]; m.setVolume(a.settings.music ?? 0.5); return out;
});
if (mus.ctx) check('Zonenmusik: 8 prozedurale Stücke, Einblenden, Wechsel, Ausblenden', Object.values(mus.scenes).every(v => v === 'ok') && mus.a[0] === 'berlin' && mus.a[1] && mus.b[0] === 'mexico' && mus.b[1] && mus.c[0] === null && mus.c[1], JSON.stringify(mus)); else console.log('– Zonenmusik übersprungen (kein AudioContext in dieser Umgebung)');
const tr = await ev(() => {
  const a = __app, g = a.game, w = a.park, p = w.pois.find(q => q.kind === 'trail'); if (!p) return { err: 'kein Trail-POI' };
  const out = { n: p.cpsList.length, zone: w.zoneOf(p.x, p.z) }; const put = (x, z) => { a.walk.pos.set(x, 3, z); a.camera.position.set(x, 3, z); };
  g.S.mode = 'free'; put(p.ax, p.az); g.update(0.1); out.hint = g.hint && g.hint.name; const w0 = g.S.wallet; g.interact(); out.started = !!g.trail && !!g.nav; g.interact(); out.twice = !!g.trail;
  for (const c of p.cpsList) { put(c.x, c.z); g.update(0.1); } out.done = g.trail === null; out.reward = g.S.wallet - w0; out.flag = g.S.stats.flags.trail; out.ach = g.unlocked.has('trail'); out.orbs = p.cpsList.every(c => c.done);
  put(p.ax, p.az); g.update(0.1); g.interact(); const was = !!g.trail; g.stopNav(); g.update(0.1); out.cancel = was && g.trail === null;
  put(p.ax, p.az); g.update(0.1); g.interact(); g.update(p.limit + 5); out.timeout = g.trail === null; return out;
});
check('Adventure Trail (Deep in Africa): Wegpunkte, Start per E, Belohnung + Erfolg, Abbruch, Zeitlimit', tr.n >= 4 && tr.zone === 'africa' && tr.hint === 'Adventure Trail' && tr.started && tr.twice && tr.done && tr.reward >= 60 && tr.flag === 1 && tr.ach && tr.orbs && tr.cancel && tr.timeout, JSON.stringify(tr));
const fw = await ev(() => { const w = __app.park; return { fac: (w.facadeList || []).map(f => f.name), wuze: w.wuzeCount, flats: w.pois.filter(p => p.kind === 'flat').map(p => p.name), hot: w.pois.filter(p => p.kind === 'hotel').length, rides: w.rides.length }; });
check('Fassaden der Fahrgeschäfte (Talocan, Tikal, Tartüff, Maus au Chocolat, Mausketiere, Würmling, Rikscha, Feng Ju)', fw.fac.length === 8, JSON.stringify(fw.fac));
check('Wuze Town (Häuser), 3 Hotels, 3 Mitfahr-Attraktionen, 21 Bahnen', fw.wuze >= 6 && fw.hot === 3 && fw.flats.length === 3 && fw.rides >= 21, JSON.stringify([fw.wuze, fw.hot, fw.flats.length, fw.rides]));
await ev(() => { __app.game.stopNav(); __app.ui.closePanel(); });
// Haus betreten: vor die Tür stellen, nach vorn laufen → man steht danach im Haus (Tür ist begehbar)
const hb = await ev(() => { const a = __app, w = a.park, b = w.buildings.find(q => q.hollow && q.d); a.ui.closePanel(); a.ui.closeMap(); const fx = b.x + Math.sin(b.rot) * (b.d / 2 + 3), fz = b.z + Math.cos(b.rot) * (b.d / 2 + 3); a.camera.position.set(fx, 3, fz); a.setParkMode('walk'); a.walk.pos.set(fx, w.groundAt(fx, fz, 60) + 1.9, fz); a.walk.yaw = b.rot; return { x: b.x, z: b.z, d: b.d, w: b.w }; });
await page.keyboard.down('KeyW'); await page.waitForFunction(b => { const p = __app.walk.pos; return Math.hypot(p.x - b.x, p.z - b.z) < b.d / 2 - 0.5; }, hb, { timeout: 60000 }).catch(() => {}); await page.keyboard.up('KeyW');
const hin = await ev(b => { const p = __app.walk.pos; return [Math.hypot(p.x - b.x, p.z - b.z), b.d / 2]; }, hb);
check('Haus betreten: Spieler steht nach dem Laufen durch die Tür im Haus', hin[0] < hin[1] + 0.2, JSON.stringify(hin));
const exitR = await ev(async () => { const a = __app, r = a.park.rides[0]; a.rideOn(r); const st = a.ride.sim.state, t0 = a.ride.sim.timer; return [st, Math.round(t0)]; });
check('Einsteigen: Station mit langem Countdown (≥ 20 s)', exitR[0] === 'station' && exitR[1] >= 20, JSON.stringify(exitR));
const up = await page.waitForFunction(() => __app.ride && __app.ride.train.upgraded === true, null, { timeout: 60000 }).then(() => true).catch(() => false);
check('Fahrgäste im Zug werden zu Vice-City-Figuren (in der Nähe)', up);
await page.keyboard.press('Space'); await page.waitForTimeout(400);
const afterExit = await ev(() => [__app.state, __app.parkMode]);
check('Leertaste = Aussteigen', afterExit[0] === 'park' && afterExit[1] === 'walk', JSON.stringify(afterExit));
const r4 = await ev(() => { const a = __app, it = a.park.interactables.find(i => i.type === 'gate'); a.camera.position.set(it.x, 3, it.z); a.walk.pos.set(it.x, 3, it.z); a.game.update(0.1); a.game.interact(); document.querySelector('#pBody [data-t="0"]').click(); return [a.game.ticketOk(), a.game.S.ticket && a.game.S.ticket.type]; });
check('Ticket kaufen', r4[0], JSON.stringify(r4));
const r5 = await ev(async () => { const a = __app, r = a.park.rides.find(x => x.coaster.name === 'Black Mamba'), it = a.park.interactables.find(i => i.ride === r); a.camera.position.set(it.x, 3, it.z); a.walk.pos.set(it.x, 3, it.z); a.game.update(0.1); a.game.interact(); const st = a.state; let n = 0; while (a.ride.sim.lap < 1 && n < 60000) { a.ride.sim.step(1 / 30); n++; } await new Promise(r => setTimeout(r, 1500)); return [st, a.game.S.stats.rides, [...a.game.unlocked]]; });
check('Fahrt starten, Runde zählt, Erfolge', r5[0] === 'ride' && r5[1] >= 1 && r5[2].includes('first') && r5[2].includes('mamba'), JSON.stringify(r5));
const r6 = await ev(() => { const a = __app; a.toPark(); const it = a.park.interactables.find(i => i.kind === 'hotel'); a.camera.position.set(it.x, 3, it.z); a.walk.pos.set(it.x, 3, it.z); a.game.update(0.1); a.game.interact(); document.querySelector('#pBody [data-b="0"]').click(); const b = a.game.S.bookings.length; document.querySelector('#pBody [data-in]').click(); const inRoom = !!a.game.room; a.game.update(0.1); a.game.interact(); return [b, inRoom, !a.game.room]; });
check('Hotel: buchen, Zimmer betreten, verlassen', r6[0] === 1 && r6[1] && r6[2], JSON.stringify(r6));
const r7 = await ev(() => { const a = __app; a.setWinter(true); const w = a.park.winter; a.setWinter(false); return w; });
check('Wintertraum schaltbar', r7 === true);
const r8 = await ev(async () => { const a = __app; a.game.takePhoto('Test'); await new Promise(r => setTimeout(r, 800)); return a.game.photos.length; });
check('Foto wird aufgenommen', r8 >= 1, 'n=' + r8);
const r9 = await ev(async () => { const a = __app; a.ui.tab('editor'); const m = a.editor.analyse(); document.querySelector('[data-k="LOOP"]').click(); document.querySelector('#edUndo').click(); document.querySelector('#edSave').click(); document.querySelector('#edTest').click(); await new Promise(r => setTimeout(r, 5000)); return [m.err, a.state, a.ride && a.ride.coaster.name, a.game.designs.length]; });
check('Editor: Analyse, Speichern, Testfahrt', !r9[0] && r9[1] === 'ride' && r9[2] === 'Meine Bahn' && r9[3] === 1, JSON.stringify(r9));
const r10 = await ev(async () => { const a = __app; a.showMenu(); a.ui.tab('saves'); document.querySelector('[data-s="1"]').click(); const i = a.game.slotInfo(1); a.game.S.wallet = 5; const ok = a.game.load(1); await new Promise(r => setTimeout(r, 3000)); return [!!i, ok, a.game.S.wallet !== 5, a.park.def.name]; });
check('Speichern/Laden (Slot)', r10[0] && r10[1] && r10[2] && r10[3] === 'Phantasialand', JSON.stringify(r10));
check('Alle Hub-Seiten rendern', await ev(() => { const a = __app; a.showMenu(); for (const t of ['attr', 'worlds', 'hotels', 'food', 'photos', 'stats', 'saves', 'editor', 'hub']) { a.ui.tab(t); if (!document.querySelector('#mbody').innerText.length) return false; } return true; }));
console.log(errs.join('\n') || 'keine Konsolenfehler'); if (errs.length) fails++;
await browser.close(); process.exit(fails ? 1 : 0);
