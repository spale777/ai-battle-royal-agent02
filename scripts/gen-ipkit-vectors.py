#!/usr/bin/env python3
"""Generate ground-truth IPv4/CIDR vectors using Python's ipaddress stdlib.
Each vector: {input, ip, prefix, network, first, last, broadcast, netmask, total}.
Also pair vectors [a, b, covering_net, covering_prefix] for the two-address coverage mode.
"""
import ipaddress, json

vectors = []

def add_vector(cidr):
    n = ipaddress.ip_network(cidr, strict=False)
    net = int(n.network_address)
    bc = int(n.broadcast_address)
    if n.prefixlen == 32:
        first = last = net
    elif n.prefixlen == 31:
        first = net
        last = net | 1
    else:
        # /30..: usable hosts exclude net and broadcast. Small /30 = 2 usable.
        # For larger networks first==net+1, last==broadcast-1 always (only /31,/32 special).
        nm = 0xFFFFFFFF ^ ((1 << (32 - n.prefixlen)) - 1)
        bc = net | ((1 << (32 - n.prefixlen)) - 1)
        first = net + 1
        last = bc - 1
    vectors.append({
        'input': cidr,
        'ip': int(ipaddress.ip_address(cidr.split('/')[0])),
        'prefix': n.prefixlen,
        'network': net,
        'first': first,
        'last': last,
        'broadcast': bc,
        'netmask': int(n.netmask),
        'total': n.num_addresses,
    })

samples = [
    '0.0.0.0/0', '0.0.0.0/1', '10.0.0.0/8', '10.255.255.255/8',
    '192.168.1.1/24', '192.168.1.200/25', '172.16.0.0/12', '100.64.0.0/10',
    '127.0.0.1/8', '169.254.10.5/16', '203.0.113.1/24', '255.255.255.255/32',
    '224.5.5.5/4', '240.240.240.240/4', '192.0.2.1/24', '1.1.1.1/32',
    '192.168.0.0/16', '198.18.5.5/15', '192.168.10.44/27', '192.168.10.44/25',
    '10.13.10.44/25', '0.0.0.0/32', '255.8.8.8/32', '10.10.10.10/31',
    '172.31.255.255/30', '90.90.90.90/30', '130.130.130.130/20',
    '192.168.44.1/24', '172.20.30.40/30', '8.8.4.4/6', '192.168.44.1/25',
]
for s in samples:
    add_vector(s)
    if '/' not in s:
        add_vector(s + '/32')

# dedup by input, preserving order
seen = set()
vectors = [v for v in vectors if not (v['input'] in seen or seen.add(v['input']))]

def pair_coverage(a, b):
    na = int(ipaddress.ip_address(a))
    nb = int(ipaddress.ip_address(b))
    x = na ^ nb
    if x == 0:
        p = 32
    else:
        hb = 31
        while not (x & (1 << hb)):
            hb -= 1
        p = 31 - hb
    hostmask = (1 << (32 - p)) - 1 if p < 32 else 0
    net = na & (0xFFFFFFFF ^ hostmask)
    return {'a': a, 'b': b, 'prefix': p, 'network': net}

pairs = [
    ('10.0.0.7', '10.0.0.33'),
    ('192.168.1.1', '192.168.1.200'),
    ('172.16.4.2', '172.16.6.9'),
    ('10.0.0.1', '10.0.1.200'),
    ('8.8.8.8', '8.8.8.200'),
    ('1.2.3.4', '1.2.3.4'),
    ('192.168.2.1', '192.168.10.44'),
]
pair_vectors = [pair_coverage(a, b) for a, b in pairs]

json.dump({'vectors': vectors, 'pairs': pair_vectors},
          open('scripts/vectors-ipkit.json', 'w'), indent=1)
print('wrote', len(vectors), 'single vectors +', len(pair_vectors), 'pair vectors')