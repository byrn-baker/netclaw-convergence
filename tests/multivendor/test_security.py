"""Transport identity, raw-read boundary and private baseline regressions; no devices."""
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'mcp-servers/multivendor-cli-mcp'))
from tools import raw, change
from inventory.sources import Device, Source
import ssh_security


class SecurityTests(unittest.TestCase):
    def test_write_enable_does_not_bypass_raw_read_gate(self):
        device = Device('fixture', '127.0.0.1', 'frr')
        inventory = SimpleNamespace(devices=[device], source=Source.OPERATOR)
        with patch.dict(os.environ, {'MULTIVENDOR_WRITE_ENABLED': 'true'}), \
             patch.object(raw.inv, 'resolve', return_value=inventory), \
             patch.object(raw, 'resolve_credential') as credentials, \
             patch('netmiko.ConnectHandler') as connect:
            for command in ('hostname audit-change', 'vtysh -c "configure terminal"'):
                self.assertEqual(raw.run_command('fixture', command)['status'], 'denied')
            credentials.assert_not_called()
            connect.assert_not_called()

    def test_default_strict_and_invalid_custom_path(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(ssh_security.options(), {'ssh_strict': True, 'system_host_keys': True})
            os.environ['MULTIVENDOR_KNOWN_HOSTS'] = '/does-not-exist/audit124'
            with self.assertRaises(ValueError):
                ssh_security.options()

    def test_real_junos_adapter_enforces_identity_before_open(self):
        from napalm import get_network_driver
        with patch.dict(os.environ, {}, clear=True):
            conn = get_network_driver('junos')('127.0.0.1', 'fixture', 'fixture')
            ssh_security.secure_napalm_connection(conn, 'junos')
            self.assertIs(conn.device._hostkey_verify, True)
            with self.assertRaises(ValueError):
                ssh_security.secure_napalm_connection(SimpleNamespace(device=object()), 'junos')

    def test_baseline_private_unique_and_audit_symlink_refused(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(change, 'BASELINE_ROOT', Path(directory) / 'baselines'):
            one = change._save_baseline('../../fixture', 'synthetic config')
            two = change._save_baseline('../../fixture', 'synthetic config')
            self.assertNotEqual(one, two)
            self.assertEqual(one.parent, change.BASELINE_ROOT.resolve())
            self.assertEqual(one.stat().st_mode & 0o777, 0o600)
            self.assertEqual(change.BASELINE_ROOT.stat().st_mode & 0o777, 0o700)
            change._audit('fixture', device='test')
            audit = change.BASELINE_ROOT / 'audit.log'
            self.assertEqual(audit.stat().st_mode & 0o777, 0o600)
            audit.unlink()
            victim = Path(directory) / 'unrelated'
            victim.write_text('preserve')
            audit.symlink_to(victim)
            with self.assertRaises(OSError):
                change._audit('fixture')
            self.assertEqual(victim.read_text(), 'preserve')

    def test_failed_write_disconnects_and_passes_strict_options(self):
        device = Device('fixture', '127.0.0.1', 'frr')
        cred = SimpleNamespace(username='fixture', password='fixture', enable='', key_file=None)
        with patch.dict(os.environ, {}, clear=True), \
             patch.object(change, 'resolve_credential', return_value=cred), \
             patch('netmiko.ConnectHandler') as connect:
            connect.return_value.send_config_set.side_effect = RuntimeError('synthetic failure')
            result = change._send_config(device, 'hostname fixture', 2)
            self.assertFalse(result['ok'])
            self.assertIs(connect.call_args.kwargs['ssh_strict'], True)
            connect.return_value.disconnect.assert_called_once()


if __name__ == '__main__':
    unittest.main()
