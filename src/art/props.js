// World props. Each builder returns "parts": [{ geo, mat, tint?, cast? }] with the prop's origin on the ground.
// Merged per material so a prop is 1-4 draw calls; repeated props are drawn with InstancedMesh.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Tex, glowTexture, mkCanvas, toTexture } from './textures.js';
import { std, Mat } from './materials.js';
import { rng } from '../world.js';

const PI = Math.PI;
const mats = new Map();
const lz = (k, fn) => { if (!mats.has(k)) mats.set(k, fn()); return mats.get(k); };
const bump = (map, s = 0.6) => ({ map, bumpMap: map, bumpScale: s });

export const PM = {
  bark: () => lz('bark', () => std({ ...bump(Tex.bark('#5a4430'), 0.8), roughness: 0.95 })),
  barkDead: () => lz('barkDead', () => std({ ...bump(Tex.bark('#4a4440', 18), 0.8), roughness: 1 })),
  leaf: (v = 0) => lz('leaf' + v, () => std({ map: Tex.leafCard(['#4f8a2c', '#5e9a34', '#46782a'][v % 3], 21 + v), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 })),
  leafAutumn: () => lz('leafAut', () => std({ map: Tex.leafCard('#8a8a2c', 31), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 })),
  pine: () => lz('pine', () => std({ map: Tex.pineCard(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 })),
  core: () => lz('core', () => std({ color: 0x2c4a1c, roughness: 1 })),
  grass: (c = '#6a9a3a') => lz('grass' + c, () => std({ map: Tex.grassBlade(c), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 })),
  reed: () => lz('reed', () => std({ map: Tex.reed(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 })),
  rock: () => lz('rock', () => std({ ...bump(Tex.rock('#8a877e'), 1.2), roughness: 0.95 })),
  rockDark: () => lz('rockDark', () => std({ ...bump(Tex.rock('#5e5c58'), 1.2), roughness: 0.95 })),
  wood: () => lz('wood', () => std({ ...bump(Tex.wood('#8a6a42', { seed: 7, planks: 3 }), 0.5), roughness: 0.9 })),
  woodDark: () => lz('woodDark', () => std({ ...bump(Tex.wood('#4a3524', { seed: 9, planks: 1 }), 0.5), roughness: 0.9 })),
  woodGrey: () => lz('woodGrey', () => std({ ...bump(Tex.wood('#7a7266', { seed: 12, planks: 3 }), 0.5), roughness: 0.95 })),
  logEnd: () => lz('logEnd', () => std({ ...bump(Tex.wood('#a88858', { seed: 13, planks: 1, ring: true }), 0.4), roughness: 0.9 })),
  straw: () => lz('straw', () => std({ ...bump(Tex.straw(), 0.5), roughness: 1 })),
  thatch: () => lz('thatch', () => std({ ...bump(Tex.thatch(), 1.2), roughness: 1 })),
  slate: () => lz('slate', () => std({ ...bump(Tex.slate(), 1.0), roughness: 0.7 })),
  plaster: () => lz('plaster', () => std({ ...bump(Tex.plaster('#d8ccae'), 0.4), roughness: 0.95 })),
  stone: () => lz('stone', () => std({ ...bump(Tex.stone('#8d887c', { seed: 9, bricks: 4 }), 1.0), roughness: 0.95 })),
  stoneRaw: () => lz('stoneRaw', () => std({ ...bump(Tex.stone('#7f7a70', { seed: 33 }), 1.0), roughness: 0.95 })),
  stoneDark: () => lz('stoneDark', () => std({ ...bump(Tex.stone('#5c5a5e', { seed: 34, bricks: 4 }), 1.0), roughness: 0.95 })),
  pillar: () => lz('pillar', () => std({ ...bump(Tex.stone('#8a857c', { seed: 35, bricks: 0 }), 0.8), roughness: 0.85 })),
  iron: () => Mat.iron(),
  gold: () => Mat.gold(),
  lantern: () => lz('lantern', () => std({ color: 0x3a2410, emissive: 0xffa040, emissiveIntensity: 2.2, roughness: 0.4 })),
  glassNight: () => lz('glassNight', () => std({ color: 0x101828, emissive: 0x3a5aa0, emissiveIntensity: 0.9, roughness: 0.2 })),
  glassDark: () => lz('glassDark', () => std({ color: 0x0c0f14, roughness: 0.2, metalness: 0.2 })),
  banner: () => lz('banner', () => std({ ...bump(Tex.banner(), 0.2), roughness: 0.95, side: THREE.DoubleSide })),
  carpetEdge: () => lz('carpetEdge', () => std({ color: 0x8a1c24, roughness: 1 })),
  clothRed: () => Mat.clothRed(),
  coal: () => lz('coal', () => std({ color: 0x1a0c06, emissive: 0xff4a10, emissiveIntensity: 1.5, roughness: 1 })),
  water: () => lz('water', () => { const t = Tex.water(); const m = std({ map: t, color: 0xd0e8f0, roughness: 0.14, metalness: 0.1, transparent: true, opacity: 0.82 }); m.envMapIntensity = 1.4; m.userData.water = true; return m; }),
  murk: () => lz('murk', () => { const m = std({ map: Tex.murk(), roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.93 }); m.envMapIntensity = 1.0; return m; }),
  shadow: () => lz('shadow', () => new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })),
};

