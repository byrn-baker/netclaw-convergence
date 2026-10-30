"""Private setup state and cooperative writer locks (POSIX, Python 3.10+).

All path traversal uses directory descriptors and O_NOFOLLOW. Callers hold a
ResourceLocks lease across read/modify/write; revision checks detect intervening
edits but do not claim to lock an unrelated editor that ignores advisory locks.
"""
from contextlib import contextmanager
import fcntl
import hashlib
import os
from pathlib import Path
import re
import secrets
import stat

from setup_schema import Invalid, canonical, loads


class Conflict(Invalid):
    def __init__(self, code='resource_conflict'):
        super().__init__(code)


ANY_REVISION = object()
DIRECTORY = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW


def absolute_path(path):
    path = Path(path)
    if not path.is_absolute() or '..' in path.parts or any(c in str(path) for c in '\r\n\0'):
        raise Conflict('unsafe_path')
    return path


@contextmanager
def directory(path, *, create=False, private=False, allow_shared_read=False):
    """Open a real directory without following any ancestor aliases."""
    path = absolute_path(path)
    fd = os.open('/', DIRECTORY)
    try:
        for part in path.parts[1:]:
            try:
                child = os.open(part, DIRECTORY, dir_fd=fd)
            except FileNotFoundError:
                if not create:
                    raise
                try:
                    os.mkdir(part, 0o700, dir_fd=fd)
                    os.fsync(fd)
                except FileExistsError:
                    pass
                child = os.open(part, DIRECTORY, dir_fd=fd)
            info = os.fstat(child)
            # System ancestors such as /private/tmp may be root-owned and sticky.
            # A foreign user may not own a traversed directory.
            if info.st_uid not in (0, os.getuid()) or (info.st_mode & 0o022 and not info.st_mode & stat.S_ISVTX and not allow_shared_read):
                os.close(child)
                raise Conflict('unsafe_parent')
            os.close(fd)
            fd = child
        info = os.fstat(fd)
        if private and (info.st_uid != os.getuid() or info.st_mode & 0o077):
            raise Conflict('private_directory_required')
        yield fd
    except (NotADirectoryError, OSError) as exc:
        if isinstance(exc, FileNotFoundError):
            raise
        raise Conflict('unsafe_path') from None
    finally:
        os.close(fd)


def _read_at(parent, name, limit, *, private=False):
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1:
            raise Conflict('owned_regular_file_required')
        if private and info.st_mode & 0o077:
            raise Conflict('private_file_required')
        if info.st_size > limit:
            raise Conflict('file_size_limit')
        data = bytearray()
        while len(data) <= limit:
            chunk = os.read(fd, min(65536, limit + 1 - len(data)))
            if not chunk:
                break
            data.extend(chunk)
        if len(data) > limit:
            raise Conflict('file_size_limit')
        after = os.fstat(fd)
        if (info.st_size, info.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise Conflict('file_changed')
        return bytes(data)
    finally:
        os.close(fd)


def guarded_read(path, limit=1024*1024, *, private=False, allow_shared_read=False):
    path = absolute_path(path)
    with directory(path.parent,allow_shared_read=allow_shared_read) as parent:
        return _read_at(parent, path.name, limit, private=private)


def revision(path, limit=64*1024*1024):
    try:
        return hashlib.sha256(guarded_read(path, limit)).hexdigest()
    except FileNotFoundError:
        return None

def artifact_revision(item):
    if item.get('class')!='service-link':return revision(item['path'])
    path=absolute_path(item['path'])
    try:
        with directory(path.parent) as parent:
            info=os.stat(path.name,dir_fd=parent,follow_symlinks=False)
            if not stat.S_ISLNK(info.st_mode) or info.st_uid!=os.getuid() or info.st_nlink!=1:raise Conflict('service_link_changed')
            value=os.readlink(path.name,dir_fd=parent)
            return hashlib.sha256(value.encode()).hexdigest()
    except FileNotFoundError:return None


def guarded_write(path, data, *, expected=ANY_REVISION):
    """Replace an owned regular file, or create a missing file, privately."""
    path = absolute_path(path)
    if not isinstance(data, bytes):
        raise TypeError('bytes_required')
    with directory(path.parent, create=True) as parent:
        def current():
            try:
                return hashlib.sha256(_read_at(parent, path.name, 64*1024*1024)).hexdigest()
            except FileNotFoundError:
                return None
        before = current()
        if expected is not ANY_REVISION and before != expected:
            raise Conflict('revision_conflict')
        name = '.netclaw-' + secrets.token_hex(16)
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent)
        try:
            with os.fdopen(fd, 'wb') as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            if current() != before:
                raise Conflict('revision_conflict')
            if before is None:
                # Atomic no-replace publication; a concurrent creator wins.
                os.link(name, path.name, src_dir_fd=parent, dst_dir_fd=parent, follow_symlinks=False)
                os.unlink(name, dir_fd=parent)
            else:
                os.replace(name, path.name, src_dir_fd=parent, dst_dir_fd=parent)
            os.fsync(parent)
        finally:
            try:
                os.unlink(name, dir_fd=parent)
            except FileNotFoundError:
                pass
    return hashlib.sha256(data).hexdigest()


