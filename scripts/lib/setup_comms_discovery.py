"""Bounded inert discovery and exact-process cleanup for native MCP probes.

OpenClaw starts MCP servers in detached process groups. A private, one-use
handshake records the wrapper's kernel process generation before permitting its
exec, so timeout cleanup never relies on a name or an unbound numeric PID.
"""
import ctypes
import hashlib
import os
from pathlib import Path
import re
import secrets
import selectors
import signal
import subprocess
import sys
import time

from setup_schema import canonical, loads
from setup_state import Conflict, directory, guarded_read, guarded_write, revision


class _BSDInfo(ctypes.Structure):
    _fields_=[(name,ctypes.c_uint32) for name in (
        'flags','status','xstatus','pid','ppid','uid','gid','ruid','rgid','svuid','svgid','reserved')]+[
        ('comm',ctypes.c_char*16),('name',ctypes.c_char*32)]+[
        (name,ctypes.c_uint32) for name in ('nfiles','pgid','jobc','tdev','tpgid')]+[
        ('nice',ctypes.c_int32),('start_sec',ctypes.c_uint64),('start_usec',ctypes.c_uint64)]


def _process_info(pid):
    """Kernel birth identity; zombies are finished, unsupported hosts fail closed."""
    if type(pid) is not int or pid<=1:return None
    try:
        if sys.platform=='darwin':
            lib=ctypes.CDLL('/usr/lib/libproc.dylib',use_errno=True)
            lib.proc_pidinfo.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_uint64,ctypes.c_void_p,ctypes.c_int]
            lib.proc_pidinfo.restype=ctypes.c_int
            info=_BSDInfo()
            if lib.proc_pidinfo(pid,3,0,ctypes.byref(info),ctypes.sizeof(info))!=ctypes.sizeof(info):return None
            if info.pid!=pid or info.uid!=os.getuid():return None
            return {'pid':pid,'uid':info.uid,'pgid':info.pgid,'ppid':info.ppid,'zombie':info.status==5,
                'birth':f'mac:{info.start_sec}:{info.start_usec}'}
        if sys.platform.startswith('linux'):
            path=Path('/proc')/str(pid)/'stat';uid=path.stat().st_uid
            raw=path.read_text();fields=raw[raw.rfind(')')+2:].split()
            if uid!=os.getuid():return None
            return {'pid':pid,'uid':uid,'pgid':int(fields[2]),'ppid':int(fields[1]),'zombie':fields[0]=='Z','birth':'linux:'+fields[19]}
    except (OSError,ValueError,IndexError):pass
    return None


def process_identity(pid):
    info=_process_info(pid)
    return {key:value for key,value in info.items() if key not in ('ppid','zombie')} if info and not info['zombie'] else None


def _ended(identity):
    info=_process_info(identity['pid'])
    if info:
        return info['zombie'] or any(info[key]!=identity[key] for key in ('pid','uid','pgid','birth'))
    try:os.kill(identity['pid'],0)
    except ProcessLookupError:return True
    except PermissionError:return False
    return False # unreadable is not proof of termination


def _descends_from(identity,leader):
    """A matching lease alone cannot authorize adopting an unrelated process."""
    if process_identity(identity['pid'])!=identity or process_identity(leader['pid'])!=leader:return False
    pid=identity['pid'];seen=set()
    for _ in range(32):
        if pid in seen:return False
        seen.add(pid);info=_process_info(pid)
        if not info:return False
        if info['ppid']==leader['pid']:
            return process_identity(identity['pid'])==identity and process_identity(leader['pid'])==leader
        pid=info['ppid']
    return False


def _scope(path,home):
    path=Path(path);home=Path(home)
    if (path.name!='request.json' or path.parent.parent!=home/'.setup/tmp' or
        not re.fullmatch(r'comms-discovery-[a-zA-Z0-9_-]{6,64}',path.parent.name)):
        raise Conflict('comms_discovery_scope')
    with directory(path.parent,private=True):pass
    return path


