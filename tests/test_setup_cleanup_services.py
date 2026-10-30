import hashlib
import json
import os
import socket
from pathlib import Path
import sys
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts/lib'))
from test_setup_plan import sample_plan
from setup_schema import canonical
from setup_state import guarded_write,revision,Conflict,directory
from setup_deploy import Deployment
from setup_risk import descriptor
from setup_cleanup import preview,cleanup_binding,apply_cleanup
from setup_cleanup_services import NativeCleanup
from setup_engine import ReviewAuthority,ReviewRefused
from test_setup_systemd import bus_reply
from setup_systemd import unit_path

class Fixture:
    def __init__(self,root,platform):
        self.root=root;self.platform=platform;self.plan=sample_plan(str(root));self.plan['host']['platform']=platform;self.claw=self.plan['claws'][0]
        self.run={'runId':'run-fixture','planHash':'a'*64,'plan':self.plan,'effects':[]};self.home=Path(self.claw['runtimeHome'])
        self.calls=[];self.mutations=[];self.jobs={};self.unavailable=False;self.foreign=False;self.stop_failure=False
        def intent(key,items):next(e for e in self.run['effects'] if e['id']==key)['artifacts'].extend(items)
        context={'runId':self.run['runId'],'planHash':self.run['planHash'],'plan':self.plan,'journal':self.run,'artifactIntent':intent}
        self.deploy=Deployment(ROOT,self.claw,context)
        def effect(name):
            item={'id':name,'owner':self.claw['id'],'phase':name,'artifacts':[]};self.run['effects'].append(item);return item
        self.deploy.home(effect('home'));services=effect('services')
        self.payload=self.home/'payload';self.deploy.write(services,self.payload,b'owned payload')
        self.definitions=[];self.links=[]
        for index,role in enumerate(('gateway','hud','federation')):
            item,data=descriptor(platform,self.claw['service']['name'],role,self.home,self.home/'.setup/source',Path(sys.executable),root)
            intent('services',[self.deploy.artifact(Path(item['file']),data,'service')]);guarded_write(item['file'],data)
            if platform=='wsl2':
                link=Path(item['file']).parent/'default.target.wants'/Path(item['file']).name
                item['enableLink']={'path':str(link),'sha256':hashlib.sha256(item['file'].encode()).hexdigest()}
                intent('services',[self.deploy.artifact(link,item['file'].encode(),'service-link')])
                with directory(link.parent,create=True) as parent:os.symlink(item['file'],link.name,dir_fd=parent)
                self.links.append(link)
            self.definitions.append(item);self.jobs[item['label']]={'active':True,'pid':800000+index,'item':item}
        identity=json.loads((self.home/'netclaw-hud/installation.json').read_text())['installationId']
        self.manifest=self.home/'.setup/services.json'
        self.deploy.write(services,self.manifest,canonical({'schema':1,'owner':self.claw['id'],'runId':self.run['runId'],
            'installationId':identity,'harness':self.claw['harness'],'home':str(self.home),'source':str(self.home/'.setup/source'),
            'platform':platform,'userHome':str(root),'services':self.definitions}),kind='service-manifest')
        self.native=NativeCleanup(self.run,execute=self.execute,user_home=root,pid_alive=lambda pid:any(j['pid']==pid for j in self.jobs.values()) if pid else False,
                                  ports_free=lambda _:not any(j['active'] for j in self.jobs.values()))

    def execute(self,args,**kwargs):
        self.calls.append(args)
        assert kwargs['env']['HOME']==str(self.root) and 'ANTHROPIC_API_KEY' not in kwargs['env']
        if self.unavailable:return {'returncode':1,'stdout':b'private-manager-error'}
        if args[0]=='/usr/bin/busctl':
            item=next(j['item'] for j in self.jobs.values() if (Path(j['item']['file']).name==args[-1] if 'GetUnit' in args else unit_path(Path(j['item']['file']).name)==args[-3]))
            return bus_reply(args,item,foreign=self.foreign)
        value=''
        if args==['/bin/launchctl','list']:
            value='PID\tStatus\tLabel\n'+''.join(str(j['pid'] or '-')+'\t0\t'+label+'\n' for label,j in self.jobs.items() if j['active'])
            value+='900001\t0\tneighbor-service\n'
        elif args[:2]==['/bin/launchctl','print']:
            item=self.jobs[args[-1].split('/')[-1]]['item'];arguments=item['arguments']+(['foreign'] if self.foreign else [])
            value='fixture {\n path = '+item['file']+'\n arguments = {\n'+'\n'.join(arguments)+'\n }\n pid = '+str(self.jobs[item['label']]['pid'])+'\n}'
        elif args[:2]==['/bin/launchctl','bootout'] or args[:3]==['/usr/bin/systemctl','--user','stop']:
            label=args[-1].split('/')[-1].removesuffix('.service');self.mutations.append(('stop',label))
            assert self.payload.exists() and all(Path(i['file']).exists() for i in self.definitions)
            if self.stop_failure:return {'returncode':1,'stdout':b''}
            self.jobs[label].update(active=False,pid=None)
        elif args[:3]==['/usr/bin/systemctl','--user','show']:
            job=self.jobs[args[3].removesuffix('.service')];item=job['item']
            if not Path(item['file']).exists():value='LoadState=not-found\nActiveState=inactive\nMainPID=0\nFragmentPath=\nExecStart=\n'
            else:value='LoadState=loaded\nActiveState='+('active' if job['active'] else 'inactive')+'\nMainPID='+str(job['pid'] or 0)+'\nFragmentPath='+item['file']+'\nNeedDaemonReload=no\nDropInPaths=\nExecStart={ argv[]='+ ' '.join(item['arguments']+(['foreign'] if self.foreign else []))+'; }\n'
        elif args==['/usr/bin/systemctl','--user','daemon-reload']:
            self.mutations.append(('reload',None));assert self.payload.exists() and not any(Path(i['file']).exists() for i in self.definitions) and not any(p.exists() or p.is_symlink() for p in self.links)
        else:raise AssertionError(args)
        return {'returncode':0,'stdout':value.encode()}

    def review(self):return ReviewAuthority('fixture').approve(cleanup_binding(self.run,preview(self.run,services=self.native)),'cleanup')

