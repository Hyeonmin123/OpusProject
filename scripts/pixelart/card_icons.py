"""Card icons: one hand-built pixel drawing per card, depicting what the card does, on the same
32px grid and with the same rules as the map-node, relic, event and screen icons in icons.py
(character maps on a 26px canvas, lowercase = fixed palette colours, uppercase = materials lit
from the upper left with ordered-dither shade, a hard 1px d0 outline, the locked palette only).

They join the "Icons" page of the Figma pixel UI kit through icons.all_icons() (group 'card'),
so `uikit.py seed` / `import` / `check` round-trip them like the others, into
src/assets/cards/<card id>.png (@4x). `python3 scripts/pixelart/card_icons.py` writes a preview
sheet (build/uikit/preview-card-icons.png) for iterating on the drawings.

A card shows its icon in the art well at 32px (the grid 1:1; 64px on the 2x reward cards), so
every drawing keeps to a bold silhouette with one or two clear details.
"""

from __future__ import annotations

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from icons import Pic, flames, flame, candle_flame, over, render, sym  # noqa: E402

# --------------------------------------------------------------------------------------------
# Shared parts
# --------------------------------------------------------------------------------------------


def sword(p: Pic, hx, hy, tx, ty, blade=3.0, mat='S', guard='G', grip='W', guard_len=4.2,
          pommel=True):
    """A straight sword from its hilt (hx, hy: where blade meets guard) to its tip."""
    dx, dy = tx - hx, ty - hy
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    # blade, tapering to a point
    bx, by = tx - ux * 1.6, ty - uy * 1.6
    p.stroke(hx, hy, bx, by, blade, mat)
    p.stroke(bx, by, tx, ty, max(1.0, blade - 1.8), mat)
    # guard, across the blade
    px_, py_ = -uy, ux
    p.stroke(hx - px_ * guard_len, hy - py_ * guard_len, hx + px_ * guard_len,
             hy + py_ * guard_len, 2.2, guard)
    # grip and pommel
    gx, gy = hx - ux * 3.6, hy - uy * 3.6
    p.stroke(hx - ux * 0.8, hy - uy * 0.8, gx, gy, 1.8, grip)
    if pommel:
        p.disc(gx - ux * 1.0, gy - uy * 1.0, 1.5, guard)
    return p


def heater(p: Pic, cx, top, w, h, ch):
    """Heater shield: flat top, straight sides, curving to a point at the bottom."""
    half = w / 2

    def t(x, y):
        if not (top <= y <= top + h):
            return False
        v = (y - top) / h
        if v < 0.45:
            return abs(x - cx) <= half
        k = (v - 0.45) / 0.55
        return abs(x - cx) <= half * math.sqrt(max(0.0, 1 - k * k))
    return p.fill(t, ch)


def burst(p: Pic, cx, cy, r0, r1, n=8, ch='y', core='h', rot=0.0):
    """Impact star: n spikes from r0 to r1 around a bright core."""
    for i in range(n):
        a = rot + i * 2 * math.pi / n
        rr = r1 if i % 2 == 0 else (r0 + r1) / 2
        p.stroke(cx, cy, cx + rr * math.cos(a), cy + rr * math.sin(a), 1.4, ch)
    p.disc(cx, cy, r0, ch)
    p.disc(cx, cy, max(0.6, r0 - 1.2), core)
    return p


def arc(p: Pic, cx, cy, r, width, a0, a1, ch, taper=True):
    """A crescent swoosh along a circle from angle a0 to a1 (degrees, y down), thickest in the
    middle when `taper`."""
    def t(x, y):
        a = math.degrees(math.atan2(y - cy, x - cx)) % 360
        lo, hi = a0 % 360, a1 % 360
        inside = lo <= a <= hi if lo <= hi else (a >= lo or a <= hi)
        if not inside:
            return False
        span = (hi - lo) % 360 or 360
        u = ((a - lo) % 360) / span
        w = width * (math.sin(math.pi * u) if taper else 1.0)
        return abs(math.hypot(x - cx, y - cy) - r) <= w / 2
    return p.fill(t, ch)


def slash(p: Pic, x0, y0, x1, y1, width, ch):
    """A straight cut, tapering to a point at both ends and thickest in the middle."""
    dx, dy = x1 - x0, y1 - y0
    ll = dx * dx + dy * dy

    def t(x, y):
        u = ((x - x0) * dx + (y - y0) * dy) / ll
        if not 0.0 <= u <= 1.0:
            return False
        px_, py_ = x0 + u * dx, y0 + u * dy
        return math.hypot(x - px_, y - py_) <= width / 2 * math.sin(math.pi * u)
    return p.fill(t, ch)


def fist(p: Pic, x0, y0, mat='S', cuff='N'):
    """A gauntleted fist seen from the front, knuckles up, thumb folded across the fingers,
    over a cuff: 14 x 13 from (x0, y0)."""
    rows = [
        '.MMM.MMM.MMM..',
        'MMMMkMMMkMMMM.',
        'MMMMkMMMkMMMkM',
        'MMMMkMMMkMMMkM',
        'MMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMM',
        'kkkkkkkkkMMMMM',
        'NNNNNNNNNkMMMM',
        '.NNNNNNNNkMMM.',
        '..kkkkkkkkkk..',
        '..CCCCCCCCCC..',
        '..CCCCCCCCCC..',
        '..CCCCCCCCCC..',
    ]
    # the thumb is a region of its own, split off the fingers by its d0 line
    p.rows([r.replace('M', mat).replace('N', mat).replace('C', cuff) for r in rows], x0, y0)
    return p


def drop(p: Pic, cx, top, h, ch='R', glint=True):
    """A falling drop, point up."""
    flame(p, cx, top, top + h, h * 0.36, layers=ch, steps=[(0, 0, 0)])
    if glint:
        p.put(int(cx - 1), int(top + h * 0.6), 'h')
    return p


# --------------------------------------------------------------------------------------------
# Starter
# --------------------------------------------------------------------------------------------


