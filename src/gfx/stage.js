// Builds a 3D stage from a layout: ground, KayKit props (merged into a few draw calls), hall walls, water,
// fires and torch lights, perimeter forest, ambient motes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getGLTF, S, wx, wz, tex, pbr } from './assets.js';
import { PROPS, pick } from './catalog.js';
import { THEMES } from './themes.js';
import { buildGround } from './ground.js';
import { glowSprite, flameSprite } from './fx.js';

const _box = new THREE.Box3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const normCache = new Map();

/** Geometry list (with baked local transform) + scale for a catalogue entry, normalised to its height. */
function proto(spec) {
  if (normCache.has(spec.file + spec.height)) return normCache.get(spec.file + spec.height);
  const g = getGLTF(spec.file);
  let out = null;
  if (g) {
    g.scene.updateMatrixWorld(true);
    _box.setFromObject(g.scene);
    const k = spec.height / Math.max(1e-4, _box.max.y - _box.min.y);
    const cx = (_box.min.x + _box.max.x) / 2, cz = (_box.min.z + _box.max.z) / 2;
    const parts = [];
    g.scene.traverse((o) => { if (o.isMesh) parts.push({ geo: o.geometry, mat: o.material, matrix: o.matrixWorld.clone() }); });
    const base = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-cx, -_box.min.y + spec.sink / k, -cz));
    out = { parts, base, size: new THREE.Vector3((_box.max.x - _box.min.x) * k, spec.height, (_box.max.z - _box.min.z) * k) };
  }
  normCache.set(spec.file + spec.height, out);
  return out;
}

// Shared by every prop material: a dithered hole between the camera and the hero, so trees and buildings never hide them.
export const SEE_THROUGH = { uHole: { value: new THREE.Vector4(0, 0, 0, 0) }, uCam: { value: new THREE.Vector3() } };
function seeThrough(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SEE_THROUGH);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSeeW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSeeW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSeeW; uniform vec4 uHole; uniform vec3 uCam;')
      .replace('void main() {', `void main() {
        if (uHole.w > 0.0 && vSeeW.y > 0.5) {
          vec3 a = uCam, b = uHole.xyz + vec3(0.0, 1.0, 0.0), ab = b - a;
          float t = clamp(dot(vSeeW - a, ab) / dot(ab, ab), 0.0, 1.0);
          float d = length(vSeeW - (a + ab * t));
          float k = (1.0 - smoothstep(uHole.w * 0.55, uHole.w, d)) * step(t, 0.97);
          float dither = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
          if (k > 0.0 && dither < k * 0.88) discard;
        }`);
  };
  mat.customProgramCacheKey = () => 'seeThrough';
}

export class Stage {
  constructor(L, quality) {
    this.L = L;
    this.th = THEMES[L.theme] || THEMES.fields;
    this.hi = quality !== 'low';
    this.root = new THREE.Group();
    this.dyn = new THREE.Group();
    this.root.add(this.dyn);
    this.batches = new Map();        // material -> [geometry]
    this.fires = [];
    this.lightSpots = [];
    this.time = 0;
    this.root.add(buildGround(L, this.th));
    this.lights();
    this.props();
    if (L.indoor) this.walls(); else this.perimeter();
    if (L.river) this.river();
    for (const p of L.pools || []) this.pool(p);
    this.flush();
    this.motes();
  }

