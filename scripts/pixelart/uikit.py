"""Pixel UI kit: the UI chrome, designed on its final pixel grid and round-tripped through Figma.

    python3 scripts/pixelart/uikit.py seed              # use_figma scripts + previews (build/uikit)
    python3 scripts/pixelart/uikit.py import SHEET...   # Figma export sheets -> src/assets/
    python3 scripts/pixelart/uikit.py check             # verify the committed PNGs
    python3 scripts/pixelart/uikit.py draft             # drawings -> src/assets (iteration only)

The Figma file "Endless Cellar — Pixel UI Kit"
(https://www.figma.com/design/m2OXVtN1pXojVj6c7EKelg) is the source of the chrome. Every
asset there is a component drawn 1 Figma unit = 1 art pixel, as one vector layer per palette
colour (bound to the "Pixel palette" variables), and every page has an "Export sheet" frame
holding that page's components at the positions `layout()` gives them. `seed` turns the
drawings below into use_figma scripts (build/uikit/figma/*.js, figma_seed.js plus a batch of
pixel data) that build or rebuild those components; `import` takes the sheets exported from
Figma at 2x (PNG, the sheets' export setting), crops each component out, checks that every
pixel is on the palette and on the 2x2 grid, and writes src/assets/ui/*.png (and the card
ornaments in src/assets/art/). Nothing is ever resampled: the PNGs are 2x and shown 1:1 in the
CSS (`image-rendering: pixelated` keeps them hard on high-DPI screens). The one exception is
the Icons page (map nodes, relics, events; drawn in icons.py): those are on the gameplay icons'
32px grid and export at 4x, like `src/assets/icons/*.png`. `check` reports any
asset that no longer matches its drawing here (i.e. was edited in Figma).

Rules every asset follows (the same discipline as the Gemini-derived portraits, icons and
scenes): hard 1px outlines, flat fills from the locked palette in pxlib.py (plus a handful of
50/50 midpoints, `EXTRA` below), shading only as flat bands or ordered (Bayer) dither, no
anti-aliasing, and shadows only as hard offsets or dithered d0.

9-slice assets keep everything that is stretched uniform along the stretched axis (a
stretched dither pattern would smear); dither lives in their fixed corners or in the
separate background tiles (`slab-tex`, `btn-dither-*`, `fill-*`, `topbar-tile`), which repeat
from the element's top-left corner so they stay on the pixel grid at any size.
"""

from __future__ import annotations

import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from pxlib import PAL  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ASSETS = os.path.join(ROOT, 'src', 'assets')
BUILD = os.path.join(ROOT, 'build', 'uikit')
SCALE = 2


def mid(a: str, b: str) -> tuple[int, int, int]:
    """Midpoint of two palette steps (the blends the scene palette uses)."""
    return tuple(int(round((x + y) / 2)) for x, y in zip(PAL[a], PAL[b]))


# Midpoints the chrome may use besides the 22 locked colours. All but the steel-blue step are
# already in the scene palette (process.py SCENE_PALETTE); b0 (d1·bl) is the one addition, so
# skill cards get a dark blue that the locked palette lacks.
EXTRA = {
    'bz': mid('s0', 'g0'),  # bronze (primary button)
    'bZ': mid('s2', 'g0'),  # lit bronze
    'rR': mid('r0', 'r1'),  # mid red (attack header, danger hover)
    'vM': mid('s1', 'v1'),  # mid violet (shadow rim)
    'gG': mid('g0', 'g1'),  # mid gold
    'b0': mid('d1', 'bl'),  # dark steel blue (skill header)
}
COLOURS: dict[str, tuple[int, int, int]] = {**PAL, **EXTRA}

# Alpha levels allowed besides opaque: the panel slab's fill and the scrims.
PANEL_ALPHA = 236
SCRIM_ALPHAS = tuple(range(16, 241, 16))  # 16, 32, ..., 240

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def bayer(x: int, y: int) -> float:
    return BAYER4[y % 4, x % 4]


# --------------------------------------------------------------------------------------------
# Grid
# --------------------------------------------------------------------------------------------


class Grid:
    """A w x h indexed image: `k` holds palette keys ('' = transparent), `a` the alpha."""

    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.k = np.full((h, w), '', dtype=object)
        self.a = np.zeros((h, w), np.uint8)

    def px(self, x: int, y: int, key: str | None, alpha: int = 255):
        if not (0 <= x < self.w and 0 <= y < self.h):
            return
        if not key:
            self.k[y, x], self.a[y, x] = '', 0
            return
        assert key in COLOURS, key
        self.k[y, x], self.a[y, x] = key, alpha

    def rect(self, x0, y0, x1, y1, key, alpha=255):
        """Inclusive rectangle."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, key, alpha)

    def hline(self, x0, x1, y, key, alpha=255):
        self.rect(x0, y, x1, y, key, alpha)

    def vline(self, x, y0, y1, key, alpha=255):
        self.rect(x, y0, x, y1, key, alpha)

    def dither(self, x0, y0, x1, y1, key, density: float, alpha=255):
        """Ordered (4x4 Bayer) dither of `key` over the rectangle at `density` (0..1)."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if bayer(x, y) < density:
                    self.px(x, y, key, alpha)

    def stamp(self, rows: list[str], legend: dict[str, str], x0=0, y0=0, flip_x=False,
              flip_y=False):
        h, w = len(rows), len(rows[0])
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch not in legend:
                    continue
                x = x0 + (w - 1 - i if flip_x else i)
                y = y0 + (h - 1 - j if flip_y else j)
                self.px(x, y, legend[ch])

    def mirror4(self, rows, legend, inset=0):
        h, w = len(rows), len(rows[0])
        for fx in (False, True):
            for fy in (False, True):
                self.stamp(rows, legend, self.w - w - inset if fx else inset,
                           self.h - h - inset if fy else inset, flip_x=fx, flip_y=fy)

    def rgba(self) -> np.ndarray:
        out = np.zeros((self.h, self.w, 4), np.uint8)
        for y in range(self.h):
            for x in range(self.w):
                if self.a[y, x]:
                    out[y, x, :3] = COLOURS[self.k[y, x]]
                    out[y, x, 3] = self.a[y, x]
        return out

    @staticmethod
    def from_png(path: str, scale: int = SCALE) -> 'Grid':
        """Read a committed 2x PNG back onto its grid (used for assets carried over as-is)."""
        im = np.asarray(Image.open(path).convert('RGBA'))
        im = im[::scale, ::scale]
        g = Grid(im.shape[1], im.shape[0])
        inv = {v: k for k, v in COLOURS.items()}
        for y in range(g.h):
            for x in range(g.w):
                r, gg, b, a = (int(v) for v in im[y, x])
                if a:
                    g.px(x, y, inv[(r, gg, b)], a)
        return g


