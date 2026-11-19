import LAYOUTS from './layouts.json';

// Stage layouts: deterministic props, road, obstacles. Shared by sim and renderers.
import { WORLD_W as W, WORLD_H as H } from './data.js';

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distToRoad(road, x, y) {
  if (!road) return 9999;
  let d = 9999;
  for (let i = 0; i < road.length - 1; i++) {
    d = Math.min(d, distSeg(x, y, road[i][0], road[i][1], road[i + 1][0], road[i + 1][1]));
  }
  return d;
}

function sineRoad(fn) {
  const pts = [];
  for (let x = -40; x <= W + 40; x += 60) pts.push([x, fn(x)]);
  return pts;
}

// Smooth a hand-authored control polyline (Catmull-Rom) into a dense one.
function smoothPath(ctrl, per = 8) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

// Layouts are baked (tools/ + the original generator) into layouts.json: stage1..6, vault1..40, town.
export function buildLayout(theme, seed = 1, opts = {}) {
  const name = theme === 'vault' ? `vault${((Math.max(1, opts.floor || 1) - 1) % 40) + 1}` : theme === 'town' ? 'town' : `stage${seed}`;
  const L = JSON.parse(JSON.stringify(LAYOUTS[name]));
  L.name = name;
  return L;
}

// Resolve circle (x,y,r) against world bounds and obstacles. Mutates & returns entity.
export function resolveMove(L, e, r = e.r) {
  const b = L.bounds;
  if (e.x < b.x0 + r) e.x = b.x0 + r; else if (e.x > b.x1 - r) e.x = b.x1 - r;
  if (e.y < b.y0 + r) e.y = b.y0 + r; else if (e.y > b.y1 - r) e.y = b.y1 - r;
  const obs = L.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (o.t === 'c') {
      const dx = e.x - o.x, dy = e.y - o.y, rr = o.r + r;
      if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.001;
        e.x = o.x + (dx / d) * rr; e.y = o.y + (dy / d) * rr;
      }
    } else {
      // oriented rect: transform to local
      const c = Math.cos(-o.rot), s = Math.sin(-o.rot);
      const lx = (e.x - o.x) * c - (e.y - o.y) * s, ly = (e.x - o.x) * s + (e.y - o.y) * c;
      const hw = o.w / 2, hh = o.h / 2;
      const cx = Math.max(-hw, Math.min(hw, lx)), cy = Math.max(-hh, Math.min(hh, ly));
      const dx = lx - cx, dy = ly - cy, d2 = dx * dx + dy * dy;
      let nx, ny;
      if (d2 > r * r) continue;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); nx = cx + (dx / d) * r; ny = cy + (dy / d) * r; }
      else { // centre inside rect: push out along shortest axis
        const px = hw - Math.abs(lx), py = hh - Math.abs(ly);
        if (px < py) { nx = Math.sign(lx || 1) * (hw + r); ny = ly; } else { nx = lx; ny = Math.sign(ly || 1) * (hh + r); }
      }
      const cs = Math.cos(o.rot), sn = Math.sin(o.rot);
      e.x = o.x + nx * cs - ny * sn; e.y = o.y + nx * sn + ny * cs;
    }
  }
  return e;
}

export function pointBlocked(L, x, y, r = 4) {
  const t = { x, y };
  resolveMove(L, t, r);
  return Math.abs(t.x - x) > 0.5 || Math.abs(t.y - y) > 0.5;
}
