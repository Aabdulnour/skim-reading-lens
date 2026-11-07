#!/usr/bin/env python3
"""Render the existing geometric Skim icon and a simple promotional tile.

Only requires Pillow. This is a development asset task, not a runtime dependency.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'store-assets'
ICONS = ROOT / 'extension' / 'icons'
OUT.mkdir(exist_ok=True)
ICONS.mkdir(exist_ok=True)
scale = 8
icon = Image.new('RGBA', (64 * scale, 64 * scale))
d = ImageDraw.Draw(icon)
d.rounded_rectangle((0, 0, 64 * scale - 1, 64 * scale - 1), radius=18 * scale, fill='#c8ed93')
def cubic(a, b, c, e):
    return [tuple(scale * ((1-t)**3*a[k] + 3*(1-t)**2*t*b[k] + 3*(1-t)*t*t*c[k] + t**3*e[k]) for k in (0, 1)) for t in [i/70 for i in range(71)]]
eye = cubic((6,32),(20,9),(44,9),(58,32)) + cubic((58,32),(44,55),(20,55),(6,32))
d.polygon(eye, fill='#263728')
for radius, color in [(11,'#c8ed93'),(5,'#263728')]:
    d.ellipse(tuple(v*scale for v in (32-radius,32-radius,32+radius,32+radius)),fill=color)
for size in (16,32,48,128):
    icon.resize((size,size),Image.Resampling.LANCZOS).save(ICONS/f'icon{size}.png')
icon.resize((128,128),Image.Resampling.LANCZOS).save(OUT/'icon-128.png')
S=3
tile=Image.new('RGB',(440*S,280*S),'#f5f5ed')
t=ImageDraw.Draw(tile)
fontdir=Path('/usr/share/fonts/truetype/dejavu')
def font(size,bold=False):
    return ImageFont.truetype(str(fontdir/('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')),size*S)
def text(x,y,value,size=12,bold=False,fill='#263728'):
    t.text((x*S,y*S),value,font=font(size,bold),fill=fill)
tile.paste(icon.resize((36*S,36*S)),(28*S,24*S),icon.resize((36*S,36*S)))
text(74,25,'skim.',26,True)
text(29,82,'Long answer.',30,True)
text(29,121,'Useful bit.',30,True)
text(30,175,'A quiet reading lens for your browser.',13)
t.rounded_rectangle((29*S,218*S,229*S,251*S),radius=6*S,fill='#c8ed93')
text(42,226,'Local. Open source. Beta.',11,True)
tile.resize((440,280),Image.Resampling.LANCZOS).save(OUT/'small-promo-440x280.png')
print('Rendered 4 extension icons, the store icon, and a 440 x 280 promotional tile.')
