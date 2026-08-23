// colorkit test suite — mirrors the pure color logic from site/colorkit.html
// Ground truth for HSL/HSV comes from scripts/gen-colorkit-vectors.py (Python colorsys).
const assert = require('assert');
const vectors = require('./vectors-colorkit.json');

// ---- mirrored pure functions (copy of page logic, no DOM) ----
const DIGITS='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function p(x){ const h=x.toString(16).toUpperCase(); return h.length<2?'0'+h:h; }
function ch(v){ return v<0?0:(v>255?255:Math.round(v)); }
function hexFrom(c,withAlpha){
  if(withAlpha && c.a<255){ const aa=(c.a<16?'0':'')+c.a.toString(16); return '#'+p(c.r)+p(c.g)+p(c.b)+aa; }
  return '#'+p(c.r)+p(c.g)+p(c.b);
}
function hue2rgb(p,q,t){
  if(t<0)t+=1; if(t>1)t-=1;
  if(t<1/6)return p+(q-p)*6*t;
  if(t<1/2)return q;
  if(t<2/3)return p+(q-p)*(2/3-t)*6;
  return p;
}
function hslToRgb(h,s,l){
  h=h/360; let r,g,b;
  if(s===0){ r=g=b=l; }
  else{
    const q=l<0.5?l*(1+s):l+s-l*s, pp=2*l-q;
    r=hue2rgb(pp,q,h+1/3); g=hue2rgb(pp,q,h); b=hue2rgb(pp,q,h-1/3);
  }
  return [r,g,b];
}
function round1(x){ return Math.round(x*10)/10; }
function rgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), l=(max+min)/2;
  let h=0, s=0;
  if(max!==min){
    const d=max-min;
    s=l>0.5?d/(2-max-min):d/(max+min);
    if(max===r) h=(g-b)/d+(g<b?6:0);
    else if(max===g) h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h*=60;
  }
  return {h:round1(h), s:round1(s*100), l:round1(l*100)};
}
// HSL -> hex (page renders hsl via rgb with 0..255 scale)
function hslToHex(h,s,l){
  const c=hslToRgb(h,s,l);
  return '#'+p(ch(c[0]*255))+p(ch(c[1]*255))+p(ch(c[2]*255));
}

let pass=0, fail=0;
function ok(cond,msg){ if(cond){pass++;} else {fail++; console.log('FAIL:',msg);} }

// ---- 1. hex parsing ----
ok(JSON.stringify(parseHex('#f80'))==='{"r":255,"g":136,"b":0}', 'hex #f80');
ok(JSON.stringify(parseHex('#ff8800'))==='{"r":255,"g":136,"b":0}', 'hex #ff8800');
ok(JSON.stringify(parseHex('#ff880080'))==='{"r":255,"g":136,"b":0,"a":128}', 'hex #ff880080');
ok(parseHex('#zzz')===null && parseHex('nope')===null, 'invalid hex rejected');

// rgb()/hsl() parsing (mirrors page cchan/achan)
function ch3(v){ return v<0?0:(v>255?255:Math.round(v)); }
function channelC(t){ return t.indexOf('%')>=0? parseFloat(t)/100*255 : parseFloat(t); }
function alphaC(m,i){ if(m[i]===undefined) return 255; const t=m[i];
  if(t.indexOf('%')>=0) return parseFloat(t)/100*255;
  const v=parseFloat(t); return (v>=0&&v<=1)? v*255 : v; }
