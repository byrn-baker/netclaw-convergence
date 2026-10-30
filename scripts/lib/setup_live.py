"""Optional verification; plan flags never substitute for native consent."""
import time
import uuid
import hashlib
from setup_schema import canonical
from setup_engine import ReviewRefused
from setup_report import outcome, summarize
from setup_state import Conflict
from setup_process import WriterUncertain
from setup_verify import HudProbe


class LiveVerification:
    def __init__(self,session,probes,context):
        self.session,self.probes,self.context=session,probes,context

    def consent(self,tier,claw,details,attempt='',*,configuration=None):
        key=claw['id']+':'+str(tier)+(':'+attempt if attempt else '')
        previous=self.context['journal'].get('liveAttempts',{}).get(key)
        binding={'operation':'verify-live','planHash':self.context['planHash'],'runId':self.context['runId'],
            'owner':claw['id'],'tier':tier,'details':details,'previousOutcome':previous.get('state') if previous else None}
        review=self.session.review_action(binding,'verify-live')
        if self.context['pause'].is_set():raise ReviewRefused('owner_disconnected')
        review.consume(binding,'verify-live')
        if configuration is not None:
            from setup_comms_evidence import configuration_binding
            if configuration_binding(self.probes)!=configuration:raise ReviewRefused('channel_configuration_changed')
        if previous:
            history=self.context['journal'].setdefault('liveAttemptHistory',{}).setdefault(key,[])
            if len(history)>=128:raise ReviewRefused('channel_attempt_history_limit')
            history.append(previous)
        sequence=self.context['journal'].get('liveAttemptSequence',0)
        if type(sequence) is not int or not 0<=sequence<1000000:raise ReviewRefused('channel_attempt_history_limit')
        self.context['journal']['liveAttemptSequence']=sequence+1
        self.context['journal'].setdefault('liveAttempts',{})[key]={'tier':tier,'state':'unknown','startedAt':int(time.time()),
            'sequence':sequence+1,
            'attemptId':uuid.uuid4().hex,'scopeHash':hashlib.sha256(canonical(binding)).hexdigest(),
            **({'configurationBinding':configuration} if configuration is not None else {})}
        self.context['save']()
        return key

    def verify(self,tier,claw,context):
        if tier==6:return self.network(claw,context)
        if tier==5:return self.channels(claw,context)
        if tier!=4:return outcome('unverified','native_consent_required')
        if not self.session or not context['plan']['verification']['costConsent']:
            return outcome('unverified','native_consent_required')
        try:
            if self.probes.running()['state']!='verified':return outcome('unverified','service_unverified')
            nonce='NETCLAW_SETUP_'+uuid.uuid4().hex
            prompt='NetClaw setup check. Do not call tools or contact anyone. Reply with exactly '+nonce
            key=self.consent(tier,claw,{'title':'One live model turn','harness':claw['harness'],
                'provider':claw['provider']['id'],'model':claw['provider']['model'],'home':claw['runtimeHome'],
                'message':prompt,'effects':'Uses the configured provider and may incur its normal token charges. The installed agent has its configured tools. An earlier unknown attempt may already have run; this is a separate new turn.'})
        except WriterUncertain:raise
        except ReviewRefused:return outcome('unverified','native_consent_required')
        except Exception:return outcome('unverified','probe_failed')
        client=HudProbe(claw,self.probes.identity);attempted=False
        try:
            runtime=client.request('/api/runtime')
            if runtime.get('kind')!=claw['harness'] or runtime.get('installationId')!=self.probes.identity:
                raise Conflict('identity_changed')
            client.request('/api/hud/session',{})
            if not list(client.cookies):raise Conflict('session_missing')
            thread=str(uuid.uuid4());messages=[{'role':'user','content':prompt}]
            if claw['harness']=='openclaw':
                attempted=True
                response=client.request('/api/chat',{'hudThread':thread,'message':prompt,'messages':messages},timeout=180)
                verified=response.get('fromGateway') is True and str(response.get('response','')).strip()==nonce
            else:
                conversation=client.request('/api/chat/conversations',{})
                thread=conversation.get('thread')
                if not isinstance(thread,str) or not thread:raise Conflict('conversation_missing')
                attempted=True
                response=client.request('/api/chat/requests',{'hudThread':thread,'message':prompt,'messages':messages,'clientNonce':str(uuid.uuid4())},timeout=45)
                request=response.get('requestId');deadline=time.monotonic()+180
                if not isinstance(request,str) or not __import__('re').fullmatch(r'[a-zA-Z0-9_-]{1,128}',request):raise Conflict('request_missing')
                while response.get('state') not in ('completed','failed','cancelled','interrupted'):
                    if response.get('state')=='unknown':raise WriterUncertain()
                    if context['pause'].wait(.5) or time.monotonic()>deadline:raise Conflict('turn_unsettled')
                    response=client.request('/api/chat/requests/'+request)
                verified=response.get('state')=='completed' and str(response.get('output','')).strip()==nonce
            result=outcome('verified' if verified else 'unverified','model_verified' if verified else 'model_unverified')
            context['journal']['liveAttempts'][key]['state']=result['state'];context['save']();return result
        except Exception:
            if attempted:raise WriterUncertain() from None
            return outcome('unverified','model_unverified')
        finally:
            try:client.request('/api/hud/session/revoke',{})
            except Exception:pass
            client.cookies.clear()

    def channels(self,claw,context):
        if not self.session:return outcome('unverified','native_consent_required')
        tests=[t for t in context['plan']['verification']['channelTests'] if t['owner']==claw['id']]
        if not tests:return outcome('configuration_required','channel_unconfigured')
        from setup_channels import arguments,delivered,valid_destination
        from setup_comms_evidence import record_message_observation,configuration_binding
        import json
        rows=[]
        for test in tests:
            if context['pause'].is_set():raise ReviewRefused('owner_disconnected')
            if test.get('direction','outbound') != 'outbound':
                # Inbound verification requires its own bounded observer. Never
                # turn an imported inbound request into an outbound message.
                record_message_observation(self.probes,context,claw,test['channel'],'inbound','unverified','unsupported')
                rows.append(outcome('unverified','channel_unconfigured'));continue
            try:
                selected={c['id'] for c in claw['channels']}
                if test['channel'] not in selected:return outcome('configuration_required','channel_unconfigured')
                binding={'operation':'channel-destination','planHash':context['planHash'],'owner':claw['id'],
                         'runId':context['runId'],'channel':test['channel'],'direction':'outbound','account':'default',
                         'destinationRef':test['destinationRef']}
                destination=self.session.destination(binding)
                if not valid_destination(test['channel'],destination):
                    rows.append(outcome('unverified','native_consent_required'));continue
                message='NetClaw setup verification '+uuid.uuid4().hex+'. No action is required.'
                argv=self.probes.harness.command()+arguments(claw['harness'],test['channel'],destination,message)
                configured=configuration_binding(self.probes)
                if configured is None:raise Conflict('channel_configuration_unbound')
                credentials=self.probes.credentials()
                if configuration_binding(self.probes)!=configured:raise Conflict('channel_configuration_changed')
                key=self.consent(5,claw,{'title':'Send one channel test message','channel':test['channel'],
                    'direction':'outbound','sender':{'account':'default','harness':claw['harness'],'installation':claw['id']},
                    **({'smsSender':credentials.get('TWILIO_PHONE_NUMBER'),'smsAccount':credentials.get('TWILIO_ACCOUNT_SID')} if test['channel']=='sms' else {}),
                    'destination':destination,'message':message,'home':claw['runtimeHome'],
                    'effects':'Sends exactly this message to this destination using the selected claw. SMS also performs one readonly lookup of the resulting message SID; it may still be pending. No setup retry. A prior unknown attempt may already have delivered.'},
                    attempt=test['channel']+':'+test['destinationRef'],configuration=configured)
            except ReviewRefused:
                record_message_observation(self.probes,context,claw,test['channel'],'outbound','cancelled','cancelled')
                rows.append(outcome('unverified','native_consent_required'));continue
            except Exception:
                rows.append(outcome('configuration_required','channel_unconfigured'));continue
            # A settled process without an affirmative receipt is uncertain:
            # do not retry or advance to another external message/device.
            record_message_observation(self.probes,context,claw,test['channel'],'outbound','unknown','attempt_unknown')
            if context['pause'].is_set():raise WriterUncertain()
            # Review-to-send races never authorize a different account/config.
            if configured is not None and configuration_binding(self.probes)!=configured:raise WriterUncertain()
            try:result=self.probes.harness.call(self.probes.effect,argv,credentials=credentials,capture=True,timeout=60)
            except Exception:raise WriterUncertain() from None
            try:
                response=json.loads(result['stdout'])
                accepted=result['returncode']==0 and delivered(claw['harness'],test['channel'],response)
            except Exception:accepted=False
            if not accepted:raise WriterUncertain()
            if test['channel']=='sms':
                from setup_comms_twilio import record_native_submission,fetch_recorded_receipt
                try:record_native_submission(self.probes,context,claw,key,destination,response,credentials)
                except Exception:raise WriterUncertain() from None
            context['journal']['liveAttempts'][key]['state']='verified';context['save']()
            record_message_observation(self.probes,context,claw,test['channel'],'outbound','verified','submission_accepted')
            delivery_state=None
            if test['channel']=='sms' and not context['pause'].is_set():
                fetched=fetch_recorded_receipt(self.probes,context,claw,key,credentials)
                delivery=fetched['delivery']
                if delivery['state'] in ('verified','failed','unknown'):
                    record_message_observation(self.probes,context,claw,'sms','outbound',delivery['state'],delivery['code'])
                    delivery_state=delivery['state']
            rows.append(outcome('failed' if delivery_state=='failed' else 'unverified' if delivery_state=='unknown' else 'verified',
                'channel_unconfigured' if delivery_state in ('failed','unknown') else 'channel_verified'))
        state=summarize(rows)
        return outcome(state,'channel_verified' if state=='verified' else 'native_consent_required')

    def network(self,claw,context):
        if not self.session:return outcome('unverified','native_consent_required')
        if 'pyats' not in claw['capabilities']['components']:return outcome('configuration_required','network_unconfigured')
        from pathlib import Path
        from setup_state import guarded_read
        from setup_schema import loads
        try:
            python=guarded_read(self.probes.home/'python-runtimes/records/pyats',8192,private=True).decode().strip()
            if not Path(python).is_relative_to(self.probes.home):raise Conflict('runtime_outside_home')
            args=[python,str(self.probes.deploy.source/'scripts/setup-network-check.py')]
            def call(extra):return self.probes.harness.call(self.probes.effect,args+extra,credentials=self.probes.credentials(),capture=True,timeout=55)
            listed=call([])
            if listed['returncode']:return outcome('unverified','network_unconfigured')
            names=loads(listed['stdout']).get('devices',[])
            if not names:return outcome('configuration_required','network_unconfigured')
            device=self.session.choose({'planHash':context['planHash'],'owner':claw['id'],'operation':'network-device'},'Select one inventory device for show version',names)
            if device not in names:return outcome('unverified','native_consent_required')
            key=self.consent(6,claw,{'title':'One read-only device observation','device':device,'command':'show version','home':claw['runtimeHome'],
                'effects':'Uses this claw’s pyATS inventory and credentials to connect to this one device. No configuration commands and no automatic retries.'})
            result=call([device]);verified=result['returncode']==0 and loads(result['stdout']).get('verified') is True
            state=outcome('verified' if verified else 'unverified','network_verified' if verified else 'network_unverified')
            context['journal']['liveAttempts'][key]['state']=state['state'];context['save']();return state
        except WriterUncertain:raise
        except ReviewRefused:return outcome('unverified','native_consent_required')
        except Exception:return outcome('unverified','network_unverified')
