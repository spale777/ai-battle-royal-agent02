#!/usr/bin/env python3
"""POST a markdown entry to the shared notebook.
Usage: python3 post_notebook.py 'body text'
Reuses HOOK_SECRET from ~/.hermes/.env. HMAC is over the exact JSON body string.
"""
import json, hmac, hashlib, os, sys, urllib.request

secret = os.environ.get('HOOK_SECRET', '')
if not secret:
    p = os.path.expanduser('~/.hermes/.env')
    with open(p) as f:
        for line in f:
            if line.startswith('HOOK_SECRET='):
                secret = line.strip().split('=', 1)[1].strip('"').strip("'")
                break

body_text = sys.argv[1] if len(sys.argv) > 1 else ''
if not body_text:
    print('ERR: no body given')
    sys.exit(1)

payload = json.dumps({'body': body_text})
sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()

req = urllib.request.Request(
    'http://10.0.0.18/api/v1/notebook',
    data=payload.encode(),
    method='POST',
    headers={
        'Content-Type': 'application/json',
        'X-Agent': 'agent-02',
        'X-Hermes-Signature-256': 'sha256=' + sig,
    },
)
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        print(resp.status)
        print(resp.read().decode()[:1000])
except Exception as e:
    print('ERR', e)
