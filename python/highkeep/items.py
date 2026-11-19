"""Items, hero stat derivation, power score, forge/reforge, sets, research, expeditions."""
import math
import random
import time
import uuid

from . import data as D


def uid():
    return uuid.uuid4().hex[:10]


def rarity_of(rid):
    return next((r for r in D.RARITIES if r["id"] == rid), D.RARITIES[0])


def rarity_index(it):
    return next(i for i, r in enumerate(D.RARITIES) if r["id"] == it["rarity"])


def _pick(seq, R):
    return seq[int(R() * len(seq))]


def roll_affix(key, ilvl, R=random.random):
    a = D.AFFIXES[key]
    scale = 1 + 0.3 * (ilvl - 1)
    v = a["base"] * scale * (0.8 + R() * 0.4)
    return {"k": key, "v": round(v, a["dec"]) if a["dec"] else int(round(v))}


COMMON_ADJ = ["Worn", "Plain", "Sturdy", "Notched", "Rough", "Road-worn"]


def roll_item(R, slot, ilvl, rarity, cls):
    rar = rarity_of(rarity)
    n = rar["affixes"]
    if slot == "charm" and n < 1:
        n = 1
    pool = [k for k in D.AFFIX_KEYS if not (slot == "weapon" and k == "armor")]
    keys = []
    while len(keys) < n:
        k = _pick(pool, R)
        if k not in keys:
            keys.append(k)
    aff = [roll_affix(k, ilvl, R) for k in keys]
    base = 0
    if slot == "weapon":
        kind = _pick(D.CLASSES[cls]["weapon_kinds"], R)
        base = round((3 + 2.3 * ilvl) * (0.9 + R() * 0.2) * (1.15 if rarity == "heroic" else 1))
    elif slot == "armor":
        kind = _pick(D.ARMOR_NAMES, R)
        base = round((3 + 3.2 * ilvl) * (0.9 + R() * 0.2) * (1.15 if rarity == "heroic" else 1))
    else:
        kind = _pick(D.CHARM_NAMES, R)
    if rarity == "common":
        name = f"{_pick(COMMON_ADJ, R)} {kind}"
    elif rarity == "magic":
        name = f"{D.AFFIXES[aff[0]['k']]['name'][0]} {kind}"
    elif rarity == "rare":
        name = f"{D.AFFIXES[aff[0]['k']]['name'][0]} {kind} {D.AFFIXES[aff[1]['k']]['name'][1]}"
    else:
        name = f"{_pick(D.HEROIC_TITLES, R)}'s {kind}"
    chance = {"common": 0, "magic": 0.3, "rare": 0.85, "heroic": 1}[rarity]
    sid = None
    if R() < chance:
        sid = max(0, min(len(D.SETS) - 1, round(ilvl - 1 + (-1 if R() < 0.3 else 0))))
    return {"id": uid(), "slot": slot, "rarity": rarity, "name": name, "kind": kind, "ilvl": ilvl, "base": base,
            "aff": aff, "cls": cls if slot == "weapon" else None, "set": sid, "plus": 0, "fp": 0, "lock": False}


def roll_rarity(R, bonus=0.0):
    w = [r["weight"] * (max(0.2, 1 - bonus) if i == 0 else 1 + bonus * i * 0.8) for i, r in enumerate(D.RARITIES)]
    t = R() * sum(w)
    for i, x in enumerate(w):
        t -= x
        if t <= 0:
            return D.RARITIES[i]["id"]
    return "common"


def starting_gear(cls):
    return {"weapon": roll_item(random.random, "weapon", 1, "common", cls),
            "armor": roll_item(random.random, "armor", 1, "common", cls), "charm": None}


def forge_mul(it):
    return 1 + 0.1 * it.get("plus", 0)


def item_sell_value(it):
    return max(3, round(7 * it["ilvl"] * rarity_of(it["rarity"])["sell"]))


def item_totals(it):
    t = dict(hp=0, mp=0, damage=0, armor=0, crit=0, speed=0, regen=0)
    if not it:
        return t
    m = forge_mul(it)
    if it["slot"] == "weapon":
        t["damage"] += it["base"] * m
    if it["slot"] == "armor":
        t["armor"] += it["base"] * m
    for a in it["aff"]:
        t[a["k"]] += a["v"] * m
    return t


