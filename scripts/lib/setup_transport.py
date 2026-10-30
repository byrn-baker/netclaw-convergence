"""Controlling-terminal or private inherited editor session authority."""
import getpass
import base64
import hashlib
import io
import json
import os
import secrets
import select
import socket
import stat
import sys
import threading
import time

from setup_engine import ReviewAuthority, ReviewRefused
from setup_schema import Invalid, canonical, loads
from setup_secrets import SecretInbox


def validate_native_effect(context,effect):
    """A private terminal belongs to one exact selected effect, never a shell."""
    claw=next((c for c in context['plan']['claws'] if c['id']==effect.get('owner')),None)
    if not claw:raise ReviewRefused('native_effect_unreviewed')
    phase=effect.get('phase');identifier=effect.get('id');owner=claw['id']
    permitted=(phase=='onboard' and identifier==owner+':onboard' or
        phase=='components' and identifier in {owner+':components:'+c for c in claw['capabilities']['components']} or
        phase=='comms' and identifier in {owner+':comms:'+c['id'] for c in claw.get('channels',[])})
    if not permitted:raise ReviewRefused('native_effect_unreviewed')


def emit(value):
    data=canonical(value)
    if len(data)>8*1024*1024:raise Invalid('document_size_limit')
    if len(data)<=65535:
        sys.stdout.buffer.write(data+b'\n');sys.stdout.buffer.flush();return
    # Large Risk explanations/reports keep the per-frame limit. Documents are
    # bounded, ordered, digest-checked and assembled only in trusted frontends.
    identifier=secrets.token_hex(16)
    frames=[{'protocol':1,'type':'document-start','id':identifier,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}]
    for index,offset in enumerate(range(0,len(data),32768)):
        frames.append({'protocol':1,'type':'document-part','id':identifier,'index':index,'data':base64.b64encode(data[offset:offset+32768]).decode('ascii')})
    frames.append({'protocol':1,'type':'document-end','id':identifier})
    for frame in frames:sys.stdout.buffer.write(canonical(frame)+b'\n')
    sys.stdout.buffer.flush()


