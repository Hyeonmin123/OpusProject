"""The combat stage: the lit well behind each portrait and the dark pool around each combatant.

    python3 scripts/pixelart/stage.py        # -> src/assets/ui/well-*.png, ui/stage-pool*.png

The portraits are sprites with a hard 1px d0 outline on a transparent ground, mostly in the
stone greys (s1, s2, p0). Shown over a d0 frame and the dim stone of the scenes, the outline
vanished and the creature melted into the wall. The fix is the old stage one: put each
combatant in a pool of dark and light it from behind.

- `well-warm` (the warrior), `well-ember` and `well-ember-boss` (the enemies): the inside of
  the arched portrait frame, on the portraits' own grids (52px, bosses 66px), lit from behind
  the creature, a little above its middle, so its d0 outline reads against a lighter ground,
  darkening to d1 at the rim and into a floor band. The warrior stands in the candle's light
  (bronze), the enemies in a dull blood-red ember glow: a different hue from the grey
  sprites, so they separate by colour as well as by value, and the two sides read apart.
- `stage-pool`, `stage-pool-boss` (and `-lg` for the largest screens): a d0 ellipse behind the whole combatant (intent, portrait,
  name, HP), solid in the middle and falling off in ordered-dither alpha steps, like the other
  scrims: it darkens the scene locally so the combatant sits in a spotlight on a dark stage,
  and gives the name and HP text a dark ground.

Same rules as the UI kit (uikit.py): the locked palette of pxlib.py plus its 50/50 midpoints,
flat steps, shading only as ordered (Bayer) dither between neighbouring steps, and the scrims'
alpha steps of 16. Wells are exported at 4x like the portraits (so the frame can show them at
2x or 3x), pools at 2x like the rest of the chrome.
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
OUT = os.path.join(ROOT, 'src', 'assets', 'ui')

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
SCRIM_ALPHAS = tuple(range(16, 241, 16))


def mid(a: str, b: str) -> tuple[int, int, int]:
    """Midpoint of two palette steps (uikit.py `mid`)."""
    return tuple(int(round((x + y) / 2)) for x, y in zip(PAL[a], PAL[b]))


COLOURS = {**PAL, 'bz': mid('s0', 'g0'), 'rD': mid('d2', 'r0'), 'rR': mid('r0', 'r1')}

# Tone ramps, darkest first; a well steps through them with ordered dither.
RAMPS = {
    'warm': ['d1', 'd2', 'd3', 's0', 'bz'],
    'ember': ['d1', 'rD', 'r0', 'rR'],
}


def dithered(lvl: np.ndarray, n: int) -> np.ndarray:
    """Fractional tone level -> ramp index, ordered-dithered between neighbouring steps."""
    h, w = lvl.shape
    base = np.floor(lvl)
    y, x = np.mgrid[0:h, 0:w]
    idx = base + (BAYER4[y % 4, x % 4] < (lvl - base))
    return np.clip(idx, 0, n - 1).astype(int)


def well(size: int, ramp: list[str]) -> np.ndarray:
    """The inside of a portrait frame: a light behind the creature, a little above its middle,
    falling off to the rim, and a darker floor band at the bottom."""
    top = len(ramp) - 1
    y, x = np.mgrid[0:size, 0:size].astype(float) + 0.5
    nx = (x - size / 2) / (size / 2)
    ny = (y - size * 0.42) / (size / 2)
    d = np.sqrt(nx ** 2 + (ny * 1.1) ** 2)
    lvl = top + 0.5 - 3.0 * d ** 1.6
    # floor: the lower fifth sinks two steps, dithered in over a few rows
    floor = np.clip((y / size - 0.76) / 0.1, 0, 1)
    lvl -= 1.6 * floor
    idx = dithered(np.clip(lvl, 0, top), len(ramp))
    out = np.zeros((size, size, 4), np.uint8)
    for i, key in enumerate(ramp):
        out[idx == i, :3] = COLOURS[key]
    out[..., 3] = 255
    return out


def scrim_alpha(a: np.ndarray) -> np.ndarray:
    """Target alpha (0..240) -> the scrims' alpha steps, ordered-dithered between steps."""
    levels = np.array((0,) + SCRIM_ALPHAS)
    h, w = a.shape
    y, x = np.mgrid[0:h, 0:w]
    i = np.clip(np.searchsorted(levels, a, side='right') - 1, 0, len(levels) - 1)
    lo = levels[i]
    hi = levels[np.minimum(i + 1, len(levels) - 1)]
    frac = np.where(hi > lo, (a - lo) / np.maximum(hi - lo, 1), 0)
    return np.where(BAYER4[y % 4, x % 4] < frac, hi, lo).astype(np.uint8)


def pool(w: int, h: int, core: int = 208, cy: float = 0.5) -> np.ndarray:
    """d0 ellipse: solid `core` alpha out to 55% of the radius, then falling to 0 at the rim."""
    y, x = np.mgrid[0:h, 0:w].astype(float) + 0.5
    nx = (x - w / 2) / (w / 2)
    ny = (y - h * cy) / (h / 2)
    d = np.sqrt(nx ** 2 + ny ** 2)
    t = np.clip((d - 0.55) / 0.45, 0, 1)
    a = core * (1 - t) ** 1.3
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = PAL['d0']
    out[..., 3] = scrim_alpha(a)
    return out


def save(name: str, rgba: np.ndarray, scale: int):
    h, w = rgba.shape[:2]
    img = Image.fromarray(rgba, 'RGBA')
    path = os.path.join(OUT, f'{name}.png')
    img.resize((w * scale, h * scale), Image.NEAREST).save(path, optimize=True)
    print(f'{path}  ({w}x{h} grid @{scale}x)')


def main():
    save('well-warm', well(52, RAMPS['warm']), 4)
    save('well-ember', well(52, RAMPS['ember']), 4)
    save('well-ember-boss', well(66, RAMPS['ember']), 4)
    # Pools: sized to the combatant column with the frame at 3x, and at 4x on the largest
    # screens (see Creature.module.css).
    save('stage-pool', pool(140, 180, cy=0.47), 2)
    save('stage-pool-boss', pool(164, 206, cy=0.47), 2)
    save('stage-pool-lg', pool(168, 214, cy=0.47), 2)
    save('stage-pool-boss-lg', pool(196, 244, cy=0.47), 2)


if __name__ == '__main__':
    main()
