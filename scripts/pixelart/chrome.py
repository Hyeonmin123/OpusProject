"""Hand-built pixel-art UI chrome.

    python3 scripts/pixelart/chrome.py

Unlike the Gemini assets in process.py there is no source image: every piece is drawn on its
final grid here, in the locked palette of pxlib.py (the bronze fill of the primary button uses
one of the scene palette's midpoints, s0/g0). Everything is exported at UI_SCALE (2x, the same
2x2 CSS pixels per art pixel as the portraits), so it is shown 1:1 and the CSS only needs
`image-rendering: pixelated` for high-DPI screens.

- 9-slice frames for CSS `border-image` (corner size C grid px; the image is 2C+1 wide, the
  middle row / column is the stretched edge):
    ui/panel-frame.png     stone slab with a bevel, chamfered corners and gilt corner brackets
    ui/panel-small.png     the same slab with small corners, for compact panels and banners
    ui/reticle.png         the gilt brackets alone (targeting reticle)
    ui/btn-*.png           button plaques: default / hover / active, primary, danger, shadow
    ui/trough-*.png        HP and candle gauge troughs
- sprites:
    ui/crest.png           candle-in-the-arch crest on the room panels
    ui/diamond.png         gilt diamond beside large primary buttons
    ui/shield.png          block badge
    ui/socket.png          relic socket (top bar)
    ui/medal-*.png         gold medallions: energy orb, card cost gem, candle flame socket
    ui/topbar-edge.png     repeating gilt rule along the top bar's lower edge
    art/frame-{light,shadow}[-small].png  card corner ornaments, full card overlays
"""

from __future__ import annotations

import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from pxlib import PAL, PALETTE, to_rgba, upscale  # noqa: E402
from redraw import Canvas  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'src', 'assets')
UI_SCALE = 2


def mid(a: str, b: str) -> tuple[int, int, int]:
    """Midpoint of two palette steps (the same blends the scene palette uses)."""
    return tuple(int(round((x + y) / 2)) for x, y in zip(PAL[a], PAL[b]))


# The only colours allowed besides the locked palette: scene-palette midpoints used for the
# bronze primary button.
EXTRA = {'bz': mid('s0', 'g0'), 'bZ': mid('s2', 'g0')}
COLOURS = {**PAL, **EXTRA}
ALLOWED = {tuple(int(v) for v in c) for c in PALETTE.tolist()} | set(EXTRA.values())

# Panel fill: the d2 stone at ~92% so the scene art still reads faintly through the slab.
FILL_ALPHA = 236


class Img:
    """RGBA grid; `a` is 0..255 so the panel fill can be translucent."""

    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.rgb = np.zeros((h, w, 3), np.uint8)
        self.a = np.zeros((h, w), np.uint8)

    def px(self, x: int, y: int, key: str | None, alpha: int = 255):
        if not (0 <= x < self.w and 0 <= y < self.h):
            return
        if key is None:
            self.a[y, x] = 0
            self.rgb[y, x] = 0
            return
        self.rgb[y, x] = COLOURS[key]
        self.a[y, x] = alpha

    def get(self, x, y):
        return self.a[y, x] > 0

    def stamp(self, rows: list[str], legend: dict[str, str | None], x0: int = 0, y0: int = 0,
              flip_x: bool = False, flip_y: bool = False):
        """Paint a character map; characters missing from `legend` are left untouched."""
        h, w = len(rows), len(rows[0])
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch not in legend:
                    continue
                x = x0 + (w - 1 - i if flip_x else i)
                y = y0 + (h - 1 - j if flip_y else j)
                self.px(x, y, legend[ch])

    def mirror4(self, rows, legend, inset=0):
        """Stamp a top-left corner map into all four corners."""
        h, w = len(rows), len(rows[0])
        for fx in (False, True):
            for fy in (False, True):
                x0 = self.w - w - inset if fx else inset
                y0 = self.h - h - inset if fy else inset
                self.stamp(rows, legend, x0, y0, flip_x=fx, flip_y=fy)

    def save(self, rel: str, scale: int = UI_SCALE):
        opaque = self.a > 0
        bad = {tuple(int(v) for v in c) for c in self.rgb[opaque].tolist()} - ALLOWED
        assert not bad, f'{rel}: off-palette colours {sorted(bad)[:5]}'
        rgba = np.dstack([self.rgb, self.a])
        rgba[~opaque] = 0
        from PIL import Image
        img = Image.fromarray(rgba, 'RGBA')
        path = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        upscale(img, scale).save(path, optimize=True)
        print(f'  {rel}  {self.w}x{self.h} grid, {os.path.getsize(path)} B')


# --------------------------------------------------------------------------------------------
# 9-slice frames
# --------------------------------------------------------------------------------------------


