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

export function buildLayout(theme, seed = 1, opts = {}) {
  const R = rng(seed * 7919 + theme.length * 131);
  const L = {
    theme, w: W, h: H, seed, indoor: false, road: null, roadW: 40,
    bounds: { x0: 30, y0: 30, x1: W - 30, y1: H - 30 },
    props: [], obstacles: [], lights: [], river: null, bridge: null, pools: [],
    start: { x: 150, y: 600 }, boss: !!opts.boss, floor: opts.floor || 0,
  };
  const occupied = [];

  const addObstacle = (o) => { L.obstacles.push(o); };
  const free = (x, y, r, roadClear = 0) => {
    const b = L.bounds;
    if (x < b.x0 + r || x > b.x1 - r || y < b.y0 + r || y > b.y1 - r) return false;
    if (roadClear && distToRoad(L.road, x, y) < roadClear + r) return false;
    if (Math.hypot(x - L.start.x, y - L.start.y) < 120 + r) return false;
    for (const o of occupied) if (Math.hypot(x - o.x, y - o.y) < o.r + r) return false;
    if (L.river && x > L.river.x0 - 30 - r && x < L.river.x1 + 30 + r) return false;
    for (const p of L.pools) if (Math.hypot(x - p.x, y - p.y) < p.r + r) return false;
    return true;
  };
  const prop = (kind, x, y, extra = {}) => { const p = { kind, x, y, rot: extra.rot ?? R() * Math.PI * 2, s: extra.s ?? 1, ...extra }; L.props.push(p); return p; };
  // scatter `n` props of `kind`; `r` = blocking radius (0 = decorative).
  const scatter = (kind, n, { r = 0, clear = 0, s0 = 0.8, s1 = 1.25, tries = 40, area = null, collide = r > 0, extra } = {}) => {
    let placed = 0;
    for (let i = 0; i < n * tries && placed < n; i++) {
      const b = area || L.bounds;
      const x = b.x0 + R() * (b.x1 - b.x0), y = b.y0 + R() * (b.y1 - b.y0);
      const s = s0 + R() * (s1 - s0);
      if (!free(x, y, r * s * 0.8, clear)) continue;
      const p = prop(kind, x, y, { s, ...(extra ? extra(R) : {}) });
      if (collide) { const o = { x, y, r: r * s }; occupied.push(o); addObstacle({ t: 'c', ...o }); }
      else if (r) occupied.push({ x, y, r: r * s * 0.5 });
      placed++;
    }
    return placed;
  };
  const rectObstacle = (cx, cy, w, h, rot = 0) => addObstacle({ t: 'r', x: cx, y: cy, w, h, rot });
  const block = (x, y, r) => occupied.push({ x, y, r });

  switch (theme) {
    case 'fields': {
      L.road = sineRoad((x) => 640 + 190 * Math.sin(x / 250 + 0.6));
      L.start = { x: 120, y: L.road[2][1] };
      // crop plots painted on the ground
      L.plots = [];
      for (let i = 0; i < 6; i++) {
        const x = 200 + R() * 1200, y = 120 + R() * 900;
        if (distToRoad(L.road, x, y) > 140) L.plots.push({ x, y, w: 150 + R() * 100, h: 90 + R() * 80, rot: (R() - 0.5) * 0.3 });
      }
      // cottages
      const spots = [[420, 330], [980, 250], [1180, 900], [600, 940], [1380, 520]];
      for (const [cx, cy] of spots) {
        if (distToRoad(L.road, cx, cy) < 110) continue;
        const rot = (R() - 0.5) * 0.5;
        prop('cottage', cx, cy, { rot, s: 0.9 + R() * 0.3 });
        rectObstacle(cx, cy, 120, 84, rot); block(cx, cy, 90);
      }
      // fences
      for (const [fx, fy, len, vert] of [[330, 420, 6, 0], [900, 330, 5, 0], [1080, 820, 6, 1], [540, 860, 5, 0]]) {
        if (distToRoad(L.road, fx, fy) < 100) continue;
        for (let i = 0; i < len; i++) {
          const x = fx + (vert ? 0 : i * 34), y = fy + (vert ? i * 34 : 0);
          prop('fence', x, y, { rot: vert ? Math.PI / 2 : 0, s: 1 });
        }
        rectObstacle(fx + (vert ? 0 : len * 17 - 17), fy + (vert ? len * 17 - 17 : 0), vert ? 8 : len * 34, vert ? len * 34 : 8);
      }
      scatter('hay', 9, { r: 18, clear: 70 });
      scatter('tree', 16, { r: 15, clear: 70, s0: 0.9, s1: 1.4 });
      scatter('rock', 12, { r: 12, clear: 50 });
      scatter('lamp', 4, { r: 6, clear: 0, collide: false });
      break;
    }
    case 'wood': {
      L.road = sineRoad((x) => 560 + 220 * Math.sin(x / 210 + 2.0));
      L.start = { x: 110, y: L.road[2][1] };
      scatter('tree', 105, { r: 16, clear: 62, s0: 0.9, s1: 1.7, extra: (Rn) => ({ pine: Rn() < 0.4 }) });
      scatter('logs', 7, { r: 18, clear: 60 });
      scatter('rock', 14, { r: 13, clear: 45 });
      scatter('lamp', 3, { r: 6, clear: 0, collide: false });
      break;
    }
    case 'bridge': {
      L.road = sineRoad((x) => 575 + 160 * Math.sin(x / 320 + 1) * smooth(0, 200, Math.abs(x - 800)));
      L.start = { x: 120, y: L.road[2][1] };
      L.river = { x0: 735, x1: 865 };
      const by = 575;
      L.bridge = { x0: 705, x1: 895, y: by, w: 104 };
      rectObstacle(800, (by - 52) / 2, 130, by - 52);
      rectObstacle(800, by + 52 + (H - by - 52) / 2, 130, H - by - 52);
      // bridge rails (collision on edges)
      rectObstacle(800, by - 54, 130, 8); rectObstacle(800, by + 54, 130, 8);
      prop('bridge', 800, by, { rot: 0 });
      for (const lx of [740, 860]) for (const ly of [by - 54, by + 54]) prop('lamp', lx, ly, { s: 1 });
      prop('cottage', 540, 330, { rot: 0.2, s: 1.1 }); rectObstacle(540, 330, 120, 84, 0.2); block(540, 330, 90);
      prop('cottage', 1090, 840, { rot: -0.2, s: 1.0 }); rectObstacle(1090, 840, 120, 84, -0.2); block(1090, 840, 90);
      scatter('tree', 34, { r: 15, clear: 70, s0: 0.9, s1: 1.5 });
      scatter('rock', 14, { r: 12, clear: 50 });
      scatter('fence', 8, { clear: 70, collide: false, r: 0 });
      break;
    }
    case 'marsh': {
      L.road = sineRoad((x) => 600 + 200 * Math.sin(x / 240 + 3.5));
      L.start = { x: 120, y: L.road[2][1] };
      // pools
      for (let i = 0; i < 12; i++) {
        const x = 200 + R() * 1200, y = 100 + R() * 950, r = 50 + R() * 70;
        if (distToRoad(L.road, x, y) > r + 60 && Math.hypot(x - L.start.x, y - L.start.y) > r + 150 && !L.pools.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + r + 20)) {
          L.pools.push({ x, y, r }); addObstacle({ t: 'c', x, y, r: r * 0.9 }); occupied.push({ x, y, r });
        }
      }
      // ruined walls and columns
      for (let i = 0; i < 4; i++) {
        const x = 300 + R() * 1000, y = 150 + R() * 850;
        if (!free(x, y, 70, 90)) continue;
        const rot = R() * Math.PI;
        prop('ruin', x, y, { rot, s: 1 + R() * 0.4 });
        rectObstacle(x, y, 110, 24, rot); block(x, y, 80);
      }
      scatter('column', 6, { r: 14, clear: 70, s0: 0.8, s1: 1.2 });
      scatter('deadtree', 36, { r: 12, clear: 55, s0: 0.9, s1: 1.6 });
      scatter('rock', 12, { r: 12, clear: 40 });
      scatter('lamp', 3, { r: 6, clear: 0, collide: false });
      break;
    }
    case 'gate': {
      L.road = smoothPath([[-40, 1010], [200, 990], [420, 910], [560, 780], [540, 620], [650, 480], [770, 380], [800, 250], [800, 120]]);
      L.start = { x: 120, y: 1000 };
      // wall across the top with gate at x=800
      rectObstacle(350, 85, 700, 140); rectObstacle(1250, 85, 700, 140);
      rectObstacle(800, 85, 200, 120); // portcullis (closed)
      for (const tx of [60, 690, 910, 1540]) { prop('tower', tx, 110, { s: tx === 60 || tx === 1540 ? 1.1 : 1.0 }); addObstacle({ t: 'c', x: tx, y: 120, r: 58 }); }
      prop('wall', 350, 85, { w: 700 }); prop('wall', 1250, 85, { w: 700 });
      prop('portcullis', 800, 120);
      for (const bx of [250, 500, 1100, 1350]) prop('banner', bx, 160, { s: 1 });
      for (const bx of [740, 860]) prop('banner', bx, 168, { s: 1.15 });
      for (const lx of [690, 910]) for (const ly of [420, 680]) { prop('brazier', lx, ly, {}); addObstacle({ t: 'c', x: lx, y: ly, r: 11 }); block(lx, ly, 14); L.lights.push({ x: lx, y: ly }); }
      scatter('rock', 10, { r: 12, clear: 55 });
      scatter('tree', 14, { r: 15, clear: 70, area: { x0: 30, y0: 450, x1: 400, y1: 1120 } });
      scatter('tree', 14, { r: 15, clear: 70, area: { x0: 1100, y0: 450, x1: 1570, y1: 1120 } });
      scatter('hay', 3, { r: 18, clear: 70 });
      scatter('lamp', 5, { r: 6, clear: 0, collide: false });
      break;
    }
    case 'hall': {
      L.indoor = true; L.bounds = { x0: 130, y0: 150, x1: W - 130, y1: H - 70 };
      L.start = { x: 800, y: 1020 };
      prop('throne', 800, 190); addObstacle({ t: 'r', x: 800, y: 175, w: 130, h: 80, rot: 0 });
      for (const px of [380, 1220]) for (const py of [290, 500, 710, 920]) {
        prop('pillar', px, py); addObstacle({ t: 'c', x: px, y: py, r: 22 }); block(px, py, 28);
      }
      for (const [bx, by] of [[560, 400], [1040, 400], [560, 820], [1040, 820], [660, 230], [940, 230]]) {
        prop('brazier', bx, by); addObstacle({ t: 'c', x: bx, y: by, r: 11 }); block(bx, by, 14); L.lights.push({ x: bx, y: by });
      }
      prop('carpet', 800, 640);
      for (const bx of [250, 1350]) prop('banner', bx, 160);
      break;
    }
    case 'vault': {
      L.indoor = true;
      L.bounds = { x0: 110, y0: 110, x1: W - 110, y1: H - 90 };
      L.start = { x: 800, y: 980 };
      const n = L.boss ? 6 : 8 + Math.floor(R() * 7);
      for (let i = 0; i < n * 20 && L.props.filter((p) => p.kind === 'pillar').length < n; i++) {
        const x = L.bounds.x0 + 60 + R() * (L.bounds.x1 - L.bounds.x0 - 120), y = L.bounds.y0 + 60 + R() * (L.bounds.y1 - L.bounds.y0 - 200);
        if (!free(x, y, 40)) continue;
        prop('pillar', x, y, { rot: 0 }); addObstacle({ t: 'c', x, y, r: 22 }); block(x, y, 36);
      }
      const nb = 4 + Math.floor(R() * 3);
      for (let i = 0; i < nb * 20 && L.lights.length < nb; i++) {
        const x = L.bounds.x0 + 40 + R() * (L.bounds.x1 - L.bounds.x0 - 80), y = L.bounds.y0 + 40 + R() * (L.bounds.y1 - L.bounds.y0 - 120);
        if (!free(x, y, 30)) continue;
        prop('brazier', x, y); addObstacle({ t: 'c', x, y, r: 11 }); block(x, y, 24); L.lights.push({ x, y });
      }
      scatter('rock', 10, { r: 10, clear: 0, collide: false });
      break;
    }
  }
  // grass tufts everywhere outdoors (decorative)
  if (!L.indoor) {
    const dens = { fields: 380, wood: 300, bridge: 320, marsh: 260, gate: 220 }[theme] || 250;
    scatter('grass', dens, { r: 0, clear: 36, tries: 3, collide: false, s0: 0.7, s1: 1.4 });
  }
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