function rgbre(s){
  const m=/^rgba?\(([0-9.]+%?)\s*[, ]\s*([0-9.]+%?)\s*[, ]\s*([0-9.]+%?)\s*(?:[,/]\s*([0-9.]+%?)\s*)?\)$/i.exec(s.trim());
  if(!m) return null;
  return {r:ch3(channelC(m[1])), g:ch3(channelC(m[2])), b:ch3(channelC(m[3])), a:ch3(alphaC(m,4))};
}
ok(JSON.stringify(rgbre('rgb(100 136 0)'))==='{"r":100,"g":136,"b":0,"a":255}', 'rgb spaces');
ok(JSON.stringify(rgbre('rgb(100% 50% 0%)'))==='{"r":255,"g":128,"b":0,"a":255}', 'rgb percent');
ok(JSON.stringify(rgbre('rgba(255,136,0,0.5)'))==='{"r":255,"g":136,"b":0,"a":128}', 'rgba fraction alpha');
ok(JSON.stringify(rgbre('rgba(255,136,0,50%)'))==='{"r":255,"g":136,"b":0,"a":128}', 'rgba percent alpha');
function alpha3(v){ return ch3(v); }
// hsl parse: reuse hslToRgb already tested; check hsl('rgb(0,0,255)') style returns its rgb
const HSL_TEST = (h,s,l)=>{ const c=hslToRgb(h,s,l); return {r:ch3(c[0]*255),g:ch3(c[1]*255),b:ch3(c[2]*255)}; };
ok(JSON.stringify(HSL_TEST(240,1,0.5))==='{"r":0,"g":0,"b":255}', 'hsl 240->blue');

function parseHex(s){
  const m=/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s.toLowerCase());
  if(!m) return null;
  const h=m[1];
  if(h.length===3||h.length===4){
    const o={r:parseInt(h[0]+h[0],16),g:parseInt(h[1]+h[1],16),b:parseInt(h[2]+h[2],16)};
    if(h.length===4)o.a=parseInt(h[3]+h[3],16);
    return o;
  }
  const o={r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)};
  if(h.length===8)o.a=parseInt(h.slice(6,8),16);
  return o;
}

// ---- 2. named colors ----
const NAMED={'red':[255,0,0],'lime':[0,255,0],'blue':[0,0,255],'white':[255,255,255],'black':[0,0,0],
 'tomato':[255,99,71],'rebeccapurple':[102,51,153],'orange':[255,165,0]};
function parseNamed(s){ const n=NAMED[s||'']; return n?{r:n[0],g:n[1],b:n[2],a:255}:null; }
ok(JSON.stringify(parseNamed('tomato'))==='{"r":255,"g":99,"b":71,"a":255}', 'named tomato');
ok(parseNamed('nope')===null, 'unknown name null');

// ---- 3. RGB->HSL vs Python vectors ----
for (const v of vectors.rgb_hsl){
  const got=rgbToHsl(v.r, v.g, v.b);
  ok(Math.abs(got.h - v.h) < 0.11 && Math.abs(got.s - v.s) < 0.11 && Math.abs(got.l - v.l) < 0.11,
     `rgb(${v.r},${v.g},${v.b}) hsl got ${got.h},${got.s},${got.l} want ${v.h},${v.s},${v.l}`);
}

// ---- 4. HSL->RGB round-trip (JS hslToRgb vs python-generated rgb) ----
for (const v of vectors.hsl_rgb){
  const c=hslToRgb(v.h,v.s,v.l);
  ok(Math.abs(c[0]-v.r/255)<=0.005 && Math.abs(c[1]-v.g/255)<=0.005 && Math.abs(c[2]-v.b/255)<=0.005,
     `hsl(${v.h},${v.s},${v.l}) got ${c} want ${v.r/255},${v.g/255},${v.b/255}`);
}

// ---- 5. cssColor / hex render ----
ok(hexFrom({r:255,g:136,b:0,a:255},false)==='#FF8800', 'hex render');
ok(hexFrom({r:255,g:136,b:0,a:128},true)==='#FF880080', 'hex alpha render');
ok(hexFrom({r:0,g:0,b:0,a:255},true)==='#000000', 'black hex');
ok(hslToHex(0,1,0.5)==='#FF0000', 'hsl 0 = red');
ok(hslToHex(120,1,0.5)==='#00FF00', 'hsl 120 = green');
ok(hslToHex(240,1,0.5)==='#0000FF', 'hsl 240 = blue');
ok(hslToHex(0,0,0.5)==='#808080', 'hsl gray 50%');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);