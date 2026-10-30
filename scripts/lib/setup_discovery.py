"""Read-only, explicit loopback model discovery. No scan, load, pull or inference."""
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
from urllib.error import HTTPError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, build_opener, ProxyHandler, HTTPRedirectHandler


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None


def fetch(url):
    opener=build_opener(ProxyHandler({}),NoRedirect())
    with opener.open(Request(url,headers={'Accept':'application/json'}),timeout=4) as response:
        data=response.read(1024*1024+1)
    if len(data)>1024*1024:raise ValueError('response_limit')
    return json.loads(data)


def text(value):
    return value if isinstance(value,str) and 0<len(value)<=256 and not any(ord(c)<32 or ord(c)==127 for c in value) else None


def number(value):
    return value if type(value) is int and 0<value<=2**53-1 else None


def origin(endpoint):
    url=urlsplit(endpoint)
    if url.scheme not in ('http','https') or url.hostname not in ('localhost','127.0.0.1','::1') or url.username or url.password or url.query or url.fragment or url.path.rstrip('/') not in ('','/v1') or url.port==0:
        raise ValueError('explicit_loopback_endpoint_required')
    host='[::1]' if url.hostname=='::1' else '127.0.0.1'
    if url.port:host+=':'+str(url.port)
    return urlunsplit((url.scheme,host,'','',''))


def discover(provider,endpoint,*,get=fetch):
    base=origin(endpoint)
    if provider not in ('ollama','lm-studio'):raise ValueError('discovery_provider_unsupported')
    report={'schema':1,'provider':provider,'state':'unverified','models':[],'inference':'unverified','offline':'unverified'}
    try:
        data=get(base+('/api/tags' if provider=='ollama' else '/api/v1/models'))
        entries=data.get('models')
        if not isinstance(entries,list) or len(entries)>512:raise ValueError()
        for row in entries:
            if not isinstance(row,dict):continue
            if provider=='lm-studio' and row.get('type')!='llm':continue
            name=text(row.get('name') if provider=='ollama' else row.get('key'))
            if name is None:continue
            details=row.get('details') or {}
            if not isinstance(details,dict):details={}
            caps=row.get('capabilities') or {}
            if not isinstance(caps,dict):caps={}
            quant=row.get('quantization') or {}
            if not isinstance(quant,dict):quant={}
            report['models'].append({'id':name,'installedBytes':number(row.get('size') if provider=='ollama' else row.get('size_bytes')),
                'downloadBytes':None,'parameters':text(details.get('parameter_size') if provider=='ollama' else row.get('params_string')),
                'quantization':text(details.get('quantization_level') if provider=='ollama' else quant.get('name')),
                'contextLength':number(row.get('max_context_length')),
                'loaded':bool(row.get('loaded_instances')) if provider=='lm-studio' and isinstance(row.get('loaded_instances'),list) else None,
                'toolUse':caps.get('trained_for_tool_use') if type(caps.get('trained_for_tool_use')) is bool else None})
        report['state']='observed'
    except HTTPError as error:report['state']='authentication_required' if error.code in (401,403) else 'unavailable'
    except (OSError,ValueError,TypeError,AttributeError):pass
    return report


def hardware(destination):
    memory=None;free=None
    try:
        if platform.system()=='Darwin':
            value=subprocess.run(['/usr/sbin/sysctl','-n','hw.memsize'],capture_output=True,timeout=3,env={'PATH':'/usr/bin:/bin','LANG':'C'},check=True).stdout
            if len(value)<32:memory=number(int(value))
        else:memory=number(os.sysconf('SC_PHYS_PAGES')*os.sysconf('SC_PAGE_SIZE'))
    except (OSError,ValueError,subprocess.SubprocessError):pass
    try:
        target=Path(destination)
        while not target.exists() and target.parent!=target:target=target.parent
        free=number(shutil.disk_usage(target).free)
    except OSError:pass
    return {'memoryBytes':memory,'diskFreeBytes':free,'memoryRequiredBytes':None,
            'note':'Model weights, context, KV cache and concurrent members all consume memory. Installed file size is not a memory requirement or a download estimate.'}


def download_advice(model,host):
    # The qualified listing APIs expose installed sizes, not an authoritative
    # missing-model transfer estimate. Never substitute one for the other.
    return {'state':'deferred','automaticDownload':False,'downloadBytes':None,
            'code':'download_size_unavailable','hardware':host,
            'guidance':'Use the runtime model manager to review size and hardware needs, approve its download there, then refresh installed models.'}
