// Every model the game uses, in one table: file and the height in metres it should stand at.
const HX = 'hex/', DG = 'dungeon/';
const h = (file, height, sink = 0) => ({ file: HX + file + '.gltf', height, sink });
const d = (file, height, sink = 0) => ({ file: DG + file + '.gltf.glb', height, sink });

export const PROPS = {
  tree: [h('tree_single_A', 7.6, -0.4), h('tree_single_B', 8.2, -0.4), h('tree_single_A', 6.4, -0.4)],
  pine: [h('tree_single_B', 9, -0.4), h('tree_single_A', 8.4, -0.4)],
  deadtree: [h('tree_single_A_cut', 1.5, -0.1)],
  rock: [h('rock_single_A', 0.6), h('rock_single_B', 0.9), h('rock_single_C', 0.7), h('rock_single_D', 1.0), h('rock_single_E', 0.8)],
  hay: [h('sack', 1.1), h('resource_lumber', 1.0)],
  logs: [h('resource_lumber', 1.4)],
  fence: [h('fence_wood_straight', 1.25)],
  cottage: [h('building_home_A_red', 5.6), h('building_home_B_red', 7.2), h('building_home_A_blue', 5.6), h('building_home_B_blue', 7.2)],
  lamp: [d('torch_lit', 2.4, -0.2)],
  brazier: [d('torch_lit', 2.7, -0.2)],
  pillar: [d('pillar_decorated', 5.2)],
  column: [d('column', 2.6)],
  ruin: [d('wall_broken', 3.4), d('rubble_half', 1.6)],
  tower: [h('building_tower_A_red', 11)],
  wall: [h('wall_straight', 5.5)],
  portcullis: [h('wall_straight_gate', 6)],
  banner: [d('banner_patternA_red', 4.2)],
  throne: [d('chair', 3.6)],
  tent: [h('tent', 3.4)], tent_blue: [h('tent', 3.4)], camp_tent: [h('tent', 3.0)],
  standard: [h('flag_red', 3.6)],
  rack: [h('weaponrack', 1.6)],
  barrel: [h('barrel', 1.05)],
  crate: [h('crate_A_big', 1.0), h('crate_B_small', 0.8)],
  well: [h('building_well_red', 4.2)],
  cart: [h('wheelbarrow', 0.9)],
  palisade: [h('fence_stone_straight', 1.8)],
  campfire: [h('resource_lumber', 0.55)],
  sarcophagus: [d('trunk_large_A', 1.3)],
  bones: [d('rubble_half', 0.7)],
  reeds: [h('waterplant_A', 1.0), h('waterplant_B', 1.1)],
  forge: [h('building_blacksmith_red', 4.6)],
  market: [h('building_market_red', 5.0)],
  tavern: [h('building_tavern_red', 8.5)],
  windmill: [h('building_windmill_red', 10)],
  church: [h('building_church_red', 10)],
  mountain: [h('mountain_A_grass_trees', 16), h('mountain_B_grass_trees', 18), h('hills_A_trees', 9)],
  hallwall: [d('wall', 5.2)], hallwindow: [d('wall_window_closed', 5.2)], torch_wall: [d('torch_mounted', 1.6)],
  chest: [{ file: DG + 'chest.glb', height: 1.0, sink: 0 }], keg: [d('keg_decorated', 1.4)], table: [d('table_long_decorated_A', 1.4)], stack: [d('box_stacked', 2.4)],
  rubble: [d('rubble_large', 2.2)], candles: [d('candle_triple', 0.9)], shelf: [d('shelf_large', 2.6)],
};

export const pick = (kind, x, y) => { const a = PROPS[kind]; return a ? a[Math.abs(Math.floor(x * 7.13 + y * 3.71)) % a.length] : null; };

const HERO_ANIMS = { idle: 'Idle', run: 'Running_A', walk: 'Walking_A', hit: 'Hit_A', death: 'Death_A' };
const FOE_ANIMS = { idle: 'Idle_Combat', run: 'Running_A', walk: 'Walking_D_Skeletons', hit: 'Hit_A', death: 'Death_A', spawn: 'Spawn_Ground_Skeletons' };
// shape: bone scales that turn KayKit's chunky proportions into a taller, grittier build
const HEROIC = { head: 0.7, leg: 1.28, torso: 1.14 };
export const CHARS = {
  knight: { file: 'chars/Knight.glb', height: 2.2, anims: HERO_ANIMS, attacks: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop'], runRef: 6.2, shape: HEROIC },
  ranger: { file: 'chars/Rogue_Hooded.glb', height: 2.1, anims: HERO_ANIMS, attacks: ['2H_Ranged_Shoot'], runRef: 6.8, shape: HEROIC },
  mage: { file: 'chars/Mage.glb', height: 2.2, anims: HERO_ANIMS, attacks: ['Spellcast_Shoot'], runRef: 6.4, shape: HEROIC },
  grunt: { file: 'chars/Skeleton_Minion.glb', height: 2.0, anims: FOE_ANIMS, attacks: ['1H_Melee_Attack_Chop'], runRef: 3.2, shape: { head: 0.74, leg: 1.22, torso: 1.1 } },
  bowman: { file: 'chars/Skeleton_Rogue.glb', height: 2.05, anims: FOE_ANIMS, attacks: ['1H_Ranged_Shoot'], runRef: 3.0, shape: { head: 0.74, leg: 1.22, torso: 1.1 } },
  wisp: { file: 'chars/Skeleton_Mage.glb', height: 1.9, anims: { ...FOE_ANIMS, run: 'Running_C' }, attacks: ['Spellcast_Shoot'], runRef: 5, hover: true, tint: 0xffb080, shape: { head: 0.74, leg: 1.1, torso: 1.1 } },
  brute: { file: 'chars/Skeleton_Warrior.glb', height: 3.1, anims: FOE_ANIMS, attacks: ['2H_Melee_Attack_Chop'], runRef: 2.0, shape: { head: 0.7, leg: 1.2, torso: 1.15 } },
  regent: { file: 'chars/Barbarian.glb', height: 4.2, anims: { idle: 'Idle_Combat', run: 'Running_C', walk: 'Running_A', hit: 'Hit_A', death: 'Death_A' }, attacks: ['2H_Melee_Attack_Chop'], runRef: 3, tint: 0x9a8f9c, shape: HEROIC },
  villager: { file: 'chars/Rogue.glb', height: 2.0, anims: HERO_ANIMS, attacks: [], runRef: 4, shape: HEROIC },
  guard: { file: 'chars/Knight.glb', height: 2.2, anims: HERO_ANIMS, attacks: [], runRef: 4, shape: HEROIC, tint: 0xc8d4ff },
  smith: { file: 'chars/Barbarian.glb', height: 2.3, anims: { ...HERO_ANIMS, idle: 'Idle', walk: 'Running_A' }, attacks: [], runRef: 4, shape: HEROIC },
  heir: { file: 'chars/Rogue.glb', height: 1.9, anims: { ...HERO_ANIMS, idle: 'Sit_Floor_Idle' }, attacks: [], runRef: 4, shape: HEROIC, tint: 0xc8d8ff },
};

/** All model files a stage could need (for the preloader). */
export function allModelFiles() {
  const s = new Set();
  for (const a of Object.values(PROPS)) for (const p of a) s.add(p.file);
  for (const c of Object.values(CHARS)) s.add(c.file);
  return [...s];
}
