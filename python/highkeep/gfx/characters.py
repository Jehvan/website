"""Character designs built on the humanoid rig. create(kind) -> Character with .root, .update(ent, dt, t), .flash(on)."""
import math

from panda3d.core import NodePath, Vec3

from .meshlib import Mesh, xf
from . import materials as M
from . import textures as T
from .rig import Rig, Animator

PI = math.pi
WHITE = (1, 1, 1, 1)


def col(r, g=None, b=None):
    if g is None:
        return (r, r, r, 1)
    return (r, g, b, 1)


# ------------------------------------------------------------------ shared pieces
W = xf((0, 0, 0), (0, -90, 0))      # weapon space (blade along +Z) -> wrist space (+Y)


def at(x=0, y=0, z=0, hpr=(0, 0, 0), s=(1, 1, 1)):
    return xf((x, y, z), hpr, s) * W


def sword(rig, joint="wristR", length=30):
    """Arming sword: blade along weapon +Z from the grip; the fist holds it so it points up/forward."""
    b = rig.part(joint, "blade")
    b.box((2.3, 0.6, length), at(0, 0, 4 + length / 2))
    b.box((0.7, 0.9, length * 0.8), at(0, 0, 4 + length * 0.45))                       # fuller
    b.cone(1.15, 5.5, 4, at(0, 0, 4 + length) , )
    g = rig.part(joint, "gold")
    g.box((9.0, 1.3, 1.3), at(0, 0, 3.6))                                              # crossguard
    g.box((1.3, 1.3, 2.4), at(4.4, 0, 2.6))
    g.box((1.3, 1.3, 2.4), at(-4.4, 0, 2.6))
    g.sphere(1.5, 8, 6, at(0, 0, -2.6))                                                # pommel
    rig.part(joint, "leather_dark").cylinder(0.9, 0.9, 6.2, 8, at(0, 0, -1.6))


def heater_shield(rig, joint="elbowL"):
    outline = [(-6.8, 8.5), (6.8, 8.5), (6.9, 2), (5.8, -4), (3, -9.5), (0, -12.5), (-3, -9.5), (-5.8, -4), (-6.9, 2)]
    m = xf((-4.6, 0.6, -6.5), (90, 0, 0))
    rig.part(joint, "heraldry").extrude(outline, 1.2, m)
    rim = xf((-4.6, 0.6, -6.5), (90, 0, 0))
    ms = rig.part(joint, "wood_dark")
    ms.extrude([(x * 1.05, z * 1.04) for x, z in outline], 0.8, rim)
    g = rig.part(joint, "steel")
    g.sphere(1.9, 10, 6, xf((-5.3, 0.6, -5.0), (0, 0, 0), (0.6, 1, 1)))


def war_standard(rig, h=30, cloth="cloth_black"):
    """Tattered warband banner on a pole strapped to the back."""
    rig.part("spine", "wood_dark").cylinder(0.7, 0.6, h, 6, xf((3.0, -6.4, 2.0), (0, 8, 0)))
    rig.part("spine", "iron").cone(1.3, 3.2, 5, xf((3.0 + h * 0.14, -6.4, 2.0 + h * 0.99)))
    f = rig.part("spine", cloth)
    for i in range(4):
        f.box((0.4, 8.0 - i * 1.3, 4.0), xf((3.0 + h * 0.12, -6.4 - (4.5 - i * 0.6), 2.0 + h * 0.94 - i * 3.6 - 2.0), (0, 0, (i % 2) * 6 - 3)))
    rig.part("spine", "cloth_red").box((0.45, 3.2, 3.2), xf((3.1 + h * 0.12, -6.4 - 3.6, 2.0 + h * 0.84)))


def quiver(rig, joint="chest"):
    ms = rig.part(joint, "leather_dark")
    m = xf((2.8, -5.4, 8.0), (0, 18, -20))
    ms.cylinder(2.5, 2.3, 15, 8, m)
    rig.part(joint, "leather").cylinder(2.7, 2.7, 1.4, 8, m * xf((0, 0, 13.5)))
    sh = rig.part(joint, "wood")
    fl = rig.part(joint, "cloth_cream")
    for i in range(5):
        mm = m * xf(((i - 2) * 0.9, (i % 2) * 0.8 - 0.4, 14.5), (0, 0, (i - 2) * 7))
        sh.cylinder(0.2, 0.2, 8, 4, mm)
        fl.box((1.4, 0.15, 2.6), mm * xf((0, 0, 6.6)))