class ResourceLocks:
    """Same-user cross-frontend locks, inherited by owned writer supervisors."""
    def __init__(self, root, resources):
        self.root = absolute_path(root)
        self.resources = sorted(set(resources))
        self.fds = []

    def acquire(self):
        if self.fds:
            raise Conflict('lock_already_acquired')
        try:
            with directory(self.root, create=True, private=True) as parent:
                for resource in self.resources:
                    name = hashlib.sha256(resource.encode('utf-8')).hexdigest() + '.lock'
                    fd = os.open(name, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600, dir_fd=parent)
                    self.fds.append(fd)
                    info = os.fstat(fd)
                    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_nlink != 1:
                        raise Conflict('unsafe_lock')
                    try:
                        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    except BlockingIOError:
                        raise Conflict('resource_busy') from None
                    os.set_inheritable(fd, True)
            return self
        except BaseException:
            self.close()
            raise

    def close(self, *, unlock=True):
        for fd in self.fds:
            if unlock:
                fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)
        self.fds.clear()

    def __enter__(self):
        return self.acquire()

    def __exit__(self, *_):
        # Closing is sufficient. Explicit LOCK_UN would release locks inherited
        # by a still-running writer after a failed parent operation.
        self.close(unlock=False)


class StateStore:
    def __init__(self, root, *, create=True):
        self.root = absolute_path(root)
        with directory(self.root, create=create, private=True):
            pass
        with directory(self.root / 'runs', create=create, private=True):
            pass

    def path(self, run_id):
        if not isinstance(run_id, str) or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}', run_id):
            raise Conflict('invalid_run_id')
        return self.root / 'runs' / (run_id + '.json')

    def save(self, run_id, value, *, expected=ANY_REVISION):
        self.path(run_id)  # Validate before constructing an artifact index path.
        # Immutable per-effect indexes keep multiclaw journals bounded. Publish
        # and fsync each index before the journal references it.
        persisted={**value,'effects':[]}
        for effect in value.get('effects',[]):
            item={k:v for k,v in effect.items() if k not in ('artifacts','artifactRef')}
            artifacts=effect.get('artifacts',[])
            if not isinstance(artifacts,list) or len(artifacts)>20000:raise Conflict('artifact_count_limit')
            encoded=canonical(artifacts)
            if len(encoded)>8*1024*1024:raise Conflict('artifact_size_limit')
            digest=hashlib.sha256(encoded).hexdigest()
            target=self.root/'artifacts'/run_id/(digest+'.json')
            current=revision(target)
            if current is None:guarded_write(target,encoded,expected=None)
            elif current!=digest:raise Conflict('artifact_index_changed')
            item['artifactRef']={'sha256':digest,'count':len(artifacts)}
            persisted['effects'].append(item)
        data = canonical(persisted)
        if len(data) > 16*1024*1024:
            raise Conflict('journal_size_limit')
        return guarded_write(self.path(run_id), data + b'\n', expected=expected)

    def load(self, run_id, *, hydrate=True):
        value=loads(guarded_read(self.path(run_id), 16*1024*1024, private=True), 16*1024*1024)
        total=0
        for effect in value.get('effects',[]):
            ref=effect.get('artifactRef')
            if ref is None:continue
            if not isinstance(ref,dict) or set(ref)!={'sha256','count'} or not re.fullmatch(r'[a-f0-9]{64}',str(ref.get('sha256',''))) or type(ref.get('count')) is not int or not 0<=ref['count']<=20000:
                raise Conflict('artifact_reference_invalid')
            if not hydrate:continue
            data=guarded_read(self.root/'artifacts'/run_id/(ref['sha256']+'.json'),8*1024*1024,private=True)
            total+=len(data)
            if total>128*1024*1024:raise Conflict('artifact_total_limit')
            if hashlib.sha256(data).hexdigest()!=ref['sha256']:raise Conflict('artifact_index_changed')
            artifacts=loads(data,8*1024*1024)
            if not isinstance(artifacts,list) or len(artifacts)!=ref['count']:raise Conflict('artifact_index_invalid')
            effect['artifacts']=artifacts
        return value