def bevel(g: Grid, rings: list[tuple[str, str]], chamfer: int = 1, x0=0, y0=0, w=None, h=None,
          fill: str | None = None, fill_alpha: int = 255):
    """Rings from the outside in; ring d = (top/left colour, bottom/right colour). Corners are
    cut by `chamfer` pixels. Inside the rings: `fill` (or left untouched)."""
    w = w or g.w
    h = h or g.h
    for y in range(h):
        for x in range(w):
            dl, dr, dt, db = x, w - 1 - x, y, h - 1 - y
            dh, dv = min(dl, dr), min(dt, db)
            d = min(dh, dv, dh + dv - chamfer)
            if d < 0:
                continue
            if d < len(rings):
                # top/left edges lit, bottom/right in shade; the top-right and bottom-left
                # corner pixels go to the shade
                lit = min(dt, dl) < min(db, dr)
                g.px(x0 + x, y0 + y, rings[d][0] if lit else rings[d][1])
            elif fill:
                g.px(x0 + x, y0 + y, fill, fill_alpha)


# --------------------------------------------------------------------------------------------
# Assets
# --------------------------------------------------------------------------------------------

ASSETS_SPEC: list[dict] = []


def asset(page: str, name: str, g: Grid, out: str | None = None, slice_=None, note: str = '',
          gen: dict | None = None, row_break: bool = False):
    """Register an asset. `slice_` = (top, right, bottom, left) 9-slice insets in grid px;
    `gen` = the parameters figma_seed.js regenerates a scrim from (instead of pixel data);
    `row_break` starts a new row on the export sheet."""
    ASSETS_SPEC.append({'page': page, 'name': name, 'grid': g,
                        'out': out if out is not None else f'ui/{name}.png',
                        'slice': slice_, 'note': note, 'gen': gen, 'row_break': row_break})


# ---- Buttons --------------------------------------------------------------------------------
# A plaque is a 9-slice frame (outline, bevel, lit band on top, shade band + depth row at the
# bottom) plus a background: the flat fill colour and a 2-row checker tile (fill/shade) that
# sits on the bottom of the padding box (the top when pressed), so the plaque shades into its
# bottom bevel with ordered dither.

# kind: (bevel lit, lit band, fill, shade, bevel dark)
PLAQUES = {
    'btn': ('s2', 's1', 's0', 'd3', 'd2'),
    'btn-hover': ('g3', 's2', 's1', 's0', 'g0'),
    'btn-primary': ('g1', 'bZ', 'bz', 's0', 'd3'),
    'btn-primary-hover': ('g3', 'g0', 'bZ', 'bz', 'gG'),
    'btn-danger': ('dr', 's1', 's0', 'r0', 'r0'),
    'btn-danger-hover': ('dr', 'r1', 'rR', 'r0', 'r0'),
    'btn-shadow': ('v1', 's1', 's0', 'v0', 'v0'),
    'btn-disabled': ('s1', 'd3', 'd2', 'd1', 'd1'),
}
# The pressed plaques invert the bevel of their resting state.
PRESSED = {'btn-active': 'btn-hover', 'btn-primary-active': 'btn-primary-hover',
           'btn-danger-active': 'btn-danger-hover', 'btn-shadow-active': 'btn-shadow'}
# checker tiles, by the (fill, shade) pair they blend
DITHER_TILES = {
    'stone': ('s0', 'd3'), 'stone-hover': ('s1', 's0'), 'bronze': ('bz', 's0'),
    'bronze-hover': ('bZ', 'bz'), 'danger': ('s0', 'r0'), 'danger-hover': ('rR', 'r0'),
    'violet': ('s0', 'v0'), 'disabled': ('d2', 'd1'),
}

BTN_W, BTN_H = 10, 11  # 3 + 4 + 3 wide; 3 + 4 + 4 tall (raised) / 4 + 4 + 3 (pressed)


def plaque(lit_bevel, lit, fill, shade, dark_bevel, pressed=False) -> Grid:
    g = Grid(BTN_W, BTN_H)
    w, h = BTN_W, BTN_H
    if not pressed:
        body_h = h - 1  # plus one depth row
        bevel(g, [('d0', 'd0'), (lit_bevel, dark_bevel)], 1, 0, 0, w, body_h, fill=fill)
        g.hline(2, w - 3, 2, lit)          # lit band under the top bevel
        g.hline(2, w - 3, body_h - 3, shade)  # shade band over the bottom bevel
        g.hline(1, w - 2, h - 1, 'd0')     # depth
    else:
        # sunk one row: a d0 lip on top, then the plaque with its bevel inverted
        g.hline(1, w - 2, 0, 'd0')
        bevel(g, [('d0', 'd0'), (dark_bevel, lit_bevel)], 1, 0, 1, w, h - 1, fill=fill)
        g.hline(2, w - 3, 3, shade)        # shade band under the (now dark) top bevel
        g.hline(2, w - 3, h - 3, lit)      # lit band over the (now lit) bottom bevel
    # the interior is the CSS background (fill + dither tile): keep only the frame
    top, bottom = (4, 3) if pressed else (3, 4)
    for y in range(top, h - bottom):
        for x in range(3, w - 3):
            g.px(x, y, None)
    return g


def dither_tile(fill, shade) -> Grid:
    g = Grid(2, 2)
    g.px(0, 0, shade)
    g.px(1, 0, fill)
    g.px(0, 1, fill)
    g.px(1, 1, shade)
    return g


def build_buttons():
    for name, ramp in PLAQUES.items():
        asset('Buttons', name, plaque(*ramp), slice_=(3, 3, 4, 3),
              note='9-slice 6 6 8 6 (CSS px); interior = fill colour + dither tile')
    for name, rest in PRESSED.items():
        asset('Buttons', name, plaque(*PLAQUES[rest], pressed=True), slice_=(4, 3, 3, 3),
              note='pressed: 9-slice 8 6 6 6')
    for name, (fill, shade) in DITHER_TILES.items():
        asset('Buttons', f'btn-dither-{name}', dither_tile(fill, shade),
              note='2x2 checker, repeat-x on the plaque interior')
    d = Grid(5, 5)
    d.stamp(['..k..', '.kGk.', 'kGgok', '.kok.', '..k..'],
            {'k': 'd0', 'G': 'g3', 'g': 'g1', 'o': 'g0'})
    asset('Buttons', 'diamond', d, note='gilt diamond beside large primary buttons')


