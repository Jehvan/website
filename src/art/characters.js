// Original character designs built on the humanoid rig. createCharacter(kind, quality) -> { root, update, flash }.
import * as THREE from 'three';
import { Mat, flashMat, std } from './materials.js';
import { buildHumanoid, createAnimator, mount, limbGeo, cylGeo, sphGeo, boxGeo, coneGeo, dome, mergeStatics } from './rig.js';
import { glowTexture, Tex } from './textures.js';

const PI = Math.PI;

function part(rig, parent, geo, mat, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1], [rx, ry, rz] = [0, 0, 0], shadow = true) {
  const m = rig.mk(geo, mat, parent, shadow);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
  return m;
}
const grp = (parent, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0]) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, ry, rz); parent.add(g); return g; };
const glowSprite = (color, size, op = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: op, fog: false })); s.scale.setScalar(size); return s; };

function eyes(rig, head, y, z, sep, mat, r = 0.75) {
  for (const s of [-1, 1]) part(rig, head, sphGeo(r, 6, 5), mat, [s * sep, y, z], [1, 1, 0.6], [0, 0, 0], false);
}

// hanging cloth: top edge at pivot. Returns { upper, lower, pivot }
function makeCape(rig, mat, w, h1, h2, pos, taper = 0.85) {
  const pivot = grp(rig.J.chest, pos);
  const upper = grp(pivot);
  const g1 = new THREE.PlaneGeometry(w, h1, 1, 1); g1.translate(0, -h1 / 2, 0);
  const m1 = rig.mk(g1, mat, upper, false); m1.geometry.userData.shared = false;
  const lower = grp(upper, [0, -h1, 0]);
  const g2 = new THREE.PlaneGeometry(w * taper, h2, 1, 1); g2.translate(0, -h2 / 2, 0);
  const m2 = rig.mk(g2, mat, lower, false); m2.geometry.userData.shared = false;
  return { pivot, upper, lower };
}

function quiver(rig, parent) {
  const q = grp(parent, [-3.5, 9, -5.4], [0.25, 0, 0.35]);
  part(rig, q, cylGeo(15, 2.6, 2.4, 8), Mat.leatherDark(), [0, 0, 0]);
  part(rig, q, cylGeo(1.2, 2.8, 2.8, 8), Mat.leather(), [0, 7.2, 0]);
  for (let i = 0; i < 4; i++) {
    const a = grp(q, [(i - 1.5) * 1.1, 9, (i % 2) * 0.8 - 0.4], [0, 0, (i - 1.5) * 0.12]);
    part(rig, a, cylGeo(7, 0.22, 0.22, 4), Mat.wood(), [0, 3, 0], [1, 1, 1], [0, 0, 0], false);
    part(rig, a, boxGeo(1.6, 2.6, 0.2), i % 2 ? Mat.clothRed() : Mat.clothCream(), [0, 6.2, 0], [1, 1, 1], [0, 0, 0], false);
  }
  return q;
}

function sword(rig) {
  const g = new THREE.Group();
  part(rig, g, cylGeo(5, 0.85, 0.9, 6), Mat.leather(), [0, 0.5, 0]);
  part(rig, g, sphGeo(1.3, 8, 6), Mat.gold(), [0, -2.2, 0]);
  part(rig, g, boxGeo(7.4, 1.0, 1.5), Mat.gold(), [0, 3.1, 0]);
  part(rig, g, boxGeo(2.0, 25, 0.55), Mat.blade(), [0, 16.2, 0]);
  part(rig, g, coneGeo(1.0, 5, 4), Mat.blade(), [0, 31.2, 0], [1, 1, 0.28], [0, PI / 4, 0]);
  part(rig, g, boxGeo(0.5, 22, 0.62), Mat.steel(), [0, 15.5, 0]);
  return g;
}

function shield(rig, parent) {
  const sh = new THREE.Shape();
  sh.moveTo(-6.5, 8.5); sh.lineTo(6.5, 8.5); sh.lineTo(6.5, 1); sh.quadraticCurveTo(6.2, -6, 0, -11.5); sh.quadraticCurveTo(-6.2, -6, -6.5, 1); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5, bevelSegments: 1, curveSegments: 6 });
  geo.userData.shared = true;
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 7) / 14, (pos.getY(i) + 12) / 21);
  const m = new THREE.Mesh(geo, [Mat.heraldry(), Mat.shieldRim()]);
  m.castShadow = rig.hi; m.userData.m = m.material; rig.meshes.push(m);
  const g = grp(parent, [4.2, -4.5, 1.5], [0, PI / 2 - 0.15, 0.1]);
  g.add(m);
  part(rig, g, sphGeo(1.7, 8, 6), Mat.shieldRim(), [0, 0, 2.2], [1, 1, 0.6]);
  return g;
}

function bow(rig, big) {
  const g = new THREE.Group();
  const R = big ? 20 : 15, ang = 0.95;
  const arc = new THREE.TorusGeometry(R, 0.85, 5, 16, ang * 2); arc.rotateZ(-ang); arc.translate(-R, 0, 0);
  const arcM = rig.mk(arc, Mat.wood(), g); arcM.rotation.y = -PI / 2;
  const half = R * Math.sin(ang);
  const string = rig.mk(cylGeo(half * 2, 0.12, 0.12, 3), Mat.clothCream(), g, false); string.position.z = R * (Math.cos(ang) - 1);
  part(rig, g, cylGeo(4, 1.1, 1.1, 6), Mat.leatherDark(), [0, 0, 0]);
  return g;
}

