// Procedural effect sprites and the per-frame mirror of projectiles, telegraphs, pickups and spell effects.
import * as THREE from 'three';
import { S, wx, wz, yaw, getGLTF } from './assets.js';
import { rarityOf } from '../items.js';

const texCache = {};
function canvasTex(name, size, draw) {
  if (texCache[name]) return texCache[name];
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[name] = t);
}
const glowTex = () => canvasTex('glow', 128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(0.6, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const ringTex = () => canvasTex('ring', 256, (g, s) => {
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = s * 0.035; g.shadowColor = '#fff'; g.shadowBlur = s * 0.05;
  g.beginPath(); g.arc(s / 2, s / 2, s * 0.44, 0, 7); g.stroke();
  g.lineWidth = s * 0.012; g.globalAlpha = 0.5; g.beginPath(); g.arc(s / 2, s / 2, s * 0.36, 0, 7); g.stroke();
});
const discTex = () => canvasTex('disc', 256, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.47);
  r.addColorStop(0, 'rgba(255,255,255,0.28)'); r.addColorStop(0.85, 'rgba(255,255,255,0.4)'); r.addColorStop(0.94, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const flameTex = () => canvasTex('flame', 128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s * 0.72, 0, s / 2, s * 0.6, s * 0.5);
  r.addColorStop(0, 'rgba(255,240,190,1)'); r.addColorStop(0.3, 'rgba(255,170,60,0.9)'); r.addColorStop(0.7, 'rgba(255,80,20,0.35)'); r.addColorStop(1, 'rgba(255,60,10,0)');
  g.fillStyle = r; g.beginPath(); g.moveTo(s / 2, s * 0.02); g.bezierCurveTo(s * 0.95, s * 0.5, s * 0.8, s, s / 2, s); g.bezierCurveTo(s * 0.2, s, s * 0.05, s * 0.5, s / 2, s * 0.02); g.fill();
});
const arcTex = () => canvasTex('arc', 256, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s * 0.5);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.75, 'rgba(255,255,255,0.35)'); r.addColorStop(0.93, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const shadowTex = () => canvasTex('shadow', 64, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(0,0,0,0.6)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s);
});

