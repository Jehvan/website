"""Painted HUD art: glass orbs with brass rings (health / mana), generated once per size."""
import math

from panda3d.core import PNMImage, Texture, SamplerState

_cache = {}

COLORS = {"hp": (0.78, 0.1, 0.08), "mp": (0.14, 0.34, 0.95)}


def _tex(img, name):
    t = Texture(name)
    t.load(img)
    t.setMinfilter(SamplerState.FT_linear)
    t.setMagfilter(SamplerState.FT_linear)
    t.setWrapU(SamplerState.WM_clamp)
    t.setWrapV(SamplerState.WM_clamp)
    return t


def _sphere(S, fn):
    """Paint a RGBA image where fn(nx, ny, nz, r) -> (r, g, b, a) inside the unit disc."""
    img = PNMImage(S, S, 4)
    img.fill(0, 0, 0)
    img.alphaFill(0)
    c = (S - 1) / 2
    for y in range(S):
        for x in range(S):
            nx, ny = (x - c) / c, (y - c) / c
            r = math.hypot(nx, ny)
            if r > 1.0:
                continue
            nz = math.sqrt(max(0.0, 1 - r * r))
            col = fn(nx, ny, nz, r)
            edge = min(1.0, (1.0 - r) * c * 0.9)
            img.setXelA(x, y, col[0], col[1], col[2], col[3] * edge)
    return img


def orb_fill(kind, S=128):
    key = ("fill", kind, S)
    if key not in _cache:
        base = COLORS[kind]

        def fn(nx, ny, nz, r):
            lam = max(0.0, nx * -0.35 + ny * -0.5 + nz * 0.8)
            k = 0.28 + 0.95 * lam
            swirl = 0.06 * math.sin(nx * 9 + ny * 5) * math.sin(ny * 7 - nx * 3)
            rim = (r ** 3) * 0.35
            return (min(1, base[0] * (k + swirl) + rim * base[0]), min(1, base[1] * (k + swirl) + rim * 0.3 * base[1]),
                    min(1, base[2] * (k + swirl) + rim * base[2]), 1.0)
        _cache[key] = _tex(_sphere(S, fn), "orb_" + kind)
    return _cache[key]


def orb_back(S=128):
    key = ("back", S)
    if key not in _cache:
        def fn(nx, ny, nz, r):
            k = 0.04 + 0.1 * nz
            return (k * 0.9, k * 0.8, k * 0.8, 0.96)
        _cache[key] = _tex(_sphere(S, fn), "orb_back")
    return _cache[key]


def orb_glass(S=128):
    """Specular highlight + inner shade drawn over the fill."""
    key = ("glass", S)
    if key not in _cache:
        def fn(nx, ny, nz, r):
            hx, hy = nx + 0.38, ny + 0.45
            spec = max(0.0, 1 - math.hypot(hx * 1.5, hy * 2.4)) ** 2
            shade = max(0.0, r - 0.55) ** 1.5 * 0.55
            if spec > shade:
                return (1, 1, 1, min(0.75, spec))
            return (0, 0, 0, min(0.6, shade))
        _cache[key] = _tex(_sphere(S, fn), "orb_glass")
    return _cache[key]


def ring(S=160, thick=0.085):
    """Brass ring as an annulus (outer radius 1, inner radius 1 - thick)."""
    key = ("ring", S)
    if key not in _cache:
        img = PNMImage(S, S, 4)
        img.fill(0, 0, 0)
        img.alphaFill(0)
        c = (S - 1) / 2
        inner = 1 - thick
        for y in range(S):
            for x in range(S):
                nx, ny = (x - c) / c, (y - c) / c
                r = math.hypot(nx, ny)
                if r > 1.0 or r < inner - 0.012:
                    continue
                t = (r - inner) / thick
                bevel = math.sin(max(0.0, min(1.0, t)) * math.pi)
                light = 0.5 + 0.5 * (-nx * 0.5 - ny * 0.8) / max(r, 1e-3)
                k = 0.25 + 0.55 * bevel * (0.45 + 0.7 * light)
                a = min(1.0, (1.0 - r) * c * 0.9, (r - (inner - 0.012)) * c * 0.9)
                img.setXelA(x, y, min(1, 0.85 * k + 0.1), min(1, 0.62 * k + 0.07), min(1, 0.25 * k + 0.03), max(0.0, a))
        _cache[key] = _tex(img, "orb_ring")
    return _cache[key]