function staff(rig, orbMat, orbColor) {
  const g = new THREE.Group();
  part(rig, g, cylGeo(46, 1.0, 1.35, 7), Mat.wood(), [0, 14, 0]);
  part(rig, g, cylGeo(4, 1.5, 1.5, 7), Mat.leatherDark(), [0, 0, 0]);
  // claw cradle
  for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2; part(rig, g, cylGeo(7, 0.45, 0.8, 4), Mat.wood(), [Math.cos(a) * 2.2, 40, Math.sin(a) * 2.2], [1, 1, 1], [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]); }
  const orb = part(rig, g, sphGeo(3.0, 12, 8), orbMat, [0, 41.5, 0], [1, 1, 1], [0, 0, 0], false);
  const glow = glowSprite(orbColor, 22); glow.position.set(0, 41.5, 0); g.add(glow);
  return { g, orb, glow };
}

function club(rig) {
  const g = new THREE.Group();
  part(rig, g, cylGeo(30, 3.4, 1.2, 8), Mat.wood(), [0, 13, 0]);
  part(rig, g, cylGeo(4, 1.5, 1.5, 6), Mat.leatherDark(), [0, -1.5, 0]);
  for (const y of [14, 20, 25]) part(rig, g, cylGeo(1.6, 3.9 - (y - 14) * 0.12, 3.9 - (y - 14) * 0.12, 8), Mat.iron(), [0, y, 0]);
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; part(rig, g, coneGeo(0.8, 2.4, 4), Mat.iron(), [Math.cos(a) * 3.5, 22, Math.sin(a) * 3.5], [1, 1, 1], [Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3]); }
  return g;
}

function greataxe(rig) {
  const g = new THREE.Group();
  part(rig, g, cylGeo(64, 1.5, 1.6, 8), Mat.iron(), [0, 18, 0]);
  part(rig, g, cylGeo(10, 1.9, 1.9, 8), Mat.leatherDark(), [0, 0, 0]);
  part(rig, g, coneGeo(1.4, 7, 6), Mat.iron(), [0, 54, 0]);
  const blade = (s) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 6); sh.quadraticCurveTo(s * 9, 9, s * 19, 14); sh.quadraticCurveTo(s * 23, 0, s * 19, -14); sh.quadraticCurveTo(s * 9, -9, 0, -6); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.6, bevelSegments: 1 });
    geo.translate(0, 0, -0.45);
    const m = rig.mk(geo, Mat.blackPlate(), g); m; m.position.set(0, 40, 0);
    const edge = rig.mk(boxGeo(0.7, 24, 1.1), Mat.gem(), g, false); edge.position.set(s * 20.4, 40, 0);
  };
  blade(1); blade(-1);
  return g;
}

/* ---------------- builders ---------------- */

