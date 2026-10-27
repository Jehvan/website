"""World props. Each builder returns a NodePath prototype (origin on the ground, +Z up); the world copies + flattens them."""
import math

from panda3d.core import (ColorBlendAttrib, NodePath, TransparencyAttrib, Vec4, AlphaTestAttrib, RenderAttrib)

from .meshlib import Mesh, xf
from . import materials as M
from . import textures as T
from ..world import Rng

PI = math.pi
_proto = {}


def _np(parts, name):
    """parts: [(style_or_tex_fn, Mesh, extras)] -> NodePath with one child per material."""
    root = NodePath(name)
    for key, mesh, extra in parts:
        if len(mesh) == 0:
            continue
        n = mesh.build(name + "_" + str(key))
        n.reparentTo(root)
        if isinstance(key, str):
            M.apply(n, key)
        else:
            key(n)
        for fn in extra:
            fn(n)
    return root


def tex_style(tex_fn, spec=0.0, shine=8, tint=None):
    def f(n):
        n.setTexture(tex_fn())
        if tint:
            n.setColorScale(Vec4(*tint))
    return f


def alpha_cards(n):
    n.setTransparency(TransparencyAttrib.MBinary)
    n.setTwoSided(True)


# ---------------------------------------------------------------- vegetation
def tree(variant=0):
    R = Rng(100 + variant)
    trunk = Mesh()
    bark = lambda: T.bark("#4a3a2c", 8 + variant)
    # flared roots + trunk, with a slight lean
    trunk.lathe([(5.4, 0), (4.2, 3), (3.1, 14), (2.7, 30), (2.3, 38)], 9, xf((0, 0, 0), (0, 0, 0)), uvs=1.2, close_top=False)
    cards, core = Mesh(), Mesh()
    for i in range(3):
        a = i * 2.1 + R()
        trunk.cylinder(1.5, 0.6, 18, 5, xf((math.cos(a) * 3, math.sin(a) * 3, 28 + i * 3), (math.degrees(a), 0, 52)))
    leafcols = ["#4f8a2c", "#69a233", "#3f7426"]
    for c in range(7):
        a = c * 0.9 + R() * 0.4
        r = 3 + R() * 10
        cx, cy, cz = math.cos(a) * r, math.sin(a) * r, 46 + R() * 16
        core.sphere(8 + R() * 3, 8, 6, xf((cx, cy, cz), scale=(1.1, 1.1, 0.8)), color=(0.75 + R() * 0.25, 0.85 + R() * 0.15, 0.65 + R() * 0.2, 1))
    for i in range(30):                                                      # leaf cards over a dome so the crown reads full
        a = R() * 6.28
        el = R() * 1.2
        r = 8 + math.cos(el) * 16
        h = 50 + math.sin(el) * 22 + (R() - 0.5) * 6
        s = 15 + R() * 6
        tone = 0.78 + R() * 0.4
        for k in range(2):
            cards.quad((-s, 0, -s), (s, 0, -s), (s, 0, s), (-s, 0, s), color=(tone, tone, tone * 0.92, 1),
                       m=xf((math.cos(a) * r, math.sin(a) * r, h), (R() * 180, (R() - 0.5) * 80 + k * 45, (R() - 0.5) * 30)))
    leaf = lambda: T.leaf_card(leafcols[variant % 3], 21 + variant)
    return _np([(bark and (lambda n: n.setTexture(bark())), trunk, []), (lambda n: n.setTexture(T.cloth("#3f7028", 11, weave=False)), core, []),
                (lambda n: (n.setTexture(leaf()), alpha_cards(n)), cards, [])], "tree")


def pine():
    R = Rng(55)
    trunk, cones = Mesh(), Mesh()
    trunk.cylinder(3.6, 1.6, 26, 6)
    for i in range(5):
        z = 14 + i * 12
        cones.cone(16 - i * 2.6, 20, 9, xf((0, 0, z), (0, 0, 0)), color=(0.8 + R() * 0.2, 0.9, 0.8, 1))
    return _np([(lambda n: n.setTexture(T.bark("#3e3126", 3)), trunk, []), (lambda n: n.setTexture(T.cloth("#1f3322", 12, weave=False)), cones, [])], "pine")


def deadtree():
    R = Rng(77)
    m = Mesh()
    m.lathe([(4.6, 0), (3.2, 8), (2.2, 30), (1.2, 44)], 7, xf(hpr=(0, 3, 4)), close_top=False)
    for i in range(6):
        a = i * 1.05 + R()
        h, ln = 18 + i * 4, 18 - i * 1.4
        m.cylinder(1.3, 0.4, ln, 5, xf((math.cos(a) * 2, math.sin(a) * 2, h), (math.degrees(a), 0, 55)))
        m.cylinder(0.7, 0.25, ln * 0.55, 4, xf((math.cos(a) * (2 + ln * 0.6), math.sin(a) * (2 + ln * 0.6), h + ln * 0.5), (math.degrees(a) + 30, 0, 60)))
    return _np([(lambda n: n.setTexture(T.bark("#3c3835", 18)), m, [])], "deadtree")


