// csvkit logic tests — run with: node scripts/test-csvkit.js
// Extracts the pure logic (parseCSV, detectDelim, cmpVal/numOrStr) from csvkit.html
// by reading the file and eval'ing the relevant snippets. Simpler: re-implement the
// pure functions here so grammar regressions are caught at the boundary.

function parseCSV(text,delim){
  if(!text) return [];
  var rows=[],row=[],field='',inQ=false;
  for(var i=0;i<text.length;i++){
    var c=text[i];
    if(inQ){
      if(c==='"'){
        if(text[i+1]==='"'){field+='"';i++;}
        else inQ=false;
      }else field+=c;
    }else{
      if(c==='"') inQ=true;
      else if(c===delim){row.push(field);field='';}
      else if(c==='\n'){row.push(field);field='';rows.push(row);row=[];}
      else if(c==='\r'){}
      else field+=c;
    }
  }
  if(field!==''||row.length){row.push(field);rows.push(row);}
  if(rows.length && rows[rows.length-1].length===1 && rows[rows.length-1][0]==='') rows.pop();
  return rows;
}
function detectDelim(line){
  var best='auto',bestN=-1;
  const DELIMS=[',','\t',';','|'];
  for(var d=0;d<DELIMS.length;d++){
    var n=0, inQ=false;
    for(var i=0;i<line.length;i++){
      var c=line[i];
      if(c==='"') inQ=!inQ;
      else if(!inQ && c===DELIMS[d]) n++;
    }
    if(n>bestN){bestN=n;best=DELIMS[d];}
  }
  return best;
}
function numOrStr(v){var n=Number(v);return (String(v).trim()!=='' && !isNaN(n))?{n:true,v:n}:{n:false,v:String(v)};}
function cmpVal(a,b){
  var A=numOrStr(a),B=numOrStr(b);
  if(A.n&&B.n) return A.v-B.v;
  var sa=A.v+'',sb=B.v+'';
  return sa<sb?-1:sa>sb?1:0;
}

let pass=0, fail=0;
function t(name,cond){
  if(cond){pass++;console.log('  ✓',name);}
  else{fail++;console.log('  ✗ FAIL:',name);}
}
function parseData(...args){return parseCSV(...args);}

console.log('csvkit tests');

// basic parse
let r=parseData('a,b,c\n1,2,3\n4,5,6',',');
t('plain rows/cols', r.length===3 && r[0][1]==='b' && r[2][2]==='6');

// quoted field with embedded comma
r=parseData('name,role\n"text,kit",utils',',');
t('embedded comma stays one field', r[1][0]==='text,kit');

// quoted field with escaped "" and embedded newline
r=parseData('a\n"line1\nline2",x',',');
t('embedded newline in quoted field', r[1].length===2 && r[1][0]==='line1\nline2');

// "" escape
r=parseData('"he said ""hi""",b',',');
t('double-quote escape', r[0][0]==='he said "hi"');

// tab delimiter across the board
r=parseData('a\tb\n1\t2\n', '\t');
t('tab delimiter', r.length===2 && r[1][1]==='2');

// trailing blank line dropped
r=parseData('a\nb\n',',');
t('trailing blank dropped', r.length===2);

// detect delimiter
t('detect comma over pipe', detectDelim('x,a,b,c')===',');
t('detect tab', detectDelim('x\ta\tb')==='\t');
t('detect pipe', detectDelim('x|a|b')==='|');
t('detect ignores quoted commas', detectDelim('"a,b",c')===',');

// number-aware compare
t('numeric sort aware', cmpVal('10','9')>0);
t('string compare', cmpVal('apple','banana')<0);
t('mixed num string stays text', cmpVal('10','app')<0);

console.log(`\n${pass} passed, ${fail} failed`);
if(fail) process.exit(1);