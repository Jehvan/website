// Stage floor: three tiling PBR sets (base / road / paved) blended by a mask painted from the layout.
import * as THREE from 'three';
import { tex, S } from './assets.js';

function paintMask(L) {
  const k = 0.64, w = Math.round(L.w * k), h = Math.round(L.h * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round'; g.lineJoin = 'round';
  const stroke = (pts, width, col, blur) => {
    if (!pts || pts.length < 2) return;
    g.filter = `blur(${blur}px)`; g.strokeStyle = col; g.lineWidth = width * k;
    g.beginPath(); g.moveTo(pts[0][0] * k, pts[0][1] * k);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * k, pts[i][1] * k);
    g.stroke();
  };
  const blob = (x, y, r, col, blur) => { g.filter = `blur(${blur}px)`; g.fillStyle = col; g.beginPath(); g.arc(x * k, y * k, r * k, 0, 7); g.fill(); };
  // R = dirt road / trampled earth
  if (!L.indoor) {
    stroke(L.road, (L.roadW || 40) * 2.1, '#ff0000', 7);
    for (const p of L.paths || []) stroke(p, 66, '#ff0000', 7);
    for (const p of L.props) {
      if (p.kind === 'campfire') blob(p.x, p.y, 70, '#ff0000', 14);
      else if (['cottage', 'tent', 'tent_blue', 'camp_tent', 'forge', 'well'].includes(p.kind)) blob(p.x, p.y, 46 * (p.s || 1), '#b00000', 16);
    }
    for (const pl of L.pools || []) blob(pl.x, pl.y, pl.r + 26, '#c00000', 12);
    if (L.river) { g.filter = 'blur(8px)'; g.fillStyle = '#ff0000'; g.fillRect((L.river.x0 - 30) * k, 0, (L.river.x1 - L.river.x0 + 60) * k, h); }
  }
  // G = paving
  if (L.plaza) blob(L.plaza[0], L.plaza[1], L.plaza[2], '#00ff00', 3);
  if (L.theme === 'gate') { g.filter = 'blur(6px)'; g.fillStyle = '#00ff00'; g.beginPath(); g.moveTo(560 * k, 150 * k); g.lineTo(1040 * k, 150 * k); g.lineTo(1100 * k, 420 * k); g.lineTo(500 * k, 420 * k); g.fill(); }
  // B = large soft darker patches, for variety
  let seed = (L.seed || 1) * 9301 + 49297;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < 46; i++) blob(rnd() * L.w, rnd() * L.h, 40 + rnd() * 110, `rgba(0,0,255,${0.25 + rnd() * 0.3})`, 26);
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function buildGround(L, th) {
  const w = L.w * S, h = L.h * S, pad = 60;
  const rep = th.rep;
  const mat = new THREE.MeshStandardMaterial({
    map: tex(`tex/${th.ground}/diff.jpg`), normalMap: tex(`tex/${th.ground}/nor.jpg`, { srgb: false }), roughness: 0.96, metalness: 0,
    color: th.groundTint ?? 0xffffff,
  });
  const u = {
    uMask: { value: paintMask(L) },
    uMap2: { value: tex(`tex/${th.road}/diff.jpg`) }, uNor2: { value: tex(`tex/${th.road}/nor.jpg`, { srgb: false }) },
    uMap3: { value: tex(`tex/${th.plaza}/diff.jpg`) }, uNor3: { value: tex(`tex/${th.plaza}/nor.jpg`, { srgb: false }) },
    uRep: { value: new THREE.Vector4(rep, rep * h / w, w, h) },      // xy = tiling over the map, zw = map size in metres
    uPad: { value: pad },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; uniform sampler2D uMask, uMap2, uNor2, uMap3, uNor3; uniform vec4 uRep; uniform float uPad;
        vec2 gUv; vec4 gMask;`)
      .replace('#include <map_fragment>', `
        vec2 mapUv01 = vec2(vWPos.x / uRep.z, vWPos.z / uRep.w);
        gUv = mapUv01 * uRep.xy;
        gMask = texture2D(uMask, clamp(mapUv01, 0.0, 1.0));
        float inside = step(0.0, mapUv01.x) * step(mapUv01.x, 1.0) * step(0.0, mapUv01.y) * step(mapUv01.y, 1.0);
        gMask *= inside;
        vec4 cA = texture2D(map, gUv);
        // break up tiling with a second, larger sample
        cA.rgb = mix(cA.rgb, texture2D(map, gUv * 0.27 + 0.31).rgb, 0.35);
        vec4 cB = texture2D(uMap2, gUv * 0.9);
        vec4 cC = texture2D(uMap3, gUv * 1.25);
        float rw = smoothstep(0.25, 0.75, gMask.r + (cB.r - 0.3) * 0.5 * gMask.r);
        vec4 gc = mix(cA, cB, rw);
        gc = mix(gc, cC, smoothstep(0.35, 0.65, gMask.g));
        gc.rgb *= 1.0 - gMask.b * 0.32;
        diffuseColor *= gc;`)
      .replace('#include <normal_fragment_maps>', `
        vec3 nA = texture2D(normalMap, gUv).xyz * 2.0 - 1.0;
        vec3 nB = texture2D(uNor2, gUv * 0.9).xyz * 2.0 - 1.0;
        vec3 nC = texture2D(uNor3, gUv * 1.25).xyz * 2.0 - 1.0;
        vec3 mapN = mix(mix(nA, nB, smoothstep(0.25, 0.75, gMask.r)), nC, smoothstep(0.35, 0.65, gMask.g));
        mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);`);
  };
  mat.normalScale.set(1.2, 1.2);
  const geo = new THREE.PlaneGeometry(w + pad * 2, h + pad * 2, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(w / 2, 0, h / 2);
  m.receiveShadow = true;
  return m;
}
