// Items, hero stat derivation, power score, loot rolls.
import {
  CLASSES, PER_LEVEL, RARITIES, AFFIXES, AFFIX_KEYS, ARMOR_NAMES, CHARM_NAMES, HEROIC_TITLES, xpToNext, MAX_LEVEL,
  SETS, SET_BONUS, MAX_PLUS, RESEARCH_MAX, TRAITS, SIGIL_PER, SIGIL_BOONS, ARTIFACTS, artValue, ART_MAX, ROUTES, SCOUT_NAMES,
} from './data.js';

let uidN = 0;
export const uid = () => `${Date.now().toString(36)}${(uidN++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export const rarityOf = (id) => RARITIES.find((r) => r.id === id) || RARITIES[0];
const pick = (arr, R) => arr[Math.floor(R() * arr.length)];
const round = (v, d = 0) => { const m = Math.pow(10, d); return Math.round(v * m) / m; };

export function rollAffix(key, ilvl, R) {
  const a = AFFIXES[key];
  const scale = 1 + 0.3 * (ilvl - 1);
  return { k: key, v: round(a.base * scale * (0.8 + R() * 0.4), a.dec || 0) };
}

const COMMON_ADJ = ['Worn', 'Plain', 'Sturdy', 'Notched', 'Rough', 'Road-worn'];

export function rollItem(R, { slot, ilvl, rarity, cls }) {
  const rar = rarityOf(rarity);
  const c = CLASSES[cls];
  let n = rar.affixes;
  if (slot === 'charm' && n < 1) n = 1;
  const keys = [];
  const pool = AFFIX_KEYS.filter((k) => slot !== 'weapon' || k !== 'armor');
  while (keys.length < n) { const k = pick(pool, R); if (!keys.includes(k)) keys.push(k); }
  const aff = keys.map((k) => rollAffix(k, ilvl, R));
  let kind, base = 0;
  if (slot === 'weapon') { kind = pick(c.weaponKinds, R); base = round((3 + 2.3 * ilvl) * (0.9 + R() * 0.2) * (rarity === 'heroic' ? 1.15 : 1)); }
  else if (slot === 'armor') { kind = pick(ARMOR_NAMES, R); base = round((3 + 3.2 * ilvl) * (0.9 + R() * 0.2) * (rarity === 'heroic' ? 1.15 : 1)); }
  else kind = pick(CHARM_NAMES, R);
  let name;
  if (rarity === 'common') name = `${pick(COMMON_ADJ, R)} ${kind}`;
  else if (rarity === 'magic') name = `${AFFIXES[aff[0].k].name[0]} ${kind}`;
  else if (rarity === 'rare') name = `${AFFIXES[aff[0].k].name[0]} ${kind} ${AFFIXES[aff[1].k].name[1]}`;
  else name = `${pick(HEROIC_TITLES, R)}'s ${kind}`;
  const setChance = { common: 0, magic: 0.3, rare: 0.85, heroic: 1 }[rarity];
  const set = R() < setChance ? Math.max(0, Math.min(SETS.length - 1, Math.round(ilvl - 1 + (R() < 0.3 ? -1 : 0)))) : null;
  return { id: uid(), slot, rarity, name, kind, ilvl, base, aff, cls: slot === 'weapon' ? cls : null, set, plus: 0, fp: 0, lock: false };
}

export function rollRarity(R, bonus = 0) {
  // bonus shifts weight towards better rarities
  const w = RARITIES.map((r, i) => r.weight * (i === 0 ? Math.max(0.2, 1 - bonus) : 1 + bonus * i * 0.8));
  let t = R() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) return RARITIES[i].id; }
  return 'common';
}

export function startingGear(cls) {
  const R = Math.random;
  return {
    weapon: rollItem(R, { slot: 'weapon', ilvl: 1, rarity: 'common', cls }),
    armor: rollItem(R, { slot: 'armor', ilvl: 1, rarity: 'common', cls }),
    charm: null,
  };
}

export const forgeMul = (it) => 1 + 0.1 * (it.plus || 0);

export function itemSellValue(it) {
  return Math.max(3, Math.round(7 * it.ilvl * rarityOf(it.rarity).sell));
}

export function itemTotals(it) {
  const t = { hp: 0, mp: 0, damage: 0, armor: 0, crit: 0, speed: 0, regen: 0 };
  if (!it) return t;
  const m = forgeMul(it);
  if (it.slot === 'weapon') t.damage += it.base * m;
  if (it.slot === 'armor') t.armor += it.base * m;
  for (const a of it.aff) t[a.k] += a.v * m;
  return t;
}

