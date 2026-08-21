// Test suite for casekit. Re-implements the pure conversion logic from
// site/casekit.html (mirrors the functions defined there).
'use strict';

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

function splitWords(s){
  var m = s.match(/[A-Z]{2,}(?=[A-Z][a-z]|[0-9]|$)|[A-Z]?[a-z]+|[A-Z]+|[0-9]+/g);
  return m || [];
}
function cap(w){ return w ? w[0].toUpperCase()+w.substr(1).toLowerCase() : w; }

function camelCase(s){ var w=splitWords(s); return w.map(function(x,i){ return i===0 ? x.toLowerCase() : cap(x); }).join(''); }
function pascalCase(s){ return splitWords(s).map(cap).join(''); }
function snakeCase(s){ return splitWords(s).map(function(x){return x.toLowerCase();}).join('_'); }
function screamingSnake(s){ return splitWords(s).map(function(x){return x.toUpperCase();}).join('_'); }
function kebabCase(s){ return splitWords(s).map(function(x){return x.toLowerCase();}).join('-'); }
function trainCase(s){ return splitWords(s).map(cap).join('-'); }
function lowerWords(s){ return splitWords(s).map(function(x){return x.toLowerCase();}).join(' '); }
function upperWords(s){ return splitWords(s).map(function(x){return x.toUpperCase();}).join(' '); }
function titleCase(s){ return splitWords(s).map(cap).join(' '); }
function sentenceCase(s){ var w=splitWords(s); return w.map(function(x,i){return i===0?cap(x):x.toLowerCase();}).join(' '); }
function dotCase(s){ return splitWords(s).map(function(x){return x.toLowerCase();}).join('.'); }

let pass=0, fail=0, errors=[];
function T(name, got, want){
  if(got===want){ pass++; }
  else { fail++; errors.push(`FAIL ${name}: got "${got}" want "${want}"`); }
}

// --- word splitting ---
T('split spaces', splitWords('the quick brown fox').join('|'), 'the|quick|brown|fox');
T('split underscores', splitWords('snake_case_word').join('|'), 'snake|case|word');
T('split hyphens', splitWords('kebab-case-word').join('|'), 'kebab|case|word');
T('split camelCase', splitWords('myCamelCase').join('|'), 'my|Camel|Case');
T('split leading acronym', splitWords('HTMLParser').join('|'), 'HTML|Parser');
T('split digits', splitWords('order 42 total').join('|'), 'order|42|total');
T('split punctuation cluster', splitWords('hello,   world!').join('|'), 'hello|world');
T('empty input', splitWords('').length, 0);
T('mixed crazy', splitWords('v2_HTTP-request body').join('|'), 'v|2|HTTP|request|body');

// conversions on a canonical phrase
const p = 'the quick brown fox jumps over the lazy dog';
T('camelCase', camelCase(p), 'theQuickBrownFoxJumpsOverTheLazyDog');
T('pascalCase', pascalCase(p), 'TheQuickBrownFoxJumpsOverTheLazyDog');
T('snake_case', snakeCase(p), 'the_quick_brown_fox_jumps_over_the_lazy_dog');
T('SCREAMING_SNAKE', screamingSnake(p), 'THE_QUICK_BROWN_FOX_JUMPS_OVER_THE_LAZY_DOG');
T('kebab-case', kebabCase(p), 'the-quick-brown-fox-jumps-over-the-lazy-dog');
T('train-case', trainCase(p), 'The-Quick-Brown-Fox-Jumps-Over-The-Lazy-Dog');
T('lower words', lowerWords(p), p);
T('UPPER WORDS', upperWords(p), p.toUpperCase());
T('title case', titleCase(p), 'The Quick Brown Fox Jumps Over The Lazy Dog');
T('sentence case', sentenceCase(p), 'The quick brown fox jumps over the lazy dog');
T('dot.case', dotCase(p), 'the.quick.brown.fox.jumps.over.the.lazy.dog');

// --- messy-input conversions
T('camel from mixed separators', camelCase('hello_world-baz qux'), 'helloWorldBazQux');
T('camel from camel', camelCase('alreadyCamel'), 'alreadyCamel');
T('pascal from camel', pascalCase('alreadyCamel'), 'AlreadyCamel');
T('snake from camel', snakeCase('alreadyCamel'), 'already_camel');
T('kebab from mixed', kebabCase('MyHTTP_Server'), 'my-http-server');
T('title from camel', titleCase('jsonParser'), 'Json Parser');
T('empty stays empty', snakeCase(''), '');

// --- escaping (attribute safety)
T('esc quotes', esc('a"b\'c'), 'a&quot;b&#39;c');
T('esc tags', esc('<b>&'), '&lt;b&gt;&amp;');

console.log(`\n${pass} passed, ${fail} failed`);
if(errors.length) console.log(errors.join('\n'));
process.exit(fail?1:0);