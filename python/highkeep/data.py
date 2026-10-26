"""Static game data: classes, skills, stages, enemies, rarities, affixes, progression systems."""
import math

WORLD_W = 1600
WORLD_H = 1150
MAX_LEVEL = 30
MAX_POTIONS = 5
POTION_PRICE = 25
BAG_SIZE = 24
BAG_MAX = 60
BAG_EXPAND = 6
MAX_PLUS = 10
RESEARCH_MAX = 10


def bag_expand_cost(size):
    return 120 + (size - BAG_SIZE) * 25


def xp_to_next(level):
    return round(30 * level ** 1.55 + 30)


SETS = [
    {"id": 0, "name": "Millbrook Militia"}, {"id": 1, "name": "Hollow Stalker"}, {"id": 2, "name": "Toll Warden"},
    {"id": 3, "name": "Marsh Wraith"}, {"id": 4, "name": "Highkeep Guard"}, {"id": 5, "name": "Throne Breaker"},
]


def set_bonus(pieces, tier):
    """Totals for wearing 2 / 3 pieces of a set; tier t = 1 + 0.35 * set id."""
    if pieces == 2:
        return {"armor": round(6 * tier), "hp": round(18 * tier)}
    return {"damage": round(3 * tier * 10) / 10, "crit": 3}


CLASSES = {
    "knight": {
        "id": "knight", "name": "Knight", "hp": 150, "mp": 60, "speed": 165, "damage": 16,
        "blurb": "Armoured vanguard. Cuts a wide arc and shrugs off blows.",
        "weapon_kinds": ["Sword", "Longsword", "Arming Sword", "Falchion"],
        "attack": {"type": "melee", "range": 64, "arc": 130, "cd": 0.46, "mult": 1.0, "dur": 0.28},
        "mana_regen": 2.5,
        "skills": [
            {"id": "rush", "name": "Shield Rush", "unlock": 1, "cost": 14, "cd": 6, "desc": "Charge forward, hurling foes aside."},
            {"id": "whirl", "name": "Whirlwind", "unlock": 3, "cost": 26, "cd": 10, "desc": "Spin for 1.5s, striking everything near."},
            {"id": "rally", "name": "Rally Cry", "unlock": 5, "cost": 30, "cd": 18, "desc": "Heal 25% and deal +50% damage for 6s."},
        ],
    },
    "ranger": {
        "id": "ranger", "name": "Ranger", "hp": 115, "mp": 70, "speed": 188, "damage": 12,
        "blurb": "Swift archer. Keeps distance and fills the air with arrows.",
        "weapon_kinds": ["Longbow", "Shortbow", "Yew Bow", "Hornbow"],
        "attack": {"type": "arrow", "range": 560, "cd": 0.36, "mult": 1.0, "dur": 0.22, "speed": 560},
        "mana_regen": 2.8,
        "skills": [
            {"id": "volley", "name": "Volley", "unlock": 1, "cost": 14, "cd": 5, "desc": "Loose seven arrows in a fan."},
            {"id": "tumble", "name": "Tumble", "unlock": 3, "cost": 8, "cd": 4, "desc": "Roll away, untouchable while rolling."},
            {"id": "rain", "name": "Arrow Rain", "unlock": 5, "cost": 32, "cd": 14, "desc": "Darken an area with arrows for 3s."},
        ],
    },
    "mage": {
        "id": "mage", "name": "Mage", "hp": 95, "mp": 130, "speed": 172, "damage": 15,
        "blurb": "Glass cannon. Firebolts that splash, spells that reshape the fight.",
        "weapon_kinds": ["Staff", "Rod", "Wand", "Scepter"],
        "attack": {"type": "bolt", "range": 520, "cd": 0.58, "mult": 1.1, "dur": 0.3, "speed": 400, "splash": 54},
        "mana_regen": 4,
        "skills": [
            {"id": "nova", "name": "Frost Nova", "unlock": 1, "cost": 20, "cd": 7, "desc": "Burst of frost that damages and slows."},
            {"id": "blink", "name": "Blink", "unlock": 3, "cost": 12, "cd": 4, "desc": "Teleport a short distance."},
            {"id": "meteor", "name": "Meteor", "unlock": 5, "cost": 40, "cd": 12, "desc": "Call a meteor; lands after a short delay."},
        ],
    },
}
PER_LEVEL = {"hp": 14, "mp": 6, "damage": 1.8}

