// Screenshot a local page with headless Chromium: node tools/shot.mjs <url> <out.png> [width height waitMs]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_DIR || 'playwright');
const [url, out, w = '1280', h = '720', wait = '0'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text().slice(0, 300)); });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)));
await p.goto(url, { waitUntil: 'load' });
await p.waitForFunction('window.__ready === true', null, { timeout: 180000 }).catch(() => console.log('ready timeout'));
if (+wait) await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
await b.close(); console.log('shot', out);
