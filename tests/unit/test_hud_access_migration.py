"""No-live-network tests for remote HUD access migration."""
import importlib.util
from pathlib import Path
from unittest.mock import patch
import pytest

spec = importlib.util.spec_from_file_location('hud_migrate', Path(__file__).parents[2] / 'scripts/migrate-hud-access.py')
migrate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migrate)


def test_preview_repeat_has_no_side_effects(capsys):
    with patch.object(migrate.subprocess, 'call') as call:
        assert migrate.main(['--ssh-target', 'operator@lab']) == 0
        first = capsys.readouterr().out
        assert migrate.main(['--ssh-target', 'operator@lab']) == 0
        assert capsys.readouterr().out == first
        call.assert_not_called()
    assert '127.0.0.1:3000:127.0.0.1:3000' in first
    assert 'Preview only' in first


@pytest.mark.parametrize('target', ['-oProxyCommand=bad', 'host;bad', 'user@host extra', 'user@', '$(bad)'])
def test_invalid_target_rejected_before_spawn(target):
    with patch.object(migrate.subprocess, 'call') as call, pytest.raises(SystemExit):
        migrate.main(['--ssh-target=' + target, '--connect'])
    call.assert_not_called()


@pytest.mark.parametrize('port', ['0', '65536', '-1', 'x', '3001'])
def test_invalid_or_conflicting_ports_rejected(port):
    with patch.object(migrate.subprocess, 'call') as call, pytest.raises(SystemExit):
        migrate.main(['--ssh-target', 'lab', '--ui-port=' + port, '--connect'])
    call.assert_not_called()


def test_ssh_failure_propagates_and_preserves_authentication():
    with patch.object(migrate.shutil, 'which', return_value='/usr/bin/ssh'), patch.object(migrate.subprocess, 'call', return_value=255) as call:
        assert migrate.main(['--ssh-target', 'lab', '--connect']) == 255
    argv = call.call_args.args[0]
    assert '-a' in argv
    assert 'ExitOnForwardFailure=yes' in argv
    assert 'StrictHostKeyChecking=ask' in argv
    assert call.call_args.kwargs == {}  # no shell


def test_missing_ssh_fails_before_connection():
    with patch.object(migrate.shutil, 'which', return_value=None), patch.object(migrate.subprocess, 'call') as call, pytest.raises(SystemExit):
        migrate.main(['--ssh-target', 'lab', '--connect'])
    call.assert_not_called()
