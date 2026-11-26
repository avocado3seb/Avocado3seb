import { Builder } from '../src/track.js';
for (const t of process.argv.slice(2)) {
  const b = new Builder(); b.apply(t);
  let minR = 1e9, at = 0;
  for (let i = 2; i < b.pts.length - 2; i++) {
    const p0 = b.pts[i - 2], p1 = b.pts[i], p2 = b.pts[i + 2];
    const a = Math.hypot(p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]), c = Math.hypot(p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2]), d = Math.hypot(p2[0]-p0[0], p2[1]-p0[1], p2[2]-p0[2]);
    const s = (a + c + d) / 2, area = Math.sqrt(Math.max(0, s*(s-a)*(s-c)*(s-d)));
    const R = area > 1e-6 ? a*c*d/(4*area) : 1e9;
    if (R < minR) { minR = R; at = i / b.pts.length; }
  }
  console.log(t.padEnd(22), 'min radius', minR.toFixed(1), 'at', (at*100).toFixed(0)+'%', 'len', b.s.toFixed(0));
}
