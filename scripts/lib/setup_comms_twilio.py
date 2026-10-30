"""Local SMS receipt contracts. No API calls, listeners, numbers or sends.

Signature validation runs in a qualified Twilio SDK environment. The stdlib
setup engine never installs/imports that SDK merely to discover a channel.
"""
import copy
import hashlib
import json
import re
import time
from urllib.parse import urlsplit
from pathlib import Path

from setup_report import comms_observation
from setup_schema import Invalid

PROGRESS={'accepted':0,'scheduled':1,'queued':2,'sending':3,'sent':4}
FAILURES=frozenset(('failed','undelivered','canceled'))
STATUSES=frozenset(PROGRESS)|FAILURES|{'delivered'}
SID=re.compile(r'SM[0-9a-fA-F]{32}')
ACCOUNT=re.compile(r'AC[0-9a-fA-F]{32}')
PHONE=re.compile(r'\+[1-9][0-9]{5,14}')
RECEIPT_KEYS=frozenset(('schema','account','sender','recipient','callbackUrl','messageSid','status',
    'submittedAt','updatedAt','conflict','eventHashes'))


def validate_receipt(receipt):
    if not isinstance(receipt,dict) or set(receipt)!=RECEIPT_KEYS:raise Invalid('twilio_receipt_invalid')
    if (receipt['schema']!=1 or type(receipt['conflict']) is not bool or
        any(not isinstance(receipt[k],str) for k in ('account','sender','recipient','callbackUrl','messageSid','status')) or
        not ACCOUNT.fullmatch(receipt['account']) or not SID.fullmatch(receipt['messageSid']) or
        not PHONE.fullmatch(receipt['sender']) or not PHONE.fullmatch(receipt['recipient']) or
        receipt['status'] not in STATUSES):raise Invalid('twilio_receipt_invalid')
    try:
        url=urlsplit(receipt['callbackUrl'])
        if (url.scheme!='https' or not url.hostname or url.username or url.password or url.fragment or
            len(receipt['callbackUrl'])>2048 or url.port is not None and not 1<=url.port<=65535):raise ValueError()
    except ValueError:raise Invalid('twilio_receipt_scope') from None
    if (any(type(receipt[k]) is not int or receipt[k]<946684800 for k in ('submittedAt','updatedAt')) or
        receipt['updatedAt']<receipt['submittedAt'] or not isinstance(receipt['eventHashes'],list) or
        len(receipt['eventHashes'])>64 or any(not isinstance(v,str) or not re.fullmatch('[a-f0-9]{64}',v) for v in receipt['eventHashes'])):
        raise Invalid('twilio_receipt_invalid')
    return receipt


def submission_receipt(account,sender,recipient,callback_url,response,*,now=None):
    """Bind an authenticated API response to the exact reviewed SMS scope.

    The caller must establish its authenticated provider response. This does
    not take a plan's success boolean or create evidence by sending a message.
    """
    if not all(isinstance(v,str) for v in (account,sender,recipient,callback_url)):raise Invalid('twilio_receipt_scope')
    try:url=urlsplit(callback_url)
    except ValueError:raise Invalid('twilio_receipt_scope') from None
    if (not ACCOUNT.fullmatch(account) or not PHONE.fullmatch(sender) or not PHONE.fullmatch(recipient) or
        url.scheme!='https' or not url.hostname or url.username or url.password or url.fragment):raise Invalid('twilio_receipt_scope')
    if not isinstance(response,dict) or any(response.get(k)!=v for k,v in
        {'account_sid':account,'from':sender,'to':recipient}.items()):raise Invalid('twilio_receipt_scope')
    sid=response.get('sid');status=response.get('status')
    if not isinstance(sid,str) or not SID.fullmatch(sid) or not isinstance(status,str) or status not in STATUSES:raise Invalid('twilio_receipt_unverified')
    stamp=int(time.time()) if now is None else now
    if type(stamp) is not int or stamp<=0:raise Invalid('twilio_receipt_time')
    return validate_receipt({'schema':1,'account':account,'sender':sender,'recipient':recipient,'callbackUrl':callback_url,
        'messageSid':sid,'status':status,'submittedAt':stamp,'updatedAt':stamp,'conflict':False,'eventHashes':[]})


