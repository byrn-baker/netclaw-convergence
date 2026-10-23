import importlib.util
from pathlib import Path
import ssl
import pytest

ROOT=Path(__file__).resolve().parents[2]
@pytest.mark.parametrize('server',['nautobot-mcp-v2','nautobot-routing-mcp','nautobot-golden-config-mcp'])
def test_nautobot_verified_default_private_ca_and_explicit_override(server,monkeypatch):
    import certifi
    monkeypatch.setenv('NAUTOBOT_URL','https://fixture.example')
    monkeypatch.setenv('NAUTOBOT_TOKEN','synthetic-token')
    monkeypatch.delenv('NAUTOBOT_VERIFY_SSL',raising=False)
    monkeypatch.delenv('NAUTOBOT_CA_BUNDLE',raising=False)
    spec=importlib.util.spec_from_file_location(server,ROOT/'mcp-servers'/server/'nautobot_client.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    seen=[];monkeypatch.setattr(module.httpx,'AsyncClient',lambda **kwargs:seen.append(kwargs))
    module.NautobotClient();assert seen[-1]['verify'] is True
    monkeypatch.setenv('NAUTOBOT_CA_BUNDLE',certifi.where())
    module.NautobotClient();context=seen[-1]['verify']
    assert context.verify_mode==ssl.CERT_REQUIRED and context.check_hostname
    monkeypatch.setenv('NAUTOBOT_VERIFY_SSL','false')
    module.NautobotClient();assert seen[-1]['verify'] is False

@pytest.mark.parametrize('service,key',[('nautobot','NAUTOBOT_VERIFY_SSL'),('anta','ANTA_VERIFY_TLS')])
def test_service_migration_is_repeatable_and_reversible(tmp_path,service,key):
    spec=importlib.util.spec_from_file_location('tls_migration',ROOT/'scripts/migrate-integration-tls.py')
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    path=tmp_path/'.env';original=b'OTHER=fixture\n';path.write_bytes(original)
    m.migrate(path,service=service);assert path.read_bytes()==original
    m.migrate(path,service=service,apply=True)
    changed=path.read_bytes();assert (key+'=true').encode() in changed
    m.migrate(path,service=service,apply=True);assert path.read_bytes()==changed
    m.migrate(path,service=service,restore=True,apply=True);assert path.read_bytes()==original