# ---- Panels & frames ------------------------------------------------------------------------

GILT = {'k': 'd0', 'G': 'g3', 'g': 'g1', 'o': 'g0', 'h': 'hi', 'm': 'gG'}


def gilt_bracket(size=12, chamfer=2, arm=10) -> list[str]:
    """Top-left gilt corner cap: the slab's stone band turns to gilt near the corner, with a
    dithered g1/gG hand-off into the stone and a diamond stud in the chamfer."""
    rows = [['.'] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            d = min(x, y, x + y - chamfer)
            if d < 0:
                continue
            reach = max(x, y) if d > 0 else 0
            if d in (0, 3) and max(x, y) <= arm + 1:
                rows[y][x] = 'k'
            elif d in (1, 2) and reach <= arm:
                rows[y][x] = 'g' if d == 1 else 'o'
                if d == 1 and 3 <= reach <= 6:
                    rows[y][x] = 'G'
                if d == 1 and reach in (8, 9) and (x + y) % 2:
                    rows[y][x] = 'm'
            elif d in (1, 2) and reach == arm + 1:
                rows[y][x] = 'k'
            elif d == 5 and 7 <= max(x, y) <= 8:
                rows[y][x] = 'o'
    cx = cy = 4
    for y in range(size):
        for x in range(size):
            m = abs(x - cx) + abs(y - cy)
            if m == 0:
                rows[y][x] = 'h'
            elif m == 1:
                rows[y][x] = 'G'
            elif m == 2 and min(x, y) >= 3:
                rows[y][x] = 'k'
    return [''.join(r) for r in rows]


BRACKET = gilt_bracket()


def slab_rings(g: Grid, chamfer: int):
    # outline, lit/shade bevel, stone band, dark inner line, then a lit inner edge (top/left)
    bevel(g, [('d0', 'd0'), ('s2', 's0'), ('s1', 's1'), ('d0', 'd0'), ('d3', 'd2')], chamfer,
          fill=None)


def panel_frame() -> Grid:
    """Main stone slab, 12px corners, 4px stretched middle. The interior (from ring 5 in) is
    transparent: the CSS paints the slab texture tile there."""
    c, m = 12, 4
    n = 2 * c + m
    g = Grid(n, n)
    slab_rings(g, 2)
    g.mirror4(BRACKET, GILT)
    return g


def panel_small() -> Grid:
    """Compact slab (4px corners) for small panels and banners."""
    g = Grid(12, 12)
    bevel(g, [('d0', 'd0'), ('s2', 's0'), ('d0', 'd0'), ('d3', 'd2')], 1, fill=None)
    corner = ['....', '.Gg.', '.g..', '....']
    g.mirror4(corner, GILT)
    return g


def slab_texture(w=16, h=16) -> Grid:
    """Slab interior: d2 at PANEL_ALPHA with a sparse, hand-placed grain of d3 and d1 pixels
    (about 5%), repeated from the top-left of the panel."""
    g = Grid(w, h)
    g.rect(0, 0, w - 1, h - 1, 'd2', PANEL_ALPHA)
    for x, y in [(2, 1), (3, 1), (11, 3), (6, 6), (14, 8), (1, 10), (9, 12), (10, 12), (5, 14)]:
        g.px(x, y, 'd3', PANEL_ALPHA)
    for x, y in [(12, 4), (7, 7), (2, 11), (13, 14)]:
        g.px(x, y, 'd1', PANEL_ALPHA)
    return g


def reticle() -> Grid:
    g = Grid(28, 28)
    g.mirror4(BRACKET, GILT)
    return g


def header_rule(n=32) -> Grid:
    """Modal header rule (repeat-x): d0 / g0 rule with a g1 glint every 8px / d0."""
    g = Grid(n, 3)
    g.hline(0, n - 1, 0, 'd0')
    g.hline(0, n - 1, 1, 'g0')
    g.hline(0, n - 1, 2, 'd0')
    for x in range(0, n, 8):
        g.px(x + 3, 1, 'g1')
    g.px(n // 2, 1, 'g3')
    return g


def niche() -> Grid:
    """Room icon niche (32x35): an arched alcove with a gilt rim, lit by a candle from above
    (the light falls off in dithered steps)."""
    w, h = 32, 35
    g = Grid(w, h)
    cx = (w - 1) / 2
    r = w / 2

    def inside(x, y, inset):
        rr = r - inset
        yy = y - inset
        top = rr  # centre of the arch
        if yy < 0 or yy > h - 1 - 2 * inset or x < inset or x > w - 1 - inset:
            return False
        if yy < top:
            return math.hypot(x - cx, yy - top + 0.5) <= rr - 0.2
        return True

    for y in range(h):
        for x in range(w):
            if not inside(x, y, 0):
                continue
            if not inside(x, y, 1):
                g.px(x, y, 'd0')
            elif not inside(x, y, 2):
                g.px(x, y, 'g1' if (x < cx and y < h * 0.6) or y < 6 else 'g0')
            elif not inside(x, y, 3):
                g.px(x, y, 'd0')
            else:
                # interior: d1 floor, light from the top centre in dithered steps
                dist = math.hypot((x - cx) / 1.1, (y - 9) * 0.9) / 16
                light = max(0.0, 1 - dist)
                g.px(x, y, 'd1')
                if light > 0.25:
                    g.dither(x, y, x, y, 'd2', min(1, (light - 0.25) * 2.2))
                if light > 0.55:
                    g.dither(x, y, x, y, 'd3', min(1, (light - 0.55) * 2.6))
                if light > 0.8:
                    g.dither(x, y, x, y, 's0', min(1, (light - 0.8) * 3))
    # a lip under the niche
    g.hline(3, w - 4, h - 3, 's0')
    return g


def build_panels():
    asset('Panels & Frames', 'panel-frame', panel_frame(), slice_=(12, 12, 12, 12),
          note='9-slice 24 (CSS px), border 10px; interior = slab-tex')
    asset('Panels & Frames', 'panel-small', panel_small(), slice_=(4, 4, 4, 4),
          note='9-slice 8 (CSS px); interior = slab-tex')
    asset('Panels & Frames', 'slab-tex', slab_texture(), note='slab interior tile, repeat')
    asset('Panels & Frames', 'reticle', reticle(), slice_=(12, 12, 12, 12),
          note='targeting reticle: the slab brackets alone')
    asset('Panels & Frames', 'header-rule', header_rule(), note='modal header rule, repeat-x')
    asset('Panels & Frames', 'niche', niche(), note='room icon niche (64x70 CSS)')
    for name in ('crest',):
        asset('Panels & Frames', name, Grid.from_png(os.path.join(ASSETS, 'ui', f'{name}.png')),
              note='carried over from the previous chrome pass (already flat pixel art)')


# ---- Card chrome ----------------------------------------------------------------------------

# rim: (lit, base, shade); header plate: (highlight, base, shade); well tint
CARD_TYPES = {
    'attack': {'rim': ('dr', 'r1', 'r0'), 'plate': ('r1', 'rR', 'r0'), 'well': 'r0'},
    'skill': {'rim': ('p1', 'bl', 'b0'), 'plate': ('bl', 'b0', 'd1'), 'well': 'b0',
              'well_density': 0.19},
    'power': {'rim': ('g1', 'g0', 'bz'), 'plate': ('bZ', 'bz', 's0'), 'well': 'bz',
              'well_density': 0.13},
    'status': {'rim': ('s2', 's1', 's0'), 'plate': ('s2', 's1', 's0'), 'well': 's0'},
}
RES_RIM = {'light': ('g3', 'g1', 'g0'), 'shadow': ('v1', 'vM', 'v0')}
CARD_SIZES = {'normal': (66, 92, 23), 'small': (56, 78, 18)}  # grid w, h, art-well height


def card_face(kind: str, res: str, size: str) -> Grid:
    """Full card face at its CSS size / 2. Layout matches CardView.module.css: 1px rim in the
    CSS border, then (in the padding) the rim's base, a d0 inner line, the header plate behind
    the name, the sunken art well at rows 16..16+wellH-1, and the stone body that shades down
    in dithered bands (for shadow cards, into violet)."""
    w, h, well_h = CARD_SIZES[size]
    t = CARD_TYPES[kind]
    rim = RES_RIM.get(res, t['rim'])
    g = Grid(w, h)
    body = 'd3'
    g.rect(0, 0, w - 1, h - 1, body)
    # rim (square outside: the CSS keeps a 2px d0 ring around the card)
    bevel(g, [(rim[0], rim[2]), (rim[1], rim[1]), ('d0', 'd0')], chamfer=0, fill=None)
    # corner studs on the rim
    for x, y in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)]:
        g.px(x, y, rim[0] if y == 1 else rim[2])
    # header plate: rows 3..14, then a d0 line
    hl, base, shade = t['plate']
    g.rect(3, 3, w - 4, 14, base)
    g.hline(3, w - 4, 3, hl)
    g.dither(3, 12, w - 4, 13, shade, 0.5)
    g.hline(3, w - 4, 14, shade)
    g.hline(3, w - 4, 15, 'd0')
    # art well (sunken): d0 top/left, s1 bottom/right, dithered tint inside
    x0, x1, y0, y1 = 5, w - 6, 16, 16 + well_h - 1
    g.rect(x0, y0, x1, y1, 'd1')
    g.dither(x0 + 1, y0 + 1, x1 - 1, y1 - 1, t['well'], t.get('well_density', 0.25))
    g.hline(x0, x1, y0, 'd0')
    g.vline(x0, y0, y1, 'd0')
    g.hline(x0 + 1, x1, y1, 's1')
    g.vline(x1, y0 + 1, y1, 's1')
    g.dither(x0 + 1, y0 + 1, x1 - 1, y0 + 1, 'd0', 0.5)  # soft lip under the top edge
    # body shading: dithered bands toward the bottom
    by1 = h - 4
    if res == 'shadow':
        top = y1 + 10
        steps = [(top, top + 3, 'v0', 0.25), (top + 4, top + 7, 'v0', 0.5),
                 (top + 8, top + 11, 'v0', 0.75), (top + 12, by1, 'v0', 1.0)]
        for a, b, key, dens in steps:
            if a <= by1:
                g.dither(3, a, w - 4, min(b, by1), key, dens)
        g.dither(3, by1 - 3, w - 4, by1, 'd0', 0.25)
    else:
        g.dither(3, by1 - 9, w - 4, by1 - 6, 'd2', 0.25)
        g.dither(3, by1 - 5, w - 4, by1 - 3, 'd2', 0.5)
        g.dither(3, by1 - 2, w - 4, by1, 'd2', 0.75)
    return g