RARITIES = [
    {"id": "common", "name": "Common", "color": (0.80, 0.78, 0.70), "affixes": 0, "sell": 1.0, "weight": 58},
    {"id": "magic", "name": "Magic", "color": (0.37, 0.67, 1.0), "affixes": 1, "sell": 2.2, "weight": 29},
    {"id": "rare", "name": "Rare", "color": (0.95, 0.82, 0.29), "affixes": 2, "sell": 4.5, "weight": 11},
    {"id": "heroic", "name": "Heroic", "color": (1.0, 0.48, 0.18), "affixes": 4, "sell": 9.0, "weight": 2},
]

AFFIXES = {
    "hp": {"label": "Health", "base": 12, "fmt": "+{} Health", "name": ("Hale", "of Vigor"), "dec": 0},
    "mp": {"label": "Mana", "base": 8, "fmt": "+{} Mana", "name": ("Lucid", "of the Well"), "dec": 0},
    "damage": {"label": "Damage", "base": 1.6, "fmt": "+{} Damage", "name": ("Keen", "of Edges"), "dec": 1},
    "armor": {"label": "Armor", "base": 3, "fmt": "+{} Armor", "name": ("Warded", "of Bulwarks"), "dec": 0},
    "crit": {"label": "Crit", "base": 1.6, "fmt": "+{}% Crit", "name": ("Sharp", "of Precision"), "dec": 1},
    "speed": {"label": "Speed", "base": 2, "fmt": "+{}% Speed", "name": ("Fleet", "of Wind"), "dec": 1},
    "regen": {"label": "Mana Regen", "base": 0.45, "fmt": "+{} Mana/s", "name": ("Flowing", "of Tides"), "dec": 2},
}
AFFIX_KEYS = list(AFFIXES)
SLOTS = ["weapon", "armor", "charm"]
SLOT_LABEL = {"weapon": "Weapon", "armor": "Armor", "charm": "Charm"}
ARMOR_NAMES = ["Jerkin", "Hauberk", "Brigandine", "Cuirass", "Gambeson", "Mantle"]
CHARM_NAMES = ["Charm", "Talisman", "Amulet", "Token", "Sigil", "Ember Stone"]
HEROIC_TITLES = ["Dawnwarden", "Kingsmark", "Ashbreaker", "Hollowlight", "Ember-Sworn", "Regent's Bane"]

ENEMIES = {
    "grunt": {"id": "grunt", "name": "Ash Grunt", "hp": 44, "dmg": 8, "speed": 74, "r": 13, "xp": 7, "gold": (2, 5),
              "windup": 0.45, "cd": 1.2, "range": 34, "drop": 0.07},
    "bowman": {"id": "bowman", "name": "Ash Bowman", "hp": 30, "dmg": 7, "speed": 66, "r": 12, "xp": 9, "gold": (3, 6),
               "windup": 0.5, "cd": 1.9, "range": 270, "keep": 190, "drop": 0.09, "proj_speed": 270},
    "wisp": {"id": "wisp", "name": "Ember Wisp", "hp": 17, "dmg": 6, "speed": 128, "r": 10, "xp": 5, "gold": (1, 3),
             "windup": 0.25, "cd": 1.0, "range": 24, "drop": 0.04, "flying": True},
    "brute": {"id": "brute", "name": "Brute", "hp": 170, "dmg": 22, "speed": 44, "r": 21, "xp": 36, "gold": (10, 18),
              "windup": 0.95, "cd": 2.2, "range": 56, "slam_r": 78, "drop": 0.38},
    "regent": {"id": "regent", "name": "The Ashen Regent", "hp": 1500, "dmg": 26, "speed": 62, "r": 27, "xp": 420,
               "gold": (140, 180), "boss": True, "drop": 1},
}


def _rep(t, n):
    return (t, n)


