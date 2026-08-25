#!/usr/bin/env node
/* Non-circular deterministic proof for mandelkit.
   This does NOT re-implement the fractal math (that would be circular).
   It LOADS the page's real pure core (the escCount function sliced out of
   site/mandelkit.html between the CORE markers), runs it in a vm sandbox, and
   diffs its integer escape counts against scripts/vectors-mandelkit.json — a
   Python-generated ground-truth corpus. Same method as test-caviz.js /
   test-ecakit.js. */
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("site/mandelkit.html", "utf8");
const m = html.match(/\/\* === CORE BEGIN === \*\/([\s\S]*?)\/\* === CORE END === \*\//);
if (!m) { console.error("CORE markers not found"); process.exit(1); }
const coreSrc = m[1];

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox);
const escCount = sandbox.escCount;

const vectors = JSON.parse(fs.readFileSync("scripts/vectors-mandelkit.json", "utf8"));

let pass = 0, fail = 0;
const fails = [];
for (const v of vectors) {
  const { w, h, maxiter, span, center, jc, counts, kind } = v;
  const [cx0, cy0] = center;
  const aspect = h / w;
  const halfA = span / 2;
  const halfHA = span * aspect / 2;
  let idx = 0;
  let sum = 0, inside = 0;
  for (let j = 0; j < h; j++) {
    const im = cy0 + halfHA - (j / h) * span * aspect;
    for (let i = 0; i < w; i++) {
      const re = cx0 + (i / w - 0.5) * span;
      const n = kind === "mandelbrot"
        ? escCount(0, 0, re, im, maxiter)
        : escCount(re, im, jc[0], jc[1], maxiter);
      const exp = counts[idx++];
      if (n === exp) pass++; else { fail++; if (fails.length < 12) fails.push(`${v.label}[${idx-1}] got ${n} exp ${exp} at (${re.toFixed(6)},${im.toFixed(6)})`); }
      sum += n;
      if (n >= maxiter) inside++;
    }
  }
  if (sum !== v.sum) { fail++; fails.push(`${v.label} SUM got ${sum} exp ${v.sum}`); }
  if (inside !== v.inside) { fail++; fails.push(`${v.label} INSIDE got ${inside} exp ${v.inside}`); }
}

console.log(`mandelkit esc-count checks: ${pass} passed, ${fail} failed`);
if (fails.length) { console.log("first failures:"); fails.slice(0,12).forEach(f=>console.log("  "+f)); process.exit(1); }
console.log("ALL GREEN — browser escCount matches Python byte-for-byte");
