// basekit logic test — mirrors the live script's core pure functions
const assert = (name, cond) => { if(!cond){ console.error('FAIL: '+name); process.exit(1);} console.log('ok: '+name); };

var B64A='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8bytes(s){
  var out=[];
  for(var i=0;i<s.length;i++){
    var cp=s.codePointAt(i);
    if(cp>0xFFFF) i++;
    if(cp<0x80) out.push(cp);
    else if(cp<0x800) out.push(0xC0|(cp>>6), 0x80|(cp&0x3F));
    else if(cp<0x10000) out.push(0xE0|(cp>>12), 0x80|((cp>>6)&0x3F), 0x80|(cp&0x3F));
    else out.push(0xF0|(cp>>18), 0x80|((cp>>12)&0x3F), 0x80|((cp>>6)&0x3F), 0x80|(cp&0x3F));
  }
  return out;
}
function bytesToUtf8(b){
  var out='';
  for(var i=0;i<b.length;){
    var x=b[i];
    if(x<0x80){ out+=String.fromCodePoint(x); i++; }
    else if((x&0xE0)===0xC0){ out+=String.fromCodePoint(((x&0x1F)<<6)|(b[i+1]&0x3F)); i+=2; }
    else if((x&0xF0)===0xE0){ out+=String.fromCodePoint(((x&0x0F)<<12)|((b[i+1]&0x3F)<<6)|(b[i+2]&0x3F)); i+=3; }
    else if((x&0xF8)===0xF0){ out+=String.fromCodePoint(((x&0x07)<<18)|((b[i+1]&0x3F)<<12)|((b[i+2]&0x3F)<<6)|(b[i+3]&0x3F)); i+=4; }
    else i++;
  }
  return out;
}
function base64encode(s){
  var bytes=utf8bytes(s);
  var out='';
  for(var i=0;i<bytes.length;i+=3){
    var n=(bytes[i]<<16)|((i+1<bytes.length?bytes[i+1]:0)<<8)|(i+2<bytes.length?bytes[i+2]:0);
    out+=B64A[(n>>18)&63]+B64A[(n>>12)&63]+B64A[(n>>6)&63]+B64A[n&63];
  }
  var rem=bytes.length%3;
  if(rem===1) out=out.substr(0,out.length-2)+'==';
  else if(rem===2) out=out.substr(0,out.length-1)+'=';
  return out;
}
function base64decode(str){
  var t=str.replace(/\s+/g,'');
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(t) || t.length%4!==0) return null;
  var out=[];
  for(var i=0;i<t.length;i+=4){
    var chunk=t.substr(i,4);
    var pad=0;
    for(var p=3;p>=0;p--){ if(chunk[p]==='=') pad++; else break; }
    var n=0;
    for(var j=0;j<4;j++){
      var c=chunk[j];
      var v=(c==='=')?0:B64A.indexOf(c);
      if(v<0) return null;
      n=(n<<6)|v;
    }
    var bytes=3-pad;
    if(bytes>=1) out.push((n>>16)&0xFF);
    if(bytes>=2) out.push((n>>8)&0xFF);
    if(bytes>=3) out.push(n&0xFF);
  }
  return bytesToUtf8(out);
}
function base64urlEncode(s){ return base64encode(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function base64urlDecode(str){
  var t=str.replace(/-/g,'+').replace(/_/g,'/');
  while(t.length%4) t+='=';
  return base64decode(t);
}
function hexEncode(s){
  var bytes=utf8bytes(s);
  var out='';
  for(var i=0;i<bytes.length;i++) out+=(bytes[i]<16?'0':'')+bytes[i].toString(16);
  return out;
}
function hexDecode(str){
  var t=str.toLowerCase().replace(/\s+/g,'');
  if(!/^[0-9a-f]*$/.test(t) || t.length%2) return null;
  var bytes=[];
  for(var i=0;i<t.length;i+=2) bytes.push(parseInt(t.substr(i,2),16));
  return bytesToUtf8(bytes);
}
function detectDecode(str){
  var s=str.trim();
  if(!s) return {ok:false,msg:'nothing to decode'};
  var h=s.toLowerCase().replace(/\s+/g,'');
  if(h.length>0 && h.length%2===0 && /^[0-9a-f]+$/.test(h)){
    var tx=hexDecode(h);
    if(tx!==null && /[\x21-\x7E\u00A0-\uFFFF]/.test(tx)) return {ok:true,text:tx,how:'hex'};
  }
  var b2=null;
  if(!/[+/]/.test(s)){
    b2=base64urlDecode(s);
    if(b2!==null && !/[\uFFFD]/.test(b2) && /[A-Za-z0-9]/.test(b2)) return {ok:true,text:b2,how:'base64url'};
  }
  var b3=base64decode(s);
  if(b3!==null && !/[\uFFFD]/.test(b3) && /[A-Za-z0-9]/.test(b3)) return {ok:true,text:b3,how:'base64'};
  return {ok:false,text:'',how:''};
}

// --- 1. round-trips (ASCII) ---
var ascii='Hello, world!';
assert('b64 ascii', base64encode(ascii)==='SGVsbG8sIHdvcmxkIQ==');
assert('b64 ascii round-trip', base64decode(base64encode(ascii))===ascii);
assert('b64u ascii round-trip', base64urlDecode(base64urlEncode(ascii))===ascii);
assert('hex ascii round-trip', hexDecode(hexEncode(ascii))===ascii);

// --- 2. round-trips (unicode / emoji) ---
var uni='hello 你好 👋';
assert('b64 unicode round-trip', base64decode(base64encode(uni))===uni);
assert('b64u unicode round-trip', base64urlDecode(base64urlEncode(uni))===uni);
assert('hex unicode round-trip', hexDecode(hexEncode(uni))===uni);

// --- 3. base64url is URL-safe ---
var e=base64urlEncode(uni);
assert('b64u url-safe', !/[+/=]/.test(e));

// --- 4. padding lengths ---
assert('1-byte -> =', base64encode('a')==='YQ==');
assert('2-byte -> =', base64encode('ab')==='YWI=');
assert('3-byte none', base64encode('abc')==='YWJj');
assert('4-byte =', base64encode('abcd')==='YWJjZA==');

// --- 5. decode detection ---
assert('detect b64', detectDecode('SGVsbG8/eA==').how==='base64' && detectDecode('SGVsbG8/eA==').text==='Hello?x'); // '/' inside → standard only
assert('detect b64url', detectDecode('SGVsbG8_eA').how==='base64url' && detectDecode('SGVsbG8_eA').text==='Hello?x'); // '_' inside → url only
assert('detect hex', detectDecode('48656c6c6f').how==='hex');
assert('detect hex text', detectDecode('48656c6c6f').text==='Hello');
assert('reject garbage', detectDecode('zzz!!!').ok===false);

// --- 6. hex known value ---
assert('hex known', hexEncode('Hi')==='4869');
assert('hex null on odd', hexDecode('abc')===null);
assert('hex null on nonhex', hexDecode('4g')===null);

console.log('all basekit tests passed (\x1b[36m'+'20'+'\x1b[0m)');