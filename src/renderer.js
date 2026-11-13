// 3D renderer (three.js): real PBR ground, KayKit characters and props, torch light, shadows, bloom and grade.
// Same interface the game loop expects: setStage / render / screenToWorld / project, plus picking and the town hub.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { preload, S, wx, wz } from './gfx/assets.js';
import { allModelFiles } from './gfx/catalog.js';
import { Stage } from './gfx/stage.js';
import { Character } from './gfx/chars.js';
import { Effects } from './gfx/fx.js';
import { buildLayout } from './world.js';
import { targetable } from './game.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 0.9 }, uVig: { value: 1.35 }, uHurt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uVig, uHurt; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb = mix(c.rgb * vec3(0.9, 0.96, 1.1), c.rgb * vec3(1.07, 1.0, 0.9), smoothstep(0.04, 0.55, l));   // cool shadows, warm lights
      c.rgb = (c.rgb - 0.5) * 1.1 + 0.5;
      vec2 q = vUv - 0.5; float v = dot(q, q);
      c.rgb *= clamp(1.0 - v * uVig, 0.0, 1.0);
      c.rgb = mix(c.rgb, vec3(0.5, 0.0, 0.0), clamp(v * 2.2, 0.0, 1.0) * uHurt);
      gl_FragColor = c;
    }`,
};

export async function createRenderer(canvas, settings, onProgress) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
  let quality = settings.gfx || 'high';
  let W = 2, H = 2;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);      // after tone mapping, so the grade works in display space
  composer.addPass(grade);

  await preload(allModelFiles(), onProgress);

  let stage = null, hero = null, fx = null, hub = null;
  const foes = new Map();
  const look = new THREE.Vector3(), want = new THREE.Vector3();
  let camInit = false, dist = 22, pitch = THREE.MathUtils.degToRad(42), hoverId = 0, hubT = 0;
  const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _v = new THREE.Vector3(), _n = new THREE.Vector2();

  function applyTheme(th) {
    scene.background = new THREE.Color(th.bg);
    scene.fog = new THREE.FogExp2(th.fog, th.fogD);
    renderer.toneMappingExposure = th.exposure;
    grade.uniforms.uSat.value = th.sat;
    grade.uniforms.uVig.value = th.indoor ? 1.9 : 1.35;
  }

  function clear() {
    for (const c of foes.values()) c.dispose();
    foes.clear();
    hero?.dispose(); hero = null;
    fx?.clear(); fx = null;
    if (hub) { for (const n of hub.npcs) n.c.dispose(); hub = null; }
    if (stage) { stage.dispose(); stage = null; }
    hoverId = 0;
  }

  function placeCamera(shake = 0, yawOff = 0) {
    const cy = Math.sin(pitch) * dist, cz = Math.cos(pitch) * dist;
    cam.position.set(look.x + Math.sin(yawOff) * cz, cy, look.z + Math.cos(yawOff) * cz);
    if (shake > 0) { cam.position.x += (Math.random() - 0.5) * shake * 0.03; cam.position.y += (Math.random() - 0.5) * shake * 0.02; }
    cam.lookAt(look.x, 0.9, look.z);
  }

  const api = {
    get hoverId() { return hoverId; },
    resize(w, h, dpr) {
      W = w; H = h;
      renderer.setPixelRatio(quality === 'low' ? Math.min(1, dpr) : dpr);
      renderer.setSize(w, h, false);
      composer.setPixelRatio(quality === 'low' ? Math.min(1, dpr) : dpr);
      composer.setSize(w, h);
      cam.aspect = w / h;
      // keep roughly the same amount of world in view on tall phone screens
      cam.fov = w / h < 1 ? 46 : 30;
      cam.updateProjectionMatrix();
    },
    setQuality(q) { quality = q; renderer.shadowMap.enabled = q !== 'low'; bloom.enabled = q !== 'low'; },
    clear,
    zoom(d) { dist = Math.max(14, Math.min(34, dist + d)); },

    setStage(game) {
      clear();
      stage = new Stage(game.L, quality);
      scene.add(stage.root);
      applyTheme(stage.th);
      fx = new Effects(stage.dyn);
      hero = new Character(game.save.cls, stage.dyn);
      hero.radius = game.p.r * S;
      if (stage.heirAt) { const c = new Character('heir', stage.dyn); c.root.position.set(wx(stage.heirAt.x), 1.2, wz(stage.heirAt.y)); c.root.rotation.y = 0; stage.heir = c; }
      camInit = false; dist = 22;
    },

    /** Town behind the title and camp screens. side = push the plaza left of the side panel. */
    setHub(cls, side) {
      if (hub && hub.cls === cls) { hub.side = side; return; }
      clear();
      const L = buildLayout('town', 3);
      stage = new Stage(L, quality);
      scene.add(stage.root);
      applyTheme(stage.th);
      hub = { cls, side, npcs: [] };
      const npc = (kind, ...way) => hub.npcs.push({ c: new Character(kind, stage.dyn), way, wi: 0, wait: Math.random() * 3, x: way[0][0], y: way[0][1], yaw: 0 });
      npc(cls || 'knight', [790, 800]);
      npc('guard', [520, 560], [620, 700]); npc('guard', [1100, 560], [1170, 700]);
      npc('villager', [720, 470], [900, 470], [980, 560]); npc('smith', [470, 700]);
      npc('villager', [560, 760], [690, 700]); npc('mage', [1050, 640], [1050, 560]); npc('ranger', [930, 760], [840, 840]);
      hubT = 0;
    },

    showClick(x, y) { fx?.showClick(x, y); },

    render(game, dt) {
      if (hub) {
        hubT += dt;
        for (const n of hub.npcs) {
          let moving = false;
          if (n.way.length > 1) {
            if (n.wait > 0) n.wait -= dt;
            else {
              const [tx, ty] = n.way[n.wi], dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy);
              if (d < 4) { n.wi = (n.wi + 1) % n.way.length; n.wait = 2.5 + Math.random() * 3; }
              else { n.x += dx / d * 34 * dt; n.y += dy / d * 34 * dt; n.yaw = Math.PI / 2 - Math.atan2(dy, dx); moving = true; }
            }
          }
          n.c.updateNpc(wx(n.x), wz(n.y), n.yaw, moving, dt);
        }
        const sideK = hub.side && W > H ? 1 : 0;
        look.set(wx(800) + sideK * 6.5 + Math.sin(hubT * 0.12) * 0.8, 0, wz(640) + (W > H ? 0 : 2));
        dist = W > H ? 27 : 34; pitch = THREE.MathUtils.degToRad(40);
        stage.tick(dt, look);
        placeCamera(0, Math.sin(hubT * 0.07) * 0.1);
        grade.uniforms.uHurt.value = 0;
      } else if (stage && game.p) {
        const p = game.p, t = game.time, sdt = game.paused ? 0 : dt;
        pitch = THREE.MathUtils.degToRad(42);
        hero.updateHero(p, game.save.cls, sdt);
        const seen = new Set();
        for (const e of game.enemies) {
          seen.add(e.id);
          let c = foes.get(e.id);
          if (!c) { c = new Character(e.type, stage.dyn); c.radius = e.r * S; c.yawNow = Math.PI / 2 - e.face; foes.set(e.id, c); }
          c.updateEnemy(e, sdt, t);
          if (!e.dead) { c.setTargeted(e.id === game.targetId, t); c.setHovered(e.id === hoverId); }
        }
        for (const [id, c] of foes) if (!seen.has(id)) { c.dispose(); foes.delete(id); }
        stage.heir?.mixer.update(dt);
        fx.sync(game, sdt);
        // camera: follow the hero, stay inside the map
        const L = game.L, halfW = dist * (W / H) * 0.27, halfH = dist * 0.3;
        const mw = L.w * S, mh = L.h * S;
        want.set(mw > halfW * 2 ? Math.max(halfW, Math.min(mw - halfW, wx(p.x))) : mw / 2, 0, mh > halfH * 2 ? Math.max(halfH * 0.5, Math.min(mh - halfH * 0.4, wz(p.y))) : mh / 2);
        if (!camInit) { look.copy(want); camInit = true; }
        look.lerp(want, 1 - Math.exp(-6 * dt));
        stage.tick(dt, look);
        placeCamera(game.shake || 0);
        grade.uniforms.uHurt.value = Math.max(Math.min(1, p.hitT / 0.22) * 0.5, p.dead ? 0.5 : Math.max(0, 0.3 - p.hp / game.hero.maxHp) * 1.6);
      } else return;
      if (quality === 'low') renderer.render(scene, cam); else composer.render(dt);
    },

    /** Screen pixel -> world (x, y) on the ground plane. */
    screenToWorld(sx, sy) {
      _n.set((sx / W) * 2 - 1, -(sy / H) * 2 + 1);
      raycaster.setFromCamera(_n, cam);
      return raycaster.ray.intersectPlane(plane, _v) ? { x: _v.x / S, y: _v.z / S } : null;
    },

    /** World (x, y, height px) -> screen pixel, or null when behind the camera. */
    project(x, y, z = 0) {
      _v.set(wx(x), z * S, wz(y)).project(cam);
      if (_v.z > 1) return null;
      return { x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H };
    },

    /** Enemy under the cursor (generous radius so clicks are forgiving). */
    pickEnemy(game, sx, sy, slop = 1) {
      let best = 0, bd = 1e9;
      for (const e of game.enemies) {
        if (!targetable(e)) continue;
        const tall = e.type === 'brute' ? 40 : e.type === 'regent' ? 55 : 28;
        const a = api.project(e.x, e.y, tall), b = api.project(e.x + e.r, e.y, tall);
        if (!a || !b) continue;
        const r = (Math.abs(b.x - a.x) * 1.5 + 22) * slop, d = Math.hypot(sx - a.x, sy - a.y);
        if (d < r && d < bd) { bd = d; best = e.id; }
      }
      return best;
    },
    setHover(id) { hoverId = id; },
  };
  api.setQuality(quality);
  return api;
}
