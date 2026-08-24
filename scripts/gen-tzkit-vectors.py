#!/usr/bin/env python3
"""Generate ground-truth vectors for tzkit tests.
For a set of instant epochs and timezones, record the UTC offset (GMT+HH:MM),
the local wall time, and the local ISO datetime, computed via Python zoneinfo.
Output: scripts/vectors-tzkit.json
"""
import json, sys
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

ZONES = [
    "Etc/UTC", "Pacific/Midway", "Pacific/Honolulu", "America/Anchorage",
    "America/Los_Angeles", "America/Denver", "America/Chicago",
    "America/New_York", "America/Toronto", "America/Sao_Paulo",
    "America/Argentina/Buenos_Aires", "Atlantic/Reykjavik", "Europe/London",
    "Europe/Paris", "Europe/Berlin", "Europe/Athens", "Europe/Moscow",
    "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Bangkok",
    "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
]

# instants: epochs (seconds). Pick dates straddling DST transitions in
# northern (Mar/Oct Europe) and southern hemispheres (Apr/Sep NZ), plus a
# non-integer-offset zone.
INSTANTS = [
    0,                       # 1970-01-01T00:00:00Z
    1700000000,              # 2023-11-14 22:13:20Z
    1750000000,              # 2025-06-15 ~ summer northern
    1711929600,              # 2024-04-01 00:00:00Z (just after EU DST +1)
    1712102400,              # 2024-04-03 (EU summer, NZ just before autumn shift)
    1727654400,              # 2024-09-30 00:00:00Z (EU back -1 next day; NZ spring forward)
    1784736000,              # 2026-07-22 00:00:00Z
    1787000000,              # 2026-08-18  approx (current era)
]

def utc_offset_str(dt_utc, zone):
    loc = dt_utc.astimezone(ZoneInfo(zone))
    off = loc.utcoffset()
    total = int(off.total_seconds())
    sign = "+" if total >= 0 else "-"
    total = abs(total)
    hh = total // 3600
    mm = (total % 3600) // 60
    return f"UTC{sign}{hh:02d}:{mm:02d}"

def local_iso(dt_utc, zone):
    loc = dt_utc.astimezone(ZoneInfo(zone))
    return loc.strftime("%Y-%m-%dT%H:%M:%S")

def wall_time(dt_utc, zone):
    loc = dt_utc.astimezone(ZoneInfo(zone))
    return {
        "hour": int(loc.strftime("%H")),
        "minute": int(loc.strftime("%M")),
        "second": int(loc.strftime("%S")),
        "date": loc.strftime("%a, %Y-%m-%d"),
        "sod": int(loc.strftime("%H"))*3600 + int(loc.strftime("%M"))*60 + int(loc.strftime("%S")),
    }

out = {"zones": ZONES, "vectors": []}
for e in INSTANTS:
    dt = datetime.fromtimestamp(e, tz=timezone.utc)
    for z in ZONES:
        out["vectors"].append({
            "epoch": e, "zone": z,
            "offset": utc_offset_str(dt, z),
            "iso": local_iso(dt, z),
            "wall": wall_time(dt, z),
        })

with open("scripts/vectors-tzkit.json", "w") as f:
    json.dump(out, f, indent=1)
print(f"wrote {len(out['vectors'])} vectors ({len(INSTANTS)} instants x {len(ZONES)} zones)")