/* ---------- geometry helpers ---------- */
const xf = (geo, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1]) => {
  const g = geo.clone();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  g.applyMatrix4(m);
  return g;
};
export function tbox(w, h, d, scale = 48) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / scale, uv.getY(k) * dims[f][1] / scale); }
  return g;
}
export function tcyl(rt, rb, h, seg, scale = 48, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const uv = g.attributes.uv, circ = 2 * PI * Math.max(rt, rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / scale, uv.getY(i) * h / scale);
  return g;
}
const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const merge = (list) => {
  const mixed = list.some((l) => !l.index) && list.some((l) => l.index);
  const src = mixed ? list.map((l) => (l.index ? l.toNonIndexed() : l)) : list;
  const g = BufferGeometryUtils.mergeBufferGeometries(src, false);
  list.forEach((l) => l.dispose()); if (mixed) src.forEach((l) => l.dispose());
  g.userData.shared = false; return g;
};
const part = (mat, list, extra = {}) => ({ geo: merge(list), mat, ...extra });

const crossedQuad = (w, h) => merge([xf(new THREE.PlaneGeometry(w, h), [0, h / 2, 0]), xf(new THREE.PlaneGeometry(w, h), [0, h / 2, 0], [0, PI / 2, 0]), xf(new THREE.PlaneGeometry(w, h), [0, h / 2, 0], [0, PI / 4, 0])]);

/* ---------- builders ---------- */
const B = {};

B.tree = (q, v = 0) => {
  const R = rng(100 + v);
  const hi = q === 'high';
  const trunk = [xf(cyl(2.6, 4.4, 34, 7), [0, 17, 0])];
  const branches = [];
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + R(); branches.push(xf(cyl(0.9, 1.8, 16, 5), [Math.cos(a) * 5, 30 + i * 3, Math.sin(a) * 5], [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9])); }
  const cards = [];
  const n = hi ? 11 : 6;
  for (let i = 0; i < n; i++) {
    const a = R() * PI * 2, r = 4 + R() * 12, y = 40 + R() * 22;
    cards.push(xf(new THREE.PlaneGeometry(34 + R() * 12, 34 + R() * 12), [Math.cos(a) * r, y, Math.sin(a) * r], [(R() - 0.5) * 2.2, R() * PI, (R() - 0.5) * 0.8]));
  }
  for (let i = 0; i < (hi ? 4 : 2); i++) { const a = R() * PI * 2; cards.push(xf(new THREE.PlaneGeometry(44, 44), [Math.cos(a) * 8, 56 + R() * 6, Math.sin(a) * 8], [-PI / 2 + (R() - 0.5) * 0.7, R() * PI, 0])); }
  const core = [xf(new THREE.IcosahedronGeometry(15, 1), [0, 48, 0], [0, 0, 0], [1.1, 0.85, 1.1])];
  return [part(PM.bark(), [...trunk, ...branches], { cast: true }), part(PM.leaf(v), cards, { tint: true, cast: true }), part(PM.core(), core, { tint: false, cast: false })];
};

