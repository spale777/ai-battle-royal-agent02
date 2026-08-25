#!/usr/bin/env python3
"""Generate ground-truth vectors for antkit (turmite engine).

Independent Python mirror of the JS pure core in site/antkit.html.

JS canonical mulberry32 (as proven in ecakit/caviz):
  s = (s + 0x6D2B79F5) >>> 0
  t = s
  t = Math.imul(t ^ (t>>>15), t | 1)
  t = t ^ (t + Math.imul(t ^ (t>>>7), t | 61))
  return ((t ^ (t>>>14)) >>> 0) / 4294967296

Math.imul(a,b) low-32-bits == ((a*b) & 0xFFFFFFFF). The signedness of imul's
return never changes the low-32-bits of (t + imul) because subtracting 2^32
doesn't change the residue mod 2^32, so pure unsigned masking below is exact.
"""
import json, os

def mulberry32(seed):
    s = seed & 0xFFFFFFFF
    def rnd():
        nonlocal s
        s = (s + 0x6D2B79F5) & 0xFFFFFFFF
        t = s
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        imul = ((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF
        t = (t ^ ((t + imul) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return (t ^ (t >> 14)) & 0xFFFFFFFF, ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0
    return rnd

# KAT: canonical mulberry32(42) first draw == 0.6011037519201636
_k = mulberry32(42)
_, kd = _k()
assert abs(kd - 0.6011037519201636) < 1e-12, f"mulberry32 KAT failed: {kd!r}"
print("mulberry32(42) first draw KAT:", kd, "OK")

def init_grid(w, h, density, seed, N):
    """Row-major list of length w*h; cell value in 0..N-1.
    density>0: seeded-random (mulberry32(seed)); each cell decided by one
       rnd()<density, then colored by the NEXT rnd() (so the JS must consume
       the same two draws).  density==0: all zeros."""
    g = [0] * (w * h)
    if density > 0:
        rnd = mulberry32(seed)
        for i in range(len(g)):
            if rnd()[1] < density:
                g[i] = int(rnd()[1] * N) % N
    return g

TURN = {'R': 1, 'L': 3, 'U': 2, 'N': 0}

def step_turm(st, grid, w, h, edges, rule):
    N = len(rule)
    idx = st['y'] * w + st['x']
    c = grid[idx]
    st['h'] = (st['h'] + TURN[rule[c]]) % 4
    grid[idx] = (c + 1) % N
    dx = 1 if st['h'] == 1 else -1 if st['h'] == 3 else 0
    dy = -1 if st['h'] == 0 else 1 if st['h'] == 2 else 0
    if edges == 1:
        st['x'] = (st['x'] + dx) % w
        st['y'] = (st['y'] + dy) % h
    else:
        nx, ny = st['x'] + dx, st['y'] + dy
        if 0 <= nx < w and 0 <= ny < h:
            st['x'], st['y'] = nx, ny

def run(rule, seed, density, edges, w, h, steps):
    grid = init_grid(w, h, density, seed, len(rule))
    st = {'x': (w - 1) // 2, 'y': (h - 1) // 2, 'h': 0}
    for _ in range(steps):
        step_turm(st, grid, w, h, edges, rule)
    nonz = sum(1 for v in grid if v != 0)
    return {'grid': grid, 'ant': [st['x'], st['y'], st['h']], 'nonz': nonz,
            'total': w * h}

RULES = {
    'langton': 'RL',      # classic Langton's ant (RLRLRL... periodic -> highway)
    'turn_right': 'R',
    'turn_left': 'L',
    'uturn': 'U',
    'rrll': 'RRLL',
    'rllr': 'RLLR',
    'long': 'RLRRRLRRLL',
}

def main():
    cases = []
    for name, rule in RULES.items():
        for edges in (0, 1):
            for seed in (42, 7, 101):
                for density in (0, 0.4):
                    w = 14 if name in ('long',) else 18
                    h = 10 if name in ('long',) else 14
                    steps = 24 if density == 0 else 30
                    res = run(rule, seed, density, edges, w, h, steps)
                    cases.append({
                        'name': name, 'rule': rule, 'seed': seed,
                        'edges': edges, 'density': density, 'w': w, 'h': h,
                        'steps': steps, **res,
                    })
    out = {'generator': 'gen-antkit-vectors.py', 'cases': cases}
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        'vectors-antkit.json')
    with open(path, 'w') as f:
        json.dump(out, f)
    print(f"wrote {len(cases)} cases -> {path}")

if __name__ == '__main__':
    main()