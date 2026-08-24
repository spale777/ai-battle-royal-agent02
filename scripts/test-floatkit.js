#!/usr/bin/env node
/* test-floatkit.js — ground-truth floatkit IEEE-754 math against Python's struct/math.
   Extracts the pure functions from site/floatkit.html and compares against vectors-floatkit.json. */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../site/floatkit.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { throw new Error('no script block found'); }
const src = m[1];

/* Stub browser globals + DOM so the pure functions can be extracted and run
   (the page also registers event listeners at top level, which must be no-ops). */
const el = () => ({
  addEventListener(){}, value:'', innerHTML:'', textContent:'',
  appendChild(){}, removeChild(){}, getAttribute:()=>'', setAttribute(){},
  select(){}, closest(){return null;}, focus(){}, style:{}, dataset:{},
});
const sandbox = {
  document: {
    getElementById: el, querySelector: () => null, querySelectorAll: () => [],
    createElement: el, body: { appendChild(){}, removeChild(){} },
    addEventListener(){}, execCommand(){ return true; },
  },
  window: {
    location: { hash: '' }, addEventListener(){}, history: { replaceState(){} },
  },
  navigator: {},
  location: { href: '', hash: '' },
  btoa: s => Buffer.from(s, 'binary').toString('base64'),
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  history: { replaceState(){} },
};
const f = new Function('window','document','navigator','location','history','btoa','atob','TextEncoder','TextDecoder','console',
  src + '\n;return {parse,analyze,classify,decompose,numToU64,u64ToNum};');
const pure = f(sandbox.window, sandbox.document, sandbox.navigator, sandbox.location, sandbox.history, sandbox.btoa, sandbox.atob, TextEncoder, TextDecoder, console);

const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'vectors-floatkit.json'), 'utf8'));

let pass = 0, fail = 0;
function check(name, cond){
  if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); }
}
function close(a, b){
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'number' && isNaN(a) && typeof b === 'number' && isNaN(b)) return true;
  if (typeof a === 'string' && typeof b === 'string') return a === b && (a === 'NaN' || a === 'Infinity' || a === '-Infinity');
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/* --- parse: number direction --- */
check('parse number 0.1 -> num', pure.parse('0.1').num === 0.1);
check('parse number 1e308', pure.parse('1e308').num === 1e308);
check('parse Infinity', pure.parse('Infinity').num === Infinity);
check('parse -inf', pure.parse('-inf').num === -Infinity);
check('parse NaN', Number.isNaN(pure.parse('NaN').num));
check('parse 16-digit hex', pure.parse('0x3FF0000000000000').u === 0x3FF0000000000000n);
check('parse bare 16-digit hex', pure.parse('3FF0000000000000').u === 0x3FF0000000000000n);
check('parse 64 binary bits', pure.parse('0011111111110000000000000000000000000000000000000000000000000000').u === 0x3FF0000000000000n);
check('parse 8 byte pairs', pure.parse('3F F0 00 00 00 00 00 00').u === 0x3FF0000000000000n);
check('parse garbage rejects', pure.parse('hello world').err !== undefined);
check('parse empty rejects', pure.parse('').err !== undefined);

/* --- number-to-bits round trip (mirrors Python struct) --- */
function uhex(u){ return u.toString(16).padStart(16,'0').toUpperCase(); }
const numVecs = vectors.filter(v => !v.fromPattern);
check('num vectors count', numVecs.length === 49);
numVecs.forEach((v, i) => {
  const u = pure.numToU64(v.num);
  check(`nvec[${i}] ${v.raw} hex`, u16hex(u) === v.hex);
  check(`nvec[${i}] ${v.raw} decode-back`, pure.u64ToNum(u) === v.num || (typeof v.num === 'string' && (v.num==='NaN' ? Number.isNaN(pure.u64ToNum(u)) : pure.u64ToNum(u) === (v.num==='Infinity'?Infinity:-Infinity))));
});
function u16hex(u){ return u.toString(16).padStart(16,'0').toUpperCase(); }

/* --- analyze() against every vector (number + pattern) --- */
vectors.forEach((v, i) => {
  const d = pure.analyze(v.raw);
  if (v.fromPattern) {
    check(`vec[${i}] kind (${v.raw})`, d.kind === v.kind);
    check(`vec[${i}] hex`, d.hexStr.toUpperCase() === v.hex);
    check(`vec[${i}] sign`, d.sign === v.sign);
  } else {
    check(`vec[${i}] ${v.raw} kind`, d.kind === v.kind);
    check(`vec[${i}] ${v.raw} sign`, d.sign === v.sign);
    check(`vec[${i}] ${v.raw} hex`, d.hexStr.toUpperCase() === v.hex);
    check(`vec[${i}] ${v.raw} expBits`, d.expBits === v.expBits || (d.expBits == null && v.expBits == null) || (v.expBits === 'NaN'));
    check(`vec[${i}] ${v.raw} expBitsBin`, d.expBitsBin === (v.expBits != null && v.expBits !== 'NaN' ? v.expBits.toString(2).padStart(11,'0') : null));
    check(`vec[${i}] ${v.raw} unbiased`, close(d.unbiased, v.unbiased));
    check(`vec[${i}] ${v.raw} mantHex`, d.mantHex === (v.mant != null ? v.mant.toString(16).padStart(13,'0') : null));
    check(`vec[${i}] ${v.raw} significand`, close(d.significand, v.significand));
    check(`vec[${i}] ${v.raw} ulp`, close(d.ulp, v.ulp));
  }
});

/* --- decode pattern → number for a few known patterns --- */
check('decode 0x3FF0000000000000 → 1.0', pure.u64ToNum(0x3FF0000000000000n) === 1.0);
check('decode 0x7fefffffffffffff → DBL_MAX', pure.u64ToNum(0x7fefffffffffffffn) === 1.7976931348623157e308);
check('decode 0x0000000000000001 → min subnormal', pure.u64ToNum(0x0000000000000001n) === 4.9406564584124654e-324);
check('0.1 hex matches Python', pure.numToU64(0.1).toString(16) === '3fb999999999999a');

/* classify kinds */
check('classify zero', pure.classify(0n).kind === 'zero');
check('classify +0 vs -0 sign', pure.classify(0n).sign === false && pure.classify(0x8000000000000000n).sign === true);
check('classify infinity', pure.classify(0x7ff0000000000000n).kind === 'inf');
check('classify NaN', pure.classify(0x7ff8000000000000n).kind === 'nan');
check('classify qNaN quiet', pure.classify(0x7ff8000000000000n).quiet === true);
check('classify NaN signaling', pure.classify(0x7ff0000000000001n).quiet === false);
check('classify subnormal', pure.classify(0x0000000000000001n).kind === 'subnormal');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);