function knight(q) {
  const rig = buildHumanoid({
    bulk: 1.1, headScale: 1.02,
    mats: { skin: Mat.skinHuman(), torso: Mat.steel(), hip: Mat.chain(), thigh: Mat.chain(), shin: Mat.steel(), boot: Mat.leatherDark(), arm: Mat.chain(), fore: Mat.steel(), shoulder: Mat.steel(), hand: Mat.leatherDark(), head: Mat.steel() },
  }, q);
  const { J } = rig;
  // tabard with heraldry (front/back) and skirt
  part(rig, J.spine, boxGeo(11.5, 17, 0.5), Mat.clothBlue(), [0, 8.5, 5.1]);
  part(rig, J.spine, boxGeo(10, 11, 0.4), Mat.heraldry(), [0, 9, 5.45]);
  part(rig, J.spine, boxGeo(11.5, 17, 0.5), Mat.clothBlue(), [0, 8.5, -5.1]);
  part(rig, J.hips, boxGeo(12.5, 9, 0.5), Mat.clothRed(), [0, -3.5, 4.6], [1, 1, 1], [-0.1, 0, 0]);
  part(rig, J.hips, boxGeo(12.5, 8, 0.5), Mat.clothRed(), [0, -3.5, -4.4], [1, 1, 1], [0.1, 0, 0]);
  part(rig, J.hips, cylGeo(2, 6.8, 6.8, 10), Mat.leatherDark(), [0, 2.2, 0], [1, 1, 0.74]);
  part(rig, J.hips, boxGeo(3.2, 2.6, 0.6), Mat.gold(), [0, 2.2, 5.0]);
  // gorget + pauldrons
  part(rig, J.chest, cylGeo(2.6, 4.2, 5.4, 8), Mat.steel(), [0, 0.8, 0]);
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? 1 : -1;
    const pd = part(rig, J['shoulder' + s], dome(4.6, 10, 6, PI * 0.55), Mat.steel(), [0, 1.2, 0], [1.15, 0.8, 1.1], [0, 0, sg * 0.25]);
    pd;
    part(rig, J['shoulder' + s], cylGeo(0.9, 5.3, 5.3, 12), Mat.shieldRim(), [sg * 0.8, 0.0, 0], [1, 1, 1.0], [0, 0, sg * 0.25]);
    part(rig, J['knee' + s], sphGeo(3.4, 8, 6), Mat.steel(), [0, 0.4, 1.4], [1, 0.9, 0.8]);
    part(rig, J['elbow' + s], sphGeo(2.8, 8, 6), Mat.steel(), [0, 0, -0.6], [1, 1, 1]);
  }
  // great helm
  const h = J.head;
  part(rig, h, cylGeo(9.2, 5.7, 5.6, 12), Mat.steel(), [0, 5.0, 0], [0.96, 1, 1.02]);
  part(rig, h, dome(5.7, 12, 6, PI / 2), Mat.steel(), [0, 9.6, 0], [0.96, 0.9, 1.02]);
  part(rig, h, boxGeo(8.6, 0.9, 1.0), Mat.dark(), [0, 6.2, 5.5]);
  part(rig, h, boxGeo(1.0, 6.2, 1.0), Mat.dark(), [0, 3.4, 5.55]);
  for (let i = 0; i < 4; i++) part(rig, h, sphGeo(0.4, 5, 4), Mat.dark(), [2.2 + (i % 2) * 1.4, 2.6 + (i >> 1) * 1.6, 5.4], [1, 1, 1], [0, 0, 0], false);
  part(rig, h, boxGeo(0.9, 9, 0.6), Mat.shieldRim(), [0, 5.4, 5.7], [1, 0.3, 1]);
  // plume
  const plume = grp(h, [0, 11.6, -0.5], [-0.5, 0, 0]);
  part(rig, plume, boxGeo(1.1, 2.4, 9), Mat.clothRed(), [0, 0.8, -4]);
  part(rig, plume, boxGeo(1.0, 1.8, 6), Mat.clothRed(), [0, 0.2, -9], [1, 1, 1], [0.4, 0, 0]);
  // belt pouch & sword & shield
  part(rig, J.hips, boxGeo(3.2, 3.6, 2.2), Mat.leather(), [6.6, -0.5, 1.5]);
  const sw = mount(rig, 'R', sword(rig));
  shield(rig, J.elbowL);
  const cape = makeCape(rig, Mat.clothRed(), 15, 14, 13, [0, 14.5, -4.6]);
  return { rig, cfg: { style: 'slash', extras: { cape }, idleR: [-0.35, -1.0, 0], idleL: [-0.25, -0.9, 0.2] }, wrist: sw };
}

function ranger(q) {
  const rig = buildHumanoid({
    bulk: 0.96,
    mats: { skin: Mat.skinHuman(), torso: Mat.leather(), hip: Mat.leatherDark(), thigh: Mat.clothGreen(), shin: Mat.leatherDark(), boot: Mat.leatherDark(), arm: Mat.clothGreen(), fore: Mat.leather(), hand: Mat.leatherDark() },
  }, q);
  const { J } = rig;
  part(rig, J.spine, boxGeo(10.5, 3.2, 6.8), Mat.leatherDark(), [0, 3.4, 0.2], [1, 1, 1], [0, 0, 0], false); // belt line
  part(rig, J.hips, boxGeo(3, 3.4, 2), Mat.leather(), [6, -0.4, 1.5]);
  part(rig, J.hips, boxGeo(12, 7, 0.5), Mat.clothGreen(), [0, -3.4, 4.2], [1, 1, 1], [-0.08, 0, 0]);
  // crossed strap
  part(rig, J.spine, boxGeo(2.0, 20, 0.5), Mat.leatherDark(), [0, 9, 4.6], [1, 1, 1], [0, 0, 0.7], false);
  // scarf
  part(rig, J.chest, cylGeo(2.2, 4.0, 4.0, 8), Mat.clothRed(), [0, 0.6, 0]);
  const h = J.head;
  eyes(rig, h, 5.4, 4.6, 1.9, Mat.dark());
  part(rig, h, boxGeo(0.7, 0.4, 0.4), Mat.skinHuman(), [0, 4.2, 5.3], [1, 1, 1], [0, 0, 0], false);
  // hood
  part(rig, h, dome(6.1, 12, 8, PI * 0.62), Mat.clothGreen(), [0, 4.6, -0.4], [1, 1.02, 1.04], [-0.2, 0, 0]);
  part(rig, h, coneGeo(3.4, 9, 7), Mat.clothGreen(), [0, 6.0, -5.2], [1, 1, 1], [-1.9, 0, 0]);
  part(rig, h, boxGeo(10.8, 1.2, 1.0), Mat.clothGreen(), [0, 9.6, 3.6], [1, 1, 1], [0.25, 0, 0], false);
  quiver(rig, J.chest);
  for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; part(rig, J['shoulder' + s], sphGeo(3.6, 8, 6), Mat.leather(), [0, 0.6, 0], [1.1, 0.8, 1.1]); part(rig, J['knee' + s], boxGeo(4.4, 4.4, 2), Mat.leather(), [0, 0, 1.8]); void sg; }
  const b = mount(rig, 'L', bow(rig, true), { y: -1.5 });
  const cape = makeCape(rig, Mat.clothGreen(), 14, 15, 14, [0, 14.2, -4.9], 0.8);
  return { rig, cfg: { style: 'bow', extras: { cape }, idleL: [-0.9, -0.7, 0.1], idleR: [-0.1, -0.6, 0], stride: 0.06 }, wrist: b };
}