def card_strike():
    """타격: one sword slashing down to the right, a swoosh behind its edge."""
    p = Pic()
    arc(p, 3.0, 3.0, 21.0, 3.6, 12, 80, 'p')
    blade = Pic()
    sword(blade, 8.0, 17.0, 22.5, 2.5)
    over(p, blade)
    return render(p)


def card_defend():
    """수비: a raised heater shield, steel-blue field, a gilt boss on a steel cross."""
    p = Pic()
    heater(p, 12.5, 1.0, 20.0, 24.0, 'S')
    field = Pic()
    heater(field, 12.5, 3.0, 16.0, 20.0, 'L')
    over(p, field, 'u')
    p.rows(['ss'] * 18, 12, 4)
    p.rows(['s' * 14], 6, 10)
    p.disc(12.5, 10.5, 2.4, 'G')
    p.put(11, 9, 'y')
    return render(p)


def card_bash():
    """강타: a flanged iron mace landing with a burst of sparks."""
    p = Pic()
    burst(p, 17.5, 7.5, 3.4, 8.0, n=8, ch='o', core='y', rot=0.4)
    mace = Pic()
    mace.stroke(3.0, 23.0, 13.0, 12.0, 2.4, 'W')
    mace.disc(14.5, 10.5, 4.4, 'S')
    for a in range(0, 360, 60):
        r = math.radians(a + 15)
        mace.stroke(14.5, 10.5, 14.5 + 6.2 * math.cos(r), 10.5 + 6.2 * math.sin(r), 1.6, 'S')
    mace.disc(3.0, 23.0, 1.5, 'S')
    mace.rows(['h', '.'], 13, 8)
    over(p, mace)
    return render(p)


def card_iron_wave():
    """무쇠 파동: a sword thrust out past a round iron shield: attack and guard at once."""
    p = Pic()
    p.disc(9.5, 15.5, 8.6, 'S')
    p.disc(9.5, 15.5, 6.8, 'I')
    p.ring(9.5, 15.5, 4.0, 4.8, 'u')
    p.disc(9.5, 15.5, 2.0, 'S')
    blade = Pic()
    sword(blade, 12.0, 13.0, 24.0, 1.0, blade=3.0)
    over(p, blade)
    return render(p)


# --------------------------------------------------------------------------------------------
# Common
# --------------------------------------------------------------------------------------------


def card_cleave():
    """휩쓸기: a broad axe at the end of a wide sweeping arc."""
    p = Pic()
    arc(p, 12.5, 16.0, 10.5, 3.6, 190, 350, 'p')
    axe = Pic()
    axe.stroke(5.0, 24.0, 17.0, 8.0, 2.2, 'W')
    axe.poly([(13.5, 7.0), (19.0, 1.0), (24.5, 8.5), (20.5, 13.5)], 'S')
    axe.fill(lambda x, y: (x - 24.0) ** 2 + (y - 12.0) ** 2 <= 6.0 ** 2 and y < 13.0
             and x > 18.0 and y > 2.0 and (x - 17.0) + (y - 8.0) * 0.2 > 1.0, 'S')
    over(p, axe)
    return render(p)


def card_twin_strike():
    """연속 베기: two parallel slashes cut through the air, blood at their ends."""
    p = Pic()
    for off in (-3.5, 3.5):
        arc(p, 2.0 - off, 25.0 + off, 19.0, 3.6, 272, 358, 'h')
    for x, y in [(5, 20), (13, 22), (4, 23)]:
        p.put(x, y, 'r')
    p.rows(['.r', 'rq'], 20, 8)
    return render(p)


def card_body_slam():
    """몸통 박치기: a round shield driven edge-first into a burst of impact."""
    p = Pic()
    burst(p, 19.0, 12.5, 3.0, 7.5, n=10, ch='y', core='h')
    shield = Pic()
    shield.ellipse(10.0, 12.5, 6.0, 10.0, 'L')
    shield.ring(10.0, 12.5, 0, 0, 'L')
    over(p, shield)
    rim = Pic().ellipse(10.0, 12.5, 6.0, 10.0, 'S')
    inner = Pic().ellipse(10.5, 12.5, 4.0, 8.0, 'L')
    over(rim, inner, 'u')
    rim.disc(10.5, 12.5, 1.6, 'G')
    over(p, rim)
    for y in (6, 12, 18):
        p.rows(['pp.p'], 0, y)
    return render(p)


def card_clothesline():
    """목조르기: a hangman's loop of rope, knotted, its tail hanging free."""
    p = Pic()
    p.ring(12.5, 9.0, 4.4, 7.6, 'W')
    p.rows(['WWWWW'] * 7, 10, 15)
    p.stroke(12.5, 20.0, 15.0, 24.5, 2.6, 'W')
    # knot wraps
    for y in (16, 18, 20):
        p.rows(['kkkkk'], 10, y)
    # twist of the strands along the loop
    for a in range(0, 360, 40):
        r = math.radians(a)
        p.put(int(12.5 + 6.0 * math.cos(r)), int(9.0 + 6.0 * math.sin(r)), 'q')
    return render(p)


def card_pommel_strike():
    """자루 치기: a sword turned about, its pommel knocking into a starburst."""
    p = Pic()
    burst(p, 5.0, 19.5, 2.6, 6.0, n=8, ch='y', core='h', rot=0.2)
    blade = Pic()
    sword(blade, 13.0, 11.0, 23.5, 0.5, blade=2.8, guard_len=3.8)
    blade.disc(7.0, 17.0, 2.4, 'G')
    over(p, blade)
    return render(p)


def card_shrug_it_off():
    """털어내기: an arrow snapping as it glances off a steel-blue shield."""
    p = Pic()
    shield = Pic()
    heater(shield, 10.5, 3.0, 17.0, 21.0, 'S')
    field = Pic()
    heater(field, 10.5, 5.0, 13.0, 17.0, 'L')
    over(shield, field, 'u')
    shield.put(8, 7, 'h')
    arrow = Pic()
    arrow.stroke(15.0, 7.0, 24.0, 1.0, 1.6, 'W')
    arrow.rows(['.S', 'SS'], 13, 7)
    arrow.rows(['z.z', '.z.'], 22, 0)
    over(shield, arrow)
    tail = Pic()
    tail.stroke(18.0, 13.0, 24.0, 20.0, 1.6, 'W')
    tail.rows(['z.', 'zz'], 23, 20)
    over(shield, tail)
    for x, y in [(16, 10), (19, 9), (17, 12)]:
        shield.put(x, y, 'y')
    return render(shield)


