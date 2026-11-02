import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('shipper', Path(__file__).with_name('shipper.py'))
shipper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shipper)


class ShipperTests(unittest.TestCase):
    def test_redirect_never_forwards_bearer(self):
        seen = []
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                seen.append((self.path, self.headers.get('Authorization')))
                self.send_response(307)
                self.send_header('Location', '/untrusted-destination')
                self.end_headers()
            def do_GET(self):
                seen.append((self.path, self.headers.get('Authorization')))
                self.send_response(200)
                self.end_headers()
            def log_message(self, *_):
                pass
        server = HTTPServer(('127.0.0.1', 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            client = urllib.request.build_opener(shipper.NoRedirect())
            config = {'url': f'http://127.0.0.1:{server.server_port}/v1/hypervisor-events'}
            with self.assertRaises(urllib.error.HTTPError) as caught:
                shipper.publish(client, config, 'test-bearer', b'{}')
            self.assertEqual(caught.exception.code, 307)
            self.assertEqual(seen, [('/v1/hypervisor-events', 'Bearer test-bearer')])
        finally:
            server.shutdown()
            server.server_close()
            worker.join()

    def test_untrusted_stale_future_and_duplicate_snapshots_rejected(self):
        config = {'node': 'node1', 'ssh_host': 'root@192.0.2.1', 'known_hosts_file': '/pins', 'identity_file': '/identity'}
        valid = {'node': 'node1', 'schema_version': 1, 'observed_at': time.time()}
        cases = [dict(valid, node='node2'), dict(valid, observed_at=time.time() - 121),
                 dict(valid, observed_at=time.time() + 31), dict(valid, observed_at=True)]
        for snapshot in cases:
            with self.subTest(snapshot=snapshot), patch.object(shipper.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=json.dumps(snapshot).encode())):
                with self.assertRaises(ValueError):
                    shipper.read_snapshot(config)
        with patch.object(shipper.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=b'{"node":"node1","node":"node2"}')):
            with self.assertRaises(ValueError):
                shipper.read_snapshot(config)

    def test_invalid_transport_configuration_rejected_before_ssh(self):
        for url in ['http://receiver/v1/hypervisor-events', 'https://token@receiver/v1/hypervisor-events',
                    'https://receiver/v1/eve', 'https://receiver/v1/hypervisor-events?token=secret']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                shipper.validate_config({'url': url})

    def test_failure_status_is_atomic_private_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'status.json'
            shipper.status_file(path, {'failures': 1, 'last_error_type': 'TimeoutError'})
            self.assertEqual(json.loads(path.read_text())['failures'], 1)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertFalse(path.with_name('status.json.tmp').exists())


if __name__ == '__main__':
    unittest.main()
