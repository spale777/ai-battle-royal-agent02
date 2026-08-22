// numbers test suite for numberkit — mirrors the pure functions in site/numberkit.html.
const assert = require('assert');

const DIGITS='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function digitVal(c){ const i=DIGITS.indexOf(c.toUpperCase()); return i<0?null:i; }

function parseBaseInt(s,b){
  s=s.trim();
  if(!s) return null;
  let neg=false;
  if(s[0]==='-'||s[0]==='+'){ neg=(s[0]==='-'); s=s.slice(1).trim(); }
  if(!s) return null;
  let n=0n;
  for(let i=0;i<s.length;i++){
    const d=digitVal(s[i]);
    if(d===null||d>=b) return null;
    n=n*BigInt(b)+BigInt(d);
  }
  return neg?(0n-n):n;
}
function renderBaseInt(n,b){
  if(n===0n) return '0';
  let neg=(n<0n); if(neg) n=0n-n;
  let out='';
  while(n>0n){ const r=Number(n%BigInt(b)); out=DIGITS[r]+out; n=n/BigInt(b); }
  return (neg?'-':'')+out;
}

const ROMAN_VALS=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
let ROMAN_RE=null;
function romanRegex(){
  if(ROMAN_RE) return ROMAN_RE;
  ROMAN_RE=new RegExp('^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$');
  return ROMAN_RE;
}
function toRoman(n){
  if(!Number.isInteger(n)||n<1||n>3999) return null;
  let out='',r=n;
  for(let i=0;i<ROMAN_VALS.length;i++){
    while(r>=ROMAN_VALS[i][0]){ out+=ROMAN_VALS[i][1]; r-=ROMAN_VALS[i][0]; }
  }
  return out;
}
function fromRoman(r){
  r=(r||'').trim().toUpperCase();
  if(!r) return null;
  if(!romanRegex().test(r)) return null;
  let out=0,i=0;
  for(let k=0;k<ROMAN_VALS.length;k++){
    const v=ROMAN_VALS[k];
    while(r.indexOf(v[1],i)===i){ out+=v[0]; i+=v[1].length; }
  }
  return out;
}

let pass=0, fail=0;
function check(name, got, want){
  if(String(got)===String(want)){ pass++; }
  else { fail++; console.log('FAIL', name, '→ got', String(got), 'want', String(want)); }
}

// --- base parse/render round trips (base 2..36) ---
const samples = ['0','1','7','10','15','16','31','32','255','256','1023','4095','65535','1000000','123456789','999999999999','18446744073709551615'];
for(const b of [2,3,8,10,16,20,32,36]){
  for(const s of samples){
    const n=parseBaseInt(s,10);
    const rendered=renderBaseInt(n,b);
    const back=parseBaseInt(rendered,b);
    check(`base${b} roundtrip ${s}`, back, n);
  }
}

// --- negatives ---
for(const s of ['-1','-42','-999999']){
  const n=parseBaseInt(s,10);
  check(`neg parse ${s}`, String(n), s);
  check(`neg render ${s}`, renderBaseInt(n,2), n.toString(2));  // BigInt.toString(radix) is ground truth
}

// --- invalid inputs ---
check('invalid binary digit 2', parseBaseInt('102',2), null);
check('invalid hex digit G', parseBaseInt('1G',16), null);
check('empty', parseBaseInt('',10), null);
check('only sign', parseBaseInt('-',10), null);

// --- Roman numerals ---
const romanCases=[ [1,'I'],[4,'IV'],[5,'V'],[9,'IX'],[10,'X'],[14,'XIV'],[40,'XL'],[49,'XLIX'],[90,'XC'],[99,'XCIX'],[100,'C'],[400,'CD'],[500,'D'],[900,'CM'],[1000,'M'],[1666,'MDCLXVI'],[1984,'MCMLXXXIV'],[2026,'MMXXVI'],[3999,'MMMCMXCIX'] ];
const romanExpected=romanCases;
for(const [d,r] of romanExpected){
  check(`toRoman ${d}`, toRoman(d), r);
  check(`fromRoman ${r}`, fromRoman(r), d);
}
check('roman too big', toRoman(4000), null);
check('roman too small', toRoman(0), null);
check('roman invalid chars', fromRoman('IIIIIIII'), null);
check('roman empty', fromRoman(''), null);

// --- BigInt arbitrary precision: a 64-bit and a 100-bit value ---
const big64='18446744073709551615';
check('big64 binary', renderBaseInt(BigInt(big64),2), BigInt(big64).toString(2));
const big100='1267650600228229401496703205377'; // 2^100 + 1
check('big100 hex', renderBaseInt(BigInt(big100),16), BigInt(big100).toString(16));

console.log(`\n${pass} passed, ${fail} failed`);
if(fail>0) process.exit(1);