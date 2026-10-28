// Procedural canvas textures. Everything is drawn in code at load; no image files.
import * as THREE from 'three';
import { rng } from '../world.js';

const cache = new Map();

export function mkCanvas(w, h = w) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function toTexture(canvas, { srgb = true, repeat = null, aniso = 4, nearest = false } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  if (nearest) { t.magFilter = THREE.NearestFilter; }
  t.userData = { shared: true };
  return t;
}

/* ---------- tileable value-noise ---------- */
export function noiseField(w, h, { cells = 6, octaves = 4, seed = 1, persistence = 0.5 } = {}) {
  const out = new Float32Array(w * h);
  const R = rng(seed * 2654435761);
  let amp = 1, total = 0, c = cells;
  for (let o = 0; o < octaves; o++) {
    const grid = new Float32Array(c * c);
    for (let i = 0; i < grid.length; i++) grid[i] = R();
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * c, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
      const ya = (y0 % c) * c, yb = ((y0 + 1) % c) * c;
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * c, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % c, xb = (x0 + 1) % c;
        const a = grid[ya + xa] + (grid[ya + xb] - grid[ya + xa]) * sx;
        const b = grid[yb + xa] + (grid[yb + xb] - grid[yb + xa]) * sx;
        out[y * w + x] += (a + (b - a) * sy) * amp;
      }
    }
    total += amp; amp *= persistence; c *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