def new_request(folder,home,server):
    path=_scope(Path(folder)/'request.json',home)
    supervisor=process_identity(os.getpid())
    if not supervisor:raise Conflict('comms_discovery_process_identity')
    owner=revision(Path(home)/'.netclaw-setup-owner.json')
    if not owner:raise Conflict('comms_discovery_owner')
    value={'schema':1,'state':'active','nonce':secrets.token_hex(32),'home':str(home),'server':server,
        'ownerRevision':owner,'supervisor':supervisor}
    guarded_write(path,canonical(value),expected=None)
    return path


def _request(path,home,server):
    path=_scope(path,home)
    raw=guarded_read(path,16384,private=True);value=loads(raw)
    if (set(value)!={'schema','state','nonce','home','server','ownerRevision','supervisor'} or
        value['schema']!=1 or value['state']!='active' or value['home']!=str(home) or value['server']!=server or
        not re.fullmatch(r'[0-9a-f]{64}',value.get('nonce','')) or
        value['ownerRevision']!=revision(Path(home)/'.netclaw-setup-owner.json') or
        process_identity(value.get('supervisor',{}).get('pid'))!=value['supervisor']):
        raise Conflict('comms_discovery_request_changed')
    return value,hashlib.sha256(raw).hexdigest()


def claim_child(home,server,request_path,*,timeout=5):
    """Called by the fixed launcher before exec, never by the MCP server itself."""
    request,digest=_request(request_path,home,server)
    identity=process_identity(os.getpid())
    if not identity or identity['pgid']!=identity['pid']:
        raise Conflict('comms_discovery_detached_identity')
    folder=Path(request_path).parent
    end=time.monotonic()+timeout
    leader=None
    while time.monotonic()<end and leader is None:
        try:
            probe=loads(guarded_read(folder/'probe.json',16384,private=True));leader=probe.get('process')
            if (set(probe)!={'schema','requestHash','process'} or probe['schema']!=1 or probe['requestHash']!=digest or
                not isinstance(leader,dict) or not _descends_from(identity,leader) or
                not _descends_from(leader,request['supervisor'])):raise Conflict('comms_discovery_probe_changed')
        except FileNotFoundError:time.sleep(.025)
    if leader is None:raise Conflict('comms_discovery_probe_missing')
    # This credential-free watcher survives cancellation of the outer probe.
    # The server cannot exec until both exact identities have been granted.
    watcher=subprocess.Popen([sys.executable,str(Path(__file__).resolve()),'watch',str(home),server,
        str(request_path),str(os.getpid())],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,start_new_session=True,env={'PATH':os.defpath,'PYTHONDONTWRITEBYTECODE':'1'})
    try:
        observer=process_identity(watcher.pid)
        if not observer:raise Conflict('comms_discovery_watcher_identity')
        lease={'schema':1,'requestHash':digest,'nonce':request['nonce'],'process':identity,'probe':leader,'watcher':observer}
        raw=canonical(lease);guarded_write(folder/'child.json',raw,expected=None)
        expected={'schema':1,'leaseHash':hashlib.sha256(raw).hexdigest(),'requestHash':digest}
        while time.monotonic()<end:
            _request(request_path,home,server)
            try:
                if loads(guarded_read(folder/'grant.json',16384,private=True))!=expected:
                    raise Conflict('comms_discovery_grant_changed')
                if process_identity(os.getpid())!=identity or process_identity(watcher.pid)!=observer:
                    raise Conflict('comms_discovery_process_changed')
                return
            except FileNotFoundError:time.sleep(.025)
        raise Conflict('comms_discovery_grant_timeout')
    except BaseException:
        watcher.terminate();watcher.wait(timeout=2)
        raise


