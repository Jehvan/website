// Jointed humanoid rig (hips/knees, shoulders/elbows) + animation driven by sim state.
// Local axes: +Z forward, +Y up, +X is the character's LEFT. Weapon hand is the right hand (-X).
import * as THREE from 'three';
import { Mat, flashMat } from './materials.js';
import { discTexture } from './textures.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const geoCache = new Map();
const G = (key, make) => { if (!geoCache.has(key)) { const g = make(); g.userData.shared = true; geoCache.set(key, g); } return geoCache.get(key); };

// limb hanging down from its pivot (y from 0 to -len)
export const limbGeo = (len, r0, r1, seg = 8) => G(`limb${len}_${r0}_${r1}_${seg}`, () => { const g = new THREE.CylinderGeometry(r0, r1, len, seg); g.translate(0, -len / 2, 0); return g; });
export const cylGeo = (h, r0, r1, seg = 8) => G(`cyl${h}_${r0}_${r1}_${seg}`, () => new THREE.CylinderGeometry(r0, r1, h, seg));
export const sphGeo = (r, w = 10, h = 8) => G(`sph${r}_${w}_${h}`, () => new THREE.SphereGeometry(r, w, h));
export const boxGeo = (x, y, z) => G(`box${x}_${y}_${z}`, () => new THREE.BoxGeometry(x, y, z));
export const dome = (r, w, h, theta) => G(`dome${r}_${w}_${h}_${theta}`, () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, theta));
export const coneGeo = (r, h, seg = 8) => G(`cone${r}_${h}_${seg}`, () => new THREE.ConeGeometry(r, h, seg));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

/**
 * Build a humanoid. Returns { root, J, meshes, add(mesh) ... }.
 * spec: { bulk, legScale, armScale, mats:{skin,torso,hip,arm,fore,thigh,shin,boot,hand}, hi (detail), name }
 */
export function buildHumanoid(spec, quality) {
  const hi = quality === 'high';
  const seg = hi ? 10 : 7;
  const b = spec.bulk || 1, ls = spec.legScale || 1, as = spec.armScale || 1;
  const M = spec.mats;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);      // animated body (leans, falls)
  const meshes = [];
  const mk = (geo, mat, parent, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow && hi; m.userData.m = mat;
    meshes.push(m); parent.add(m); return m;
  };
  const piv = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const legH = 26 * ls;
  const hips = piv(body, 0, legH, 0);
  const pelvis = mk(cylGeo(6, 6.4 * b, 6.0 * b, seg), M.hip, hips); pelvis.scale.z = 0.72; pelvis.position.y = 0.5;
  const spine = piv(hips, 0, 2.5, 0);
  const torso = mk(cylGeo(17, 8.3 * b, 6.3 * b, seg), M.torso, spine); torso.scale.z = 0.62; torso.position.y = 8.5;
  const chest = piv(spine, 0, 17, 0);
  const neck = mk(cylGeo(3, 1.9 * Math.max(1, b * 0.85), 2.1 * Math.max(1, b * 0.9), 6), M.skin, chest, false); neck.position.y = 1.2;
  const head = piv(chest, 0, 3.6, 0);
  const skull = mk(sphGeo(5.2 * (spec.headScale || 1), hi ? 14 : 8, hi ? 10 : 6), M.head || M.skin, head); skull.position.y = 4.8 * (spec.headScale || 1); skull.scale.set(0.94, 1.05, 1);

  const J = { hips, spine, chest, head, skull, torso, pelvis };
  const sideSign = { L: 1, R: -1 };
  for (const side of ['L', 'R']) {
    const s = sideSign[side];
    // legs
    const thigh = piv(hips, s * 3.9 * b, -0.5, 0);
    mk(limbGeo(13 * ls, 3.6 * b, 2.7 * b, seg), M.thigh, thigh);
    const knee = piv(thigh, 0, -13 * ls, 0);
    if (hi) mk(sphGeo(2.7 * b, 8, 6), M.thigh, knee, false);
    mk(limbGeo(13 * ls, 2.7 * b, 2.0 * b, seg), M.shin, knee);
    const ankle = piv(knee, 0, -13 * ls, 0);
    const foot = mk(boxGeo(3.8 * b, 3.2, 8), M.boot, ankle); foot.position.set(0, -1.2, 1.9);
    J['thigh' + side] = thigh; J['knee' + side] = knee; J['foot' + side] = foot;
    // arms
    const sh = piv(spine, s * (8.2 * b + 1.8), 14.8, 0);
    if (hi || M.shoulder) mk(sphGeo(3.2 * b, 8, 6), M.shoulder || M.arm, sh);
    mk(limbGeo(9.5 * as, 2.7 * b, 2.2 * b, seg), M.arm, sh);
    const elbow = piv(sh, 0, -9.5 * as, 0);
    if (hi) mk(sphGeo(2.3 * b, 7, 5), M.arm, elbow, false);
    mk(limbGeo(9 * as, 2.25 * b, 1.8 * b, seg), M.fore, elbow);
    const wrist = piv(elbow, 0, -9 * as, 0);
    mk(sphGeo(2.1 * b, 7, 5), M.hand || M.skin, wrist, hi);
    J['shoulder' + side] = sh; J['elbow' + side] = elbow; J['wrist' + side] = wrist;
  }
  // blob shadow for low quality
  if (!hi) {
    const sm = new THREE.MeshBasicMaterial({ map: discTexture(), transparent: true, depthWrite: false, fog: false }); sm.userData.shared = true;
    const bs = new THREE.Mesh(new THREE.PlaneGeometry(26 * (spec.shadow || 1), 26 * (spec.shadow || 1)), sm); bs.geometry.userData.shared = false;
    bs.rotation.x = -Math.PI / 2; bs.position.y = 0.6; root.add(bs);
  }
  return { root, body, J, meshes, mk, piv, hi, seg, legH, b, spec };
}

