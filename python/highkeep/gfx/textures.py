"""Procedural textures painted into PNMImages, cached to disk. No image assets ship with the game."""
import math
import os

from panda3d.core import Filename, PNMBrush, PNMImage, PNMPainter, Texture, SamplerState

from ..save import save_dir

_cache = {}
_dir = None


def cache_dir():
    global _dir
    if _dir is None:
        _dir = os.path.join(save_dir(), "texcache-v1")
        try:
            os.makedirs(_dir, exist_ok=True)
        except Exception:
            pass
    return _dir


def _rng(seed):
    a = [seed & 0xFFFFFFFF]

    def r():
        a[0] = (a[0] * 1664525 + 1013904223) & 0xFFFFFFFF
        return a[0] / 4294967296.0
    return r


def noise_field(w, h, cells=6, octaves=4, seed=1, persistence=0.5):
    """Tileable value noise in [0,1], returned as a flat list."""
    out = [0.0] * (w * h)
    R = _rng(seed * 2654435761)
    amp, total, c = 1.0, 0.0, cells
    for _ in range(octaves):
        grid = [R() for _ in range(c * c)]
        for y in range(h):
            fy = y / h * c
            y0 = int(fy)
            ty = fy - y0
            sy = ty * ty * (3 - 2 * ty)
            ya, yb = (y0 % c) * c, ((y0 + 1) % c) * c
            row = y * w
            for x in range(w):
                fx = x / w * c
                x0 = int(fx)
                tx = fx - x0
                sx = tx * tx * (3 - 2 * tx)
                xa, xb = x0 % c, (x0 + 1) % c
                a = grid[ya + xa] + (grid[ya + xb] - grid[ya + xa]) * sx
                b = grid[yb + xa] + (grid[yb + xb] - grid[yb + xa]) * sx
                out[row + x] += (a + (b - a) * sy) * amp
        total += amp
        amp *= persistence
        c *= 2
    inv = 1.0 / total
    return [v * inv for v in out]


def hexc(s):
    s = s.lstrip("#")
    return (int(s[0:2], 16) / 255, int(s[2:4], 16) / 255, int(s[4:6], 16) / 255)


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def _img(w, h, alpha=False):
    img = PNMImage(w, h, 4 if alpha else 3)
    if alpha:
        img.alphaFill(0)
    return img


def pixels(w, h, fn, alpha=False):
    img = _img(w, h, alpha)
    for y in range(h):
        for x in range(w):
            v = fn(x, y, y * w + x)
            img.setXel(x, y, min(1, max(0, v[0])), min(1, max(0, v[1])), min(1, max(0, v[2])))
            if alpha and len(v) > 3:
                img.setAlpha(x, y, v[3])
    return img


def painter(img):
    return PNMPainter(img)


def line(p, x0, y0, x1, y1, color, width=1.0, alpha=1.0, fuzzy=False):
    p.setPen(PNMBrush.makeSpot(color + (alpha,) if len(color) == 3 else color, max(0.5, width / 2), fuzzy))
    p.drawLine(x0, y0, x1, y1)


def rect(p, x0, y0, x1, y1, color, alpha=1.0):
    p.setPen(PNMBrush.makeTransparent())
    p.setFill(PNMBrush.makePixel(color + (alpha,)))
    p.drawRectangle(x0, y0, x1, y1)


def spot(p, x, y, r, color, alpha=1.0, fuzzy=True):
    p.setPen(PNMBrush.makeSpot(color + (alpha,), r, fuzzy))
    p.drawLine(x, y, x, y)


def to_texture(img, name, repeat=True, srgb=True, mip=True):
    tex = Texture(name)
    tex.load(img)
    if srgb:
        tex.setFormat(Texture.F_srgb_alpha if img.hasAlpha() else Texture.F_srgb)
    tex.setWrapU(SamplerState.WM_repeat if repeat else SamplerState.WM_clamp)
    tex.setWrapV(SamplerState.WM_repeat if repeat else SamplerState.WM_clamp)
    tex.setMinfilter(SamplerState.FT_linear_mipmap_linear if mip else SamplerState.FT_linear)
    tex.setMagfilter(SamplerState.FT_linear)
    tex.setAnisotropicDegree(4)
    return tex


def cached(name, painter_fn, **kw):
    """Memoised + disk-cached texture. painter_fn() -> PNMImage."""
    if name in _cache:
        return _cache[name]
    path = os.path.join(cache_dir(), name + ".png")
    img = None
    try:
        if os.path.exists(path):
            img = PNMImage()
            if not img.read(Filename.fromOsSpecific(path)):
                img = None
    except Exception:
        img = None
    if img is None:
        img = painter_fn()
        try:
            img.write(Filename.fromOsSpecific(path))
        except Exception:
            pass
    tex = to_texture(img, name, **kw)
    _cache[name] = tex
    return tex


# ---------------------------------------------------------------- material textures
def cloth(base, seed=1, name=None, weave=True):
    def paint():
        n = noise_field(128, 128, 8, 3, seed)
        b = hexc(base)

        def f(x, y, i):
            thread = (0.88 + 0.12 * (((x % 4 < 2) ^ (y % 4 < 2)))) if weave else 1.0
            thread += ((x * 7 + y * 13) % 5) * 0.012
            k = (0.7 + 0.5 * n[i]) * thread
            return (b[0] * k, b[1] * k, b[2] * k)
        return pixels(128, 128, f)
    return cached(name or f"cloth_{base[1:]}_{seed}", paint)


