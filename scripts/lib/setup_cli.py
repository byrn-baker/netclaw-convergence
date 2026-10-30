#!/usr/bin/env python3
"""Interactive plan authoring. Saving a draft never authorizes installation."""
import json
import hashlib
import os
from pathlib import Path
import sys
import uuid

from setup_engine import ReviewRefused
from setup_observation import host_identity, source_identity
from setup_plan import PlanValidator, BORDER_COMPONENTS, contains_literal
from setup_schema import Invalid, canonical
from setup_state import guarded_write, guarded_read
from setup_transport import TerminalSession, emit

ROOT=Path(__file__).resolve().parents[2]


def existing_notice(owner_home):
    present=False
    for name in ('.openclaw','.hermes'):
        home=Path(owner_home)/name
        if not home.exists() and not home.is_symlink():continue
        present=True
        try:
            value=json.loads(guarded_read(home/'netclaw-hud/installation.json',8192))
            if value.get('schemaVersion')==1 and str(uuid.UUID(value['installationId']))==value['installationId']:
                return 'Existing NetClaw detected. This setup creates a separate installation.'
        except (OSError,ValueError,KeyError,TypeError):pass
    return ('Existing claw directory detected. This setup creates a separate NetClaw installation.' if present
            else 'New setup creates separate homes and preserves existing claws.')


