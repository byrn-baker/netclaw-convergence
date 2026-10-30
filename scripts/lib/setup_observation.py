"""Read-only host/source observations used again under apply/resume locks."""
import hashlib
import os
from pathlib import Path
import platform
import socket
import stat

from setup_schema import canonical, loads
from setup_state import Conflict, directory, guarded_read
from setup_process import run

ORIGIN = 'https://github.com/automateyournetwork/netclaw.git'


def git(repository, *args):
    # Local read-only git commands only; no hooks, helpers, pager, optional locks,
    # inherited git config, alternate worktree or environment credential import.
    env = {'PATH': os.defpath, 'HOME': '/nonexistent', 'GIT_CONFIG_NOSYSTEM': '1',
           'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_OPTIONAL_LOCKS': '0',
           'GIT_TERMINAL_PROMPT': '0', 'LC_ALL': 'C'}
    result = run(['/usr/bin/git', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
                             '-c', 'core.untrackedCache=false', '-C', str(repository), *args],
                            cwd=repository, env=env, timeout=20, capture=True, limit=8*1024*1024)
    if result['returncode']:
        raise Conflict('source_observation_failed')
    return result['stdout']


def source_identity(repository):
    repository = Path(repository)
    with directory(repository):
        pass
    if git(repository, 'rev-parse', '--show-toplevel').decode().strip() != str(repository):
        raise Conflict('source_root_mismatch')
    origin = git(repository, 'config', '--get', 'remote.origin.url').decode().strip()
    if origin not in (ORIGIN, ORIGIN[:-4]):
        raise Conflict('source_origin_mismatch')
    commit = git(repository, 'rev-parse', '--verify', 'HEAD').decode().strip()
    if len(commit)!=40 or any(c not in '0123456789abcdef' for c in commit):raise Conflict('source_commit_invalid')
    # git status/diff may execute a checkout's configured clean filters. Compare
    # raw HEAD/index/blob data instead, before trusting any checkout code.
    head={}
    for row in git(repository,'ls-tree','-rz','--full-tree','HEAD').split(b'\0'):
        if not row:continue
        metadata,name=row.split(b'\t',1);mode,kind,oid=metadata.split(b' ')
        if kind!=b'blob':raise Conflict('source_submodule_unsupported')
        head[name]=(mode,oid)
    indexed={};dirty=False
    for row in git(repository,'ls-files','--stage','-z').split(b'\0'):
        if not row:continue
        metadata,name=row.split(b'\t',1);mode,oid,stage=metadata.split(b' ')
        if stage!=b'0':dirty=True
        indexed[name]=(mode,oid)
    dirty=dirty or indexed!=head
    names = sorted(set(git(repository, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split(b'\0')) - {b''})
    if len(names) > 50000:
        raise Conflict('source_file_limit')
    digest = hashlib.sha256(); total = 0
    for raw in names:
        try:
            relative = raw.decode('utf-8', 'strict')
        except UnicodeError:
            raise Conflict('source_path_encoding') from None
        if relative.startswith('/') or '..' in Path(relative).parts or '\n' in relative:
            raise Conflict('source_path_invalid')
        path = repository / relative
        try:
            # Hash the complete public git tree, including non-executable
            # project data with group-writable ancestors. Protocol/catalog reads
            # and executable source copying keep the stricter directory guard.
            with directory(path.parent,allow_shared_read=True) as parent:
                info = os.stat(path.name, dir_fd=parent, follow_symlinks=False)
                if stat.S_ISLNK(info.st_mode):
                    # Hash link text, never follow it. Only regular guarded
                    # protocol/catalog/entry files may be executed/read later.
                    data, mode = os.readlink(path.name, dir_fd=parent).encode(), b'l'
                else:
                    data = guarded_read(path, 64*1024*1024,allow_shared_read=True)
                    mode = b'x' if info.st_mode & 0o111 else b'f'
        except FileNotFoundError:
            # A reviewed deletion is part of the dirty tree identity.
            data, mode = b'', b'd'
        total += len(data)
        if total > 2*1024*1024*1024:
            raise Conflict('source_size_limit')
        git_mode={b'l':b'120000',b'x':b'100755',b'f':b'100644',b'd':b'd'}[mode]
        blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest().encode()
        if head.get(raw)!=(git_mode,blob):dirty=True
        digest.update(raw + b'\0' + mode + b'\0' + hashlib.sha256(data).digest())
    if set(names)!=set(head):dirty=True
    manifest = loads(guarded_read(repository / 'config/setup-engine.json', 16384))
    if manifest != {'protocol':{'major':1,'minor':0},'planSchema':1,'catalogSchema':1,
                    'entryPoint':'scripts/setup-engine.py','pythonMinimum':[3,10]}:
        raise Conflict('engine_protocol_mismatch')
    return {'commit': commit, 'treeHash': digest.hexdigest(), 'dirty': dirty}


def host_identity():
    machine = platform.machine().lower()
    architecture = {'aarch64': 'arm64', 'arm64': 'arm64', 'x86_64': 'x64', 'amd64': 'x64'}.get(machine)
    if not architecture:
        raise Conflict('unsupported_architecture')
    if platform.system() == 'Darwin':
        result = {'platform': 'macos', 'architecture': architecture, 'osVersion': platform.mac_ver()[0],
                  'remote': 'local', 'distribution': ''}
    elif platform.system() == 'Linux':
        release = Path('/proc/sys/kernel/osrelease').read_text().strip().lower()
        values = {}
        for line in Path('/etc/os-release').read_text().splitlines():
            if '=' in line:
                key, value = line.split('=', 1); values[key] = value.strip('"')
        if 'microsoft-standard-wsl2' not in release or values.get('ID') != 'ubuntu' or values.get('VERSION_ID') not in ('24.04', '26.04'):
            raise Conflict('unsupported_host')
        result = {'platform': 'wsl2', 'architecture': architecture, 'osVersion': values['VERSION_ID'],
                  'remote': 'wsl', 'distribution': os.environ.get('WSL_DISTRO_NAME', '')}
        if not result['distribution']:
            raise Conflict('unknown_wsl_distribution')
    else:
        raise Conflict('unsupported_host')
    result['fingerprint'] = hashlib.sha256(canonical({**result, 'uid': os.getuid(), 'node': platform.node()})).hexdigest()
    return result


class HostObservation:
    def binding(self, plan):
        source = source_identity(plan['source']['path'])
        if any(source[k] != plan['source'][k] for k in source):
            raise Conflict('source_changed')
        host = host_identity()
        if host != plan['host']:
            raise Conflict('host_changed')
        inputs = []
        for kind in ('inventory', 'identity'):
            for item in plan[kind]:
                digest = hashlib.sha256(guarded_read(item['path'], 256*1024 if item['kind'].startswith('testbed-') else 64*1024)).hexdigest()
                if digest != item['sha256']:
                    raise Conflict('input_changed')
                inputs.append({'owner': item['owner'], 'kind': item['kind'], 'sha256': digest})
        return {'source': source, 'host': host, 'inputs': inputs}

    def check(self, plan, run=None):
        self.binding(plan)
        if run is None:
            ports=[p for c in plan['claws'] for p in c['endpoints'].values()]
            ports.extend(b['port'] for b in plan.get('commsBindings',[]))
            from setup_comms import channel_listening_ports
            ports.extend(channel_listening_ports(plan))
            for port in ports:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
                    try:
                        probe.bind(('127.0.0.1', port))
                    except OSError:
                        raise Conflict('endpoint_occupied') from None
        # Services/endpoints created by this run are verified by their adapters.

    def controls(self, plan, required):
        # Native presence alone is not proof. Qualified control adapters populate
        # this observation only after authenticated, installation-bound probes.
        return [{'owner': owner, 'control': control, 'state': 'unverified'}
                for owner, control in required]
