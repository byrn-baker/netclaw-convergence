"""Real Flask routes and SDK signatures; all downstream work is synthetic."""
import importlib
from pathlib import Path
import sys
import pytest
from twilio.request_validator import RequestValidator

TOKEN = 'synthetic-auth-token-for-tests'
PUBLIC = 'https://voice.example'
BASE = '/webhooks/twilio/voice'
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'mcp-servers/twilio-voice-mcp'))

@pytest.fixture
def server(monkeypatch):
    monkeypatch.setenv('TWILIO_AUTH_TOKEN', TOKEN)
    monkeypatch.setenv('VOICE_WEBHOOK_URL', PUBLIC)
    monkeypatch.setenv('VOICE_ALERT_TOKEN', 'synthetic-alert-token')
    monkeypatch.setenv('OPENCLAW_GATEWAY_TOKEN', '')
    module = importlib.import_module('webhook_server')
    monkeypatch.setattr(module, 'load_config', lambda: {})
    monkeypatch.setattr(module, 'is_whitelisted', lambda *args, **kwargs: (True, {}))
    monkeypatch.setattr(module, 'start_async_processing', lambda *args: None)
    module._active_calls.clear()
    return module


def test_unsigned_callbacks_reject_before_dispatch(server, monkeypatch):
    dispatched = []
    monkeypatch.setattr(server, 'start_async_processing', lambda *args: dispatched.append(args))
    client = server.app.test_client()
    response = client.post(BASE+'/process-command', data={'CallSid':'synthetic-call','From':'+15555550101','SpeechResult':'show status'})
    assert response.status_code == 403
    assert not dispatched
    assert not server._active_calls


def test_unauthenticated_alert_rejects_before_call(server, monkeypatch):
    dispatched = []
    async def fake(*args):
        dispatched.append(args)
        return []
    monkeypatch.setattr(server, 'process_event_for_alerts', fake)
    response = server.app.test_client().post(BASE+'/trigger-alert', json={'event_source':'test','event_data':{}})
    assert response.status_code == 403
    assert not dispatched


def signed_headers(path, data):
    return {'X-Twilio-Signature':RequestValidator(TOKEN).compute_signature(PUBLIC+path, data)}


def test_signed_status_uses_configured_public_url_not_forwarded_headers(server):
    path=BASE+'/status?event=1'
    data={'CallSid':'synthetic-call','CallStatus':'completed'}
    headers=signed_headers(path,data)
    headers.update({'X-Forwarded-Host':'untrusted.example','X-Forwarded-Proto':'http'})
    client=server.app.test_client()
    assert client.post(path, data=data, headers=headers, base_url='http://internal.local').status_code == 200
    assert client.post(path, data={**data,'CallStatus':'changed'}, headers=headers).status_code == 403


def test_missing_auth_token_fails_closed(server, monkeypatch):
    monkeypatch.setattr(server, 'validator', None)
    assert server.app.test_client().post(BASE+'/status', data={}).status_code == 503


def test_signed_interactive_request_still_requires_allowlisted_caller(server, monkeypatch):
    monkeypatch.setattr(server, 'is_whitelisted', lambda *args, **kwargs: (False, None))
    data={'CallSid':'synthetic-call','From':'+15555550101','SpeechResult':'show status'}
    path=BASE+'/process-command'
    assert server.app.test_client().post(path,data=data,headers=signed_headers(path,data)).status_code == 403


def test_authenticated_alert_and_outbound_callback_preserved(server, monkeypatch):
    dispatched=[]
    async def fake(*args): dispatched.append(args);return []
    monkeypatch.setattr(server,'process_event_for_alerts',fake)
    client=server.app.test_client()
    assert client.post(BASE+'/trigger-alert',json={'event_source':'fixture'},headers={'Authorization':'Bearer synthetic-alert-token'}).status_code == 200
    assert len(dispatched)==1
    checked=[]
    monkeypatch.setattr(server,'is_whitelisted',lambda number,direction: checked.append((number,direction)) or (True,{}))
    data={'CallSid':'synthetic-call','From':'+15555550000','To':'+15555550101','Direction':'outbound-api','SpeechResult':'goodbye'}
    path=BASE+'/process-command'
    assert client.post(path,data=data,headers=signed_headers(path,data)).status_code == 200
    assert checked == [('+15555550101','outbound')]


def test_cml_tls_defaults_and_explicit_lab_override(server, monkeypatch):
    monkeypatch.delenv('CML_VERIFY_SSL', raising=False)
    monkeypatch.delenv('CML_CA_BUNDLE', raising=False)
    assert server.cml_tls_verify() is True
    monkeypatch.setenv('CML_VERIFY_SSL', 'false')
    assert server.cml_tls_verify() is False
    monkeypatch.setenv('CML_VERIFY_SSL', 'true')
    monkeypatch.setenv('CML_CA_BUNDLE', '/synthetic/ca.pem')
    sentinel = object()
    monkeypatch.setattr(server.ssl, 'create_default_context', lambda *, cafile: sentinel if cafile == '/synthetic/ca.pem' else None)
    assert server.cml_tls_verify() is sentinel


def test_every_registered_voice_route_is_guarded_before_its_handler(server, monkeypatch):
    reached = []
    for rule in server.app.url_map.iter_rules():
        if not rule.rule.startswith(BASE):
            continue
        monkeypatch.setitem(server.app.view_functions, rule.endpoint, lambda: reached.append(True) or 'unexpected')
        response = server.app.test_client().post(rule.rule)
        assert response.status_code == 403, rule.rule
    assert reached == []