// Hand helper: attach a weapon group (modelled along +Y, grip at origin) to the wrist.
export function mount(rig, side, obj, { rotX = Math.PI / 2, y = -1.2, rotZ = 0 } = {}) {
  const g = new THREE.Group();
  g.position.y = y; g.rotation.x = rotX; g.rotation.z = rotZ;
  g.add(obj);
  rig.J['wrist' + side].add(g);
  return g;
}

/* ---------------- animation ---------------- */

export function createAnimator(rig, cfg) {
  const J = rig.J;
  const st = {
    phase: Math.random() * 6, mv: 0, lx: null, ly: null, state: '', stateT: 0, time: 0,
    capeA: 0, hitK: 0, spin: 0, lastAnim: '', animT: 0,
  };
  const baseHipY = J.hips.position.y;
  const ext = cfg.extras || {};

  function apply(ent, dt, time, isPlayer) {
    // ---- derive motion ----
    if (st.lx === null) { st.lx = ent.x; st.ly = ent.y; }
    const spd = dt > 0 ? Math.hypot(ent.x - st.lx, ent.y - st.ly) / dt : 0;
    st.lx = ent.x; st.ly = ent.y;
    const target = clamp(spd / (cfg.runRef || 110), 0, 1.4);
    st.mv += (target - st.mv) * clamp(dt * 12, 0, 1);
    const mv = st.mv;
    st.phase += dt * (3.2 + spd * (cfg.stride || 0.052)) * (mv > 0.05 ? 1 : 0.3);
    const ph = st.phase;
    if (ent.state !== st.state) { st.state = ent.state; st.stateT = 0; }
    st.stateT += dt;

    // ---- reset pose ----
    const r = (j, x = 0, y = 0, z = 0) => j.rotation.set(x, y, z);
    r(rig.body); rig.body.position.set(0, 0, 0);
    r(J.hips); J.hips.position.y = baseHipY;
    r(J.spine); r(J.chest); r(J.head);
    const walkBlend = mv;
    // legs
    const A = 0.78 * walkBlend;
    r(J.thighL, Math.sin(ph) * A); r(J.thighR, -Math.sin(ph) * A);
    r(J.kneeL, 0.12 + Math.max(0, -Math.cos(ph)) * 1.0 * walkBlend); r(J.kneeR, 0.12 + Math.max(0, Math.cos(ph)) * 1.0 * walkBlend);
    J.hips.position.y = baseHipY - 0.5 + Math.abs(Math.sin(ph)) * 1.4 * walkBlend;
    J.hips.rotation.y = Math.sin(ph) * 0.1 * walkBlend;
    J.spine.rotation.y = -Math.sin(ph) * 0.12 * walkBlend; J.spine.rotation.x = 0.08 * walkBlend + (cfg.hunch || 0);
    // arms (idle)
    const breath = Math.sin(time * 2.1 + st.phase * 0.0) * 0.03;
    const idleR = cfg.idleR || [-0.3, -0.9, 0], idleL = cfg.idleL || [-0.1, -0.5, 0];
    r(J.shoulderR, idleR[0] + Math.sin(ph) * 0.55 * walkBlend + breath, 0, -idleR[2]);
    r(J.elbowR, idleR[1] - 0.2 * walkBlend);
    r(J.shoulderL, idleL[0] - Math.sin(ph) * 0.55 * walkBlend - breath, 0, idleL[2]);
    r(J.elbowL, idleL[1] - 0.2 * walkBlend);
    J.chest.scale.y = 1 + Math.sin(time * 2.1) * 0.012;
    J.head.rotation.x = -0.06 * walkBlend; J.head.rotation.y = Math.sin(time * 0.7 + st.phase) * 0.05 * (1 - walkBlend);

    // ---- action poses ----
    let strike = 0, wind = 0, k = 0;
    const style = cfg.style;
    const dead = ent.dead;
    // collect action phase
    let skill = isPlayer ? ent.skillAnim : null;
    if (isPlayer) {
      if (ent.atkT >= 0 && !skill) strike = ent.atkT;
    } else {
      if (ent.state === 'windup') wind = clamp(ent.atkT, 0, 1);
      else if (ent.state === 'recover' && st.stateT < 0.3 && st.prevWind) strike = st.stateT / 0.3;
      if (ent.state === 'windup') st.prevWind = true; else if (ent.state !== 'recover') st.prevWind = false;
      // boss states
      if (ent.type === 'regent') {
        const a = ent.state;
        if (a === 'slam' || a === 'orbs' || a === 'summon' || a === 'charge') wind = clamp(ent.atkT, 0, 1), st.bossAct = a, st.prevWind = true;
        if (a === 'recover' && st.stateT < 0.35 && st.prevWind) strike = st.stateT / 0.35;
        if (a === 'idle') st.prevWind = false;
      }
    }
    const act = ent.type === 'regent' ? (st.bossAct || 'slam') : '';

    const swing = (x0, x1, kk) => lerp(x0, x1, ease(clamp(kk, 0, 1)));
    if (!dead) {
      if (isPlayer && skill) {
        const t = ent.skillT;
        skillPose(skill, t, time);
      } else if (style === 'slash') { // knight sword
        if (strike > 0 || (isPlayer && ent.atkT >= 0)) {
          const kk = isPlayer ? ent.atkT : strike;
          r(J.shoulderR, swing(-2.1, -0.9, kk), 0, -swing(0.5, -0.3, kk)); r(J.elbowR, swing(-0.7, -0.15, kk));
          J.spine.rotation.y += swing(0.95, -0.95, kk); J.spine.rotation.x += 0.12; J.hips.rotation.y += swing(0.4, -0.4, kk);
          r(J.shoulderL, -0.9, 0, 0.3);
          rig.body.position.z = Math.sin(kk * Math.PI) * 2.5;
        }
      } else if (style === 'club') { // grunt: overhead chop
        if (wind > 0) { r(J.shoulderR, swing(-0.3, -2.8, wind), 0, 0); r(J.elbowR, swing(-0.9, -0.5, wind)); J.spine.rotation.x = swing(0, -0.28, wind); r(J.shoulderL, swing(-0.1, -0.9, wind), 0, 0.3); }
        else if (strike > 0) { r(J.shoulderR, swing(-2.8, 0.1, strike), 0, 0); r(J.elbowR, swing(-0.5, -0.25, strike)); J.spine.rotation.x = swing(-0.28, 0.55, strike); r(J.shoulderL, -0.5, 0, 0.3); rig.body.position.z = 3 * ease(strike); }
      } else if (style === 'bow') {
        const drawK = isPlayer ? 0 : wind;
        if (wind > 0 || strike > 0) {
          const dk = wind > 0 ? wind : 1 - strike * 1.2;
          r(J.shoulderL, -1.55, 0, 0.05); r(J.elbowL, -0.05);
          r(J.shoulderR, -1.45 * clamp(dk * 1.3, 0, 1), 0, -0.1); r(J.elbowR, swing(-0.2, -2.25, dk));
          J.spine.rotation.y = 0.5; J.head.rotation.y = -0.4; J.spine.rotation.x = 0;
        } else if (isPlayer && ent.atkT >= 0) {
          const kk = ent.atkT; const dk = kk < 0.7 ? kk / 0.7 : 1 - (kk - 0.7) / 0.3 * 0.9;
          r(J.shoulderL, -1.55, 0, 0.05); r(J.elbowL, -0.05); r(J.shoulderR, -1.45 * clamp(dk * 1.3, 0, 1), 0, -0.1); r(J.elbowR, swing(-0.2, -2.25, dk));
          J.spine.rotation.y = 0.5; J.head.rotation.y = -0.4;
        }
        void drawK;
      } else if (style === 'cast') { // mage staff
        if (isPlayer && ent.atkT >= 0) {
          const kk = ent.atkT;
          r(J.shoulderR, swing(-2.2, -1.35, kk), 0, -0.25); r(J.elbowR, swing(-0.6, -0.15, kk)); r(J.shoulderL, swing(-1.0, -1.5, kk), 0, 0.3); r(J.elbowL, -0.3);
          J.spine.rotation.x = swing(-0.12, 0.2, kk);
        }
      } else if (style === 'slam') { // brute, boss
        const k2 = wind > 0 ? wind : 0;
        if (wind > 0) {
          if (act === 'orbs' || act === 'summon') { r(J.shoulderR, swing(-0.3, -2.9, k2), 0, -0.35); r(J.shoulderL, swing(-0.1, -2.7, k2), 0, 0.35); r(J.elbowR, -0.3); r(J.elbowL, -0.3); J.spine.rotation.x = swing(0, -0.3, k2); J.head.rotation.x = -0.3 * k2; }
          else if (act === 'charge') { J.spine.rotation.x = swing(0, 0.55, k2); rig.body.position.y = -3 * k2; r(J.shoulderR, swing(-0.3, 0.9, k2)); r(J.shoulderL, swing(-0.1, 0.9, k2)); }
          else { r(J.shoulderR, swing(-0.3, -3.0, k2), 0, -0.18); r(J.shoulderL, swing(-0.1, -2.9, k2), 0, 0.18); r(J.elbowR, swing(-0.9, -0.4, k2)); r(J.elbowL, swing(-0.6, -0.4, k2)); J.spine.rotation.x = swing(0, -0.4, k2); }
        } else if (strike > 0) {
          r(J.shoulderR, swing(-3.0, -0.1, strike), 0, -0.1); r(J.shoulderL, swing(-2.9, -0.1, strike), 0, 0.1); r(J.elbowR, -0.3); r(J.elbowL, -0.3);
          J.spine.rotation.x = swing(-0.4, 0.6, strike); rig.body.position.y = -3 * Math.sin(strike * Math.PI); rig.body.position.z = 5 * ease(strike);
        }
        if (act === 'charge' && ent.state === 'charge' && ent.chargePhase === 1) { J.spine.rotation.x = 0.6; r(J.shoulderR, 0.9); r(J.shoulderL, 0.9); J.thighL.rotation.x = Math.sin(time * 28) * 0.9; J.thighR.rotation.x = -Math.sin(time * 28) * 0.9; }
      } else if (style === 'bowman') { /* handled by bow */ }
    }

    function skillPose(name, t, tm) {
      const prog = (dur) => 1 - clamp(t / dur, 0, 1);
      switch (name) {
        case 'rush': r(J.shoulderL, -1.1, 0, 0.2); r(J.elbowL, -0.9); r(J.shoulderR, 0.8, 0, -0.1); r(J.elbowR, -0.3); J.spine.rotation.x = 0.55; rig.body.position.z = 4; J.thighL.rotation.x = Math.sin(tm * 30) * 0.9; J.thighR.rotation.x = -Math.sin(tm * 30) * 0.9; break;
        case 'whirl': st.spin += 0.5; rig.body.rotation.y = tm * 18; r(J.shoulderR, -1.45, 0, -0.9); r(J.shoulderL, -1.4, 0, 0.9); r(J.elbowR, -0.1); r(J.elbowL, -0.1); J.spine.rotation.x = 0.1; break;
        case 'rally': { const k3 = Math.sin(prog(0.5) * Math.PI); r(J.shoulderR, -2.6 * k3 - 0.3, 0, -0.3); r(J.shoulderL, -2.4 * k3 - 0.1, 0, 0.3); J.head.rotation.x = -0.4 * k3; J.spine.rotation.x = -0.2 * k3; break; }
        case 'volley': r(J.shoulderL, -1.55, 0, 0.05); r(J.elbowL, -0.05); r(J.shoulderR, -1.45, 0, -0.1); r(J.elbowR, -2.25 + prog(0.3) * 1.8); J.spine.rotation.y = 0.5; J.head.rotation.y = -0.4; break;
        case 'tumble': { const kk = prog(0.4); rig.body.rotation.x = kk * Math.PI * 2; rig.body.position.y = 14 * Math.sin(kk * Math.PI) + 8; J.thighL.rotation.x = -1.4; J.thighR.rotation.x = -1.4; J.kneeL.rotation.x = 1.6; J.kneeR.rotation.x = 1.6; r(J.shoulderR, -1.6, 0, -0.2); r(J.shoulderL, -1.6, 0, 0.2); r(J.elbowR, -1.5); r(J.elbowL, -1.5); break; }
        case 'nova': { const kk = Math.sin(prog(0.45) * Math.PI); r(J.shoulderR, -0.5, 0, -1.3 * kk); r(J.shoulderL, -0.5, 0, 1.3 * kk); r(J.elbowR, -0.3); r(J.elbowL, -0.3); J.head.rotation.x = -0.25 * kk; rig.body.position.y = 3 * kk; break; }
        case 'blink': { const kk = prog(0.3); rig.body.scale.set(1 - 0.25 * Math.sin(kk * Math.PI), 1 + 0.15 * Math.sin(kk * Math.PI), 1 - 0.25 * Math.sin(kk * Math.PI)); r(J.shoulderR, -1.0, 0, -0.5); r(J.shoulderL, -1.0, 0, 0.5); break; }
        case 'cast': { const kk = Math.sin(prog(0.5) * Math.PI * 0.9); r(J.shoulderR, -2.9 * kk - 0.3, 0, -0.2); r(J.shoulderL, -2.5 * kk - 0.1, 0, 0.3); J.head.rotation.x = -0.35 * kk; J.spine.rotation.x = -0.2 * kk; break; }
        default: break;
      }
    }
    if (skill !== 'blink') rig.body.scale.set(1, 1, 1);

    // ---- hit / death ----
    const hk = isPlayer ? ent.hitT / 0.22 : ent.hitT / 0.16;
    if (hk > 0 && !dead) { rig.body.rotation.x += -0.28 * clamp(hk, 0, 1); rig.body.position.z -= 2 * clamp(hk, 0, 1); }
    if (dead) {
      const kd = clamp(ent.deadT / 0.55, 0, 1), e2 = ease(kd);
      r(rig.body, -1.5 * e2); rig.body.position.y = 5.5 * e2; rig.body.position.z = -8 * e2;
      r(J.shoulderL, -0.4 * e2, 0, 1.2 * e2); r(J.shoulderR, -0.2 * e2, 0, -1.2 * e2); J.kneeL.rotation.x = 0.4 * e2; J.kneeR.rotation.x = 0.6 * e2;
    }

    // ---- extras: capes etc ----
    if (ext.cape) {
      const c = ext.cape;
      const fl = 0.15 + 0.55 * mv + Math.sin(time * 5 + ph) * 0.05 * (0.4 + mv);
      c.upper.rotation.x = fl * 0.7; c.lower.rotation.x = fl * 0.5 + Math.sin(time * 7 + ph * 1.3) * 0.12 * mv;
      c.upper.rotation.z = Math.sin(ph * 0.5) * 0.05 * mv;
    }
    if (ext.update) ext.update(ent, time, mv, dt);
  }
  return { apply, st };
}

