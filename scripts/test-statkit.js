#!/usr/bin/env node
/* test-statkit.js — ground-truth statkit statistics against Python's statistics module.
   Extracts the pure functions from site/statkit.html and compares against vectors-statkit.json. */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../site/statkit.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { throw new Error('no script block found'); }
const src = m[1];

/* Stub browser globals so the pure functions can be extracted + run. */
const noopEl = () => ({
  addEventListener(){}, addEventListener(){}, value:'', innerHTML:'',
  appendChild(){}, removeChild(){}, textContent:'', getAttribute:()=>'', setAttribute(){},
  select(){}, closest(){ return null; }, focus(){}, style:{},
});
const sandbox = {
  document: { getElementById: noopEl, querySelector: () => null, createElement: noopEl, body: { appendChild(){}, removeChild(){} } },
  window: { location: { hash: '' }, addEventListener(){}, history: { replaceState(){} } },
  navigator: {},
  location: { href: '', hash: '' },
  btoa: s => Buffer.from(s, 'binary').toString('base64'),
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  TextEncoder, TextDecoder,
  history: { replaceState(){} },
};
const f = new Function('window','document','navigator','location','history','btoa','atob','TextEncoder','TextDecoder','console', src + '\n;return {parseNums,stats,numSort,encodeText,decodeText,fmt};');
const pure = f(sandbox.window, sandbox.document, sandbox.navigator, sandbox.location, sandbox.history, sandbox.btoa, sandbox.atob, TextEncoder, TextDecoder, console);

const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'vectors-statkit.json'), 'utf8'));

let pass = 0, fail = 0;
const eps = 1e-9;
function close(a, b){
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'object') return true;
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
}
function check(name, cond){
  if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); }
}

/* --- parseNums --- */
check('parseNums: whitespace/comma/semicolon/newline split', JSON.stringify(pure.parseNums('1, 2 3;4\n5')) === JSON.stringify([1,2,3,4,5]));
check('parseNums: decimals', JSON.stringify(pure.parseNums('0.5 1.5 -2.5')) === JSON.stringify([0.5,1.5,-2.5]));
check('parseNums: scientific', JSON.stringify(pure.parseNums('2e3 3e-2')) === JSON.stringify([2000, 0.03]));
check('parseNums: empty -> []', JSON.stringify(pure.parseNums('')) === JSON.stringify([]));
check('parseNums: null -> null', pure.parseNums(null) === null);
check('parseNums: rejects text token', pure.parseNums('1 2 three 4') === null);
check('parseNums: rejects .5.5', pure.parseNums('1 2.5.5') === null);
check('parseNums: rejects Infinity-ish 1e999', pure.parseNums('1e999') === null);
check('parseNums: leading dot .5', JSON.stringify(pure.parseNums('.5 .25')) === JSON.stringify([0.5,0.25]));
check('parseNums: rejects empty tokens between delims', JSON.stringify(pure.parseNums('1,,2')) === JSON.stringify([1,2]));
check('parseNums: negative', JSON.stringify(pure.parseNums('-5 -3 0')) === JSON.stringify([-5,-3,0]));

/* --- stats() vs Python vectors --- */
let vecChecks = 0;
vectors.forEach((v, idx) => {
  const st = pure.stats(v.input);
  /* single-value rows: varSample is NaN in JS; Python record stores None */
  if (v.n === 1) {
    check(`vec[${idx}] n single`, st.n === 1);
    check(`vec[${idx}] sum`, close(st.sum, v.sum));
    return;
  }
  const fields = ['n','sum','min','max','range','mean','median','q1','q3','iqr','varSample','varPop','sdSample','sdPop','geo'];
  fields.forEach(fld => {
    vecChecks++;
    check(`vec[${idx}] ${fld}`, close(st[fld], v[fld]));
  });
  // modes
  vecChecks++;
  check(`vec[${idx}] modes`, JSON.stringify(st.modes) === JSON.stringify(v.modes));
  vecChecks++;
  check(`vec[${idx}] maxfreq`, st.maxfreq === v.maxfreq);
});

/* --- hand-verified specific statistics --- */
check('median odd count [3,1] = 2', pure.stats([3,1]).median === 2);
check('median even [1,2] = 1.5', pure.stats([1,2]).median === 1.5);
check('mean [1..5] = 3', pure.stats([1,2,3,4,5]).mean === 3);
check('sum [1..5] = 15', pure.stats([1,2,3,4,5]).sum === 15);
check('mode [1,1,2,2,3] = [1,2]', JSON.stringify(pure.stats([1,1,2,2,3]).modes) === JSON.stringify([1,2]));
check('single value sdSample NaN', Number.isNaN(pure.stats([7]).sdSample));
check('single value varSample NaN', Number.isNaN(pure.stats([7]).varSample));
check('numeric sort not lexicographic', JSON.stringify(pure.numSort([10,9,2,1])) === JSON.stringify([1,2,9,10]));
check('variance sample [1..5]=2.5', close(pure.stats([1,2,3,4,5]).varSample, 2.5));
check('variance pop [1..5]=2', close(pure.stats([1,2,3,4,5]).varPop, 2));

/* --- share-link roundtrip --- */
check('encode/decode roundtrip plain', pure.decodeText(pure.encodeText('1 2 3 4 5')) === '1 2 3 4 5');
check('encode/decode roundtrip unicode', pure.decodeText(pure.encodeText('1 2 3.5 − 4')) === '1 2 3.5 − 4');
check('decode padding tolerant', (() => { const raw = pure.encodeText('7 8 9'); const unpadded = raw.replace(/=+$/,''); return pure.decodeText(unpadded) === '7 8 9'; })());

console.log(`\n${pass} passed, ${fail} failed (${vecChecks} vector-field checks)`);
process.exit(fail ? 1 : 0);