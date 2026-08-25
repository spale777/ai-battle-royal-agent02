#!/usr/bin/env python3
"""gen-ecakit-vectors.py — ground-truth corpus for site/ecakit.html.

Mirrors the JS pure core (mulberry32 + initRow + stepCA) exactly, so the
Node suite can diff the browser code against an independent-language oracle.

Generates, for a matrix of (rule, seed, width, mode, edges):
  - init row (the initial condition row)
  - the alive-population after every generation
  - the final derived row after `gens` generations
"""
import json, random

def mulberry(seed):
    """Canonical mulberry32 — byte-for-byte the JS core (same proven form as caviz)."""
    s = seed & 0xFFFFFFFF
    def f():
        nonlocal s
        s = (s + 0x6D2B79F5) & 0xFFFFFFFF
        t = s
        t = ((t ^ (t >> 15)) * (1 | t)) & 0xFFFFFFFF
        t = ((t + ((t ^ (t >> 7)) * (61 | t))) ^ t) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0
    return f

def init_row(seed, w, mode, density):
    g = [0] * w
    if mode == 'random':
        # JS: for i in 0..w-1: g[i] = rnd() < density ? 1 : 0  (single rnd stream)
        r = mulberry(seed)
        for i in range(w):
            g[i] = 1 if r() < density else 0
    else:
        g[(w - 1) >> 1] = 1
    return g

def step_ca(row, n, rule, edges):
    out = [0] * n
    for i in range(n):
        if edges == 1:
            l, c, r = row[(i + n - 1) % n], row[i], row[(i + 1) % n]
        else:
            l = 0 if i == 0 else row[i - 1]
            c = row[i]
            r = 0 if i == n - 1 else row[i + 1]
        idx = (l << 2) | (c << 1) | r
        out[i] = (rule >> idx) & 1
    return out

def evolve(seed, w, rule, mode, density, edges, gens):
    row = init_row(seed, w, mode, density)
    init = list(row)
    pops = [sum(row)]
    for _ in range(gens):
        row = step_ca(row, w, rule, edges)
        pops.append(sum(row))
    return init, pops[:-1] if gens > 0 else [], row, pops

def main():
    rules = [30, 54, 90, 110, 184, 0, 255, 73, 1]
    seeds = [42, 7, 2026, 31337]
    widths = [11, 31, 64]
    modes = ['single', 'random']
    edgeses = [0, 1]
    gens = 24
    cases = []
    for rule in rules:
        for seed in seeds:
            for w in widths:
                for mode in modes:
                    for edges in edgeses:
                        density = 0.35 if mode == 'random' else 0.0
                        init, pops, final_row, allpops = evolve(seed, w, rule, mode, density, edges, gens)
                        cases.append({
                            "rule": rule, "seed": seed, "w": w, "mode": mode,
                            "density": round(density, 4), "edges": edges, "gens": gens,
                            "init": init,
                            "pops": allpops,             # includes gen0 = init pop
                            "genPops": pops,             # pops[0..gens-1]
                            "finalRow": final_row,       # row after `gens` steps
                        })
    random.seed(0)
    with open('vectors-ecakit.json', 'w') as f:
        json.dump(cases, f)
    print(f"wrote {len(cases)} vectors -> vectors-ecakit.json")

if __name__ == '__main__':
    main()
