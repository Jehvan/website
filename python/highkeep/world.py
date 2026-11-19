"""Stage layouts: deterministic props, road, obstacles and collision (y grows towards the camera/south)."""
import math
from .data import WORLD_W as W, WORLD_H as H


class Rng:
    """mulberry32, so layouts are reproducible."""

    def __init__(self, seed):
        self.a = int(seed) & 0xFFFFFFFF

    def __call__(self):
        self.a = (self.a + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def dist_seg(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy or 1.0
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def dist_to_road(road, x, y):
    if not road:
        return 9999.0
    d = 9999.0
    for i in range(len(road) - 1):
        d = min(d, dist_seg(x, y, road[i][0], road[i][1], road[i + 1][0], road[i + 1][1]))
    return d


def sine_road(fn):
    return [(x, fn(x)) for x in range(-40, W + 41, 60)]


def smooth_path(ctrl, per=8):
    out = []
    n = len(ctrl)
    for i in range(n - 1):
        p0, p1, p2, p3 = ctrl[max(0, i - 1)], ctrl[i], ctrl[i + 1], ctrl[min(n - 1, i + 2)]
        for s in range(per):
            t = s / per
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                                    + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in (0, 1)))
    out.append(tuple(ctrl[-1]))
    return out


class Layout:
    def __init__(self, theme, seed, boss=False, floor=0):
        self.theme, self.seed, self.boss, self.floor = theme, seed, boss, floor
        self.w, self.h = W, H
        self.indoor = False
        self.road = None
        self.road_w = 40
        self.bounds = {"x0": 30, "y0": 30, "x1": W - 30, "y1": H - 30}
        self.props = []          # dicts: kind,x,y,rot,s,...
        self.obstacles = []      # ('c',x,y,r) or ('r',x,y,w,h,rot)
        self.lights = []
        self.river = None
        self.bridge = None
        self.pools = []
        self.plots = []
        self.start = (150, 600)

    def of(self, kind):
        return [p for p in self.props if p["kind"] == kind]