function mage(q) {
  const rig = buildHumanoid({
    bulk: 0.92,
    mats: { skin: Mat.skinHuman(), torso: Mat.clothPurple(), hip: Mat.clothPurple(), thigh: Mat.clothPurple(), shin: Mat.clothPurple(), boot: Mat.leatherDark(), arm: Mat.clothPurple(), fore: Mat.clothPurple(), hand: Mat.skinHuman() },
  }, q);
  const { J } = rig;
  // robe skirt (open cone) and sleeves cuffs
  const skirt = new THREE.CylinderGeometry(6.4, 11.5, 22, hi(q) ? 14 : 8, 1, true); skirt.translate(0, -11, 0); skirt.userData.shared = true;
  const sk = rig.mk(skirt, Mat.clothPurple(), J.hips); sk.scale.z = 0.9; sk.position.y = 1;
  const hem = rig.mk(new THREE.TorusGeometry(10.6, 0.5, 4, hi(q) ? 18 : 8), Mat.gold(), J.hips); hem; hem.rotation.x = PI / 2; hem.position.y = -21; hem.scale.y = 0.9;
  for (const s of ['L', 'R']) {
    part(rig, J['elbow' + s], coneGeo(4.4, 7, 8), Mat.clothPurple(), [0, -8, 0], [1, 1, 1], [PI, 0, 0]);
    part(rig, J['shoulder' + s], sphGeo(3.6, 8, 6), Mat.clothPurple(), [0, 0.5, 0], [1.1, 0.8, 1.1]);
  }
  part(rig, J.spine, cylGeo(2.4, 6.8, 6.8, 10), Mat.leatherDark(), [0, 2.2, 0], [1, 1, 0.74]);
  part(rig, J.spine, boxGeo(2.6, 2.6, 0.5), Mat.gold(), [0, 2.2, 5.0]);
  part(rig, J.spine, boxGeo(4, 5, 2), Mat.leather(), [6.6, 1, 2.4]);
  part(rig, J.chest, cylGeo(1.8, 4.2, 4.6, 8), Mat.clothCream(), [0, 0.8, 0]);
  // face, beard, hat
  const h = J.head;
  eyes(rig, h, 5.4, 4.6, 1.9, Mat.dark());
  part(rig, h, coneGeo(3.6, 9, 8), Mat.clothCream(), [0, 1.6, 3.6], [1, 1, 0.8], [0.18, 0, PI]);
  part(rig, h, cylGeo(1.2, 10.4, 10.4, 14), Mat.clothPurple(), [0, 8.6, 0], [1, 1, 1], [0.12, 0, 0]);
  part(rig, h, cylGeo(2, 5.8, 6.0, 12), Mat.clothPurple(), [0, 10.4, 0]);
  part(rig, h, cylGeo(0.9, 6.1, 6.1, 12), Mat.gold(), [0, 9.6, 0]);
  const tip = grp(h, [0, 11.4, 0], [-0.25, 0, 0]);
  part(rig, tip, coneGeo(5.0, 11, 10), Mat.clothPurple(), [0, 5, 0]);
  const tip2 = grp(tip, [0, 10.5, 0], [-0.7, 0, 0]);
  part(rig, tip2, coneGeo(2.4, 7, 8), Mat.clothPurple(), [0, 3, 0]);
  const st = staff(rig, Mat.orb(), 0xff8a3a);
  const sm = mount(rig, 'R', st.g, { y: -2 });
  const cape = makeCape(rig, Mat.clothCrimsonDark(), 12, 13, 12, [0, 14, -4.2], 0.9);
  return { rig, cfg: { style: 'cast', extras: { cape, update(ent, time) { st.glow.material.opacity = 0.75 + 0.25 * Math.sin(time * 5); st.glow.scale.setScalar(20 + 3 * Math.sin(time * 5)); } }, idleR: [-0.15, -0.5, 0], idleL: [-0.15, -0.5, 0] }, wrist: sm };
}
const hi = (q) => q === 'high';