def native_submission_receipt(account,sender,recipient,callback_url,response,*,now=None):
    """A bounded native SMS send reports its SID, not recipient delivery.

    Scope comes from the exact reviewed command and its selected environment;
    the native acknowledgement must be supplied directly by that command.
    """
    if (not isinstance(response,dict) or response.get('success') is not True or response.get('skipped') or
        response.get('error') or response.get('partial_success')):raise Invalid('twilio_receipt_unverified')
    sid=response.get('message_id')
    if not isinstance(sid,str) or not SID.fullmatch(sid):raise Invalid('twilio_receipt_unverified')
    return submission_receipt(account,sender,recipient,callback_url,{
        'account_sid':account,'from':sender,'to':recipient,'sid':sid,'status':'accepted'},now=now)


class _Form(dict):
    def getlist(self,key):return self[key] if isinstance(self[key],list) else [self[key]]


def callback_receipt(receipt,parameters,signature,auth_token,*,now=None):
    """Authenticate all form fields before accepting known evidence fields.

    Unknown future Twilio fields participate in SDK signature validation.
    Forged/foreign callbacks leave the existing receipt untouched. Out-of-order
    progress cannot regress a terminal result; contradictory terminals become
    unknown and require separate reconciliation.
    """
    validate_receipt(receipt)
    if not isinstance(parameters,dict) or not 1<=len(parameters)<=256:raise Invalid('twilio_callback_invalid')
    form=_Form()
    for key,value in parameters.items():
        values=value if isinstance(value,list) else [value]
        if (not isinstance(key,str) or not 1<=len(key)<=128 or not values or len(values)>16 or
            any(not isinstance(v,str) or len(v)>8192 or '\0' in v for v in values)):raise Invalid('twilio_callback_invalid')
        form[key]=value
    if len(json.dumps(form).encode())>65536:raise Invalid('twilio_callback_invalid')
    if not isinstance(signature,str) or len(signature)>256 or not isinstance(auth_token,str) or not auth_token.strip():
        raise Invalid('twilio_signature_invalid')
    try:
        from twilio.request_validator import RequestValidator
    except ImportError:raise Invalid('twilio_verifier_unavailable') from None
    try:valid=RequestValidator(auth_token).validate(receipt['callbackUrl'],form,signature)
    except Exception:valid=False
    if not valid:raise Invalid('twilio_signature_invalid')
    # Critical fields must be unambiguous even if an otherwise valid signature
    # covers a form with repeated parameter names.
    for key in ('AccountSid','MessageSid','MessageStatus','From','To','ErrorCode'):
        if key in form and not isinstance(form[key],str):raise Invalid('twilio_callback_ambiguous')
    if (form.get('AccountSid')!=receipt.get('account') or form.get('MessageSid')!=receipt.get('messageSid') or
        any(key in form and form[key]!=receipt[field] for key,field in [('From','sender'),('To','recipient')])):
        raise Invalid('twilio_callback_scope')
    status=form.get('MessageStatus')
    if not isinstance(status,str) or status not in STATUSES:raise Invalid('twilio_callback_status')
    return _advance(receipt,status,form,now=now)


def authenticated_lookup_receipt(receipt,response,*,now=None):
    """Consume an authenticated readonly API lookup, bound to the exact SID."""
    validate_receipt(receipt)
    if not isinstance(response,dict) or any(response.get(key)!=receipt[field] for key,field in
        [('account_sid','account'),('sid','messageSid'),('from','sender'),('to','recipient')]):raise Invalid('twilio_receipt_scope')
    status=response.get('status')
    if not isinstance(status,str) or status not in STATUSES:raise Invalid('twilio_receipt_unverified')
    return _advance(receipt,status,{'source':'authenticated-lookup','status':status},now=now)


