"""Map-node, relic, event and screen icons: hand-built pixel grids on the gameplay icons' 32px
grid. The screen icons are the few glyphs the screens drew as emoji: the reward trophy, the
shop's card removal, the run summary's crown and headstone, and the top bar's HP heart.

Seeded into the "Icons" page of the Figma pixel UI kit by `uikit.py seed` and imported back
from its export sheet (exported @4x, like `src/assets/icons/*.png`) by `uikit.py import`; see
uikit.py for the round trip. `python3 scripts/pixelart/icons.py` writes a 4x preview sheet
(build/uikit/preview-icons.png) for iterating on the drawings.

Every icon is drawn as a character map on a 26px canvas (1px left free on each side for the
outline), then:

- lowercase letters are fixed palette colours (FIX), placed by hand;
- uppercase letters are materials (MAT): each 4-connected region of one letter is shaded on the
  shared light (upper left): its top / left edge pixels take the material's lit step, its bottom
  / right edge pixels the deep step, and its interior shades from the base step to the shade
  step toward the lower right in ordered (Bayer) dither;
- ',' is an empty pixel the outline must leave empty;
- the silhouette gets a hard 1px d0 outline (4-connected), and the result is centred on the
  32 x 32 grid (3px or more of margin), like the gameplay icons.

Only the locked palette of pxlib.py is used (no midpoints), the same as the gameplay icons.
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

SIZE = 32
CANVAS = 26

# Fixed colours (lowercase letters).
FIX = {
    'k': 'd0', '1': 'd1', '2': 'd2', '3': 'd3',
    'u': 's0', 't': 's1', 's': 's2',
    'z': 'p0', 'm': 'p1', 'p': 'p2', 'h': 'hi',
    'n': 'g0', 'g': 'g1', 'o': 'g2', 'y': 'g3',
    'w': 'v0', 'v': 'v1', 'q': 'r0', 'r': 'r1', 'e': 'dr',
    'b': 'bl', 'x': 'gr',
}

# Materials (uppercase letters): (deep, shade, base, lit).
MAT = {
    'G': ('g0', 'g0', 'g1', 'g3'),  # gold
    'Y': ('g2', 'g2', 'g3', 'hi'),  # flame gold / glowing
    'S': ('s1', 's2', 'p1', 'p2'),  # steel, silver
    'I': ('d3', 's0', 's1', 's2'),  # dark iron
    'T': ('s0', 's1', 's2', 'p1'),  # stone
    'B': ('p0', 'p1', 'p2', 'hi'),  # bone, parchment
    'X': ('p1', 'p1', 'p2', 'hi'),  # white wax
    'R': ('r0', 'r0', 'r1', 'dr'),  # blood, red wax
    'W': ('r0', 'r0', 'p0', 'g0'),  # wood, leather
    'V': ('v0', 'v0', 'v1', 'p2'),  # violet
    'D': ('d1', 'd1', 'd2', 's0'),  # black (wax, shadow)
    'L': ('s1', 's1', 'bl', 'p1'),  # steel blue
    'E': ('s0', 's1', 'gr', 'p2'),  # sage leaf
    'N': ('r0', 'p0', 'g0', 'g1'),  # bronze
    'C': ('v0', 'v0', 'g0', 'g1'),  # tarnished gold, violet in the shade (cursed)
    'K': ('d1', 'd1', 'd3', 's1'),  # black wax
    'H': ('v0', 'v0', 's1', 'v1'),  # shadow cloth, violet rim
}

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


# --------------------------------------------------------------------------------------------
# Canvas
# --------------------------------------------------------------------------------------------


class Pic:
    """A CANVAS x CANVAS character map ('.' = empty)."""

    def __init__(self, w: int = CANVAS, h: int = CANVAS):
        self.w, self.h = w, h
        self.c = [['.'] * w for _ in range(h)]

    def get(self, x, y):
        return self.c[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.'

    def put(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.c[y][x] = ch

    def rows(self, rows: list[str], x0: int = 0, y0: int = 0, center: bool = False):
        """Stamp character rows ('.' is skipped). `center` centres them on the canvas."""
        if center:
            x0 = (self.w - max(len(r) for r in rows)) // 2
            y0 = (self.h - len(rows)) // 2
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.':
                    self.put(x0 + i, y0 + j, ch)
        return self

    def fill(self, test, ch):
        for y in range(self.h):
            for x in range(self.w):
                if test(x + 0.5, y + 0.5):
                    self.put(x, y, ch)
        return self

    def disc(self, cx, cy, r, ch):
        return self.fill(lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= r * r, ch)

    def ellipse(self, cx, cy, rx, ry, ch):
        return self.fill(lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, ch)

    def ring(self, cx, cy, r0, r1, ch):
        return self.fill(lambda x, y: r0 * r0 <= (x - cx) ** 2 + (y - cy) ** 2 <= r1 * r1, ch)

    def stroke(self, x0, y0, x1, y1, width, ch):
        """Capsule: pixels whose centre lies within width/2 of the segment."""
        def t(x, y):
            dx, dy = x1 - x0, y1 - y0
            ll = dx * dx + dy * dy
            u = 0 if ll == 0 else max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / ll))
            px, py = x0 + u * dx, y0 + u * dy
            return (x - px) ** 2 + (y - py) ** 2 <= (width / 2) ** 2
        return self.fill(t, ch)

    def poly(self, pts, ch):
        """Filled polygon (even-odd, pixel centres)."""
        def t(x, y):
            inside = False
            n = len(pts)
            for i in range(n):
                (ax, ay), (bx, by) = pts[i], pts[(i + 1) % n]
                if (ay > y) != (by > y) and x < ax + (y - ay) * (bx - ax) / (by - ay):
                    inside = not inside
            return inside
        return self.fill(t, ch)

    def edge_k(self, over: str, under: str):
        """Hard d0 line where letter `under` touches letter `over` (the top layer)."""
        hits = []
        for y in range(self.h):
            for x in range(self.w):
                if self.c[y][x] in under and any(
                        self.get(x + dx, y + dy) in over
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    hits.append((x, y))
        for x, y in hits:
            self.c[y][x] = 'k'
        return self


def sym(rows: list[str], odd: bool = False) -> list[str]:
    """Mirror left-half rows into full rows (odd: the last column is the shared centre)."""
    return [r + (r[-2::-1] if odd else r[::-1]) for r in rows]


def over(p: Pic, q: Pic, edge: str = 'k') -> Pic:
    """Paint `q` over `p`; where p's pixels touch q's they become an `edge` line."""
    for y in range(p.h):
        for x in range(p.w):
            if q.c[y][x] == '.' and p.c[y][x] not in '.,' and any(
                    q.get(x + dx, y + dy) != '.'
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                p.c[y][x] = edge
    for y in range(p.h):
        for x in range(p.w):
            if q.c[y][x] != '.':
                p.c[y][x] = q.c[y][x]
    return p


def vflip_into(p: Pic, rows_top: int):
    """Mirror the top `rows_top` rows downwards around the row `rows_top - 1`."""
    for j in range(rows_top - 1):
        dst = 2 * (rows_top - 1) - j
        if dst < p.h:
            p.c[dst] = p.c[j][:]
    return p


# --------------------------------------------------------------------------------------------
# Render: shading, outline, centring
# --------------------------------------------------------------------------------------------


def render(pic: Pic):
    """Character map -> (keys, alpha) on the 32 x 32 grid."""
    H, W = pic.h, pic.w
    c = pic.c
    keys = [[''] * W for _ in range(H)]

    # material regions (4-connected runs of one uppercase letter)
    region = [[-1] * W for _ in range(H)]
    boxes = []
    for y in range(H):
        for x in range(W):
            ch = c[y][x]
            if not ch.isupper() or region[y][x] >= 0:
                continue
            rid = len(boxes)
            stack = [(x, y)]
            region[y][x] = rid
            pts = []
            while stack:
                px, py = stack.pop()
                pts.append((px, py))
                for dx, dy_ in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    qx, qy = px + dx, py + dy_
                    if 0 <= qx < W and 0 <= qy < H and region[qy][qx] < 0 and c[qy][qx] == ch:
                        region[qy][qx] = rid
                        stack.append((qx, qy))
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            boxes.append((min(xs), min(ys), max(xs), max(ys)))

    def same(x, y, ch):
        o = pic.get(x, y)
        return o == ch or (o.islower() or o.isdigit())

    for y in range(H):
        for x in range(W):
            ch = c[y][x]
            if ch in '.,':
                continue
            if ch in FIX:
                keys[y][x] = FIX[ch]
                continue
            deep, shade, base, lit = MAT[ch]
            up, left = same(x, y - 1, ch), same(x - 1, y, ch)
            down, right = same(x, y + 1, ch), same(x + 1, y, ch)
            ul = not up or not left
            lr = not down or not right
            if ul and not lr:
                keys[y][x] = lit
            elif lr and not ul:
                keys[y][x] = deep
            elif ul and lr:
                keys[y][x] = base
            else:
                x0, y0, x1, y1 = boxes[region[y][x]]
                u = ((x - x0) / max(1, x1 - x0) + (y - y0) / max(1, y1 - y0)) / 2
                k = base
                if u > 0.58:
                    if BAYER4[y % 4, x % 4] < min(0.5, (u - 0.58) / 0.2):
                        k = shade
                elif u < 0.2 and BAYER4[y % 4, x % 4] < 0.5:
                    k = lit
                keys[y][x] = k

    filled = np.array([[bool(k) for k in row] for row in keys])
    # outline
    out = [row[:] for row in keys]
    for y in range(H):
        for x in range(W):
            if filled[y, x] or c[y][x] == ',':
                continue
            if any(0 <= x + dx < W and 0 <= y + dy_ < H and filled[y + dy_, x + dx]
                   for dx, dy_ in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = 'd0'
    # centre on the 32 grid
    ys, xs = np.nonzero(np.array([[bool(k) for k in row] for row in out]))
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    ox = (SIZE - (x1 - x0 + 1)) // 2 - x0
    oy = (SIZE - (y1 - y0 + 1)) // 2 - y0
    grid = [[''] * SIZE for _ in range(SIZE)]
    for y in range(H):
        for x in range(W):
            if out[y][x]:
                gx, gy = x + ox, y + oy
                assert 0 <= gx < SIZE and 0 <= gy < SIZE, 'icon does not fit the grid'
                grid[gy][gx] = out[y][x]
    return grid


# --------------------------------------------------------------------------------------------
# Shared parts
# --------------------------------------------------------------------------------------------


def flames(p: Pic, tongues, layers='roYh', steps=None):
    """Teardrop flames, point up, merged layer by layer (all outer layers first, so tongues
    fuse into one fire). Each tongue is (cx, top, bottom, half width, lean); `lean` curls the
    tip sideways."""
    steps = steps or [(0, 0, 0), (1.2, 0.8, 1.2), (2.6, 1.6, 2.4), (4.2, 2.6, 3.4)]
    for (dt, db, dw), ch in zip(steps, layers):
        for cx, top, bottom, half, lean in tongues:
            t0, b0, hw = top + dt, bottom - db, half - dw
            if hw <= 0.3 or b0 - t0 < 1:
                continue

            def test(x, y, t0=t0, b0=b0, hw=hw, cx=cx, lean=lean):
                if not (t0 <= y <= b0):
                    return False
                t = (y - t0) / (b0 - t0)
                if t < 0.68:
                    w = hw * (t / 0.68) ** 0.75
                else:
                    w = hw * math.sqrt(max(0.0, 1 - ((t - 0.68) / 0.32) ** 2))
                return abs(x - (cx + lean * (1 - t) ** 2)) <= w
            p.fill(test, ch)
    return p


def flame(p: Pic, cx, top, bottom, half, layers='roYh', lean=0.0, steps=None):
    return flames(p, [(cx, top, bottom, half, lean)], layers, steps)


def candle_flame(p: Pic, x: int, y: int, colours='roy'):
    """Small 3x5 candle flame with its base at (x, y) (the wick column)."""
    o, m, i = colours
    p.rows([f'.{o}.', f'.{m}.', f'{o}{i}{m}', f'{m}{i}{m}', f'.{m}.'], x - 1, y - 4)
    return p


# --------------------------------------------------------------------------------------------
# Map nodes
# --------------------------------------------------------------------------------------------


def sword(p: Pic, flip: bool):
    """A sword on the diagonal, tip to the upper right (flip: upper left)."""
    def P(x, y):
        return (CANVAS - x if flip else x, y)
    # blade
    bx0, by0 = P(9.0, 17.0)
    bx1, by1 = P(22.2, 3.8)
    p.stroke(bx0, by0, bx1, by1, 3.0, 'S')
    tx, ty = P(23.3, 2.7)
    p.stroke(bx1, by1, tx, ty, 1.2, 'S')
    # guard
    gx0, gy0 = P(5.2, 13.2)
    gx1, gy1 = P(12.8, 20.8)
    p.stroke(gx0, gy0, gx1, gy1, 2.2, 'G')
    # grip, pommel
    hx0, hy0 = P(8.0, 18.0)
    hx1, hy1 = P(4.2, 21.8)
    p.stroke(hx0, hy0, hx1, hy1, 1.8, 'W')
    px_, py_ = P(3.2, 22.8)
    p.disc(px_, py_, 1.6, 'G')


def node_combat():
    """Crossed swords."""
    back, front = Pic(), Pic()
    sword(back, True)
    sword(front, False)
    return render(over(back, front))


def node_elite():
    """Horned demon head: violet, bone horns, burning eyes."""
    half = [
        'B...........',
        'BB..........',
        '.BB.........',
        '.BBB........',
        '..BBB.......',
        '..BBBB..VVVV',
        '...BBBVVVVVV',
        '....BVVVVVVV',
        '....VVVVVVVV',
        '...VVVVVVVVV',
        '...VVkkVVVVV',
        '...VVyokkVVV',
        '...VVkyykVVV',
        '...VVVkkVVVV',
        '...VVVVVVVkk',
        '....VVVVVVVV',
        '....VkVVVVVV',
        '....VkpkkkkV',
        '.....kkpkpkk',
        '.....VkkkkkV',
        '......VVVVVV',
        '........VVVV',
    ]
    p = Pic().rows(sym(half), center=True)
    return render(p)


def node_event():
    rows = [
        '...GGGGGG...',
        '.GGGGGGGGGG.',
        'GGGG....GGGG',
        'GGG......GGG',
        'GGG......GGG',
        '.........GGG',
        '........GGGG',
        '.......GGGG.',
        '......GGGG..',
        '.....GGGG...',
        '.....GGG....',
        '.....GGG....',
        '.....GGG....',
        '............',
        '............',
        '.....GGG....',
        '.....GGG....',
        '.....GGG....',
    ]
    return render(Pic().rows(rows, center=True))


def node_shop():
    """A stack of coins with one coin standing in front of it."""
    p = Pic()
    face = [
        '...yyyyyyyy...',
        '.yyGGGGGGGGnn.',
        'yGGGGGGGGGGGGn',
        '.nnGGGGGGGGnn.',
    ]
    edge = 'onnnnnnnnnnnnn'
    sep = 'kkkkkkkkkkkkkk'
    p.rows(face + [edge, sep, edge, sep, edge, sep, edge, sep, edge], 0, 8)
    # standing coin, face on: rim, sunken ring, a stamped mark
    p.disc(17.5, 14.5, 7.6, 'k')
    p.disc(17.5, 14.5, 6.6, 'G')
    p.ring(17.5, 14.5, 3.6, 4.6, 'n')
    p.rows(['.y.', 'ynn', '.n.'], 16, 13)
    return render(p)


def node_rest():
    """Campfire: two crossed logs under a three-tongued fire."""
    p = Pic()
    flames(p, [(7.5, 7.0, 20.0, 4.2, -2.5), (18.0, 5.0, 20.0, 4.4, 2.5),
               (12.5, 0.5, 20.0, 7.0, -1.2)])
    p.stroke(2.0, 18.5, 22.0, 23.0, 3.2, 'W')
    p.stroke(2.0, 23.0, 22.0, 18.5, 3.2, 'W')
    p.edge_k('W', 'roYh')
    return render(p)


def node_boss():
    half = [
        '.....BBBBBBBB',
        '...BBBBBBBBBB',
        '..BBBBBBBBBBB',
        '.BBBBBBBBBBBB',
        '.BBBBBBBBBBBB',
        'BBBBBBBBBBBBB',
        'BBBBBBBBBBBBB',
        'BBBkkkkkBBBBB',
        'BBkkkkkkkBBBB',
        'BBkkkrkkkBBBB',
        'BBkkkkkkkBBBB',
        '.BBkkkkkBBBBk',
        '.BBBBBBBBBBkk',
        '..BBBBBBBBBBB',
        '...BBBBBBBBBB',
        '....BkBkBkBkB',
        '....BkBkBkBkB',
        '.....BBBBBBBB',
        '......BBBBBBB',
    ]
    return render(Pic().rows(sym(half), center=True))


NODES = {
    'combat': node_combat,
    'elite': node_elite,
    'event': node_event,
    'shop': node_shop,
    'rest': node_rest,
    'boss': node_boss,
}

# --------------------------------------------------------------------------------------------
# Relics
# --------------------------------------------------------------------------------------------


def relic_burning_blood():
    """전사의 피: a drop of blood that glows from within and burns at its tip."""
    p = Pic()
    flame(p, 12.5, 6.0, 24.5, 8.2, layers='R', steps=[(0, 0, 0)])
    p.disc(12.5, 18.2, 3.6, 'e')
    p.disc(12.5, 18.2, 1.9, 'o')
    p.put(12, 17, 'y')
    p.rows(['h', 'h.', '.h'], 8, 13)
    fire = Pic()
    flame(fire, 12.5, 0.0, 9.5, 3.4, layers='roy', lean=1.8,
          steps=[(0, 0, 0), (1.3, 0.9, 1.1), (3.0, 1.9, 2.1)])
    over(p, fire)
    return render(p)


def relic_anchor():
    """녹슨 닻: an iron anchor eaten by rust."""
    p = Pic()
    p.ring(12.5, 3.5, 1.3, 3.0, 'S')
    p.stroke(12.5, 6.0, 12.5, 22.0, 2.8, 'S')
    p.stroke(6.0, 9.0, 19.0, 9.0, 2.4, 'S')
    p.fill(lambda x, y: y >= 15.0 and 7.6 ** 2 <= (x - 12.5) ** 2 + (y - 13.5) ** 2 <= 10.2 ** 2,
           'S')
    p.poly([(0.5, 17.5), (4.5, 12.0), (6.0, 18.0)], 'S')
    p.poly([(24.5, 17.5), (20.5, 12.0), (19.0, 18.0)], 'S')
    # rust: blooms of r0 / dr on the shaded side
    for x, y, ch in [(13, 12, 'e'), (13, 13, 'q'), (12, 17, 'e'), (13, 18, 'e'), (13, 19, 'q'),
                     (18, 21, 'e'), (19, 20, 'q'), (20, 19, 'e'), (7, 22, 'e'), (8, 22, 'q'),
                     (17, 9, 'e'), (18, 9, 'q'), (14, 2, 'e'), (23, 15, 'e')]:
        if p.get(x, y) == 'S':
            p.put(x, y, ch)
    return render(p)


def relic_vajra():
    """금강저: a gilt thunderbolt sceptre, prongs meeting at both ends."""
    p = Pic()
    # top half on rows 0..12, mirrored down around row 12
    p.stroke(12.5, 1.0, 12.5, 9.0, 1.9, 'G')
    p.stroke(10.0, 9.0, 7.6, 5.4, 1.7, 'G')
    p.stroke(7.6, 5.4, 11.6, 1.2, 1.7, 'G')
    p.stroke(15.0, 9.0, 17.4, 5.4, 1.7, 'G')
    p.stroke(17.4, 5.4, 13.4, 1.2, 1.7, 'G')
    p.rows(['GGGGGGGGG', '.GGGGGGG.'], 8, 9)
    p.rows(['.nnnn.'], 10, 11)
    vflip_into(p, 13)
    over(p, Pic().disc(12.5, 12.5, 3.1, 'G'))
    p.rows(['y'], 11, 11)
    return render(p)


def relic_marbles():
    """구슬 주머니: a drawstring pouch, marbles rolling out of it."""
    p = Pic()
    p.ellipse(10.5, 15.0, 8.6, 8.0, 'N')
    p.poly([(5.5, 10.0), (15.5, 10.0), (13.0, 5.0), (8.0, 5.0)], 'N')
    p.rows(['N.NN.NN.N', 'NNNNNNNNN'], 6, 2)
    p.rows(['rrrrrrrrr', '.q.....q.'], 6, 6)
    p.rows(['r', 'r', '.r', '.q'], 14, 7)
    bag = p
    for cx, cy, ch in [(16.0, 21.0, 'V'), (21.5, 17.0, 'L'), (22.0, 22.5, 'R')]:
        m = Pic().disc(cx, cy, 3.0, ch)
        m.put(int(cx - 1), int(cy - 1), 'h')
        over(bag, m)
    return render(bag)


def relic_lantern():
    """등불: a bronze hanging lantern with a lit candle behind its panes."""
    p = Pic()
    p.ring(12.5, 3.0, 1.2, 2.6, 'N')
    p.poly([(6.0, 9.0), (19.0, 9.0), (15.5, 5.5), (9.5, 5.5)], 'N')
    p.rows(['Y' * 11] * 10, 7, 10)
    p.rows(['NNNNNNNNNNNNN', '.NNNNNNNNNNN.', '...NNNNNNN...'], 6, 20)
    # frame bars
    for y in range(10, 20):
        p.put(7, y, 'n')
        p.put(17, y, 'n')
        p.put(12, y, 'k' if y < 13 else '.')
    for y in range(13, 20):
        p.put(12, y, 'Y')
    p.rows(['nnnnnnnnnnn'], 7, 10)
    candle_flame(p, 12, 16, 'roh')
    p.rows(['X', 'X', 'X'], 12, 17)
    return render(p)


def relic_blood_vial():
    """피의 약병: a round-bellied flask of blood, stoppered with a cork."""
    p = Pic()
    p.disc(12.5, 16.0, 8.3, 'u')
    p.rows(['uuuuu'] * 6, 10, 3)
    p.rows(['.WWWWW.', 'WWWWWWW', '.WWWWW.'], 9, 0)
    # the blood, up to a meniscus
    p.fill(lambda x, y: y >= 14.0 and (x - 12.5) ** 2 + (y - 16.0) ** 2 <= 7.3 ** 2, 'R')
    p.rows(['eeeeeeeeeeeee'], 6, 13)
    for y in range(p.h):
        for x in range(p.w):
            if p.c[y][x] == 'e' and not ((x - 12.0) ** 2 + (y + 0.5 - 16.0) ** 2 <= 7.3 ** 2):
                p.c[y][x] = 'u'
    # glass highlights
    p.rows(['t', 't', 't'], 11, 4)
    p.rows(['..h', '.h.', 'h..', 'h..', 'h..'], 6, 9)
    p.rows(['ttt'], 11, 8)
    return render(p)


def relic_bronze_scales():
    """청동 비늘: overlapping bronze scales, like a torn-off patch of dragon hide."""
    p = Pic()
    outline = Pic().poly([(2.0, 2.0), (23.0, 2.0), (23.0, 14.0), (12.5, 24.5), (2.0, 14.0)], 'x')
    for r in reversed(range(5)):
        for c in range(-1, 5):
            cx = 4.0 + 5.4 * c + (2.7 if r % 2 else 0)
            cy = 3.2 + 4.6 * r
            q = Pic()
            q.fill(lambda x, y, cx=cx, cy=cy: (x - cx) ** 2 + ((y - cy) * 0.95) ** 2 <= 3.6 ** 2
                   and outline.get(int(x), int(y)) == 'x', 'N')
            over(p, q, 'q')
    for x, y in [(3, 3), (8, 7), (14, 3), (11, 12), (17, 12), (6, 12), (14, 16), (9, 16)]:
        if p.get(x, y) == 'N':
            p.put(x, y, 'y')
    return render(p)


def relic_wild_berry():
    """야생 산딸기: a wild raspberry under its sage-green calyx."""
    p = Pic()
    pts = [(12.5, 22.0), (9.5, 20.0), (15.5, 20.0), (7.0, 16.8), (12.5, 17.3), (18.0, 16.8),
           (9.6, 13.8), (15.4, 13.8), (6.5, 11.0), (12.5, 10.8), (18.5, 11.0), (9.4, 8.2),
           (15.6, 8.2)]
    for cx, cy in pts:
        q = Pic().disc(cx, cy, 2.75, 'R')
        q.put(int(cx - 1), int(cy - 1), 'h')
        over(p, q, 'q')
    leaf = Pic()
    leaf.poly([(12.5, 8.5), (3.0, 5.5), (8.5, 4.5), (12.5, 1.5), (16.5, 4.5), (22.0, 5.5)], 'E')
    leaf.stroke(12.5, 4.0, 14.5, 0.3, 1.6, 'x')
    over(p, leaf)
    return render(p)


def relic_golden_idol():
    """황금 우상: a squat golden statuette seated on a stone plinth, ruby eyes."""
    p = Pic()
    p.rows(['TTTTTTTTTTTTTTT', 'TTTTTTTTTTTTTTT', '.TTTTTTTTTTTTT.'], 5, 21)
    body = Pic()
    body.poly([(7.0, 21.0), (18.0, 21.0), (17.0, 12.0), (8.0, 12.0)], 'G')
    body.ellipse(12.5, 18.0, 6.5, 3.6, 'G')
    over(p, body)
    arms = Pic()
    arms.rows(['GGG.......GGG', '.GGGGGGGGGGG.', '..GGGGGGGGG..'], 6, 14)
    over(p, arms)
    head = Pic().disc(12.5, 7.0, 5.0, 'G')
    head.rows(['GGGGGGGGG'], 8, 3)
    head.rows(['.G.G.G.'], 9, 1)
    head.rows(['.G.G.G.'], 9, 2)
    head.rows(['r...r', '.....', '.kkk.'], 10, 6)
    over(p, head)
    return render(p)


def relic_wax_seal():
    """밀랍 봉인: a blob of red sealing wax with a stamped flame, on parchment ribbons."""
    p = Pic()
    p.stroke(9.5, 16.0, 5.5, 24.0, 3.4, 'B')
    p.stroke(15.5, 16.0, 19.5, 24.0, 3.4, 'B')
    p.put(5, 24, '.')
    p.put(19, 24, '.')
    seal = Pic()
    seal.disc(12.5, 11.0, 8.2, 'R')
    for a in range(0, 360, 45):
        r = math.radians(a + 20)
        seal.disc(12.5 + 8.0 * math.cos(r), 11.0 + 8.0 * math.sin(r), 1.9, 'R')
    seal.ring(12.5, 11.0, 5.2, 6.1, 'q')
    seal.rows(['..q..', '.qq..', '.qeq.', 'qeeqq', 'qqeq.', '.qqq.'], 10, 8)
    over(p, seal)
    return render(p)


def relic_silver_candlestick():
    """은촛대: a silver candlestick: foot, knopped stem, drip pan, a taper burning."""
    p = Pic()
    p.ellipse(12.5, 22.8, 7.6, 2.2, 'S')
    p.stroke(12.5, 21.0, 12.5, 13.0, 2.6, 'S')
    p.disc(12.5, 17.0, 2.4, 'S')
    pan = Pic().ellipse(12.5, 12.8, 6.4, 1.8, 'S')
    over(p, pan)
    c = Pic().rows(['XXXXX'] * 6, 10, 5)
    c.put(14, 6, 'p')
    c.put(10, 11, 'X')
    over(p, c)
    candle_flame(p, 12, 3, 'roh')
    p.put(12, 4, 'k')
    return render(p)


def relic_owl_eye():
    """올빼미의 눈: a great owl's eye, burning amber, ringed with feathers and ear tufts."""
    p = Pic()
    p.disc(12.5, 13.5, 10.6, 'W')
    p.poly([(1.5, 1.0), (9.0, 5.0), (3.5, 9.0)], 'W')
    p.poly([(23.5, 1.0), (16.0, 5.0), (21.5, 9.0)], 'W')
    for a in range(0, 360, 30):
        r = math.radians(a)
        for d in (8.2, 9.4):
            p.put(int(12.5 + d * math.cos(r)), int(13.5 + d * math.sin(r)), 'z')
    eye = Pic().disc(12.5, 13.5, 6.8, 'Y')
    eye.ring(12.5, 13.5, 5.6, 6.9, 'o')
    eye.disc(12.5, 13.5, 3.2, 'k')
    eye.rows(['hh', 'h.'], 10, 11)
    over(p, eye)
    return render(p)


