// Game state and simulation: stage flow, player, enemies, combat, loot.
import { CLASSES, ENEMIES, STAGES, stageById, MAX_POTIONS, WORLD_W, skillMul, skillCdMul, ARTIFACTS, ART_MAX } from './data.js';
import { buildLayout, resolveMove, pointBlocked, rng } from './world.js';
import { heroStats, rollItem, rollRarity, addXp, armorMul, rarityOf } from './items.js';

const TAU = Math.PI * 2;
const R = Math.random;
const rand = (a, b) => a + R() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return Math.abs(d); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(save, settings) {
  return {
    save, settings, hero: save ? heroStats(save) : null, mode: 'idle', paused: false, time: 0,
    p: null, enemies: [], proj: [], zones: [], pickups: [], fx: [], texts: [], spawnQ: [],
    L: null, stage: null, run: null, shake: 0, banner: null, god: false,
    cb: { end() {}, levelUp() {}, toast() {} },
    nextId: 1,
  };
}

/* ---------- stage setup ---------- */

function vaultWaves(floor, boss) {
  const Rn = rng(floor * 977 + 13);
  const waves = [];
  const n = boss ? 2 : Math.min(4, 2 + Math.floor(floor / 3));
  const budget = 6 + floor * 1.4;
  const costs = { grunt: 1, bowman: 1.3, wisp: 0.8, brute: 4 };
  const weights = { grunt: 5, bowman: 3, wisp: 3, brute: 1 + floor * 0.15 };
  for (let w = 0; w < n; w++) {
    const counts = {};
    let left = budget * (0.7 + w * 0.2) / (boss ? 1.3 : 1);
    let guard = 0;
    while (left > 0.8 && guard++ < 60) {
      const keys = Object.keys(weights);
      let t = Rn() * keys.reduce((a, k) => a + weights[k], 0), pick = keys[0];
      for (const k of keys) { t -= weights[k]; if (t <= 0) { pick = k; break; } }
      if (costs[pick] > left && pick === 'brute') continue;
      counts[pick] = (counts[pick] || 0) + 1; left -= costs[pick];
    }
    waves.push(Object.entries(counts).map(([type, n2]) => ({ type, n: Math.min(n2, 14) })));
  }
  if (boss) waves.push([{ type: 'regent', n: 1 }]);
  return waves;
}

export function startStage(game, id, floor = 0) {
  const def = stageById(id);
  const isVault = id === 'vault';
  const boss = isVault ? floor % 5 === 0 : id === 6;
  const L = buildLayout(def.theme, isVault ? 1000 + floor : id, { floor, boss: isVault && boss });
  const hero = heroStats(game.save);
  game.hero = hero;
  const sIdx = isVault ? 5 + floor * 0.35 : id - 1;
  game.diff = { hp: 1 + 0.5 * sIdx, dmg: 1 + 0.28 * sIdx, xp: 1 + 0.3 * sIdx, gold: 1 + 0.3 * sIdx, s: sIdx };
  game.L = L; game.mode = 'stage'; game.paused = false;
  game.enemies = []; game.proj = []; game.zones = []; game.pickups = []; game.fx = []; game.texts = []; game.spawnQ = [];
  game.shake = 0; game.time = 0;
  game.run = { kills: 0, steel: 0, gold: 0, xp: 0, items: [], levels: 0, potions: 0, startLevel: game.save.level, firstClear: false };
  game.p = {
    x: L.start.x, y: L.start.y, r: 12, face: 0, hp: hero.maxHp, mp: hero.maxMp, vx: 0, vy: 0,
    atkCd: 0, atkT: -1, atkDur: 0.3, hitT: 0, invuln: 0, grace: 0, dash: null, spin: null,
    dmgBuff: 0, cd: [0, 0, 0], potCd: 0, walkPhase: 0, moving: false, dead: false, deadT: 0,
    skillAnim: null, skillT: 0, moveAng: 0, speedMul: 1,
  };
  const waves = isVault ? vaultWaves(floor, boss) : def.waves;
  game.stage = { id, def, floor, waves, waveIdx: -1, state: 'intro', t: 2.2, boss, name: isVault ? `${def.name} - Floor ${floor}` : def.name };
  setBanner(game, game.stage.name, isVault ? (boss ? 'A warlord stirs below' : 'Descend') : `Suggested power ${def.power}`, 2.2);
}

function setBanner(game, text, sub, t = 2) { game.banner = { text, sub, t, dur: t }; }

function startWave(game) {
  const st = game.stage;
  st.waveIdx++;
  st.state = 'fight';
  const wave = st.waves[st.waveIdx];
  const total = st.waves.length;
  const isBoss = wave.some((g) => g.type === 'regent');
  setBanner(game, isBoss ? 'The Ashen Regent' : `Wave ${st.waveIdx + 1} / ${total}`, isBoss ? 'Boss' : '', 1.6);
  let t = 0;
  const list = [];
  for (const g of wave) for (let i = 0; i < g.n; i++) list.push(g.type);
  // shuffle for variety
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  for (const type of list) { game.spawnQ.push({ t, type }); t += type === 'regent' ? 0 : 0.18; }
}

const sideOf = (L, x) => (!L.river ? 0 : x < L.river.x0 ? -1 : x > L.river.x1 ? 1 : 0);

function spawnPoint(game, type) {
  const { L, p } = game;
  const psd = sideOf(L, p.x);
  for (let i = 0; i < 60; i++) {
    const a = R() * TAU, d = type === 'regent' ? 330 : rand(340, 560);
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    const b = L.bounds;
    if (x < b.x0 + 30 || x > b.x1 - 30 || y < b.y0 + 30 || y > b.y1 - 30) continue;
    if (L.river && (sideOf(L, x) === 0 || (psd !== 0 && sideOf(L, x) !== psd))) continue;
    if (pointBlocked(L, x, y, 22)) continue;
    return { x, y };
  }
  // fallback: anywhere free
  for (let i = 0; i < 80; i++) {
    const x = rand(L.bounds.x0 + 40, L.bounds.x1 - 40), y = rand(L.bounds.y0 + 40, L.bounds.y1 - 40);
    if (!pointBlocked(L, x, y, 22) && Math.hypot(x - p.x, y - p.y) > 250) return { x, y };
  }
  return { x: L.start.x + 200, y: L.start.y };
}

