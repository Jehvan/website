"""Game state and simulation: stage flow, player, enemies, combat, loot. Pure logic (no graphics).

World coordinates: x east, y SOUTH (towards the camera). Angles are atan2(dy, dx).
"""
import math
import random
from types import SimpleNamespace as NS

from . import data as D
from .items import (hero_stats, roll_item, roll_rarity, add_xp, armor_mul, rarity_of)
from .world import build_layout, resolve_move, point_blocked, Rng

TAU = math.tau
R = random.random


def rand(a, b):
    return a + R() * (b - a)


def dist(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)


def ang_diff(a, b):
    d = (a - b) % TAU
    if d > math.pi:
        d = TAU - d
    return abs(d)


def clamp(v, a, b):
    return max(a, min(b, v))


class Input:
    def __init__(self):
        self.mx = self.my = 0.0
        self.aim = None
        self.auto = False
        self.attack = False
        self.skills = [False, False, False]
        self.potion = False


class Game:
    def __init__(self, save=None):
        self.save = save
        self.hero = hero_stats(save) if save else None
        self.mode = "idle"
        self.paused = False
        self.time = 0.0
        self.p = None
        self.enemies, self.proj, self.zones, self.pickups, self.fx, self.texts, self.spawn_q = [], [], [], [], [], [], []
        self.L = None
        self.stage = None
        self.run = None
        self.shake = 0.0
        self.banner = None
        self.god = False
        self.next_id = 1
        self.skill_mul_now = 1.0
        self.mp_flash = 0.0
        self.diff = None
        self.on_end = lambda res: None
        self.on_level_up = lambda lv, sk: None

    # ------------------------------------------------------------ setup
    def start_stage(self, sid, floor=0):
        d = D.stage_by_id(sid)
        vault = sid == "vault"
        boss = (floor % 5 == 0) if vault else sid == 6
        L = build_layout(d["theme"], 1000 + floor if vault else sid, boss=vault and boss, floor=floor)
        self.hero = hero_stats(self.save)
        s_idx = 5 + floor * 0.35 if vault else sid - 1
        self.diff = {"hp": 1 + 0.5 * s_idx, "dmg": 1 + 0.28 * s_idx, "xp": 1 + 0.3 * s_idx, "gold": 1 + 0.3 * s_idx, "s": s_idx}
        self.L, self.mode, self.paused = L, "stage", False
        self.enemies, self.proj, self.zones, self.pickups, self.fx, self.texts, self.spawn_q = [], [], [], [], [], [], []
        self.shake, self.time = 0.0, 0.0
        self.run = NS(kills=0, steel=0, gold=0, xp=0, items=[], levels=0, potions=0, start_level=self.save["level"],
                      first_clear=False, bonus=0, artifacts=[])
        h = self.hero
        self.p = NS(x=L.start[0], y=L.start[1], r=12, face=0.0, hp=h["max_hp"], mp=h["max_mp"], vx=0.0, vy=0.0,
                    atk_cd=0.0, atk_t=-1.0, atk_dur=0.3, hit_t=0.0, invuln=0.0, grace=0.0, dash=None, spin=None,
                    dmg_buff=0.0, cd=[0.0, 0.0, 0.0], pot_cd=0.0, walk=0.0, moving=False, dead=False, dead_t=0.0,
                    skill_anim=None, skill_t=0.0, move_ang=0.0, id=0, type=None, state="")
        waves = vault_waves(floor, boss) if vault else d["waves"]
        name = f"{d['name']} - Floor {floor}" if vault else d["name"]
        self.stage = NS(id=sid, d=d, floor=floor, waves=waves, wave_idx=-1, state="intro", t=2.2, boss=boss, name=name)
        sub = ("A warlord stirs below" if boss else "Descend") if vault else f"Suggested power {d['power']}"
        self.set_banner(name, sub, 2.2)

    def set_banner(self, text, sub="", t=2.0):
        self.banner = {"text": text, "sub": sub, "t": t, "dur": t}

    def start_wave(self):
        st = self.stage
        st.wave_idx += 1
        st.state = "fight"
        wave = st.waves[st.wave_idx]
        is_boss = any(t == "regent" for t, _ in wave)
        self.set_banner("The Ashen Regent" if is_boss else f"Wave {st.wave_idx + 1} / {len(st.waves)}", "Boss" if is_boss else "", 1.6)
        lst = [t for t, n in wave for _ in range(n)]
        random.shuffle(lst)
        t = 0.0
        for typ in lst:
            self.spawn_q.append({"t": t, "type": typ})
            t += 0 if typ == "regent" else 0.18

    # ------------------------------------------------------------ helpers
    def side_of(self, x):
        rv = self.L.river
        if not rv:
            return 0
        return -1 if x < rv["x0"] else 1 if x > rv["x1"] else 0

    def spawn_point(self, typ):
        L, p = self.L, self.p
        psd = self.side_of(p.x)
        b = L.bounds
        for _ in range(60):
            a = R() * TAU
            d = 330 if typ == "regent" else rand(340, 560)
            x, y = p.x + math.cos(a) * d, p.y + math.sin(a) * d
            if x < b["x0"] + 30 or x > b["x1"] - 30 or y < b["y0"] + 30 or y > b["y1"] - 30:
                continue
            if L.river and (self.side_of(x) == 0 or (psd != 0 and self.side_of(x) != psd)):
                continue
            if point_blocked(L, x, y, 22):
                continue
            return x, y
        for _ in range(80):
            x, y = rand(b["x0"] + 40, b["x1"] - 40), rand(b["y0"] + 40, b["y1"] - 40)
            if not point_blocked(L, x, y, 22) and math.hypot(x - p.x, y - p.y) > 250:
                return x, y
        return L.start[0] + 200, L.start[1]

    def make_enemy(self, typ, x, y, no_spawn=False):
        d = D.ENEMIES[typ]
        df = self.diff
        e = NS(id=self.next_id, type=typ, d=d, x=x, y=y, r=d["r"], face=R() * TAU, vx=0.0, vy=0.0,
               max_hp=round(d["hp"] * df["hp"]), hp=0, dmg=d["dmg"] * df["dmg"],
               speed=d["speed"] * (1 if d.get("boss") else 1 + df["s"] * 0.015), state="chase", t=0.0, cd=rand(0.4, 1.4),
               spawn_t=0.0 if no_spawn else 0.7, hit_t=0.0, slow_t=0.0, stun_t=0.0, walk=R() * 6, atk_t=-1.0,
               dead=False, dead_t=0.0, strafe=1 if R() < 0.5 else -1, strafe_t=rand(1, 2.5), wob=R() * 6,
               flying=bool(d.get("flying")), enraged=False, anim="idle", steer=0, steer_t=0.0, stuck_t=0.0,
               sx=1e5, sy=1e5, summoned=False, r_ang=0.0, charge_phase=0, charge_ang=0.0, hit_done=False,
               rings=0, dur=1.0, summon_cd=0.0, skill_anim=None)
        self.next_id += 1
        e.hp = e.max_hp
        if typ == "regent":
            e.state, e.cd, e.summon_cd = "idle", 1.5, 6.0
        self.enemies.append(e)
        return e

    def aim_info(self, inp):
        p = self.p
        if inp.auto:
            best, tgt = 700.0, None
            for e in self.enemies:
                if e.dead or e.spawn_t > 0.3:
                    continue
                d = dist(p, e)
                if d < best:
                    best, tgt = d, e
            if tgt:
                return NS(x=tgt.x, y=tgt.y, ang=math.atan2(tgt.y - p.y, tgt.x - p.x), target=tgt)
            ang = math.atan2(inp.my, inp.mx) if math.hypot(inp.mx, inp.my) > 0.1 else p.face
            return NS(x=p.x + math.cos(ang) * 200, y=p.y + math.sin(ang) * 200, ang=ang, target=None)
        a = inp.aim or (p.x + math.cos(p.face) * 100, p.y + math.sin(p.face) * 100)
        dx, dy = a[0] - p.x, a[1] - p.y
        return NS(x=a[0], y=a[1], ang=math.atan2(dy, dx) if math.hypot(dx, dy) > 4 else p.face, target=None)

    def float_text(self, x, y, text, color=(1, 1, 1), size=14, crit=False):
        if len(self.texts) > 70:
            self.texts.pop(0)
        self.texts.append(NS(x=x + rand(-6, 6), y=y, z=30.0, text=text, color=color, size=size, crit=crit, t=0.0,
                             dur=1.0 if crit else 0.8))

    def add_fx(self, **kw):
        if len(self.fx) < 120:
            self.fx.append(NS(t=0.0, **kw))

    def player_dmg(self):
        p = self.p
        crit = R() * 100 < self.hero["crit"]
        d = self.hero["damage"] * rand(0.92, 1.08) * (1.5 if p.dmg_buff > 0 else 1) * self.skill_mul_now
        if crit:
            d *= 1.75
        return d, crit

    def hurt_enemy(self, e, amount, crit, kbx=0.0, kby=0.0, kb=0.0, stun=0.0):
        if e.dead or e.spawn_t > 0:
            return
        dmg = max(1, round(amount))
        e.hp -= dmg
        e.hit_t = 0.16
        if kb:
            k = 0.4 if e.type == "brute" else 0.1 if e.d.get("boss") else 1
            e.vx += kbx * kb * k
            e.vy += kby * kb * k
        if stun and not e.d.get("boss"):
            e.stun_t = max(e.stun_t, stun)
        self.float_text(e.x, e.y - e.r, str(dmg), (1.0, 0.82, 0.29) if crit else (1, 1, 1), 20 if crit else 14, crit)
        if e.hp <= 0:
            self.kill_enemy(e)

    def hurt_player(self, raw, srcx, srcy, unblockable=False):
        p = self.p
        if p.dead or p.invuln > 0 or (p.grace > 0 and not unblockable):
            return False
        dmg = max(1, round(raw * armor_mul(self.hero["armor"])))
        if self.god:
            dmg = 0
        p.hp -= dmg
        p.hit_t = 0.22
        p.grace = 0.35
        self.shake = min(14, self.shake + 4 + dmg * 0.1)
        self.float_text(p.x, p.y - 14, str(dmg), (1.0, 0.35, 0.29), 16)
        a = math.atan2(p.y - srcy, p.x - srcx)
        p.vx += math.cos(a) * 120
        p.vy += math.sin(a) * 120
        if p.hp <= 0:
            p.hp, p.dead, p.dead_t = 0, True, 0.0
            self.stage.state, self.stage.t = "defeat", 2.2
            self.set_banner("You have fallen", "", 2.2)
        return True

    # ------------------------------------------------------------ loot
    def drop_item(self, x, y, bonus, min_rarity=None):
        ilvl = max(1, round(1 + self.diff["s"]))
        rar = roll_rarity(R, bonus + self.diff["s"] * 0.05)
        order = ["common", "magic", "rare", "heroic"]
        if min_rarity and order.index(rar) < order.index(min_rarity):
            rar = min_rarity
        t = R()
        slot = "weapon" if t < 0.38 else "armor" if t < 0.76 else "charm"
        item = roll_item(R, slot, ilvl, rar, self.save["cls"])
        self.pickups.append(NS(kind="item", item=item, x=x + rand(-14, 14), y=y + rand(-14, 14), vx=rand(-40, 40),
                               vy=rand(-40, 40), t=0.0, magnet=False, amount=0))

    def kill_enemy(self, e, silent=False):
        if e.dead:
            return
        e.dead, e.dead_t, e.state = True, 0.0, "dead"
        if silent:
            return
        run, d, df = self.run, e.d, self.diff
        run.kills += 1
        xp = round(d["xp"] * df["xp"] * (1 + self.hero["xp_pct"] / 100))
        run.xp += xp
        lv = add_xp(self.save, xp)
        self.float_text(e.x, e.y - e.r - 16, f"+{xp} xp", (0.6, 0.82, 1.0), 11)
        if lv:
            self.level_up(lv)
        steel = (8 + int(df["s"])) if d.get("boss") else 2 if e.type == "brute" else 1 if R() < 0.1 else 0
        if steel:
            self.save["steel"] = self.save.get("steel", 0) + steel
            run.steel += steel
            self.float_text(e.x, e.y - e.r - 28, f"+{steel} steel", (0.62, 0.71, 0.78), 12)
        if d.get("boss") or (e.type == "brute" and R() < 0.04):
            from .items import grant_artifact
            msg = grant_artifact(self.save)
            run.artifacts.append(msg)
            self.float_text(e.x, e.y - 50, msg, (0.48, 0.88, 1.0), 15, True)
            self.set_banner("Artifact found", msg, 2.4)
        gold = round(rand(*d["gold"]) * df["gold"] * (1 + self.hero["gold_pct"] / 100))
        self.pickups.append(NS(kind="gold", amount=gold, x=e.x, y=e.y, vx=rand(-50, 50), vy=rand(-50, 50), t=0.0, magnet=False))
        if d.get("boss"):
            for o in self.enemies:
                if not o.dead and o is not e:
                    self.kill_enemy(o, True)
            self.drop_item(e.x, e.y, 1.0, "rare")
            self.drop_item(e.x, e.y, 1.0, "magic")
            self.drop_item(e.x, e.y, 0.8, "magic")
            self.pickups.append(NS(kind="potion", x=e.x + 20, y=e.y, vx=30, vy=20, t=0.0, magnet=False, amount=0))
            self.shake = 12
        else:
            if R() < d["drop"]:
                self.drop_item(e.x, e.y, 0.35 if e.type == "brute" else 0)
            if R() < 0.05:
                self.pickups.append(NS(kind="potion", x=e.x, y=e.y, vx=rand(-40, 40), vy=rand(-40, 40), t=0.0, magnet=False, amount=0))

    def level_up(self, n):
        p, old = self.p, self.hero
        self.run.levels += n
        self.hero = hero_stats(self.save)
        p.hp = min(self.hero["max_hp"], p.hp + (self.hero["max_hp"] - old["max_hp"]) + self.hero["max_hp"] * 0.3)
        p.mp = self.hero["max_mp"]
        self.add_fx(type="ring", x=p.x, y=p.y, r=90, dur=0.8, color=(1, 0.89, 0.54))
        self.float_text(p.x, p.y - 40, f"LEVEL {self.save['level']}!", (1, 0.89, 0.54), 22, True)
        c = D.CLASSES[self.save["cls"]]
        sk = next((s for s in c["skills"] if s["unlock"] == self.save["level"]), None)
        self.set_banner(f"Level {self.save['level']}", f"Skill unlocked: {sk['name']}" if sk else "", 2)
        self.on_level_up(self.save["level"], sk)

    def collect(self, pk):
        save, run = self.save, self.run
        if pk.kind == "gold":
            save["gold"] += pk.amount
            run.gold += pk.amount
            self.float_text(self.p.x, self.p.y - 20, f"+{pk.amount}g", (1, 0.82, 0.29), 12)
        elif pk.kind == "potion":
            if save["potions"] >= D.MAX_POTIONS:
                save["gold"] += 15
                run.gold += 15
                self.float_text(self.p.x, self.p.y - 20, "+15g", (1, 0.82, 0.29), 12)
            else:
                save["potions"] += 1
                run.potions += 1
                self.float_text(self.p.x, self.p.y - 20, "Potion", (1, 0.56, 0.63), 13)
        else:
            if len(save["bag"]) >= save.get("bag_size", 24):
                v = round(5 * pk.item["ilvl"] * rarity_of(pk.item["rarity"])["sell"])
                save["gold"] += v
                run.gold += v
                self.float_text(self.p.x, self.p.y - 20, f"Bag full: sold for {v}g", (1, 0.82, 0.29), 11)
            else:
                save["bag"].append(pk.item)
                run.items.append(pk.item)
                self.float_text(self.p.x, self.p.y - 28, pk.item["name"], rarity_of(pk.item["rarity"])["color"], 13)

    # ------------------------------------------------------------ skills
    def in_circle(self, x, y, r):
        return [e for e in self.enemies if not e.dead and e.spawn_t <= 0 and math.hypot(e.x - x, e.y - y) < r + e.r]

    def fire_arrow(self, ang, mult, kind="arrow", speed=None, r=6, rng=None, splash=0, pierce=0):
        p, c = self.p, D.CLASSES[self.save["cls"]]
        sp = speed or c["attack"].get("speed", 560)
        rg = rng or c["attack"]["range"]
        d, crit = self.player_dmg()
        self.proj.append(NS(team="p", kind=kind, x=p.x + math.cos(ang) * 16, y=p.y + math.sin(ang) * 16,
                            vx=math.cos(ang) * sp, vy=math.sin(ang) * sp, ang=ang, r=r, dmg=d * mult, crit=crit,
                            life=rg / sp, splash=splash, pierce=pierce, hit=set(), t=0.0))

    def skill_rush(self, a, inp):
        p = self.p
        p.dash = NS(t=0.3, dur=0.3, vx=math.cos(a.ang) * 640, vy=math.sin(a.ang) * 640, hit=set(), kind="rush")
        p.invuln = max(p.invuln, 0.3)
        p.face = a.ang
        p.skill_anim, p.skill_t = "rush", 0.3

    def skill_whirl(self, a, inp):
        self.p.spin = NS(t=1.5, tick=0.0, mul=self.skill_mul_now)
        self.p.skill_anim, self.p.skill_t = "whirl", 1.5

    def skill_rally(self, a, inp):
        p = self.p
        p.hp = min(self.hero["max_hp"], p.hp + self.hero["max_hp"] * 0.25 * self.skill_mul_now)
        p.dmg_buff = 6
        p.skill_anim, p.skill_t = "rally", 0.5
        self.float_text(p.x, p.y - 30, "Rally!", (1, 0.89, 0.54), 16, True)
        self.add_fx(type="ring", x=p.x, y=p.y, r=120, dur=0.7, color=(1, 0.85, 0.42))

    def skill_volley(self, a, inp):
        p = self.p
        for i in range(-3, 4):
            self.fire_arrow(a.ang + i * 0.1, 0.8)
        p.face = a.ang
        p.skill_anim, p.skill_t, p.atk_t, p.atk_dur = "volley", 0.3, 0.0, 0.3

    def skill_tumble(self, a, inp):
        p = self.p
        ang = math.atan2(inp.my, inp.mx) if math.hypot(inp.mx, inp.my) > 0.2 else a.ang + math.pi
        p.dash = NS(t=0.4, dur=0.4, vx=math.cos(ang) * 400, vy=math.sin(ang) * 400, hit=set(), kind="tumble")
        p.invuln = max(p.invuln, 0.42)
        p.skill_anim, p.skill_t, p.move_ang = "tumble", 0.4, ang

    def skill_rain(self, a, inp):
        p = self.p
        d = min(420, math.hypot(a.x - p.x, a.y - p.y))
        x, y = p.x + math.cos(a.ang) * d, p.y + math.sin(a.ang) * d
        self.zones.append(NS(kind="rain", team="p", x=x, y=y, r=112, t=0.0, delay=0.0, dur=3.0, tick=0.0,
                             dmg=0.55 * self.skill_mul_now, fired=False, crit=False, x2=0, y2=0, w=0))
        p.face = a.ang
        p.skill_anim, p.skill_t = "volley", 0.4

    def skill_nova(self, a, inp):
        p = self.p
        for e in self.in_circle(p.x, p.y, 135):
            d, crit = self.player_dmg()
            ang = math.atan2(e.y - p.y, e.x - p.x)
            self.hurt_enemy(e, d * 1.6, crit, math.cos(ang), math.sin(ang), 120)
            e.slow_t = 3
        self.add_fx(type="nova", x=p.x, y=p.y, r=135, dur=0.55, color=(0.56, 0.85, 1.0))
        p.skill_anim, p.skill_t = "nova", 0.45
        self.shake = min(14, self.shake + 3)

    def skill_blink(self, a, inp):
        p = self.p
        ang = math.atan2(inp.my, inp.mx) if (inp.auto and math.hypot(inp.mx, inp.my) > 0.2) else a.ang
        self.add_fx(type="blink", x=p.x, y=p.y, dur=0.4, color=(0.72, 0.61, 1.0))
        for _ in range(18):
            p.x += math.cos(ang) * 10
            p.y += math.sin(ang) * 10
            px, py = p.x, p.y
            resolve_move(self.L, p)
            if abs(px - p.x) > 3 or abs(py - p.y) > 3:
                break
        self.add_fx(type="blink", x=p.x, y=p.y, dur=0.4, color=(0.72, 0.61, 1.0))
        p.invuln = max(p.invuln, 0.2)
        p.skill_anim, p.skill_t, p.face = "blink", 0.3, ang

    def skill_meteor(self, a, inp):
        p = self.p
        d = min(460, math.hypot(a.x - p.x, a.y - p.y))
        x, y = p.x + math.cos(a.ang) * d, p.y + math.sin(a.ang) * d
        dmg, crit = self.player_dmg()
        self.zones.append(NS(kind="meteor", team="p", x=x, y=y, r=118, t=0.0, delay=1.1, dur=1.6, fired=False,
                             dmg=dmg * 4, crit=crit, tick=0.0, x2=0, y2=0, w=0))
        p.face = a.ang
        p.skill_anim, p.skill_t = "cast", 0.5

    def try_skill(self, i, inp):
        p = self.p
        sk = D.CLASSES[self.save["cls"]]["skills"][i]
        if p.dead or self.save["level"] < sk["unlock"] or p.cd[i] > 0 or p.dash or p.spin:
            return
        if p.mp < sk["cost"]:
            self.mp_flash = 0.4
            return
        a = self.aim_info(inp)
        lv = self.save["skill_lv"][i]
        p.mp -= sk["cost"]
        p.cd[i] = sk["cd"] * D.skill_cd_mul(lv) * (1 - min(0.5, self.hero["cdr"] / 100))
        self.skill_mul_now = D.skill_mul(lv)
        getattr(self, "skill_" + sk["id"])(a, inp)
        self.skill_mul_now = 1.0

    def player_attack(self, a):
        p = self.p
        at = D.CLASSES[self.save["cls"]]["attack"]
        p.atk_cd, p.atk_t, p.atk_dur, p.face = at["cd"], 0.0, at["dur"], a.ang
        if at["type"] == "melee":
            half = math.radians(at["arc"] / 2)
            for e in self.enemies:
                if e.dead or e.spawn_t > 0:
                    continue
                d = dist(p, e)
                if d > at["range"] + e.r:
                    continue
                ang = math.atan2(e.y - p.y, e.x - p.x)
                if d > e.r + 14 and ang_diff(ang, a.ang) > half:
                    continue
                dmg, crit = self.player_dmg()
                self.hurt_enemy(e, dmg * at["mult"], crit, math.cos(ang), math.sin(ang), 90)
            self.add_fx(type="slash", x=p.x, y=p.y, ang=a.ang, range=at["range"], arc=at["arc"], dur=0.22, color=(0.91, 0.94, 1.0))
        elif at["type"] == "arrow":
            self.fire_arrow(a.ang, at["mult"])
        else:
            self.fire_arrow(a.ang, at["mult"], "bolt", at["speed"], 8, splash=at["splash"])

    # ------------------------------------------------------------ main update
    def update(self, dt, inp):
        if self.mode != "stage" or self.paused:
            return
        dt = min(dt, 0.05)
        self.time += dt
        st, p = self.stage, self.p
        if self.banner:
            self.banner["t"] -= dt
            if self.banner["t"] <= 0:
                self.banner = None
        self.mp_flash = max(0.0, self.mp_flash - dt)
        self.shake = max(0.0, self.shake - dt * 22)

        if st.state == "intro":
            st.t -= dt
            if st.t <= 0:
                self.start_wave()
        elif st.state == "fight":
            if not any(not e.dead for e in self.enemies) and not self.spawn_q:
                if st.wave_idx >= len(st.waves) - 1:
                    st.state, st.t = "victory", 1.8
                    for pk in self.pickups:
                        pk.magnet = True
                    self.set_banner("The Regent is slain" if st.boss else "Victory!", "", 1.8)
                else:
                    st.state, st.t = "between", 2.2
                    self.set_banner("Wave cleared", "", 1.6)
        elif st.state == "between":
            st.t -= dt
            if st.t <= 0:
                self.start_wave()
        elif st.state in ("victory", "defeat"):
            st.t -= dt
            if st.t <= 0:
                won = st.state == "victory"
                st.state = "done"
                self.finish_stage(won)

        for q in list(self.spawn_q):
            q["t"] -= dt
            if q["t"] <= 0:
                x, y = self.spawn_point(q["type"])
                e = self.make_enemy(q["type"], x, y)
                self.add_fx(type="spawn", x=x, y=y, dur=0.7, color=(1.0, 0.42, 0.16) if e.d.get("boss") else (1.0, 0.6, 0.29))
                self.spawn_q.remove(q)

        self.update_player(dt, inp)
        self.update_enemies(dt)
        self.update_projectiles(dt)
        self.update_zones(dt)
        self.update_pickups(dt)
        for f in self.fx[:]:
            f.t += dt
            if f.t >= f.dur:
                self.fx.remove(f)
        for t in self.texts[:]:
            t.t += dt
            t.z += dt * 30
            if t.t >= t.dur:
                self.texts.remove(t)

    def finish_stage(self, won):
        save, st, run = self.save, self.stage, self.run
        bonus = 0
        if won:
            if st.id == "vault":
                bonus = round(40 + st.floor * 12)
                save["vault_best"] = max(save["vault_best"], st.floor)
            else:
                bonus = 30 + st.id * 15
                if st.id > save["cleared"]:
                    save["cleared"] = st.id
                    run.first_clear = True
                    bonus += st.id * 40
                if st.id == 6:
                    save["story"] = True
            save["gold"] += bonus
            run.gold += bonus
        run.bonus = bonus
        self.mode = "ended"
        self.on_end({"won": won, "stage": st, "run": run})

    # ------------------------------------------------------------ player
    def update_player(self, dt, inp):
        p, hero = self.p, self.hero
        if p.dead:
            p.dead_t += dt
            return
        a = self.aim_info(inp)
        p.atk_cd = max(0.0, p.atk_cd - dt)
        p.hit_t = max(0.0, p.hit_t - dt)
        p.invuln = max(0.0, p.invuln - dt)
        p.grace = max(0.0, p.grace - dt)
        p.dmg_buff = max(0.0, p.dmg_buff - dt)
        p.pot_cd = max(0.0, p.pot_cd - dt)
        for i in range(3):
            p.cd[i] = max(0.0, p.cd[i] - dt)
        if p.atk_t >= 0:
            p.atk_t += dt / p.atk_dur
            if p.atk_t >= 1:
                p.atk_t = -1.0
        if p.skill_t > 0:
            p.skill_t -= dt
            if p.skill_t <= 0:
                p.skill_anim = None
        p.mp = min(hero["max_mp"], p.mp + hero["regen"] * dt)

        if inp.potion:
            inp.potion = False
            if self.save["potions"] > 0 and p.pot_cd <= 0 and p.hp < hero["max_hp"]:
                self.save["potions"] -= 1
                p.pot_cd = 1.0
                h = round(hero["max_hp"] * 0.5)
                p.hp = min(hero["max_hp"], p.hp + h)
                self.float_text(p.x, p.y - 26, f"+{h}", (0.44, 0.88, 0.54), 16)
                self.add_fx(type="ring", x=p.x, y=p.y, r=60, dur=0.5, color=(0.44, 0.88, 0.54))
        for i in range(3):
            if inp.skills[i]:
                inp.skills[i] = False
                self.try_skill(i, inp)

        mx, my = inp.mx, inp.my
        ml = math.hypot(mx, my)
        if ml > 1:
            mx, my = mx / ml, my / ml
        p.moving = ml > 0.1
        spd = hero["speed"] * (0.65 if p.spin else 1.0)
        if p.dash:
            d = p.dash
            d.t -= dt
            p.vx, p.vy = d.vx, d.vy
            p.x += d.vx * dt
            p.y += d.vy * dt
            if d.kind == "rush":
                ang = math.atan2(d.vy, d.vx)
                for e in self.enemies:
                    if e.dead or e.spawn_t > 0 or e.id in d.hit:
                        continue
                    if math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 12:
                        d.hit.add(e.id)
                        dmg, crit = self.player_dmg()
                        side = 1 if ((e.x - p.x) * -math.sin(ang) + (e.y - p.y) * math.cos(ang)) >= 0 else -1
                        self.hurt_enemy(e, dmg * 1.6, crit, -math.sin(ang) * side + math.cos(ang) * 0.3,
                                        math.cos(ang) * side + math.sin(ang) * 0.3, 360, 0.5)
                if R() < 0.6:
                    self.add_fx(type="trail", x=p.x, y=p.y, dur=0.3, color=(0.85, 0.89, 1.0))
            if d.t <= 0:
                p.dash = None
            p.walk += dt * 16
            p.move_ang = math.atan2(d.vy, d.vx)
        else:
            k = 0.0005 ** dt
            p.vx *= k
            p.vy *= k
            p.x += (mx * spd + p.vx) * dt
            p.y += (my * spd + p.vy) * dt
            if p.moving:
                p.walk += dt * (spd / 18)
                p.move_ang = math.atan2(my, mx)
        resolve_move(self.L, p)

        if not p.dash:
            if inp.auto:
                p.face = a.ang if a.target else (math.atan2(my, mx) if p.moving else p.face)
            else:
                p.face = a.ang

        if p.spin:
            p.spin.t -= dt
            p.spin.tick -= dt
            if p.spin.tick <= 0:
                p.spin.tick = 0.25
                for e in self.in_circle(p.x, p.y, 86):
                    d, crit = self.player_dmg()
                    ang = math.atan2(e.y - p.y, e.x - p.x)
                    self.hurt_enemy(e, d * 0.8 * p.spin.mul, crit, math.cos(ang), math.sin(ang), 110)
                self.add_fx(type="ring", x=p.x, y=p.y, r=86, dur=0.3, color=(0.91, 0.94, 1.0))
            if p.spin.t <= 0:
                p.spin = None

        if inp.attack and p.atk_cd <= 0 and not p.dash and not p.spin:
            self.player_attack(a)

    # ------------------------------------------------------------ enemies
    def move_towards(self, e, tx, ty, speed, dt):
        ang = math.atan2(ty - e.y, tx - e.x)
        step = speed * dt
        best = ang
        if not e.flying:
            L = self.L

            def probe(a):
                t = _Pt(e.x + math.cos(a) * step * 2, e.y + math.sin(a) * step * 2)
                resolve_move(L, t, e.r)
                return ((t.x - e.x) * math.cos(ang) + (t.y - e.y) * math.sin(ang)) / (step * 2)

            if probe(ang) < 0.45:
                if not e.steer_t or e.steer_t < self.time:
                    e.steer = e.steer or (1 if R() < 0.5 else -1)
                    e.steer_t = self.time + 1.2
                bp = -9.0
                for k in (0.7, 1.4, 2.1):
                    a2 = ang + e.steer * k
                    pr = probe(a2)
                    if pr > bp:
                        bp, best = pr, a2
                    if pr > 0.2:
                        break
                if bp < 0.1:
                    e.steer = -e.steer
        e.x += math.cos(best) * step
        e.y += math.sin(best) * step
        e.face = ang
        e.walk += dt * speed / 14

    def goal_for(self, e):
        L, p = self.L, self.p
        if L.river:
            es, ps = self.side_of(e.x), self.side_of(p.x)
            if es != 0 and es != ps:
                return (L.river["x0"] + 12 if es < 0 else L.river["x1"] - 12), L.bridge["y"], True
        return p.x, p.y, False

    def enemy_shoot(self, e, kind, ang, speed, dmg, life=3.0, r=5):
        self.proj.append(NS(team="e", kind=kind, x=e.x + math.cos(ang) * 14, y=e.y + math.sin(ang) * 14,
                            vx=math.cos(ang) * speed, vy=math.sin(ang) * speed, ang=ang, r=r, dmg=dmg, life=life,
                            hit=set(), t=0.0, splash=0, pierce=0, crit=False))

    def update_enemies(self, dt):
        p, L = self.p, self.L
        for e in self.enemies[:]:
            if e.dead:
                e.dead_t += dt
                if e.dead_t > 1.2:
                    self.enemies.remove(e)
                continue
            e.hit_t = max(0.0, e.hit_t - dt)
            e.slow_t = max(0.0, e.slow_t - dt)
            e.stun_t = max(0.0, e.stun_t - dt)
            e.cd -= dt
            if e.atk_t >= 0 and e.state != "windup":
                e.atk_t = -1.0
            k = 0.002 ** dt
            e.vx *= k
            e.vy *= k
            e.x += e.vx * dt
            e.y += e.vy * dt
            if e.spawn_t > 0:
                e.spawn_t -= dt
                if not e.flying:
                    resolve_move(L, e)
                continue
            if e.stun_t > 0:
                if not e.flying:
                    resolve_move(L, e)
                continue
            slow = 0.5 if e.slow_t > 0 else 1.0
            dp = dist(e, p)
            alive_p = not p.dead
            e.stuck_t += dt
            if e.stuck_t > 3:
                if e.state == "chase" and not e.d.get("boss") and dp > 140 and math.hypot(e.x - e.sx, e.y - e.sy) < 10:
                    e.x, e.y = self.spawn_point(e.type)
                    e.spawn_t = 0.5
                e.sx, e.sy, e.stuck_t = e.x, e.y, 0.0
            getattr(self, "ai_" + e.type)(e, dt, dp, slow, alive_p)
        es = self.enemies
        for i, a in enumerate(es):
            if a.dead or a.spawn_t > 0:
                continue
            for b in es[i + 1:]:
                if b.dead or b.spawn_t > 0 or a.flying != b.flying:
                    continue
                dx, dy, rr = b.x - a.x, b.y - a.y, a.r + b.r
                d2 = dx * dx + dy * dy
                if 0.01 < d2 < rr * rr:
                    d = math.sqrt(d2)
                    push = (rr - d) * 0.5
                    wa = 0.1 if a.d.get("boss") else 1
                    wb = 0.1 if b.d.get("boss") else 1
                    a.x -= dx / d * push * wa
                    a.y -= dy / d * push * wa
                    b.x += dx / d * push * wb
                    b.y += dy / d * push * wb
            if not a.flying:
                resolve_move(L, a)
            else:
                bd = L.bounds
                a.x = clamp(a.x, bd["x0"] + a.r, bd["x1"] - a.r)
                a.y = clamp(a.y, bd["y0"] + a.r, bd["y1"] - a.r)
            if not p.dead and not a.d.get("boss"):
                dx, dy, rr = p.x - a.x, p.y - a.y, a.r + p.r - 2
                d2 = dx * dx + dy * dy
                if 0.01 < d2 < rr * rr and not p.dash:
                    d = math.sqrt(d2)
                    p.x += dx / d * (rr - d) * 0.35
                    p.y += dy / d * (rr - d) * 0.35
                    a.x -= dx / d * (rr - d) * 0.15
                    a.y -= dy / d * (rr - d) * 0.15

    def ai_grunt(self, e, dt, dp, slow, alive_p):
        d, p = e.d, self.p
        if e.state == "chase":
            gx, gy, via = self.goal_for(e)
            if alive_p and dp < d["range"] + p.r and e.cd <= 0:
                e.state, e.t, e.atk_t = "windup", d["windup"], 0.0
                e.face = math.atan2(p.y - e.y, p.x - e.x)
            elif dp > d["range"] * 0.6 or via:
                self.move_towards(e, gx, gy, e.speed * slow, dt)
            else:
                e.face = math.atan2(p.y - e.y, p.x - e.x)
        elif e.state == "windup":
            e.t -= dt
            e.atk_t = 1 - max(0.0, e.t) / d["windup"]
            if e.t <= 0:
                if alive_p and dist(e, p) < d["range"] + p.r + 14 and ang_diff(math.atan2(p.y - e.y, p.x - e.x), e.face) < 1.2:
                    self.hurt_player(e.dmg, e.x, e.y)
                e.state, e.t, e.atk_t, e.cd = "recover", 0.35, -1.0, d["cd"]
        elif e.state == "recover":
            e.t -= dt
            if e.t <= 0:
                e.state = "chase"

    def ai_bowman(self, e, dt, dp, slow, alive_p):
        d, p = e.d, self.p
        if e.state == "chase":
            e.strafe_t -= dt
            if e.strafe_t <= 0:
                e.strafe *= -1
                e.strafe_t = rand(1.2, 2.8)
            to_p = math.atan2(p.y - e.y, p.x - e.x)
            gx, gy, via = self.goal_for(e)
            if via:
                self.move_towards(e, gx, gy, e.speed * slow, dt)
            elif dp < d["keep"]:
                e.x -= math.cos(to_p) * e.speed * 1.1 * slow * dt
                e.y -= math.sin(to_p) * e.speed * 1.1 * slow * dt
                e.face = to_p
                e.walk += dt * 6
            elif dp > d["range"] - 30:
                self.move_towards(e, p.x, p.y, e.speed * slow, dt)
            else:
                e.x += math.cos(to_p + math.pi / 2) * e.strafe * e.speed * 0.7 * slow * dt
                e.y += math.sin(to_p + math.pi / 2) * e.strafe * e.speed * 0.7 * slow * dt
                e.face = to_p
                e.walk += dt * 5
            if alive_p and e.cd <= 0 and dp < d["range"]:
                e.state, e.t, e.atk_t = "windup", d["windup"], 0.0
        elif e.state == "windup":
            e.t -= dt
            e.atk_t = 1 - max(0.0, e.t) / d["windup"]
            e.face = math.atan2(p.y - e.y, p.x - e.x)
            if e.t <= 0:
                self.enemy_shoot(e, "earrow", e.face, d["proj_speed"], e.dmg, 2.6, 5)
                e.state, e.t, e.atk_t, e.cd = "recover", 0.25, -1.0, d["cd"] * rand(0.9, 1.3)
        elif e.state == "recover":
            e.t -= dt
            if e.t <= 0:
                e.state = "chase"

    def ai_wisp(self, e, dt, dp, slow, alive_p):
        d, p = e.d, self.p
        e.wob += dt * 5
        if e.state == "chase":
            ang = math.atan2(p.y - e.y, p.x - e.x) + math.sin(e.wob) * 0.6
            e.x += math.cos(ang) * e.speed * slow * dt
            e.y += math.sin(ang) * e.speed * slow * dt
            e.face = ang
            e.walk += dt * 8
            if alive_p and dp < d["range"] + p.r and e.cd <= 0:
                e.state, e.t, e.atk_t = "windup", d["windup"], 0.0
        elif e.state == "windup":
            e.t -= dt
            e.atk_t = 1 - max(0.0, e.t) / d["windup"]
            if e.t <= 0:
                if alive_p and dist(e, p) < d["range"] + p.r + 8:
                    self.hurt_player(e.dmg, e.x, e.y)
                e.state, e.t, e.atk_t, e.cd = "recover", 0.7, -1.0, d["cd"]
                e.r_ang = math.atan2(e.y - p.y, e.x - p.x) + rand(-0.6, 0.6)
        elif e.state == "recover":
            e.t -= dt
            e.x += math.cos(e.r_ang) * e.speed * 0.9 * dt
            e.y += math.sin(e.r_ang) * e.speed * 0.9 * dt
            if e.t <= 0:
                e.state = "chase"

    def ai_brute(self, e, dt, dp, slow, alive_p):
        d, p = e.d, self.p
        if e.state == "chase":
            gx, gy, via = self.goal_for(e)
            if alive_p and dp < 120 and e.cd <= 0:
                e.state, e.t, e.atk_t = "windup", d["windup"], 0.0
                e.face = math.atan2(p.y - e.y, p.x - e.x)
                sx, sy = clamp(p.x, e.x - 150, e.x + 150), clamp(p.y, e.y - 150, e.y + 150)
                self.zones.append(NS(kind="slam", team="e", x=sx, y=sy, r=d["slam_r"], t=0.0, delay=d["windup"],
                                     dur=d["windup"] + 0.35, fired=False, dmg=e.dmg, crit=False, tick=0.0, x2=0, y2=0, w=0))
            else:
                self.move_towards(e, gx, gy, e.speed * slow, dt)
        elif e.state == "windup":
            e.t -= dt
            e.atk_t = 1 - max(0.0, e.t) / d["windup"]
            if e.t <= 0:
                e.state, e.t, e.atk_t, e.cd = "recover", 0.9, -1.0, d["cd"]
                self.shake = min(14, self.shake + 4)
        elif e.state == "recover":
            e.t -= dt
            if e.t <= 0:
                e.state = "chase"

    def ai_regent(self, e, dt, dp, slow, alive_p):
        p = self.p
        enr = e.enraged
        if not enr and e.hp < e.max_hp * 0.5:
            e.enraged = enr = True
            self.set_banner("The Regent is enraged!", "", 1.8)
            self.add_fx(type="ring", x=e.x, y=e.y, r=200, dur=0.9, color=(1.0, 0.35, 0.16))
            self.shake = 12
        spd = e.speed * (1.3 if enr else 1.0) * slow
        dmg = e.dmg * (1.2 if enr else 1.0)
        e.summon_cd -= dt
        to_p = math.atan2(p.y - e.y, p.x - e.x)
        rec_cd = 0.9 if enr else 1.5
        if e.state == "idle":
            e.anim = "idle"
            if alive_p and dp > 90:
                self.move_towards(e, p.x, p.y, spd, dt)
            else:
                e.face = to_p
            if alive_p and e.cd <= 0:
                alive = sum(1 for o in self.enemies if not o.dead and o is not e)
                opts = ["slam", "orbs", "charge"]
                if e.summon_cd <= 0 and alive < 4:
                    opts += ["summon", "summon"]
                if dp < 140:
                    opts.append("slam")
                pick = random.choice(opts)
                e.state, e.anim, e.face, e.atk_t, e.hit_done = pick, pick, to_p, 0.0, False
                if pick == "slam":
                    e.t = e.dur = 0.8 if enr else 1.05
                    self.zones.append(NS(kind="slam", team="e", x=p.x, y=p.y, r=108, t=0.0, delay=e.t, dur=e.t + 0.4,
                                         fired=False, dmg=dmg * 1.3, crit=False, tick=0.0, x2=0, y2=0, w=0))
                    if enr:
                        for s in (-1, 1):
                            self.zones.append(NS(kind="slam", team="e", x=p.x + s * 140, y=p.y + 30, r=80, t=0.0,
                                                 delay=e.t + 0.25, dur=e.t + 0.65, fired=False, dmg=dmg, crit=False,
                                                 tick=0.0, x2=0, y2=0, w=0))
                elif pick == "orbs":
                    e.t = e.dur = 0.7
                    e.rings = 2 if enr else 1
                elif pick == "charge":
                    e.t = e.dur = 0.65 if enr else 0.85
                    e.charge_ang, e.charge_phase = to_p, 0
                    self.zones.append(NS(kind="line", team="e", x=e.x, y=e.y, x2=e.x + math.cos(to_p) * 560,
                                         y2=e.y + math.sin(to_p) * 560, w=56, r=0, t=0.0, delay=e.t, dur=e.t,
                                         fired=False, dmg=0, crit=False, tick=0.0))
                else:
                    e.t = e.dur = 0.9
                    e.summon_cd = 9 if enr else 13
        elif e.state == "slam":
            e.t -= dt
            e.atk_t = 1 - max(0.0, e.t) / e.dur
            if e.t <= 0:
                e.state, e.t, e.anim, e.atk_t, e.cd = "recover", 0.8, "idle", -1.0, rec_cd
                self.shake = min(14, self.shake + 6)
        elif e.state == "orbs":
            e.t -= dt
            e.atk_t = 1 - max(0.0, e.t) / e.dur
            if e.t <= 0:
                n = 18 if enr else 12
                off = rand(0, TAU)
                for i in range(n):
                    self.enemy_shoot(e, "orb", off + i / n * TAU, 170, dmg * 0.55, 4.5, 8)
                e.rings -= 1
                if e.rings > 0:
                    e.t = e.dur = 0.55
                    e.atk_t = 0.0
                else:
                    e.state, e.t, e.anim, e.atk_t, e.cd = "recover", 0.7, "idle", -1.0, rec_cd
        elif e.state == "charge":
            if e.charge_phase == 0:
                e.t -= dt
                e.atk_t = 1 - max(0.0, e.t) / e.dur
                if e.t <= 0:
                    e.charge_phase, e.t, e.atk_t = 1, 0.6, -1.0
            else:
                e.t -= dt
                e.x += math.cos(e.charge_ang) * 560 * dt
                e.y += math.sin(e.charge_ang) * 560 * dt
                e.face = e.charge_ang
                e.walk += dt * 20
                if not e.hit_done and alive_p and dist(e, p) < e.r + p.r + 6:
                    if self.hurt_player(dmg * 1.4, e.x, e.y):
                        e.hit_done = True
                        p.vx += math.cos(e.charge_ang) * 260
                        p.vy += math.sin(e.charge_ang) * 260
                b = self.L.bounds
                before = e.x + e.y
                resolve_move(self.L, e)
                if (e.t <= 0 or abs(before - (e.x + e.y)) > 3 or e.x < b["x0"] + 40 or e.x > b["x1"] - 40
                        or e.y < b["y0"] + 40 or e.y > b["y1"] - 40):
                    e.state, e.t, e.anim, e.cd = "recover", 0.9, "idle", rec_cd
                    self.shake = min(14, self.shake + 4)
        elif e.state == "summon":
            e.t -= dt
            e.atk_t = 1 - max(0.0, e.t) / e.dur
            if e.t <= 0:
                n = 3 if enr else 2
                bd = self.L.bounds
                for i in range(n):
                    a = i / n * TAU + rand(0, 1)
                    g = self.make_enemy("grunt", clamp(e.x + math.cos(a) * 80, bd["x0"] + 30, bd["x1"] - 30),
                                        clamp(e.y + math.sin(a) * 80, bd["y0"] + 30, bd["y1"] - 30))
                    g.summoned = True
                    self.add_fx(type="spawn", x=g.x, y=g.y, dur=0.7, color=(1.0, 0.42, 0.16))
                e.state, e.t, e.anim, e.atk_t, e.cd = "recover", 0.6, "idle", -1.0, rec_cd
        elif e.state == "recover":
            e.t -= dt
            if e.t <= 0:
                e.state = "idle"

    # ------------------------------------------------------------ projectiles / zones / pickups
    def splash_damage(self, x, y, r, dmg, crit, skip):
        for e in self.enemies:
            if e.dead or e.spawn_t > 0 or e is skip:
                continue
            if math.hypot(e.x - x, e.y - y) < r + e.r:
                self.hurt_enemy(e, dmg, crit)
        self.add_fx(type="burst", x=x, y=y, r=r, dur=0.35, color=(1.0, 0.6, 0.23))

    def update_projectiles(self, dt):
        p, b = self.p, self.L.bounds
        for q in self.proj[:]:
            q.t += dt
            q.life -= dt
            q.x += q.vx * dt
            q.y += q.vy * dt
            dead = q.life <= 0
            if q.x < b["x0"] - 40 or q.x > b["x1"] + 40 or q.y < b["y0"] - 40 or q.y > b["y1"] + 40:
                dead = True
            if not dead and q.team == "p":
                for e in self.enemies:
                    if e.dead or e.spawn_t > 0 or e.id in q.hit:
                        continue
                    if math.hypot(e.x - q.x, e.y - q.y) < e.r + q.r:
                        q.hit.add(e.id)
                        self.hurt_enemy(e, q.dmg, q.crit, math.cos(q.ang), math.sin(q.ang), 40)
                        if q.splash:
                            self.splash_damage(q.x, q.y, q.splash, q.dmg * 0.6, False, e)
                        q.pierce -= 1
                        if q.pierce < 0:
                            dead = True
                            break
            elif not dead and not p.dead:
                if math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r:
                    self.hurt_player(q.dmg, q.x - q.vx, q.y - q.vy)
                    dead = True
            if dead:
                if q.team == "p" and q.splash and not q.hit:
                    self.splash_damage(q.x, q.y, q.splash, q.dmg * 0.6, False, None)
                self.proj.remove(q)

    def update_zones(self, dt):
        p = self.p
        for z in self.zones[:]:
            z.t += dt
            if z.kind == "rain":
                z.tick -= dt
                if z.tick <= 0 and z.t < z.dur:
                    z.tick = 0.25
                    for e in self.in_circle(z.x, z.y, z.r):
                        d, crit = self.player_dmg()
                        self.hurt_enemy(e, d * z.dmg, crit)
            elif z.kind in ("meteor", "slam") and not z.fired and z.t >= z.delay:
                z.fired = True
                if z.team == "p":
                    for e in self.in_circle(z.x, z.y, z.r):
                        a = math.atan2(e.y - z.y, e.x - z.x)
                        self.hurt_enemy(e, z.dmg, z.crit, math.cos(a), math.sin(a), 160, 0.4)
                    self.shake = min(14, self.shake + 7)
                else:
                    if not p.dead and math.hypot(p.x - z.x, p.y - z.y) < z.r + p.r * 0.4:
                        self.hurt_player(z.dmg, z.x, z.y)
                    self.shake = min(14, self.shake + 5)
                self.add_fx(type="burst", x=z.x, y=z.y, r=z.r, dur=0.5, color=(1.0, 0.54, 0.23) if z.team == "p" else (0.78, 0.63, 0.44))
            if z.t >= z.dur:
                self.zones.remove(z)

    def update_pickups(self, dt):
        p = self.p
        for pk in self.pickups[:]:
            pk.t += dt
            if pk.vx or pk.vy:
                pk.x += pk.vx * dt
                pk.y += pk.vy * dt
                k = 0.01 ** dt
                pk.vx *= k
                pk.vy *= k
            if p.dead:
                continue
            d = math.hypot(p.x - pk.x, p.y - pk.y)
            mag = 55 if pk.kind == "item" else 95
            if pk.t > 0.35 and (pk.magnet or d < mag):
                sp = 700 if pk.magnet else 260
                pk.x += (p.x - pk.x) / (d or 1) * sp * dt
                pk.y += (p.y - pk.y) / (d or 1) * sp * dt
            if d < 20 and pk.t > 0.2:
                self.collect(pk)
                self.pickups.remove(pk)


class _Pt:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x, self.y = x, y


def vault_waves(floor, boss):
    Rn = Rng(floor * 977 + 13)
    n = 2 if boss else min(4, 2 + floor // 3)
    budget = 6 + floor * 1.4
    costs = {"grunt": 1, "bowman": 1.3, "wisp": 0.8, "brute": 4}
    weights = {"grunt": 5, "bowman": 3, "wisp": 3, "brute": 1 + floor * 0.15}
    waves = []
    for w in range(n):
        counts = {}
        left = budget * (0.7 + w * 0.2) / (1.3 if boss else 1)
        guard = 0
        while left > 0.8 and guard < 60:
            guard += 1
            keys = list(weights)
            t = Rn() * sum(weights.values())
            pick = keys[0]
            for k in keys:
                t -= weights[k]
                if t <= 0:
                    pick = k
                    break
            if costs[pick] > left and pick == "brute":
                continue
            counts[pick] = counts.get(pick, 0) + 1
            left -= costs[pick]
        waves.append([(t, min(c, 14)) for t, c in counts.items()])
    if boss:
        waves.append([("regent", 1)])
    return waves
