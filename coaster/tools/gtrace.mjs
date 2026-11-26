import { buildTrack } from '../src/track.js';
import { Sim } from '../src/physics.js';
import { genLayout } from '../src/gen.js';
import { CATS } from '../src/specs.js';
import { buildDatabase } from '../src/data/index.js';
const db = buildDatabase(); const c = db.coasters.find(x => x.name === process.argv[2]);
const spec = CATS[c.cat]; const dsl = c.layout || genLayout(c); const tr = buildTrack(dsl, { trainLen: spec.cars * spec.spacing });
console.log(dsl);
const sim = new Sim(tr, { cars: spec.cars, spacing: spec.spacing, crr: spec.crr }); sim.timer = 0.1;
let t = 0, last = 0;
while (sim.lap < 1 && t < 900) { sim.step(1 / 60); t += 1 / 60; if (sim.state === 'run' && sim.g.vert > 5.5 && t - last > 0.3) { last = t; const s = sim.s % tr.L; const tok = (tr.log.find(l => s >= l[1] && s <= l[2]) || ['conn'])[0]; console.log('t', t.toFixed(1), 's', s.toFixed(0), 'v', (sim.v * 3.6).toFixed(0), 'gv', sim.g.vert.toFixed(1), tok); } }
