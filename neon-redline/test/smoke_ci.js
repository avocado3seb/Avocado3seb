/* Browser-Rauchtest für CI: lädt dist/index.html (WebGL über SwiftShader), startet die freie Fahrt, fährt kurz und prüft auf Fehler. */
const path = require('path'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/GPU stall|GL Driver/.test(t)) errs.push('console: ' + t.slice(0, 300)); });
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
  await p.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await p.waitForFunction(() => !document.getElementById('menu').classList.contains('hidden') || /Fehler/.test(document.getElementById('loadmsg').textContent), { timeout: 300000 });
  const loadMsg = await p.evaluate(() => document.getElementById('loadmsg').textContent); if (/Fehler/.test(loadMsg)) errs.push('Startfehler: ' + loadMsg);
  await p.evaluate(() => { const x = [...document.querySelectorAll('.mbtn')].find(e => /Freie Fahrt/i.test(e.textContent)); x && x.click(); });
  await p.waitForTimeout(2500); await p.evaluate(() => { const o = document.getElementById('ok'); o && o.click(); }); await p.keyboard.down('KeyW'); await p.waitForTimeout(10000);
  const s = await p.evaluate(() => ({ mode: G.Game.mode, kmh: G.Game.speedKmh, chunks: G.Gen.chunks.size, cars: G.AI.cars.length }));
  console.log('Zustand:', JSON.stringify(s)); if (s.mode !== 'drive') errs.push('Spiel nicht im Fahrmodus: ' + s.mode); if (!(s.kmh > 5)) errs.push('Fahrzeug bewegt sich nicht: ' + s.kmh); if (s.chunks < 50) errs.push('Zu wenige Chunks: ' + s.chunks);
  await p.evaluate(() => { G.UI.openGarage(G.Career.garages[0], 'perf'); }); await p.waitForTimeout(2000); await p.evaluate(() => G.UI.closeGarage()); await p.waitForTimeout(1500);
  await p.evaluate(() => { G.Career.startEvent(G.Career.events[0]); }); await p.waitForTimeout(6000);
  await p.screenshot({ path: path.resolve(__dirname, '../test-ci.png') }); await b.close();
  if (errs.length) { console.error('FEHLER:\n' + errs.join('\n')); process.exit(1); } console.log('Rauchtest bestanden');
})();