export function makeEnemy(game, type, x, y, opts = {}) {
  const def = ENEMIES[type];
  const d = game.diff;
  const hpMul = def.boss ? d.hp * 1.0 : d.hp;
  const e = {
    id: game.nextId++, type, def, x, y, r: def.r, face: R() * TAU, vx: 0, vy: 0,
    maxHp: Math.round(def.hp * hpMul), hp: 0, dmg: def.dmg * d.dmg, speed: def.speed * (def.boss ? 1 : 1 + d.s * 0.015),
    state: 'chase', t: 0, cd: rand(0.4, 1.4), spawnT: opts.noSpawn ? 0 : 0.7, hitT: 0, slowT: 0, stunT: 0, walkPhase: R() * 6,
    atkT: -1, dead: false, deadT: 0, strafe: R() < 0.5 ? 1 : -1, strafeT: rand(1, 2.5), wob: R() * 6,
    flying: !!def.flying, enraged: false, anim: 'idle', tint: 0,
  };
  e.hp = e.maxHp;
  if (type === 'regent') { e.state = 'idle'; e.cd = 1.5; e.summonCd = 6; e.title = def.name; }
  game.enemies.push(e);
  return e;
}

/* ---------- helpers ---------- */

function aimInfo(game, input) {
  const p = game.p;
  let target = null;
  if (input.auto) {
    let best = 700;
    for (const e of game.enemies) {
      if (e.dead || e.spawnT > 0.3) continue;
      const d = dist(p, e);
      if (d < best) { best = d; target = e; }
    }
    if (target) return { x: target.x, y: target.y, ang: Math.atan2(target.y - p.y, target.x - p.x), target };
    const ang = Math.hypot(input.mx, input.my) > 0.1 ? Math.atan2(input.my, input.mx) : p.face;
    return { x: p.x + Math.cos(ang) * 200, y: p.y + Math.sin(ang) * 200, ang, target: null };
  }
  const a = input.aim || { x: p.x + Math.cos(p.face) * 100, y: p.y + Math.sin(p.face) * 100 };
  const dx = a.x - p.x, dy = a.y - p.y;
  return { x: a.x, y: a.y, ang: Math.hypot(dx, dy) > 4 ? Math.atan2(dy, dx) : p.face, target: null };
}

function floatText(game, x, y, text, color = '#fff', size = 14, crit = false) {
  if (game.texts.length > 70) game.texts.shift();
  game.texts.push({ x: x + rand(-6, 6), y, z: 30, text, color, size, crit, t: 0, dur: crit ? 1.0 : 0.8 });
}

function addFx(game, fx) { if (game.fx.length < 120) game.fx.push({ t: 0, ...fx }); }

function playerDmg(game) {
  const p = game.p;
  const crit = R() * 100 < game.hero.crit;
  let d = game.hero.damage * rand(0.92, 1.08) * (p.dmgBuff > 0 ? 1.5 : 1) * (game.skillMulNow || 1);
  if (crit) d *= 1.75;
  return { d, crit };
}

function hurtEnemy(game, e, amount, crit, kbx = 0, kby = 0, kb = 0, stun = 0) {
  if (e.dead || e.spawnT > 0) return;
  const dmg = Math.max(1, Math.round(amount));
  e.hp -= dmg; e.hitT = 0.16;
  if (kb) { e.vx += kbx * kb * (e.type === 'brute' ? 0.4 : e.def.boss ? 0.1 : 1); e.vy += kby * kb * (e.type === 'brute' ? 0.4 : e.def.boss ? 0.1 : 1); }
  if (stun && !e.def.boss) e.stunT = Math.max(e.stunT, stun);
  floatText(game, e.x, e.y - e.r, String(dmg), crit ? '#ffd24a' : '#fff', crit ? 20 : 14, crit);
  if (e.hp <= 0) killEnemy(game, e);
}

function hurtPlayer(game, raw, srcx, srcy, unblockable = false) {
  const p = game.p;
  if (p.dead || p.invuln > 0 || (p.grace > 0 && !unblockable)) return false;
  let dmg = Math.max(1, Math.round(raw * armorMul(game.hero.armor)));
  if (game.god) dmg = 0;
  p.hp -= dmg; p.hitT = 0.22; p.grace = 0.35;
  game.shake = Math.min(14, game.shake + 4 + dmg * 0.1);
  floatText(game, p.x, p.y - 14, String(dmg), '#ff5a4a', 16);
  const a = Math.atan2(p.y - srcy, p.x - srcx);
  p.vx += Math.cos(a) * 120; p.vy += Math.sin(a) * 120;
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true; p.deadT = 0; game.stage.state = 'defeat'; game.stage.t = 2.2;
    setBanner(game, 'You have fallen', '', 2.2);
  }
  return true;
}

/* ---------- loot ---------- */

function dropItem(game, x, y, bonus, minRarity) {
  const ilvl = Math.max(1, Math.round(1 + game.diff.s));
  let rarity = rollRarity(R, bonus + game.diff.s * 0.05);
  const order = ['common', 'magic', 'rare', 'heroic'];
  if (minRarity && order.indexOf(rarity) < order.indexOf(minRarity)) rarity = minRarity;
  const t = R();
  const slot = t < 0.38 ? 'weapon' : t < 0.76 ? 'armor' : 'charm';
  const item = rollItem(R, { slot, ilvl, rarity, cls: game.save.cls });
  game.pickups.push({ kind: 'item', item, x: x + rand(-14, 14), y: y + rand(-14, 14), vx: rand(-40, 40), vy: rand(-40, 40), t: 0, magnet: false });
}

function killEnemy(game, e, silent = false) {
  if (e.dead) return;
  e.dead = true; e.deadT = 0; e.state = 'dead';
  if (silent) return;
  const run = game.run, def = e.def, d = game.diff;
  run.kills++;
  const xp = Math.round(def.xp * d.xp * (1 + (game.hero.xpPct || 0) / 100));
  run.xp += xp;
  const lv = addXp(game.save, xp);
  floatText(game, e.x, e.y - e.r - 16, `+${xp} xp`, '#9ad0ff', 11);
  if (lv) onLevelUp(game, lv);
  const steelN = def.boss ? 8 + Math.floor(d.s) : e.type === 'brute' ? 2 : R() < 0.1 ? 1 : 0;
  if (steelN) { game.save.steel = (game.save.steel || 0) + steelN; run.steel += steelN; floatText(game, e.x, e.y - e.r - 28, `+${steelN} steel`, '#9fb4c8', 12); }
  if (def.boss || (e.type === 'brute' && R() < 0.04)) {
    const a = ARTIFACTS[Math.floor(R() * ARTIFACTS.length)];
    const own = (game.save.artifacts = game.save.artifacts || {})[a.id];
    if (!own) { game.save.artifacts[a.id] = { lv: 1 }; setBanner(game, 'Artifact found', a.name, 2.4); floatText(game, e.x, e.y - 50, a.name, '#7ae0ff', 15, true); }
    else if (own.lv < ART_MAX) { own.lv++; floatText(game, e.x, e.y - 50, `${a.name} +1`, '#7ae0ff', 14, true); }
    else { game.save.steel = (game.save.steel || 0) + 4; run.steel += 4; }
    (run.artifacts = run.artifacts || []).push(a.name);
  }
  const gold = Math.round(rand(def.gold[0], def.gold[1]) * d.gold * (1 + (game.hero.goldPct || 0) / 100));
  game.pickups.push({ kind: 'gold', amount: gold, x: e.x, y: e.y, vx: rand(-50, 50), vy: rand(-50, 50), t: 0 });
  if (def.boss) {
    for (const o of game.enemies) if (!o.dead && o !== e) killEnemy(game, o, true);
    dropItem(game, e.x, e.y, 1.0, 'rare'); dropItem(game, e.x, e.y, 1.0, 'magic'); dropItem(game, e.x, e.y, 0.8, 'magic');
    game.pickups.push({ kind: 'potion', x: e.x + 20, y: e.y, vx: 30, vy: 20, t: 0 });
    game.shake = 12;
  } else {
    if (R() < def.drop * 1.0) dropItem(game, e.x, e.y, e.type === 'brute' ? 0.35 : 0);
    if (R() < 0.05) game.pickups.push({ kind: 'potion', x: e.x, y: e.y, vx: rand(-40, 40), vy: rand(-40, 40), t: 0 });
  }
}