def tag(lit, base, shade) -> Grid:
    """Wax pill: 8x9, 9-slice 2 2 2 2 (CSS 4px); drawn over the pill's 2px border."""
    g = Grid(8, 9)
    bevel(g, [('d0', 'd0')], 1, fill=base)
    g.hline(1, 6, 1, lit)
    g.hline(1, 6, 7, shade)
    return g


def build_cards():
    for size in CARD_SIZES:
        for kind in CARD_TYPES:
            for res in ('neutral', 'light', 'shadow'):
                suffix = '' if size == 'normal' else '-small'
                rname = '' if res == 'neutral' else f'-{res}'
                name = f'card-{kind}{rname}{suffix}'
                asset('Card Chrome', name, card_face(kind, res, size), out=f'ui/card/{name[5:]}.png',
                      note='full card face, 1:1 at the card size')
    asset('Card Chrome', 'tag-gain', tag('hi', 'g3', 'g0'), slice_=(2, 2, 2, 2),
          note='wax pill (restores wax)')
    asset('Card Chrome', 'tag-burn', tag('p1', 'v1', 'v0'), slice_=(2, 2, 2, 2),
          note='wax pill (burns wax)')
    for kind in ('light', 'shadow'):
        for suffix in ('', '-small'):
            name = f'frame-{kind}{suffix}'
            asset('Card Chrome', name, Grid.from_png(os.path.join(ASSETS, 'art', f'{name}.png')),
                  out=f'art/{name}.png',
                  note='corner ornaments, carried over from the previous chrome pass (flat pixel art)')


# ---- Bars & gauges --------------------------------------------------------------------------


