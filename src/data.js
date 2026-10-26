// Static game data: classes, skills, stages, enemies, rarities, affixes.

export const WORLD_W = 1600;
export const WORLD_H = 1150;
export const MAX_LEVEL = 30;
export const MAX_POTIONS = 5;
export const POTION_PRICE = 25;
export const BAG_SIZE = 24;       // starting bag slots
export const BAG_MAX = 60;
export const BAG_EXPAND = 6;      // slots per purchase
export const bagExpandCost = (size) => 120 + (size - BAG_SIZE) * 25;
export const MAX_PLUS = 10;       // forge levels
export const RESEARCH_MAX = 10;

// Armour/weapon sets (original). One per stage tier; Magic+ items may roll one.
export const SETS = [
  { id: 0, name: 'Millbrook Militia' }, { id: 1, name: 'Hollow Stalker' }, { id: 2, name: 'Toll Warden' },
  { id: 3, name: 'Marsh Wraith' }, { id: 4, name: 'Highkeep Guard' }, { id: 5, name: 'Throne Breaker' },
];
// bonus totals for wearing 2 / 3 pieces of a set, scaled by set tier t = 1 + 0.35*setId
export const SET_BONUS = {
  2: (t) => ({ armor: Math.round(6 * t), hp: Math.round(18 * t) }),
  3: (t) => ({ damage: Math.round(3 * t * 10) / 10, crit: 3 }),
};
export const SET_BONUS_TEXT = { 2: '+Armor, +Health', 3: '+Damage, +3% Crit' };

export const xpToNext = (L) => Math.round(30 * Math.pow(L, 1.55) + 30);

export const CLASSES = {
  knight: {
    id: 'knight', name: 'Knight', hp: 150, mp: 60, speed: 165, damage: 16,
    blurb: 'Armoured vanguard. Cuts a wide arc and shrugs off blows.',
    weaponKinds: ['Sword', 'Longsword', 'Arming Sword', 'Falchion'],
    attack: { type: 'melee', range: 64, arc: 130, cd: 0.46, mult: 1.0, dur: 0.28 },
    manaRegen: 2.5,
    skills: [
      { id: 'rush', name: 'Shield Rush', unlock: 1, cost: 14, cd: 6, desc: 'Charge forward, hurling foes aside.' },
      { id: 'whirl', name: 'Whirlwind', unlock: 3, cost: 26, cd: 10, desc: 'Spin for 1.5s, striking everything near.' },
      { id: 'rally', name: 'Rally Cry', unlock: 5, cost: 30, cd: 18, desc: 'Heal 25% and deal +50% damage for 6s.' },
    ],
  },
  ranger: {
    id: 'ranger', name: 'Ranger', hp: 115, mp: 70, speed: 188, damage: 12,
    blurb: 'Swift archer. Keeps distance and fills the air with arrows.',
    weaponKinds: ['Longbow', 'Shortbow', 'Yew Bow', 'Hornbow'],
    attack: { type: 'arrow', range: 560, cd: 0.36, mult: 1.0, dur: 0.22, speed: 560 },
    manaRegen: 2.8,
    skills: [
      { id: 'volley', name: 'Volley', unlock: 1, cost: 14, cd: 5, desc: 'Loose seven arrows in a fan.' },
      { id: 'tumble', name: 'Tumble', unlock: 3, cost: 8, cd: 4, desc: 'Roll away, untouchable while rolling.' },
      { id: 'rain', name: 'Arrow Rain', unlock: 5, cost: 32, cd: 14, desc: 'Darken an area with arrows for 3s.' },
    ],
  },
  mage: {
    id: 'mage', name: 'Mage', hp: 95, mp: 130, speed: 172, damage: 15,
    blurb: 'Glass cannon. Firebolts that splash, spells that reshape the fight.',
    weaponKinds: ['Staff', 'Rod', 'Wand', 'Scepter'],
    attack: { type: 'bolt', range: 520, cd: 0.58, mult: 1.1, dur: 0.3, speed: 400, splash: 54 },
    manaRegen: 4,
    skills: [
      { id: 'nova', name: 'Frost Nova', unlock: 1, cost: 20, cd: 7, desc: 'Burst of frost that damages and slows.' },
      { id: 'blink', name: 'Blink', unlock: 3, cost: 12, cd: 4, desc: 'Teleport a short distance.' },
      { id: 'meteor', name: 'Meteor', unlock: 5, cost: 40, cd: 12, desc: 'Call a meteor; lands after a short delay.' },
    ],
  },
};