def leather(base, seed=2, name=None):
    def paint():
        n, n2 = noise_field(128, 128, 16, 3, seed), noise_field(128, 128, 4, 2, seed + 5)
        b = hexc(base)

        def f(x, y, i):
            grain = 0.6 if abs(n[i] - 0.5) < 0.04 else 1.0
            k = (0.6 + 0.6 * n2[i]) * grain * (0.9 + 0.2 * n[i])
            return (b[0] * k, b[1] * k, b[2] * k)
        img = pixels(128, 128, f)
        p = painter(img)
        for yy in (10, 118):
            for x in range(0, 128, 7):
                line(p, x, yy, x + 3, yy, (0.1, 0.06, 0.03), 1.4, 0.7)
        return img
    return cached(name or f"leather_{base[1:]}_{seed}", paint)


def metal(base, seed=3, scratches=40, rivets=True, name=None, rust=0.0):
    def paint():
        n = noise_field(128, 128, 4, 4, seed)
        r = noise_field(128, 128, 6, 3, seed + 7)
        b = hexc(base)

        def f(x, y, i):
            streak = 0.95 + 0.05 * math.sin(y * 0.55 + n[(i + x * 3) % len(n)] * 6)
            k = (0.62 + 0.6 * n[i]) * streak
            c = (b[0] * k, b[1] * k, b[2] * k)
            if rust > 0 and r[i] > 0.58:
                c = mix(c, (0.42, 0.22, 0.1), min(1, (r[i] - 0.58) * 4 * rust))
            return c
        img = pixels(128, 128, f)
        p = painter(img)
        R = _rng(seed * 31)
        for _ in range(scratches):
            x, y, a = R() * 128, R() * 128, (R() - 0.5) * 0.8
            L = 10 + R() * 22
            line(p, x, y, x + math.cos(a) * L, y + math.sin(a) * L, (1, 1, 1), 0.7, 0.07 + R() * 0.12)
        if rivets:
            for (x, y) in ((10, 10), (118, 10), (10, 118), (118, 118), (64, 10), (64, 118)):
                spot(p, x + 0.7, y + 1, 2.6, (0, 0, 0), 0.4)
                spot(p, x, y, 2.2, mix(b, (1, 1, 1), 0.35), 1.0, False)
        for x in range(128):          # dark edge
            for y in (0, 1, 126, 127):
                img.setXel(x, y, *(c * 0.35 for c in img.getXel(x, y)))
        return img
    return cached(name or f"metal_{base[1:]}_{seed}_{int(rust * 10)}", paint)


def chain(base="#7d838c"):
    def paint():
        b = hexc(base)
        img = pixels(128, 128, lambda x, y, i: (0.06, 0.07, 0.08))
        p = painter(img)
        for yy in range(16):
            for xx in range(16):
                cx, cy = xx * 8 + (4 if yy % 2 else 0), yy * 8
                for rr, col in ((3.9, mix(b, (0, 0, 0), 0.55)), (3.2, b), (2.0, mix(b, (1, 1, 1), 0.3))):
                    pass
                spot(p, cx, cy, 3.6, mix(b, (0, 0, 0), 0.5), 1.0, False)
                spot(p, cx - 0.5, cy - 0.5, 2.6, b, 1.0, False)
                spot(p, cx, cy, 1.5, (0.05, 0.05, 0.06), 1.0, False)
                spot(p, cx - 1.2, cy - 1.4, 1.0, mix(b, (1, 1, 1), 0.45), 0.9, False)
        return img
    return cached("chain_" + base[1:], paint)


def skin(base, seed=5, mottle=0.25, freckle=0, name=None, grime=0.0):
    def paint():
        n, n2 = noise_field(128, 128, 6, 4, seed), noise_field(128, 128, 24, 2, seed + 9)
        b = hexc(base)

        def f(x, y, i):
            k = 1 - mottle + mottle * 2 * n[i] + (n2[i] - 0.5) * 0.16
            c = (b[0] * k, b[1] * k, b[2] * k * (0.97 + 0.06 * n2[i]))
            if grime:
                c = mix(c, (0.1, 0.08, 0.06), grime * max(0, n2[i] - 0.5) * 2)
            return c
        img = pixels(128, 128, f)
        p = painter(img)
        R = _rng(seed * 13)
        for _ in range(freckle):
            spot(p, R() * 128, R() * 128, 0.9, (0.16, 0.08, 0.04), 0.3)
        return img
    return cached(name or f"skin_{base[1:]}_{seed}", paint)


def bone(seed=6):
    def paint():
        n = noise_field(128, 128, 5, 4, seed)
        img = pixels(128, 128, lambda x, y, i: (0.82 * (0.7 + 0.4 * n[i]), 0.76 * (0.7 + 0.4 * n[i]), 0.64 * (0.7 + 0.4 * n[i])))
        p = painter(img)
        R = _rng(seed)
        for _ in range(16):
            x, y = R() * 128, R() * 128
            line(p, x, y, x + (R() - 0.5) * 24, y + (R() - 0.5) * 24, (0.3, 0.22, 0.1), 0.8, 0.4)
        return img
    return cached(f"bone_{seed}", paint)


