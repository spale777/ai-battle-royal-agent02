#!/usr/bin/env node
// test-sortviz.js — mirrors the pure core (tracers + generator) from site/sortviz.html
// and proves: every algorithm's final snapshot is sorted, and the generator is
// deterministic for a given seed.
'use strict';
const assert = require('assert');

// --- mirrored pure core (identical to the HTML) ---
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function genArray(seed, n, maxVal){
  const rnd = mulberry32(seed), a = [];
  for (let i = 0; i < n; i++) a.push(1 + Math.floor(rnd() * maxVal));
  return a;
}
function traceBubble(src){ const r=[];let a=src.slice(),n=a.length,c=0,w=0;
  for(let i=0;i<n-1;i++){let sw=false;for(let j=0;j<n-1-i;j++){c++;r.push({a:a.slice(),cmp:[j,j+1],wrt:null});
    if(a[j]>a[j+1]){let t=a[j];a[j]=a[j+1];a[j+1]=t;w+=2;sw=true;r.push({a:a.slice(),cmp:null,wrt:[j,j+1]});}}if(!sw)break;}
  r.push({a:a.slice(),cmp:null,wrt:null,done:true});return{steps:r,comparisons:c,writes:w};}
function traceSelection(src){const r=[];let a=src.slice(),n=a.length,c=0,w=0;
  for(let i=0;i<n-1;i++){let m=i;for(let j=i+1;j<n;j++){c++;r.push({a:a.slice(),cmp:[m,j],wrt:null});if(a[j]<a[m])m=j;}
    if(m!==i){let t=a[i];a[i]=a[m];a[m]=t;w+=2;r.push({a:a.slice(),cmp:null,wrt:[i,m]});}}
  r.push({a:a.slice(),cmp:null,wrt:null,done:true});return{steps:r,comparisons:c,writes:w};}
function traceInsertion(src){const r=[];let a=src.slice(),n=a.length,c=0,w=0;
  for(let i=1;i<n;i++){let j=i;while(j>0){c++;r.push({a:a.slice(),cmp:[j-1,j],wrt:null});
    if(a[j-1]<=a[j])break;let t=a[j];a[j]=a[j-1];a[j-1]=t;w+=2;r.push({a:a.slice(),cmp:null,wrt:[j-1,j]});j--;}}
  r.push({a:a.slice(),cmp:null,wrt:null,done:true});return{steps:r,comparisons:c,writes:w};}
function traceShell(src){const r=[];let a=src.slice(),n=a.length,c=0,w=0;
  for(let gap=(n>>1);gap>0;gap=gap>>1){for(let i=gap;i<n;i++){const t=a[i];let j=i;
    while(j>=gap){c++;r.push({a:a.slice(),cmp:[j-gap,j],wrt:null});if(a[j-gap]<=t)break;
      a[j]=a[j-gap];w++;r.push({a:a.slice(),cmp:null,wrt:[j]});j-=gap;}
    if(j!==i){a[j]=t;w++;r.push({a:a.slice(),cmp:null,wrt:[j]});}}}
  r.push({a:a.slice(),cmp:null,wrt:null,done:true});return{steps:r,comparisons:c,writes:w};}
function traceMerge(src){const r=[];let a=src.slice(),n=a.length,tmp=a.slice(),c=0,w=0;
  for(let width=1;width<n;width*=2){for(let lo=0;lo<n;lo+=2*width){const mid=Math.min(lo+width,n),hi=Math.min(lo+2*width,n);
    if(mid>=hi)continue;for(let x=lo;x<hi;x++)tmp[x]=a[x];let i=lo,j=mid,k=lo;
    while(i<mid&&j<hi){c++;r.push({a:a.slice(),cmp:[i,j],wrt:null});if(tmp[i]<=tmp[j]){a[k++]=tmp[i++];w++;r.push({a:a.slice(),cmp:null,wrt:[k-1]});}
      else{a[k++]=tmp[j++];w++;r.push({a:a.slice(),cmp:null,wrt:[k-1]});}}
    while(i<mid){a[k++]=tmp[i++];w++;r.push({a:a.slice(),cmp:null,wrt:[k-1]});}
    while(j<hi){a[k++]=tmp[j++];w++;r.push({a:a.slice(),cmp:null,wrt:[k-1]});}}}
  r.push({a:a.slice(),cmp:null,wrt:null,done:true});return{steps:r,comparisons:c,writes:w};}
