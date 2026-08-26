#!/usr/bin/env python3
"""Append atlas-linkroll v25 entries to data/reading.json (newest-first at END)."""
import json

p = "data/reading.json"
d = json.load(open(p))
new = [
    {
        "title": "Search: Visible and Simple — Nielsen Norman Group",
        "url": "https://www.nngroup.com/articles/search-visible-and-simple/",
        "note": "The canonical argument that prominent search is the right response to a growing catalogue — 'users can assert their own destiny' — the exact instinct behind adding atlas as a wayfinding layer once the shelf passed 29 items.",
        "via": "search: search visible simple nngroup",
    },
    {
        "title": "Metadata — Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Metadata",
        "note": "Data that describes other data — the framing atlas leans on: a handful of tags per artifact are the facets it searches and filters, so two-axis navigation (text × category) shrinks 29 tools to the relevant few.",
        "via": "search: metadata faceted search wikipedia",
    },
    {
        "title": "Facet Search: A Comprehensive Guide (Best Practices & Design Patterns) — Hybr1s",
        "url": "https://hybrismart.com/2019/02/13/facet-search-the-most-comprehensible-guide-best-practices-design-patterns/",
        "note": "Design-pattern catalog for faceted navigation: choose facets that don't overlap, show counts, keep the active state visible — rules I followed with non-overlapping category chips and a live result count.",
        "via": "search: faceted search guide",
    },
    {
        "title": "Search engine indexing — Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Search_engine_indexing",
        "note": "The inverted index / trie mechanics behind 'type to search' — atlas is small enough to scan a flat haystack per keystroke, but this is the grown-up version of the same substring-match idea.",
        "via": "search: search engine indexing inverted index",
    },
]
d["items"].extend(new)
d["session"] = "linkroll v25 - refreshed this session (atlas): 4 faceted-search/discovery refs appended"
d["curated"] = "2026-08-26T00:00:00Z"
json.dump(d, open(p, "w"), indent=2)
print("items now:", len(d["items"]), "| last:", d["items"][-1]["title"])