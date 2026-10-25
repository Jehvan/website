// Dev-only art gallery: ?gallery=knight,ranger&pose=walk|attack|dead|idle&view=front|back|side
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { createCharacter } from './art/characters.js';
import { setEnvIntensity, std } from './art/materials.js';

export function startGallery(canvas, params) {
  const kinds = (params.get('gallery') || 'knight,ranger,mage,grunt,bowman,wisp,brute,regent').split(',');
  const pose = params.get('pose') || 'idle';
  const view = params.get('view') || 'front';
  const quality = params.get('q') || 'high';
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true });
  gl.outputEncoding = THREE.sRGBEncoding; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1;
  gl.shadowMap.enabled = quality === 'high'; gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.setPixelRatio(1); gl.setSize(innerWidth, innerHeight, false);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(gl);
  const sky = new Sky(); sky.scale.setScalar(450000);
  sky.material.uniforms.turbidity.value = 3.5; sky.material.uniforms.rayleigh.value = 1.4;
  sky.material.uniforms.sunPosition.value.setFromSphericalCoords(1, THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(150));
  const ss = new THREE.Scene(); ss.add(sky);
  const env = pm.fromScene(ss).texture;
  scene.environment = env; scene.background = env;
  const qn = (k, d) => (params.has(k) ? +params.get(k) : d);
  setEnvIntensity(qn('env', 0.22)); gl.toneMappingExposure = qn('exp', 1);
  const sun = new THREE.DirectionalLight(0xfff0d8, qn('sun', 1.4)); sun.position.set(80, 140, 100); sun.castShadow = quality === 'high';
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -200; sc.right = 200; sc.top = 200; sc.bottom = -200; sc.near = 10; sc.far = 600; sun.shadow.bias = -0.0006;
  scene.add(sun, new THREE.HemisphereLight(0xbfd8ff, 0x6a5a3a, qn('hemi', 0.35)));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), std({ color: 0x5f7d3a, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const spacing = 70;
  const items = kinds.map((k, i) => {
    const vis = createCharacter(k, quality);
    const x = (i - (kinds.length - 1) / 2) * spacing;
    vis.root.position.set(x, 0, 0);
    scene.add(vis.root);
    const ent = { id: i + 1, type: ['grunt', 'bowman', 'wisp', 'brute', 'regent'].includes(k) ? k : undefined, x: 0, y: 0, state: 'chase', atkT: -1, hitT: 0, dead: false, deadT: 0, skillAnim: null, skillT: 0, face: 0, enraged: params.has('enraged'), spawnT: 0, hp: 1, maxHp: 1 };
    return { vis, ent, x };
  });
  const cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 1, 3000);
  const span = Math.max(1, kinds.length - 1) * spacing + 90;
  const dist = Math.max(190, span / (2 * Math.tan(THREE.MathUtils.degToRad(16)) * cam.aspect) * 1.05);
  const dir = view === 'back' ? [0, 0.25, -1] : view === 'side' ? [1, 0.25, 0] : [0.25, 0.28, 1];
  cam.position.set(dir[0] * dist, 28 + dir[1] * dist * 0.5, dir[2] * dist); cam.lookAt(0, 26, 0);
  let t = 0;
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta()); t += dt;
    for (const it of items) {
      const e = it.ent;
      e.hitT = Math.max(0, e.hitT - dt);
      if (pose === 'walk') { e.x += 70 * dt; e.state = 'chase'; e.atkT = -1; }
      else if (pose === 'attack') {
        const c = (t % 1.6) / 1.6;
        if (e.type) { e.state = c < 0.6 ? 'windup' : 'recover'; e.atkT = c < 0.6 ? c / 0.6 : -1; if (e.type === 'regent') { e.state = c < 0.6 ? 'slam' : 'recover'; e.atkT = c < 0.6 ? c / 0.6 : -1; } }
        else { e.atkT = c < 0.4 ? c / 0.4 : -1; }
      } else if (pose === 'hit') { if (t % 1.2 < dt) e.hitT = 0.2; }
      else if (pose === 'dead') { e.dead = true; e.deadT = (t % 3) ; }
      else if (pose.startsWith('skill:')) { e.skillAnim = pose.slice(6); e.skillT = 0.4 + 0.4 * (1 - ((t % 1.2) / 1.2)); }
      it.vis.root.rotation.y = view === 'orbit' ? t * 0.8 : 0;
      it.vis.update(e, dt, t, null);
      it.vis.flash(e.hitT > 0.1);
    }
    gl.render(scene, cam);
  }
  frame();
  window.__gallery = { items, scene, cam, gl };
}