/**
 * Merge static meshes that share a parent joint and a material into one mesh (cuts draw calls ~2x).
 * Skips multi-material meshes. Rebuilds rig.meshes so hit-flash keeps working.
 */
export function mergeStatics(rig) {
  const groups = new Set();
  for (const m of rig.meshes) if (m.parent) groups.add(m.parent);
  const keep = [];
  for (const parent of groups) {
    const byMat = new Map();
    for (const child of [...parent.children]) {
      if (!child.isMesh || Array.isArray(child.material) || child.userData.noMerge) { if (child.isMesh) keep.push(child); continue; }
      if (!byMat.has(child.material)) byMat.set(child.material, []);
      byMat.get(child.material).push(child);
    }
    for (const [mat, list] of byMat) {
      if (list.length < 2) { keep.push(list[0]); continue; }
      const geos = list.map((m) => { m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); return g; });
      const mixed = geos.some((g) => !g.index) && geos.some((g) => g.index);
      const src = mixed ? geos.map((g) => (g.index ? g.toNonIndexed() : g)) : geos;
      const merged = BufferGeometryUtils.mergeBufferGeometries(src, false);
      geos.forEach((g) => g.dispose()); if (mixed) src.forEach((g) => g.dispose());
      if (!merged) { keep.push(...list); continue; }
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = list.some((m) => m.castShadow); mesh.userData.m = mat;
      list.forEach((m) => parent.remove(m));
      parent.add(mesh); keep.push(mesh);
    }
  }
  rig.meshes.length = 0; rig.meshes.push(...keep);
}
