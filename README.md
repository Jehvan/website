# Highkeep Road
> **Unity version:** the game has been rebuilt for Unity in [`unity/`](unity/README.md) (click-to-move, animated 3D characters). The Python/Panda3D version is in `python/`.

> **Two versions live here.** The browser game (Vite + three.js) is documented below; the Python / Panda3D rewrite is in
> [`python/`](python/README.md) (`cd python && pip install -r requirements.txt && python main.py`).

An original medieval-fantasy action RPG for the browser. Built with **Vite + three.js 0.128**; every texture, model and
icon is generated in code (canvas textures, procedural geometry) — there are no image or model files.

> The king rode east and never returned. The Ashen Warband holds the road from Millbrook to Highkeep, and the heir is
> held in the Throne Hall. Fight down the road to free the heir.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Play

| Action | Desktop | Touch |
| --- | --- | --- |
| Move | `WASD` / arrows | floating joystick (left half of the screen) |
| Aim | mouse | auto-aims at the nearest enemy |
| Attack | click / `Space` | attack button |
| Skills | `1` `2` `3` (unlock at level 1 / 3 / 5) | skill buttons |
| Potion | `F` | potion button |
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

Graphics can be switched between **Low** and **High** from the pause menu (Low is the default on touch devices:
no shadow maps, pixel ratio 1, fewer instances and particles).

## Code layout

| File | Role |
| --- | --- |
| `src/data.js` | classes, skills, stages, enemies, rarities, affixes |
| `src/world.js` | seeded stage layouts (road, props, obstacles) and collision |
| `src/items.js`, `src/save.js` | loot rolls, hero stats, power score, `localStorage` persistence |
| `src/game.js` | game state and simulation: waves, combat, AI, skills, loot |
| `src/render2d.js` | placeholder / WebGL-less fallback renderer (`?2d` forces it) |
| `src/renderer.js` | three.js renderer: camera, sky + PMREM, shadows, effects, entity sync |
| `src/art/*` | procedural textures, materials, jointed humanoid rig, characters, props, world dressing |
| `src/overlay.js` | 2D overlay canvas: damage numbers, health bars, boss bar |
| `src/hud.js`, `src/ui.js`, `src/icons.js` | HUD, title/camp/result/pause screens, procedural icons |
| `src/input.js` | keyboard, mouse and touch input |
| `src/gallery.js` | dev-only art gallery: `/?gallery=knight,regent&pose=walk` |

Debug helpers: `window.__hk` exposes the game state; query flags `?2d`, `?gallery=…`, `?dist=1.5` (camera zoom).
