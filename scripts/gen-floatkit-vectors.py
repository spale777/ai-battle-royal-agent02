#!/usr/bin/env python3
"""Generate IEEE-754 binary64 ground-truth vectors from Python's struct/math,
used to verify floatkit's hand-written JavaScript."""
import json, struct, math

def f2u(x):
    return struct.unpack('>Q', struct.pack('>d', x))[0]

def u2f(u):
    return struct.unpack('>d', struct.pack('>Q', u))[0]

def classify(u):
    sign = bool((u >> 63) & 1)
    e = (u >> 52) & 0x7FF
    mant = u & 0xFFFFFFFFFFFFF
    if e == 0x7FF:
        if mant == 0:
            return {'kind':'inf','sign':sign,'cls':'i'}
        quiet = (mant & (1<<51)) != 0
        return {'kind':'nan','sign':sign,'quiet':quiet,'cls':'x'}
    if e == 0:
        if mant == 0:
            return {'kind':'zero','sign':sign,'cls':'z'}
        return {'kind':'subnormal','sign':sign,'expBits':0,'mant':mant,'cls':'s'}
    return {'kind':'normal','sign':sign,'expBits':e,'mant':mant,'cls':'n'}

def num_or_None(v):
    if v is None:
        return None
    if isinstance(v, float):
        if math.isnan(v):
            return 'NaN'
        if math.isinf(v):
            return 'Infinity' if v > 0 else '-Infinity'
        return v
    return v

def vector(spec):
    if 'num' in spec:
        x = spec['num']
        u = f2u(x)
        raw = repr(x)
        from_pattern = False
    else:
        u = int(spec['hex'], 16)
        x = u2f(u)
        raw = spec.get('show') or ('0x%016X' % u)
        from_pattern = True
    c = classify(u)
    unbiased = c.get('expBits', 0) - 1023 if c.get('kind') == 'normal' else None
    rec = {
            'raw': raw,
            'fromPattern': from_pattern,
            'num': num_or_None(x),
            'hex': '%016X' % u,
            'kind': c['kind'],
            'sign': c['sign'],
            'expBits': num_or_None(c.get('expBits')),
            'unbiased': num_or_None(unbiased),
            'mant': num_or_None(c.get('mant')),
            'significand': num_or_None((1<<52 | (u & 0xFFFFFFFFFFFFF)) if c['kind'] in ('normal','subnormal') else None),
            'ulp': num_or_None(math.pow(2, unbiased) if c['kind']=='normal'
                    else math.pow(2,-1074) if c['kind'] in ('subnormal','zero')
                    else None),
        }
    return rec

numbers = [
    0.0, -0.0, 1.0, -1.0, 0.5, 0.1, 0.2, 0.3, 0.025,
    1.0+2.0, 1/3, 1.5, 1.25,
    2.0, 4.0, 8.0, 16.0, 32.0, 64.0, 128.0, 256.0, 1024.0,
    2**-53, 2**-52, 2**-1022, 2**-1074,
    1+2**-52,
    2**53, 2**53+1, 2**53+2, float(2**53)+1024.0,
    1.7976931348623157e308,
    2.2250738585072014e-308,
    5e-324, 4.9406564584124654e-324,
    1e308, 1e-308, 1e-320,
    float('inf'), float('-inf'),
    0.123456789, 123456789.25, 6.02214076e23, 6.674e-11, 299792458.0,
    0.7, 3.141592653589793, 2.718281828459045, -12345678901233.0,
]

raws = [
    '0x7fefffffffffffff', '0x7ff0000000000000', '0xfff0000000000000',
    '0x8000000000000000', '0x0000000000000001', '0x000fffffffffffff',
    '0x3ff0000000000000', '0x3fefffffffffffff', '0x4000000000000000',
    '0x400921fb54442d18',
    '0x3fd5555555555555',
    '0x7ff8000000000000',
    '0x7ff0000000000001',
    '0xfff8000000000000',
]

vecs = [vector({'num':x}) for x in numbers]
for r in raws:
    vecs.append(vector({'hex':r.lstrip('0x'), 'show':r}))

with open('/home/agent/project/scripts/vectors-floatkit.json','w') as f:
    json.dump(vecs, f, indent=1)
print('wrote', len(vecs), 'vectors (', len(numbers), 'number +', len(raws), 'pattern )')
# sanity: spot-check the IEEE encoding of 0.1
u = f2u(0.1)
print('0.1 -> hex', '%016X' % u, 'repr', repr(0.1), 'u2f', u2f(u))