def _grant(request_path,home,server,leader):
    request,digest=_request(request_path,home,server)
    folder=Path(request_path).parent
    try:raw=guarded_read(folder/'child.json',16384,private=True)
    except FileNotFoundError:return None
    child=loads(raw);identity=child.get('process')
    watcher=child.get('watcher')
    if (set(child)!={'schema','requestHash','nonce','process','probe','watcher'} or child['schema']!=1 or
        child['requestHash']!=digest or child['nonce']!=request['nonce'] or not isinstance(identity,dict) or
        set(identity)!={'pid','uid','pgid','birth'} or identity.get('pgid')!=identity.get('pid') or
        identity==request['supervisor'] or process_identity(identity.get('pid'))!=identity or
        child.get('probe')!=leader or not isinstance(watcher,dict) or
        set(watcher)!={'pid','uid','pgid','birth'} or watcher.get('pgid')!=watcher.get('pid') or
        not _descends_from(identity,leader) or not _descends_from(watcher,identity)):
        raise Conflict('comms_discovery_child_changed')
    grant=canonical({'schema':1,'leaseHash':hashlib.sha256(raw).hexdigest(),'requestHash':digest})
    try:
        if guarded_read(folder/'watcher-ready.json',16384,private=True)!=grant:
            raise Conflict('comms_discovery_watcher_changed')
    except FileNotFoundError:return None
    guarded_write(folder/'grant.json',grant,expected=None)
    return child


def _members(identity):
    """Snapshot only this still-bound group; no command-name based selection."""
    if process_identity(identity['pid'])!=identity:return []
    if identity['pgid']!=identity['pid']:raise Conflict('comms_discovery_group_changed')
    result=subprocess.run(['/bin/ps','-axo','pid=,pgid=,uid='],capture_output=True,timeout=2)
    if result.returncode or len(result.stdout)>1024*1024:raise Conflict('comms_discovery_process_list')
    found=[]
    for line in result.stdout.splitlines():
        parts=line.split()
        if len(parts)!=3 or not all(p.isdigit() for p in parts):continue
        pid,pgid,uid=map(int,parts)
        if pgid==identity['pgid'] and uid==identity['uid']:
            current=process_identity(pid)
            if current and current['pgid']==identity['pgid']:found.append(current)
    if len(found)>128:raise Conflict('comms_discovery_process_limit')
    if process_identity(identity['pid'])!=identity:return []
    return found


def stop_process(identity,*,grace=.4):
    """Signal only a generation-bound group and its observed surviving members."""
    if process_identity(identity['pid'])!=identity:return _ended(identity)
    members=_members(identity)
    if process_identity(identity['pid'])==identity:
        try:os.killpg(identity['pgid'],signal.SIGTERM)
        except ProcessLookupError:pass
    end=time.monotonic()+grace
    while time.monotonic()<end and any(process_identity(item['pid'])==item for item in members):time.sleep(.02)
    for item in members:
        if process_identity(item['pid'])==item:
            try:os.kill(item['pid'],signal.SIGKILL)
            except ProcessLookupError:pass
    end=time.monotonic()+1
    while time.monotonic()<end:
        if all(_ended(item) for item in members):return True
        time.sleep(.02)
    return False


def watch_discovery(home,server,request_path,parent_pid):
    """Lifetime guard; requires exact private lease and native parent ancestry."""
    identity=process_identity(os.getpid());parent=process_identity(parent_pid)
    if not identity or not parent or _process_info(os.getpid())['ppid']!=parent_pid:return
    request,digest=_request(request_path,home,server);end=time.monotonic()+5;lease=None
    while time.monotonic()<end:
        try:
            raw=guarded_read(Path(request_path).parent/'child.json',16384,private=True);lease=loads(raw);break
        except FileNotFoundError:time.sleep(.025)
    if (not lease or lease.get('watcher')!=identity or lease.get('process')!=parent or
        lease.get('requestHash')!=digest or lease.get('nonce')!=request['nonce'] or
        not _descends_from(parent,lease.get('probe',{}))):return
    leader=lease['probe'];end=time.monotonic()+100
    guarded_write(Path(request_path).parent/'watcher-ready.json',canonical({'schema':1,
        'leaseHash':hashlib.sha256(raw).hexdigest(),'requestHash':digest}),expected=None)
    while time.monotonic()<end:
        if _ended(parent) and _ended(leader):return
        try:_request(request_path,home,server)
        except Exception:break
        time.sleep(.05)
    for target in (parent,leader):stop_process(target)


