#!/usr/bin/env python3
"""Opt-in disposable real-engine smoke test; synthetic review, no live provider.

Uses the production private socket protocol and actual adapters. Creates a NEW
OS temporary runtime home and unique native service names. Authoritative setup
journals/locks and uniquely named launchd/systemd definitions use the current
account's normal locations. It never adopts an existing installation. This is
not wizard/client/human acceptance. Keep private result paths on the test host.
"""
import argparse,copy,json,os,secrets,shutil,socket,subprocess,sys,tempfile,threading,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path[:0]=[str(ROOT/'scripts/lib'),str(ROOT/'tests')]
from test_setup_plan import sample_plan
from setup_observation import source_identity,host_identity
from setup_plan import PlanValidator

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--run-disposable-test',action='store_true',required=True)
 parser.add_argument('--harness',choices=('openclaw','hermes'),required=True)
 parser.add_argument('--shape',choices=('focused','risk'),default='focused')
 args=parser.parse_args()
 host=host_identity()  # Reject native Windows/unsupported Linux before effects.
 tools={name:shutil.which(name) for name in ('node','npm','uv','git')}
 if not all(tools.values()):raise SystemExit('Qualified Node/npm, uv and Git are required on PATH.')
 os.umask(0o077)
 root=Path(tempfile.mkdtemp(prefix='netclaw153-acceptance-')).resolve();home=root/'user';home.mkdir(mode=0o700)
 plan=sample_plan(str(root));plan['source'].update(path=str(ROOT),**source_identity(ROOT));plan['host']=host
 claw=plan['claws'][0];claw.update(id='disposable-acceptance',displayName='Disposable local acceptance')
 claw['service']['name']='netclaw-spec153-'+secrets.token_hex(5)
 claw['provider']={'kind':'local','id':'ollama','model':'acceptance-not-invoked','apiMode':'ollama','endpoint':'http://127.0.0.1:11434','credentialKeys':[]}
 claw['settings']={}
 if args.harness=='hermes':
  claw.update(harness='hermes',runtimeVersion='v0.21.6',workspace=claw['runtimeHome'])
  claw['provider'].update(apiMode='openai',endpoint='http://127.0.0.1:11434/v1')
 if args.shape=='risk':
  template=copy.deepcopy(claw);plan['shape']='risk';plan['verification']['risk']=True
  claw.update(role='border',id='acceptance-border')
  claw['capabilities'].update(components=['n2n','protocol'],skills=[])
  for index in range(3):
   member=copy.deepcopy(template);kind=args.harness if index!=1 else ('hermes' if args.harness=='openclaw' else 'openclaw')
   target=root/('member-'+str(index+1))
   member.update(id='member-'+str(index+1),displayName='Disposable member '+str(index+1),role='member',harness=kind,
    harnessChoice='inherit' if kind==args.harness else 'explicit',runtimeVersion='v0.21.6' if kind=='hermes' else '2026.7.1-2',
    runtimeHome=str(target),workspace=str(target if kind=='hermes' else target/'workspace'))
   member['service'].update(name='netclaw-spec153-'+secrets.token_hex(5),mode='on-demand' if index==2 else 'hot')
   member['capabilities'].update(profile='subnet',components=['subnet-calc','n2n'])
   provider='lm-studio' if index==1 else 'ollama';api='openai' if provider=='lm-studio' or kind=='hermes' else 'ollama'
   member['provider'].update(id=provider,apiMode=api,endpoint='http://127.0.0.1:'+('11435' if provider=='lm-studio' else '11434')+('/v1' if api=='openai' else ''))
   plan['claws'].append(member)
 ports=[]
 try:
  for selected in plan['claws']:
   for key in selected['endpoints']:
    s=socket.socket();s.bind(('127.0.0.1',0));ports.append(s);selected['endpoints'][key]=s.getsockname()[1]
  checked=PlanValidator(ROOT).inspect(plan)
  if not checked['applyReady']:raise SystemExit('Fixture plan failed validation: '+json.dumps(checked))
  file=root/'plan.json';file.write_text(json.dumps(plan));file.chmod(0o600)
  print(json.dumps({'privateRoot':str(root),'harness':args.harness,'shape':args.shape}),flush=True)
 finally:
  for s in ports:s.close()
 dirs=sorted({str(Path(value).parent) for value in tools.values()}|{str(Path(sys.executable).parent)})
 env={'HOME':str(home),'PATH':':'.join(dirs)+':'+os.defpath,'PYTHONNOUSERSITE':'1','LANG':'en_US.UTF-8'}
 if host['platform']=='wsl2':env['WSL_DISTRO_NAME']=host['distribution']
 launcher=root/'launcher.py'
 launcher.write_text('import os,sys\nfd=int(sys.argv[1]);os.dup2(fd,3);os.set_inheritable(3,True)\nos.execve(sys.executable,[sys.executable,*sys.argv[2:]],os.environ)\n')
 parent,child=socket.socketpair();parent.settimeout(60);closed=threading.Event();events=[]
 with (root/'engine-errors.log').open('wb') as errors:
  process=subprocess.Popen([sys.executable,str(launcher),str(child.fileno()),str(ROOT/'scripts/setup-engine.py'),'apply','--native','--plan',str(file)],env=env,cwd=ROOT,pass_fds=(child.fileno(),),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=errors)
  child.close();stream=parent.makefile('rwb',buffering=0)
  def heartbeat():
   while not closed.wait(2):
    try:process.stdin.write(b'{"protocol":1,"type":"heartbeat"}\n');process.stdin.flush()
    except (BrokenPipeError,ValueError):return
  thread=threading.Thread(target=heartbeat,daemon=True);thread.start();started=time.monotonic()
  try:
   request=json.loads(stream.readline());assert request['type']=='native-review'
   # Synthetic native review of this fixed disposable scenario only. The test
   # neither represents a human click nor adds an approval flag to the product.
   stream.write((json.dumps({'protocol':1,'type':'native-review-answer','requestId':request['requestId'],'planHash':request['binding']['planHash'],'approved':True})+'\n').encode())
   for line in process.stdout:
    event=json.loads(line);events.append(event)
    if event.get('type')=='secret-request':raise RuntimeError('Unexpected credential request; disposable test stopped')
    print(json.dumps({k:event[k] for k in ('type','phase','code','state') if k in event}),flush=True)
   process.wait(timeout=10)
  finally:
   closed.set();thread.join(timeout=3)
   if process.poll() is None:
    try:process.stdin.write(b'{"protocol":1,"type":"pause"}\n');process.stdin.flush()
    except (BrokenPipeError,ValueError):pass
   stream.close();parent.close();process.stdin.close()
 result={'scope':'actual isolated runtime; synthetic native review; not wizard/live-provider acceptance','harness':args.harness,'shape':args.shape,'exit':process.returncode,'seconds':round(time.monotonic()-started,3),'root':str(root),'plan':str(file),'sourceTreeHash':plan['source']['treeHash'],'events':events,'providerCalls':0,'channelMessages':0,'deviceCalls':0}
 (root/'result.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'privateResult':str(root/'result.json'),'runId':events[-1].get('runId') if events else None,'exit':process.returncode}),flush=True)
 return process.returncode or 0
if __name__=='__main__':raise SystemExit(main())