def _advance(receipt,status,form,*,now=None):
    result=copy.deepcopy(receipt)
    digest=hashlib.sha256(json.dumps(form,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    if digest in result['eventHashes']:return result
    if len(result['eventHashes'])>=64:raise Invalid('twilio_callback_limit')
    result['eventHashes'].append(digest)
    previous=result['status']
    terminal=FAILURES|{'delivered'}
    if previous in terminal and status in terminal and previous!=status:
        result['conflict']=True
    elif previous in PROGRESS and (status in terminal or PROGRESS[status]>=PROGRESS[previous]):
        result['status']=status
    stamp=int(time.time()) if now is None else now
    if type(stamp) is not int or stamp<=0:raise Invalid('twilio_receipt_time')
    result['updatedAt']=max(result['updatedAt'],stamp)
    return result


def receipt_evidence(receipt):
    validate_receipt(receipt)
    submission=comms_observation('verified','submission_accepted',checker='native-send',observed_at=receipt['submittedAt'])
    status=receipt['status']
    if receipt.get('conflict'):state,code='unknown','receipt_unverified'
    elif status=='delivered':state,code='verified','delivery_verified'
    elif status in FAILURES:state,code='failed','delivery_failed'
    else:state,code='unverified','receipt_unverified'
    delivery=comms_observation(state,code,checker='netclaw-setup',observed_at=receipt['updatedAt'])
    return {'submission':submission,'delivery':delivery}


def _attempt(probes,context,claw,key):
    from setup_comms_evidence import configuration_binding
    if probes.claw['id']!=claw['id'] or probes.claw['harness']!='hermes' or not any(c['id']=='sms' for c in claw['channels']):
        raise Invalid('twilio_receipt_owner')
    attempt=context['journal'].get('liveAttempts',{}).get(key,{})
    if (attempt.get('tier')!=5 or not key.startswith(claw['id']+':5:sms:') or
        not isinstance(attempt.get('attemptId'),str) or not re.fullmatch('[a-f0-9]{32}',attempt['attemptId']) or
        not re.fullmatch('[a-f0-9]{64}',attempt.get('scopeHash','')) or
        not attempt.get('configurationBinding') or attempt['configurationBinding']!=configuration_binding(probes)):
        raise Invalid('twilio_receipt_attempt')
    return attempt


def record_native_submission(probes,context,claw,key,destination,response,values):
    """Private durable receipt; no token, body or raw native output is stored."""
    from setup_schema import canonical
    attempt=_attempt(probes,context,claw,key)
    if attempt.get('state')!='unknown':raise Invalid('twilio_receipt_attempt')
    receipt=native_submission_receipt(values.get('TWILIO_ACCOUNT_SID'),values.get('TWILIO_PHONE_NUMBER'),destination,
        values.get('SMS_WEBHOOK_URL'),response)
    envelope={'schema':1,'owner':claw['id'],'channel':'sms','attemptId':attempt['attemptId'],
        'scopeHash':attempt['scopeHash'],'configurationBinding':attempt['configurationBinding'],'receipt':receipt}
    path=probes.home/'.setup/comms/sms/receipts'/(attempt['attemptId']+'.json')
    probes.deploy.write(probes.effect,path,canonical(envelope),kind='comms-receipt')
    attempt['receiptRef']=attempt['attemptId'];context['save']()
    return receipt_evidence(receipt)


def read_recorded_receipt(probes,context,claw,key):
    from setup_state import guarded_read,revision
    from setup_schema import loads
    attempt=_attempt(probes,context,claw,key)
    if attempt.get('receiptRef')!=attempt['attemptId']:raise Invalid('twilio_receipt_unverified')
    path=probes.home/'.setup/comms/sms/receipts'/(attempt['attemptId']+'.json')
    artifacts=[a for e in context['journal']['effects'] for a in e.get('artifacts',[]) if a.get('path')==str(path)]
    if not artifacts or artifacts[-1].get('owner')!=claw['id'] or revision(path)!=artifacts[-1]['sha256']:
        raise Invalid('twilio_receipt_changed')
    envelope=loads(guarded_read(path,16384,private=True))
    expected={'schema':1,'owner':claw['id'],'channel':'sms','attemptId':attempt['attemptId'],
        'scopeHash':attempt['scopeHash'],'configurationBinding':attempt['configurationBinding']}
    if set(envelope)!=set(expected)|{'receipt'} or any(envelope[k]!=v for k,v in expected.items()):raise Invalid('twilio_receipt_changed')
    validate_receipt(envelope['receipt'])
    return path,artifacts[-1]['sha256'],envelope


def update_recorded_receipt(probes,context,claw,key,*,lookup=None,callback=None,signature=None,auth_token=None):
    """Accept exactly one trusted observation source; never send/retry here."""
    from setup_schema import canonical
    if (lookup is None)==(callback is None):raise Invalid('twilio_receipt_source')
    path,before,envelope=read_recorded_receipt(probes,context,claw,key)
    receipt=(authenticated_lookup_receipt(envelope['receipt'],lookup) if lookup is not None else
        callback_receipt(envelope['receipt'],callback,signature,auth_token))
    if receipt!=envelope['receipt']:
        envelope['receipt']=receipt;probes.deploy.write(probes.effect,path,canonical(envelope),kind='comms-receipt',expected=before)
    return receipt_evidence(receipt)


def fetch_recorded_receipt(probes,context,claw,key,values):
    """One bounded GET for this attempt's SID; no polling loop or send retry.

    Called only within the explicitly reviewed SMS verification action. The
    general report observer never invokes this network function.
    """
    import base64
    import urllib.request
    from setup_verify import NoRedirect
    _,_,envelope=read_recorded_receipt(probes,context,claw,key);receipt=envelope['receipt']
    account=values.get('TWILIO_ACCOUNT_SID');token=values.get('TWILIO_AUTH_TOKEN')
    if account!=receipt['account'] or not isinstance(token,str) or not token or len(token)>4096 or any(c in token for c in '\r\n\0'):
        raise Invalid('twilio_receipt_credentials')
    url='https://api.twilio.com/2010-04-01/Accounts/'+account+'/Messages/'+receipt['messageSid']+'.json'
    auth=base64.b64encode((account+':'+token).encode()).decode()
    request=urllib.request.Request(url,method='GET',headers={'Authorization':'Basic '+auth,'Accept':'application/json'})
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
    try:
        with opener.open(request,timeout=10) as response:
            if response.status!=200:raise Invalid('twilio_receipt_unverified')
            raw=response.read(65537)
            if len(raw)>65536:raise Invalid('twilio_receipt_unverified')
            value=json.loads(raw)
        if not isinstance(value,dict) or value.get('direction')!='outbound-api':raise Invalid('twilio_receipt_scope')
        scoped={k:value.get(k) for k in ('account_sid','sid','from','to','status')}
        return update_recorded_receipt(probes,context,claw,key,lookup=scoped)
    except Exception:
        # A failed observation does not erase accepted submission or authorize
        # another send. Provider diagnostics/body/headers are never exported.
        return receipt_evidence(receipt)


def latest_recorded_evidence(probes,context,claw):
    """Local only; inspect the newest SMS attempt, never borrow older success."""
    candidates=[(key,value) for key,value in context['journal'].get('liveAttempts',{}).items()
        if key.startswith(claw['id']+':5:sms:') and value.get('tier')==5]
    if not candidates:return None
    key,_=max(candidates,key=lambda pair:(pair[1].get('sequence',0),pair[1].get('startedAt',0)))
    try:
        _,_,envelope=read_recorded_receipt(probes,context,claw,key)
        return receipt_evidence(envelope['receipt'])
    except Exception:return None