def trough(fill: str, rim=('d1', 's1')) -> Grid:
    """Sunken gauge trough, 2px corners, 4px flat middle: outline, dark top-left / lit
    bottom-right bevel, flat fill."""
    g = Grid(8, 8)
    bevel(g, [('d0', 'd0'), rim], 1, fill=fill)
    return g


def fill_tile(rows: int, lit, base, shade, notch) -> Grid:
    """Gauge fill tile (6 wide, repeat-x from the left): lit top row, base, a checker row into
    the shade, and a notch column every 6px."""
    g = Grid(6, rows)
    g.rect(0, 0, 5, rows - 1, base)
    g.hline(0, 5, 0, lit)
    last = rows - 1
    for x in range(6):
        if x % 2:
            g.px(x, last, shade)
    g.vline(5, 0, rows - 1, notch)
    return g


def disc(n: int, rings: list[tuple[str, str]], ramp: list[str] | None, concave=False,
         spec=False) -> Grid:
    """Round medallion. Rings from the outside in, split lit (upper left) / shade. The body is
    shaded as a sphere lit from the upper left, quantised onto `ramp` (dark -> light) with
    ordered dither between neighbouring steps; `concave` lights it from the lower right."""
    g = Grid(n, n)
    c = (n - 1) / 2
    r = n / 2
    L = np.array([-0.55, -0.6, 0.58])
    L /= np.linalg.norm(L)
    if concave:
        L = np.array([-L[0], -L[1], L[2]])
    for y in range(n):
        for x in range(n):
            dx, dy = x - c, y - c
            dist = math.hypot(dx, dy)
            depth = r - dist - 0.5
            if depth < -0.35:
                continue
            d = max(0, int(depth + 0.35))
            lit = (dx + dy) < 0
            if d < len(rings):
                g.px(x, y, rings[d][0] if lit else rings[d][1])
            elif ramp:
                inner = r - len(rings)
                nx, ny = dx / inner, dy / inner
                nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
                v = max(0.0, nx * L[0] + ny * L[1] + nz * L[2])
                v = min(0.999, v ** 1.4)
                pos = v * (len(ramp) - 1)
                i = int(pos)
                frac = pos - i
                key = ramp[i + 1] if (i + 1 < len(ramp) and bayer(x, y) < frac) else ramp[i]
                g.px(x, y, key)
    if spec and ramp:
        s = round(c - r * 0.38)
        for sx, sy in [(s, s), (s + 1, s), (s, s + 1)]:
            g.px(sx, sy, 'hi')
    return g


def shield() -> Grid:
    return Grid.from_png(os.path.join(ASSETS, 'ui', 'shield.png'))


def build_bars():
    asset('Bars & Gauges', 'trough-hp', trough('r0'), slice_=(2, 2, 2, 2),
          note='9-slice 4 fill (CSS px)')
    asset('Bars & Gauges', 'trough-block', trough('r0', ('bl', 'bl')), slice_=(2, 2, 2, 2))
    asset('Bars & Gauges', 'trough-candle', trough('d1'), slice_=(2, 2, 2, 2))
    asset('Bars & Gauges', 'fill-hp', fill_tile(4, 'dr', 'r1', 'r0', 'r0'),
          note='HP fill, repeat-x 12x8')
    asset('Bars & Gauges', 'fill-block', fill_tile(4, 'p1', 'bl', 's1', 's1'))
    asset('Bars & Gauges', 'fill-candle', fill_tile(4, 'g3', 'g2', 'g0', 'g0'))
    asset('Bars & Gauges', 'fill-candle-dim', fill_tile(4, 'g1', 'g0', 's1', 's1'))
    asset('Bars & Gauges', 'fill-candle-sm', fill_tile(3, 'g3', 'g2', 'g0', 'g0'),
          note='top-bar gauge, repeat-x 12x6')
    asset('Bars & Gauges', 'fill-candle-dim-sm', fill_tile(3, 'g1', 'g0', 's1', 's1'))
    gold = ['g0', 'g2', 'g3']
    asset('Bars & Gauges', 'medal-energy',
          disc(36, [('d0', 'd0'), ('g1', 'g0'), ('d0', 'd0')], gold, spec=True),
          note='energy orb (72px)')
    asset('Bars & Gauges', 'medal-cost', disc(15, [('d0', 'd0'), ('g1', 'g0')], gold, spec=True),
          note='card cost gem (30px)')
    well = ['d0', 'd1', 'd2']
    asset('Bars & Gauges', 'medal-candle',
          disc(19, [('d0', 'd0'), ('g1', 'g0'), ('d0', 'd0')], well, concave=True),
          note='candle flame socket (38px)')
    asset('Bars & Gauges', 'medal-candle-out',
          disc(19, [('d0', 'd0'), ('dr', 'r1'), ('d0', 'd0')], well, concave=True))
    asset('Bars & Gauges', 'shield', shield(),
          note='block badge, carried over from the previous chrome pass')


# ---- Top bar --------------------------------------------------------------------------------


def lintel(w=32, h=32) -> Grid:
    """Top bar background tile (repeat): a lit s1 top line, then a d2 lintel with a sparse
    d3 / d1 grain."""
    g = Grid(w, h)
    g.rect(0, 0, w - 1, h - 1, 'd2')
    g.hline(0, w - 1, 0, 's1')
    g.hline(0, w - 1, 1, 'd3')
    g.dither(0, 2, w - 1, 2, 'd3', 0.5)
    for x, y in [(4, 7), (5, 7), (19, 10), (27, 5), (11, 15), (24, 19), (25, 19), (7, 23),
                 (16, 27), (29, 26), (2, 30)]:
        g.px(x, y, 'd3')
    for x, y in [(20, 11), (12, 16), (8, 24), (30, 27), (14, 4)]:
        g.px(x, y, 'd1')
    return g


def topbar_edge(n=32) -> Grid:
    """Repeating lower edge of the top bar: d0 / gilt rule with a stud / d0, then two rows of
    dithered d0 drop shadow (50%, then 25%)."""
    g = Grid(n, 5)
    g.hline(0, n - 1, 0, 'd0')
    g.hline(0, n - 1, 1, 'g0')
    g.hline(0, n - 1, 2, 'd0')
    for x in range(n):
        if x % 2 == 0:
            g.px(x, 3, 'd0')
        if x % 4 == 1:
            g.px(x, 4, 'd0')
    c = n // 2
    g.stamp(['.kgk.', 'kgGgk', '.kok.'], GILT, c - 2, 0)
    return g