# --------------------------------------------------------------------------------------------
# Uncommon
# --------------------------------------------------------------------------------------------


def card_uppercut():
    """올려치기: a gauntleted fist driving upward, speed lines under it."""
    p = Pic()
    fist(p, 6, 0)
    for x, y0, h in [(2, 8, 8), (23, 8, 8), (5, 16, 6), (20, 16, 6), (12, 20, 5)]:
        for y in range(y0, y0 + h):
            p.put(x, y, 'p')
    return render(p)


def card_bloodletting():
    """사혈: a thin dagger, blood running off its edge in drops."""
    p = Pic()
    sword(p, 9.0, 12.0, 21.5, 0.5, blade=2.4, guard_len=3.2, mat='S')
    p.stroke(15.0, 7.0, 20.5, 1.8, 1.0, 'r')
    drop(p, 16.0, 11.0, 6.0)
    drop(p, 20.0, 15.0, 7.0)
    drop(p, 13.0, 18.0, 6.0)
    return render(p)


def card_battle_trance():
    """전투 몰입: three cards fanned out in the hand."""
    p = Pic()
    for ang, ch in ((-24, 'B'), (0, 'B'), (24, 'B')):
        q = Pic()
        a = math.radians(ang)
        cx, cy = 12.5 + 7.0 * math.sin(a), 13.0 - 2.0 * math.cos(a) + 2.0
        w, h = 4.6, 7.4
        pts = []
        for sx, sy in ((-w, -h), (w, -h), (w, h), (-w, h)):
            pts.append((cx + sx * math.cos(a) - sy * math.sin(a),
                        cy + sx * math.sin(a) + sy * math.cos(a)))
        q.poly(pts, ch)
        # the card back's gilt lozenge
        q.put(int(cx), int(cy), 'o')
        q.put(int(cx), int(cy) - 1, 'y')
        q.put(int(cx) - 1, int(cy), 'y')
        q.put(int(cx) + 1, int(cy), 'n')
        q.put(int(cx), int(cy) + 1, 'n')
        over(p, q)
    return render(p)


def card_intimidate():
    """위협: a horned steel helm, eyes burning red in its slit."""
    half = [
        'B...........',
        'BB..........',
        '.BB.........',
        '.BBB........',
        '..BBB..SSSSS',
        '...BBSSSSSSS',
        '....SSSSSSSS',
        '...SSSSSSSSS',
        '...SSSSSSSSS',
        '..SSSSSSSSSS',
        '..SSSSSSSSSu',
        '..SSkkkkkkkk',
        '..SSkrrkkkkk',
        '..SSkkkkkkkk',
        '..SSSSSSSSSu',
        '..SSSSSSSSSu',
        '..SSSSSSkSSu',
        '..SSSSSSkSSu',
        '..SSSSSSkSSu',
        '...SSSSSkSSu',
        '....SSSSSSSu',
    ]
    p = Pic().rows(sym(half), center=True)
    return render(p)


def card_entrench():
    """참호: a stone rampart, crenellated, built up in courses."""
    rows = [
        'TTTT..TTTT..TTTT..TTTT',
        'TTTT..TTTT..TTTT..TTTT',
        'TTTT..TTTT..TTTT..TTTT',
        'TTTTTTTTTTTTTTTTTTTTTT',
        'kkkkkkkkkkkkkkkkkkkkkk',
        'TTTTTTkTTTTTTkTTTTTTTT',
        'TTTTTTkTTTTTTkTTTTTTTT',
        'TTTTTTkTTTTTTkTTTTTTTT',
        'kkkkkkkkkkkkkkkkkkkkkk',
        'TTTkTTTTTTkTTTTTTkTTTT',
        'TTTkTTTTTTkTTTTTTkTTTT',
        'TTTkTTTTTTkTTTTTTkTTTT',
        'kkkkkkkkkkkkkkkkkkkkkk',
        'TTTTTTkTTTTTTkTTTTTTTT',
        'TTTTTTkTTTTTTkTTTTTTTT',
        'TTTTTTkTTTTTTkTTTTTTTT',
    ]
    p = Pic().rows(rows, 2, 5)
    # a shield hung on the wall
    s = Pic()
    heater(s, 12.5, 7.0, 8.0, 11.0, 'L')
    s.rows(['yy'], 12, 10)
    over(p, s)
    return render(p)


def card_inflame():
    """분노 점화: a clenched fist wreathed in fire."""
    p = Pic()
    flames(p, [(12.5, 0.0, 22.0, 9.0, 0.0), (5.0, 5.0, 22.0, 4.2, -2.4),
               (20.0, 5.0, 22.0, 4.2, 2.4)])
    f = Pic()
    fist(f, 6, 10, 'S')
    over(p, f)
    return render(p)


def card_metallicize():
    """금속화: a square plate of riveted iron, bands of sheen across it."""
    p = Pic()
    p.rows(['S' * 20] * 9, 3, 3)
    p.rows(['k' * 20], 3, 12)
    p.rows(['S' * 20] * 10, 3, 13)
    for x, y in [(5, 5), (19, 5), (5, 19), (19, 19), (12, 5), (12, 19)]:
        p.rows(['hp', 'pu'], x, y)
    p.rows(['..h', '.h.', 'h..'], 8, 6)
    p.rows(['..h', '.h.', 'h..'], 14, 15)
    return render(p)


