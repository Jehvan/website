"""Build the 3D stage from a Layout: painted ground, instanced props, buildings, water, fires, lights and ambience."""
import math
import random

from panda3d.core import (AmbientLight, DirectionalLight, Fog, NodePath, PointLight, Texture, TextureStage, Vec3, Vec4,
                          TransparencyAttrib, TransformState)

from . import effects as FX
from . import props as P
from . import textures as T
from .meshlib import Mesh, xf
from .characters import create as create_character
from ..world import Rng, dist_to_road

# (sun colour, sun heading/pitch, ambient, fog colour, fog density, background, exposure, bloom, vignette)
THEMES = {
    "fields": dict(sun=(2.1, 1.65, 1.1), hp=(-35, -34), amb=(0.26, 0.3, 0.4), fog=(0.52, 0.55, 0.6), dens=0.00035, exp=1.15, bloom=0.5, vig=1.0),
    "wood": dict(sun=(2.0, 1.7, 1.1), hp=(-30, -40), amb=(0.3, 0.38, 0.36), fog=(0.26, 0.32, 0.28), dens=0.0008, exp=1.3, bloom=0.5, vig=1.2),
    "bridge": dict(sun=(2.2, 1.6, 0.95), hp=(-50, -28), amb=(0.26, 0.3, 0.4), fog=(0.5, 0.52, 0.54), dens=0.0004, exp=1.15, bloom=0.55, vig=1.05),
    "marsh": dict(sun=(1.6, 1.2, 0.75), hp=(-20, -20), amb=(0.2, 0.25, 0.23), fog=(0.26, 0.3, 0.24), dens=0.0016, exp=1.2, bloom=0.6, vig=1.3),
    "gate": dict(sun=(2.0, 1.5, 1.0), hp=(-30, -24), amb=(0.26, 0.28, 0.34), fog=(0.42, 0.42, 0.42), dens=0.0006, exp=1.15, bloom=0.55, vig=1.15),
    "hall": dict(sun=(0.4, 0.47, 0.75), hp=(-20, -55), amb=(0.16, 0.16, 0.22), fog=(0.05, 0.04, 0.05), dens=0.0008, exp=1.35, bloom=0.8, vig=1.5),
    "vault": dict(sun=(0.34, 0.4, 0.65), hp=(-20, -55), amb=(0.13, 0.14, 0.2), fog=(0.03, 0.03, 0.05), dens=0.001, exp=1.4, bloom=0.8, vig=1.6),
}

AMB = {"fields": ((1.0, 0.95, 0.7), 26, 3.5, 3), "wood": ((0.75, 1.0, 0.55), 30, 4, 2), "bridge": ((1, 1, 1), 20, 3, 2),
       "marsh": ((0.85, 1.0, 0.45), 44, 5, 3), "gate": ((1.0, 0.6, 0.3), 30, 3.5, 12), "hall": ((1.0, 0.6, 0.3), 36, 3.5, 11),
       "vault": ((1.0, 0.5, 0.2), 40, 3.5, 11)}


def P3(x, y, z=0.0):
    return (x, -y, z)


