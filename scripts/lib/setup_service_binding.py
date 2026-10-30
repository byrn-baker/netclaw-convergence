"""Bind native services to the final run-owned source revisions."""
import hashlib
from pathlib import Path, PurePosixPath
import re
from setup_schema import loads
from setup_state import Conflict,guarded_read,revision

LIMIT=8*1024*1024

def capture(source,owner,journal):
    source=Path(source)
    latest={a['path']:a for e in journal['effects'] for a in e.get('artifacts',[])}
    files=[]
    for name,item in sorted(latest.items()):
        file=Path(name)
        if item.get('owner')!=owner or item.get('class') not in ('source','built-source') or not file.is_relative_to(source):continue
        if revision(file)!=item['sha256']:raise Conflict('service_source_changed')
        files.append({'path':file.relative_to(source).as_posix(),'sha256':item['sha256']})
    if not files or len(files)>20000 or 'scripts/setup-service.py' not in {f['path'] for f in files}:
        raise Conflict('service_source_unowned')
    return {'schema':1,'source':str(source),'files':files}

def verify(home,source,binding):
    index=Path(home)/'.setup/service-source.json'
    raw=guarded_read(index,LIMIT,private=True)
    if not isinstance(binding,dict) or hashlib.sha256(raw).hexdigest()!=binding.get('sha256'):
        raise Conflict('service_source_index_changed')
    value=loads(raw,LIMIT)
    if value.get('schema')!=1 or value.get('source')!=str(source) or not isinstance(value.get('files'),list) or not 1<=len(value['files'])<=20000 or len(value['files'])!=binding.get('count'):
        raise Conflict('service_source_index_invalid')
    seen=set();result=[]
    for row in value['files']:
        name=row.get('path');digest=row.get('sha256')
        if not isinstance(name,str) or not name or '\\' in name or PurePosixPath(name).as_posix()!=name or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or name in seen or not isinstance(digest,str) or not re.fullmatch('[0-9a-f]{64}',digest):
            raise Conflict('service_source_index_invalid')
        seen.add(name);file=Path(source)/name
        if revision(file)!=digest:raise Conflict('service_source_changed')
        result.append(str(file))
    if 'scripts/setup-service.py' not in seen:raise Conflict('service_source_unowned')
    return result