function onLevelUp(game, n) {
  const p = game.p;
  const old = game.hero;
  game.run.levels += n;
  game.hero = heroStats(game.save);
  p.hp = Math.min(game.hero.maxHp, p.hp + (game.hero.maxHp - old.maxHp) + game.hero.maxHp * 0.3);
  p.mp = game.hero.maxMp;
  addFx(game, { type: 'ring', x: p.x, y: p.y, r: 90, dur: 0.8, color: '#ffe38a' });
  floatText(game, p.x, p.y - 40, `LEVEL ${game.save.level}!`, '#ffe38a', 22, true);
  const c = CLASSES[game.save.cls];
  const sk = c.skills.find((s) => s.unlock === game.save.level);
  setBanner(game, `Level ${game.save.level}`, sk ? `Skill unlocked: ${sk.name}` : '', 2);
  game.cb.levelUp(game.save.level, sk);
}

function collect(game, pk) {
  const { save, run } = game;
  if (pk.kind === 'gold') { save.gold += pk.amount; run.gold += pk.amount; floatText(game, game.p.x, game.p.y - 20, `+${pk.amount}g`, '#ffd24a', 12); return true; }
  if (pk.kind === 'potion') {
    if (save.potions >= MAX_POTIONS) { save.gold += 15; run.gold += 15; floatText(game, game.p.x, game.p.y - 20, '+15g', '#ffd24a', 12); }
    else { save.potions++; run.potions++; floatText(game, game.p.x, game.p.y - 20, 'Potion', '#ff8fa0', 13); }
    return true;
  }
  if (save.bag.length >= (save.bagSize || 24)) {
    const v = Math.round(5 * pk.item.ilvl * rarityOf(pk.item.rarity).sell);
    save.gold += v; run.gold += v;
    floatText(game, game.p.x, game.p.y - 20, `Bag full: sold for ${v}g`, '#ffd24a', 11);
    return true;
  }
  save.bag.push(pk.item); run.items.push(pk.item);
  floatText(game, game.p.x, game.p.y - 28, pk.item.name, rarityOf(pk.item.rarity).color, 13);
  return true;
}

/* ---------- skills ---------- */

function inCircleEnemies(game, x, y, r) {
  return game.enemies.filter((e) => !e.dead && e.spawnT <= 0 && Math.hypot(e.x - x, e.y - y) < r + e.r);
}

function fireArrow(game, ang, mult, extra = {}) {
  const p = game.p, c = CLASSES[game.save.cls];
  const sp = c.attack.speed || 560;
  const { d, crit } = playerDmg(game);
  game.proj.push({
    team: 'p', kind: extra.kind || 'arrow', x: p.x + Math.cos(ang) * 16, y: p.y + Math.sin(ang) * 16,
    vx: Math.cos(ang) * (extra.speed || sp), vy: Math.sin(ang) * (extra.speed || sp), ang,
    r: extra.r || 6, dmg: d * mult, crit, life: (extra.range || c.attack.range) / (extra.speed || sp), splash: extra.splash || 0, pierce: extra.pierce || 0, hit: new Set(), t: 0,
  });
}

const SKILLS = {
  rush(game, a) {
    const p = game.p;
    p.dash = { t: 0.3, dur: 0.3, vx: Math.cos(a.ang) * 640, vy: Math.sin(a.ang) * 640, hit: new Set(), kind: 'rush' };
    p.invuln = Math.max(p.invuln, 0.3); p.face = a.ang; p.skillAnim = 'rush'; p.skillT = 0.3;
  },
  whirl(game) {
    const p = game.p;
    p.spin = { t: 1.5, tick: 0, mul: game.skillMulNow || 1 }; p.skillAnim = 'whirl'; p.skillT = 1.5;
  },
  rally(game) {
    const p = game.p;
    p.hp = Math.min(game.hero.maxHp, p.hp + game.hero.maxHp * 0.25 * (game.skillMulNow || 1));
    p.dmgBuff = 6; p.skillAnim = 'rally'; p.skillT = 0.5;
    floatText(game, p.x, p.y - 30, 'Rally!', '#ffe38a', 16, true);
    addFx(game, { type: 'ring', x: p.x, y: p.y, r: 120, dur: 0.7, color: '#ffd96a' });
  },
  volley(game, a) {
    const p = game.p;
    for (let i = -3; i <= 3; i++) fireArrow(game, a.ang + i * 0.1, 0.8, { kind: 'arrow' });
    p.face = a.ang; p.skillAnim = 'volley'; p.skillT = 0.3; p.atkT = 0; p.atkDur = 0.3;
  },
  tumble(game, a, input) {
    const p = game.p;
    let ang = Math.hypot(input.mx, input.my) > 0.2 ? Math.atan2(input.my, input.mx) : a.ang + Math.PI;
    p.dash = { t: 0.4, dur: 0.4, vx: Math.cos(ang) * 400, vy: Math.sin(ang) * 400, hit: new Set(), kind: 'tumble' };
    p.invuln = Math.max(p.invuln, 0.42); p.skillAnim = 'tumble'; p.skillT = 0.4; p.moveAng = ang;
  },
  rain(game, a) {
    const p = game.p;
    const d = Math.min(420, Math.hypot(a.x - p.x, a.y - p.y));
    const x = p.x + Math.cos(a.ang) * d, y = p.y + Math.sin(a.ang) * d;
    game.zones.push({ kind: 'rain', team: 'p', x, y, r: 112, t: 0, delay: 0, dur: 3, tick: 0, dmg: 0.55 * (game.skillMulNow || 1) });
    p.face = a.ang; p.skillAnim = 'volley'; p.skillT = 0.4;
  },
  nova(game) {
    const p = game.p;
    for (const e of inCircleEnemies(game, p.x, p.y, 135)) {
      const { d, crit } = playerDmg(game);
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      hurtEnemy(game, e, d * 1.6, crit, Math.cos(a), Math.sin(a), 120);
      e.slowT = 3;
    }
    addFx(game, { type: 'nova', x: p.x, y: p.y, r: 135, dur: 0.55, color: '#8fd8ff' });
    p.skillAnim = 'nova'; p.skillT = 0.45; game.shake = Math.min(14, game.shake + 3);
  },
  blink(game, a, input) {
    const p = game.p;
    const ang = input.auto && Math.hypot(input.mx, input.my) > 0.2 ? Math.atan2(input.my, input.mx) : a.ang;
    addFx(game, { type: 'blink', x: p.x, y: p.y, dur: 0.4, color: '#b79bff' });
    const ox = p.x, oy = p.y;
    for (let s = 0; s < 18; s++) {
      p.x += Math.cos(ang) * 10; p.y += Math.sin(ang) * 10;
      const px = p.x, py = p.y;
      resolveMove(game.L, p);
      if (Math.abs(px - p.x) > 3 || Math.abs(py - p.y) > 3) break;
    }
    if (game.L.river) { /* never land inside river rect */ }
    addFx(game, { type: 'blink', x: p.x, y: p.y, dur: 0.4, color: '#b79bff' });
    p.invuln = Math.max(p.invuln, 0.2); p.skillAnim = 'blink'; p.skillT = 0.3; p.face = ang;
    void ox; void oy;
  },
  meteor(game, a) {
    const p = game.p;
    const d = Math.min(460, Math.hypot(a.x - p.x, a.y - p.y));
    const x = p.x + Math.cos(a.ang) * d, y = p.y + Math.sin(a.ang) * d;
    const { d: dmg, crit } = playerDmg(game);
    game.zones.push({ kind: 'meteor', team: 'p', x, y, r: 118, t: 0, delay: 1.1, dur: 1.6, fired: false, dmg: dmg * 4, crit });
    p.face = a.ang; p.skillAnim = 'cast'; p.skillT = 0.5;
  },
};

