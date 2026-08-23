#!/usr/bin/env python3
"""Generate ground-truth vectors for statkit — descriptive statistics, checked against
Python's statistics module (mean, median, quartiles inclusive, variance, stdev, mode).
Writes scripts/vectors-statkit.json consumed by scripts/test-statkit.js."""
import json, random, statistics, math

def q_incl(a):
    s = sorted(a); n = len(s)
    if n % 2 == 1:
        m = n // 2; lo, hi = s[:m+1], s[m:]
    else:
        h = n // 2; lo, hi = s[:h], s[h:]
    return statistics.median(lo), statistics.median(s), statistics.median(hi)

def row(a):
    q1, med, q3 = q_incl(a)
    modes = sorted(statistics.multimode(a))
    geo = None
    if all(v > 0 for v in a):
        geo = round(math.exp(sum(math.log(v) for v in a) / len(a)), 12)
    rec = {
        "input": a,
        "n": len(a),
        "sum": round(sum(a), 12),
        "min": min(a),
        "max": max(a),
        "range": round(max(a) - min(a), 12),
        "mean": round(statistics.fmean(a), 12),
        "median": round(med, 12),
        "q1": round(q1, 12),
        "q3": round(q3, 12),
        "iqr": round(q3 - q1, 12),
        "modes": [round(m, 8) for m in modes],
        "geo": geo,
    }
    if len(a) > 1:
        rec["varSample"] = round(statistics.variance(a), 12)
        rec["varPop"] = round(statistics.pvariance(a), 12)
        rec["sdSample"] = round(statistics.stdev(a), 12)
        rec["sdPop"] = round(statistics.pstdev(a), 12)
    else:
        rec["varSample"] = None
        rec["varPop"] = None
        rec["sdSample"] = None
        rec["sdPop"] = None
    # max frequency via Counter
    from collections import Counter
    rec["maxfreq"] = max(Counter(a).values())
    return rec

cases = [
    [1,2,3,4,5,6,7,8,9,10],
    [1,1,2,3,5,8,13,21,34,55,89],
    [5],
    [2,2],
    [1,2,2,3,4],
    [3,1],
    [170,182,158,174,165,171,180,166],
    [-5,-3,-1,0,2,4],
    [0.5,1.5,2.5,3.5],
    [2e3,3e3,1e3,5e3,4e3],
    [-10,0,10],
    [100,100,100,100],
    [1,2],
    [7],
    [1,1,2,2,3],
    [-2.5,-1.5,0,1.5,2.5],
]
random.seed(42)
for _ in range(5):
    r = [round(random.uniform(-50, 200), 2) for _ in range(random.randint(5, 14))]
    cases.append(r)

out = []
for c in cases:
    out.append(row(c))

with open("scripts/vectors-statkit.json", "w") as f:
    json.dump(out, f, indent=1)
print(f"wrote {len(out)} vectors")