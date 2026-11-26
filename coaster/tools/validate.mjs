// Validiert alle Bahnen der Datenbank: baut Strecke, simuliert eine Runde, meldet Auffälligkeiten
import { buildTrack } from '../src/track.js';
import { Sim } from '../src/physics.js';
import { genLayout } from '../src/gen.js';
import { CATS } from '../src/specs.js';
import { buildDatabase } from '../src/data/index.js';
const db = buildDatabase();
let bad = 0;
const rows = [];
for (const c of db.coasters) {
  const spec = CATS[c.cat];
  const layout = c.layout || genLayout(c);
  let tr;
  try { tr = buildTrack(layout, { trainLen: spec.cars * spec.spacing }); } catch (e) { console.log('FEHLER', c.name, e.message); bad++; globalThis.__crash = true; continue; }
  const sim = new Sim(tr, { cars: spec.cars, spacing: spec.spacing, crr: spec.crr });
  let t = 0; sim.timer = 0.1;
  let gmax = 0, gAt = 0;
  while (sim.lap < 1 && t < 900) { sim.step(1 / 60); t += 1 / 60; if (sim.state === 'run' && sim.g.vert > gmax) { gmax = sim.g.vert; gAt = sim.s % tr.L; } }
  const gTok = (tr.log.find(l => gAt >= l[1] && gAt <= l[2]) || ['conn'])[0];
  const st = sim.lastLapStats || sim.stats;
  const issues = [];
  if (t >= 900) issues.push('LAUFT NICHT DURCH');
  if (st.assist > 3) issues.push('Hilfsantrieb ' + st.assist.toFixed(1) + 's');
  if (tr.connLen > 160) issues.push('Verbinder ' + tr.connLen.toFixed(0) + 'm');
  if (tr.bounds.minY < -0.5) issues.push('minY ' + tr.bounds.minY.toFixed(1));
  const attr = c.kind === 'Attraktion';
  if (attr) { rows.push([c.name, c.park, 'A', tr.L.toFixed(0), '-', (st.maxV * 3.6).toFixed(0), '-', st.maxY.toFixed(0), '-', tr.inversions, '-', st.maxG.toFixed(1), tr.connLen.toFixed(0), t.toFixed(0), t >= 900 ? 'LAUFT NICHT DURCH' : (tr.connLen > 160 ? 'Verbinder ' + tr.connLen.toFixed(0) : '')]); if (t >= 900 || tr.connLen > 160) bad++; continue; }
  if (st.maxG > 6.5) issues.push('G+ ' + st.maxG.toFixed(1) + ' @' + gTok);
  if (st.minG < -1.8) issues.push('G- ' + st.minG.toFixed(1));
  if (tr.warn.length) issues.push(tr.warn.join(';'));
  if (tr.inversions < Math.min(c.inv, 2) ) issues.push(`Inv ${tr.inversions}/${c.inv}`);
  if (tr.L > c.len * 2.3 || tr.L < c.len * 0.4) issues.push(`Länge ${tr.L.toFixed(0)}/${c.len}`);
  if (st.maxV * 3.6 < c.v * 0.6 || st.maxV * 3.6 > c.v * 1.5) issues.push(`v ${(st.maxV * 3.6).toFixed(0)}/${c.v}`);
  rows.push([c.name, c.park, c.layout ? 'H' : 'G', tr.L.toFixed(0), c.len, (st.maxV * 3.6).toFixed(0), c.v, st.maxY.toFixed(0), c.h, tr.inversions, c.inv, st.maxG.toFixed(1), tr.connLen.toFixed(0), t.toFixed(0), issues.join(' | ')]);
  if (issues.length) bad++;
}
const w = [26, 22, 1, 5, 5, 4, 4, 3, 3, 2, 2, 4, 4, 4];
for (const r of rows) console.log(r.slice(0, 14).map((x, i) => String(x).slice(0, w[i] + 4).padEnd(w[i])).join(' ') + (r[14] ? '  ⚠ ' + r[14] : ''));
console.log(`\n${db.coasters.length} Bahnen, ${bad} mit Auffälligkeiten`);
const fatal = rows.filter(r => /LAUFT NICHT DURCH|Verbinder|minY/.test(r[14])).length;
if (process.argv.includes('--strict') && (fatal || globalThis.__crash)) { console.log('STRICT: ' + fatal + ' Bahnen mit schweren Fehlern'); process.exit(1); }
