#!/usr/bin/env node
/*
 * test-ecakit.js — NON-CIRCULAR cross-language proof for site/ecakit.html.
 *
 * We do NOT re-implement the CA logic (that would be circular). Instead we
 * load the page's ACTUAL pure core out of the HTML — the block between
 *   /* === CORE BEGIN === *​/  and  /* === CORE END === *​/
 * — run it in a `vm` sandbox, and diff its behaviour against
 * vectors-ecakit.json, a Python mulberry32 ground-truth corpus
 * (scripts/gen-ecakit-vectors.py).
 *
 * For each vector we assert:
 *   - init row == Python init
 *   - alive population after every generation == Python pops
 *   - final derived row after N steps == Python finalRow
 * and independently: a hand-computed rule-30 first step from a single centre
 * cell (the classic 3->1->1 pattern) to confirm the rule is canonical, plus
 * the mulberry32 first draw for a known seed.
 */
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/../site/ecakit.html', 'utf8');
const start = html.indexOf('/* === CORE BEGIN === */');
const end = html.indexOf('/* === CORE END === */');
if (start < 0 || end < 0 || end <= start) {
  console.error('✗ could not locate CORE markers in ecakit.html');
  process.exit(1);
}
const coreSrc = html.slice(start, end);
const sandbox = { Math, Uint8Array, console };
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox);
const { initRow, stepCA } = sandbox;

const vectors = JSON.parse(fs.readFileSync(__dirname + '/vectors-ecakit.json', 'utf8'));

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('  ✗ ' + msg); }
}
function row(arr){ return Array.from(arr); }
function eq(a, b){ return row(a).join(',') === row(b).join(','); }

/* ---- independent KATs ---- */
{
  // canonical mulberry32: known-first-draw table for seed 42
  const r = vm.runInContext('mulberry32(42)', sandbox);
  const d0 = r();
  check(Math.abs(d0 - 0.6011037519201636) < 1e-12,
        'mulberry32(42) first draw = ' + d0 + ' (want 0.6011037519…)');

  // rule 30, single centre cell of width 7, dead edges -> 3 neighbours
  const r30 = stepCA(new Uint8Array([0,0,0,1,0,0,0]), 7, 30, 0);
  check(eq(r30, [0,0,1,1,1,0,0]),
        'rule30 single→' + row(r30) + ' (want 0011 100)');
}

/* ---- corpus ---- */
for (const v of vectors) {
  const w = v.w, rule = v.rule, seed = v.seed, edges = v.edges, gens = v.gens;
  const mode = v.mode, dens = v.density;

  // init row
  const init = initRow(seed, w, mode, dens);
  check(eq(init, v.init),
        `init ${mode} r${rule} s${seed} w${w} e${edges}: ${row(init)} != ${v.init}`);

  // evolve; population after every generation + final row
  let cur = Array.from(init);
  let okPops = true;
  const gotPops = [sum(cur)];
  for (let g = 0; g < gens; g++) {
    cur = stepCA(new Uint8Array(cur), w, rule, edges);
    gotPops.push(sum(cur));
  }
  check(eq(cur, v.finalRow),
        `finalRow r${rule} s${seed} w${w} ${mode} e${edges}: ${row(cur)} != ${v.finalRow}`);
  check(gotPops.join(',') === v.pops.join(','),
        `pops r${rule} s${seed} w${w} ${mode} e${edges}: ${gotPops} != ${v.pops}`);
}

function sum(a){ let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; }

console.log(`\necakit: ${pass} passed, ${fail} failed ` +
            `(${vectors.length} vectors × 3 checks + 2 KATs)`);
process.exit(fail ? 1 : 0);