def grass_tuft():
    m = Mesh()
    for k in range(3):
        s = 7.5
        m.quad((-s, 0, 0), (s, 0, 0), (s, 0, 2 * s), (-s, 0, 2 * s), m=xf(hpr=(k * 60, 0, 0)), uv=((0, 0), (1, 0), (1, 1), (0, 1)))
    return _np([(lambda n: (n.setTexture(T.grass_blade("#5c6c32", 23)), alpha_cards(n)), m, [])], "grass")


def reeds():
    m = Mesh()
    for k in range(3):
        s = 7
        m.quad((-s, 0, 0), (s, 0, 0), (s, 0, 4 * s), (-s, 0, 4 * s), m=xf(hpr=(k * 60, 0, 0)))
    return _np([(lambda n: (n.setTexture(T.reed(24)), alpha_cards(n)), m, [])], "reeds")


def rock():
    R = Rng(5)
    m = Mesh()
    m.sphere(1.0, 9, 7)
    # roughen by displacing vertices
    for i, p in enumerate(m.pos):
        k = 0.78 + ((math.sin(p[0] * 7.3 + p[1] * 3.1) * 0.5 + 0.5) * 0.3 + (math.sin(p[2] * 9.1 + p[0] * 2.2) * 0.5 + 0.5) * 0.18)
        m.pos[i] = (p[0] * k, p[1] * k, p[2] * k)
    return _np([(lambda n: n.setTexture(T.rock("#6a665e")), m, [])], "rock")


def hay_bale():
    m = Mesh()
    m.cylinder(11, 11, 17, 12, xf((-8.5, 0, 11), (0, 0, 90)), uvs=1.3)
    rope = Mesh()
    for x in (-4, 4):
        rope.torus(11.1, 0.5, 14, 4, xf((x, 0, 11), (0, 90, 0)))
    return _np([("wood", Mesh(), []), (lambda n: n.setTexture(T.straw()), m, []), (lambda n: n.setTexture(T.wood("#3a2a1c", 9, 1)), rope, [])], "hay")


def fence():
    m = Mesh()
    for x in (-15, 15):
        m.box((2.6, 2.6, 17), xf((x, 0, 8.5)), uv=(1, 1))
    for z in (5, 11.5):
        m.box((34, 1.6, 2), xf((0, 0.5, z)))
    return _np([(lambda n: n.setTexture(T.wood("#625a4e", 12, 3)), m, [])], "fence")


def log_pile():
    logs, ends = Mesh(), Mesh()
    R = Rng(9)
    for (x, z) in ((-5, 4.6), (5, 4.6), (15, 4.6), (0, 12.6), (10, 12.6), (5, 20.4)):
        ln = 30 + R() * 6
        logs.cylinder(4.6, 4.7, ln, 8, xf((x - 10, -ln / 2, z), (0, -90, 0)))
        ends.sphere(0.01, 3, 2)
    return _np([(lambda n: n.setTexture(T.bark("#4a3a2c", 5)), logs, [])], "logs")


# ---------------------------------------------------------------- stone
def pillar():
    shaft, cap = Mesh(), Mesh()
    shaft.cylinder(9, 8.2, 70, 14, xf((0, 0, 8)), uvs=2)
    cap.box((26, 26, 7), xf((0, 0, 3.5)))
    cap.box((20, 20, 4), xf((0, 0, 9.5)))
    cap.box((25, 25, 6), xf((0, 0, 79)))
    cap.box((20, 20, 4), xf((0, 0, 74)))
    return _np([(lambda n: n.setTexture(T.stone("#7d786e", 35)), shaft, []), (lambda n: n.setTexture(T.stone("#6d695f", 9, bricks=4)), cap, [])], "pillar")


def column():
    m = Mesh()
    m.cylinder(8.5, 7.4, 34, 10, xf((0, 0, 4)))
    m.box((20, 20, 5), xf((0, 0, 2.5)))
    m.box((9, 7, 12), xf((2, 1, 40), (30, 10, 17)))
    return _np([(lambda n: n.setTexture(T.stone("#6f6b62", 33)), m, [])], "column")


