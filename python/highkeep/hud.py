"""In-game HUD: bars, level badge, stage/wave, gold, skill/potion buttons, banner, boss bar, health bars, damage numbers."""
import math

from panda3d.core import NodePath, TextNode, TransparencyAttrib

from . import data as D
from .icons import icon
from .uikit import INK, DIM, EMBER, N

SKILL_KEYS = ["1", "2", "3"]


class Hud:
    def __init__(self, app):
        self.app = app
        self.kit = app.kit
        self.root = app.base.pixel2d.attachNewNode("hud")
        self.root.setBin("gui-popup", 5)
        self.hits = []
        self.pool = []
        self.bars = {}
        self.cache = {}
        self.built_for = None

    # ------------------------------------------------------------ build
    def build(self, cls):
        k = self.kit
        for c in self.root.getChildren():
            c.removeNode()
        self.pool = []
        self.cache = {}
        self.built_for = cls
        W, H = k.W, k.H
        u = max(0.8, min(1.5, H / 720))
        self.u = u
        r = self.root
        # top-left
        k.box(r, 12, 12, 44 * u, 44 * u, (0.12, 0.09, 0.07, 0.95), EMBER, 2)
        self.lvl = k.text(r, 12 + 22 * u, 16 * u, "1", 22 * u, INK, "center")
        bx, bw = 64 * u, 230 * u
        self.hp = self._bar(r, bx, 12 * u, bw, 17 * u, (0.8, 0.22, 0.17, 1))
        self.mp = self._bar(r, bx, 31 * u, bw, 14 * u, (0.22, 0.4, 0.88, 1))
        self.xp = self._bar(r, bx, 47 * u, bw, 6 * u, (0.95, 0.75, 0.3, 1))
        self.hpt = k.text(r, bx + bw / 2, 12 * u, "", 12 * u, INK, "center", serif=False)
        self.mpt = k.text(r, bx + bw / 2, 30 * u, "", 11 * u, INK, "center", serif=False)
        # top center
        self.stage_t = k.text(r, W / 2, 10 * u, "", 17 * u, INK, "center")
        self.wave_t = k.text(r, W / 2, 32 * u, "", 13 * u, EMBER, "center")
        # top right
        k.box(r, W - 190 * u, 12, 120 * u, 32 * u, (0.07, 0.05, 0.04, 0.8), (0.35, 0.27, 0.19, 1))
        k.icon(r, "coin", W - 186 * u, 14 * u, 26 * u)
        self.gold_t = k.text(r, W - 78 * u, 16 * u, "0", 16 * u, INK, "right")
        k.box(r, W - 56 * u, 12, 44 * u, 32 * u, (0.07, 0.05, 0.04, 0.85), (0.54, 0.42, 0.28, 1))
        k.text(r, W - 34 * u, 15 * u, "II", 17 * u, INK, "center")
        self.pause_rect = (W - 56 * u, 12, 44 * u, 32 * u)
        # action bar
        cls_d = D.CLASSES[cls]
        size = 58 * u
        gap = 10 * u
        total = 4 * size + 3 * gap
        x0, y0 = (W - total) / 2, H - size - 16 * u
        self.slots = []
        names = [(s["id"], KEY) for s, KEY in zip(cls_d["skills"], SKILL_KEYS)] + [("potion", "F")]
        for i, (nm, key) in enumerate(names):
            x = x0 + i * (size + gap)
            k.box(r, x, y0, size, size, (0.12, 0.09, 0.07, 0.95), (0.54, 0.42, 0.28, 1), 2)
            ic = k.icon(r, nm, x + 4, y0 + 4, size - 8)
            cd = k._card(r, x, y0, size, size, (0, 0, 0, 0.7))
            cd.hide()
            k.text(r, x + 5, y0 + 2, key, 12 * u, INK, serif=False)
            cdt = k.text(r, x + size / 2, y0 + size / 2 - 10 * u, "", 20 * u, INK, "center", serif=False)
            lock = k.text(r, x + size / 2, y0 + size / 2 - 8 * u, "", 13 * u, INK, "center", serif=False)
            cnt = k.text(r, x + size - 5, y0 + size - 20 * u, "", 15 * u, INK, "right", serif=False) if nm == "potion" else None
            self.slots.append(dict(icon=ic, cd=cd, cdt=cdt, lock=lock, cnt=cnt, x=x, y=y0, size=size))
        # banner
        self.banner_h = k.text(r, W / 2, H * 0.2, "", 46 * u, (0.96, 0.9, 0.75, 1), "center")
        self.banner_s = k.text(r, W / 2, H * 0.2 + 56 * u, "", 18 * u, EMBER, "center")
        # boss bar
        bw = min(520 * u, W - 40)
        self.boss_x, self.boss_w = (W - bw) / 2, bw
        self.boss_back = k.box(r, self.boss_x - 3, 68 * u, bw + 6, 20 * u, (0.04, 0.03, 0.02, 0.85), (0.54, 0.42, 0.28, 1), 1.5)
        self.boss_fill = k._card(r, self.boss_x, 71 * u, bw, 14 * u, (0.72, 0.16, 0.11, 1))
        self.boss_name = k.text(r, W / 2, 48 * u, "", 14 * u, (0.95, 0.88, 0.7, 1), "center")
        self.boss_back.hide()
        self.boss_fill.hide()
        # flash
        self.hit_flash = k.box(r, 0, 0, W, H, (0.7, 0.0, 0.0, 0.0))
        self.enemy_bars = []

    def _bar(self, parent, x, y, w, h, color):
        k = self.kit
        k.box(parent, x, y, w, h, (0.04, 0.03, 0.02, 0.9), (0, 0, 0, 1), 1)
        c = k._card(parent, x, y, w, h, color)
        return c

    def set_text(self, np, s):
        if np.node().getText() != s:
            np.node().setText(s)

    # ------------------------------------------------------------ frame
    def update(self, game, scene):
        if self.built_for != game.save["cls"] or abs(self.kit.W / max(1, self.kit.H) - getattr(self, "_aspect", 0)) > 1e-3:
            self._aspect = self.kit.W / max(1, self.kit.H)
            self.build(game.save["cls"])
        p, save, hero, st = game.p, game.save, game.hero, game.stage
        self.lvl.node().setText(str(save["level"]))
        self.hp.setSx(max(0.001, p.hp / hero["max_hp"]))
        self.mp.setSx(max(0.001, p.mp / hero["max_mp"]))
        need = 1 if save["level"] >= D.MAX_LEVEL else D.xp_to_next(save["level"])
        self.xp.setSx(max(0.001, 1 if save["level"] >= D.MAX_LEVEL else save["xp"] / need))
        self.set_text(self.hpt, f"{math.ceil(p.hp)} / {hero['max_hp']}")
        self.set_text(self.mpt, f"{math.floor(p.mp)} / {hero['max_mp']}")
        self.set_text(self.stage_t, st.name)
        self.set_text(self.wave_t, f"Wave {max(1, st.wave_idx + 1)} / {len(st.waves)}")
        self.set_text(self.gold_t, str(save["gold"]))
        cls_d = D.CLASSES[save["cls"]]
        for i, slot in enumerate(self.slots):
            if i < 3:
                sk = cls_d["skills"][i]
                locked = save["level"] < sk["unlock"]
                lv = save["skill_lv"][i]
                cdmax = sk["cd"] * D.skill_cd_mul(lv) * (1 - min(0.5, hero["cdr"] / 100))
                frac = 0 if locked else min(1.0, p.cd[i] / max(0.01, cdmax))
                slot["cd"].show() if (locked or frac > 0) else slot["cd"].hide()
                slot["cd"].setSz(1.0 if locked else max(0.01, frac))
                slot["cd"].setZ(-slot["y"])
                self.set_text(slot["cdt"], "" if locked or frac <= 0 else str(math.ceil(p.cd[i])))
                self.set_text(slot["lock"], f"Lv {sk['unlock']}" if locked else "")
                nm = p.mp < sk["cost"] and not locked
                slot["icon"].setColorScale(0.55, 0.6, 0.9, 1) if nm else slot["icon"].setColorScale(1, 1, 1, 1)
            else:
                self.set_text(slot["cnt"], str(save["potions"]))
                slot["icon"].setColorScale(1, 1, 1, 1) if save["potions"] else slot["icon"].setColorScale(0.5, 0.5, 0.5, 1)
        # banner
        bn = game.banner
        if bn:
            a = max(0.0, min(1.0, bn["t"] * 2, (bn["dur"] - bn["t"]) * 4))
            self.set_text(self.banner_h, bn["text"])
            self.set_text(self.banner_s, bn["sub"] or "")
            self.banner_h.setColorScale(1, 1, 1, a)
            self.banner_s.setColorScale(1, 1, 1, a)
            self.banner_h.show()
            self.banner_s.show()
        else:
            self.banner_h.hide()
            self.banner_s.hide()
        # hit flash
        if p.hit_t > 0:
            self.hit_flash.setColorScale(1, 1, 1, min(1.0, p.hit_t / 0.22) * 0.35)
        else:
            self.hit_flash.setColorScale(1, 1, 1, 0)
        # boss bar + enemy bars + damage numbers
        boss = next((e for e in game.enemies if e.d.get("boss") and not e.dead), None)
        if boss:
            self.boss_back.show()
            self.boss_fill.show()
            self.boss_fill.setSx(max(0.001, boss.hp / boss.max_hp))
            self.boss_fill.setColor(1.0, 0.35, 0.1, 1) if boss.enraged else self.boss_fill.setColor(0.72, 0.16, 0.11, 1)
            self.set_text(self.boss_name, boss.d["name"])
        else:
            self.boss_back.hide()
            self.boss_fill.hide()
            self.set_text(self.boss_name, "")
        self.draw_enemy_bars(game, scene)
        self.draw_numbers(game, scene)

    def draw_enemy_bars(self, game, scene):
        k, u = self.kit, self.u
        n = 0
        for e in game.enemies:
            if e.dead or e.d.get("boss"):
                continue
            if e.hp >= e.max_hp and e.hit_t <= 0 and e.spawn_t <= 0 and e.state != "windup":
                continue
            tall = 70 if e.type == "brute" else 44 if e.type == "wisp" else 54
            sp = scene.project(e.x, e.y, tall)
            if not sp:
                continue
            bw = (46 if e.type == "brute" else 32) * u
            if n >= len(self.enemy_bars):
                back = k._card(self.root, 0, 0, 1, 1, (0.04, 0.03, 0.02, 0.8))
                fill = k._card(self.root, 0, 0, 1, 1, (0.85, 0.28, 0.2, 1))
                self.enemy_bars.append((back, fill))
            back, fill = self.enemy_bars[n]
            n += 1
            back.show()
            fill.show()
            back.setPos(sp[0] - bw / 2 - 1, 0, -sp[1] + 1)
            back.setScale(bw + 2, 1, 6)
            fill.setPos(sp[0] - bw / 2, 0, -sp[1])
            fill.setScale(bw * max(0.001, e.hp / e.max_hp), 1, 4)
            fill.setColor(0.85, 0.28, 0.2, 1) if e.hp / e.max_hp > 0.35 else fill.setColor(1.0, 0.55, 0.16, 1)
        for back, fill in self.enemy_bars[n:]:
            back.hide()
            fill.hide()

    def draw_numbers(self, game, scene):
        k, u = self.kit, self.u
        while len(self.pool) < len(game.texts):
            tn = TextNode("dmg")
            if k.serif:
                tn.setFont(k.serif)
            tn.setAlign(TextNode.ACenter)
            tn.setShadow(0.06, 0.06)
            tn.setShadowColor(0, 0, 0, 1)
            np = self.root.attachNewNode(tn)
            self.pool.append(np)
        for i, np in enumerate(self.pool):
            if i >= len(game.texts):
                np.hide()
                continue
            t = game.texts[i]
            sp = scene.project(t.x, t.y, t.z)
            if not sp:
                np.hide()
                continue
            kk = t.t / t.dur
            a = 1 - (kk - 0.6) / 0.4 if kk > 0.6 else 1.0
            sc = (1 + max(0, 0.35 - t.t) * 1.5) if t.crit else 1.0
            tn = np.node()
            if tn.getText() != t.text:
                tn.setText(t.text)
            tn.setTextColor(t.color[0], t.color[1], t.color[2], a)
            np.setScale(t.size * u * sc * 1.05)
            np.setPos(sp[0], 0, -sp[1])
            np.show()

    def pause_hit(self, px, py):
        x, y, w, h = self.pause_rect
        return x <= px <= x + w and y <= py <= y + h

    def slot_hit(self, px, py):
        for i, s in enumerate(self.slots):
            if s["x"] <= px <= s["x"] + s["size"] and s["y"] <= py <= s["y"] + s["size"]:
                return i
        return None

    def hide(self):
        self.root.hide()

    def show(self):
        self.root.show()
