"""Explicit destination and receipt contracts for pinned channel CLIs.

Only concrete IDs are accepted. Names, default routes, URLs, files and fanout
expressions cannot turn a one-destination review into a different delivery.
"""
import re

PATTERNS={
    'slack':r'[CDG][A-Z0-9]{8,31}',
    'telegram':r'-?[1-9][0-9]{0,19}',
    'discord':r'[1-9][0-9]{15,20}',
    'webex':r'[A-Za-z0-9_-]{16,256}={0,2}',
    'sms':r'\+[1-9][0-9]{5,14}',
}

def valid_destination(channel,value):
    return isinstance(value,str) and bool(re.fullmatch(PATTERNS.get(channel,r'(?!)'),value))

def arguments(harness,channel,destination,message):
    if not valid_destination(channel,destination):raise ValueError('channel_destination_invalid')
    if channel not in ('slack','discord','telegram') and not (harness=='hermes' and channel=='sms'):
        raise ValueError('channel_verification_unimplemented')
    if not isinstance(message,str) or not 1<=len(message)<=160 or any(c in message for c in '\r\n\0'):
        raise ValueError('channel_message_invalid')
    if harness=='openclaw':return ['message','send','--channel',channel,'--target',destination,'--message',message,'--json']
    if harness=='hermes' and channel!='webex':return ['send','--to',channel+':'+destination,'--json',message]
    raise ValueError('channel_harness_unsupported')

def delivered(harness,channel,value):
    """Legacy name: proves provider submission only, never recipient delivery."""
    if not isinstance(value,dict):return False
    if channel not in ('slack','discord','telegram') and not (harness=='hermes' and channel=='sms'):return False
    if harness=='hermes':
        if channel=='sms' and not re.fullmatch(r'SM[0-9a-fA-F]{32}',str(value.get('message_id',''))):return False
        return (value.get('success') is True and not value.get('skipped') and not value.get('error') and
            not value.get('partial_success') and isinstance(value.get('message_id'),(str,int)) and
            not isinstance(value.get('message_id'),bool) and bool(str(value['message_id']).strip()) and
            value.get('platform',channel)==channel)
    if harness!='openclaw':return False
    return (value.get('action')=='send' and value.get('channel')==channel and value.get('dryRun') is False
            and isinstance(value.get('messageId'),str) and bool(value['messageId'].strip())
            and not value.get('error'))