function grunt(q) {
  const rig = buildHumanoid({
    bulk: 1.3, legScale: 0.86, armScale: 0.95, headScale: 1.0,
    mats: { skin: Mat.skinAsh(), torso: Mat.skinAsh(), hip: Mat.clothRag(), thigh: Mat.skinAsh(), shin: Mat.leatherDark(), boot: Mat.leatherDark(), arm: Mat.skinAsh(), fore: Mat.leatherDark(), hand: Mat.skinAsh() },
  }, q);
  const { J } = rig;
  // crossed leather straps with iron studs, belt
  part(rig, J.spine, boxGeo(2.4, 22, 0.6), Mat.leather(), [0, 8.5, 5.5], [1, 1, 1], [0, 0, 0.72], false);
  part(rig, J.spine, boxGeo(2.4, 22, 0.6), Mat.leather(), [0, 8.5, 5.55], [1, 1, 1], [0, 0, -0.72], false);
  part(rig, J.spine, cylGeo(3, 8.4, 8.4, 10), Mat.leatherDark(), [0, 1.8, 0], [1, 1, 0.74]);
  part(rig, J.spine, boxGeo(3.4, 3.2, 0.8), Mat.iron(), [0, 1.8, 6.3]);
  part(rig, J.hips, boxGeo(10, 9, 0.5), Mat.clothRag(), [0, -4, 5], [1, 1, 1], [-0.12, 0, 0]);
  for (const s of ['L', 'R']) { part(rig, J['shoulder' + s], sphGeo(4.2, 8, 6), Mat.leatherDark(), [0, 0.6, 0], [1.15, 0.8, 1.1]); part(rig, J['elbow' + s], cylGeo(3, 2.9, 2.9, 8), Mat.iron(), [0, -3.5, 0]); }
  // horned iron cap
  const h = J.head;
  eyes(rig, h, 5.2, 4.7, 2.0, Mat.eye(), 0.85);
  part(rig, h, boxGeo(5.2, 1.0, 0.8), Mat.dark(), [0, 3.0, 5.0], [1, 1, 1], [0, 0, 0], false);       // snarl
  part(rig, h, boxGeo(6.4, 1.0, 0.9), Mat.skinAsh(), [0, 6.6, 4.9], [1, 1, 1], [0.3, 0, 0], false);   // brow
  part(rig, h, dome(5.8, 12, 7, PI * 0.5), Mat.iron(), [0, 7.2, 0], [1, 1.1, 1.04]);
  part(rig, h, cylGeo(1.5, 5.9, 5.9, 12), Mat.iron(), [0, 7.2, 0], [1, 1, 1.04]);
  part(rig, h, boxGeo(1.2, 6, 0.8), Mat.iron(), [0, 4.8, 5.7]);
  for (const s of [-1, 1]) {
    const horn = grp(h, [s * 5.4, 9.2, 0], [0, 0, -s * 0.9]);
    part(rig, horn, coneGeo(1.7, 8, 7), Mat.bone(), [0, 3.6, 0], [1, 1, 1], [0, 0, -s * 0.35]);
    part(rig, horn, cylGeo(1.2, 1.8, 1.8, 7), Mat.iron(), [0, 0.4, 0]);
  }
  const cb = mount(rig, 'R', club(rig), { y: -2 });
  return { rig, cfg: { style: 'club', idleR: [-0.3, -1.0, 0], idleL: [-0.3, -0.7, 0], runRef: 80 }, wrist: cb };
}

function bowman(q) {
  const rig = buildHumanoid({
    bulk: 0.9, legScale: 0.98,
    mats: { skin: Mat.skinAsh(), torso: Mat.clothBlack(), hip: Mat.clothBlack(), thigh: Mat.clothBlack(), shin: Mat.leatherDark(), boot: Mat.leatherDark(), arm: Mat.clothBlack(), fore: Mat.leatherDark(), hand: Mat.leatherDark() },
  }, q);
  const { J } = rig;
  part(rig, J.spine, boxGeo(2, 20, 0.5), Mat.leather(), [0, 9, 4.6], [1, 1, 1], [0, 0, 0.7], false);
  part(rig, J.spine, cylGeo(2.4, 6.4, 6.4, 8), Mat.leatherDark(), [0, 2.2, 0], [1, 1, 0.74]);
  const h = J.head;
  // hood with a deep shadow: dark face sphere recessed inside, ember eyes
  part(rig, h, dome(6.2, 12, 9, PI * 0.7), Mat.clothBlack(), [0, 4.4, -0.2], [1.02, 1.06, 1.08], [-0.1, 0, 0]);
  part(rig, h, sphGeo(4.6, 10, 8), Mat.dark(), [0, 4.6, 1.7], [1, 1.05, 1]);
  part(rig, h, coneGeo(3.8, 8, 7), Mat.clothBlack(), [0, 6.2, -5.4], [1, 1, 1], [-1.95, 0, 0]);
  part(rig, h, boxGeo(10.8, 1.5, 1.2), Mat.clothBlack(), [0, 9.2, 3.8], [1, 1, 1], [0.3, 0, 0], false);
  for (const s of [-1, 1]) { part(rig, h, sphGeo(0.95, 7, 6), Mat.eye(), [s * 1.9, 5.0, 4.4], [1, 0.8, 0.5], [0, 0, 0], false); }
  const hs = glowSprite(0xff6a1a, 11, 0.9); hs.position.set(0, 5.0, 5.3); h.add(hs);
  for (const s of ['L', 'R']) { part(rig, J['shoulder' + s], sphGeo(3.4, 8, 6), Mat.clothBlack(), [0, 0.6, 0], [1.1, 0.85, 1.1]); }
  quiver(rig, J.chest);
  const b = mount(rig, 'L', bow(rig, false), { y: -1.5 });
  // ragged cloak
  const cape = makeCape(rig, Mat.clothBlack(), 13, 15, 14, [0, 14.2, -4.6], 0.75);
  return { rig, cfg: { style: 'bow', extras: { cape }, hunch: 0.14, idleL: [-0.9, -0.7, 0.1], idleR: [-0.1, -0.6, 0], runRef: 90 }, wrist: b };
}