const hex = (s) => { const n = parseInt(s.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// fill canvas from a per-pixel function(x,y,i) -> [r,g,b,(a)]
function pixels(w, h, fn) {
  const [c, g] = mkCanvas(w, h);
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fn(x, y, y * w + x), i = (y * w + x) * 4;
    d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = v[3] === undefined ? 255 : v[3];
  }
  g.putImageData(img, 0, 0);
  return [c, g];
}

const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
const tex = (c, opts) => toTexture(c, opts);

/* ---------- materials' maps ---------- */
export const Tex = {
  cloth(base, seed = 1, weave = 1) {
    return memo(`cloth${base}${seed}${weave}`, () => {
      const n = noiseField(128, 128, { cells: 8, octaves: 3, seed });
      const b = hex(base);
      const [c] = pixels(128, 128, (x, y, i) => {
        const wv = ((x % 4 < 2) ^ (y % 4 < 2)) ? 1 : 0;
        const thread = weave ? 0.9 + 0.1 * wv + ((x * 7 + y * 13) % 5) * 0.012 : 1;
        const k = (0.75 + 0.5 * n[i]) * thread;
        return [b[0] * k, b[1] * k, b[2] * k];
      });
      return tex(c, { repeat: [2, 2] });
    });
  },
  leather(base, seed = 2) {
    return memo(`leather${base}${seed}`, () => {
      const n = noiseField(128, 128, { cells: 16, octaves: 3, seed }), n2 = noiseField(128, 128, { cells: 4, octaves: 2, seed: seed + 5 });
      const b = hex(base);
      const [c, g] = pixels(128, 128, (x, y, i) => {
        const grain = Math.abs(n[i] - 0.5) < 0.04 ? 0.62 : 1;
        const k = (0.68 + 0.55 * n2[i]) * grain * (0.9 + 0.2 * n[i]);
        return [b[0] * k, b[1] * k, b[2] * k];
      });
      g.strokeStyle = 'rgba(25,14,6,0.55)'; g.lineWidth = 1.2; g.setLineDash([4, 3]);
      g.beginPath(); g.moveTo(0, 10); g.lineTo(128, 10); g.moveTo(0, 118); g.lineTo(128, 118); g.stroke();
      return tex(c, { repeat: [1, 1] });
    });
  },
  plate(base, { seed = 3, scratches = 40, cracks = false, rivets = true } = {}) {
    return memo(`plate${base}${seed}${scratches}${cracks}${rivets}`, () => {
      const n = noiseField(256, 256, { cells: 4, octaves: 4, seed });
      const b = hex(base);
      const [c, g] = pixels(256, 256, (x, y, i) => {
        const streak = 0.92 + 0.08 * Math.sin(y * 1.7 + n[(i + x * 3) % n.length] * 9);
        const k = (0.7 + 0.6 * n[i]) * streak;
        return [b[0] * k, b[1] * k, b[2] * k];
      });
      const R = rng(seed * 31);
      for (let i = 0; i < scratches; i++) {
        g.strokeStyle = `rgba(255,255,255,${0.05 + R() * 0.12})`; g.lineWidth = 0.6 + R();
        const x = R() * 256, y = R() * 256, a = (R() - 0.5) * 0.8;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (20 + R() * 40), y + Math.sin(a) * (20 + R() * 40)); g.stroke();
      }
      if (rivets) {
        for (const [x, y] of [[20, 20], [236, 20], [20, 236], [236, 236], [128, 20], [128, 236]]) {
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(x + 1, y + 1.5, 4.2, 0, 7); g.fill();
          g.fillStyle = css(mix(b, [255, 255, 255], 0.35)); g.beginPath(); g.arc(x, y, 3.6, 0, 7); g.fill();
        }
      }
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 5; g.strokeRect(0, 0, 256, 256);
      return tex(c);
    });
  },
  emberCracks(seed = 4) {
    return memo(`cracks${seed}`, () => {
      const [c, g] = mkCanvas(256);
      g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
      const R = rng(seed * 77);
      for (let k = 0; k < 14; k++) {
        let x = R() * 256, y = R() * 256, a = R() * 6.28;
        g.lineWidth = 1 + R() * 2.2; g.strokeStyle = `rgb(${200 + R() * 55},${60 + R() * 70},10)`; g.shadowColor = '#ff5a10'; g.shadowBlur = 6;
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 9; s++) { a += (R() - 0.5) * 1.3; x += Math.cos(a) * (10 + R() * 18); y += Math.sin(a) * (10 + R() * 18); g.lineTo(x, y); }
        g.stroke();
      }
      return tex(c);
    });
  },
  chain(base = '#8a929c') {
    return memo(`chain${base}`, () => {
      const [c, g] = mkCanvas(128);
      const b = hex(base);
      g.fillStyle = '#14161a'; g.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const cx = x * 8 + (y % 2 ? 4 : 0), cy = y * 8;
        const gr = g.createRadialGradient(cx - 1, cy - 1, 0.5, cx, cy, 5);
        gr.addColorStop(0, css(mix(b, [255, 255, 255], 0.45))); gr.addColorStop(0.7, css(b)); gr.addColorStop(1, css(mix(b, [0, 0, 0], 0.5)));
        g.strokeStyle = gr; g.lineWidth = 1.7; g.beginPath(); g.arc(cx, cy, 3.4, 0, 6.3); g.stroke();
      }
      return tex(c, { repeat: [2, 2] });
    });
  },
  skin(base, seed = 5, { mottle = 0.25, freckle = 0 } = {}) {
    return memo(`skin${base}${seed}${mottle}${freckle}`, () => {
      const n = noiseField(128, 128, { cells: 6, octaves: 4, seed }), n2 = noiseField(128, 128, { cells: 24, octaves: 2, seed: seed + 9 });
      const b = hex(base);
      const [c, g] = pixels(128, 128, (x, y, i) => {
        const k = 1 - mottle + mottle * 2 * n[i] + (n2[i] - 0.5) * 0.16;
        return [b[0] * k, b[1] * k, b[2] * k * (0.97 + 0.06 * n2[i])];
      });
      const R = rng(seed * 13);
      for (let i = 0; i < freckle; i++) { g.fillStyle = 'rgba(40,20,10,0.25)'; g.beginPath(); g.arc(R() * 128, R() * 128, 0.6 + R(), 0, 7); g.fill(); }
      return tex(c);
    });
  },
  bone(seed = 6) {
    return memo(`bone${seed}`, () => {
      const n = noiseField(128, 128, { cells: 5, octaves: 4, seed });
      const [c, g] = pixels(128, 128, (x, y, i) => { const k = 0.78 + 0.35 * n[i]; return [226 * k, 214 * k, 186 * k]; });
      const R = rng(seed);
      for (let i = 0; i < 16; i++) { g.strokeStyle = 'rgba(80,60,30,0.35)'; g.lineWidth = 0.8; g.beginPath(); const x = R() * 128, y = R() * 128; g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 24, y + (R() - 0.5) * 24); g.stroke(); }
      return tex(c);
    });
  },
  wood(base = '#7a5a38', { seed = 7, planks = 4, ring = false } = {}) {
    return memo(`wood${base}${seed}${planks}${ring}`, () => {
      const n = noiseField(256, 256, { cells: 3, octaves: 4, seed });
      const b = hex(base);
      const [c, g] = pixels(256, 256, (x, y, i) => {
        const grain = 0.82 + 0.28 * Math.sin((y * 0.5 + n[i] * 24) * 1.2) * 0.5 + 0.14 * n[i];
        const pl = Math.floor(x / (256 / planks)); const pk = 0.88 + ((pl * 37) % 11) * 0.016;
        const k = grain * pk;
        return [b[0] * k, b[1] * k, b[2] * k];
      });
      g.strokeStyle = 'rgba(15,8,2,0.7)'; g.lineWidth = 2;
      for (let p = 1; p < planks; p++) { g.beginPath(); g.moveTo(p * 256 / planks, 0); g.lineTo(p * 256 / planks, 256); g.stroke(); }
      if (ring) { for (let r = 6; r < 70; r += 8) { g.strokeStyle = 'rgba(40,24,10,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(128, 128, r, 0, 7); g.stroke(); } }
      return tex(c, { repeat: [1, 1] });
    });
  },
  bark(base = '#4a3826', seed = 8) {
    return memo(`bark${base}${seed}`, () => {
      const n = noiseField(128, 256, { cells: 6, octaves: 4, seed });
      const b = hex(base);
      const [c] = pixels(128, 256, (x, y, i) => { const v = 0.55 + 0.9 * Math.abs(Math.sin(x * 0.55 + n[i] * 7)) * n[i]; return [b[0] * v, b[1] * v, b[2] * v]; });
      return tex(c, { repeat: [1, 2] });
    });
  },
  stone(base = '#8a8478', { seed = 9, bricks = 0, cobbles = false, dark = 0.55 } = {}) {
    return memo(`stone${base}${seed}${bricks}${cobbles}${dark}`, () => {
      const n = noiseField(256, 256, { cells: 8, octaves: 5, seed }), n2 = noiseField(256, 256, { cells: 32, octaves: 2, seed: seed + 3 });
      const b = hex(base);
      const [c, g] = pixels(256, 256, (x, y, i) => { const k = 0.65 + 0.6 * n[i] + (n2[i] - 0.5) * 0.25; return [b[0] * k, b[1] * k, b[2] * k]; });
      const R = rng(seed * 5);
      g.strokeStyle = `rgba(10,8,6,${dark})`; g.lineWidth = 2.5;
      if (bricks) {
        const rows = bricks, rh = 256 / rows;
        for (let r = 0; r < rows; r++) {
          g.beginPath(); g.moveTo(0, r * rh); g.lineTo(256, r * rh); g.stroke();
          const bw = 256 / 4; const off = (r % 2) * bw / 2;
          for (let x = -off; x < 256; x += bw) { g.beginPath(); g.moveTo(x + bw * (0.85 + R() * 0.3) * 0 + bw, r * rh); g.lineTo(x + bw, (r + 1) * rh); g.stroke(); }
          for (let x = -off; x < 256; x += bw) { g.fillStyle = `rgba(255,255,255,${0.02 + R() * 0.05})`; g.fillRect(x + 3, r * rh + 3, bw - 6, rh - 6); }
        }
      } else if (cobbles) {
        for (let i = 0; i < 260; i++) {
          const x = R() * 256, y = R() * 256, r = 6 + R() * 5;
          g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + R() * 0.08})`; g.beginPath(); g.ellipse(x, y, r, r * 0.8, R() * 3, 0, 7); g.fill();
          g.strokeStyle = 'rgba(10,8,6,0.28)'; g.lineWidth = 1.4; g.stroke();
        }
      }
      return tex(c);
    });
  },
  flag(base = '#6a6660', seed = 10) { // flagstones for halls
    return memo(`flag${base}${seed}`, () => {
      const n = noiseField(256, 256, { cells: 8, octaves: 4, seed });
      const b = hex(base);
      const [c, g] = pixels(256, 256, (x, y, i) => { const tile = ((Math.floor(x / 64) + Math.floor(y / 64) * 3) % 5); const k = (0.7 + 0.5 * n[i]) * (0.9 + tile * 0.03); return [b[0] * k, b[1] * k, b[2] * k]; });
      g.strokeStyle = 'rgba(8,6,5,0.8)'; g.lineWidth = 3;
      for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
      return tex(c, { repeat: [1, 1] });
    });
  },
  thatch() {
    return memo('thatch', () => {
      const [c, g] = mkCanvas(256);
      g.fillStyle = '#a88a4a'; g.fillRect(0, 0, 256, 256);
      const R = rng(11);
      for (let i = 0; i < 2600; i++) {
        const x = R() * 256, y = R() * 256, l = 14 + R() * 26;
        const v = 120 + R() * 90;
        g.strokeStyle = `rgba(${v},${v * 0.78 | 0},${v * 0.36 | 0},${0.45 + R() * 0.4})`; g.lineWidth = 0.8 + R() * 1.2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 4, y + l); g.stroke();
      }
      for (let y = 0; y < 256; y += 32) { g.fillStyle = 'rgba(40,24,6,0.25)'; g.fillRect(0, y, 256, 3); }
      return tex(c, { repeat: [3, 2] });
    });
  },
  slate() {
    return memo('slate', () => {
      const [c, g] = mkCanvas(256);
      g.fillStyle = '#444b55'; g.fillRect(0, 0, 256, 256);
      const R = rng(12);
      const rows = 8, rh = 256 / rows, cw = 32;
      for (let r = 0; r < rows; r++) for (let x = -(r % 2) * cw / 2; x < 256; x += cw) {
        const v = 52 + R() * 34;
        g.fillStyle = `rgb(${v},${v + 6},${v + 14})`; g.fillRect(x + 1, r * rh + 1, cw - 2, rh - 2);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 1, r * rh + rh - 4, cw - 2, 3);
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 1, r * rh + 1, cw - 2, 2);
      }
      return tex(c, { repeat: [2, 2] });
    });
  },
  straw() {
    return memo('straw', () => {
      const [c, g] = mkCanvas(128);
      g.fillStyle = '#c8a74a'; g.fillRect(0, 0, 128, 128);
      const R = rng(13);
      for (let i = 0; i < 900; i++) { const v = 150 + R() * 100; g.strokeStyle = `rgba(${v},${v * 0.82 | 0},${v * 0.3 | 0},0.6)`; g.lineWidth = 1; const x = R() * 128, y = R() * 128; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 12 + R() * 10, y + (R() - 0.5) * 3); g.stroke(); }
      g.fillStyle = 'rgba(70,40,10,0.7)'; g.fillRect(0, 30, 128, 4); g.fillRect(0, 92, 128, 4);
      return tex(c);
    });
  },
  plaster(base = '#d9cdb0') {
    return memo(`plaster${base}`, () => {
      const n = noiseField(128, 128, { cells: 6, octaves: 4, seed: 14 });
      const b = hex(base);
      const [c] = pixels(128, 128, (x, y, i) => { const k = 0.85 + 0.3 * n[i]; return [b[0] * k, b[1] * k, b[2] * k]; });
      return tex(c, { repeat: [1, 1] });
    });
  },
  rock(base = '#7a7770') {
    return memo(`rock${base}`, () => {
      const n = noiseField(128, 128, { cells: 5, octaves: 5, seed: 15 }), n2 = noiseField(128, 128, { cells: 20, octaves: 2, seed: 16 });
      const b = hex(base);
      const [c] = pixels(128, 128, (x, y, i) => { const k = 0.55 + 0.75 * n[i] + (n2[i] - 0.5) * 0.3; return [b[0] * k, b[1] * k * 0.98, b[2] * k * 0.95]; });
      return tex(c);
    });
  },
  carpet() {
    return memo('carpet', () => {
      const [c, g] = mkCanvas(128, 256);
      const n = noiseField(128, 256, { cells: 8, octaves: 3, seed: 17 });
      const [, g2] = [null, g];
      const img = g2.createImageData(128, 256);
      for (let i = 0; i < 128 * 256; i++) { const k = 0.8 + 0.4 * n[i]; img.data[i * 4] = 140 * k; img.data[i * 4 + 1] = 22 * k; img.data[i * 4 + 2] = 28 * k; img.data[i * 4 + 3] = 255; }
      g2.putImageData(img, 0, 0);
      g.strokeStyle = '#d8aa3a'; g.lineWidth = 7; g.strokeRect(8, 0, 112, 256);
      g.strokeStyle = '#8a6420'; g.lineWidth = 2; g.strokeRect(17, -2, 94, 260);
      g.fillStyle = '#d8aa3a';
      for (let y = 16; y < 256; y += 40) { g.beginPath(); g.moveTo(64, y - 10); g.lineTo(74, y); g.lineTo(64, y + 10); g.lineTo(54, y); g.closePath(); g.fill(); }
      return tex(c);
    });
  },
  water() {
    return memo('water', () => {
      const n = noiseField(256, 256, { cells: 6, octaves: 4, seed: 18 }), n2 = noiseField(256, 256, { cells: 12, octaves: 3, seed: 19 });
      const [c] = pixels(256, 256, (x, y, i) => {
        const w = Math.abs(n[i] - n2[i]);
        const hi = w < 0.04 ? 1 : 0;
        const k = 0.7 + 0.5 * n[i];
        return [(52 + hi * 110) * k, (118 + hi * 100) * k, (140 + hi * 80) * k];
      });
      return tex(c, { repeat: [2, 14] });
    });
  },
  murk() {
    return memo('murk', () => {
      const n = noiseField(256, 256, { cells: 6, octaves: 4, seed: 20 });
      const [c] = pixels(256, 256, (x, y, i) => { const k = 0.6 + 0.8 * n[i]; return [36 * k, 58 * k, 40 * k]; });
      return tex(c, { repeat: [2, 2] });
    });
  },
  leafCard(base = '#4a7a2a', seed = 21) {
    return memo(`leaf${base}${seed}`, () => {
      const [c, g] = mkCanvas(256);
      const b = hex(base), R = rng(seed);
      for (let i = 0; i < 160; i++) {
        const a = R() * 6.283, r = Math.sqrt(R()) * 108;
        const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r * 0.9;
        const v = 0.55 + R() * 0.7;
        g.save(); g.translate(x, y); g.rotate(R() * 6.28);
        g.fillStyle = `rgb(${b[0] * v | 0},${b[1] * v | 0},${b[2] * v | 0})`;
        g.beginPath(); g.ellipse(0, 0, 13 + R() * 7, 6 + R() * 3, 0, 0, 7); g.fill();
        g.strokeStyle = `rgba(0,0,0,0.25)`; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.stroke();
        g.restore();
      }
      return tex(c, { srgb: true });
    });
  },
  pineCard(seed = 22) {
    return memo(`pine${seed}`, () => {
      const [c, g] = mkCanvas(256);
      const R = rng(seed);
      for (let i = 0; i < 260; i++) {
        const y = 10 + R() * 236, spread = 14 + y * 0.42;
        const x = 128 + (R() - 0.5) * spread * 2, v = 0.5 + R() * 0.6;
        g.strokeStyle = `rgb(${24 * v + 10 | 0},${72 * v + 16 | 0},${40 * v + 8 | 0})`; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x > 128 ? 22 : -22) * (0.5 + R() * 0.6), y + 12 + R() * 8); g.stroke();
      }
      return tex(c);
    });
  },
  grassBlade(base = '#6a9a3a', seed = 23) {
    return memo(`grass${base}${seed}`, () => {
      const [c, g] = mkCanvas(128);
      const b = hex(base), R = rng(seed);
      for (let i = 0; i < 16; i++) {
        const x = 12 + R() * 104, h = 60 + R() * 60, lean = (R() - 0.5) * 40, v = 0.65 + R() * 0.6;
        g.fillStyle = `rgb(${b[0] * v | 0},${b[1] * v | 0},${b[2] * v | 0})`;
        g.beginPath(); g.moveTo(x - 4, 128); g.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.6, x + lean, 128 - h); g.quadraticCurveTo(x + lean * 0.3 + 3, 128 - h * 0.5, x + 4, 128); g.closePath(); g.fill();
      }
      return tex(c);
    });
  },
  reed(seed = 24) {
    return memo(`reed${seed}`, () => {
      const [c, g] = mkCanvas(64, 128);
      const R = rng(seed);
      for (let i = 0; i < 7; i++) { const x = 8 + R() * 48, h = 70 + R() * 50, l = (R() - 0.5) * 16; g.strokeStyle = `rgb(${90 + R() * 30},${100 + R() * 30},${50})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x, 128 - h * 0.5, x + l, 128 - h); g.stroke(); g.fillStyle = '#5a3a20'; g.fillRect(x + l - 2, 128 - h - 6, 4, 14); }
      return tex(c);
    });
  },
  /* original heraldry: a gold keep on a field per bend of blue and red, over a white road-chevron */
  heraldry(w = 256, h = 320) {
    return memo(`heraldry${w}`, () => {
      const [c, g] = mkCanvas(w, h);
      g.fillStyle = '#1d3a78'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#9c1f26'; g.beginPath(); g.moveTo(w, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
      // road chevron
      g.strokeStyle = '#efe6d0'; g.lineWidth = w * 0.09; g.lineJoin = 'miter';
      g.beginPath(); g.moveTo(w * 0.12, h * 0.9); g.lineTo(w * 0.5, h * 0.66); g.lineTo(w * 0.88, h * 0.9); g.stroke();
      // keep
      g.fillStyle = '#e4b53c'; const kx = w * 0.5, kw = w * 0.34, kt = h * 0.2, kb = h * 0.58;
      g.fillRect(kx - kw / 2, kt + h * 0.06, kw, kb - kt - h * 0.06);
      for (let i = 0; i < 3; i++) g.fillRect(kx - kw / 2 + i * (kw / 3) + 1, kt, kw / 3 - w * 0.025, h * 0.08);
      g.fillStyle = '#7a1a20'; g.beginPath(); g.moveTo(kx - kw * 0.15, kb); g.lineTo(kx - kw * 0.15, kb - h * 0.12); g.arc(kx, kb - h * 0.12, kw * 0.15, Math.PI, 0); g.lineTo(kx + kw * 0.15, kb); g.fill();
      g.fillStyle = '#e4b53c'; for (const [sx, sy] of [[0.2, 0.18], [0.8, 0.18], [0.5, 0.05]]) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 0.014 : 0.034) * w; g.lineTo(sx * w + Math.cos(a) * r, sy * h + Math.sin(a) * r); } g.closePath(); g.fill(); }
      g.strokeStyle = '#e4b53c'; g.lineWidth = w * 0.045; g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
      const n = noiseField(128, 128, { cells: 8, octaves: 3, seed: 25 });
      const img = g.getImageData(0, 0, w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = 0.9 + 0.2 * n[((y * 128 / h) | 0) * 128 + ((x * 128 / w) | 0)]; const i = (y * w + x) * 4; img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k; }
      g.putImageData(img, 0, 0);
      return tex(c, { aniso: 4 });
    });
  },
  banner() {
    return memo('banner', () => {
      const [c, g] = mkCanvas(128, 256);
      g.fillStyle = '#3a0e12'; g.fillRect(0, 0, 128, 256);
      const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#6a1a20'); gr.addColorStop(1, '#2a0a0e'); g.fillStyle = gr; g.fillRect(6, 0, 116, 250);
      g.fillStyle = '#18181a'; g.beginPath(); g.moveTo(64, 70); g.lineTo(90, 110); g.lineTo(64, 170); g.lineTo(38, 110); g.closePath(); g.fill();
      g.strokeStyle = '#e8a030'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#ff6a1a'; g.beginPath(); g.arc(64, 112, 9, 0, 7); g.fill();
      g.fillStyle = '#8a6a30'; g.fillRect(0, 0, 128, 8);
      for (let i = 0; i < 4; i++) { g.fillStyle = '#1a0608'; g.beginPath(); g.moveTo(6 + i * 29, 256); g.lineTo(20 + i * 29, 226); g.lineTo(34 + i * 29, 256); g.fill(); }
      return tex(c);
    });
  },
  ember() { // flame sprite
    return memo('ember', () => {
      const [c, g] = mkCanvas(64, 128);
      const gr = g.createRadialGradient(32, 90, 2, 32, 80, 54);
      gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(0.35, 'rgba(255,170,50,0.9)'); gr.addColorStop(0.7, 'rgba(230,70,10,0.4)'); gr.addColorStop(1, 'rgba(120,20,0,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(60, 50, 64, 90, 32, 124); g.bezierCurveTo(0, 90, 4, 50, 32, 2); g.fill();
      return tex(c);
    });
  },
};

