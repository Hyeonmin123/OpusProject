"""Gemini pixel-art -> game assets.

    python3 scripts/pixelart/process.py [name ...]

Reads the raw exports in art-src/gemini/ and writes palette-locked, pixel-grid PNGs into
src/assets/. For every asset:

  1. drop Gemini's sparkle watermark (repainted from the surroundings),
  2. sprites only: remove the baked-in checkerboard "transparency" and crop to the subject,
  3. explicit recolours / redraws (see RECOLOURS and redraw.py) happen here, before 4-5,
  4. reduce to a real low-res grid (per-cell palette mode, outline-preserving),
  5. snap to the locked palette and export, scaled back up with nearest-neighbour.

Grid sizes follow the size each asset is shown at, so the pixels land on whole CSS pixels:
portraits 52px (2x in the 104px portrait frame), boss portraits 66px (2x in 132px),
icons 32px, backgrounds 256x144 (shown full-bleed with image-rendering: pixelated).
"""

from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import redraw  # noqa: E402
from pxlib import (PAL, PALETTE, blend_palette, dilate, hex_rgb, inpaint, load_rgb,  # noqa: E402
                   quantize, rgb_to_lab, star_mask, to_rgba, upscale)
from sprite import clean_sprite, fill_holes, to_grid  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'art-src', 'gemini')
OUT = os.path.join(ROOT, 'src', 'assets')

SPRITE_SCALE = 4  # exported PNGs are the pixel grid scaled up 4x with nearest-neighbour

# --------------------------------------------------------------------------------------------
# Explicit recolours (run on the cleaned full-res source, before the grid reduction)
# --------------------------------------------------------------------------------------------


def _hsv(rgb: np.ndarray):
    a = rgb.astype(float)
    mx, mn = a.max(2), a.min(2)
    return mx, mn, a[..., 0], a[..., 1], a[..., 2]


def _ramp(lum: np.ndarray, stops: list[tuple[float, str]]) -> np.ndarray:
    """Map luminance to palette colours: stops = [(upper_bound, key), ...] ascending."""
    out = np.zeros(lum.shape + (3,), np.uint8)
    lo = -1.0
    for hi, key in stops:
        sel = (lum > lo) & (lum <= hi)
        out[sel] = PAL[key]
        lo = hi
    return out


def recolour_sword(rgb, alpha):
    """Steel-blue blade -> neutral silver: the blue face becomes #948b80, the dithered shadow
    face #5a5162 / #312c37. The black outline, pale cutting edge and gold hilt are untouched."""
    mx, mn, r, g, b = _hsv(rgb)
    blue = alpha & (b - r > 18) & (b > g - 4)
    warm = (r - b) > 30
    zone = alpha & dilate(blue, 24) & ~warm
    lum = rgb_to_lab(rgb)[..., 0]
    out = rgb.copy()
    out[blue] = PAL['p1']
    shadow_face = zone & ~blue & (lum >= 9) & (lum < 60)
    out[shadow_face & (lum < 30)] = PAL['s0']
    out[shadow_face & (lum >= 30)] = PAL['s2']
    return out


def recolour_dexterity(rgb, alpha):
    """Brown leather grip wrap -> neutral steel-grey (#5a5162 / #948b80); gold guards, pommels
    and the blades stay."""
    mx, mn, r, g, b = _hsv(rgb)
    warm_dull = alpha & (r - b >= 12) & (r - b <= 52) & (mx > 60) & (mx - mn < 60)
    lum = rgb_to_lab(rgb)[..., 0]
    out = rgb.copy()
    out[warm_dull] = _ramp(lum[warm_dull], [(52, 's2'), (101, 'p1')])
    return out


