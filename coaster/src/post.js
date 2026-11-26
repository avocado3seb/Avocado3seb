// ============================================================================
//  post.js – "Vice-City-Look": Nachbearbeitung mit Bloom (leuchtende Lichter), Farbkorrektur
//  (Kontrast, Sättigung, warme Töne), Vignette und Filmkorn. Umgeht den Standard-Renderer nur, wenn aktiv.
// ============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.enabled = false; this.q = 'medium';
    const size = renderer.getSize(new THREE.Vector2());
    this.rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(renderer, this.rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.gtao = new GTAOPass(scene, camera, size.x, size.y); this.gtao.output = GTAOPass.OUTPUT.Default; this.gtao.enabled = false; this.gtao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 }); this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.65, 0.92); this.composer.addPass(this.bloom);
    this.grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uNight: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uNight; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv-0.5; float v = smoothstep(0.9, 0.28, length(d*vec2(1.0,0.85)));
          c.rgb *= mix(0.76, 1.0, v);
          float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
          c.rgb = mix(vec3(l), c.rgb, 1.22);                       // kräftigere Farben
          c.rgb = (c.rgb - 0.18) * 1.1 + 0.18;                     // mehr Kontrast
          c.rgb = mix(c.rgb, c.rgb*vec3(1.05,1.0,0.92), 0.55);    // warmer Ton
          c.rgb += (h(vUv*vec2(1920.0,1080.0)+uTime)-0.5)*0.016;
          gl_FragColor = c; }`,
    });
    this.composer.addPass(this.grade); this.composer.addPass(new OutputPass());
  }
  setQuality(q, on, ao = false) { this.q = q; this.gtao.enabled = !!on && !!ao && q !== 'low'; this.enabled = !!on && q !== 'low'; this.bloom.enabled = q === 'high'; const s = q === 'high' ? 4 : q === 'medium' ? 2 : 0; for (const t of [this.composer.renderTarget1, this.composer.renderTarget2]) { t.samples = s; t.dispose(); } }
  resize(w, h) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
  render(night) { this.grade.uniforms.uTime.value = (performance.now() * 0.001) % 100; this.grade.uniforms.uNight.value = night || 0; this.composer.render(); }
}
