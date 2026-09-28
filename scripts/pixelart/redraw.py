"""Hand-built pixel art for the assets whose Gemini version could not be used as-is:

- light_resonance(): the Gemini sunburst had 12 hairline spikes and an olive shadow; redrawn as
  a chunky six-ray spark in gold with violet shade, at the same 32px grid and 1px outline as
  the rest of the icon set.
- rat() / bat(): the Gemini rat and bat were boss-grade (snarling close-ups, warm browns,
  pink ears, acid-green eyes). These are the weakest Act-1 mobs, so they are redrawn as small,
  scrawny full-body critters on the portrait grid, in the locked palette only.
- split_keyart(): widens the candle-in-archway key art to 16:9 for the menu backdrop and lifts
  the candle out as its own sprite.

Everything is drawn on the final grid with a tiny shape toolkit: filled parts, an automatic
1px outline and a top-left light bevel, the same shading language as the Gemini sprites.
"""

from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from pxlib import PAL, PALETTE, dilate, quantize, remove_checker  # noqa: F401


class Canvas:
    """A small indexed-colour canvas: parts are painted as masks with a colour ramp."""

    def __init__(self, n_w: int, n_h: int | None = None):
        self.w, self.h = n_w, n_h or n_w
        self.rgb = np.zeros((self.h, self.w, 3), np.uint8)
        self.a = np.zeros((self.h, self.w), bool)

    # --- mask builders (no anti-aliasing) --------------------------------------------------
    def _mask(self, draw_fn) -> np.ndarray:
        im = Image.new('1', (self.w, self.h), 0)
        draw_fn(ImageDraw.Draw(im))
        return np.asarray(im, bool)

    def ellipse(self, x0, y0, x1, y1):
        return self._mask(lambda d: d.ellipse([x0, y0, x1, y1], fill=1))

    def poly(self, pts):
        return self._mask(lambda d: d.polygon([tuple(p) for p in pts], fill=1))

    def line(self, pts, width=1):
        return self._mask(lambda d: d.line([tuple(p) for p in pts], fill=1, width=width))

    def rect(self, x0, y0, x1, y1):
        return self._mask(lambda d: d.rectangle([x0, y0, x1, y1], fill=1))

    # --- painting ---------------------------------------------------------------------------
    def fill(self, m, key):
        self.rgb[m] = PAL[key]
        self.a |= m

    def shade(self, m, base, light=None, dark=None, depth=1):
        """Fill `m` with `base`, a top-left rim in `light` and a bottom-right rim in `dark`."""
        self.fill(m, base)
        if dark:
            edge = np.zeros_like(m)
            for k in range(1, depth + 1):
                sh = np.zeros_like(m)
                sh[:-k, :-k] = m[k:, k:]
                edge |= m & ~sh  # pixels whose lower-right neighbour leaves the part
                sh2 = np.zeros_like(m)
                sh2[:-k, :] = m[k:, :]
                edge |= m & ~sh2
            self.rgb[edge] = PAL[dark]
        if light:
            edge = np.zeros_like(m)
            sh = np.zeros_like(m)
            sh[1:, 1:] = m[:-1, :-1]
            edge |= m & ~sh
            sh2 = np.zeros_like(m)
            sh2[1:, :] = m[:-1, :]
            edge |= m & ~sh2
            self.rgb[edge] = PAL[light]

    def px(self, x, y, key):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.rgb[y, x] = PAL[key]
            self.a[y, x] = True

    def outline(self, key='d0'):
        """1px outline around everything painted so far (4-connected)."""
        ring = dilate(self.a, 1) & ~self.a
        self.rgb[ring] = PAL[key]
        self.a |= ring

    def result(self):
        return self.rgb.copy(), self.a.copy()


# --------------------------------------------------------------------------------------------
# Light resonance icon
# --------------------------------------------------------------------------------------------


def light_resonance():
    """Six thick rays (vertical + four at 2:1 slopes, which stay clean on a pixel grid) around
    a round core. Gold #f3d27a / #d8b76e, shade only in violet #8e6bc4, outline #1a1024."""
    n = 32
    c = Canvas(n)
    cx, cy = 15.5, 15.5
    rays = np.zeros((n, n), bool)
    for ang_deg, length in ((90, 13.5), (270, 13.5), (30, 12.0), (150, 12.0), (210, 12.0),
                            (330, 12.0)):
        a = math.radians(ang_deg)
        tip = (cx + math.cos(a) * length, cy - math.sin(a) * length)
        half = 3.1
        base_r = 5.0
        px_, py_ = -math.sin(a), -math.cos(a)  # perpendicular (screen coords)
        b = (cx + math.cos(a) * base_r, cy - math.sin(a) * base_r)
        pts = [(b[0] + px_ * half, b[1] + py_ * half), tip, (b[0] - px_ * half, b[1] - py_ * half),
               (cx, cy)]
        rays |= c.poly(pts)
    core = c.ellipse(cx - 6.2, cy - 6.2, cx + 6.2, cy + 6.2)
    # rays: gold with a violet lower-right edge
    c.shade(rays & ~core, 'g1', light='g3', dark='v1')
    # core: bright face, gold rim on the shadow side, a single highlight glint
    c.shade(core, 'g3', dark='g1')
    inner = c.ellipse(cx - 3.2, cy - 3.2, cx + 3.2, cy + 3.2)
    c.fill(inner & ~c.ellipse(cx - 1.2, cy - 1.2, cx + 3.2, cy + 3.2), 'g3')
    c.px(13, 12, 'hi')
    c.px(12, 13, 'hi')
    c.px(13, 13, 'hi')
    c.outline('v0')
    return c.result()