def socket(ring=('g1', 'g0')) -> Grid:
    return disc(15, [('d0', 'd0'), ring, ('d0', 'd0')], ['d1', 'd2', 's0'], concave=True)


def build_topbar():
    asset('Top Bar', 'topbar-tile', lintel(), note='top bar background, repeat from top-left')
    asset('Top Bar', 'topbar-edge', topbar_edge(), note='lower edge, repeat-x 64x10')
    asset('Top Bar', 'socket', socket(), note='relic socket (30px)')
    asset('Top Bar', 'socket-hover', socket(('hi', 'g3')))


# ---- Scrims & shading -----------------------------------------------------------------------


def scrim(w: int, h: int, alpha_fn) -> Grid:
    """d0 overlay whose alpha steps through SCRIM_ALPHAS; between two steps the pixels are
    ordered-dithered, so the darkening reads as hard pixel bands, not a blend."""
    levels = (0,) + SCRIM_ALPHAS
    g = Grid(w, h)
    for y in range(h):
        for x in range(w):
            a = alpha_fn(x, y)  # 0..240
            if a <= 0:
                continue
            i = 0
            while i + 1 < len(levels) and levels[i + 1] <= a:
                i += 1
            lo = levels[i]
            hi = levels[i + 1] if i + 1 < len(levels) else levels[i]
            frac = 0 if hi == lo else (a - lo) / (hi - lo)
            pick = hi if bayer(x, y) < frac else lo
            if pick:
                g.px(x, y, 'd0', pick)
    return g


def vignette(w, h, inner, outer, strength, cy=0.5, extra=None):
    def f(x, y):
        nx = (x + 0.5) / w - 0.5
        ny = (y + 0.5) / h - cy
        ey = ny * (h / w) * 1.35
        d = math.sqrt(nx * nx + ey * ey) / 0.5  # (figma_scrims.js mirrors this exactly)
        t = min(1.0, max(0.0, (d - inner) / (outer - inner)))
        a = strength * t
        if extra:
            a = max(a, extra(x, y))
        return a
    return f


def build_scrims():
    def combat_extra(x, y):
        t = (y / 143)
        return 0 if t < 0.25 else 150 * (t - 0.25) / 0.75

    # Scene backdrops (256x144, the scenes' own grid, sized like the scene so pixels line up)
    def vig(name, w, h, inner, outer, strength, cy=0.5, floor=0, ramp=False, note=''):
        extra = None
        if floor:
            def extra(x, y):
                return floor
        if ramp:
            extra = combat_extra
        gen = {'kind': 'vignette', 'inner': inner, 'outer': outer, 'strength': strength,
               'cy': cy, 'floor': floor, 'ramp': ramp}
        asset('Scrims & Shading', name,
              scrim(w, h, vignette(w, h, inner, outer, strength, cy=cy, extra=extra)),
              note=note, gen=gen)

    vig('scrim-scene', 256, 144, 0.55, 1.35, 115,
        note='scene vignette over the backdrop (cover, aligned with the scene grid)')
    vig('scrim-combat', 256, 144, 0.4, 1.3, 140, cy=0.42, ramp=True,
        note='combat scene vignette + floor darkening')
    # Combat field in dim light / blackout (128x72, cover over the field)
    vig('scrim-dim', 128, 72, 0.35, 1.25, 150, note='field darkening, dim light')
    vig('scrim-dark', 128, 72, 0.0, 1.05, 224, floor=72, note='field darkening, blackout')

    # The hand's ledge: 2 x 128 tile, bottom-anchored, repeat-x
    def ledge(top_a, mid_a, bot_a):
        def f(x, y):
            t = y / 127
            if t < 0.38:
                return top_a + (mid_a - top_a) * t / 0.38
            if t < 0.7:
                return mid_a + (bot_a - mid_a) * (t - 0.38) / 0.32
            return bot_a
        return f

    for name, (top, mid_, bot) in {'ledge': (0, 140, 224), 'ledge-dim': (96, 170, 240),
                                   'ledge-dark': (192, 230, 240)}.items():
        asset('Scrims & Shading', name, scrim(4, 128, ledge(top, mid_, bot)),
              note='hand ledge, bottom-anchored 8x256 repeat-x',
              gen={'kind': 'ledge', 'top': top, 'mid': mid_, 'bot': bot})

    # Shadow pool behind each combatant
    def pool(x, y, w=56, h=60):
        nx = (x + 0.5) / w - 0.5
        ny = (y + 0.5) / h - 0.5
        d = math.sqrt(nx * nx + ny * ny) / 0.5
        if d >= 1:
            return 0
        return 192 if d < 0.55 else 192 - 144 * (d - 0.55) / 0.45
    asset('Scrims & Shading', 'pool', scrim(56, 60, pool), note='combatant shadow pool',
          gen={'kind': 'pool'})

    # Map node shading overlays (on the flat node colour): a short lit arc on the upper-left
    # rim and a dithered d0 shade crescent to the lower right
    def node_shade(n, arch=False):
        g = Grid(n, n)
        c = (n - 1) / 2
        r = n / 2 - 1
        for y in range(n):
            for x in range(n):
                dx, dy = x - c, y - c
                if arch and dy > 0:
                    edge = r - max(abs(dx), dy)
                else:
                    edge = r - math.hypot(dx, dy)
                if edge < 0:
                    continue
                ang = (dx + dy) / max(0.01, math.hypot(dx, dy))  # -1.41 upper left .. 1.41
                if edge < 1.0 and ang < -0.9:
                    g.px(x, y, 'p1')
                s_ = (dx + dy) / (2 * r)
                if s_ > 0.1:
                    g.dither(x, y, x, y, 'd0', min(0.75, (s_ - 0.1) * 1.9))
        return g
    asset('Scrims & Shading', 'node-shade', node_shade(21), note='map node shading (42px)')
    asset('Scrims & Shading', 'node-shade-boss', node_shade(38, arch=True),
          note='boss node shading (76px)')
    asset('Scrims & Shading', 'node-shade-sm', node_shade(13), note='legend dot shading (26px)')


# ---- Icons ----------------------------------------------------------------------------------
# Map-node, relic and event icons, drawn in icons.py on the gameplay icons' 32px grid.

