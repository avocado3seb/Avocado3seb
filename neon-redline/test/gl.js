const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async()=>{
  const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
  const p = await b.newPage();
  const t = require('fs').readFileSync('node_modules/three/build/three.min.js','utf8');
  await p.setContent('<canvas id=c></canvas>');
  await p.addScriptTag({content:t});
  const r = await p.evaluate(()=>{
    const c=document.getElementById('c');
    const r=new THREE.WebGLRenderer({canvas:c});
    const gl=r.getContext();
    return {webgl2: r.capabilities.isWebGL2, ext: !!gl.getExtension('EXT_color_buffer_float'), half: !!gl.getExtension('EXT_color_buffer_half_float'), maxTex: r.capabilities.maxTextureSize, aniso: r.capabilities.getMaxAnisotropy(), v: THREE.REVISION};
  });
  console.log(r);
  await b.close();
})();