# --------------------------------------------------------------------------------------------
# Rat and bat (portrait grid)
# --------------------------------------------------------------------------------------------


def rat(n: int = 52):
    """굶주린 쥐: a scrawny, hunched grey rat in profile, small in the frame, beady eye and
    closed mouth. Grey fur (#5a5162 / #948b80 / #3b3542), pink bits in dusty red #b86a6a."""
    c = Canvas(n)
    # tail first so the body overlaps its root: a long thin curl to the right
    tail = c.line([(35, 44), (40, 45), (44, 44), (47, 41), (47, 37), (45, 35)], width=1)
    c.fill(tail, 'dr')
    # hunched, bony body (arched back, thin belly)
    body = c.poly([(17, 44), (18, 36), (22, 30), (28, 28), (33, 29), (37, 33), (38, 39),
                   (37, 44)])
    c.shade(body, 's2', light='p1', dark='s1')
    # starving: a few ribs showing on the flank
    for x in (23, 26, 29):
        c.fill(c.line([(x, 35), (x + 1, 39)]), 's1')
    # hind leg / haunch
    haunch = c.ellipse(29, 36, 37, 44)
    c.shade(haunch, 's2', light='p0', dark='s1')
    # ear: round, pink inside, tucked behind the head
    ear = c.ellipse(17, 22, 23, 28)
    c.shade(ear, 's2', light='p1', dark='s1')
    c.fill(c.ellipse(18, 23, 21, 26), 'dr')
    # head: small, pointed snout to the left
    head = c.poly([(8, 34), (11, 30), (15, 27), (20, 27), (22, 30), (21, 35), (16, 37), (11, 37)])
    c.shade(head, 's2', light='p1', dark='s1')
    snout = c.poly([(5, 35), (9, 32), (11, 34), (10, 37), (7, 37)])
    c.shade(snout, 'p0', light='p1')
    # front paws and hind foot
    for m in (c.rect(12, 43, 14, 44), c.rect(18, 43, 20, 44), c.rect(34, 43, 37, 44)):
        c.fill(m, 'dr')
    c.outline('d0')
    # details drawn over the outline pass
    c.px(5, 35, 'dr')          # nose
    c.px(14, 30, 'd0')         # beady eye with a glint
    c.px(15, 30, 'd0')
    c.px(14, 31, 'd0')
    c.px(15, 31, 'd0')
    c.px(14, 30, 'hi')
    for x, y in ((6, 32), (5, 31), (4, 30), (7, 38), (5, 39)):  # whiskers
        c.px(x, y, 'p1')
    return c.result()


def bat(n: int = 52):
    """동굴 박쥐: a small round bat, wings spread, big ears, tiny fangs and two gold eye glints.
    Stone-grey fur, dark violet-grey membranes with lighter finger bones."""
    c = Canvas(n)
    cx = 26

    def mirror(pts):
        return [(2 * cx - x, y) for x, y in pts]

    wing_l = [(22, 25), (16, 19), (9, 16), (4, 18), (6, 23), (9, 22), (10, 28), (14, 25),
              (16, 31), (20, 28), (23, 32)]
    for pts in (wing_l, mirror(wing_l)):
        w = c.poly(pts)
        c.shade(w, 's1', light='s2', dark='s0')
    # finger bones
    for bone in ([(22, 25), (9, 16)], [(21, 26), (9, 22)], [(21, 27), (14, 25)],
                 [(22, 28), (20, 28)]):
        for pts in (bone, mirror(bone)):
            c.fill(c.line(pts), 's2')
    # body and head
    body = c.ellipse(cx - 5, 22, cx + 5, 36)
    c.shade(body, 's2', light='p0', dark='s1')
    c.fill(c.ellipse(cx - 3, 27, cx + 3, 34), 'p0')  # lighter chest fur
    head = c.ellipse(cx - 5, 15, cx + 5, 25)
    c.shade(head, 's2', light='p1', dark='s1')
    ear_l = [(cx - 5, 18), (cx - 6, 10), (cx - 1, 16)]
    for pts in (ear_l, mirror(ear_l)):
        c.shade(c.poly(pts), 's2', light='p1', dark='s1')
    # feet
    c.fill(c.rect(cx - 3, 37, cx - 2, 38), 'p1')
    c.fill(c.rect(cx + 2, 37, cx + 3, 38), 'p1')
    c.outline('d0')
    # face details
    for x in (cx - 3, cx + 2):
        c.px(x, 19, 'd0')
        c.px(x + 1, 19, 'g2')
    c.px(cx, 21, 'dr')                               # snout
    c.px(cx - 1, 23, 'd0')                           # mouth
    c.px(cx, 23, 'd0')
    c.px(cx + 1, 23, 'd0')
    c.px(cx - 1, 24, 'p2')                           # tiny fangs
    c.px(cx + 1, 24, 'p2')
    for pts in ([(cx - 4, 13), (cx - 3, 15)], [(cx + 4, 13), (cx + 3, 15)]):  # inner ears
        for x, y in pts:
            c.px(x, y, 's1')
    return c.result()


# --------------------------------------------------------------------------------------------
# Key art
# --------------------------------------------------------------------------------------------


def split_keyart(rgb):
    raise NotImplementedError


def keyart_candle_grid(rgb, a):
    raise NotImplementedError
