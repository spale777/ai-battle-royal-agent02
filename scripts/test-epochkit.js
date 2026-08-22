// test-epochkit.js — node suite for epochkit's pure functions.
// Ground truth: Python-generated civil-date vectors (see gen-epochkit-vectors.py)
// plus known-answer boundaries. The pure logic (isLeap, daysFromCivil,
// civilFromDays, epochToUTC, isoFromUTC, parseISO, parseEpoch) lives inline in
// site/epochkit.html; here we stub the browser DOM and eval it whole.
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../site/epochkit.html', 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('NO SCRIPT FOUND'); process.exit(1); }
const js = m[1];

// ---- stub browser globals so the DOM wiring doesn't crash at load ----
function stubEl(){
  return { value:'', textContent:'', innerHTML:'', style:{}, addEventListener(){}, setAttribute(){}, getAttribute(){return '';}, querySelectorAll(){return [];} };
}
global.document = { getElementById:()=>stubEl() };
global.window = { location:{ hash:'', href:'' }, addEventListener(){} };
global.history = { replaceState(){} };
global.navigator = { clipboard:{ writeText:()=>new Promise(()=>{}), readText:()=>new Promise(()=> '') } };
global.addEventListener = ()=>{};

try {
  eval(js);
} catch(e) {
  console.error('EVAL FAILED', e.message);
  process.exit(1);
}

// sanity: pure fns should now exist
if (typeof epochToUTC !== 'function' || typeof parseISO !== 'function' || typeof daysFromCivil !== 'function') {
  console.error('PURE FUNCS MISSING after eval');
  process.exit(1);
}

let pass=0, fail=0;
function check(name, got, want){
  if(JSON.stringify(got)===JSON.stringify(want)){ pass++; }
  else { fail++; console.log('FAIL', name, 'got', JSON.stringify(got), 'want', JSON.stringify(want)); }
}

// ---- epoch -> civil date (UTC): Python-generated vectors ----
const vecs = JSON.parse(fs.readFileSync(__dirname + '/vectors-epochkit.json', 'utf8'));
for (const v of vecs) {
  if (v.epoch === undefined) continue;
  const u = epochToUTC(v.epoch);
  check('e2u '+v.epoch+' y', u.y, v.y);
  check('e2u '+v.epoch+' mo', u.mo, v.mo);
  check('e2u '+v.epoch+' d', u.d, v.d);
  check('e2u '+v.epoch+' h', u.h, v.h);
  check('e2u '+v.epoch+' mi', u.mi, v.mi);
  check('e2u '+v.epoch+' wd', u.wd, v.wd);
  check('e2u '+v.epoch+' iso', isoFromUTC(u), v.iso);
}

// ---- known day boundaries (negative / era edge) ----
check('daysFromCivil 1970-01-01', daysFromCivil(1970,1,1)*86400, 0);
check('daysFromCivil 1970-01-02', daysFromCivil(1970,1,2)*86400, 86400);
check('daysFromCivil 1969-12-31', daysFromCivil(1969,12,31)*86400, -86400);
check('daysFromCivil 1900-01-01', daysFromCivil(1900,1,1)*86400, -2208988800);
check('daysFromCivil 2000-02-29', daysFromCivil(2000,2,29)*86400, 951782400);
check('daysFromCivil 2000-03-01', daysFromCivil(2000,3,1)*86400, 951868800);
check('daysFromCivil year1', daysFromCivil(1,1,1)*86400, -62135596800);

// ---- ISO -> epoch (Python ground truth for offset cases) ----
for (const v of vecs) {
  if (v.iso_in === undefined) continue;
  check('pISO '+v.iso_in, parseISO(v.iso_in), v.epoch_out);
}
// explicit knowns
check('parseISO basic', parseISO('2024-11-14T22:13:20Z'), 1731622400);
check('parseISO epoch0', parseISO('1970-01-01T00:00:00Z'), 0);
check('parseISO 2038', parseISO('2038-01-19T03:14:07Z'), 2147483647);
check('parseISO leap', parseISO('2024-02-29T12:00:00Z'), 1709208000);
check('parseISO 1969', parseISO('1969-12-31T23:59:59Z'), -1);
check('parseISO off', parseISO('2024-11-14T10:00:00-05:00'), 1731596400);

// ---- validation / rejects ----
check('reject month 13', parseISO('2023-13-01T00:00:00Z'), null);
check('reject feb30', parseISO('2023-02-30T00:00:00Z'), null);
check('reject hour25', parseISO('2023-01-01T25:00:00Z'), null);
check('reject junk', parseISO('not a date'), null);
// no timezone is accepted and treated as UTC (documented choice for an epoch tool)
check('tz-less assumed UTC', parseISO('2023-11-14T22:13:20'), 1700000000);

// ---- fraction round-trip within 10ms ----
const fracEpoch = 1700000000.12345;
const rt = parseISO(isoFromUTC(epochToUTC(fracEpoch)));
check('frac roundtrip', Math.abs(rt - fracEpoch) < 0.005, true);

// ---- parseEpoch ms heuristic ----
check('parseEpoch sec', parseEpoch('1700000000'), 1700000000);
check('parseEpoch ms', parseEpoch('1700000000999'), 1700000000.999);
check('parseEpoch frac', parseEpoch('1700000000.5'), 1700000000.5);
check('parseEpoch neg', parseEpoch('-1000'), -1000);
check('parseEpoch junk', parseEpoch('abc'), null);

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);