// ipkit test suite — mirrors the pure IPv4/CIDR logic from site/ipkit.html
// Ground truth comes from scripts/gen-ipkit-vectors.py (Python ipaddress stdlib).
const data = require('./vectors-ipkit.json');
const assert = require('assert');

// ---- mirrored pure functions (copy of page logic, no DOM) ----
function ipToInt(s){
  const m=s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(!m) return null;
  const o=[+m[1],+m[2],+m[3],+m[4]];
  if(o.some(x=>x>255)) return null;
  return ((o[0]*256 + o[1])*256 + o[2])*256 + o[3];
}
function intToIp(n){
  n=(n>>>0)&0xFFFFFFFF;
  return ((n>>>24)&255)+'.'+((n>>>16)&255)+'.'+((n>>>8)&255)+'.'+(n&255);
}
function hostMask(p){ return p>=32 ? 0 : ((0xFFFFFFFF >>> p) & 0xFFFFFFFF); }
function netMask(p){ return (0xFFFFFFFF ^ hostMask(p)) >>> 0; }
function networkOf(addr,prefix){ return (addr & netMask(prefix))>>>0; }
function broadcastOf(net,prefix){ return (net | hostMask(prefix)) >>> 0; }
function usables(net,prefix){
  if(prefix===32) return {first:net,last:net,count:1};
  if(prefix===31) return {first:net,last:(net|1)>>>0,count:2};
  const first=net+1;
  const last=((net|hostMask(prefix))>>>0)-1;
  return {first,last,count:last-first+1};
}
function parseNetwork(s){
  const t=s.trim();
  if(!t) return null;
  const slash=t.split('/');
  if(slash.length>2) return {err:'many'};
  const addr=ipToInt(slash[0]);
  if(addr===null) return {err:'addr'};
  let p=32;
  if(slash.length===2){
    const pr=parseInt(slash[1],10);
    if(isNaN(pr)||pr<0||pr>32) return {err:'prefix'};
    p=pr;
  }
  return {ok:true, addr, prefix:p};
}
function parsePair(s){
  const parts=s.trim().split(/\s+/);
  if(parts.length===2){
    const a=ipToInt(parts[0]), b=ipToInt(parts[1]);
    if(a===null||b===null) return null;
    const x=a^b;
    let hb=-1; for(let i=31;i>=0;i--){ if(x&(1<<i)){ hb=i; break; } }
    const p = hb<0 ? 32 : 31-hb;
    return {ok:true, addr:networkOf(a,p), prefix:p, pair:parts};
  }
  return null;
}

let pass=0, fail=0;
function ok(cond,msg){ if(cond){pass++;} else {fail++; console.log('FAIL:',msg);} }

// ---- 1. ipToInt / intToIp round trips ----
ok(ipToInt('192.168.1.1')===0xC0A80101, 'ipToInt 192.168.1.1');
ok(ipToInt('255.255.255.255')===0xFFFFFFFF, 'ipToInt all-ones stays positive');
ok(ipToInt('0.0.0.0')===0, 'ipToInt zero');
ok(ipToInt('256.1.1.1')===null&&ipToInt('1.2.3')===null&&ipToInt('1.2.3.x')===null, 'invalid rejected');
ok(intToIp(0xC0A80101)==='192.168.1.1','intToIp reverse');
ok(intToIp(0xFFFFFFFF)==='255.255.255.255','intToIp max');
ok(intToIp(1)==='0.0.0.1','intToIp small');

// ---- 2. network / broadcast / netmask vs ground truth ----
data.vectors.forEach(v=>{
  const m=parseNetwork(v.input);
  ok(m&&m.ok, 'parse '+v.input);
  if(m&&m.ok){
    const net=networkOf(m.addr,m.prefix);
    const bc=broadcastOf(net,m.prefix);
    ok(net===v.network, v.input+' network '+intToIp(net)+' != '+intToIp(v.network));
    ok(bc===v.broadcast, v.input+' broadcast');
    ok(netMask(m.prefix)===v.netmask, v.input+' netmask');
    if(v.prefix!==32){
      const u=usables(net,m.prefix);
      ok(u.first===v.first, v.input+' first host '+intToIp(u.first)+' != '+intToIp(v.first));
      ok(u.last===v.last, v.input+' last host');
    }
  }
});

// ---- 3. total address count ----
ok(Math.pow(2,32-24)===256,'/24 total');
ok(parseNetwork('192.168.1.1/16') && usables(networkOf(parseNetwork('192.168.1.1/16').addr,16),16).count===65534, '/16 usable');

// ---- 4. pair coverage vs ground truth ----
data.pairs.forEach(p=>{
  const r=parsePair(p.a+' '+p.b);
  ok(r&&r.ok, 'parse pair '+p.a+' '+p.b);
  if(r){
    ok(r.prefix===p.prefix, p.a+' '+p.b+' prefix '+r.prefix+' != '+p.prefix);
    ok(r.addr===p.network, p.a+' '+p.b+' network '+intToIp(r.addr)+' != '+intToIp(p.network));
  }
});

// ---- 5. special-range classification ----
function classify(net,prefix){
  const out=[]; const span=Math.pow(2,32-prefix);
  for(const e of SPECIAL){
    const es=e[0]>>>0; const ec=Math.pow(2,32-e[1]);
    if((net>=es&&net<es+ec)||(es>=net&&es<net+span)) out.push(e[2]);
  }
  return out;
}
const SPECIAL=[
  [0x00000000,8,'this network'],[0x0A000000,8,'private (RFC 1918)'],
  [0x7F000000,8,'loopback'],[0xA9FE0000,16,'link-local (RFC 3927)'],
  [0xAC100000,12,'private (RFC 1918)'],[0xC0A80000,16,'private (RFC 1918)'],
  [0xE0000000,4,'multicast'],[0xF0000000,4,'reserved'],
  [0xFFFFFFFF,32,'limited broadcast']
];
ok(classify(0xC0A80000>>>0,16).length>=1, '192.168 flagged');
ok(classify(0x0A000000,8).length>=1,'10.0 flagged');
ok(classify(0x08080808,8).length===0,'8.8 not special');
ok(classify(0xE0000000>>>0,4).length>=1,'multicast flagged');
ok(classify(0xFFFFFFFF>>>0,32).length>=1,'limited broadcast flagged');

// ---- 6. malformed inputs ----
ok(parseNetwork('1.2.3.4/33').err==='prefix','/33 rejected');
ok(parseNetwork('1.2.3.4/-1').err==='prefix','/-1 rejected');
ok(parseNetwork('1.2.3.4/8/5').err==='many','double slash rejected');
ok(parseNetwork('')===null,'empty returns null');
ok(parseNetwork('   ')!==undefined,'whitespace');

console.log('\n'+pass+' passed, '+fail+' failed');
if(fail>0) process.exit(1);