// Placeholder / fallback 2D canvas renderer (used if WebGL is unavailable).
import { WORLD_W, WORLD_H } from './data.js';

const GROUND = { fields: '#5f7d3a', wood: '#3e5a2c', bridge: '#587a3c', marsh: '#4a5a3a', gate: '#6a6a50', hall: '#3a3430', vault: '#2c2a34' };
const ENEMY_COL = { grunt: '#8a8a7a', bowman: '#5a4a3a', wisp: '#ff9a3a', brute: '#6a5a4a', regent: '#2a2430' };

export function createRender2D(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 1, h = 1, dpr = 1, cam = { x: 800, y: 575, s: 1 };
  const api = {
    kind: '2d',
    resize(width, height, ratio) {
      w = width; h = height; dpr = ratio;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    },
    setStage() {},
    screenToWorld(cx, cy) { return { x: (cx - w / 2) / cam.s + cam.x, y: (cy - h / 2) / cam.s + cam.y }; },
    project(x, y, z = 0) { return { x: (x - cam.x) * cam.s + w / 2, y: (y - cam.y) * cam.s + h / 2 - z * cam.s * 0.8 }; },
    render(game) {
      const L = game.L, p = game.p;
      cam.s = Math.max(0.5, Math.min(w / (w < h ? 480 : 820), 2));
      cam.x = Math.max(w / 2 / cam.s, Math.min(WORLD_W - w / 2 / cam.s, p.x));
      cam.y = Math.max(h / 2 / cam.s, Math.min(WORLD_H - h / 2 / cam.s, p.y));
      if (WORLD_W * cam.s < w) cam.x = WORLD_W / 2;
      if (WORLD_H * cam.s < h) cam.y = WORLD_H / 2;
      const sx = game.shake ? (Math.random() - 0.5) * game.shake : 0, sy = game.shake ? (Math.random() - 0.5) * game.shake : 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0c0a08'; ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2 + sx, h / 2 + sy); ctx.scale(cam.s, cam.s); ctx.translate(-cam.x, -cam.y);
      ctx.fillStyle = GROUND[L.theme] || '#444'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      if (L.road) {
        ctx.strokeStyle = '#8a6c46'; ctx.lineWidth = L.roadW * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); L.road.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
      if (L.river) { ctx.fillStyle = '#3a6a9a'; ctx.fillRect(L.river.x0, 0, L.river.x1 - L.river.x0, WORLD_H); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(L.bridge.x0, L.bridge.y - 52, L.bridge.x1 - L.bridge.x0, 104); }
      for (const pl of L.pools) { ctx.fillStyle = '#2a3a2a'; ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#000'; ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (const o of L.obstacles) {
        if (o.t === 'c') { ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill(); }
        else { ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot); ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h); ctx.restore(); }
      }
      for (const z of game.zones) {
        if (z.kind === 'line') {
          ctx.strokeStyle = 'rgba(255,60,40,0.45)'; ctx.lineWidth = z.w; ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x2, z.y2); ctx.stroke(); continue;
        }
        const k = Math.min(1, z.t / (z.delay || 1));
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7);
        ctx.fillStyle = z.kind === 'rain' ? 'rgba(200,220,120,0.25)' : z.team === 'p' ? `rgba(255,140,40,${0.15 + 0.25 * k})` : `rgba(255,40,30,${0.15 + 0.3 * k})`; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      }
      for (const pk of game.pickups) {
        ctx.fillStyle = pk.kind === 'gold' ? '#ffd24a' : pk.kind === 'potion' ? '#ff6a8a' : pk.item.rarity === 'heroic' ? '#ff7a2e' : pk.item.rarity === 'rare' ? '#f1d04b' : pk.item.rarity === 'magic' ? '#5eaaff' : '#ddd';
        ctx.fillRect(pk.x - 5, pk.y - 5, 10, 10);
      }
      const ents = [...game.enemies, p].sort((a, b) => a.y - b.y);
      for (const e of ents) {
        const isP = e === p;
        const col = isP ? '#4a7ad8' : ENEMY_COL[e.type];
        ctx.globalAlpha = e.dead ? Math.max(0, 1 - e.deadT) : e.spawnT > 0 ? 0.4 : 1;
        ctx.fillStyle = (e.hitT > 0 || (isP && p.hitT > 0)) ? '#fff' : (e.enraged ? '#8a2a1a' : col);
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.face) * (e.r + 8), e.y + Math.sin(e.face) * (e.r + 8)); ctx.stroke();
        if (e.state === 'windup') { ctx.strokeStyle = '#ff4a3a'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4 + 6 * (e.atkT || 0), 0, 7); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      for (const q of game.proj) { ctx.fillStyle = q.team === 'p' ? (q.kind === 'bolt' ? '#ff9a3a' : '#f0e0b0') : q.kind === 'orb' ? '#ff6a2a' : '#c8a070'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
      for (const f of game.fx) {
        const k = f.t / f.dur; ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color || '#fff'; ctx.lineWidth = 3;
        if (f.type === 'slash') { ctx.beginPath(); ctx.arc(f.x, f.y, f.range, f.ang - f.arc * Math.PI / 360, f.ang + f.arc * Math.PI / 360); ctx.stroke(); }
        else if (f.r) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.3 + 0.7 * k), 0, 7); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    },
  };
  return api;
}
