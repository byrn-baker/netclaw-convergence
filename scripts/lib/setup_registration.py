"""Translate catalog defaults into qualified native env references.

The qualified OpenClaw pin understands ${NAME}, not ${NAME:-default}. Values,
including resolved aliases, remain solely in this installation's private .env.
"""
import hashlib
import re
from setup_state import Conflict
from mcp_environment import defaults_for

REFERENCE=re.compile(r'\$\{([A-Z_][A-Z0-9_]*)(?::-([^}]*))?\}')

def native_environment(server,template,values):
    result={}
    defaults=defaults_for(server)
    for key,value in template.items():
        if not isinstance(value,str):raise Conflict('registration_environment_invalid')
        matches=list(REFERENCE.finditer(value))
        if not matches:
            if '${' in value:raise Conflict('registration_environment_invalid')
            result[key]=value;continue
        unresolved=False
        def resolve(match):
            nonlocal unresolved
            name,default=match.groups()
            if default is None:default=defaults.get(name)
            selected=values.get(name)
            if selected is None or selected=='':selected=default if default is not None else selected
            if selected is None or (selected=='' and default is None):unresolved=True;return match.group(0)
            return selected
        resolved=REFERENCE.sub(resolve,value)
        if unresolved:
            # Configure-later stays unresolved; never create a fake credential.
            result[key]=value;continue
        if '${' in resolved:raise Conflict('registration_environment_invalid')
        if resolved=='':
            result[key]='';continue  # Native substitution rejects empty aliases.
        alias='NETCLAW_SETUP_MCP_'+hashlib.sha256((server+'\0'+key).encode()).hexdigest()[:24].upper()
        if alias in values and values[alias]!=resolved:raise Conflict('registration_environment_changed')
        values[alias]=resolved
        result[key]='${'+alias+'}'
    return result
