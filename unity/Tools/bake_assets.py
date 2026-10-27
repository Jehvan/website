"""Bake data and painted textures from the Python version into the Unity project.

Run from the repo root:  python unity/Tools/bake_assets.py
Outputs into unity/Assets/HighkeepRoad/Resources/{Layouts,Ground,Icons,Hud}.
"""
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "python"))

from panda3d.core import loadPrcFileData, PNMImage, Filename  # noqa: E402
loadPrcFileData("", "window-type none\naudio-library-name null\nnotify-level error")

from highkeep import world, data as D            # noqa: E402
from highkeep.gfx import textures as T           # noqa: E402
from highkeep import icons as IC                 # noqa: E402

OUT = os.path.join(ROOT, "unity", "Assets", "HighkeepRoad", "Resources")
VAULT_FLOORS = 60


def jsonable(v):
    if isinstance(v, dict):
        return {k: jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [jsonable(x) for x in v]
    if isinstance(v, float):
        return round(v, 3)
    return v


def layout_json(L):
    d = {"theme": L.theme, "seed": L.seed, "floor": L.floor, "boss": L.boss, "indoor": L.indoor, "w": L.w, "h": L.h,
         "road_w": L.road_w, "bounds": L.bounds, "start": L.start, "props": L.props, "obstacles": L.obstacles,
         "lights": L.lights, "road": L.road, "river": L.river, "bridge": L.bridge, "pools": L.pools, "plots": L.plots}
    if hasattr(L, "plaza"):
        d["plaza"] = L.plaza
        d["paths"] = L.paths
    return jsonable(d)


def save_png(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.write(Filename.fromOsSpecific(path))


def main(only=None):
    layouts = []
    for st in D.STAGES:
        layouts.append((f"stage{st['id']}", world.build_layout(st["theme"], st["id"]), f"ground_{st['theme']}"))
    for f in range(1, VAULT_FLOORS + 1):
        boss = f % 5 == 0
        layouts.append((f"vault{f}", world.build_layout("vault", 1000 + f, boss=boss, floor=f), "ground_vault_boss" if boss else "ground_vault"))
    layouts.append(("town", world.build_town(), "ground_town"))

    ldir = os.path.join(OUT, "Layouts")
    os.makedirs(ldir, exist_ok=True)
    painted = set()
    for name, L, gname in layouts:
        js = layout_json(L)
        js["ground"] = gname
        with open(os.path.join(ldir, name + ".json"), "w") as f:
            json.dump(js, f, separators=(",", ":"))
        if only != "layouts" and gname not in painted:
            painted.add(gname)
            print("painting", gname)
            save_png(T._paint_ground(L, "ultra"), os.path.join(OUT, "Ground", gname + ".png"))
    if only == "layouts":
        return

    names = ["rush", "whirl", "rally", "volley", "tumble", "rain", "nova", "blink", "meteor", "potion", "sword", "bow", "staff",
             "armor", "charm", "coin", "steel", "knight", "ranger", "mage"]
    for n in names:
        img = PNMImage(64, 64, 4)
        img.alphaFill(0)
        from panda3d.core import PNMPainter
        IC._draw(n, PNMPainter(img))
        save_png(img, os.path.join(OUT, "Icons", n + ".png"))
    for n, fn in (("detail", T.detail), ("grass_blade", lambda: T.grass_blade("#5c6c32", 23))):
        img = PNMImage()
        fn().store(img)
        img.applyExponent(1 / 2.2) if n != "detail" else None
        save_png(img, os.path.join(OUT, "Textures", n + ".png"))
    print("done")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
