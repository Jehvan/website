"""JSON persistence in the user's data directory. Every access is guarded; the game runs without storage."""
import json
import os
import sys

from .items import starting_gear

VERSION = 1


def save_dir():
    base = os.environ.get("XDG_DATA_HOME") or (
        os.path.join(os.environ.get("APPDATA", ""), "") if sys.platform.startswith("win")
        else os.path.expanduser("~/Library/Application Support") if sys.platform == "darwin"
        else os.path.expanduser("~/.local/share"))
    return os.path.join(base, "highkeep-road")


def _path(name):
    return os.path.join(save_dir(), name)


def new_save(cls):
    return {"v": VERSION, "cls": cls, "level": 1, "xp": 0, "gold": 60, "potions": 3,
            "equip": starting_gear(cls), "bag": [], "cleared": 0, "vault_best": 0, "story": False,
            "steel": 6, "research": {}, "bag_size": 24, "skill_lv": [1, 1, 1], "traits": {}, "sigil": 0,
            "artifacts": {}, "art_slots": [None, None, None],
            "scouts": [{"id": "scout0", "name": "Wren", "rar": 1}], "expeds": []}


def _migrate(s):
    s.setdefault("steel", 0); s.setdefault("research", {}); s.setdefault("bag_size", 24)
    s.setdefault("skill_lv", [1, 1, 1]); s.setdefault("traits", {}); s.setdefault("sigil", 0)
    s.setdefault("artifacts", {}); s.setdefault("art_slots", [None, None, None])
    s.setdefault("scouts", [{"id": "scout0", "name": "Wren", "rar": 1}]); s.setdefault("expeds", [])
    return s


def load_save():
    try:
        with open(_path("save.json"), "r", encoding="utf-8") as f:
            s = json.load(f)
        if not isinstance(s, dict) or s.get("v") != VERSION or "cls" not in s:
            return None
        return _migrate(s)
    except Exception:
        return None


def write_save(save):
    try:
        os.makedirs(save_dir(), exist_ok=True)
        tmp = _path("save.json.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(save, f)
        os.replace(tmp, _path("save.json"))
        return True
    except Exception:
        return False


def clear_save():
    try:
        os.remove(_path("save.json"))
    except Exception:
        pass


def load_settings():
    try:
        with open(_path("settings.json"), "r", encoding="utf-8") as f:
            return {"quality": "high", **json.load(f)}
    except Exception:
        return {"quality": "high"}


def write_settings(s):
    try:
        os.makedirs(save_dir(), exist_ok=True)
        with open(_path("settings.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
    except Exception:
        pass