def relic_cursed_crown():
    """저주받은 왕관: a jagged, crooked crown of tarnished gold, violet rot seeping in."""
    rows = [
        '..........C...........',
        '.........CCC..........',
        '.C.......CCC.......C..',
        '.CC.....CkCCC.....CC..',
        '.CCC....CCkCC....CCC.C',
        '.CCC...CCCkCCC...CCCCC',
        '.CCCC..CCCvCCC..CCCCC.',
        '.CCCC.CCCvwvCCC.CCCC..',
        '.CCCCCCCCCvCCCCCCCCC..',
        '.CCCCCCCCCCCCCCCCCCCC.',
        'kkkkkkkkkkkkkkkkkkkkkk',
        'CCCCCCCCCCCCCCCCCCCCCC',
        'CCvvCCCCCvvCCCCCCvvCCC',
        'CCvwCCCCCvwCCCCCCvwCCC',
        'CCCCCCCCCCCCCCCwCCCwCC',
        '.CCCCCCCCCCCCCwwCCwwC.',
        '..............v....v..',
        '..............v.......',
    ]
    return render(Pic().rows(rows, center=True))


def relic_black_candle():
    """검은 양초: a candle of black wax guttering with a violet flame."""
    rows = [
        '..KKKKKKK..',
        '.KKKKKKKKK.',
        '.KtKKKKKKKK',
        '.KtKKKKKKKK',
        '.KtKKKKKKK.',
        'KKtKKKKKKK.',
        'KKtKKKKKKK.',
        'K.tKKKKKKK.',
        '..tKKKKKKK.',
        '.KtKKKKKKK.',
        '.KKKKKKKKK.',
        '.KKKKKKKKK.',
        '.KKKKKKKKK.',
        'KKKKKKKKKKK',
        'KKKKKKKKKKK',
    ]
    p = Pic().rows(rows, 7, 10)
    flame(p, 12.5, 0.0, 10.0, 4.2, layers='vph', lean=-1.2,
          steps=[(0, 0, 0), (1.6, 1.2, 1.4), (3.4, 2.4, 2.6)])
    p.put(12, 9, 'k')
    p.put(12, 10, 'k')
    return render(p)


