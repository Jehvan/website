"""Tiny retained-mode UI on Panda's pixel space: cards, text, buttons with hit testing. Screens rebuild on state change."""
from panda3d.core import CardMaker, NodePath, TextNode, TransparencyAttrib, LineSegs, Vec4

from . import fonts
from .icons import icon

INK = (0.92, 0.87, 0.78, 1)
DIM = (0.66, 0.6, 0.49, 1)
EMBER = (1.0, 0.69, 0.29, 1)
EMBER_D = (0.91, 0.51, 0.18, 1)
GOOD = (0.48, 0.82, 0.48, 1)
BAD = (0.91, 0.38, 0.29, 1)
PANEL = (0.13, 0.105, 0.085, 0.96)
PANEL2 = (0.17, 0.135, 0.1, 0.97)
LINE = (0.35, 0.275, 0.19, 1)
LINE2 = (0.54, 0.42, 0.28, 1)


class N(NodePath):
    """NodePath that can carry attributes."""


class Hit:
    __slots__ = ("x", "y", "w", "h", "cb", "enabled", "node", "colors", "tip", "fill")

    def __init__(self, x, y, w, h, cb, enabled=True, node=None, colors=None):
        self.x, self.y, self.w, self.h, self.cb, self.enabled, self.node, self.colors = x, y, w, h, cb, enabled, node, colors