STAGES = [
    {"id": 1, "name": "Millbrook Fields", "theme": "fields", "power": 105, "node": (0.10, 0.80),
     "blurb": "The road begins among thatched cottages and hay-fields. Raiders have already burned the mill.",
     "waves": [[_rep("grunt", 5)], [_rep("grunt", 4), _rep("bowman", 2)], [_rep("grunt", 5), _rep("bowman", 2), _rep("wisp", 2)]]},
    {"id": 2, "name": "Hollow Wood", "theme": "wood", "power": 150, "node": (0.26, 0.55),
     "blurb": "Dense forest, thick with log piles and ambush. Bowmen shoot from the shadows.",
     "waves": [[_rep("grunt", 5), _rep("bowman", 2)], [_rep("wisp", 5), _rep("bowman", 3)], [_rep("grunt", 5), _rep("brute", 1), _rep("bowman", 2)]]},
    {"id": 3, "name": "Old Toll Bridge", "theme": "bridge", "power": 200, "node": (0.42, 0.74),
     "blurb": "The warband holds the only crossing. Fight through the toll gate and over the river.",
     "waves": [[_rep("grunt", 6), _rep("bowman", 3)], [_rep("brute", 1), _rep("grunt", 4), _rep("wisp", 3)], [_rep("brute", 2), _rep("bowman", 3), _rep("grunt", 4)]]},
    {"id": 4, "name": "Ember Marsh", "theme": "marsh", "power": 255, "node": (0.58, 0.46),
     "blurb": "Murky pools, dead trees and drowned ruins. Wisps drift in from the fog.",
     "waves": [[_rep("wisp", 7), _rep("grunt", 4)], [_rep("brute", 2), _rep("bowman", 4), _rep("wisp", 3)], [_rep("grunt", 7), _rep("brute", 2), _rep("bowman", 3)]]},
    {"id": 5, "name": "Highkeep Gate", "theme": "gate", "power": 315, "node": (0.74, 0.68),
     "blurb": "The great gate of Highkeep, banners hung with ash. Only the courtyard stands between you and the hall.",
     "waves": [[_rep("grunt", 7), _rep("bowman", 4)], [_rep("brute", 2), _rep("wisp", 5), _rep("bowman", 3)], [_rep("brute", 3), _rep("grunt", 6), _rep("bowman", 4)]]},
    {"id": 6, "name": "The Throne Hall", "theme": "hall", "power": 385, "node": (0.90, 0.36),
     "blurb": "The heir is bound before the throne. The Ashen Regent waits.",
     "waves": [[_rep("grunt", 6), _rep("bowman", 4)], [_rep("brute", 2), _rep("wisp", 5), _rep("grunt", 4)], [_rep("regent", 1)]]},
]
VAULT = {"id": "vault", "name": "The Deep Vaults", "theme": "vault", "power": 400, "node": (0.95, 0.80),
         "blurb": "Endless vaults beneath Highkeep. A warlord waits every fifth floor."}


def stage_by_id(sid):
    return VAULT if sid == "vault" else STAGES[sid - 1]


ENDING_TEXT = ("The Regent falls, and the heir is freed from the throne-chains. The road is open again from "
               "Millbrook to Highkeep. Beneath the hall, a stair leads down to the Deep Vaults...")
INTRO_TEXT = ("The king rode east and never returned. The Ashen Warband holds the road from Millbrook to Highkeep, "
              "and the heir is held in the Throne Hall. Fight down the road and free the heir.")

# ---- advancement ----
SKILL_MAX = 10


def skill_mul(lv):
    return 1 + 0.1 * (lv - 1)


def skill_cd_mul(lv):
    return 1 - 0.03 * (lv - 1)


def skill_up_cost(lv):
    return {"gold": round(70 * lv ** 1.5), "steel": lv}


