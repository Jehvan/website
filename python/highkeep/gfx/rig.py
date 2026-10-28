"""Jointed humanoid rig built from procedural parts + a pose animator driven by simulation state.

Panda3D axes: +Y forward, +Z up, +X is the character's RIGHT. Angles here are degrees:
  shoulder/hip pitch  : positive swings the limb FORWARD
  elbow flex          : positive bends the forearm forward/up
  knee flex           : positive bends the shin backward
"""
import math

from panda3d.core import NodePath, Vec3

from .meshlib import Mesh, xf
from . import materials as M

CLAMP = lambda v, a, b: max(a, min(b, v))
LERP = lambda a, b, t: a + (b - a) * t
EASE = lambda t: t * t * (3 - 2 * t)


class Batch:
    """Per-joint collection of meshes keyed by material name; builds one node per material."""

    def __init__(self):
        self.meshes = {}

    def mesh(self, style):
        if style not in self.meshes:
            self.meshes[style] = Mesh()
        return self.meshes[style]


class Rig:
    JOINTS = ("body", "hips", "spine", "chest", "head", "thighL", "kneeL", "thighR", "kneeR", "shoulderL", "elbowL",
              "wristL", "shoulderR", "elbowR", "wristR")

    def __init__(self, scale=1.0, bulk=1.0, leg=1.0, arm=1.0):
        self.scale, self.bulk, self.leg, self.arm = scale, bulk, leg, arm
        self.root = NodePath("rig")
        self.batches = {}
        self.J = {}
        self.cfg = {}
        self.extra_update = None
        self._build_skeleton()

    # hierarchy: body > hips > {thigh > knee, spine > {chest > head, shoulder > elbow > wrist}}
    def _build_skeleton(self):
        b, ls, A = self.bulk, self.leg, self.arm
        mk = lambda name, parent, pos=(0, 0, 0): self._joint(name, parent, pos)
        body = mk("body", self.root)
        self.leg_h = 26 * ls
        hips = mk("hips", body, (0, 0, self.leg_h))
        spine = mk("spine", hips, (0, 0, 2.5))
        chest = mk("chest", spine, (0, 0, 17))
        head = mk("head", chest, (0, 0, 2.6))
        for side, sx in (("L", -1), ("R", 1)):
            th = mk("thigh" + side, hips, (sx * 4.2 * b, 0, -0.5))
            mk("knee" + side, th, (0, 0, -13 * ls))
            sh = mk("shoulder" + side, spine, (sx * (8.4 * b + 1.8), 0, 14.8))
            el = mk("elbow" + side, sh, (0, 0, -9.5 * A))
            mk("wrist" + side, el, (0, 0, -9 * A))

    def _joint(self, name, parent, pos):
        np = parent.attachNewNode(name)
        np.setPos(*pos)
        self.J[name] = np
        self.batches[name] = Batch()
        return np

    # ------------------------------------------------------------ geometry helpers
    def part(self, joint, style):
        """Mesh for (joint, material) in joint-local coordinates."""
        return self.batches[joint].mesh(style)

    def limb(self, joint, style, length, r0, r1, seg=10, m=None, bulge=0.0, color=(1, 1, 1, 1)):
        """Tapered limb hanging down from the joint (z 0 .. -length)."""
        mid = (r0 + r1) / 2 * (1 + bulge)
        prof = [(r1, -length), (mid, -length * 0.5), (r0, 0)]
        self.part(joint, style).lathe(prof, seg, m, color)

    def finish(self):
        """Build the batched geometry nodes and attach them to their joints."""
        for name, batch in self.batches.items():
            for style, mesh in batch.meshes.items():
                if len(mesh) == 0:
                    continue
                np = mesh.build(f"{name}_{style}")
                np.reparentTo(self.J[name])
                M.apply(np, style)
        self.root.setScale(self.scale)
        self.base_hip_z = self.leg_h
        return self

    def clone(self):
        c = Rig.__new__(Rig)
        c.__dict__.update(self.__dict__)
        c.root = self.root.copyTo(NodePath("inst"))
        c.J = {n: c.root.find("**/" + n) for n in self.J}
        c.extras = {}
        return c


