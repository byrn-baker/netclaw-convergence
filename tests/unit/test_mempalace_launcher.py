import os
from pathlib import Path
import runpy
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize('explicit', [False, True])
def test_launcher_uses_recorded_runtime_and_module(tmp_path, monkeypatch, explicit):
    record = tmp_path / '.openclaw/python-runtimes/records/mempalace'
    record.parent.mkdir(parents=True)
    record.write_text('/recorded/bin/python\n')
    monkeypatch.setenv('HOME', str(tmp_path))
    if explicit:
        monkeypatch.setenv('MEMPALACE_MCP_PYTHON', '/explicit/bin/python')
    else:
        monkeypatch.delenv('MEMPALACE_MCP_PYTHON', raising=False)
    monkeypatch.setattr(sys, 'argv', ['mempalace-stdio.py', '--palace', '/fixture palace'])
    observed = []
    monkeypatch.setattr(os, 'execv', lambda *args: observed.append(args))
    runpy.run_path(str(ROOT / 'scripts/mempalace-stdio.py'), run_name='__main__')
    python = '/explicit/bin/python' if explicit else '/recorded/bin/python'
    assert observed == [(python, [python, '-m', 'mempalace.mcp_server', '--palace', '/fixture palace'])]