def bevel_frame(c: int, bands: list[tuple[str, str]], fill: str | None, fill_alpha: int = 255,
                chamfer: int = 1) -> Img:
    """A (2c+1)-square 9-slice with a bevelled border.

    `bands[d]` = (top/left colour, bottom/right colour) for the ring at distance d from the
    outside; the corners are cut diagonally by `chamfer` pixels (transparent outside the cut).
    Everything deeper than the bands is `fill`."""
    n = 2 * c + 1
    im = Img(n, n)
    for y in range(n):
        for x in range(n):
            dl, dr, dt, db = x, n - 1 - x, y, n - 1 - y
            dh, dv = min(dl, dr), min(dt, db)
            d = min(dh, dv, dh + dv - chamfer)
            if d < 0:
                continue
            if d < len(bands):
                light = min(dt, dl) < min(db, dr)
                im.px(x, y, bands[d][0] if light else bands[d][1])
            elif fill:
                im.px(x, y, fill, fill_alpha)
    return im


GILT = {'k': 'd0', 'G': 'g3', 'g': 'g1', 'o': 'g0', 'h': 'hi'}

def gilt_bracket(size: int = 12, chamfer: int = 2, arm: int = 10) -> list[str]:
    """Top-left gilt corner cap of the panel frame, as a character map.

    The slab's stone band (rings 1-2 from the outside, between the d0 outline and the d0 inner
    line) turns to gilt for `arm` pixels from the corner: g1 on the outer ring, g0 on the inner
    one, a g3 glint along the lit edge and a d0 cap where the arms end. A diamond stud sits in
    the chamfered corner and a thin g0 rule inside echoes the bracket."""
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
            elif d in (1, 2) and reach == arm + 1:
                rows[y][x] = 'k'
            elif d == 5 and 7 <= max(x, y) <= 8:
                rows[y][x] = 'o'
    # corner stud: a diamond with a bright centre, outlined in d0
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


PANEL_BRACKET = gilt_bracket()


def panel_frame(c: int = 12) -> Img:
    """Stone slab: black outline, lit top-left edge, stone band, dark inner line; d2 fill.
    Gilt caps and studs on the corners."""
    im = bevel_frame(c, [('d0', 'd0'), ('s2', 's0'), ('s1', 's1'), ('d0', 'd0')], 'd2',
                     FILL_ALPHA, chamfer=2)
    im.mirror4(PANEL_BRACKET, GILT)
    return im


def panel_small(c: int = 4) -> Img:
    """Compact slab (4px corners): outline, bevel, inner line, a gilt pip in each corner."""
    im = bevel_frame(c, [('d0', 'd0'), ('s2', 's0'), ('d0', 'd0')], 'd2', FILL_ALPHA, chamfer=1)
    corner = [
        '....',
        '.Gg.',
        '.g..',
        '....',
    ]
    im.mirror4(corner, GILT)
    return im


def reticle(c: int = 12) -> Img:
    """The panel's gilt brackets and studs with nothing between them."""
    im = Img(2 * c + 1, 2 * c + 1)
    im.mirror4(PANEL_BRACKET, GILT)
    return im


# Button plaques: (light bevel, dark bevel, fill); outline d0 and a 1px d0 depth row under
# the bottom edge. Active = pressed: bevel inverted, no depth (the CSS shifts the label 2px).
BUTTONS = {
    'btn': ('s2', 'd3', 's0'),
    'btn-hover': ('g1', 'g0', 's1'),
    'btn-primary': ('g1', 's0', 'bz'),
    'btn-primary-hover': ('g3', 'g0', 'bZ'),
    'btn-danger': ('dr', 'r0', 's0'),
    'btn-danger-hover': ('dr', 'r1', 'r0'),
    'btn-shadow': ('v1', 'v0', 's0'),
}


def button(light: str, dark: str, fill: str, pressed: bool = False) -> Img:
    """3px corners (6 CSS px) plus one depth row: 7x8 grid, sliced 3 3 4 3."""
    c = 3
    if pressed:
        light, dark = dark, light
    im = bevel_frame(c, [('d0', 'd0'), (light, dark)], fill, chamfer=1)
    # depth: one more dark row under the plaque (raised) or a flat d0 row (pressed flush)
    n = im.w
    big = Img(n, n + 1)
    big.rgb[:n], big.a[:n] = im.rgb, im.a
    for x in range(1, n - 1):
        big.px(x, n, 'd0')
    if pressed:
        # pressed: the whole plaque sits one row lower, the top outline doubles up
        shifted = Img(n, n + 1)
        shifted.rgb[1:], shifted.a[1:] = im.rgb, im.a
        for x in range(1, n - 1):
            shifted.px(x, 0, 'd0')
        return shifted
    return big


def trough(fill: str, rim: tuple[str, str] = ('d1', 's1')) -> Img:
    """Gauge trough: outline, sunken bevel (dark top-left, lit bottom-right by default), `fill`
    inside. 2px corners (4 CSS px)."""
    return bevel_frame(2, [('d0', 'd0'), rim], fill, chamfer=1)