def bounded_probe(argv,*,home,env,request_path,server,timeout=80,output_limit=1024*1024):
    """Bound memory/time and close all granted native children in every outcome."""
    process=None;leader=None;child=None;selector=selectors.DefaultSelector();output=bytearray()
    folder=Path(request_path).parent;clean=False
    try:
        _request(request_path,home,server)
        process=subprocess.Popen(argv,cwd=home,env=env,stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
        leader=process_identity(process.pid)
        if not leader or leader['pgid']!=process.pid:raise Conflict('comms_discovery_process_identity')
        _,digest=_request(request_path,home,server)
        guarded_write(folder/'probe.json',canonical({'schema':1,'requestHash':digest,'process':leader}),expected=None)
        for stream in (process.stdout,process.stderr):
            os.set_blocking(stream.fileno(),False);selector.register(stream,selectors.EVENT_READ)
        deadline=time.monotonic()+timeout;diagnostics=0
        while selector.get_map():
            if time.monotonic()>=deadline:raise Conflict('comms_discovery_timeout')
            if child is None:child=_grant(request_path,home,server,leader)
            events=selector.select(min(.05,max(0,deadline-time.monotonic())))
            for key,_ in events:
                raw=os.read(key.fd,65536)
                if not raw:selector.unregister(key.fileobj);continue
                if key.fileobj is process.stdout:
                    if len(output)+len(raw)>output_limit:raise Conflict('comms_discovery_output_limit')
                    output.extend(raw)
                else:
                    diagnostics+=len(raw)
                    if diagnostics>output_limit:raise Conflict('comms_discovery_output_limit')
            if process.poll() is not None and not events:break
        if process.wait(timeout=max(.01,deadline-time.monotonic()))!=0:
            raise Conflict('comms_discovery_probe_failed')
        if child is None:raise Conflict('comms_discovery_child_missing')
        return bytes(output)
    finally:
        # Revoke before cleanup: an as-yet ungranted detached wrapper cannot
        # enter its server even if native process creation raced the deadline.
        try:
            raw=guarded_read(request_path,16384,private=True);request=loads(raw);request['state']='closed'
            guarded_write(request_path,canonical(request),expected=hashlib.sha256(raw).hexdigest())
            clean=True
        except Exception:clean=False
        targets=[identity for identity in (child.get('process') if child else None,leader,
            child.get('watcher') if child else None) if identity]
        for identity in targets:
            if identity:
                try:stop_process(identity)
                except Exception:pass # the final independent liveness check decides
        if process is not None:
            try:process.wait(timeout=2)
            except subprocess.TimeoutExpired:clean=False
            for stream in (process.stdout,process.stderr):
                if stream is not None:stream.close()
        selector.close()
        # A dead native child can remain a zombie until its probe parent exits.
        # Evaluate after all parent/child cleanup and Popen reaping, not midway.
        end=time.monotonic()+2
        while time.monotonic()<end and not all(_ended(identity) for identity in targets):time.sleep(.02)
        clean=clean and all(_ended(identity) for identity in targets)
        guarded_write(folder/'cleanup.json',canonical({'schema':1,'complete':clean}),expected=None)
        if not clean:raise Conflict('comms_discovery_cleanup_unknown')


if __name__=='__main__':
    try:
        if len(sys.argv)!=6 or sys.argv[1]!='watch' or not sys.argv[5].isdigit():raise ValueError()
        watch_discovery(Path(sys.argv[2]),sys.argv[3],Path(sys.argv[4]),int(sys.argv[5]))
    except Exception:raise SystemExit(8)