class World:
    def __init__(self, base, L, quality):
        self.L, self.quality = L, quality
        self.hi = quality == "high"
        self.root = NodePath("world")
        self.theme = THEMES[L.theme]
        self.updaters = []
        self.R = Rng(L.seed * 17 + 3)
        self.lights = []
        self.build()

    # --------------------------------------------------------------- helpers
    def place(self, kind, items, *proto_args, parent=None, flatten=True, tint=None):
        proto = P.proto(kind, *proto_args)
        grp = (parent or self.root).attachNewNode("grp_" + kind)
        for it in items:
            inst = proto.copyTo(grp)
            inst.setPos(*P3(it["x"], it["y"]))
            inst.setH(-math.degrees(it.get("rot", 0)))
            s = it.get("s", 1.0)
            inst.setScale(s * it.get("sx", 1.0), s * it.get("sy", 1.0), s * it.get("sz", 1.0))
            if tint:
                c = tint(it)
                inst.setColorScale(*c)
        if flatten and len(items) > 1:
            grp.flattenStrong()
        return grp

    def single(self, kind, x, y, rot=0.0, s=1.0, z=0.0, args=()):
        np = P.proto(kind, *args).copyTo(self.root)
        np.setPos(*P3(x, y, z))
        np.setH(-math.degrees(rot))
        np.setScale(s)
        return np

    def glow(self, x, y, z, color, size, op=0.6):
        g = FX.glow(size, color, op)
        g.reparentTo(self.root)
        g.setPos(*P3(x, y, z))
        return g

    # --------------------------------------------------------------- build
    def build(self):
        L, R = self.L, self.R
        # ground + skirt
        gt = T.paint_ground(L, self.quality)
        gm = Mesh().box((L.w, L.h, 2), xf((0, 0, -1)), uv=(1, 1))
        # one big quad with exact 0..1 UVs for the painted floor
        q = Mesh()
        q.quad((0, -L.h, 0), (L.w, -L.h, 0), (L.w, 0, 0), (0, 0, 0), uv=((0, 0), (1, 0), (1, 1), (0, 1)))
        ground = q.build("ground")
        ground.setTexture(gt)
        if not L.indoor:
            ts = TextureStage("detail")
            ts.setMode(TextureStage.MModulate)
            ground.setTexture(ts, T.detail())
            ground.setTexScale(ts, 46, 32)
        ground.reparentTo(self.root)
        base = T.hexc(T.THEMES[L.theme]["base"])
        sk = Mesh().box((L.w * 5, L.h * 5, 2), xf((L.w / 2, -L.h / 2, -2.5)))
        skirt = sk.build("skirt")
        skirt.setColor(base[0] * 0.32, base[1] * 0.32, base[2] * 0.3, 1)
        skirt.reparentTo(self.root)

        def by(kind):
            return L.of(kind)

        trees = by("tree")
        if trees:
            broad = [t for t in trees if not t.get("pine")]
            pines = [t for t in trees if t.get("pine")]
            for v in range(3):
                self.place("tree", [dict(t) for i, t in enumerate(broad) if i % 3 == v], v)
            self.place("pine", pines)
        self.place("deadtree", by("deadtree"))
        self.place("column", by("column"))
        self.place("ruin", by("ruin"))
        self.place("logs", by("logs"))
        self.place("hay", [dict(p, s=p["s"] * 1.25) for p in by("hay")])
        self.place("fence", by("fence"))
        self.place("rock", [dict(p, s=12 * p["s"], sx=1.15, sy=0.95, sz=0.7) for p in by("rock")])
        gr = by("grass")
        n = len(gr) if self.hi else int(len(gr) * 0.5)
        self.place("grass", gr[:n])
        for pool in L.pools:
            self.make_pool(pool)
        if not L.indoor:
            self.perimeter()

        self.smokes = []
        for c in by("cottage"):
            self.single("cottage", c["x"], c["y"], c["rot"], c["s"])
            cx = c["x"] + math.cos(-c["rot"]) * 34 * c["s"] + math.sin(-c["rot"]) * 16 * c["s"]
            cy = c["y"] - math.sin(-c["rot"]) * 34 * c["s"] + math.cos(-c["rot"]) * 16 * c["s"]
            for i in range(4):
                g = self.glow(cx, cy, 64 * c["s"], (0.8, 0.8, 0.8), 14, 0.25)
                self.smokes.append((g, cx, cy, 62 * c["s"], i))
        for p in by("lamp"):
            self.single("lamp", p["x"], p["y"], p["rot"])
            lx, ly = p["x"] + math.cos(p["rot"]) * 6.5, p["y"] - math.sin(p["rot"]) * 6.5
            self.glow(lx, ly, 33, (1.0, 0.65, 0.28), 54, 0.55)
        self.fires = []
        for b in by("brazier"):
            self.make_brazier(b["x"], b["y"])
        if L.river:
            self.make_river()
        if L.theme == "gate":
            for w in by("wall"):
                self.single("wall", w["x"], w["y"], args=(w["w"],))
            for t in by("tower"):
                self.single("tower", t["x"], t["y"] + 10, s=t["s"])
            for p in by("portcullis"):
                self.single("portcullis", p["x"], p["y"] + 8)
            self.banners = []
            for b in by("banner"):
                pole = self.single("banner", b["x"], b["y"] + 4, s=b["s"], z=104)
                self.banners.append(pole)
            self.updaters.append(lambda t, dt: [bn.setHpr(math.sin(t * 1.4 + i) * 4, math.sin(t * 1.1 + i * 2) * 3, 0) for i, bn in enumerate(self.banners)])
        if L.theme == "hall":
            self.single("hallwall", 800, 60, args=(1600, 170, 150))
            self.single("hallwall", 60, L.h / 2, args=(120, 170, L.h + 200))
            self.single("hallwall", L.w - 60, L.h / 2, args=(120, 170, L.h + 200))
            for x in (300, 520, 1080, 1300):
                self.single("slit", x, 140, z=96)
            self.single("throne", 800, 200)
            for b in by("banner"):
                bn = self.single("banner", b["x"], 148, s=1.3, z=124)
            self.place("pillar", [dict(p, rot=0) for p in by("pillar")])
            self.make_heir()
        if L.theme == "vault":
            self.single("hallwall", 800, 40, args=(1600, 150, 110))
            self.single("hallwall", 40, L.h / 2, args=(110, 150, L.h + 160))
            self.single("hallwall", L.w - 40, L.h / 2, args=(110, 150, L.h + 160))
            self.place("pillar", [dict(p, rot=0) for p in by("pillar")])

        self.setup_lights()
        self.setup_ambience()

    def perimeter(self):
        L, R = self.L, self.R
        trees, pines = [], []
        for _ in range(70 if self.hi else 36):
            side = R()
            if side < 0.36:
                x, y = -20 - R() * 220, R() * (L.h + 100)
            elif side < 0.72:
                x, y = L.w + 20 + R() * 220, R() * (L.h + 100)
            else:
                x, y = R() * (L.w + 400) - 200, -20 - R() * 200
            if L.theme == "gate" and y < 0:
                continue
            it = dict(x=x, y=y, rot=R() * 6, s=1.1 + R() * 0.9)
            (pines if (L.theme == "wood" or R() < 0.3) else trees).append(it)
        if L.theme == "marsh":
            self.place("deadtree", trees + pines)
        else:
            self.place("tree", trees, 0)
            self.place("pine", pines)

    def make_pool(self, pool):
        R = Rng(int(pool["x"] * 7 + pool["y"]))
        m = Mesh()
        n = 22
        pts = []
        for i in range(n):
            a = i / n * math.tau
            r = pool["r"] * (0.86 + R() * 0.22)
            pts.append((math.cos(a) * r, -math.sin(a) * r, 0.4))
        verts = [(0, 0, 0.4)] + pts
        faces = [(0, 1 + (k + 1) % n, 1 + k) for k in range(n)]
        m._emit(verts, [(0, 0, 1)] * len(verts), [(0.5 + v[0] / 200, 0.5 + v[1] / 200) for v in verts], (1, 1, 1, 1), faces, xf((pool["x"], -pool["y"], 0)))
        np = m.build("pool")
        np.setTwoSided(True)
        np.setTexture(T.murk())
        np.setTransparency(TransparencyAttrib.MAlpha)
        np.setColorScale(1, 1, 1, 0.92)
        np.reparentTo(self.root)
        if self.hi:
            reeds = []
            for i in range(9):
                a = R() * math.tau
                reeds.append(dict(x=pool["x"] + math.cos(a) * pool["r"] * 0.98, y=pool["y"] + math.sin(a) * pool["r"] * 0.98, rot=R() * 6, s=0.8 + R() * 0.6))
            self.place("reeds", reeds)

    def make_river(self):
        L = self.L
        x0, x1 = L.river["x0"] - 3, L.river["x1"] + 3
        m = Mesh()
        m.quad((x0, -L.h, 0.45), (x1, -L.h, 0.45), (x1, 0, 0.45), (x0, 0, 0.45), uv=((0, 14), (2, 14), (2, 0), (0, 0)))
        np = m.build("river")
        tex = T.water()
        np.setTexture(tex)
        np.setTransparency(TransparencyAttrib.MAlpha)
        np.setColorScale(0.85, 0.95, 1.0, 0.85)
        ts = TextureStage.getDefault()
        np.reparentTo(self.root)
        self.updaters.append(lambda t, dt: np.setTexOffset(ts, t * 0.004, -t * 0.035))
        self.single("bridge", 800, L.bridge["y"], z=0.2)

    def make_brazier(self, x, y):
        self.single("brazier", x, y)
        flames = []
        for i in range(3):
            f = FX.flame(15, 26)
            f.reparentTo(self.root)
            f.setPos(*P3(x + (i - 1) * 2.4, y + (i % 2) * 2, 40 + i))
            flames.append(f)
        gl = self.glow(x, y, 42, (1.0, 0.55, 0.2), 95 if self.hi else 70, 0.5)
        self.fires.append((flames, gl, x, y, random.random() * 10))
        self.lights.append((x, y))

    def make_heir(self):
        from .characters import create
        # kneeling captive: reuse the knight rig without armour would be heavy; a small stand-in figure
        m = Mesh()
        m.lathe([(5.0, 0), (6.5, 4), (5.0, 12), (3.4, 16)], 10, xf((0, 0, 0)))
        body = m.build("heir")
        body.setTexture(T.cloth("#27406e", 1))
        body.reparentTo(self.root)
        body.setPos(*P3(800, 222, 30))
        head = Mesh().sphere(3.6, 10, 8, xf((0, 0, 19.5))).build("heirhead")
        head.setTexture(T.skin("#c99a7c", 5, 0.12, 20))
        head.reparentTo(body)
        crown = Mesh().cylinder(3.7, 3.7, 1.5, 10, xf((0, 0, 22.2))).build("crown")
        crown.setTexture(T.metal("#b08a30", 7, 10, rivets=False))
        crown.reparentTo(body)
        self.glow(800, 222, 52, (0.55, 0.65, 1.0), 70, 0.25)

    # --------------------------------------------------------------- lights & ambience
    def setup_lights(self):
        th = self.theme
        self.ambient = AmbientLight("amb")
        self.ambient.setColor(Vec4(*th["amb"], 1))
        self.ambient_np = self.root.attachNewNode(self.ambient)
        self.sun = DirectionalLight("sun")
        self.sun.setColor(Vec4(*th["sun"], 1))
        self.sun_np = self.root.attachNewNode(self.sun)
        self.sun_np.setHpr(th["hp"][0], th["hp"][1], 0)
        if self.hi:
            self.sun.setShadowCaster(True, 2048, 2048)
            lens = self.sun.getLens()
            lens.setFilmSize(560, 560)
            lens.setNearFar(20, 1400)
        self.fill = DirectionalLight("fill")
        self.fill.setColor(Vec4(th["amb"][0] * 0.5, th["amb"][1] * 0.5, th["amb"][2] * 0.6, 1))
        self.fill_np = self.root.attachNewNode(self.fill)
        self.fill_np.setHpr(150, -30, 0)
        self.point_nodes = []
        if self.hi and self.lights:
            for i in range(4):
                pl = PointLight(f"pl{i}")
                pl.setColor(Vec4(2.2, 1.15, 0.45, 1))
                pl.setAttenuation((1.0, 0.0, 0.00012))
                pn = self.root.attachNewNode(pl)
                pn.setPos(0, 0, -999)
                self.point_nodes.append(pn)

    def apply_lights(self, render):
        render.setLight(self.ambient_np)
        render.setLight(self.sun_np)
        render.setLight(self.fill_np)
        for pn in self.point_nodes:
            render.setLight(pn)
        fog = Fog("fog")
        fog.setColor(*self.theme["fog"])
        fog.setExpDensity(self.theme["dens"])
        render.setFog(fog)

    def setup_ambience(self):
        spec = AMB.get(self.L.theme)
        self.motes = []
        if not spec:
            return
        color, n, size, vy = spec
        n = n if self.hi else n // 2
        R = random.Random(7)
        for i in range(n):
            g = FX.glow(size, color, 0.8)
            g.reparentTo(self.root)
            self.motes.append([g, R.uniform(-450, 450), R.uniform(4, 130), R.uniform(-350, 350), R.uniform(0, 10)])
        self._vy = vy

    # --------------------------------------------------------------- per frame
    def update(self, t, dt, player, cam):
        for u in self.updaters:
            u(t, dt)
        for g, cx, cy, base, i in self.smokes:
            k = (t * 0.18 + i * 0.25) % 1
            g.setPos(*P3(cx + k * 14, cy - k * 6, base + k * 46))
            g.setScale(10 + k * 26)
            g.setColor(0.8, 0.8, 0.8, 0.3 * (1 - k))
        for flames, gl, x, y, seed in self.fires:
            for i, f in enumerate(flames):
                n = math.sin(t * 11 + seed + i * 2.1) * 0.5 + math.sin(t * 17 + i) * 0.3
                f.setScale(15 + n * 2.5, 1, 26 + n * 6)
                f.setPos(*P3(x + (i - 1) * 2.4 + n * 0.8, y + (i % 2) * 2, 40 + i + n * 1.5))
            gl.setColor(1.0, 0.55, 0.2, 0.5 + 0.1 * math.sin(t * 13 + seed))
        for m in self.motes:
            g, rx, rz, ry, seed = m
            rx += math.sin(t * 0.7 + seed) * 6 * dt
            rz += self._vy * dt * (0.6 + 0.4 * math.sin(seed + t * 0.5))
            ry += math.cos(t * 0.5 + seed) * 4 * dt
            if rz > 130:
                rz = 4
            rx = (rx + 450) % 900 - 450
            ry = (ry + 350) % 700 - 350
            m[1], m[2], m[3] = rx, rz, ry
            g.setPos(cam[0] + rx, cam[1] + ry, rz)
        if self.point_nodes and self.lights:
            near = sorted(self.lights, key=lambda b: (b[0] - player.x) ** 2 + (b[1] - player.y) ** 2)
            for i, pn in enumerate(self.point_nodes):
                if i < len(near):
                    b = near[i]
                    pn.setPos(*P3(b[0], b[1], 56))
                    pn.node().setColor(Vec4(2.2 * (0.92 + 0.08 * math.sin(t * 9 + i)), 1.15, 0.45, 1))
                else:
                    pn.setPos(0, 0, -999)

    def height_at(self, x, y):
        b = self.L.bridge
        if b and b["x0"] + 4 < x < b["x1"] - 4 and abs(y - b["y"]) < b["w"] / 2:
            return 3.8
        return 0.0

    def destroy(self):
        self.root.removeNode()