B.pine = (q) => {
  const R = rng(55);
  const trunk = [xf(cyl(2, 3.6, 26, 6), [0, 13, 0])];
  const cards = [];
  const layers = q === 'high' ? 5 : 3;
  for (let i = 0; i < layers; i++) { const y = 18 + i * 13, w = 46 - i * 7; for (let k = 0; k < 3; k++) cards.push(xf(new THREE.PlaneGeometry(w, 30), [0, y + 6, 0], [0, k * PI / 3 + R() * 0.4, 0])); }
  const cones = [];
  for (let i = 0; i < layers; i++) cones.push(xf(new THREE.ConeGeometry(15 - i * 2.2, 22, 8), [0, 26 + i * 13, 0]));
  return [part(PM.bark(), trunk, { cast: true }), part(PM.pine(), cards, { tint: true, cast: true }), part(PM.core(), cones, { cast: true })];
};

B.deadtree = () => {
  const R = rng(77);
  const parts = [xf(cyl(1.8, 4.2, 44, 6), [0, 22, 0], [0.04, 0, 0.05])];
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + R(), h = 20 + i * 4, len = 18 - i * 1.4;
    const g = xf(cyl(0.5, 1.4, len, 5), [0, len / 2, 0]);
    parts.push(xf(g, [Math.cos(a) * 2, h, Math.sin(a) * 2], [Math.sin(a) * 0.9 - 0.2, a, -Math.cos(a) * 0.9]));
    const g2 = xf(cyl(0.3, 0.7, len * 0.55, 4), [0, len * 0.28, 0]);
    parts.push(xf(g2, [Math.cos(a) * (2 + len * 0.55), h + len * 0.5, Math.sin(a) * (2 + len * 0.55)], [Math.sin(a) * 1.1, a + 0.5, -Math.cos(a) * 1.1]));
  }
  return [part(PM.barkDead(), parts, { cast: true })];
};

B.grass = () => [part(PM.grass(), [crossedQuad(15, 15)], { tint: true })];
B.reeds = () => [part(PM.reed(), [crossedQuad(14, 28)], { tint: true })];

B.rock = () => {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position, R = rng(5);
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(k)) seen.set(k, 0.78 + R() * 0.4);
    const s = seen.get(k); p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  const uvs = g.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, p.getX(i) * 0.6 + 0.5, p.getZ(i) * 0.6 + 0.5);
  return [{ geo: g, mat: PM.rock(), cast: true, rockLike: true }];
};

B.hay = () => {
  const bale = xf(cyl(11, 11, 17, 12), [0, 11, 0], [0, 0, PI / 2]);
  return [part(PM.straw(), [bale], { cast: true }), part(PM.woodDark(), [xf(new THREE.TorusGeometry(11.1, 0.5, 4, 14), [-4, 11, 0], [0, PI / 2, 0]), xf(new THREE.TorusGeometry(11.1, 0.5, 4, 14), [4, 11, 0], [0, PI / 2, 0])])];
};

B.fence = () => {
  const posts = [xf(box(2.6, 17, 2.6), [-15, 8.5, 0]), xf(box(2.6, 17, 2.6), [15, 8.5, 0])];
  const rails = [xf(box(34, 2, 1.6), [0, 5, 0.5]), xf(box(34, 2, 1.6), [0, 11.5, 0.5])];
  return [part(PM.woodGrey(), [...posts, ...rails], { cast: true })];
};

