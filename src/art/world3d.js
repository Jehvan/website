// PLACEHOLDER world (stage 2): painted ground + boxes. Replaced by full dressing in stage 3.
import { mkCanvas, toTexture } from './textures.js';

const GROUND = { fields: '#5f7d3a', wood: '#3e5a2c', bridge: '#587a3c', marsh: '#4a5a3a', gate: '#6a6a50', hall: '#3a3430', vault: '#2c2a34' };

export function buildWorld(L, quality, THREE) {
  const group = new THREE.Group();
  const [c, g] = mkCanvas(1024, 740);
  const sx = 1024 / L.w, sy = 740 / L.h;
  g.fillStyle = GROUND[L.theme] || '#444'; g.fillRect(0, 0, 1024, 740);
  if (L.road) {
    g.strokeStyle = '#8a6c46'; g.lineWidth = L.roadW * 2 * sx; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); L.road.forEach(([x, y], i) => (i ? g.lineTo(x * sx, y * sy) : g.moveTo(x * sx, y * sy))); g.stroke();
  }
  const tex = toTexture(THREE, c, { aniso: 4 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(L.w / 2, 0, L.h / 2); ground.receiveShadow = true;
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(L.w * 4, L.h * 4), new THREE.MeshStandardMaterial({ color: GROUND[L.theme] || '#444', roughness: 1 }));
  skirt.rotation.x = -Math.PI / 2; skirt.position.set(L.w / 2, -1, L.h / 2);
  group.add(ground, skirt);
  const m = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.9 });
  for (const o of L.obstacles) {
    let mesh;
    if (o.t === 'c') { mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, 40, 10), m); mesh.position.set(o.x, 20, o.y); }
    else { mesh = new THREE.Mesh(new THREE.BoxGeometry(o.w, 40, o.h), m); mesh.position.set(o.x, 20, o.y); mesh.rotation.y = -o.rot; }
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  }
  return { group, update() {}, dispose() { tex.dispose(); } };
}
