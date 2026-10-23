import importlib.util
from pathlib import Path
import ssl
import pytest

ROOT=Path(__file__).resolve().parents[2]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module


def test_verified_default_and_explicit_override(monkeypatch):
    monkeypatch.delenv('REDFISH_VERIFY_TLS',raising=False)
    monkeypatch.delenv('REDFISH_CA_BUNDLE',raising=False)
    client=load('redfish_secure','mcp-servers/redfish-mcp/client.py')
    calls=[]
    monkeypatch.setattr(client.httpx,'Client',lambda **kw:calls.append(kw))
    c=client.RedfishClient('https://bmc.example','fixture','fixture');c._client()
    assert calls[-1]['verify'] is True and calls[-1]['follow_redirects'] is False
    assert c.tls_note() is None
    monkeypatch.setattr(client,'VERIFY_TLS',False);c._client()
    assert calls[-1]['verify'] is False and 'DISABLED' in c.tls_note()


def test_custom_ca_is_loaded_into_verified_context(monkeypatch):
    import certifi
    monkeypatch.setenv('REDFISH_VERIFY_TLS','true');monkeypatch.setenv('REDFISH_CA_BUNDLE',certifi.where())
    client=load('redfish_private_ca','mcp-servers/redfish-mcp/client.py')
    calls=[];monkeypatch.setattr(client.httpx,'Client',lambda **kw:calls.append(kw))
    client.RedfishClient('https://bmc.example')._client()
    context=calls[0]['verify']
    assert context.verify_mode==ssl.CERT_REQUIRED and context.check_hostname


def test_redirect_is_not_reported_as_success(monkeypatch):
    import httpx
    client=load('redfish_redirect','mcp-servers/redfish-mcp/client.py')
    c=client.RedfishClient('https://bmc.example')
    transport=httpx.MockTransport(lambda request:httpx.Response(302,headers={'Location':'http://bmc.example/insecure'}))
    monkeypatch.setattr(c,'_client',lambda:httpx.Client(base_url=c.base,transport=transport,follow_redirects=False))
    with pytest.raises(client.BmcUnreachable,match='redirected'):c.get('/redfish/v1')


def test_migration_preserves_state_and_restores(tmp_path):
    migration=load('redfish_migration','scripts/migrate-integration-tls.py')
    p=tmp_path/'.env';original=b'REDFISH_PASSWORD=synthetic\nOTHER=retained\n';p.write_bytes(original)
    migration.migrate(p);assert p.read_bytes()==original
    migration.migrate(p,apply=True);changed=p.read_bytes()
    assert original in changed and b'REDFISH_VERIFY_TLS=true' in changed
    assert p.stat().st_mode&0o777==0o600
    migration.migrate(p,apply=True);assert p.read_bytes()==changed
    migration.migrate(p,restore=True);assert p.read_bytes()==changed
    migration.migrate(p,restore=True,apply=True);assert p.read_bytes()==original
    assert p.with_name('.env.pre-redfish-tls').read_bytes()==original
    with pytest.raises(FileExistsError):migration.migrate(p,lab_insecure=True,apply=True)
    assert p.read_bytes()==original


def test_invalid_ca_and_symlink_are_rejected_before_writes(tmp_path):
    migration=load('redfish_bad_migration','scripts/migrate-integration-tls.py')
    p=tmp_path/'.env';p.write_text('OTHER=retained\n')
    ca=tmp_path/'bad.pem';ca.write_text('not a certificate')
    with pytest.raises((ssl.SSLError,ValueError)):migration.migrate(p,ca=ca,apply=True)
    link=tmp_path/'link';link.symlink_to(p)
    with pytest.raises(ValueError):migration.migrate(link,apply=True)
    assert p.read_text()=='OTHER=retained\n'
    assert not p.with_name('.env.pre-redfish-tls').exists()
