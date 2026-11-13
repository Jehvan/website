// Drive the real game in headless Chromium and take screenshots.
// node tools/play.mjs <out-prefix> <class> <stage> [seconds] [w] [h]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_DIR || 'playwright');
const [out, cls = 'knight', stage = '1', secs = '6', w = '1280', h = '720'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 400)); });
p.on('pageerror', (e) => console.log('[pageerror]', String(e.stack || e).slice(0, 600)));
await p.goto(process.env.URL || 'http://localhost:5199/', { waitUntil: 'load' });
await p.waitForFunction('window.__hk && window.__hk.renderer', null, { timeout: 240000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: out + '_title.png' });
if (stage !== 'none') {
  await p.evaluate(([c]) => { const k = window.__hk; k.api.newGame(c); k.game.save.level = 8; k.game.save.cleared = 6; }, [cls]);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '_camp.png' });
  await p.evaluate(([s]) => { const k = window.__hk; k.game.god = true; k.api.march(s === 'vault' ? 'vault' : +s, s === 'vault' ? 5 : 0); }, [stage]);
  // let the bot fight: target the nearest enemy, like a player clicking
  await p.evaluate(() => { const k = window.__hk; window.__bot = setInterval(() => { const g = k.game, pl = g.p; if (!pl || g.mode !== 'stage') return; let best = null, bd = 1e9; for (const e of g.enemies) { if (e.dead || e.spawnT > 0.3) continue; const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < bd) { bd = d; best = e; } } k.input.targetId = best ? best.id : 0; }, 200); });
  await p.waitForTimeout(+secs * 1000);
  await p.screenshot({ path: out + '_stage.png' });
}
await b.close(); console.log('done');