function traceQuick(src){const r=[];let a=src.slice(),n=a.length,c=0,w=0,stack=[[0,n-1]];
  while(stack.length){let lo,hi;[lo,hi]=stack.pop();if(lo>=hi)continue;const pv=a[hi];let i=lo;
    for(let j=lo;j<hi;j++){c++;r.push({a:a.slice(),cmp:[j,hi],wrt:null});
      if(a[j]<=pv){if(i!==j){let t=a[i];a[i]=a[j];a[j]=t;w+=2;r.push({a:a.slice(),cmp:null,wrt:[i,j]});}i++;}}
    if(i!==hi){let t=a[i];a[i]=a[hi];a[hi]=t;w+=2;r.push({a:a.slice(),cmp:null,wrt:[i,hi]});}
    stack.push([lo,i-1]);stack.push([i+1,hi]);}
  r.push({a:a.slice(),cmp:null,wrt:null,done:true});return{steps:r,comparisons:c,writes:w};}
function traceHeap(src){const r=[];let a=src.slice(),n=a.length,c=0,w=0;
  function sift(root,end){for(;;){let child=2*root+1;if(child>end)break;
    if(child+1<=end){c++;r.push({a:a.slice(),cmp:[child,child+1],wrt:null});if(a[child+1]>a[child])child++;}
    c++;r.push({a:a.slice(),cmp:[root,child],wrt:null});if(a[root]>=a[child])break;
    let t=a[root];a[root]=a[child];a[child]=t;w+=2;r.push({a:a.slice(),cmp:null,wrt:[root,child]});root=child;}}
  for(let i=(n>>1)-1;i>=0;i--)sift(i,n-1);
  for(let end=n-1;end>0;end--){let t=a[0];a[0]=a[end];a[end]=t;w+=2;r.push({a:a.slice(),cmp:null,wrt:[0,end]});sift(0,end-1);}
  r.push({a:a.slice(),cmp:null,wrt:null,done:true});return{steps:r,comparisons:c,writes:w};}
const TRACERS={bubble:traceBubble,selection:traceSelection,insertion:traceInsertion,
  shell:traceShell,merge:traceMerge,quick:traceQuick,heap:traceHeap};
const ALGOS=Object.keys(TRACERS);

let pass=0;
function ok(cond,msg){ if(!cond){ console.error('FAIL: '+msg); process.exit(1);} pass++; }

// 1. Every algorithm provably sorts a family of arrays (sizes 8..48, several seeds).
const seeds=[1,42,1234,777,99999,31337];
for (const algo of ALGOS){
  for (const seed of seeds){
    for (const size of [8,9,15,16,17,31,32,40]){
      const src=genArray(seed,size,100);
      const {steps}=TRACERS[algo](src);
      const last=steps[steps.length-1];
      ok(last.a.length===size, algo+' size '+size+' length');
      for(let i=1;i<last.a.length;i++) ok(last.a[i-1]<=last.a[i],
        algo+' seed '+seed+' size '+size+' sorted @'+i);
      // multiset preserved
      ok(last.a.slice().sort((x,y)=>x-y).join(',')===src.slice().sort((x,y)=>x-y).join(','),
        algo+' seed '+seed+' size '+size+' multiset');
    }
  }
}

// 2. Edge: tiny arrays (0,1,2) don't crash and are sorted.
for (const algo of ALGOS){
  for (const size of [0,1,2]){
    const src=genArray(7,size,100);
    const {steps}=TRACERS[algo](src);
    const last=steps[steps.length-1];
    for(let i=1;i<size;i++) ok(last.a[i-1]<=last.a[i], algo+' tiny '+size);
  }
}

// 3. Determinism: same seed → same array; different seed → (usually) different.
const A=genArray(99,50,100), B=genArray(99,50,100);
ok(A.join(',')===B.join(','),'gen determinism');
ok(genArray(99,50,100).join(',')!==genArray(100,50,100).join(','),'seeds differ');

// 4. Comparison-style sanity: bubble compares increase with size; each algo returns
//    a reasonable number of steps (no infinite loops).
for (const algo of ALGOS){
  const {steps,comparisons}=TRACERS[algo](genArray(5,60,100));
  ok(steps.length>60 && steps.length<200000, algo+' step count sane ('+steps.length+')');
  ok(comparisons>0, algo+' has comparisons');
}

console.log('sortviz: '+pass+' passed, 0 failed');
