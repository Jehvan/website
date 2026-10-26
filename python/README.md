# Highkeep Road (Python / Panda3D)

A medieval-fantasy action RPG, rewritten in **Python** on top of the **Panda3D** engine. Every texture, model and
icon is generated in code at start-up (procedural meshes, painted noise textures, a jointed humanoid rig) - the
repository contains no image or model assets. Textures are cached to your user data folder after the first run.

> The king rode east and never returned. The Ashen Warband holds the road from Millbrook to Highkeep, and the heir is
> held in the Throne Hall. Fight down the road to free the heir.

## Run

```bash
cd python
pip install -r requirements.txt      # just panda3d
python main.py
```

Python 3.9+ and a GPU/driver with OpenGL 3.0+ are required. The first launch paints the textures (a few seconds).

## Controls

| Action | Input |
| --- | --- |
| Move | `WASD` / arrow keys |
| Aim | mouse |
| Attack | left click or `Space` |
| Skills | `1` `2` `3` (unlock at level 1 / 3 / 5) or click the skill buttons |
| Potion | `F` |
| Pause | `Esc` or `P` |

## Game

Title -> pick a class (or continue) -> Camp (road map, hero, bag, forge, advance, shop) -> stage waves -> victory or
defeat -> Camp. Clear all six stages to free the heir and unlock **The Deep Vaults** (endless floors, a warlord every
fifth floor). Gear progression follows the Kingsroad-style loop: forge items to +10, reforge effects, dismantle for
steel, wear 2/3-piece sets, study sets for permanent research bonuses, level skills, spend trait points, raise the House
Sigil, collect artifacts and send scouts on real-time expeditions from the Lodge.

Saves live in `~/.local/share/highkeep-road` (`%APPDATA%\highkeep-road` on Windows, `~/Library/Application Support`
on macOS). Graphics (Low/High) can be switched from the pause menu; Low drops shadow maps, point lights and
some detail.

## Layout

| File | Role |
| --- | --- |
| `highkeep/data.py` | classes, skills, stages, enemies, rarities, progression tables |
| `highkeep/world.py` | seeded stage layouts (road, props, obstacles) and collision |
| `highkeep/items.py`, `save.py` | loot, hero stats, power, forge/sets/research/expeditions, JSON saves |
| `highkeep/game.py` | pure-logic simulation (no graphics): waves, combat, AI, skills, loot |
| `highkeep/gfx/meshlib.py` | procedural mesh builder (boxes, lathes, tori, extrusions) |
| `highkeep/gfx/textures.py` | procedural texture painters + terrain painter, disk cached |
| `highkeep/gfx/rig.py`, `characters.py` | jointed humanoid rig, animator and the 8 character designs |
| `highkeep/gfx/props.py`, `world3d.py` | trees, cottages, bridge, castle, hall... and stage assembly |
| `highkeep/gfx/scene.py`, `effects.py`, `post.py` | entity sync, telegraphs/loot/fx, camera, tone-mapping + bloom post pass |
| `highkeep/uikit.py`, `screens.py`, `hud.py`, `icons.py` | UI toolkit, title/camp/result/pause screens, HUD, procedural icons |
| `highkeep/app.py` | window, input and main loop |
| `tests/test_logic.py` | headless tests: `python -m unittest discover -s tests` |

The original browser version (Vite + three.js) still lives in `../src`.