/* ---------- ground painters (large canvases) ---------- */
export function paintGround(L, quality) {
  const S = quality === 'low' ? 0.5 : 0.75;       // pixels per world unit
  const w = Math.round(L.w * S), h = Math.round(L.h * S);
  const [c, g] = mkCanvas(w, h);
  const R = rng(L.seed * 99 + 5);
  const sx = w / L.w, sy = h / L.h;
  const theme = L.theme;
  const P = {
    fields: { base: '#6f8f3e', a: '#86a64a', b: '#567a32', road: '#9a7a4a', edge: '#6e8a3a' },
    wood: { base: '#3f5c2a', a: '#55743a', b: '#2d4620', road: '#77603a', edge: '#4a6a30' },
    bridge: { base: '#648540', a: '#7a9a4c', b: '#4e6e34', road: '#9a8052', edge: '#5a7a3a' },
    marsh: { base: '#48583a', a: '#5e6e44', b: '#344430', road: '#6a5a3a', edge: '#4a5a36' },
    gate: { base: '#6c7248', a: '#808650', b: '#585e3a', road: '#8a8068', edge: '#6a7040' },
    hall: { base: '#5a544e' }, vault: { base: '#4a4852' },
  }[theme];
  g.fillStyle = P.base; g.fillRect(0, 0, w, h);
  const blob = (col, n, rmin, rmax, a) => { for (let i = 0; i < n; i++) { g.fillStyle = css(hex(col), a * (0.5 + R() * 0.5)); g.beginPath(); g.ellipse(R() * w, R() * h, rmin + R() * (rmax - rmin), (rmin + R() * (rmax - rmin)) * 0.7, R() * 3, 0, 7); g.fill(); } };
  if (L.indoor) {
    const flag = Tex.flag(theme === 'hall' ? '#6a645c' : '#54525c', L.seed % 7);
    const pat = g.createPattern(flag.image, 'repeat');
    const k = 0.5 * sx * 2;
    g.save(); g.scale(k, k); g.fillStyle = pat; g.fillRect(0, 0, w / k, h / k); g.restore();
    blob('#000000', 40, 40, 140, 0.12);
    if (theme === 'hall') {
      // red carpet
      const cx = 800 * sx, cw = 120 * sx;
      const cp = Tex.carpet();
      g.save(); g.translate(cx - cw / 2, 0); g.scale(cw / 128, (h / 256)); g.drawImage(cp.image, 0, 0); g.restore();
      // dais
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(560 * sx, 110 * sy, 480 * sx, 150 * sy);
    }
    if (L.boss && theme === 'vault') { g.strokeStyle = 'rgba(255,90,20,0.5)'; g.lineWidth = 3; for (let i = 0; i < 22; i++) { let x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 7; s++) { x += (R() - 0.5) * 60; y += (R() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); } }
    return c;
  }
  blob(P.a, 600, 8 * sx * 4, 26 * sx * 4, 0.25);
  blob(P.b, 600, 8 * sx * 4, 24 * sx * 4, 0.25);
  // fine speckle
  for (let i = 0; i < 9000; i++) { g.fillStyle = R() < 0.5 ? css(hex(P.a), 0.35) : css(hex(P.b), 0.35); g.fillRect(R() * w, R() * h, 1.5, 1.5 + R() * 2); }
  if (L.plots) for (const p of L.plots) { // crop rows
    g.save(); g.translate(p.x * sx, p.y * sy); g.rotate(p.rot);
    g.fillStyle = 'rgba(92,64,34,0.7)'; g.fillRect(-p.w / 2 * sx, -p.h / 2 * sy, p.w * sx, p.h * sy);
    for (let y = -p.h / 2; y < p.h / 2; y += 9) { g.fillStyle = (R() < 0.7) ? 'rgba(140,170,60,0.85)' : 'rgba(190,160,60,0.85)'; g.fillRect(-p.w / 2 * sx + 3, y * sy, (p.w - 6) * sx, 4 * sy); g.fillStyle = 'rgba(40,26,12,0.5)'; g.fillRect(-p.w / 2 * sx + 3, (y + 5) * sy, (p.w - 6) * sx, 2.5 * sy); }
    g.restore();
  }
  if (theme === 'marsh') { for (const pl of L.pools) { g.fillStyle = 'rgba(40,50,30,0.55)'; g.beginPath(); g.ellipse(pl.x * sx, pl.y * sy, (pl.r + 22) * sx, (pl.r + 18) * sy, 0, 0, 7); g.fill(); } blob('#2a3a28', 120, 10 * sx * 4, 30 * sx * 4, 0.2); }
  if (L.river) { // banks + wet mud
    g.fillStyle = 'rgba(80,64,40,0.8)'; g.fillRect((L.river.x0 - 26) * sx, 0, (L.river.x1 - L.river.x0 + 52) * sx, h);
    g.fillStyle = 'rgba(120,100,64,0.55)'; g.fillRect((L.river.x0 - 14) * sx, 0, (L.river.x1 - L.river.x0 + 28) * sx, h);
  }
  // road
  if (L.road) {
    const stroke = (wd, col, a) => { g.strokeStyle = css(hex(col), a); g.lineWidth = wd * sx; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); L.road.forEach(([x, y], i) => (i ? g.lineTo(x * sx, y * sy) : g.moveTo(x * sx, y * sy))); g.stroke(); };
    stroke(L.roadW * 2 + 26, P.edge, 0.35); stroke(L.roadW * 2 + 14, '#5a4630', 0.55); stroke(L.roadW * 2, P.road, 1);
    // wheel ruts + pebbles
    g.save(); g.globalAlpha = 0.5;
    for (const off of [-12, 12]) {
      g.strokeStyle = 'rgba(60,40,20,0.6)'; g.lineWidth = 3 * sx; g.beginPath();
      for (let i = 0; i < L.road.length - 1; i++) { const [x0, y0] = L.road[i], [x1, y1] = L.road[i + 1]; const a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2; const px = x0 + Math.cos(a) * off, py = y0 + Math.sin(a) * off; if (i) g.lineTo(px * sx, py * sy); else g.moveTo(px * sx, py * sy); }
      g.stroke();
    }
    g.restore();
    for (let i = 0; i < L.road.length - 1; i++) for (let k = 0; k < 14; k++) { const t = R(); const x = L.road[i][0] + (L.road[i + 1][0] - L.road[i][0]) * t + (R() - 0.5) * L.roadW * 1.7, y = L.road[i][1] + (L.road[i + 1][1] - L.road[i][1]) * t + (R() - 0.5) * L.roadW * 1.7; g.fillStyle = R() < 0.5 ? 'rgba(200,180,140,0.5)' : 'rgba(70,50,30,0.5)'; g.beginPath(); g.ellipse(x * sx, y * sy, (1 + R() * 2.4) * sx * 1.4, (1 + R() * 1.6) * sy * 1.4, R() * 3, 0, 7); g.fill(); }
  }
  if (theme === 'gate') { // courtyard cobbles near the gate
    const st = Tex.stone('#8a8678', { seed: 31, cobbles: true });
    const pat = g.createPattern(st.image, 'repeat');
    g.save(); g.globalAlpha = 0.9;
    g.beginPath(); g.moveTo(560 * sx, 150 * sy); g.lineTo(1040 * sx, 150 * sy); g.lineTo(1100 * sx, 420 * sy); g.lineTo(500 * sx, 420 * sy); g.closePath(); g.clip();
    g.scale(sx * 0.9, sy * 0.9); g.fillStyle = pat; g.fillRect(0, 0, w / sx / 0.9, h / sy / 0.9); g.restore();
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 0, w, 150 * sy);
  }
  return c;
}

/* ---------- sprites / blobs ---------- */
export function glowTexture() {
  return memo('glow', () => {
    const [c, g] = mkCanvas(64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return tex(c);
  });
}
export function discTexture() {
  return memo('disc', () => {
    const [c, g] = mkCanvas(64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return tex(c);
  });
}
