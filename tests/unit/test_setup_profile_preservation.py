import importlib.util
import json
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('setup_profile', ROOT/'scripts/setup-profile.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def test_identity_preserves_operator_prose_and_retains_original(tmp_path):
    target = tmp_path/'USER.md'
    original = '# Operator\n\nKeep all network notes.\n'
    target.write_text(original)
    m.identity(target, 'Name', 'Role', 'Zone')
    assert target.read_text().startswith(original)
    backup, = (tmp_path/'.setup-backups').iterdir()
    assert backup.read_text() == original
    assert backup.stat().st_mode & 0o777 == 0o600
    first = target.read_text()
    m.identity(target, 'Name', 'Role', 'Zone')
    assert target.read_text() == first
    assert len(list((tmp_path/'.setup-backups').iterdir())) == 1
    m.identity(target, 'New name', 'Role', 'Zone')
    assert target.read_text().startswith(original)
    assert target.read_text().count(m.START) == 1


def test_voice_merge_escapes_label_and_preserves_policy(tmp_path):
    target = tmp_path/'voice.json'
    prior = {'whitelist':[{'phone_number':'+15551112222','label':'operator','can_initiate_calls':False}], 'quiet_hours':[{'custom':'keep'}], 'rate_limits':{'daily_max':1}}
    target.write_text(json.dumps(prior))
    m.voice(target, '+15551234567', 'Name "quoted" \\ literal', ROOT/'config/twilio-voice.json.example')
    actual = json.loads(target.read_text())
    assert actual['quiet_hours'] == prior['quiet_hours']
    assert actual['rate_limits'] == prior['rate_limits']
    assert actual['whitelist'][0] == prior['whitelist'][0]
    assert actual['whitelist'][1]['label'] == 'Name "quoted" \\ literal'
    first = target.read_bytes()
    m.voice(target, '+15551234567', 'Name "quoted" \\ literal', ROOT/'config/twilio-voice.json.example')
    assert target.read_bytes() == first
    assert target.stat().st_mode & 0o777 == 0o600


def test_fresh_voice_omits_example_number(tmp_path):
    target = tmp_path/'voice.json'
    m.voice(target, '+15551234567', 'fixture', ROOT/'config/twilio-voice.json.example')
    assert [r['phone_number'] for r in json.loads(target.read_text())['whitelist']] == ['+15551234567']


def test_malformed_existing_and_symlink_targets_are_preserved(tmp_path):
    target = tmp_path/'voice.json'
    target.write_text('invalid json')
    with pytest.raises(ValueError): m.voice(target, '+15551234567', 'fixture', ROOT/'config/twilio-voice.json.example')
    assert target.read_text() == 'invalid json'
    link = tmp_path/'USER.md'
    link.symlink_to(target)
    with pytest.raises(ValueError): m.identity(link, 'name','role','zone')
    assert target.read_text() == 'invalid json'