# ------------------------------------------------------------------ builders
def build_knight():
    rig = Rig(bulk=1.1)
    b = 1.1
    S = lambda s: (1, 0.66, 1)
    # --- torso: steel cuirass with a ridge, tabard, belt
    t = rig.part("spine", "steel")
    t.lathe([(6.6 * b, 0.5), (7.3 * b, 5), (8.7 * b, 11.5), (8.9 * b, 14.6), (7.2 * b, 17.2)], 14, xf((0, 0, 0), (0, 0, 0), (1, 0.66, 1)), close_bottom=False)
    t.box((0.8, 1.0, 13), xf((0, 5.4, 9.5), (0, 8, 0)))                                  # medial ridge
    for z in (4.6, 8.2):                                                                   # breastplate lames
        t.torus(8.3 * b, 0.45, 14, 4, xf((0, 0, z), (0, 0, 0), (1, 0.66, 1)))
    rig.part("spine", "cloth_blue").box((11.0, 0.5, 15), xf((0, 5.9, 9)))
    rig.part("spine", "heraldry").quad((3.9, 6.3, 5.4), (-3.9, 6.3, 5.4), (-3.9, 6.3, 15.0), (3.9, 6.3, 15.0))
    rig.part("spine", "cloth_blue").box((11.5, 0.5, 15), xf((0, -5.9, 9)))
    rig.part("spine", "leather_dark").lathe([(7.4 * b, 0.4), (7.4 * b, 3.0)], 14, xf((0, 0, 0), (0, 0, 0), (1, 0.7, 1)))
    rig.part("spine", "gold").box((3.0, 0.7, 2.4), xf((0, 5.4, 1.7)))
    # --- hips: fauld, mail skirt, tassets
    h = rig.part("hips", "steel")
    for i, z in enumerate((1.0, -1.8, -4.4)):
        h.lathe([(7.4 * b + i * 0.4, z), (7.7 * b + i * 0.4, z - 2.8)], 14, xf((0, 0, 0), (0, 0, 0), (1, 0.74, 1)), close_top=False, close_bottom=False)
    rig.part("hips", "chain").lathe([(7.5 * b, -4), (9.0 * b, -13.5)], 14, xf((0, 0, 0), (0, 0, 0), (1, 0.78, 1)), close_top=False, close_bottom=False, uvs=2.5)
    for s in (-1, 1):
        rig.part("hips", "steel").box((4.6, 1.0, 8), xf((s * 6.0, 4.4, -7.5), (0, 8, 0)))
    rig.part("hips", "cloth_red").box((10.5, 0.5, 11), xf((0, 5.9, -9.5), (0, -6, 0)))
    rig.part("hips", "cloth_red").box((10.5, 0.5, 11), xf((0, -5.9, -9.5), (0, 6, 0)))
    rig.part("hips", "leather").box((3.2, 2.0, 4.2), xf((-7.0, 0.5, -3.0)))
    # --- gorget + camail
    rig.part("chest", "steel").lathe([(4.2, -1.4), (5.3, 1.2)], 12, close_top=False, close_bottom=False)
    rig.part("chest", "chain").lathe([(4.6, 0.6), (8.6 * b, -2.4)], 12, xf((0, 0, 0), (0, 0, 0), (1, 0.7, 1)), close_top=False, close_bottom=False, uvs=1.5)
    # --- arms & legs
    for side, sx in (("L", -1), ("R", 1)):
        sh, el, wr = "shoulder" + side, "elbow" + side, "wrist" + side
        p = rig.part(sh, "steel")
        p.dome(5.0, 12, 5, xf((sx * 0.4, 0, 1.0), (0, 0, 0), (1.15, 1.05, 0.8)))                       # pauldron
        for i, (rr, z) in enumerate(((5.4, -0.6), (5.0, -2.4), (4.6, -4.0))):
            p.lathe([(rr, z), (rr - 0.2, z - 1.7)], 12, xf((sx * 0.4, 0, 0), (0, 0, 0), (1.1, 1.0, 1)), close_top=False, close_bottom=False)
        rig.part(sh, "gold").torus(4.9, 0.4, 14, 4, xf((sx * 0.4, 0, 1.0), (0, 0, 0), (1.1, 1.0, 1)))
        rig.limb(sh, "chain", 9.5, 2.9, 2.5, 8)
        rig.limb(sh, "steel", 6.5, 3.3, 2.9, 8, xf((0, 0, -1.2)))                                       # rerebrace
        rig.part(el, "steel").sphere(2.9, 8, 6, xf((0, -0.5, 0)))                                       # couter
        rig.part(el, "steel").cone(1.2, 3.4, 5, xf((sx * 2.6, -0.4, 0.3), (0, 0, -sx * 90)))
        rig.limb(el, "steel", 7.6, 2.55, 2.0, 8, xf((0, 0, -1.0)))                                      # vambrace
        rig.limb(el, "chain", 9, 2.3, 1.9, 8)
        g = rig.part(wr, "leather_dark")
        g.sphere(2.35, 8, 6, xf((0, 0.3, -1.0), (0, 0, 0), (0.9, 1.1, 1.0)))
        rig.part(wr, "steel").lathe([(2.4, 1.2), (2.1, -0.6)], 8, close_top=False)
        # leg
        th, kn = "thigh" + side, "knee" + side
        rig.limb(th, "chain", 13, 3.9 * b, 3.0 * b, 9)
        rig.limb(th, "steel", 9.5, 4.2 * b, 3.4 * b, 9, xf((0, 0.2, -0.6)))                           # cuisse
        pk = rig.part(kn, "steel")
        pk.sphere(3.2 * b, 8, 6, xf((0, 1.5, 0.3), (0, 0, 0), (1.0, 0.8, 0.9)))                       # poleyn
        pk.cone(1.2, 3.0, 5, xf((sx * 2.9, 1.0, 0.2), (0, 0, -sx * 90)))
        rig.limb(kn, "steel", 12.2, 3.2 * b, 2.3 * b, 9, xf((0, 0, -0.5)))                            # greave
        fz = -13.0
        rig.part(kn, "leather_dark").box((4.2 * b, 9.0, 3.0), xf((0, 1.8, fz - 1.0)))
        rig.part(kn, "steel").box((3.6 * b, 3.4, 2.2), xf((0, 5.4, fz - 0.4)))
    # --- helm: hounskull bascinet
    hd = rig.part("head", "steel")
    hd.lathe([(4.4, 0.2), (5.0, 3.0), (5.35, 6.2), (4.8, 9.2), (3.0, 11.6), (0.2, 12.5)], 14, xf((0, 0, 0), (0, 0, 0), (0.98, 1.06, 1)), close_bottom=False, close_top=False)
    hd.cone(3.5, 8.5, 8, xf((0, 4.1, 5.0), (0, -92, 0), (1, 1.15, 1)))                                # snout
    for s in (-1, 1):
        rig.part("head", "dark").box((1.5, 0.6, 0.5), xf((s * 1.9, 5.15, 6.0)))                        # eye slits
        rig.part("head", "dark").box((0.35, 0.5, 0.35), xf((s * 1.5, 7.6, 3.3)))
        rig.part("head", "dark").box((0.35, 0.5, 0.35), xf((s * 1.5, 8.6, 2.4)))
    rig.part("head", "dark").box((0.9, 0.5, 0.45), xf((0, 4.9, 5.4)))
    rig.part("head", "gold").torus(4.9, 0.35, 14, 4, xf((0, 0, 8.5), (0, 0, 0), (0.98, 1.06, 1)))
    rig.part("head", "chain").lathe([(4.6, 5.2), (5.6, -1.6)], 12, xf((0, -0.3, 0), (0, 0, 0), (1, 1.05, 1)), close_top=False, close_bottom=False, uvs=1.2)
    for i in range(5):                                                                                 # plumed crest
        rig.part("head", "cloth_red").box((1.0, 3.2, 3.4), xf((0, 2.4 - i * 2.2, 12.6 + (1.3 - abs(i - 1.6) * 0.45) * 1.8 - i * 0.5), (0, 12 + i * 10, 0)))
    rig.part("head", "gold").box((1.2, 9, 0.7), xf((0, 0, 12.1)))
    # --- weapons
    sword(rig)
    heater_shield(rig)
    rig.finish()
    cfg = dict(style="slash", idle_r=(0.35, 1.0, 0.0), idle_l=(0.25, 0.9, 0.2), cape=dict(style="cloth_crimson", w=15, h1=15, h2=14))
    return rig, cfg


