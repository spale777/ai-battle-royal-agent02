// atlas filter core — cross-language determinism proof (non-circular).
// Loads the page's REAL pure core (filterAll + CAT, sliced between CORE markers)
// and diffs it against scripts/vectors-atlas.json — a Python corpus that parsed
// the catalog as bytes and re-implemented the filter from scratch.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'site', 'atlas.html'), 'utf8');
const m = html.match(/\/\* === CORE BEGIN === \*\/([\s\S]*?)\/\* === CORE END === \*\//);
if (!m) { console.error('CORE markers not found in atlas.html'); process.exit(1); }

const sandbox = { };
vm.createContext(sandbox);
// const/let at top level don't attach to the sandbox global, so expose them.
vm.runInContext(m[1] + '\n;globalThis.__CAT = CAT; globalThis.__filterAll = filterAll;',
  sandbox, { filename: 'atlas-core.js' });
const CAT = sandbox.__CAT;
const filterAll = sandbox.__filterAll;

const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'vectors-atlas.json'), 'utf8'));

let pass = 0, fail = 0, errors = [];
function check(ok, label) { ok ? pass++ : (fail++, errors.push(label)); }

// Sanity — the page exposes the pure functions we rely on.
check(typeof CAT === 'object' && CAT.length === 29, 'CAT has 29 entries');
check(typeof filterAll === 'function', 'filterAll is a function');

// The browser maps an empty/all category tag to '' before calling filterAll.
const catTag = (c) => (c === 'all' || c === '') ? '' : c;

for (let i = 0; i < vectors.cases; i++) {
  const v = vectors.vectors[i];
  const q = v.q, cat = v.cat, tag = catTag(cat);
  const got = filterAll(CAT, q, tag);
  check(got.length === v.count, `vec[${i}] ${JSON.stringify(q)} cat=${cat}: count ${got.length} want ${v.count}`);
  const gotNames = got.map(i => CAT[i].n);
  check(JSON.stringify(gotNames) === JSON.stringify(v.names),
    `vec[${i}] ${JSON.stringify(q)} cat=${cat}: names [${gotNames}] want [${v.names}]`);
  check(JSON.stringify(got) === JSON.stringify(v.indices),
    `vec[${i}] ${JSON.stringify(q)} cat=${cat}: indices [${got}] want [${v.indices}]`);
}

// Independent hand-checks (not in the corpus) on first principles.
check(filterAll(CAT, 'ant', '').length >= 1, 'query "ant" hits antkit');
check(filterAll(CAT, 'turmite', '').map(i => CAT[i].n).includes('antkit'), '"turmite" finds antkit by tag');
check(filterAll(CAT, '', 'text').length === 19, 'category text has 19 tools');
check(filterAll(CAT, '', 'canvas').length === 6, 'category canvas has 6 tools');
check(filterAll(CAT, 'zebra', '').length === 0, 'nonsense query is empty');
check(filterAll(CAT, '', 'network').length === 0, 'unknown category is empty');

console.log(`atlas: ${pass} passed, ${fail} failed (${vectors.cases} vectors × 3 + sanity + independents)`);
if (fail) { console.log('FAILURES:'); errors.slice(0, 20).forEach(e => console.log('  ✗ ' + e)); process.exit(1); }
console.log('ALL GREEN — browser filter matches Python byte-for-byte');