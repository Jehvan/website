# Highkeep Road (Unity)

The Kingsroad-style action RPG, rebuilt for Unity: click-to-move, click-to-attack, animated 3D characters,
real-time shadows, torch light, fog and a filmic colour grade.

## Open it

1. Install **Unity Hub** and a **Unity 2022.3 LTS** or **Unity 6** editor (the free Personal licence is fine).
2. In Unity Hub: **Add > Add project from disk** and pick this `unity` folder. If Hub asks about the editor
   version, choose the one you have installed.
3. The first import takes a few minutes (models, textures, shaders). The project then switches itself to linear
   colour and creates `Assets/Scenes/Main.unity`.
4. Press **Play**. The game boots itself in any scene; no setup needed.

To build a standalone game: **File > Build Settings > Build** (Main is already in the scene list).

## Controls

| Action | Input |
|---|---|
| Walk | Left-click the ground (hold to keep walking toward the cursor). WASD also works |
| Attack | Left-click an enemy: the hero walks into range and keeps attacking until it falls |
| Attack in place | Shift + click, or hold Space |
| Skills | 1, 2, 3 (aimed at your target, or at the cursor). The action bar buttons work too |
| Potion | F |
| Zoom | Mouse wheel |
| Pause / graphics | Esc |

## Layout

- `Assets/HighkeepRoad/Core`: the whole game simulation in plain C# (no UnityEngine). Combat, AI, waves,
  loot, forge, sets, traits, sigil, relics, expeditions, saves.
- `Assets/HighkeepRoad/Runtime`: the Unity side.
  - `HighkeepApp`: the app itself (modes, input, saving).
  - `StageView` and `CharacterView`: the 3D scene and the animated characters.
  - `CameraRig`: the camera and post-processing.
  - `Hud` and `Screens`: the in-game UI and menus.
  - `ModelCatalog`: the single table of every 3D model and its size.
- `Assets/HighkeepRoad/Resources`: models, stage layouts, painted ground textures, icons, fonts and shaders.
- `Assets/HighkeepRoad/Editor`: import settings and the one-time project setup.
- `Tools`: scripts that produced the assets (Blender conversion, layout baking), plus headless checks.
  - `CoreTests`: `dotnet run` plays every stage with a click-to-target bot.
  - `UnityCheck`: compile-checks the Unity scripts against Unity's reference assemblies.

## Swapping the art

Every model is listed in `Runtime/ModelCatalog.cs`, with the file it uses, the texture atlas and the height
in metres it should stand at. To use a different art pack (for example a grittier commercial one), drop its
FBX files under `Resources/Models` and change the entries there. Sizes are normalised automatically, so
nothing else needs to change.

Saves live in Unity's `Application.persistentDataPath` (menu **Highkeep > Delete Save** clears it).
