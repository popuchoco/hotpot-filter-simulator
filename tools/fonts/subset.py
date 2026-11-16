#!/usr/bin/env python3
"""Dev-only: rebuild the self-hosted font subsets in assets/fonts/.

Requires Python fontTools + brotli (pip install fonttools brotli) and the
upstream OFL sources from https://github.com/google/fonts:
  ofl/notosanstc/NotoSansTC[wght].ttf, ofl/baloo2/Baloo2[wght].ttf
Usage: python3 tools/fonts/subset.py <dir-with-upstream-ttf>
The Noto Sans TC subset covers every character used in index.html and src/*.js,
plus ASCII and common full-width punctuation. Re-run after adding new UI text.
"""
import glob, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
src = sys.argv[1] if len(sys.argv) > 1 else '.'
chars = set(chr(c) for c in range(0x20, 0x7f))
chars |= set('，。、！？：；「」『』（）《》〈〉…—～・·％＋－×÷｜０１２３４５６７８９')
for path in [os.path.join(root, 'index.html')] + glob.glob(os.path.join(root, 'src', '*.js')):
    chars |= set(open(path, encoding='utf-8').read())
text = ''.join(sorted(c for c in chars if ord(c) >= 0x20))

def build(infile, outfile, text, wght):
    font = TTFont(infile)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    try:
        font = instancer.instantiateVariableFont(font, {'wght': wght})
    except Exception as error:  # keep the full axis if limiting fails
        print('instancer skipped:', error)
    font.flavor = 'woff2'
    font.save(outfile)
    print(outfile, os.path.getsize(outfile))

out = os.path.join(root, 'assets', 'fonts')
os.makedirs(out, exist_ok=True)
build(os.path.join(src, 'NotoSansTC[wght].ttf'), os.path.join(out, 'NotoSansTC-subset.woff2'), text, (400, 700))
build(os.path.join(src, 'Baloo2[wght].ttf'), os.path.join(out, 'Baloo2-subset.woff2'),
      ''.join(chr(c) for c in range(0x20, 0x7f)), (500, 700))
