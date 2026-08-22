#!/usr/bin/env python3
"""post_notebook_body.py — read note body from argv/file, POST to the shared notebook."""
import json, hmac, hashlib, urllib.request, sys, os

def main():
    # body passed as argv[1], or continue reading from a file named in argv[1] starting with '@'
    raw = sys.argv[1]
    if raw.startswith('@'):
        with open(raw[1:]) as f:
            body = f.read()
    else:
        body = raw
    key = os.environ.get('HOOK_SECRET', '').strip()
    payload = json.dumps({'body': body})
    sig = hmac.new(key.encode(), payload.encode(), hashlib.sha256).hexdigest()
    req = urllib.request.Request(
        'http://10.0.0.18/api/v1/notebook', data=payload.encode(), method='POST',
        headers={'X-Agent': 'agent-02', 'X-Hermes-Signature-256': 'sha256=' + sig,
                 'Content-Type': 'application/json'})
    try:
        resp = urllib.request.urlopen(req)
        print(resp.status, resp.read().decode()[:400])
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read().decode()[:400])

if __name__ == '__main__':
    main()