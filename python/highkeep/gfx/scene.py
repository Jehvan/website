"""SceneRenderer: mirrors Game state into the 3D scene (entities, projectiles, telegraphs, loot, fx) and drives the camera."""
import math

from panda3d.core import (NodePath, Plane, Point3, Vec3, Vec4, TextNode, LPoint3, Fog, DirectionalLight)

from . import effects as FX
from . import textures as T
from .characters import create as create_char, set_outline
from .meshlib import Mesh, xf
from . import materials as M
from .post import Post
from .world3d import World, THEMES, P3
from ..data import RARITIES
from ..world import build_town
from types import SimpleNamespace
from ..items import rarity_of

TILT = math.radians(47)


class NP(NodePath):
    """NodePath that can carry extra attributes."""


def hd(face):
    """Panda heading from a world angle (world y points south)."""
    return -math.degrees(face) - 90


class SceneRenderer:
    def __init__(self, base, settings):
        self.base = base
        self.settings = settings
        self.quality = settings.get("quality", "high")
        self.render = base.render
        self.stage_root = NodePath("stage")
        self.stage_root.reparentTo(self.render)
        self.world = None
        self.hub = None
        self.hub_key = None
        self.player_vis = None
        self.enemy_vis = {}
        self.proj_vis, self.zone_vis, self.pick_vis, self.fx_vis = {}, {}, {}, {}
        self.cam_target = Vec3(800, -575, 0)
        self.cam_init = False
        self.cam_dist = 700
        self.post = None
        self.dyn = self.stage_root.attachNewNode("dyn")
        self.render.setShaderAuto()
        base.camLens.setNearFar(20, 4200)
        self._ground = Plane(Vec3(0, 0, 1), Point3(0, 0, 0))
        try:
            self.post = Post(base)
        except Exception as ex:                                      # noqa: BLE001
            print("post-processing disabled:", ex)
        self.resize()

    # ------------------------------------------------------------ setup
    def clear(self):
        for m in (self.enemy_vis, self.proj_vis, self.zone_vis, self.pick_vis, self.fx_vis):
            for v in m.values():
                (v.root if hasattr(v, "root") else v).removeNode()
            m.clear()
        if self.player_vis:
            self.player_vis.root.removeNode()
            self.player_vis = None
        if getattr(self, "hub", None):
            self.hub.vis.root.removeNode()
        for v in getattr(self, "hub_npcs", []):
            v[0].root.removeNode()
        self.hub_npcs = []
        self.hub = None
        self.hub_key = None
        self.base.camLens.setFilmOffset(0, 0)
        if self.world:
            self.render.clearLight()
            self.render.clearFog()
            self.world.destroy()
            self.world = None

    def set_stage(self, game):
        self.clear()
        set_outline(self.quality == "high")
        self.world = World(self.base, game.L, self.quality)
        self.world.root.reparentTo(self.stage_root)
        self.world.apply_lights(self.render)
        th = self.world.theme
        self.base.setBackgroundColor(*th["fog"])
        if self.post:
            self.post.set_grade(exposure=th["exp"], bloom=th["bloom"], vignette=th["vig"], grain=0.02,
                                tint=(1.0, 0.94, 0.9) if not game.L.indoor else (1.0, 0.92, 0.95), sat=1.06 if not game.L.indoor else 0.9)
        self.player_vis = create_char(game.save["cls"])
        self.player_vis.root.reparentTo(self.dyn)
        self.cam_init = False

    def set_quality(self, q):
        self.quality = q

    def resize(self):
        w, h = self.base.win.getXSize(), self.base.win.getYSize()
        self.W, self.H = max(1, w), max(1, h)
        asp = self.W / self.H
        vfov = 38.0
        self.base.camLens.setFov(2 * math.degrees(math.atan(math.tan(math.radians(vfov / 2)) * asp)), vfov)
        target_w = min(700, 540 + asp * 55) if asp >= 1 else 440
        self.cam_dist = max(520, min(1500, target_w / (2 * math.tan(math.radians(vfov / 2)) * min(asp, 1.9) )))
        if self.post:
            self.post.resize()

    # ------------------------------------------------------------ helpers
    def screen_to_world(self, mx, my):
        """mx,my in pixels -> world (x, y_south)."""
        nx, ny = (mx / self.W) * 2 - 1, -((my / self.H) * 2 - 1)
        near, far = Point3(), Point3()
        self.base.camLens.extrude((nx, ny), near, far)
        n = self.render.getRelativePoint(self.base.cam, near)
        f = self.render.getRelativePoint(self.base.cam, far)
        out = Point3()
        if self._ground.intersectsLine(out, n, f):
            return out.x, -out.y
        return self.cam_target.x, -self.cam_target.y

    def project(self, x, y, z=0.0):
        """World coords -> pixel coords, or None if behind the camera."""
        p3 = self.base.cam.getRelativePoint(self.render, Point3(*P3(x, y, z)))
        p2 = Point3()
        if not self.base.camLens.project(p3, p2):
            return None
        return (p2.x * 0.5 + 0.5) * self.W, (-p2.y * 0.5 + 0.5) * self.H

    # ------------------------------------------------------------ frame
    def render_frame(self, game, dt):
        if not self.world:
            return
        p, L, t = game.p, game.L, game.time
        # camera
        asp = self.W / self.H
        half_w = min(800.0, self.cam_dist * math.tan(math.radians(19)) * asp * 0.8)
        half_h = min(575.0, self.cam_dist * 0.42)
        tx = max(half_w, min(L.w - half_w, p.x))
        ty = max(half_h, min(L.h - half_h, p.y))
        if not self.cam_init:
            self.cam_target.set(tx, -ty, 0)
            self.cam_init = True
        k = 1 - 0.0008 ** dt
        self.cam_target.x += (tx - self.cam_target.x) * k
        self.cam_target.y += (-ty - self.cam_target.y) * k
        sh = game.shake
        import random
        ox = (random.random() - 0.5) * sh if sh else 0
        oz = (random.random() - 0.5) * sh * 0.5 if sh else 0
        ct = self.cam_target
        self.base.camera.setPos(ct.x + ox, ct.y - math.cos(TILT) * self.cam_dist, math.sin(TILT) * self.cam_dist + oz)
        self.base.camera.lookAt(ct.x, ct.y + 20, 0)
        # light follows the action
        if self.world.hi:
            self.world.sun_np.setPos(ct.x - 300, ct.y - 220, 520)
            self.world.sun_np.lookAt(ct.x, ct.y, 0)
        self.world.update(t, dt, p, (ct.x, ct.y))

        # player
        pv = self.player_vis
        pv.root.setPos(*P3(p.x, p.y, self.world.height_at(p.x, p.y)))
        pv.root.setH(hd(p.face))
        pv.update(p, dt, t, True)
        pv.flash(p.hit_t > 0.1 and not p.dead)

        # enemies
        seen = set()
        for e in game.enemies:
            seen.add(e.id)
            v = self.enemy_vis.get(e.id)
            if v is None:
                v = create_char(e.type)
                v.root.reparentTo(self.dyn)
                self.enemy_vis[e.id] = v
            v.root.setPos(*P3(e.x, e.y, self.world.height_at(e.x, e.y)))
            v.root.setH(hd(e.face))
            sp = 1 - e.spawn_t / 0.7 if e.spawn_t > 0 else 1
            v.root.setScale(0.4 + 0.6 * min(1, sp * 1.3))
            v.update(e, dt, t, False)
            v.flash(e.hit_t > 0.09)
        for i in [i for i in self.enemy_vis if i not in seen]:
            self.enemy_vis.pop(i).root.removeNode()

        self.sync_projectiles(game)
        self.sync_zones(game, t)
        self.sync_pickups(game, t)
        self.sync_fx(game)
        if self.post:
            self.post.update(t)


    # ------------------------------------------------------------ town hub
    HUB_NPCS = (("knight", (0.75, 0.8, 1.0), [(500, 560), (600, 700)], 0), ("knight", (1.0, 0.85, 0.7), [(1100, 560), (1180, 700)], 1),
                ("ranger", (1.0, 0.95, 0.8), [(720, 470), (900, 470)], 2), ("mage", (0.9, 0.8, 1.0), [(1050, 640), (1050, 560)], 3),
                ("ranger", (0.8, 1.0, 0.8), [(560, 760), (680, 700)], 4), ("knight", (0.9, 0.9, 0.9), [(800, 330), (880, 360)], 5))

    def set_hub(self, cls, side=True):
        """Show the town hub behind the title/camp UI. side=True shifts the plaza to the lower-left (camp), else centres it."""
        self.clear()
        L = build_town()
        set_outline(self.quality == "high")
        self.world = World(self.base, L, self.quality)
        self.world.root.reparentTo(self.stage_root)
        self.world.apply_lights(self.render)
        th = self.world.theme
        self.base.setBackgroundColor(*th["fog"])
        if self.post:
            self.post.set_grade(exposure=th["exp"], bloom=th["bloom"], vignette=th["vig"], grain=0.02, tint=(1.0, 0.94, 0.9), sat=1.06)
        self.hub = SimpleNamespace(t=0.0, side=side, hero=SimpleNamespace(x=770, y=800, state="idle", dead=False, skill_anim=None, atk_t=-1, type="hero", skill_t=0, face=math.pi / 2, hit_t=9, dead_t=0, charge_phase=0, attach=None))
        self.hub.vis = create_char(cls)
        self.hub.vis.root.reparentTo(self.dyn)
        self.hub_npcs = []
        for kind, col, way, i in self.HUB_NPCS:
            v = create_char(kind)
            v.root.reparentTo(self.dyn)
            v.root.setColorScale(*col, 1)
            e = SimpleNamespace(x=way[0][0], y=way[0][1], state="idle", dead=False, skill_anim=None, atk_t=-1, type="npc", skill_t=0, face=0.0, hit_t=9, dead_t=0, charge_phase=0, attach=None, way=way, wi=0, wait=i * 1.3)
            self.hub_npcs.append((v, e))
        self.cam_init = False

    def render_hub(self, dt):
        h = self.hub
        if not h or not self.world:
            return
        h.t += dt
        t = h.t
        fw, fh = self.base.camLens.getFilmSize()
        if h.side:
            self.base.camLens.setFilmOffset(0.28 * fw, 0.2 * fh)
        else:
            self.base.camLens.setFilmOffset(0, 0)
        tilt = math.radians(42)
        cx, cy = 800 + math.sin(t * 0.12) * 18, 610
        dist = self.cam_dist * 1.55
        self.base.camera.setPos(cx, -cy - math.cos(tilt) * dist, math.sin(tilt) * dist)
        self.base.camera.lookAt(cx, -cy, 0)
        if self.world.hi:
            self.world.sun_np.setPos(cx - 300, -cy - 220, 520)
            self.world.sun_np.lookAt(cx, -cy, 0)
        self.world.update(t, dt, h.hero, (cx, -cy))
        hero = h.hero
        h.vis.root.setPos(*P3(hero.x, hero.y, 0))
        h.vis.root.setH(hd(hero.face))
        h.vis.update(hero, dt, t, True)
        for v, e in self.hub_npcs:
            if e.wait > 0:
                e.wait -= dt
                e.state = "idle"
            else:
                tx, ty = e.way[e.wi]
                d = math.hypot(tx - e.x, ty - e.y)
                if d < 6:
                    e.wi = (e.wi + 1) % len(e.way)
                    e.wait = 3 + (e.wi * 1.7) % 4
                else:
                    e.x += (tx - e.x) / d * 38 * dt
                    e.y += (ty - e.y) / d * 38 * dt
                    e.face = math.atan2(ty - e.y, tx - e.x)
            v.root.setPos(*P3(e.x, e.y, 0))
            v.root.setH(hd(e.face))
            v.update(e, dt, t, False)
        if self.post:
            self.post.update(t)

    # ------------------------------------------------------------ projectiles
    def make_proj(self, q):
        g = NP("proj")
        g.obj = q
        if q.kind in ("bolt", "orb"):
            core = Mesh().sphere(6.0 if q.kind == "bolt" else 5.5, 8, 6).build("core")
            M.apply(core, "orb")
            core.reparentTo(g)
            gl = FX.glow(56, (1.0, 0.45, 0.12) if q.kind == "bolt" else (1.0, 0.3, 0.08), 0.9)
            gl.reparentTo(g)
        else:
            m = Mesh()
            m.box((0.7, 26, 0.7), xf((0, 0, 0)))
            m.cone(1.4, 7, 5, xf((0, 14.5, 0), (0, -90, 0)))
            np = m.build("arrow")
            M.apply(np, "wood" if q.team == "p" else "wood_dark")
            np.reparentTo(g)
            fl = Mesh().box((0.2, 6, 3.0), xf((0, -11, 0))).build("fl")
            M.apply(fl, "cloth_red" if q.team == "p" else "cloth_black")
            fl.reparentTo(g)
            if q.team == "e":
                FX.glow(22, (1.0, 0.45, 0.15), 0.7).reparentTo(g)
        g.reparentTo(self.dyn)
        return g

    def sync_projectiles(self, game):
        seen = set()
        for q in game.proj:
            seen.add(id(q))
            g = self.proj_vis.get(id(q))
            if g is None:
                g = self.proj_vis[id(q)] = self.make_proj(q)
            g.setPos(*P3(q.x, q.y, 20))
            g.setH(hd(math.atan2(q.vy, q.vx)))
        for k_ in [k_ for k_ in self.proj_vis if k_ not in seen]:
            self.proj_vis.pop(k_).removeNode()

    # ------------------------------------------------------------ zones
    def make_zone(self, z):
        g = NP("zone")
        g.obj = z
        if z.kind == "line":
            m = Mesh().box((1, 1, 0.5)).build("line")
            m.setColor(1.0, 0.2, 0.12, 0.4)
            FX._finish(m, additive=False)
            m.reparentTo(g)
            g.line = m
        else:
            col = (0.72, 0.85, 0.3) if z.kind == "rain" else (1.0, 0.45, 0.12) if z.team == "p" else (0.9, 0.12, 0.1)
            g.disc = FX.disc(col, 0.2)
            g.ring = FX.ring(col, 0.9, 0.93)
            g.fill = FX.disc(col, 0.3)
            for n in (g.disc, g.ring, g.fill):
                n.setScale(z.r, z.r, 1)
                n.reparentTo(g)
            if z.kind == "meteor":
                rock = Mesh().sphere(1.0, 9, 7).build("rock")
                M.apply(rock, "orb")
                rock.setScale(26)
                rock.reparentTo(g)
                g.rock = rock
                g.mglow = FX.glow(150, (1.0, 0.45, 0.12), 0.9)
                g.mglow.reparentTo(g)
            if z.kind == "rain":
                g.arrows = []
                for i in range(16):
                    a = Mesh().box((0.9, 0.9, 20)).build("a")
                    M.apply(a, "blade")
                    a.reparentTo(g)
                    g.arrows.append((a, (i * 7.31) % 10))
        g.reparentTo(self.dyn)
        return g

    def sync_zones(self, game, t):
        seen = set()
        for z in game.zones:
            seen.add(id(z))
            g = self.zone_vis.get(id(z))
            if g is None:
                g = self.zone_vis[id(z)] = self.make_zone(z)
            if z.kind == "line":
                dx, dy = z.x2 - z.x, z.y2 - z.y
                ln = math.hypot(dx, dy)
                g.setPos(*P3(z.x + dx / 2, z.y + dy / 2, 1.2))
                g.setH(hd(math.atan2(dy, dx)))
                g.line.setScale(z.w, ln, 1)
                g.line.setColor(1.0, 0.2, 0.12, 0.18 + 0.3 * min(1, z.t / max(z.delay, 0.01)) * (0.7 + 0.3 * math.sin(t * 30)))
                continue
            g.setPos(*P3(z.x, z.y, 0.8))
            k = min(1.0, z.t / z.delay) if z.delay else 1.0
            fired = z.fired or (z.kind == "rain" and z.t > z.dur - 0.3)
            fade = (min(1, (z.dur - z.t) * 3, z.t * 4) if z.kind == "rain" else (max(0.0, 1 - (z.t - z.delay) / 0.35) if fired else 1.0))
            col = g.ring.getColor()
            g.disc.setColor(col[0], col[1], col[2], (0.16 + 0.14 * k) * fade)
            g.ring.setColor(col[0], col[1], col[2], (0.55 + 0.4 * k) * fade)
            g.fill.setScale(max(0.01, z.r * k), max(0.01, z.r * k), 1)
            g.fill.setColor(col[0], col[1], col[2], (0.1 if z.kind == "rain" else 0.32) * fade)
            if z.kind == "meteor":
                kk = min(1.0, z.t / z.delay)
                pos = (-(1 - kk) * 200, (1 - kk) * 200, 640 * (1 - kk * kk) + 20)
                g.rock.setPos(*pos)
                g.mglow.setPos(*pos)
                g.rock.setHpr(t * 200, t * 150, 0)
                g.rock.setShaderOff(1) if False else None
                if z.fired:
                    g.rock.hide()
                    g.mglow.hide()
            if z.kind == "rain":
                for a, seed in g.arrows:
                    ph = (t * 2.4 + seed) % 1
                    ang = seed * 97.3 + math.floor(t * 2.4 + seed) * 31.7
                    rr = math.sqrt(math.sin(ang * 12.9898) * 0.5 + 0.5) * z.r * 0.95
                    th = (math.sin(ang * 78.233) * 0.5 + 0.5) * math.tau
                    a.setPos(math.cos(th) * rr, math.sin(th) * rr, 180 * (1 - ph))
                    a.setScale(1) if fade > 0.05 else a.hide()
        for k_ in [k_ for k_ in self.zone_vis if k_ not in seen]:
            self.zone_vis.pop(k_).removeNode()

    # ------------------------------------------------------------ pickups
    def make_pickup(self, pk):
        g = NP("pk")
        g.obj = pk
        bob = g.attachNewNode("bob")
        g.bob = bob
        if pk.kind == "gold":
            m = Mesh().cylinder(5, 5, 1.8, 14, xf((0, 0, 0), (0, 90, 0))).build("coin")
            M.apply(m, "gold")
            m.reparentTo(bob)
            FX.glow(30, (1.0, 0.8, 0.25), 0.6).reparentTo(g)
        elif pk.kind == "potion":
            m = Mesh().sphere(5.2, 10, 8, xf((0, 0, 5))).cylinder(1.6, 1.6, 5, 8, xf((0, 0, 9))).build("pot")
            m.setColor(0.85, 0.12, 0.22, 1)
            m.setLightOff(1)
            m.setShaderOff(1)
            m.reparentTo(bob)
            cork = Mesh().cylinder(2.0, 2.0, 2.4, 8, xf((0, 0, 14))).build("cork")
            M.apply(cork, "wood")
            cork.reparentTo(bob)
            FX.glow(36, (1.0, 0.3, 0.4), 0.7).reparentTo(g)
        else:
            rc = rarity_of(pk.item["rarity"])["color"]
            gem = Mesh().sphere(5.5, 4, 2, xf((0, 0, 0), (0, 0, 0), (1, 1, 1.4))).build("gem")
            gem.setColor(rc[0], rc[1], rc[2], 1)
            gem.setLightOff(1)
            gem.setShaderOff(1)
            gem.reparentTo(bob)
            beam = FX.beam(rc, 0.25, 4, 90)
            beam.reparentTo(g)
            FX.glow(60, rc, 0.8).reparentTo(g)
        g.reparentTo(self.dyn)
        return g

    def sync_pickups(self, game, t):
        seen = set()
        for pk in game.pickups:
            seen.add(id(pk))
            g = self.pick_vis.get(id(pk))
            if g is None:
                g = self.pick_vis[id(pk)] = self.make_pickup(pk)
            g.setPos(*P3(pk.x, pk.y, self.world.height_at(pk.x, pk.y)))
            g.bob.setZ(14 + math.sin(t * 3 + pk.x) * 3)
            g.bob.setH(math.degrees(t * 2 + pk.x))
            g.setScale(min(1.0, pk.t * 4) or 0.01)
        for k_ in [k_ for k_ in self.pick_vis if k_ not in seen]:
            self.pick_vis.pop(k_).removeNode()

    # ------------------------------------------------------------ fx
    def make_fx(self, f):
        g = NP("fx")
        g.obj = f
        col = f.color
        if f.type in ("ring", "nova"):
            g.a = FX.additive_ring(col, 1.0, 0.9)
            g.b = FX.disc(col, 0.25)
            g.a.reparentTo(g)
            g.b.reparentTo(g)
        elif f.type == "burst":
            g.a = FX.additive_ring((1.0, 0.88, 0.62), 1.0, 0.88)
            g.b = FX.disc(col, 0.35)
            g.s = FX.glow(1, col, 0.9)
            for n in (g.a, g.b, g.s):
                n.reparentTo(g)
        elif f.type == "slash":
            g.a = FX.arc_mesh(f.arc)
            g.a.setColor(col[0], col[1], col[2], 0.9)
            FX._finish(g.a, True)
            g.a.reparentTo(g)
        elif f.type == "blink":
            g.a = FX.beam(col, 0.7, 1, 1)
            g.a.reparentTo(g)
            g.s = FX.glow(70, col, 0.9)
            g.s.reparentTo(g)
        elif f.type == "spawn":
            g.a = FX.beam(col, 0.3, 1, 1)
            g.b = FX.additive_ring(col, 1.0, 0.85)
            g.s = FX.glow(60, col, 0.8)
            for n in (g.a, g.b, g.s):
                n.reparentTo(g)
        else:   # trail
            g.s = FX.glow(40, col, 0.8)
            g.s.reparentTo(g)
        g.reparentTo(self.dyn)
        return g

    def sync_fx(self, game):
        seen = set()
        for f in game.fx:
            seen.add(id(f))
            g = self.fx_vis.get(id(f))
            if g is None:
                g = self.fx_vis[id(f)] = self.make_fx(f)
            k = f.t / f.dur
            op = 1 - k
            ease = 1 - (1 - k) * (1 - k)
            g.setPos(*P3(f.x, f.y, 1.5))
            col = f.color
            if f.type in ("ring", "nova"):
                s = f.r * (0.25 + 0.75 * ease)
                g.a.setScale(s, s, 1)
                g.b.setScale(s, s, 1)
                g.a.setColor(col[0], col[1], col[2], op)
                g.b.setColor(col[0], col[1], col[2], 0.28 * op)
            elif f.type == "burst":
                s = f.r * (0.2 + 0.8 * ease)
                g.a.setScale(s, s, 1)
                g.b.setScale(s, s, 1)
                g.s.setScale(s * 2.4)
                g.s.setZ(s * 0.3)
                g.a.setColor(1, 0.88, 0.62, op)
                g.b.setColor(col[0], col[1], col[2], 0.35 * op)
                g.s.setColor(col[0], col[1], col[2], 0.9 * op)
            elif f.type == "slash":
                g.setH(hd(f.ang) + 90 - 90)
                g.setPos(*P3(f.x, f.y, 18))
                g.a.setScale(f.range, f.range, 1)
                g.a.setColor(col[0], col[1], col[2], 0.9 * op)
            elif f.type == "blink":
                g.a.setScale(14 * (1 - k), 14 * (1 - k), 90)
                g.a.setColor(col[0], col[1], col[2], 0.7 * op)
                g.s.setZ(30)
                g.s.setColor(col[0], col[1], col[2], op)
            elif f.type == "spawn":
                g.a.setScale(9 * (1 - k * 0.5), 9 * (1 - k * 0.5), 80 * ease + 10)
                g.b.setScale(32 * (1 - k * 0.6), 32 * (1 - k * 0.6), 1)
                g.a.setColor(col[0], col[1], col[2], 0.35 * op)
                g.b.setColor(col[0], col[1], col[2], op)
                g.s.setZ(24)
            else:
                g.setZ(18)
                g.s.setScale(40 * (1 - k * 0.5))
                g.s.setColor(col[0], col[1], col[2], 0.8 * op)
        for k_ in [k_ for k_ in self.fx_vis if k_ not in seen]:
            self.fx_vis.pop(k_).removeNode()
