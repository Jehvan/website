"""Procedural mesh builder: accumulate shapes (with transforms) into one Geom with normals, UVs and vertex colours."""
import math

from panda3d.core import (Geom, GeomNode, GeomTriangles, GeomVertexData, GeomVertexFormat, GeomVertexWriter, Mat3, Mat4,
                          NodePath, TransformState, Vec3, LVector3f, Point3)

TAU = math.tau


def xf(pos=(0, 0, 0), hpr=(0, 0, 0), scale=(1, 1, 1)):
    """Matrix from position, heading/pitch/roll (degrees) and scale."""
    if not isinstance(scale, (tuple, list)):
        scale = (scale, scale, scale)
    return TransformState.makePosHprScale(Vec3(*pos), Vec3(*hpr), Vec3(*scale)).getMat()


IDENT = Mat4.identMat()


class Mesh:
    def __init__(self):
        self.pos, self.nrm, self.uv, self.col = [], [], [], []
        self.tris = []

    # -- low level
    def _emit(self, verts, norms, uvs, color, faces, m):
        nm = None
        if m is not None:
            nm = Mat3(m.getUpper3())
            nm.invertInPlace()
            nm.transposeInPlace()
        base = len(self.pos)
        for p, n, t in zip(verts, norms, uvs):
            if m is not None:
                q = m.xformPoint(Point3(*p))
                nn = nm.xform(Vec3(*n))
                nn.normalize()
                self.pos.append((q[0], q[1], q[2]))
                self.nrm.append((nn[0], nn[1], nn[2]))
            else:
                self.pos.append(tuple(p))
                self.nrm.append(tuple(n))
            self.uv.append(t)
            self.col.append(color)
        for f in faces:
            self.tris.append((base + f[0], base + f[1], base + f[2]))

    # -- shapes
    def box(self, size=(1, 1, 1), m=None, color=(1, 1, 1, 1), uv=(1, 1), origin="center"):
        sx, sy, sz = (size[0] / 2, size[1] / 2, size[2] / 2)
        oz = sz if origin == "base" else 0
        faces = [((1, 0, 0), [(sx, -sy, -sz), (sx, sy, -sz), (sx, sy, sz), (sx, -sy, sz)], (size[1], size[2])),
                 ((-1, 0, 0), [(-sx, sy, -sz), (-sx, -sy, -sz), (-sx, -sy, sz), (-sx, sy, sz)], (size[1], size[2])),
                 ((0, 1, 0), [(sx, sy, -sz), (-sx, sy, -sz), (-sx, sy, sz), (sx, sy, sz)], (size[0], size[2])),
                 ((0, -1, 0), [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, -sy, sz), (-sx, -sy, sz)], (size[0], size[2])),
                 ((0, 0, 1), [(-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)], (size[0], size[1])),
                 ((0, 0, -1), [(-sx, sy, -sz), (sx, sy, -sz), (sx, -sy, -sz), (-sx, -sy, -sz)], (size[0], size[1]))]
        for n, vs, (du, dv) in faces:
            vs = [(a, b, c + oz) for a, b, c in vs]
            uvs = [(0, 0), (du * uv[0] / 32, 0), (du * uv[0] / 32, dv * uv[1] / 32), (0, dv * uv[1] / 32)]
            self._emit(vs, [n] * 4, uvs, color, [(0, 1, 2), (0, 2, 3)], m)
        return self

    def lathe(self, profile, seg=12, m=None, color=(1, 1, 1, 1), uvs=1.0, smooth=True, close_top=True, close_bottom=True):
        """Revolve [(radius, z), ...] about Z. Profile runs bottom->top."""
        n = len(profile)
        rows = []
        for i, (r, z) in enumerate(profile):
            # profile tangent -> outward normal (in r,z plane)
            if i == 0:
                dr, dz = profile[1][0] - r, profile[1][1] - z
            elif i == n - 1:
                dr, dz = r - profile[i - 1][0], z - profile[i - 1][1]
            else:
                dr, dz = profile[i + 1][0] - profile[i - 1][0], profile[i + 1][1] - profile[i - 1][1]
            ln = math.hypot(dr, dz) or 1
            nr, nz = dz / ln, -dr / ln
            rows.append((r, z, nr, nz))
        length = [0.0]
        for i in range(1, n):
            length.append(length[-1] + math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]))
        verts, norms, uv, faces = [], [], [], []
        for i, (r, z, nr, nz) in enumerate(rows):
            for k in range(seg + 1):
                a = k / seg * TAU
                ca, sa = math.cos(a), math.sin(a)
                verts.append((r * ca, r * sa, z))
                norms.append((nr * ca, nr * sa, nz))
                uv.append((k / seg * uvs * max(1, rows[0][0] * 0.4 + 1) , length[i] / 24 * uvs))
        for i in range(n - 1):
            for k in range(seg):
                a, b = i * (seg + 1) + k, i * (seg + 1) + k + 1
                c, d = (i + 1) * (seg + 1) + k, (i + 1) * (seg + 1) + k + 1
                faces.append((a, b, d))
                faces.append((a, d, c))
        self._emit(verts, norms, uv, color, faces, m)
        if close_top and profile[-1][0] > 1e-4:
            self._disc(profile[-1][0], profile[-1][1], seg, (0, 0, 1), m, color, up=True)
        if close_bottom and profile[0][0] > 1e-4:
            self._disc(profile[0][0], profile[0][1], seg, (0, 0, -1), m, color, up=False)
        return self

    def _disc(self, r, z, seg, nrm, m, color, up):
        verts = [(0, 0, z)] + [(r * math.cos(k / seg * TAU), r * math.sin(k / seg * TAU), z) for k in range(seg)]
        uv = [(0.5, 0.5)] + [(0.5 + 0.5 * math.cos(k / seg * TAU), 0.5 + 0.5 * math.sin(k / seg * TAU)) for k in range(seg)]
        faces = [(0, 1 + k, 1 + (k + 1) % seg) if up else (0, 1 + (k + 1) % seg, 1 + k) for k in range(seg)]
        self._emit(verts, [nrm] * len(verts), uv, color, faces, m)

    def cylinder(self, r0, r1, h, seg=10, m=None, color=(1, 1, 1, 1), caps=True, origin="base", uvs=1.0):
        """Tapered cylinder along Z; r0 at the bottom, r1 at the top. origin 'base' (z 0..h) or 'center'."""
        z0 = 0 if origin == "base" else -h / 2
        return self.lathe([(r0, z0), (r1, z0 + h)], seg, m, color, uvs, close_top=caps, close_bottom=caps)

    def cone(self, r, h, seg=8, m=None, color=(1, 1, 1, 1)):
        return self.lathe([(r, 0), (0.001, h)], seg, m, color, close_top=False)

    def sphere(self, r=1.0, seg=12, rings=8, m=None, color=(1, 1, 1, 1), theta=math.pi, uvs=1.0):
        prof = [(r * math.sin(i / rings * theta), -r * math.cos(i / rings * theta)) for i in range(rings + 1)]
        prof[0] = (0.0005, prof[0][1])
        if theta >= math.pi - 1e-6:
            prof[-1] = (0.0005, prof[-1][1])
        return self.lathe(prof, seg, m, color, uvs, close_top=False, close_bottom=False)

    def dome(self, r, seg=12, rings=5, m=None, color=(1, 1, 1, 1), frac=0.5):
        """Cap of a sphere: from the equator (z=0) up to angle frac*pi from the bottom."""
        prof = []
        for i in range(rings + 1):
            a = i / rings * (math.pi / 2) * frac * 2
            prof.append((r * math.cos(a), r * math.sin(a)))
        prof[-1] = (max(0.0005, prof[-1][0]), prof[-1][1])
        return self.lathe(prof, seg, m, color, close_top=False, close_bottom=False)

    def torus(self, R, r, seg=16, rseg=6, m=None, color=(1, 1, 1, 1), arc=TAU):
        verts, norms, uv, faces = [], [], [], []
        for i in range(seg + 1):
            a = i / seg * arc
            ca, sa = math.cos(a), math.sin(a)
            for j in range(rseg + 1):
                b = j / rseg * TAU
                cb, sb = math.cos(b), math.sin(b)
                verts.append(((R + r * cb) * ca, (R + r * cb) * sa, r * sb))
                norms.append((cb * ca, cb * sa, sb))
                uv.append((i / seg * 2, j / rseg))
        for i in range(seg):
            for j in range(rseg):
                a, b = i * (rseg + 1) + j, (i + 1) * (rseg + 1) + j
                faces.append((a, b, b + 1))
                faces.append((a, b + 1, a + 1))
        self._emit(verts, norms, uv, color, faces, m)
        return self

    def quad(self, p0, p1, p2, p3, color=(1, 1, 1, 1), uv=((0, 0), (1, 0), (1, 1), (0, 1)), m=None, double=False):
        a = Vec3(*p1) - Vec3(*p0)
        b = Vec3(*p3) - Vec3(*p0)
        n = a.cross(b)
        n.normalize()
        nn = (n[0], n[1], n[2])
        self._emit([p0, p1, p2, p3], [nn] * 4, list(uv), color, [(0, 1, 2), (0, 2, 3)], m)
        if double:
            nb = (-nn[0], -nn[1], -nn[2])
            self._emit([p0, p3, p2, p1], [nb] * 4, [uv[0], uv[3], uv[2], uv[1]], color, [(0, 1, 2), (0, 2, 3)], m)
        return self

    def extrude(self, outline, depth, m=None, color=(1, 1, 1, 1), bevel=0.0):
        """Extrude a convex-ish 2D outline [(x,z)...] (in the XZ plane) along +Y by depth, with side walls."""
        n = len(outline)
        cx = sum(p[0] for p in outline) / n
        cz = sum(p[1] for p in outline) / n
        # front (y=-depth/2 side facing -Y) and back caps as fans
        for sign, yy in ((-1, -depth / 2), (1, depth / 2)):
            verts = [(cx, yy, cz)] + [(p[0], yy, p[1]) for p in outline]
            uv = [(0.5, 0.5)] + [((p[0] - cx) / 20 + 0.5, (p[1] - cz) / 20 + 0.5) for p in outline]
            faces = [(0, 1 + k, 1 + (k + 1) % n) if sign < 0 else (0, 1 + (k + 1) % n, 1 + k) for k in range(n)]
            self._emit(verts, [(0, sign, 0)] * len(verts), uv, color, faces, m)
        for k in range(n):
            a, b = outline[k], outline[(k + 1) % n]
            dx, dz = b[0] - a[0], b[1] - a[1]
            ln = math.hypot(dx, dz) or 1
            nn = (dz / ln, 0, -dx / ln)
            self._emit([(a[0], -depth / 2, a[1]), (b[0], -depth / 2, b[1]), (b[0], depth / 2, b[1]), (a[0], depth / 2, a[1])],
                       [nn] * 4, [(0, 0), (ln / 20, 0), (ln / 20, depth / 20), (0, depth / 20)], color, [(0, 1, 2), (0, 2, 3)], m)
        return self

    # -- output
    def build(self, name="mesh"):
        fmt = GeomVertexFormat.getV3n3c4t2()
        vd = GeomVertexData(name, fmt, Geom.UHStatic)
        n = len(self.pos)
        vd.setNumRows(n)
        wv, wn, wc, wt = (GeomVertexWriter(vd, c) for c in ("vertex", "normal", "color", "texcoord"))
        for i in range(n):
            wv.addData3(*self.pos[i])
            wn.addData3(*self.nrm[i])
            wc.addData4(*self.col[i])
            wt.addData2(*self.uv[i])
        prim = GeomTriangles(Geom.UHStatic)
        for a, b, c in self.tris:
            prim.addVertices(a, b, c)
        prim.closePrimitive()
        geom = Geom(vd)
        geom.addPrimitive(prim)
        node = GeomNode(name)
        node.addGeom(geom)
        return NodePath(node)

    def __len__(self):
        return len(self.pos)
