// Items, hero stat derivation, power score, loot rolls.
import {
  CLASSES, PER_LEVEL, RARITIES, AFFIXES, AFFIX_KEYS, ARMOR_NAMES, CHARM_NAMES, HEROIC_TITLES, xpToNext, MAX_LEVEL,
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
  return { id: uid(), slot, rarity, name, kind, ilvl, base, aff, cls: slot === 'weapon' ? cls : null };
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

export function itemSellValue(it) {
  return Math.max(3, Math.round(7 * it.ilvl * rarityOf(it.rarity).sell));
}

export function itemTotals(it) {
  const t = { hp: 0, mp: 0, damage: 0, armor: 0, crit: 0, speed: 0, regen: 0 };
  if (!it) return t;
  if (it.slot === 'weapon') t.damage += it.base;
  if (it.slot === 'armor') t.armor += it.base;
  for (const a of it.aff) t[a.k] += a.v;
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
  const s = {
    maxHp: Math.round(c.hp + PER_LEVEL.hp * (L - 1) + g.hp),
    maxMp: Math.round(c.mp + PER_LEVEL.mp * (L - 1) + g.mp),
    damage: round(c.damage + PER_LEVEL.damage * (L - 1) + g.damage, 1),
    armor: Math.round(g.armor),
    crit: round(5 + g.crit, 1),
    speed: round(c.speed * (1 + g.speed / 100), 1),
    speedPct: g.speed,
    regen: round(c.manaRegen + g.regen, 2),
  };
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
