import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('hermes_discovery',ROOT/'scripts/setup-hermes-discovery.py')
probe=importlib.util.module_from_spec(spec);spec.loader.exec_module(probe)


class HermesDiscoveryTests(unittest.TestCase):
    def test_live_agent_registration_rejects_cache_missing_session_and_foreign_tools(self):
        for fault in (None,'cache','session','error','not-ready','missing-tool','foreign-owner','missing-registration','duplicate'):
            with self.subTest(fault=fault):
                connected=SimpleNamespace(name='protocol-mcp',session=None if fault=='session' else object(),
                    _error=ValueError() if fault=='error' else None,
                    _ready=SimpleNamespace(is_set=lambda:fault!='not-ready'),
                    _tools=[] if fault=='missing-tool' else [SimpleNamespace(name='status')])
                connections={} if fault=='cache' else {'protocol-mcp':connected}
                if fault=='duplicate':connections['neighbor']=connected
                names=set() if fault=='missing-registration' else {'mcp__protocol_mcp__status'}
                registry=SimpleNamespace(get_toolset_for_tool=lambda name:'mcp-neighbor' if fault=='foreign-owner' else 'mcp-protocol-mcp')
                self.assertEqual(probe.live_registered('protocol-mcp',['status'],names,connections,registry,
                    lambda server,tool:'mcp__'+server.replace('-','_')+'__'+tool),fault is None)

    def test_scope_is_checked_before_native_import_or_launch(self):
        from unittest.mock import patch
        with patch.dict('os.environ',{'HERMES_HOME':'/some/neighbor','HOME':'/some/neighbor/.setup/os-home'},clear=True):
            with self.assertRaises(ValueError):probe.discover('protocol')


if __name__=='__main__':unittest.main()
