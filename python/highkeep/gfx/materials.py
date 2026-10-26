"""Named surface styles (texture + tint + specular) applied to built geometry."""
from panda3d.core import Material, TextureStage, Vec4

from . import textures as T

_mats = {}


def _spec(shine, spec):
    m = Material()
    m.setSpecular((spec, spec, spec, 1))
    m.setShininess(shine)
    return m


STYLES = {
    # name: (texture factory, tint, specular strength, shininess)
    "steel": (lambda: T.metal("#8f969f", 3, 50), (1, 1, 1, 1), 0.9, 60),
    "steel_dark": (lambda: T.metal("#4b4f57", 4, 70), (1, 1, 1, 1), 0.7, 40),
    "iron": (lambda: T.metal("#55524f", 5, 60, rust=0.6), (1, 1, 1, 1), 0.35, 25),
    "black_plate": (lambda: T.metal("#26242b", 6, 60), (1, 1, 1, 1), 0.8, 50),
    "gold": (lambda: T.metal("#b08a30", 7, 10, rivets=False), (1, 1, 1, 1), 0.9, 70),
    "brass": (lambda: T.metal("#8c6a2e", 8, 10, rivets=False, rust=0.3), (1, 1, 1, 1), 0.5, 40),
    "blade": (lambda: T.metal("#b9c0c8", 9, 25, rivets=False), (1, 1, 1, 1), 1.0, 90),
    "chain": (lambda: T.chain("#7d838c"), (1, 1, 1, 1), 0.6, 30),
    "leather": (lambda: T.leather("#6a4426", 2), (1, 1, 1, 1), 0.12, 8),
    "leather_dark": (lambda: T.leather("#3a281a", 3), (1, 1, 1, 1), 0.1, 8),
    "cloth_blue": (lambda: T.cloth("#27406e", 1), (1, 1, 1, 1), 0.0, 1),
    "cloth_red": (lambda: T.cloth("#7a1f26", 2), (1, 1, 1, 1), 0.0, 1),
    "cloth_green": (lambda: T.cloth("#3c4f30", 3), (1, 1, 1, 1), 0.0, 1),
    "cloth_purple": (lambda: T.cloth("#3a2a5c", 4), (1, 1, 1, 1), 0.0, 1),
    "cloth_black": (lambda: T.cloth("#1d1b22", 5), (1, 1, 1, 1), 0.0, 1),
    "cloth_rag": (lambda: T.cloth("#5a5244", 6), (1, 1, 1, 1), 0.0, 1),
    "cloth_cream": (lambda: T.cloth("#b8ab88", 7), (1, 1, 1, 1), 0.0, 1),
    "cloth_crimson": (lambda: T.cloth("#3a0f14", 8), (1, 1, 1, 1), 0.0, 1),
    "fur": (lambda: T.cloth("#5b4a38", 9, weave=False), (1, 1, 1, 1), 0.0, 1),
    "skin_human": (lambda: T.skin("#c99a7c", 5, 0.12, 20), (1, 1, 1, 1), 0.15, 10),
    "skin_ash": (lambda: T.skin("#6a6560", 6, 0.3, grime=0.5), (1, 1, 1, 1), 0.05, 4),
    "skin_ogre": (lambda: T.skin("#66714f", 7, 0.28, 60, grime=0.4), (1, 1, 1, 1), 0.05, 4),
    "bone": (lambda: T.bone(), (1, 1, 1, 1), 0.2, 10),
    "wood": (lambda: T.wood("#6a4c30", 7, 1), (1, 1, 1, 1), 0.1, 6),
    "wood_dark": (lambda: T.wood("#3d2c1e", 9, 1), (1, 1, 1, 1), 0.1, 6),
    "heraldry": (lambda: T.heraldry(), (1, 1, 1, 1), 0.25, 14),
    "dark": (lambda: T.cloth("#0a0908", 10, weave=False), (1, 1, 1, 1), 0.0, 1),
}
# self-lit materials (no lighting): eyes, flames, crystals
EMISSIVE = {"eye": (1.0, 0.45, 0.1), "eye_white": (1.0, 0.94, 0.78), "gem": (1.0, 0.35, 0.1), "crystal": (0.4, 0.7, 1.0),
            "orb": (1.0, 0.55, 0.15), "flame_core": (1.0, 0.7, 0.25), "lantern": (1.0, 0.65, 0.25)}


def style(name):
    return STYLES[name]


def apply(np, name):
    """Texture/tint/specular for a built NodePath."""
    if name in EMISSIVE:
        c = EMISSIVE[name]
        np.setColor(c[0], c[1], c[2], 1)
        np.setShaderOff(1)
        np.setLightOff(1)
        return np
    tex_fn, tint, spec, shine = STYLES[name]
    np.setTexture(tex_fn())
    if tint != (1, 1, 1, 1):
        np.setColorScale(Vec4(*tint))
    if spec > 0:
        key = (spec, shine)
        if key not in _mats:
            _mats[key] = _spec(shine, spec)
        np.setMaterial(_mats[key])
    return np
