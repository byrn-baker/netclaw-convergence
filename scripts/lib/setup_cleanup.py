"""Revision-bound cleanup of proved run-created files; never recursive removal."""
import hashlib
import os
from pathlib import Path
import stat
import re
import time
from contextlib import contextmanager
from setup_schema import canonical,loads
from setup_state import Conflict,directory,guarded_read,revision,artifact_revision

@contextmanager
def management_lock(home,run_id):
    """Share Spec152's exclusive mutation lock; never overlap native controls."""
    state=Path(home)/'netclaw-hud/management'
    with directory(state,create=True,private=True) as parent:
        try:fd=os.open('mutation.lock',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=parent)
        except FileExistsError:
            record=loads(guarded_read(state/'mutation.lock',16384,private=True))
            if record.get('setupCleanup') is not True or record.get('setupRunId')!=run_id or type(record.get('pid')) is not int or record['pid']<2:raise Conflict('cleanup_management_busy')
            try:os.kill(record['pid'],0)
            except ProcessLookupError:pass
            except OSError:raise Conflict('cleanup_management_busy') from None
            else:raise Conflict('cleanup_management_busy')
            # Caller already holds the engine's inherited writer locks. A dead
            # cleanup owner may be reclaimed only through fresh native review.
            os.unlink('mutation.lock',dir_fd=parent)
            fd=os.open('mutation.lock',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=parent)
        identity=os.fstat(fd);abandoned=False
        try:
            os.write(fd,canonical({'pid':os.getpid(),'started':int(time.time()*1000),'setupCleanup':True,'setupRunId':run_id}));os.fsync(fd);os.fsync(parent)
            operations=state/'operations'
            if operations.exists():
                with directory(operations,private=True):
                    names=list(operations.iterdir())
                    if len(names)>20000:raise Conflict('cleanup_management_history_limit')
                    for item in names:
                        if re.fullmatch(r'[a-f0-9-]+\.json',item.name):
                            record=loads(guarded_read(item,1024*1024,private=True))
                            if record.get('phase') not in ('verified','failed','not-applied','reconciled-partial'):raise Conflict('cleanup_management_unsettled')
            try:yield
            except BaseException:abandoned=True;raise
        finally:
            os.close(fd)
            if not abandoned:
                current=os.stat('mutation.lock',dir_fd=parent,follow_symlinks=False)
                if (current.st_dev,current.st_ino)!=(identity.st_dev,identity.st_ino):raise Conflict('cleanup_management_lock_changed')
                os.unlink('mutation.lock',dir_fd=parent);os.fsync(parent)

def preview(run,*,services=None):
    from setup_cleanup_services import NativeCleanup
    services=services or NativeCleanup(run)
    owners={c['id']:Path(c['runtimeHome']) for c in run['plan']['claws']};first={};latest={};unsafe=set();shared=set();groups=[];external={};bindings={}
    for owner,home in owners.items():
        try:
            marker=loads(guarded_read(home/'.netclaw-setup-owner.json',16384,private=True))
            if marker!={'schema':1,'runId':run['runId'],'planHash':run['planHash'],'installationId':owner}:raise Conflict('cleanup_owner_changed')
            bindings[owner]=revision(home/'.netclaw-setup-owner.json')
            if (home/'.setup/services.json').exists() or any(a.get('owner')==owner and a.get('class') in ('service','service-link') for e in run['effects'] for a in e.get('artifacts',[])):
                group=services.inspect(next(c for c in run['plan']['claws'] if c['id']==owner));groups.append(group)
                external.update({name:owner for name in group['external']})
        except Exception:unsafe.add(owner)
    for effect in run['effects']:
        writer=effect.get('writer')
        if writer:
            try:os.killpg(writer['group'],0)
            except ProcessLookupError:pass
            except OSError:raise Conflict('writer_ownership_unknown')
            else:raise Conflict('writer_still_active')
        for item in effect.get('artifacts',[]):
            original=first.setdefault(item['path'],item);latest[item['path']]=item
            if original.get('owner')!=item.get('owner') or item.get('referencedBy')!=[item.get('owner')]:shared.add(item['path'])
    rows=[]
    for file,item in sorted(latest.items(),key=lambda pair:(-len(Path(pair[0]).parts),pair[0])):
        home=owners.get(item.get('owner'));reason=None;actual=None
        if item.get('owner') in unsafe:reason='service_ownership_requires_reconciliation'
        elif home is None or (not Path(file).is_relative_to(home) and external.get(file)!=item.get('owner')) or Path(file)==home:reason='outside_owned_home'
        elif Path(file).name=='.netclaw-setup-owner.json':reason='ownership_evidence_retained'
        elif first[file].get('existedBefore') or first[file].get('before') is not None:reason='preexisting'
        elif file in shared:reason='shared'
        else:
            try:
                actual=artifact_revision(item)
                if actual is None:reason='already_absent'
                elif actual!=item['sha256']:reason='revision_changed'
            except Exception:reason='ambiguous_path'
        rows.append({'path':file,'owner':item.get('owner'),'class':item.get('class'),'sha256':item['sha256'],
            'action':'retain' if reason else 'remove','reason':reason or 'owned_unchanged'})
    rows.sort(key=lambda row:(0 if row['class']=='service-link' else 1 if row['class']=='service' else 2,-len(Path(row['path']).parts),row['path']))
    result={'runId':run['runId'],'items':rows,'services':groups,'ownerBindings':bindings,'directories':'retained','audit':'retained'}
    if len(rows)>20000 or len(canonical(result))>7*1024*1024:raise Conflict('cleanup_preview_limit')
    return result