ICON_DIRS = {'node': 'nodes', 'relic': 'relics', 'event': 'events'}
ICON_NOTES = {'node': 'map node icon', 'relic': 'relic icon', 'event': 'event icon'}


def build_icons():
    import icons  # the drawings (icons.py)

    last = None
    for group, key, keys in icons.all_icons():
        g = Grid(icons.SIZE, icons.SIZE)
        for y, row in enumerate(keys):
            for x, k in enumerate(row):
                if k:
                    g.px(x, y, k)
        asset('Icons', f'{group}-{key}', g, out=f'{ICON_DIRS[group]}/{key}.png',
              note=f'{ICON_NOTES[group]} (32px grid, @4x)', row_break=group != last)
        last = group


def build_all():
    ASSETS_SPEC.clear()
    build_buttons()
    build_panels()
    build_cards()
    build_bars()
    build_topbar()
    build_scrims()
    build_icons()
    return ASSETS_SPEC


# --------------------------------------------------------------------------------------------
# Seed (-> Figma) / import (<- Figma) / check
# --------------------------------------------------------------------------------------------

PAGES = ['Buttons', 'Panels & Frames', 'Card Chrome', 'Bars & Gauges', 'Top Bar',
         'Scrims & Shading', 'Icons']
# Export scale per page (Figma "Export sheet" setting): the chrome is 2x, the icons 4x like the
# gameplay and status icons.
PAGE_SCALE = {'Icons': 4}
GAP = 4


def page_scale(page: str) -> int:
    return PAGE_SCALE.get(page, SCALE)


def layout(spec):
    """Place each page's components on its export sheet, left to right in rows GAP units
    apart. Returns {page: (sheet_w, sheet_h)} and sets a['x'], a['y'] (Figma units = grid px)."""
    sheets = {}
    for page in PAGES:
        items = [a for a in spec if a['page'] == page]
        sheet_w = max(300, max(a['grid'].w for a in items) + 2 * GAP)
        x = y = GAP
        row_h = 0
        for a in items:
            g = a['grid']
            if x + g.w + GAP > sheet_w or (a.get('row_break') and x > GAP):
                x = GAP
                y += row_h + GAP
                row_h = 0
            a['x'], a['y'] = x, y
            x += g.w + GAP
            row_h = max(row_h, g.h)
        sheets[page] = (sheet_w, y + row_h + GAP)
    return sheets


TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'


def encode_rows(g: Grid, tokens: list[str]) -> list[str]:
    """Rows as run-length strings over a page-wide token table ('key' or 'key@alpha'): one
    letter per token ('.' = transparent), each optionally followed by a repeat count."""
    out = []
    for y in range(g.h):
        chars = []
        for x in range(g.w):
            if not g.a[y, x]:
                chars.append('.')
                continue
            tok = g.k[y, x] + ('' if g.a[y, x] == 255 else f'@{g.a[y, x]}')
            if tok not in tokens:
                tokens.append(tok)
            chars.append(TOKEN_CHARS[tokens.index(tok)])
        runs = []
        i = 0
        while i < len(chars):
            j = i
            while j < len(chars) and chars[j] == chars[i]:
                j += 1
            runs.append(chars[i] + (str(j - i) if j - i > 1 else ''))
            i = j
        out.append(''.join(runs))
    return out


# Web code syntax for the palette variables that have a CSS custom property in global.css.
CSS_VARS = {
    'd0': '--bg', 'd1': '--bg-2', 'd2': '--panel', 'd3': '--panel-2', 's0': '--panel-3',
    's1': '--border', 's2': '--border-strong', 'p2': '--text', 'p1': '--text-dim',
    'p0': '--text-faint', 'g0': '--accent', 'g1': '--accent-strong', 'g2': '--candle',
    'g3': '--light', 'v1': '--shadow', 'v0': '--shadow-deep', 'r1': '--hp', 'r0': '--hp-bg',
    'bl': '--block', 'gr': '--buff', 'dr': '--debuff', 'hi': '--hi',
}
CHUNK = 38000  # characters of pixel data per use_figma call (the tool takes 50k of code)


def seed():
    """Write the use_figma scripts that build each page's components in the Figma file
    (build/uikit/figma/*.js: figma_seed.js with a batch of pixel data), the palette
    (build/uikit/palette.json) and 4x previews of each sheet."""
    spec = build_all()
    sheets = layout(spec)
    os.makedirs(os.path.join(BUILD, 'figma'), exist_ok=True)
    palette = [{'key': k, 'hex': '#%02x%02x%02x' % COLOURS[k], 'css': CSS_VARS.get(k, ''),
                'extra': k in EXTRA} for k in COLOURS]
    with open(os.path.join(HERE, 'figma_seed.js')) as f:
        template = f.read()
    n_batches = 0
    for page in PAGES:
        items = [a for a in spec if a['page'] == page]
        tokens: list[str] = []
        rows: dict[str, int] = {}
        entries = []
        for a in items:
            e = {'name': a['name'], 'w': a['grid'].w, 'h': a['grid'].h, 'x': a['x'], 'y': a['y'],
                 'slice': a['slice'], 'note': a['note']}
            if a['out'] != f"ui/{a['name']}.png":
                e['out'] = a['out']
            if a['gen']:
                e['gen'] = a['gen']
            else:
                e['rows'] = [rows.setdefault(r, len(rows)) for r in encode_rows(a['grid'], tokens)]
            entries.append(e)
        row_list = sorted(rows, key=rows.get)
        # split into batches that fit one use_figma call; each carries the rows it uses
        batch, size = [], 0
        batches = []
        for e in entries:
            n = 300 + sum(len(row_list[i]) + 4 for i in set(e.get('rows', [])))
            if batch and size + n > CHUNK:
                batches.append(batch)
                batch, size = [], 0
            batch.append(e)
            size += n
        batches.append(batch)
        for b in batches:
            used = sorted({i for e in b for i in e.get('rows', [])})
            remap = {old: new for new, old in enumerate(used)}
            b = [dict(e, rows=[remap[i] for i in e['rows']]) if 'rows' in e else e for e in b]
            payload = {'sheet': {'page': page, 'w': sheets[page][0], 'h': sheets[page][1],
                                 'scale': page_scale(page)},
                       'palette': palette, 'tokens': tokens,
                       'rows': [row_list[i] for i in used],
                       'scrimAlphas': list(SCRIM_ALPHAS), 'assets': b}
            js = template.replace('__DATA__', json.dumps(payload, separators=(',', ':')))
            with open(os.path.join(BUILD, 'figma', f'{n_batches:02d}-{slug(page)}.js'), 'w') as f:
                f.write(js)
            n_batches += 1
    with open(os.path.join(BUILD, 'palette.json'), 'w') as f:
        json.dump(palette, f)
    # previews: each page's sheet at 4x on a mid-grey
    for page, (sw, sh) in sheets.items():
        canvas = np.zeros((sh, sw, 4), np.uint8)
        canvas[..., :3] = (72, 64, 80)
        canvas[..., 3] = 255
        for a in spec:
            if a['page'] != page:
                continue
            rgba = a['grid'].rgba().astype(float)
            al = rgba[..., 3:4] / 255
            y, x, g = a['y'], a['x'], a['grid']
            dst = canvas[y:y + g.h, x:x + g.w, :3].astype(float)
            canvas[y:y + g.h, x:x + g.w, :3] = (rgba[..., :3] * al + dst * (1 - al)).astype(np.uint8)
        im = Image.fromarray(canvas, 'RGBA')
        im = im.resize((sw * 4, sh * 4), Image.NEAREST)
        im.save(os.path.join(BUILD, f'preview-{slug(page)}.png'))
    print(f'{len(spec)} assets on {len(sheets)} sheets, {n_batches} Figma batches -> {BUILD}')


