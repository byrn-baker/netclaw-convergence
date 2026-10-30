from pathlib import Path
import sys
import tempfile
import unittest
import types
import json
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_schema import canonical
from setup_state import guarded_write,revision,Conflict
from test_setup_systemd import bus_reply
from setup_systemd import unit_path

class ServiceBindingTests(unittest.TestCase):
    def test_wsl_installer_journals_exact_enable_links_before_creation_and_checks_them(self):
        from test_setup_plan import sample_plan
        from setup_deploy import Deployment
        from setup_risk import install_services,observe_services
        from setup_state import artifact_revision
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp).resolve();plan=sample_plan(str(root));plan['host']['platform']='wsl2';claw=plan['claws'][0]
            effects=[{'id':'home','artifacts':[]},{'id':'runtime','artifacts':[]},{'id':'credentials','artifacts':[]},{'id':'services','artifacts':[]}]
            context={'runId':'run-fixture','planHash':'a'*64,'plan':plan,'journal':{'effects':effects},'lockFds':(), 'writerStarted':lambda *_:None}
            links=[];calls=[]
            def intent(key,items):
                for item in items:
                    if item['class']=='service-link':
                        self.assertFalse(Path(item['path']).is_symlink());links.append(item)
                next(e for e in effects if e['id']==key)['artifacts'].extend(items)
            context['artifactIntent']=intent;deploy=Deployment(ROOT,claw,context)
            deploy.home(effects[0]);deploy.write(effects[1],deploy.source/'scripts/setup-service.py',b'# fixture',kind='source')
            deploy.write(effects[1],deploy.source/'ui/netclaw-visual/node_modules/vite/bin/vite.js',b'// fixture')
            deploy.write(effects[2],deploy.root/'.env',b'FIXTURE=1\n',kind='credentials')
            def execute(args,**kwargs):
                calls.append(args)
                if 'cat' in args:return {'returncode':1,'stdout':b''}
                if args[0]=='/usr/bin/busctl':
                    m=json.loads((deploy.root/'.setup/services.json').read_text())
                    item=next(s for s in m['services'] if (Path(s['file']).name==args[-1] if 'GetUnit' in args else unit_path(Path(s['file']).name)==args[-3]))
                    return bus_reply(args,item)
                if 'show' in args:
                    m=json.loads((deploy.root/'.setup/services.json').read_text());item=next(s for s in m['services'] if Path(s['file']).name==args[3])
                    raw='ActiveState=active\nMainPID=800000\nFragmentPath='+item['file']+'\nNeedDaemonReload=no\nDropInPaths=\nExecStart={ argv[]='+ ' '.join(item['arguments'])+'; }\n'
                    return {'returncode':0,'stdout':raw.encode()}
                if 'start' in args:self.assertTrue(all(artifact_revision(link)==link['sha256'] for link in links))
                return {'returncode':0,'stdout':b''}
            harness=types.SimpleNamespace(environment=lambda:{'PATH':'/fixture'},home=deploy.root,tool_directories=(),context=context,execute=execute,
                call=lambda *args,**kwargs:{'returncode':0,'stdout':b''})
            with patch('setup_risk.shutil.which',side_effect=lambda tool,**_:str(root/'bin'/tool)):
                result=install_services(effects[3],context,deploy,harness,user_home=root)
            self.assertEqual(result['state'],'verified');self.assertEqual(len(links),2)
            self.assertFalse(any('enable' in args for args in calls))
            self.assertTrue(observe_services(effects[3],context,deploy,harness))
            Path(links[0]['path']).unlink();self.assertFalse(observe_services(effects[3],context,deploy,harness))

    def test_source_binding_uses_latest_owned_revision_and_refuses_drift_alias_and_neighbor(self):
        from setup_service_binding import capture,verify
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve()/'claw';source=home/'.setup/source'
            file=source/'scripts/setup-service.py';guarded_write(file,b'old')
            first={'owner':'one','path':str(file),'sha256':revision(file),'class':'source'}
            guarded_write(file,b'reviewed build')
            latest={**first,'sha256':revision(file),'class':'built-source'}
            run={'effects':[{'artifacts':[first]},{'artifacts':[latest]}]}
            data=capture(source,'one',run);index=home/'.setup/service-source.json'
            guarded_write(index,canonical(data));binding={'sha256':revision(index),'count':1}
            self.assertEqual(verify(home,source,binding),[str(file)])
            guarded_write(file,b'operator edit')
            with self.assertRaises(Conflict):verify(home,source,binding)
            with self.assertRaises(Conflict):capture(source,'one',run)
            guarded_write(file,b'reviewed build');file.unlink();file.symlink_to(ROOT/'scripts/setup-service.py')
            with self.assertRaises(Conflict):verify(home,source,binding)
            file.unlink();guarded_write(file,b'reviewed build')
            data['files'][0]['path']='../neighbor';guarded_write(index,canonical(data));binding['sha256']=revision(index)
            with self.assertRaises(Conflict):verify(home,source,binding)

    def test_no_unowned_or_missing_launcher_can_be_bound(self):
        from setup_service_binding import capture
        with tempfile.TemporaryDirectory() as tmp:
            source=Path(tmp).resolve()/'source';file=source/'scripts/setup-service.py';guarded_write(file,b'pass')
            row={'owner':'neighbor','path':str(file),'sha256':revision(file),'class':'source'}
            with self.assertRaises(Conflict):capture(source,'one',{'effects':[{'artifacts':[row]}]})
