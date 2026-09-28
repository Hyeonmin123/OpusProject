"""Shared helpers for the Gemini -> game pixel-art pipeline (see process.py).

Everything works on numpy arrays: RGB uint8 (H, W, 3) and boolean / float masks (H, W).
Only Pillow and numpy are required.
"""

from __future__ import annotations

from collections import deque

import numpy as np
from PIL import Image

# --------------------------------------------------------------------------------------------
# Locked palette
# --------------------------------------------------------------------------------------------

PALETTE_HEX = {
    # darks
    'd0': '#0f0e11',
    'd1': '#16141a',
    'd2': '#1e1b22',
    'd3': '#27232c',
    # stone grays
    's0': '#312c37',
    's1': '#3b3542',
    's2': '#5a5162',
    # parchment
    'p2': '#ddd6ca',
    'p1': '#948b80',
    'p0': '#6b645c',
    # warm gold / candle
    'g0': '#b89a5e',
    'g1': '#d8b76e',
    'g2': '#f0b84a',
    'g3': '#f3d27a',
    # shadow violet
    'v1': '#8e6bc4',
    'v0': '#1a1024',
    # blood red
    'r1': '#a23a3a',
    'r0': '#3a1c1c',
    # singles
    'bl': '#5b7d99',  # steel blue
    'gr': '#86a872',  # sage green
    'dr': '#b86a6a',  # dusty red
    'hi': '#f5f0e6',  # sparing highlight
}


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip('#')
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


PAL = {k: hex_rgb(v) for k, v in PALETTE_HEX.items()}
PALETTE = np.array(list(PAL.values()), dtype=np.uint8)


def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """sRGB uint8 (..., 3) -> CIELAB float (..., 3)."""
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array(
        [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]
    )
    xyz = c @ m.T
    xyz /= np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], -1)


def quantize(rgb: np.ndarray, palette: np.ndarray = PALETTE, chroma_weight: float = 1.0):
    """Map every pixel to the nearest palette colour (CIELAB distance). Returns (rgb, index)."""
    lab = rgb_to_lab(rgb.reshape(-1, 3))
    plab = rgb_to_lab(palette)
    w = np.array([1.0, chroma_weight, chroma_weight])
    d = (((lab[:, None, :] - plab[None, :, :]) * w) ** 2).sum(-1)
    idx = d.argmin(1)
    return palette[idx].reshape(rgb.shape), idx.reshape(rgb.shape[:2])


def blend_palette(pairs: list[tuple[str, str]], base: np.ndarray = PALETTE) -> np.ndarray:
    """Base palette plus 50/50 blends of the given colour pairs (for painterly backgrounds)."""
    extra = []
    for a, b in pairs:
        ca, cb = np.array(PAL[a], float), np.array(PAL[b], float)
        extra.append(np.round((ca + cb) / 2).astype(np.uint8))
    return np.concatenate([base, np.array(extra, np.uint8)]) if extra else base


# --------------------------------------------------------------------------------------------
# Loading / geometry
# --------------------------------------------------------------------------------------------


def load_rgb(path: str, size: int | None = None) -> np.ndarray:
    im = Image.open(path).convert('RGB')
    if size and im.width != size:
        im = im.resize((size, round(im.height * size / im.width)), Image.BOX)
    return np.asarray(im).copy()


def star_mask(h: int, w: int, cx: float, cy: float, r: float, grow: float = 3.0) -> np.ndarray:
    """Gemini's four-point sparkle watermark: an astroid |x|^(2/3)+|y|^(2/3) <= r^(2/3), grown."""
    yy, xx = np.mgrid[0:h, 0:w]
    dx, dy = np.abs(xx - cx), np.abs(yy - cy)
    core = dx ** (2 / 3) + dy ** (2 / 3) <= r ** (2 / 3)
    # grow by a few px so the soft anti-aliased rim goes too
    return dilate(core, int(grow))


def dilate(m: np.ndarray, n: int = 1) -> np.ndarray:
    out = m.copy()
    for _ in range(n):
        o = out.copy()
        o[1:, :] |= out[:-1, :]
        o[:-1, :] |= out[1:, :]
        o[:, 1:] |= out[:, :-1]
        o[:, :-1] |= out[:, 1:]
        out = o
    return out


def erode(m: np.ndarray, n: int = 1) -> np.ndarray:
    return ~dilate(~m, n)


