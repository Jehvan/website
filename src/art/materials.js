// Shared PBR materials built from the procedural textures. Registry lets the renderer retune env intensity.
import * as THREE from 'three';
import { Tex } from './textures.js';

const registry = [];
export const ENV = { i: 0.22 };
export function setEnvIntensity(v) { ENV.i = v; for (const m of registry) m.envMapIntensity = v; }

// r128 reads hex colours as linear; convert sRGB hex so painted colours read as authored.
export const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();

export function std(opts) {
  const o = { roughness: 0.8, metalness: 0, ...opts };
  if (typeof o.color === 'number') o.color = lin(o.color);
  if (typeof o.emissive === 'number') o.emissive = lin(o.emissive);
  const m = new THREE.MeshStandardMaterial(o);
  m.envMapIntensity = ENV.i;
  m.userData.shared = true;
  registry.push(m);
  return m;
}
export const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); flashMat.userData.shared = true;

const cacheM = new Map();
const lazy = (k, fn) => { if (!cacheM.has(k)) { const m = fn(); m.userData.shared = true; cacheM.set(k, m); } return cacheM.get(k); };
const withBump = (map, s = 0.8) => ({ map, bumpMap: map, bumpScale: s });

export const Mat = {
  steel: () => lazy('steel', () => std({ ...withBump(Tex.plate('#b4bcc8', { seed: 3 }), 0.6), metalness: 0.85, roughness: 0.38 })),
  iron: () => lazy('iron', () => std({ ...withBump(Tex.plate('#5c616a', { seed: 4, scratches: 70 }), 0.8), metalness: 0.8, roughness: 0.52 })),
  blackPlate: () => lazy('blackPlate', () => std({ ...withBump(Tex.plate('#2a2732', { seed: 5, scratches: 60, rivets: true }), 0.7), metalness: 0.8, roughness: 0.42, emissive: 0xff5a10, emissiveMap: Tex.emberCracks(4), emissiveIntensity: 0.9 })),
  blade: () => lazy('blade', () => std({ color: 0xd6dde6, metalness: 0.95, roughness: 0.22 })),
  gold: () => lazy('gold', () => std({ color: 0xd8aa3a, metalness: 0.95, roughness: 0.3 })),
  chain: () => lazy('chain', () => std({ ...withBump(Tex.chain('#9aa2ac'), 0.5), metalness: 0.85, roughness: 0.5 })),
  leather: () => lazy('leather', () => std({ ...withBump(Tex.leather('#7a4e2a'), 0.6), roughness: 0.75 })),
  leatherDark: () => lazy('leatherDark', () => std({ ...withBump(Tex.leather('#3e2a1a', 8), 0.6), roughness: 0.8 })),
  clothBlue: () => lazy('clothBlue', () => std({ ...withBump(Tex.cloth('#2c4f92', 1), 0.3), roughness: 0.92, side: THREE.DoubleSide })),
  clothRed: () => lazy('clothRed', () => std({ ...withBump(Tex.cloth('#9a2630', 2), 0.3), roughness: 0.92, side: THREE.DoubleSide })),
  clothGreen: () => lazy('clothGreen', () => std({ ...withBump(Tex.cloth('#46663a', 3), 0.3), roughness: 0.95, side: THREE.DoubleSide })),
  clothPurple: () => lazy('clothPurple', () => std({ ...withBump(Tex.cloth('#5e3c96', 4), 0.3), roughness: 0.9, side: THREE.DoubleSide })),
  clothBlack: () => lazy('clothBlack', () => std({ ...withBump(Tex.cloth('#26222c', 5), 0.3), roughness: 0.95, side: THREE.DoubleSide })),
  clothRag: () => lazy('clothRag', () => std({ ...withBump(Tex.cloth('#6a6254', 6), 0.3), roughness: 1, side: THREE.DoubleSide })),
  clothCream: () => lazy('clothCream', () => std({ ...withBump(Tex.cloth('#d6c9a6', 7), 0.3), roughness: 0.95, side: THREE.DoubleSide })),
  clothCrimsonDark: () => lazy('clothCrimsonDark', () => std({ ...withBump(Tex.cloth('#4a1216', 8), 0.3), roughness: 0.95, side: THREE.DoubleSide })),
  skinHuman: () => lazy('skinHuman', () => std({ ...withBump(Tex.skin('#dba98a', 5, { mottle: 0.12, freckle: 20 }), 0.2), roughness: 0.65 })),
  skinAsh: () => lazy('skinAsh', () => std({ ...withBump(Tex.skin('#6f6a66', 6, { mottle: 0.3 }), 0.5), roughness: 0.9 })),
  skinOgre: () => lazy('skinOgre', () => std({ ...withBump(Tex.skin('#6a7852', 7, { mottle: 0.28, freckle: 60 }), 0.6), roughness: 0.88 })),
  bone: () => lazy('bone', () => std({ ...withBump(Tex.bone(), 0.8), roughness: 0.7 })),
  wood: () => lazy('wood', () => std({ ...withBump(Tex.wood('#7a5632', { seed: 7, planks: 1 }), 0.5), roughness: 0.85 })),
  woodDark: () => lazy('woodDark', () => std({ ...withBump(Tex.wood('#4a3222', { seed: 9, planks: 1 }), 0.5), roughness: 0.9 })),
  heraldry: () => lazy('heraldry', () => std({ ...withBump(Tex.heraldry(), 0.2), roughness: 0.55, metalness: 0.1 })),
  shieldRim: () => lazy('shieldRim', () => std({ color: 0xc8a040, metalness: 0.9, roughness: 0.35 })),
  eye: () => lazy('eye', () => new THREE.MeshBasicMaterial({ color: 0xff7a1a, fog: false })),
  eyeWhite: () => lazy('eyeWhite', () => new THREE.MeshBasicMaterial({ color: 0xfff0c8 })),
  dark: () => lazy('dark', () => std({ color: 0x0a0807, roughness: 1 })),
  orb: () => lazy('orb', () => std({ color: 0x7a4a20, emissive: 0xff8a2a, emissiveIntensity: 1.8, roughness: 0.3 })),
  orbBlue: () => lazy('orbBlue', () => std({ color: 0x2a4a7a, emissive: 0x6ab8ff, emissiveIntensity: 1.6, roughness: 0.3 })),
  gem: () => lazy('gem', () => std({ color: 0x802010, emissive: 0xff4a10, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.2 })),
  flame: () => lazy('flame', () => new THREE.MeshBasicMaterial({ color: 0xff7a1a, fog: false })),
  flameCore: () => lazy('flameCore', () => new THREE.MeshBasicMaterial({ color: 0xffb236, fog: false })),
};