def ruin():
    R = Rng(14)
    m = Mesh()
    for i in range(5):
        h = 16 + R() * 26
        m.box((22, 18, h), xf((-44 + i * 22, 0, h / 2), (0, 0, (R() - 0.5) * 4)))
    m.box((10, 12, 8), xf((-60, 16, 4), (28, 0, 6)))
    m.box((12, 9, 7), xf((58, -14, 3.5), (-23, 0, -6)))
    return _np([(lambda n: n.setTexture(T.stone("#575559", 34, bricks=4)), m, [])], "ruin")


def lamp_post():
    wd, glass = Mesh(), Mesh()
    wd.cylinder(1.3, 0.9, 40, 6)
    wd.box((8, 1.2, 1.2), xf((3, 0, 38)))
    wd.cone(4.6, 4, 4, xf((6.5, 0, 36.5), (45, 0, 0)))
    glass.box((5, 5, 7), xf((6.5, 0, 33)))
    return _np([("wood_dark", wd, []), ("lantern", glass, [])], "lamp")


def brazier_body():
    iron, coal = Mesh(), Mesh()
    for i in range(3):
        a = i / 3 * math.tau
        iron.cylinder(1.3, 0.9, 26, 5, xf((math.cos(a) * 5, math.sin(a) * 5, 0), (math.degrees(a), 0, 12)))
    iron.lathe([(5, 25), (10, 33)], 10, close_top=False)
    iron.torus(10, 0.9, 12, 4, xf((0, 0, 33)))
    coal.cylinder(9, 9, 1, 10, xf((0, 0, 30.5)))
    return _np([("iron", iron, []), ("gem", coal, [])], "brazier")


# ---------------------------------------------------------------- buildings
def cottage():
    W, D, H = 96, 64, 34
    plaster, timber, thatch, stone_, glass = Mesh(), Mesh(), Mesh(), Mesh(), Mesh()
    plaster.box((W, D, H), xf((0, 0, H / 2 + 5)), uv=(1.4, 1.4))
    stone_.box((W + 3, D + 3, 6), xf((0, 0, 3)))
    t = 3.2
    for sx in (-1, 1):
        for sy in (-1, 1):
            timber.box((t, t, H + 1), xf((sx * W / 2, sy * D / 2, H / 2 + 5)))
    for z in (5.5, 5 + H / 2, 5 + H):
        for sy in (-1, 1):
            timber.box((W + 1, t, t * 0.7), xf((0, sy * D / 2, z)))
        for sx in (-1, 1):
            timber.box((t, D + 1, t * 0.7), xf((sx * W / 2, 0, z)))
    for x in (-W / 4, 0, W / 4):
        for sy in (-1, 1):
            timber.box((t * 0.7, t * 0.7, H), xf((x, sy * (D / 2 + 0.3), H / 2 + 5)))
    for sy in (-1, 1):
        for s in (-1, 1):
            timber.box((t * 0.6, t * 0.6, H * 0.62), xf((s * W * 0.375, sy * (D / 2 + 0.2), H / 2 + 5), (0, s * 40, 0)))
    rise = 30
    slope = math.degrees(math.atan2(rise, D / 2 + 6))
    ln = math.hypot(rise, D / 2 + 6)
    # roof slabs rotated about the X axis (ridge along X)
    for s in (-1, 1):
        thatch.box((W + 14, ln + 1, 5.5), xf((0, s * (D / 4 + 3), 5 + H + rise / 2 - 1), (0, s * slope, 0)), uv=(2.5, 2.5))
    thatch.cylinder(2.8, 2.8, W + 15, 6, xf((0, 0, 5 + H + rise + 2), (0, 0, 90)), origin="center")
    gable = [(-D / 2, 0), (D / 2, 0), (0, rise + 2)]
    for sx in (-1, 1):
        plaster.extrude(gable, 1.2, xf((sx * (W / 2 + 0.2), 0, 5 + H), (90, 0, 0)))
    stone_.box((9, 9, 52), xf((W / 2 - 14, -D / 4, 30)))
    stone_.box((12, 12, 3), xf((W / 2 - 14, -D / 4, 57)))
    timber.box((11, 1.6, 22), xf((-W / 5, D / 2 + 0.8, 16)))
    glass.box((9, 1.2, 9), xf((W / 5 + 6, D / 2 + 0.6, 26)))
    glass.box((9, 1.2, 9), xf((-W / 2 + 14, D / 2 + 0.6, 26)))
    for x in (W / 5 + 6, -W / 2 + 14):
        for s in (-1, 1):
            timber.box((4.6, 0.8, 9.6), xf((x + s * 7, D / 2 + 1, 26)))
    return _np([(lambda n: n.setTexture(T.plaster("#a89c82")), plaster, []), ("wood_dark", timber, []), (lambda n: n.setTexture(T.thatch()), thatch, []),
                (lambda n: n.setTexture(T.stone("#6b665c", 33)), stone_, []), ("dark", glass, [])], "cottage")