TRAIT_MAX = 5
TRAITS = [
    {"id": "might", "name": "Path of Might", "nodes": [
        {"id": "m1", "name": "Honed Edge", "stat": "dmgPct", "per": 2, "text": "+2% damage"},
        {"id": "m2", "name": "Killing Eye", "stat": "crit", "per": 1.5, "text": "+1.5% crit"},
        {"id": "m3", "name": "Heavy Hand", "stat": "damage", "per": 1.2, "text": "+1.2 damage"},
        {"id": "m4", "name": "Executioner", "stat": "dmgPct", "per": 2.5, "text": "+2.5% damage"}]},
    {"id": "guard", "name": "Path of the Warden", "nodes": [
        {"id": "g1", "name": "Thick Skin", "stat": "armor", "per": 2, "text": "+2 armor"},
        {"id": "g2", "name": "Vital Spark", "stat": "hpPct", "per": 2, "text": "+2% health"},
        {"id": "g3", "name": "Iron Will", "stat": "hp", "per": 12, "text": "+12 health"},
        {"id": "g4", "name": "Bulwark", "stat": "armor", "per": 3, "text": "+3 armor"}]},
    {"id": "swift", "name": "Path of the Road", "nodes": [
        {"id": "s1", "name": "Fleet Foot", "stat": "speed", "per": 1.5, "text": "+1.5% speed"},
        {"id": "s2", "name": "Deep Well", "stat": "mp", "per": 8, "text": "+8 mana"},
        {"id": "s3", "name": "Flowing Mana", "stat": "regen", "per": 0.3, "text": "+0.3 mana/s"},
        {"id": "s4", "name": "Quick Study", "stat": "cdr", "per": 2, "text": "-2% cooldowns"}]},
]


def trait_points(save):
    return max(0, save["level"] - 1)


def trait_spent(save):
    return sum(save.get("traits", {}).values())


def trait_reset_cost(save):
    return 100 + save["level"] * 20


SIGIL_MAX = 10
SIGIL_PER = {"dmgPct": 1.5, "hpPct": 2, "armor": 1}
SIGIL_BOONS = {3: {"goldPct": 5, "text": "+5% gold"}, 6: {"xpPct": 8, "text": "+8% experience"},
               9: {"goldPct": 10, "xpPct": 5, "text": "+10% gold, +5% experience"}}


def sigil_cost(lv):
    return {"gold": round(150 * (lv + 1) ** 1.5), "steel": lv + 2}


ART_MAX = 10
ART_SLOTS = 3
ARTIFACTS = [
    {"id": "compass", "name": "Ember Compass", "stat": "speed", "val": 4, "text": "% speed"},
    {"id": "seal", "name": "Kingsmark Seal", "stat": "hpPct", "val": 4, "text": "% health"},
    {"id": "ring", "name": "Ashen Ring", "stat": "armor", "val": 6, "text": " armor"},
    {"id": "chalice", "name": "Hollow Chalice", "stat": "regen", "val": 0.8, "text": " mana/s"},
    {"id": "die", "name": "Tollkeeper's Die", "stat": "crit", "val": 3, "text": "% crit"},
    {"id": "horn", "name": "Marsh Horn", "stat": "dmgPct", "val": 3, "text": "% damage"},
    {"id": "lantern", "name": "Wraith Lantern", "stat": "mp", "val": 20, "text": " mana"},
    {"id": "crown", "name": "Broken Crown", "stat": "cdr", "val": 4, "text": "% faster cooldowns"},
]


def art_value(a, lv):
    return round(a["val"] * (1 + 0.3 * (lv - 1)), 1)


def art_up_cost(lv):
    return {"gold": round(90 * lv ** 1.4), "steel": 2 + lv}


EXP_UNLOCK_STAGE = 3
EXP_SLOTS = 2
SCOUT_MAX = 5


def scout_cost(n):
    return 150 + n * 120


ROUTES = [
    {"id": "patrol", "name": "Roadside Patrol", "mins": 2, "scouts": 1, "art": 0.12, "steel": (2, 4), "gold": (40, 90), "blurb": "A short sweep of the verge."},
    {"id": "cairn", "name": "Ruined Cairn", "mins": 20, "scouts": 2, "art": 0.4, "steel": (5, 9), "gold": (120, 220), "blurb": "Old stones, older things beneath them."},
    {"id": "barrow", "name": "Deep Barrow", "mins": 90, "scouts": 3, "art": 0.85, "steel": (10, 18), "gold": (260, 450), "blurb": "A king's barrow. Few come back with empty hands."},
]
SCOUT_NAMES = ["Wren", "Tamsin", "Corvin", "Ilse", "Bram", "Odalys", "Hob", "Sable", "Rook", "Maud", "Fenn", "Lark"]
FORGE_CHANCE = [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]