def describe_affix(a, mult=1.0):
    d = D.AFFIXES[a["k"]]
    v = a["v"] * mult
    v = round(v, d["dec"]) if d["dec"] else int(round(v))
    return d["fmt"].format(v)


# ---------- sets / research / advancement ----------
def set_counts(eq):
    c = {}
    for sl in D.SLOTS:
        it = eq.get(sl)
        if it and it.get("set") is not None:
            c[it["set"]] = c.get(it["set"], 0) + 1
    return c


def set_bonus_totals(eq):
    out = {}
    for sid, n in set_counts(eq).items():
        t = 1 + 0.35 * sid
        for need in (2, 3):
            if n >= need:
                for k, v in D.set_bonus(need, t).items():
                    out[k] = out.get(k, 0) + v
    return out


def research_level(xp):
    return min(D.RESEARCH_MAX, int(math.sqrt((xp or 0) / 25)))


def research_need(lv):
    return lv * lv * 25


def research_totals(save):
    out = {"armor": 0, "damage": 0, "hp": 0}
    for xp in save.get("research", {}).values():
        L = research_level(xp)
        out["armor"] += 2 * L
        out["damage"] += L
        out["hp"] += 6 * L
    return out


def study_value(it):
    return round(10 * rarity_of(it["rarity"])["sell"] * it["ilvl"]) + it.get("plus", 0) * 6


def advance_totals(save):
    t = dict(hp=0, mp=0, damage=0, armor=0, crit=0, speed=0, regen=0, dmgPct=0, hpPct=0, cdr=0, goldPct=0, xpPct=0)
    for br in D.TRAITS:
        for n in br["nodes"]:
            t[n["stat"]] += n["per"] * save.get("traits", {}).get(n["id"], 0)
    sl = save.get("sigil", 0)
    for k, v in D.SIGIL_PER.items():
        t[k] += v * sl
    for lv, b in D.SIGIL_BOONS.items():
        if sl >= lv:
            t["goldPct"] += b.get("goldPct", 0)
            t["xpPct"] += b.get("xpPct", 0)
    for aid in save.get("art_slots", []):
        a = next((x for x in D.ARTIFACTS if x["id"] == aid), None)
        own = aid and save.get("artifacts", {}).get(aid)
        if a and own:
            t[a["stat"]] += D.art_value(a, own["lv"])
    return t


def trait_unlocked(save, branch, idx):
    spent = sum(save.get("traits", {}).get(n["id"], 0) for n in branch["nodes"])
    return spent >= idx * 3


def hero_stats(save, equip_override=None):
    c = D.CLASSES[save["cls"]]
    L = save["level"]
    eq = equip_override or save["equip"]
    g = dict(hp=0, mp=0, damage=0, armor=0, crit=0, speed=0, regen=0)
    for sl in D.SLOTS:
        for k, v in item_totals(eq.get(sl)).items():
            g[k] += v
    for k, v in set_bonus_totals(eq).items():
        g[k] += v
    for k, v in research_totals(save).items():
        g[k] += v
    x = advance_totals(save)
    for k in ("hp", "mp", "damage", "armor", "crit", "regen", "speed"):
        g[k] += x[k]
    s = {
        "max_hp": round((c["hp"] + D.PER_LEVEL["hp"] * (L - 1) + g["hp"]) * (1 + x["hpPct"] / 100)),
        "max_mp": round(c["mp"] + D.PER_LEVEL["mp"] * (L - 1) + g["mp"]),
        "damage": round((c["damage"] + D.PER_LEVEL["damage"] * (L - 1) + g["damage"]) * (1 + x["dmgPct"] / 100), 1),
        "armor": round(g["armor"]),
        "crit": round(5 + g["crit"], 1),
        "speed": round(c["speed"] * (1 + g["speed"] / 100), 1),
        "speed_pct": g["speed"],
        "regen": round(c["mana_regen"] + g["regen"], 2),
        "cdr": x["cdr"], "gold_pct": x["goldPct"], "xp_pct": x["xpPct"],
    }
    s["power"] = power_of(s)
    return s