def card_thorn_armor():
    """가시 갑옷: a steel breastplate bristling with iron spikes along its edges."""
    p = Pic()
    for (bx, by, tx, ty) in [(6.0, 5.0, 1.0, 1.0), (19.0, 5.0, 24.0, 1.0), (4.5, 11.0, -0.5, 10.0),
                             (20.5, 11.0, 25.5, 10.0), (5.5, 17.0, 1.0, 19.5),
                             (19.5, 17.0, 24.0, 19.5), (12.5, 4.0, 12.5, -0.5)]:
        nx, ny = ty - by, bx - tx
        ln = math.hypot(nx, ny)
        nx, ny = nx / ln * 2.0, ny / ln * 2.0
        p.poly([(bx + nx, by + ny), (bx - nx, by - ny), (tx, ty)], 'I')
    plate = Pic()
    plate.poly([(4.0, 4.0), (9.0, 3.0), (12.5, 6.0), (16.0, 3.0), (21.0, 4.0), (21.0, 12.0),
                (18.5, 21.0), (12.5, 24.0), (6.5, 21.0), (4.0, 12.0)], 'S')
    plate.stroke(12.5, 8.0, 12.5, 22.0, 1.0, 'u')
    plate.rows(['uuuuuuuuuuu'], 7, 15)
    plate.rows(['h', 'h', '.h'], 7, 6)
    over(p, plate)
    return render(p)


# --------------------------------------------------------------------------------------------
# Rare
# --------------------------------------------------------------------------------------------


def card_bludgeon():
    """분쇄: a massive iron warhammer, its head the size of an anvil."""
    p = Pic()
    p.stroke(2.5, 24.0, 15.0, 11.5, 2.6, 'W')
    p.disc(2.5, 24.0, 1.4, 'I')
    head = Pic()
    head.poly([(8.0, 7.5), (16.5, -1.0), (26.0, 8.5), (17.5, 17.0)], 'S')
    head.stroke(12.2, 3.2, 21.8, 12.8, 1.0, 'u')
    head.rows(['h'], 16, 1)
    over(p, head)
    return render(p)


def card_demon_form():
    """악마의 형상: a blood-red demon's head, bone horns curling, eyes of fire."""
    half = [
        'B............',
        'BB...........',
        'BBB..........',
        '.BBB.........',
        '.BBBB........',
        '..BBBB..RRRRR',
        '...BBBRRRRRRR',
        '....RRRRRRRRR',
        '...RRRRRRRRRR',
        '...RRRRRRRRRR',
        '..RRRRRRRRRRR',
        '..RRRkkkRRRRR',
        '..RRRkyykRRRR',
        '..RRRRkkRRRRR',
        '...RRRRRRRRRR',
        '...RRRRRRRRkk',
        '....RRRRRRkhk',
        '....RRRRRRkkk',
        '.....RRRRRRRR',
        '......RRRRRRR',
        '........RRRRR',
    ]
    return render(Pic().rows(sym(half, odd=True), center=True))


def card_impervious():
    """불굴: a great tower shield rimmed in gold, a gilt sunburst on its face."""
    p = Pic()
    p.fill(lambda x, y: abs(x - 12.5) <= 9.5 and 1.0 <= y <= 24.5
           and (y >= 5.0 or (x - 12.5) ** 2 / 9.5 ** 2 + (y - 5.0) ** 2 / 4.0 ** 2 <= 1), 'G')
    face = Pic()
    face.fill(lambda x, y: abs(x - 12.5) <= 7.0 and 3.5 <= y <= 22.5
              and (y >= 6.0 or (x - 12.5) ** 2 / 7.0 ** 2 + (y - 6.0) ** 2 / 2.5 ** 2 <= 1),
              'S')
    over(p, face, 'n')
    burst(p, 12.5, 12.5, 2.4, 5.2, n=8, ch='o', core='y')
    return render(p)


# --------------------------------------------------------------------------------------------
# Light (빛)
# --------------------------------------------------------------------------------------------


def card_ember_strike():
    """불씨 베기: a sword whose edge has caught fire."""
    p = Pic()
    flames(p, [(17.0, 0.0, 13.5, 4.0, 2.0), (11.5, 5.0, 17.0, 3.2, 1.0)], layers='roy')
    blade = Pic()
    sword(blade, 7.0, 18.0, 21.5, 3.5)
    over(p, blade)
    for x, y in [(22, 10), (20, 14), (4, 8)]:
        p.put(x, y, 'o')
    return render(p)


def card_warding_flame():
    """수호의 불꽃: a steel-blue shield bearing a burning flame."""
    p = Pic()
    heater(p, 12.5, 1.0, 20.0, 24.0, 'S')
    field = Pic()
    heater(field, 12.5, 3.0, 16.0, 20.0, 'L')
    over(p, field, 'u')
    fire = Pic()
    flame(fire, 12.5, 4.0, 18.0, 4.6, layers='roYh')
    over(p, fire, 'k')
    return render(p)


def card_tend_the_wick():
    """심지 다듬기: shears trimming a candle's wick, its flame standing up clean."""
    p = Pic()
    p.rows(['XXXXXXX'] * 13, 4, 12)
    p.rows(['.p', 'p.'], 9, 13)
    p.put(7, 11, 'k')
    p.put(7, 10, 'k')
    candle_flame(p, 7, 9, 'roh')
    shears = Pic()
    shears.stroke(11.0, 7.0, 20.0, 14.0, 1.6, 'S')
    shears.stroke(11.0, 10.0, 20.0, 5.0, 1.6, 'S')
    shears.ring(21.5, 15.5, 0.8, 2.3, 'S')
    shears.ring(21.5, 3.5, 0.8, 2.3, 'S')
    shears.put(15, 9, 'G')
    over(p, shears)
    return render(p)


def card_radiant_blow():
    """광휘의 일격: a gilt war hammer swung out of a burst of light."""
    p = Pic()
    for i in range(12):
        a = i * math.pi / 6 + 0.26
        r = 12.0 if i % 2 == 0 else 8.5
        p.stroke(15.0, 10.0, 15.0 + r * math.cos(a), 10.0 + r * math.sin(a), 1.4, 'y')
    p.disc(15.0, 10.0, 5.0, 'Y')
    ham = Pic()
    ham.stroke(3.0, 24.0, 13.0, 13.0, 2.4, 'W')
    ham.poly([(8.5, 11.0), (14.0, 5.5), (19.5, 11.0), (14.0, 16.5)], 'G')
    ham.rows(['h'], 13, 7)
    over(p, ham)
    return render(p)


