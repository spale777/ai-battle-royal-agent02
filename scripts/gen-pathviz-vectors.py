#!/usr/bin/env python3
"""Ground-truth vector generator for pathviz (agent-02, 2026-08-24).

Reproduces the JS maze generators and the single priority-search core from
site/pathviz.html EXACTLY (same PRNG, same tie-breaks), so the Node test suite
can diff a JS run against these ground-truth maze + path vectors and prove the
browser code is byte-for-byte deterministic.

PRNG mirror:  makeRng(seed) -> ((s*1664525 + 1013904223) mod 2^32) / 2^32.
Cell model:   cell = r*cols + c ; wall bits N=1 E=2 S=4 W=8 = open sides.
Search keys:  BFS=(g,ord)  DFS=(-ord,0)  A*=(f=g+h,g,ord)  Greedy=(h,g,ord).
               Total tie-break on insertion order (ord) => fully deterministic.
"""
import json
import os

DR = [-1, 0, 1, 0]
DC = [0, 1, 0, -1]
BIT = [1, 2, 4, 8]
OPT = [4, 8, 1, 2]


def make_rng(seed):
    s = seed & 0xFFFFFFFF

    def rnd():
        nonlocal s
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        return s / 4294967296.0

    return rnd


def shuffled_dirs(rnd):
    d = [0, 1, 2, 3]
    for i in range(3, 0, -1):
        j = int(rnd() * (i + 1))
        d[i], d[j] = d[j], d[i]
    return d


def inb(r, c, rows, cols):
    return 0 <= r < rows and 0 <= c < cols


def maze_none(cols, rows, rnd):
    return [15] * (cols * rows)


def maze_backtracker(cols, rows, rnd):
    n = cols * rows
    open_ = [0] * n
    vis = [0] * n
    stack = [0]
    vis[0] = 1
    while stack:
        cur = stack[-1]
        cr, cc = cur // cols, cur % cols
        ds = shuffled_dirs(rnd)
        nb, nd = -1, -1
        for k in range(4):
            d = ds[k]
            nr, nc = cr + DR[d], cc + DC[d]
            if not inb(nr, nc, rows, cols):
                continue
            ni = nr * cols + nc
            if vis[ni]:
                continue
            nb, nd = ni, d
            break
        if nb < 0:
            stack.pop()
            continue
        open_[cur] |= BIT[nd]
        open_[nb] |= OPT[nd]
        vis[nb] = 1
        stack.append(nb)
    return open_


def maze_prim(cols, rows, rnd):
    n = cols * rows
    open_ = [0] * n
    vis = [0] * n
    frontier = []
    vis[0] = 1

    def add_f(cell):
        cr, cc = cell // cols, cell % cols
        for d in range(4):
            nr, nc = cr + DR[d], cc + DC[d]
            if not inb(nr, nc, rows, cols):
                continue
            ni = nr * cols + nc
            if vis[ni]:
                continue
            frontier.append(ni)

    def visited_neighbors(cell):
        cr, cc = cell // cols, cell % cols
        out = []
        for d in range(4):
            nr, nc = cr + DR[d], cc + DC[d]
            if not inb(nr, nc, rows, cols):
                continue
            ni = nr * cols + nc
            if vis[ni]:
                out.append(d)
        return out

    add_f(0)
    while frontier:
        k = int(rnd() * len(frontier))
        cell = frontier.pop(k)
        vis[cell] = 1
        vn = visited_neighbors(cell)
        cd = vn[int(rnd() * len(vn))]
        cr, cc = cell // cols, cell % cols
        nr, nc = cr + DR[cd], cc + DC[cd]
        nb = nr * cols + nc
        open_[cell] |= BIT[cd]
        open_[nb] |= OPT[cd]
        add_f(cell)
    return open_


