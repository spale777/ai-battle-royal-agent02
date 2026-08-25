/*
 * test-caviz.js — determinism & correctness proof for site/caviz.html.
 *
 * Strategy (non-circular, same as pathviz): we LOAD THE ACTUAL pure-core
 * functions out of site/caviz.html (slice between the two CORE markers, run in
 * a vm sandbox — no DOM) and drive them against vectors-caviz.json, a corpus
 * generated independently in Python by scripts/gen-caviz-vectors.py (same
 * mulberry32 PRNG, same B/S rule array, same toroidal neighbor count).
 *
 * The seed -> init grid, every generation-step population, and the final grid
 * bitmap must match Python byte-for-byte.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'site', 'caviz.html'), 'utf8');
const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'vectors-caviz.json'), 'utf8'));

// --- extract the pure core (no DOM) from the page and evaluate it ---
const coreStart = html.indexOf('/* === CORE BEGIN === */');
const coreEnd = html.indexOf('/* === CORE END === */');
if (coreStart < 0 || coreEnd < 0) throw new Error('could not locate pure core in caviz.html');
const coreSrc = html.slice(coreStart, coreEnd);
const sandbox = { Uint8Array, Math, JSON };
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox);

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) pass++; else { fail++; console.error('  \u2717 ' + msg); }
}
function arrEq(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

for (const vc of vectors) {
  const { rule, seed, cols: w, rows: h, init_b64, init_pop, gens, final_b64, tor, density } = vc;
  const label = rule + ' seed ' + seed + ' ' + w + 'x' + h;

  // 1) seeded init grid == python
  const g0 = sandbox.initRandom(seed, w, h, density);
  check(sandbox.b64EncodeGrid(g0, w, h) === init_b64, 'init grid ' + label);

  // 2) parse the rule identically
  const p = sandbox.parseRule(rule);
  check(!!p, 'parseRule(' + rule + ') non-null');

  // 3) run GENS steps, compare populations and final bitmap
  let g = g0;
  let okPops = true;
  for (let t = 0; t < gens.length; t++) {
    g = sandbox.stepCA(g, w, h, p.B, p.S, tor);
    if (g.reduce((a, b) => a + b, 0) !== gens[t]) okPops = false;
  }
  check(okPops, 'generation populations ' + label);
  check(sandbox.b64EncodeGrid(g, w, h) === final_b64, 'final grid ' + label);
  check(g.reduce((a, b) => a + b, 0) === gens[gens.length - 1], 'final pop ' + label);
}

// 4) b64 round-trip: encode -> decode restores the exact grid
for (const vc of vectors) {
  const { cols: w, rows: h, density, seed } = vc;
  const g0 = sandbox.initRandom(seed, w, h, density);
  const b64 = sandbox.b64EncodeGrid(g0, w, h);
  const back = decodeGrid(sandbox, b64, w, h);
  check(arrEq(back, Array.from(g0)), 'b64 round-trip seed ' + seed + ' ' + w + 'x' + h);
}

// 5) rule-parse variants agree on the canonical forms
const canon = parseRuleDoc();
for (const [form, [br, sv]] of Object.entries(canon)) {
  const p = sandbox.parseRule(form);
  check(!!p && idx(p.B, br) && idx(p.S, sv), 'rule form "' + form + '" -> birth ' + br.join('') + ' survival ' + sv.join(''));
}

console.log('caviz: ' + pass + ' passed, ' + fail + ' failed  (' + vectors.length + ' oracle vectors)');
process.exit(fail ? 1 : 0);

/* decode a b64 grid back to an array using the page's own core helpers */
function decodeGrid(sb, b64, w, h) {
  const bytes = Array.from(sb.b64uToBytes(b64));
  const out = new Array(w * h);
  for (let i = 0; i < out.length; i++) {
    const byte = bytes[i >> 3] || 0, shift = 7 - (i & 7);
    out[i] = (byte & (1 << shift)) ? 1 : 0;
  }
  return out;
}
function idx(arr, wanted) {
  for (let d = 0; d < 9; d++) {
    const has = wanted.indexOf(d) >= 0;
    if (arr[d] !== has) return false;
  }
  return true;
}
function parseRuleDoc() {
  return {
    'B3/S23':     [[3],            [2, 3]],
    '23/3':       [[3],            [2, 3]],
    'B3S23':      [[3],            [2, 3]],
    'B36/S23':    [[3, 6],         [2, 3]],
    'B3/S2':      [[3],            [2]],
    'B2/S':       [[2],            []],
    'b1357/s1357':[[1, 3, 5, 7],   [1, 3, 5, 7]],
    'B3/S123456': [[3],            [1, 2, 3, 4, 5, 6]],
    'B36/S125':   [[3, 6],         [1, 2, 5]]
  };
}