def bow(rig, joint="wristL", R=20, ang=56):
    """Recurve bow held vertically; belly bulges forward (weapon +Y)."""
    wd = rig.part(joint, "wood")
    pts = []
    n = 10
    for i in range(n + 1):
        a = math.radians(-ang + 2 * ang * i / n)
        pts.append((R * math.cos(a) - R, R * math.sin(a)))
    for (y0, z0), (y1, z1) in zip(pts, pts[1:]):
        ln = math.hypot(y1 - y0, z1 - z0)
        pitch = -math.degrees(math.atan2(y1 - y0, z1 - z0))
        wd.box((1.5, 1.7, ln + 0.5), at(0, (y0 + y1) / 2, (z0 + z1) / 2, (0, pitch, 0)))
    ty = pts[0][0]
    rig.part(joint, "cloth_cream").cylinder(0.12, 0.12, 2 * R * math.sin(math.radians(ang)), 3, at(0, ty, -R * math.sin(math.radians(ang))))
    rig.part(joint, "leather_dark").cylinder(1.15, 1.15, 5.0, 6, at(0, 0.2, -2.5))
    rig.part(joint, "gold").sphere(0.9, 6, 4, at(0, ty, R * math.sin(math.radians(ang))))
    rig.part(joint, "gold").sphere(0.9, 6, 4, at(0, ty, -R * math.sin(math.radians(ang))))


def staff(rig, joint="wristR", length=50, crystal="crystal"):
    rig.part(joint, "wood_dark").cylinder(1.35, 1.0, length, 7, at(0, 0, -8))
    rig.part(joint, "leather_dark").cylinder(1.5, 1.5, 5, 7, at(0, 0, -1))
    ir = rig.part(joint, "iron")
    for i in range(4):
        a = i / 4 * math.tau
        ir.cone(0.7, 7.5, 4, at(math.cos(a) * 2.6, math.sin(a) * 2.6, length - 11, (0, 0, 0)) * 1.0)
    ir.torus(2.2, 0.5, 10, 4, at(0, 0, length - 8))
    rig.part(joint, crystal).sphere(3.0, 10, 8, at(0, 0, length - 3.5, (0, 0, 0), (1, 1, 1.4)))


def club(rig, joint="wristR", s=1.0):
    rig.part(joint, "wood").cylinder(1.3 * s, 3.5 * s, 28 * s, 8, at(0, 0, -2 * s))
    ir = rig.part(joint, "iron")
    for z in (14, 21, 26):
        ir.cylinder(3.9 * s - (z - 14) * 0.05, 3.9 * s, 1.7 * s, 8, at(0, 0, z * s - 0.6))
    for i in range(7):
        a = i / 7 * math.tau
        ir.cone(0.85 * s, 2.6 * s, 4, at(math.cos(a) * 3.6 * s, math.sin(a) * 3.6 * s, 22 * s, (0, 0, 0)))
    rig.part(joint, "leather_dark").cylinder(1.4 * s, 1.4 * s, 6 * s, 7, at(0, 0, -3 * s))


def greataxe(rig, joint="wristR"):
    rig.part(joint, "iron").cylinder(1.5, 1.7, 66, 8, at(0, 0, -10))
    rig.part(joint, "leather_dark").cylinder(1.9, 1.9, 12, 8, at(0, 0, -4))
    bp = rig.part(joint, "black_plate")
    bp.cone(1.5, 8, 6, at(0, 0, 54))
    for sgn in (-1, 1):
        outline = [(0, 6), (sgn * 9, 9.5), (sgn * 19, 15), (sgn * 24, 3), (sgn * 20, -13), (sgn * 9, -9), (0, -6)]
        m = xf((0, 0, 38), (0, 0, 0)) * W if False else at(0, 0, 38)
        # extrude lies in XZ(weapon X/Z=blade axis); depth along weapon Y
        bp.extrude([(x, z) for x, z in outline], 1.2, xf((0, 0, 0)) * at(0, 0, 38))
        rig.part(joint, "gem").box((0.7, 1.4, 22), at(sgn * 22.5, 0, 38, (0, 0, 0)))


