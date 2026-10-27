"""Highkeep Road application: window, input, screens, main loop."""
import math
import os
import sys

from panda3d.core import loadPrcFileData, ConfigVariableString

from . import data as D
from .game import Game, Input
from .save import load_save, write_save, new_save, load_settings, write_settings


def configure(headless=False, size=(1280, 720)):
    cfg = [
        "window-title Highkeep Road", f"win-size {size[0]} {size[1]}", "framebuffer-srgb true", "textures-power-2 none",
        "audio-library-name null", "sync-video true", "notify-level warning", "default-directnotify-level warning",
        "multisamples 4", "framebuffer-multisample 1",
    ]
    if headless:
        cfg.append("window-type offscreen")
    for c in cfg:
        loadPrcFileData("", c)


class HighkeepApp:
    def __init__(self, headless=False, size=(1280, 720), quality=None):
        configure(headless, size)
        from direct.showbase.ShowBase import ShowBase
        from .uikit import Kit
        from .screens import Screens
        from .hud import Hud
        self.base = ShowBase()
        self.base.disableMouse()
        self.base.setBackgroundColor(0.04, 0.03, 0.025)
        self.settings = load_settings()
        if quality:
            self.settings["quality"] = quality
        self.save = load_save()
        self.game = Game(self.save)
        self.game.on_end = self.on_stage_end
        self.kit = Kit(self.base)
        self.screens = Screens(self)
        self.hud = Hud(self)
        self.hud.hide()
        self.scene = None
        self.input = Input()
        self.keys = set()
        self.mouse_down = False
        self.space_down = False
        self.accum = 0.0
        self.mode = "title"
        self._bind()
        self.base.taskMgr.add(self.tick, "tick")
        self.base.accept("aspectRatioChanged", self.on_resize)
        self.base.accept("window-event", self.on_window)
        self.show_hub(False)
        self.screens.title()

    # ------------------------------------------------------------ input
    def _bind(self):
        b = self.base
        for key in ("w", "a", "s", "d", "arrow_up", "arrow_down", "arrow_left", "arrow_right"):
            b.accept(key, self.keys.add, [key])
            b.accept(key + "-up", self.keys.discard, [key])
        b.accept("space", self._space, [True])
        b.accept("space-up", self._space, [False])
        b.accept("mouse1", self.on_click)
        b.accept("mouse1-up", self._mouse_up)
        for i in range(3):
            b.accept(str(i + 1), self._skill, [i])
        b.accept("f", self._potion)
        b.accept("escape", self.on_escape)
        b.accept("p", self.on_escape)

    def _space(self, v):
        self.space_down = v

    def _mouse_up(self):
        self.mouse_down = False

    def _skill(self, i):
        if self.mode == "stage":
            self.input.skills[i] = True

    def _potion(self):
        if self.mode == "stage":
            self.input.potion = True

    def on_click(self):
        if self.mode == "stage" and not self.game.paused:
            pos = self.kit.mouse_px()
            if pos and self.hud.pause_hit(*pos):
                self.on_escape()
                return
            if pos:
                i = self.hud.slot_hit(*pos)
                if i is not None:
                    (self._potion() if i == 3 else self._skill(i))
                    return
            self.mouse_down = True
        else:
            self.kit.click()

    def on_escape(self):
        if self.mode != "stage":
            return
        if self.game.paused:
            self.resume()
        else:
            self.game.paused = True
            self.screens.pause()

    def on_window(self, win):
        if win is self.base.win:
            self.on_resize()

    def on_resize(self):
        if self.scene:
            self.scene.resize()
        if self.mode == "title":
            self.screens.title()
        elif self.mode == "camp":
            self.screens.camp()
        elif self.game.paused and self.mode == "stage":
            self.screens.pause()

    # ------------------------------------------------------------ flow
    def persist(self):
        if self.save:
            write_save(self.save)

    def pick_class(self, cls):
        def go():
            self.save = new_save(cls)
            self.game.save = self.save
            self.persist()
            self.to_camp()
        go()

    def continue_game(self):
        if self.save:
            self.to_camp()

    def to_title(self):
        self.persist()
        self.stop_stage()
        self.mode = "title"
        self.show_hub(False)
        self.screens.title()

    def to_camp(self):
        self.stop_stage()
        self.persist()
        self.mode = "camp"
        self.show_hub(True)
        self.screens.st.update(tab="hero", sel=None, eq_sel=None, bag_sel=None)
        self.screens.camp()

    def ensure_scene(self):
        if self.scene is None:
            from .gfx.scene import SceneRenderer
            self.scene = SceneRenderer(self.base, self.settings)
        return self.scene

    def show_hub(self, side):
        sc = self.ensure_scene()
        cls = self.save["cls"] if self.save else "knight"
        key = (cls, side, self.settings.get("quality", "high"))
        if sc.hub is not None and getattr(sc, "hub_key", None) == key:
            return
        sc.quality = key[2]
        sc.set_hub(cls, side)
        sc.hub_key = key

    def stop_stage(self):
        self.game.mode = "idle"
        self.game.paused = False
        self.hud.hide()
        self.mouse_down = False
        if self.scene:
            self.scene.clear()

    def march(self, sid, floor=0):
        s = self.save
        if not s or (sid == "vault" and s["cleared"] < 6) or (sid != "vault" and sid > s["cleared"] + 1):
            return
        self.screens.clear()
        self.ensure_scene()
        self.game.save = s
        self.scene.quality = self.settings.get("quality", "high")
        self.game.start_stage(sid, floor)
        self.scene.set_stage(self.game)
        self.hud.build(s["cls"])
        self.hud.show()
        self.input = Input()
        self.game.on_end = self.on_stage_end
        self.mode = "stage"
        self.accum = 0.0

    def resume(self):
        self.game.paused = False
        self.screens.clear()

    def quit_stage(self):
        self.screens.clear()
        self.to_camp()

    def set_quality(self, q):
        self.settings["quality"] = q
        write_settings(self.settings)
        if self.scene:
            self.scene.set_quality(q)
            self.scene.set_stage(self.game)
        self.screens.pause()

    def on_stage_end(self, res):
        self.persist()
        self.mode = "result"
        self.hud.hide()
        self.mouse_down = False
        self.screens.result(res)

    # ------------------------------------------------------------ main loop
    def tick(self, task):
        from direct.task.Task import Task
        dt = min(0.1, self.base.clock.getDt())
        self.kit.update_hover()
        self.screens.tick(dt)
        g = self.game
        if self.scene and self.scene.hub is not None and self.mode in ("title", "camp"):
            self.scene.render_hub(dt)
        if g.mode in ("stage", "ended") and self.scene:
            if self.mode == "stage" and not g.paused:
                self._read_input()
                self.accum += dt
                n = 0
                while self.accum >= 1 / 60 and n < 5:
                    g.update(1 / 60, self.input)
                    self.accum -= 1 / 60
                    n += 1
                if n >= 5:
                    self.accum = 0
            elif g.mode == "ended":
                g.shake = 0
            self.scene.render_frame(g, dt)
            if self.mode == "stage":
                self.hud.update(g, self.scene)
        return Task.cont

    def _read_input(self):
        i = self.input
        k = self.keys
        x = (1 if ("d" in k or "arrow_right" in k) else 0) - (1 if ("a" in k or "arrow_left" in k) else 0)
        y = (1 if ("s" in k or "arrow_down" in k) else 0) - (1 if ("w" in k or "arrow_up" in k) else 0)
        if x and y:
            x, y = x * 0.7071, y * 0.7071
        i.mx, i.my = x, y
        i.attack = self.mouse_down or self.space_down
        pos = self.kit.mouse_px()
        if pos:
            i.aim = self.scene.screen_to_world(*pos)

    def run(self):
        self.base.run()


def main(argv=None):
    app = HighkeepApp()
    app.run()
