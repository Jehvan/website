// three.js renderer: camera, lights, sky/PMREM, entity sync, effects. Art lives in ./art/*.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { WORLD_W, WORLD_H } from './data.js';
import { rarityOf } from './items.js';
import { createCharacter } from './art/characters.js';
import { buildWorld } from './art/world3d.js';
import { glowTexture, discTexture } from './art/textures.js';
import { setEnvIntensity, std, lin, Mat } from './art/materials.js';
import { PM } from './art/props.js';

const TAU = Math.PI * 2;
const SKY = {
  fields: { el: 38, az: 150, turb: 3.5, ray: 1.4, mie: 0.004, sun: 0xfff0d8, sunI: 1.4, hemi: [0xbfd8ff, 0x6a5a3a, 0.35], fog: 0xb9cfe0, exp: 1.0 },
  wood: { el: 30, az: 140, turb: 6, ray: 1.2, mie: 0.006, sun: 0xffe6b8, sunI: 1.25, hemi: [0xa8c8a0, 0x3a3020, 0.35], fog: 0x9bb09a, exp: 0.95 },
  bridge: { el: 24, az: 130, turb: 5, ray: 1.6, mie: 0.005, sun: 0xffd9a0, sunI: 1.35, hemi: [0xb0c8e8, 0x504030, 0.35], fog: 0xb8c8d4, exp: 1.0 },
  marsh: { el: 9, az: 120, turb: 14, ray: 2.6, mie: 0.012, sun: 0xff9a5a, sunI: 1.2, hemi: [0x9a9a8a, 0x2a3020, 0.6], fog: 0x7a7868, exp: 0.95 },
  gate: { el: 18, az: 160, turb: 10, ray: 1.0, mie: 0.01, sun: 0xffc890, sunI: 1.25, hemi: [0xa0a8b8, 0x3a3028, 0.35], fog: 0x9a9a9a, exp: 0.95 },
  hall: { el: -4, az: 180, turb: 8, ray: 0.5, mie: 0.005, sun: 0x8a9ad0, sunI: 0.5, hemi: [0x403a50, 0x201810, 0.35], fog: 0x120d0b, exp: 1.1, indoor: true },
  vault: { el: -6, az: 180, turb: 8, ray: 0.4, mie: 0.005, sun: 0x7a8ac0, sunI: 0.45, hemi: [0x303a50, 0x181018, 0.35], fog: 0x0c0a10, exp: 1.1, indoor: true },
};

