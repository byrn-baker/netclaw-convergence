"""Secrets enter through native input and leave only through owned env files.

No secret is placed in a plan, journal, event, argv, command string or temporary
answer file. Python strings cannot promise secure memory erasure; references are
dropped at phase completion/disconnect and never serialized to editor state.
"""
import hashlib
import importlib.util
import os
from pathlib import Path
import re
import secrets
import time

from setup_schema import Invalid, loads
from setup_state import Conflict, directory, guarded_read, guarded_write

_spec = importlib.util.spec_from_file_location('netclaw_dotenv', Path(__file__).resolve().parents[1]/'write-env.py')
_dotenv = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_dotenv)
KEY = re.compile(r'[A-Z][A-Z0-9_]{0,127}')


class SecretInbox:
    def __init__(self, run_id):
        self.run_id, self.pending, self.values = run_id, {}, {}

    def request(self, owner, key):
        if not KEY.fullmatch(key):
            raise Invalid('secret_key_invalid')
        request = {'protocol': 1, 'runId': self.run_id, 'requestId': secrets.token_hex(24),
                   'type': 'secret-request', 'owner': owner, 'key': key}
        self.pending[request['requestId']] = (request, time.monotonic()+300)
        return dict(request)

    def accept(self, data):
        frame = loads(data, 65536)
        allowed = {'protocol','runId','requestId','type','owner','key','value'}
        if not isinstance(frame, dict) or set(frame) != allowed or frame['type'] != 'secret':
            raise Invalid('secret_frame_invalid')
        request_id = frame['requestId']
        if not isinstance(request_id, str) or request_id not in self.pending:
            raise Invalid('secret_request_unknown')
        request, expires = self.pending[request_id]
        if time.monotonic() > expires or any(frame[k] != request[k] for k in ('protocol','runId','owner','key')):
            raise Invalid('secret_binding_mismatch')
        value = frame['value']
        if not isinstance(value,str) or not 0 < len(value.encode('utf-8')) <= 16384 or any(c in value for c in '\r\n\0'):
            raise Invalid('secret_value_invalid')
        self.values[(request['owner'], request['key'])] = value
        del self.pending[request_id]

    def take(self, owner, key):
        return self.values.pop((owner,key), None)

    def clear(self):
        self.pending.clear(); self.values.clear()


def child_environment(home, harness, credentials=None, *, tool_directories=()):
    home = Path(home)
    if not home.is_absolute() or harness not in ('openclaw','hermes'):
        raise Invalid('child_scope_invalid')
    # Directories are native preflight observations, never arbitrary plan values.
    directories = [str(home/'.setup/prefix/bin')] + [str(Path(p)) for p in tool_directories if Path(p).is_absolute()]
    env = {'HOME': str(home/'.setup/os-home'), 'PATH': ':'.join(directories+[os.defpath]),
           'XDG_CONFIG_HOME': str(home/'.setup/os-home/.config'),
           'XDG_CACHE_HOME': str(home/'.setup/cache'), 'XDG_DATA_HOME': str(home/'.setup/data'),
           'XDG_STATE_HOME': str(home/'.setup/state'), 'TMPDIR': str(home/'.setup/tmp'),
           'UV_CACHE_DIR': str(home/'.setup/cache/uv'), 'UV_PYTHON_INSTALL_DIR': str(home/'.setup/python'),
           # An installed system Python 3.14 must not become the companion's
           # executable. Independent installations own their interpreters.
           'UV_MANAGED_PYTHON': '1',
           'NPM_CONFIG_CACHE': str(home/'.setup/cache/npm'), 'NPM_CONFIG_PREFIX': str(home/'.setup/prefix'),
           'NPM_CONFIG_USERCONFIG': '/dev/null', 'PIP_CONFIG_FILE': '/dev/null',
           'HF_HOME':str(home/'.setup/cache/huggingface'),'HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1',
           'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_TERMINAL_PROMPT': '0',
           'PYTHONNOUSERSITE': '1', 'NETCLAW_RUNTIME': harness, 'LANG': 'en_US.UTF-8', 'LC_ALL': 'en_US.UTF-8'}
    if harness == 'openclaw':
        env.update(OPENCLAW_STATE_DIR=str(home), OPENCLAW_CONFIG_PATH=str(home/'openclaw.json'))
    else:
        env['HERMES_HOME'] = str(home)
    for key, value in (credentials or {}).items():
        if not KEY.fullmatch(key) or key in ('BASH_ENV','ENV','PYTHONPATH','NODE_OPTIONS','LD_PRELOAD','DYLD_INSERT_LIBRARIES'):
            raise Invalid('credential_environment_key_invalid')
        _dotenv.quote(value)  # single-line validation; no execution
        if key in env:
            if value != env[key]:
                raise Invalid('credential_environment_scope_changed')
            continue
        env[key] = value
    return env


def write_environment(path, values, *, expected):
    if any(not KEY.fullmatch(k) or not isinstance(v,str) for k,v in values.items()):
        raise Invalid('environment_values_invalid')
    with directory(Path(path).parent, private=True):
        pass
    data = ''.join(key+'='+_dotenv.quote(values[key])+'\n' for key in sorted(values)).encode('utf-8')
    return guarded_write(path, data, expected=expected)


def read_owned_environment(path, expected):
    data = guarded_read(path, 1024*1024, private=True)
    if not isinstance(expected,str) or hashlib.sha256(data).hexdigest() != expected:
        raise Conflict('environment_revision_changed')
    try:
        return _dotenv.values(data.decode('utf-8','strict'))
    except (ValueError, UnicodeError):
        raise Invalid('environment_parse_failed') from None