# --------------------------------------------------------------------------------------------
# Sprites
# --------------------------------------------------------------------------------------------


def crest() -> Img:
    """Candle in a gilt arch, with rules and diamonds to either side (32x16)."""
    rows = [
        '................................',
        '..............kkkk..............',
        '............kkggggkk............',
        '...........kgGddddgok...........',
        '..........kgGddddddgok..........',
        '..........kgddddGddddok.........',
        '.........kgdddddGdddddok........',
        '.........kgddddGHGddddok........',
        '...k.....kgddddGhGddddok....k...',
        '..kGk....kgdddGhhhGdddok...kGk..',
        '.kGhGkkkkkgdddGh3hGdddokkkkGhGk.',
        '..kGk.oooogddddGGGddddokoookGk..',
        '...k.....kgddddyyyddddok....k...',
        '.........kgddddpppddddok........',
        '........kkgggggggggggggokk......',
        '........kooooooooooooooook......',
    ]
    legend = {'k': 'd0', 'g': 'g1', 'G': 'g3', 'o': 'g0', 'd': 'd2', 'h': 'hi', 'H': 'g3',
              '3': 'g2', 'y': 'g0', 'p': 'p1'}
    im = Img(32, 16)
    im.stamp(rows, legend)
    return im


def diamond() -> Img:
    im = Img(5, 5)
    im.stamp(['..k..', '.kGk.', 'kGgok', '.kok.', '..k..'], GILT)
    return im


def shield() -> Img:
    """Block badge (15x13): a steel-blue heater shield, lit rim, dark outline."""
    rows = [
        '.kkkkkkkkkkkkk.',
        'kHHHHHHHHHHHHbk',
        'kHbbbbbbbbbbbsk',
        'kHbbbbbbbbbbbsk',
        'kHbbbbbbbbbbbsk',
        'kHbbbbbbbbbbbsk',
        'kHbbbbbbbbbbbsk',
        '.kHbbbbbbbbbsk.',
        '.kHbbbbbbbbbsk.',
        '..kHbbbbbbbsk..',
        '...kkbbbbbskk..',
        '.....kkbsskk...',
        '.......kkk.....',
    ]
    im = Img(15, 13)
    im.stamp(rows, {'k': 'd0', 'H': 'p1', 'b': 'bl', 's': 's1'})
    return im


def disc(n: int, rings: list[tuple[str, str]], body: tuple[str, str, str] | None,
         spec: bool = False) -> Img:
    """A round medallion on an n-px grid.

    `rings[d]` = (lit, shade) colour of the ring at depth d from the outside; `body` =
    (highlight, base, shade) for the inside, lit from the upper left."""
    im = Img(n, n)
    cx = cy = (n - 1) / 2
    r = n / 2
    for y in range(n):
        for x in range(n):
            dx, dy = x - cx, y - cy
            dist = math.hypot(dx, dy)
            depth = r - dist - 0.5  # 0 at the rim
            if depth < -0.35:
                continue
            d = max(0, int(depth + 0.35))
            lit = (dx + dy) < 0
            if d < len(rings):
                im.px(x, y, rings[d][0] if lit else rings[d][1])
            elif body:
                hl, base, shade = body
                # light from the upper left: a crescent of highlight / shade
                ox, oy = dx + r * 0.22, dy + r * 0.22
                inner = r - len(rings)
                if math.hypot(ox, oy) > inner * 0.95 and (dx + dy) > 0:
                    im.px(x, y, shade)
                elif math.hypot(dx + inner * 0.35, dy + inner * 0.35) < inner * 0.42:
                    im.px(x, y, hl)
                else:
                    im.px(x, y, base)
    if spec and body:
        s = round(cx - r * 0.38)
        im.px(s, s, 'hi')
        im.px(s + 1, s, 'hi')
        im.px(s, s + 1, 'hi')
    return im


def socket(ring: tuple[str, str] = ('g1', 'g0')) -> Img:
    """Relic socket (15px): gilt ring, dark stone well."""
    return disc(15, [('d0', 'd0'), ring, ('d0', 'd0')], ('s0', 'd2', 'd1'))


def topbar_edge(n: int = 32) -> Img:
    """n x 5 tile, repeated along the top bar's lower edge: d0 line, g0 gilt rule with a small
    diamond stud once per tile, d0 line, then two rows of hard drop shadow (d0 at 55% / 27%)."""
    im = Img(n, 5)
    for x in range(n):
        im.px(x, 0, 'd0')
        im.px(x, 1, 'g0')
        im.px(x, 2, 'd0')
        im.px(x, 3, 'd0', 140)
        im.px(x, 4, 'd0', 70)
    c = n // 2
    im.stamp(['.kgk.', 'kgGgk', '.kok.'], GILT, c - 2, 0)
    return im