def build_layout(theme, seed=1, boss=False, floor=0):
    L = Layout(theme, seed, boss, floor)
    R = Rng(seed * 7919 + len(theme) * 131)
    occupied = []

    def free(x, y, r, road_clear=0.0):
        b = L.bounds
        if x < b["x0"] + r or x > b["x1"] - r or y < b["y0"] + r or y > b["y1"] - r:
            return False
        if road_clear and dist_to_road(L.road, x, y) < road_clear + r:
            return False
        if math.hypot(x - L.start[0], y - L.start[1]) < 120 + r:
            return False
        for ox, oy, orr in occupied:
            if math.hypot(x - ox, y - oy) < orr + r:
                return False
        if L.river and L.river["x0"] - 30 - r < x < L.river["x1"] + 30 + r:
            return False
        for p in L.pools:
            if math.hypot(x - p["x"], y - p["y"]) < p["r"] + r:
                return False
        return True

    def prop(kind, x, y, **kw):
        p = {"kind": kind, "x": x, "y": y, "rot": kw.pop("rot", R() * math.tau), "s": kw.pop("s", 1.0)}
        p.update(kw)
        L.props.append(p)
        return p

    def scatter(kind, n, r=0.0, clear=0.0, s0=0.8, s1=1.25, tries=40, area=None, collide=None, **extra):
        collide = (r > 0) if collide is None else collide
        placed = 0
        for _ in range(n * tries):
            if placed >= n:
                break
            b = area or L.bounds
            x = b["x0"] + R() * (b["x1"] - b["x0"])
            y = b["y0"] + R() * (b["y1"] - b["y0"])
            s = s0 + R() * (s1 - s0)
            if not free(x, y, r * s * 0.8, clear):
                continue
            kw = {k: (v(R) if callable(v) else v) for k, v in extra.items()}
            prop(kind, x, y, s=s, **kw)
            if collide:
                occupied.append((x, y, r * s))
                L.obstacles.append(("c", x, y, r * s))
            elif r:
                occupied.append((x, y, r * s * 0.5))
            placed += 1


    def camp(cands, tents=2):
        """Raider camp: campfire ringed by tents, a standard and a weapon rack; first free candidate wins."""
        tries = list(cands) + [(150 + R() * 1300, 150 + R() * 850) for _ in range(120)]
        for cx, cy in tries:
            if not free(cx, cy, 90, 70):
                continue
            prop("campfire", cx, cy, s=1.3)
            L.obstacles.append(("c", cx, cy, 16)); occupied.append((cx, cy, 90))
            L.lights.append((cx, cy))
            for i in range(tents):
                a = i * (math.tau / tents) + 0.6 + R() * 0.3
                tx, ty = cx + math.cos(a) * 62, cy + math.sin(a) * 52
                prop("camp_tent", tx, ty, rot=a + math.pi / 2, s=1.15)
                L.obstacles.append(("c", tx, ty, 30))
            sa = 0.6 + math.pi
            prop("standard", cx + math.cos(sa) * 50, cy + math.sin(sa) * 50, rot=R() * 6, s=1.2)
            L.obstacles.append(("c", cx + math.cos(sa) * 50, cy + math.sin(sa) * 50, 6))
            prop("rack", cx + 34, cy - 40, rot=0.3, s=1.2)
            prop("barrel", cx - 30, cy + 38, s=1.3); prop("crate", cx - 18, cy + 46, s=1.3)
            return True
        return False

    def rect(cx, cy, w, h, rot=0.0):
        L.obstacles.append(("r", cx, cy, w, h, rot))

    def block(x, y, r):
        occupied.append((x, y, r))

    if theme == "fields":
        L.road = sine_road(lambda x: 640 + 190 * math.sin(x / 250 + 0.6))
        L.start = (120, L.road[2][1])
        for _ in range(6):
            x, y = 200 + R() * 1200, 120 + R() * 900
            if dist_to_road(L.road, x, y) > 140:
                L.plots.append({"x": x, "y": y, "w": 150 + R() * 100, "h": 90 + R() * 80, "rot": (R() - 0.5) * 0.3})
        for cx, cy in [(420, 330), (980, 250), (1180, 900), (600, 940), (1380, 520)]:
            if dist_to_road(L.road, cx, cy) < 110:
                continue
            rot = (R() - 0.5) * 0.5
            prop("cottage", cx, cy, rot=rot, s=0.9 + R() * 0.3)
            rect(cx, cy, 120, 84, rot)
            block(cx, cy, 90)
        for fx, fy, ln, vert in [(330, 420, 6, 0), (900, 330, 5, 0), (1080, 820, 6, 1), (540, 860, 5, 0)]:
            if dist_to_road(L.road, fx, fy) < 100:
                continue
            for i in range(ln):
                prop("fence", fx + (0 if vert else i * 34), fy + (i * 34 if vert else 0), rot=math.pi / 2 if vert else 0, s=1)
            rect(fx + (0 if vert else ln * 17 - 17), fy + (ln * 17 - 17 if vert else 0), 8 if vert else ln * 34, ln * 34 if vert else 8)
        camp([(1300, 300), (1280, 950), (500, 160), (700, 980)])
        scatter("hay", 9, r=18, clear=70)
        scatter("tent", 2, r=34, clear=90, s0=1.2, s1=1.4)
        scatter("tent_blue", 1, r=34, clear=90, s0=1.2, s1=1.4)
        scatter("barrel", 9, r=8, clear=60, s0=1.2, s1=1.5)
        scatter("crate", 7, r=8, clear=60, s0=1.2, s1=1.5)
        scatter("cart", 2, r=22, clear=80, s0=1.3, s1=1.5)
        scatter("well", 1, r=16, clear=90, s0=1.4, s1=1.5)
        scatter("tree", 16, r=15, clear=70, s0=0.9, s1=1.4)
        scatter("rock", 12, r=12, clear=50)
        scatter("lamp", 4, r=6, collide=False)
    elif theme == "wood":
        L.road = sine_road(lambda x: 560 + 220 * math.sin(x / 210 + 2.0))
        L.start = (110, L.road[2][1])
        scatter("tree", 105, r=16, clear=62, s0=0.9, s1=1.7, pine=lambda Rn: Rn() < 0.4)
        camp([(1250, 250), (1300, 900), (480, 900), (500, 220)], 3)
        scatter("logs", 7, r=18, clear=60)
        scatter("rock", 14, r=13, clear=45)
        scatter("lamp", 3, r=6, collide=False)
    elif theme == "bridge":
        L.road = sine_road(lambda x: 575 + 160 * math.sin(x / 320 + 1) * smooth(0, 200, abs(x - 800)))
        L.start = (120, L.road[2][1])
        L.river = {"x0": 735, "x1": 865}
        by = 575
        L.bridge = {"x0": 705, "x1": 895, "y": by, "w": 104}
        rect(800, (by - 52) / 2, 130, by - 52)
        rect(800, by + 52 + (H - by - 52) / 2, 130, H - by - 52)
        rect(800, by - 54, 130, 8)
        rect(800, by + 54, 130, 8)
        prop("bridge", 800, by, rot=0)
        for lx in (740, 860):
            for ly in (by - 54, by + 54):
                prop("lamp", lx, ly, s=1)
        prop("cottage", 540, 330, rot=0.2, s=1.1); rect(540, 330, 120, 84, 0.2); block(540, 330, 90)
        prop("cottage", 1090, 840, rot=-0.2, s=1.0); rect(1090, 840, 120, 84, -0.2); block(1090, 840, 90)
        for px in (668, 932):
            for py in (by - 96, by + 96):
                prop("palisade", px, py, rot=math.pi / 2, s=1.3)
                rect(px, py, 14, 96)
        camp([(330, 870), (1300, 280), (1330, 880), (330, 250)], 2)
        scatter("tree", 34, r=15, clear=70, s0=0.9, s1=1.5)
        scatter("rock", 14, r=12, clear=50)
        scatter("fence", 8, clear=70, collide=False)
    elif theme == "marsh":
        L.road = sine_road(lambda x: 600 + 200 * math.sin(x / 240 + 3.5))
        L.start = (120, L.road[2][1])
        for _ in range(12):
            x, y, r = 200 + R() * 1200, 100 + R() * 950, 50 + R() * 70
            if (dist_to_road(L.road, x, y) > r + 60 and math.hypot(x - L.start[0], y - L.start[1]) > r + 150
                    and not any(math.hypot(p["x"] - x, p["y"] - y) < p["r"] + r + 20 for p in L.pools)):
                L.pools.append({"x": x, "y": y, "r": r})
                L.obstacles.append(("c", x, y, r * 0.9))
                occupied.append((x, y, r))
        camp([(1250, 220), (1330, 950), (400, 950), (420, 200)], 2)
        for _ in range(4):
            x, y = 300 + R() * 1000, 150 + R() * 850
            if not free(x, y, 70, 90):
                continue
            rot = R() * math.pi
            prop("ruin", x, y, rot=rot, s=1 + R() * 0.4)
            rect(x, y, 110, 24, rot)
            block(x, y, 80)
        scatter("column", 6, r=14, clear=70, s0=0.8, s1=1.2)
        scatter("deadtree", 36, r=12, clear=55, s0=0.9, s1=1.6)
        scatter("rock", 12, r=12, clear=40)
        scatter("lamp", 3, r=6, collide=False)
    elif theme == "gate":
        L.road = smooth_path([(-40, 1010), (200, 990), (420, 910), (560, 780), (540, 620), (650, 480), (770, 380), (800, 250), (800, 120)])
        L.start = (120, 1000)
        rect(350, 85, 700, 140); rect(1250, 85, 700, 140); rect(800, 85, 200, 120)
        for tx in (60, 690, 910, 1540):
            prop("tower", tx, 110, s=1.1 if tx in (60, 1540) else 1.0)
            L.obstacles.append(("c", tx, 120, 58))
        prop("wall", 350, 85, w=700); prop("wall", 1250, 85, w=700)
        prop("portcullis", 800, 120)
        for bx in (250, 500, 1100, 1350):
            prop("banner", bx, 160, s=1)
        for bx in (740, 860):
            prop("banner", bx, 168, s=1.15)
        for lx in (690, 910):
            for ly in (420, 680):
                prop("brazier", lx, ly)
                L.obstacles.append(("c", lx, ly, 11)); block(lx, ly, 14); L.lights.append((lx, ly))
        scatter("rock", 10, r=12, clear=55)
        scatter("tree", 14, r=15, clear=70, area={"x0": 30, "y0": 450, "x1": 400, "y1": 1120})
        scatter("tree", 14, r=15, clear=70, area={"x0": 1100, "y0": 450, "x1": 1570, "y1": 1120})
        camp([(280, 700), (1330, 760), (260, 520)], 2)
        scatter("hay", 3, r=18, clear=70)
        scatter("tent_blue", 2, r=34, clear=90, s0=1.2, s1=1.4, area={"x0": 560, "y0": 420, "x1": 1050, "y1": 1100})
        scatter("barrel", 8, r=8, clear=60, s0=1.2, s1=1.5)
        scatter("crate", 6, r=8, clear=60, s0=1.2, s1=1.5)
        scatter("cart", 2, r=22, clear=80, s0=1.3, s1=1.5)
        scatter("lamp", 5, r=6, collide=False)
    elif theme == "hall":
        L.indoor = True
        L.bounds = {"x0": 130, "y0": 150, "x1": W - 130, "y1": H - 70}
        L.start = (800, 1020)
        prop("throne", 800, 190)
        L.obstacles.append(("r", 800, 175, 130, 80, 0.0))
        for px in (380, 1220):
            for py in (290, 500, 710, 920):
                prop("pillar", px, py); L.obstacles.append(("c", px, py, 22)); block(px, py, 28)
        for bx, by in [(560, 400), (1040, 400), (560, 820), (1040, 820), (660, 230), (940, 230)]:
            prop("brazier", bx, by); L.obstacles.append(("c", bx, by, 11)); block(bx, by, 14); L.lights.append((bx, by))
        prop("carpet", 800, 640)
        for bx in (250, 1350):
            prop("banner", bx, 160)
    elif theme == "vault":
        L.indoor = True
        L.bounds = {"x0": 110, "y0": 110, "x1": W - 110, "y1": H - 90}
        L.start = (800, 980)
        n = 6 if boss else 8 + int(R() * 7)
        b = L.bounds
        for _ in range(n * 20):
            if sum(1 for p in L.props if p["kind"] == "pillar") >= n:
                break
            x = b["x0"] + 60 + R() * (b["x1"] - b["x0"] - 120)
            y = b["y0"] + 60 + R() * (b["y1"] - b["y0"] - 200)
            if not free(x, y, 40):
                continue
            prop("pillar", x, y, rot=0)
            L.obstacles.append(("c", x, y, 22)); block(x, y, 36)
        nb = 4 + int(R() * 3)
        for _ in range(nb * 20):
            if len(L.lights) >= nb:
                break
            x = b["x0"] + 40 + R() * (b["x1"] - b["x0"] - 80)
            y = b["y0"] + 40 + R() * (b["y1"] - b["y0"] - 120)
            if not free(x, y, 30):
                continue
            prop("brazier", x, y)
            L.obstacles.append(("c", x, y, 11)); block(x, y, 24); L.lights.append((x, y))
        scatter("crystal", 5, r=12, s0=1.1, s1=1.6)
        scatter("sarcophagus", 3, r=26, s0=1.2, s1=1.4)
        scatter("bones", 6, r=8, s0=1.2, s1=1.6, collide=False)
        scatter("rock", 10, r=10, collide=False)
    if not L.indoor:
        dens = {"fields": 380, "wood": 300, "bridge": 320, "marsh": 260, "gate": 220}.get(theme, 250)
        scatter("grass", dens, r=0, clear=36, tries=3, collide=False, s0=0.7, s1=1.4)
    return L


