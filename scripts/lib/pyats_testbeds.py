"""Bounded, credential-free inventory composition. No network or device I/O."""
from datetime import datetime, timezone
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
MAX_BYTES = 8 * 1024 * 1024
MAX_DEVICES = 5000
SENSITIVE = re.compile(r'password|passwd|secret|token|credential|authorization|private.?key|configuration|environment|^env$|^pyats$', re.I)
IDENTITY = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.:@ /=-]{0,191}\Z')
NAME = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,63}\Z')
OS_NAMES = {'ios','iosxe','iosxr','nxos','eos','junos','linux','asa','aireos','bigip','vyos','sros','comware'}
OS_ALIASES = {'ios-xe':'iosxe','ios-xr':'iosxr','nx-os':'nxos','ios xe':'iosxe','ios xr':'iosxr','nx os':'nxos'}
FIELDS = {'id','name','host','os','port'}


class TestbedError(ValueError):
    """Messages are fixed codes, never source values or upstream exceptions."""


def catalog():
    return json.loads((ROOT/'config/pyats-testbed-sources.json').read_text())['sources']


def policy(value=None):
    value = value if value is not None else {'mode':'static','sources':[]}
    if not isinstance(value,dict) or set(value)-{'mode','sources'}:
        raise TestbedError('invalid_testbed_policy')
    mode, sources = value.get('mode'), value.get('sources',[])
    ids={s['id'] for s in catalog()}
    if mode not in ('static','dynamic') or not isinstance(sources,list) or any(not isinstance(s,str) or s not in ids for s in sources):
        raise TestbedError('invalid_testbed_source')
    if len(sources)!=len(set(sources)) or (mode=='dynamic' and not sources) or (mode=='static' and sources):
        raise TestbedError('testbed_mode_sources_mismatch')
    return {'mode':mode,'sources':sorted(sources)}


def environment_policy(env):
    return policy({'mode':env.get('NETCLAW_TESTBED_MODE','static'),
                   'sources':[s.strip() for s in env.get('NETCLAW_TESTBED_SOURCES','').split(',') if s.strip()]})


def policy_environment(value, static_path):
    p=policy(value)
    return {'NETCLAW_TESTBED_MODE':p['mode'],'NETCLAW_TESTBED_SOURCES':','.join(p['sources']),
            'PYATS_MCP_DYNAMIC_ONLY':'1' if p['mode']=='dynamic' else '0',
            'PYATS_TESTBED_PATH':'' if p['mode']=='dynamic' else str(static_path)}


def bounded_json(value):
    try:
        raw=json.dumps(value,ensure_ascii=True,allow_nan=False).encode()
    except (ValueError,TypeError,RecursionError):
        raise TestbedError('invalid_json') from None
    if len(raw)>MAX_BYTES:
        raise TestbedError('inventory_too_large')
    return raw


def identity(value):
    if not isinstance(value,(str,int)) or isinstance(value,bool) or not IDENTITY.fullmatch(str(value)):
        raise TestbedError('invalid_source_identity')
    return str(value)


def timestamp(value, now, max_age):
    try:
        date=datetime.fromisoformat(value.replace('Z','+00:00'))
        if date.tzinfo is None or date.utcoffset().total_seconds()!=0:
            raise ValueError()
        age=(now-date).total_seconds()
        if age < -60 or age > max_age:
            raise ValueError()
        return date.isoformat().replace('+00:00','Z')
    except (AttributeError,TypeError,ValueError,OverflowError):
        raise TestbedError('inventory_stale_or_invalid_timestamp') from None


def path_value(record, path):
    if not isinstance(path,str) or len(path)>160 or any(not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]*',p) or SENSITIVE.search(p) for p in path.split('.')):
        raise TestbedError('unsafe_mapping_path')
    value=record
    for part in path.split('.'):
        value=value.get(part) if isinstance(value,dict) else None
    return value


