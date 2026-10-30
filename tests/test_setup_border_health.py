import hashlib
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_border_health import read_status
from setup_state import guarded_write,Conflict

class BorderHealthTests(unittest.TestCase):
    def test_local_border_status_requires_owned_manifest_and_actual_matching_endpoint(self):
        calls=[];response={'installation_id':'owned','harness_type':'hermes','federation_ready':True}
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                calls.append(self.path);self.send_response(200);self.end_headers();self.wfile.write(json.dumps(response).encode())
            def log_message(self,*args):pass
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp:
                home=Path(temp).resolve()
                guarded_write(home/'netclaw-hud/installation.json',b'{"installationId":"owned"}')
                guarded_write(home/'.netclaw-setup-owner.json',b'{"installationId":"border","runId":"run-fixture"}')
                manifest={'installationId':'owned','owner':'border','runId':'run-fixture','role':'border','home':str(home),'harness':'hermes','endpoints':{'bgpApiPort':server.server_port}}
                target=home/'.setup/services.json';guarded_write(target,json.dumps(manifest).encode())
                self.assertEqual(read_status(home,'owned','hermes'),{'enabled':True,'identity':'owned','role':'border','ready':True})
                response['federation_ready']=False;self.assertFalse(read_status(home,'owned','hermes')['ready'])
                response['installation_id']='neighbor'
                with self.assertRaises(Conflict):read_status(home,'owned','hermes')
                count=len(calls)
                for field,value in [('owner','neighbor'),('role','member'),('harness','openclaw'),('home',str(home/'neighbor')),('runId','run-neighbor')]:
                    target.write_text(json.dumps({**manifest,field:value}))
                    with self.assertRaises(Conflict):read_status(home,'owned','hermes')
                    self.assertEqual(len(calls),count)
                self.assertEqual(set(calls),{'/status'})
        finally:server.shutdown();server.server_close();thread.join()

    def test_local_status_change_is_in_the_protected_hermes_source_allowlist(self):
        policy=json.loads((ROOT/'config/hermes-hud-tool-policy.json').read_text())
        digest=hashlib.sha256((ROOT/'mcp-servers/n2n-mcp/server.py').read_bytes()).hexdigest()
        self.assertIn(digest,policy['servers']['n2n-mcp']['sourceHashes'])

if __name__=='__main__':unittest.main()