B.logs = () => {
  const L = [];
  const rows = [[-5, 4.6, 0], [5, 4.6, 0], [15, 4.6, 0], [0, 12.6, 0], [10, 12.6, 0], [5, 20.4, 0]];
  const ends = [];
  const R = rng(9);
  for (const [x, y] of rows) { const len = 30 + R() * 6; L.push(xf(cyl(4.6, 4.7, len, 8), [x - 10, y, 0], [PI / 2, 0, 0])); ends.push(xf(new THREE.CircleGeometry(4.5, 10), [x - 10, y, len / 2 + 0.05], [0, 0, 0])); ends.push(xf(new THREE.CircleGeometry(4.5, 10), [x - 10, y, -len / 2 - 0.05], [0, PI, 0])); }
  return [part(PM.bark(), L, { cast: true }), part(PM.logEnd(), ends)];
};

B.pillar = () => {
  const parts = [xf(tbox(26, 7, 26, 40), [0, 3.5, 0])];
  const shaft = [xf(tcyl(9, 10, 70, 14, 40), [0, 42, 0])];
  const top = [xf(tbox(25, 6, 25, 40), [0, 79, 0]), xf(tbox(20, 4, 20, 40), [0, 74, 0])];
  return [part(PM.pillar(), shaft, { cast: true }), part(PM.stone(), [...parts, ...top], { cast: true })];
};

B.column = () => {
  const shaft = [xf(tcyl(7.5, 8.5, 34, 10, 40), [0, 17, 0]), xf(tbox(20, 5, 20, 40), [0, 2.5, 0]), xf(tbox(9, 12, 7, 40), [2, 38, 1], [0.1, 0.4, 0.3])];
  return [part(PM.stoneRaw(), shaft, { cast: true })];
};

B.ruin = () => {
  const R = rng(14);
  const p = [];
  for (let i = 0; i < 5; i++) { const h = 16 + R() * 26; p.push(xf(tbox(22, h, 18, 36), [-44 + i * 22, h / 2, 0], [0, 0, (R() - 0.5) * 0.06])); }
  p.push(xf(tbox(10, 8, 12, 36), [-60, 4, 16], [0, 0.5, 0.1]), xf(tbox(12, 7, 9, 36), [58, 3.5, -14], [0, -0.4, -0.1]));
  return [part(PM.stoneDark(), p, { cast: true })];
};

B.lampPost = () => {
  const post = [xf(cyl(0.9, 1.3, 40, 6), [0, 20, 0]), xf(box(8, 1.2, 1.2), [3, 38, 0])];
  const lantern = [xf(box(5, 7, 5), [6.5, 33, 0])];
  const roof = [xf(new THREE.ConeGeometry(4.6, 4, 4), [6.5, 38.5, 0], [0, PI / 4, 0])];
  return [part(PM.woodDark(), [...post, ...roof], { cast: true }), part(PM.lantern(), lantern)];
};

B.brazierBody = () => {
  const legs = [];
  for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2; legs.push(xf(cyl(0.9, 1.3, 26, 5), [Math.cos(a) * 5, 13, Math.sin(a) * 5], [Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22])); }
  const bowl = [xf(new THREE.CylinderGeometry(10, 5, 8, 10, 1, true), [0, 29, 0]), xf(new THREE.TorusGeometry(10, 0.9, 4, 12), [0, 33, 0], [PI / 2, 0, 0])];
  return [part(PM.iron(), [...legs, ...bowl], { cast: true }), part(PM.coal(), [xf(new THREE.CylinderGeometry(9, 9, 1, 10), [0, 31.5, 0])])];
};

