#!/usr/bin/env python3
import http.server
import json
import os
import urllib.parse
from pathlib import Path

from dotenv import load_dotenv

from report_portal import main

load_dotenv(Path(__file__).parent / ".env")

# Store configuration received from extension
config = {}


class JumpHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/jump":
            self.handle_jump(parsed)
        else:
            self.send_error(404, "Unknown endpoint")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/config":
            self.handle_config()
        else:
            self.send_error(404, "Unknown endpoint")

    def handle_config(self):
        """Handle POST /config to receive configuration from extension."""
        global config
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body.decode("utf-8"))
            config = {
                "api_key": data.get("apiKey", ""),
                "base_url": data.get("baseUrl", ""),
                "project": data.get("project", ""),
            }
            print(
                f"[SERVER] Configuration updated: project={config['project']}, base_url={config['base_url']}"
            )

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok"}).encode())
        except Exception as e:
            print(f"[SERVER] Error processing config: {e}")
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def handle_jump(self, parsed):
        """Handle GET /jump to process ReportPortal URLs."""
        url = urllib.parse.parse_qs(parsed.query).get("url", [""])[0]
        print(f"[EXT] Received URL from Chrome: {url}")

        # Use config from extension, fall back to environment variables
        api_key = config.get("api_key") or os.environ.get("RP_API_KEY", "")
        base_url = config.get("base_url") or os.environ.get(
            "RP_BASE_URL", ""
        ).strip().strip('"')
        project = config.get("project") or os.environ.get("RP_PROJECT", "")

        if not api_key or not base_url or not project:
            error_msg = "Configuration missing. Please configure RP Jump in the extension options."
            print(f"[SERVER] error: {error_msg}")
            self.send_response(500)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(error_msg.encode())
            return

        try:
            result = main(url, api_key=api_key, base_url=base_url, project=project)
            self.send_response(200)
            output = str(result).strip() if result is not None else ""
        except Exception as e:
            print(f"[SERVER] error: {e}")
            self.send_response(500)
            output = str(e)

        self.send_header("Content-Type", "text/plain")
        self.end_headers()

        print(f"[SERVER] returned to chrome:\n{output}\n")
        self.wfile.write(output.encode())


print("RP Jump server listening on http://localhost:9999/jump")
http.server.HTTPServer(("localhost", 9999), JumpHandler).serve_forever()