export const PER_LEVEL = { hp: 14, mp: 6, damage: 1.8 };

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#cdc6b4', affixes: 0, sell: 1, weight: 58 },
  { id: 'magic', name: 'Magic', color: '#5eaaff', affixes: 1, sell: 2.2, weight: 29 },
  { id: 'rare', name: 'Rare', color: '#f1d04b', affixes: 2, sell: 4.5, weight: 11 },
  { id: 'heroic', name: 'Heroic', color: '#ff7a2e', affixes: 4, sell: 9, weight: 2 },
];

export const AFFIXES = {
  hp: { label: 'Health', base: 12, fmt: (v) => `+${v} Health`, name: ['Hale', 'of Vigor'] },
  mp: { label: 'Mana', base: 8, fmt: (v) => `+${v} Mana`, name: ['Lucid', 'of the Well'] },
  damage: { label: 'Damage', base: 1.6, fmt: (v) => `+${v} Damage`, name: ['Keen', 'of Edges'], dec: 1 },
  armor: { label: 'Armor', base: 3, fmt: (v) => `+${v} Armor`, name: ['Warded', 'of Bulwarks'] },
  crit: { label: 'Crit', base: 1.6, fmt: (v) => `+${v}% Crit`, name: ['Sharp', 'of Precision'], dec: 1 },
  speed: { label: 'Speed', base: 2, fmt: (v) => `+${v}% Speed`, name: ['Fleet', 'of Wind'], dec: 1 },
  regen: { label: 'Mana Regen', base: 0.45, fmt: (v) => `+${v} Mana/s`, name: ['Flowing', 'of Tides'], dec: 2 },
};
export const AFFIX_KEYS = Object.keys(AFFIXES);

export const SLOTS = ['weapon', 'armor', 'charm'];
export const SLOT_LABEL = { weapon: 'Weapon', armor: 'Armor', charm: 'Charm' };
export const ARMOR_NAMES = ['Jerkin', 'Hauberk', 'Brigandine', 'Cuirass', 'Gambeson', 'Mantle'];
export const CHARM_NAMES = ['Charm', 'Talisman', 'Amulet', 'Token', 'Sigil', 'Ember Stone'];
export const HEROIC_TITLES = ['Dawnwarden', 'Kingsmark', 'Ashbreaker', 'Hollowlight', 'Ember-Sworn', 'Regent\'s Bane'];

// Enemy templates (stats at stage index 0)
export const ENEMIES = {
  grunt: {
    id: 'grunt', name: 'Ash Grunt', hp: 44, dmg: 8, speed: 74, r: 13, xp: 7, gold: [2, 5],
    windup: 0.45, cd: 1.2, range: 34, drop: 0.07,
  },
  bowman: {
    id: 'bowman', name: 'Ash Bowman', hp: 30, dmg: 7, speed: 66, r: 12, xp: 9, gold: [3, 6],
    windup: 0.5, cd: 1.9, range: 270, keep: 190, drop: 0.09, projSpeed: 270,
  },
  wisp: {
    id: 'wisp', name: 'Ember Wisp', hp: 17, dmg: 6, speed: 128, r: 10, xp: 5, gold: [1, 3],
    windup: 0.25, cd: 1.0, range: 24, drop: 0.04, flying: true,
  },
  brute: {
    id: 'brute', name: 'Brute', hp: 170, dmg: 22, speed: 44, r: 21, xp: 36, gold: [10, 18],
    windup: 0.95, cd: 2.2, range: 56, slamR: 78, drop: 0.38,
  },
  regent: {
    id: 'regent', name: 'The Ashen Regent', hp: 1500, dmg: 26, speed: 62, r: 27, xp: 420, gold: [140, 180],
    boss: true, drop: 1,
  },
};

