#!/usr/bin/env python3
"""gen-epochkit-vectors.py — ground-truth civil-date vectors for epochkit.

Epoch -> {iso, y, mo, d, h, mi, s, wd} and iso_in -> epoch_out pairs, generated
from Python's datetime (the standard-library source of truth). The JS functions
in site/epochkit.html are tested against these in scripts/test-epochkit.js.
Millisecond/fractional precision is exercised via a separate round-trip check.
"""
import json, random
from datetime import datetime, timezone, timedelta

def iso_fmt(dt):
    # zero-pad year to 4 (Python %Y omits padding for year < 1000); ISO-8601 wants 4
    return ('0' * max(0, 4 - len(str(dt.year)))) + dt.strftime('%Y-%m-%dT%H:%M:%SZ')

def out():
    tests = []
    epoch_cases = [
        0, 1, 59, 60, 86400, 86400-1, 946684800, 951868800, 1700000000,
        2147483647, 1000000000, 1234567890, 1609459200, 1672531200, 1704067200,
        -1, -59, -86400, -2208988800, -62135596800,
    ]
    for e in epoch_cases:
        dt = datetime.fromtimestamp(e, tz=timezone.utc)
        tests.append({
            'epoch': e,
            'iso': iso_fmt(dt),
            'y': dt.year, 'mo': dt.month, 'd': dt.day,
            'h': dt.hour, 'mi': dt.minute, 's': dt.second,
            'wd': (dt.weekday() + 1) % 7,
        })
    # ISO strings (with offsets) to parse back
    iso_cases = [
        '2024-11-14T22:13:20Z', '1970-01-01T00:00:00Z', '2038-01-19T03:14:07Z',
        '2024-02-29T12:00:00Z', '1900-02-28T00:00:00Z', '1969-12-31T23:59:59Z',
        '0001-01-01T00:00:00Z', '2024-11-14T22:13:20+02:30', '2024-11-14T10:00:00-05:00',
    ]
    for s in iso_cases:
        norm = s.replace('Z', '+00:00')
        dt = datetime.fromisoformat(norm)
        tests.append({'iso_in': s, 'epoch_out': dt.timestamp()})
    # a few random modern epochs
    rnd = random.Random(42)
    for _ in range(6):
        e = rnd.randint(0, 4_100_000_000)
        dt = datetime.fromtimestamp(e, tz=timezone.utc)
        tests.append({
            'epoch': e, 'iso': iso_fmt(dt),
            'y': dt.year, 'mo': dt.month, 'd': dt.day,
            'h': dt.hour, 'mi': dt.minute, 's': dt.second,
            'wd': (dt.weekday() + 1) % 7,
        })
    return tests

if __name__ == '__main__':
    path = __file__.rsplit('/', 1)[0] + '/vectors-epochkit.json'
    with open(path, 'w') as f:
        json.dump(out(), f, indent=1)
    print('wrote', path)