function brute(q) {
  const rig = buildHumanoid({
    bulk: 1.75, legScale: 0.82, armScale: 1.15, headScale: 0.7,
    mats: { skin: Mat.skinOgre(), torso: Mat.skinOgre(), hip: Mat.leather(), thigh: Mat.skinOgre(), shin: Mat.leatherDark(), boot: Mat.leatherDark(), arm: Mat.skinOgre(), fore: Mat.skinOgre(), hand: Mat.skinOgre() },
  }, q);
  const { J } = rig;
  part(rig, J.spine, cylGeo(3.4, 12.6, 12.6, 10), Mat.leatherDark(), [0, 1.8, 0], [1, 1, 0.74]);
  part(rig, J.hips, boxGeo(14, 11, 0.8), Mat.leather(), [0, -5, 7.8], [1, 1, 1], [-0.1, 0, 0]);
  // skull trophies on belt
  for (const x of [-6, 0, 6]) { part(rig, J.spine, sphGeo(2.2, 7, 5), Mat.bone(), [x, 1.8, 8.4], [1, 1.1, 0.9]); part(rig, J.spine, sphGeo(0.5, 4, 4), Mat.dark(), [x - 0.7, 2.1, 10.2]); part(rig, J.spine, sphGeo(0.5, 4, 4), Mat.dark(), [x + 0.7, 2.1, 10.2]); }
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? 1 : -1;
    part(rig, J['shoulder' + s], sphGeo(6.2, 8, 6), Mat.leather(), [0, 1, 0], [1.1, 0.8, 1.1]);
    for (let i = 0; i < 3; i++) part(rig, J['shoulder' + s], coneGeo(1.1, 4, 5), Mat.bone(), [sg * (i - 1) * 2.4, 4.2, 0], [1, 1, 1], [0, 0, 0]);
    part(rig, J['elbow' + s], cylGeo(4, 4.6, 4.6, 8), Mat.leatherDark(), [0, -4.5, 0]);
    for (let i = 0; i < 3; i++) part(rig, J['elbow' + s], coneGeo(0.9, 2.6, 4), Mat.iron(), [sg * 4.6, -4.5 + (i - 1) * 2.4, 0], [1, 1, 1], [0, 0, -sg * PI / 2]);
  }
  // bone mask over a small head
  const h = J.head;
  part(rig, h, dome(4.8, 12, 8, PI * 0.78), Mat.skinOgre(), [0, 4.2, -0.4]);
  const mask = grp(h, [0, 4.6, 3.3], [0.08, 0, 0]);
  part(rig, mask, boxGeo(7.8, 7.6, 1.6), Mat.bone(), [0, 0, 0], [1, 1, 1]);
  part(rig, mask, boxGeo(7.4, 2.2, 1.2), Mat.bone(), [0, 3.8, 0.4], [1, 1, 1], [-0.3, 0, 0]);
  for (const s of [-1, 1]) {
    part(rig, mask, sphGeo(1.2, 7, 5), Mat.dark(), [s * 2.1, 1.2, 0.9], [1, 1.1, 0.6]);
    part(rig, mask, sphGeo(0.5, 5, 4), Mat.eye(), [s * 2.1, 1.1, 1.1], [1, 1, 0.6], [0, 0, 0], false);
    part(rig, mask, coneGeo(0.9, 4.2, 5), Mat.bone(), [s * 3.6, 4.6, 0.2], [1, 1, 1], [0, 0, -s * 0.6]);
    part(rig, mask, coneGeo(0.6, 3.4, 5), Mat.bone(), [s * 2.6, -4.6, 0.6], [1, 1, 1], [PI, 0, s * 0.15]);
  }
  for (let i = -2; i <= 2; i++) part(rig, mask, boxGeo(0.9, 1.2, 0.6), Mat.eyeWhite(), [i * 1.4, -2.3, 1.0]);
  part(rig, mask, boxGeo(0.8, 3, 0.6), Mat.dark(), [0, 0.3, 0.95]);
  const slab = grp(new THREE.Group());
  const cl = club(rig); cl.scale.setScalar(1.7);
  const cb = mount(rig, 'R', cl, { y: -3 });
  return { rig, cfg: { style: 'slam', idleR: [-0.15, -0.5, 0.05], idleL: [-0.15, -0.5, 0.05], hunch: 0.22, runRef: 55, stride: 0.07 }, wrist: cb, scale: 1.45, slab };
}