def build_ranger():
    rig = Rig(bulk=0.97)
    b = 0.97
    rig.part("spine", "leather").lathe([(6.3 * b, 0.5), (7.0 * b, 6), (7.6 * b, 12), (7.3 * b, 16.5), (5.2 * b, 17.4)], 12, xf(scale=(1, 0.66, 1)), close_bottom=False)
    rig.part("spine", "leather_dark").lathe([(6.8 * b, 0.6), (6.8 * b, 3.4)], 12, xf(scale=(1, 0.7, 1)))
    rig.part("spine", "gold").box((2.2, 0.7, 2.0), xf((0, 4.7, 2.0)))
    rig.part("spine", "leather_dark").box((1.8, 0.5, 21), xf((1.0, 4.9, 9.0), (0, 0, 32)))             # bandolier
    for z in (5, 8, 11, 14):
        rig.part("spine", "gold").sphere(0.35, 4, 3, xf((0, 4.4, z)))
    rig.part("hips", "cloth_green").lathe([(6.8 * b, 0.0), (8.2 * b, -9.5)], 12, xf(scale=(1, 0.75, 1)), close_top=False, close_bottom=False)
    rig.part("hips", "leather").box((3.4, 2.0, 4.2), xf((7.0, 0.5, -2.0)))
    rig.part("chest", "cloth_cream").lathe([(4.0, -1.2), (4.6, 2.6)], 10, close_top=False, close_bottom=False)    # scarf
    for side, sx in (("L", -1), ("R", 1)):
        sh, el, wr, th, kn = ("shoulder" + side, "elbow" + side, "wrist" + side, "thigh" + side, "knee" + side)
        rig.part(sh, "leather").dome(4.0, 10, 4, xf((0, 0, 0.8), scale=(1.1, 1.0, 0.8)))
        rig.limb(sh, "cloth_green", 9.5, 2.9, 2.4, 8)
        rig.limb(el, "leather", 8.2, 2.5, 2.0, 8, xf((0, 0, -0.6)))                                   # bracer
        rig.limb(el, "cloth_green", 9, 2.3, 1.9, 8)
        rig.part(wr, "leather_dark").sphere(2.2, 8, 6, xf((0, 0.2, -1.0), scale=(0.9, 1.1, 1.0)))
        rig.limb(th, "cloth_green", 13, 3.7 * b, 2.8 * b, 9)
        rig.limb(kn, "leather_dark", 13, 2.9 * b, 2.2 * b, 9)
        rig.part(kn, "leather").box((4.0 * b, 4.0, 4.0), xf((0, 1.8, 0.0)))
        rig.part(kn, "leather_dark").box((3.8 * b, 9, 3.0), xf((0, 1.8, -14.0)))
    hd = rig.part("head", "skin_human")
    hd.sphere(4.7, 12, 9, xf((0, 0.2, 4.8), scale=(0.93, 1.0, 1.08)))
    for s in (-1, 1):
        rig.part("head", "dark").sphere(0.65, 6, 4, xf((s * 1.9, 4.5, 5.4), scale=(1, 0.6, 0.8)))
    hh = rig.part("head", "cloth_green")                                                             # hood
    hh.dome(5.6, 12, 6, xf((0, -0.4, 3.6), (0, 14, 0), (1.04, 1.1, 1.3)))
    hh.cone(3.4, 9, 7, xf((0, -5.2, 8.0), (0, 130, 0)))
    hh.box((10.4, 1.3, 1.0), xf((0, 4.6, 9.1), (0, 15, 0)))
    rig.part("head", "cloth_cream").lathe([(4.9, 0.5), (4.8, 3.6)], 10, xf((0, 0.5, 0), scale=(1, 1.04, 1)), close_top=False, close_bottom=False)   # face wrap
    for i in range(4):                                                                              # long hood feather
        rig.part("head", "cloth_red").box((0.5, 3.2, 1.6), xf((3.6 + i * 0.3, -2.0 - i * 2.4, 9.5 - i * 0.7), (0, -18 - i * 8, 18)))
    rig.part("chest", "leather").lathe([(4.6, -0.8), (8.8 * b, -4.4)], 12, xf(scale=(1, 0.72, 1)), close_top=False, close_bottom=False)          # cape mantle
    rig.part("chest", "fur").torus(8.0 * b, 0.9, 14, 4, xf((0, 0, -4.2), scale=(1, 0.72, 1)))
    for side in ("L", "R"):
        for z in (-3.0, -6.0):
            rig.part("elbow" + side, "gold").sphere(0.5, 4, 3, xf((0, 2.4, z)))
    quiver(rig)
    bow(rig)
    rig.finish()
    return rig, dict(style="bow", idle_l=(1.0, 0.7, 0.1), idle_r=(0.1, 0.6, 0.0), stride=0.06,
                     cape=dict(style="cloth_green", w=14, h1=15, h2=14))


def build_mage():
    rig = Rig(bulk=0.95)
    b = 0.95
    rig.part("spine", "cloth_purple").lathe([(6.3 * b, 0.5), (7.0 * b, 6), (7.7 * b, 12), (7.4 * b, 16.5), (5.0 * b, 17.4)], 12, xf(scale=(1, 0.68, 1)), close_bottom=False)
    rig.part("spine", "leather_dark").lathe([(7.0 * b, 0.6), (7.0 * b, 3.0)], 12, xf(scale=(1, 0.72, 1)))
    rig.part("spine", "gold").box((2.6, 0.7, 2.4), xf((0, 5.0, 1.8)))
    rig.part("spine", "cloth_blue").box((2.4, 0.4, 16), xf((0, 5.2, 9.0)))                             # robe trim
    rig.part("spine", "leather").box((4.0, 2.2, 5.0), xf((7.2, 1.2, 1.0)))                            # pouch
    rig.part("spine", "wood_dark").box((3.4, 1.8, 5.0), xf((-6.8, 2.6, 0.6), (0, 0, 14)))             # tome
    rig.part("spine", "gold").box((3.2, 1.9, 0.5), xf((-6.8, 2.6, 3.1), (0, 0, 14)))
    h = rig.part("hips", "cloth_purple")
    h.lathe([(6.8 * b, 1.0), (11.5 * b, -22)], 14, xf(scale=(1, 0.88, 1)), close_top=False, close_bottom=False)
    rig.part("hips", "gold").torus(10.8 * b, 0.45, 16, 4, xf((0, 0, -21.2), scale=(1, 0.88, 1)))
    rig.part("hips", "cloth_blue").box((2.4, 0.4, 22), xf((0, 7.6 * b, -10.5)))
    rig.part("chest", "fur").lathe([(4.4, -1.2), (8.6 * b, -2.6)], 12, xf(scale=(1, 0.72, 1)), close_top=False, close_bottom=False)      # fur mantle
    rig.part("chest", "fur").torus(7.6 * b, 1.6, 14, 5, xf((0, 0, -1.6), scale=(1, 0.72, 1)))
    for side, sx in (("L", -1), ("R", 1)):
        sh, el, wr, th, kn = ("shoulder" + side, "elbow" + side, "wrist" + side, "thigh" + side, "knee" + side)
        rig.part(sh, "cloth_purple").sphere(3.5, 8, 6, xf((0, 0, 0.5), scale=(1.1, 1, 0.85)))
        rig.limb(sh, "cloth_purple", 9.5, 3.0, 2.6, 8)
        rig.limb(el, "cloth_purple", 9, 2.7, 2.6, 8)
        rig.part(el, "cloth_blue").lathe([(2.6, -8.0), (4.4, -11.0)], 10, close_top=False, close_bottom=False)      # wide cuff
        rig.part(wr, "skin_human").sphere(2.0, 8, 6, xf((0, 0.2, -1.0), scale=(0.9, 1.1, 1.0)))
        rig.limb(th, "cloth_purple", 13, 3.4, 2.7, 8)
        rig.limb(kn, "leather_dark", 13, 2.7, 2.1, 8)
        rig.part(kn, "leather_dark").box((3.6, 8.5, 3.0), xf((0, 1.8, -14.0)))
    hd = rig.part("head", "skin_human")
    hd.sphere(4.7, 12, 9, xf((0, 0.3, 4.8), scale=(0.93, 1.0, 1.08)))
    for s in (-1, 1):
        rig.part("head", "eye_white").sphere(0.55, 6, 4, xf((s * 1.9, 4.5, 5.5), scale=(1, 0.6, 0.8)))
    rig.part("head", "cloth_cream").cone(3.4, 8.5, 8, xf((0, 4.0, 1.8), (0, 172, 0), (1, 0.8, 1)))     # beard
    hh = rig.part("head", "cloth_purple")                                                            # cowl
    hh.dome(5.9, 12, 6, xf((0, -0.5, 3.4), (0, 12, 0), (1.05, 1.12, 1.3)))
    hh.cone(3.6, 11, 7, xf((0, -5.8, 8.2), (0, 125, 0)))
    rig.part("head", "fur").torus(4.6, 0.9, 12, 4, xf((0, 1.0, 5.8), (0, 22, 0), (1, 1.08, 1)))
    hat = rig.part("head", "cloth_purple")                                                           # wide-brim pointed hat
    hat.cylinder(10.5, 10.5, 0.8, 14, xf((0, 0.3, 8.8), scale=(1, 1.05, 1)))
    hat.lathe([(5.2, 8.8), (4.4, 12), (2.8, 17), (1.2, 22), (0.2, 26)], 12, xf((0, 0, 0)), close_top=False, close_bottom=False)
    rig.part("head", "gold").torus(5.0, 0.55, 14, 4, xf((0, 0, 9.6)))
    rig.part("head", "gold").sphere(1.1, 6, 4, xf((0, 4.6, 10.0)))
    rig.part("head", "gem").sphere(0.7, 6, 4, xf((0, 5.2, 10.0)))
    staff(rig)
    rig.finish()
    return rig, dict(style="cast", idle_r=(0.15, 0.5, 0.0), idle_l=(0.15, 0.5, 0.0), cape=dict(style="cloth_crimson", w=12, h1=13, h2=12))