class TerminalSession:
    def __init__(self):
        # BufferedRandom (open(..., 'r+')) requires seeking and rejects a real
        # PTY on macOS. A raw duplex device supports independent reads/writes.
        try:self.tty=io.TextIOWrapper(io.FileIO('/dev/tty','r+'),encoding='utf-8',write_through=True)
        except OSError:raise ReviewRefused('controlling_terminal_required') from None
        if not os.isatty(self.tty.fileno()):raise ReviewRefused('controlling_terminal_required')
        self.authority=ReviewAuthority('terminal-'+secrets.token_hex(8))

    def review(self,engine,plan):
        binding=engine.review_binding(plan)
        self.tty.write('\nCreate these separate NetClaw installations:\n')
        self.tty.write(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
        self.tty.write(json.dumps(engine.validator.explain(plan),ensure_ascii=False,indent=2)+'\n')
        self.tty.write('Review includes runtime/dependency downloads, powerful agent execution, and listed owned services.\n')
        expected='APPLY '+binding['planHash'][:12]
        self.tty.write('Type '+expected+' to proceed: ');self.tty.flush()
        if self.tty.readline(128).strip()!=expected:raise ReviewRefused('review_cancelled')
        return self.authority.approve(binding)

    def secret(self,owner,key,run_id):
        value=getpass.getpass(owner+' · '+key+' (blank: configure later): ',stream=self.tty)
        return value or None

    def review_action(self,binding,action):
        self.tty.write('\nReview '+action+':\n'+json.dumps(binding,indent=2)+'\n')
        expected='CONFIRM '+binding['planHash'][:12]
        self.tty.write('Type '+expected+' to proceed: ');self.tty.flush()
        if self.tty.readline(128).strip()!=expected:raise ReviewRefused('review_cancelled')
        return self.authority.approve(binding,action)

    def close(self):self.tty.close()

    def choose(self,binding,title,choices):
        self.tty.write('\n'+title+'\n')
        for index,value in enumerate(choices):self.tty.write(str(index+1)+'. '+value+'\n')
        self.tty.write('Number (blank cancels): ');self.tty.flush();value=self.tty.readline(32).strip()
        return choices[int(value)-1] if value.isdecimal() and 1<=int(value)<=len(choices) else None

    def destination(self,binding):
        self.tty.write('\nDestination ID for '+binding['channel']+' ('+binding['destinationRef']+'). Blank cancels: ');self.tty.flush()
        value=self.tty.readline(514).strip()
        from setup_channels import valid_destination
        return value if valid_destination(binding['channel'],value) else None

    def terminal(self,arguments,*,cwd,env,context,effect):
        from setup_native import terminal_terminal
        validate_native_effect(context,effect)
        self.tty.write('\nNative setup for '+effect['owner']+'. Closing or cancelling requires reconciliation before continuing.\n')
        self.tty.flush()
        return terminal_terminal(self.tty,arguments,cwd=cwd,env=env,context=context,effect=effect)


class EditorSession:
    def __init__(self, engine, fd=3):
        try:
            info=os.fstat(fd)
            if not stat.S_ISSOCK(info.st_mode):raise ValueError()
            self.channel=socket.socket(fileno=os.dup(fd))
            self.channel.settimeout(300)
            self.stream=self.channel.makefile('rwb',buffering=0)
        except (OSError,ValueError):raise ReviewRefused('native_channel_required') from None
        self.engine=engine;self.authority=ReviewAuthority('editor-'+secrets.token_hex(16))
        self.last_heartbeat=time.monotonic();self.closed=threading.Event()
        self.inbox=None;self.secret_ready=threading.Event();self.guard=threading.Lock()
        self.reader=threading.Thread(target=self._read_inputs,daemon=True);self.reader.start()
        threading.Thread(target=self._watch,daemon=True).start()

    def _watch(self):
        while not self.closed.wait(1):
            if time.monotonic()-self.last_heartbeat>30:
                self._disconnect()

    def _disconnect(self):
        self.engine.request_pause();self.closed.set();self.secret_ready.set()
        # Wake a pending native prompt immediately when its owning editor goes
        # away; the 300-second input timeout is not a pause checkpoint.
        try:self.channel.shutdown(socket.SHUT_RDWR)
        except OSError:pass

    def _read_inputs(self):
        pending=b''
        try:
            fd=sys.stdin.fileno()
            while not self.closed.is_set():
                # A daemon blocked in BufferedReader.readline can abort Python
                # during interpreter shutdown while the editor keeps stdin open.
                # Poll the descriptor instead so close() can settle this reader.
                if not select.select([fd],[],[],0.25)[0]:continue
                chunk=os.read(fd,65537)
                if not chunk:break
                pending+=chunk
                while b'\n' in pending:
                    line,pending=pending.split(b'\n',1);line+=b'\n'
                    if len(line)>65536:raise Invalid('input_frame_invalid')
                    frame=loads(line,65536)
                    if frame=={'protocol':1,'type':'heartbeat'}:
                        self.last_heartbeat=time.monotonic()
                    elif frame=={'protocol':1,'type':'pause'}:
                        self._disconnect();return
                    elif isinstance(frame,dict) and frame.get('type')=='secret':
                        with self.guard:
                            if self.inbox is None:raise Invalid('secret_request_unknown')
                            self.inbox.accept(line);self.secret_ready.set()
                    else:raise Invalid('input_frame_invalid')
                if len(pending)>65536:raise Invalid('input_frame_invalid')
        except Exception:
            pass
        self._disconnect()

    def review(self,engine,plan):
        return self.review_action(engine.review_binding(plan),'apply')

    def review_action(self,binding,action):
        nonce=secrets.token_hex(24)
        request={'protocol':1,'type':'native-review','requestId':nonce,'binding':binding}
        self.stream.write(canonical(request)+b'\n')
        response=self.stream.readline(65537)
        expected={'protocol':1,'type':'native-review-answer','requestId':nonce,'planHash':binding['planHash'],'approved':True}
        if self.closed.is_set() or len(response)>65536 or loads(response,65536)!=expected:
            raise ReviewRefused('review_cancelled')
        return self.authority.approve(binding,action)

    def secret(self,owner,key,run_id):
        with self.guard:
            self.inbox=SecretInbox(run_id);request=self.inbox.request(owner,key);self.secret_ready.clear()
        emit(request)
        if not self.secret_ready.wait(300) or self.closed.is_set():
            self.engine.request_pause();return None
        with self.guard:
            value=self.inbox.take(owner,key);self.inbox.clear();self.inbox=None
        return value

    def choose(self,binding,title,choices):
        if not choices or len(choices)>512 or any(not isinstance(c,str) or len(c)>128 or any(v in c for v in '\n\r\0') for c in choices):raise Invalid('native_choices_invalid')
        nonce=secrets.token_hex(24)
        request={'protocol':1,'type':'native-choice','requestId':nonce,'binding':binding,'title':title,'choices':choices}
        self.stream.write(canonical(request)+b'\n');response=loads(self.stream.readline(65537),65536)
        if self.closed.is_set() or set(response)!={'protocol','type','requestId','planHash','choice'} or any(response[k]!=v for k,v in {'protocol':1,'type':'native-choice-answer','requestId':nonce,'planHash':binding['planHash']}.items()):raise ReviewRefused('native_choice_invalid')
        value=response['choice']
        if value is not None and value not in choices:raise ReviewRefused('native_choice_invalid')
        return value

    def close(self):
        self.closed.set();self.secret_ready.set()
        if self.inbox:self.inbox.clear()
        self.reader.join(timeout=1)
        self.stream.close();self.channel.close()

    def destination(self,binding):
        nonce=secrets.token_hex(24)
        self.stream.write(canonical({'protocol':1,'type':'native-destination','requestId':nonce,'binding':binding})+b'\n')
        response=loads(self.stream.readline(65537),65536)
        expected={'protocol':1,'type':'native-destination-answer','requestId':nonce,'planHash':binding['planHash']}
        if self.closed.is_set() or not isinstance(response,dict) or set(response)!=set(expected)|{'destination'} or any(response[k]!=v for k,v in expected.items()):raise ReviewRefused('native_destination_invalid')
        value=response['destination']
        from setup_channels import valid_destination
        if value is not None and not valid_destination(binding['channel'],value):raise ReviewRefused('native_destination_invalid')
        return value

    def terminal(self,arguments,*,cwd,env,context,effect):
        from setup_native import editor_terminal
        validate_native_effect(context,effect)
        nonce=secrets.token_hex(24)
        binding={'planHash':context['planHash'],'owner':effect['owner'],'effectId':effect['id'],'phase':effect['phase']}
        self.stream.write(canonical({'protocol':1,'type':'native-terminal','requestId':nonce,'binding':binding})+b'\n')
        response=loads(self.stream.readline(65537),65536)
        expected={'protocol':1,'type':'native-terminal-ready','requestId':nonce,'planHash':context['planHash']}
        if self.closed.is_set() or response!=expected:raise ReviewRefused('native_terminal_cancelled')
        return editor_terminal(self.channel,binding,nonce,arguments,cwd=cwd,env=env,context=context,effect=effect)
