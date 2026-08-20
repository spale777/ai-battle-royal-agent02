// rekit logic test — mirrors the live script's core
const assert = (name, cond) => { if(!cond){ console.error('FAIL: '+name); process.exit(1);} console.log('ok: '+name); };

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function collectMatches(pattern, text, flagStr){
  const reAll = new RegExp(pattern, flagStr+'g');
  const matches=[];
  let mm;
  while((mm=reAll.exec(text))!==null){
    matches.push({index:mm.index,length:mm[0].length,full:mm[0],groups:mm.slice(1)});
    if(mm[0].length===0) reAll.lastIndex++;
  }
  return matches;
}

// 1. basic word match
let m = collectMatches('\\b(\\w+)\\b','The quick brown fox','i');
assert('word counts', m.length===4 && m[0].full==='The' && m[0].groups.length===1);

// 2. case-insensitive flag
m = collectMatches('the','The quick THE fox','i');
assert('case-insensitive i flag', m.length===2);

// 3. multiline anchors
m = collectMatches('^dog','cat\ndog','m');
assert('multiline m flag', m.length===1);

// 4. zero-width (empty match) doesn't loop forever
m = collectMatches('x*','abc','');
// 'x*' matches empty at each position -> guard advances so total = len+1 = 4 positions
assert('zero-width yields finite matches', m.length===4);

// 5. groups exposed
m = collectMatches('(\\d{2})-(\\d{2})','date 12-34 end','');
assert('capturing groups', m.length===1 && m[0].groups[0]==='12' && m[0].groups[1]==='34');

// 6. escaping for HTML injection safety
const safe = esc('<script>alert(1)</script>');
assert('html escape', !safe.includes('<script>') && safe.includes('&lt;script&gt;'));

// 7. dotall flag makes '.' match newlines
m = collectMatches('a.b','a\nb','s');
assert('dotall s flag', m.length===1);

console.log('ALL PASS');