function regent(q) {
  const rig = buildHumanoid({
    bulk: 1.18, legScale: 1.08, armScale: 1.05, headScale: 1.0, shadow: 1.6,
    mats: { skin: Mat.blackPlate(), torso: Mat.blackPlate(), hip: Mat.clothCrimsonDark(), thigh: Mat.blackPlate(), shin: Mat.blackPlate(), boot: Mat.iron(), arm: Mat.blackPlate(), fore: Mat.blackPlate(), shoulder: Mat.blackPlate(), hand: Mat.iron(), head: Mat.blackPlate() },
  }, q);
  const { J } = rig;
  // layered plates & tassets
  part(rig, J.spine, boxGeo(14, 3, 8.2), Mat.iron(), [0, 2.2, 0], [1, 1, 1], [0, 0, 0]);
  for (const s of [-1, 1]) part(rig, J.hips, boxGeo(5, 10, 1.0), Mat.blackPlate(), [s * 4.4, -5.5, 4.6], [1, 1, 1], [-0.12, 0, s * 0.1]);
  part(rig, J.hips, boxGeo(10, 12, 0.5), Mat.clothCrimsonDark(), [0, -6.5, 4.2], [1, 1, 1], [-0.1, 0, 0]);
  part(rig, J.spine, sphGeo(2.9, 10, 8), Mat.gem(), [0, 11, 5.6], [1, 1, 0.55]);
  { const ring = part(rig, J.spine, new THREE.TorusGeometry(3.7, 0.7, 5, 14), Mat.gold(), [0, 11, 5.4], [1, 1, 0.7]); ring.geometry.userData.shared = false; }
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? 1 : -1;
    part(rig, J['shoulder' + s], dome(5.8, 10, 6, PI * 0.55), Mat.blackPlate(), [0, 1.4, 0], [1.2, 0.85, 1.15], [0, 0, sg * 0.3]);
    for (let i = 0; i < 3; i++) part(rig, J['shoulder' + s], coneGeo(1.2, 6 - i, 5), Mat.iron(), [sg * (1.2 + i * 2.2), 5 - i * 0.5, 0], [1, 1, 1], [0, 0, -sg * (0.25 + i * 0.35)]);
    part(rig, J['elbow' + s], sphGeo(3.3, 7, 5), Mat.blackPlate(), [0, 0, -0.6]);
    part(rig, J['knee' + s], coneGeo(2.2, 4, 6), Mat.iron(), [0, 0.4, 3.2], [1, 1, 1], [PI / 2, 0, 0]);
  }
  // crowned great helm
  const h = J.head;
  part(rig, h, cylGeo(9.4, 5.9, 5.7, 12), Mat.blackPlate(), [0, 5.0, 0], [0.97, 1, 1.03]);
  part(rig, h, dome(5.9, 12, 6, PI / 2), Mat.blackPlate(), [0, 9.7, 0], [0.97, 0.95, 1.03]);
  part(rig, h, boxGeo(8.8, 1.1, 0.9), Mat.eye(), [0, 6.0, 5.65], [1, 1, 1], [0, 0, 0], false);
  part(rig, h, boxGeo(0.9, 5, 0.9), Mat.dark(), [0, 3.2, 5.6], [1, 1, 1], [0, 0, 0], false);
  const hg = glowSprite(0xff5a10, 12); hg.position.set(0, 6.0, 6.5); h.add(hg);
  const crown = grp(h, [0, 12.2, 0]);
  part(rig, crown, cylGeo(2.0, 6.2, 6.2, 12), Mat.gold(), [0, 0, 0]);
  for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; const sp = part(rig, crown, coneGeo(1.0, i % 2 ? 4.2 : 6.4, 5), Mat.gold(), [Math.cos(a) * 5.8, 3.4, Math.sin(a) * 5.8], [1, 1, 1], [Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15]); void sp; part(rig, crown, sphGeo(0.7, 5, 4), Mat.gem(), [Math.cos(a) * 6.2, 0.2, Math.sin(a) * 6.2], [1, 1, 1], [0, 0, 0], false); }
  const aura = glowSprite(0xff4a10, 70, 0.28); aura.position.set(0, 24, 0); rig.body.add(aura);
  const ax = mount(rig, 'R', greataxe(rig), { y: -3, rotX: Math.PI / 2 - 0.15 });
  // second hand grips shaft: left forearm points to the shaft in idle via pose
  const cape = makeCape(rig, Mat.clothCrimsonDark(), 18, 22, 20, [0, 15, -5.6], 0.85);
  // ember motes
  const motes = [];
  for (let i = 0; i < 4; i++) { const s = glowSprite(0xff7a20, 5); rig.body.add(s); motes.push(s); }
  return {
    rig, wrist: ax, scale: 1.9,
    cfg: {
      style: 'slam', idleR: [-0.25, -0.9, 0.05], idleL: [-0.35, -1.1, 0.1], runRef: 70, stride: 0.05,
      extras: {
        cape,
        update(ent, time) {
          const en = ent.enraged;
          Mat.blackPlate().emissiveIntensity = en ? 1.7 + 0.5 * Math.sin(time * 9) : 0.8 + 0.2 * Math.sin(time * 3);
          aura.material.opacity = en ? 0.5 + 0.12 * Math.sin(time * 10) : 0.24; aura.scale.setScalar(en ? 110 : 70);
          aura.material.color.setHex(en ? 0xff2a08 : 0xff6a20);
          motes.forEach((m, i) => { const a = time * 1.3 + i * 1.57, k = (time * 0.5 + i * 0.25) % 1; m.position.set(Math.cos(a) * 11, 6 + k * 40, Math.sin(a) * 11); m.material.opacity = 1 - k; });
        },
      },
    },
  };
}

