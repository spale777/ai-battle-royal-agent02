#!/usr/bin/env node
/* Non-circular determinism proof for antkit (turmite engine).

   Like test-caviz / test-ecakit / test-mandelkit: we do NOT re-implement the
   turmite. We load the page's ACTUAL pure core (the block between the
   CORE BEGIN and CORE END markers inside site/antkit.html) and run it in a
   `vm` sandbox with browser-global shims, then diff its outputs against
   scripts/vectors-antkit.json — a corpus generated independently by Python
   (gen-antkit-vectors.py).

   Per case we run the real core from a seeded blank/random grid through the
   real stepTurm `steps` times and compare:
     - final grid colour array (byte-for-byte, row-major)
     - final ant position + heading
     - nonzero-colour-cell count
   using the exact same rule/seed/edges/density/w/h/steps the corpus used.
*/
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(__dirname + '/../site/antkit.html', 'utf8');
const a = html.indexOf('/* === CORE BEGIN === */');
const b = html.indexOf('/* === CORE END === */');
assert(a >= 0, 'CORE BEGIN marker not found');
assert(b > a, 'CORE END marker not found');
const core = html.slice(a, b);

const vec = JSON.parse(fs.readFileSync(__dirname + '/vectors-antkit.json', 'utf8'));

const sandbox = { Math, console, Uint8Array };
vm.createContext(sandbox);
vm.runInContext(core, sandbox, { filename: 'antkit-core.js' });

/* tiny harness calling the real core functions inside the sandbox */
vm.runInContext(`
function runCase(cfg){
  var grid = initGrid(cfg.w, cfg.h, cfg.density, cfg.seed, cfg.rule.length);
  var st = { x: (cfg.w - 1) >> 1, y: (cfg.h - 1) >> 1, h: 0 };
  for (var i = 0; i < cfg.steps; i++) stepTurm(st, grid, cfg.w, cfg.h, cfg.edges, cfg.rule);
  var nonz = 0, arr = [];
  for (i = 0; i < grid.length; i++){ arr.push(grid[i]); if (grid[i] !== 0) nonz++; }
  return { grid: arr, ant: [st.x, st.y, st.h], nonz: nonz };
}
`, sandbox);

let passed = 0, failed = 0;
const failures = [];

function check(ok, label){
  if (ok) passed++; else { failed++; failures.push(label); }
}

let counts = 0;
for (const c of vec.cases){
  const got = sandbox.runCase(c);
  const wantGrid = c.grid, gotGrid = got.grid;
  let gridOK = wantGrid.length === gotGrid.length;
  if (gridOK) for (let i = 0; i < wantGrid.length; i++){ if (wantGrid[i] !== gotGrid[i]) { gridOK = false; break; } }
  const tag = c.name + ' ' + c.rule + ' s' + c.seed + ' e' + c.edges + ' d' + c.density + ' ' + c.w + 'x' + c.h + '/s' + c.steps;
  check(gridOK, tag + ' : grid');
  check(got.ant[0] === c.ant[0] && got.ant[1] === c.ant[1] && got.ant[2] === c.ant[2], tag + ' : ant');
  check(got.nonz === c.nonz, tag + ' : nonz');
  counts += 3;
}

/* independent KAT 1: canonical mulberry32(42) first draw */
vm.runInContext('var __r = mulberry32(42); var __first = __r();', sandbox);
check(Math.abs(sandbox.__first - 0.6011037519201636) < 1e-12, 'mulberry32(42) first draw KAT');

/* independent KAT 2: one RL step from a blank 5x5 grid, ant centre/up.
   The cell is colour 0 (white) -> turn right, flip to 1, step one cell right.
   So after 1 step the ant is at (centre+1, centre) facing right. */
vm.runInContext(`
var __g2 = initGrid(5,5,0,1,2);
var __r2 = { x: 2, y: 2, h: 0 };
stepTurm(__r2, __g2, 5, 5, 1, 'RL');
`, sandbox);
check(sandbox.__r2.x === 3 && sandbox.__r2.y === 2 && sandbox.__r2.h === 1,
  'RL 1-step ant pos/heading KAT: got x=' + sandbox.__r2.x + ' y=' + sandbox.__r2.y + ' h=' + sandbox.__r2.h);

console.log('antkit checks: ' + passed + ' passed, ' + failed + ' failed (' + vec.cases.length + ' cases x 3)' );
if (failed > 0){
  console.log('FAILURES:'); failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('ALL GREEN — browser antkit core matches the Python corpus byte-for-byte');