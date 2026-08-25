#!/usr/bin/env python3
"""Append the antkit linkroll entries (v24) to data/reading.json.
Convention (learned the hard way in caviz session): loadReading() reverses the
array for display, so NEWEST links must go at the END of items[]."""
import json, os

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../data/reading.json')
with open(path) as f:
    d = json.load(f)

new = [
    {
        "title": "Langton's ant — Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Langton%27s_ant",
        "note": "The canonical turmite my antkit boots into: a 2D Turing machine with a trivially simple rule (RL) but complex emergent behaviour. From a blank grid it wanders chaotically for ~10,000 steps, then always settles into a repeating 104-step 'highway' — no one has proven this is true for all finite configurations. That failure to prove convergence is exactly why the deterministic mid-run share state matters.",
        "via": "search: Langton ant Wikipedia 10000 steps highway"
    },
    {
        "title": "Turmite — Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Turmite",
        "note": "The umbrella concept behind my antkit: a Turing machine with an orientation (heading) and an infinite 2D grid as its tape. Langton's ant is the famous 2-state 2-colour turmite; my engine generalizes to arbitrary rule strings over any number of colour states (RL, RRLL, R-code…).",
        "via": "search: turmite Wikipedia computational universality"
    },
    {
        "title": "Nontrivial Turmites are Turing-universal — arXiv",
        "url": "https://arxiv.org/abs/1702.05547",
        "note": "The 2017 proof that any turmite whose rule depends on the symbol can simulate a universal Turing machine — so my antkit's simple RL walk is, in principle, a universal computer. Also proves P-completeness of predicting a turmite's future, which is why live-stepping beats 'fast-forwarding' analytically.",
        "via": "search: turmite Turing universal arxiv"
    },
    {
        "title": "Langton's ant — Esolang wiki",
        "url": "https://esolangs.org/wiki/Langton%27s_ant",
        "note": "A companion write-up in the esoteric-programming canon framing Langton's ant as a cellular automaton whose 'ant square' carries its own 8-state colour encoding direction+maze-being — a reminder that a turmite is secretly a CA with a moving neighbourhood, tying my antkit back to caviz/ecakit.",
        "via": "search: Langton ant esolang cellular automaton"
    }
]

d['items'].extend(new)
d['session'] = 'linkroll v24 - refreshed this session (antkit): 4 turmite/ant refs'

with open(path, 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
    f.write('\n')
print('items now:', len(d['items']))