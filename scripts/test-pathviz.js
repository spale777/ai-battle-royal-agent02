/*
 * test-pathviz.js — determinism & correctness proof for site/pathviz.html.
 *
 * Strategy: rather than re-implementing the algorithms (which would be circular),
 * we LOAD THE ACTUAL pure-core functions out of site/pathviz.html and run them
 * against vectors-pathviz.json — a corpus generated independently in Python by
 * scripts/gen-pathviz-vectors.py (same PRNG, same tie-breaks). If the browser
 * code's maze + search reproduce Python's maze + path exactly, the page is
 * byte-for-byte deterministic per seed across languages.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'site', 'pathviz.html'), 'utf8');
const vectorsr = JSON.parse(fs.readFileSync(path.join(__dirname, 'vectors-pathviz.json'), 'utf8'));

// --- extract the pure core (no DOM) from the page and evaluate it ---
const coreStart = html.indexOf('var DR=[-1,0,1,0]');
const coreEnd = html.indexOf('/* ================= URL state');
if (coreStart < 0 || coreEnd < 0) throw new Error('could not locate pure core in pathviz.html');
const coreSrc = html.slice(coreStart, coreEnd);
const sandbox = { Uint8Array, Int32Array, Math, Set };
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox);

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) pass++; else { fail++; console.error('  ✗ ' + msg); }
}
function arrEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

for (const vc of vectorsr) {
  const { seed, maze, alg, w, h, open, start, goal } = vc;
  const rnd = sandbox.makeRng(seed);
  const jsMaze = sandbox.MAZERS[maze](w, h, rnd);
  check(arrEqual(jsMaze, open), `maze ${maze} seed ${seed} ${w}x${h} open == oracle`);
  const res = sandbox.traceSearch(w, h, jsMaze, start, goal, alg);
  check(arrEqual(res.path, vc.path), `path ${maze}/${alg} seed ${seed}`);
  check(res.expanded === vc.expanded, `expanded ${maze}/${alg} seed ${seed} (${res.expanded} vs ${vc.expanded})`);
  check(res.frontierMax === vc.frontierMax, `frontierMax ${maze}/${alg} seed ${seed} (${res.frontierMax} vs ${vc.frontierMax})`);
  check(!!res.hit === !!vc.hit, `hit ${maze}/${alg} seed ${seed}`);
}

// invariants: any found path starts at start, ends at goal, every hop is an
// open adjacency, and (for optimal algs on a tree maze) matches oracle length.
for (const vc of vectorsr) {
  if (!vc.hit) continue;
  const p = vc.path;
  check(p.length >= 2 && p[0] === vc.start && p[p.length - 1] === vc.goal,
    `endpoints ${vc.maze}/${vc.alg} seed ${vc.seed}`);
  let ok = true;
  for (let x = 0; x < p.length - 1; x++) {
    if (!adjacent(vc, p[x], p[x + 1])) { ok = false; break; }
  }
  check(ok, `path walks open adjacencies ${vc.maze}/${vc.alg} seed ${vc.seed}`);
}

console.log(`pathviz: ${pass} passed, ${fail} failed  (${vectorsr.length} oracle vectors)`);
process.exit(fail ? 1 : 0);

function adjacent(vc, a, b) {
  const w = vc.w;
  const r1 = (a / w) | 0, c1 = a % w, r2 = (b / w) | 0, c2 = b % w;
  if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
  const dr = r2 - r1, dc = c2 - c1;
  let bit = 0;
  for (let d = 0; d < 4; d++) if (sandbox.DR[d] === dr && sandbox.DC[d] === dc) bit = d;
  return (vc.open[a] & sandbox.BIT[bit]) !== 0;
}