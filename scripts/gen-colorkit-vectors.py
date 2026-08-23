#!/usr/bin/env python3
"""gen-colorkit-vectors.py — ground-truth RGB<->HSL vectors via Python colorsys.
The JS page's rgbToHsl returns rounded-to-0.1 values; we store full-precision
for the harness and tolerance-compare."""
import colorsys, json, random

def rgb01_from_ints(r,g,b):
    return r/255.0, g/255.0, b/255.0

rgb_hsl = []
samples = [(255,0,0),(0,255,0),(0,0,255),(255,255,255),(0,0,0),
           (58,166,255),(255,165,0),(102,51,153),(255,99,71),
           (128,128,128),(0,128,128),(192,192,192),(128,0,128),
           (240,248,255),(64,224,208),(250,120,60),(50,205,50)]
for _ in range(40):
    r,g,b = random.randint(0,255), random.randint(0,255), random.randint(0,255)
    samples.append((r,g,b))
for (r,g,b) in samples:
    h,l,s = colorsys.rgb_to_hls(r/255.0,g/255.0,b/255.0)
    # convert HLS (l in middle) to HSL (max/min) — colorsys uses HLS ordering
    # rgb_to_hls returns (h, light, sat): to get HSL we swap: s_hsl from hls same sat
    # Actually colorsys.rgb_to_hls gives (h, l, s) where l is lightness, s is saturation
    # HSL uses same s, and h. So:
    rgb_hsl.append({'r':r,'g':g,'b':b,'h':round(h*360,4),'s':round(s*100,4),'l':round(l*100,4)})

hsl_rgb = []
h_samples = [(0,0.5,0.5),(120,0.5,0.5),(240,0.5,0.5),(213,0.67,0.67),
             (0,1.0,0.5),(30,1.0,0.7),(270,0.4,0.3),(180,1.0,0.5),
             (0,0,0.5),(0,0,1.0),(0,0,0.0),(90,0.8,0.4),(330,0.6,0.8)]
for _ in range(40):
    h_samples.append((random.uniform(0,360), random.uniform(0,1), random.uniform(0,1)))
for (h,s,l) in h_samples:
    r,g,b = colorsys.hls_to_rgb(h/360.0, l, s)
    hsl_rgb.append({'h':round(h,4),'s':round(s,4),'l':round(l,4),
                    'r':round(r*255,6),'g':round(g*255,6),'b':round(b*255,6)})

json.dump({'rgb_hsl':rgb_hsl,'hsl_rgb':hsl_rgb}, open('vectors-colorkit.json','w'), indent=1)
print(f'wrote {len(rgb_hsl)} rgb->hsl and {len(hsl_rgb)} hsl->rgb vectors')