def resolve_move(L, e, r=None):
    """Push circle e (dict-like with x,y,r) out of bounds and obstacles."""
    if r is None:
        r = e.r
    b = L.bounds
    x, y = e.x, e.y
    x = max(b["x0"] + r, min(b["x1"] - r, x))
    y = max(b["y0"] + r, min(b["y1"] - r, y))
    for o in L.obstacles:
        if o[0] == "c":
            dx, dy, rr = x - o[1], y - o[2], o[3] + r
            if dx > rr or dx < -rr or dy > rr or dy < -rr:
                continue
            d2 = dx * dx + dy * dy
            if d2 < rr * rr:
                d = math.sqrt(d2) or 0.001
                x = o[1] + dx / d * rr
                y = o[2] + dy / d * rr
        else:
            _, ox, oy, w, h, rot = o
            c, s = math.cos(-rot), math.sin(-rot)
            lx, ly = (x - ox) * c - (y - oy) * s, (x - ox) * s + (y - oy) * c
            hw, hh = w / 2, h / 2
            cx, cy = max(-hw, min(hw, lx)), max(-hh, min(hh, ly))
            dx, dy = lx - cx, ly - cy
            d2 = dx * dx + dy * dy
            if d2 > r * r:
                continue
            if d2 > 1e-6:
                d = math.sqrt(d2)
                nx, ny = cx + dx / d * r, cy + dy / d * r
            else:
                px, py = hw - abs(lx), hh - abs(ly)
                if px < py:
                    nx, ny = (1 if lx >= 0 else -1) * (hw + r), ly
                else:
                    nx, ny = lx, (1 if ly >= 0 else -1) * (hh + r)
            cs, sn = math.cos(rot), math.sin(rot)
            x = ox + nx * cs - ny * sn
            y = oy + nx * sn + ny * cs
    e.x, e.y = x, y
    return e


