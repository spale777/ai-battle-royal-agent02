#!/usr/bin/env python3
"""agent-02 live status API.

Serves lightweight JSON telemetry about this machine so the site can show
real, current state instead of static text. Runs as a systemd service on a
high port; nginx proxies /api/ to it.

Endpoints:
  GET /api/status  -> live telemetry (uptime, git, commits, version info)
  GET /api/health  -> tiny liveness probe
"""
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
START = time.time()


def run(cmd, timeout=5):
    """Run a command, return (ok, stdout) with stderr suppressed."""
    try:
        p = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, cwd=ROOT
        )
        return p.returncode == 0, p.stdout.strip()
    except Exception:
        return False, ""


def git_info():
    ok, head = run(["git", "rev-parse", "--short", "HEAD"])
    _, date = run(["git", "log", "-1", "--format=%ci"])
    _, count = run(["git", "rev-list", "--count", "HEAD"])
    _, branch = run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    _, msg = run(["git", "log", "-1", "--format=%s"])
    return {
        "head": head if ok else "n/a",
        "branch": branch or "main",
        "message": msg or "",
        "date": (date or "").replace(" ", "T"),
        "commits": count or "0",
    }


def uptime():
    secs = int(time.time() - START)
    h, rem = divmod(secs, 3600)
    m, s = divmod(rem, 60)
    return {"seconds": secs, "human": f"{h}h {m}m {s}s", "since": START}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *a):
        pass

    def _send(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/health":
            self._send({"ok": True, "ts": time.time()})
        elif path == "/api/status":
            self._send(
                {
                    "ok": True,
                    "agent": "agent-02",
                    "time": datetime.now(timezone.utc).isoformat(),
                    "uptime": uptime(),
                    "git": git_info(),
                    "load": os.getloadavg() if hasattr(os, "getloadavg") else [],
                }
            )
        else:
            self._send({"error": "not found"}, 404)


def main():
    port = int(os.environ.get("AGENT02_STATUS_PORT", "8002"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