def components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """4-connected component labels (0 = not in mask), via row runs + union-find."""
    h, w = mask.shape
    parent: list[int] = [0]

    def find(a: int) -> int:
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    runs_prev: list[tuple[int, int, int]] = []
    all_runs: list[tuple[int, int, int, int]] = []
    for y in range(h):
        row = mask[y]
        d = np.diff(np.concatenate([[0], row.view(np.int8), [0]]))
        starts, ends = np.flatnonzero(d == 1), np.flatnonzero(d == -1)
        runs_cur = []
        j = 0
        for s0, e0 in zip(starts.tolist(), ends.tolist()):
            lbl = len(parent)
            parent.append(lbl)
            while j < len(runs_prev) and runs_prev[j][1] <= s0:
                j += 1
            k = j
            while k < len(runs_prev) and runs_prev[k][0] < e0:
                ra, rb = find(runs_prev[k][2]), find(lbl)
                if ra != rb:
                    parent[max(ra, rb)] = min(ra, rb)
                k += 1
            runs_cur.append((s0, e0, lbl))
            all_runs.append((y, s0, e0, lbl))
        runs_prev = runs_cur
    roots: dict[int, int] = {}
    lab = np.zeros((h, w), np.int32)
    for y, s0, e0, lbl in all_runs:
        r = find(lbl)
        if r not in roots:
            roots[r] = len(roots) + 1
        lab[y, s0:e0] = roots[r]
    return lab, len(roots)


def inpaint(rgb: np.ndarray, unknown: np.ndarray, source: np.ndarray | None = None) -> np.ndarray:
    """Onion-peel fill: every unknown pixel takes the mean of its known 8-neighbours, ring by ring.
    `source` limits which known pixels may donate colour (default: all known ones)."""
    if not unknown.any():
        return rgb
    # work on a padded crop around the hole only
    ys, xs = np.nonzero(unknown)
    pad = 6
    y0, y1 = max(0, ys.min() - pad), min(rgb.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(rgb.shape[1], xs.max() + pad + 1)
    if (y0, x0, y1, x1) != (0, 0, rgb.shape[0], rgb.shape[1]):
        out = rgb.copy()
        sub_src = None if source is None else source[y0:y1, x0:x1]
        out[y0:y1, x0:x1] = inpaint(rgb[y0:y1, x0:x1], unknown[y0:y1, x0:x1], sub_src)
        return out
    rgb = rgb.astype(np.float64).copy()
    known = ~unknown if source is None else (~unknown & source)
    todo = unknown.copy()
    for _ in range(400):
        if not todo.any():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros(rgb.shape[:2])
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == dx == 0:
                    continue
                k = np.roll(np.roll(known, dy, 0), dx, 1)
                c = np.roll(np.roll(rgb, dy, 0), dx, 1)
                acc += c * k[..., None]
                cnt += k
        fill = todo & (cnt > 0)
        if not fill.any():
            break
        rgb[fill] = acc[fill] / cnt[fill][:, None]
        known = known | fill
        todo &= ~fill
    return np.clip(np.round(rgb), 0, 255).astype(np.uint8)


def inpaint_mask(mask: np.ndarray, unknown: np.ndarray) -> np.ndarray:
    """Fill unknown cells of a boolean mask by majority of known neighbours, ring by ring."""
    v = inpaint(np.repeat(mask[..., None].astype(np.uint8) * 255, 3, -1), unknown)[..., 0]
    return v >= 128


# --------------------------------------------------------------------------------------------
# Fake-transparency (baked checkerboard) removal
# --------------------------------------------------------------------------------------------


def checker_levels(rgb: np.ndarray) -> list[float]:
    """Grey levels of the baked checkerboard, read off the image border."""
    b = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3),
                        rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)]).astype(int)
    neutral = (b.max(1) - b.min(1)) <= 12
    L = b[neutral].mean(1)
    hist = np.bincount(np.round(L).astype(int), minlength=256).astype(float)
    # smooth and take the two strongest separated peaks
    k = np.convolve(hist, np.ones(5) / 5, 'same')
    p1 = int(k.argmax())
    k2 = k.copy()
    k2[max(0, p1 - 12):p1 + 13] = 0
    p2 = int(k2.argmax())
    levels = [float(p1)]
    if k2[p2] > 0.08 * k[p1]:
        levels.append(float(p2))
    return levels


