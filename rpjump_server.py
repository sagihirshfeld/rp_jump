#!/usr/bin/env python3
import http.server
from pathlib import Path
import urllib.parse
import subprocess
import os

# ✅ Load .env automatically
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            if "=" in line:
                key, val = line.strip().split("=", 1)
                os.environ[key] = val


PORT = 9999
SCRIPT = "report_portal.py"


class JumpHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/jump":
            self.send_error(404, "Unknown endpoint")
            return

        url = urllib.parse.parse_qs(parsed.query).get("url", [""])[0]
        print(f"[EXT] Received URL from Chrome: {url}")

        # run python script and capture stdout+stderr
        proc = subprocess.Popen(
            ["python3", SCRIPT, url],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        out = proc.communicate()[0].strip()

        if proc.returncode == 0:
            # success → return URL to Chrome
            self.send_response(200)
        else:
            # failure → return message to Chrome
            self.send_response(500)

        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        print(f"[SERVER] returned to chrome:\n{out.encode()}\n")
        self.wfile.write(out.encode())

        print(f"[SERVER] returned to chrome:\n{out}\n")


print("RP Jump server listening on http://localhost:9999/jump")
http.server.HTTPServer(("localhost", 9999), JumpHandler).serve_forever()
