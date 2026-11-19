"""Pick the nicest serif font available on this machine (system fonts only - nothing is bundled)."""
import os
import sys

from panda3d.core import Filename

CANDIDATES = [
    # Windows
    "C:/Windows/Fonts/georgiab.ttf", "C:/Windows/Fonts/georgia.ttf", "C:/Windows/Fonts/pala.ttf", "C:/Windows/Fonts/times.ttf",
    # macOS
    "/System/Library/Fonts/Supplemental/Georgia Bold.ttf", "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/System/Library/Fonts/Supplemental/Palatino.ttc", "/Library/Fonts/Georgia.ttf",
    # Linux
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf", "/usr/share/fonts/TTF/DejaVuSerif-Bold.ttf",
]
SANS = [
    "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]
_loaded = {}


def load(loader, kind="serif"):
    if kind in _loaded:
        return _loaded[kind]
    font = None
    for path in (CANDIDATES if kind == "serif" else SANS):
        if os.path.exists(path):
            try:
                font = loader.loadFont(Filename.fromOsSpecific(path))
                font.setPixelsPerUnit(72)
                font.setPageSize(1024, 1024)
                font.setMinfilter(2)
                break
            except Exception:
                font = None
    _loaded[kind] = font
    return font