def slug(page: str) -> str:
    return page.replace(' & ', '-').replace(' ', '-')


def allowed_rgba():
    cols = {tuple(v) for v in COLOURS.values()}
    alphas = {255, PANEL_ALPHA, *SCRIM_ALPHAS}
    return cols, alphas


def import_sheets(paths: list[str]):
    """Crop every component out of the Figma export sheets (2x), verify, write the PNGs."""
    spec = build_all()
    sheets = layout(spec)
    by_page = {}
    for p in paths:
        base = os.path.basename(p)
        page = next(pg for pg in PAGES if base.startswith(slug(pg)))
        by_page[page] = np.asarray(Image.open(p).convert('RGBA'))
    cols, alphas = allowed_rgba()
    written = 0
    for a in spec:
        if a['page'] not in by_page:
            continue
        sheet = by_page[a['page']]
        sw, sh = sheets[a['page']]
        k = page_scale(a['page'])
        assert sheet.shape[1] == sw * k and sheet.shape[0] == sh * k, \
            f"{a['page']}: sheet is {sheet.shape[1]}x{sheet.shape[0]}, want {sw * k}x{sh * k}"
        x, y, w, h = (v * k for v in (a['x'], a['y'], a['grid'].w, a['grid'].h))
        crop = snap(sheet[y:y + h, x:x + w].copy(), cols, alphas, a['name'])
        check_grid(crop, a['name'], k)
        path = os.path.join(ASSETS, a['out'])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        Image.fromarray(crop, 'RGBA').save(path, optimize=True)
        written += 1
    print(f'wrote {written} assets')


def snap(px: np.ndarray, cols, alphas, name: str, tol: int = 3) -> np.ndarray:
    """Snap colour-managed export noise (a unit or two) back onto the palette; fail on
    anything further off."""
    col_arr = np.array(sorted(cols))
    al_arr = np.array(sorted(alphas | {0}))
    flat = px.reshape(-1, 4).astype(int)
    uniq, inv = np.unique(flat, axis=0, return_inverse=True)
    fixed = np.zeros_like(uniq)
    for i, (r, g, b, a) in enumerate(uniq):
        ai = al_arr[np.abs(al_arr - a).argmin()]
        assert abs(ai - a) <= tol, f'{name}: alpha {a} off the allowed levels'
        if ai == 0:
            continue
        d = np.abs(col_arr - (r, g, b)).max(1)
        j = d.argmin()
        assert d[j] <= tol, f'{name}: colour {(r, g, b)} off the palette'
        fixed[i, :3] = col_arr[j]
        fixed[i, 3] = ai
    return fixed[inv.ravel()].reshape(px.shape).astype(np.uint8)


def check_grid(px: np.ndarray, name: str, k: int = SCALE):
    """Every k x k block must be one colour (the art is exported at exactly k x)."""
    h, w = px.shape[:2]
    assert h % k == 0 and w % k == 0, f'{name}: size {w}x{h} not on the {k}x grid'
    blocks = px.reshape(h // k, k, w // k, k, 4)
    same = (blocks == blocks[:, :1, :, :1]).all(axis=(1, 3, 4))
    assert same.all(), f'{name}: {int((~same).sum())} blocks are not solid {k}x{k}'


def check():
    spec = build_all()
    cols, alphas = allowed_rgba()
    bad = 0
    for a in spec:
        path = os.path.join(ASSETS, a['out'])
        px = np.asarray(Image.open(path).convert('RGBA'))
        k = page_scale(a['page'])
        try:
            check_grid(px, a['name'], k)
            flat = px.reshape(-1, 4)
            vis = flat[flat[:, 3] > 0]
            off_c = {tuple(int(v) for v in c[:3]) for c in vis} - cols
            off_a = {int(v) for v in vis[:, 3]} - alphas
            assert not off_c, f"{a['name']}: off-palette {sorted(off_c)[:4]}"
            assert not off_a, f"{a['name']}: off alpha levels {sorted(off_a)[:4]}"
            want = a['grid'].rgba()
            got = px[::k, ::k]
            if not np.array_equal(want, got):
                print(f"  note: {a['out']} differs from the seed drawing (edited in Figma)")
        except AssertionError as e:
            bad += 1
            print('FAIL', e)
    print(f'{len(spec)} assets checked, {bad} failed')
    return bad == 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'seed'
    if cmd == 'seed':
        seed()
    elif cmd == 'import':
        import_sheets(sys.argv[2:])
    elif cmd == 'draft':
        # write the drawings straight to src/assets (for iterating on a design before it goes
        # through Figma; `import` from the Figma sheets is what gets committed)
        for a in build_all():
            path = os.path.join(ASSETS, a['out'])
            os.makedirs(os.path.dirname(path), exist_ok=True)
            img = Image.fromarray(a['grid'].rgba(), 'RGBA')
            k = page_scale(a['page'])
            img.resize((img.width * k, img.height * k), Image.NEAREST).save(path, optimize=True)
    elif cmd == 'check':
        sys.exit(0 if check() else 1)
    else:
        sys.exit(__doc__)
