const { chromium } = require('playwright');
(async () => {
  const out = 'test/out_s3'; const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  p.on('console', m => { const t = m.text(); if ((m.type() === 'error') && !/GPU stall|GL Driver/.test(t)) errs.push(m.type() + ': ' + t.slice(0, 300)); });
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
  await p.goto('file://' + require('path').resolve(__dirname, '../dist/index.html') + '');
  await p.waitForFunction(() => !document.getElementById('menu').classList.contains('hidden'), { timeout: 280000 });
  const st = async (tag) => console.log(tag, JSON.stringify(await p.evaluate(() => ({ mode: G.Game.mode, fps: Math.round(G.Game.fps), kmh: Math.round(G.Game.speedKmh), x: Math.round(G.Game.player.pos.x), y: Math.round(G.Game.player.pos.y), z: Math.round(G.Game.player.pos.z), hp: +G.Game.player.health.toFixed(2), cars: G.AI.cars.length, cops: G.AI.cars.filter(c=>c.kind==='cop').length, heat: G.AI.heat, tun: +G.FX.tunnel.toFixed(2) }))));
  await p.evaluate(() => { document.querySelectorAll('.mbtn').forEach(x => /Freie Fahrt/i.test(x.textContent) && x.click()); }); await p.waitForTimeout(2000); await p.evaluate(() => { const o = document.getElementById('ok'); o && o.click(); G.Career.data.flags.tutDone = true; });
  const tp = async (x, z, yaw, hour, wait, tag, extra) => { await p.evaluate(([x, z, yaw, hour]) => { G.FX.hour = hour; G.FX.setWeather('clear', true); G.Game.respawnAt(x, z, yaw); G.Game.camInit = false; G.AI.reset(); }, [x, z, yaw, hour]); await p.keyboard.down('KeyW'); await p.waitForTimeout(wait); await st(tag); await p.screenshot({ path: out + '_' + tag + '.png' }); await p.keyboard.up('KeyW'); };
  await tp(1700, 20, Math.PI / 2, 16, 14000, 'tunnel');
  await tp(0, 1650, 0, 18.6, 12000, 'bridge');
  await tp(1075, -1150, Math.atan2(0.5, -0.8), 17.5, 12000, 'pass');
  await tp(-1850, -500, 0, 21, 8000, 'harbor');
  // Polizei
  await p.evaluate(() => { G.Game.respawnAt(0, 600, 0); G.AI.addHeat(200, 'Test'); }); await p.keyboard.down('KeyW'); await p.waitForTimeout(16000); await st('cops'); await p.screenshot({ path: out + '_cops.png' }); await p.keyboard.up('KeyW');
  // Crash gegen Gebäude
  await p.evaluate(() => { G.AI.clearHeat(); G.AI.reset(); G.FX.hour = 14; G.Game.respawnAt(60, 200, Math.PI / 2); G.Game.player.vel.set(40, 0, 0); }); await p.keyboard.down('KeyW'); await p.waitForTimeout(6000); await st('crash'); await p.screenshot({ path: out + '_crash.png' }); await p.keyboard.up('KeyW');
  // Event beenden
  await p.evaluate(() => { G.Game.repairAll(); G.Career.startEvent(G.Career.events[0]); }); await p.waitForTimeout(5000);
  await p.evaluate(() => { const a = G.Career.active; const R = a.route.pts; const q = R[R.length - 2]; G.Game.player.pos.set(q.x, q.h + 1, q.z); a.state = 'run'; a.cd = 0; G.Game.eventFreeze = false; for (const c of a.opp) c.state = 'race'; }); await p.waitForTimeout(5000); await st('finish'); await p.screenshot({ path: out + '_finish.png' });
  console.log(await p.evaluate(() => document.getElementById('card').innerText.slice(0, 200)));
  console.log(errs.slice(0, 20).join('\n') || 'keine Fehler'); await b.close();
})();