B.cottage = (q) => {
  const W = 96, D = 64, H = 34;
  const walls = [xf(tbox(W, H, D, 52), [0, H / 2 + 5, 0])];
  const foundation = [xf(tbox(W + 3, 6, D + 3, 30), [0, 3, 0])];
  const timber = [];
  const T = 3.2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) timber.push(xf(box(T, H + 1, T), [sx * (W / 2), H / 2 + 5, sz * (D / 2)]));
  for (const y of [5.5, 5 + H / 2, 5 + H]) { for (const sz of [-1, 1]) timber.push(xf(box(W + 1, T * 0.7, T), [0, y, sz * (D / 2)])); for (const sx of [-1, 1]) timber.push(xf(box(T, T * 0.7, D + 1), [sx * (W / 2), y, 0])); }
  for (const x of [-W / 4, W / 4, 0]) for (const sz of [-1, 1]) timber.push(xf(box(T * 0.7, H, T * 0.7), [x, H / 2 + 5, sz * (D / 2 + 0.3)]));
  for (const sz of [-1, 1]) for (const s of [-1, 1]) timber.push(xf(box(T * 0.6, H * 0.62, T * 0.6), [s * W / 8 * 3, H / 2 + 5, sz * (D / 2 + 0.2)], [0, 0, s * 0.75]));
  const rise = 30, slope = Math.atan2(rise, D / 2 + 6), len = Math.hypot(rise, D / 2 + 6);
  const roof = [];
  for (const s of [-1, 1]) roof.push(xf(tbox(W + 14, 5.5, len + 1, 36), [0, 5 + H + rise / 2 - 1, s * (D / 4 + 3)], [s * slope, 0, 0]));
  roof.push(xf(cyl(2.8, 2.8, W + 15, 6), [0, 5 + H + rise + 2, 0], [0, 0, PI / 2]));
  const gableShape = new THREE.Shape(); gableShape.moveTo(-D / 2, 0); gableShape.lineTo(D / 2, 0); gableShape.lineTo(0, rise + 2); gableShape.closePath();
  const gable = new THREE.ShapeGeometry(gableShape);
  const gables = [xf(gable, [W / 2 + 0.2, 5 + H, 0], [0, PI / 2, 0]), xf(gable, [-W / 2 - 0.2, 5 + H, 0], [0, -PI / 2, 0])];
  const stone = [xf(tbox(9, 52, 9, 24), [W / 2 - 14, 30, -D / 4]), ...foundation, xf(tbox(12, 3, 12, 24), [W / 2 - 14, 57, -D / 4])];
  const door = [xf(box(11, 22, 1.6), [-W / 5, 16, D / 2 + 0.8])];
  const windows = [xf(box(9, 9, 1.2), [W / 5 + 6, 26, D / 2 + 0.6]), xf(box(9, 9, 1.2), [-W / 2 + 14, 26, D / 2 + 0.6]), xf(box(1.2, 9, 9), [W / 2 + 0.6, 26, 8]), xf(box(1.2, 9, 9), [-W / 2 - 0.6, 26, 8])];
  const shutters = [];
  for (const [x, z] of [[W / 5 + 6, D / 2 + 1], [-W / 2 + 14, D / 2 + 1]]) for (const s of [-1, 1]) shutters.push(xf(box(4.6, 9.6, 0.8), [x + s * 7, 26, z]));
  const planters = [xf(box(10, 2.5, 3), [W / 5 + 6, 20, D / 2 + 2.2]), xf(box(10, 2.5, 3), [-W / 2 + 14, 20, D / 2 + 2.2])];
  return [
    part(PM.plaster(), [...walls, ...gables], { cast: true }), part(PM.woodDark(), [...timber, ...door, ...shutters, ...planters], { cast: true }),
    part(PM.thatch(), roof, { cast: true }), part(PM.stoneRaw(), stone, { cast: true }), part(PM.glassDark(), windows),
  ];
};