def maze_kruskal(cols, rows, rnd):
    n = cols * rows
    open_ = [0] * n
    edges = []
    for r in range(rows):
        for c in range(cols):
            cell = r * cols + c
            if c + 1 < cols:
                edges.append([cell, cell + 1])
            if r + 1 < rows:
                edges.append([cell, cell + cols])
    for i in range(len(edges) - 1, 0, -1):
        j = int(rnd() * (i + 1))
        edges[i], edges[j] = edges[j], edges[i]
    par = list(range(n))

    def find(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x

    for a, b in edges:
        ra, rb = find(a), find(b)
        if ra == rb:
            continue
        if b == a + 1:
            open_[a] |= 2
            open_[b] |= 8
        else:
            open_[a] |= 4
            open_[b] |= 1
        par[rb] = ra
    return open_


MAZERS = {
    "backtrack": maze_backtracker,
    "prim": maze_prim,
    "kruskal": maze_kruskal,
    "none": maze_none,
}


def trace_search(cols, rows, open_, start, goal, alg):
    _gR = goal // cols
    _gC = goal % cols

    def heur(c):
        r, cc = c // cols, c % cols
        return abs(r - _gR) + abs(cc - _gC)

    n = cols * rows
    g = [-1] * n
    par = [-1] * n
    ord = [0] * n
    closed = [0] * n
    inf = [0] * n
    order = 0
    for i in range(n):
        g[i] = -1

    def key_of(c):
        if alg == "bfs":
            return (g[c], ord[c])
        if alg == "dfs":
            return (-ord[c], 0)
        hh = heur(c)
        if alg == "astar":
            return (g[c] + hh, g[c], ord[c])
        return (hh, g[c], ord[c])  # greedy

    fr = []

    def push_f(c):
        key = key_of(c)
        lo, hi = 0, len(fr)
        while lo < hi:
            mid = (lo + hi) >> 1
            # keep fr sorted ascending by key
            if fr[mid][1] < key:
                lo = mid + 1
            else:
                hi = mid
        fr.insert(lo, (c, key))

    g[start] = 0
    ord[start] = order
    order += 1
    inf[start] = 1
    push_f(start)
    expanded = 0
    frontier_max = 1
    hit = False
    path = []
    while fr:
        c, _key = fr.pop(0)
        if closed[c]:
            continue
        closed[c] = 1
        expanded += 1
        if c == goal:
            hit = True
            break
        cr, cc = c // cols, c % cols
        for d in range(4):
            if not (open_[c] & BIT[d]):
                continue
            nr, nc = cr + DR[d], cc + DC[d]
            if not inb(nr, nc, rows, cols):
                continue
            ni = nr * cols + nc
            if closed[ni] or inf[ni]:
                continue
            g[ni] = g[c] + 1
            par[ni] = c
            ord[ni] = order
            order += 1
            inf[ni] = 1
            push_f(ni)
            if len(fr) > frontier_max:
                frontier_max = len(fr)
    if hit:
        cur = goal
        while cur != -1:
            path.append(cur)
            if cur == start:
                break
            cur = par[cur]
        path.reverse()
    return {
        "path": path,
        "expanded": expanded,
        "frontierMax": frontier_max,
        "hit": hit,
    }


# DFS needs ord compare? In JS DFS key = [-ord,0]; push_f ordering only used to find
# min, which for fr sorted ascending by key pops the most-recently-pushed (largest
# ord => most negative -ord => smallest key). Python fr.pop(0) with same ordering
# reproduces it.  Note: we rely on push_f leaving fr sorted by Python tuple < which
# matches JS `lt` (tuple lexicographic). Good.

def build_vectors():
    seeds = [1, 7, 1337, 2026, 424242, 999983]
    mazes = ["backtrack", "prim", "kruskal", "none"]
    searches = ["astar", "greedy", "bfs", "dfs"]
    sizes = [(30, 18), (16, 12), (45, 26), (10, 8), (12, 20)]
    out = []
    for seed in seeds:
        for mz in mazes:
            dims = sizes if mz != "none" else [(30, 18)]
            for (w, h) in dims:
                gn = make_rng(seed)
                maze = MAZERS[mz](w, h, gn)
                goal = (h - 1) * w + (w - 1)
                for alg in searches:
                    res = trace_search(w, h, maze, 0, goal, alg)
                    rec = {
                        "seed": seed, "maze": mz, "w": w, "h": h,
                        "alg": alg, "open": maze, "start": 0, "goal": goal,
                    }
                    rec.update(res)
                    out.append(rec)
    return out


def main():
    vectors = build_vectors()
    here = os.path.dirname(os.path.abspath(__file__))
    dest = os.path.join(here, "vectors-pathviz.json")
    with open(dest, "w") as f:
        json.dump(vectors, f, separators=(",", ":"))
    print(f"wrote {len(vectors)} vectors to {dest}")


if __name__ == "__main__":
    main()