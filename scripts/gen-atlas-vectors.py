#!/usr/bin/env python3
"""Independent cross-language ground truth for the atlas filter core.

The page's own catalog is a JS object array; we parse it out of the HTML as
*data* (exactly the bytes a visitor's browser would evaluate), then re-implement
the filter/normalize logic in Python from scratch.  The result is a corpus of
(category, query) -> expected name lists that the JS test suite diffs against
the page's real core — proving the filter semantics are deterministic across
implementations without re-using the page's code.

Reads site/atlas.html, writes scripts/vectors-atlas.json.
"""
import json, re, sys

HTML = "site/atlas.html"


def load_catalog():
    text = open(HTML, encoding="utf-8").read()
    m = re.search(r"const CAT = (\[.*?\]);\s*// normalize", text, re.S)
    if not m:
        sys.exit("could not find CAT array in atlas.html")
    raw = m.group(1)
    # Each element is { key:"value", key:[..], ... } with keys (n,rid,cat,d,p,ts).
    entries = re.findall(r"\{([^{}]*)\}", raw)
    cat = []
    for body in entries:
        rec = {}
        for km in re.finditer(r'(\w+):(("[^"]*(?:\\"[^"]*)*")|(\[[^\]]*\]))', body):
            k, val = km.group(1), km.group(2)
            rec[k] = json.loads(val)
        if "n" in rec and "d" in rec:
            cat.append(rec)
    if len(cat) < 20:
        raise SystemExit(f"catalog parse suspicious: only {len(cat)} entries")
    return cat


def normq(q):
    return [t for t in re.split(r"\s+", (q or "").strip().lower()) if t]


def filter_all(cat, q, tag):
    toks = normq(q)
    out = []
    for i, c in enumerate(cat):
        if tag and c.get("cat") != tag:
            continue
        hay = f"{c.get('n','')} {c.get('d','')} {' '.join(c.get('ts') or [])} {c.get('cat','')}".lower()
        if all(t in hay for t in toks):
            out.append(i)
    return out


CASES = [
    ("", ""), ("", "canvas"), ("", "text"), ("", "audio"), ("", "game"), ("", "gen"),
    ("ca", ""), ("canvas", ""), ("maze", ""), ("time", ""),
    ("automata", ""), ("hash", ""), ("color", ""), ("color", "text"),
    ("au", ""), ("auto", ""), ("m", ""), ("ma", ""),
    ("ant", ""), ("xxqq", "all"), ("life", ""), ("life", "canvas"),
    ("cul", ""), ("pars", "text"), ("base", ""), ("sheet", ""),
    ("e", ""), ("can", "canvas"), ("a", ""),
    ("rule", ""), ("to", "canvas"), ("text", "text"),
    ("cell", ""), ("tree", ""), ("15", ""), ("zzz", "text"),
]


def main():
    cat = load_catalog()
    vectors = []
    for q, catname in CASES:
        tag = catname if catname not in ("all", "") else ""
        idx = filter_all(cat, q, tag)
        vectors.append({
            "q": q, "cat": catname,
            "count": len(idx),
            "names": [cat[i]["n"] for i in idx],
            "indices": idx,
        })
    json.dump({"hash": "atlas filter corpus v1", "cases": len(vectors), "vectors": vectors},
              open("scripts/vectors-atlas.json", "w"), indent=1)
    print(f"catalog entries parsed: {len(cat)}")
    print(f"vectors written: {len(vectors)}")
    for v in vectors[:5]:
        print("  %-8r cat=%-6s -> %d %s" % (v["q"], v["cat"], v["count"], v["names"][:4]))


if __name__ == "__main__":
    main()