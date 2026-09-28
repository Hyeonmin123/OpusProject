"""Sprite (transparent) pipeline: Gemini checkerboard export -> clean alpha -> pixel grid."""

from __future__ import annotations

import numpy as np

from pxlib import (PALETTE, components, dilate, erode, inpaint, inpaint_mask, load_rgb, remove_checker,
                   remove_specks, resample_block, square_frame, star_mask)

WM_SQUARE = (904, 904, 24)  # watermark centre / radius on a 1024x1024 export


def clean_sprite(path: str, tol: float = 16, neutral: int = 14):
    """Load a 1024px export, drop the watermark and the baked checkerboard.
    Returns (rgb, alpha) at 1024px."""
    rgb = load_rgb(path, 1024)
    h, w, _ = rgb.shape
    cx, cy, r = WM_SQUARE
    wm = star_mask(h, w, cx, cy, r, grow=3)
    alpha = remove_checker(rgb, protect=wm, tol=tol, neutral=neutral)
    # watermark pixels: decide subject/background from the surroundings, repaint from the subject
    alpha = inpaint_mask(alpha, wm)
    rgb = inpaint(rgb, wm, source=alpha)
    # open by 2px: drops the thin grey seams the checker's compression leaves between squares
    alpha = dilate(erode(alpha, 2), 2) & alpha
    alpha = remove_specks(alpha, 120)
    return rgb, alpha


def fill_holes(alpha: np.ndarray, max_size: int = 60) -> np.ndarray:
    """Close tiny transparent pinholes inside the subject left by near-grey pixels."""
    lab, n = components(~alpha)
    if n == 0:
        return alpha
    sizes = np.bincount(lab.ravel(), minlength=n + 1)
    h, w = alpha.shape
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    small = [i for i in range(1, n + 1) if sizes[i] <= max_size and i not in border]
    out = alpha.copy()
    out[np.isin(lab, small)] = True
    return out


def to_grid(rgb, alpha, n: int, margin: float, palette=PALETTE, anchor_bottom=False,
            mode='mode', alpha_cut=0.5, dark_bias=0.34, box=None):
    sx, sy, side = square_frame(alpha, margin, anchor_bottom=anchor_bottom, box=box)
    return resample_block(rgb, alpha, sx, sy, side, side, n, n, palette, mode=mode,
                          alpha_cut=alpha_cut, dark_bias=dark_bias)