B.bridge = () => {
  const L = 190, Wd = 104;
  const planks = [];
  for (let i = 0; i < 17; i++) planks.push(xf(tbox(10.4, 2.4, Wd, 36), [-L / 2 + 6 + i * 11.2, 2.4, 0]));
  const beams = [xf(box(L, 3, 4), [0, 0.2, -Wd / 2 + 6]), xf(box(L, 3, 4), [0, 0.2, Wd / 2 - 6]), xf(box(L, 3, 4), [0, 0.2, 0])];
  const rails = [];
  for (const sz of [-1, 1]) {
    rails.push(xf(box(L - 20, 2.4, 2.4), [0, 17, sz * (Wd / 2 - 2)]), xf(box(L - 20, 2.4, 2.4), [0, 10, sz * (Wd / 2 - 2)]));
    for (let i = 0; i < 6; i++) rails.push(xf(box(3, 22, 3), [-L / 2 + 14 + i * ((L - 28) / 5), 11, sz * (Wd / 2 - 2)]));
  }
  const piles = [];
  for (const sz of [-1, 1]) for (const x of [-60, 0, 60]) piles.push(xf(cyl(4, 4.4, 26, 7), [x, -6, sz * (Wd / 2 - 8)]));
  return [part(PM.wood(), planks, { cast: true }), part(PM.woodDark(), [...beams, ...rails, ...piles], { cast: true })];
};

B.wallLong = (q, w = 700) => {
  const H = 112, D = 140;
  const body = [xf(tbox(w, H, D, 56), [0, H / 2, 0])];
  const top = [xf(tbox(w + 2, 6, D + 4, 40), [0, H + 3, 0])];
  const merlons = [];
  for (let x = -w / 2 + 14; x < w / 2; x += 40) merlons.push(xf(tbox(22, 14, 10, 24), [x, H + 13, D / 2 - 3]));
  const pilasters = [];
  for (let x = -w / 2 + 40; x < w / 2; x += 80) pilasters.push(xf(tbox(14, H, 8, 30), [x, H / 2, D / 2 + 3]));
  const slits = [];
  for (let x = -w / 2 + 80; x < w / 2; x += 80) slits.push(xf(box(3.2, 20, 1.4), [x, 66, D / 2 + 0.8]));
  return [part(PM.stone(), [...body, ...top, ...merlons, ...pilasters], { cast: true }), part(PM.glassDark(), slits)];
};

B.tower = (q) => {
  const r = 52, H = 170;
  const shaft = [xf(tcyl(r, r + 2, H, 18, 56), [0, H / 2, 0])];
  const cor = [xf(tcyl(r + 6, r + 4, 8, 18, 56), [0, H + 4, 0])];
  const merl = [];
  for (let i = 0; i < 14; i++) { const a = i / 14 * PI * 2; merl.push(xf(tbox(14, 14, 9, 24), [Math.cos(a) * (r + 4), H + 15, Math.sin(a) * (r + 4)], [0, -a + PI / 2, 0])); }
  const roof = [xf(new THREE.ConeGeometry(r + 8, 92, 16), [0, H + 8 + 46, 0])];
  const finial = [xf(cyl(0.8, 1.2, 22, 4), [0, H + 8 + 100, 0]), xf(new THREE.OctahedronGeometry(3, 0), [0, H + 8 + 112, 0])];
  const slits = [];
  for (const [y, n] of [[70, 4], [120, 4]]) for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + 0.4; slits.push(xf(box(4, 20, 3), [Math.cos(a) * (r + 1.2), y, Math.sin(a) * (r + 1.2)], [0, -a + PI / 2, 0])); }
  return [part(PM.stone(), [...shaft, ...cor, ...merl], { cast: true }), part(PM.slate(), roof, { cast: true }), part(PM.gold(), finial), part(PM.glassDark(), slits)];
};

B.portcullis = () => {
  const bars = [];
  for (let x = -40; x <= 40; x += 8) bars.push(xf(cyl(1.3, 1.3, 96, 5), [x, 48, 0]), xf(new THREE.ConeGeometry(1.7, 5, 5), [x, 1, 0], [PI, 0, 0]));
  for (let y = 12; y <= 90; y += 20) bars.push(xf(box(86, 2.4, 2.4), [0, y, 0]));
  const arch = [xf(tbox(18, 108, 34, 48), [-58, 54, 0]), xf(tbox(18, 108, 34, 48), [58, 54, 0]), xf(tbox(134, 22, 34, 48), [0, 108, 0])];
  const dark = [xf(box(100, 100, 2), [0, 50, -10])];
  return [part(PM.iron(), bars, { cast: true }), part(PM.stone(), arch, { cast: true }), part(PM.glassDark(), dark)];
};

