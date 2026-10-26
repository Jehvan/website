"""Headless logic tests (no Panda3D needed):  python -m unittest discover -s tests"""
import math
import os
import random
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["XDG_DATA_HOME"] = tempfile.mkdtemp()

from highkeep import data as D, items as I, save as S, world as W
from highkeep.game import Game, Input


def play(cls, stage, floor=0, level=8, seconds=400, god=True):
    s = S.new_save(cls)
    s["level"], s["cleared"] = level, 6
    g = Game(s)
    result = {}
    g.on_end = result.update
    g.start_stage(stage, floor)
    g.god = god
    inp = Input()
    steps = 0
    sk = 0
    while g.mode == "stage" and steps < 60 * seconds:
        steps += 1
        p = g.p
        best, bd = None, 1e9
        for e in g.enemies:
            if not e.dead:
                d = math.hypot(e.x - p.x, e.y - p.y)
                if d < bd:
                    best, bd = e, d
        inp.mx = inp.my = 0.0
        if best:
            a = math.atan2(best.y - p.y, best.x - p.x)
            inp.aim = (best.x, best.y)
            want = 40 if cls == "knight" else 230
            d = 1 if bd > want + 30 else -1 if bd < want - 40 else 0
            inp.mx, inp.my = math.cos(a) * d, math.sin(a) * d
        inp.attack = bool(best) and bd < 560
        if steps % 45 == 0:
            inp.skills[sk % 3] = True
            sk += 1
        g.update(1 / 60, inp)
    return g, result


class LayoutTests(unittest.TestCase):
    def test_deterministic(self):
        a, b = W.build_layout("wood", 2), W.build_layout("wood", 2)
        self.assertEqual(len(a.props), len(b.props))
        self.assertEqual(a.props[5]["x"], b.props[5]["x"])

    def test_all_themes_build(self):
        for th in ("fields", "wood", "bridge", "marsh", "gate", "hall", "vault"):
            L = W.build_layout(th, 3)
            self.assertTrue(L.obstacles or th == "fields")
            self.assertFalse(W.point_blocked(L, *L.start, 10), th)


class ItemTests(unittest.TestCase):
    def test_starting_power(self):
        self.assertEqual(I.hero_stats(S.new_save("knight"))["power"], 125)

    def test_forge_never_loses_levels(self):
        it = I.roll_item(random.random, "weapon", 3, "rare", "knight")
        for _ in range(60):
            before = it["plus"]
            I.forge_attempt(it)
            self.assertGreaterEqual(it["plus"], before)
        info = {"fp": 100, "plus": 0, "ilvl": 1, "rarity": "common"}
        self.assertTrue(I.forge_info(info)["guaranteed"])

    def test_reforge_changes_affix_key(self):
        it = I.roll_item(random.random, "armor", 3, "rare", "knight")
        keys = [a["k"] for a in it["aff"]]
        I.reforge_affix(it, 0)
        self.assertNotIn(it["aff"][0]["k"], keys[1:] if it["aff"][0]["k"] == keys[0] else keys)

    def test_set_bonus(self):
        s = S.new_save("knight")
        for sl in D.SLOTS:
            s["equip"][sl] = I.roll_item(random.random, sl, 2, "rare", "knight")
            s["equip"][sl]["set"] = 1
        self.assertIn("damage", I.set_bonus_totals(s["equip"]))

    def test_expedition_resolves(self):
        s = S.new_save("mage")
        res = I.resolve_expedition(s, {"route": "barrow", "scouts": ["scout0"]}, R=lambda: 0.0)
        self.assertTrue(res["found"])
        self.assertGreater(s["steel"], 6)


class SaveTests(unittest.TestCase):
    def test_roundtrip(self):
        s = S.new_save("ranger")
        s["gold"] = 1234
        self.assertTrue(S.write_save(s))
        self.assertEqual(S.load_save()["gold"], 1234)


class SimTests(unittest.TestCase):
    def test_every_stage_completes(self):
        for cls in ("knight", "ranger", "mage"):
            for st in (1, 2, 3, 4, 5, 6):
                g, res = play(cls, st)
                self.assertTrue(res.get("won"), f"{cls} stage {st}")

    def test_vault_floors(self):
        for f in (1, 5):
            g, res = play("knight", "vault", f)
            self.assertTrue(res.get("won"), f"vault {f}")

    def test_defeat_flow(self):
        s = S.new_save("knight")
        g = Game(s)
        res = {}
        g.on_end = res.update
        g.start_stage(1)
        inp = Input()
        for _ in range(60 * 5):
            g.update(1 / 60, inp)
            if g.stage.state != "intro":
                break
        g.proj.append(type("Q", (), dict(team="e", kind="earrow", x=g.p.x, y=g.p.y, vx=0, vy=0, ang=0, r=5, dmg=99999, life=1, hit=set(), t=0, splash=0, pierce=0, crit=False))())
        for _ in range(60 * 6):
            g.update(1 / 60, inp)
        self.assertFalse(res["won"])


if __name__ == "__main__":
    unittest.main()
