import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import time
import unittest
from datetime import datetime, timezone

from fastapi.testclient import TestClient
import httpx
from server import create_app
from store import Store, case_payload


def event(kind='alert', now=None, **extra):
    value = {'timestamp': datetime.fromtimestamp(now or time.time(), timezone.utc).isoformat(),
        'event_type': kind, 'vlan': [104], 'src_ip': '192.168.104.10', 'dest_ip': '198.51.100.20'}
    if kind == 'alert':
        value['alert'] = {'signature_id': 12345, 'signature': 'Test signature', 'severity': 1}
    value.update(extra)
    return value


class IngestionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.temp.name)/'eve.sqlite')
        self.store = Store(self.path, capacity=10)
        self.sensor = {'id': 'sensor-home', 'site': 'home', 'vlans': [104, 301],
            'token_sha256': hashlib.sha256(b'sensor-secret').hexdigest(), 'auto_investigate': False}
        self.hb = {'capture_running': True, 'rules_count': 50000, 'rules_checked_at': time.time(),
                   'disk_free_bytes': 10*1024**3}
        self.config = {'sensors': [self.sensor], 'status_token_sha256': hashlib.sha256(b'status-secret').hexdigest(),
            'state_dir': self.temp.name}
        self.client = TestClient(create_app(self.config, self.store))

    def tearDown(self):
        self.client.close()
        self.store.db.close()
        self.temp.cleanup()

    def test_authentication_binds_site_and_status_is_separate(self):
        payload = {'events': [event()], 'heartbeat': self.hb, 'site': 'other', 'sensor': 'spoofed'}
        self.assertEqual(self.client.post('/v1/eve', json=payload).status_code, 401)
        r = self.client.post('/v1/eve', json=payload, headers={'Authorization': 'Bearer sensor-secret'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.store.pending('log')[0]['site'], 'home')
        self.assertEqual(self.client.get('/v1/status?site=home', headers={'Authorization': 'Bearer sensor-secret'}).status_code, 401)
        r = self.client.get('/v1/status?site=other', headers={'Authorization': 'Bearer status-secret'})
        self.assertEqual(r.json()['sensors'], [])
        self.assertEqual(r.json()['alertsLast24h'], None)

    def test_replay_survives_restart_and_delivery_checkpoints_are_independent(self):
        record = event()
        self.assertEqual(self.store.accept(self.sensor, [record, record], self.hb), 1)
        row = self.store.pending('log')[0]
        self.store.acknowledge('log', [row['id']])
        self.store.db.close()
        self.store = Store(self.path)
        self.assertEqual(self.store.accept(self.sensor, [record], self.hb), 0)
        self.assertEqual(self.store.pending('log'), [])
        self.assertEqual(len(self.store.pending('case')), 1)
        self.store.prune(now=time.time()+90*86400)
        self.assertEqual(len(self.store.pending('case')), 1, 'Undelivered cases must never expire')

    def test_full_queue_rolls_back_entire_batch(self):
        self.store.capacity = 1
        with self.assertRaises(OverflowError):
            self.store.accept(self.sensor, [event(), event(src_ip='192.168.104.11')], self.hb)
        self.assertEqual(self.store.pending('log'), [])
        self.assertEqual(self.store.status([self.sensor], 'home')['sensors'][0]['status'], 'unknown')

    def test_bad_batch_cannot_partially_persist_or_rewrite_identity(self):
        invalid = event(src_ip='an instruction instead of an IP')
        r = self.client.post('/v1/eve', json={'events': [event(), invalid], 'heartbeat': self.hb},
                             headers={'Authorization': 'Bearer sensor-secret'})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.store.pending('log'), [])

    def test_recent_heartbeat_does_not_hide_stale_capture_or_missing_vlan(self):
        now = time.time()
        stats = event('stats', now, stats={'capture': {'kernel_packets': 500, 'kernel_drops': 0}})
        self.store.accept(self.sensor, [stats, event('flow', now)], self.hb, now=now)
        status = self.store.status([self.sensor], 'home', now=now)
        self.assertEqual(status['status'], 'active')
        self.assertEqual([v['status'] for v in status['sensors'][0]['coverage']], ['observed', 'unverified'])
        self.store.accept(self.sensor, [], self.hb, now=now+180)
        self.assertEqual(self.store.status([self.sensor], 'home', now=now+180)['sensors'][0]['status'], 'degraded')
        self.assertEqual(self.store.status([self.sensor], 'home', now=now+600)['sensors'][0]['status'], 'stale')

    def test_case_identity_correlates_repeated_signature_but_separates_sites_and_windows(self):
        now = 1700000101
        a = case_payload(self.sensor, event(now=now))['alerts'][0]
        b = case_payload(self.sensor, event(now=now+1, src_port=9999))['alerts'][0]
        self.assertEqual(a['fingerprint'], b['fingerprint'])
        self.assertEqual(a['labels']['investigate'], 'false')
        other = case_payload({**self.sensor, 'site': 'other'}, event(now=now))['alerts'][0]
        self.assertNotEqual(a['fingerprint'], other['fingerprint'])
        canary = case_payload({**self.sensor, 'auto_investigate': True}, event(alert={'signature_id':9000001}))['alerts'][0]
        self.assertEqual(canary['labels']['investigate'], 'false')
        self.assertEqual(canary['labels']['severity'], 'info')

    def test_malformed_mirror_cannot_report_healthy_capture(self):
        now = time.time()
        stats = event('stats', now, stats={'capture': {'kernel_packets': 1000, 'kernel_drops': 0},
                                         'decoder': {'too_many_layers': 500}})
        self.store.accept(self.sensor, [stats], self.hb, now=now)
        state = self.store.status([self.sensor], 'home', now=now)['sensors'][0]
        self.assertEqual(state['status'], 'degraded')
        self.assertIn('decoder', state['reason'])

    def test_shipper_waits_for_complete_line(self):
        script = Path(__file__).resolve().parents[2]/'deploy/convergence/ids/shipper.py'
        spec = importlib.util.spec_from_file_location('ids_shipper', script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        path = Path(self.temp.name)/'eve.json'
        first = json.dumps(event()).encode()+b'\n'
        second = json.dumps(event('flow')).encode()
        path.write_bytes(first+second)
        records, offset = module.read_batch(path, 0)
        self.assertEqual(len(records), 1)
        self.assertEqual(offset, len(first))
        path.write_bytes(first+second+b'\n')
        records, end = module.read_batch(path, offset)
        self.assertEqual(len(records), 1)
        self.assertEqual(end, path.stat().st_size)

    def test_case_outage_does_not_block_raw_log_delivery(self):
        self.store.accept(self.sensor, [event()], self.hb)
        calls = []
        def upstream(request):
            calls.append(request.url.host)
            return httpx.Response(204 if request.url.host == 'logs' else 503)
        config = {**self.config, 'loki_url': 'http://logs', 'receiver_url': 'http://cases/webhook',
                  'receiver_token': 'test'}
        factory = lambda **kw: httpx.AsyncClient(transport=httpx.MockTransport(upstream), **kw)
        with TestClient(create_app(config, self.store, factory)):
            deadline = time.monotonic()+3
            while self.store.pending('log') and time.monotonic()<deadline:
                time.sleep(0.02)
        self.assertEqual(self.store.pending('log'), [])
        self.assertEqual(len(self.store.pending('case')), 1)
        self.assertIn('logs', calls)
        self.assertIn('cases', calls)


if __name__ == '__main__':
    unittest.main()