def relic_eternal_flame():
    """영원의 불꽃: a flame that never gutters, in a gilt brazier."""
    p = Pic()
    flames(p, [(12.5, 0.0, 16.5, 7.4, 1.5), (8.0, 5.0, 16.5, 4.0, -2.2),
               (17.2, 4.0, 16.5, 4.0, 2.4)])
    bowl = Pic()
    bowl.fill(lambda x, y: y >= 14.0 and ((x - 12.5) / 10.5) ** 2 + ((y - 14.0) / 5.6) ** 2 <= 1,
              'G')
    bowl.rows(['GGGGGGGGGGGGGGGGGGGGG'], 2, 14)
    bowl.rows(['nynynynynynynynynyn'], 3, 15)
    bowl.stroke(12.5, 19.0, 12.5, 22.0, 2.6, 'G')
    bowl.ellipse(12.5, 23.0, 5.0, 1.6, 'G')
    over(p, bowl)
    return render(p)


def relic_iron_heart():
    """무쇠 심장: a heart of riveted cast iron, a red glow in its seam."""
    p = Pic()
    p.disc(8.0, 8.6, 5.9, 'T')
    p.disc(17.0, 8.6, 5.9, 'T')
    p.poly([(2.2, 10.0), (22.8, 10.0), (12.5, 23.5)], 'T')
    p.fill(lambda x, y: abs(x - 12.5) < 9.5 and 7.0 < y < 16.0 and
           abs(x - 12.5) < 10.4 - (y - 7.0) * 0.1, 'T')
    # seam with a red glow, rivets
    for y, x in [(5, 12), (6, 12), (7, 13), (8, 13), (9, 12), (10, 12), (11, 13), (12, 13),
                 (13, 12), (14, 12), (15, 13), (16, 13), (17, 12), (18, 12), (19, 13)]:
        p.put(x, y, 'k')
    for y, x in [(7, 12), (8, 12), (11, 12), (12, 12), (15, 12), (16, 12)]:
        p.put(x, y, 'r')
    p.put(12, 12, 'o')
    for x, y in [(6, 6), (9, 5), (18, 5), (20, 8), (5, 11), (8, 15), (17, 16), (20, 12)]:
        p.put(x, y, 'p')
        p.put(x, y + 1, 'u')
    return render(p)