def card_sanctuary_lamp():
    """성역의 등불: a bronze oil lamp hanging on its chain, its flame steady."""
    p = Pic()
    for y in range(0, 7, 2):
        p.rows(['n', 'o'], 12, y)
    body = Pic()
    body.ellipse(11.5, 16.5, 8.0, 4.4, 'N')
    body.rows(['NNNNNNN'], 8, 11)
    body.poly([(18.0, 14.0), (24.0, 11.0), (24.5, 13.0), (19.0, 18.0)], 'N')
    body.rows(['.NNNNN.', 'NNNNNNN'], 8, 20)
    body.rows(['yoyoyoyoyoyoy'], 5, 16)
    over(p, body)
    flame(p, 23.0, 3.0, 11.0, 2.8, layers='roh', lean=-0.6,
          steps=[(0, 0, 0), (1.2, 0.8, 1.0), (2.8, 1.8, 1.9)])
    return render(p)


def card_dawn_vow():
    """새벽의 서약: a sword planted upright before the rising sun."""
    p = Pic()
    for i in range(7):
        a = math.pi + i * math.pi / 6
        p.stroke(12.5, 18.0, 12.5 + 12.5 * math.cos(a), 18.0 + 12.5 * math.sin(a), 1.4, 'o')
    p.fill(lambda x, y: y <= 18.0 and (x - 12.5) ** 2 + (y - 18.0) ** 2 <= 8.0 ** 2, 'Y')
    p.rows(['T' * 26] * 3, 0, 19)
    blade = Pic()
    sword(blade, 12.5, 8.0, 12.5, 22.5, blade=2.8, guard_len=4.0)
    over(p, blade)
    return render(p)


# --------------------------------------------------------------------------------------------
# Shadow (그림자)
# --------------------------------------------------------------------------------------------


def card_shadow_strike():
    """그림자 베기: a black blade leaving a violet slash in the dark."""
    p = Pic()
    arc(p, 3.0, 3.0, 21.0, 3.6, 12, 80, 'v')
    blade = Pic()
    sword(blade, 8.0, 17.0, 22.5, 2.5, mat='H', guard='V', grip='D')
    over(p, blade)
    return render(p)


def card_dusk_veil():
    """어스름 장막: a veil of violet shadow drawn down under a crescent moon."""
    p = Pic()
    p.fill(lambda x, y: (x - 7.0) ** 2 + (y - 6.0) ** 2 <= 5.8 ** 2
           and (x - 9.6) ** 2 + (y - 4.4) ** 2 > 4.8 ** 2, 'B')
    veil = Pic()
    veil.fill(lambda x, y: 1.5 <= x <= 24.0 and 10.0 + 1.6 * math.sin(x * 0.9) <= y <= 24.5
              and not (y > 21.0 and abs(((x - 1.5) % 5.5) - 2.75) < (y - 21.0) * 0.7), 'V')
    for x in (6, 11, 17, 22):
        for y in range(13, 22):
            if veil.get(x, y) == 'V':
                veil.put(x, y, 'w')
    over(p, veil)
    return render(p)


def card_gaze_into_dark():
    """어둠 응시: a wide eye opening in the dark, its iris violet."""
    p = Pic()
    p.fill(lambda x, y: abs(y - 12.5) <= 8.2 * (1 - ((x - 12.5) / 12.0) ** 2), 'H')
    eye = Pic()
    eye.fill(lambda x, y: abs(y - 12.5) <= 5.4 * (1 - ((x - 12.5) / 9.5) ** 2), 'B')
    eye.disc(12.5, 12.5, 4.6, 'V')
    eye.disc(12.5, 12.5, 2.2, 'k')
    eye.rows(['h'], 10, 10)
    for y in range(p.h):
        for x in range(p.w):
            if eye.c[y][x] != '.' and not abs(y + 0.5 - 12.5) <= 5.4 * (
                    1 - ((x + 0.5 - 12.5) / 9.5) ** 2):
                eye.c[y][x] = '.'
    over(p, eye, 'w')
    return render(p)


def card_night_stalker():
    """밤의 추적자: a crescent moon, a dagger drawn in front of it."""
    p = Pic()
    p.fill(lambda x, y: (x - 11.0) ** 2 + (y - 12.5) ** 2 <= 10.5 ** 2
           and (x - 15.5) ** 2 + (y - 10.0) ** 2 > 8.6 ** 2, 'V')
    d = Pic()
    sword(d, 10.0, 16.0, 21.0, 5.0, blade=2.4, mat='S', guard='V', grip='D', guard_len=3.2)
    over(p, d)
    return render(p)


def card_devouring_dark():
    """삼키는 어둠: a black maw yawning open, fangs of bone."""
    p = Pic()
    p.ellipse(12.5, 12.5, 12.0, 10.5, 'H')
    maw = Pic().ellipse(12.5, 12.5, 9.0, 7.2, 'k')
    for i in range(5):
        x = 5.5 + i * 3.5
        maw.poly([(x - 1.4, 5.0), (x + 1.4, 5.0), (x, 9.8)], 'B')
        maw.poly([(x + 0.3, 20.0), (x + 3.1, 20.0), (x + 1.7, 15.2)], 'B')
    for y in range(maw.h):
        for x in range(maw.w):
            if ((x + 0.5 - 12.5) / 9.0) ** 2 + ((y + 0.5 - 12.5) / 7.2) ** 2 > 1:
                maw.c[y][x] = '.'
    maw.rows(['v.v'], 11, 12)
    over(p, maw, 'w')
    return render(p)


def card_umbral_form():
    """그늘의 형상: a fist of black shadow wreathed in violet fire."""
    p = Pic()
    flames(p, [(12.5, 0.0, 22.0, 9.0, 0.0), (5.0, 5.0, 22.0, 4.2, -2.4),
               (20.0, 5.0, 22.0, 4.2, 2.4)], layers='wvph')
    f = Pic()
    fist(f, 6, 10, 'K', cuff='H')
    over(p, f)
    return render(p)


# --------------------------------------------------------------------------------------------
# Status
# --------------------------------------------------------------------------------------------