class Kit:
    def __init__(self, base):
        self.base = base
        self.serif = fonts.load(base.loader, "serif")
        self.sans = fonts.load(base.loader, "sans")
        self.layer = base.pixel2d.attachNewNode("ui")
        self.layer.setBin("gui-popup", 0)
        self.hits = []
        self.hover = None
        self.modal_stack = []
        self._cm = CardMaker("card")

    # ------------------------------------------------------------ lifecycle
    @property
    def W(self):
        return self.base.win.getXSize()

    @property
    def H(self):
        return self.base.win.getYSize()

    def clear(self):
        for c in self.layer.getChildren():
            c.removeNode()
        self.hits = []
        self.hover = None

    def new_layer(self, name="screen"):
        return self.layer.attachNewNode(name)

    # ------------------------------------------------------------ drawing
    def box(self, parent, x, y, w, h, color=PANEL, border=None, bw=1.5):
        n = N(parent.attachNewNode("box"))
        if border:
            self._card(n, x - bw, y - bw, w + 2 * bw, h + 2 * bw, border)
        n.fill = self._card(n, x, y, w, h, color)
        return n

    def _card(self, parent, x, y, w, h, color):
        self._cm.setFrame(0, w, -h, 0)
        c = parent.attachNewNode(self._cm.generate())
        c.setPos(x, 0, -y)
        c.setColor(*color)
        if color[3] < 1:
            c.setTransparency(TransparencyAttrib.MAlpha)
        return c

    def gradient(self, parent, x, y, w, h, top, bottom, steps=24):
        for i in range(steps):
            t = i / (steps - 1)
            col = tuple(top[k] + (bottom[k] - top[k]) * t for k in range(4))
            self._card(parent, x, y + h * i / steps, w, h / steps + 1, col)

    def text(self, parent, x, y, s, size=18, color=INK, align="left", serif=True, wrap=None, shadow=True, bold=False):
        tn = TextNode("t")
        tn.setText(str(s))
        f = self.serif if serif else self.sans
        if f:
            tn.setFont(f)
        tn.setTextColor(*color)
        if shadow:
            tn.setShadow(0.04, 0.04)
            tn.setShadowColor(0, 0, 0, 0.8)
        tn.setAlign({"left": TextNode.ALeft, "center": TextNode.ACenter, "right": TextNode.ARight}[align])
        if wrap:
            tn.setWordwrap(wrap / size)
        np = N(parent.attachNewNode(tn))
        np.setScale(size)
        np.setPos(x, 0, -y - size * 0.8)
        h = tn.getHeight() * size
        np.text_h = h
        np.text_w = tn.getWidth() * size
        return np

    def image(self, parent, tex, x, y, w, h, color=(1, 1, 1, 1)):
        self._cm.setFrame(0, w, -h, 0)
        c = parent.attachNewNode(self._cm.generate())
        c.setPos(x, 0, -y)
        c.setTexture(tex)
        c.setColor(*color)
        c.setTransparency(TransparencyAttrib.MAlpha)
        return c

    def icon(self, parent, name, x, y, size=40):
        return self.image(parent, icon(name, 64), x, y, size, size)

    def line(self, parent, pts, color=LINE2, thick=3):
        ls = LineSegs()
        ls.setThickness(thick)
        ls.setColor(*color)
        ls.moveTo(pts[0][0], 0, -pts[0][1])
        for p in pts[1:]:
            ls.drawTo(p[0], 0, -p[1])
        return parent.attachNewNode(ls.create())

    # ------------------------------------------------------------ widgets
    def button(self, parent, x, y, w, h, label, cb, kind="normal", enabled=True, size=17, icon_name=None):
        pal = {
            "normal": ((0.25, 0.2, 0.15, 1), (0.33, 0.26, 0.19, 1), LINE2),
            "primary": ((0.78, 0.4, 0.14, 1), (0.92, 0.52, 0.2, 1), (1.0, 0.75, 0.43, 1)),
            "on": ((0.3, 0.22, 0.14, 1), (0.38, 0.28, 0.17, 1), EMBER),
            "tab": ((0.17, 0.135, 0.1, 1), (0.24, 0.19, 0.14, 1), LINE),
        }[kind]
        col = pal[0] if enabled else (pal[0][0] * 0.6, pal[0][1] * 0.6, pal[0][2] * 0.6, 0.8)
        n = self.box(parent, x, y, w, h, col, pal[2] if enabled else LINE)
        if icon_name:
            self.icon(n, icon_name, x + 6, y + (h - 28) / 2, 28)
        tc = INK if enabled else DIM
        if kind == "primary" and enabled:
            tc = (1, 0.96, 0.88, 1)
        t = self.text(n, x + (w + (34 if icon_name else 0)) / 2, y + (h - size) / 2 - 1, label, size, tc, "center")
        hit = Hit(x, y, w, h, cb, enabled, n, (col, pal[1]))
        hit.fill = n.fill
        self.hits.append(hit)
        return n

    def hotspot(self, x, y, w, h, cb, enabled=True):
        self.hits.append(Hit(x, y, w, h, cb, enabled))

    def bar(self, parent, x, y, w, h, frac, color, back=(0.04, 0.03, 0.02, 0.9)):
        self.box(parent, x, y, w, h, back, (0, 0, 0, 1), 1)
        if frac > 0:
            self._card(parent, x, y, w * max(0.0, min(1.0, frac)), h, color)

    # ------------------------------------------------------------ interaction
    def mouse_px(self):
        mw = self.base.mouseWatcherNode
        if mw is None or not mw.hasMouse():
            return None
        m = mw.getMouse()
        return (m.x + 1) / 2 * self.W, (1 - (m.y + 1) / 2) * self.H

    def _at(self, px, py):
        for h in reversed(self.hits):
            if h.x <= px <= h.x + h.w and h.y <= py <= h.y + h.h:
                return h
        return None

    def update_hover(self):
        pos = self.mouse_px()
        h = self._at(*pos) if pos else None
        if h is not self.hover:
            if self.hover and self.hover.node and self.hover.colors and self.hover.enabled:
                self._recolor(self.hover, 0)
            if h and h.node and h.colors and h.enabled:
                self._recolor(h, 1)
            self.hover = h

    def _recolor(self, hit, idx):
        hit.fill.setColor(*hit.colors[idx])

    def click(self):
        pos = self.mouse_px()
        if not pos:
            return False
        h = self._at(*pos)
        if h and h.enabled and h.cb:
            h.cb()
            return True
        return h is not None