RELICS = {
    'burningBlood': relic_burning_blood,
    'anchor': relic_anchor,
    'vajra': relic_vajra,
    'bagOfMarbles': relic_marbles,
    'lantern': relic_lantern,
    'bloodVial': relic_blood_vial,
    'bronzeScales': relic_bronze_scales,
    'wildBerry': relic_wild_berry,
    'goldenIdol': relic_golden_idol,
    'waxSeal': relic_wax_seal,
    'silverCandlestick': relic_silver_candlestick,
    'owlEye': relic_owl_eye,
    'cursedCrown': relic_cursed_crown,
    'blackCandle': relic_black_candle,
    'eternalFlame': relic_eternal_flame,
    'ironHeart': relic_iron_heart,
}


# --------------------------------------------------------------------------------------------
# Events
# --------------------------------------------------------------------------------------------


def event_altar():
    """버려진 제단: a stone altar, one candle on it, old blood run down its face."""
    p = Pic()
    p.rows(['T' * 22, 'T' * 22], 1, 11)
    p.rows(['T' * 16] * 8, 4, 13)
    p.rows(['T' * 20, 'T' * 20], 2, 21)
    p.rows(['u' * 16], 4, 13)
    p.rows(['u' * 20], 2, 21)
    for y in range(14, 21):
        p.put(12, y, 'u')
    p.rows(['u' * 16], 4, 17)
    for y in range(17, 21):
        p.put(12, y, 'T')
    for y in range(18, 21):
        p.put(8, y, 'u')
        p.put(16, y, 'u')
    p.rows(['rrr', '.q.', '.r.', '.q.', '.r.', '...', '.q.'], 13, 11)
    p.rows(['qr', '.r'], 6, 11)
    p.rows(['XXX'] * 5, 11, 6)
    candle_flame(p, 12, 4, 'roh')
    p.put(12, 5, 'k')
    return render(p)