  // ---------------------------------------------------------------- lighting
  lights() {
    const th = this.th;
    this.sun = new THREE.DirectionalLight(th.sun, th.sunI);
    this.sunDir = new THREE.Vector3(...th.sunDir).normalize();
    this.sun.castShadow = true;
    const sz = this.hi ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sz, sz);
    const c = this.sun.shadow.camera; c.left = -26; c.right = 26; c.top = 26; c.bottom = -26; c.near = 1; c.far = 120;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.05;
    this.root.add(this.sun, this.sun.target);
    this.root.add(new THREE.HemisphereLight(th.sky, th.gnd, th.hemi));
    this.root.add(new THREE.AmbientLight(th.sky, 0.25));
    this.torches = [];
    for (let i = 0; i < (this.hi ? 5 : 2); i++) {
      const l = new THREE.PointLight(0xff8a3c, 0, 13, 1.8);
      this.root.add(l); this.torches.push(l);
    }
  }

  // ---------------------------------------------------------------- props
  add(kind, x, y, rot = 0, s = 1, yOff = 0, tint = null) {
    const spec = pick(kind, x, y);
    if (!spec) return null;
    const pr = proto(spec);
    if (!pr) return null;
    _q.setFromAxisAngle(_v.set(0, 1, 0), -rot);
    _m.compose(_v.set(wx(x), yOff, wz(y)), _q, _s.set(s, s, s)).multiply(pr.base);
    for (const p of pr.parts) {
      const geo = p.geo.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(_m, p.matrix));
      for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
      if (tint) {
        const n = geo.attributes.position.count, col = new Float32Array(n * 3), tc = new THREE.Color(tint);
        for (let i = 0; i < n; i++) { col[i * 3] = tc.r; col[i * 3 + 1] = tc.g; col[i * 3 + 2] = tc.b; }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      }
      const key = spec.file.split('/')[0];
      if (!this.batches.has(key)) this.batches.set(key, { mat: p.mat, geos: [], tinted: [] });
      (tint ? this.batches.get(key).tinted : this.batches.get(key).geos).push(geo);
    }
    return pr;
  }

  flush() {
    for (const { mat, geos, tinted } of this.batches.values()) {
      for (const [list, vc] of [[geos, false], [tinted, true]]) {
        if (!list.length) continue;
        const merged = mergeGeometries(list, false);
        list.forEach((g) => g.dispose());
        if (!merged) continue;
        const m = new THREE.MeshStandardMaterial({ map: mat.map, color: 0xffffff, roughness: 0.88, metalness: 0, vertexColors: vc });
        seeThrough(m);
        const mesh = new THREE.Mesh(merged, m);
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.root.add(mesh);
      }
    }
    this.batches.clear();
  }

  props() {
    const L = this.L, th = this.th, town = L.theme === 'town';
    for (const p of L.props) {
      const { kind, x, y } = p, rot = p.rot || 0, s = p.s || 1;
      switch (kind) {
        case 'grass': case 'carpet': break;
        case 'tree': this.add(p.pine ? 'pine' : 'tree', x, y, rot, s, 0, th.treeTint); break;
        case 'deadtree': this.add('pine', x, y, rot, s * 0.8, 0, 0x3a382c); break;
        case 'wall': this.row('wall', x, y, p.w || 700); break;
        case 'tower': this.add('tower', x, y + 10, 0, s); break;
        case 'portcullis': this.add('portcullis', x, y + 8, 0, 1); break;
        case 'banner': this.add('banner', x, L.indoor ? y - 8 : y, 0, s); break;
        case 'brazier': case 'lamp': case 'campfire':
          this.add(kind, x, y, rot, kind === 'campfire' ? s : 1);
          this.fire(x, y, kind === 'campfire' ? 0.4 : kind === 'brazier' ? 2.55 : 2.3, kind === 'campfire' ? 1.7 : 0.9);
          break;
        case 'bridge': this.bridge(); break;
        case 'throne': this.throne(x, y); break;
        case 'fountain': this.fountain(x, y, s); break;
        case 'crystal': this.crystal(x, y, s); break;
        case 'tent': case 'tent_blue': this.add(town ? 'market' : 'tent', x, y, rot, town ? 1 : s); break;
        case 'cottage': this.add('cottage', x, y, rot, s * 0.85); break;
        case 'rock': this.add('rock', x, y, rot, s * 1.4, 0, 0x9a968c); break;
        default: this.add(kind, x, y, rot, s);
      }
    }
    if (town) { this.add('tavern', 1450, 980, 2.6, 1); this.add('windmill', 140, 120, 0.4, 1); this.add('church', 1460, 120, -0.3, 1); }
  }

  row(kind, cx, cy, wpx) {
    const spec = pick(kind, cx, cy), pr = spec && proto(spec);
    if (!pr) return;
    const alongX = pr.size.x >= pr.size.z;
    const seg = Math.max(0.5, alongX ? pr.size.x : pr.size.z) * 0.98 / S;
    const n = Math.max(1, Math.ceil(wpx / seg));
    for (let i = 0; i < n; i++) this.add(kind, cx - wpx / 2 + seg * (i + 0.5), cy, alongX ? 0 : Math.PI / 2, 1);
  }

  fire(x, y, h, size) {
    const g = new THREE.Group();
    g.position.set(wx(x), h, wz(y));
    const glow = glowSprite(0xff8a3c, size * 3.4, 0.55);
    g.add(glow);
    const flames = [];
    for (let i = 0; i < 2; i++) { const f = flameSprite(size); f.position.set((i - 0.5) * 0.12 * size, 0.28 * size, 0.01 * i); g.add(f); flames.push(f); }
    this.dyn.add(g);
    this.fires.push({ flames, glow, size, seed: Math.random() * 10 });
    this.lightSpots.push(new THREE.Vector3(wx(x), Math.max(1.6, h), wz(y)));
  }

  box(w, h, d, mat, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true;
    this.root.add(m); return m;
  }

  bridge() {
    const b = this.L.bridge, x0 = wx(b.x0), x1 = wx(b.x1), z = wz(b.y), w = b.w * S;
    const wood = pbr('weathered_brown_planks', 1); wood.map.repeat.set(3, 2);
    const stone = pbr('medieval_blocks_02', 1);
    this.box(x1 - x0, 0.3, w, wood, (x0 + x1) / 2, 0.06, z);
    for (const s of [-1, 1]) {
      this.box(x1 - x0, 0.14, 0.2, wood, (x0 + x1) / 2, 0.95, z + s * (w / 2 - 0.1));
      for (let i = 0; i <= 5; i++) this.box(0.24, 1.0, 0.24, wood, x0 + (x1 - x0) * i / 5, 0.5, z + s * (w / 2 - 0.1));
      for (const px of [x0, x1]) this.box(1.1, 1.3, 0.9, stone, px, 0.5, z + s * (w / 2 + 0.3));
    }
  }

  throne(x, y) {
    const stone = pbr('medieval_blocks_02', 1);
    const red = new THREE.MeshStandardMaterial({ color: 0x6a0f10, roughness: 0.7 });
    for (let i = 0; i < 3; i++) this.box(13.6 - i * 3, 0.4, 5.2 - i * 1.1, i === 2 ? red : stone, wx(x), 0.2 + i * 0.4, wz(y - 10 - i * 6));
    this.add('throne', x, y - 20, Math.PI, 1, 1.2);
    this.add('banner', x - 120, y - 40, 0, 1.2); this.add('banner', x + 120, y - 40, 0, 1.2);
    this.add('chest', x - 220, y + 10, 0, 1); this.add('keg', x + 220, y + 10, 0, 1); this.add('candles', x - 60, y - 8, 0, 1, 1.2); this.add('candles', x + 60, y - 8, 0, 1, 1.2);
    // long red carpet down the hall
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#8a1a1c'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#b8892e'; g.fillRect(4, 0, 4, 256); g.fillRect(56, 0, 4, 256);
    g.fillStyle = '#a8282a'; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(32, i * 32 + 4); g.lineTo(44, i * 32 + 16); g.lineTo(32, i * 32 + 28); g.lineTo(20, i * 32 + 16); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6);
    const len = (this.L.bounds.y1 - y - 20) * S;
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.6, len), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(wx(x), 0.02, wz(y + 20) + len / 2); carpet.receiveShadow = true;
    this.root.add(carpet);
    this.heirAt = { x, y: y + 34 };
  }

  fountain(x, y, s) {
    const stone = pbr('medieval_blocks_02', 1);
    const r = 2.1 * s * 0.75, cx = wx(x), cz = wz(y);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.35, r + 0.45, 0.9, 12, 1, true), stone); ring.material.side = THREE.DoubleSide;
    ring.position.set(cx, 0.45, cz); ring.castShadow = true; ring.receiveShadow = true; this.root.add(ring);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.38, 0.14, 6, 12), stone); rim.rotation.x = Math.PI / 2; rim.position.set(cx, 0.9, cz); rim.rotation.z = Math.PI / 12; this.root.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(r + 0.3, 24), this.waterMat()); water.rotation.x = -Math.PI / 2; water.position.set(cx, 0.62, cz); this.root.add(water);
    this.add('column', x, y, 0, 1.25);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.35, 0.4, 10), stone); bowl.position.set(cx, 3.3, cz); bowl.castShadow = true; this.root.add(bowl);
    const spray = glowSprite(0x9fd0ff, 2.4, 0.35); spray.position.set(cx, 3.9, cz); this.dyn.add(spray);
  }

  crystal(x, y, s) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a50a0, emissive: 0x2f6cff, emissiveIntensity: 2.2, roughness: 0.25 });
    let seed = x * 13 + y; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 5; i++) {
      const hgt = (i === 0 ? 1.9 : 0.8 + rnd() * 0.9) * s, a = rnd() * 6.28, d = i === 0 ? 0 : 0.38;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.22, hgt, 5), mat);
      m.position.set(wx(x) + Math.cos(a) * d, hgt * 0.45, wz(y) + Math.sin(a) * d); m.rotation.set((rnd() - 0.5) * 0.6, rnd() * 6, (rnd() - 0.5) * 0.6);
      this.root.add(m);
    }
    const g = glowSprite(0x4a80ff, 4.5 * s, 0.4); g.position.set(wx(x), 1, wz(y)); this.dyn.add(g);
    this.lightSpots.push(Object.assign(new THREE.Vector3(wx(x), 1.5, wz(y)), { cold: true }));
  }

  waterMat() {
    if (this._water) return this._water;
    const marsh = this.L.theme === 'marsh';
    const n = tex('tex/stony_dirt_path/nor.jpg', { srgb: false, repeat: 1 }).clone(); n.needsUpdate = true; n.wrapS = n.wrapT = THREE.RepeatWrapping; n.repeat.set(4, 12);
    this._water = new THREE.MeshStandardMaterial({ color: marsh ? 0x1c2416 : 0x1e3a44, roughness: 0.12, metalness: 0.3, normalMap: n, transparent: true, opacity: marsh ? 0.92 : 0.86 });
    this._water.normalScale.set(0.35, 0.35);
    this._waterNor = n;
    return this._water;
  }

  river() {
    const L = this.L, x0 = wx(L.river.x0 - 4), x1 = wx(L.river.x1 + 4), h = L.h * S;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, h + 120), this.waterMat());
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.05, h / 2); m.receiveShadow = true;
    this.root.add(m);
  }

  pool(p) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(p.r * S, 28), this.waterMat());
    m.rotation.x = -Math.PI / 2; m.position.set(wx(p.x), 0.04, wz(p.y)); m.scale.set(1, 0.92, 1); m.receiveShadow = true;
    this.root.add(m);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + p.x; this.add('reeds', p.x + Math.cos(a) * p.r * 0.95, p.y + Math.sin(a) * p.r * 0.95, a, 1.2, 0, 0x6a7a4a); }
  }

  walls() {
    const b = this.L.bounds, top = b.y0 - 30, left = b.x0 - 30, right = b.x1 + 30, bottom = b.y1 + 40;
    const pr = proto(PROPS.hallwall[0]);
    if (!pr) return;
    const segPx = Math.max(pr.size.x, 1) * 0.995 / S;
    let i = 0;
    for (let x = left; x < right; x += segPx, i++) {
      const cx = x + segPx / 2;
      this.add(i % 3 === 1 ? 'hallwindow' : 'hallwall', cx, top, 0, 1);
      if (i % 3 === 2) { this.add('torch_wall', cx, top + 14, 0, 1, 2.3); this.fire(cx, top + 22, 3.2, 0.6); }
      if (i % 3 === 0 && this.L.theme === 'hall') this.add('banner', cx, top + 12, 0, 1, 0.5);
    }
    for (let y = top; y < bottom; y += segPx) {
      this.add('hallwall', left, y + segPx / 2, Math.PI / 2, 1);
      this.add('hallwall', right, y + segPx / 2, -Math.PI / 2, 1);
    }
    if (this.L.theme === 'vault') for (const p of this.L.props) if (p.kind === 'pillar') { const g = glowSprite(0x4060ff, 5, 0.22); g.position.set(wx(p.x), 0.6, wz(p.y)); this.dyn.add(g); }
    // rubble and stores along the edges so the hall is not bare
    let seed = this.L.seed * 7 + 3; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let k = 0; k < 10; k++) {
      const side = rnd() < 0.5, x = side ? (rnd() < 0.5 ? b.x0 - 8 : b.x1 + 8) : b.x0 + rnd() * (b.x1 - b.x0), y = side ? b.y0 + rnd() * (b.y1 - b.y0) : b.y0 - 8;
      this.add(['stack', 'keg', 'rubble', 'shelf', 'chest'][Math.floor(rnd() * 5)], x, y, side ? Math.PI / 2 : 0, 1);
    }
  }

  perimeter() {
    const L = this.L, W = L.w, H = L.h, th = this.th;
    let seed = L.seed * 31 + 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 24; i++) {
      const t = i / 24; let x, y;
      if (t < 0.4) { x = t / 0.4 * (W + 500) - 250; y = -300 - rnd() * 140; }
      else if (t < 0.7) { x = -300 - rnd() * 160; y = (t - 0.4) / 0.3 * H; }
      else { x = W + 300 + rnd() * 160; y = (t - 0.7) / 0.3 * H; }
      this.add('mountain', x, y, rnd() * 6.28, 0.9 + rnd() * 0.5, 0, 0x6f7a62);
    }
    const dead = L.theme === 'marsh';
    for (let i = 0; i < (this.hi ? 110 : 60); i++) {
      const side = rnd(); let x, y;
      if (side < 0.36) { x = rnd() * (W + 300) - 150; y = -30 - rnd() * 230; }
      else if (side < 0.6) { x = -30 - rnd() * 230; y = rnd() * (H + 200) - 60; }
      else if (side < 0.84) { x = W + 30 + rnd() * 230; y = rnd() * (H + 200) - 60; }
      else { x = rnd() * (W + 300) - 150; y = H + 60 + rnd() * 120; }
      this.add(rnd() < 0.5 ? 'pine' : 'tree', x, y, rnd() * 6.28, 0.9 + rnd() * 0.7, 0, dead ? 0x34322a : th.treeTint);
    }
  }

  motes() {
    const n = this.hi ? 60 : 24, pos = new Float32Array(n * 3);
    this.moteSeed = [];
    for (let i = 0; i < n; i++) { this.moteSeed.push([Math.random() * 40 - 20, Math.random() * 5, Math.random() * 30 - 15, Math.random() * 10]); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const col = this.th.indoor ? 0xff9a50 : this.L.theme === 'marsh' ? 0xc8e070 : 0xffe8b0;
    this.motePts = new THREE.Points(geo, new THREE.PointsMaterial({ color: col, size: 0.09, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.motePts.frustumCulled = false;
    this.dyn.add(this.motePts);
  }

  // ---------------------------------------------------------------- per frame
  tick(dt, focus) {
    this.time += dt;
    const t = this.time;
    for (const f of this.fires) {
      const n = Math.sin(t * 11 + f.seed) * 0.5 + Math.sin(t * 17 + f.seed * 2) * 0.3;
      for (const fl of f.flames) fl.scale.set((0.62 + n * 0.08) * f.size, (1 + n * 0.2) * f.size, 1);
      f.glow.material.opacity = 0.5 + n * 0.08;
    }
    this.lightSpots.sort((a, b) => a.distanceToSquared(focus) - b.distanceToSquared(focus));
    const base = this.th.torch || (this.th.indoor ? 100 : 46);
    this.torches.forEach((l, i) => {
      const s = this.lightSpots[i];
      if (s && s.distanceToSquared(focus) < 34 * 34) {
        l.position.copy(s);
        l.color.setHex(s.cold ? 0x5080ff : 0xff8a3c);
        l.intensity = base * (s.cold ? 0.5 : 1) * (0.88 + 0.12 * Math.sin(t * 9 + i * 1.7) * Math.sin(t * 5.3 + i));
      } else l.intensity = 0;
    });
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 50);
    if (this._waterNor) this._waterNor.offset.set(t * 0.004, -t * 0.03);
    const p = this.motePts.geometry.attributes.position;
    this.moteSeed.forEach((m, i) => {
      p.setXYZ(i, focus.x + m[0] + Math.sin(t * 0.5 + m[3]) * 1.2, (m[1] + t * 0.25) % 5.5 + 0.2, focus.z + m[2] + Math.cos(t * 0.4 + m[3]) * 1.2);
    });
    p.needsUpdate = true;
  }

  dispose() {
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.root.removeFromParent();
  }
}