def build_grunt():
    rig = Rig(bulk=1.3, leg=0.88, arm=0.95)
    b = 1.3
    rig.part("spine", "skin_ash").lathe([(6.5 * b, 0.5), (7.2 * b, 6), (8.4 * b, 12), (7.9 * b, 16.5), (5.6 * b, 17.4)], 12, xf(scale=(1, 0.68, 1)), close_bottom=False)
    for sgn in (-1, 1):
        rig.part("spine", "leather").box((2.4, 0.6, 22), xf((0, 5.9, 9), (0, 0, sgn * 40)))
    rig.part("spine", "iron").box((3.4, 0.9, 3.0), xf((0, 5.8, 8.9)))
    rig.part("spine", "leather_dark").lathe([(8.2 * b, 0.4), (8.2 * b, 3.6)], 12, xf(scale=(1, 0.72, 1)))
    rig.part("spine", "iron").box((3.6, 0.9, 3.2), xf((0, 6.0, 2.0)))
    rig.part("chest", "fur").lathe([(5.0, -0.5), (9.8 * b * 0.9, -3.6)], 12, xf(scale=(1, 0.72, 1)), close_top=False, close_bottom=False)
    rig.part("hips", "cloth_rag").lathe([(7.4 * b, 0.0), (9.0 * b, -11)], 12, xf(scale=(1, 0.7, 1)), close_top=False, close_bottom=False)
    rig.part("hips", "leather_dark").box((10, 0.6, 8), xf((0, 6.9, -9.0), (0, -8, 0)))
    for side, sx in (("L", -1), ("R", 1)):
        sh, el, wr, th, kn = ("shoulder" + side, "elbow" + side, "wrist" + side, "thigh" + side, "knee" + side)
        rig.part(sh, "fur").sphere(4.8, 9, 6, xf((0, 0, 0.8), scale=(1.15, 1.05, 0.85)))
        rig.limb(sh, "skin_ash", 9.5, 3.4, 2.9, 8)
        rig.limb(el, "leather_dark", 8, 3.0, 2.4, 8, xf((0, 0, -0.6)))
        rig.part(el, "iron").torus(2.8, 0.4, 9, 4, xf((0, 0, -4.2)))
        rig.limb(el, "skin_ash", 9, 2.7, 2.2, 8)
        rig.part(wr, "skin_ash").sphere(2.5, 8, 6, xf((0, 0.2, -1.0), scale=(0.95, 1.1, 1.0)))
        rig.limb(th, "skin_ash", 13 * 0.88, 4.6, 3.4, 9)
        rig.limb(kn, "leather_dark", 13 * 0.88, 3.7, 2.8, 9)
        rig.part(kn, "leather_dark").box((5.4, 9.4, 3.2), xf((0, 1.8, -12.0)))
    hd = rig.part("head", "skin_ash")
    hd.sphere(4.9, 12, 9, xf((0, 0.3, 4.9), scale=(0.96, 1.0, 1.05)))
    rig.part("head", "dark").box((4.2, 0.6, 0.7), xf((0, 4.8, 2.6)))
    for s in (-1, 1):
        rig.part("head", "eye").sphere(0.7, 6, 4, xf((s * 2.0, 4.4, 5.4), scale=(1, 0.5, 0.7)))
        rig.part("head", "bone").cone(1.0, 3.0, 5, xf((s * 2.4, 4.4, 2.4), (0, 180, 0)))              # tusks
    ir = rig.part("head", "iron")                                                                    # horned nasal helm
    ir.dome(5.4, 12, 5, xf((0, 0, 6.2), scale=(1, 1.05, 1.1)), )
    ir.cylinder(5.5, 5.5, 1.4, 12, xf((0, 0, 6.0), scale=(1, 1.05, 1)))
    ir.box((1.0, 0.8, 5.0), xf((0, 5.3, 3.8)))
    for s in (-1, 1):
        rig.part("head", "bone").cone(1.5, 8.0, 7, xf((s * 5.4, 0, 9.0), (0, 0, -s * 55)))
    club(rig, s=1.0)
    war_standard(rig)
    rig.finish()
    return rig, dict(style="club", idle_r=(0.3, 1.0, 0.0), idle_l=(0.3, 0.7, 0.0), run_ref=80)


