"""Installer flow tests: no package downloads, no live Genie or router access."""
import argparse
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('installer', Path(__file__).with_name('install-pyats-genie.py'))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
READY = {'pyats': '26.8', 'genie': '26.8', 'parser': '26.8.1', 'synthetic_parse': 'passed'}


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='netclaw-installer-test-')
        self.addCleanup(self.directory.cleanup)
        self.target = Path(self.directory.name).resolve() / 'venv with spaces'
        self.args = argparse.Namespace(venv=str(self.target), version='26.8', yes=True, upgrade=False, check_only=False)
        self.platform = patch.object(installer, 'check_platform')
        self.platform.start()
        self.addCleanup(self.platform.stop)

    def existing(self, managed=True):
        (self.target / 'bin').mkdir(parents=True)
        (self.target / 'bin' / 'python').touch()
        (self.target / 'pyvenv.cfg').touch()
        if managed:
            (self.target / installer.MARKER).write_text(json.dumps({'owner': 'netclaw-pyats-installer', 'format': 1}))

    def test_unmanaged_directory_preserved(self):
        self.existing(managed=False)
        with self.assertRaisesRegex(RuntimeError, 'unmanaged'), patch.object(installer, 'run') as run:
            installer.install(self.args)
        run.assert_not_called()

    def test_ready_environment_is_idempotent(self):
        self.existing()
        with patch.object(installer, 'smoke', return_value=READY), patch.object(installer, 'run') as run:
            self.assertEqual(installer.install(self.args), 0)
        run.assert_not_called()

    def test_other_release_requires_explicit_upgrade(self):
        self.existing()
        with patch.object(installer, 'smoke', return_value={**READY, 'pyats': '25.1'}):
            with self.assertRaisesRegex(RuntimeError, '--upgrade'):
                installer.install(self.args)

    def test_check_existing_without_install(self):
        self.existing(managed=False)
        self.args.check_only = True
        with patch.object(installer, 'smoke', return_value=READY), patch.object(installer, 'run') as run:
            installer.install(self.args)
        run.assert_not_called()
        self.assertFalse((self.target / installer.MARKER).exists())

    def test_fresh_install_is_isolated(self):
        def build(_target):
            (self.target / 'bin').mkdir()
            (self.target / 'bin' / 'python').touch()
            (self.target / 'pyvenv.cfg').touch()
        with patch.object(installer.venv.EnvBuilder, 'create', side_effect=build), patch.object(installer, 'run') as run, patch.object(installer, 'smoke', return_value=READY):
            installer.install(self.args)
        self.assertTrue(installer.is_managed(self.target))
        self.assertEqual(run.call_count, 3)
        for call in run.call_args_list:
            self.assertEqual(call.args[0][0], str(self.target / 'bin' / 'python'))
            self.assertIn('--isolated', call.args[0])
            self.assertNotIn('shell', call.kwargs)
        self.assertIn('--prefix', run.call_args_list[1].args[0])
        self.assertIn('pyats[full]==26.8', run.call_args_list[1].args[0])

    def test_failure_does_not_delete_or_claim_ready(self):
        self.existing()
        self.args.upgrade = True
        output = io.StringIO()
        with patch.object(installer, 'run', side_effect=subprocess.CalledProcessError(1, 'pip')), contextlib.redirect_stdout(output):
            with self.assertRaises(subprocess.CalledProcessError):
                installer.install(self.args)
        self.assertNotIn('READY:', output.getvalue())
        self.assertTrue(installer.is_managed(self.target))

    def test_noninteractive_needs_consent(self):
        self.args.yes = False
        with patch.object(installer.sys.stdin, 'isatty', return_value=False):
            with self.assertRaisesRegex(RuntimeError, 'cancelled'):
                installer.install(self.args)
        self.assertFalse(self.target.exists())

    def test_clean_env(self):
        with patch.dict(installer.os.environ, {'PYTHONPATH': 'bad', 'PIP_TARGET': 'global', 'VIRTUAL_ENV': 'other'}):
            env = installer.clean_environment()
            self.assertNotIn('PYTHONPATH', env)
            self.assertNotIn('PIP_TARGET', env)
            self.assertNotIn('VIRTUAL_ENV', env)

    def test_native_windows_rejected(self):
        self.platform.stop()
        with patch.object(installer.sys, 'platform', 'win32'):
            with self.assertRaisesRegex(RuntimeError, 'Native Windows'):
                installer.check_platform()

    def test_broad_target_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'dedicated subdirectory'):
            installer.target_path(str(Path.home()))


if __name__ == '__main__':
    unittest.main()
