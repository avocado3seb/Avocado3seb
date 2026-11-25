import * as THREE from 'three';
import * as T from './textures.js';

// Gemeinsame Materialien der Welt (Schlüssel = MBSet-Schlüssel)
export function createMaterials() {
  const M = {};
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const rep = (t, x, y) => { t.repeat.set(x, y); return t; };

  const asphalt = T.makeAsphalt();
  M.asphalt = std({ map: asphalt, roughness: 0.92, metalness: 0.0, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.road = M.asphalt;
  M.sidewalk = std({ map: T.makeSidewalk(), roughness: 0.95, vertexColors: true });
  M.concrete = std({ map: T.makeConcrete(), roughness: 0.95, vertexColors: true });
  M.grass = std({ map: T.makeGrass(), roughness: 1, vertexColors: true });
  M.sand = std({ map: T.makeSand(), roughness: 1, vertexColors: true });
  M.dirt = std({ map: T.makeDirt(), roughness: 1, vertexColors: true });
  M.plaza = std({ map: T.makePlaza(), roughness: 0.85, vertexColors: true });
  M.pitch = std({ map: T.makePitch(), roughness: 1, vertexColors: true });
  M.runway = std({ map: T.makeRunway(), roughness: 0.9, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.wood = std({ map: T.makeWood(), roughness: 0.8, vertexColors: true });
  M.metal = std({ map: T.makeMetal(), roughness: 0.45, metalness: 0.7, vertexColors: true });
  M.roof = std({ map: T.makeRoof(), roughness: 0.95, vertexColors: true });
  M.tiles = std({ map: T.makeTiles(), roughness: 0.8, vertexColors: true });
  M.marking = std({ vertexColors: true, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  M.plain = std({ roughness: 0.75, metalness: 0.05, vertexColors: true });
  M.shiny = std({ roughness: 0.28, metalness: 0.85, vertexColors: true, envMapIntensity: 1.3 });
  M.leaf = std({ roughness: 0.85, vertexColors: true });
  M.glassClear = std({ color: 0x9fc4d8, roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.35, vertexColors: true, depthWrite: false });
  M.pool = std({ color: 0x35c8e8, roughness: 0.1, metalness: 0.1, emissive: 0x0a5a78, emissiveIntensity: 0.4, vertexColors: true });
  // Leuchtende Materialien
  M.neon = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  M.lamp = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  M.glow = new THREE.MeshBasicMaterial({ map: T.makeGlow(), polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, vertexColors: true, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

  // Fassaden
  const kinds = { office: [0.85, 0.05], glass: [0.18, 0.45], brick: [0.9, 0.02], deco: [0.8, 0.05], house: [0.9, 0.02], shop: [0.4, 0.3], warehouse: [0.7, 0.4] };
  for (const [k, [rough, met]] of Object.entries(kinds)) {
    const f = T.makeFacade(k);
    M['facade_' + k] = std({ map: f.map, emissiveMap: f.emissive, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: rough, metalness: met, vertexColors: true, envMapIntensity: k === 'glass' ? 1.6 : 0.8 });
  }
  return M;
}

export const NIGHT_MATS = ['facade_office', 'facade_glass', 'facade_brick', 'facade_deco', 'facade_house', 'facade_shop', 'facade_warehouse'];

export function updateMaterialsForEnv(M, night, wet) {
  for (const k of NIGHT_MATS) {
    const m = M[k];
    m.emissiveIntensity = night * (k === 'facade_shop' ? 1.0 : 0.85);
  }
  M.neon.color.setScalar(0.35 + night * 0.9);
  M.lamp.color.setScalar(0.25 + night * 1.0);
  M.glow.opacity = night * 0.22;
  M.pool.emissiveIntensity = 0.25 + night * 0.9;
  M.asphalt.roughness = 0.92 - wet * 0.62;
  M.asphalt.envMapIntensity = 0.3 + wet * 1.6;
  M.asphalt.color.setScalar(1 - wet * 0.4);
  M.runway.roughness = 0.9 - wet * 0.6;
  M.sidewalk.roughness = 0.95 - wet * 0.35;
  M.plaza.roughness = 0.85 - wet * 0.5;
}
