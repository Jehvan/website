"""Unlit translucent helpers: glow sprites, ground decals, rings, flames."""
import math

from panda3d.core import (ColorBlendAttrib, NodePath, TransparencyAttrib, Vec4, DepthWriteAttrib, CullFaceAttrib, TextureStage)

from .meshlib import Mesh, xf
from . import textures as T

_cache = {}


def _finish(np, additive=True, depth_test=True):
    np.setShaderOff(1)
    np.setLightOff(1)
    np.setFogOff(1)
    np.setTransparency(TransparencyAttrib.MAlpha)
    np.setDepthWrite(False)
    np.setBin("fixed", 20)
    if additive:
        np.setAttrib(ColorBlendAttrib.make(ColorBlendAttrib.MAdd, ColorBlendAttrib.OIncomingAlpha, ColorBlendAttrib.OOne))
    np.setTwoSided(True)
    return np


def sprite(tex_fn, size, color=(1, 1, 1, 1), additive=True, aspect=1.0):
    """Camera-facing quad (billboard)."""
    key = ("sprite", id(tex_fn))
    m = Mesh()
    m.quad((-0.5, 0, -0.5), (0.5, 0, -0.5), (0.5, 0, 0.5), (-0.5, 0, 0.5), double=True)
    np = m.build("sprite")
    np.setTexture(tex_fn())
    np.setBillboardPointEye()
    np.setScale(size * aspect, 1, size)
    np.setColor(*color)
    return _finish(np, additive)


def glow(size, color, op=1.0):
    return sprite(T.glow, size, (color[0], color[1], color[2], op))


def flame(w, h, color=(1, 1, 1, 1)):
    np = sprite(T.ember_flame, 1.0, color)
    np.setScale(w, 1, h)
    return np


def _flat(profile, seg, name):
    if name in _cache:
        return _cache[name]
    m = Mesh().lathe(profile, seg, close_top=False, close_bottom=False)
    np = m.build(name)
    _cache[name] = np
    return np


def ring(color, op=1.0, inner=0.9, seg=48):
    np = _flat([(1.0, 0), (inner, 0)], seg, f"ring{inner}").copyTo(NodePath("ring"))
    np.setColor(color[0], color[1], color[2], op)
    return _finish(np, additive=False)


def disc(color, op=1.0, seg=40):
    np = _flat([(1.0, 0), (0.001, 0)], seg, "disc").copyTo(NodePath("disc"))
    np.setColor(color[0], color[1], color[2], op)
    return _finish(np, additive=False)


def additive_ring(color, op=1.0, inner=0.9):
    np = ring(color, op, inner)
    np.setAttrib(ColorBlendAttrib.make(ColorBlendAttrib.MAdd, ColorBlendAttrib.OIncomingAlpha, ColorBlendAttrib.OOne))
    return np


def arc_mesh(arc_deg, inner=0.72, seg=24):
    m = Mesh()
    a0 = -math.radians(arc_deg) / 2
    da = math.radians(arc_deg) / seg
    for i in range(seg):
        a, b = a0 + i * da, a0 + (i + 1) * da
        # angle measured from +Y (forward) - flat in the XY plane
        p = lambda ang, r: (math.sin(ang) * r, math.cos(ang) * r, 0)
        m.quad(p(a, inner), p(b, inner), p(b, 1.0), p(a, 1.0), double=True)
    return m.build("arc")


def beam(color, op=0.5, r=1.0, h=1.0, seg=10):
    key = "beam"
    if key not in _cache:
        _cache[key] = Mesh().lathe([(1, 0), (1, 1)], seg, close_top=False, close_bottom=False).build("beam")
    np = _cache[key].copyTo(NodePath("beam"))
    np.setColor(color[0], color[1], color[2], op)
    np.setScale(r, r, h)
    return _finish(np, True)