function tryUseSkill(game, i, input) {
  const p = game.p;
  const c = CLASSES[game.save.cls];
  const sk = c.skills[i];
  if (p.dead || game.save.level < sk.unlock || p.cd[i] > 0 || p.dash || p.spin) return false;
  if (p.mp < sk.cost) { game.mpFlash = 0.4; return false; }
  const a = aimInfo(game, input);
  const lv = (game.save.skillLv || [1, 1, 1])[i] || 1;
  p.mp -= sk.cost; p.cd[i] = sk.cd * skillCdMul(lv) * (1 - Math.min(0.5, (game.hero.cdr || 0) / 100));
  game.skillMulNow = skillMul(lv);
  SKILLS[sk.id](game, a, input);
  game.skillMulNow = 1;
  return true;
}

function playerAttack(game, a) {
  const p = game.p, c = CLASSES[game.save.cls], at = c.attack;
  p.atkCd = at.cd; p.atkT = 0; p.atkDur = at.dur; p.face = a.ang;
  if (at.type === 'melee') {
    const half = (at.arc / 2) * (Math.PI / 180);
    for (const e of game.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const d = dist(p, e);
      if (d > at.range + e.r) continue;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      if (d > e.r + 14 && angDiff(ang, a.ang) > half) continue;
      const { d: dmg, crit } = playerDmg(game);
      hurtEnemy(game, e, dmg * at.mult, crit, Math.cos(ang), Math.sin(ang), 90);
    }
    addFx(game, { type: 'slash', x: p.x, y: p.y, ang: a.ang, range: at.range, arc: at.arc, dur: 0.22, color: '#e8f0ff' });
  } else if (at.type === 'arrow') {
    fireArrow(game, a.ang, at.mult);
  } else {
    fireArrow(game, a.ang, at.mult, { kind: 'bolt', speed: at.speed, r: 8, splash: at.splash });
  }
}

/* ---------- main update ---------- */

export function update(game, dt, input) {
  if (game.mode !== 'stage' || game.paused) return;
  dt = Math.min(dt, 0.05);
  game.time += dt;
  const st = game.stage, p = game.p;
  if (game.banner) { game.banner.t -= dt; if (game.banner.t <= 0) game.banner = null; }
  if (game.mpFlash > 0) game.mpFlash -= dt;
  game.shake = Math.max(0, game.shake - dt * 22);

  // stage state machine
  if (st.state === 'intro') { st.t -= dt; if (st.t <= 0) startWave(game); }
  else if (st.state === 'fight') {
    const alive = game.enemies.some((e) => !e.dead);
    if (!alive && game.spawnQ.length === 0) {
      if (st.waveIdx >= st.waves.length - 1) { st.state = 'victory'; st.t = 1.8; for (const pk of game.pickups) pk.magnet = true; setBanner(game, st.boss ? 'The Regent is slain' : 'Victory!', '', 1.8); }
      else { st.state = 'between'; st.t = 2.2; setBanner(game, 'Wave cleared', '', 1.6); }
    }
  } else if (st.state === 'between') { st.t -= dt; if (st.t <= 0) startWave(game); }
  else if (st.state === 'victory') {
    st.t -= dt;
    if (st.t <= 0) { st.state = 'done'; finishStage(game, true); }
  } else if (st.state === 'defeat') {
    st.t -= dt;
    if (st.t <= 0) { st.state = 'done'; finishStage(game, false); }
  }

  // spawn queue
  for (let i = game.spawnQ.length - 1; i >= 0; i--) {
    const q = game.spawnQ[i];
    q.t -= dt;
    if (q.t <= 0) {
      const sp = spawnPoint(game, q.type);
      const e = makeEnemy(game, q.type, sp.x, sp.y);
      addFx(game, { type: 'spawn', x: sp.x, y: sp.y, dur: 0.7, color: e.def.boss ? '#ff6a2a' : '#ff9a4a' });
      game.spawnQ.splice(i, 1);
    }
  }

  updatePlayer(game, dt, input);
  updateEnemies(game, dt);
  updateProjectiles(game, dt);
  updateZones(game, dt);
  updatePickups(game, dt);
  for (let i = game.fx.length - 1; i >= 0; i--) { const f = game.fx[i]; f.t += dt; if (f.t >= f.dur) game.fx.splice(i, 1); }
  for (let i = game.texts.length - 1; i >= 0; i--) { const t = game.texts[i]; t.t += dt; t.z += dt * 30; if (t.t >= t.dur) game.texts.splice(i, 1); }
}

