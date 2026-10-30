"""Wake an on-demand member through its owned native service, never a second worker."""
import os
from pathlib import Path
import plistlib
import pwd
import re
from setup_schema import loads
from setup_state import Conflict,guarded_read,revision
from setup_service_binding import verify
from setup_process import run

def start(home,source,*,execute=run,user_home=None):
    home,source=Path(home),Path(source)
    account=Path(user_home or pwd.getpwuid(os.getuid()).pw_dir).resolve()
    owner=loads(guarded_read(home/'.netclaw-setup-owner.json',16384,private=True))
    data=loads(guarded_read(home/'.setup/services.json',65536,private=True))
    if data.get('schema')!=1 or owner.get('schema')!=1 or data.get('home')!=str(home) or data.get('source')!=str(source) or data.get('userHome')!=str(account) or data.get('role')!='member' or data.get('runId')!=owner.get('runId') or data.get('owner')!=owner.get('installationId'):
        raise Conflict('member_service_owner_changed')
    verify(home,source,data.get('sourceIndex'))
    selected=[s for s in data['services'] if s.get('role')=='federation']
    if len(selected)!=1 or selected[0].get('hot') is not False:raise Conflict('member_not_on_demand')
    item=selected[0];platform=data['platform'];label=item['label']
    if not re.fullmatch('[A-Za-z0-9][A-Za-z0-9._-]{0,140}',label):raise Conflict('member_service_invalid')
    base=account/('Library/LaunchAgents' if platform=='macos' else '.config/systemd/user')
    suffix='.plist' if platform=='macos' else '.service'
    if platform not in ('macos','wsl2') or Path(item['file'])!=base/(label+suffix) or revision(item['file'])!=item['sha256']:
        raise Conflict('member_service_changed')
    args=item['arguments']
    if len(args)!=6 or args[1:]!=[str(source/'scripts/setup-service.py'),'--home',str(home),'--role','federation']:
        raise Conflict('member_service_invalid')
    env={'PATH':os.defpath,'HOME':str(account),'LANG':'C','XDG_RUNTIME_DIR':'/run/user/'+str(os.getuid()),
         'DBUS_SESSION_BUS_ADDRESS':'unix:path=/run/user/'+str(os.getuid())+'/bus'}
    def call(command):return execute(command,cwd=home,env=env,capture=True,timeout=20)
    if platform=='macos':
        disk=plistlib.loads(guarded_read(item['file'],65536,private=True))
        if disk.get('Label')!=label or disk.get('ProgramArguments')!=args or disk.get('WorkingDirectory')!=str(home) or disk.get('EnvironmentVariables') or disk.get('Program') or disk.get('KeepAlive') is not False:
            raise Conflict('member_service_changed')
        domain='gui/'+str(os.getuid());target=domain+'/'+label
        if call(['/bin/launchctl','print',domain])['returncode']:raise Conflict('member_manager_unavailable')
        loaded=call(['/bin/launchctl','print',target])
        if loaded['returncode']:
            if call(['/bin/launchctl','bootstrap',domain,item['file']])['returncode']:raise Conflict('member_service_start_unknown')
        else:
            text=loaded['stdout'].decode('utf-8','strict')
            match=re.search(r'\n\s*arguments = \{\n([\s\S]*?)\n\s*\}',text)
            if 'path = '+item['file'] not in text or not match or [a.strip() for a in match[1].splitlines() if a.strip()]!=args:
                raise Conflict('member_loaded_service_changed')
        # No -k: do not kill an already-running owned member.
        command=['/bin/launchctl','kickstart',target]
    else:
        unit=Path(item['file']).name
        def check_definition():
            result=call(['/usr/bin/systemctl','--user','show',unit,'--no-pager','--property=FragmentPath,DropInPaths,NeedDaemonReload'])
            fields=dict(line.split('=',1) for line in result['stdout'].decode().splitlines() if '=' in line)
            if result['returncode'] or fields.get('FragmentPath')!=item['file'] or fields.get('DropInPaths') or fields.get('NeedDaemonReload')!='no':
                raise Conflict('member_loaded_service_changed')
        check_definition()
        from setup_systemd import observe_argv
        observe_argv(call,item,allow_absent=True)
        command=['/usr/bin/systemctl','--user','start',unit]
    if revision(item['file'])!=item['sha256']:raise Conflict('member_service_changed')
    if call(command)['returncode']:raise Conflict('member_service_start_unknown')
    if platform=='wsl2':
        # Starting an exactly owned inactive unit may load it afresh. Confirm
        # the actual loaded definition and typed argv before acknowledging it.
        if revision(item['file'])!=item['sha256']:raise Conflict('member_service_changed')
        check_definition()
        observe_argv(call,item)
    # This is manager acknowledgement only. Border still waits for the pinned
    # authenticated member channel before routing any work.
    return True
