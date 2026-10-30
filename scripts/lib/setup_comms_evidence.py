"""Independent per-channel observations; no implicit provider or send probes."""
import time

from setup_comms import prepare_channel_config,owned_configuration,hermes_channel_inspection
from setup_report import COMMS_DIMENSIONS,comms_observation
from setup_process import WriterUncertain
from setup_state import revision


def configuration_binding(probes):
    try:
        home=probes.home
        config=home/('config.yaml' if probes.claw['harness']=='hermes' else 'openclaw.json')
        values=[revision(config),revision(home/'.env')]
        return values if all(isinstance(v,str) and len(v)==64 for v in values) else None
    except (AttributeError,OSError,ValueError):return None


def record_message_observation(probes,context,claw,channel,direction,state,code):
    """Persist typed outcome only; receipts, destinations and content stay out."""
    if direction not in ('inbound','outbound') or channel not in {c['id'] for c in claw['channels']}:return
    record={'observation':comms_observation(state,code,checker='native-send',observed_at=int(time.time())),
        'configurationBinding':configuration_binding(probes)}
    records=context['journal'].setdefault('commsObservations',{}).setdefault(claw['id'],{}).setdefault(channel,{})
    if state=='cancelled' and records.get(direction,{}).get('observation',{}).get('state')=='unknown':return
    records[direction]=record
    context['save']()


def configuration(probes,channel):
    now=int(time.time());claw=probes.claw;context=probes.context
    checker=claw['harness']+'-config'
    def result(state,code):return comms_observation(state,code,checker=checker,observed_at=now)
    effect=next((e for e in context['journal']['effects'] if e['owner']==claw['id'] and
        e['phase']=='comms' and e.get('channel')==channel),None)
    if not effect or effect['state']!='verified':return result('unverified','effect_unsettled')
    try:
        values=probes.credentials();_,current,_=owned_configuration(context,probes.deploy)
        if claw['harness']=='openclaw':
            from setup_comms_openclaw import PERSONAL_CHANNELS,personal_configuration_valid
            if channel in PERSONAL_CHANNELS:
                from setup_comms_openclaw import observe_channel
                if not personal_configuration_valid(context,probes.deploy,channel,values):return result('unverified','configuration_required')
                if not observe_channel(probes.effect,context,probes.deploy,probes.harness,channel):return result('unverified','dependency_unverified')
                checked=probes.harness.call(probes.effect,probes.harness.command()+['config','validate'],credentials=values,capture=True,timeout=30)
                return result('verified','configuration_valid') if checked['returncode']==0 else result('unverified','configuration_required')
        if claw['harness']=='openclaw' and channel=='whatsapp':
            from setup_comms_openclaw import whatsapp_configuration_valid,observe_channel
            if not whatsapp_configuration_valid(context,probes.deploy,values):return result('unverified','configuration_required')
            if not observe_channel(probes.effect,context,probes.deploy,probes.harness,channel):return result('unverified','dependency_unverified')
            checked=probes.harness.call(probes.effect,probes.harness.command()+['config','validate'],credentials=values,capture=True,timeout=30)
            return result('verified','configuration_valid') if checked['returncode']==0 else result('unverified','configuration_required')
        expected,updates=prepare_channel_config(claw,channel,current,values)
        if expected!=current or any(values.get(k)!=v for k,v in updates.items()):return result('failed','configuration_changed')
        if claw['harness']=='hermes':
            if channel=='whatsapp':
                from setup_comms_hermes_native import observe_whatsapp
                if observe_whatsapp(effect,context,probes.deploy,probes.harness)!='paired':return result('unverified','configuration_required')
            entry=probes.deploy.validator.comms.channel('hermes',channel)
            observed=hermes_channel_inspection(probes.effect,probes.deploy,probes.harness,entry['nativeId'],mode='readback',values=values)
            if not observed or not observed.get('configured'):return result('unverified','configuration_required')
            if not observed.get('dependencies'):return result('unverified','dependency_unverified')
        else:
            from setup_comms_openclaw import observe_channel,observe_prepared_prerequisites
            if not observe_prepared_prerequisites(probes.deploy,channel,values):return result('unverified','dependency_unverified')
            if channel!='webchat' and not observe_channel(probes.effect,context,probes.deploy,probes.harness,channel):return result('unverified','dependency_unverified')
            checked=probes.harness.call(probes.effect,probes.harness.command()+['config','validate'],credentials=values,capture=True,timeout=30)
            if checked['returncode']:return result('unverified','configuration_required')
        return result('verified','configuration_valid')
    except WriterUncertain:raise
    except Exception:return result('unverified','configuration_changed')


def observe(probes):
    rows=[]
    for selected in probes.claw.get('channels',[]):
        channel=selected['id'];row={'channel':channel,'account':'default'}
        row.update({key:comms_observation() for key in COMMS_DIMENSIONS})
        row['configuration']=configuration(probes,channel)
        if row['configuration']['state']=='verified':
            from setup_comms_services import observe_runtime
            row.update(observe_runtime(probes,channel))
        # Provider authentication is distinct from owned configuration; fresh
        # transport and reviewed message observations are attached separately.
        tests=[t for t in probes.context['plan']['verification']['channelTests']
            if t['owner']==probes.claw['id'] and t['channel']==channel]
        for direction in ('inbound','outbound'):
            if not any(t.get('direction','outbound')==direction for t in tests):
                row[direction]=comms_observation('skipped','not_requested')
            elif direction=='inbound' or channel not in ('slack','discord','telegram') and not (probes.claw['harness']=='hermes' and channel=='sms'):
                row[direction]=comms_observation('unverified','unsupported')
            evidence=probes.context['journal'].get('commsObservations',{}).get(probes.claw['id'],{}).get(channel,{}).get(direction)
            if (row['configuration']['state']=='verified' and isinstance(evidence,dict) and evidence.get('configurationBinding') and
                evidence['configurationBinding']==configuration_binding(probes)):
                value=evidence.get('observation',{})
                row[direction]=comms_observation(value.get('state'),value.get('code'),checker=value.get('checker'),observed_at=value.get('observedAt'))
        if channel=='sms' and probes.claw['harness']=='hermes' and row['configuration']['state']=='verified':
            from setup_comms_twilio import latest_recorded_evidence
            receipt=latest_recorded_evidence(probes,probes.context,probes.claw)
            if receipt is not None:
                row['outbound']=receipt['delivery'] if receipt['delivery']['state'] in ('verified','failed','unknown') else receipt['submission']
        rows.append(row)
    return rows