const rep = (type, n) => ({ type, n });

export const STAGES = [
  {
    id: 1, name: 'Millbrook Fields', theme: 'fields', power: 105,
    blurb: 'The road begins among thatched cottages and hay-fields. Raiders have already burned the mill.',
    node: [0.10, 0.80],
    waves: [[rep('grunt', 5)], [rep('grunt', 4), rep('bowman', 2)], [rep('grunt', 5), rep('bowman', 2), rep('wisp', 2)]],
  },
  {
    id: 2, name: 'Hollow Wood', theme: 'wood', power: 150,
    blurb: 'Dense forest, thick with log piles and ambush. Bowmen shoot from the shadows.',
    node: [0.26, 0.55],
    waves: [[rep('grunt', 5), rep('bowman', 2)], [rep('wisp', 5), rep('bowman', 3)], [rep('grunt', 5), rep('brute', 1), rep('bowman', 2)]],
  },
  {
    id: 3, name: 'Old Toll Bridge', theme: 'bridge', power: 200,
    blurb: 'The warband holds the only crossing. Fight through the toll gate and over the river.',
    node: [0.42, 0.74],
    waves: [[rep('grunt', 6), rep('bowman', 3)], [rep('brute', 1), rep('grunt', 4), rep('wisp', 3)], [rep('brute', 2), rep('bowman', 3), rep('grunt', 4)]],
  },
  {
    id: 4, name: 'Ember Marsh', theme: 'marsh', power: 255,
    blurb: 'Murky pools, dead trees and drowned ruins. Wisps drift in from the fog.',
    node: [0.58, 0.46],
    waves: [[rep('wisp', 7), rep('grunt', 4)], [rep('brute', 2), rep('bowman', 4), rep('wisp', 3)], [rep('grunt', 7), rep('brute', 2), rep('bowman', 3)]],
  },
  {
    id: 5, name: 'Highkeep Gate', theme: 'gate', power: 315,
    blurb: 'The great gate of Highkeep, banners hung with ash. Only the courtyard stands between you and the hall.',
    node: [0.74, 0.68],
    waves: [[rep('grunt', 7), rep('bowman', 4)], [rep('brute', 2), rep('wisp', 5), rep('bowman', 3)], [rep('brute', 3), rep('grunt', 6), rep('bowman', 4)]],
  },
  {
    id: 6, name: 'The Throne Hall', theme: 'hall', power: 385,
    blurb: 'The heir is bound before the throne. The Ashen Regent waits.',
    node: [0.90, 0.36],
    waves: [[rep('grunt', 6), rep('bowman', 4)], [rep('brute', 2), rep('wisp', 5), rep('grunt', 4)], [rep('regent', 1)]],
  },
];

export const VAULT = {
  id: 'vault', name: 'The Deep Vaults', theme: 'vault', power: 400, node: [0.95, 0.80],
  blurb: 'Endless vaults beneath Highkeep. A warlord waits every fifth floor.',
};

export const stageById = (id) => (id === 'vault' ? VAULT : STAGES[id - 1]);

export const ENDING_TEXT =
  'The Regent falls, and the heir is freed from the throne-chains. The road is open again from Millbrook to Highkeep. ' +
  'Beneath the hall, a stair leads down to the Deep Vaults...';

export const INTRO_TEXT =
  'The king rode east and never returned. The Ashen Warband holds the road from Millbrook to Highkeep, ' +
  'and the heir is held in the Throne Hall. Fight down the road and free the heir.';