def cleanup_binding(run,preview):
    return {'operation':'cleanup','runId':run['runId'],'planHash':run['planHash'],
        'cleanupHash':hashlib.sha256(canonical(preview)).hexdigest()}

def apply_cleanup(run,review,*,started=None,services=None):
    from setup_engine import _Review,ReviewRefused
    from setup_cleanup_services import NativeCleanup
    services=services or NativeCleanup(run)
    proposed=preview(run,services=services)
    if not isinstance(review,_Review):raise ReviewRefused('native_review_required')
    binding=cleanup_binding(run,proposed)
    review.consume(binding,'cleanup')
    # Expired/cancelled reviews do not abandon an otherwise resumable install.
    # The engine persists this accepted intent before the first removal.
    if started:started(binding,proposed)
    if cleanup_binding(run,preview(run,services=services))!=binding:raise Conflict('cleanup_changed_while_locking')
    services.stop(proposed['services'])
    removed=0;outcomes=[];native_removed=False
    for item in proposed['items']:
        if item['class'] not in ('service','service-link') and not native_removed:
            services.removed(proposed['services']);native_removed=True
        if item['action']!='remove':
            outcomes.append({'path':item['path'],'owner':item['owner'],'outcome':'already_absent' if item['reason']=='already_absent' else 'retained','reason':item['reason']});continue
        file=Path(item['path'])
        home=next(Path(c['runtimeHome']) for c in run['plan']['claws'] if c['id']==item['owner'])
        if revision(home/'.netclaw-setup-owner.json')!=proposed['ownerBindings'][item['owner']]:raise Conflict('cleanup_owner_changed')
        with directory(file.parent) as parent:
            before=os.stat(file.name,dir_fd=parent,follow_symlinks=False)
            kind=stat.S_ISLNK if item['class']=='service-link' else stat.S_ISREG
            if not kind(before.st_mode) or before.st_uid!=os.getuid() or before.st_nlink!=1 or artifact_revision(item)!=item['sha256']:raise Conflict('cleanup_revision_changed')
            after=os.stat(file.name,dir_fd=parent,follow_symlinks=False)
            if (before.st_dev,before.st_ino,before.st_mtime_ns)!=(after.st_dev,after.st_ino,after.st_mtime_ns):raise Conflict('cleanup_revision_changed')
            os.unlink(file.name,dir_fd=parent);os.fsync(parent);removed+=1
        outcomes.append({'path':item['path'],'owner':item['owner'],'outcome':'removed','reason':'owned_unchanged'})
    if not native_removed:services.removed(proposed['services'])
    return {'protocol':1,'operation':'cleanup','runId':run['runId'],'planHash':run['planHash'],
            'state':'configuration_required' if any(i['reason'] not in ('owned_unchanged','already_absent','ownership_evidence_retained') for i in proposed['items']) else 'verified',
            'removed':removed,'retained':sum(i['outcome']=='retained' for i in outcomes),
            'alreadyAbsent':sum(i['outcome']=='already_absent' for i in outcomes),'items':outcomes,
            'services':[{'owner':g['owner'],'outcome':'stopped_and_removed'} for g in proposed['services']],
            'directories':'retained','audit':'retained'}
