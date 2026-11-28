const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async()=>{
  const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--allow-file-access-from-files']});
  const p = await b.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('file:///home/user/neon-redline/test/car_view.html?ids=zephyr_s15'); await p.waitForFunction('window.done===true');
  const info = await p.evaluate(()=>{ const m = (window.G.CM,  null); return null; });
  const out = await p.evaluate(()=>{ const CM=window.G.CM, CD=window.G.CD; const spec=CD.byId['zephyr_s15']; const mod=CM.build(spec, CD.defaultCfg(spec), {lod:0}); const res=[]; 
    mod.group.children.forEach((c,i)=>{ if(!c.geometry){res.push([i,c.type]);return;} c.geometry.computeBoundingBox(); const bb=c.geometry.boundingBox; res.push([i, c.type, c.material.length?'multi':(c.material.type), bb.min.toArray().map(v=>+v.toFixed(2)).join(','), bb.max.toArray().map(v=>+v.toFixed(2)).join(',')]); });
    const B=mod.B; return {res, tA:B.tA,tB:B.tB, tPeak:B.tPeak, H:B.H, L:B.L, zR:B.zR, zfa:B.zfa, zra:B.zra, eye: mod.eye.toArray()}; });
  console.log(JSON.stringify(out,null,0).replace(/\],\[/g,'],\n['));
  console.log(errs.join('\n')); await b.close();
})();