export function heroStats(save, equipOverride) {
  const c = CLASSES[save.cls];
  const L = save.level;
  const eq = equipOverride || save.equip;
  const g = { hp: 0, mp: 0, damage: 0, armor: 0, crit: 0, speed: 0, regen: 0 };
  for (const slot of ['weapon', 'armor', 'charm']) {
    const t = itemTotals(eq[slot]);
    for (const k in g) g[k] += t[k];
  }
  for (const [k, v] of Object.entries(setBonusTotals(eq))) g[k] += v;
  for (const [k, v] of Object.entries(researchTotals(save))) g[k] += v;
  const x = advanceTotals(save);
  for (const k of ['hp', 'mp', 'damage', 'armor', 'crit', 'regen']) g[k] += x[k];
  g.speed += x.speed;
  const s = {
    maxHp: Math.round((c.hp + PER_LEVEL.hp * (L - 1) + g.hp) * (1 + x.hpPct / 100)),
    maxMp: Math.round(c.mp + PER_LEVEL.mp * (L - 1) + g.mp),
    damage: round((c.damage + PER_LEVEL.damage * (L - 1) + g.damage) * (1 + x.dmgPct / 100), 1),
    armor: Math.round(g.armor),
    crit: round(5 + g.crit, 1),
    speed: round(c.speed * (1 + g.speed / 100), 1),
    speedPct: g.speed,
    regen: round(c.manaRegen + g.regen, 2),
  };
  s.cdr = x.cdr; s.goldPct = x.goldPct; s.xpPct = x.xpPct;
  s.power = powerOf(s);
  return s;
}

export function powerOf(s) {
  return Math.round(s.maxHp * 0.2 + s.maxMp * 0.1 + s.damage * 3.2 + s.armor * 2 + s.crit * 2 + s.speedPct * 0.8 + s.regen * 3 - 8);
}

// armor -> damage multiplier
export const armorMul = (armor) => 120 / (120 + armor);

export function addXp(save, amount) {
  let gained = 0;
  if (save.level >= MAX_LEVEL) return 0;
  save.xp += amount;
  while (save.level < MAX_LEVEL && save.xp >= xpToNext(save.level)) {
    save.xp -= xpToNext(save.level); save.level++; gained++;
  }
  if (save.level >= MAX_LEVEL) save.xp = 0;
  return gained;
}

export function describeAffix(a) { return AFFIXES[a.k].fmt(a.v); }

/* ---------- sets, research ---------- */
export function setCounts(eq) {
  const c = {};
  for (const sl of ['weapon', 'armor', 'charm']) { const it = eq[sl]; if (it && it.set != null) c[it.set] = (c[it.set] || 0) + 1; }
  return c;
}
export function setBonusTotals(eq) {
  const out = {};
  for (const [id, n] of Object.entries(setCounts(eq))) {
    const t = 1 + 0.35 * id;
    for (const need of [2, 3]) if (n >= need) for (const [k, v] of Object.entries(SET_BONUS[need](t))) out[k] = (out[k] || 0) + v;
  }
  return out;
}
export const researchLevel = (xp) => Math.min(RESEARCH_MAX, Math.floor(Math.sqrt((xp || 0) / 25)));
export const researchNeed = (lv) => lv * lv * 25;
// Researched sets grant their bonus whether or not the set is worn.
export function researchTotals(save) {
  const out = { armor: 0, damage: 0, hp: 0 };
  for (const xp of Object.values(save.research || {})) { const L = researchLevel(xp); out.armor += 2 * L; out.damage += 1 * L; out.hp += 6 * L; }
  return out;
}
export const studyValue = (it) => Math.round(10 * rarityOf(it.rarity).sell * it.ilvl) + (it.plus || 0) * 6;

