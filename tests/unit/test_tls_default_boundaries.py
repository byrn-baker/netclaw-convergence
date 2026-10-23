"""Evaluate the actual startup expressions without importing optional SDKs."""
import ast
import importlib.util
import json
import os
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[2]
SOURCES=[
 ('catc-mcp/server.py','verify','CATALYST_CENTER_VERIFY_SSL'),
 ('gns3-mcp-server/gns3_mcp_server.py','GNS3_VERIFY_SSL','GNS3_VERIFY_SSL'),
 ('eve-ng-mcp-server/eve_client.py','EVE_VERIFY_SSL','EVE_VERIFY_SSL'),
 ('auvik-mcp/auvik_mcp_server.py','AUVIK_VERIFY_SSL','AUVIK_VERIFY_SSL'),
 ('halo-mcp/halo_mcp_server.py','HALO_VERIFY_SSL','HALO_VERIFY_SSL'),
 ('suzieq-mcp/suzieq_client.py','self.verify_ssl','SUZIEQ_VERIFY_SSL'),
 ('claroty-mcp/clients/claroty_client.py','self.verify_ssl','CLAROTY_VERIFY_SSL'),
]

@pytest.mark.parametrize('source,target,key',SOURCES)
@pytest.mark.parametrize('value',[None,'','${UNSET_VERIFY_SSL}','typo','true','false','0','no'])
def test_startup_tls_requires_explicit_disable(monkeypatch,source,target,key,value):
    if value is None:monkeypatch.delenv(key,raising=False)
    else:monkeypatch.setenv(key,value)
    tree=ast.parse((ROOT/'mcp-servers'/source).read_text())
    expressions=[node.value for node in ast.walk(tree) if isinstance(node,(ast.Assign,ast.AnnAssign)) and target in [ast.unparse(t) for t in (node.targets if isinstance(node,ast.Assign) else [node.target])]]
    assert len(expressions)==1
    actual=eval(compile(ast.Expression(expressions[0]),source,'eval'),{'os':os})
    assert actual is (value not in ('false','0','no'))


def test_registration_defaults_do_not_disable_tls():
    servers=json.loads((ROOT/'config/openclaw.json').read_text())['mcpServers']
    for name,key in [('redfish-mcp','REDFISH_VERIFY_TLS'),('cml-mcp','CML_VERIFY_SSL')]:
        assert servers[name]['env'][key]=='${'+key+':-true}'


@pytest.mark.parametrize('value',['','${VERIFY_SSL}','typo','true','false','0','no'])
def test_zabbix_wrapper_normalizes_before_actual_vendor_parser(monkeypatch,value):
    def load(name,path):
        spec=importlib.util.spec_from_file_location(name,ROOT/path);obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj);return obj
    config=load('zabbix_vendor_config','mcp-servers/zabbix-mcp/vendor/zabbix-mcp-server/src/zabbix_mcp_server/config.py')
    wrapper=load('zabbix_entry','scripts/zabbix-stdio.py')
    monkeypatch.setenv('VERIFY_SSL',value)
    seen=[]
    monkeypatch.setattr(wrapper.runpy,'run_module',lambda name,run_name: seen.append((name,run_name,config.parse_bool_env('VERIFY_SSL',default=True))))
    wrapper.main()
    assert seen==[('zabbix_mcp_server.server','__main__',value not in ('false','0','no'))]


def migration():
    spec=importlib.util.spec_from_file_location('tls_migration',ROOT/'scripts/migrate-tls-registration.py');obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj);return obj


def test_tls_registration_preview_repeat_recovery_and_conflict(tmp_path):
    obj=migration();path=tmp_path/'openclaw.json'
    original={'agent':'keep','mcpServers':{'zabbix-mcp':{'command':'/private/venv/python','args':['-m','zabbix_mcp_server.server'],'env':{'ZABBIX_TOKEN':'private-fixture'}},'redfish-mcp':{'env':{'REDFISH_VERIFY_TLS':'${REDFISH_VERIFY_TLS:-false}'}},'cml-mcp':{'env':{'CML_VERIFY_SSL':'false'}}}}
    path.write_text(json.dumps(original));before=path.read_bytes()
    obj.migrate(path,ROOT);assert path.read_bytes()==before
    assert not list(tmp_path.glob('*.pre-*'))
    obj.migrate(path,ROOT,apply=True);after=path.read_bytes();data=json.loads(after)
    assert data['agent']=='keep' and data['mcpServers']['zabbix-mcp']['env']==original['mcpServers']['zabbix-mcp']['env']
    assert data['mcpServers']['cml-mcp']['env']['CML_VERIFY_SSL']=='false'
    assert data['mcpServers']['zabbix-mcp']['args']==['-u',str(ROOT/'scripts/zabbix-stdio.py')]
    backup=path.with_name(path.name+'.pre-tls-registration');assert backup.read_bytes()==before and backup.stat().st_mode&0o777==0o600
    obj.migrate(path,ROOT,apply=True);assert path.read_bytes()==after
    path.write_text(json.dumps({**data,'newer':'operator edit'}))
    with pytest.raises(ValueError):obj.migrate(path,ROOT,apply=True,restore=True)
    assert json.loads(path.read_text())['newer']=='operator edit'
    path.write_bytes(after);obj.migrate(path,ROOT,apply=True,restore=True)
    assert path.read_bytes()==before


def test_custom_zabbix_launch_refuses_without_writing(tmp_path):
    obj=migration();path=tmp_path/'config.json';path.write_text(json.dumps({'mcpServers':{'zabbix-mcp':{'args':['custom']}}}));before=path.read_bytes()
    with pytest.raises(ValueError):obj.migrate(path,ROOT,apply=True)
    assert path.read_bytes()==before and not list(tmp_path.glob('*.pre-*'))