def event_corpse():
    """모험가의 시체: a plank coffin, bound in iron, a cross on its lid."""
    p = Pic()
    p.poly([(8.0, 0.5), (17.0, 0.5), (21.5, 7.0), (17.5, 25.0), (7.5, 25.0), (3.5, 7.0)], 'W')
    inner = Pic().poly([(9.0, 2.5), (16.0, 2.5), (19.3, 7.2), (16.2, 23.0), (8.8, 23.0),
                        (5.7, 7.2)], 'W')
    over(p, inner, 'q')
    for y in (6, 18):
        for x in range(p.w):
            if p.get(x, y) not in '.,':
                p.put(x, y, 'I')
    p.rows(['..BB..', '..BB..', 'BBBBBB', 'BBBBBB', '..BB..', '..BB..', '..BB..', '..BB..'],
           10, 8)
    return render(p)


def event_spring():
    """검은 샘: a stone basin of black water, a drop falling into it."""
    p = Pic()
    p.fill(lambda x, y: y >= 12.0 and ((x - 12.5) / 11.5) ** 2 + ((y - 12.0) / 8.0) ** 2 <= 1,
           'T')
    p.ellipse(12.5, 12.0, 11.5, 3.6, 'T')
    p.stroke(12.5, 19.0, 12.5, 23.0, 3.6, 'T')
    p.rows(['TTTTTTTTTTT'], 7, 23)
    water = Pic().ellipse(12.5, 12.0, 9.0, 2.2, 'D')
    over(p, water)
    p.rows(['..vvvv..', 'vv....vv'], 9, 11)
    p.rows(['.vv.'], 11, 12)
    p.rows(['uuuuuuu'], 9, 18)
    drop = Pic()
    flame(drop, 12.5, 0.5, 7.5, 2.6, layers='V', steps=[(0, 0, 0)])
    drop.put(12, 4, 'p')
    over(p, drop)
    return render(p)


