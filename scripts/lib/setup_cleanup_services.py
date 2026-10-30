"""Stop only journal-owned native services before removing their exact files.

Observation never executes runtime code, starts a service or guesses a PID.
Unknown manager output and older unjournaled enable links remain retained.
"""
import hashlib
import os
from pathlib import Path
import plistlib
import pwd
import re
import socket
import time
from setup_schema import loads
from setup_state import Conflict,guarded_read,artifact_revision,revision,directory
from setup_process import run as process_run

ORDER={'federation':0,'hud':1,'gateway':2}

class NativeCleanup:
    def __init__(self,run,*,execute=process_run,user_home=None,pid_alive=None,ports_free=None,lock_fds=()):
        self.run=run;self.execute=execute
        self.lock_fds=tuple(lock_fds)
        self.account=Path(user_home or pwd.getpwuid(os.getuid()).pw_dir).resolve()
        self.pid_alive=pid_alive or self._alive;self.ports_free=ports_free or self._ports_free
        self.first={};self.latest={};self.shared=set()
        for effect in run['effects']:
            for item in effect.get('artifacts',[]):
                first=self.first.setdefault(item['path'],item);self.latest[item['path']]=item
                if first.get('owner')!=item.get('owner') or item.get('referencedBy')!=[item.get('owner')]:self.shared.add(item['path'])

    @staticmethod
    def _alive(pid):
        if not pid:return False
        try:os.kill(pid,0);return True
        except ProcessLookupError:return False
        except OSError:raise Conflict('cleanup_pid_unknown') from None

    @staticmethod
    def _ports_free(ports):
        for port in ports:
            with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as probe:
                # A closed federation/WebSocket connection can leave TIME_WAIT
                # after every owned PID and service has exited. Match native
                # TCP server reuse semantics without opting into SO_REUSEPORT;
                # an active listener must still refuse the reservation.
                probe.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
                try:probe.bind(('127.0.0.1',port))
                except OSError:return False
        return True

    def call(self,args):
        env={'HOME':str(self.account),'PATH':os.defpath,'LANG':'C','LC_ALL':'C',
             'XDG_RUNTIME_DIR':'/run/user/'+str(os.getuid()),'DBUS_SESSION_BUS_ADDRESS':'unix:path=/run/user/'+str(os.getuid())+'/bus'}
        result=self.execute(args,cwd=self.account,env=env,capture=True,timeout=10,limit=1024*1024,lock_fds=self.lock_fds)
        if result['returncode']:raise Conflict('cleanup_manager_unverified')
        return result['stdout'].decode('utf-8','strict')

    def owned(self,path,owner,kind,expected):
        first=self.first.get(str(path));last=self.latest.get(str(path))
        if not first or not last or str(path) in self.shared or first.get('before') is not None or first.get('existedBefore') or last.get('owner')!=owner or last.get('class')!=kind or last.get('referencedBy')!=[owner] or last.get('sha256')!=expected:
            raise Conflict('cleanup_service_not_owned')
        actual=artifact_revision(last)
        if actual not in (None,expected):raise Conflict('cleanup_service_changed')
        return actual

    def mac_jobs(self):
        listing=self.call(['/bin/launchctl','list']);lines=[s for s in listing.splitlines() if s.strip()]
        if not lines or lines[0].split()!=['PID','Status','Label']:raise Conflict('cleanup_manager_output_unknown')
        jobs={}
        for line in lines[1:]:
            parts=line.split()
            if len(parts)!=3 or not re.fullmatch(r'-|[1-9][0-9]*',parts[0]) or not re.fullmatch(r'-?[0-9]+',parts[1]) or parts[2] in jobs:raise Conflict('cleanup_manager_output_unknown')
            jobs[parts[2]]=None if parts[0]=='-' else int(parts[0])
        return jobs

    def observe(self,platform,item):
        if platform=='macos':
            jobs=self.mac_jobs()
            if item['label'] not in jobs:return {'loaded':False,'pid':None}
            try:text=self.call(['/bin/launchctl','print','gui/'+str(os.getuid())+'/'+item['label']])
            except Conflict:
                # A just-booted-out job may disappear between list and print.
                # Only a second successful, parsed manager listing proves it
                # absent; manager failure or a still-listed job stays unknown.
                if item['label'] not in self.mac_jobs():return {'loaded':False,'pid':None}
                raise
            match=re.search(r'\n\s*arguments = \{\n([\s\S]*?)\n\s*\}',text)
            pid=re.search(r'\n\s*pid = ([1-9][0-9]*)\b',text)
            if 'path = '+item['file'] not in text or not match or [a.strip() for a in match[1].splitlines() if a.strip()]!=item['arguments'] or (int(pid[1]) if pid else None)!=jobs[item['label']]:
                raise Conflict('cleanup_loaded_service_changed')
            return {'loaded':True,'pid':jobs[item['label']]}
        raw=self.call(['/usr/bin/systemctl','--user','show',Path(item['file']).name,'--no-pager',
                       '--property=LoadState,ActiveState,MainPID,FragmentPath,NeedDaemonReload,DropInPaths,ExecStart'])
        fields=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
        if fields.get('LoadState')=='not-found' and fields.get('ActiveState')=='inactive' and fields.get('MainPID')=='0' and not fields.get('FragmentPath') and not fields.get('ExecStart'):
            return {'loaded':False,'pid':None}
        pid=fields.get('MainPID','')
        if fields.get('LoadState')!='loaded' or fields.get('FragmentPath')!=item['file'] or fields.get('NeedDaemonReload')!='no' or fields.get('DropInPaths') or not pid.isdecimal() or fields.get('ActiveState') not in ('active','inactive','failed'):
            raise Conflict('cleanup_loaded_service_changed')
        from setup_systemd import observe_argv
        observe_argv(self.call,item)
        if int(pid)==1:raise Conflict('cleanup_pid_unknown')
        return {'loaded':fields['ActiveState']=='active' or int(pid)>0,'pid':int(pid) or None}

    def inspect(self,claw):
        home=Path(claw['runtimeHome']);file=home/'.setup/services.json'
        manifest=loads(guarded_read(file,65536,private=True));digest=revision(file)
        self.owned(file,claw['id'],'service-manifest',digest)
        expected={'schema':1,'owner':claw['id'],'runId':self.run['runId'],'harness':claw['harness'],'home':str(home),
                  'source':str(home/'.setup/source'),'platform':self.run['plan']['host']['platform'],'userHome':str(self.account)}
        if any(manifest.get(k)!=v for k,v in expected.items()) or manifest['platform'] not in ('macos','wsl2') or not isinstance(manifest.get('services'),list) or not 1<=len(manifest['services'])<=3:
            raise Conflict('cleanup_service_owner_changed')
        if loads(guarded_read(home/'netclaw-hud/installation.json',8192,private=True)).get('installationId')!=manifest.get('installationId'):
            raise Conflict('cleanup_service_owner_changed')
        platform=manifest['platform'];base=self.account/('Library/LaunchAgents' if platform=='macos' else '.config/systemd/user');services=[];roles=set();external=[]
        for item in manifest['services']:
            role=item.get('role');label=claw['service']['name']+'-'+str(role)
            path=base/(label+('.plist' if platform=='macos' else '.service'));args=item.get('arguments')
            if role not in ORDER or role in roles or item.get('label')!=label or item.get('file')!=str(path) or not isinstance(args,list) or len(args)!=6 or not all(isinstance(a,str) for a in args) or not Path(args[0]).is_absolute() or args[1:]!=[str(home/'.setup/source/scripts/setup-service.py'),'--home',str(home),'--role',role]:
                raise Conflict('cleanup_service_definition_invalid')
            roles.add(role);actual=self.owned(path,claw['id'],'service',item['sha256']);external.append(str(path))
            if actual is not None and platform=='macos':
                disk=plistlib.loads(guarded_read(path,65536,private=True))
                if disk.get('Label')!=label or disk.get('ProgramArguments')!=args or disk.get('WorkingDirectory')!=str(home) or disk.get('Program') or disk.get('EnvironmentVariables'):raise Conflict('cleanup_service_definition_invalid')
            if platform=='wsl2':
                link=base/'default.target.wants'/path.name;reference=item.get('enableLink')
                if os.path.lexists(link) or reference:
                    wanted={'path':str(link),'sha256':hashlib.sha256(str(path).encode()).hexdigest()}
                    if reference!=wanted:raise Conflict('cleanup_enable_link_unowned')
                    self.owned(link,claw['id'],'service-link',wanted['sha256']);external.append(str(link))
                # Additional enable aliases are not part of this run's journal.
                with directory(base):
                    for target in [*base.glob('*.wants'),*base.glob('*.requires')]:
                        if target.is_symlink():raise Conflict('cleanup_enable_link_unowned')
                        if target.name!='default.target.wants' and os.path.lexists(target/path.name):raise Conflict('cleanup_enable_link_unowned')
            services.append({**item,'observed':self.observe(platform,item)})
        return {'owner':claw['id'],'platform':platform,'manifestHash':digest,'services':services,'external':external,'ports':list(claw['endpoints'].values())}

    def stop(self,groups):
        work=sorted([(group,item) for group in groups for item in group['services']],key=lambda pair:ORDER[pair[1]['role']])
        for group,item in work:
            if self.observe(group['platform'],item)!=item['observed']:raise Conflict('cleanup_service_state_changed')
            previous=item['observed']['pid']
            if item['observed']['loaded']:
                args=['/bin/launchctl','bootout','gui/'+str(os.getuid())+'/'+item['label']] if group['platform']=='macos' else ['/usr/bin/systemctl','--user','stop',Path(item['file']).name]
                self.call(args)
            deadline=time.monotonic()+10
            while True:
                now=self.observe(group['platform'],item)
                if not now['loaded'] and not self.pid_alive(previous):break
                if time.monotonic()>=deadline:raise Conflict('cleanup_service_stop_unknown')
                time.sleep(.1)
        for group in groups:
            if not self.ports_free(group['ports']):raise Conflict('cleanup_endpoint_still_active')

    def removed(self,groups):
        if any(g['platform']=='wsl2' for g in groups):self.call(['/usr/bin/systemctl','--user','daemon-reload'])
        for group in groups:
            for item in group['services']:
                if self.observe(group['platform'],item)['loaded']:raise Conflict('cleanup_service_removal_unknown')
