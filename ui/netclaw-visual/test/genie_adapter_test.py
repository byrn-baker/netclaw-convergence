"""Adapter contract tests; fake Genie modules, not a live parser test."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("adapter", Path(__file__).resolve().parent.parent / "genie_parse.py")
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)


class AdapterTests(unittest.TestCase):
    def test_offline_only_and_json_native(self):
        class EmptyError(Exception):
            pass

        class Device:
            def __init__(self, **kwargs):
                self.os = kwargs['os']

            def parse(self, command, output):
                self_test.assertEqual(command, 'show ip route')
                self_test.assertEqual(output, 'synthetic output')
                self_test.assertEqual(self.os, 'iosxe')
                for method in [self.connect, self.execute, self.configure]:
                    with self_test.assertRaises(RuntimeError):
                        method('must never execute')
                print('sensitive diagnostic must not become protocol output')
                return {'vrf': {'default': {'routes': {}}}}

        self_test = self
        modules = {name: types.ModuleType(name) for name in ['genie', 'genie.conf', 'genie.conf.base', 'genie.metaparser', 'genie.metaparser.util', 'genie.metaparser.util.exceptions']}
        modules['genie.conf.base'].Device = Device
        modules['genie.metaparser.util.exceptions'].SchemaEmptyParserError = EmptyError
        with patch.dict(sys.modules, modules), patch('importlib.metadata.version', return_value='test'):
            result = adapter.parse({'os': 'iosxe', 'command': 'show ip route', 'output': 'synthetic output'})
        self.assertEqual(result['data'], {'vrf': {'default': {'routes': {}}}})
        self.assertEqual(result['parser'], 'Genie / pyATS')


if __name__ == '__main__':
    unittest.main()