B.bannerCloth = () => [{ geo: xf(new THREE.PlaneGeometry(22, 48, 1, 6), [0, -24, 0]), mat: PM.banner(), banner: true }];
B.bannerPole = () => [part(PM.woodDark(), [xf(cyl(1, 1, 28, 5), [0, 0, 0], [0, 0, PI / 2]), xf(new THREE.SphereGeometry(1.6, 6, 5), [-14, 0, 0]), xf(new THREE.SphereGeometry(1.6, 6, 5), [14, 0, 0])])];

B.throne = () => {
  const dais = [xf(tbox(340, 10, 130, 60), [0, 5, 0]), xf(tbox(270, 10, 100, 60), [0, 15, -4]), xf(tbox(190, 10, 70, 60), [0, 25, -8])];
  const seat = [xf(box(40, 8, 34), [0, 34, -10]), xf(box(6, 18, 34), [-22, 40, -10]), xf(box(6, 18, 34), [22, 40, -10])];
  const back = [xf(box(40, 78, 8), [0, 74, -24]), xf(new THREE.ConeGeometry(14, 22, 4), [0, 125, -24], [0, PI / 4, 0], [1, 1, 0.3])];
  const spikes = [];
  for (const x of [-18, -9, 0, 9, 18]) spikes.push(xf(new THREE.ConeGeometry(2.2, 14, 4), [x, 118 - Math.abs(x) * 0.4, -24]));
  const cushion = [xf(box(34, 5, 28), [0, 39, -9])];
  return [part(PM.stoneDark(), dais, { cast: true }), part(PM.iron(), [...seat, ...back], { cast: true }), part(PM.gold(), spikes), part(PM.carpetEdge(), cushion)];
};

B.hallWall = (q, w = 1600, h = 160, d = 140) => [part(PM.stoneDark(), [xf(tbox(w, h, d, 64), [0, h / 2, 0]), xf(tbox(w, 8, d + 6, 64), [0, h + 4, 0])], { cast: true })];

B.arrowSlit = () => [part(PM.glassNight(), [xf(box(24, 60, 2), [0, 0, 0]), xf(new THREE.ConeGeometry(12, 20, 3), [0, 38, 0], [0, 0, 0], [1, 1, 0.1])])];

export function buildParts(kind, q, ...args) {
  const fn = B[kind];
  if (!fn) throw new Error('unknown prop ' + kind);
  return fn(q, ...args);
}

/* ---------- instancing / placement ---------- */
export function meshFromParts(parts, { shadows }) {
  const g = new THREE.Group();
  for (const p of parts) { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = shadows && p.cast !== false; m.receiveShadow = shadows; g.add(m); if (p.banner) m.userData.banner = true; }
  return g;
}

// placements: [{x,y,z,rot,s,sx,sy,sz,color}] -> Group of InstancedMesh (one per part)
export function instanceParts(parts, placements, { shadows }) {
  const g = new THREE.Group();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  for (const p of parts) {
    const im = new THREE.InstancedMesh(p.geo, p.mat, placements.length);
    placements.forEach((pl, i) => {
      e.set(0, pl.rot || 0, 0); q.setFromEuler(e);
      v.set(pl.x, pl.y || 0, pl.z);
      const s = pl.s || 1;
      sc.set((pl.sx ?? 1) * s, (pl.sy ?? 1) * s, (pl.sz ?? 1) * s);
      m4.compose(v, q, sc); im.setMatrixAt(i, m4);
      if (p.tint) { const t = pl.tint ?? 0.5; col.setHSL(0.25 + (t - 0.5) * 0.07 + (pl.hue || 0), 0.3 + t * 0.2, 0.62 + (t - 0.5) * 0.3); if (p.mat === PM.leafAutumn()) col.setHSL(0.14, 0.5, 0.45); im.setColorAt(i, col); }
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = shadows && p.cast !== false; im.receiveShadow = shadows;
    im.frustumCulled = false;
    g.add(im);
  }
  return g;
}