def card_slimed():
    """점액: a sage-green glob of slime, bubbles in it, dripping."""
    p = Pic()
    p.ellipse(12.5, 16.0, 11.5, 6.8, 'E')
    p.disc(9.0, 10.5, 5.0, 'E')
    p.disc(15.5, 9.0, 4.0, 'E')
    p.rows(['EE', 'EE', 'EE', '.E'], 6, 21)
    p.rows(['EE', 'EE', '.E'], 17, 22)
    for cx, cy in [(16.0, 16.0), (8.0, 15.0)]:
        p.ring(cx, cy, 0.8, 1.8, 'x')
    p.rows(['..hh', '.h..', 'h...'], 5, 7)
    return render(p)


def card_wound():
    """상처: a strip of bandage wound on the diagonal, blood soaking through it and dripping."""
    p = Pic()
    p.stroke(3.0, 20.0, 22.0, 5.0, 8.0, 'B')
    for i in range(-2, 3):
        x = 12.5 + i * 3.6
        y = 12.5 - i * 2.9
        p.stroke(x - 1.8, y - 3.0, x + 1.0, y + 3.2, 0.9, 'z')
    stain = Pic()
    stain.disc(12.0, 13.0, 3.8, 'R')
    stain.disc(14.8, 11.2, 2.4, 'R')
    stain.disc(9.6, 15.2, 2.0, 'R')
    for y in range(stain.h):
        for x in range(stain.w):
            if stain.c[y][x] != '.' and p.c[y][x] != 'B':
                stain.c[y][x] = '.'
    for y in range(stain.h):
        for x in range(stain.w):
            if stain.c[y][x] != '.':
                p.c[y][x] = stain.c[y][x]
    drop(p, 11.5, 18.5, 6.0)
    return render(p)


# --------------------------------------------------------------------------------------------
# Added cards
# --------------------------------------------------------------------------------------------


def card_wild_swing():
    """난도질: three wild hacks cut at odd angles, blood flying off them."""
    p = Pic()
    for (x0, y0, x1, y1) in [(1.0, 11.0, 15.0, 1.0), (12.0, 24.0, 25.0, 6.0),
                             (1.0, 15.0, 11.0, 25.0)]:
        slash(p, x0, y0, x1, y1, 4.0, 'h')
    for x, y, ch in [(12, 8, 'r'), (9, 11, 'r'), (13, 12, 'q'), (17, 3, 'r'), (7, 14, 'r')]:
        p.put(x, y, ch)
    return render(p)


def card_heavy_slash():
    """내려찍기: a broad sword driven point-first into the ground, the stone cracking."""
    p = Pic()
    p.rows(['T' * 24] * 4, 1, 21)
    for x, y in [(8, 21), (7, 22), (6, 23), (17, 21), (18, 22), (19, 23), (12, 22), (13, 23)]:
        p.put(x, y, 'k')
    blade = Pic()
    sword(blade, 12.5, 7.0, 12.5, 22.5, blade=4.0, guard_len=5.0)
    over(p, blade)
    for x, y0 in [(5, 3), (20, 3), (3, 10), (22, 10)]:
        for y in range(y0, y0 + 5):
            p.put(x, y, 'p')
    for x, y in [(8, 19), (17, 19), (6, 18), (19, 18)]:
        p.put(x, y, 'y')
    return render(p)


def card_reckless_charge():
    """무모한 돌진: a lance couched and thrust ahead, speed lines behind, a drop of the rider's
    own blood."""
    p = Pic()
    p.stroke(1.0, 18.0, 17.0, 10.0, 2.4, 'W')
    p.poly([(15.0, 8.0), (25.0, 5.0), (19.0, 13.5)], 'S')
    p.poly([(7.5, 11.5), (11.5, 17.5), (8.0, 18.5), (5.0, 13.5)], 'I')
    for x0, y, n in [(2, 7, 7), (0, 11, 4), (4, 23, 7)]:
        p.rows(['p' * n], x0, y)
    drop(p, 19.0, 16.0, 7.0)
    return render(p)


def card_sidestep():
    """흘려내기: a blow swerving off a raised buckler, its path bent away."""
    p = Pic()
    arc(p, 12.5, 12.5, 10.5, 3.0, 150, 330, 'p', taper=False)
    p.poly([(21.0, 2.0), (25.0, 9.0), (18.0, 8.0)], 'p')
    b = Pic()
    b.disc(12.5, 13.0, 6.6, 'S')
    b.disc(12.5, 13.0, 4.6, 'L')
    b.disc(12.5, 13.0, 1.6, 'G')
    over(p, b)
    return render(p)


def card_hemokinesis():
    """피의 일격: a sword whose blade is blood, drawn from the wielder's own veins."""
    p = Pic()
    sword(p, 8.0, 17.0, 22.5, 2.5, blade=3.4, mat='R', guard='S', grip='W')
    drop(p, 20.0, 12.0, 6.0)
    drop(p, 15.0, 17.0, 6.0)
    return render(p)


def card_war_cry():
    """전장의 포효: a bronze war horn sounding, the blast rolling out of its bell."""
    p = Pic()
    arc(p, 17.0, 12.5, 6.5, 1.4, 290, 70, 'p', taper=False)
    arc(p, 17.0, 12.5, 9.5, 1.4, 300, 60, 'p', taper=False)
    horn = Pic()
    horn.fill(lambda x, y: 3.0 <= x <= 18.0 and abs(y - (16.0 - 0.02 * (x - 3.0) ** 2))
              <= 1.2 + (x - 3.0) * 0.32, 'N')
    horn.rows(['yy'], 16, 10)
    horn.stroke(6.0, 16.5, 6.0, 20.0, 1.2, 'W')
    horn.stroke(13.0, 16.5, 13.0, 21.0, 1.2, 'W')
    horn.stroke(6.0, 20.0, 13.0, 21.0, 1.2, 'W')
    over(p, horn)
    return render(p)


