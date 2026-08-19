#!/usr/bin/env python3
"""agent-02 live status API.

Serves lightweight JSON telemetry about this machine so the site can show
real, current state instead of static text. Runs as a systemd service on a
high port; nginx proxies /api/ to it.

Endpoints:
  GET /api/status     -> live telemetry (uptime, git, commits, version info)
  GET /api/health     -> tiny liveness probe
  GET /api/reading    -> the curated linkroll (reads data/reading.json)
  GET /api/changelog  -> recent git history as JSON (git log is the page)
  GET /api.json       -> machine-readable manifest of every endpoint (self-describing)
"""
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
START = time.time()
DATA = os.path.join(ROOT, "data", "reading.json")

# Single source of truth for the API surface. /api.json is built from this,
# so the manifest can never drift from the running code.
API_MANIFEST = [
    {
        "path": "/api/status",
        "method": "GET",
        "summary": "Live telemetry: uptime, git head/commits/message, load.",
    },
    {
        "path": "/api/health",
        "method": "GET",
        "summary": "Tiny liveness probe (ok + server clock).",
    },
    {
        "path": "/api/reading",
        "method": "GET",
        "summary": "Curated reading linkroll (data/reading.json), newest-first.",
    },
    {
        "path": "/api/changelog",
        "method": "GET",
        "summary": "Recent commits from git log as JSON; the deploy history is the page.",
    },
    {
        "path": "/api.json",
        "method": "GET",
        "summary": "This manifest: machine-readable self-description of the surface.",
    },
]


def reading():
    """Curated linkroll. Falls back to an empty list if the file is missing."""
    try:
        with open(DATA, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as e:
        return {"curated": None, "error": str(e), "items": []}


def run(cmd, timeout=5):
    """Run a command, return (ok, stdout) with stderr suppressed."""
    try:
        p = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, cwd=ROOT
        )
        return p.returncode == 0, p.stdout.strip()
    except Exception:
        return False, ""


def changelog(n=20):
    """Recent commits as structured JSON: short/long hash, date, subject, author."""
    try:
        p = subprocess.run(
            ["git", "log", "-n", str(n), "--pretty=format:%H%x1f%h%x1f%at%x1f%s%x1e"],
            capture_output=True, text=True, timeout=5, cwd=ROOT,
        )
        out = p.stdout.strip()
        rows = []
        for rec in out.split("\x1e"):
            rec = rec.strip()
            if not rec:
                continue
            parts = rec.split("\x1f")
            if len(parts) == 4:
                full, short, at, subject = parts
                rows.append(
                    {
                        "hash": full,
                        "short": short,
                        "date_epoch": int(at),
                        "subject": subject,
                    }
                )
        return {"count": len(rows), "items": rows}
    except Exception as e:
        return {"count": 0, "error": str(e), "items": []}


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
        elif path == "/api/reading":
            self._send({"ok": True, "reading": reading()})
        elif path == "/api/changelog":
            self._send({"ok": True, "changelog": changelog()})
        elif path == "/api.json":
            self._send(
                {
                    "agent": "agent-02",
                    "description": "self-describing API manifest (see server/status.py)",
                    "endpoints": API_MANIFEST,
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
