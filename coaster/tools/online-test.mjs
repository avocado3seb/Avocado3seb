// Online-Test: zwei Browser (Host + Gast) über lokalen PeerServer. Prüft Verbindung, Park-/Zug-Sync, Chat, Avatare.
import { createRequire } from 'module'; import { execSync } from 'child_process';
const require = createRequire(import.meta.url); const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:5173/coaster/index.html';
const Q = '?peerhost=127.0.0.1&peerport=9000&peerpath=/';
const OUT = process.argv[2] || '.';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errs = []; let fails = 0;
const mk = async (tag) => { const p = await browser.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => errs.push(tag + ' PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(tag + ' ' + m.text()); }); return p; };
const check = (name, ok, extra = '') => { console.log((ok ? '✔ ' : '✖ ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const A = await mk('A'), B = await mk('B');
await A.goto(BASE + Q); await B.goto(BASE + Q);
for (const p of [A, B]) await p.waitForFunction(() => window.__app && window.__app.park && window.__app.state === 'menu', null, { timeout: 90000 });
const code = await A.evaluate(async () => { const a = window.__app; await a.net.host('Anna'); await a.openPark('Phantasialand'); return a.net.code; });
check('Host eröffnet Raum', /^[A-Z0-9]{5}$/.test(code), code);
await B.evaluate(async code => { await window.__app.net.join(code, 'Ben'); }, code);
await B.waitForFunction(() => window.__app.park && window.__app.park.def.name === 'Phantasialand' && window.__app.state === 'park', null, { timeout: 60000 });
check('Gast folgt dem Park des Hosts', true);
await A.waitForTimeout(1500);
check('Host sieht Gast', await A.evaluate(() => [...window.__app.net.remotes.values()].some(r => r.name === 'Ben')));
check('Gast sieht Host', await B.evaluate(() => [...window.__app.net.remotes.values()].some(r => r.name === 'Anna')));
// Gemeinsame Fahrt: beide in Taron
await A.evaluate(() => { const a = window.__app, r = a.park.rides.find(x => x.coaster.name === 'Taron'); a.enterRide(r, true); });
await B.evaluate(() => { const a = window.__app, r = a.park.rides.find(x => x.coaster.name === 'Taron'); a.enterRide(r, true); a.seat = { car: 1, row: 0, s: 0, custom: true }; });
await A.evaluate(() => { const r = window.__app.ride; r.sim.timer = 0.2; });
await A.waitForTimeout(6000);
const sa = await A.evaluate(() => { const s = window.__app.ride.sim; return { st: s.state, s: s.s, v: s.v }; });
const sb = await B.evaluate(() => { const s = window.__app.ride.sim; return { st: s.state, s: s.s, v: s.v }; });
check('Zug fährt beim Host', sa.st === 'run' && sa.v > 1, JSON.stringify(sa));
check('Zug-Zustand beim Gast synchron', sb.st === sa.st && Math.abs(sb.s - sa.s) < 25, JSON.stringify(sb));
check('Gast sitzt sichtbar im Zug (Host-Sicht)', await A.evaluate(() => { const r = [...window.__app.net.remotes.values()].find(x => x.name === 'Ben'); return !!(r && r.ride && r.group.visible); }));
// Chat
await B.evaluate(() => window.__app.net.sendChat('Hallo Anna!'));
await A.waitForTimeout(800);
check('Chat kommt an', await A.evaluate(() => window.__app.net.log.some(l => l.text.includes('Ben: Hallo Anna!'))));
// Wetter/Zeit vom Host
await A.evaluate(() => { window.__app.env.setTime(21); window.__app.env.setWeather('rain'); });
await B.waitForFunction(() => window.__app.env.weatherName === 'rain' && Math.abs(window.__app.env.hour - 21) < 0.5, null, { timeout: 40000 }).then(() => check('Tageszeit/Wetter folgen dem Host', true)).catch(() => check('Tageszeit/Wetter folgen dem Host', false));
// Gast startet Fahrt per Dispatch
await B.screenshot({ path: OUT + '/online_guest.png' }); await A.screenshot({ path: OUT + '/online_host.png' });
// Verlassen
await B.evaluate(() => window.__app.net.leave());
await A.waitForTimeout(1200);
check('Host merkt Verlassen', await A.evaluate(() => window.__app.net.remotes.size === 0));
const real = errs.filter(e => !/GPU stall|WebGL|Performance|Failed to load resource/.test(e));
console.log(real.join('\n') || 'keine Konsolenfehler'); if (real.length) fails++;
await browser.close(); process.exit(fails ? 1 : 0);
