// Builds the 3D dressing for a stage layout: painted ground, instanced props, buildings, water, fires, ambience.
import * as THREE from 'three';
import { paintGround, toTexture, glowTexture, Tex, mkCanvas } from './textures.js';
import { buildParts, meshFromParts, instanceParts, PM } from './props.js';
import { std } from './materials.js';
import { createHeir } from './characters.js';
import { rng } from '../world.js';

const PI = Math.PI;
const BASE = { fields: 0x6f8f3e, wood: 0x3f5c2a, bridge: 0x648540, marsh: 0x48583a, gate: 0x6c7248, hall: 0x2a2622, vault: 0x201e26 };

export function buildWorld(L, quality) {
  const hi = quality === 'high';
  const group = new THREE.Group();
  const R = rng(L.seed * 17 + 3);
  const upd = [];                      // per-frame animators
  const own = [];                      // textures to dispose
  const shadows = hi;

  /* ---- ground ---- */
  const gcan = paintGround(L, quality);
  const gtex = toTexture(gcan, { aniso: hi ? 8 : 2 }); own.push(gtex); gtex.userData.shared = false;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), std({ map: gtex, roughness: 1, color: 0xffffff }));
  ground.material.userData.shared = false;
  ground.rotation.x = -PI / 2; ground.position.set(L.w / 2, 0, L.h / 2); ground.receiveShadow = shadows;
  const skirtMat = std({ color: BASE[L.theme] || 0x444444, roughness: 1 }); skirtMat.userData.shared = false;
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(L.w * 5, L.h * 5), skirtMat);
  skirt.rotation.x = -PI / 2; skirt.position.set(L.w / 2, -0.8, L.h / 2);
  group.add(skirt, ground);

  const place = (kind, placements, args = []) => {
    if (!placements.length) return;
    const parts = buildParts(kind, quality, ...args);
    const g = instanceParts(parts, placements, { shadows });
    group.add(g);
  };
  const single = (kind, x, z, { rot = 0, s = 1, y = 0, args = [] } = {}) => {
    const g = meshFromParts(buildParts(kind, quality, ...args), { shadows });
    g.position.set(x, y, z); g.rotation.y = rot; g.scale.setScalar(s);
    group.add(g); return g;
  };
  const glow = (x, y, z, color, size, op = 0.8) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: op, fog: false }));
    s.position.set(x, y, z); s.scale.setScalar(size); group.add(s); return s;
  };
  const byKind = (k) => L.props.filter((p) => p.kind === k);
  const pl = (arr, f = {}) => arr.map((p, i) => ({ x: p.x, z: p.y, rot: p.rot, s: p.s, tint: R(), ...f, ...(typeof f === 'function' ? f(p, i) : {}) }));

  /* ---- vegetation & rocks ---- */
  const trees = byKind('tree');
  if (trees.length) {
    const broad = trees.filter((t) => !t.pine), pines = trees.filter((t) => t.pine);
    for (let v = 0; v < 3; v++) place('tree', pl(broad.filter((_, i) => i % 3 === v), { sy: 1 }), [v]);
    place('pine', pl(pines));
  }
  place('deadtree', pl(byKind('deadtree')));
  place('column', pl(byKind('column')));
  place('ruin', pl(byKind('ruin')));
  place('logs', pl(byKind('logs')));
  place('hay', pl(byKind('hay'), { sy: 1 }).map((p) => ({ ...p, s: p.s * 1.25 })));
  place('fence', pl(byKind('fence')));
  place('rock', byKind('rock').map((p) => ({ x: p.x, z: p.y, rot: p.rot, s: 12 * p.s, sx: 1.15, sy: 0.7, sz: 0.95 })));
  const gr = byKind('grass');
  const grassN = hi ? gr.length : Math.floor(gr.length * 0.45);
  const grassMat = L.theme === 'marsh' ? '#5a7a3a' : L.theme === 'wood' ? '#4a7a30' : '#6a9a3a';
  void grassMat;
  place('grass', gr.slice(0, grassN).map((p) => ({ x: p.x, z: p.y, rot: p.rot, s: p.s, tint: R() })));

  /* ---- perimeter dressing so the edge of the world is not a void ---- */
  if (!L.indoor) {
    const per = [], perPine = [];
    const count = hi ? 70 : 34;
    for (let i = 0; i < count; i++) {
      const side = R();
      let x, z;
      if (side < 0.36) { x = -20 - R() * 220; z = R() * (L.h + 100); }
      else if (side < 0.72) { x = L.w + 20 + R() * 220; z = R() * (L.h + 100); }
      else { x = R() * (L.w + 400) - 200; z = -20 - R() * 200; }
      if (L.theme === 'gate' && z < 0) continue;
      const p = { x, z, rot: R() * 6, s: 1.1 + R() * 0.9, tint: R() };
      (L.theme === 'wood' || R() < 0.3 ? perPine : per).push(p);
    }
    if (L.theme === 'marsh') place('deadtree', [...per, ...perPine].map((p) => ({ ...p, s: p.s * 1.1 })));
    else { place('tree', per, [0]); place('pine', perPine); }
  }

  /* ---- buildings & structures ---- */
  const smokes = [];
  for (const c of byKind('cottage')) {
    const g = single('cottage', c.x, c.y, { rot: -c.rot, s: c.s });
    // chimney smoke puffs
    const cx = c.x + Math.cos(-c.rot) * 34 * c.s + Math.sin(-c.rot) * 16 * c.s, cz = c.y - Math.sin(-c.rot) * 34 * c.s + Math.cos(-c.rot) * 16 * c.s;
    for (let i = 0; i < 4; i++) { const s = glow(cx, 70 * c.s, cz, 0xcfcfcf, 14, 0.25); s.userData = { cx, cz, base: 62 * c.s, i }; smokes.push(s); }
    void g;
  }
  upd.push((dt, t) => { for (const s of smokes) { const k = ((t * 0.18 + s.userData.i * 0.25) % 1); s.position.set(s.userData.cx + k * 14, s.userData.base + k * 46, s.userData.cz - k * 6); s.scale.setScalar(10 + k * 26); s.material.opacity = 0.3 * (1 - k); } });

  const fires = [];
  const makeBrazier = (x, z) => {
    const g = single('brazierBody', x, z);
    const flames = [];
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.ember(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.95 }));
      sp.position.set(x + (i - 1) * 2.4, 40 + i, z + (i % 2) * 2); sp.scale.set(15, 26, 1); group.add(sp); flames.push(sp);
    }
    const gl = glow(x, 42, z, 0xff8a30, hi ? 90 : 70, 0.55);
    fires.push({ flames, gl, x, z, seed: R() * 10 });
    void g;
  };
  for (const b of byKind('brazier')) makeBrazier(b.x, b.y);
  upd.push((dt, t) => { for (const f of fires) { f.flames.forEach((s, i) => { const n = Math.sin(t * 11 + f.seed + i * 2.1) * 0.5 + Math.sin(t * 17 + i) * 0.3; s.scale.set(15 + n * 2.5, 26 + n * 6, 1); s.position.y = 40 + i + n * 1.5; s.position.x = f.x + (i - 1) * 2.4 + n * 0.8; }); f.gl.material.opacity = 0.5 + 0.12 * Math.sin(t * 13 + f.seed); } });

  const lamps = byKind('lamp');
  const lampGlows = [];
  if (lamps.length) {
    place('lampPost', lamps.map((p) => ({ x: p.x, z: p.y, rot: p.rot, s: 1 })));
    for (const p of lamps) {
      // lantern sits at local (6.5, 33, 0) rotated by rot
      const lx = p.x + Math.cos(p.rot) * 6.5, lz = p.y - Math.sin(p.rot) * 6.5;
      lampGlows.push(glow(lx, 33, lz, 0xffa848, 60, 0.55));
    }
    upd.push((dt, t) => lampGlows.forEach((g, i) => { g.material.opacity = 0.5 + 0.08 * Math.sin(t * 9 + i * 3); }));
  }

  // bridge + river
  let waterMat = null;
  if (L.river) {
    waterMat = PM.water();
    const w = new THREE.Mesh(new THREE.PlaneGeometry(L.river.x1 - L.river.x0 + 6, L.h), waterMat);
    w.rotation.x = -PI / 2; w.position.set((L.river.x0 + L.river.x1) / 2, 0.45, L.h / 2); w.receiveShadow = shadows;
    group.add(w);
    // foam at banks
    for (const x of [L.river.x0 - 1, L.river.x1 + 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(5, L.h), new THREE.MeshBasicMaterial({ color: 0xdfeff4, transparent: true, opacity: 0.35, depthWrite: false })); f.rotation.x = -PI / 2; f.position.set(x, 0.5, L.h / 2); group.add(f); }
    single('bridge', 800, L.bridge.y, { y: 0.2 });
    upd.push((dt) => { waterMat.map.offset.y -= dt * 0.035; waterMat.map.offset.x += dt * 0.004; });
  }
  // marsh pools
  const poolMeshes = [];
  for (const p of L.pools) {
    const sh = new THREE.Shape(); const n = 22; const Rp = rng(Math.floor(p.x * 7 + p.y));
    for (let i = 0; i < n; i++) { const a = i / n * PI * 2, r = p.r * (0.86 + Rp() * 0.22); const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }
    sh.closePath();
    const geo = new THREE.ShapeGeometry(sh, 4);
    const m = new THREE.Mesh(geo, PM.murk()); m.rotation.x = -PI / 2; m.position.set(p.x, 0.5, p.y); group.add(m); poolMeshes.push(m);
    // reeds around the rim
    const reeds = [];
    for (let i = 0; i < 9; i++) { const a = Rp() * PI * 2; reeds.push({ x: p.x + Math.cos(a) * (p.r * 0.98), z: p.y + Math.sin(a) * (p.r * 0.98), rot: Rp() * 6, s: 0.8 + Rp() * 0.6, tint: Rp() }); }
    if (hi) place('reeds', reeds);
  }

  // castle
  if (L.theme === 'gate') {
    for (const w of byKind('wall')) single('wallLong', w.x, w.y - 0 + 0, { args: [w.w], s: 1 });
    for (const t of byKind('tower')) single('tower', t.x, t.y + 10, { s: t.s });
    for (const p of byKind('portcullis')) { single('portcullis', p.x, p.y + 8); }
    const banners = [];
    for (const b of byKind('banner')) {
      const poleY = 104 * 1.0;
      single('bannerPole', b.x, b.y + 4, { y: poleY, s: b.s });
      const cloth = single('bannerCloth', b.x, b.y + 5, { y: poleY - 1, s: b.s });
      cloth.children[0].castShadow = false; banners.push(cloth);
    }
    upd.push((dt, t) => banners.forEach((b, i) => { b.rotation.x = Math.sin(t * 1.6 + i) * 0.06; b.rotation.z = Math.sin(t * 1.1 + i * 2) * 0.05; }));
  }
  // hall
  if (L.theme === 'hall') {
    single('hallWall', 800, 60, { args: [1600, 170, 150] });
    single('hallWall', 60, L.h / 2, { args: [120, 170, L.h + 200], rot: 0, y: 0 }).scale.set(1, 1, 1);
    single('hallWall', L.w - 60, L.h / 2, { args: [120, 170, L.h + 200] });
    group.children[group.children.length - 1].rotation.y = 0;
    for (const x of [300, 520, 1080, 1300]) single('arrowSlit', x, 140, { y: 96 });
    single('throne', 800, 200);
    for (const b of byKind('banner')) { single('bannerPole', b.x, 148, { y: 120 }); const c = single('bannerCloth', b.x, 149, { y: 119, s: 1.3 }); void c; }
    place('pillar', byKind('pillar').map((p) => ({ x: p.x, z: p.y, rot: 0, s: 1 })));
    const heir = createHeir(quality);
    heir.root.position.set(800, 40, 222); heir.root.rotation.y = 0; group.add(heir.root);
    glow(800, 60, 222, 0x8aa8ff, 70, 0.25);
  }
  if (L.theme === 'vault') {
    single('hallWall', 800, 40, { args: [1600, 150, 110] });
    single('hallWall', 40, L.h / 2, { args: [110, 150, L.h + 160] });
    single('hallWall', L.w - 40, L.h / 2, { args: [110, 150, L.h + 160] });
    place('pillar', byKind('pillar').map((p) => ({ x: p.x, z: p.y, rot: 0, s: 1 })));
    place('rock', byKind('rock').map((p) => ({ x: p.x, z: p.y, rot: p.rot, s: 9 * p.s, sx: 1.2, sy: 0.6, sz: 1 })));
    if (L.boss) glow(800, 6, 600, 0xff4a10, 520, 0.12);
  }

  /* ---- ambient particles ---- */
  const AMB = {
    fields: { color: 0xfff4c0, n: 36, size: 5, vy: 3, drift: 8 }, wood: { color: 0xc8ff90, n: 40, size: 5, vy: 2, drift: 6 }, bridge: { color: 0xffffff, n: 28, size: 4, vy: 2, drift: 10 },
    marsh: { color: 0xd8ff7a, n: 56, size: 7, vy: 3, drift: 6 }, gate: { color: 0xff9a50, n: 40, size: 5, vy: 14, drift: 10 }, hall: { color: 0xff9a50, n: 48, size: 5, vy: 12, drift: 6 }, vault: { color: 0xff7a30, n: 54, size: 5, vy: 12, drift: 6 },
  }[L.theme];
  let pts = null, pos = null;
  if (AMB) {
    const n = hi ? AMB.n : Math.floor(AMB.n * 0.5);
    pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (R() - 0.5) * 900; pos[i * 3 + 1] = 6 + R() * 120; pos[i * 3 + 2] = (R() - 0.5) * 700; seed[i] = R() * 10; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture(), color: AMB.color, size: AMB.size * 5, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pts.frustumCulled = false; group.add(pts);
    const rel = new Float32Array(pos);
    upd.push((dt, t, p, cam) => {
      const a = geo.attributes.position.array;
      for (let i = 0; i < n; i++) {
        rel[i * 3] += Math.sin(t * 0.7 + seed[i]) * AMB.drift * dt; rel[i * 3 + 1] += AMB.vy * dt * (0.6 + 0.4 * Math.sin(seed[i] + t * 0.5)); rel[i * 3 + 2] += Math.cos(t * 0.5 + seed[i]) * AMB.drift * 0.6 * dt;
        if (rel[i * 3 + 1] > 130) rel[i * 3 + 1] = 4;
        if (rel[i * 3] > 450) rel[i * 3] -= 900; else if (rel[i * 3] < -450) rel[i * 3] += 900;
        if (rel[i * 3 + 2] > 350) rel[i * 3 + 2] -= 700; else if (rel[i * 3 + 2] < -350) rel[i * 3 + 2] += 700;
        a[i * 3] = cam.x + rel[i * 3]; a[i * 3 + 1] = rel[i * 3 + 1]; a[i * 3 + 2] = cam.z + rel[i * 3 + 2];
      }
      geo.attributes.position.needsUpdate = true;
    });
  }

  const heightAt = (x, y) => (L.bridge && x > L.bridge.x0 + 4 && x < L.bridge.x1 - 4 && Math.abs(y - L.bridge.y) < L.bridge.w / 2 ? 3.8 : 0);
  return {
    group, heightAt,
    update(dt, time, p, cam) { for (const f of upd) f(dt, time, p, cam); },
    dispose() { own.forEach((t) => t.dispose()); },
  };
}
