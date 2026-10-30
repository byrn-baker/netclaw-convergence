"""Engine-owned PTYs. Raw terminal bytes never enter progress or journals.

Only trusted, fixed adapters call this module; the plan/provisioning broker
cannot supply commands. A terminal exit is an observation, not a postcondition.
"""
import base64
import errno
import fcntl
import os
from pathlib import Path
import pty
import select
import socket
import struct
import subprocess
import sys
import termios
import threading
import time

from setup_process import WriterUncertain
from setup_schema import Invalid, canonical, loads

_SURVIVORS=set()

def reap_later(process):
    # Keep Popen alive and reap after an unsettled child exits. This thread never
    # releases the child's inherited locks or sends it a termination signal.
    _SURVIVORS.add(process)
    def wait():
        process.wait();_SURVIVORS.discard(process)
    threading.Thread(target=wait,daemon=True).start()


class OwnedTerminal:
    def __init__(self,arguments,*,cwd,env,lock_fds=(),started=None):
        if not arguments or any(not isinstance(v,str) or '\0' in v for v in arguments):
            raise Invalid('invalid_argument_vector')
        self.master,slave=pty.openpty()
        self.process=None
        try:
            self.resize(80,24)
            # No preexec_fn: the editor session already has reader threads.
            # The small fresh child acquires the controlling TTY before exec.
            child=[sys.executable,str(Path(__file__).resolve()),'--child',','.join(map(str,lock_fds)),'--',*arguments]
            self.process=subprocess.Popen(child,cwd=str(cwd),env=env,stdin=slave,stdout=slave,stderr=slave,
                start_new_session=True,pass_fds=tuple(lock_fds))
            if started:started({'pid':self.process.pid,'group':self.process.pid})
            os.set_blocking(self.master,False)
        except BaseException:
            os.close(self.master)
            raise
        finally:os.close(slave)

    def resize(self,columns,rows):
        if type(columns) is not int or type(rows) is not int or not 1<=columns<=500 or not 1<=rows<=300:
            raise Invalid('native_terminal_dimensions_invalid')
        fcntl.ioctl(self.master,termios.TIOCSWINSZ,struct.pack('HHHH',rows,columns,0,0))

    def read(self):
        try:return os.read(self.master,16384)
        except BlockingIOError:return None
        except OSError as error:
            if error.errno==errno.EIO:return b''  # Linux PTY EOF.
            raise

    def write(self,data):
        if not data or len(data)>16384:raise Invalid('native_terminal_input_invalid')
        view=memoryview(data)
        deadline=time.monotonic()+2
        while view:
            if time.monotonic()>deadline:raise WriterUncertain()
            if select.select([],[self.master],[],0.1)[1]:
                try:view=view[os.write(self.master,view):]
                except BlockingIOError:pass

    def close(self):
        # Closing the PTY may settle an interactive child. It does not establish
        # what it wrote, and must never release a surviving child's writer lock.
        os.close(self.master)
        try:self.process.wait(timeout=0.25)
        except subprocess.TimeoutExpired:reap_later(self.process)

    def settle(self):
        try:code=self.process.wait(timeout=1)
        except subprocess.TimeoutExpired:raise WriterUncertain() from None
        try:os.killpg(self.process.pid,0)
        except ProcessLookupError:return code
        # A detached descendant can retain writer locks after the terminal
        # leader exits. Never start a later effect on its behalf.
        raise WriterUncertain()


def editor_terminal(channel,binding,request_id,arguments,*,cwd,env,context,effect,timeout=1800):
    expected={'protocol':1,'requestId':request_id,'planHash':binding['planHash']}
    process=None;pending=bytearray();output=0;deadline=time.monotonic()+timeout
    channel.settimeout(2)
    def send(kind,**values):
        channel.sendall(canonical({**expected,'type':kind,**values})+b'\n')
    try:
        if context['pause'].is_set():raise WriterUncertain()
        process=OwnedTerminal(arguments,cwd=cwd,env=env,lock_fds=context['lockFds'],
            started=lambda identity:context['writerStarted'](effect['id'],identity))
        while True:
            if context['pause'].is_set() or time.monotonic()>=deadline:raise WriterUncertain()
            ready=select.select([channel,process.master],[],[],0.1)[0]
            if channel in ready:
                data=channel.recv(65537)
                if not data:raise WriterUncertain()
                pending.extend(data)
                while b'\n' in pending:
                    line,_,rest=pending.partition(b'\n');pending=bytearray(rest)
                    frame=loads(line,65536)
                    if not isinstance(frame,dict) or any(frame.get(k)!=v for k,v in expected.items()):raise WriterUncertain()
                    kind=frame.get('type')
                    if kind=='native-terminal-input' and set(frame)==set(expected)|{'type','data'}:
                        try:
                            raw=base64.b64decode(frame['data'],validate=True)
                            if base64.b64encode(raw).decode()!=frame['data']:raise ValueError()
                        except (TypeError,ValueError):raise WriterUncertain() from None
                        process.write(raw)
                    elif kind=='native-terminal-resize' and set(frame)==set(expected)|{'type','columns','rows'}:
                        process.resize(frame['columns'],frame['rows'])
                    else:raise WriterUncertain()
                if len(pending)>65536:raise WriterUncertain()
            if process.master in ready:
                chunk=process.read()
                if chunk:
                    output+=len(chunk)
                    if output>8*1024*1024:raise WriterUncertain()
                    send('native-terminal-output',data=base64.b64encode(chunk).decode())
                elif chunk==b'':
                    code=process.settle()
                    send('native-terminal-exit',returncode=code)
                    return {'returncode':code}
    except (OSError,ValueError,Invalid):
        # Neither a disconnected view nor terminal cancellation proves absence.
        context['pause'].set()
        raise WriterUncertain() from None
    finally:
        if process:process.close()
        try:channel.settimeout(300)
        except OSError:pass


def terminal_terminal(tty,arguments,*,cwd,env,context,effect,timeout=1800):
    """CLI equivalent: engine supervises the same PTY, with /dev/tty only."""
    import tty as tty_module
    if context['pause'].is_set():raise WriterUncertain()
    fd=tty.fileno();previous=termios.tcgetattr(fd)
    process=OwnedTerminal(arguments,cwd=cwd,env=env,lock_fds=context['lockFds'],
        started=lambda identity:context['writerStarted'](effect['id'],identity))
    try:
        tty_module.setraw(fd);deadline=time.monotonic()+timeout
        while True:
            if context['pause'].is_set() or time.monotonic()>=deadline:raise WriterUncertain()
            ready=select.select([fd,process.master],[],[],0.1)[0]
            if fd in ready:
                value=os.read(fd,16384)
                if not value:raise WriterUncertain()
                process.write(value)
            if process.master in ready:
                value=process.read()
                if value:os.write(fd,value)
                elif value==b'':
                    return {'returncode':process.settle()}
    finally:
        termios.tcsetattr(fd,termios.TCSADRAIN,previous);process.close()


if __name__=='__main__':
    if len(sys.argv)<5 or sys.argv[1]!='--child' or sys.argv[3]!='--':raise SystemExit(2)
    fcntl.ioctl(0,termios.TIOCSCTTY,0)
    for value in filter(None,sys.argv[2].split(',')):os.set_inheritable(int(value),True)
    os.execvpe(sys.argv[4],sys.argv[4:],os.environ)