def card_footwork():
    """발놀림: a quick leather boot, steel at the toe, a dust of motion behind its heel."""
    rows = [
        '.....WWWWWW.....',
        '.....WWWWWW.....',
        '.....WWWWWW.....',
        '.....nnnnnn.....',
        '.....WWWWWW.....',
        '.....WWWWWW.....',
        '.....WWWWWW.....',
        '.....WWWWWWW....',
        '.....WWWWWWWWW..',
        '....WWWWWWWWWWW.',
        '....WWWWWWWWWSSS',
        '....WWWWWWWWWSSS',
        '....kkkkkkkkkkkk',
        '....IIIIIIIIIIII',
    ]
    p = Pic().rows(rows, 7, 5)
    for x0, y, n in [(1, 9, 4), (0, 13, 5), (2, 17, 3)]:
        p.rows(['p' * n], x0, y)
    return render(p)


def card_blade_storm():
    """칼날 폭풍: three blades spinning round a gilt hub, each trailing a swirl of steel."""
    p = Pic()
    for ang in (270, 30, 150):
        arc(p, 12.5, 12.5, 10.0, 3.4, ang + 25, ang + 105, 'p')
    for ang in (270, 30, 150):
        a = math.radians(ang)
        q = Pic()
        sword(q, 12.5 + 4.2 * math.cos(a), 12.5 + 4.2 * math.sin(a),
              12.5 + 12.5 * math.cos(a), 12.5 + 12.5 * math.sin(a), blade=3.0, guard_len=1.2,
              pommel=False, grip='G')
        over(p, q)
    p.disc(12.5, 12.5, 2.4, 'G')
    p.put(11, 11, 'y')
    return render(p)


def card_offering():
    """제물: a heart laid in a gilt offering bowl, a flame rising off it."""
    p = Pic()
    flame(p, 12.5, 0.0, 8.0, 3.0, layers='roy',
          steps=[(0, 0, 0), (1.2, 0.8, 1.0), (2.8, 1.8, 1.9)])
    heart = Pic()
    heart.disc(9.5, 11.5, 3.6, 'R')
    heart.disc(15.5, 11.5, 3.6, 'R')
    heart.poly([(5.8, 12.5), (19.2, 12.5), (12.5, 19.0)], 'R')
    heart.rows(['.h', 'h.'], 7, 9)
    over(p, heart)
    bowl = Pic()
    bowl.fill(lambda x, y: y >= 16.0 and ((x - 12.5) / 10.5) ** 2 + ((y - 16.0) / 5.0) ** 2 <= 1,
              'G')
    bowl.rows(['G' * 21], 2, 16)
    bowl.stroke(12.5, 20.0, 12.5, 23.0, 2.6, 'G')
    bowl.rows(['.GGGGGGG.', 'GGGGGGGGG'], 8, 23)
    over(p, bowl)
    return render(p)


def card_vigil():
    """불빛 경계: a watchful eye whose pupil is a candle flame."""
    p = Pic()
    p.fill(lambda x, y: abs(y - 13.0) <= 7.6 * (1 - ((x - 12.5) / 12.0) ** 2), 'G')
    eye = Pic()
    eye.fill(lambda x, y: abs(y - 13.0) <= 5.2 * (1 - ((x - 12.5) / 9.6) ** 2), 'B')
    over(p, eye, 'n')
    fire = Pic()
    flame(fire, 12.5, 7.0, 17.5, 3.2, layers='roYh',
          steps=[(0, 0, 0), (1.0, 0.6, 0.9), (2.2, 1.4, 1.7), (3.4, 2.0, 2.4)])
    over(p, fire, 'k')
    for x, y in [(12, 1), (4, 4), (20, 4)]:
        p.rows(['y', 'y'], x, y)
    return render(p)


def card_flash_burst():
    """섬광: a blinding starburst of candlelight."""
    p = Pic()
    for i in range(16):
        a = i * math.pi / 8
        r = 12.5 if i % 4 == 0 else (9.0 if i % 2 == 0 else 6.5)
        p.stroke(12.5, 12.5, 12.5 + r * math.cos(a), 12.5 + r * math.sin(a),
                 2.2 if i % 4 == 0 else 1.4, 'Y')
    p.disc(12.5, 12.5, 4.6, 'Y')
    p.disc(12.5, 12.5, 2.6, 'h')
    return render(p)


def card_mending_glow():
    """치유의 온기: a heart held in a ring of warm light."""
    p = Pic()
    for a in range(0, 360, 30):
        r = math.radians(a)
        p.stroke(12.5 + 9.0 * math.cos(r), 13.0 + 9.0 * math.sin(r),
                 12.5 + 11.5 * math.cos(r), 13.0 + 11.5 * math.sin(r), 1.4, 'y')
    heart = Pic()
    heart.disc(9.0, 10.5, 4.2, 'R')
    heart.disc(16.0, 10.5, 4.2, 'R')
    heart.poly([(4.8, 11.5), (20.2, 11.5), (12.5, 20.5)], 'R')
    heart.rows(['.hh', 'h..', 'h..'], 6, 8)
    over(p, heart)
    return render(p)


def card_holy_flame():
    """성화의 가호: a sacred flame crowned with a gilt halo."""
    p = Pic()
    flames(p, [(12.5, 4.0, 24.0, 7.0, 0.0), (7.0, 11.0, 24.0, 3.6, -2.0),
               (18.0, 11.0, 24.0, 3.6, 2.0)])
    halo = Pic()
    halo.fill(lambda x, y: 0.4 <= ((x - 12.5) / 9.5) ** 2 + ((y - 3.5) / 3.4) ** 2 <= 1.0, 'G')
    over(p, halo)
    return render(p)


def card_shadow_flurry():
    """그림자 연격: three violet slashes raked through the dark at once."""
    p = Pic()
    for off in (-6.0, 0.0, 6.0):
        arc(p, 2.0 - off, 25.0 + off, 18.0, 3.4, 272, 358, 'v')
    for off in (-6.0, 0.0, 6.0):
        arc(p, 2.0 - off, 25.0 + off, 18.0, 1.2, 285, 345, 'p')
    return render(p)