function finishStage(game, won) {
  const { save, stage, run } = game;
  let bonus = 0;
  if (won) {
    if (stage.id === 'vault') {
      bonus = Math.round(40 + stage.floor * 12);
      if (stage.floor > save.vaultBest) save.vaultBest = stage.floor;
    } else {
      bonus = 30 + stage.id * 15;
      if (stage.id > save.cleared) { save.cleared = stage.id; run.firstClear = true; bonus += stage.id * 40; }
      if (stage.id === 6) save.story = true;
    }
    save.gold += bonus; run.gold += bonus;
  }
  run.bonus = bonus;
  game.mode = 'ended';
  game.cb.end({ won, stage, run });
}

function updatePlayer(game, dt, input) {
  const p = game.p, c = CLASSES[game.save.cls], hero = game.hero;
  if (p.dead) { p.deadT += dt; return; }
  const a = aimInfo(game, input);

  // timers
  p.atkCd = Math.max(0, p.atkCd - dt);
  p.hitT = Math.max(0, p.hitT - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.grace = Math.max(0, p.grace - dt);
  p.dmgBuff = Math.max(0, p.dmgBuff - dt);
  p.potCd = Math.max(0, p.potCd - dt);
  for (let i = 0; i < 3; i++) p.cd[i] = Math.max(0, p.cd[i] - dt);
  if (p.atkT >= 0) { p.atkT += dt / p.atkDur; if (p.atkT >= 1) p.atkT = -1; }
  if (p.skillT > 0) { p.skillT -= dt; if (p.skillT <= 0) p.skillAnim = null; }
  p.mp = Math.min(hero.maxMp, p.mp + hero.regen * dt);

  // potion
  if (input.potion) {
    input.potion = false;
    if (game.save.potions > 0 && p.potCd <= 0 && p.hp < hero.maxHp) {
      game.save.potions--; p.potCd = 1;
      const h = Math.round(hero.maxHp * 0.5);
      p.hp = Math.min(hero.maxHp, p.hp + h);
      floatText(game, p.x, p.y - 26, `+${h}`, '#6fe08a', 16);
      addFx(game, { type: 'ring', x: p.x, y: p.y, r: 60, dur: 0.5, color: '#6fe08a' });
    }
  }
  // skills
  for (let i = 0; i < 3; i++) {
    if (input.skills[i]) { input.skills[i] = false; tryUseSkill(game, i, input); }
  }

  // movement
  let mx = input.mx, my = input.my;
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  p.moving = ml > 0.1;
  let spd = hero.speed;
  if (p.spin) spd *= 0.65;
  if (p.dash) {
    const d = p.dash;
    d.t -= dt;
    p.vx = d.vx; p.vy = d.vy;
    p.x += d.vx * dt; p.y += d.vy * dt;
    if (d.kind === 'rush') {
      const ang = Math.atan2(d.vy, d.vx);
      for (const e of game.enemies) {
        if (e.dead || e.spawnT > 0 || d.hit.has(e.id)) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 12) {
          d.hit.add(e.id);
          const { d: dmg, crit } = playerDmg(game);
          // knock foes aside (perpendicular to the charge)
          const side = Math.sign((e.x - p.x) * -Math.sin(ang) + (e.y - p.y) * Math.cos(ang)) || 1;
          hurtEnemy(game, e, dmg * 1.6, crit, -Math.sin(ang) * side + Math.cos(ang) * 0.3, Math.cos(ang) * side + Math.sin(ang) * 0.3, 360, 0.5);
        }
      }
      if (R() < 0.6) addFx(game, { type: 'trail', x: p.x, y: p.y, dur: 0.3, color: '#d8e4ff' });
    }
    if (d.t <= 0) p.dash = null;
    p.walkPhase += dt * 16;
    p.moveAng = Math.atan2(d.vy, d.vx);
  } else {
    p.vx *= Math.pow(0.0005, dt); p.vy *= Math.pow(0.0005, dt);
    p.x += (mx * spd + p.vx) * dt; p.y += (my * spd + p.vy) * dt;
    if (p.moving) { p.walkPhase += dt * (spd / 18); p.moveAng = Math.atan2(my, mx); }
  }
  resolveMove(game.L, p);

  // facing: desktop faces aim point; touch faces target or move dir
  if (!p.dash) {
    if (input.auto) { p.face = a.target ? a.ang : p.moving ? Math.atan2(my, mx) : p.face; }
    else p.face = a.ang;
  }

  // whirlwind
  if (p.spin) {
    p.spin.t -= dt; p.spin.tick -= dt;
    if (p.spin.tick <= 0) {
      p.spin.tick = 0.25;
      for (const e of inCircleEnemies(game, p.x, p.y, 86)) {
        const { d, crit } = playerDmg(game);
        const ang = Math.atan2(e.y - p.y, e.x - p.x);
        hurtEnemy(game, e, d * 0.8 * (p.spin.mul || 1), crit, Math.cos(ang), Math.sin(ang), 110);
      }
      addFx(game, { type: 'ring', x: p.x, y: p.y, r: 86, dur: 0.3, color: '#e8f0ff' });
    }
    if (p.spin.t <= 0) p.spin = null;
  }

  // basic attack
  if (input.attack && p.atkCd <= 0 && !p.dash && !p.spin) playerAttack(game, a);
}

/* ---------- enemies ---------- */

function moveTowards(game, e, tx, ty, speed, dt) {
  const dx = tx - e.x, dy = ty - e.y;
  const ang = Math.atan2(dy, dx), step = speed * dt;
  let best = ang;
  if (!e.flying) {
    // probe the direct step; if an obstacle eats most of it, steer around (sticky side)
    const probe = (a) => {
      const t = { x: e.x + Math.cos(a) * step * 2, y: e.y + Math.sin(a) * step * 2 };
      resolveMove(game.L, t, e.r);
      return ((t.x - e.x) * Math.cos(ang) + (t.y - e.y) * Math.sin(ang)) / (step * 2);
    };
    if (probe(ang) < 0.45) {
      if (!e.steerT || e.steerT < game.time) { e.steer = e.steer || (R() < 0.5 ? 1 : -1); e.steerT = game.time + 1.2; }
      let bp = -9;
      for (const k of [0.7, 1.4, 2.1]) { const a = ang + e.steer * k, pr = probe(a); if (pr > bp) { bp = pr; best = a; } if (pr > 0.2) break; }
      if (bp < 0.1) e.steer = -e.steer;
    }
  }
  e.x += Math.cos(best) * step; e.y += Math.sin(best) * step;
  e.face = ang;
  e.walkPhase += dt * speed / 14;
}

