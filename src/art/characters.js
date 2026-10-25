// PLACEHOLDER characters (stage 2): capsule people. Replaced by the jointed rig in stage 3.
import * as THREE from 'three';

const mats = new Map();
const mat = (color) => {
  if (!mats.has(color)) { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 }); m.userData.shared = true; mats.set(color, m); }
  return mats.get(color);
};
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); flashMat.userData.shared = true;
const body = new THREE.CylinderGeometry(1, 1, 1, 10); body.userData.shared = true;
const ball = new THREE.SphereGeometry(1, 10, 8); ball.userData.shared = true;

const COL = { knight: 0x6f8fc8, ranger: 0x4f8a50, mage: 0x7a5ac0, grunt: 0x8a8a7a, bowman: 0x5a4a3a, wisp: 0xff9a3a, brute: 0x6a5a4a, regent: 0x2a2430 };
const SIZE = { knight: 1, ranger: 1, mage: 1, grunt: 1.05, bowman: 0.95, wisp: 0.8, brute: 1.7, regent: 2.1 };

export function createCharacter(kind) {
  const root = new THREE.Group();
  const s = SIZE[kind] || 1;
  const m = mat(COL[kind] || 0x888888);
  const b = new THREE.Mesh(body, m); b.scale.set(9 * s, 34 * s, 9 * s); b.position.y = 17 * s;
  const h = new THREE.Mesh(ball, mat(0xd8b090)); h.scale.setScalar(7 * s); h.position.y = 40 * s;
  const nose = new THREE.Mesh(ball, mat(0x222222)); nose.scale.setScalar(2.5 * s); nose.position.set(0, 40 * s, 6 * s);
  const inner = new THREE.Group(); inner.add(b, h, nose);
  root.add(inner);
  return {
    root,
    update(e, dt, time) {
      inner.rotation.x = e.atkT >= 0 ? 0.4 * Math.sin(e.atkT * Math.PI) : 0;
      inner.position.y = (e.type === 'wisp' ? 14 + Math.sin(time * 4 + e.id) * 4 : 0) + (e.walkPhase ? Math.abs(Math.sin(e.walkPhase)) * 2 : 0);
      if (e.dead) inner.rotation.x = Math.min(1.5, e.deadT * 4);
    },
    flash(on) { for (const c of inner.children) c.material = on ? flashMat : c === h ? mat(0xd8b090) : c === nose ? mat(0x222222) : m; },
  };
}