def event_whisper():
    """속삭이는 그림자: a hooded shade, eyes burning violet, its hem fraying into smoke."""
    p = Pic()
    p.ellipse(12.5, 8.0, 7.2, 7.4, 'H')
    p.poly([(5.5, 8.0), (19.5, 8.0), (22.5, 21.0), (2.5, 21.0)], 'H')
    # ragged hem
    for x, y in [(3, 21), (4, 22), (7, 22), (8, 23), (12, 22), (13, 23), (16, 22), (17, 22),
                 (20, 22), (21, 23)]:
        p.put(x, y, 'H')
    for x in (5, 10, 15, 19):
        p.put(x, 21, '.')
        p.put(x, 20, '.')
    face = Pic().ellipse(12.5, 9.5, 4.3, 4.6, 'k')
    over(p, face, 'w')
    p.rows(['h...h', 'v...v'], 10, 9)
    p.rows(['w', 'w', 'w', 'w', 'w'], 12, 15)
    # whisper wisps
    p.rows(['..v', '.v.', 'v..'], 21, 4)
    p.rows(['v', '.v'], 23, 8)
    return render(p)


def event_forge():
    """버려진 대장간: an anvil, a hammer left lying on it, the last sparks."""
    p = Pic()
    p.poly([(0.5, 9.0), (9.0, 9.5), (9.0, 8.0), (23.5, 8.0), (23.5, 12.5), (19.0, 12.5),
            (16.5, 15.5), (16.5, 18.0), (20.5, 21.5), (20.5, 23.5), (4.5, 23.5), (4.5, 21.5),
            (8.5, 18.0), (8.5, 15.5), (7.0, 12.5), (5.0, 11.5)], 'T')
    p.rows(['u' * 11], 8, 12)
    hammer = Pic()
    hammer.stroke(2.0, 5.5, 15.0, 5.5, 2.0, 'W')
    hammer.rows(['SSSSSS'] * 5, 15, 3)
    over(p, hammer)
    for x, y, ch in [(22, 1, 'y'), (20, 0, 'o'), (23, 3, 'o'), (5, 2, 'o'), (7, 1, 'y')]:
        p.put(x, y, ch)
    return render(p)


