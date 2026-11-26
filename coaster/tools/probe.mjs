import { Builder } from '../src/track.js';
for (const t of process.argv.slice(2)) {
  const b = new Builder(); b.apply(t);
  let minY=1e9, maxY=-1e9, minZ=1e9, maxZ=-1e9; for (const p of b.pts) { minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); minZ=Math.min(minZ,p[2]); maxZ=Math.max(maxZ,p[2]); }
  console.log(t.padEnd(24), 'len', b.s.toFixed(1), 'end x', b.x.toFixed(1), 'y', b.y.toFixed(1), 'z', b.z.toFixed(1), 'th', (b.th*57.3).toFixed(1), 'psi', (b.psi*57.3).toFixed(1), 'phi', (b.phi*57.3).toFixed(1), '| y range', minY.toFixed(1), maxY.toFixed(1), 'z range', minZ.toFixed(1), maxZ.toFixed(1));
}