def power_of(s):
    return round(s["max_hp"] * 0.2 + s["max_mp"] * 0.1 + s["damage"] * 3.2 + s["armor"] * 2 + s["crit"] * 2
                 + s["speed_pct"] * 0.8 + s["regen"] * 3 - 8)


def armor_mul(armor):
    return 120 / (120 + armor)


def add_xp(save, amount):
    gained = 0
    if save["level"] >= D.MAX_LEVEL:
        return 0
    save["xp"] += amount
    while save["level"] < D.MAX_LEVEL and save["xp"] >= D.xp_to_next(save["level"]):
        save["xp"] -= D.xp_to_next(save["level"])
        save["level"] += 1
        gained += 1
    if save["level"] >= D.MAX_LEVEL:
        save["xp"] = 0
    return gained


# ---------- forge / reforge / dismantle ----------
def forge_info(it):
    plus = it.get("plus", 0)
    if plus >= D.MAX_PLUS:
        return None
    guaranteed = it.get("fp", 0) >= 100
    return {"chance": 1.0 if guaranteed else D.FORGE_CHANCE[plus], "guaranteed": guaranteed,
            "gold": round(25 * (plus + 1) * (1 + it["ilvl"] * 0.5)),
            "steel": 1 + plus + (1 if rarity_index(it) >= 2 else 0)}


def forge_attempt(it, R=random.random):
    info = forge_info(it)
    if info is None:
        return False
    if R() < info["chance"]:
        it["plus"] = it.get("plus", 0) + 1
        it["fp"] = 0
        return True
    it["fp"] = min(100, it.get("fp", 0) + 20 + int(R() * 10))
    return False


def reforge_cost(it):
    ri = rarity_index(it)
    return {"gold": 40 * it["ilvl"] + 20 * ri * it["ilvl"], "steel": 2 + ri}


def can_reforge(it):
    return rarity_index(it) >= 1 and len(it["aff"]) > 0


def reforge_affix(it, idx, R=random.random):
    have = [a["k"] for a in it["aff"]]
    pool = [k for k in D.AFFIX_KEYS if k not in have and not (it["slot"] == "weapon" and k == "armor")]
    it["aff"][idx] = roll_affix(_pick(pool, R), it["ilvl"], R)


def dismantle_value(it):
    return max(1, round([1, 2, 4, 8][rarity_index(it)] * (1 + it["ilvl"] * 0.35)) + it.get("plus", 0))


# ---------- artifacts & expeditions ----------
def grant_artifact(save, R=random.random):
    a = _pick(D.ARTIFACTS, R)
    arts = save.setdefault("artifacts", {})
    own = arts.get(a["id"])
    if not own:
        arts[a["id"]] = {"lv": 1}
        return f"New artifact: {a['name']}"
    if own["lv"] < D.ART_MAX:
        own["lv"] += 1
        return f"{a['name']} rose to level {own['lv']}"
    save["steel"] = save.get("steel", 0) + 4
    return f"{a['name']} is maxed (+4 steel)"


def new_scout(R=random.random):
    w = [50, 32, 14, 4]
    t = R() * 100
    rar = 0
    for i, x in enumerate(w):
        t -= x
        if t <= 0:
            rar = i
            break
    return {"id": uid(), "name": _pick(D.SCOUT_NAMES, R), "rar": rar}


def scout_bonus(scouts):
    return sum(0.05 * (c["rar"] + 1) for c in scouts)


def expedition_odds(route, scouts):
    return min(0.97, route["art"] + scout_bonus(scouts) - 0.05 * len(scouts))


def resolve_expedition(save, ex, R=random.random):
    route = next(r for r in D.ROUTES if r["id"] == ex["route"])
    crew = [c for c in save["scouts"] if c["id"] in ex["scouts"]]
    steel = round(route["steel"][0] + R() * (route["steel"][1] - route["steel"][0]))
    gold = round(route["gold"][0] + R() * (route["gold"][1] - route["gold"][0]))
    save["steel"] = save.get("steel", 0) + steel
    save["gold"] += gold
    found = grant_artifact(save, R) if R() < expedition_odds(route, crew) else None
    return {"steel": steel, "gold": gold, "found": found, "route": route["name"]}


def now_s():
    return time.time()
