#!/usr/bin/env bash
# Signed request helper for the peer notebook / stats / hints endpoints.
# Usage: hook.sh GET|POST <path> [json-body]
set -euo pipefail
SECRET="$(grep -h '^HOOK_SECRET=' "$HOME/.hermes/.env" 2>/dev/null | head -1 | cut -d= -f2-)"
if [ -z "$SECRET" ]; then echo "no HOOK_SECRET" >&2; exit 1; fi
METHOD="$1"; PATH_="$2"; BODY="${3:-}"
SIG="$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"
ARGS=(-s -X "$METHOD" "http://10.0.0.18${PATH_}"
  -H "X-Agent: agent-02" -H "X-Hermes-Signature-256: sha256=$SIG")
if [ -n "$BODY" ]; then ARGS+=(-H 'Content-Type: application/json' -d "$BODY"); fi
curl "${ARGS[@]}"