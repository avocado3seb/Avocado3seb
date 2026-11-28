// ============================================================================
//  pl_merge.js – fasst die statischen Teile der Gebäude/Dekorationen zusammen: je Material und 96-m-Kachel ein Mesh statt hunderter Einzelteile.
//  Ohne das hat Phantasialand je Blick 7000+ Draw-Calls (jedes Fenster, Brett, Zierteil ein eigenes Mesh); damit sind es wenige Tausend.
//  Betrifft nur Gruppen, die über out.world.add() eingefügt wurden und nicht als animiert markiert sind (userData.noMerge).
//  Ausgenommen bleiben: animierte Teile (out.spinners), Instanced/Skinned-Meshes, Material-Arrays, gespiegelte Meshes (negative Skalierung), Sprites.
// ============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mats } from './pl_assets.js';

// Gleich aussehende Materialien (andere Instanz, gleiche Eigenschaften) werden zu einer Instanz zusammengeführt – Lampen nie mit Nicht-Lampen mischen
function matSig(m, lamps, shared) {
  if (shared.has(m)) return 'm:' + m.uuid; // Materialien aus dem Asset-Cache (A.M) werden zur Laufzeit verändert (z. B. Winter-Schnee auf Dächern) → Instanz beibehalten
  const lamp = lamps.has(m);
  if (!(m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial)) return 'u:' + m.uuid;
  const t = x => x ? (x.source ? x.source.uuid : x.uuid) + ':' + x.repeat.x.toFixed(3) + ',' + x.repeat.y.toFixed(3) + ',' + x.offset.x.toFixed(3) + ',' + x.offset.y.toFixed(3) + ',' + x.rotation.toFixed(3) + ',' + x.wrapS + x.wrapT + x.colorSpace + x.flipY : '';
  return [lamp ? 'L' : 'S', m.type, m.color.getHex(), m.emissive ? m.emissive.getHex() + (lamp ? '' : ':' + m.emissiveIntensity) : '', lamp ? m.userData.base ?? '' : '', m.roughness, m.metalness, m.side, m.transparent ? m.opacity : 1, m.alphaTest, m.vertexColors ? 1 : 0, m.flatShading ? 1 : 0,
    m.polygonOffset ? m.polygonOffsetFactor + ',' + m.polygonOffsetUnits : '', m.depthWrite, m.depthTest, m.fog, m.blending, t(m.map), t(m.emissiveMap), t(m.normalMap), t(m.roughnessMap), t(m.alphaMap), m.normalScale ? m.normalScale.x : ''].join('|');
}

export function bakeStatic(world, cell = 96) {
  const root = world.group, lamps = new Set(world.env.lamps), shared = new Set(Object.values(mats)), keep = new Set((world.out.spinners || []).map(s => s.obj)), canon = new Map(), ids = new Map(), buckets = new Map();
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert(), rel = new THREE.Matrix4(), box = new THREE.Box3(), c = new THREE.Vector3();
  const targets = root.children.filter(o => o.isGroup && o.userData.merge && !o.userData.noMerge), remove = []; let before = 0;
  for (const g of targets) {
    g.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.isSprite || Array.isArray(o.material) || !o.geometry || !o.geometry.attributes.position) return;
      for (let p = o; p && p !== root; p = p.parent) if (keep.has(p) || p.userData.noMerge || (p !== o && !p.visible)) return;
      before++;
      if (!o.visible) { remove.push(o); return; } // unsichtbare Teile (z. B. durch ein Stilbauteil ersetztes Dach) gleich entfernen
      rel.multiplyMatrices(rootInv, o.matrixWorld); if (rel.determinant() <= 0) return;
      const geo = o.geometry.clone().applyMatrix4(rel);
      const sig = matSig(o.material, lamps, shared); let cm = canon.get(sig); if (!cm) canon.set(sig, cm = o.material);
      let id = ids.get(cm); if (id === undefined) ids.set(cm, id = ids.size);
      box.setFromBufferAttribute(geo.attributes.position); box.getCenter(c);
      const key = id + '|' + Math.floor(c.x / cell) + '|' + Math.floor(c.z / cell) + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0);
      let b = buckets.get(key); if (!b) buckets.set(key, b = { material: cm, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
      b.geos.push(geo); remove.push(o);
    });
  }
  let after = 0;
  for (const b of buckets.values()) {
    // gleiche Attribute und gleiche Indizierung erzwingen (sonst verweigert mergeGeometries)
    const names = b.geos.map(g => Object.keys(g.attributes)); const common = names[0].filter(n => names.every(a => a.includes(n)));
    const allIdx = b.geos.every(g => g.index), geos = b.geos.map(g => { for (const n of Object.keys(g.attributes)) if (!common.includes(n)) g.deleteAttribute(n); g.clearGroups(); return allIdx || !g.index ? g : g.toNonIndexed(); });
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false); if (!merged) continue;
    merged.computeBoundingSphere(); const m = new THREE.Mesh(merged, b.material); m.castShadow = b.cast; m.receiveShadow = b.recv; m.userData.merged = true; root.add(m); after++;
  }
  for (const o of remove) if (o.parent) o.parent.remove(o);
  return { groups: targets.length, meshesBefore: before, meshesAfter: after, materials: canon.size };
}
