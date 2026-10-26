"""Title, camp (map / hero / bag / forge / advance / shop), results and pause screens."""
import math
import time

from . import data as D
from . import items as I
from .uikit import INK, DIM, EMBER, EMBER_D, GOOD, BAD, PANEL, PANEL2, LINE, LINE2

POWER_COL = {"good": GOOD, "ok": EMBER, "bad": BAD}
TABS = [("hero", "Hero"), ("bag", "Bag"), ("forge", "Forge"), ("adv", "Advance"), ("shop", "Shop")]


def rcol(item):
    c = I.rarity_of(item["rarity"])["color"]
    return (c[0], c[1], c[2], 1)


class Screens:
    def __init__(self, app):
        self.app = app
        self.kit = app.kit
        self.st = dict(tab="hero", sel=None, bag_sel=None, eq_sel=None, forge_sel=None, reforge_idx=0, adv="skills", floor=1,
                       msg="", msg_ok=True, exp=dict(route="patrol", crew=[]))
        self.view = "none"
        self.root = None
        self._tick = 0.0

    @property
    def save(self):
        return self.app.save

    # ------------------------------------------------------------ helpers
    def begin(self, view):
        self.view = view
        self.kit.clear()
        self.root = self.kit.new_layer(view)
        self.u = max(0.8, min(1.5, self.kit.H / 720))
        return self.root

    def clear(self):
        self.view = "none"
        self.kit.clear()

    def power_class(self, mine, need):
        return "good" if mine >= need * 1.1 else "ok" if mine >= need * 0.9 else "bad"

    def tile(self, parent, x, y, size, item, selected=False, cb=None):
        k = self.kit
        if item is None:
            k.box(parent, x, y, size, size, (0.09, 0.07, 0.055, 1), LINE)
            return
        col = rcol(item)
        k.box(parent, x, y, size, size, (0.14, 0.11, 0.085, 1), (1, 1, 1, 1) if selected else col, 2)
        k.icon(parent, I_icon(item), x + size * 0.1, y + size * 0.1, size * 0.8)
        if item.get("plus"):
            k.text(parent, x + 3, y, f"+{item['plus']}", size * 0.28, EMBER)
        k.text(parent, x + size - 3, y + size - size * 0.3, str(item["ilvl"]), size * 0.26, INK, "right")
        if item.get("set") is not None:
            k.box(parent, x + size - 9, y + 3, 6, 6, (0.35, 0.88, 0.66, 1))
        if item.get("lock"):
            k.text(parent, x + 3, y + size - size * 0.32, "o", size * 0.26, INK)
        if cb:
            k.hotspot(x, y, size, size, cb)

    def item_lines(self, item):
        t = I.item_totals(item)
        lines = []
        if item["slot"] == "weapon":
            lines.append((f"{t['damage']:.1f} Damage", INK))
        if item["slot"] == "armor":
            lines.append((f"{t['armor']:.0f} Armor", INK))
        m = I.forge_mul(item)
        for a in item["aff"]:
            lines.append((I.describe_affix(a, m), (0.54, 0.72, 1.0, 1)))
        return lines

    def item_card(self, parent, x, y, w, item, compare=None, show_cmp=False):
        """Draw an item card; returns its height."""
        k, u = self.kit, self.u
        r = I.rarity_of(item["rarity"])
        h = 0
        k.text(parent, x + 10, y + 8, item["name"] + (f"  +{item['plus']}" if item.get("plus") else ""), 18 * u, rcol(item))
        k.text(parent, x + 10, y + 30 * u, f"{r['name']} {item['kind']} - {D.SLOT_LABEL[item['slot']]} - ilvl {item['ilvl']}", 12 * u, DIM, serif=False)
        yy = y + 52 * u
        for s, c in self.item_lines(item):
            k.text(parent, x + 10, yy, s, 14 * u, c, serif=False)
            yy += 19 * u
        if item.get("set") is not None:
            have = I.set_counts(self.save["equip"]).get(item["set"], 0)
            t = 1 + 0.35 * item["set"]
            k.text(parent, x + 10, yy + 2, f"{D.SETS[item['set']]['name']} Set ({have}/3 worn)", 13 * u, (0.36, 0.88, 0.66, 1))
            yy += 20 * u
            for need in (2, 3):
                bonus = ", ".join(f"+{v} {D.AFFIXES[kk]['label'] if kk in D.AFFIXES else kk}" for kk, v in D.set_bonus(need, t).items())
                k.text(parent, x + 10, yy, f"({need}) {bonus}", 12 * u, (0.6, 0.94, 0.8, 1) if have >= need else DIM, serif=False)
                yy += 17 * u
        if show_cmp:
            tot, cur = I.item_totals(item), I.item_totals(compare)
            labels = dict(hp="Health", mp="Mana", damage="Damage", armor="Armor", crit="Crit %", speed="Speed %", regen="Mana/s")
            k.text(parent, x + 10, yy + 4, ("vs equipped " + compare["name"]) if compare else "vs empty slot", 11 * u, DIM, serif=False)
            yy += 22 * u
            cx = x + 10
            for key, lab in labels.items():
                d = round(tot[key] - cur[key], 2)
                if d:
                    s = f"{'+' if d > 0 else ''}{d:g} {lab}"
                    n = k.text(parent, cx, yy, s, 12 * u, GOOD if d > 0 else BAD, serif=False)
                    cx += n.text_w + 12
                    if cx > x + w - 90:
                        cx = x + 10
                        yy += 16 * u
            yy += 18 * u
            now = I.hero_stats(self.save)["power"]
            new = I.hero_stats(self.save, {**self.save["equip"], item["slot"]: item})["power"]
            k.text(parent, x + 10, yy, f"Power {now} -> {new} ({new - now:+d})", 14 * u, GOOD if new > now else BAD if new < now else INK)
            yy += 22 * u
        h = yy - y + 6
        k.box(parent, x, y, w, h, (0.1, 0.08, 0.06, 0.9), rcol(item), 1.5).setBin("gui-popup", -1) if False else None
        return h

    # ------------------------------------------------------------ TITLE
    def title(self):
        k, u = self.kit, None
        root = self.begin("title")
        W, H, u = k.W, k.H, self.u
        k.gradient(root, 0, 0, W, H, (0.2, 0.12, 0.07, 1), (0.04, 0.03, 0.02, 1), 40)
        cx = W / 2
        k.text(root, cx, 28 * u, "AN ORIGINAL TALE OF THE ROAD", 13 * u, DIM, "center", serif=False)
        k.text(root, cx, 52 * u, "HIGHKEEP", 74 * u, (0.96, 0.87, 0.64, 1), "center")
        k.text(root, cx, 126 * u, "R  O  A  D", 38 * u, EMBER, "center")
        story = k.text(root, cx, 190 * u, D.INTRO_TEXT, 17 * u, (0.85, 0.78, 0.62, 1), "center", wrap=min(720 * u, W - 80))
        y = 190 * u + story.text_h + 22 * u
        s = self.save
        if s:
            hs = I.hero_stats(s)
            k.button(root, cx - 190 * u, y, 380 * u, 56 * u, f"Continue  -  Lv {s['level']} {D.CLASSES[s['cls']]['name']}  -  Power {hs['power']}", self.app.continue_game, "primary", size=18 * u)
            y += 72 * u
        k.text(root, cx, y, "Or begin a new hero" if s else "Choose your class", 14 * u, DIM, "center", serif=False)
        y += 28 * u
        cw, gap = min(300 * u, (W - 80) / 3 - 14), 16 * u
        total = 3 * cw + 2 * gap
        x0 = cx - total / 2
        ch = max(210 * u, H - y - 60 * u)
        for i, c in enumerate(D.CLASSES.values()):
            x = x0 + i * (cw + gap)
            k.box(root, x, y, cw, ch, (0.15, 0.115, 0.085, 0.96), LINE2)
            k.icon(root, c["id"], x + 14, y + 12, 64 * u)
            k.text(root, x + 90 * u, y + 14, c["name"], 24 * u, INK)
            k.text(root, x + 90 * u, y + 44 * u, f"HP {c['hp']}  MP {c['mp']}  Dmg {c['damage']}  Spd {c['speed']}", 12 * u, DIM, serif=False)
            k.text(root, x + 14, y + 86 * u, c["blurb"], 14 * u, (0.8, 0.74, 0.6, 1), wrap=cw - 28, serif=False)
            for j, sk in enumerate(c["skills"]):
                k.icon(root, sk["id"], x + 14 + j * 44 * u, y + ch - 56 * u, 38 * u)
            k.hotspot(x, y, cw, ch, (lambda cid=c["id"]: self.app.pick_class(cid)))
            k.button(root, x + 14, y + ch - 100 * u if False else y + ch - 100 * u, cw - 28, 34 * u, "Choose", (lambda cid=c["id"]: self.app.pick_class(cid)), "normal", size=15 * u)
        k.text(root, cx, H - 28 * u, "WASD move   -   mouse aim   -   click / Space attack   -   1 2 3 skills   -   F potion   -   Esc pause", 12 * u, DIM, "center", serif=False)

    # ------------------------------------------------------------ CAMP
    def camp(self):
        k, st = self.kit, self.st
        s = self.save
        hero = I.hero_stats(s)
        root = self.begin("camp")
        W, H, u = k.W, k.H, self.u
        k.gradient(root, 0, 0, W, H, (0.13, 0.09, 0.06, 1), (0.06, 0.045, 0.035, 1), 30)
        # header
        k.box(root, 0, 0, W, 54 * u, (0, 0, 0, 0.35))
        k.text(root, 18, 14 * u, "Highkeep Road", 24 * u, (0.96, 0.87, 0.64, 1))
        k.text(root, 18 + 190 * u, 22 * u, "CAMP", 12 * u, DIM, serif=False)
        rx = W - 18
        k.button(root, rx - 80 * u, 10 * u, 80 * u, 34 * u, "Menu", self.app.to_title, size=15 * u)
        items = [(f"Power {hero['power']}", EMBER, None), (f"{s.get('steel', 0)} steel", (0.62, 0.71, 0.78, 1), "steel"),
                 (f"{s['potions']}/{D.MAX_POTIONS}", INK, "potion"), (f"{s['gold']}", INK, "coin")]
        x = rx - 100 * u
        for label, col, ic in items:
            n = k.text(root, 0, 0, label, 16 * u, col, "right")
            w = n.text_w
            n.removeNode()
            k.text(root, x, 17 * u, label, 16 * u, col, "right")
            x -= w + 8
            if ic:
                k.icon(root, ic, x - 22 * u, 12 * u, 26 * u)
                x -= 36 * u
            x -= 14 * u
        top = 64 * u
        lw = min(W * 0.56, 820 * u)
        self.draw_map(root, 14, top, lw - 14, s, hero)
        self.draw_side(root, lw + 14, top, W - lw - 28, H - top - 14, s, hero)

    # --- map
    def draw_map(self, root, x, y, w, s, hero):
        k, st, u = self.kit, self.st, self.u
        mh = w * 0.56
        mh = min(mh, (self.kit.H - y) * 0.52)
        mw = mh / 0.56
        k.box(root, x, y, mw, mh, (0.1, 0.08, 0.06, 1), LINE2, 2)
        k.gradient(root, x, y, mw, mh, (0.88, 0.8, 0.62, 1), (0.7, 0.58, 0.38, 1), 30)
        import random
        R = random.Random(7)
        nodes = [(x + n["node"][0] * mw, y + n["node"][1] * mh) for n in D.STAGES] + [(x + D.VAULT["node"][0] * mw, y + D.VAULT["node"][1] * mh)]
        for _ in range(40):
            px, py = x + R.random() * mw, y + R.random() * mh
            if any(math.hypot(px - nx, py - ny) < 60 * u for nx, ny in nodes):
                continue
            sz = 6 + R.random() * 8
            k.line(root, [(px, py + sz), (px - sz * 0.6, py + sz * 1.9), (px + sz * 0.6, py + sz * 1.9), (px, py + sz)], (0.36, 0.42, 0.22, 0.8), 2)
        road = [(x - 10, nodes[0][1] + 30)] + nodes[:6]
        # smooth road
        pts = []
        for i in range(len(road) - 1):
            p0, p1, p2, p3 = road[max(0, i - 1)], road[i], road[i + 1], road[min(len(road) - 1, i + 2)]
            for t in [j / 10 for j in range(10)]:
                pts.append(tuple(0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t ** 3) for c in (0, 1)))
        pts.append(road[-1])
        k.line(root, pts, (0.42, 0.29, 0.15, 1), 9 * u)
        k.line(root, pts, (0.77, 0.6, 0.35, 1), 5 * u)
        k.line(root, [nodes[5], ((nodes[5][0] + nodes[6][0]) / 2 + 10, (nodes[5][1] + nodes[6][1]) / 2 + 20), nodes[6]], (0.45, 0.32, 0.2, 1), 3)
        if st["sel"] is None:
            st["sel"] = min(6, s["cleared"] + 1)
        for i, (nx, ny) in enumerate(nodes):
            vault = i == 6
            sid = "vault" if vault else i + 1
            unlocked = (s["cleared"] >= 6) if vault else (sid <= s["cleared"] + 1)
            done = (not vault) and s["cleared"] >= sid
            cur = (not vault) and sid == s["cleared"] + 1
            sel = st["sel"] == sid
            r = 17 * u
            if sel:
                k.box(root, nx - r - 6, ny - r - 6, 2 * r + 12, 2 * r + 12, (1, 1, 1, 0.25), (1, 1, 1, 0.9), 2)
            elif cur:
                k.box(root, nx - r - 5, ny - r - 5, 2 * r + 10, 2 * r + 10, (0.9, 0.5, 0.2, 0.25), EMBER, 2)
            col = (0.25, 0.4, 0.22, 1) if done else (0.55, 0.15, 0.13, 1) if unlocked else (0.35, 0.33, 0.29, 1)
            if vault:
                col = (0.1, 0.08, 0.07, 1) if unlocked else (0.3, 0.28, 0.26, 1)
            k.box(root, nx - r, ny - r, 2 * r, 2 * r, col, (0.2, 0.1, 0.04, 1), 2)
            label = ("v" + str(s["vault_best"] or "-")) if vault and unlocked else "?" if not unlocked else ("OK" if done and False else str(sid))
            k.text(root, nx, ny - 9 * u, label, 17 * u, (1, 0.95, 0.8, 1), "center")
            name = D.VAULT["name"] if vault else D.STAGES[i]["name"]
            k.text(root, nx, ny + r + 4, name, 12 * u, (0.22, 0.14, 0.06, 1), "center", shadow=False)
            k.hotspot(nx - r - 6, ny - r - 6, 2 * r + 12, 2 * r + 12, (lambda sid=sid: self.pick_stage(sid)))
            if done:
                k.text(root, nx + r - 2, ny - r - 6, "+", 14 * u, (0.7, 1, 0.55, 1))
        # info panel
        iy = y + mh + 10
        ih = self.kit.H - iy - 14
        k.box(root, x, iy, mw, ih, PANEL, LINE, 1.5)
        sid = st["sel"]
        if sid == "vault":
            un = s["cleared"] >= 6
            k.text(root, x + 14, iy + 10, D.VAULT["name"], 22 * u, INK)
            k.text(root, x + 14, iy + 40 * u, D.VAULT["blurb"], 14 * u, (0.82, 0.76, 0.62, 1), wrap=mw - 28, serif=False)
            if un:
                st["floor"] = max(1, min(st["floor"], s["vault_best"] + 1))
                need = D.VAULT["power"] + 25 * st["floor"]
                k.text(root, x + 14, iy + 84 * u, f"Best floor {s['vault_best'] or '-'}   Suggested power {need}   Yours", 14 * u, INK, serif=False)
                k.text(root, x + 14 + 345 * u, iy + 84 * u, str(hero["power"]), 14 * u, POWER_COL[self.power_class(hero["power"], need)], serif=False)
                k.text(root, x + 14, iy + 112 * u, "Start at floor", 14 * u, INK, serif=False)
                k.button(root, x + 130 * u, iy + 106 * u, 30 * u, 28 * u, "-", lambda: self.set_floor(-1), size=16 * u)
                k.text(root, x + 190 * u, iy + 110 * u, str(st["floor"]), 18 * u, EMBER, "center")
                k.button(root, x + 214 * u, iy + 106 * u, 30 * u, 28 * u, "+", lambda: self.set_floor(1), size=16 * u)
                k.button(root, x + 14, iy + ih - 52 * u, mw - 28, 40 * u, "Descend", (lambda: self.app.march("vault", st["floor"])), "primary", size=18 * u)
            else:
                k.text(root, x + 14, iy + 90 * u, "Defeat the Ashen Regent to unlock the Vaults.", 14 * u, DIM, serif=False)
        else:
            d = D.STAGES[sid - 1]
            locked = sid > s["cleared"] + 1
            k.text(root, x + 14, iy + 10, f"{sid}. {d['name']}", 22 * u, INK)
            k.text(root, x + 14, iy + 40 * u, d["blurb"], 14 * u, (0.82, 0.76, 0.62, 1), wrap=mw - 28, serif=False)
            pc = self.power_class(hero["power"], d["power"])
            k.text(root, x + 14, iy + 84 * u, f"Waves {len(d['waves'])}   Suggested power {d['power']}   Yours", 14 * u, INK, serif=False)
            k.text(root, x + 14 + 335 * u, iy + 84 * u, str(hero["power"]), 14 * u, POWER_COL[pc], serif=False)
            msg = {"good": "You outmatch this road.", "ok": "A fair fight.", "bad": "Dangerous: you are underpowered."}[pc]
            k.text(root, x + 14, iy + 108 * u, msg, 13 * u, DIM, serif=False)
            if locked:
                k.text(root, x + 14, iy + ih - 40 * u, "Clear the previous stage first.", 14 * u, DIM, serif=False)
            else:
                k.button(root, x + 14, iy + ih - 52 * u, mw - 28, 40 * u, "Replay" if s["cleared"] >= sid else "March", (lambda sid=sid: self.app.march(sid, 0)), "primary", size=18 * u)

    def pick_stage(self, sid):
        self.st["sel"] = sid
        self.camp()

    def set_floor(self, d):
        self.st["floor"] = max(1, min(self.save["vault_best"] + 1, self.st["floor"] + d))
        self.camp()

    # --- side panel
    def draw_side(self, root, x, y, w, h, s, hero):
        k, st, u = self.kit, self.st, self.u
        tw = w / len(TABS)
        for i, (tid, name) in enumerate(TABS):
            k.button(root, x + i * tw, y, tw - 3, 32 * u, name + (f" {len(s['bag'])}" if tid == "bag" and s["bag"] else ""), (lambda t=tid: self.set_tab(t)), "on" if st["tab"] == tid else "tab", size=15 * u)
        py = y + 36 * u
        k.box(root, x, py, w, h - 36 * u, PANEL2, LINE2, 1.5)
        getattr(self, "tab_" + st["tab"])(root, x + 12, py + 10, w - 24, h - 36 * u - 20, s, hero)

    def set_tab(self, t):
        self.st["tab"] = t
        self.st["msg"] = ""
        self.camp()

    def msgbar(self, root, x, y, w, key="msg"):
        k, st, u = self.kit, self.st, self.u
        if st.get(key):
            k.box(root, x, y, w, 26 * u, (0.2, 0.32, 0.2, 0.8) if st["msg_ok"] else (0.35, 0.15, 0.12, 0.8), GOOD if st["msg_ok"] else BAD, 1)
            k.text(root, x + 8, y + 4 * u, st[key], 13 * u, INK, serif=False)
            return 32 * u
        return 0

    # --- hero tab
    def tab_hero(self, root, x, y, w, h, s, hero):
        k, st, u = self.kit, self.st, self.u
        c = D.CLASSES[s["cls"]]
        need = 0 if s["level"] >= D.MAX_LEVEL else D.xp_to_next(s["level"])
        k.box(root, x, y, 56 * u, 56 * u, (0.1, 0.075, 0.055, 1), LINE)
        k.icon(root, c["id"], x + 4, y + 4, 48 * u)
        k.text(root, x + 66 * u, y, c["name"], 22 * u, INK)
        k.bar(root, x + 66 * u, y + 30 * u, w - 66 * u - 110 * u, 9 * u, (s["xp"] / need) if need else 1, (0.95, 0.75, 0.3, 1))
        k.text(root, x + 66 * u, y + 41 * u, f"Level {s['level']}" + (f"  -  {s['xp']} / {need} XP" if need else "  (max)"), 12 * u, DIM, serif=False)
        k.box(root, x + w - 96 * u, y, 96 * u, 56 * u, (0.1, 0.075, 0.055, 1), EMBER_D)
        k.text(root, x + w - 48 * u, y + 2, "POWER", 10 * u, DIM, "center", serif=False)
        k.text(root, x + w - 48 * u, y + 16 * u, str(hero["power"]), 28 * u, EMBER, "center")
        y += 68 * u
        stats = [("Health", hero["max_hp"]), ("Mana", hero["max_mp"]), ("Damage", f"{hero['damage']:g}"), ("Armor", hero["armor"]),
                 ("Crit", f"{hero['crit']:g}%"), ("Speed", round(hero["speed"])), ("Mana regen", f"{hero['regen']:g}/s"),
                 ("Reduction", f"{round(100 - 12000 / (120 + hero['armor']))}%")]
        for i, (a, b) in enumerate(stats):
            cx = x + (i % 2) * (w / 2 + 6)
            cy = y + (i // 2) * 22 * u
            k.text(root, cx, cy, a, 14 * u, DIM, serif=False)
            k.text(root, cx + w / 2 - 14, cy, str(b), 14 * u, INK, "right", serif=False)
        y += 4 * 22 * u + 8
        k.text(root, x, y, "EQUIPMENT", 13 * u, EMBER)
        y += 22 * u
        for sl in D.SLOTS:
            it = s["equip"][sl]
            self.tile(root, x, y, 44 * u, it, st["eq_sel"] == sl)
            k.text(root, x + 54 * u, y + 2, D.SLOT_LABEL[sl].upper(), 10 * u, DIM, serif=False)
            k.text(root, x + 54 * u, y + 15 * u, it["name"] if it else "Empty", 15 * u, rcol(it) if it else DIM)
            if it:
                k.hotspot(x, y, w, 44 * u, (lambda sl=sl: self.eq_inspect(sl)))
            y += 50 * u
        if st["eq_sel"] and s["equip"][st["eq_sel"]]:
            it = s["equip"][st["eq_sel"]]
            hh = self.item_card(root, x, y, w, it)
            k.button(root, x + w - 110 * u, y + 6, 100 * u, 28 * u, "Unequip", self.unequip, size=13 * u, enabled=len(s["bag"]) < s.get("bag_size", 24))
            y += hh + 6
        k.text(root, x, y, "SKILLS", 13 * u, EMBER)
        y += 22 * u
        for i, sk in enumerate(c["skills"]):
            locked = s["level"] < sk["unlock"]
            k.icon(root, sk["id"], x, y, 34 * u)
            k.text(root, x + 42 * u, y - 2, sk["name"], 14 * u, DIM if locked else INK)
            sub = f"Unlocks at Lv {sk['unlock']}" if locked else f"{sk['cost']} MP  -  {sk['cd']}s  -  Lv {s['skill_lv'][i]}"
            k.text(root, x + 42 * u, y + 16 * u, sub + "  " + sk["desc"] if not locked else sub, 11 * u, DIM, serif=False)
            y += 38 * u

    def eq_inspect(self, sl):
        self.st["eq_sel"] = None if self.st["eq_sel"] == sl else sl
        self.camp()

    def unequip(self):
        s, sl = self.save, self.st["eq_sel"]
        if sl and s["equip"][sl] and len(s["bag"]) < s.get("bag_size", 24):
            s["bag"].append(s["equip"][sl])
            s["equip"][sl] = None
            self.st["eq_sel"] = None
            self.app.persist()
            self.camp()

    # --- bag tab
    def tab_bag(self, root, x, y, w, h, s, hero):
        k, st, u = self.kit, self.st, self.u
        size = s.get("bag_size", 24)
        k.text(root, x, y, f"Bag {len(s['bag'])} / {size}", 16 * u, INK)
        commons = [it for it in s["bag"] if it["rarity"] == "common" and not it.get("lock")]
        k.button(root, x + w - 210 * u, y - 4, 60 * u, 28 * u, "Sort", self.sort_bag, size=13 * u)
        k.button(root, x + w - 144 * u, y - 4, 144 * u, 28 * u, f"Sell Common ({sum(I.item_sell_value(i) for i in commons)}g)", self.sell_common, size=12 * u, enabled=bool(commons))
        y += 30 * u
        cols = 6
        rows = math.ceil(size / cols)
        ts = min(46 * u, (w - (cols - 1) * 6) / cols, max(24, (h * 0.42) / rows))
        sel_item = next((it for it in s["bag"] if it["id"] == st["bag_sel"]), None)
        for i in range(size):
            cx, cy = x + (i % cols) * (ts + 6), y + (i // cols) * (ts + 6)
            it = s["bag"][i] if i < len(s["bag"]) else None
            self.tile(root, cx, cy, ts, it, bool(it) and it["id"] == st["bag_sel"], (lambda it=it: self.bag_select(it["id"])) if it else None)
        y += rows * (ts + 6) + 8
        if sel_item:
            hh = self.item_card(root, x, y, w, sel_item, s["equip"][sel_item["slot"]], True)
            by = y + hh + 4
            k.button(root, x, by, 90 * u, 30 * u, "Equip", (lambda: self.equip(sel_item["id"])), "primary", size=14 * u)
            k.button(root, x + 96 * u, by, 80 * u, 30 * u, "Forge", (lambda: self.forge_open(sel_item["id"])), size=14 * u)
            k.button(root, x + 182 * u, by, 80 * u, 30 * u, "Unlock" if sel_item.get("lock") else "Lock", (lambda: self.toggle_lock(sel_item["id"])), size=14 * u)
            k.button(root, x, by + 36 * u, 200 * u, 26 * u, f"Dismantle +{I.dismantle_value(sel_item)} steel", (lambda: self.dismantle(sel_item["id"])), size=12 * u, enabled=not sel_item.get("lock"))
            k.button(root, x + 206 * u, by + 36 * u, 100 * u, 26 * u, f"Sell {I.item_sell_value(sel_item)}g", (lambda: self.sell(sel_item["id"])), size=12 * u, enabled=not sel_item.get("lock"))
        else:
            k.text(root, x, y, "Select an item to compare it with what you are wearing.\nLock items you want to keep.", 13 * u, DIM, serif=False, wrap=w)

    def bag_select(self, iid):
        self.st["bag_sel"] = iid
        self.camp()

    def equip(self, iid):
        s = self.save
        idx = next((i for i, it in enumerate(s["bag"]) if it["id"] == iid), None)
        if idx is None:
            return
        it = s["bag"][idx]
        old = s["equip"][it["slot"]]
        s["equip"][it["slot"]] = it
        if old:
            s["bag"][idx] = old
            self.st["bag_sel"] = old["id"]
        else:
            s["bag"].pop(idx)
            self.st["bag_sel"] = None
        self.app.persist()
        self.camp()

    def sell(self, iid):
        s = self.save
        idx = next((i for i, it in enumerate(s["bag"]) if it["id"] == iid), None)
        if idx is None or s["bag"][idx].get("lock"):
            return
        s["gold"] += I.item_sell_value(s["bag"][idx])
        s["bag"].pop(idx)
        self.st["bag_sel"] = None
        self.app.persist()
        self.camp()

    def dismantle(self, iid):
        s = self.save
        idx = next((i for i, it in enumerate(s["bag"]) if it["id"] == iid), None)
        if idx is None or s["bag"][idx].get("lock"):
            return
        s["steel"] = s.get("steel", 0) + I.dismantle_value(s["bag"][idx])
        s["bag"].pop(idx)
        self.st["bag_sel"] = None
        self.app.persist()
        self.camp()

    def sell_common(self):
        s = self.save
        g = 0
        keep = []
        for it in s["bag"]:
            if it["rarity"] == "common" and not it.get("lock"):
                g += I.item_sell_value(it)
            else:
                keep.append(it)
        s["bag"], s["gold"] = keep, s["gold"] + g
        self.st["bag_sel"] = None
        self.app.persist()
        self.camp()

    def sort_bag(self):
        self.save["bag"].sort(key=lambda it: (-I.rarity_index(it), -it.get("plus", 0), -it["ilvl"], it["slot"]))
        self.app.persist()
        self.camp()

    def toggle_lock(self, iid):
        it = self.find_item(iid)
        if it:
            it[0]["lock"] = not it[0].get("lock")
            self.app.persist()
            self.camp()

    def find_item(self, iid):
        s = self.save
        for sl in D.SLOTS:
            if s["equip"][sl] and s["equip"][sl]["id"] == iid:
                return s["equip"][sl], sl, None
        for i, it in enumerate(s["bag"]):
            if it["id"] == iid:
                return it, "bag", i
        return None

    # --- forge tab
    def forge_open(self, iid):
        self.st["forge_sel"] = iid
        self.st["tab"] = "forge"
        self.st["msg"] = ""
        self.camp()

    def tab_forge(self, root, x, y, w, h, s, hero):
        k, st, u = self.kit, self.st, self.u
        allitems = [s["equip"][sl] for sl in D.SLOTS if s["equip"][sl]] + s["bag"]
        if not st["forge_sel"] or not self.find_item(st["forge_sel"]):
            st["forge_sel"] = allitems[0]["id"] if allitems else None
        k.text(root, x, y, f"Steel {s.get('steel', 0)}", 15 * u, (0.62, 0.71, 0.78, 1))
        k.text(root, x + w, y, f"Gold {s['gold']}", 15 * u, EMBER, "right")
        y += 24 * u
        y += self.msgbar(root, x, y, w)
        cols = 8
        ts = min(38 * u, (w - (cols - 1) * 5) / cols)
        for i, it in enumerate(allitems):
            cx, cy = x + (i % cols) * (ts + 5), y + (i // cols) * (ts + 5)
            self.tile(root, cx, cy, ts, it, st["forge_sel"] == it["id"], (lambda it=it: self.forge_sel(it["id"])))
        y += math.ceil(max(1, len(allitems)) / cols) * (ts + 5) + 6
        f = self.find_item(st["forge_sel"]) if st["forge_sel"] else None
        if f:
            it, where, idx = f
            hh = self.item_card(root, x, y, w, it)
            y += hh + 2
            k.text(root, x, y, f"Forge pity {it.get('fp', 0)} / 100  (at 100 the next forge cannot fail)", 11 * u, DIM, serif=False)
            k.bar(root, x, y + 17 * u, w, 6 * u, it.get("fp", 0) / 100, (0.95, 0.75, 0.3, 1))
            y += 32 * u
            info = I.forge_info(it)
            if info:
                k.text(root, x, y, f"Forge +{it.get('plus', 0) + 1}   success {round(info['chance'] * 100)}%" + ("  (guaranteed)" if info["guaranteed"] else ""), 15 * u, INK)
                k.text(root, x, y + 20 * u, "+10% to every stat on the item. A failure never lowers it.", 11 * u, DIM, serif=False)
                ok = s["gold"] >= info["gold"] and s.get("steel", 0) >= info["steel"]
                k.button(root, x, y + 40 * u, 250 * u, 32 * u, f"Forge  -  {info['gold']}g  -  {info['steel']} steel", self.do_forge, "primary", ok, size=14 * u)
                y += 80 * u
            else:
                k.text(root, x, y, f"Fully forged (+{D.MAX_PLUS})", 15 * u, EMBER)
                y += 28 * u
            if I.can_reforge(it):
                rc = I.reforge_cost(it)
                fodder = next((o for o in s["bag"] if o["id"] != it["id"] and not o.get("lock") and o["slot"] == it["slot"] and o["rarity"] == it["rarity"]), None)
                st["reforge_idx"] = min(st["reforge_idx"], len(it["aff"]) - 1)
                k.text(root, x, y, "Reforge: replace one effect (consumes a spare matching item)", 13 * u, INK)
                y += 22 * u
                cx = x
                for i, a in enumerate(it["aff"]):
                    label = I.describe_affix(a, I.forge_mul(it))
                    wd = 8 * len(label) * u * 0.9 + 16
                    k.button(root, cx, y, wd, 26 * u, label, (lambda i=i: self.set_reforge(i)), "on" if st["reforge_idx"] == i else "normal", size=11 * u)
                    cx += wd + 6
                    if cx > x + w - 100:
                        cx, y = x, y + 30 * u
                y += 32 * u
                k.button(root, x, y, 260 * u, 30 * u, (f"Reforge  -  {rc['gold']}g  -  {rc['steel']} steel" if fodder else "Needs a matching spare item"), self.do_reforge, "normal", bool(fodder and s["gold"] >= rc["gold"] and s.get("steel", 0) >= rc["steel"]), size=13 * u)
                y += 40 * u
            if where == "bag" and it.get("set") is not None:
                k.text(root, x, y, f"Set research: study to add {I.study_value(it)} to {D.SETS[it['set']]['name']}", 13 * u, INK)
                k.button(root, x, y + 22 * u, 220 * u, 28 * u, "Study (consumes item)", self.do_study, "normal", not it.get("lock"), size=13 * u)
                y += 58 * u
        k.text(root, x, y, "SET RESEARCH", 13 * u, EMBER)
        y += 22 * u
        for st_ in D.SETS:
            xp = s.get("research", {}).get(st_["id"], 0)
            L = I.research_level(xp)
            prev, nxt = I.research_need(L), I.research_need(L + 1)
            k.text(root, x, y, st_["name"], 13 * u, INK, serif=False)
            k.text(root, x + w, y, f"Lv {L}" + (" (max)" if L >= D.RESEARCH_MAX else ""), 13 * u, EMBER, "right", serif=False)
            k.bar(root, x, y + 17 * u, w, 5 * u, 1 if L >= D.RESEARCH_MAX else (xp - prev) / max(1, nxt - prev), (0.95, 0.75, 0.3, 1))
            y += 28 * u

    def forge_sel(self, iid):
        self.st["forge_sel"] = iid
        self.st["msg"] = ""
        self.camp()

    def set_reforge(self, i):
        self.st["reforge_idx"] = i
        self.camp()

    def do_forge(self):
        s, st = self.save, self.st
        f = self.find_item(st["forge_sel"])
        if not f:
            return
        info = I.forge_info(f[0])
        if not info or s["gold"] < info["gold"] or s.get("steel", 0) < info["steel"]:
            return
        s["gold"] -= info["gold"]
        s["steel"] -= info["steel"]
        ok = I.forge_attempt(f[0])
        st["msg"] = f"Forged to +{f[0]['plus']}!" if ok else f"The forge failed (pity {f[0]['fp']}/100). Only the materials were lost."
        st["msg_ok"] = ok
        self.app.persist()
        self.camp()

    def do_reforge(self):
        s, st = self.save, self.st
        f = self.find_item(st["forge_sel"])
        if not f or not I.can_reforge(f[0]):
            return
        it = f[0]
        rc = I.reforge_cost(it)
        fi = next((i for i, o in enumerate(s["bag"]) if o["id"] != it["id"] and not o.get("lock") and o["slot"] == it["slot"] and o["rarity"] == it["rarity"]), None)
        if fi is None or s["gold"] < rc["gold"] or s.get("steel", 0) < rc["steel"]:
            return
        s["bag"].pop(fi)
        s["gold"] -= rc["gold"]
        s["steel"] -= rc["steel"]
        I.reforge_affix(it, st["reforge_idx"])
        st["msg"], st["msg_ok"] = "Reforged: " + I.describe_affix(it["aff"][st["reforge_idx"]]), True
        self.app.persist()
        self.camp()

    def do_study(self):
        s, st = self.save, self.st
        f = self.find_item(st["forge_sel"])
        if not f or f[1] != "bag" or f[0].get("set") is None or f[0].get("lock"):
            return
        it = f[0]
        r = s.setdefault("research", {})
        before = I.research_level(r.get(it["set"], 0))
        r[it["set"]] = r.get(it["set"], 0) + I.study_value(it)
        s["bag"].pop(f[2])
        st["forge_sel"] = None
        after = I.research_level(r[it["set"]])
        st["msg"] = f"{D.SETS[it['set']]['name']} research reached level {after}!" if after > before else "Research gained."
        st["msg_ok"] = True
        self.app.persist()
        self.camp()

    # --- advance tab
    def tab_adv(self, root, x, y, w, h, s, hero):
        k, st, u = self.kit, self.st, self.u
        k.text(root, x, y, f"Steel {s.get('steel', 0)}", 15 * u, (0.62, 0.71, 0.78, 1))
        k.text(root, x + w, y, f"Gold {s['gold']}", 15 * u, EMBER, "right")
        y += 24 * u
        y += self.msgbar(root, x, y, w, "msg")
        subs = [("skills", "Skills"), ("traits", "Traits"), ("sigil", "Sigil"), ("arts", "Relics"), ("exped", "Lodge")]
        sw = w / len(subs)
        for i, (sid, name) in enumerate(subs):
            k.button(root, x + i * sw, y, sw - 3, 28 * u, name, (lambda sid=sid: self.set_adv(sid)), "on" if st["adv"] == sid else "tab", size=13 * u)
        y += 36 * u
        getattr(self, "adv_" + st["adv"])(root, x, y, w, s, hero)

    def set_adv(self, sid):
        self.st["adv"] = sid
        self.st["msg"] = ""
        self.camp()

    def adv_skills(self, root, x, y, w, s, hero):
        k, u = self.kit, self.u
        c = D.CLASSES[s["cls"]]
        k.text(root, x, y, "Each level: +10% skill power and 3% faster cooldown.", 12 * u, DIM, serif=False)
        y += 24 * u
        for i, sk in enumerate(c["skills"]):
            lv, locked = s["skill_lv"][i], s["level"] < sk["unlock"]
            cost = D.skill_up_cost(lv)
            k.box(root, x, y, w, 54 * u, (0.1, 0.08, 0.06, 0.9), LINE)
            k.icon(root, sk["id"], x + 8, y + 7, 40 * u)
            k.text(root, x + 58 * u, y + 5, f"{sk['name']}   Lv {lv}/{D.SKILL_MAX}", 15 * u, DIM if locked else INK)
            k.text(root, x + 58 * u, y + 28 * u, f"power x{D.skill_mul(lv):.1f}  -  cooldown {sk['cd'] * D.skill_cd_mul(lv):.1f}s", 12 * u, DIM, serif=False)
            if locked:
                k.text(root, x + w - 12, y + 18 * u, f"Lv {sk['unlock']}", 14 * u, DIM, "right")
            elif lv < D.SKILL_MAX:
                k.button(root, x + w - 126 * u, y + 11 * u, 116 * u, 32 * u, f"{cost['gold']}g {cost['steel']} steel", (lambda i=i: self.skill_up(i)), "normal", s["gold"] >= cost["gold"] and s.get("steel", 0) >= cost["steel"], size=12 * u)
            y += 60 * u

    def skill_up(self, i):
        s = self.save
        lv = s["skill_lv"][i]
        c = D.skill_up_cost(lv)
        if lv < D.SKILL_MAX and s["gold"] >= c["gold"] and s.get("steel", 0) >= c["steel"]:
            s["gold"] -= c["gold"]
            s["steel"] -= c["steel"]
            s["skill_lv"][i] = lv + 1
            self.app.persist()
            self.camp()

    def adv_traits(self, root, x, y, w, s, hero):
        k, u = self.kit, self.u
        left = D.trait_points(s) - D.trait_spent(s)
        k.text(root, x, y, f"Trait points {left}", 15 * u, EMBER)
        k.button(root, x + w - 130 * u, y - 4, 130 * u, 28 * u, f"Reset {D.trait_reset_cost(s)}g", self.trait_reset, "normal", bool(D.trait_spent(s)) and s["gold"] >= D.trait_reset_cost(s), size=12 * u)
        y += 26 * u
        k.text(root, x, y, "One point per level after the first. Deeper nodes need 3 points above.", 11 * u, DIM, serif=False)
        y += 22 * u
        for br in D.TRAITS:
            k.text(root, x, y, br["name"], 13 * u, EMBER)
            y += 20 * u
            nw = (w - 6) / 2
            for i, n in enumerate(br["nodes"]):
                rank = s["traits"].get(n["id"], 0)
                open_ = I.trait_unlocked(s, br, i)
                cx, cy = x + (i % 2) * (nw + 6), y + (i // 2) * 46 * u
                can = open_ and left > 0 and rank < D.TRAIT_MAX
                k.box(root, cx, cy, nw, 42 * u, (0.12, 0.095, 0.07, 1) if open_ else (0.08, 0.065, 0.05, 1), EMBER if rank else LINE)
                k.text(root, cx + 8, cy + 3, n["name"], 13 * u, INK if open_ else DIM)
                k.text(root, cx + 8, cy + 22 * u, n["text"], 11 * u, DIM, serif=False)
                k.text(root, cx + nw - 8, cy + 3, f"{rank}/{D.TRAIT_MAX}", 13 * u, EMBER, "right")
                k.hotspot(cx, cy, nw, 42 * u, (lambda nid=n["id"]: self.trait_up(nid)), can)
            y += 2 * 46 * u + 6

    def trait_up(self, nid):
        s = self.save
        br = next(b for b in D.TRAITS if any(n["id"] == nid for n in b["nodes"]))
        idx = next(i for i, n in enumerate(br["nodes"]) if n["id"] == nid)
        rank = s["traits"].get(nid, 0)
        if I.trait_unlocked(s, br, idx) and rank < D.TRAIT_MAX and D.trait_spent(s) < D.trait_points(s):
            s["traits"][nid] = rank + 1
            self.app.persist()
            self.camp()

    def trait_reset(self):
        s = self.save
        c = D.trait_reset_cost(s)
        if s["gold"] >= c:
            s["gold"] -= c
            s["traits"] = {}
            self.app.persist()
            self.camp()

    def adv_sigil(self, root, x, y, w, s, hero):
        k, u = self.kit, self.u
        lv = s["sigil"]
        cost = D.sigil_cost(lv)
        k.box(root, x, y, 86 * u, 86 * u, (0.1, 0.075, 0.055, 1), EMBER, 2)
        k.icon(root, s["cls"], x + 8, y + 8, 70 * u)
        k.text(root, x + 100 * u, y + 4, "House Sigil", 22 * u, INK)
        k.text(root, x + 100 * u, y + 34 * u, f"Level {lv} / {D.SIGIL_MAX}", 16 * u, EMBER)
        k.text(root, x + 100 * u, y + 58 * u, f"Per level: +{D.SIGIL_PER['dmgPct']}% damage, +{D.SIGIL_PER['hpPct']}% health, +{D.SIGIL_PER['armor']} armor", 11 * u, DIM, serif=False)
        y += 100 * u
        for l, b in D.SIGIL_BOONS.items():
            k.text(root, x, y, ("* " if lv >= l else "o ") + f"Level {l}: {b['text']}", 13 * u, GOOD if lv >= l else DIM, serif=False)
            y += 22 * u
        y += 8
        if lv < D.SIGIL_MAX:
            k.button(root, x, y, 300 * u, 36 * u, f"Raise sigil  -  {cost['gold']}g  -  {cost['steel']} steel", self.sigil_up, "primary", s["gold"] >= cost["gold"] and s.get("steel", 0) >= cost["steel"], size=14 * u)
        else:
            k.text(root, x, y, "Your sigil is fully raised.", 14 * u, DIM, serif=False)

    def sigil_up(self):
        s = self.save
        c = D.sigil_cost(s["sigil"])
        if s["sigil"] < D.SIGIL_MAX and s["gold"] >= c["gold"] and s.get("steel", 0) >= c["steel"]:
            s["gold"] -= c["gold"]
            s["steel"] -= c["steel"]
            s["sigil"] += 1
            self.app.persist()
            self.camp()

    def adv_arts(self, root, x, y, w, s, hero):
        k, u = self.kit, self.u
        k.text(root, x, y, "Relics from bosses (and rarely brutes). A duplicate levels it up.", 12 * u, DIM, serif=False)
        y += 24 * u
        sw = (w - 12) / 3
        for i in range(D.ART_SLOTS):
            aid = s["art_slots"][i]
            a = next((q for q in D.ARTIFACTS if q["id"] == aid), None)
            k.box(root, x + i * (sw + 6), y, sw, 66 * u, (0.1, 0.08, 0.06, 1), (0.48, 0.88, 1, 1) if a else LINE)
            if a:
                k.text(root, x + i * (sw + 6) + sw / 2, y + 6, a["name"], 12 * u, INK, "center")
                k.text(root, x + i * (sw + 6) + sw / 2, y + 26 * u, f"+{D.art_value(a, s['artifacts'][aid]['lv'])}{a['text']}", 11 * u, DIM, "center", serif=False)
                k.button(root, x + i * (sw + 6) + 8, y + 40 * u, sw - 16, 22 * u, "Remove", (lambda i=i: self.art_unequip(i)), size=11 * u)
            else:
                k.text(root, x + i * (sw + 6) + sw / 2, y + 24 * u, "Empty slot", 12 * u, DIM, "center", serif=False)
        y += 76 * u
        for a in D.ARTIFACTS:
            own = s["artifacts"].get(a["id"])
            k.box(root, x, y, w, 44 * u, (0.1, 0.08, 0.06, 0.9), LINE)
            if not own:
                k.text(root, x + 12, y + 12 * u, "???  Not yet found", 14 * u, DIM)
                y += 50 * u
                continue
            cost = D.art_up_cost(own["lv"])
            worn = a["id"] in s["art_slots"]
            k.text(root, x + 12, y + 4, f"{a['name']}   Lv {own['lv']}/{D.ART_MAX}", 14 * u, INK)
            k.text(root, x + 12, y + 24 * u, f"+{D.art_value(a, own['lv'])}{a['text']}", 11 * u, DIM, serif=False)
            k.button(root, x + w - 224 * u, y + 8 * u, 70 * u, 28 * u, "Worn" if worn else "Equip", (lambda aid=a["id"]: self.art_equip(aid)), "normal", not worn, size=12 * u)
            if own["lv"] < D.ART_MAX:
                k.button(root, x + w - 148 * u, y + 8 * u, 140 * u, 28 * u, f"{cost['gold']}g {cost['steel']} steel", (lambda aid=a["id"]: self.art_up(aid)), "normal", s["gold"] >= cost["gold"] and s.get("steel", 0) >= cost["steel"], size=11 * u)
            y += 50 * u

    def art_equip(self, aid):
        s = self.save
        i = next((j for j, q in enumerate(s["art_slots"]) if not q), 0)
        s["art_slots"][i] = aid
        self.app.persist()
        self.camp()

    def art_unequip(self, i):
        self.save["art_slots"][i] = None
        self.app.persist()
        self.camp()

    def art_up(self, aid):
        s = self.save
        own = s["artifacts"][aid]
        c = D.art_up_cost(own["lv"])
        if own["lv"] < D.ART_MAX and s["gold"] >= c["gold"] and s.get("steel", 0) >= c["steel"]:
            s["gold"] -= c["gold"]
            s["steel"] -= c["steel"]
            own["lv"] += 1
            self.app.persist()
            self.camp()

    def adv_exped(self, root, x, y, w, s, hero):
        k, st, u = self.kit, self.st, self.u
        if s["cleared"] < D.EXP_UNLOCK_STAGE:
            k.text(root, x, y, f"The Scout Lodge opens once you have cleared stage {D.EXP_UNLOCK_STAGE}: {D.STAGES[D.EXP_UNLOCK_STAGE - 1]['name']}.", 14 * u, DIM, wrap=w, serif=False)
            return
        now = time.time()
        busy = {sid for e in s["expeds"] for sid in e["scouts"]}
        ex = st["exp"]
        ex["crew"] = [c for c in ex["crew"] if any(q["id"] == c for q in s["scouts"]) and c not in busy]
        route = next(r for r in D.ROUTES if r["id"] == ex["route"])
        crew = [q for q in s["scouts"] if q["id"] in ex["crew"]]
        k.text(root, x, y, "Scouts walk off for real-time errands, even while the game is closed.", 12 * u, DIM, serif=False)
        y += 24 * u
        k.text(root, x, y, f"Out now ({len(s['expeds'])}/{D.EXP_SLOTS})", 13 * u, EMBER)
        y += 22 * u
        if not s["expeds"]:
            k.text(root, x, y, "No expeditions out.", 13 * u, DIM, serif=False)
            y += 24 * u
        for i, e in enumerate(s["expeds"]):
            r = next(q for q in D.ROUTES if q["id"] == e["route"])
            left = e["end"] - now
            k.box(root, x, y, w, 40 * u, (0.1, 0.08, 0.06, 0.9), LINE)
            k.text(root, x + 10, y + 3, f"{r['name']}  ({len(e['scouts'])} scouts)", 14 * u, INK)
            k.text(root, x + 10, y + 22 * u, "Returned, awaiting you." if left <= 0 else f"{fmt_time(left)} remaining", 12 * u, GOOD if left <= 0 else DIM, serif=False)
            k.button(root, x + w - 100 * u, y + 6 * u, 90 * u, 28 * u, "Collect", (lambda i=i: self.exp_collect(i)), "primary" if left <= 0 else "normal", left <= 0, size=13 * u)
            y += 46 * u
        k.text(root, x, y, "Routes", 13 * u, EMBER)
        y += 22 * u
        rw = (w - 12) / 3
        for i, r in enumerate(D.ROUTES):
            k.button(root, x + i * (rw + 6), y, rw, 42 * u, f"{r['name']}\n{r['mins']} min - {r['scouts']}+ scouts" if r["mins"] < 60 else f"{r['name']}\n{r['mins'] / 60:g}h - {r['scouts']}+ scouts", (lambda rid=r["id"]: self.exp_route(rid)), "on" if ex["route"] == r["id"] else "normal", size=11 * u)
        y += 50 * u
        odds = I.expedition_odds(route, crew)
        k.text(root, x, y, f"{route['blurb']}  Artifact chance with this crew: {round(odds * 100)}%", 12 * u, DIM, wrap=w, serif=False)
        y += 36 * u
        k.text(root, x, y, f"Scouts ({len(s['scouts'])}/{D.SCOUT_MAX})", 13 * u, EMBER)
        y += 22 * u
        sw = (w - 12) / 3
        for i, c in enumerate(s["scouts"]):
            cx, cy = x + (i % 3) * (sw + 6), y + (i // 3) * 44 * u
            col = D.RARITIES[c["rar"]]["color"]
            away = c["id"] in busy
            k.button(root, cx, cy, sw, 38 * u, f"{c['name']}\n{D.RARITIES[c['rar']]['name']}{' - away' if away else ''}", (lambda cid=c["id"]: self.exp_crew(cid)), "on" if c["id"] in ex["crew"] else "normal", not away, size=11 * u)
        y += math.ceil(len(s["scouts"]) / 3) * 44 * u + 6
        full = len(s["expeds"]) >= D.EXP_SLOTS
        can = (not full) and route["scouts"] <= len(crew) <= 3
        k.button(root, x, y, 200 * u, 34 * u, "Expedition slots full" if full else (f"Pick {route['scouts']} scout(s)" if len(crew) < route["scouts"] else "Send out"), self.exp_send, "primary", can, size=14 * u)
        k.button(root, x + 208 * u, y, 220 * u, 34 * u, "Lodge is full" if len(s["scouts"]) >= D.SCOUT_MAX else f"Hire a scout - {D.scout_cost(len(s['scouts']))}g", self.exp_hire, "normal", len(s["scouts"]) < D.SCOUT_MAX and s["gold"] >= D.scout_cost(len(s["scouts"])), size=13 * u)

    def exp_route(self, rid):
        self.st["exp"]["route"] = rid
        self.camp()

    def exp_crew(self, cid):
        c = self.st["exp"]["crew"]
        if cid in c:
            c.remove(cid)
        elif len(c) < 3:
            c.append(cid)
        self.camp()

    def exp_send(self):
        s, ex = self.save, self.st["exp"]
        r = next(q for q in D.ROUTES if q["id"] == ex["route"])
        if len(s["expeds"]) >= D.EXP_SLOTS or len(ex["crew"]) < r["scouts"]:
            return
        now = time.time()
        s["expeds"].append({"route": r["id"], "scouts": list(ex["crew"]), "start": now, "end": now + r["mins"] * 60})
        ex["crew"] = []
        self.app.persist()
        self.camp()

    def exp_collect(self, i):
        s = self.save
        e = s["expeds"][i]
        if time.time() < e["end"]:
            return
        r = I.resolve_expedition(s, e)
        s["expeds"].pop(i)
        self.st["msg"] = f"{r['route']}: +{r['steel']} steel, +{r['gold']} gold" + (f". {r['found']}!" if r["found"] else ".")
        self.st["msg_ok"] = True
        self.app.persist()
        self.camp()

    def exp_hire(self):
        s = self.save
        c = D.scout_cost(len(s["scouts"]))
        if len(s["scouts"]) < D.SCOUT_MAX and s["gold"] >= c:
            s["gold"] -= c
            sc = I.new_scout()
            s["scouts"].append(sc)
            self.st["msg"], self.st["msg_ok"] = f"{sc['name']} joins the lodge.", True
            self.app.persist()
            self.camp()

    # --- shop tab
    def tab_shop(self, root, x, y, w, h, s, hero):
        k, u = self.kit, self.u
        k.icon(root, "potion", x, y, 64 * u)
        k.text(root, x + 76 * u, y + 2, "Hedge-Apothecary", 20 * u, INK)
        k.text(root, x + 76 * u, y + 30 * u, f"Red tonic. Heals half your health. Carry up to {D.MAX_POTIONS}.", 13 * u, (0.82, 0.76, 0.62, 1), serif=False, wrap=w - 80 * u)
        y += 84 * u
        k.text(root, x, y, f"Potions {s['potions']} / {D.MAX_POTIONS}", 16 * u, INK)
        y += 30 * u
        full = s["potions"] >= D.MAX_POTIONS
        to_full = D.MAX_POTIONS - s["potions"]
        k.button(root, x, y, 190 * u, 34 * u, f"Buy 1  -  {D.POTION_PRICE}g", (lambda: self.buy(1)), "primary", s["gold"] >= D.POTION_PRICE and not full, size=14 * u)
        k.button(root, x + 198 * u, y, 220 * u, 34 * u, f"Fill up ({to_full}) - {to_full * D.POTION_PRICE}g" if to_full > 1 else "Fill up", (lambda: self.buy(to_full)), "normal", to_full > 1 and s["gold"] >= D.POTION_PRICE, size=14 * u)
        y += 56 * u
        size = s.get("bag_size", 24)
        k.text(root, x, y, f"Bag slots {size} / {D.BAG_MAX}", 16 * u, INK)
        y += 30 * u
        cost = D.bag_expand_cost(size)
        k.button(root, x, y, 300 * u, 34 * u, "Bag is full size" if size >= D.BAG_MAX else f"+{D.BAG_EXPAND} slots  -  {cost}g", self.expand_bag, "normal", size < D.BAG_MAX and s["gold"] >= cost, size=14 * u)
        y += 52 * u
        k.text(root, x, y, "Sell or dismantle spare equipment from the Bag.", 13 * u, DIM, serif=False)

    def buy(self, n):
        s = self.save
        n = min(n, D.MAX_POTIONS - s["potions"], s["gold"] // D.POTION_PRICE)
        if n > 0:
            s["potions"] += n
            s["gold"] -= n * D.POTION_PRICE
            self.app.persist()
            self.camp()

    def expand_bag(self):
        s = self.save
        size = s.get("bag_size", 24)
        c = D.bag_expand_cost(size)
        if size < D.BAG_MAX and s["gold"] >= c:
            s["gold"] -= c
            s["bag_size"] = min(D.BAG_MAX, size + D.BAG_EXPAND)
            self.app.persist()
            self.camp()

    # ------------------------------------------------------------ RESULT
    def result(self, res):
        k = self.kit
        root = self.begin("result")
        W, H, u = k.W, k.H, self.u
        k.box(root, 0, 0, W, H, (0.03, 0.02, 0.015, 0.74))
        won, stage, run, s = res["won"], res["stage"], res["run"], self.save
        vault = stage.id == "vault"
        ending = won and stage.id == 6 and run.first_clear
        bw = min(560 * u, W - 40)
        bh = min(H - 40, 620 * u)
        bx, by = (W - bw) / 2, (H - bh) / 2
        k.box(root, bx, by, bw, bh, (0.14, 0.11, 0.085, 0.98), LINE2, 2)
        y = by + 18 * u
        title = f"Floor {stage.floor} cleared" if (won and vault) else "The Heir is Free" if ending else "Victory" if won else "Defeated"
        k.text(root, W / 2, y, title, 36 * u, EMBER if won else BAD, "center")
        y += 48 * u
        k.text(root, W / 2, y, stage.name, 14 * u, DIM, "center", serif=False)
        y += 26 * u
        if ending:
            t = k.text(root, W / 2, y, D.ENDING_TEXT, 14 * u, (0.85, 0.78, 0.62, 1), "center", wrap=bw - 60)
            y += t.text_h + 12 * u
        stats = [(str(run.kills), "Foes slain"), (str(run.xp), "XP"), (str(run.gold), "Gold")]
        if run.steel:
            stats.append((str(run.steel), "Steel"))
        if won and run.bonus:
            stats.append((f"+{run.bonus}", "Clear bonus"))
        cw = (bw - 40) / len(stats)
        for i, (v, l) in enumerate(stats):
            k.text(root, bx + 20 + cw * (i + 0.5), y, v, 26 * u, INK, "center")
            k.text(root, bx + 20 + cw * (i + 0.5), y + 32 * u, l.upper(), 10 * u, DIM, "center", serif=False)
        y += 62 * u
        if run.levels:
            k.text(root, W / 2, y, f"Level {run.start_level} -> {s['level']}", 16 * u, EMBER, "center")
            y += 26 * u
        if vault:
            k.text(root, W / 2, y, f"Best floor {s['vault_best']}", 14 * u, EMBER, "center")
            y += 24 * u
        for a in run.artifacts:
            k.text(root, W / 2, y, a, 14 * u, (0.48, 0.88, 1, 1), "center")
            y += 22 * u
        if run.items:
            k.text(root, W / 2, y, "LOOT", 11 * u, DIM, "center", serif=False)
            y += 20 * u
            for it in run.items[:7]:
                k.icon(root, I_icon(it), bx + 40, y - 2, 22 * u)
                k.text(root, bx + 68 * u, y, it["name"], 14 * u, rcol(it))
                y += 24 * u
            if len(run.items) > 7:
                k.text(root, W / 2, y, f"...and {len(run.items) - 7} more", 12 * u, DIM, "center", serif=False)
        by_ = by + bh - 56 * u
        if won and vault:
            k.button(root, W / 2 - 250 * u, by_, 240 * u, 40 * u, f"Descend to floor {stage.floor + 1}", (lambda: self.app.march("vault", stage.floor + 1)), "primary", size=15 * u)
            k.button(root, W / 2 + 10 * u, by_, 240 * u, 40 * u, "Return to camp", self.app.to_camp, size=15 * u)
        elif not won:
            k.button(root, W / 2 - 250 * u, by_, 240 * u, 40 * u, "Try again", (lambda: self.app.march(stage.id, stage.floor if vault else 0)), "primary", size=15 * u)
            k.button(root, W / 2 + 10 * u, by_, 240 * u, 40 * u, "Return to camp", self.app.to_camp, size=15 * u)
        else:
            k.button(root, W / 2 - 130 * u, by_, 260 * u, 40 * u, "Return to camp", self.app.to_camp, "primary", size=16 * u)

    # ------------------------------------------------------------ PAUSE
    def pause(self):
        k = self.kit
        root = self.begin("pause")
        W, H, u = k.W, k.H, self.u
        k.box(root, 0, 0, W, H, (0.03, 0.02, 0.015, 0.72))
        bw, bh = 360 * u, 330 * u
        bx, by = (W - bw) / 2, (H - bh) / 2
        k.box(root, bx, by, bw, bh, (0.14, 0.11, 0.085, 0.98), LINE2, 2)
        k.text(root, W / 2, by + 18 * u, "Paused", 34 * u, INK, "center")
        k.button(root, bx + 40 * u, by + 76 * u, bw - 80 * u, 44 * u, "Resume", self.app.resume, "primary", size=18 * u)
        q = self.app.settings.get("quality", "high")
        k.text(root, bx + 40 * u, by + 146 * u, "Graphics", 15 * u, DIM, serif=False)
        k.button(root, bx + 140 * u, by + 138 * u, 80 * u, 34 * u, "Low", (lambda: self.app.set_quality("low")), "on" if q == "low" else "normal", size=14 * u)
        k.button(root, bx + 226 * u, by + 138 * u, 80 * u, 34 * u, "High", (lambda: self.app.set_quality("high")), "on" if q == "high" else "normal", size=14 * u)
        k.button(root, bx + 40 * u, by + 200 * u, bw - 80 * u, 40 * u, "Abandon stage", self.app.quit_stage, size=15 * u)
        k.text(root, W / 2, by + 272 * u, "Esc to resume", 12 * u, DIM, "center", serif=False)

    # ------------------------------------------------------------ per-frame
    def tick(self, dt):
        """Refresh expedition countdowns while the camp is visible."""
        if self.view == "camp" and self.st["tab"] == "adv" and self.st["adv"] == "exped" and self.save and self.save["expeds"]:
            self._tick += dt
            if self._tick >= 1.0:
                self._tick = 0
                self.camp()


def I_icon(item):
    from .icons import slot_icon
    return slot_icon(item)


def fmt_time(sec):
    t = max(0, int(math.ceil(sec)))
    h, m, s = t // 3600, (t % 3600) // 60, t % 60
    return f"{h}h {m:02d}m" if h else f"{m}:{s:02d}"
