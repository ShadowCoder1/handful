#!/usr/bin/env python3
"""serve.py: this folder over http with caching off, for working on the app.
    python3 tools/serve.py [port]      -> http://localhost:8020/"""
import os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
class NoStore(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=ROOT, **kw)
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()
    def log_message(self, *a): pass
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8020
ThreadingHTTPServer(("127.0.0.1", port), NoStore).serve_forever()