def bridge():
    L, Wd = 190, 104
    planks, beams, rails = Mesh(), Mesh(), Mesh()
    for i in range(17):
        planks.box((10.4, Wd, 2.4), xf((-L / 2 + 6 + i * 11.2, 0, 2.4)), uv=(1, 1))
    for y in (-Wd / 2 + 6, 0, Wd / 2 - 6):
        beams.box((L, 4, 3), xf((0, y, 0.2)))
    for sy in (-1, 1):
        rails.box((L - 20, 2.4, 2.4), xf((0, sy * (Wd / 2 - 2), 17)))
        rails.box((L - 20, 2.4, 2.4), xf((0, sy * (Wd / 2 - 2), 10)))
        for i in range(6):
            rails.box((3, 3, 22), xf((-L / 2 + 14 + i * ((L - 28) / 5), sy * (Wd / 2 - 2), 11)))
    piles = Mesh()
    for sy in (-1, 1):
        for x in (-60, 0, 60):
            piles.cylinder(4, 4.4, 26, 7, xf((x, sy * (Wd / 2 - 8), -16)))
    return _np([(lambda n: n.setTexture(T.wood("#6b5a44", 7, 3)), planks, []), ("wood_dark", beams, []), ("wood_dark", rails, []), ("wood_dark", piles, [])], "bridge")


def wall_long(w=700):
    H, D = 112, 140
    body, top, merlons, pil = Mesh(), Mesh(), Mesh(), Mesh()
    body.box((w, D, H), xf((0, 0, H / 2)), uv=(1.6, 1.6))
    top.box((w + 2, D + 4, 6), xf((0, 0, H + 3)))
    x = -w / 2 + 14
    while x < w / 2:
        merlons.box((22, 10, 14), xf((x, D / 2 - 3, H + 13)))
        x += 40
    x = -w / 2 + 40
    while x < w / 2:
        pil.box((14, 8, H), xf((x, D / 2 + 3, H / 2)))
        x += 80
    slits = Mesh()
    x = -w / 2 + 80
    while x < w / 2:
        slits.box((3.2, 1.4, 20), xf((x, D / 2 + 0.8, 66)))
        x += 80
    st = lambda n: n.setTexture(T.stone("#6e6a62", 9, bricks=4))
    return _np([(st, body, []), (st, top, []), (st, merlons, []), (st, pil, []), ("dark", slits, [])], "wall")


def tower():
    r, H = 52, 170
    shaft, cor, merl, roof, fin, slits = Mesh(), Mesh(), Mesh(), Mesh(), Mesh(), Mesh()
    shaft.cylinder(r + 2, r, H, 18, uvs=3)
    cor.cylinder(r + 4, r + 6, 8, 18, xf((0, 0, H)), uvs=3)
    for i in range(14):
        a = i / 14 * math.tau
        merl.box((14, 9, 14), xf((math.cos(a) * (r + 4), math.sin(a) * (r + 4), H + 15), (math.degrees(a) + 90, 0, 0)))
    roof.cone(r + 8, 92, 16, xf((0, 0, H + 8)))
    fin.cylinder(1.2, 0.8, 22, 4, xf((0, 0, H + 100)))
    fin.sphere(3, 6, 4, xf((0, 0, H + 112)))
    for z, n in ((70, 4), (120, 4)):
        for i in range(n):
            a = i / n * math.tau + 0.4
            slits.box((4, 3, 20), xf((math.cos(a) * (r + 1.2), math.sin(a) * (r + 1.2), z), (math.degrees(a) + 90, 0, 0)))
    st = lambda n: n.setTexture(T.stone("#6e6a62", 9, bricks=4))
    return _np([(st, shaft, []), (st, cor, []), (st, merl, []), ("steel_dark", roof, [lambda n: n.setTexture(T.slate())]), ("gold", fin, []), ("dark", slits, [])], "tower")


def portcullis():
    bars, arch, dark = Mesh(), Mesh(), Mesh()
    x = -40
    while x <= 40:
        bars.cylinder(1.3, 1.3, 96, 5, xf((x, 0, 0)))
        bars.cone(1.7, 5, 5, xf((x, 0, 6), (0, 180, 0)))
        x += 8
    for z in range(12, 91, 20):
        bars.box((86, 2.4, 2.4), xf((0, 0, z)))
    arch.box((18, 34, 108), xf((-58, 0, 54)))
    arch.box((18, 34, 108), xf((58, 0, 54)))
    arch.box((134, 34, 22), xf((0, 0, 108)))
    dark.box((100, 2, 100), xf((0, 10, 50)))
    return _np([("iron", bars, []), (lambda n: n.setTexture(T.stone("#6e6a62", 9, bricks=4)), arch, []), ("dark", dark, [])], "portcullis")