def remove_checker(rgb: np.ndarray, protect: np.ndarray | None = None, tol: float = 16,
                   neutral: int = 14, levels: list[float] | None = None) -> np.ndarray:
    """Return an alpha mask (True = subject). Background = neutral pixels near a checker level that
    are connected to the image border, plus enclosed pockets that clearly show the checker pattern.
    `protect` pixels (e.g. the watermark) are ignored here and decided by the caller."""
    levels = levels or checker_levels(rgb)
    a = rgb.astype(int)
    L = a.mean(2)
    neu = (a.max(2) - a.min(2)) <= neutral
    cand = neu & (L >= min(levels) - tol) & (L <= max(levels) + tol)
    if protect is not None:
        cand |= protect  # watermark pixels may be crossed by the fill
    lab, n = components(cand)
    h, w = cand.shape
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # enclosed pockets (between a sword's blade and guard, inside a ring, ...)
    if len(levels) == 2:
        sizes = np.bincount(lab.ravel(), minlength=n + 1)
        lo, hi = sorted(levels)
        for i in np.flatnonzero(sizes >= 150).tolist():
            if i == 0 or i in border:
                continue
            sel = lab == i
            vals = L[sel]
            f_lo = (np.abs(vals - lo) <= tol).mean()
            f_hi = (np.abs(vals - hi) <= tol).mean()
            if f_lo > 0.2 and f_hi > 0.2:
                bg |= sel
    return ~bg


def remove_specks(alpha: np.ndarray, min_size: int) -> np.ndarray:
    lab, n = components(alpha)
    if n == 0:
        return alpha
    sizes = np.bincount(lab.ravel(), minlength=n + 1)
    keep = sizes >= min_size
    keep[0] = False
    return keep[lab]


# --------------------------------------------------------------------------------------------
# Pixel grid
# --------------------------------------------------------------------------------------------


def bbox(alpha: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(alpha)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def square_frame(alpha: np.ndarray, margin: float, anchor_bottom: bool = False,
                 box: tuple[int, int, int, int] | None = None):
    """Square crop window around the subject with `margin` (fraction of the side) on each side.
    Returns (x0, y0, side) in source pixels; the window may extend outside the image."""
    x0, y0, x1, y1 = box or bbox(alpha)
    side = max(x1 - x0, y1 - y0) / (1 - 2 * margin)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    sx = cx - side / 2
    sy = cy - side / 2
    if anchor_bottom:  # bust crop: subject runs off the bottom edge, keep it there
        sy = y1 - side
    return sx, sy, side


def resample_block(rgb: np.ndarray, alpha: np.ndarray, x0: float, y0: float, side_w: float,
                   side_h: float, n_w: int, n_h: int, palette: np.ndarray, mode: str = 'mean',
                   alpha_cut: float = 0.5, dark_bias: float = 0.34):
    """Downscale a window of the source to an n_w x n_h grid.

    Each output cell looks at its source block: it is opaque when >= alpha_cut of the block is
    subject, and its colour is either the mean of the subject pixels snapped to the palette
    ('mean'), or the most common palette colour in the block ('mode'). With dark_bias, a block
    whose darkest palette colours (outline) cover that fraction wins them, so 1px outlines
    survive the reduction."""
    H, W = alpha.shape
    out = np.zeros((n_h, n_w, 3), np.uint8)
    out_a = np.zeros((n_h, n_w), bool)
    _, qidx = quantize(rgb, palette)
    plab_L = rgb_to_lab(palette)[:, 0]
    dark = set(np.flatnonzero(plab_L <= plab_L.min() + 6).tolist())
    for j in range(n_h):
        for i in range(n_w):
            bx0 = x0 + i * side_w / n_w
            by0 = y0 + j * side_h / n_h
            xa, xb = int(np.floor(bx0)), int(np.ceil(bx0 + side_w / n_w))
            ya, yb = int(np.floor(by0)), int(np.ceil(by0 + side_h / n_h))
            area = max(1, (xb - xa) * (yb - ya))
            xa_c, xb_c, ya_c, yb_c = max(0, xa), min(W, xb), max(0, ya), min(H, yb)
            if xa_c >= xb_c or ya_c >= yb_c:
                continue
            am = alpha[ya_c:yb_c, xa_c:xb_c]
            cov = am.sum() / area
            if cov < alpha_cut:
                continue
            out_a[j, i] = True
            if mode == 'mean':
                c = rgb[ya_c:yb_c, xa_c:xb_c][am].mean(0)
                out[j, i] = c
            else:
                ids = qidx[ya_c:yb_c, xa_c:xb_c][am]
                cnt = np.bincount(ids, minlength=len(palette))
                if dark_bias and sum(cnt[d] for d in dark) >= dark_bias * len(ids):
                    best = max(dark, key=lambda d: cnt[d])
                else:
                    best = int(cnt.argmax())
                out[j, i] = palette[best]
    if mode == 'mean':
        out, _ = quantize(out, palette)
    return out, out_a


def upscale(img: Image.Image, k: int) -> Image.Image:
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def to_rgba(rgb: np.ndarray, alpha: np.ndarray | None) -> Image.Image:
    if alpha is None:
        return Image.fromarray(rgb, 'RGB')
    a = (alpha * 255).astype(np.uint8)
    rgba = np.dstack([rgb, a])
    rgba[~alpha] = 0
    return Image.fromarray(rgba, 'RGBA')