function goalFor(game, e) {
  const { L, p } = game;
  if (L.river) {
    const es = sideOf(L, e.x), ps = sideOf(L, p.x);
    if (es !== 0 && es !== ps) return { x: es < 0 ? L.river.x0 + 12 : L.river.x1 - 12, y: L.bridge.y };
  }
  return { x: p.x, y: p.y };
}

function enemyShoot(game, e, kind, ang, speed, dmg, life = 3, r = 5) {
  game.proj.push({ team: 'e', kind, x: e.x + Math.cos(ang) * 14, y: e.y + Math.sin(ang) * 14, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, ang, r, dmg, life, hit: new Set(), t: 0 });
}

function updateEnemies(game, dt) {
  const p = game.p;
  const L = game.L;
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const e = game.enemies[i];
    if (e.dead) { e.deadT += dt; if (e.deadT > 1.2) game.enemies.splice(i, 1); continue; }
    e.hitT = Math.max(0, e.hitT - dt);
    e.slowT = Math.max(0, e.slowT - dt);
    e.stunT = Math.max(0, e.stunT - dt);
    e.cd -= dt;
    if (e.atkT >= 0 && e.state !== 'windup') e.atkT = -1;
    // knockback velocity
    e.vx *= Math.pow(0.002, dt); e.vy *= Math.pow(0.002, dt);
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.spawnT > 0) { e.spawnT -= dt; if (!e.flying) resolveMove(L, e); continue; }
    if (e.stunT > 0) { if (!e.flying) resolveMove(L, e); continue; }
    const slow = e.slowT > 0 ? 0.5 : 1;
    const dp = dist(e, p);
    // stuck backup: if a chaser hasn't gone anywhere for ~3s while far from the hero, relocate it
    e.stuckT = (e.stuckT || 0) + dt;
    if (e.stuckT > 3) {
      if (e.state === 'chase' && !e.def.boss && dp > 140 && Math.hypot(e.x - (e.sx ?? 1e5), e.y - (e.sy ?? 1e5)) < 10) {
        const sp = spawnPoint(game, e.type); e.x = sp.x; e.y = sp.y; e.spawnT = 0.5;
        addFx(game, { type: 'spawn', x: sp.x, y: sp.y, dur: 0.7, color: '#ff9a4a' });
      }
      e.sx = e.x; e.sy = e.y; e.stuckT = 0;
    }
    const aliveP = !p.dead;

    switch (e.type) {
      case 'grunt': aiGrunt(game, e, dt, dp, slow, aliveP); break;
      case 'bowman': aiBowman(game, e, dt, dp, slow, aliveP); break;
      case 'wisp': aiWisp(game, e, dt, dp, slow, aliveP); break;
      case 'brute': aiBrute(game, e, dt, dp, slow, aliveP); break;
      case 'regent': aiRegent(game, e, dt, dp, slow, aliveP); break;
    }
  }
  // separation
  const es = game.enemies;
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (a.dead || a.spawnT > 0) continue;
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j];
      if (b.dead || b.spawnT > 0 || a.flying !== b.flying) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (rr - d) * 0.5;
        const wa = a.def.boss ? 0.1 : 1, wb = b.def.boss ? 0.1 : 1;
        a.x -= (dx / d) * push * wa; a.y -= (dy / d) * push * wa;
        b.x += (dx / d) * push * wb; b.y += (dy / d) * push * wb;
      }
    }
    if (!a.flying) resolveMove(L, a); else {
      const b = L.bounds; a.x = clamp(a.x, b.x0 + a.r, b.x1 - a.r); a.y = clamp(a.y, b.y0 + a.r, b.y1 - a.r);
    }
    // body contact with player: push player a little
    if (!p.dead && !a.def.boss) {
      const dx = p.x - a.x, dy = p.y - a.y, rr = a.r + p.r - 2, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.01 && !p.dash) { const d = Math.sqrt(d2); p.x += (dx / d) * (rr - d) * 0.35; p.y += (dy / d) * (rr - d) * 0.35; a.x -= (dx / d) * (rr - d) * 0.15; a.y -= (dy / d) * (rr - d) * 0.15; }
    }
  }
}

function aiGrunt(game, e, dt, dp, slow, aliveP) {
  const def = e.def, p = game.p;
  if (e.state === 'chase') {
    const g = goalFor(game, e);
    if (aliveP && dp < def.range + p.r && e.cd <= 0) { e.state = 'windup'; e.t = def.windup; e.face = Math.atan2(p.y - e.y, p.x - e.x); e.atkT = 0; }
    else if (dp > def.range * 0.6 || g.x !== p.x) moveTowards(game, e, g.x, g.y, e.speed * slow, dt);
    else e.face = Math.atan2(p.y - e.y, p.x - e.x);
  } else if (e.state === 'windup') {
    e.t -= dt; e.atkT = 1 - Math.max(0, e.t) / def.windup;
    if (e.t <= 0) {
      if (aliveP && dist(e, p) < def.range + p.r + 14 && angDiff(Math.atan2(p.y - e.y, p.x - e.x), e.face) < 1.2) hurtPlayer(game, e.dmg, e.x, e.y);
      e.state = 'recover'; e.t = 0.35; e.atkT = -1; e.cd = def.cd;
    }
  } else if (e.state === 'recover') { e.t -= dt; if (e.t <= 0) e.state = 'chase'; }
}

function aiBowman(game, e, dt, dp, slow, aliveP) {
  const def = e.def, p = game.p;
  if (e.state === 'chase') {
    e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rand(1.2, 2.8); }
    const toP = Math.atan2(p.y - e.y, p.x - e.x);
    const g = goalFor(game, e);
    if (g.x !== p.x) moveTowards(game, e, g.x, g.y, e.speed * slow, dt);
    else if (dp < def.keep) { e.x -= Math.cos(toP) * e.speed * 1.1 * slow * dt; e.y -= Math.sin(toP) * e.speed * 1.1 * slow * dt; e.face = toP; e.walkPhase += dt * 6; }
    else if (dp > def.range - 30) moveTowards(game, e, p.x, p.y, e.speed * slow, dt);
    else { e.x += Math.cos(toP + Math.PI / 2) * e.strafe * e.speed * 0.7 * slow * dt; e.y += Math.sin(toP + Math.PI / 2) * e.strafe * e.speed * 0.7 * slow * dt; e.face = toP; e.walkPhase += dt * 5; }
    if (aliveP && e.cd <= 0 && dp < def.range) { e.state = 'windup'; e.t = def.windup; e.atkT = 0; }
  } else if (e.state === 'windup') {
    e.t -= dt; e.atkT = 1 - Math.max(0, e.t) / def.windup;
    e.face = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.t <= 0) {
      enemyShoot(game, e, 'earrow', e.face, def.projSpeed, e.dmg, 2.6, 5);
      e.state = 'recover'; e.t = 0.25; e.atkT = -1; e.cd = def.cd * rand(0.9, 1.3);
    }
  } else if (e.state === 'recover') { e.t -= dt; if (e.t <= 0) e.state = 'chase'; }
}