class CleanupServiceTests(unittest.TestCase):
    def test_mac_job_disappearing_between_list_and_print_requires_fresh_absence(self):
        with tempfile.TemporaryDirectory() as temp:
            fixture=Fixture(Path(temp).resolve(),'macos');item=fixture.definitions[0]
            original=fixture.execute
            def execute(args,**kwargs):
                if args[:2]==['/bin/launchctl','print']:
                    fixture.jobs[item['label']].update(active=False,pid=None)
                    return {'returncode':113,'stdout':b'Could not find service'}
                return original(args,**kwargs)
            fixture.native.execute=execute
            self.assertEqual(fixture.native.observe('macos',item),{'loaded':False,'pid':None})
            self.assertEqual(sum(c==['/bin/launchctl','list'] for c in fixture.calls),2)
            fixture.unavailable=True
            with self.assertRaises(Conflict):fixture.native.observe('macos',item)

    def test_port_probe_refuses_listener_but_accepts_closed_tcp_time_wait(self):
        listener=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
        listener.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
        listener.bind(('127.0.0.1',0));listener.listen(1)
        port=listener.getsockname()[1]
        with socket.create_connection(('127.0.0.1',port),timeout=2) as client:
            peer,_=listener.accept()
            try:
                self.assertFalse(NativeCleanup._ports_free([port]))
                peer.shutdown(socket.SHUT_WR)
                self.assertEqual(client.recv(1),b'')
            finally:peer.close()
        listener.close()
        self.assertTrue(NativeCleanup._ports_free([port]))

    def test_mac_and_wsl_stop_then_remove_owned_native_files_before_runtime_content(self):
        for platform in ('macos','wsl2'):
            with self.subTest(platform=platform),tempfile.TemporaryDirectory() as temp:
                fixture=Fixture(Path(temp).resolve(),platform);neighbor=fixture.root/'neighbor';neighbor.write_bytes(b'untouched')
                proposed=preview(fixture.run,services=fixture.native);self.assertEqual(len(proposed['services']),1)
                self.assertEqual(fixture.mutations,[])
                result=apply_cleanup(fixture.run,fixture.review(),services=fixture.native)
                self.assertEqual(result['state'],'verified');self.assertFalse(fixture.payload.exists())
                self.assertEqual([label.split('-')[-1] for action,label in fixture.mutations if action=='stop'],['federation','hud','gateway'])
                self.assertTrue(all(not Path(i['file']).exists() for i in fixture.definitions));self.assertEqual(neighbor.read_bytes(),b'untouched')
                self.assertTrue((fixture.home/'.netclaw-setup-owner.json').exists())
                self.assertEqual(result['services'],[{'owner':fixture.claw['id'],'outcome':'stopped_and_removed'}])

    def test_changed_controller_or_unavailable_manager_retains_entire_home(self):
        for platform in ('macos','wsl2'):
            for flag in ('foreign','unavailable'):
                with self.subTest(platform=platform,flag=flag),tempfile.TemporaryDirectory() as temp:
                    fixture=Fixture(Path(temp).resolve(),platform);setattr(fixture,flag,True)
                    result=apply_cleanup(fixture.run,fixture.review(),services=fixture.native)
                    self.assertEqual(result['removed'],0);self.assertEqual(result['state'],'configuration_required')
                    self.assertTrue(fixture.payload.exists());self.assertFalse(fixture.mutations)

    def test_pid_change_invalidates_review_and_failed_stop_removes_nothing(self):
        with tempfile.TemporaryDirectory() as temp:
            fixture=Fixture(Path(temp).resolve(),'macos');review=fixture.review()
            fixture.jobs[fixture.definitions[0]['label']]['pid']+=10
            with self.assertRaises(ReviewRefused):apply_cleanup(fixture.run,review,services=fixture.native)
            self.assertFalse(fixture.mutations)
            fixture.stop_failure=True
            with self.assertRaises(Conflict):apply_cleanup(fixture.run,fixture.review(),services=fixture.native)
            self.assertTrue(fixture.payload.exists());self.assertTrue(all(Path(i['file']).exists() for i in fixture.definitions))

    def test_foreign_or_unjournaled_wsl_enable_link_never_gets_disabled_or_removed(self):
        with tempfile.TemporaryDirectory() as temp:
            fixture=Fixture(Path(temp).resolve(),'wsl2');link=fixture.links[0];link.unlink();link.symlink_to('/foreign/unit.service')
            result=apply_cleanup(fixture.run,fixture.review(),services=fixture.native)
            self.assertEqual(result['removed'],0);self.assertEqual(os.readlink(link),'/foreign/unit.service');self.assertFalse(fixture.mutations)

if __name__=='__main__':unittest.main()
