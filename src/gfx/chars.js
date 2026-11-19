// A KayKit character in the world: cloned skinned model, reshaped proportions, animation state machine driven
// by the simulation, hit flash, target ring and hover highlight.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { getGLTF, S, wx, wz, yaw } from './assets.js';
import { CHARS } from './catalog.js';
import { CLASSES } from '../data.js';
import { groundDecal } from './fx.js';

const clipCache = new Map();
// model heights in metres as authored (measured in Blender), so characters can be normalised reliably
const NATIVE = { Knight: 2.45, Mage: 2.7, Rogue_Hooded: 2.25, Rogue: 2.19, Barbarian: 2.39, Skeleton_Minion: 2.17, Skeleton_Rogue: 2.29, Skeleton_Mage: 2.61, Skeleton_Warrior: 2.57 };

function clipsFor(file, gltf) {
  if (clipCache.has(file)) return clipCache.get(file);
  const m = {};
  for (const c of gltf.animations) {
    const clip = c.clone();
    clip.tracks = clip.tracks.filter((t) => !t.name.endsWith('.scale'));     // proportions are ours
    m[c.name] = clip;
  }
  clipCache.set(file, m);
  return m;
}

const ONCE = new Set(['death', 'spawn']);

export class Character {
  constructor(kind, parent) {
    const spec = CHARS[kind];
    this.kind = kind; this.spec = spec;
    this.root = new THREE.Group();
    parent.add(this.root);
    const gltf = getGLTF(spec.file);
    this.ok = !!gltf;
    if (!gltf) return;
    this.model = SkeletonUtils.clone(gltf.scene);
    this.mats = [];
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      o.material = o.material.clone();
      o.material.roughness = 0.82; o.material.metalness = 0.0;
      if (spec.tint) o.material.color.multiply(new THREE.Color(spec.tint));
      this.mats.push(o.material);
    });
    // reshape: smaller head, longer legs and torso
    const sh = spec.shape || {};
    const bone = (n) => this.model.getObjectByName(n);
    if (sh.head) bone('head')?.scale.setScalar(sh.head);
    if (sh.leg) for (const n of ['upperlegl', 'upperlegr', 'lowerlegl', 'lowerlegr']) bone(n)?.scale.set(1, sh.leg, 1);
    if (sh.torso) for (const n of ['spine', 'chest']) bone(n)?.scale.set(1, sh.torso, 1);
    const stretch = 1 + ((sh.leg || 1) - 1) * 0.42 + ((sh.torso || 1) - 1) * 0.3 - (1 - (sh.head || 1)) * 0.3;
    this.model.scale.setScalar(spec.height / ((NATIVE[spec.file.split('/')[1].replace('.glb', '')] || 2.4) * stretch));
    this.root.add(this.model);
    this.shadow = groundDecal('shadow', 0xffffff, 0.9, false);
    this.shadow.scale.setScalar(spec.height * 0.6); this.shadow.position.y = 0.03;
    this.root.add(this.shadow);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = clipsFor(spec.file, gltf);
    this.actions = {};
    this.cur = null; this.curName = '';
    this.oneT = 0; this.atkIdx = 0; this.lastAtk = -1; this.flash = 0; this.yawNow = 0; this.last = null;
    this.radius = 0.5;
    this.play(spec.anims.idle, 1, 0);
  }

  has(name) { return !!this.clips?.[name]; }

  play(name, speed = 1, fade = 0.15, restart = false, once = false) {
    if (!this.ok || !this.clips[name]) return false;
    let a = this.actions[name];
    if (!a) { a = this.actions[name] = this.mixer.clipAction(this.clips[name]); }
    if (this.curName === name && !restart) { a.timeScale = speed; return true; }
    a.reset(); a.timeScale = speed;
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
    if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, fade, false);
    a.play();
    this.cur = a; this.curName = name;
    return true;
  }

  /** Play a clip once, stretched to last `dur` seconds. */
  oneShot(name, dur, fade = 0.08) {
    if (!this.has(name)) return;
    const len = this.clips[name].duration;
    this.play(name, Math.min(4, Math.max(0.4, len / Math.max(0.05, dur))), fade, true, true);
    this.oneT = dur;
  }

  face(target, dt, rate = 14) {
    let d = target - this.yawNow;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yawNow += d * (1 - Math.exp(-rate * dt));
    this.root.rotation.y = this.yawNow;
  }

  speedOf(x, z, dt) {
    if (!this.last) this.last = { x, z };
    const v = dt > 0 ? Math.hypot(x - this.last.x, z - this.last.z) / dt : 0;
    this.last.x = x; this.last.z = z;
    return v;
  }

  setFlash(v, color = 0xffe8c8) {
    if (Math.abs(v - this.flash) < 0.02) return;
    this.flash = v;
    for (const m of this.mats) { m.emissive.setHex(color); m.emissiveIntensity = v; }
  }

  setTargeted(on, t) {
    if (on && !this.ring) { this.ring = groundDecal('ring', 0xff3018, 1); this.ring.position.y = 0.06; this.root.add(this.ring); }
    if (this.ring) { this.ring.visible = on; if (on) { this.ring.scale.setScalar(this.radius * 3.2 * (1 + Math.sin(t * 6) * 0.05)); this.ring.rotation.y = t * 0.7 - this.yawNow; } }
  }

  setHovered(on) {
    if (on === this.hovered) return;
    this.hovered = on;
    if (on && !this.hover) { this.hover = groundDecal('ring', 0xffd080, 0.8); this.hover.position.y = 0.05; this.root.add(this.hover); }
    if (this.hover) { this.hover.visible = on; this.hover.scale.setScalar(this.radius * 2.8); }
  }

  // ---------------------------------------------------------------- hero
  updateHero(p, cls, dt) {
    if (!this.ok) return;
    const x = wx(p.x), z = wz(p.y), an = this.spec.anims;
    this.root.position.set(x, 0, z);
    const v = this.speedOf(x, z, dt);
    this.mixer.update(dt);
    this.face(yaw(p.face), dt, p.dash ? 30 : 14);
    this.setFlash(p.hitT > 0.12 ? 0.9 : 0, 0xff5040);
    if (p.dead) { if (this.curName !== an.death) this.play(an.death, 1, 0.1, true, true); return; }
    this.oneT -= dt;
    if (p.skillAnim) {
      const clip = { rush: 'Block', whirl: '2H_Melee_Attack_Spinning', rally: 'Cheer', volley: '2H_Ranged_Shoot', tumble: 'Dodge_Backward', nova: 'Spellcast_Raise', blink: 'Spellcast_Shoot', cast: 'Spellcast_Long' }[p.skillAnim];
      if (clip && this.curName !== clip) { if (p.skillAnim === 'whirl') this.play(clip, 1.5, 0.08, true); else this.oneShot(clip, Math.max(0.35, p.skillT)); }
      this.lastAtk = p.atkT;
      return;
    }
    if (p.atkT >= 0 && (this.lastAtk < 0 || p.atkT < this.lastAtk)) {
      const list = this.spec.attacks;
      this.oneShot(list[this.atkIdx++ % list.length], Math.max(0.3, CLASSES[cls].attack.cd * 1.05));
    }
    this.lastAtk = p.atkT;
    if (this.oneT > 0) return;
    if (v > 0.6) this.play(an.run, Math.min(1.8, Math.max(0.6, v / this.spec.runRef)), 0.12);
    else this.play(an.idle, 1, 0.2);
  }

  // ---------------------------------------------------------------- enemies
  updateEnemy(e, dt, t) {
    if (!this.ok) return;
    const an = this.spec.anims;
    const hover = this.spec.hover && !e.dead ? 0.45 + Math.sin(t * 3 + e.id) * 0.15 : 0;
    const x = wx(e.x), z = wz(e.y);
    const v = this.speedOf(x, z, dt);
    this.mixer.update(dt);
    this.setFlash(e.hitT > 0.08 ? 1.2 : 0);
    if (e.dead) {
      if (this.curName !== an.death) this.play(an.death, 1.15, 0.08, true, true);
      this.root.position.set(x, -Math.max(0, e.deadT - 1.5) * 0.9, z);
      this.shadow.visible = false;
      this.setTargeted(false, t); this.setHovered(false);
      return;
    }
    this.root.position.set(x, hover, z);
    this.face(yaw(e.face), dt, e.type === 'regent' && e.state === 'charge' ? 30 : 10);
    if (e.spawnT > 0) {
      if (an.spawn && this.curName !== an.spawn) this.oneShot(an.spawn, 0.75, 0.01);
      this.root.scale.setScalar(Math.min(1, 1.15 - e.spawnT * 0.6));
      return;
    }
    this.root.scale.setScalar(1);
    this.oneT -= dt;
    if (e.stunT > 0) { if (this.curName !== an.hit) this.oneShot(an.hit, 0.4); return; }
    let atk = null, wind = e.def.windup || 0.5;
    if (e.type === 'regent') {
      if (e.state === 'slam') { atk = '2H_Melee_Attack_Chop'; wind = e.dur; }
      else if (e.state === 'orbs') { atk = 'Spellcast_Raise'; wind = e.dur; }
      else if (e.state === 'summon') { atk = 'Spellcast_Summon'; wind = e.dur; }
      else if (e.state === 'charge') {
        if (e.chargePhase === 0) { atk = 'Taunt'; wind = e.dur; } else { this.play('Running_C', 1.7, 0.08); return; }
      }
    } else if (e.state === 'windup') atk = this.spec.attacks[0];
    if (atk) { if (this.curName !== atk) this.oneShot(atk, wind * 1.6 + 0.2, 0.06); return; }
    if (this.oneT > 0) return;
    if (v > 0.25) {
      const run = v > this.spec.runRef * 0.65 || !this.has(an.walk);
      this.play(run ? an.run : an.walk, Math.min(1.8, Math.max(0.5, v / (run ? this.spec.runRef : this.spec.runRef * 0.55))), 0.15);
    } else this.play(an.idle, 1, 0.25);
  }

  // ---------------------------------------------------------------- town folk
  updateNpc(x, z, yawT, moving, dt) {
    if (!this.ok) return;
    this.root.position.set(x, 0, z);
    this.mixer.update(dt);
    this.face(yawT, dt, 6);
    const an = this.spec.anims;
    this.play(moving ? (this.has(an.walk) ? an.walk : an.run) : an.idle, 1, 0.3);
  }

  dispose() { this.mixer?.stopAllAction(); this.root.removeFromParent(); for (const m of this.mats || []) m.dispose(); }
}
