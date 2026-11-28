const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || 'test/out_smoke'; const w = +(process.argv[3]||960), h = +(process.argv[4]||540);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: w, height: h } }); const errs = [];
  p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|Deprecat/.test(t)) errs.push(m.type() + ': ' + t.slice(0, 300)); });
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
  await p.goto('file://' + require('path').resolve(__dirname, '../dist/index.html') + '');
  try { await p.waitForFunction(() => !document.getElementById('menu').classList.contains('hidden') || /Fehler/.test(document.getElementById('loadmsg').textContent), { timeout: 280000 }); } catch (e) { errs.push('TIMEOUT beim Laden: ' + await p.evaluate(() => document.getElementById('loadmsg').textContent)); }
  console.log('load msg:', await p.evaluate(() => document.getElementById('loadmsg').textContent));
  await p.screenshot({ path: out + '_menu.png' });
  if (process.argv[5] !== 'menuonly') {
    await p.evaluate(() => { const b = [...document.querySelectorAll('.mbtn')].find(x => /Freie Fahrt/i.test(x.textContent)); b && b.click(); });
    await p.waitForTimeout(6000); await p.keyboard.down('KeyW'); await p.waitForTimeout(9000);
    await p.screenshot({ path: out + '_drive.png' });
    console.log(JSON.stringify(await p.evaluate(() => ({ mode: G.Game.mode, fps: Math.round(G.Game.fps), kmh: Math.round(G.Game.speedKmh), chunks: G.Gen.chunks.size, queue: G.Gen.queue.length, cars: G.AI.cars.length, dpr: G.Game.dpr }))));
  }
  console.log(errs.slice(0, 25).join('\n') || 'keine Fehler'); await b.close();
})();