def banner_cloth():
    m = Mesh()
    segs = 6
    for i in range(segs):
        z0, z1 = -i * 8, -(i + 1) * 8
        m.quad((-11, 0, z0), (11, 0, z0), (11, 0, z1), (-11, 0, z1), uv=((0, 1 - i / segs), (1, 1 - i / segs), (1, 1 - (i + 1) / segs), (0, 1 - (i + 1) / segs)), double=True)
    pole = Mesh()
    pole.cylinder(1, 1, 28, 5, xf((-14, 0, 0), (0, 0, 90)))
    return _np([(lambda n: (n.setTexture(T.banner()), n.setTwoSided(True)), m, []), ("wood_dark", pole, [])], "banner")


def throne():
    dais, seat, back, gold = Mesh(), Mesh(), Mesh(), Mesh()
    dais.box((340, 130, 10), xf((0, 0, 5)), uv=(3, 3))
    dais.box((270, 100, 10), xf((0, -4, 15)), uv=(3, 3))
    dais.box((190, 70, 10), xf((0, -8, 25)), uv=(3, 3))
    seat.box((40, 34, 8), xf((0, 10, 34)))
    seat.box((6, 34, 18), xf((-22, 10, 40)))
    seat.box((6, 34, 18), xf((22, 10, 40)))
    back.box((40, 8, 78), xf((0, 24, 74)))
    back.cone(14, 22, 4, xf((0, 24, 113), (45, 0, 0)), color=(1, 1, 1, 1))
    for x in (-18, -9, 0, 9, 18):
        gold.cone(2.2, 14, 4, xf((x, 24, 112 - abs(x) * 0.4)))
    cush = Mesh()
    cush.box((34, 28, 5), xf((0, 9, 39)))
    return _np([(lambda n: n.setTexture(T.stone("#8a8690", 34, bricks=4)), dais, []), ("steel_dark", seat, []), ("steel_dark", back, []), ("gold", gold, []), ("cloth_red", cush, [])], "throne")


def hall_wall(w=1600, h=160, d=140):
    m = Mesh()
    m.box((w, d, h), xf((0, 0, h / 2)), uv=(w / 100, 1.6))
    m.box((w, d + 6, 8), xf((0, 0, h + 4)), uv=(w / 100, 1))
    return _np([(lambda n: n.setTexture(T.stone("#8a8690", 34, bricks=4)), m, [])], "hallwall")


def arrow_slit():
    m = Mesh()
    m.box((24, 2, 60))
    m.cone(12, 20, 3, xf((0, 0, 30), (0, 0, 0), (1, 0.1, 1)))
    return _np([("crystal", m, [lambda n: n.setColor(0.18, 0.24, 0.42, 1)])], "slit")


# ---------------------------------------------------------------- town props
def _canopy(W, D, rise, c1, c2, mesh_h, ln_extra=8):
    """Striped pitched awning with its ridge along X. Returns Mesh (top slabs)."""
    m = Mesh()
    slope = math.degrees(math.atan2(rise, D / 2 + ln_extra / 2))
    ln = math.hypot(rise, D / 2 + ln_extra / 2)
    for s in (-1, 1):
        m.box((W, ln, 1.6), xf((0, s * (D / 4 + ln_extra / 4), mesh_h + rise / 2), (0, s * slope, 0)), uv=(0.5, 1.0))
    return m


def tent():
    W, D, H = 64, 46, 40
    post, trim, crate, goods = Mesh(), Mesh(), Mesh(), Mesh()
    for sx in (-1, 1):
        for sy in (-1, 1):
            post.cylinder(1.3, 1.1, H, 6, xf((sx * (W / 2 - 2), sy * (D / 2 - 2), 0)))
    m = _canopy(W + 6, D + 4, 20, "#b3402e", "#e8d8b0", H)
    for sy in (-1, 1):
        trim.box((W + 8, 1.4, 5), xf((0, sy * (D / 2 + 2.6), H - 1)), uv=(1, 1))
    for sx in (-1, 1):
        trim.box((1.4, D + 6, 3), xf((sx * (W / 2 + 3), 0, H + 5)))
    crate.box((W - 14, 14, 16), xf((0, D / 2 - 14, 8)), uv=(1.2, 1.2))
    for i in range(6):
        goods.sphere(4.2, 8, 6, xf(((i - 2.5) * 8.5, D / 2 - 14, 19 + (i % 2))))
    return _np([("wood_dark", post, []), (lambda n: n.setTexture(T.stripes("#b3402e", "#e8d8b0", 4)), m, []),
                ("cloth_cream", trim, []), ("wood", crate, []), ("cloth_green", goods, [])], "tent")


