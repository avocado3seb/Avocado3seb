// Playwright-Test: lädt das Spiel, sammelt Konsolenfehler, macht Screenshots
import { createRequire } from 'module'; import { execSync } from 'child_process';
const require = createRequire(import.meta.url); const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const OUT = process.argv[2] || '/tmp/claude-0/-home-user-Avocado3seb/3e0de609-42c5-517a-8844-eef1ea943b59/scratchpad';
const steps = JSON.parse(process.argv[3] || '[]');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type()) || m.text().startsWith('[Park]')) errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.goto('http://127.0.0.1:5173/coaster/index.html');
await page.waitForFunction(() => window.__app && window.__app.park && window.__app.state === 'menu', null, { timeout: 90000 }).catch(e => errs.push('TIMEOUT waiting for menu'));
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + '/menu.png' });
for (const [i, s] of steps.entries()) {
  if (s.eval) { const r = await page.evaluate(s.eval).catch(e => 'EVALERR ' + e.message); if (r !== undefined) console.log('eval', i, JSON.stringify(r)); }
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.shot) await page.screenshot({ path: OUT + '/' + s.shot + '.png' });
}
console.log(errs.join('\n') || 'keine Konsolenfehler');
await browser.close();
