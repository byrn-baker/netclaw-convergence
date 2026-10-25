"""Deployment boundary checks for the optional flow log shipper."""
import importlib.util
from pathlib import Path
import unittest
import json

path = Path(__file__).resolve().parents[2] / 'deploy/convergence/flows/render-collector.py'
spec = importlib.util.spec_from_file_location('flow_collector', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FlowCollectorTests(unittest.TestCase):
    def render(self, **changes):
        args = dict(namespace='monitoring', deployment='goflow2', container='goflow2',
                    site='cottage', exporters=['192.0.2.1'], endpoint='http://archive:9428')
        return module.manifest(**{**args, **changes})

    def test_only_selected_logs_and_exporters_with_durable_state(self):
        rendered = self.render()
        config = json.loads(rendered['items'][0]['data']['collector.yaml'])
        receiver = config['receivers']['filelog/flows']
        self.assertEqual(receiver['include'], ['/var/log/pods/monitoring_goflow2-*/goflow2/*.log'])
        self.assertEqual(receiver['resource']['site'], 'cottage')
        self.assertIn('192.0.2.1', str(receiver['operators']))
        self.assertEqual(receiver['storage'], 'file_storage')
        pod = rendered['items'][1]['spec']['template']['spec']
        self.assertFalse(pod['automountServiceAccountToken'])
        logs = next(v for v in pod['containers'][0]['volumeMounts'] if v['name'] == 'logs')
        self.assertTrue(logs['readOnly'])
        self.assertFalse(pod['containers'][0]['securityContext']['allowPrivilegeEscalation'])

    def test_untrusted_globs_exporters_or_credential_urls_are_rejected(self):
        for change in [{'namespace':'*'}, {'deployment':'../all'}, {'site':'a" OR *'},
                       {'exporters':['*']}, {'endpoint':'http://user:password@archive'},
                       {'endpoint':'file:///etc/passwd'}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.render(**change)


if __name__ == '__main__':
    unittest.main()
