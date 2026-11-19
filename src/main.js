// Highkeep Road: bootstraps screens, renderer and the main loop.
import './style.css';
import { createGame, startStage, update, makeEnemy } from './game.js';
import { loadSave, writeSave, newSave, loadSettings, writeSettings } from './save.js';
import { createInput } from './input.js';
import { createOverlay } from './overlay.js';
import { createHUD } from './hud.js';
import { createUI } from './ui.js';
import { createRenderer } from './renderer.js';

const $ = (id) => document.getElementById(id);
const els = { game: $('game'), gl: $('gl'), overlay: $('overlay'), hud: $('hud'), pause: $('pause'), screen: $('screen') };

let settings = loadSettings();
const game = createGame(loadSave(), settings);
const input = createInput({ game: els.game, hud: els.hud });
input.game = game;
const overlay = createOverlay(els.overlay);
const hud = createHUD(els.hud);
let renderer = null;

function persist() { if (game.save) writeSave(game.save); }

const api = {
  pauseEl: els.pause,
  save: () => game.save,
  persist,
  newGame(cls) { game.save = newSave(cls); persist(); renderer.clear(); api.toCamp(); },
  toCamp() {
    stopStage(); persist();
    ui.state.tab = 'map'; ui.state.sel = null; ui.state.eqSel = null; ui.state.bagSel = null;
    showHub(true);
    ui.showCamp();
  },
  toTitle() { stopStage(); persist(); showHub(false); ui.showTitle(); },
  march(id, floor) {
    if (!game.save) return;
    if (id === 'vault' ? game.save.cleared < 6 : id > game.save.cleared + 1) return;
    ui.hide(); ui.hidePause();
    hud.setClass(game.save.cls);
    els.hud.classList.remove('hidden');
    input.reset(); input.enabled = true; document.body.classList.add('playing');
    startStage(game, id, floor);
    renderer.setStage(game);
    onResize();
  },
  async marchWithLoading(id, floor) {
    const el = $('loading');
    el.classList.remove('hidden');
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    try { api.march(id, floor); } finally { el.classList.add('hidden'); }
  },
  resume() { game.paused = false; ui.hidePause(); },
  quit() { ui.hidePause(); api.toCamp(); },
  setGfx(v) { settings.gfx = v; game.settings = settings; writeSettings(settings); renderer.setQuality?.(v); if (game.mode === 'stage') renderer.setStage(game); onResize(); },
};
const ui = createUI(els.screen, api);

game.cb.end = (res) => {
  input.enabled = false; input.reset(); document.body.classList.remove('playing');
  persist();
  els.hud.classList.add('hidden');
  ui.showResult(res);
};

function stopStage() {
  game.mode = 'idle'; game.paused = false; input.enabled = false; input.reset(); document.body.classList.remove('playing');
  els.hud.classList.add('hidden'); ui.hidePause(); overlay.clear();
  
}

input.onPause = () => {
  if (game.mode !== 'stage') return;
  if (game.paused) api.resume(); else { game.paused = true; ui.showPause(settings.gfx); }
};
document.addEventListener('visibilitychange', () => { if (!document.hidden) return; persist(); if (game.mode === 'stage' && !game.paused) input.onPause(); });
addEventListener('pagehide', persist);

function onResize() {
  const w = innerWidth, h = innerHeight;
  document.documentElement.style.setProperty('--u', Math.min(1, Math.max(0.56, Math.min(w / 860, h / 560))).toFixed(3));
  const dprCap = settings.gfx === 'low' ? 1 : 2;
  const dpr = Math.min(devicePixelRatio || 1, dprCap);
  renderer.resize(w, h, dpr);
  overlay.resize(w, h, Math.min(devicePixelRatio || 1, settings.gfx === 'low' ? 1.5 : 2));
}
addEventListener('resize', onResize);

async function initRenderer() {
  const bar = document.querySelector('#loading i');
  renderer = await createRenderer(els.gl, settings, (k) => { if (bar) bar.style.width = `${Math.round(k * 100)}%`; });
  input.view = renderer;
}

function showHub(side) { renderer?.setHub(game.save ? game.save.cls : 'knight', side); }

let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (game.mode === 'idle') { renderer.render(game, dt); return; }
  if (game.mode === 'stage' && !game.paused) {
    input.update();
    game.targetId = input.targetId;
    acc += dt;
    let n = 0;
    while (acc >= 1 / 60 && n++ < 5) { update(game, 1 / 60, input); acc -= 1 / 60; }
    if (n >= 5) acc = 0;
  } else acc = 0;
  renderer.render(game, dt);
  overlay.draw(game, renderer.project);
  if (game.mode === 'stage') hud.update(game, renderer.hoverId);
}

(async function boot() {
  try {
    $('loading').classList.remove('hidden');
    await initRenderer();
    $('loading').classList.add('hidden');
    onResize();
    showHub(false);
    ui.showTitle();
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    const f = $('fatal'); f.classList.remove('hidden'); f.textContent = 'Highkeep Road could not start: ' + err.message;
  }
})();

window.__hk = { game, input, ui, api, hud, update, makeEnemy, get renderer() { return renderer; } };