function aiWisp(game, e, dt, dp, slow, aliveP) {
  const def = e.def, p = game.p;
  e.wob += dt * 5;
  if (e.state === 'chase') {
    const ang = Math.atan2(p.y - e.y, p.x - e.x) + Math.sin(e.wob) * 0.6;
    e.x += Math.cos(ang) * e.speed * slow * dt; e.y += Math.sin(ang) * e.speed * slow * dt;
    e.face = ang; e.walkPhase += dt * 8;
    if (aliveP && dp < def.range + p.r && e.cd <= 0) { e.state = 'windup'; e.t = def.windup; e.atkT = 0; }
  } else if (e.state === 'windup') {
    e.t -= dt; e.atkT = 1 - Math.max(0, e.t) / def.windup;
    if (e.t <= 0) {
      if (aliveP && dist(e, p) < def.range + p.r + 8) hurtPlayer(game, e.dmg, e.x, e.y);
      e.state = 'recover'; e.t = 0.7; e.atkT = -1; e.cd = def.cd;
      e.rAng = Math.atan2(e.y - p.y, e.x - p.x) + rand(-0.6, 0.6);
    }
  } else if (e.state === 'recover') {
    e.t -= dt; e.x += Math.cos(e.rAng) * e.speed * 0.9 * dt; e.y += Math.sin(e.rAng) * e.speed * 0.9 * dt;
    if (e.t <= 0) e.state = 'chase';
  }
}

function aiBrute(game, e, dt, dp, slow, aliveP) {
  const def = e.def, p = game.p;
  if (e.state === 'chase') {
    const g = goalFor(game, e);
    if (aliveP && dp < 120 && e.cd <= 0) {
      e.state = 'windup'; e.t = def.windup; e.atkT = 0; e.face = Math.atan2(p.y - e.y, p.x - e.x);
      const sx = clamp(p.x, e.x - 150, e.x + 150), sy = clamp(p.y, e.y - 150, e.y + 150);
      game.zones.push({ kind: 'slam', team: 'e', x: sx, y: sy, r: def.slamR, t: 0, delay: def.windup, dur: def.windup + 0.35, fired: false, dmg: e.dmg, owner: e.id });
    } else moveTowards(game, e, g.x, g.y, e.speed * slow, dt);
  } else if (e.state === 'windup') {
    e.t -= dt; e.atkT = 1 - Math.max(0, e.t) / def.windup;
    if (e.t <= 0) { e.state = 'recover'; e.t = 0.9; e.atkT = -1; e.cd = def.cd; game.shake = Math.min(14, game.shake + 4); }
  } else if (e.state === 'recover') { e.t -= dt; if (e.t <= 0) e.state = 'chase'; }
}

function aiRegent(game, e, dt, dp, slow, aliveP) {
  const p = game.p, enr = e.enraged;
  if (!enr && e.hp < e.maxHp * 0.5) {
    e.enraged = true; e.tint = 1; setBanner(game, 'The Regent is enraged!', '', 1.8);
    addFx(game, { type: 'ring', x: e.x, y: e.y, r: 200, dur: 0.9, color: '#ff5a2a' });
    game.shake = 12;
  }
  const spd = e.speed * (e.enraged ? 1.3 : 1) * slow;
  const dmg = e.dmg * (e.enraged ? 1.2 : 1);
  e.summonCd -= dt;
  const toP = Math.atan2(p.y - e.y, p.x - e.x);

  if (e.state === 'idle') {
    e.anim = 'idle';
    if (aliveP && dp > 90) moveTowards(game, e, p.x, p.y, spd, dt); else e.face = toP;
    if (aliveP && e.cd <= 0) {
      const alive = game.enemies.filter((o) => !o.dead && o !== e).length;
      const opts = ['slam', 'orbs', 'charge'];
      if (e.summonCd <= 0 && alive < 4) opts.push('summon', 'summon');
      if (dp < 140) opts.push('slam');
      const pick = opts[Math.floor(R() * opts.length)];
      e.state = pick; e.anim = pick; e.face = toP; e.atkT = 0; e.hitDone = false;
      if (pick === 'slam') {
        e.t = e.dur = enr ? 0.8 : 1.05;
        game.zones.push({ kind: 'slam', team: 'e', x: p.x, y: p.y, r: 108, t: 0, delay: e.t, dur: e.t + 0.4, fired: false, dmg: dmg * 1.3, owner: e.id });
        if (enr) for (const s of [-1, 1]) game.zones.push({ kind: 'slam', team: 'e', x: p.x + s * 140, y: p.y + 30, r: 80, t: 0, delay: e.t + 0.25, dur: e.t + 0.65, fired: false, dmg: dmg, owner: e.id });
      } else if (pick === 'orbs') { e.t = e.dur = 0.7; e.rings = enr ? 2 : 1; }
      else if (pick === 'charge') {
        e.t = e.dur = enr ? 0.65 : 0.85; e.chargeAng = toP; e.chargePhase = 0;
        game.zones.push({ kind: 'line', team: 'e', x: e.x, y: e.y, x2: e.x + Math.cos(toP) * 560, y2: e.y + Math.sin(toP) * 560, w: 56, t: 0, delay: e.t, dur: e.t, owner: e.id });
      } else if (pick === 'summon') { e.t = e.dur = 0.9; e.summonCd = enr ? 9 : 13; }
    }
  } else if (e.state === 'slam') {
    e.t -= dt; e.atkT = 1 - Math.max(0, e.t) / e.dur;
    if (e.t <= 0) { e.state = 'recover'; e.t = 0.8; e.anim = 'idle'; e.atkT = -1; e.cd = enr ? 0.9 : 1.5; game.shake = Math.min(14, game.shake + 6); }
  } else if (e.state === 'orbs') {
    e.t -= dt; e.atkT = 1 - Math.max(0, e.t) / e.dur;
    if (e.t <= 0) {
      const n = enr ? 18 : 12;
      const off = rand(0, TAU);
      for (let i = 0; i < n; i++) enemyShoot(game, e, 'orb', off + (i / n) * TAU, 170, dmg * 0.55, 4.5, 8);
      e.rings--;
      if (e.rings > 0) { e.t = 0.55; e.dur = 0.55; e.atkT = 0; }
      else { e.state = 'recover'; e.t = 0.7; e.anim = 'idle'; e.atkT = -1; e.cd = enr ? 0.9 : 1.5; }
    }
  } else if (e.state === 'charge') {
    if (e.chargePhase === 0) {
      e.t -= dt; e.atkT = 1 - Math.max(0, e.t) / e.dur;
      if (e.t <= 0) { e.chargePhase = 1; e.t = 0.6; e.atkT = -1; }
    } else {
      e.t -= dt;
      const sp = 560;
      e.x += Math.cos(e.chargeAng) * sp * dt; e.y += Math.sin(e.chargeAng) * sp * dt;
      e.face = e.chargeAng; e.walkPhase += dt * 20;
      if (!e.hitDone && aliveP && dist(e, p) < e.r + p.r + 6) { if (hurtPlayer(game, dmg * 1.4, e.x, e.y)) { e.hitDone = true; p.vx += Math.cos(e.chargeAng) * 260; p.vy += Math.sin(e.chargeAng) * 260; } }
      const b = game.L.bounds;
      const before = e.x + e.y;
      resolveMove(game.L, e);
      if (e.t <= 0 || Math.abs(before - (e.x + e.y)) > 3 || e.x < b.x0 + 40 || e.x > b.x1 - 40 || e.y < b.y0 + 40 || e.y > b.y1 - 40) {
        e.state = 'recover'; e.t = 0.9; e.anim = 'idle'; e.cd = enr ? 0.9 : 1.5; game.shake = Math.min(14, game.shake + 4);
      }
    }
  } else if (e.state === 'summon') {
    e.t -= dt; e.atkT = 1 - Math.max(0, e.t) / e.dur;
    if (e.t <= 0) {
      const n = enr ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rand(0, 1);
        const sx = e.x + Math.cos(a) * 80, sy = e.y + Math.sin(a) * 80;
        const g = makeEnemy(game, 'grunt', clamp(sx, game.L.bounds.x0 + 30, game.L.bounds.x1 - 30), clamp(sy, game.L.bounds.y0 + 30, game.L.bounds.y1 - 30));
        g.summoned = true;
        addFx(game, { type: 'spawn', x: g.x, y: g.y, dur: 0.7, color: '#ff6a2a' });
      }
      e.state = 'recover'; e.t = 0.6; e.anim = 'idle'; e.atkT = -1; e.cd = enr ? 0.9 : 1.5;
    }
  } else if (e.state === 'recover') {
    e.t -= dt; if (e.t <= 0) e.state = 'idle';
  }
}

