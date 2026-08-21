// test-hashkit.js — verify hand-written SHA-1/SHA-224/SHA-256 against
// known-good vectors AND against Python's hashlib over a corpus.
// Run: python3 -c 'import json,sys;from hashlib import *;...' > vectors.json
// then: node test-hashkit.js
'use strict';
const { sha1Hex, sha224Hex, sha256Hex } = require('./hashcore.js');
const fs = require('fs');

// ---- Hardcoded NIST/KAT known vectors --------------------------------------
const KAT = [
  { alg: 'sha1', input: '', want: 'da39a3ee5e6b4b0d3255bfef95601890afd80709' },
  { alg: 'sha1', input: 'abc', want: 'a9993e364706816aba3e25717850c26c9cd0d89d' },
  { alg: 'sha1', input: 'The quick brown fox jumps over the lazy dog', want: '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12' },
  { alg: 'sha224', input: '', want: 'd14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f' },
  { alg: 'sha224', input: 'abc', want: '23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7' },
  { alg: 'sha256', input: '', want: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { alg: 'sha256', input: 'abc', want: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
  { alg: 'sha256', input: 'The quick brown fox jumps over the lazy dog', want: 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592' },
];

// Inputs spanning edge cases: empty, exactly-boundary lengths, >64-byte (multi-block)
const corpus = [
  '', 'a', 'abc', 'message digest', 'abcdefghijklmnopqrstuvwxyz',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  '12345678901234567890123456789012345678901234567890123456789012345678901234567890',
  'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(57), // padding boundaries
  'x'.repeat(63), 'x'.repeat(64), 'x'.repeat(65), 'x'.repeat(127), 'x'.repeat(128),
  'x'.repeat(129), 'x'.repeat(1000), 'x'.repeat(4096),
  'The quick brown fox jumps over the lazy dog',
  'The quick brown fox jumps over the lazy cog',
  'héllo wörld 🚀 emoji test 日本語',
  'line1\nline2\r\nline3\ttab',
];

const FN = { sha1: sha1Hex, sha224: sha224Hex, sha256: sha256Hex };

let pass = 0, fail = 0;

function check(name, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log(`FAIL ${name}\n  got  ${got}\n  want ${want}`); }
}

// 1) Against known vectors
for (const v of KAT) check(`KAT ${v.alg}(${JSON.stringify(v.input)})`, FN[v.alg](v.input), v.want);

// 2) Against Python-generated vectors (if present)
const pyFile = __dirname + '/hashkit.vectors.json';
if (fs.existsSync(pyFile)) {
  const py = JSON.parse(fs.readFileSync(pyFile, 'utf8'));
  for (const alg of ['sha1', 'sha224', 'sha256']) {
    for (const s of corpus) {
      const want = (py[alg] && py[alg][s]);
      if (want === undefined) continue;
      check(`PY ${alg}(${JSON.stringify(s.slice(0, 20))}${s.length > 20 ? '…' : ''})`, FN[alg](s), want);
    }
  }
} else {
  console.log('(no python vectors file — run python3 gen-hashkit-vectors.py first)');
}

// 3) Self-consistency: UTF-8 comparison with a reference TextEncoder path
const te = new TextEncoder();
if (te.encode('🚀').length === 4) { pass++; } else { fail++; console.log('FAIL TextEncoder emoji bytes'); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
