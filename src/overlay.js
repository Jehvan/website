// 2D overlay canvas: enemy health bars, damage numbers, boss bar. Works with any renderer's project().
export function createOverlay(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  const api = {
    resize(width, height, ratio) {
      w = width; h = height; dpr = ratio;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    },
    clear() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); },
    draw(game, project) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!game.p) return;
      ctx.textAlign = 'center';
      let boss = null;
      // health bars
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (e.def.boss) { boss = e; continue; }
        if (e.hp >= e.maxHp && e.hitT <= 0 && e.spawnT <= 0 && e.state !== 'windup') continue;
        const tall = e.type === 'brute' ? 62 : e.type === 'wisp' ? 40 : 46;
        const s = project(e.x, e.y, tall);
        if (!s) continue;
        const bw = e.type === 'brute' ? 46 : 32;
        ctx.fillStyle = 'rgba(10,6,4,0.75)'; ctx.fillRect(s.x - bw / 2 - 1, s.y - 1, bw + 2, 6);
        ctx.fillStyle = e.hp / e.maxHp > 0.35 ? '#d84a3a' : '#ff8a2a';
        ctx.fillRect(s.x - bw / 2, s.y, bw * Math.max(0, e.hp / e.maxHp), 4);
      }
      // damage numbers
      for (const t of game.texts) {
        const s = project(t.x, t.y, t.z);
        if (!s) continue;
        const k = t.t / t.dur;
        ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
        const sc = t.crit ? 1 + Math.max(0, 0.35 - t.t) * 1.5 : 1;
        ctx.font = `700 ${Math.round(t.size * sc)}px Georgia, serif`;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(15,8,4,0.9)'; ctx.strokeText(t.text, s.x, s.y);
        ctx.fillStyle = t.color; ctx.fillText(t.text, s.x, s.y);
      }
      ctx.globalAlpha = 1;
      // boss bar
      if (boss) {
        const bw = Math.min(520, w - 40), x = (w - bw) / 2, y = 66;
        ctx.fillStyle = 'rgba(10,6,4,0.8)'; ctx.fillRect(x - 3, y - 3, bw + 6, 20);
        ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 3, y - 3, bw + 6, 20);
        const g = ctx.createLinearGradient(x, 0, x + bw, 0);
        g.addColorStop(0, boss.enraged ? '#ff4a1a' : '#b8281c'); g.addColorStop(1, boss.enraged ? '#ff9a2a' : '#e8563a');
        ctx.fillStyle = g; ctx.fillRect(x, y, bw * Math.max(0, boss.hp / boss.maxHp), 14);
        ctx.font = '700 13px Georgia, serif'; ctx.fillStyle = '#f2e4c4';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(boss.def.name, w / 2, y - 7); ctx.fillText(boss.def.name, w / 2, y - 7);
      }
    },
  };
  return api;
}