def tent_blue():
    W, D, H = 64, 46, 40
    post, trim, crate = Mesh(), Mesh(), Mesh()
    for sx in (-1, 1):
        for sy in (-1, 1):
            post.cylinder(1.3, 1.1, H, 6, xf((sx * (W / 2 - 2), sy * (D / 2 - 2), 0)))
    m = _canopy(W + 6, D + 4, 20, "#2f6a78", "#e3d6ab", H)
    for sy in (-1, 1):
        trim.box((W + 8, 1.4, 5), xf((0, sy * (D / 2 + 2.6), H - 1)))
    crate.box((W - 10, 12, 14), xf((0, D / 2 - 14, 7)))
    for i in range(3):
        crate.box((10, 10, 10), xf((-20 + i * 20, -D / 2 + 12, 5), (i * 20, 0, 0)))
    return _np([("wood_dark", post, []), (lambda n: n.setTexture(T.stripes("#2f6a78", "#e3d6ab", 4)), m, []),
                ("cloth_cream", trim, []), ("wood", crate, [])], "tent_blue")


def fountain():
    stone_, water, rim = Mesh(), Mesh(), Mesh()
    seg = 8
    stone_.lathe([(40, 0), (40, 12), (36, 12), (36, 4)], seg, xf((0, 0, 0)), close_top=True, uvs=2.2)
    rim.torus(38, 1.8, 8, 4, xf((0, 0, 12.5)))
    stone_.cylinder(11, 8, 4, 8, xf((0, 0, 3)))
    stone_.lathe([(7, 7), (4.5, 12), (3.6, 30), (9, 33), (11, 38)], 8, xf((0, 0, 0)), close_top=False, uvs=1.5)
    stone_.cylinder(3, 2, 14, 6, xf((0, 0, 38)))
    stone_.sphere(3.6, 8, 6, xf((0, 0, 54)))
    water.cylinder(35, 35, 0.5, 16, xf((0, 0, 9.5)))
    water.lathe([(0.1, 30.8), (10, 33.6), (11, 33)], 12, xf((0, 0, 0)), close_top=False)
    return _np([(lambda n: n.setTexture(T.stone("#9a948a", 61, bricks=4)), stone_, []), ("gold", rim, []),
                (lambda n: (n.setTexture(T.water()), n.setTransparency(TransparencyAttrib.MAlpha), n.setColorScale(0.7, 0.95, 1.1, 0.85)), water, [])], "fountain")


def barrel():
    wd, band = Mesh(), Mesh()
    wd.lathe([(5.5, 0), (6.8, 6), (7.2, 11), (6.8, 16), (5.5, 22)], 10, xf((0, 0, 0)), uvs=1.0)
    for z in (4, 18):
        band.torus(6.2 + (0.9 if z == 18 else 0.0) * 0, 0.5, 10, 4, xf((0, 0, z)))
    return _np([("wood", wd, []), ("iron", band, [])], "barrel")


def crate():
    wd, fr = Mesh(), Mesh()
    wd.box((11, 11, 11), xf((0, 0, 5.5)), uv=(0.7, 0.7))
    for sx in (-1, 1):
        for sy in (-1, 1):
            fr.box((1.4, 1.4, 11.4), xf((sx * 5.4, sy * 5.4, 5.5)))
    return _np([("wood", wd, []), ("wood_dark", fr, [])], "crate")


def forge():
    st, hood, anvil, wd, coal = Mesh(), Mesh(), Mesh(), Mesh(), Mesh()
    st.box((34, 26, 18), xf((0, 0, 9)), uv=(1.4, 1.4))
    st.box((26, 18, 4), xf((0, -2, 20)))
    hood.box((26, 6, 30), xf((0, -9, 40)))
    st.box((12, 12, 42), xf((0, -8, 52)))
    st.box((15, 15, 3), xf((0, -8, 75)))
    coal.box((20, 12, 1), xf((0, 4, 18.5)))
    anvil.box((14, 7, 5), xf((34, 6, 12)))
    anvil.box((7, 5, 9), xf((34, 6, 6)))
    anvil.box((6, 4, 3), xf((43, 6, 14)))
    wd.cylinder(7, 6, 10, 8, xf((34, 6, 0)))
    wd.box((4, 18, 10), xf((-26, 4, 5)))
    return _np([(lambda n: n.setTexture(T.stone("#6f6a60", 71, bricks=5)), st, []), ("iron", hood, []), ("steel_dark", anvil, []),
                ("wood", wd, []), ("gem", coal, [])], "forge")


