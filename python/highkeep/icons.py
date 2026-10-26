"""Procedural icons painted with PNMPainter (no image assets)."""
import math

from panda3d.core import PNMImage, PNMPainter, PNMBrush, Texture, SamplerState

_cache = {}


def _tex(img):
    t = Texture("icon")
    t.load(img)
    t.setMinfilter(SamplerState.FT_linear)
    t.setMagfilter(SamplerState.FT_linear)
    t.setWrapU(SamplerState.WM_clamp)
    t.setWrapV(SamplerState.WM_clamp)
    return t


def _pen(p, col, w, a=1.0):
    p.setPen(PNMBrush.makeSpot(col + (a,), max(0.6, w / 2), False))


def _line(p, x0, y0, x1, y1, col, w=3):
    _pen(p, col, w)
    p.drawLine(x0, y0, x1, y1)


def _dot(p, x, y, r, col, a=1.0):
    p.setPen(PNMBrush.makeSpot(col + (a,), r, False))
    p.drawLine(x, y, x, y)


def _poly(p, pts, col, w=2, close=True):
    for a, b in zip(pts, pts[1:] + ([pts[0]] if close else [])):
        _line(p, a[0], a[1], b[0], b[1], col, w)


def _fill(p, pts, col):
    """Cheap scanline fill for small convex-ish polygons."""
    ys = [q[1] for q in pts]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        xs = []
        for a, b in zip(pts, pts[1:] + [pts[0]]):
            if (a[1] <= y < b[1]) or (b[1] <= y < a[1]):
                xs.append(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            _line(p, xs[i], y, xs[i + 1], y, col, 1.4)


def _arrow(p, x0, y0, x1, y1, col=(0.9, 0.86, 0.75), w=3):
    _line(p, x0, y0, x1, y1, col, w)
    a = math.atan2(y1 - y0, x1 - x0)
    _fill(p, [(x1, y1), (x1 - math.cos(a - 0.5) * 9, y1 - math.sin(a - 0.5) * 9), (x1 - math.cos(a + 0.5) * 9, y1 - math.sin(a + 0.5) * 9)], col)


def _star(p, x, y, r, col):
    pts = [(x + math.cos(-math.pi / 2 + i * math.pi / 4) * (r if i % 2 == 0 else r * 0.4), y + math.sin(-math.pi / 2 + i * math.pi / 4) * (r if i % 2 == 0 else r * 0.4)) for i in range(8)]
    _fill(p, pts, col)


def _draw(name, p):
    gold, steel, blue = (0.88, 0.7, 0.25), (0.78, 0.82, 0.88), (0.4, 0.55, 0.85)
    if name in ("rush", "knight"):
        pts = [(22, 14), (50, 14), (50, 34), (36, 56), (22, 34)] if name == "rush" else [(14, 12), (50, 12), (50, 34), (32, 60), (14, 34)]
        _fill(p, pts, (0.42, 0.5, 0.7) if name == "rush" else (0.2, 0.3, 0.55))
        _poly(p, pts, (0.85, 0.9, 1.0), 3)
        if name == "knight":
            _fill(p, [(32, 18), (32, 54), (20, 38), (20, 18)], (0.7, 0.14, 0.18))
            _fill(p, [(40, 22), (43, 31), (37, 31)], gold)
        else:
            _arrow(p, 4, 34, 22, 34, gold)
            _arrow(p, 4, 22, 16, 22, gold)
    elif name == "whirl":
        for r, w in ((18, 5), (10, 3)):
            for i in range(0, 300, 12):
                a = math.radians(i + (0 if r == 18 else 90))
                _dot(p, 32 + math.cos(a) * r, 32 + math.sin(a) * r, w / 2, steel)
        _arrow(p, 40, 10, 51, 18, (1, 1, 1))
    elif name == "rally":
        _fill(p, [(12, 28), (34, 18), (34, 46), (12, 36)], gold)
        _fill(p, [(34, 18), (54, 32), (34, 46)], (0.8, 0.55, 0.15))
        for a in (-0.6, 0, 0.6):
            _line(p, 46 + math.cos(a) * 4, 32 + math.sin(a) * 4, 58, 32 + math.sin(a) * 14, (1, 0.95, 0.7), 2.5)
    elif name == "volley":
        for i in range(-2, 3):
            a = -0.9 + i * 0.28
            _arrow(p, 14, 52, 14 + math.cos(a) * 44, 52 + math.sin(a) * 44)
    elif name == "tumble":
        for i in range(0, 250, 10):
            a = math.radians(i + 200)
            _dot(p, 30 + math.cos(a) * 17, 34 + math.sin(a) * 17, 2.5, (0.82, 0.9, 0.7))
        _arrow(p, 40, 14, 52, 22, (0.82, 0.9, 0.7))
        _dot(p, 30, 34, 6, (0.55, 0.68, 0.4))
    elif name == "rain":
        _dot(p, 32, 52, 14, (0.5, 0.6, 0.3), 0.4)
        for x, y in ((18, 8), (32, 4), (46, 10), (26, 22), (40, 24)):
            _arrow(p, x - 4, y, x, y + 22)
    elif name == "nova":
        for i in range(6):
            a = i / 6 * math.tau
            _line(p, 32, 32, 32 + math.cos(a) * 24, 32 + math.sin(a) * 24, (0.75, 0.92, 1.0), 4)
            for s in (-0.5, 0.5):
                _line(p, 32 + math.cos(a) * 15, 32 + math.sin(a) * 15, 32 + math.cos(a + s) * 21, 32 + math.sin(a + s) * 21, (0.75, 0.92, 1.0), 3)
    elif name == "blink":
        for x, y, s in ((22, 40, 12), (44, 22, 9), (14, 18, 5)):
            _fill(p, [(x, y - s), (x + s * 0.3, y - s * 0.3), (x + s, y), (x + s * 0.3, y + s * 0.3), (x, y + s), (x - s * 0.3, y + s * 0.3), (x - s, y), (x - s * 0.3, y - s * 0.3)], (0.72, 0.6, 1.0))
    elif name == "meteor":
        _line(p, 6, 6, 36, 34, (1.0, 0.5, 0.15), 8)
        _dot(p, 40, 40, 13, (1.0, 0.68, 0.28))
        _dot(p, 43, 43, 8, (1.0, 0.38, 0.1))
    elif name == "potion":
        _fill(p, [(26, 28), (22, 42), (24, 54), (32, 56), (40, 54), (42, 42), (38, 28)], (0.85, 0.2, 0.32))
        _line(p, 26, 28, 26, 14, steel, 3)
        _line(p, 38, 28, 38, 14, steel, 3)
        _fill(p, [(24, 8), (40, 8), (40, 16), (24, 16)], (0.5, 0.32, 0.18))
    elif name == "sword":
        _line(p, 14, 50, 46, 14, steel, 6)
        _line(p, 14, 38, 26, 50, (0.55, 0.4, 0.22), 5)
    elif name == "bow":
        for i in range(-12, 13):
            a = i / 12 * 1.0
            _dot(p, 12 + math.cos(a) * 30, 32 + math.sin(a) * 30, 2.4, (0.65, 0.48, 0.28))
        _line(p, 12 + math.cos(-1) * 30, 32 + math.sin(-1) * 30, 12 + math.cos(1) * 30, 32 + math.sin(1) * 30, (0.9, 0.86, 0.75), 1.4)
        _arrow(p, 14, 32, 54, 32)
    elif name == "staff":
        _line(p, 16, 56, 44, 20, (0.55, 0.38, 0.22), 5)
        _dot(p, 48, 14, 9, (1.0, 0.55, 0.2))
        _dot(p, 46, 12, 4, (1.0, 0.88, 0.6))
    elif name == "armor":
        pts = [(10, 16), (22, 10), (32, 18), (42, 10), (54, 16), (48, 30), (46, 54), (18, 54), (16, 30)]
        _fill(p, pts, (0.5, 0.55, 0.62))
        _poly(p, pts, (0.85, 0.88, 0.92), 2.5)
    elif name == "charm":
        for i in range(0, 180, 10):
            a = math.radians(180 + i)
            _dot(p, 32 + math.cos(a) * 14, 24 + math.sin(a) * 14, 1.8, gold)
        _fill(p, [(32, 26), (44, 40), (32, 56), (20, 40)], (0.35, 0.78, 0.65))
        _poly(p, [(32, 26), (44, 40), (32, 56), (20, 40)], (0.9, 1, 0.95), 2)
    elif name == "coin":
        _dot(p, 32, 32, 24, gold)
        _dot(p, 32, 32, 18, (0.7, 0.5, 0.1))
        _dot(p, 32, 32, 15, (0.95, 0.78, 0.3))
    elif name == "steel":
        _line(p, 14, 50, 50, 14, (0.6, 0.65, 0.72), 7)
        _fill(p, [(40, 10), (54, 24), (48, 30), (34, 16)], (0.55, 0.58, 0.65))
    elif name == "ranger":
        _draw("bow", p)
    elif name == "mage":
        _draw("staff", p)
    else:
        _draw("charm", p)


def icon(name, size=64):
    key = (name, size)
    if key not in _cache:
        img = PNMImage(64, 64, 4)
        img.alphaFill(0)
        p = PNMPainter(img)
        _draw(name, p)
        if size != 64:
            small = PNMImage(size, size, 4)
            small.quickFilterFrom(img)
            img = small
        _cache[key] = _tex(img)
    return _cache[key]


def slot_icon(item):
    if item["slot"] == "weapon":
        return {"ranger": "bow", "mage": "staff"}.get(item.get("cls"), "sword")
    return item["slot"]
