"""Startup probes must use each server's installed SDK environment."""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('startup_probe', ROOT / 'scripts/check-server-startup.py')
startup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(startup)


def test_python_probe_uses_recorded_interpreter(tmp_path, monkeypatch):
    records = tmp_path / 'records'
    records.mkdir()
    python = tmp_path / 'component/bin/python'
    python.parent.mkdir(parents=True)
    python.write_text('#!/bin/sh\nexit 0\n')
    python.chmod(0o700)
    (records / 'cml-mcp').write_text(str(python))
    monkeypatch.setenv('NETCLAW_RUNTIME_ROOT', str(tmp_path))
    argv, _ = startup.launchable('cml-mcp', {'command': 'python3', 'args': ['-m', 'cml_mcp']})
    assert argv == [str(python), '-m', 'cml_mcp']


def test_broken_record_is_reported_instead_of_falling_back(tmp_path, monkeypatch):
    records = tmp_path / 'records'
    records.mkdir()
    missing = str(tmp_path / 'missing/bin/python')
    (records / 'junos-mcp').write_text(missing)
    monkeypatch.setenv('NETCLAW_RUNTIME_ROOT', str(tmp_path))
    argv, _ = startup.launchable('junos-mcp', {'command': 'python3', 'args': ['server.py']})
    assert startup.probe('junos-mcp', argv).startswith('could not launch:')


def test_record_works_without_ambient_python(tmp_path, monkeypatch):
    records = tmp_path / 'records'
    records.mkdir()
    python = tmp_path / 'runtime/bin/python'
    (records / 'cml-mcp').write_text(str(python))
    monkeypatch.setenv('NETCLAW_RUNTIME_ROOT', str(tmp_path))
    monkeypatch.setattr(startup.shutil, 'which', lambda command: None)
    argv, _ = startup.launchable('cml-mcp', {'command': 'python3', 'args': ['-m', 'cml_mcp']})
    assert argv[0] == str(python)