def build_bowman():
    rig = Rig(bulk=0.9, leg=0.98)
    b = 0.9
    rig.part("spine", "cloth_black").lathe([(6.2 * b, 0.5), (6.8 * b, 6), (7.3 * b, 12), (7.0 * b, 16.5), (5.0 * b, 17.4)], 12, xf(scale=(1, 0.66, 1)), close_bottom=False)
    rig.part("spine", "leather").box((1.8, 0.5, 21), xf((1.0, 4.7, 9.0), (0, 0, 32)))
    rig.part("spine", "leather_dark").lathe([(6.6 * b, 0.6), (6.6 * b, 3.2)], 12, xf(scale=(1, 0.7, 1)))
    rig.part("hips", "cloth_black").lathe([(6.5 * b, 0.0), (7.8 * b, -9)], 12, xf(scale=(1, 0.75, 1)), close_top=False, close_bottom=False)
    rig.part("chest", "fur").lathe([(4.0, -0.5), (8.0 * b, -3.2)], 12, xf(scale=(1, 0.72, 1)), close_top=False, close_bottom=False)
    for side, sx in (("L", -1), ("R", 1)):
        sh, el, wr, th, kn = ("shoulder" + side, "elbow" + side, "wrist" + side, "thigh" + side, "knee" + side)
        rig.part(sh, "leather_dark").sphere(3.5, 8, 6, xf((0, 0, 0.6), scale=(1.1, 1, 0.8)))
        rig.limb(sh, "cloth_black", 9.5, 2.8, 2.3, 8)
        rig.limb(el, "leather_dark", 8, 2.4, 1.9, 8, xf((0, 0, -0.6)))
        rig.limb(el, "cloth_black", 9, 2.2, 1.8, 8)
        rig.part(wr, "leather_dark").sphere(2.1, 8, 6, xf((0, 0.2, -1.0), scale=(0.9, 1.1, 1.0)))
        rig.limb(th, "cloth_black", 13 * 0.98, 3.4, 2.6, 8)
        rig.limb(kn, "leather_dark", 13 * 0.98, 2.7, 2.1, 8)
        rig.part(kn, "leather_dark").box((3.6, 8.5, 3.0), xf((0, 1.8, -13.0)))
    hh = rig.part("head", "cloth_black")
    hh.dome(6.0, 12, 6, xf((0, -0.4, 3.4), (0, 10, 0), (1.04, 1.12, 1.3)))
    hh.cone(3.6, 10, 7, xf((0, -5.6, 8.0), (0, 128, 0)))
    hh.lathe([(5.2, 0.0), (5.1, 3.5)], 10, xf((0, 0.5, 0.4), scale=(1, 1.05, 1)), close_top=False, close_bottom=False)         # face wrap
    rig.part("head", "dark").sphere(4.6, 10, 8, xf((0, 1.4, 4.8), scale=(0.95, 1.0, 1.05)))           # deep shadow
    for s in (-1, 1):
        rig.part("head", "eye").sphere(0.85, 6, 4, xf((s * 1.9, 5.6, 5.2), scale=(1, 0.5, 0.65)))
    quiver(rig)
    bow(rig, R=15)
    war_standard(rig, 26)
    rig.finish()
    return rig, dict(style="bow", hunch=0.14, idle_l=(1.0, 0.7, 0.1), idle_r=(0.1, 0.6, 0.0), run_ref=90,
                     cape=dict(style="cloth_black", w=13, h1=15, h2=14))


def build_brute():
    rig = Rig(bulk=1.8, leg=0.84, arm=1.15)
    b = 1.8
    rig.part("spine", "skin_ogre").lathe([(6.0 * b, 0.5), (6.8 * b, 6), (8.0 * b, 12), (7.4 * b, 16.5), (5.0 * b, 17.4)], 14, xf(scale=(1, 0.72, 1)), close_bottom=False)
    rig.part("spine", "leather_dark").lathe([(7.8 * b, 0.4), (7.8 * b, 3.6)], 14, xf(scale=(1, 0.76, 1)))
    for x in (-6, 0, 6):
        rig.part("spine", "bone").sphere(2.2, 7, 5, xf((x, 8.8, 2.0), scale=(1, 0.9, 1.1)))
    rig.part("chest", "iron").torus(8.5, 1.0, 14, 5, xf((0, 0, -2.8), scale=(1, 0.74, 1)))             # collar
    for i in range(5):
        rig.part("chest", "iron").torus(0.9, 0.3, 6, 3, xf((6.5 * math.cos(i), 6.0, -5 - i * 1.4)))
    rig.part("hips", "leather").lathe([(8.8, 0.0), (10.5, -10)], 14, xf(scale=(1, 0.8, 1)), close_top=False, close_bottom=False)
    for side, sx in (("L", -1), ("R", 1)):
        sh, el, wr, th, kn = ("shoulder" + side, "elbow" + side, "wrist" + side, "thigh" + side, "knee" + side)
        rig.part(sh, "leather").dome(6.4, 10, 5, xf((0, 0, 0.8), scale=(1.15, 1.05, 0.8)))
        for i in range(3):
            rig.part(sh, "bone").cone(1.0, 4.2, 5, xf(((i - 1) * 2.6 * sx, 0, 4.0)))
        rig.limb(sh, "skin_ogre", 9.5 * 1.15, 4.6, 3.8, 9)
        rig.part(el, "leather_dark").lathe([(4.2, 0.4), (4.0, -6.0)], 10, close_top=False, close_bottom=False)
        for i in range(3):
            rig.part(el, "iron").cone(0.9, 2.6, 4, xf((sx * 4.2, 0, -1.6 - i * 2.0), (0, 0, -sx * 90)))
        rig.limb(el, "skin_ogre", 9 * 1.15, 3.7, 3.0, 9)
        rig.part(wr, "skin_ogre").sphere(3.6, 8, 6, xf((0, 0.3, -1.4), scale=(1, 1.1, 1.0)))
        rig.limb(th, "skin_ogre", 13 * 0.84, 6.0, 4.6, 9)
        rig.limb(kn, "leather_dark", 13 * 0.84, 5.0, 3.8, 9)
        rig.part(kn, "leather_dark").box((7.0, 11, 3.8), xf((0, 2.4, -11.4)))
    hd = rig.part("head", "skin_ogre")
    hd.sphere(4.9, 10, 8, xf((0, -0.3, 3.6), scale=(1.0, 1.0, 0.9)))
    mk = rig.part("head", "bone")
    mk.box((8.4, 1.8, 8.0), xf((0, 4.0, 4.0), (0, -4, 0)))
    mk.box((7.8, 1.2, 2.2), xf((0, 3.6, 8.4), (0, -22, 0)))
    for s in (-1, 1):
        rig.part("head", "dark").box((1.8, 0.7, 1.8), xf((s * 2.2, 5.0, 5.0)))
        rig.part("head", "eye").sphere(0.55, 5, 4, xf((s * 2.2, 5.1, 4.9), scale=(1, 0.5, 1)))
        mk.cone(0.9, 4.0, 5, xf((s * 4.4, 3.0, 9.0), (0, 0, -s * 40)))
        mk.cone(0.7, 3.4, 5, xf((s * 2.4, 4.4, 0.6), (0, 180, 0)))
    for i in range(-2, 3):
        rig.part("head", "eye_white").box((0.9, 0.6, 1.2), xf((i * 1.5, 5.1, 1.6)))
    club(rig, s=1.7)
    rig.finish()
    return rig, dict(style="slam", idle_r=(0.15, 0.5, 0.05), idle_l=(0.15, 0.5, 0.05), hunch=0.22, run_ref=55, stride=0.07)


