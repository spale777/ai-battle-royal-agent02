#!/usr/bin/env python3
"""Generate ground-truth escape-count vectors for mandelkit.

The browser and this generator must agree byte-for-byte on the integer escape
count, because z -> z^2 + c uses only + and * on IEEE-754 doubles, which Python
reproduces exactly (both are correctly-rounded to nearest). We sample a
deterministic grid of points across several viewports/maxiter and record the
bailout iteration count (or maxiter for "inside").
"""
import json, math

def esc_count(zr, zi, cr, ci, maxiter):
    x, y = zr, zi
    cx, cy = cr, ci
    n = 0
    while n < maxiter:
        x2 = x * x; y2 = y * y
        if x2 + y2 > 4.0:
            break
        nx = x2 - y2 + cx
        ny = 2.0 * x * y + cy
        x, y = nx, ny
        n += 1
    return n

def main():
    vectors = []
    # Deterministic pseudo-random generator (matches JS plan? No — vectors are
    # pure constants, we just need reproducible point sampling; use fixed grid
    # positions so no PRNG is involved at all).
    cases = [
        # (label, is_mandelbrot, center, span, maxiter)
        ("mb_default", True,  (-0.5, 0.0), 3.0,   120),
        ("mb_cardioid", True, (-0.5, 0.0), 1.0,   120),
        ("mb_seahorse", True, (-0.745, 0.1), 0.05, 200),
        ("mb_zoom2", True,    (-0.5, 0.0), 0.5,   100),
        ("jul_classic", False, (-0.0, 0.0), 3.0,   120),
        ("jul_rabbit", False,  (-0.0, 0.0), 3.0,   150),
        ("jul_galaxy", False,  (-0.0, 0.0), 2.0,   80),
    ]
    # constant c for the Julia cases
    julia_c = {
        "jul_classic": (-0.8, 0.156),
        "jul_rabbit":  (-0.123, 0.745),
        "jul_galaxy":  (-0.7269, 0.1889),
    }
    W, H = 40, 30   # coarse sampled grid (fast, still byte-exact)
    for label, is_mb, center, span, maxiter in cases:
        cx0, cy0 = center
        aspect = H / W
        halfA = span / 2
        halfHA = span * aspect / 2
        counts = []
        for j in range(H):
            im = cy0 + halfHA - (j / H) * span * aspect
            for i in range(W):
                re = cx0 + (i / W - 0.5) * span
                if is_mb:
                    n = esc_count(0.0, 0.0, re, im, maxiter)
                else:
                    jc = julia_c[label]
                    n = esc_count(re, im, jc[0], jc[1], maxiter)
                counts.append(n)
        vectors.append({
            "label": label,
            "kind": "mandelbrot" if is_mb else "julia",
            "center": list(center),
            "span": span,
            "maxiter": maxiter,
            "w": W, "h": H,
            "jc": list(julia_c[label]) if not is_mb else None,
            # a compact but exact representation: the full count grid, plus a
            # hash for sanity
            "counts": counts,
            "sum": sum(counts),
            "inside": sum(1 for c in counts if c >= maxiter),
        })
    with open("scripts/vectors-mandelkit.json", "w") as f:
        json.dump(vectors, f)
    print(f"wrote {len(vectors)} vectors")
    for v in vectors:
        print(f"  {v['label']}: sum={v['sum']} inside={v['inside']}")

if __name__ == "__main__":
    main()
