"""Build the self-hosted Galmuri webfonts in src/assets/fonts/ from the upstream release.

    npm pack galmuri@2.40.3 && tar xzf galmuri-2.40.3.tgz
    pip install fonttools brotli
    python3 scripts/fonts/subset_galmuri.py package/dist

Galmuri (Lee Minseo, https://github.com/quiple/galmuri) is licensed under the SIL Open Font
License 1.1 with no Reserved Font Name, so subsetting and keeping the family name is allowed;
the licence travels with the fonts as src/assets/fonts/OFL.txt.

The subset keeps everything the game can show as text: ASCII and Latin-1, general
punctuation, arrows, geometric shapes (the gold coin), the heart, CJK punctuation, the Hangul
compatibility jamo and all 11,172 Hangul syllables. Kana, kanji and Galmuri's monochrome
dingbats (U+2600-27BF except the heart) are dropped: the kanji are most of the file size,
and the dingbats would otherwise win over the colour emoji the UI uses for relics and nodes.
"""

from __future__ import annotations

import os
import sys

from fontTools import subset

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', 'src', 'assets', 'fonts'))

FONTS = ['Galmuri9', 'Galmuri11', 'Galmuri11-Bold', 'Galmuri14']

UNICODES = [
    *range(0x0020, 0x007F),  # Basic Latin
    *range(0x00A0, 0x0100),  # Latin-1 Supplement (· ×)
    *range(0x2000, 0x2070),  # General Punctuation (– — …)
    *range(0x2190, 0x2200),  # Arrows (→)
    *range(0x25A0, 0x2600),  # Geometric Shapes (◉)
    0x2665,  # ♥
    *range(0x3000, 0x3040),  # CJK Symbols and Punctuation
    *range(0x3130, 0x3190),  # Hangul Compatibility Jamo
    *range(0xAC00, 0xD7A4),  # Hangul Syllables
    *range(0xFF01, 0xFF5F),  # Fullwidth ASCII forms
]


def main(src_dir: str) -> None:
    os.makedirs(OUT, exist_ok=True)
    for name in FONTS:
        src = os.path.join(src_dir, f'{name}.ttf')
        dst = os.path.join(OUT, f'{name}.woff2')
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.name_languages = ['*']
        opts.notdef_outline = True
        opts.hinting = False
        font = subset.load_font(src, opts)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=UNICODES)
        sub.subset(font)
        subset.save_font(font, dst, opts)
        print(f'{name}: {os.path.getsize(dst) / 1024:.0f} KB')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'package/dist')