def host(value):
    if not isinstance(value,str) or len(value)>253 or value!=value.strip():
        raise TestbedError('missing_or_invalid_management_address')
    try:
        ip=ipaddress.ip_interface(value).ip if '/' in value else ipaddress.ip_address(value)
        if ip.is_unspecified or ip.is_multicast:
            raise ValueError()
        return str(ip)
    except ValueError:
        if '/' in value or ':' in value or re.fullmatch(r'[0-9.]+',value) or not re.fullmatch(r'(?=.{1,253}\Z)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.?',value):
            raise TestbedError('missing_or_invalid_management_address') from None
        return value.lower().rstrip('.')


def credential_refs(value):
    defaults={'username_env':'NETCLAW_USERNAME','password_env':'NETCLAW_PASSWORD','enable_env':'NETCLAW_ENABLE_PASSWORD'}
    if value is None:
        return defaults
    if not isinstance(value,dict) or set(value)!=set(defaults):
        raise TestbedError('device_credentials_require_three_env_references')
    for key,ref in value.items():
        suffix={'username_env':'USERNAME','password_env':'PASSWORD','enable_env':'(?:ENABLE_)?PASSWORD'}[key]
        if not isinstance(ref,str) or len(ref)>128 or not re.fullmatch(r'(?:NETCLAW_|PYATS_DEVICE_(?:[A-Z0-9]+_)*)(?:'+suffix+r')',ref):
            raise TestbedError('invalid_device_credential_reference')
    return dict(value)