def build_regent():
    rig = Rig(bulk=1.18, leg=1.08, arm=1.05)
    b = 1.18
    bp = lambda: rig.part("spine", "black_plate")
    bp().lathe([(6.6 * b, 0.5), (7.3 * b, 5), (8.9 * b, 11.5), (9.2 * b, 14.6), (7.4 * b, 17.4)], 14, xf(scale=(1, 0.68, 1)), close_bottom=False)
    bp().box((1.0, 1.0, 14), xf((0, 5.8, 9.5), (0, 8, 0)))
    rig.part("spine", "gem").sphere(2.6, 10, 8, xf((0, 6.0, 11.4), scale=(1, 0.55, 1)))
    rig.part("spine", "gold").torus(3.4, 0.7, 14, 4, xf((0, 5.7, 11.4), (90, 0, 0)))
    for z in (4.4, 7.4):
        rig.part("spine", "gold").torus(8.4 * b, 0.35, 14, 4, xf((0, 0, z), scale=(1, 0.68, 1)))
    rig.part("spine", "iron").lathe([(7.6 * b, 0.4), (7.6 * b, 3.2)], 14, xf(scale=(1, 0.72, 1)))
    for i, z in enumerate((1.0, -2.2)):
        rig.part("hips", "black_plate").lathe([(7.6 * b, z), (7.9 * b, z - 3.4)], 14, xf(scale=(1, 0.76, 1)), close_top=False, close_bottom=False)
    rig.part("hips", "cloth_crimson").box((10.5, 0.5, 14), xf((0, 7.0, -10), (0, -5, 0)))
    rig.part("hips", "cloth_crimson").box((10.5, 0.5, 14), xf((0, -7.0, -10), (0, 5, 0)))
    for s in (-1, 1):
        rig.part("hips", "black_plate").box((4.8, 1.0, 10), xf((s * 6.0, 5.4, -8.5), (0, 8, 0)))
    for side, sx in (("L", -1), ("R", 1)):
        sh, el, wr, th, kn = ("shoulder" + side, "elbow" + side, "wrist" + side, "thigh" + side, "knee" + side)
        rig.part(sh, "black_plate").dome(5.8, 12, 5, xf((sx * 0.4, 0, 1.0), scale=(1.2, 1.1, 0.85)))
        for i in range(3):
            rig.part(sh, "iron").cone(1.3, 6.6 - i, 5, xf((sx * (1.2 + i * 2.3), 0, 4.5 - i * 0.4), (0, 0, -sx * (20 + i * 22))))
        rig.part(sh, "black_plate").lathe([(5.6, -1.0), (5.2, -3.2)], 12, xf((sx * 0.4, 0, 0), scale=(1.1, 1.0, 1)), close_top=False, close_bottom=False)
        rig.limb(sh, "black_plate", 9.5 * 1.05, 3.4, 2.8, 8)
        rig.part(el, "black_plate").sphere(3.4, 8, 6, xf((0, -0.5, 0)))
        rig.part(el, "iron").cone(1.4, 4.4, 5, xf((sx * 3.0, -0.4, 0.2), (0, 0, -sx * 90)))
        rig.limb(el, "black_plate", 9 * 1.05, 2.9, 2.3, 8)
        rig.part(wr, "iron").sphere(2.7, 8, 6, xf((0, 0.3, -1.2), scale=(0.95, 1.15, 1.0)))
        rig.limb(th, "black_plate", 13 * 1.08, 4.4 * b, 3.4 * b, 9)
        rig.part(kn, "black_plate").sphere(3.5 * b, 8, 6, xf((0, 1.6, 0.4), scale=(1, 0.8, 0.9)))
        rig.part(kn, "iron").cone(1.3, 3.4, 5, xf((0, 4.2, 0.2), (0, -90, 0)))
        rig.limb(kn, "black_plate", 13 * 1.08, 3.3 * b, 2.4 * b, 9)
        rig.part(kn, "iron").box((4.2 * b, 10, 3.2), xf((0, 2.0, -14.4)))
    hd = rig.part("head", "black_plate")
    hd.lathe([(4.7, 0.0), (5.3, 3.4), (5.5, 6.6), (4.9, 9.6), (3.0, 11.8), (0.2, 12.5)], 14, xf(scale=(0.98, 1.05, 1)), close_top=False, close_bottom=False)
    rig.part("head", "eye").box((7.8, 0.7, 0.9), xf((0, 5.4, 6.4)))
    rig.part("head", "dark").box((0.9, 0.6, 5.2), xf((0, 5.4, 3.3)))
    crown = rig.part("head", "gold")
    crown.cylinder(5.9, 5.9, 2.4, 12, xf((0, 0, 10.8), scale=(1, 1.05, 1)))
    for i in range(7):
        a = i / 7 * math.tau
        crown.cone(1.0, 6.4 if i % 2 == 0 else 4.2, 5, xf((math.cos(a) * 5.6, math.sin(a) * 5.9, 13.0)))
        rig.part("head", "gem").sphere(0.65, 5, 4, xf((math.cos(a) * 6.0, math.sin(a) * 6.3, 11.4)))
    for s in (-1, 1):
        rig.part("head", "iron").cone(1.6, 10.0, 6, xf((s * 5.4, 0, 8.6), (0, 0, -s * 62)))
    greataxe(rig)
    rig.finish()
    return rig, dict(style="slam", idle_r=(0.25, 0.9, 0.05), idle_l=(0.35, 1.1, 0.1), run_ref=70, stride=0.05,
                     cape=dict(style="cloth_crimson", w=18, h1=22, h2=20, z=15.5, y=-5.8))