def well():
    st, wd, roof = Mesh(), Mesh(), Mesh()
    st.lathe([(13, 0), (13, 14), (10, 14), (10, 3)], 10, xf((0, 0, 0)), uvs=1.5)
    for s in (-1, 1):
        wd.box((2, 2, 34), xf((s * 11, 0, 17)))
    wd.cylinder(1.2, 1.2, 24, 6, xf((-12, 0, 32), (0, 0, 90)))
    for s in (-1, 1):
        roof.box((30, 18, 2), xf((0, s * 7, 40), (0, s * 28, 0)), uv=(1.2, 1.2))
    return _np([(lambda n: n.setTexture(T.stone("#8a8478", 81, cobbles=True)), st, []), ("wood", wd, []), (lambda n: n.setTexture(T.thatch()), roof, [])], "well")


def cart():
    wd, wheel = Mesh(), Mesh()
    wd.box((40, 22, 3), xf((0, 0, 11)))
    for sy in (-1, 1):
        wd.box((40, 1.6, 9), xf((0, sy * 10.5, 15)))
    for sx in (-1, 1):
        wd.box((1.6, 22, 9), xf((sx * 19.5, 0, 15)))
    wd.cylinder(0.9, 0.9, 30, 5, xf((-34, 0, 7), (0, 0, 0)))
    for sy in (-1, 1):
        wheel.torus(8, 1.3, 14, 4, xf((0, sy * 12.5, 9), (0, 90, 0)))
        wheel.cylinder(1.6, 1.6, 3, 6, xf((0, sy * 12.5 - 1.5, 9), (0, 90, 0)))
    return _np([("wood", wd, []), ("wood_dark", wheel, [])], "cart")


def campfire():
    st, lg, ash = Mesh(), Mesh(), Mesh()
    for i in range(8):
        a = i / 8 * math.tau
        st.sphere(3.0, 6, 4, xf((math.cos(a) * 12, math.sin(a) * 12, 2.0), scale=(1.2, 1, 0.8)))
    for i in range(4):
        lg.cylinder(1.8, 1.6, 16, 6, xf((0, 0, 3.0), (i * 45 + 10, 0, 74)))
    ash.cylinder(9, 9, 0.8, 10, xf((0, 0, 0.6)))
    return _np([(lambda n: n.setTexture(T.rock()), st, []), ("wood_dark", lg, []), ("gem", ash, [])], "campfire")


def standard():
    """Free-standing warband standard: tall pole, crossbar, tattered black and red cloth."""
    pole, cloth, red, tip = Mesh(), Mesh(), Mesh(), Mesh()
    pole.cylinder(1.5, 1.1, 70, 6)
    pole.box((16, 1.2, 1.2), xf((0, 0, 62)))
    tip.cone(2.2, 7, 5, xf((0, 0, 70)))
    for i in range(3):
        cloth.box((4.6, 0.5, 26 - i * 4), xf((-5.2 + i * 5.2, 0.4, 48 - i * 2.0 - (26 - i * 4) / 2 + 12)))
    red.box((4.6, 0.55, 5), xf((0, 0.45, 56)))
    red.box((4.6, 0.55, 5), xf((5.2, 0.45, 56)))
    return _np([("wood_dark", pole, []), ("iron", tip, []), (lambda n: (n.setTexture(T.cloth("#1d1b22", 5)), n.setTwoSided(True)), cloth, []),
                (lambda n: (n.setTexture(T.cloth("#7a1f26", 2)), n.setTwoSided(True)), red, [])], "standard")


def camp_tent():
    cv, pole = Mesh(), Mesh()
    W, D, H = 56, 46, 34
    hw, hd = W / 2, D / 2
    cv.quad((-hw, -hd, 0), (hw, -hd, 0), (hw, 0, H), (-hw, 0, H), uv=((0, 0), (2, 0), (2, 1.2), (0, 1.2)), double=True)
    cv.quad((hw, hd, 0), (-hw, hd, 0), (-hw, 0, H), (hw, 0, H), uv=((0, 0), (2, 0), (2, 1.2), (0, 1.2)), double=True)
    for sx in (-1, 1):
        cv.quad((sx * hw, -hd, 0), (sx * hw, hd, 0), (sx * hw, 0, H), (sx * hw, 0, H), uv=((0, 0), (1, 0), (0.5, 1), (0.5, 1)), double=True)
    for sx in (-1, 1):
        pole.cylinder(1.0, 0.8, H + 7, 5, xf((sx * (hw + 1), 0, 0)))
    pole.cylinder(0.7, 0.7, W + 6, 5, xf((0, 0, H + 0.4), (0, 0, 90)), origin="center")
    return _np([(lambda n: (n.setTexture(T.cloth("#7d6f55", 12)), n.setTwoSided(True)), cv, []), ("wood_dark", pole, [])], "camp_tent")