class _P:
    __slots__ = ("x", "y", "r")

    def __init__(self, x, y, r):
        self.x, self.y, self.r = x, y, r


def point_blocked(L, x, y, r=4):
    t = _P(x, y, r)
    resolve_move(L, t, r)
    return abs(t.x - x) > 0.5 or abs(t.y - y) > 0.5


def build_town(seed=3):
    """Non-playable hub: cobbled plaza with fountain, market tents, forge and cottages."""
    L = Layout("town", seed)
    R = Rng(seed * 31 + 7)
    L.plaza = (800, 600, 215)
    L.road = [(800, H + 60), (800, 900), (800, 800)]
    L.road_w = 34
    L.paths = [[(-60, 560), (300, 575), (590, 600)], [(1010, 610), (1300, 560), (W + 60, 540)], [(800, 380), (800, 200), (790, -60)]]
    L.start = (800, 760)

    def prop(kind, x, y, rot=0.0, s=1.0, **kw):
        L.props.append(dict(kind=kind, x=x, y=y, rot=rot, s=s, **kw))

    prop("fountain", 800, 600, s=2.0)
    prop("tent", 575, 470, rot=0.35, s=1.5)
    prop("tent_blue", 1030, 470, rot=-0.35, s=1.5)
    prop("tent", 1020, 735, rot=math.pi - 0.4, s=1.4)
    prop("forge", 430, 660, rot=0.2, s=1.8)
    prop("well", 1190, 640, s=1.5)
    prop("cart", 640, 790, rot=0.5, s=1.5)
    prop("cottage", 330, 270, rot=0.1, s=1.5)
    prop("cottage", 800, 190, rot=0.0, s=1.8)
    prop("cottage", 1270, 280, rot=-0.15, s=1.5)
    prop("cottage", 1330, 800, rot=3.3, s=1.3)
    prop("cottage", 250, 880, rot=0.3, s=1.3)
    for a in range(8):
        ang = a / 8 * math.tau + 0.2
        prop("lamp", 800 + math.cos(ang) * 230, 600 + math.sin(ang) * 230 * 0.92, rot=ang + math.pi)
    for x, y in [(600, 430), (620, 520), (1060, 440), (1000, 500), (1050, 770), (990, 700), (560, 800), (700, 800), (455, 600), (395, 725)]:
        prop("barrel" if R() < 0.5 else "crate", x, y, rot=R() * 6, s=1.5)
    for _ in range(50):
        x, y = R() * W, R() * H
        if math.hypot(x - 800, y - 600) < 280:
            continue
        prop("tree", x, y, rot=R() * 6, s=1.1 + R() * 0.7, pine=R() < 0.25)
    for _ in range(60):
        x, y = R() * W, R() * H
        if math.hypot(x - 800, y - 600) < 235:
            continue
        prop("grass", x, y, rot=R() * 6, s=0.8 + R() * 0.7)
    for _ in range(10):
        x, y = 80 + R() * (W - 160), 80 + R() * (H - 160)
        if math.hypot(x - 800, y - 600) > 300:
            prop("rock", x, y, rot=R() * 6, s=0.8 + R() * 0.6)
    return L
