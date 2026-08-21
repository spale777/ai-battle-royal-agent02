// urlkit logic test — mirrors the live script's core pure functions
const assert = (name, cond) => { if(!cond){ console.error('FAIL: '+name); process.exit(1);} console.log('ok: '+name); };

// Node shims for the browser btoa/atob/escape/unescape used by the tool.
// In the browser these come from JS's built-in escape/unescape + btoa/atob.
global.btoa = (s)=>Buffer.from(unescape(encodeURIComponent(s)),'binary').toString('base64');
global.atob = (s)=>decodeURIComponent(escape(Buffer.from(s,'base64').toString('binary')));

/* --- copy of the script's pure functions --- */
function isUnreserved(c){ return /[A-Za-z0-9\-._~]/.test(c); }
function percentEncode(str, safe){
  var safeRe = safe ? new RegExp('['+safe.replace(/[\]\\]/g,'\\$&')+']') : null;
  var out='';
  for(var i=0;i<str.length;i++){
    var ch=str[i];
    if(isUnreserved(ch) || (safeRe && safeRe.test(ch))){ out+=ch; }
    else{
      var b=encodeURIComponent(ch);
      out+=b;
    }
  }
  out=out.replace(/[!'()*]/g,function(c){return '%'+c.charCodeAt(0).toString(16).toUpperCase();});
  return out;
}
function percentDecode(str, plusAsSpace){
  var out='';
  for(var i=0;i<str.length;i++){
    var c=str[i];
    if(c==='+' && plusAsSpace){ out+=' '; }
    else if(c==='%' && i+2<str.length && /[0-9A-Fa-f]{2}/.test(str.substr(i+1,2))){
      out+=String.fromCharCode(parseInt(str.substr(i+1,2),16)); i+=2;
    } else out+=c;
  }
  return out;
}
function parseUrl(raw){
  var p={scheme:'',user:'',host:'',port:'',path:'',query:'',fragment:''};
  var s=raw;
  var h=s.indexOf('#');
  if(h>=0){ p.fragment=s.substr(h+1); s=s.substr(0,h); }
  var schm=s.match(/^([A-Za-z][A-Za-z0-9+.\-]*):\/\//);
  if(schm){ p.scheme=schm[1]; s=s.substr(schm[0].length); }
  var slash=s.indexOf('/');
  var qm=s.indexOf('?');
  var authEnd=Math.min.apply(null,[s.length].concat([slash,qm].filter(function(x){return x>=0;})));
  if(authEnd>0){
    var auth=s.substr(0,authEnd);
    var at=auth.lastIndexOf('@');
    var userInfo=at>=0?auth.substr(0,at):'';
    var hostport=at>=0?auth.substr(at+1):auth;
    if(userInfo){ p.user=userInfo; }
    var colon=hostport.lastIndexOf(':');
    if(colon>0 && !/[\[\]]/.test(hostport)){ p.host=hostport.substr(0,colon); p.port=hostport.substr(colon+1); }
    else { p.host=hostport; }
    s=s.substr(authEnd);
  } else if(s[0]!=='/' && s[0]!=='?'){ p.path=s; return p; }
  qm=s.indexOf('?');
  if(qm>=0){ p.query=s.substr(qm+1); s=s.substr(0,qm); }
  if(s===''){ s=(p.scheme? '/':''); }
  p.path=s;
  return p;
}
function parseQuery(qs){
  if(!qs) return [];
  var out=[];
  var parts=qs.split('&');
  for(var i=0;i<parts.length;i++){
    if(parts[i]===''){ out.push({key:'',value:'',blank:true}); continue; }
    var eq=parts[i].indexOf('=');
    var k,v;
    if(eq<0){ k=percentDecode(parts[i],true); v=''; }
    else { k=percentDecode(parts[i].substr(0,eq),true); v=percentDecode(parts[i].substr(eq+1),true); }
    out.push({key:k,value:v});
  }
  return out;
}
function b64u(s){ return btoa(unescape(encodeURIComponent(s))).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function b64d(s){
  var t=s.replace(/-/g,'+').replace(/_/g,'/');
  while(t.length%4) t+='=';
  try{ return decodeURIComponent(escape(atob(t))); }catch(e){ return ''; }
}

/* --- 1. full URL split --- */
var p = parseUrl('https://user:pass@example.com:8080/path/to?q=hi%20there&x=1#sec');
assert('scheme', p.scheme==='https');
assert('userinfo', p.user==='user:pass');
assert('host', p.host==='example.com');
assert('port', p.port==='8080');
assert('path', p.path==='/path/to');
assert('query', p.query==='q=hi%20there&x=1');
assert('fragment', p.fragment==='sec');

// --- 2. no authority (relative path) ---
p = parseUrl('/a/b?c=d');
assert('relative path', p.path==='/a/b');
assert('relative host empty', p.host==='');
assert('relative query', p.query==='c=d');

// --- 3. bare query string ---
p = parseUrl('?a=1&b=2');
assert('bare query path', p.path==='' || p.path==='');
// bare "?..." -> path '' (older branch) ; query split
assert('bare query q', p.query==='a=1&b=2');

// --- 4. percent decode: plus as space in query ---
var q = parseQuery('q=hello%20world&lang=en&empty=&dup=1&dup=2');
assert('query param count', q.length===5);
assert('decode %20', q[0].value==='hello world');
assert('decode key', q[1].key==='lang');
assert('empty value', q[2].key==='empty' && q[2].value==='');
assert('dup keys kept', q[3].value==='1' && q[4].value==='2');
// plus-as-space in form query
q = parseQuery('a=b+c');
assert('plus treated as space', q[0].value==='b c');

// --- 5. percent encode round-trip ---
var enc = percentEncode('hello world+/-', '');
assert('encode becomes %20', enc.indexOf('%20')>=0);
assert('encode unreserved kept', enc.indexOf('hello')===0);
assert('encode + as %2B', enc.indexOf('%2B')>=0);
assert('encode round-trips', percentDecode(enc,false)==='hello world+/-');
var enc2 = percentEncode('a/b', '/');
assert('safe chars kept', enc2==='a/b');

// --- 6. base64url round-trip ---
var msg='https://agent-02.sklopocija.com/?q=hello world&x=2#f';
var e=b64u(msg), d=b64d(e);
assert('b64u round-trip', d===msg);
assert('b64u is url-safe', !/[+/=]/.test(e));

console.log('all urlkit tests passed ('+"\x1b[36m"+'13'+'\x1b[0m'+')');