def palisade():
    wd, tp = Mesh(), Mesh()
    R = Rng(41)
    for i in range(9):
        h = 38 + R() * 10
        wd.cylinder(2.3, 2.0, h, 6, xf((-32 + i * 8, (R() - 0.5) * 1.5, 0)))
        tp.cone(2.1, 7, 6, xf((-32 + i * 8, 0, h)))
    wd.box((74, 1.6, 2.2), xf((0, 2.4, 16)))
    wd.box((74, 1.6, 2.2), xf((0, 2.4, 30)))
    return _np([(lambda n: n.setTexture(T.bark("#4a3a2c", 5)), wd, []), (lambda n: n.setTexture(T.bark("#4a3a2c", 5)), tp, [])], "palisade")


def weapon_rack():
    wd, st = Mesh(), Mesh()
    for s in (-1, 1):
        wd.cylinder(1.3, 1.3, 26, 5, xf((s * 12, 0, 0)))
    wd.box((28, 1.6, 1.6), xf((0, 0, 22)))
    wd.box((28, 1.6, 1.6), xf((0, 0, 11)))
    for i in range(5):
        st.cylinder(0.5, 0.5, 34, 4, xf((-10 + i * 5, 1.6, 2), (0, (i - 2) * 4, 0)))
        st.cone(0.9, 5, 4, xf((-10 + i * 5 + (i - 2) * 2.3, 1.6, 36)))
    return _np([("wood", wd, []), ("steel", st, [])], "rack")


def crystal():
    cr, base = Mesh(), Mesh()
    R = Rng(77)
    for i in range(6):
        a = i / 6 * math.tau + R()
        h = 16 + R() * 20
        cr.cone(3.2 + R() * 1.6, h, 5, xf((math.cos(a) * (3 + R() * 6), math.sin(a) * (3 + R() * 6), 0), (R() * 360, (R() - 0.5) * 36, (R() - 0.5) * 36)))
    cr.cone(4.5, 30, 5, xf((0, 0, 0)))
    base.sphere(9, 7, 4, xf((0, 0, 0), scale=(1.3, 1.2, 0.45)))
    return _np([("crystal", cr, []), (lambda n: n.setTexture(T.rock("#4a4852")), base, [])], "crystal")


def sarcophagus():
    st, lid, tr = Mesh(), Mesh(), Mesh()
    st.box((22, 46, 14), xf((0, 0, 7)), uv=(1, 1))
    lid.box((24, 48, 5), xf((0, 0, 16.5)))
    lid.box((13, 30, 5), xf((0, 0, 21)))
    tr.box((24.4, 1.2, 1.2), xf((0, 20, 17)))
    return _np([(lambda n: n.setTexture(T.stone("#8a8690", 91, bricks=3)), st, []), (lambda n: n.setTexture(T.stone("#9a96a0", 92)), lid, []), ("gold", tr, [])], "sarcophagus")


def bones():
    bn, sk = Mesh(), Mesh()
    R = Rng(63)
    for i in range(9):
        a = R() * math.tau
        bn.cylinder(0.9, 0.9, 10 + R() * 8, 5, xf((math.cos(a) * 9, math.sin(a) * 9, 0.9), (R() * 360, 90, 0)))
    for i in range(3):
        sk.sphere(3.6, 7, 5, xf((math.cos(i * 2.1) * 6, math.sin(i * 2.1) * 6, 3.0)))
    return _np([("bone", bn, []), ("bone", sk, [])], "bones")


BUILD = {"tree": tree, "pine": pine, "deadtree": deadtree, "grass": grass_tuft, "reeds": reeds, "rock": rock, "hay": hay_bale, "fence": fence,
         "logs": log_pile, "pillar": pillar, "column": column, "ruin": ruin, "lamp": lamp_post, "brazier": brazier_body, "cottage": cottage,
         "bridge": bridge, "tower": tower, "portcullis": portcullis, "banner": banner_cloth, "tent": tent, "tent_blue": tent_blue, "fountain": fountain, "barrel": barrel, "crate": crate, "forge": forge, "well": well, "cart": cart, "crystal": crystal, "sarcophagus": sarcophagus, "bones": bones, "campfire": campfire, "standard": standard, "camp_tent": camp_tent, "palisade": palisade, "rack": weapon_rack, "throne": throne, "slit": arrow_slit}


def proto(kind, *args):
    key = (kind,) + args
    if key not in _proto:
        if kind == "wall":
            _proto[key] = wall_long(*args)
        elif kind == "hallwall":
            _proto[key] = hall_wall(*args)
        else:
            _proto[key] = BUILD[kind](*args)
    return _proto[key]