def event_chandler():
    """양초장이의 작업실: tapers hung from a rod over a pot of melted wax."""
    p = Pic()
    p.stroke(1.0, 1.5, 24.0, 1.5, 2.0, 'W')
    for x, bottom in [(6, 11), (12, 13), (18, 10)]:
        p.put(x + 1, 3, 'k')
        p.rows(['XX'] * (bottom - 4), x, 4)
        p.put(x + 1, bottom, 'X')
    pot = Pic()
    pot.fill(lambda x, y: y >= 15.5 and ((x - 12.5) / 10.0) ** 2 + ((y - 15.5) / 8.4) ** 2 <= 1,
             'I')
    pot.ellipse(12.5, 15.5, 10.5, 2.4, 'I')
    pot.ellipse(12.5, 15.5, 8.2, 1.3, 'Y')
    pot.rows(['..o.....o.'], 7, 18)
    pot.rows(['II', '.I'], 1, 17)
    pot.rows(['II', 'I.'], 22, 17)
    over(p, pot)
    return render(p)


EVENTS = {
    'altar': event_altar,
    'corpse': event_corpse,
    'spring': event_spring,
    'whisper': event_whisper,
    'forge': event_forge,
    'chandler': event_chandler,
}


# --------------------------------------------------------------------------------------------
# Screen icons (screen headers in the room niche, the shop's card removal, the top bar's HP)
# --------------------------------------------------------------------------------------------


def ui_trophy():
    """전리품: a gilt two-handled cup on a stepped foot."""
    p = Pic()
    # handles: open loops on either side of the bowl
    p.fill(lambda x, y: x < 8.0 and 2.3 ** 2 <= (x - 5.0) ** 2 + (y - 7.0) ** 2 <= 4.0 ** 2, 'G')
    p.fill(lambda x, y: x > 17.0 and 2.3 ** 2 <= (x - 20.0) ** 2 + (y - 7.0) ** 2 <= 4.0 ** 2,
           'G')
    cup = Pic()
    cup.fill(lambda x, y: 2.0 <= y <= 8.0 and abs(x - 12.5) <= 7.6, 'G')
    cup.fill(lambda x, y: y >= 8.0 and ((x - 12.5) / 7.6) ** 2 + ((y - 8.0) / 6.4) ** 2 <= 1, 'G')
    cup.rows(['G' * 19], 3, 1)
    cup.rows(['n' * 17], 4, 3)
    cup.rows(['h', 'h', 'h', '.h'], 6, 5)
    over(p, cup)
    p.rows(['GGG'] * 3, 11, 15)
    p.rows(['.GGGGG.', 'GGGGGGG'], 9, 18)
    p.rows(['GGGGGGGGGGG', 'GGGGGGGGGGG', 'nnnnnnnnnnn'], 7, 20)
    p.rows(['nnnnnnn'], 9, 19)
    return render(p)