/* ---------- projectiles, zones, pickups ---------- */

function splashDamage(game, x, y, r, dmg, crit, skip) {
  for (const e of game.enemies) {
    if (e.dead || e.spawnT > 0 || e === skip) continue;
    if (Math.hypot(e.x - x, e.y - y) < r + e.r) hurtEnemy(game, e, dmg, crit, 0, 0, 0);
  }
  addFx(game, { type: 'burst', x, y, r, dur: 0.35, color: '#ff9a3a' });
}

function updateProjectiles(game, dt) {
  const p = game.p;
  for (let i = game.proj.length - 1; i >= 0; i--) {
    const q = game.proj[i];
    q.t += dt; q.life -= dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    let dead = q.life <= 0;
    const b = game.L.bounds;
    if (q.x < b.x0 - 40 || q.x > b.x1 + 40 || q.y < b.y0 - 40 || q.y > b.y1 + 40) dead = true;
    if (!dead && q.team === 'p') {
      for (const e of game.enemies) {
        if (e.dead || e.spawnT > 0 || q.hit.has(e.id)) continue;
        if (Math.hypot(e.x - q.x, e.y - q.y) < e.r + q.r) {
          q.hit.add(e.id);
          hurtEnemy(game, e, q.dmg, q.crit, Math.cos(q.ang), Math.sin(q.ang), 40);
          if (q.splash) splashDamage(game, q.x, q.y, q.splash, q.dmg * 0.6, false, e);
          if (q.pierce-- <= 0) { dead = true; break; }
        }
      }
      if (dead === false && q.life <= 0) dead = true;
    } else if (!dead && !p.dead) {
      if (Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r) {
        hurtPlayer(game, q.dmg, q.x - q.vx, q.y - q.vy);
        dead = true;
      }
    }
    if (dead) {
      if (q.team === 'p' && q.splash && q.hit.size === 0) splashDamage(game, q.x, q.y, q.splash, q.dmg * 0.6, false, null);
      game.proj.splice(i, 1);
    }
  }
}

function updateZones(game, dt) {
  const p = game.p;
  for (let i = game.zones.length - 1; i >= 0; i--) {
    const z = game.zones[i];
    z.t += dt;
    if (z.kind === 'rain') {
      z.tick -= dt;
      if (z.tick <= 0 && z.t < z.dur) {
        z.tick = 0.25;
        for (const e of inCircleEnemies(game, z.x, z.y, z.r)) { const { d, crit } = playerDmg(game); hurtEnemy(game, e, d * z.dmg, crit); }
      }
    } else if ((z.kind === 'meteor' || z.kind === 'slam') && !z.fired && z.t >= z.delay) {
      z.fired = true;
      if (z.team === 'p') {
        for (const e of inCircleEnemies(game, z.x, z.y, z.r)) {
          const a = Math.atan2(e.y - z.y, e.x - z.x);
          hurtEnemy(game, e, z.dmg, z.crit, Math.cos(a), Math.sin(a), 160, 0.4);
        }
        game.shake = Math.min(14, game.shake + 7);
      } else {
        if (!p.dead && Math.hypot(p.x - z.x, p.y - z.y) < z.r + p.r * 0.4) hurtPlayer(game, z.dmg, z.x, z.y);
        game.shake = Math.min(14, game.shake + 5);
      }
      addFx(game, { type: 'burst', x: z.x, y: z.y, r: z.r, dur: 0.5, color: z.team === 'p' ? '#ff8a3a' : '#c8a070' });
    }
    if (z.t >= z.dur) game.zones.splice(i, 1);
  }
}

function updatePickups(game, dt) {
  const p = game.p;
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const pk = game.pickups[i];
    pk.t += dt;
    if (pk.vx || pk.vy) { pk.x += pk.vx * dt; pk.y += pk.vy * dt; pk.vx *= Math.pow(0.01, dt); pk.vy *= Math.pow(0.01, dt); }
    if (p.dead) continue;
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    const magR = pk.kind === 'item' ? 55 : 95;
    if (pk.t > 0.35 && (pk.magnet || d < magR)) {
      const sp = pk.magnet ? 700 : 260;
      pk.x += ((p.x - pk.x) / (d || 1)) * sp * dt; pk.y += ((p.y - pk.y) / (d || 1)) * sp * dt;
    }
    if (d < 20 && pk.t > 0.2) { collect(game, pk); game.pickups.splice(i, 1); }
  }
}

export function setPaused(game, v) { game.paused = v; }
export { WORLD_W };