class Animator:
    """Drives a rig's joints from entity state (position deltas -> walk cycle, atk_t -> swings, etc.)."""

    def __init__(self, rig, cfg):
        self.rig, self.cfg = rig, cfg
        self.phase = (id(self) % 100) / 10.0
        self.mv = 0.0
        self.last = None
        self.state, self.state_t = "", 0.0
        self.prev_wind = False
        self.boss_act = "slam"
        self.base_hip = rig.leg_h

    def apply(self, ent, dt, t, is_player):
        J, cfg = self.rig.J, self.cfg
        if self.last is None:
            self.last = (ent.x, ent.y)
        spd = math.hypot(ent.x - self.last[0], ent.y - self.last[1]) / dt if dt > 0 else 0
        self.last = (ent.x, ent.y)
        target = CLAMP(spd / cfg.get("run_ref", 110), 0, 1.4)
        self.mv += (target - self.mv) * CLAMP(dt * 12, 0, 1)
        mv = self.mv
        self.phase += dt * (3.2 + spd * cfg.get("stride", 0.052)) * (1 if mv > 0.05 else 0.3)
        ph = self.phase
        if ent.state != self.state:
            self.state, self.state_t = ent.state, 0.0
        self.state_t += dt

        # ---- reset to the base pose + walk cycle
        body, hips, spine, chest, head = J["body"], J["hips"], J["spine"], J["chest"], J["head"]
        body.setPosHpr(0, 0, 0, 0, 0, 0)
        body.setScale(1)
        hips.setPosHpr(0, 0, self.base_hip - 0.5 + abs(math.sin(ph)) * 1.4 * mv, math.degrees(math.sin(ph) * 0.1 * mv), 0, 0)
        spine.setHpr(math.degrees(-math.sin(ph) * 0.12 * mv), -math.degrees(0.08 * mv + cfg.get("hunch", 0)), 0)
        chest.setHpr(0, 0, 0)
        chest.setSz(1 + math.sin(t * 2.1) * 0.012)
        head.setHpr(math.degrees(math.sin(t * 0.7 + self.phase) * 0.05 * (1 - mv)), math.degrees(0.06 * mv), 0)
        A = 0.78 * mv
        deg = math.degrees
        J["thighL"].setHpr(0, -deg(math.sin(ph) * A), 0)
        J["thighR"].setHpr(0, deg(math.sin(ph) * A), 0)
        J["kneeL"].setHpr(0, -deg(0.12 + max(0, -math.cos(ph)) * 1.0 * mv), 0)
        J["kneeR"].setHpr(0, -deg(0.12 + max(0, math.cos(ph)) * 1.0 * mv), 0)
        iR, iL = cfg.get("idle_r", (0.3, 0.9, 0)), cfg.get("idle_l", (0.1, 0.5, 0))
        breath = math.sin(t * 2.1) * 0.03
        self._arm("R", iR[0] - math.sin(ph) * 0.55 * mv - breath, iR[1] + 0.2 * mv, iR[2])
        self._arm("L", iL[0] + math.sin(ph) * 0.55 * mv + breath, iL[1] + 0.2 * mv, iL[2])

        style = cfg.get("style")
        dead = ent.dead
        skill = ent.skill_anim if is_player else None
        strike = wind = 0.0
        if is_player:
            if ent.atk_t >= 0 and not skill:
                strike = ent.atk_t
        else:
            if ent.state == "windup":
                wind = CLAMP(ent.atk_t, 0, 1)
                self.prev_wind = True
            elif ent.state == "recover" and self.state_t < 0.3 and self.prev_wind:
                strike = self.state_t / 0.3
            elif ent.state != "recover":
                self.prev_wind = False
            if ent.type == "regent":
                if ent.state in ("slam", "orbs", "summon", "charge"):
                    wind, self.boss_act, self.prev_wind = CLAMP(ent.atk_t, 0, 1), ent.state, True
                if ent.state == "recover" and self.state_t < 0.35 and self.prev_wind:
                    strike = self.state_t / 0.35
                if ent.state == "idle":
                    self.prev_wind = False
        act = self.boss_act if ent.type == "regent" else ""
        sw = lambda a, b, k: LERP(a, b, EASE(CLAMP(k, 0, 1)))

        if not dead:
            if is_player and skill:
                self._skill(skill, ent.skill_t, t)
            elif style == "slash":
                if is_player and ent.atk_t >= 0:
                    k = ent.atk_t
                    self._arm("R", sw(2.1, 0.9, k), sw(0.7, 0.15, k), sw(-0.5, 0.3, k))
                    spine.setH(deg(sw(-0.95, 0.95, k)))
                    spine.setP(-deg(0.12))
                    hips.setH(deg(sw(-0.4, 0.4, k)))
                    self._arm("L", 0.9, 0.9, 0.3)
                    body.setY(math.sin(k * math.pi) * 2.5)
            elif style == "club":
                if wind > 0:
                    self._arm("R", sw(0.3, 2.8, wind), sw(0.9, 0.5, wind), 0)
                    spine.setP(-deg(sw(0, -0.28, wind)))
                    self._arm("L", sw(0.1, 0.9, wind), 0.5, 0.3)
                elif strike > 0:
                    self._arm("R", sw(2.8, -0.1, strike), sw(0.5, 0.25, strike), 0)
                    spine.setP(-deg(sw(-0.28, 0.55, strike)))
                    self._arm("L", 0.5, 0.5, 0.3)
                    body.setY(3 * EASE(strike))
            elif style == "bow":
                k = None
                if wind > 0:
                    k = wind
                elif strike > 0:
                    k = 1 - strike * 1.2
                elif is_player and ent.atk_t >= 0:
                    a = ent.atk_t
                    k = a / 0.7 if a < 0.7 else 1 - (a - 0.7) / 0.3 * 0.9
                if k is not None:
                    self._arm("L", 1.55, 0.05, -0.05)
                    self._arm("R", 1.45 * CLAMP(k * 1.3, 0, 1), sw(0.2, 2.25, k), 0.1)
                    spine.setH(deg(-0.5))
                    head.setH(deg(0.4))
            elif style == "cast":
                if is_player and ent.atk_t >= 0:
                    k = ent.atk_t
                    self._arm("R", sw(2.2, 1.35, k), sw(0.6, 0.15, k), 0.25)
                    self._arm("L", sw(1.0, 1.5, k), 0.3, 0.3)
                    spine.setP(-deg(sw(-0.12, 0.2, k)))
            elif style == "slam":
                if wind > 0:
                    if act in ("orbs", "summon"):
                        self._arm("R", sw(0.3, 2.9, wind), 0.3, 0.35)
                        self._arm("L", sw(0.1, 2.7, wind), 0.3, 0.35)
                        spine.setP(-deg(sw(0, -0.3, wind)))
                        head.setP(-deg(-0.3 * wind))
                    elif act == "charge":
                        spine.setP(-deg(sw(0, 0.55, wind)))
                        body.setZ(-3 * wind)
                        self._arm("R", sw(0.3, -0.9, wind), 0.3, 0)
                        self._arm("L", sw(0.1, -0.9, wind), 0.3, 0)
                    else:
                        self._arm("R", sw(0.3, 3.0, wind), sw(0.9, 0.4, wind), 0.18)
                        self._arm("L", sw(0.1, 2.9, wind), sw(0.6, 0.4, wind), 0.18)
                        spine.setP(-deg(sw(0, -0.4, wind)))
                elif strike > 0:
                    self._arm("R", sw(3.0, 0.1, strike), 0.3, 0.1)
                    self._arm("L", sw(2.9, 0.1, strike), 0.3, 0.1)
                    spine.setP(-deg(sw(-0.4, 0.6, strike)))
                    body.setZ(-3 * math.sin(strike * math.pi))
                    body.setY(5 * EASE(strike))
                if act == "charge" and ent.state == "charge" and ent.charge_phase == 1:
                    spine.setP(-deg(0.6))
                    self._arm("R", -0.9, 0.3, 0)
                    self._arm("L", -0.9, 0.3, 0)
                    J["thighL"].setP(deg(math.sin(t * 28) * 0.9))
                    J["thighR"].setP(deg(-math.sin(t * 28) * 0.9))

        hk = (ent.hit_t / 0.22) if is_player else (ent.hit_t / 0.16)
        if hk > 0 and not dead:
            body.setP(body.getP() + deg(0.28 * CLAMP(hk, 0, 1)))
            body.setY(body.getY() - 2 * CLAMP(hk, 0, 1))
        if dead:
            dt_ = ent.dead_t if is_player else ent.dead_t
            k = EASE(CLAMP(dt_ / 0.55, 0, 1))
            body.setP(deg(-1.5 * k) * -1)       # fall backwards
            body.setZ(5.5 * k)
            body.setY(-8 * k)
            self._arm("L", -0.4 * k, 0, 1.2 * k)
            self._arm("R", -0.2 * k, 0, 1.2 * k)
            J["kneeL"].setP(deg(-0.4 * k))
            J["kneeR"].setP(deg(-0.6 * k))
        ex = cfg.get("extras")
        if ex:
            ex(ent, t, mv, ph, dt)

    def _arm(self, side, shoulder, elbow, out=0.0):
        """shoulder: forward swing (rad); elbow: flex (rad); out: abduction away from the body (rad)."""
        sx = 1 if side == "R" else -1
        self.rig.J["shoulder" + side].setHpr(0, math.degrees(shoulder), math.degrees(-out * sx))
        self.rig.J["elbow" + side].setHpr(0, math.degrees(elbow), 0)

    def _skill(self, name, t, tm):
        J, deg = self.rig.J, math.degrees
        prog = lambda dur: 1 - CLAMP(t / dur, 0, 1)
        body, spine, head = J["body"], J["spine"], J["head"]
        if name == "rush":
            self._arm("L", 1.1, 0.9, 0.2)
            self._arm("R", -0.8, 0.3, 0.1)
            spine.setP(-deg(0.55))
            body.setY(4)
            J["thighL"].setP(deg(math.sin(tm * 30) * 0.9))
            J["thighR"].setP(deg(-math.sin(tm * 30) * 0.9))
        elif name == "whirl":
            body.setH(math.degrees(tm * 18))
            self._arm("R", 1.45, 0.1, 0.9)
            self._arm("L", 1.4, 0.1, 0.9)
            spine.setP(-deg(0.1))
        elif name == "rally":
            k = math.sin(prog(0.5) * math.pi)
            self._arm("R", 2.6 * k + 0.3, 0.3, 0.3)
            self._arm("L", 2.4 * k + 0.1, 0.3, 0.3)
            head.setP(-deg(-0.4 * k))
            spine.setP(-deg(-0.2 * k))
        elif name == "volley":
            self._arm("L", 1.55, 0.05, -0.05)
            self._arm("R", 1.45, 2.25 - prog(0.3) * 1.8, 0.1)
            spine.setH(deg(-0.5))
            head.setH(deg(0.4))
        elif name == "tumble":
            k = prog(0.4)
            body.setP(deg(-k * math.pi * 2))
            body.setZ(14 * math.sin(k * math.pi) + 8)
            J["thighL"].setP(deg(1.4))
            J["thighR"].setP(deg(1.4))
            J["kneeL"].setP(deg(-1.6))
            J["kneeR"].setP(deg(-1.6))
            self._arm("R", 1.6, 1.5, 0.2)
            self._arm("L", 1.6, 1.5, 0.2)
        elif name == "nova":
            k = math.sin(prog(0.45) * math.pi)
            self._arm("R", 0.5, 0.3, 1.3 * k)
            self._arm("L", 0.5, 0.3, 1.3 * k)
            head.setP(-deg(-0.25 * k))
            body.setZ(3 * k)
        elif name == "blink":
            k = prog(0.3)
            s = 1 - 0.25 * math.sin(k * math.pi)
            body.setScale(s, s, 1 + 0.15 * math.sin(k * math.pi))
            self._arm("R", 1.0, 0.3, 0.5)
            self._arm("L", 1.0, 0.3, 0.5)
        elif name == "cast":
            k = math.sin(prog(0.5) * math.pi * 0.9)
            self._arm("R", 2.9 * k + 0.3, 0.3, 0.2)
            self._arm("L", 2.5 * k + 0.1, 0.3, 0.3)
            head.setP(-deg(-0.35 * k))
            spine.setP(-deg(-0.2 * k))