export function createRenderer(canvas, settings) {
  let quality = settings.gfx === 'low' ? 'low' : 'high';
  const gl = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance', alpha: false });
  gl.outputEncoding = THREE.sRGBEncoding;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.setClearColor(0x0a0806, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 20, 4200);
  const pmrem = new THREE.PMREMGenerator(gl);
  const envCache = new Map();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.target = new THREE.Object3D();
  scene.add(hemi, sun, sun.target);
  const pointLights = [];
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xff9a4a, 0, 420, 2); l.visible = false; scene.add(l); pointLights.push(l); }

  let W = 1, H = 1, dpr = 1;
  let world = null, theme = 'fields', skyCfg = SKY.fields;
  const sunDir = new THREE.Vector3(0.5, 1, 0.4).normalize();
  const camTarget = new THREE.Vector3(800, 0, 575);
  let camInit = false;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  const entities = new THREE.Group(); scene.add(entities);
  const fxGroup = new THREE.Group(); scene.add(fxGroup);
  let playerVis = null;
  const enemyVis = new Map();
  const projVis = new Map(), zoneVis = new Map(), pickVis = new Map(), fxVis = new Map();
  let camDist = 700, aspect = 1;

  /* ---------- environment ---------- */
  function envFor(name) {
    if (envCache.has(name)) return envCache.get(name);
    const c = SKY[name];
    const sky = new Sky(); sky.scale.setScalar(450000);
    const u = sky.material.uniforms;
    u.turbidity.value = c.turb; u.rayleigh.value = c.ray; u.mieCoefficient.value = c.mie; u.mieDirectionalG.value = 0.8;
    const phi = THREE.MathUtils.degToRad(90 - c.el), th = THREE.MathUtils.degToRad(c.az);
    u.sunPosition.value.setFromSphericalCoords(1, phi, th);
    const s = new THREE.Scene(); s.add(sky);
    const rt = pmrem.fromScene(s);
    sky.geometry.dispose(); sky.material.dispose();
    const entry = { tex: rt.texture, dir: new THREE.Vector3().setFromSphericalCoords(1, phi, th) };
    envCache.set(name, entry);
    return entry;
  }

  /* ---------- stage ---------- */
  function disposeObject(o) {
    o.traverse((m) => {
      if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mt of mats) if (!mt.userData.shared) mt.dispose();
    });
  }
  function clearDynamic() {
    for (const m of [enemyVis, projVis, zoneVis, pickVis, fxVis]) {
      for (const v of m.values()) { const o = v.root || v.g; o.parent?.remove(o); disposeObject(o); }
      m.clear();
    }
    if (playerVis) { entities.remove(playerVis.root); disposeObject(playerVis.root); playerVis = null; }
  }

  function setStage(game) {
    clearDynamic();
    if (world) { scene.remove(world.group); disposeObject(world.group); world.dispose?.(); world = null; }
    const L = game.L;
    theme = L.theme; skyCfg = SKY[theme] || SKY.fields;
    const env = envFor(theme in SKY ? theme : 'fields');
    scene.environment = env.tex; scene.background = env.tex;
    sunDir.copy(env.dir);
    if (skyCfg.indoor) sunDir.set(0.3, 1, 0.5).normalize();
    const qp = (k, d) => { const v = new URLSearchParams(location.search).get(k); return v === null ? d : +v; };
    sun.color.setHex(skyCfg.sun); sun.intensity = qp('sun', skyCfg.sunI);
    hemi.color.setHex(skyCfg.hemi[0]); hemi.groundColor.setHex(skyCfg.hemi[1]); hemi.intensity = qp('hemi', skyCfg.hemi[2]);
    scene.fog = new THREE.Fog(skyCfg.fog, 900, 2600);
    if (skyCfg.indoor) scene.background = new THREE.Color(skyCfg.fog);
    gl.toneMappingExposure = skyCfg.exp * (+new URLSearchParams(location.search).get('exp') || 1);
    applyQuality();
    world = buildWorld(L, quality);
    scene.add(world.group);
    playerVis = createCharacter(game.save.cls, quality);
    entities.add(playerVis.root);
    setEnvIntensity(qp('env', skyCfg.indoor ? 0.5 : 0.22));
    camInit = false;
    for (const l of pointLights) { l.visible = false; l.intensity = 0; }
  }

  function applyQuality() {
    const hi = quality === 'high';
    gl.shadowMap.enabled = hi;
    sun.castShadow = hi;
    if (hi) {
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera; sc.left = -520; sc.right = 520; sc.top = 520; sc.bottom = -520; sc.near = 10; sc.far = 1800; sc.updateProjectionMatrix();
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.2;
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
  }

  /* ---------- effects ---------- */
  const ringGeo = new THREE.RingGeometry(0.9, 1, 56); ringGeo.rotateX(Math.PI / 2); ringGeo.userData.shared = true;
  const discGeo = new THREE.CircleGeometry(1, 40); discGeo.rotateX(Math.PI / 2); discGeo.userData.shared = true;
  const sphereGeo = new THREE.SphereGeometry(1, 14, 10); sphereGeo.userData.shared = true;
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true); cylGeo.userData.shared = true;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.userData.shared = true;
  const glowTex = glowTexture(), discTex = discTexture();
  const addMat = (color, opacity = 1, map = null) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map, fog: false });
  const decalMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const sprite = (color, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); s.scale.setScalar(size); return s; };

  function makeFx(f) {
    const g = new THREE.Group(); const col = new THREE.Color(f.color || '#fff');
    g.userData.col = col;
    switch (f.type) {
      case 'ring': case 'nova': {
        const r = new THREE.Mesh(ringGeo, addMat(col, 1)); r.name = 'ring';
        const d = new THREE.Mesh(discGeo, addMat(col, 0.25)); d.name = 'disc';
        g.add(r, d); if (f.type === 'nova') { for (let i = 0; i < 10; i++) { const sh = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 4), addMat(0xdff6ff, 0.9)); const a = (i / 10) * TAU; sh.position.set(Math.cos(a) * 0.8, 0.06, Math.sin(a) * 0.8); sh.name = 'shard'; g.add(sh); } }
        break;
      }
      case 'burst': {
        const s = new THREE.Mesh(sphereGeo, addMat(col, 0.9)); s.name = 'sph';
        const r = new THREE.Mesh(ringGeo, addMat(0xffe0a0, 1)); r.name = 'ring';
        const d = new THREE.Mesh(discGeo, addMat(col, 0.35)); d.name = 'disc';
        g.add(s, r, d, sprite(0xffa040, 1)); break;
      }
      case 'slash': {
        const geo = new THREE.RingGeometry(0.72, 1, 28, 1, -f.arc * Math.PI / 360, f.arc * Math.PI / 180); geo.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(geo, addMat(col, 0.9)); m.name = 'slash'; g.add(m); break;
      }
      case 'blink': { const c = new THREE.Mesh(cylGeo, addMat(col, 0.7)); c.name = 'beam'; g.add(c, sprite(col, 80)); break; }
      case 'spawn': { const c = new THREE.Mesh(cylGeo, addMat(col, 0.3)); c.name = 'beam'; const r = new THREE.Mesh(ringGeo, addMat(col, 1)); r.name = 'ring'; g.add(c, r, sprite(col, 70)); break; }
      case 'trail': { g.add(sprite(col, 44)); break; }
      default: break;
    }
    fxGroup.add(g);
    return g;
  }
  const ease = (k) => 1 - (1 - k) * (1 - k);
  function updateFx(f, g) {
    const k = f.t / f.dur, op = 1 - k;
    g.position.set(f.x, 1, f.y);
    for (const c of g.children) {
      if (c.material && c.material.opacity !== undefined && c.type === 'Mesh') {
        const base = c.name === 'disc' ? 0.28 : c.name === 'beam' ? (f.type === 'spawn' ? 0.35 : 0.7) : 1;
        c.material.opacity = base * op;
      } else if (c.isSprite) c.material.opacity = op;
    }
    switch (f.type) {
      case 'ring': case 'nova': { const s = f.r * (0.25 + 0.75 * ease(k)); g.scale.set(s, 1, s); for (const c of g.children) if (c.name === 'shard') { c.scale.setScalar(1 + k * 0.5); c.position.y = 6; } break; }
      case 'burst': {
        const s = f.r * (0.2 + 0.8 * ease(k));
        for (const c of g.children) {
          if (c.name === 'sph') { c.scale.setScalar(s * 0.5 * (1 - k * 0.6)); c.position.y = s * 0.3; }
          else if (c.name === 'ring' || c.name === 'disc') c.scale.set(s, 1, s);
          else if (c.isSprite) { c.scale.setScalar(s * 2.6); c.position.y = s * 0.3; }
        }
        break;
      }
      case 'slash': g.rotation.y = -f.ang; g.scale.set(f.range, 1, f.range); g.position.y = 18; break;
      case 'blink': for (const c of g.children) { if (c.name === 'beam') { c.scale.set(14 * (1 - k), 90, 14 * (1 - k)); c.position.y = 45; } else if (c.isSprite) c.position.y = 30; } break;
      case 'spawn': for (const c of g.children) { if (c.name === 'beam') { c.scale.set(9 * (1 - k * 0.5), 80 * ease(k) + 10, 9 * (1 - k * 0.5)); c.position.y = 40 * ease(k); } else if (c.name === 'ring') c.scale.set(32 * (1 - k * 0.6), 1, 32 * (1 - k * 0.6)); else if (c.isSprite) c.position.y = 24; } break;
      case 'trail': g.position.y = 18; g.scale.setScalar(1 - k * 0.5); break;
      default: break;
    }
  }

  // projectiles
  function makeProj(q) {
    const g = new THREE.Group();
    if (q.kind === 'bolt') {
      const core = new THREE.Mesh(sphereGeo, addMat(0xffd080, 1)); core.scale.setScalar(6);
      g.add(core, sprite(0xff7a20, 56));
    } else if (q.kind === 'orb') {
      const core = new THREE.Mesh(sphereGeo, addMat(0xffa050, 1)); core.scale.setScalar(6);
      g.add(core, sprite(0xff4a10, 52));
    } else {
      const col = q.team === 'p' ? 0xe8dcc0 : 0x8a6a4a;
      const shaft = new THREE.Mesh(boxGeo, std({ color: col, roughness: 0.7 })); shaft.scale.set(26, 1.6, 1.6);
      const head = new THREE.Mesh(new THREE.ConeGeometry(2.6, 7, 6), std({ color: 0x9aa4ae, metalness: 0.8, roughness: 0.4 })); head.rotation.z = -Math.PI / 2; head.position.x = 15;
      const fl = new THREE.Mesh(boxGeo, std({ color: q.team === 'p' ? 0xc84a3a : 0x3a3a3a })); fl.scale.set(6, 0.6, 5); fl.position.x = -11;
      g.add(shaft, head, fl);
      if (q.team === 'e') g.add(sprite(0xff7a30, 20));
    }
    entities.add(g);
    return g;
  }

  // zones
  function makeZone(z) {
    const g = new THREE.Group();
    const col = z.kind === 'rain' ? 0xb8d850 : z.team === 'p' ? 0xff7a2a : 0xe82a20;
    if (z.kind === 'line') {
      const m = new THREE.Mesh(boxGeo, decalMat(0xff3020, 0.35)); m.name = 'line'; g.add(m);
    } else {
      const d = new THREE.Mesh(discGeo, decalMat(col, 0.18)); d.name = 'disc'; d.scale.set(z.r, 1, z.r);
      const r = new THREE.Mesh(ringGeo, decalMat(col, 0.9)); r.name = 'ring'; r.scale.set(z.r, 1, z.r);
      const f = new THREE.Mesh(discGeo, decalMat(col, 0.35)); f.name = 'fill';
      g.add(d, r, f);
      if (z.kind === 'meteor') { const m = new THREE.Mesh(sphereGeo, std({ color: 0x3a2418, emissive: 0xff5a10, emissiveIntensity: 1.6, roughness: 0.8 })); m.scale.setScalar(26); m.name = 'rock'; g.add(m, Object.assign(sprite(0xff7a20, 150), { name: 'mglow' })); }
      if (z.kind === 'rain') {
        for (let i = 0; i < 16; i++) { const a = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xf0e6c0 })); a.scale.set(1.4, 20, 1.4); a.name = 'arr'; a.userData.i = i; a.userData.seed = Math.random() * 10; g.add(a); }
      }
    }
    g.position.set(z.x, 0.8, z.y);
    fxGroup.add(g);
    return g;
  }
  function updateZone(z, g, time) {
    if (z.kind === 'line') {
      const m = g.children[0];
      const dx = z.x2 - z.x, dy = z.y2 - z.y, len = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      g.position.set(z.x + dx / 2, 1.2, z.y + dy / 2); g.rotation.y = -ang;
      m.scale.set(len, 0.5, z.w); m.material.opacity = 0.18 + 0.3 * Math.min(1, z.t / z.delay) * (0.7 + 0.3 * Math.sin(time * 30));
      return;
    }
    const k = z.delay ? Math.min(1, z.t / z.delay) : 1;
    const fired = z.fired || (z.kind === 'rain' && z.t > z.dur - 0.3);
    const fade = z.kind === 'rain' ? Math.min(1, (z.dur - z.t) * 3, z.t * 4) : fired ? Math.max(0, 1 - (z.t - z.delay) / 0.35) : 1;
    for (const c of g.children) {
      if (c.name === 'disc') c.material.opacity = (0.16 + 0.14 * k) * fade;
      else if (c.name === 'ring') c.material.opacity = (0.55 + 0.4 * k) * fade;
      else if (c.name === 'fill') { c.scale.set(z.r * k, 1, z.r * k); c.material.opacity = (z.kind === 'rain' ? 0.12 : 0.32) * fade; }
      else if (c.name === 'rock') {
        const kk = Math.min(1, z.t / z.delay);
        c.visible = !z.fired; c.position.set(-(1 - kk) * 220, 640 * (1 - kk * kk) + 20, -(1 - kk) * 220); c.rotation.x = time * 3;
      } else if (c.name === 'mglow') { c.visible = !z.fired; const kk = Math.min(1, z.t / z.delay); c.position.set(-(1 - kk) * 220, 640 * (1 - kk * kk) + 20, -(1 - kk) * 220); }
      else if (c.name === 'arr') {
        const ph = ((time * 2.4 + c.userData.seed) % 1);
        const a = c.userData.seed * 97.3 + Math.floor(time * 2.4 + c.userData.seed) * 31.7;
        const rr = Math.sqrt((Math.sin(a * 12.9898) * 0.5 + 0.5)) * z.r * 0.95, th = (Math.sin(a * 78.233) * 0.5 + 0.5) * TAU;
        c.position.set(Math.cos(th) * rr, 180 * (1 - ph), Math.sin(th) * rr);
        c.visible = fade > 0.05;
      }
    }
  }

  // pickups
  function makePickup(pk) {
    const g = new THREE.Group();
    if (pk.kind === 'gold') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.8, 14), std({ color: 0xe8b830, metalness: 0.9, roughness: 0.3, emissive: 0x5a3a00, emissiveIntensity: 0.6 })); m.rotation.x = Math.PI / 2; m.name = 'spin';
      const h = new THREE.Group(); h.add(m); h.name = 'bob'; g.add(h, sprite(0xffc840, 32));
    } else if (pk.kind === 'potion') {
      const h = new THREE.Group(); h.name = 'bob';
      const fl = new THREE.Mesh(sphereGeo, std({ color: 0xd8304a, emissive: 0x801020, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.1 })); fl.scale.set(5.5, 6, 5.5);
      const nk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 5, 8), std({ color: 0xcfd8e0, roughness: 0.2 })); nk.position.y = 7;
      const cp = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2.4, 8), std({ color: 0x7a4a28 })); cp.position.y = 10.5;
      h.add(fl, nk, cp); g.add(h, sprite(0xff4a6a, 38));
    } else {
      const rc = new THREE.Color(rarityOf(pk.item.rarity).color).convertSRGBToLinear();
      const beam = new THREE.Mesh(cylGeo, addMat(rc, 0.28)); beam.scale.set(7, 90, 7); beam.position.y = 45;
      const h = new THREE.Group(); h.name = 'bob';
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(7, 0), std({ color: rc, emissive: rc, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.4 })); gem.name = 'spin';
      h.add(gem); g.add(beam, h, sprite(rc, 60));
    }
    fxGroup.add(g);
    return g;
  }

  /* ---------- per-frame ---------- */
  function syncMap(map, list, make, key = (x) => x) {
    const seen = new Set();
    for (const o of list) { const k = key(o); seen.add(k); if (!map.has(k)) map.set(k, { o, g: make(o) }); }
    for (const [k, v] of map) if (!seen.has(k)) { v.g.parent?.remove(v.g); disposeObject(v.g); map.delete(k); }
  }

  const TILT = 56 * Math.PI / 180;
  function layoutCamera() {
    aspect = W / H;
    const fov = camera.fov * Math.PI / 180;
    const targetW = aspect >= 1 ? Math.min(700, 540 + aspect * 55) : 440;
    camDist = Math.max(520, Math.min(1500, targetW / (2 * Math.tan(fov / 2) * Math.min(aspect, 1.9))));
    camDist *= (+new URLSearchParams(location.search).get('dist') || 1);
    camera.aspect = aspect; camera.updateProjectionMatrix();
  }

  function render(game, dt) {
    const p = game.p, L = game.L;
    const time = game.time;
    if (!world) return;
    // camera follow
    const halfW = Math.min(WORLD_W / 2, camDist * Math.tan(camera.fov * Math.PI / 360) * aspect * 0.6);
    const halfH = Math.min(WORLD_H / 2, camDist * 0.35);
    const tx = Math.max(halfW, Math.min(WORLD_W - halfW, p.x)), tz = Math.max(halfH, Math.min(WORLD_H - halfH, p.y));
    if (!camInit) { camTarget.set(tx, 0, tz); camInit = true; }
    const k = 1 - Math.pow(0.0008, dt);
    camTarget.x += (tx - camTarget.x) * k; camTarget.z += (tz - camTarget.z) * k;
    const sh = game.shake;
    camera.position.set(camTarget.x + (sh ? (Math.random() - 0.5) * sh : 0), Math.sin(TILT) * camDist + (sh ? (Math.random() - 0.5) * sh * 0.5 : 0), camTarget.z + Math.cos(TILT) * camDist);
    camera.lookAt(camTarget.x, 0, camTarget.z - 20);

    // lights follow
    sun.position.set(camTarget.x + sunDir.x * 700, sunDir.y * 700, camTarget.z + sunDir.z * 700);
    sun.target.position.set(camTarget.x, 0, camTarget.z);
    sun.target.updateMatrixWorld();
    if (L.lights.length && quality === 'high') {
      const near = [...L.lights].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      pointLights.forEach((l, i) => {
        const b = near[i];
        l.visible = !!b;
        if (b) { l.position.set(b.x, 52, b.y); l.intensity = 2.2 * (0.9 + 0.1 * Math.sin(time * 9 + i * 2)); l.distance = 460; }
      });
    }

    world.update?.(dt, time, p, camTarget);

    // player
    playerVis.root.position.set(p.x, world.heightAt(p.x, p.y), p.y);
    playerVis.root.rotation.y = Math.PI / 2 - p.face;
    playerVis.update(p, dt, time, game);
    playerVis.flash(p.hitT > 0.1 && !p.dead);

    // enemies
    const seen = new Set();
    for (const e of game.enemies) {
      seen.add(e.id);
      let v = enemyVis.get(e.id);
      if (!v) { v = createCharacter(e.type, quality); entities.add(v.root); enemyVis.set(e.id, v); }
      v.root.position.set(e.x, world.heightAt(e.x, e.y), e.y);
      v.root.rotation.y = Math.PI / 2 - e.face;
      const sp = e.spawnT > 0 ? 1 - e.spawnT / 0.7 : 1;
      v.root.scale.setScalar(0.4 + 0.6 * Math.min(1, sp * 1.3));
      v.root.visible = true;
      v.update(e, dt, time, game);
      v.flash(e.hitT > 0.09);
    }
    for (const [id, v] of enemyVis) if (!seen.has(id)) { entities.remove(v.root); disposeObject(v.root); enemyVis.delete(id); }

    // projectiles
    {
      const seenP = new Set();
      for (const q of game.proj) {
        seenP.add(q);
        let v = projVis.get(q);
        if (!v) { v = { g: makeProj(q) }; projVis.set(q, v); }
        const ang = Math.atan2(q.vy, q.vx);
        v.g.position.set(q.x, q.kind === 'earrow' || q.kind === 'arrow' ? 20 : 22, q.y);
        v.g.rotation.y = -ang;
        if (q.kind === 'bolt' || q.kind === 'orb') v.g.scale.setScalar(1 + 0.15 * Math.sin(time * 30 + q.x));
      }
      for (const [q, v] of projVis) if (!seenP.has(q)) { entities.remove(v.g); disposeObject(v.g); projVis.delete(q); }
    }
    // zones
    {
      const seenZ = new Set();
      for (const z of game.zones) { seenZ.add(z); let v = zoneVis.get(z); if (!v) { v = { g: makeZone(z) }; zoneVis.set(z, v); } updateZone(z, v.g, time); }
      for (const [z, v] of zoneVis) if (!seenZ.has(z)) { fxGroup.remove(v.g); disposeObject(v.g); zoneVis.delete(z); }
    }
    // pickups
    {
      const seenK = new Set();
      for (const pk of game.pickups) {
        seenK.add(pk);
        let v = pickVis.get(pk);
        if (!v) { v = { g: makePickup(pk) }; pickVis.set(pk, v); }
        v.g.position.set(pk.x, world.heightAt(pk.x, pk.y), pk.y);
        for (const c of v.g.children) if (c.name === 'bob') { c.position.y = 14 + Math.sin(time * 3 + pk.x) * 3; c.rotation.y = time * 2 + pk.x; }
        const s = Math.min(1, pk.t * 4); v.g.scale.setScalar(s);
      }
      for (const [pk, v] of pickVis) if (!seenK.has(pk)) { fxGroup.remove(v.g); disposeObject(v.g); pickVis.delete(pk); }
    }
    // fx
    {
      const seenF = new Set();
      for (const f of game.fx) { seenF.add(f); let v = fxVis.get(f); if (!v) { v = { g: makeFx(f) }; fxVis.set(f, v); } updateFx(f, v.g); }
      for (const [f, v] of fxVis) if (!seenF.has(f)) { fxGroup.remove(v.g); disposeObject(v.g); fxVis.delete(f); }
    }
    gl.render(scene, camera);
  }

  const api = {
    kind: '3d', gl, scene, camera,
    resize(w, h, ratio) {
      W = w; H = h; dpr = ratio;
      gl.setPixelRatio(ratio); gl.setSize(w, h, false);
      layoutCamera();
    },
    setStage, render,
    setQuality(q) { quality = q === 'low' ? 'low' : 'high'; },
    screenToWorld(cx, cy) {
      ndc.set((cx / W) * 2 - 1, -(cy / H) * 2 + 1);
      camera.updateMatrixWorld();
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(ground, hit)) return { x: hit.x, y: hit.z };
      return { x: camTarget.x, y: camTarget.z };
    },
    project(x, y, z = 0) {
      tmp.set(x, z, y).project(camera);
      if (tmp.z > 1) return null;
      return { x: (tmp.x * 0.5 + 0.5) * W, y: (-tmp.y * 0.5 + 0.5) * H };
    },
    // Pre-build textures/materials/sky in small idle slices so the first stage load is quick.
    warm() {
      const steps = [() => envFor('fields'), ...Object.values(Mat).map((f) => () => f()), ...Object.values(PM).map((f) => () => { try { f(); } catch (e) { /* optional */ } })];
      let i = 0;
      const run = () => { const t = performance.now(); while (i < steps.length && performance.now() - t < 10) steps[i++](); if (i < steps.length) setTimeout(run, 6); };
      run();
    },
    clear() { gl.clear(); },
    info: () => gl.info,
  };
  return api;
}