def recolour_golem(rgb, alpha):
    """Off-palette brown / tan / ochre flesh -> the palette's warm bone range for lit areas and
    its cool parchment greys for the rest. The purple shoulder armour (cool) and the ember chest
    (hot, saturated) are left alone."""
    mx, mn, r, g, b = _hsv(rgb)
    sat = (mx - mn) / np.maximum(mx, 1)
    lum = rgb_to_lab(rgb)[..., 0]
    ember = (r > 150) & (r - g > 70) & (sat > 0.55)
    warm = alpha & (r >= b + 8) & (r >= g - 4) & ~ember & (mx > 38)
    out = rgb.copy()
    out[warm] = _ramp(lum[warm], [(30, 's0'), (40, 'p0'), (52, 'p1'), (62, 'g0'), (74, 'g1'),
                                  (101, 'g3')])
    return out


QMARK = [
    '.XXXXX.',
    'XXXXXXX',
    'XX...XX',
    '.....XX',
    '....XXX',
    '...XXX.',
    '...XX..',
    '...XX..',
    '.......',
    '...XX..',
    '...XX..',
]


def stamp_hidden(g, ga):
    """The '?' on the Gemini hidden-intent disc is a hairline outline glyph that disappears at
    icon size. Keep the disc and rim, and stamp a solid 2px-stroke '?' in the shadow violet
    (the colour the old hidden-intent icon used) in its centre."""
    ys, xs = np.nonzero(ga)
    cx = (xs.min() + xs.max() + 1) // 2
    cy = (ys.min() + ys.max() + 1) // 2
    h, w = len(QMARK), len(QMARK[0])
    x0, y0 = cx - w // 2, cy - h // 2
    # clear the old faint glyph: repaint the disc's inner area with its dark fill
    inner = np.zeros_like(ga)
    yy, xx = np.mgrid[0:ga.shape[0], 0:ga.shape[1]]
    rad = (xs.max() - xs.min()) / 2
    inner = ga & ((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 < (rad * 0.62) ** 2)
    g[inner] = PAL['d1']
    for j, row in enumerate(QMARK):
        for i, ch in enumerate(row):
            if ch == 'X':
                g[y0 + j, x0 + i] = PAL['v1']
    return g, ga


def lift(gamma: float, gain: float = 1.0):
    """Brighten dark subjects a touch so their shading lands on the palette's stone greys
    rather than collapsing into the four darks."""

    def f(rgb, alpha):
        a = (rgb.astype(float) / 255.0) ** gamma * gain
        return np.clip(a * 255, 0, 255).astype(np.uint8)

    return f


RECOLOURS = {
    'sword': recolour_sword,
    'dexterity': recolour_dexterity,
    'rottingGolem': recolour_golem,
    'abyssalEye': lift(0.8, 1.05),
    'thorns': lift(0.75, 1.1),
}

POST_GRID = {'hidden': stamp_hidden}

# Slime is the one sprite allowed off-palette greens: a dark / light step around sage.
SLIME_PALETTE = np.concatenate(
    [PALETTE, np.array([hex_rgb('#5f7a50'), hex_rgb('#3d4f36'), hex_rgb('#a9c492')], np.uint8)])

# --------------------------------------------------------------------------------------------
# Asset table
# --------------------------------------------------------------------------------------------

# name -> (source file, output path, grid, margin, extra)
ICONS = {
    'energy': ('icon-energy', 'icons/energy.png'),
    'candle': ('icon-candle', 'icons/candle.png'),
    'candleOut': ('icon-candle-snuffed', 'icons/candle-out.png'),
    'shield': ('icon-shield', 'icons/shield.png'),
    'sword': ('icon-sword-DRAFT', 'icons/sword.png'),
    'power': ('icon-power-glyph', 'icons/power.png'),
    'shadow': ('icon-shadow-resonance', 'icons/shadow.png'),
    'hidden': ('icon-hidden-intent', 'icons/hidden.png'),
}
STATUS = {k: (f'status-{k}', f'status/{k}.png') for k in
          ['strength', 'dexterity', 'vulnerable', 'weak', 'frail', 'metallicize', 'thorns',
           'kindle', 'ritual']}
PORTRAITS = {
    'warrior': ('anchor-player', 'portraits/warrior.png'),
    'cultist': ('portrait-cultist', 'portraits/cultist.png'),
    'slime': ('portrait-slime', 'portraits/slime.png'),
    'skeleton': ('portrait-skeleton', 'portraits/skeleton.png'),
    'fallenKnight': ('portrait-fallenKnight', 'portraits/fallenKnight.png'),
    'gargoyle': ('portrait-gargoyle', 'portraits/gargoyle.png'),
}
BOSSES = {
    'rottingGolem': ('portrait-rottingGolem-NEEDS-COLOR-FIX', 'portraits/rottingGolem.png'),
    'boneQueen': ('portrait-boneQueen', 'portraits/boneQueen.png'),
    'abyssalEye': ('portrait-abyssalEye', 'portraits/abyssalEye.png'),
}
BACKGROUNDS = {
    'act1': ('bg-combat-act1', 'bg/act1.png'),
    'act2': ('bg-combat-act2', 'bg/act2.png'),
    'act3': ('bg-combat-act3', 'bg/act3.png'),
    'map': ('bg-map', 'bg/map.png'),
    'shop': ('bg-shop', 'bg/shop.png'),
    'rest': ('bg-rest', 'bg/rest.png'),
    'event': ('bg-event', 'bg/event.png'),
}

ICON_GRID, PORTRAIT_GRID, BOSS_GRID = 32, 52, 66
BG_GRID = (256, 144)


def save_sprite(grid_rgb, grid_a, rel):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img = to_rgba(grid_rgb, grid_a)
    upscale(img, SPRITE_SCALE).save(path, optimize=True)
    print(f'  {rel}  {img.width}x{img.height} grid, {os.path.getsize(path) / 1024:.1f} KB')


def check_palette(grid_rgb, grid_a, palette):
    px = grid_rgb[grid_a] if grid_a is not None else grid_rgb.reshape(-1, 3)
    pal = {tuple(c) for c in palette.tolist()}
    bad = {tuple(c) for c in px.tolist()} - pal
    assert not bad, f'off-palette colours: {sorted(bad)[:5]}'


def build_sprite(key, src, rel, grid, margin, *, anchor_bottom=False, dark_bias=0.5):
    rgb, alpha = clean_sprite(os.path.join(SRC, src + '.webp'))
    alpha = fill_holes(alpha)
    if key in RECOLOURS:
        rgb = RECOLOURS[key](rgb, alpha)
    palette = SLIME_PALETTE if key == 'slime' else PALETTE
    g, ga = to_grid(rgb, alpha, grid, margin, palette=palette, anchor_bottom=anchor_bottom,
                    mode='mode', dark_bias=dark_bias)
    if key in POST_GRID:
        g, ga = POST_GRID[key](g, ga)
    check_palette(g, ga, palette)
    save_sprite(g, ga, rel)


# --------------------------------------------------------------------------------------------
# Backgrounds and key art (opaque scenes)
# --------------------------------------------------------------------------------------------

# Scenes keep the locked palette plus the midpoints of neighbouring ramp steps, so stonework
# keeps its texture while staying in the same family as the sprites.
SCENE_PALETTE = blend_palette([
    ('d0', 'd1'), ('d1', 'd2'), ('d2', 'd3'), ('d3', 's0'), ('s0', 's1'), ('s1', 's2'),
    ('s2', 'p0'), ('p0', 'p1'), ('p1', 'p2'), ('p1', 'g0'), ('g0', 'g1'), ('g1', 'g3'),
    ('g1', 'g2'), ('d2', 'v0'), ('v0', 's1'), ('s1', 'v1'), ('s2', 'v1'), ('v1', 'p2'),
    ('d3', 'r0'), ('r0', 'r1'), ('s0', 'g0'), ('s1', 'g0'), ('s2', 'g0'), ('p0', 'g0'),
    ('d3', 'g0'),
])

WM_WIDE = (934, 90, 18)  # sparkle centre x, distance from the bottom, radius on 1024x572
WM_SQUARE = (904, 904, 24)


def clean_scene(path, square=False):
    rgb = load_rgb(path, 1024)
    h, w, _ = rgb.shape
    if square:
        cx, cy, r = WM_SQUARE
    else:
        cx, dy, r = WM_WIDE
        cy = h - dy
    wm = star_mask(h, w, cx, cy, r, grow=4)
    return inpaint(rgb, wm)


def scene_grid(rgb, n_w, n_h, palette=SCENE_PALETTE):
    """Area-average down to the grid, then snap to the scene palette (no dithering)."""
    small = np.asarray(Image.fromarray(rgb).resize((n_w, n_h), Image.BOX))
    q, _ = quantize(small, palette)
    return q


def save_scene(q, rel, scale):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img = Image.fromarray(q, 'RGB')
    img = upscale(img, scale) if scale > 1 else img
    img.save(path, optimize=True)
    print(f'  {rel}  {q.shape[1]}x{q.shape[0]} grid, {os.path.getsize(path) / 1024:.1f} KB')


def build_background(key, src, rel):
    rgb = clean_scene(os.path.join(SRC, src + '.webp'))
    # the exports are 1024x572; trim 2px so the grid is exactly 16:9
    rgb = rgb[2:-2] if rgb.shape[0] == 572 else rgb
    q = scene_grid(rgb, *BG_GRID)
    check_palette(q, None, SCENE_PALETTE)
    save_scene(q, rel, SPRITE_SCALE)


def build_keyart():
    """Main-menu art from the candle-in-archway anchor:
    - bg/menu.png: the archway widened to 16:9 for the full-bleed menu backdrop, with the candle
      lifted out so the menu's title and buttons sit in the dark doorway;
    - art/keyart.png: that candle as a transparent sprite, shown above the title."""
    rgb = clean_scene(os.path.join(SRC, 'anchor-keyart.webp'), square=True)
    menu, candle_rgb, candle_a = redraw.split_keyart(rgb)
    q = scene_grid(menu, 256, 144)
    check_palette(q, None, SCENE_PALETTE)
    save_scene(q, 'bg/menu.png', SPRITE_SCALE)
    g, ga = redraw.keyart_candle_grid(candle_rgb, candle_a)
    check_palette(g, ga, PALETTE)
    save_sprite(g, ga, 'art/keyart.png')


# --------------------------------------------------------------------------------------------


def main(only: set[str]):
    def want(k):
        return not only or k in only

    print('icons')
    for k, (src, rel) in ICONS.items():
        if want(k):
            build_sprite(k, src, rel, ICON_GRID, 0.10, dark_bias=0.34)
    if want('light'):
        g, ga = redraw.light_resonance()
        check_palette(g, ga, PALETTE)
        save_sprite(g, ga, 'icons/light.png')
    print('status')
    for k, (src, rel) in STATUS.items():
        if want(k):
            build_sprite(k, src, rel, ICON_GRID, 0.10, dark_bias=0.34)
    print('portraits')
    for k, (src, rel) in PORTRAITS.items():
        if want(k):
            build_sprite(k, src, rel, PORTRAIT_GRID, 0.06, anchor_bottom=k == 'warrior')
    for k in ('rat', 'bat'):
        if want(k):
            g, ga = getattr(redraw, k)(PORTRAIT_GRID)
            check_palette(g, ga, PALETTE)
            save_sprite(g, ga, f'portraits/{k}.png')
    for k, (src, rel) in BOSSES.items():
        if want(k):
            build_sprite(k, src, rel, BOSS_GRID, 0.05)
    print('scenes')
    for k, (src, rel) in BACKGROUNDS.items():
        if want(k):
            build_background(k, src, rel)
    if want('menu'):
        build_keyart()


if __name__ == '__main__':
    main(set(sys.argv[1:]))