def card_ambush():
    """매복: violet eyes in a mass of shadow, a dagger already drawn out of it."""
    p = Pic()
    p.disc(10.0, 15.0, 9.0, 'H')
    p.disc(16.5, 17.0, 7.0, 'H')
    p.rows(['vv...vv', 'hv...hv'], 7, 12)
    d = Pic()
    sword(d, 17.0, 11.0, 24.5, 2.0, blade=2.4, mat='S', guard='V', grip='D', guard_len=2.8)
    over(p, d)
    return render(p)


def card_nightfall():
    """해질녘: the sun sinking behind black hills under a violet sky."""
    p = Pic()
    p.fill(lambda x, y: (x - 12.5) ** 2 + (y - 16.0) ** 2 <= 11.5 ** 2 and y <= 16.0, 'V')
    p.fill(lambda x, y: (x - 12.5) ** 2 + (y - 16.0) ** 2 <= 6.8 ** 2 and y <= 16.0, 'Y')
    hills = Pic()
    hills.fill(lambda x, y: 0.5 <= x <= 24.5 and y >= 15.0 + 2.5 * math.sin(x * 0.45 + 1.0)
               and y <= 22.0, 'D')
    over(p, hills, 'k')
    for x, y in [(4, 7), (21, 5), (18, 9)]:
        p.put(x, y, 'h')
    return render(p)


def card_thorn_shade():
    """가시 그림자: a briar of violet shadow, coiled and bristling with thorns."""
    p = Pic()
    pts = [(3.0, 22.0), (8.0, 14.0), (15.0, 17.0), (18.0, 9.0), (12.0, 5.0), (8.0, 8.0)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        p.stroke(x0, y0, x1, y1, 3.2, 'V')
    for (bx, by, tx, ty) in [(6.0, 17.0, 2.0, 15.0), (10.5, 15.0, 11.0, 11.5),
                             (13.0, 16.5, 14.0, 21.5), (17.0, 13.0, 21.5, 14.0),
                             (16.5, 7.0, 19.5, 3.5), (10.0, 5.5, 9.0, 1.5),
                             (4.5, 20.0, 1.0, 23.5)]:
        nx, ny = ty - by, bx - tx
        ln = math.hypot(nx, ny)
        nx, ny = nx / ln * 1.8, ny / ln * 1.8
        p.poly([(bx + nx, by + ny), (bx - nx, by - ny), (tx, ty)], 'V')
    return render(p)


def card_soul_rend():
    """영혼 가르기: a pale wisp of a soul, split by a violet cut."""
    p = Pic()
    p.disc(12.5, 9.0, 7.5, 'B')
    p.fill(lambda x, y: abs(x - 12.5) <= 7.5 and 9.0 <= y <= 21.0, 'B')
    for i, x in enumerate(range(5, 21, 3)):
        p.poly([(x, 20.0), (x + 3.0, 20.0), (x + 1.5, 24.0 if i % 2 else 22.5)], 'B')
    p.rows(['kk..kk', 'kk..kk'], 9, 8)
    p.rows(['.kk.'], 10, 13)
    cut = Pic()
    cut.stroke(2.0, 23.0, 23.0, 2.0, 2.4, 'v')
    cut.stroke(2.0, 23.0, 23.0, 2.0, 0.9, 'h')
    over(p, cut)
    return render(p)


CARDS = {
    'strike': card_strike,
    'defend': card_defend,
    'bash': card_bash,
    'ironWave': card_iron_wave,
    'cleave': card_cleave,
    'twinStrike': card_twin_strike,
    'bodySlam': card_body_slam,
    'clothesline': card_clothesline,
    'pommelStrike': card_pommel_strike,
    'shrugItOff': card_shrug_it_off,
    'uppercut': card_uppercut,
    'bloodletting': card_bloodletting,
    'battleTrance': card_battle_trance,
    'intimidate': card_intimidate,
    'entrench': card_entrench,
    'inflame': card_inflame,
    'metallicize': card_metallicize,
    'thornArmor': card_thorn_armor,
    'bludgeon': card_bludgeon,
    'demonForm': card_demon_form,
    'impervious': card_impervious,
    'emberStrike': card_ember_strike,
    'wardingFlame': card_warding_flame,
    'tendTheWick': card_tend_the_wick,
    'radiantBlow': card_radiant_blow,
    'sanctuaryLamp': card_sanctuary_lamp,
    'dawnVow': card_dawn_vow,
    'shadowStrike': card_shadow_strike,
    'duskVeil': card_dusk_veil,
    'gazeIntoDark': card_gaze_into_dark,
    'nightStalker': card_night_stalker,
    'devouringDark': card_devouring_dark,
    'umbralForm': card_umbral_form,
    'slimed': card_slimed,
    'wound': card_wound,
    'wildSwing': card_wild_swing,
    'heavySlash': card_heavy_slash,
    'recklessCharge': card_reckless_charge,
    'sidestep': card_sidestep,
    'hemokinesis': card_hemokinesis,
    'warCry': card_war_cry,
    'footwork': card_footwork,
    'bladeStorm': card_blade_storm,
    'offering': card_offering,
    'vigil': card_vigil,
    'flashBurst': card_flash_burst,
    'mendingGlow': card_mending_glow,
    'holyFlame': card_holy_flame,
    'shadowFlurry': card_shadow_flurry,
    'ambush': card_ambush,
    'nightfall': card_nightfall,
    'thornShade': card_thorn_shade,
    'soulRend': card_soul_rend,
}


def preview(path: str):
    """The card icons at 4x on each card face's fill colour, then 1x as a card shows them."""
    import numpy as np
    from PIL import Image

    from icons import to_rgba

    items = [(k, fn()) for k, fn in CARDS.items()]
    bgs = [(0x5e, 0x2a, 0x2a), (0x25, 0x3f, 0x4d), (0x4d, 0x3f, 0x22), (0x1e, 0x1b, 0x22)]
    cols, cell = 9, 34
    rows_n = math.ceil(len(items) / cols)
    sheet = np.zeros((rows_n * cell * len(bgs), cols * cell, 3), np.uint8)
    for b, bg in enumerate(bgs):
        for i, (_, g) in enumerate(items):
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
    print(f'{len(items)} card icons -> {path}')


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'build', 'uikit',
                                                             'preview-card-icons.png')
    preview(out)