BUILDERS = {"knight": build_knight, "ranger": build_ranger, "mage": build_mage, "grunt": build_grunt, "bowman": build_bowman,
            "brute": build_brute, "regent": build_regent}
SCALES = {"knight": 1.2, "ranger": 1.2, "mage": 1.2, "grunt": 1.15, "bowman": 1.15, "brute": 1.65, "regent": 2.1}

_templates = {}


def _cape(rig_inst, spec):
    """Two-segment hanging cloth on the chest; returns update(mv, t, ph)."""
    w, h1, h2 = spec["w"], spec["h1"], spec["h2"]
    st = spec["style"]
    spine = rig_inst.J["spine"]
    pivot = spine.attachNewNode("cape_pivot")
    pivot.setPos(0, spec.get("y", -5.2), spec.get("z", 15.0))
    upper = pivot.attachNewNode("cape_up")
    lower = upper.attachNewNode("cape_lo")
    lower.setPos(0, 0, -h1)

    def quad(parent, ww, hh, top_w=None):
        m = Mesh()
        tw = top_w or ww
        p0, p1, p2, p3 = (-ww / 2, 0, -hh), (ww / 2, 0, -hh), (tw / 2, 0, 0), (-tw / 2, 0, 0)
        m.quad(p0, p1, p2, p3, uv=((0, 0), (1, 0), (1, 1), (0, 1)), double=True)
        np = m.build("cape")
        np.reparentTo(parent)
        M.apply(np, st)
        np.setTwoSided(True)
        return np
    quad(upper, w * 0.9, h1, w)
    quad(lower, w * 0.78, h2, w * 0.9)

    def upd(mv, t, ph):
        fl = 0.15 + 0.55 * mv + math.sin(t * 5 + ph) * 0.05 * (0.4 + mv)
        upper.setP(math.degrees(fl * 0.7))
        lower.setP(math.degrees(fl * 0.5 + math.sin(t * 7 + ph * 1.3) * 0.12 * mv))
        upper.setR(math.degrees(math.sin(ph * 0.5) * 0.05 * mv))
    return upd


class Character:
    def __init__(self, template, cfg, kind):
        self.kind = kind
        self.rig = template.clone()
        self.root = NodePath("char_" + kind)
        self.rig.root.reparentTo(self.root)
        self.rig.root.setScale(SCALES.get(kind, 1.0))
        cape_upd = _cape(self.rig, cfg["cape"]) if cfg.get("cape") else None
        c = dict(cfg)
        extra = cfg.get("extras_factory")
        ex = extra(self.rig) if extra else None

        def extras(ent, t, mv, ph, dt):
            if cape_upd:
                cape_upd(mv, t, ph)
            if ex:
                ex(ent, t, mv, ph, dt)
        c["extras"] = extras
        self.anim = Animator(self.rig, c)
        self._flash = False

    def update(self, ent, dt, t, is_player):
        self.anim.apply(ent, dt, t, is_player)

    def flash(self, on):
        if on != self._flash:
            self._flash = on
            self.rig.root.setColorScale(3.2, 2.6, 2.2, 1) if on else self.rig.root.clearColorScale()


def create(kind):
    if kind not in _templates:
        rig, cfg = BUILDERS[kind]()
        _templates[kind] = (rig, cfg)
    rig, cfg = _templates[kind]
    return Character(rig, cfg, kind)



class Wisp:
    """Floating flame spirit: solid core, flickering flame cards and a halo (no skeleton)."""

    def __init__(self):
        from . import effects as FX
        self.kind = "wisp"
        self.root = NodePath("wisp")
        self.body = self.root.attachNewNode("wbody")
        core = Mesh().sphere(6.0, 10, 8).build("core")
        M.apply(core, "flame_core")
        core.reparentTo(self.body)
        self.core = core
        inner = Mesh().sphere(3.6, 8, 6).build("inner")
        inner.setColor(1.0, 0.92, 0.6, 1)
        inner.setLightOff(1)
        inner.setShaderOff(1)
        inner.reparentTo(self.body)
        self.flames = []
        for i in range(6):
            f = FX.flame(11, 22 + (i % 3) * 4)
            f.reparentTo(self.body)
            a = i / 6 * math.tau
            f.setPos(math.cos(a) * 2.5, math.sin(a) * 2.5, 8 + (i % 2) * 2)
            self.flames.append((f, a))
        self.halo = FX.glow(52, (1.0, 0.45, 0.1), 0.55)
        self.halo.reparentTo(self.body)
        for s in (-1, 1):
            e = Mesh().sphere(1.0, 6, 4, xf((s * 2.4, 5.2, 1.0), scale=(1, 0.5, 1.4))).build("eye")
            e.setColor(0.25, 0.06, 0.0, 1)
            e.setLightOff(1)
            e.setShaderOff(1)
            e.reparentTo(self.body)
        self._flash = False

    def update(self, e, dt, t, is_player):
        hover = 20 + math.sin(t * 4 + e.id) * 3.5
        self.body.setZ(hover)
        fl = 1 + 0.12 * math.sin(t * 18 + e.id) + (0.35 * e.atk_t if e.state == "windup" and e.atk_t > 0 else 0)
        self.core.setScale(fl)
        for i, (f, a) in enumerate(self.flames):
            f.setSz(22 + (i % 3) * 4 + math.sin(t * 10 + i * 1.7) * 5)
            f.setX(math.cos(a) * 2.5 + math.sin(t * 6 + i) * 1.2)
        self.halo.setScale(50 + 8 * math.sin(t * 9 + e.id))
        if e.dead:
            k = min(1.0, e.dead_t / 0.5)
            self.body.setScale(max(0.01, 1 - k))
            self.body.setZ(hover + k * 18)
        else:
            self.body.setScale(1)

    def flash(self, on):
        if on != self._flash:
            self._flash = on
            self.core.setColorScale(3, 3, 3, 1) if on else self.core.clearColorScale()


_orig_create = create


def create(kind):  # noqa: F811
    return Wisp() if kind == "wisp" else _orig_create(kind)
