// Headless check of the simulation: a bot that only clicks targets must clear every stage.
// Run with: npx vite-node tools/simtest.mjs
import { createGame, startStage, update, targetable } from '../src/game.js';
import { newSave } from '../src/save.js';
import { rollItem } from '../src/items.js';
import { CLASSES } from '../src/data.js';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
let fails = 0;
for (const cls of ['knight', 'ranger', 'mage']) {
  const save = newSave(cls); save.level = 12;
  for (const id of [1, 2, 3, 4, 5, 6, 'vault']) {
    if (id === 6) { save.level = 18; for (const slot of ['weapon', 'armor', 'charm']) save.equip[slot] = rollItem(Math.random, { slot, ilvl: 6, rarity: 'rare', cls }); }
    save.potions = 5;
    const g = createGame(save, {}); let won = null; g.cb.end = (r) => { won = r.won; };
    startStage(g, id, id === 'vault' ? 5 : 0);
    const inp = { mx: 0, my: 0, aim: null, dest: null, targetId: 0, attack: false, skills: [false, false, false], potion: false };
    let steps = 0;
    while (g.mode === 'stage' && steps++ < 60 * 400) {
      const p = g.p; let best = null, bd = 1e9;
      for (const e of g.enemies) { if (!targetable(e)) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
      const z = g.zones.find((q) => q.team === 'e' && !q.fired && q.kind !== 'line' && Math.hypot(p.x - q.x, p.y - q.y) < q.r + 18);
      if (z) { const dx = p.x - z.x || 1, dy = p.y - z.y, d = Math.hypot(dx, dy); inp.targetId = 0; inp.dest = { x: z.x + dx / d * (z.r + 60), y: z.y + dy / d * (z.r + 60) }; }
      else if (inp.dest && g.zones.some((q) => q.team === 'e' && !q.fired && q.kind !== 'line')) { /* keep dodging */ }
      else if (best) { inp.dest = null; inp.targetId = best.id; inp.aim = { x: best.x, y: best.y }; if (steps % 50 === 0) CLASSES[cls].skills.forEach((s, i) => { if (!['tumble', 'blink'].includes(s.id)) inp.skills[i] = true; }); }
      else { inp.targetId = 0; inp.dest = g.pickups[0] ? { x: g.pickups[0].x, y: g.pickups[0].y } : null; }
      if (p.hp < g.hero.maxHp * 0.45) inp.potion = true;
      update(g, 1 / 60, inp);
    }
    console.log(won ? 'ok  ' : 'FAIL', cls, 'stage', id, Math.round(steps / 60) + 's');
    if (!won) fails++;
  }
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
