// Asset loading and caches: KayKit models (CC0), Poly Haven PBR textures (CC0).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = import.meta.env.BASE_URL + 'assets/';
const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const gltfs = new Map();       // url -> Promise<gltf>
const ready = new Map();       // url -> gltf (resolved)
const textures = new Map();

export const S = 1 / 25;       // world px -> metres
export const wx = (x) => x * S;
export const wz = (y) => y * S;
/** Y rotation for a model that faces +Z, from a game angle atan2(dy, dx) with y pointing south. */
export const yaw = (ang) => Math.PI / 2 - ang;

export function loadGLTF(path) {
  const url = BASE + 'models/' + path;
  if (!gltfs.has(url)) {
    gltfs.set(url, new Promise((res, rej) => gltfLoader.load(url, (g) => { ready.set(url, g); res(g); }, undefined, rej)));
  }
  return gltfs.get(url);
}
export const getGLTF = (path) => ready.get(BASE + 'models/' + path);

export function tex(path, { srgb = true, repeat = 1, aniso = 8 } = {}) {
  const key = path + '|' + repeat;
  if (textures.has(key)) return textures.get(key);
  const t = texLoader.load(BASE + path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  textures.set(key, t);
  return t;
}

/** Standard PBR material from a Poly Haven set (diff / nor / arm). */
export function pbr(id, repeat = 1, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: tex(`tex/${id}/diff.jpg`, { repeat }),
    normalMap: tex(`tex/${id}/nor.jpg`, { srgb: false, repeat }),
    roughnessMap: tex(`tex/${id}/arm.jpg`, { srgb: false, repeat }),
    roughness: 1, metalness: 0, ...opts,
  });
  return m;
}

/** Preload a list of model paths; resolves when all are in. */
export function preload(paths, onProgress) {
  let done = 0;
  return Promise.all(paths.map((p) => loadGLTF(p).then((g) => { done++; onProgress?.(done / paths.length); return g; })
    .catch((e) => { console.warn('missing model', p, e?.message || e); done++; })));
}