# --------------------------------------------------------------------------------------------
# Card corner ornaments (full-card overlays)
# --------------------------------------------------------------------------------------------

# Light cards: a gilt bracket in each corner with a four-point sparkle, and a diamond on a
# short rule at the bottom centre. 11x11, top-left orientation.
LIGHT_CORNER = [
    '.k.........',
    'khkkkkkkk..',
    '.kGggggggk.',
    '.kgkkkkkok.',
    '.kgk.......',
    '.kgk..k....',
    '.kgk.kok...',
    '.kgk..ok...',
    '.kgk...k...',
    '.kok.......',
    '..k........',
]
LIGHT_BOTTOM = [
    '.........k.........',
    'kkkkkkkkkGkkkkkkkkk',
    'gggggggkGhGkggggggo',
    'kkkkkkkkkGkkkkkkkkk',
    '.........k.........',
]

# Shadow cards: a violet thorn vine curling round each corner, thorns pointing outwards and a
# small curled bud; a crescent between two wisps at the bottom centre. 14x14.
SHADOW_CORNER = [
    '....kk..kk....',
    '...kvvkkvvkk..',
    '..kvkk.kk.kvk.',
    '.kvk.......kvk',
    '.kvk.........k',
    'kvk.kk........',
    'kvk.kvk.......',
    '.kvk.kk.......',
    'kvvk..........',
    'kvk...........',
    '.kvk..........',
    '.kvk..........',
    '..k...........',
    '..............',
]
SHADOW_BOTTOM = [
    '.........kk........',
    '..kk.....kvk....kk.',
    '.kvvkk..kvk...kkvvk',
    'kv..vvkkkvk.kkvv..v',
    '.k....kkvvk.k....k.',
    '........kk.........',
]

ORNAMENT = {'k': 'd0', 'G': 'g3', 'g': 'g1', 'o': 'g0', 'h': 'hi', 'v': 'v1', 'V': 'v0'}
SHADOW_ORNAMENT = {'k': 'v0', 'v': 'v1'}


def card_overlay(w: int, h: int, kind: str) -> Img:
    """Full overlay of the card's padding box (grid = CSS size / 2)."""
    im = Img(w, h)
    if kind == 'light':
        im.mirror4(LIGHT_CORNER, ORNAMENT, inset=1)
        bottom, legend = LIGHT_BOTTOM, ORNAMENT
    else:
        im.mirror4(SHADOW_CORNER, SHADOW_ORNAMENT, inset=0)
        bottom, legend = SHADOW_BOTTOM, SHADOW_ORNAMENT
    bw, bh = len(bottom[0]), len(bottom)
    im.stamp(bottom, legend, (w - bw) // 2, h - bh - 1)
    return im


# --------------------------------------------------------------------------------------------


def main():
    print('frames')
    panel_frame().save('ui/panel-frame.png')
    panel_small().save('ui/panel-small.png')
    reticle().save('ui/reticle.png')
    for name, (light, dark, fill) in BUTTONS.items():
        button(light, dark, fill).save(f'ui/{name}.png')
    for name in ('btn', 'btn-primary', 'btn-danger', 'btn-shadow'):
        light, dark, fill = BUTTONS[name]
        button(light, dark, fill, pressed=True).save(f'ui/{name}-active.png')
    trough('r0').save('ui/trough-hp.png')
    trough('r0', ('bl', 'bl')).save('ui/trough-block.png')
    trough('d1').save('ui/trough-candle.png')
    print('sprites')
    crest().save('ui/crest.png')
    diamond().save('ui/diamond.png')
    shield().save('ui/shield.png')
    socket().save('ui/socket.png')
    socket(('hi', 'g3')).save('ui/socket-hover.png')
    topbar_edge().save('ui/topbar-edge.png')
    gold = ('g3', 'g2', 'g0')
    disc(36, [('d0', 'd0'), ('g1', 'g0'), ('d0', 'd0')], gold, spec=True).save('ui/medal-energy.png')
    disc(15, [('d0', 'd0'), ('g1', 'g0')], gold, spec=True).save('ui/medal-cost.png')
    disc(19, [('d0', 'd0'), ('g1', 'g0'), ('d0', 'd0')], ('d2', 'd1', 'd0')).save(
        'ui/medal-candle.png')
    disc(19, [('d0', 'd0'), ('dr', 'r1'), ('d0', 'd0')], ('d2', 'd1', 'd0')).save(
        'ui/medal-candle-out.png')
    print('card ornaments')
    for kind in ('light', 'shadow'):
        card_overlay(64, 90, kind).save(f'art/frame-{kind}.png')
        card_overlay(54, 76, kind).save(f'art/frame-{kind}-small.png')


if __name__ == '__main__':
    main()
