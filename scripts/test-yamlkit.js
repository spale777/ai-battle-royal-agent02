// yamlkit logic tests — run with: node scripts/test-yamlkit.js
// Re-implements the pure parser functions (parseScalar, findColon, stripComment,
// isSeqItem, parseYAML) so grammar regressions are caught at the boundary,
// mirroring the csvkit/jsonkit test-harness pattern.
function parseScalar(raw){
  var s=raw.trim();
  if(s==='')return null;
  if(/^(~|null|Null|NULL)$/.test(s))return null;
  if(/^(true|True|TRUE)$/.test(s))return true;
  if(/^(false|False|FALSE)$/.test(s))return false;
  if(/^-?\d+$/.test(s))return parseInt(s,10);
  if(/^-?[\d.]+$/.test(s)&&s.indexOf('.')>=0)return parseFloat(s);
  if(s[0]==='"'&&s[s.length-1]==='"')return s.slice(1,-1).replace(/\\"/g,'"').replace(/\\\\/g,'\\').replace(/\\n/g,'\n').replace(/\\t/g,'\t');
  if(s[0]==='\''&&s[s.length-1]==='\'')return s.slice(1,-1).replace(/''/g,"'");
  if(s[0]==='['&&s[s.length-1]===']'){
    var inn=s.slice(1,-1).trim();if(inn==='')return[];
    return inn.split(',').map(function(p){return parseScalar(p.trim());});
  }
  if(s[0]==='{'&&s[s.length-1]==='}'){
    var m={},inner=s.slice(1,-1).trim();
    if(inner!=='')inner.split(',').forEach(function(pair){
      var idx=findColon(pair);
      if(idx>=0)m[parseScalar(pair.slice(0,idx).trim())]=parseScalar(pair.slice(idx+1).trim());
    });
    return m;
  }
  return s;
}
function findColon(s){
  var q=null;
  for(var i=0;i<s.length;i++){
    var c=s[i];
    if(q){if(c===q)q=null;}
    else if(c==='"'||c==='\'')q=c;
    else if(c===':')return i;
  }
  return -1;
}
function stripComment(s){
  var q=null;
  for(var i=0;i<s.length;i++){
    var c=s[i];
    if(q){if(c===q)q=null;}
    else if(c==='"'||c==='\'')q=c;
    else if(c==='#'&&(i===0||s[i-1]===' '||s[i-1]==='\t'))return s.slice(0,i).replace(/\s+$/,'');
  }
  return s;
}
function isSeqItem(c){return c[0]==='-'&&(c.length===1||c[1]===' '||c[1]==='\t');}

function parseYAML(text){
  if(!text||!text.trim())return{ok:true,value:null,error:null};
  var lines=[];
  var src=text.replace(/\r\n/g,'\n').split('\n');
  for(var i=0;i<src.length;i++){
    var line=src[i];
    var ind=0;while(ind<line.length&&(line[ind]===' '||line[ind]==='\t'))ind++;
    var c=stripComment(line.slice(ind));
    if(c===''||c[0]==='#')continue;
    if(c==='---'||c==='...')continue;
    lines.push({indent:ind,content:c});
  }
  if(!lines.length)return{ok:true,value:null,error:null};
  var pos=0;
  function hasChild(ind){return pos<lines.length&&lines[pos].indent>ind;}
  function parseSeq(ind){
    var arr=[];
    while(pos<lines.length&&lines[pos].indent===ind&&isSeqItem(lines[pos].content)){
      var rest=lines[pos].content.slice(1).trim();
      var ci=findColon(rest);
      if(ci>=0){
        var k=rest.slice(0,ci).trim(),v=rest.slice(ci+1).trim();
        var item={};pos++;
        if(v!=='')item[k]=parseScalar(v);
        else{item[k]=null;if(hasChild(ind))item[k]=parseBlock();}
        while(pos<lines.length&&lines[pos].indent>ind&&findColon(lines[pos].content)>=0&&!isSeqItem(lines[pos].content)){
          var lc=lines[pos].content,lci=findColon(lc);
          var lk=lc.slice(0,lci).trim(),lv=lc.slice(lci+1).trim();
          pos++;
          if(lv===''){if(hasChild(ind))item[lk]=parseBlock();else item[lk]=null;}
          else item[lk]=parseScalar(lv);
        }
        arr.push(item);
      }else if(rest===''){
        pos++;var child=null;
        if(hasChild(ind))child=parseBlock();
        arr.push(child);
      }else{arr.push(parseScalar(rest));pos++;}
    }
    return arr;
  }
  function parseMap(ind){
    var obj={};
    while(pos<lines.length&&lines[pos].indent===ind&&!isSeqItem(lines[pos].content)){
      var c=lines[pos].content;
      var ci=findColon(c);
      if(ci<0){obj[c.trim()]=null;pos++;continue;}
      var k=c.slice(0,ci).trim(),v=c.slice(ci+1).trim();
      if(v===''){
        var kk=parseScalar(k);var key=''+kk;pos++;
        if(hasChild(ind))obj[key]=parseBlock();
        else obj[key]=null;
      }else{obj[parseScalar(k)]=parseScalar(v);pos++;}
    }
    return obj;
  }
  function parseBlock(){
    var ind=lines[pos].indent;
    var c=lines[pos].content;
    if(isSeqItem(c))return parseSeq(ind);
    if(findColon(c)>=0)return parseMap(ind);
    var v=parseScalar(c);pos++;return v;
  }
  var root=parseBlock();
  return{ok:true,value:root,error:null};
}

let pass=0,fail=0;
function eq(a,b,msg){
  const ja=JSON.stringify(a),jb=JSON.stringify(b);
  if(ja===jb){pass++;console.log('  ok  '+msg);}
  else{fail++;console.log('  FAIL '+msg+'\n       got      '+ja+'\n       expected '+jb);}
}
// scalar typing
eq(parseScalar('42'),42,'int scalar');
eq(parseScalar('3.14'),3.14,'float scalar');
eq(parseScalar('true'),true,'bool scalar');
eq(parseScalar('~'),null,'null tilde');
eq(parseScalar("'a:b'"),'a:b','single-quoted with colon stays string');
eq(parseScalar('"hi\\nthere"'),'hi\nthere','double-quoted newline escape');
eq(parseScalar('[a, b, 3]'),['a','b',3],'inline array');
eq(parseScalar('{x: 1, y: two}'),{x:1,y:'two'},'inline map');

// map with nested blocks
eq(parseYAML('a: 1\nb:\n  c: 2\n  d: 3').value,{a:1,b:{c:2,d:3}},'nested block map');
// sequence of scalars
eq(parseYAML('fruits:\n  - apple\n  - banana\n  - 7').value,{fruits:['apple','banana',7]},'seq of scalars');
// seq of maps
eq(parseYAML('people:\n  - name: a\n    age: 1\n  - name: b\n    age: 2').value,
  {people:[{name:'a',age:1},{name:'b',age:2}]},'seq of maps');
// top-level seq
eq(parseYAML('- x\n- y').value,['x','y'],'top-level seq');
// comments stripped
eq(parseYAML('a: 1  # trailing\n# whole comment\nb: 2').value,{a:1,b:2},'comments ignored');
// inline seq on one line
eq(parseYAML('tags: [x, y, z]').value,{tags:['x','y','z']},'inline array value');
// pointer-escaping helper
const pdf=t=>String(t).replace(/~/g,'~0').replace(/\//g,'~1');
eq(pdf('a/b'),'a~1b','pointer escape slash');
eq(pdf('a~b'),'a~0b','pointer escape tilde');

console.log('---');
console.log(pass+' passed, '+fail+' failed');
process.exit(fail?1:0);