def wood(base="#6a4c30", seed=7, planks=4, ring=False, name=None):
    def paint():
        n = noise_field(128, 128, 3, 4, seed)
        b = hexc(base)

        def f(x, y, i):
            grain = 0.78 + 0.16 * math.sin((y * 0.9 + n[i] * 24) * 1.2) + 0.14 * n[i]
            pk = 0.86 + (((x * planks // 128) * 37) % 11) * 0.016
            k = grain * pk
            return (b[0] * k, b[1] * k, b[2] * k)
        img = pixels(128, 128, f)
        p = painter(img)
        if planks > 1:
            for q in range(1, planks):
                line(p, q * 128 // planks, 0, q * 128 // planks, 128, (0.05, 0.03, 0.01), 1.6, 0.8)
        if ring:
            for r in range(4, 40, 5):
                for a in range(0, 360, 6):
                    x, y = 64 + r * math.cos(math.radians(a)), 64 + r * math.sin(math.radians(a))
                    spot(p, x, y, 0.8, (0.15, 0.09, 0.04), 0.5, False)
        return img
    return cached(name or f"wood_{base[1:]}_{seed}_{planks}_{int(ring)}", paint)


def bark(base="#4a3a2c", seed=8):
    def paint():
        n = noise_field(64, 128, 6, 4, seed)
        b = hexc(base)
        return pixels(64, 128, lambda x, y, i: tuple(c * (0.45 + 0.95 * abs(math.sin(x * 0.6 + n[i] * 7)) * n[i]) for c in b))
    return cached(f"bark_{base[1:]}_{seed}", paint)


def stone(base="#80796c", seed=9, bricks=0, cobbles=False, dark=0.6, name=None):
    def paint():
        n, n2 = noise_field(128, 128, 8, 5, seed), noise_field(128, 128, 32, 2, seed + 3)
        b = hexc(base)
        img = pixels(128, 128, lambda x, y, i: tuple(c * (0.6 + 0.6 * n[i] + (n2[i] - 0.5) * 0.25) for c in b))
        p = painter(img)
        R = _rng(seed * 5)
        if bricks:
            rh, bw = 128 / bricks, 32
            for r in range(bricks):
                line(p, 0, r * rh, 128, r * rh, (0.04, 0.03, 0.03), 1.6, dark)
                off = (r % 2) * bw / 2
                x = -off
                while x < 128:
                    line(p, x + bw, r * rh, x + bw, (r + 1) * rh, (0.04, 0.03, 0.03), 1.6, dark)
                    spot(p, x + bw * 0.5, (r + 0.5) * rh, bw * 0.4, (1, 1, 1), 0.03 + R() * 0.05)
                    x += bw
        elif cobbles:
            for _ in range(150):
                x, y, r = R() * 128, R() * 128, 4 + R() * 3.5
                spot(p, x, y, r, (1, 1, 1) if R() < 0.5 else (0, 0, 0), 0.05 + R() * 0.07)
                for a in range(0, 360, 40):
                    spot(p, x + r * math.cos(math.radians(a)), y + r * math.sin(math.radians(a)), 0.9, (0.04, 0.03, 0.03), 0.3, False)
        return img
    return cached(name or f"stone_{base[1:]}_{seed}_{bricks}_{int(cobbles)}", paint)


def flagstone(base="#5e5a55", seed=10):
    def paint():
        n = noise_field(128, 128, 8, 4, seed)
        b = hexc(base)
        img = pixels(128, 128, lambda x, y, i: tuple(c * (0.62 + 0.55 * n[i]) * (0.92 + ((x // 32 + (y // 32) * 3) % 5) * 0.03) for c in b))
        p = painter(img)
        for q in range(0, 129, 32):
            line(p, q, 0, q, 128, (0.03, 0.025, 0.02), 1.8, 0.85)
            line(p, 0, q, 128, q, (0.03, 0.025, 0.02), 1.8, 0.85)
        return img
    return cached(f"flag_{base[1:]}_{seed}", paint)


def stripes(c1, c2, n=4):
    def paint():
        a, b = hexc(c1), hexc(c2)
        nz = noise_field(128, 128, 8, 3, 41)
        w = 128 // (n * 2)

        def f(x, y, i):
            c = a if (x // w) % 2 == 0 else b
            k = 0.78 + 0.35 * nz[i] + (0.06 if (x * 5 + y * 3) % 4 < 2 else 0)
            return (c[0] * k, c[1] * k, c[2] * k)
        return pixels(128, 128, f)
    return cached(f"stripes_{c1[1:]}_{c2[1:]}_{n}", paint)


def thatch(variant=0):
    """Straw courses with dark gaps, bleached streaks and moss; variants shift the straw colour."""
    def paint():
        base = [(0.50, 0.38, 0.19), (0.42, 0.33, 0.18), (0.55, 0.45, 0.24)][variant % 3]
        img = pixels(128, 128, lambda x, y, i: base)
        p = painter(img)
        R = _rng(11 + variant)
        for y in range(0, 128, 16):                                  # bundled courses, each lighter at its lower edge
            for k in range(16):
                v = 0.78 + 0.34 * k / 16
                line(p, 0, y + k, 128, y + k, (base[0] * v, base[1] * v, base[2] * v), 1.2, 0.55)
        for _ in range(1500):
            x, y, ln = R() * 128, R() * 128, 7 + R() * 14
            v = 0.55 + R() * 0.65
            line(p, x, y, x + (R() - 0.5) * 3, y + ln, (base[0] * v * 1.05, base[1] * v, base[2] * v * 0.8), 0.9 + R() * 0.8, 0.5 + R() * 0.4)
        for y in range(0, 128, 16):
            line(p, 0, y, 128, y, (0.1, 0.06, 0.02), 1.8, 0.45)
        for _ in range(26):                                          # moss / weathering
            spot(p, R() * 128, R() * 128, 3 + R() * 6, (0.22, 0.34, 0.12), 0.3 * R())
        return img
    return cached(f"thatch2_{variant}", paint)


def tiles(base="#9a4a30", seed=14):
    """Overlapping curved clay tiles in staggered rows."""
    def paint():
        b = hexc(base)
        img = pixels(128, 128, lambda x, y, i: (b[0] * 0.5, b[1] * 0.5, b[2] * 0.5))
        p = painter(img)
        R = _rng(seed)
        rh, cw = 16, 16
        for r in range(8):
            x = -(r % 2) * cw / 2
            while x < 128:
                v = 0.78 + R() * 0.4
                col = (b[0] * v, b[1] * v, b[2] * v)
                rect(p, x + 1, r * rh + 1, x + cw - 1, r * rh + rh - 1, col)
                for k in range(6):                                   # lit upper, shaded lower: reads as a curved tile
                    line(p, x + 2, r * rh + 2 + k * 2, x + cw - 2, r * rh + 2 + k * 2, (col[0] * (1.15 - k * 0.07),) * 1 + (col[1] * (1.15 - k * 0.07), col[2] * (1.15 - k * 0.07)), 1.2, 0.8)
                line(p, x + 1, r * rh + rh - 1, x + cw - 1, r * rh + rh - 1, (0.08, 0.03, 0.02), 1.6, 0.6)
                line(p, x + cw, r * rh, x + cw, r * rh + rh, (0.08, 0.03, 0.02), 1.2, 0.5)
                x += cw
        for _ in range(18):
            spot(p, R() * 128, R() * 128, 3 + R() * 6, (0.22, 0.32, 0.12), 0.3 * R())
        return img
    return cached(f"tiles_{base[1:]}_{seed}", paint)


def slate():
    def paint():
        img = pixels(128, 128, lambda x, y, i: (0.2, 0.22, 0.26))
        p = painter(img)
        R = _rng(12)
        rh, cw = 16, 16
        for r in range(8):
            x = -(r % 2) * cw / 2
            while x < 128:
                v = 0.2 + R() * 0.14
                rect(p, x + 1, r * rh + 1, x + cw - 1, r * rh + rh - 1, (v, v + 0.025, v + 0.055))
                line(p, x + 1, r * rh + rh - 2, x + cw - 1, r * rh + rh - 2, (0, 0, 0), 1.4, 0.4)
                x += cw
        return img
    return cached("slate", paint)


def straw():
    def paint():
        img = pixels(128, 128, lambda x, y, i: (0.66, 0.54, 0.24))
        p = painter(img)
        R = _rng(13)
        for _ in range(700):
            x, y = R() * 128, R() * 128
            v = 0.55 + R() * 0.4
            line(p, x, y, x + 8 + R() * 8, y + (R() - 0.5) * 2, (v, v * 0.82, v * 0.3), 1, 0.6)
        line(p, 0, 30, 128, 30, (0.28, 0.16, 0.04), 3, 0.7)
        line(p, 0, 92, 128, 92, (0.28, 0.16, 0.04), 3, 0.7)
        return img
    return cached("straw", paint)


def plaster(base="#b9ad92"):
    def paint():
        n = noise_field(128, 128, 6, 4, 14)
        b = hexc(base)
        return pixels(128, 128, lambda x, y, i: tuple(c * (0.78 + 0.34 * n[i]) for c in b))
    return cached("plaster_" + base[1:], paint)


def rock(base="#76726a"):
    def paint():
        n, n2 = noise_field(128, 128, 5, 5, 15), noise_field(128, 128, 20, 2, 16)
        b = hexc(base)
        return pixels(128, 128, lambda x, y, i: tuple(c * (0.5 + 0.75 * n[i] + (n2[i] - 0.5) * 0.3) for c in b))
    return cached("rock_" + base[1:], paint)


def carpet():
    def paint():
        n = noise_field(64, 128, 8, 3, 17)
        img = pixels(64, 128, lambda x, y, i: (0.46 * (0.75 + 0.4 * n[i]), 0.07 * (0.75 + 0.4 * n[i]), 0.09 * (0.75 + 0.4 * n[i])))
        p = painter(img)
        gold = (0.78, 0.6, 0.2)
        for rect_ in ((4, 0, 60, 128),):
            line(p, 4, 0, 4, 128, gold, 3.5)
            line(p, 60, 0, 60, 128, gold, 3.5)
        line(p, 9, 0, 9, 128, (0.45, 0.3, 0.08), 1)
        line(p, 55, 0, 55, 128, (0.45, 0.3, 0.08), 1)
        for y in range(8, 128, 20):
            for d in range(0, 6):
                line(p, 32 - d, y - 6 + d, 32 + d, y - 6 + d, gold, 1.2)
                line(p, 32 - d, y + 6 - d, 32 + d, y + 6 - d, gold, 1.2)
        return img
    return cached("carpet", paint)


def water():
    def paint():
        n, n2 = noise_field(128, 128, 6, 4, 18), noise_field(128, 128, 12, 3, 19)

        def f(x, y, i):
            w = abs(n[i] - n2[i])
            hi = 1 if w < 0.035 else 0
            k = 0.7 + 0.5 * n[i]
            return ((0.12 + hi * 0.38) * k, (0.27 + hi * 0.36) * k, (0.31 + hi * 0.3) * k)
        return pixels(128, 128, f)
    return cached("water", paint)


def murk():
    def paint():
        n = noise_field(128, 128, 6, 4, 20)
        return pixels(128, 128, lambda x, y, i: (0.1 * (0.6 + 0.8 * n[i]), 0.17 * (0.6 + 0.8 * n[i]), 0.11 * (0.6 + 0.8 * n[i])))
    return cached("murk", paint)


def leaf_card(base="#4a7a2a", seed=21):
    def paint():
        img = _img(128, 128, True)
        p = painter(img)
        b = hexc(base)
        R = _rng(seed)
        for _ in range(190):
            a, r = R() * 6.283, math.sqrt(R()) * 54
            x, y = 64 + math.cos(a) * r, 64 + math.sin(a) * r * 0.9
            v = 0.45 + R() * 0.6
            ang = R() * 3.14
            L = 6 + R() * 4
            col = (b[0] * v, b[1] * v, b[2] * v)
            line(p, x - math.cos(ang) * L, y - math.sin(ang) * L, x + math.cos(ang) * L, y + math.sin(ang) * L, col, 3.4 + R() * 1.5, 1.0)
        return img
    return cached(f"leaf_{base[1:]}_{seed}", paint)


def pine_card(seed=22):
    def paint():
        img = _img(128, 128, True)
        p = painter(img)
        R = _rng(seed)
        for _ in range(240):
            y = 4 + R() * 120
            spread = 7 + y * 0.4
            x = 64 + (R() - 0.5) * spread * 2
            v = 0.4 + R() * 0.6
            d = 10 if x > 64 else -10
            line(p, x, y, x + d * (0.5 + R() * 0.6), y + 6 + R() * 4, (0.1 * v + 0.04, 0.3 * v + 0.07, 0.17 * v + 0.03), 1.8, 1.0)
        return img
    return cached(f"pine_{seed}", paint)


def grass_blade(base="#5c7c34", seed=23):
    def paint():
        img = _img(64, 64, True)
        p = painter(img)
        b = hexc(base)
        R = _rng(seed)
        for _ in range(14):
            x, h, lean, v = 6 + R() * 52, 30 + R() * 30, (R() - 0.5) * 20, 0.6 + R() * 0.6
            col = (b[0] * v, b[1] * v, b[2] * v)
            pts = [(x, 63), (x + lean * 0.3, 63 - h * 0.6), (x + lean, 63 - h)]
            for a, c in zip(pts, pts[1:]):
                line(p, a[0], a[1], c[0], c[1], col, 2.4 if c is pts[1] else 1.2, 1.0)
        return img
    return cached(f"grass_{base[1:]}_{seed}", paint)


def reed(seed=24):
    def paint():
        img = _img(64, 128, True)
        p = painter(img)
        R = _rng(seed)
        for _ in range(7):
            x, h, ln = 8 + R() * 48, 70 + R() * 50, (R() - 0.5) * 16
            line(p, x, 127, x + ln * 0.4, 127 - h * 0.5, (0.36 + R() * 0.1, 0.4 + R() * 0.1, 0.2), 1.8, 1.0)
            line(p, x + ln * 0.4, 127 - h * 0.5, x + ln, 127 - h, (0.4, 0.42, 0.22), 1.4, 1.0)
            line(p, x + ln, 127 - h, x + ln, 127 - h - 12, (0.3, 0.2, 0.1), 3, 1.0)
        return img
    return cached(f"reed_{seed}", paint)


def heraldry():
    """Original device: a gold keep on a field per bend of blue and crimson, over a white road-chevron."""
    def paint():
        W, H = 128, 160
        img = pixels(W, H, lambda x, y, i: (0.09, 0.17, 0.4) if x * H / W > H - y * 1.0 - 0 or True else (0, 0, 0))
        for y in range(H):
            for x in range(W):
                img.setXel(x, y, *((0.11, 0.2, 0.44) if x / W + y / H < 1.0 else (0.5, 0.1, 0.13)))
        p = painter(img)
        gold = (0.86, 0.68, 0.22)
        line(p, W * 0.12, H * 0.9, W * 0.5, H * 0.66, (0.9, 0.86, 0.78), 9)
        line(p, W * 0.5, H * 0.66, W * 0.88, H * 0.9, (0.9, 0.86, 0.78), 9)
        rect(p, W * 0.33, H * 0.26, W * 0.67, H * 0.58, gold)
        for i in range(3):
            rect(p, W * 0.33 + i * W * 0.1133, H * 0.2, W * 0.33 + i * W * 0.1133 + W * 0.085, H * 0.27, gold)
        rect(p, W * 0.45, H * 0.42, W * 0.55, H * 0.58, (0.45, 0.09, 0.12))
        spot(p, W * 0.5, H * 0.42, W * 0.05, (0.45, 0.09, 0.12), 1.0, False)
        for sx, sy in ((0.2, 0.15), (0.8, 0.15), (0.5, 0.06)):
            spot(p, W * sx, H * sy, 3, gold, 1.0, False)
        for (x0, y0, x1, y1) in ((1, 1, W - 2, 1), (1, H - 2, W - 2, H - 2), (1, 1, 1, H - 2), (W - 2, 1, W - 2, H - 2)):
            line(p, x0, y0, x1, y1, gold, 4)
        n = noise_field(64, 64, 8, 3, 25)
        for y in range(H):
            for x in range(W):
                k = 0.78 + 0.34 * n[(y * 64 // H) * 64 + (x * 64 // W)]
                c = img.getXel(x, y)
                img.setXel(x, y, c[0] * k, c[1] * k, c[2] * k)
        return img
    return cached("heraldry", paint, repeat=False)


def banner():
    def paint():
        img = pixels(64, 128, lambda x, y, i: (0.3 - y * 0.0008, 0.07, 0.09))
        p = painter(img)
        rect(p, 0, 0, 64, 5, (0.5, 0.4, 0.2))
        for pts in (((32, 34), (46, 56)), ((46, 56), (32, 86)), ((32, 86), (18, 56)), ((18, 56), (32, 34))):
            line(p, pts[0][0], pts[0][1], pts[1][0], pts[1][1], (0.9, 0.62, 0.2), 2.2)
        spot(p, 32, 58, 5, (1.0, 0.42, 0.1), 1.0, False)
        for k in range(4):
            line(p, 2 + k * 15, 127, 10 + k * 15, 112, (0.07, 0.02, 0.03), 4)
        return img
    return cached("banner", paint, repeat=False)


def ember_flame():
    def paint():
        img = _img(64, 96, True)
        for y in range(96):
            for x in range(64):
                dx, dy = (x - 32) / 26.0, (y - 62) / 44.0
                # teardrop mask
                wdt = max(0.0, 1 - ((y - 4) / 90.0)) ** 0.7
                d = abs(x - 32) / (26 * (0.25 + 0.75 * math.sin(min(1, y / 70.0) * math.pi * 0.9)))
                if y < 4 or y > 92 or d > 1:
                    continue
                core = max(0, 1 - math.hypot(dx * 1.4, (y - 70) / 36.0))
                a = (1 - d) ** 1.2 * wdt
                img.setXel(x, y, min(1, 0.9 + core * 0.1), min(1, 0.32 + core * 0.7 + (1 - y / 96) * 0.1), 0.05 + core * 0.55)
                img.setAlpha(x, y, min(1, a * 1.6))
        return img
    return cached("flame", paint, repeat=False)


def glow():
    def paint():
        img = _img(64, 64, True)
        for y in range(64):
            for x in range(64):
                d = math.hypot(x - 31.5, y - 31.5) / 32
                a = max(0.0, 1 - d) ** 2.2
                img.setXel(x, y, 1, 1, 1)
                img.setAlpha(x, y, a)
        return img
    return cached("glow", paint, repeat=False, srgb=False)


def blob_shadow():
    def paint():
        img = _img(64, 64, True)
        for y in range(64):
            for x in range(64):
                d = math.hypot(x - 31.5, y - 31.5) / 32
                img.setXel(x, y, 0, 0, 0)
                img.setAlpha(x, y, max(0.0, 1 - d) ** 1.3 * 0.55)
        return img
    return cached("blob", paint, repeat=False, srgb=False)


def detail():
    """Neutral tileable grain multiplied over the terrain for fine close-up texture."""
    def paint():
        n, n2 = noise_field(128, 128, 16, 4, 41), noise_field(128, 128, 48, 2, 42)
        return pixels(128, 128, lambda x, y, i: (lambda k: (k, k, k * 0.97))(0.62 + 0.5 * n[i] + (n2[i] - 0.5) * 0.35))
    return cached("detail", paint)


# ---------------------------------------------------------------- terrain painter
THEMES = {
    "fields": {"base": "#5b7a2e", "a": "#7f9a3a", "b": "#42602a", "road": "#85704c", "edge": "#5b6a30"},
    "wood": {"base": "#3f6a2a", "a": "#5a8434", "b": "#2c4e20", "road": "#6a5a3c", "edge": "#3c4e2a"},
    "bridge": {"base": "#587a30", "a": "#799a3a", "b": "#44642a", "road": "#86704c", "edge": "#506230"},
    "marsh": {"base": "#3d4a34", "a": "#4f5d3c", "b": "#2c3828", "road": "#5d513a", "edge": "#3e4a30"},
    "gate": {"base": "#68803a", "a": "#7f9444", "b": "#52682e", "road": "#7c735c", "edge": "#5b6038"},
    "town": {"base": "#5f8530", "a": "#80a03c", "b": "#456a28", "road": "#8a7452", "edge": "#5b6a30"},
    "hall": {"base": "#4a4540"}, "vault": {"base": "#3a3942"},
}


def paint_ground(L, quality="high"):
    """Stage floor texture; outdoor stages are deterministic, so they are disk cached per (theme, quality)."""
    name = f"ground_{L.theme}_{L.seed}_{quality}"
    if L.theme == "vault":
        return to_texture(_paint_ground(L, quality), name)
    return cached(name, lambda: _paint_ground(L, quality))


def _paint_ground(L, quality="high"):
    S = 0.4 if quality == "low" else 0.72
    w, h = int(L.w * S), int(L.h * S)
    img = PNMImage(w, h, 3)
    theme = THEMES[L.theme]
    base = hexc(theme["base"])
    img.fill(*base)
    p = PNMPainter(img)
    R = _rng(L.seed * 99 + 5)
    sx = sy = S

    def blobs(col, n, rmin, rmax, a):
        for _ in range(n):
            spot(p, R() * w, R() * h, rmin + R() * (rmax - rmin), col, a * (0.5 + R() * 0.5))

    if L.indoor:
        flag = flagstone("#7a766c" if L.theme == "hall" else "#5e5d6c", L.seed % 7)
        tile = PNMImage()
        flag.store(tile)
        tile.applyExponent(1 / 2.2)                                      # Texture.store() hands back linear values
        k = int(128 * S * 1.6)
        tile.quickFilterFrom(tile, 0, 0) if False else None
        for ty in range(0, h, k):
            for tx in range(0, w, k):
                small = PNMImage(k, k, 3)
                small.quickFilterFrom(tile)
                img.copySubImage(small, tx, ty, 0, 0, min(k, w - tx), min(k, h - ty))
        blobs((0, 0, 0), 40, 24 * S * 4, 90 * S * 4, 0.06)
        if L.theme == "hall":
            cp = PNMImage()
            carpet().store(cp)
            cp.applyExponent(1 / 2.2)
            cw = int(120 * sx)
            small = PNMImage(cw, h, 3)
            small.quickFilterFrom(cp)
            img.copySubImage(small, int(800 * sx - cw / 2), 0, 0, 0, cw, h)
        if L.boss and L.theme == "vault":
            for _ in range(22):
                x, y = R() * w, R() * h
                for _ in range(7):
                    nx, ny = x + (R() - 0.5) * 60, y + (R() - 0.5) * 60
                    line(p, x, y, nx, ny, (1.0, 0.36, 0.08), 2.2, 0.6)
                    x, y = nx, ny
        return img

    A, B = hexc(theme["a"]), hexc(theme["b"])
    blobs(A, 260, 7 * sx * 3, 24 * sx * 3, 0.22)
    blobs(B, 260, 7 * sx * 3, 22 * sx * 3, 0.24)
    for _ in range(2500):
        c = A if R() < 0.5 else B
        x, y = int(R() * w), int(R() * h)
        px = img.getXel(x, y)
        img.setXel(x, y, *mix(px, c, 0.4))
    if L.theme in ("fields", "wood", "bridge", "gate", "town"):
        blobs((0.95, 0.9, 0.45), 40, 20 * sx * 3, 50 * sx * 3, 0.1)       # sunlit patches
        for _ in range(260 if L.theme != "wood" else 120):
            fc = ((1.0, 0.95, 0.4), (0.95, 0.95, 0.95), (0.9, 0.35, 0.45), (0.55, 0.5, 0.95))[int(R() * 4)]
            spot(p, R() * w, R() * h, 0.9 + R() * 0.9, fc, 0.85, False)
    if L.theme in ("fields", "wood", "bridge", "gate", "town", "marsh"):                       # hand-painted grass strokes
        n = int(w * h / (110 if quality == "high" else 170))
        for _ in range(n):
            x, y = R() * w, R() * h
            c = mix(A if R() < 0.55 else B, (0.95, 0.95, 0.5), 0.15 * R())
            ln = (2.5 + R() * 4) * (sx * 1.4)
            ang = -1.57 + (R() - 0.5) * 1.2
            line(p, x, y, x + math.cos(ang) * ln, y + math.sin(ang) * ln, c, 0.9, 0.55)
    # leaf litter / dirt speckle for a worn, earthy look
    for _ in range(900):
        c = (0.36 + R() * 0.12, 0.26 + R() * 0.08, 0.14) if R() < 0.6 else (0.5, 0.38, 0.2)
        spot(p, R() * w, R() * h, 0.8 + R(), c, 0.25, False)
    for pl in L.plots:
        x, y = pl["x"] * sx, pl["y"] * sy
        hw, hh = pl["w"] * sx / 2, pl["h"] * sy / 2
        rect(p, x - hw, y - hh, x + hw, y + hh, (0.3, 0.21, 0.12), 0.85)
        yy = y - hh
        while yy < y + hh:
            line(p, x - hw + 2, yy, x + hw - 2, yy, (0.46, 0.5, 0.2) if R() < 0.7 else (0.6, 0.5, 0.2), 2.4, 0.85)
            line(p, x - hw + 2, yy + 3.5, x + hw - 2, yy + 3.5, (0.12, 0.08, 0.04), 1.6, 0.5)
            yy += 6
    if L.theme == "marsh":
        for pool in L.pools:
            spot(p, pool["x"] * sx, pool["y"] * sy, (pool["r"] + 24) * sx, (0.12, 0.16, 0.1), 0.6)
        blobs((0.1, 0.14, 0.1), 120, 8 * sx * 4, 26 * sx * 4, 0.18)
    if L.river:
        x0, x1 = (L.river["x0"] - 26) * sx, (L.river["x1"] + 26) * sx
        rect(p, x0, 0, x1, h, (0.28, 0.22, 0.14), 0.85)
        rect(p, x0 + 8 * sx, 0, x1 - 8 * sx, h, (0.42, 0.36, 0.24), 0.6)
    if L.road:
        def stroke(width, col, a):
            p.setPen(PNMBrush.makeSpot(col + (a,), width * sx / 2, True))
            pts = L.road
            p.drawLine(pts[0][0] * sx, pts[0][1] * sy, pts[0][0] * sx, pts[0][1] * sy)
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                p.drawLine(x0 * sx, y0 * sy, x1 * sx, y1 * sy)
        road = hexc(theme["road"])
        stroke(L.road_w * 2 + 30, hexc(theme["edge"]), 0.35)
        stroke(L.road_w * 2 + 12, (0.25, 0.19, 0.11), 0.6)
        stroke(L.road_w * 2, road, 1.0)
        # ruts
        for off in (-12, 12):
            p.setPen(PNMBrush.makeSpot((0.2, 0.14, 0.08, 0.55), 1.6 * sx * 2, True))
            first = True
            for (x0, y0), (x1, y1) in zip(L.road, L.road[1:]):
                a = math.atan2(y1 - y0, x1 - x0) + math.pi / 2
                px, py = (x0 + math.cos(a) * off) * sx, (y0 + math.sin(a) * off) * sy
                qx, qy = (x1 + math.cos(a) * off) * sx, (y1 + math.sin(a) * off) * sy
                p.drawLine(px, py, qx, qy)
        for (x0, y0), (x1, y1) in zip(L.road, L.road[1:]):
            for _ in range(14):
                t = R()
                x = x0 + (x1 - x0) * t + (R() - 0.5) * L.road_w * 1.7
                y = y0 + (y1 - y0) * t + (R() - 0.5) * L.road_w * 1.7
                spot(p, x * sx, y * sy, 1.0 + R() * 1.4, (0.8, 0.72, 0.56) if R() < 0.5 else (0.26, 0.19, 0.11), 0.5, False)
    if L.theme == "town":
        road = hexc(theme["road"])
        for pts in L.paths:
            for width, col, a in ((86, hexc(theme["edge"]), 0.35), (74, (0.25, 0.19, 0.11), 0.6), (62, road, 1.0)):
                p.setPen(PNMBrush.makeSpot(col + (a,), width * sx / 2, True))
                p.drawLine(pts[0][0] * sx, pts[0][1] * sy, pts[0][0] * sx, pts[0][1] * sy)
                for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                    p.drawLine(x0 * sx, y0 * sy, x1 * sx, y1 * sy)
        cx, cy, cr = L.plaza
        tile = PNMImage()
        stone("#a39d8e", 53, cobbles=True).store(tile)
        tw = tile.getXSize()
        step = max(1, int(1 / sx))
        for yy in range(int((cy - cr - 14) * sy), int((cy + cr + 14) * sy)):
            for xx in range(int((cx - cr - 14) * sx), int((cx + cr + 14) * sx)):
                if not (0 <= xx < w and 0 <= yy < h):
                    continue
                d = math.hypot(xx / sx - cx, yy / sy - cy)
                if d > cr + 12:
                    continue
                c = tuple(max(0.0, v) ** 0.4545 * 1.1 for v in tile.getXel((xx * 3) % tw, (yy * 3) % tw))
                if d > cr:
                    c = (c[0] * 0.55, c[1] * 0.52, c[2] * 0.48)          # dark kerb
                elif cr - 14 < d <= cr:
                    c = (c[0] * 1.15, c[1] * 1.12, c[2] * 1.05)
                elif 70 < d < 86:
                    c = (c[0] * 0.72, c[1] * 0.7, c[2] * 0.66)           # inner ring
                img.setXel(xx, yy, *c)
        for _ in range(120):
            a, rr = R() * math.tau, R() * (cr - 10)
            spot(p, (cx + math.cos(a) * rr) * sx, (cy + math.sin(a) * rr) * sy, 2 + R() * 3, (0.3, 0.45, 0.2), 0.3)
    if L.theme == "gate":
        st = stone("#847f72", 31, cobbles=True)
        tile = PNMImage()
        st.store(tile)
        tile.applyExponent(1 / 2.2)
        k = int(128 * sx * 0.9)
        small = PNMImage(k, k, 3)
        small.quickFilterFrom(tile)
        for ty in range(int(150 * sy), int(420 * sy), k):
            for tx in range(int(500 * sx), int(1100 * sx), k):
                for yy in range(min(k, int(420 * sy) - ty)):
                    for xx in range(min(k, int(1100 * sx) - tx)):
                        fx = (tx + xx) / sx
                        top = 150 + (fx - 560) * 0 if False else 150
                        left = 560 - (ty + yy) / sy * 0 if False else 0
                        # trapezoid courtyard
                        t = ((ty + yy) / sy - 150) / 270
                        if not (560 - 60 * t) <= fx <= (1040 + 60 * t):
                            continue
                        c = small.getXel(xx, yy)
                        img.setXel(tx + xx, ty + yy, *mix(img.getXel(tx + xx, ty + yy), c, 0.9))
    return img