def compose(envelope, selected=None, now=None):
    """Return fixed builder arguments and sanitized provenance; reject all omissions."""
    bounded_json(envelope)
    if not isinstance(envelope,dict) or set(envelope)-{'schema','name','sources','credentials','maxAgeSeconds'} or envelope.get('schema')!=1:
        raise TestbedError('invalid_composition_envelope')
    name=envelope.get('name')
    if not isinstance(name,str) or not NAME.fullmatch(name) or name=='static':
        raise TestbedError('invalid_candidate_name')
    max_age=envelope.get('maxAgeSeconds',86400)
    if type(max_age) is not int or not 1<=max_age<=31*86400:
        raise TestbedError('invalid_freshness_limit')
    now=now or datetime.now(timezone.utc)
    sources=envelope.get('sources')
    if not isinstance(sources,list) or not 1<=len(sources)<=32:
        raise TestbedError('sources_required')
    definitions={s['id']:s for s in catalog()}
    allowed=set(definitions) if selected is None else set(selected)
    records=[]; summaries=[]; names=set(); endpoints=set(); identities=set(); source_keys=set()
    for source in sources:
        if not isinstance(source,dict) or set(source)-{'kind','owner','scope','capturedAt','snapshotCapturedAt','complete','total','records','mapping','osMap','defaults','endpoints'}:
            raise TestbedError('invalid_source_envelope')
        kind=source.get('kind')
        if kind not in definitions or kind not in allowed:
            raise TestbedError('source_not_selected')
        owner=identity(source.get('owner')); scope=source.get('scope')
        if not isinstance(scope,dict) or not 1<=len(scope)<=12:
            raise TestbedError('source_scope_required')
        scope={identity(k):identity(v) for k,v in scope.items() if not SENSITIVE.search(str(k))}
        if len(scope)!=len(source['scope']):
            raise TestbedError('unsafe_scope_field')
        scope_key=json.dumps(scope,sort_keys=True)
        key=(kind,owner,scope_key)
        if key in source_keys:
            raise TestbedError('duplicate_source_scope')
        source_keys.add(key)
        captured=timestamp(source.get('capturedAt'),now,max_age)
        snapshot=None
        if kind in ('ipfabric','forward') or 'snapshotCapturedAt' in source:
            if not scope.get('snapshot_id') or scope['snapshot_id'].startswith('$'):
                raise TestbedError('concrete_snapshot_required')
            snapshot=timestamp(source.get('snapshotCapturedAt'),now,max_age)
        rows=source.get('records')
        if source.get('complete') is not True or not isinstance(rows,list) or not rows or type(source.get('total')) is not int or source['total']!=len(rows):
            raise TestbedError('complete_nonempty_inventory_required')
        if len(records)+len(rows)>MAX_DEVICES:
            raise TestbedError('device_limit_exceeded')
        overrides=source.get('mapping',{})
        if not isinstance(overrides,dict):
            raise TestbedError('invalid_mapping')
        mapping={**definitions[kind]['mapping'],**overrides}
        if set(mapping)-FIELDS:
            raise TestbedError('unsupported_mapping_field')
        defaults=source.get('defaults',{})
        if not isinstance(defaults,dict) or set(defaults)-{'port'}:
            raise TestbedError('only_explicit_ssh_port_default_supported')
        os_map=source.get('osMap',{})
        if not isinstance(os_map,dict) or len(os_map)>100:
            raise TestbedError('invalid_os_map')
        enrichment=source.get('endpoints',{})
        if not isinstance(enrichment,dict) or len(enrichment)>len(rows):
            raise TestbedError('invalid_endpoint_enrichment')
        used=set()
        for row in rows:
            if not isinstance(row,dict):
                raise TestbedError('records_must_be_objects')
            values={field:path_value(row,path) for field,path in mapping.items()}
            device_id=identity(values.get('id'))
            stable=key+(device_id,)
            if stable in identities:
                raise TestbedError('duplicate_source_device')
            identities.add(stable)
            extra=enrichment.get(device_id)
            if extra is not None:
                if not isinstance(extra,dict) or set(extra)-{'host','port','os','observedAt','evidence'} or not extra.get('evidence'):
                    raise TestbedError('invalid_endpoint_evidence')
                timestamp(extra.get('observedAt'),now,max_age);identity(extra['evidence']);used.add(device_id)
                for field in ('host','port','os'):
                    if field in extra:
                        if values.get(field) not in (None,'',extra[field]):
                            raise TestbedError('endpoint_enrichment_conflict')
                        values[field]=extra[field]
            device_name=values.get('name')
            if not isinstance(device_name,str) or not NAME.fullmatch(device_name):
                raise TestbedError('invalid_device_name')
            if device_name.casefold() in names:
                raise TestbedError('conflicting_device_names')
            names.add(device_name.casefold())
            address=host(values.get('host'))
            port=values.get('port') if values.get('port') is not None else defaults.get('port')
            if isinstance(port,str) and re.fullmatch(r'[0-9]{1,5}',port):port=int(port)
            if type(port) is not int or not 1<=port<=65535:
                raise TestbedError('explicit_valid_ssh_port_required')
            endpoint=(address,port)
            if endpoint in endpoints:
                raise TestbedError('conflicting_management_endpoints')
            endpoints.add(endpoint)
            raw_os=values.get('os')
            if not isinstance(raw_os,str):
                raise TestbedError('explicit_os_mapping_required')
            chosen=os_map.get(raw_os,OS_ALIASES.get(raw_os.lower(),raw_os.lower()))
            if not isinstance(chosen,str) or chosen not in OS_NAMES:
                raise TestbedError('explicit_os_mapping_required')
            records.append({'name':device_name,'host':address,'port':port,'os':chosen})
        if set(enrichment)!=used:
            raise TestbedError('unmatched_endpoint_enrichment')
        summaries.append({'kind':kind,'owner':owner,'scope':scope,'capturedAt':captured,
                          'snapshotCapturedAt':snapshot,'count':len(rows)})
    credentials=credential_refs(envelope.get('credentials'))
    digest=hashlib.sha256(bounded_json({'records':records,'credentials':credentials,'sources':summaries})).hexdigest()
    return {'arguments':{'name':name,'source':'inline','data':records,'mapping':{'name':'name','ip':'host','os':'os','port':'port'},
                         'credentials':credentials,'activate':False,'max_devices':MAX_DEVICES},
            'preview':{'name':name,'digest':digest,'devices':len(records),'sources':summaries,
                       'credentialReferences':credentials,'rows':records[:50],'total':len(records),
                       'reachability':'not_checked','login':'not_checked','execution':'not_checked'}}
