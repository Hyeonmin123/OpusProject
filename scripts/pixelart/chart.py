"""The map's vellum chart, drawn as pixel art on its final grid.

    python3 scripts/pixelart/chart.py        # -> src/assets/bg/map-chart.png

The node graph on the map screen is 444 x 850 CSS px; the chart is a 222 x 425 grid exported
at 2x, so each art pixel is 2 x 2 CSS px like the rest of the chrome, and the map shows it 1:1.
It replaces the Figma-era vector chart (bg/mapChart) and keeps its design: dark vellum lit
toward the middle, faint wavy survey lines and a sparse grid, a few old stains, a compass rose
at the top where the boss sits, and a thin rounded border with a dot at each corner.

Same rules as the UI kit (uikit.py): only the locked palette of pxlib.py, flat steps, shading
only as ordered (Bayer) dither between neighbouring steps, 1px lines, no anti-aliasing.
Everything stays in the darkest steps so the nodes and paths in front keep the contrast.
"""

from __future__ import annotations

import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from pxlib import PAL  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'src', 'assets', 'bg', 'map-chart.png')
W, H = 222, 425
SCALE = 2

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
# The vellum's tone ramp, darkest first: level 0..3 between these steps, dithered.
RAMP = ['d0', 'd1', 'd2', 'd3']


def vellum() -> np.ndarray:
    """Tone level (0..3, fractional) per pixel: lit toward the upper middle, darker at the
    edges and the bottom, with a few stains."""
    y, x = np.mgrid[0:H, 0:W].astype(float) + 0.5
    nx = (x - W / 2) / (W / 2)
    ny = (y - H * 0.42) / (H * 0.62)
    lvl = 2.15 - 0.95 * np.sqrt(nx ** 2 * 0.8 + ny ** 2)
    # a slow warm swell down the middle of the sheet
    lvl += 0.18 * np.cos(ny * 2.2) * np.exp(-nx ** 2 * 2)
    # stains: soft ellipses that pull the tone down (positions from the vector chart)
    for cx, cy, rx, ry, depth in [(65, 110, 20, 12, 0.55), (68, 80, 10, 6, 0.4),
                                  (135, 85, 20, 17, 0.5), (55, 162, 32, 16, 0.5),
                                  (110, 266, 36, 22, 0.55), (116, 306, 34, 24, 0.45),
                                  (22, 344, 18, 12, 0.4), (105, 360, 24, 16, 0.4),
                                  (170, 392, 26, 10, 0.3)]:
        d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
        lvl -= depth * np.clip(1.2 - d, 0, 1)
    return np.clip(lvl, 0, 3)


def dither(lvl: np.ndarray) -> np.ndarray:
    """Tone level -> ramp index with ordered dither between neighbouring steps."""
    base = np.floor(lvl)
    frac = lvl - base
    y, x = np.mgrid[0:H, 0:W]
    idx = base + (BAYER4[y % 4, x % 4] < frac)
    return np.clip(idx, 0, len(RAMP) - 1).astype(int)


class Chart:
    def __init__(self):
        self.k = np.array(RAMP, dtype=object)[dither(vellum())]

    def put(self, x, y, key):
        if 0 <= x < W and 0 <= y < H:
            self.k[y, x] = key

    def lighten(self, x, y, key='d3'):
        """A faint line: one step up from the vellum under it (never onto a darker step)."""
        if 0 <= x < W and 0 <= y < H and self.k[y, x] in ('d0', 'd1', 'd2'):
            self.k[y, x] = key if self.k[y, x] != 'd0' else 'd2'

    def line(self, x0, y0, x1, y1, key, step=1, faint=False):
        """1px line (DDA); `step` > 1 dots it."""
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(0, int(n) + 1, step):
            t = i / n
            x, y = round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t)
            (self.lighten(x, y, key) if faint else self.put(x, y, key))

    def circle(self, cx, cy, r, key, step=1):
        n = int(2 * math.pi * r)
        seen = set()
        for i in range(0, n, step):
            a = 2 * math.pi * i / n
            p = (round(cx + r * math.cos(a)), round(cy + r * math.sin(a)))
            if p not in seen:
                seen.add(p)
                self.put(*p, key)

    def rgba(self) -> np.ndarray:
        out = np.zeros((H, W, 4), np.uint8)
        for key in set(self.k.ravel()):
            out[self.k == key, :3] = PAL[key]
        out[..., 3] = 255
        return out


