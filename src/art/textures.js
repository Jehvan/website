// Procedural canvas textures. Everything is drawn in code at load; no image files.
let THREE_ = null;
const cache = new Map();

export function mkCanvas(w, h = w) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function toTexture(THREE, canvas, { srgb = true, repeat = null, aniso = 2 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  t.userData = { shared: true };
  return t;
}

export function glowTexture(THREE) {
  if (cache.has('glow')) return cache.get('glow');
  const [c, g] = mkCanvas(64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = toTexture(THREE, c); cache.set('glow', t); return t;
}

export function discTexture(THREE) {
  if (cache.has('disc')) return cache.get('disc');
  const [c, g] = mkCanvas(64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = toTexture(THREE, c); cache.set('disc', t); return t;
}
