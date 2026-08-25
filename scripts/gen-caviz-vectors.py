#!/usr/bin/env python3
"""Generate the ground-truth vector corpus for caviz (cellular automata lab).

The JS core in caviz.html (mulberry32 rng, parseRule, neighbor-count, one
generation step) is mirrored EXACTLY here so this corpus is the verifiable ground
truth handed to test-caviz.js. The test loads the *real* core out of the HTML and
diffs against this corpus (non-circular; same convention as pathviz).

Per (rule, seed, cols, rows):
  { rule, seed, cols, rows, init_pop, gens:[N step pops], final_b64 }
where final is the row-major live grid after N steps, base64url of the bitmask
(multi-row order within each row: left-to-right, high bit first).
"""

import json, os, base64

GENS = 24

def rng(seed):
    """mulberry32, byte-for-byte the JS core."""
    s = seed & 0xFFFFFFFF
    def f():
        nonlocal s
        s = (s + 0x6D2B79F5) & 0xFFFFFFFF
        t = s
        t = ((t ^ (t >> 15)) * (1 | t)) & 0xFFFFFFFF
        t = ((t + ((t ^ (t >> 7)) * (61 | t))) ^ t) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0
    return f

def parse_rule(rs):
    """'B3/S23' | '23/3' | 'B3S23'; case-insensitive. Returns (birth, survival)
    as bool arrays of length 9 (index = neighbor count)."""
    up = rs.upper()
    b, s = [], []
    if '/' in up:
        for part in up.split('/'):
            digs = ''.join(c for c in part if c.isdigit())
            if part.startswith('B'):
                b = [int(c) for c in digs]
            elif part.startswith('S'):
                s = [int(c) for c in digs]
            else:
                if b:
                    s = [int(c) for c in digs]
                else:
                    b = [int(c) for c in digs]
    else:
        # bare like "B3S23"
        si = up.find('S')
        bi = up.find('B')
        if bi >= 0:
            seg = up[bi+1: si if si > bi else len(up)]
            b = [int(c) for c in seg]
        if si >= 0:
            seg = up[si+1:]
            s = [int(c) for c in seg]
        if not s and not b:
            # neither marker: all digits are birth
            b = [int(c) for c in up if c.isdigit()]
    B = [False]*9
    S = [False]*9
    for c in b:
        if 0 <= c <= 8:
            B[c] = True
    for c in s:
        if 0 <= c <= 8:
            S[c] = True
    return B, S

def count(grid, w, h, c, tor):
    x = c % w
    y = c // w
    n = 0
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            if tor:
                xx = (x + dx) % w
                yy = (y + dy) % h
            else:
                xx = x + dx
                yy = y + dy
                if xx < 0 or xx >= w or yy < 0 or yy >= h:
                    continue
            if grid[yy*w + xx]:
                n += 1
    return n

def step(grid, w, h, B, S, tor):
    out = [0]*(w*h)
    for c in range(w*h):
        n = count(grid, w, h, c, tor)
        out[c] = 1 if (grid[c] and S[n]) or (not grid[c] and B[n]) else 0
    return out

def build(seed, w, h, density=0.25):
    rd = rng(seed)
    g = [0]*(w*h)
    for c in range(w*h):
        if rd() < density:
            g[c] = 1
    return g

def encode(grid, w, h):
    bits = ''.join('1' if v else '0' for v in grid)
    bits = bits + '0' * ((-len(bits)) % 8)
    raw = bytes(int(bits[i:i+8], 2) for i in range(0, len(bits), 8))
    return base64.urlsafe_b64encode(raw).decode().rstrip('=')

RULES = ["B3/S23", "B36/S23", "B3/S2", "B2/S", "B1357/S1357",
         "B36/S346", "B3/S123456", "B3/S012345678"]
SEEDS = [101, 202, 303, 404]
SIZES = [(16, 8), (20, 10), (24, 12)]
DENSITY = 0.25
TOR = True

def main():
    clean = []
    for rule in RULES:
        B, S = parse_rule(rule)
        for seed in SEEDS:
            for (w, h) in SIZES:
                g = build(seed, w, h, DENSITY)
                init_pop = sum(g)
                # store init_bits too so the test can verify the seeding itself
                init_bits = encode(g, w, h)
                pops = []
                for _ in range(GENS):
                    g = step(g, w, h, B, S, TOR)
                    pops.append(sum(g))
                clean.append({
                    "rule": rule, "seed": seed, "cols": w, "rows": h,
                    "init_pop": init_pop, "init_b64": init_bits,
                    "gens": pops, "final_b64": encode(g, w, h),
                    "density": DENSITY, "tor": TOR,
                })
    path = os.path.join(os.path.dirname(__file__), "vectors-caviz.json")
    with open(path, "w") as f:
        json.dump(clean, f)
    print("wrote", path, "vectors:", len(clean))

if __name__ == "__main__":
    main()