const add = (map, color, opacity = 1) => new THREE.SpriteMaterial({ map, color, opacity, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
export function glowSprite(color, size, opacity = 0.8) { const s = new THREE.Sprite(add(glowTex(), color, opacity)); s.scale.setScalar(size); return s; }
export function flameSprite(size) { const s = new THREE.Sprite(add(flameTex(), 0xffffff, 0.95)); s.scale.set(0.62 * size, size, 1); s.center.set(0.5, 0.15); return s; }

const flatGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
/** Additive decal lying on the ground. */
export function groundDecal(kind, color, opacity = 1, additive = true) {
  const map = kind === 'ring' ? ringTex() : kind === 'disc' ? discTex() : kind === 'shadow' ? shadowTex() : kind === 'arc' ? arcTex() : glowTex();
  const m = new THREE.Mesh(flatGeo, new THREE.MeshBasicMaterial({ map, color, opacity, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.renderOrder = 2;
  return m;
}

function sectorGeo(arcDeg) {
  const a = arcDeg * Math.PI / 180, seg = 20, pos = [0, 0, 0], uv = [0.5, 0.5], idx = [];
  for (let i = 0; i <= seg; i++) { const t = -a / 2 + a * i / seg; pos.push(Math.sin(t), 0, Math.cos(t)); uv.push(0.5 + Math.sin(t) * 0.5, 0.5 + Math.cos(t) * 0.5); }
  for (let i = 0; i < seg; i++) idx.push(0, i + 1, i + 2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

const hex = (c) => new THREE.Color(c);

export class Effects {
  constructor(parent) {
    this.root = new THREE.Group(); parent.add(this.root);
    this.maps = { proj: new Map(), zone: new Map(), pick: new Map(), fx: new Map() };
    this.click = groundDecal('ring', 0xffd070, 1); this.click.visible = false; this.root.add(this.click);
    this.clickT = 9;
  }

  showClick(x, y) { this.click.position.set(wx(x), 0.07, wz(y)); this.clickT = 0; }

  prune(map, live) {
    if (!map.size) return;
    const set = new Set(live);
    for (const [k, o] of map) if (!set.has(k)) { o.removeFromParent(); map.delete(k); }
  }

  sync(game, dt) {
    const t = game.time;
    this.clickT += dt;
    this.click.visible = this.clickT < 0.5;
    if (this.click.visible) { const k = this.clickT / 0.5; this.click.scale.setScalar(1.7 - k * 1.2); this.click.material.opacity = 1 - k; this.click.rotation.y = k * 3; }
    this.projectiles(game); this.zones(game, t); this.pickups(game, t); this.effects(game);
  }

  projectiles(game) {
    const map = this.maps.proj;
    for (const q of game.proj) {
      let o = map.get(q);
      if (!o) {
        o = new THREE.Group();
        if (q.kind === 'arrow' || q.kind === 'earrow') {
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.8 }));
          const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.8, roughness: 0.3 }));
          tip.position.z = 0.55;
          o.add(shaft, tip, Object.assign(glowSprite(q.team === 'e' ? 0xff5020 : 0xfff0c0, 0.7, 0.6), {}));
        } else {
          o.add(glowSprite(0xffffff, 0.7, 1), glowSprite(q.kind === 'orb' ? 0xff3a10 : 0xff7a20, 2.6, 0.9));
        }
        this.root.add(o); map.set(q, o);
      }
      o.position.set(wx(q.x), 1.15, wz(q.y));
      o.rotation.y = yaw(Math.atan2(q.vy, q.vx));
    }
    this.prune(map, game.proj);
  }

  zones(game, t) {
    const map = this.maps.zone;
    for (const z of game.zones) {
      let o = map.get(z);
      if (!o) {
        o = new THREE.Group();
        const col = z.kind === 'rain' ? 0xc0d860 : z.team === 'p' ? 0xff8028 : 0xff2010;
        if (z.kind === 'line') {
          o.fill = groundDecal('glow', 0xff2010, 0.55); o.add(o.fill);
        } else {
          o.ring = groundDecal('ring', col, 1); o.fill = groundDecal('disc', col, 0.55); o.add(o.ring, o.fill);
          if (z.kind === 'meteor') {
            o.rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: 0x2a1408, emissive: 0xff4a10, emissiveIntensity: 2.5, roughness: 0.8 }));
            o.rock.add(glowSprite(0xff6a20, 5, 0.9)); o.add(o.rock);
          }
          if (z.kind === 'rain') {
            o.arrows = [];
            const geo = new THREE.CylinderGeometry(0.025, 0.025, 1.1, 4), mat = new THREE.MeshBasicMaterial({ color: 0xf0e8c0 });
            for (let i = 0; i < 18; i++) { const a = new THREE.Mesh(geo, mat); o.add(a); o.arrows.push(a); }
          }
        }
        this.root.add(o); map.set(z, o);
      }
      if (z.kind === 'line') {
        const ax = wx(z.x), az = wz(z.y), bx = wx(z.x2), bz = wz(z.y2), k = Math.min(1, z.t / Math.max(0.01, z.delay));
        const len = Math.hypot(bx - ax, bz - az);
        o.position.set((ax + bx) / 2, 0.08, (az + bz) / 2);
        o.rotation.y = Math.atan2(bx - ax, bz - az);
        o.fill.scale.set(z.w * S * 1.6, 1, len * (0.3 + 0.7 * k) * 1.25);
        continue;
      }
      const r = z.r * S;
      o.position.set(wx(z.x), 0.08, wz(z.y));
      o.ring.scale.setScalar(r * 2.25); o.ring.rotation.y = t * 0.5;
      if (z.kind === 'rain') {
        o.fill.scale.setScalar(r * 2.1);
        o.arrows.forEach((a, i) => { const ph = (t * 2.2 + i * 0.37) % 1, ang = i * 2.39, rr = r * Math.sqrt((i * 0.618) % 1); a.position.set(Math.cos(ang) * rr, (1 - ph) * 7, Math.sin(ang) * rr); });
      } else {
        const k = Math.min(1, z.t / Math.max(0.01, z.delay));
        o.fill.scale.setScalar(r * 2.1 * k);
        if (o.rock) { o.rock.visible = !z.fired; o.rock.position.set(-3 * (1 - k), 15 * (1 - k) + 0.4, -2 * (1 - k)); }
        if (z.fired) { const f = Math.min(1, (z.t - z.delay) / 0.35); o.fill.visible = f < 1; o.ring.material.opacity = 1 - f; o.ring.scale.setScalar(r * 2.25 * (1 + f * 0.3)); }
      }
    }
    this.prune(map, game.zones);
  }

  pickups(game, t) {
    const map = this.maps.pick;
    for (const pk of game.pickups) {
      let o = map.get(pk);
      if (!o) {
        o = new THREE.Group();
        const col = pk.kind === 'gold' ? 0xffc040 : pk.kind === 'potion' ? 0xff3050 : hex(rarityOf(pk.item.rarity).color).getHex();
        const g = glowSprite(col, pk.kind === 'item' ? 1.6 : 1.0, 0.8); g.position.y = 0.4; o.add(g);
        if (pk.kind === 'item') {
          const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
          beam.scale.set(0.5, 5, 1); beam.position.y = 2.2; o.add(beam);
          const chest = getGLTF('dungeon/chest.glb');
          if (chest) { o.spin = chest.scene.clone(); o.spin.scale.setScalar(0.55); o.spin.traverse((c) => { if (c.isMesh) c.castShadow = true; }); o.add(o.spin); }
        } else {
          o.spin = new THREE.Mesh(pk.kind === 'gold' ? new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12).rotateX(Math.PI / 2) : new THREE.SphereGeometry(0.17, 10, 8),
            new THREE.MeshStandardMaterial({ color: col, metalness: pk.kind === 'gold' ? 0.9 : 0.1, roughness: 0.3, emissive: col, emissiveIntensity: 0.35 }));
          o.spin.position.y = 0.35; o.add(o.spin);
        }
        this.root.add(o); map.set(pk, o);
      }
      o.position.set(wx(pk.x), 0.1 + Math.sin(t * 3 + pk.x) * 0.08, wz(pk.y));
      if (o.spin) o.spin.rotation.y = t * 2.2;
    }
    this.prune(map, game.pickups);
  }

  effects(game) {
    const map = this.maps.fx;
    for (const f of game.fx) {
      let o = map.get(f);
      const col = hex(f.color || '#ffffff');
      if (!o) {
        o = new THREE.Group();
        if (f.type === 'slash') {
          o.body = new THREE.Mesh(sectorGeo(f.arc || 120), new THREE.MeshBasicMaterial({ map: arcTex(), color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        } else if (['ring', 'nova', 'spawn'].includes(f.type)) {
          o.body = groundDecal('ring', col, 1);
          if (f.type !== 'ring') { o.disc = groundDecal('glow', col, 0.7); o.add(o.disc); }
        } else o.body = glowSprite(col, 1, 1);
        o.add(o.body); this.root.add(o); map.set(f, o);
      }
      const k = f.t / f.dur, fade = 1 - k;
      const flat = ['ring', 'nova', 'spawn'].includes(f.type);
      o.position.set(wx(f.x), f.type === 'slash' ? 1.0 : flat ? 0.09 : 1.0, wz(f.y));
      if (f.type === 'slash') {
        const rr = (f.range || 60) * S * 1.15;
        o.rotation.y = yaw(f.ang) + (k - 0.5) * 0.7;
        o.body.scale.set(rr, 1, rr);
      } else if (flat) {
        let rr = (f.r || 40) * S * 2.2 * (0.3 + 0.7 * Math.sqrt(k));
        if (f.type === 'spawn') rr = 2.6 * (1 - k * 0.5);
        o.body.scale.setScalar(rr);
        if (o.disc) { o.disc.scale.setScalar(rr * 1.1); o.disc.material.opacity = 0.7 * fade; }
      } else if (f.type === 'burst') o.body.scale.setScalar((f.r || 30) * S * 3.2 * (0.4 + 0.6 * k));
      else o.body.scale.setScalar(1.4 + k * 1.2);
      o.body.material.opacity = fade;
    }
    this.prune(map, game.fx);
  }

  clear() { for (const m of Object.values(this.maps)) { for (const o of m.values()) o.removeFromParent(); m.clear(); } }
}
