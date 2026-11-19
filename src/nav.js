// Grid navigation: A* paths for click-to-move and a shared flow field that leads enemies around obstacles.
import { pointBlocked } from './world.js';

const CELL = 16;

export function buildNav(L, radius = 13) {
  const w = Math.ceil(L.w / CELL), h = Math.ceil(L.h / CELL);
  const blocked = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) blocked[y * w + x] = pointBlocked(L, (x + 0.5) * CELL, (y + 0.5) * CELL, radius) ? 1 : 0;
  return { L, w, h, blocked, field: new Int32Array(w * h), fieldKey: -1, fieldT: -1, radius };
}

const cellOf = (nav, x, y) => Math.max(0, Math.min(nav.h - 1, Math.floor(y / CELL))) * nav.w + Math.max(0, Math.min(nav.w - 1, Math.floor(x / CELL)));

function nearestFree(nav, c) {
  if (!nav.blocked[c]) return c;
  const cx = c % nav.w, cy = Math.floor(c / nav.w);
  for (let r = 1; r < 14; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= nav.w || y >= nav.h) continue;
      if (!nav.blocked[y * nav.w + x]) return y * nav.w + x;
    }
  }
  return c;
}

/** True when a body of the nav radius can walk the straight segment. */
export function lineClear(nav, ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 8);
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    if (nav.blocked[cellOf(nav, x, y)] && pointBlocked(nav.L, x, y, nav.radius - 3)) return false;
  }
  return true;
}

const NB = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];

/** A* from (sx, sy) to (tx, ty); returns smoothed waypoints in world px (excluding the start), or [] if unreachable. */
export function findPath(nav, sx, sy, tx, ty) {
  if (lineClear(nav, sx, sy, tx, ty)) return [{ x: tx, y: ty }];
  const { w, h, blocked } = nav;
  const start = nearestFree(nav, cellOf(nav, sx, sy)), goal = nearestFree(nav, cellOf(nav, tx, ty));
  const g = new Int32Array(w * h).fill(1e9), from = new Int32Array(w * h).fill(-1), closed = new Uint8Array(w * h);
  const gx = goal % w, gy = Math.floor(goal / w);
  const heur = (c) => { const dx = Math.abs(c % w - gx), dy = Math.abs(Math.floor(c / w) - gy); return 10 * (dx + dy) - 6 * Math.min(dx, dy); };
  // binary heap of [f, cell]
  const heap = [];
  const push = (f, c) => { let i = heap.length; heap.push([f, c]); while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
    return top;
  };
  g[start] = 0; push(heur(start), start);
  let found = false, guard = 0;
  while (heap.length && guard++ < 20000) {
    const c = pop()[1];
    if (closed[c]) continue;
    closed[c] = 1;
    if (c === goal) { found = true; break; }
    const cx = c % w, cy = Math.floor(c / w);
    for (const [dx, dy, cost] of NB) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const n = y * w + x;
      if (blocked[n] || closed[n]) continue;
      if (dx && dy && (blocked[cy * w + x] || blocked[y * w + cx])) continue;      // no corner cutting
      const ng = g[c] + cost;
      if (ng < g[n]) { g[n] = ng; from[n] = c; push(ng + heur(n), n); }
    }
  }
  if (!found) return [];
  const cells = [];
  for (let c = goal; c !== -1 && c !== start; c = from[c]) cells.push(c);
  cells.reverse();
  const pts = cells.map((c) => ({ x: (c % w + 0.5) * CELL, y: (Math.floor(c / w) + 0.5) * CELL }));
  if (!blocked[cellOf(nav, tx, ty)]) pts.push({ x: tx, y: ty });
  // string pulling: skip waypoints we can walk straight past
  const out = [];
  let ax = sx, ay = sy, i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !lineClear(nav, ax, ay, pts[j].x, pts[j].y)) j--;
    out.push(pts[j]); ax = pts[j].x; ay = pts[j].y; i = j + 1;
  }
  return out;
}

/** Distance field to (tx, ty), refreshed at most a few times a second; enemies walk downhill on it. */
export function updateField(nav, tx, ty, time) {
  const key = nearestFree(nav, cellOf(nav, tx, ty));
  if (key === nav.fieldKey || time - nav.fieldT < 0.2) return;
  nav.fieldKey = key; nav.fieldT = time;
  const { w, h, blocked, field } = nav;
  field.fill(1e9);
  const q = new Int32Array(w * h); let qh = 0, qt = 0;
  field[key] = 0; q[qt++] = key;
  while (qh < qt) {
    const c = q[qh++], cx = c % w, cy = Math.floor(c / w), d = field[c] + 1;
    for (let k = 0; k < 4; k++) {
      const x = cx + NB[k][0], y = cy + NB[k][1];
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const n = y * w + x;
      if (blocked[n] || field[n] <= d) continue;
      field[n] = d; q[qt++] = n;
    }
  }
}

/** Heading (radians) that follows the flow field from (x, y), or null when there is no route. */
export function fieldHeading(nav, x, y) {
  const { w, h, field } = nav;
  const c = nearestFree(nav, cellOf(nav, x, y)), cx = c % w, cy = Math.floor(c / w);
  let best = field[c], bx = 0, by = 0;
  for (const [dx, dy] of NB) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const n = ny * w + nx;
    if (dx && dy && (nav.blocked[cy * w + nx] || nav.blocked[ny * w + cx])) continue;
    if (field[n] < best) { best = field[n]; bx = dx; by = dy; }
  }
  if (!bx && !by) return null;
  // aim at the centre of the next cell so bodies do not scrape corners
  return Math.atan2((cy + by + 0.5) * CELL - y, (cx + bx + 0.5) * CELL - x);
}