/* ---------- forge / reforge / dismantle ---------- */
export const FORGE_CHANCE = [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
export function forgeInfo(it) {
  const plus = it.plus || 0;
  if (plus >= MAX_PLUS) return null;
  const guaranteed = (it.fp || 0) >= 100;
  return { chance: guaranteed ? 1 : FORGE_CHANCE[plus], guaranteed, gold: Math.round(25 * (plus + 1) * (1 + it.ilvl * 0.5)), steel: 1 + plus + (rarityIndex(it) >= 2 ? 1 : 0) };
}
export const rarityIndex = (it) => RARITIES.findIndex((r) => r.id === it.rarity);
export function forgeAttempt(it, R = Math.random) {
  const info = forgeInfo(it);
  if (R() < info.chance) { it.plus = (it.plus || 0) + 1; it.fp = 0; return true; }
  it.fp = Math.min(100, (it.fp || 0) + 20 + Math.floor(R() * 10)); // failure never lowers the item; builds towards a sure success
  return false;
}
export const reforgeCost = (it) => ({ gold: 40 * it.ilvl + 20 * rarityIndex(it) * it.ilvl, steel: 2 + rarityIndex(it) });
export const canReforge = (it) => rarityIndex(it) >= 1 && it.aff.length > 0;
// Re-roll one affix, taking a fresh random stat (never one the item already has).
export function reforgeAffix(it, idx, R = Math.random) {
  const have = it.aff.map((a) => a.k);
  const pool = AFFIX_KEYS.filter((k) => !have.includes(k) && !(it.slot === 'weapon' && k === 'armor'));
  const key = pool[Math.floor(R() * pool.length)];
  it.aff[idx] = rollAffix(key, it.ilvl, R);
}
export const dismantleValue = (it) => Math.max(1, Math.round([1, 2, 4, 8][rarityIndex(it)] * (1 + it.ilvl * 0.35)) + (it.plus || 0));

/* ---------- traits, sigil, artifacts ---------- */
export function advanceTotals(save) {
  const t = { hp: 0, mp: 0, damage: 0, armor: 0, crit: 0, speed: 0, regen: 0, dmgPct: 0, hpPct: 0, cdr: 0, goldPct: 0, xpPct: 0 };
  for (const br of TRAITS) for (const n of br.nodes) t[n.stat] += n.per * ((save.traits || {})[n.id] || 0);
  const sl = save.sigil || 0;
  for (const [k, v] of Object.entries(SIGIL_PER)) t[k] += v * sl;
  for (const [lv, b] of Object.entries(SIGIL_BOONS)) if (sl >= +lv) { t.goldPct += b.goldPct || 0; t.xpPct += b.xpPct || 0; }
  for (const id of save.artSlots || []) {
    const a = ARTIFACTS.find((x) => x.id === id), own = id && (save.artifacts || {})[id];
    if (a && own) t[a.stat] += artValue(a, own.lv);
  }
  return t;
}
export function traitUnlocked(save, branch, idx) {
  const spent = branch.nodes.reduce((a, n) => a + ((save.traits || {})[n.id] || 0), 0);
  return spent >= idx * 3;
}

/* ---------- artifacts & expeditions ---------- */
// Award a random artifact; a duplicate raises it one level. Returns a message.
export function grantArtifact(save, R = Math.random) {
  const a = ARTIFACTS[Math.floor(R() * ARTIFACTS.length)];
  save.artifacts = save.artifacts || {};
  const own = save.artifacts[a.id];
  if (!own) { save.artifacts[a.id] = { lv: 1 }; return `New artifact: ${a.name}`; }
  if (own.lv < ART_MAX) { own.lv++; return `${a.name} rose to level ${own.lv}`; }
  save.steel = (save.steel || 0) + 4; return `${a.name} is maxed (+4 steel)`;
}
export function newScout(R = Math.random) {
  const w = [50, 32, 14, 4]; let t = R() * 100, rar = 0;
  for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) { rar = i; break; } }
  return { id: uid(), name: SCOUT_NAMES[Math.floor(R() * SCOUT_NAMES.length)], rar };
}
export const scoutBonus = (scouts) => scouts.reduce((a, c) => a + 0.05 * (c.rar + 1), 0);
export function expeditionOdds(route, scouts) { return Math.min(0.97, route.art + scoutBonus(scouts) - 0.05 * scouts.length); }
export function resolveExpedition(save, ex, R = Math.random) {
  const route = ROUTES.find((r) => r.id === ex.route);
  const crew = save.scouts.filter((c) => ex.scouts.includes(c.id));
  const steel = Math.round(route.steel[0] + R() * (route.steel[1] - route.steel[0]));
  const gold = Math.round(route.gold[0] + R() * (route.gold[1] - route.gold[0]));
  save.steel = (save.steel || 0) + steel; save.gold += gold;
  const found = R() < expeditionOdds(route, crew) ? grantArtifact(save, R) : null;
  return { steel, gold, found, route: route.name };
}
