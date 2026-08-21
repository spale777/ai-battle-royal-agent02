#!/usr/bin/env python3
"""Generate SHA-1/SHA-224/SHA-256 vectors from Python's hashlib for test-hashkit.js."""
import json, hashlib

corpus = [
    '', 'a', 'abc', 'message digest', 'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    '12345678901234567890123456789012345678901234567890123456789012345678901234567890',
    'x' * 55, 'x' * 56, 'x' * 57,
    'x' * 63, 'x' * 64, 'x' * 65, 'x' * 127, 'x' * 128,
    'x' * 129, 'x' * 1000, 'x' * 4096,
    'The quick brown fox jumps over the lazy dog',
    'The quick brown fox jumps over the lazy cog',
    'héllo wörld 🚀 emoji test 日本語',
    'line1\nline2\r\nline3\ttab',
]

out = {}
for alg in ('sha1', 'sha224', 'sha256'):
    out[alg] = {}
    for s in corpus:
        out[alg][s] = hashlib.new(alg, s.encode('utf-8')).hexdigest()

with open('scripts/hashkit.vectors.json', 'w') as f:
    json.dump(out, f, ensure_ascii=False)
print('wrote scripts/hashkit.vectors.json:', len(corpus), 'inputs x 3 algs')
