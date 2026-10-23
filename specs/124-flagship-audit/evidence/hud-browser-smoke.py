"""Isolated Mac browser smoke; never reads operator config or invokes a live agent."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'ui/netclaw-visual'
EVIDENCE = Path(__file__).resolve().parent

def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]

def wait_ready(url, child):
    for _ in range(100):
        if child.poll() is not None:
            raise RuntimeError(f'Process exited {child.returncode}')
        try:
            with urllib.request.urlopen(url, timeout=.5) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(.1)
    raise TimeoutError(url)

with tempfile.TemporaryDirectory(prefix='netclaw-browser-') as temporary:
    root = Path(temporary)
    ui = root / 'ui/netclaw-visual'
    ui.mkdir(parents=True)
    for name in ('src', 'public', 'dist'):
        shutil.copytree(SOURCE / name, ui / name)
    for name in ('server.js', 'vite.config.js', 'package.json', 'index.html', 'canvas.html'):
        shutil.copy2(SOURCE / name, ui / name)
    (ui / 'node_modules').symlink_to(SOURCE / 'node_modules', target_is_directory=True)
    (root / 'testbed').mkdir()
    (root / 'testbed/testbed.yaml').write_text('devices: {}\n')
    api_port, ui_port = port(), port()
    assert api_port != ui_port
    env = {'PATH': os.environ['PATH'], 'HOME': str(root), 'HUD_PORT': str(api_port), 'HUD_UI_PORT': str(ui_port)}
    results = []
    with (EVIDENCE / 'hud-browser-processes.txt').open('w') as logs:
        api = subprocess.Popen(['node', 'server.js'], cwd=ui, env=env, stdout=logs, stderr=logs)
        try:
            wait_ready(f'http://127.0.0.1:{api_port}/api/health', api)
            for mode in ('dev', 'preview'):
                command = ['node', str(SOURCE / 'node_modules/vite/bin/vite.js')]
                if mode == 'preview': command += ['preview']
                frontend = subprocess.Popen(command, cwd=ui, env=env, stdout=logs, stderr=logs)
                try:
                    base = f'http://127.0.0.1:{ui_port}'
                    wait_ready(base, frontend)
                    with sync_playwright() as pw:
                        browser = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
                        context = browser.new_context(viewport={'width':1440,'height':1000})
                        # Keep the browser on synthetic state, including both chat destinations.
                        def route_api(route):
                            endpoint = route.request.url.split('/api/',1)[1]
                            if endpoint in ('graph','health'):
                                route.continue_()
                            elif endpoint == 'gateway/status':
                                route.fulfill(json={'connected':False,'available':False})
                            elif endpoint == 'bgp':
                                route.fulfill(json={'available':False,'peers':[],'rib':{}})
                            elif endpoint == 'n2n':
                                route.fulfill(json={'available':False,'members':[],'peers':[]})
                            elif endpoint == 'layout':
                                route.fulfill(json={})
                            else:
                                route.fulfill(json={})
                        context.route('**/api/**', route_api)
                        context.route_web_socket('**/ws', lambda ws: None)
                        assert context.request.get(base+'/api/health').status == 200
                        assert context.request.get(base+'/api/health',headers={'Origin':'https://untrusted.example'}).status == 403
                        for path, label in (('/', 'hud'),('/canvas.html','canvas')):
                            page = context.new_page()
                            errors = []
                            page.on('pageerror', lambda error: errors.append(str(error)))
                            response = page.goto(base+path, wait_until='networkidle')
                            page.wait_for_timeout(1000)
                            text = page.locator('body').inner_text()
                            page.screenshot(path=str(EVIDENCE/f'{mode}-{label}.png'))
                            result = {'mode':mode,'page':label,'status':response.status,'title':page.title(),'errors':errors,'body_chars':len(text),'canvas_count':page.locator('canvas').count()}
                            results.append(result)
                            assert response.status == 200 and len(text)>100 and not errors, result
                            if label == 'hud': assert result['canvas_count']>0
                            page.close()
                        browser.close()
                finally:
                    frontend.terminate()
                    frontend.wait(timeout=10)
        finally:
            api.terminate()
            api.wait(timeout=10)
    (EVIDENCE/'hud-browser-results.json').write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps(results,indent=2))
