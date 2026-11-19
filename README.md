# Highkeep Road

An original medieval-fantasy action RPG for the browser, in the spirit of Kingsroad: click-to-move, click-to-attack,
animated 3D heroes and skeleton raiders, torch-lit halls. Built with **Vite + three.js 0.187**.

> Other versions in this repo: a Unity project in [`unity/`](unity/README.md) and a Python / Panda3D one in
> [`python/`](python/README.md). The browser game below is the current one.

> The king rode east and never returned. The Ashen Warband holds the road from Millbrook to Highkeep, and the heir is
> held in the Throne Hall. Fight down the road to free the heir.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Play

| Action | Mouse / keyboard | Touch |
| --- | --- | --- |
| Walk | click the ground (hold to keep walking toward the cursor); `WASD` also works | tap the ground (hold to keep walking) |
| Attack | click an enemy: the hero walks into range and attacks until it falls | tap an enemy |
| Attack in place | `Shift`+click or hold `Space` | |
| Skills | `1` `2` `3` (aimed at your target, else the cursor) | skill buttons |
| Potion | `F` | potion button |
| Zoom | mouse wheel | |
| Pause | `Esc` / `P` | pause button |

Title → pick a class (or continue) → Camp (road map, hero, bag with compare-before-equip, potion shop) → stage waves →
victory/defeat → Camp. Clear all six stages to free the heir and unlock **The Deep Vaults** (endless floors, a warlord
every fifth floor, best floor tracked). Progress is saved to `localStorage`.

**Gear progression** (Forge tab in camp): forge items to +10 (each level +10% to every stat; a failure never lowers the
item but builds pity until the next forge is guaranteed), reforge an effect using a spare matching item, dismantle gear
into forging steel, study set items for permanent set research, wear 2/3 pieces of a set for set bonuses, lock items,
sort the bag, and buy extra bag slots.

**Advance tab**: raise skill levels (+10% power, faster cooldown), spend trait points in a three-branch tree, level the
House Sigil (stat bonuses plus gold/experience boons), and collect/equip artifacts dropped by bosses (duplicates level them).

**Scout Lodge** (Advance → Lodge, opens after stage 3): send scouts on real-time expeditions (they keep running while the
game is closed) for steel, gold and artifacts; rarer scouts raise the artifact odds.

Graphics can be switched between **Low** and **High** from the pause menu.

## Art

All art is free CC0: characters, buildings and props from the **KayKit** packs by Kay Lousberg (kaylousberg.com), and
ground / stone / wood textures from **Poly Haven**. Characters were trimmed to the animations the game uses with
`tools/blender_chars.py`; `tools/fetch_polyhaven.py` downloads the textures.

## Checks

- `npx vite-node tools/simtest.mjs`: a bot that only clicks enemies plays every stage with every class.
- `node tools/play.mjs <out> <class> <stage>`: drives the real game in headless Chromium and saves screenshots.

## Code layout

| File | Role |
| --- | --- |
| `src/data.js` | classes, skills, stages, enemies, rarities, affixes |
| `src/world.js` | seeded stage layouts (road, props, obstacles) and collision |
| `src/items.js`, `src/save.js` | loot rolls, hero stats, power score, `localStorage` persistence |
| `src/game.js` | game state and simulation: waves, combat, AI, skills, loot |
| `src/nav.js` | A* paths for click-to-move and the flow field enemies follow |
| `src/renderer.js` | three.js renderer: camera, shadows, bloom and colour grade, picking, town hub |
| `src/gfx/*` | model catalogue, stage builder, PBR ground blending, animated characters, spell effects |
| `src/layouts.json` | baked stage layouts (props, obstacles, roads) |
| `src/overlay.js` | 2D overlay canvas: damage numbers, health bars, boss bar |
| `src/hud.js`, `src/ui.js`, `src/icons.js` | HUD, title/camp/result/pause screens, procedural icons |
| `src/input.js` | keyboard, mouse and touch input |
| `src/gallery.js` | dev-only art gallery: `/?gallery=knight,regent&pose=walk` |

Debug helpers: `window.__hk` exposes the game state; query flags `?2d`, `?gallery=…`, `?dist=1.5` (camera zoom).