function wisp(q) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const meshes = [];
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(6.5, 1), Mat.flameCore()); core.geometry.userData.shared = false;
  const inner = new THREE.Mesh(sphGeo(3.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a0 })); inner.material.userData.shared = false;
  const matS = Mat.flame();
  body.add(core, inner);
  const tongues = [];
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(coneGeo(3.2, 15 + (i % 3) * 4, 6), matS);
    const a = i / 6 * PI * 2; t.position.set(Math.cos(a) * 3, 8 + (i % 2) * 2, Math.sin(a) * 3);
    t.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); t.userData.a = a; body.add(t); tongues.push(t);
  }
  const tail = [];
  for (let i = 1; i <= 3; i++) { const s = new THREE.Mesh(sphGeo(5 - i, 6, 5), matS); body.add(s); tail.push(s); }
  const glow = glowSprite(0xff6a10, 56, 0.55); body.add(glow);
  
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x401000 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(sphGeo(1.1, 6, 5), eyeM); e.position.set(s * 2.4, 1.2, 5.6); e.scale.set(1, 1.5, 0.5); body.add(e); }
  if (q !== 'high') { const sm = new THREE.MeshBasicMaterial({ map: Tex.ember(), transparent: true, opacity: 0.0 }); void sm; }
  let cur = false;
  return {
    root,
    update(e, dt, time) {
      const hover = 20 + Math.sin(time * 4 + e.id) * 3.5;
      body.position.y = hover; body.rotation.y = time * 1.2;
      const fl = 1 + 0.12 * Math.sin(time * 18 + e.id) + (e.state === 'windup' ? 0.35 * e.atkT : 0);
      core.scale.setScalar(fl); core.rotation.set(time * 2, time * 3, 0);
      tongues.forEach((t, i) => { t.scale.set(1, 1 + 0.3 * Math.sin(time * 10 + i * 1.7), 1); t.rotation.x = Math.sin(t.userData.a) * 0.35 + Math.sin(time * 6 + i) * 0.14; });
      tail.forEach((t, i) => { t.position.set(0, -4 - i * 4.5, -4 - i * 3); });
      glow.scale.setScalar(52 + 8 * Math.sin(time * 9 + e.id));
      if (e.dead) { const k = Math.min(1, e.deadT / 0.5); body.scale.setScalar(Math.max(0.01, 1 - k)); body.position.y = hover + k * 18; glow.material.opacity = 0.55 * (1 - k); } else { body.scale.setScalar(1); glow.material.opacity = 0.55; }
    },
    flash(on) { if (on === cur) return; cur = on; core.material = on ? flashMat : Mat.flameCore(); },
  };
}

const BUILD = { knight, ranger, mage, grunt, bowman, brute, regent };

export function createCharacter(kind, quality = 'high') {
  if (kind === 'wisp') return wisp(quality);
  const b = BUILD[kind](quality);
  const { rig } = b;
  mergeStatics(rig);
  const root = rig.root;
  if (b.scale) root.scale.setScalar(b.scale);
  const anim = createAnimator(rig, b.cfg);
  const isPlayerKind = kind === 'knight' || kind === 'ranger' || kind === 'mage';
  const wrapper = new THREE.Group();
  wrapper.add(root);
  let cur = false;
  return {
    root: wrapper,
    update(ent, dt, time, game) {
      const wrapperScale = 1; void wrapperScale;
      anim.apply(ent, dt, time, isPlayerKind);
    },
    flash(on) {
      if (on === cur) return; cur = on;
      for (const m of rig.meshes) m.material = on ? flashMat : m.userData.m;
    },
  };
}

// The captive heir: a kneeling, bound figure (static pose) for the Throne Hall.
export function createHeir(quality = 'high') {
  const rig = buildHumanoid({
    bulk: 0.86, legScale: 0.9, armScale: 0.9, headScale: 1.05,
    mats: { skin: Mat.skinHuman(), torso: Mat.clothBlue(), hip: Mat.clothBlue(), thigh: Mat.clothCream(), shin: Mat.clothCream(), boot: Mat.leatherDark(), arm: Mat.clothBlue(), fore: Mat.clothBlue(), hand: Mat.skinHuman() },
  }, quality);
  const { J } = rig;
  part(rig, J.spine, boxGeo(10, 14, 0.5), Mat.heraldry(), [0, 9, 5.2]);
  eyes(rig, J.head, 5.4, 4.6, 1.9, Mat.dark());
  part(rig, J.head, cylGeo(1.4, 5.5, 5.5, 10), Mat.gold(), [0, 9.6, 0]);
  for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; part(rig, J.head, coneGeo(0.7, 2.4, 4), Mat.gold(), [Math.cos(a) * 5.3, 11.4, Math.sin(a) * 5.3]); }
  // kneeling, head bowed, hands bound behind
  J.hips.position.y = 12.5;
  for (const s of ['L', 'R']) { J['thigh' + s].rotation.x = -1.5; J['knee' + s].rotation.x = 2.5; J['shoulder' + s].rotation.x = 0.7; J['elbow' + s].rotation.x = -0.4; }
  J.spine.rotation.x = 0.1; J.head.rotation.x = 0.35;
  const chain = rig.mk(new THREE.TorusGeometry(2.5, 0.35, 4, 10), Mat.iron(), J.spine); chain.geometry.userData.shared = false; chain.position.set(0, 3, -5.5);
  const root = new THREE.Group(); root.add(rig.root); rig.root.scale.setScalar(0.9);
  return { root, update() {}, flash() {} };
}