class DraftBuilder:
    def __init__(self,repository,ask):
        self.repository=Path(repository);self.validator=PlanValidator(repository);self.ask=ask

    def choose(self,title,options):
        while True:
            value=self.ask(title+' ['+' / '.join(options)+']: ').strip()
            if value in options:return value

    def testbed(self,label):
        from pyats_testbeds import catalog, policy, TestbedError
        mode=self.choose('Testbed mode for '+label,['static','dynamic'])
        if mode=='static':return {'mode':'static','sources':[]}
        choices=catalog()
        listing='\n'.join(s['id']+' · '+s['label']+' · '+s['help'] for s in choices)
        prompt='Dynamic testbed sources (space-separated IDs; list for routes and prerequisites): '
        while True:
            value=self.ask(prompt).strip()
            if value=='list':prompt=listing+'\nDynamic testbed sources: ';continue
            try:return policy({'mode':'dynamic','sources':value.replace(',',' ').split()})
            except TestbedError:prompt='Choose one or more known source IDs; list for options: '

    def runtime(self,primary=None):
        choice=self.choose('Harness',['inherit','openclaw','hermes'] if primary else ['openclaw','hermes'])
        harness=primary['harness'] if choice=='inherit' else choice
        providers=[c['id'] for c in self.validator.catalog['choices'] if c['kind']=='provider' and harness in c['harnesses']]
        provider=self.choose('Model provider',providers)
        kind='local' if provider in ('ollama','lm-studio') else self.choose('Endpoint location',['local','cloud']) if provider=='custom' else 'cloud'
        model=self.ask('Exact model identifier (no inference is performed): ').strip()
        modes=[v for v in self.validator.adapters['providerApiModes'][provider] if v in self.validator.adapters[harness]['apiModes']]
        mode=self.choose('Provider API mode',modes)
        endpoint=self.ask('Provider endpoint URL: ').strip() if kind=='local' or provider=='custom' else ''
        descriptor=self.validator.choices[('provider',provider)]
        keys=[f['key'] for f in descriptor['settings'] if f['classification']=='secret' and (f['required']=='always' or self.choose(f['key']+' endpoint authentication',['key','none'])=='key')]
        channels=[]
        if primary is None:
            entries=self.validator.comms.search(harness=harness)
            choices={e['channelId']:e for e in entries if e['inventory']=='channel' or e['channelId']=='webex'}
            listing='\n'.join(e['channelId']+' · '+e['name']+' · '+e['kind']+' · '+e['setup']['disposition']+' · '+e['documentation'] for e in entries)
            prompt='Conversation channels / Comms (space-separated IDs, none, list for every option, or guide): '
            while True:
                answer=self.ask(prompt).strip()
                if answer=='guide':prompt='Setup guide: '+str(self.repository/'docs/COMMS-SETUP.md')+'\nConversation channels / Comms: ';continue
                if answer=='list':prompt=listing+'\nConversation channels / Comms: ';continue
                ids=answer.replace(',',' ').split()
                if ids==['none']:break
                if not ids or len(set(ids))!=len(ids) or any(cid not in choices for cid in ids):continue
                if any(choices[cid]['setup']['disposition'] not in ('typed','native') and cid not in ('slack','telegram','discord') for cid in ids):
                    prompt='Selected Comms setup is not yet available in this runtime baseline. Choose another option or none: ';continue
                channels=[{'id':cid,'settingKeys':[f['key'] for f in (choices[cid]['setup']['settings'] or self.validator.choices[('channel',cid)]['settings'])]} for cid in ids]
                break
        return {'harness':harness,'harnessChoice':'inherit' if choice=='inherit' else 'explicit',
                'runtimeVersion':self.validator.adapters[harness]['versions'][0],
                'provider':{'id':provider,'kind':kind,'model':model,'apiMode':mode,'endpoint':endpoint,'credentialKeys':keys},'channels':channels}

    def file_input(self,owner,kind):
        name=self.ask(kind+' absolute input file (blank: omit): ').strip()
        if not name:return None
        if not self.validator.absolute(name):raise Invalid('absolute_path_required')
        data=guarded_read(name,256*1024 if kind.startswith('testbed-') else 64*1024)
        return {'owner':owner,'kind':kind,'path':name,'sha256':hashlib.sha256(data).hexdigest()}

    def build(self,host,source):
        primary=self.runtime()
        shape=self.choose('Installation shape',['focused','risk'])
        count=1
        if shape=='risk':
            while True:
                value=self.ask('Number of members (1–32): ').strip()
                if value.isdecimal() and 1<=int(value)<=32:count=1+int(value);break
        plan={'schema':1,'source':{'path':str(self.repository),'channel':'existing','ref':source['commit'],**source},
            'host':host,'shape':shape,'claws':[],'inventory':[],'identity':[],
            'posture':{'mode':'testing','requiredControls':[]},
            'verification':{'tiers':[1,2,3],'risk':shape=='risk','costConsent':False,'networkReadOnly':True,'channelTests':[]},
            'assumptions':[],'unresolved':[]}
        for index in range(count):
            role='focused' if shape=='focused' else 'border' if index==0 else 'member'
            name=self.ask(role.title()+' display name: ').strip()
            id='claw-'+uuid.uuid4().hex[:12]
            home=self.ask('New, empty absolute runtime home: ').strip()
            runtime=primary if index==0 else self.runtime(primary)
            harness=runtime['harness'];provider=runtime['provider']['id'];keys=runtime['provider']['credentialKeys']
            if role=='member':
                profile=self.choose('Member capability profile',[p['id'] for p in self.validator.catalog['memberProfiles'] if harness in p['harnesses']])
                entry=self.validator.members[profile];components=list(entry['components']);skills=list(entry['skills'])
                if profile=='comms':
                    components=self.choose('Comms member tools',['twilio','zoom-rtms','twilio zoom-rtms']).split()
                    skills=[s['id'] for s in self.validator.catalog['skills'] if s['availability']=='supported' and s['components'] and set(s['components'])<=set(components)]
            else:
                profile=self.choose('Capability profile',list(self.validator.profiles))
                components=list(self.validator.profiles[profile]['components'])
                if role=='border':components=[c for c in components if c in BORDER_COMPONENTS]
                selection=self.ask('Component IDs, space separated (blank keeps '+', '.join(components)+'): ').strip()
                if selection:components=selection.split()
                skills=[s['id'] for s in self.validator.catalog['skills'] if s['availability']=='supported' and s['components'] and set(s['components'])<=set(components)]
            if shape=='risk':components=list(dict.fromkeys(components+['n2n']+(['protocol'] if role=='border' else [])))
            descriptor=self.validator.choices[('provider',provider)]
            claw={'id':id,'displayName':name,'role':role,'runtimeHome':home,'workspace':home if harness=='hermes' else home.rstrip('/')+'/workspace',
                **runtime,'capabilities':{'profile':profile,'components':components,'skills':skills,
                'trustDomain':self.ask('Credential trust domain label: ').strip()},'settings':{},
                'endpoints':{'gatewayPort':18789+index*20,'hudPort':3001+index*20,'hudUiPort':3000+index*20,
                    'companionPort':8643+index*20,'bgpApiPort':8179+index*20,'bgpPort':1179+index*20,'federationPort':8000+index*20},
                'service':{'name':'netclaw-'+id,'mode':self.choose('Member lifecycle',['hot','on-demand']) if role=='member' else 'hot'}}
            for key,field in self.validator.fields(claw).items():
                if field['input']=='generated':continue
                if key in descriptor['settingKeys'] and field['classification']=='secret' and key not in keys:continue
                if field['classification']=='secret':
                    source=self.choose(key+' credential entry',['prompt','later'])
                    claw['settings'][key]={'kind':'secret','key':key,'owner':id,'source':source}
                else:
                    answer=self.ask(key+' — '+field['help']+' (blank: configure later): ')
                    if answer:
                        value=answer
                        if field['valueType']=='integer':
                            try:value=int(answer)
                            except ValueError:plan['unresolved'].append('setting-'+key);continue
                        if field['valueType']=='boolean':
                            if answer.lower() not in ('true','false'):plan['unresolved'].append('setting-'+key);continue
                            value=answer.lower()=='true'
                        claw['settings'][key]={'kind':'value','value':value}
            plan['claws'].append(claw)
        for claw in plan['claws']:
            if shape!='risk' or claw['role']=='border' or 'zoom-rtms' not in claw['capabilities']['components']:continue
            if self.choose('Zoom input from '+claw['displayName']+' to this Border',['none','bind'])=='bind':
                from setup_comms import set_zoom_binding
                while True:
                    port=self.ask('Dedicated loopback Zoom Border port (1024–65535): ').strip()
                    try:plan=set_zoom_binding(plan,claw['id'],int(port));break
                    except (ValueError,Invalid):continue
        # Input content never enters the plan or terminal transcript. Each owner
        # receives an independently copied, exact-hash input at deployment.
        for claw in plan['claws']:
            if 'pyats' in claw['capabilities']['components']:
                claw['testbed']=self.testbed(claw['displayName'])
            kind='none' if claw.get('testbed',{}).get('mode')=='dynamic' else self.choose('Inventory for '+claw['displayName'],['none','testbed-yaml','testbed-json','testbed-csv'])
            if kind!='none':
                item=self.file_input(claw['id'],kind)
                if item:plan['inventory'].append(item)
            for kind in ('soul','user','identity'):
                item=self.file_input(claw['id'],kind)
                if item:plan['identity'].append(item)
        plan['posture']['mode']=self.choose('Posture',['testing','production'])
        for tier,title in ((4,'One live model turn (may incur cost)'),(5,'Separately reviewed channel messages'),(6,'One read-only inventory device check')):
            if self.choose(title,['no','yes'])=='yes':
                plan['verification']['tiers'].append(tier)
                if tier==4:plan['verification']['costConsent']=True
                if tier==5:
                    from setup_comms import channel_test_choices,set_channel_tests
                    choices=channel_test_choices(plan,self.validator.comms.data)
                    selected=[c['key'] for c in choices if self.choose(c['label']+' test request (destination reviewed before sending)',['no','yes'])=='yes']
                    plan=set_channel_tests(plan,selected,self.validator.comms.data)
        return plan


def main():
    if len(sys.argv)!=2:raise Invalid('destination_required')
    destination=Path(sys.argv[1]).absolute()
    session=TerminalSession()
    try:
        session.tty.write(existing_notice(Path.home())+'\n'+
            'Host and source are observed first. Choose harness, provider, channel, shape, capabilities, settings, inventory, identity and posture. Saved drafts authorize no effects. Generated port choices and all effects are shown at apply review.\n')
        def ask(prompt):
            session.tty.write(prompt);session.tty.flush()
            value=session.tty.readline(4097)
            if not value or len(value)>4096:raise ReviewRefused('draft_cancelled')
            return value.rstrip('\r\n')
        builder=DraftBuilder(ROOT,ask);plan=builder.build(host_identity(),source_identity(ROOT))
        if contains_literal(plan):raise Invalid('literal_credential_refused')
        report=builder.validator.inspect(plan,draft=True)
        guarded_write(destination,canonical(plan)+b'\n',expected=None)
        emit({'saved':True,**report})
    finally:session.close()


if __name__=='__main__':
    try:main()
    except (Invalid,OSError,ValueError):
        emit({'saved':False,'code':'draft_not_saved'});raise SystemExit(2)
