"""Bounded owned subprocesses; unknown output is discarded, never logged."""
import os
import selectors
import subprocess
import time

from setup_schema import Invalid


class WriterUncertain(Invalid):
    def __init__(self):
        super().__init__('writer_outcome_unknown')


def run(arguments, *, cwd, env, timeout=60, limit=1024*1024, lock_fds=(), started=None, capture=False):
    if not arguments or any(not isinstance(a,str) or '\0' in a for a in arguments):
        raise Invalid('invalid_argument_vector')
    process = subprocess.Popen(arguments, cwd=str(cwd), env=env, stdin=subprocess.DEVNULL,
                               stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL, start_new_session=True,
                               pass_fds=tuple(lock_fds))
    if started:
        started({'pid': process.pid, 'group': process.pid})
    deadline, output = time.monotonic()+timeout, bytearray()
    if not capture:
        try:
            return {'returncode': process.wait(timeout=timeout), 'stdout': b''}
        except subprocess.TimeoutExpired:
            # This child retains the writer locks. A timeout never implies the
            # effect was absent, and setup does not kill installed services.
            raise WriterUncertain() from None
    with selectors.DefaultSelector() as selector:
        selector.register(process.stdout, selectors.EVENT_READ)
        while selector.get_map():
            if time.monotonic() >= deadline:
                process.stdout.close()
                raise WriterUncertain()
            for key, _ in selector.select(min(0.1, max(0, deadline-time.monotonic()))):
                chunk = os.read(key.fileobj.fileno(), 65536)
                if not chunk:
                    selector.unregister(key.fileobj); key.fileobj.close(); continue
                output.extend(chunk)
                if len(output) > limit:
                    process.stdout.close()
                    raise WriterUncertain()
    try:
        code = process.wait(timeout=max(0.01, deadline-time.monotonic()))
    except subprocess.TimeoutExpired:
        raise WriterUncertain() from None
    return {'returncode': code, 'stdout': bytes(output)}
