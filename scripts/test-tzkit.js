#!/usr/bin/env node
// tzkit test suite: mirrors the pure timezone logic and ground-truths it
// against Python zoneinfo vectors (scripts/vectors-tzkit.json).
"use strict";
const fs = require("fs");
const path = require("path");
const vecs = JSON.parse(fs.readFileSync(path.join(__dirname, "vectors-tzkit.json"), "utf8"));

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; fails.push(name + (detail ? " :: " + detail : "")); }
}

/* --- mirrored pure functions (from site/tzkit.html) --- */
function pad2(n){ return String(Math.abs(n)).padStart(2,"0"); }
const OFMT = {year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"};
function parts(date, zone){
  const p = new Intl.DateTimeFormat("en-US", Object.assign({timeZone:zone}, OFMT)).formatToParts(date);
  const g={}; p.forEach(x=>g[x.type]=x.value);
  return g;
}
function wallAsUTC(date, zone){
  const g = parts(date, zone);
  return Date.UTC(+g.year, +g.month-1, +g.day, +g.hour, +g.minute, +g.second);
}
function offsetStr(date, zone){
  try{
    const ms = wallAsUTC(date, zone) - Math.floor(date.getTime()/1000)*1000;
    const total = Math.round(ms/60000);
    const sign = total<0 ? "-" : "+";
    const a = Math.abs(total);
    return "UTC"+sign+pad2(Math.floor(a/60))+":"+pad2(a%60);
  }catch(e){ return "—"; }
}
function isoLocal(date, zone){
  const g = parts(date, zone);
  return g.year+"-"+g.month+"-"+g.day+"T"+pad2(+g.hour)+":"+g.minute+":"+g.second;
}
function wallParts(date, zone){
  const g = parts(date, zone);
  const w = new Intl.DateTimeFormat("en-US",{timeZone:zone,weekday:"short"}).formatToParts(date).find(x=>x.type==="weekday");
  g.weekday = w ? w.value : "";
  return g;
}

/* --- run ground truth --- */
const ZONES = vecs.zones;
for (const v of vecs.vectors) {
  const d = new Date(v.epoch * 1000);
  // offset string
  const off = offsetStr(d, v.zone);
  check(`offset ${v.zone}@${v.epoch}`, off === v.offset, `got ${off} want ${v.offset}`);

  // iso local
  const iso = isoLocal(d, v.zone);
  check(`iso ${v.zone}@${v.epoch}`, iso === v.iso, `got ${iso} want ${v.iso}`);

  // wall parts
  const wp = wallParts(d, v.zone);
  const sod = (+wp.hour)*3600 + (+wp.minute)*60 + (+wp.second);
  check(`sod ${v.zone}@${v.epoch}`, sod === v.wall.sod, `got ${sod} want ${v.wall.sod}`);
}

/* --- parseInstant logic (epoch number handling) --- */
function parseEpoch(raw){
  if(/^\d{1,15}$/.test(raw)){
    let n = +raw;
    if(n < 1e12) n *= 1000;
    return n;
  }
  return null;
}
check("epoch seconds 0 -> ms 0", parseEpoch("0") === 0);
check("epoch 1700000000 -> ms", parseEpoch("1700000000") === 1700000000000);
check("epoch 1700000000000 (ms) unchanged", parseEpoch("1700000000000") === 1700000000000);
check("epoch 1784736000000 (13-digit ms) unchanged", parseEpoch("1784736000000") === 1784736000000);

/* --- b64 round trip --- */
const b64u = s => Buffer.from(s).toString("base64").replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
const unb64u = s => { s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4)s+="="; return Buffer.from(s,"base64").toString("utf8"); };
check("b64u round trip", unb64u(b64u("1784736000000|Europe/Paris")) === "1784736000000|Europe/Paris");
check("b64u round trip now", unb64u(b64u("now|Etc/UTC")) === "now|Etc/UTC");

/* --- DST sanity (specific catches) --- */
// Paris in July 2025 should be +02:00 (CEST); London +01:00; Kolkata +05:30 (fixed)
const july = new Date("2025-07-01T12:00:00Z");
check("Paris July CEST +02", offsetStr(july, "Europe/Paris") === "UTC+02:00", offsetStr(july, "Europe/Paris"));
check("London July BST +01", offsetStr(july, "Europe/London") === "UTC+01:00", offsetStr(july, "Europe/London"));
check("Kolkata fixed +05:30", offsetStr(july, "Asia/Kolkata") === "UTC+05:30", offsetStr(july, "Asia/Kolkata"));
const jan = new Date("2025-01-15T12:00:00Z");
check("Paris Jan CET +01", offsetStr(jan, "Europe/Paris") === "UTC+01:00", offsetStr(jan, "Europe/Paris"));
// NZ southern hemisphere: January = summer (UTC+13, NZDT), July = winter (UTC+12)
check("Auckland Jan +13", offsetStr(jan, "Pacific/Auckland") === "UTC+13:00", offsetStr(jan, "Pacific/Auckland"));
check("Auckland July +12", offsetStr(july, "Pacific/Auckland") === "UTC+12:00", offsetStr(july, "Pacific/Auckland"));

/* --- wall-clock parse (bare date-time interpreted in source zone) --- */
function rawOffsetMs(zone, date){
  const g = parts(date, zone);
  const localAsUTC = Date.UTC(+g.year, +g.month-1, +g.day, +g.hour, +g.minute, +g.second);
  return localAsUTC - Math.floor(date.getTime()/1000)*1000;
}
function parseBareWall(raw, srcZone){
  let m = raw.split(/[-:\s]+/).map(Number);
  const y=m[0],mo=(m[1]||1),da=(m[2]||1),h=(m[3]||0),mi=(m[4]||0),s=(m[5]||0);
  const naiveUTC = Date.UTC(y, mo-1, da, h, mi, s);
  const off = rawOffsetMs(srcZone, new Date(naiveUTC));
  return new Date(naiveUTC - off);
}
// "2026-08-24 14:00" in Paris (UTC+2 summer) -> 12:00Z
{
  const d = parseBareWall("2026-08-24 14:00", "Europe/Paris");
  check("wall-clock Paris 2026-08-24 14:00 -> 12:00Z", d.toISOString() === "2026-08-24T12:00:00.000Z", d.toISOString());
}
// "2026-08-24 14:00" in Tokyo (UTC+9) -> 05:00Z
{
  const d = parseBareWall("2026-08-24 14:00", "Asia/Tokyo");
  check("wall-clock Tokyo 2026-08-24 14:00 -> 05:00Z", d.toISOString() === "2026-08-24T05:00:00.000Z", d.toISOString());
}
// "2026-01-15 12:00" in Paris (UTC+1 winter) -> 11:00Z
{
  const d = parseBareWall("2026-01-15 12:00", "Europe/Paris");
  check("wall-clock Paris winter 2026-01-15 12:00 -> 11:00Z", d.toISOString() === "2026-01-15T11:00:00.000Z", d.toISOString());
}

console.log(`tzkit: ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log("  FAIL " + f)); process.exit(1); }
