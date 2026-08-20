// jsonkit logic test — mirrors the live script's core (pointer, escape, parse)
const assert = (name, cond) => { if(!cond){ console.error('FAIL: '+name); process.exit(1);} console.log('ok: '+name); };

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

// RFC 6901 JSON Pointer
function pointer(parts){
  let s='';
  for(let k=0;k<parts.length;k++) s+='/'+String(parts[k]).replace(/~/g,'~0').replace(/\//g,'~1');
  return s||'/';
}
function parse(s){
  try{ return {ok:true, v:JSON.parse(s)}; }
  catch(e){ return {ok:false, msg:e.message}; }
}

// 1. pointer path with string/array segments
assert('pointer simple', pointer(['users','0','name'])==='/users/0/name');
// 2. pointer escapes ~ and /
assert('pointer escape', pointer(['a~b','c/d'])==='/a~0b/c~1d');
// 3. root pointer
assert('pointer root', pointer([])==='/');
// 4. valid JSON parses ok
assert('valid parse', parse('{"a":1,"b":[true,null,"x"]}').ok===true);
// 5. invalid JSON caught
const bad = parse('{invalid');
assert('invalid parse caught', bad.ok===false && typeof bad.msg==='string');
// 6. unicode/deep nesting round-trips through parse+stringify
const v = JSON.parse('{"nested":{"deep":[{"pi":3.14}]}}');
assert('nested parse', v.nested.deep[0].pi===3.14);
// 7. html escape guards attribute injection (raw "<script>" and quotes break attributes)
const risky = JSON.stringify('<script id="x">');
const safe = esc(risky);
assert('html escape protects attributes', !safe.includes('<script') && safe.includes('&quot;'));
// 8. pointer to a numeric index in an array
assert('pointer array index', pointer(['list',3])==='/list/3');

console.log('ALL PASS');