def ui_remove():
    """카드 제거: a card struck through with a blood-red X."""
    p = Pic()
    p.rows(['B' * 16] * 22, 3, 1)
    p.rows(['k' * 12] + ['k' + 'T' * 10 + 'k'] * 7 + ['k' * 12], 5, 3)
    p.rows(['uuuuuuuuuu'], 6, 4)
    p.rows(['pppppppppppp', '............', 'pppppppppp..', '............', 'pppppppppppp'],
           5, 14)
    x = Pic()
    x.stroke(9.0, 8.5, 22.5, 22.0, 3.0, 'R')
    x.stroke(22.5, 8.5, 9.0, 22.0, 3.0, 'R')
    over(p, x)
    return render(p)


def ui_crown():
    """승리: an untarnished gold crown, a ruby at its brow."""
    p = Pic()
    p.poly([(2.0, 16.0), (2.0, 5.0), (7.5, 11.0), (12.5, 3.0), (17.5, 11.0), (23.0, 5.0),
            (23.0, 16.0)], 'G')
    for cx, cy, r in [(2.5, 4.0, 1.7), (12.5, 2.2, 1.9), (22.5, 4.0, 1.7)]:
        p.disc(cx, cy, r, 'G')
    band = Pic().rows(['G' * 23] * 6, 1, 16)
    band.rows(['y' * 23], 1, 16)
    band.rows(['n' * 23], 1, 21)
    over(p, band)
    p.rows(['.rr.', 'rrrr', 'rrqr', '.qq.'], 11, 17)
    p.put(12, 17, 'h')
    for gx in (5, 19):
        p.rows(['bb', 'bk'], gx, 18)
    return render(p)


def ui_tombstone():
    """탐험 실패: a rounded headstone with a carved cross, sunk in a mound of earth."""
    p = Pic()
    p.fill(lambda x, y: abs(x - 12.5) <= 7.6 and (y >= 8.5 or
                                                    (x - 12.5) ** 2 + (y - 8.5) ** 2 <= 7.6 ** 2)
           and y <= 21.0, 'T')
    # carved cross: a d0 groove whose lower / right wall catches the light
    for y in range(4, 14):
        p.put(12, y, 'k')
        p.put(13, y, 'p')
    p.rows(['kkkkkkk', 'ppppppp'], 9, 7)
    p.put(12, 8, 'k')
    # a crack down the lower right
    p.rows(['u.', '.u', 'u.', 'u.'], 16, 14)
    mound = Pic()
    mound.fill(lambda x, y: y >= 19.0 and ((x - 12.5) / 12.0) ** 2 + ((y - 23.5) / 4.6) ** 2 <= 1,
               'W')
    over(p, mound)
    for x, y in [(3, 21), (6, 19), (20, 19), (22, 21)]:
        p.put(x, y, 'x')
    return render(p)


def ui_heart():
    """체력: a heart of blood red, a glint on its upper left."""
    p = Pic()
    p.disc(8.0, 9.0, 5.8, 'R')
    p.disc(17.0, 9.0, 5.8, 'R')
    p.poly([(2.2, 10.5), (22.8, 10.5), (12.5, 22.5)], 'R')
    p.fill(lambda x, y: 8.0 < y < 14.0 and abs(x - 12.5) < 10.3 - (y - 8.0) * 0.2, 'R')
    p.rows(['.hh', 'h..', 'h..'], 5, 6)
    return render(p)


SCREENS = {
    'trophy': ui_trophy,
    'remove': ui_remove,
    'crown': ui_crown,
    'tombstone': ui_tombstone,
    'heart': ui_heart,
}


def all_icons():
    """[(group, id, 32x32 key grid)] for every icon, in sheet order."""
    out = []
    for group, table in (('node', NODES), ('relic', RELICS), ('event', EVENTS),
                         ('ui', SCREENS)):
        for k, fn in table.items():
            out.append((group, k, fn()))
    return out


def to_rgba(grid) -> np.ndarray:
    a = np.zeros((SIZE, SIZE, 4), np.uint8)
    for y in range(SIZE):
        for x in range(SIZE):
            if grid[y][x]:
                a[y, x, :3] = PAL[grid[y][x]]
                a[y, x, 3] = 255
    return a


def preview(path: str):
    icons = all_icons()
    bgs = [(72, 64, 80), (0x7d, 0x4a, 0x44), (0x5b, 0x6a, 0x8a), (0x16, 0x14, 0x1a)]
    cols = 8
    cell = 34
    rows_n = math.ceil(len(icons) / cols)
    sheet = np.zeros((rows_n * cell * len(bgs), cols * cell, 3), np.uint8)
    for b, bg in enumerate(bgs):
        for i, (_, _, g) in enumerate(icons):
            x0 = (i % cols) * cell
            y0 = (b * rows_n + i // cols) * cell
            sheet[y0:y0 + cell, x0:x0 + cell] = bg
            rgba = to_rgba(g)
            al = rgba[..., 3:4] > 0
            tile = sheet[y0 + 1:y0 + 33, x0 + 1:x0 + 33]
            sheet[y0 + 1:y0 + 33, x0 + 1:x0 + 33] = np.where(al, rgba[..., :3], tile)
    im = Image.fromarray(sheet, 'RGB')
    k = int(os.environ.get('ZOOM', 4))
    im.resize((im.width * k, im.height * k), Image.NEAREST).save(path)
    print(f'{len(icons)} icons -> {path}')


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'build', 'uikit',
                                                             'preview-icons.png')
    preview(out)
