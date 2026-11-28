const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async()=>{
  const url = process.argv[2]; const out = process.argv[3]; const w = +(process.argv[4]||1500), h = +(process.argv[5]||860);
  const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--allow-file-access-from-files']});
  const p = await b.newPage({viewport:{width:w,height:h}}); const errs=[];
  p.on('console', m=>{ if(m.type()==='error'||m.type()==='warning') errs.push(m.type()+': '+m.text()); }); p.on('pageerror', e=>errs.push('PAGEERROR '+e.message+' '+(e.stack||'').split('\n').slice(0,3).join('|')));
  await p.goto(url); await p.waitForFunction('window.done===true',{timeout:120000}).catch(e=>errs.push('timeout'));
  await p.screenshot({path:out}); console.log(errs.slice(0,15).join('\n')||'no errors'); await b.close();
})();