def survey_lines(c: Chart):
    """Wavy horizontal survey lines every 24 px, broken here and there, and a sparse dotted
    grid of verticals."""
    for i, y0 in enumerate(range(14, H - 10, 24)):
        phase = i * 1.7
        for x in range(8, W - 8):
            if (x + i * 13) % 53 < 4:  # breaks
                continue
            y = y0 + round(1.4 * math.sin(x / 17.0 + phase) + 0.8 * math.sin(x / 7.3 + phase * 2))
            c.lighten(x, y)
    for x in range(37, W - 8, 37):
        for y in range(10, H - 10, 3):
            c.lighten(x, y, 'd2')


def compass(c: Chart, cx=111, cy=37):
    """A compass rose behind the boss node: two rings, 16 rays, a gilt star at the heart."""
    c.circle(cx, cy, 34, 's0', step=2)
    c.circle(cx, cy, 25, 's0')
    for k in range(16):
        a = -math.pi / 2 + k * math.pi / 8
        long = k % 4 == 0
        r = 40 if long else (30 if k % 2 == 0 else 22)
        c.line(cx, cy, cx + r * math.cos(a), cy + r * math.sin(a), 's0' if long else 'd3',
               step=1 if long else 2)
    # the star: 8 points, filled, in bronze with a gilt spine on the cardinal points
    for y in range(cy - 14, cy + 15):
        for x in range(cx - 14, cx + 15):
            dx, dy = x - cx, y - cy
            r = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            spike = abs(math.cos(4 * a)) ** 6
            reach = 3 + 11 * spike * (1.0 if abs(math.cos(2 * a)) > 0.7 else 0.55)
            if r <= reach:
                c.put(x, y, 's1' if r > 3 else 'g0')
    for k in range(4):
        a = -math.pi / 2 + k * math.pi / 2
        c.line(cx, cy, cx + 13 * math.cos(a), cy + 13 * math.sin(a), 's2')
        c.line(cx, cy, cx + 5 * math.cos(a), cy + 5 * math.sin(a), 'g0')
    c.put(cx, cy, 'g1')


def border(c: Chart, inset=6, radius=10):
    """A thin rounded border with a gilt dot at each corner, and a d0 edge round the sheet."""
    x0, y0, x1, y1 = inset, inset, W - 1 - inset, H - 1 - inset
    for x in range(x0 + radius, x1 - radius + 1):
        c.put(x, y0, 's0')
        c.put(x, y1, 's0')
    for y in range(y0 + radius, y1 - radius + 1):
        c.put(x0, y, 's0')
        c.put(x1, y, 's0')
    for (cx, cy, qx, qy) in [(x0 + radius, y0 + radius, -1, -1), (x1 - radius, y0 + radius, 1, -1),
                             (x0 + radius, y1 - radius, -1, 1), (x1 - radius, y1 - radius, 1, 1)]:
        for i in range(0, 40):
            a = i / 39 * math.pi / 2
            c.put(round(cx + qx * radius * math.cos(a)), round(cy + qy * radius * math.sin(a)),
                  's0')
    for x, y in [(x0 + 3, y0 + 3), (x1 - 3, y0 + 3), (x0 + 3, y1 - 3), (x1 - 3, y1 - 3)]:
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            c.put(x + dx, y + dy, 'g0' if (dx, dy) == (0, 0) else 's0')
    c.k[0, :] = c.k[-1, :] = 'd0'
    c.k[:, 0] = c.k[:, -1] = 'd0'


def build() -> np.ndarray:
    c = Chart()
    survey_lines(c)
    compass(c)
    border(c)
    return c.rgba()


if __name__ == '__main__':
    rgba = build()
    img = Image.fromarray(rgba, 'RGBA').convert('RGB')
    img.resize((W * SCALE, H * SCALE), Image.NEAREST).save(OUT, optimize=True)
    print(f'{W}x{H} chart -> {os.path.relpath(OUT, ROOT)} (@{SCALE}x)')
