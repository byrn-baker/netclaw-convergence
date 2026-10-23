import importlib.util
from pathlib import Path
import stat
import pytest

SPEC = importlib.util.spec_from_file_location('voice_migrate', Path(__file__).resolve().parents[2] / 'scripts/migrate-voice-auth.py')
migration = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(migration)


def test_preview_apply_repeat_restore_preserves_state_and_hides_secrets(tmp_path, monkeypatch, capsys):
    path = tmp_path / '.env'
    original = b'UNRELATED=preserve\nOPENCLAW_GATEWAY_TOKEN=synthetic-gateway-secret\n'
    path.write_bytes(original)
    monkeypatch.setenv('TWILIO_AUTH_TOKEN','synthetic-auth-secret')
    migration.migrate(path,'https://voice.example')
    assert path.read_bytes() == original
    assert not path.with_name('.env.pre-voice-auth').exists()
    migration.migrate(path,'https://voice.example',apply=True)
    contents=path.read_bytes()
    settings=migration.values(contents.decode())
    assert settings['TWILIO_AUTH_TOKEN']=='synthetic-auth-secret'
    assert settings['UNRELATED']=='preserve'
    assert settings['OPENCLAW_GATEWAY_TOKEN']=='synthetic-gateway-secret'
    assert len(settings['VOICE_ALERT_TOKEN'])>=32
    backup=path.with_name('.env.pre-voice-auth')
    assert backup.read_bytes()==original
    assert stat.S_IMODE(path.stat().st_mode)==0o600
    assert stat.S_IMODE(backup.stat().st_mode)==0o600
    migration.migrate(path,'https://voice.example',apply=True)
    assert path.read_bytes()==contents
    migration.migrate(path,restore=True)
    assert path.read_bytes()==contents
    migration.migrate(path,restore=True,apply=True)
    assert path.read_bytes()==original
    output=capsys.readouterr().out
    for secret in ('synthetic-auth-secret','synthetic-gateway-secret',settings['VOICE_ALERT_TOKEN']):
        assert secret not in output


def test_invalid_url_and_existing_backup_stop_before_mutation(tmp_path,monkeypatch):
    path=tmp_path/'.env';path.write_text('UNRELATED=preserve\n')
    monkeypatch.setenv('TWILIO_AUTH_TOKEN','synthetic-auth-secret')
    for url in ('http://voice.example','https://user:password@voice.example','https://voice.example?secret=value'):
        with pytest.raises(ValueError):migration.migrate(path,url,apply=True)
    backup=tmp_path/'.env.pre-voice-auth';backup.write_text('original backup')
    with pytest.raises(FileExistsError):migration.migrate(path,'https://voice.example',apply=True)
    assert path.read_text()=='UNRELATED=preserve\n'
    assert backup.read_text()=='original backup'


def test_symlink_and_failed_atomic_write_preserve_original(tmp_path,monkeypatch):
    path=tmp_path/'.env';path.write_text('UNRELATED=preserve\n')
    link=tmp_path/'link';link.symlink_to(path)
    with pytest.raises(ValueError):migration.migrate(link,apply=True)
    monkeypatch.setenv('TWILIO_AUTH_TOKEN','synthetic-auth-secret')
    def fail(*args):raise OSError('simulated replace failure')
    monkeypatch.setattr(migration.os,'replace',fail)
    with pytest.raises(OSError):migration.migrate(path,'https://voice.example',apply=True)
    assert path.read_text()=='UNRELATED=preserve\n'
    assert (tmp_path/'.env.pre-voice-auth').read_text()==path.read_text()
    assert not list(tmp_path.glob('.voice-auth-*'))


def test_credentials_with_quotes_roundtrip_through_runtime_dotenv(tmp_path, monkeypatch):
    from dotenv import dotenv_values
    path = tmp_path/'.env'
    path.write_text('OPENCLAW_GATEWAY_TOKEN=fixture\n')
    secret = '''fixture'"&|$literal`text\\end'''
    monkeypatch.setenv('TWILIO_AUTH_TOKEN', secret)
    migration.migrate(path, 'https://voice.example', apply=True)
    assert dotenv_values(path, interpolate=False)['TWILIO_AUTH_TOKEN'] == secret
    assert migration.values(path.read_text())['TWILIO_AUTH_TOKEN'] == secret
    contents = path.read_bytes()
    migration.migrate(path, 'https://voice.example', apply=True)
    assert path.read_bytes() == contents
