"""Run locally, then open http://127.0.0.1:8766/tools/bake-watermelon.html.
Regenerate the textures after changing the illustration or drawn lettering.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]

class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        name = self.path.removeprefix('/__bake/')
        if self.headers.get('Origin') != 'http://127.0.0.1:8766' or name not in ('rind', 'flesh', 'writing', 'seed-flow', 'state'):
            self.send_error(403)
            return
        length = int(self.headers.get('Content-Length', '0'))
        if not 0 < length < 32 * 1024 * 1024:
            self.send_error(413)
            return
        data = self.rfile.read(length)
        folder = ROOT / 'assets' / 'textures'
        folder.mkdir(exist_ok=True)
        if name == 'state':
            state = int(data)
            (folder / 'artwork-state.js').write_text(f'// Continue the original seed/shadow sequence after the baked artwork.\nexport const seedRandomState = {state};\n')
        else:
            if not data.startswith(b'\x89PNG\r\n\x1a\n'):
                self.send_error(400)
                return
            (folder / f'{name}.png').write_bytes(data)
        self.send_response(204)
        self.end_headers()

os.chdir(ROOT)
print('Open http://127.0.0.1:8766/tools/bake-watermelon.html', flush=True)
ThreadingHTTPServer(('127.0.0.1', 8766), Handler).serve_forever()
