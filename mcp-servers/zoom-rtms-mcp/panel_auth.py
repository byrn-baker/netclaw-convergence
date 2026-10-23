"""Validate Zoom-issued app context before granting meeting-feed access.

Wire framing documented at https://developers.zoom.us/docs/zoom-apps/zoom-app-context/
No client-supplied plain meeting/user identifier is an authorization credential.
"""
import base64
import hashlib
import json
import math
import os
import time
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def verify_context(encoded, *, now=None):
    secret=os.environ.get('ZOOM_CLIENT_SECRET','')
    client_id=os.environ.get('ZOOM_CLIENT_ID','')
    if not secret or not client_id:raise ValueError('Zoom app authentication is not configured')
    if not isinstance(encoded,str) or not encoded or len(encoded)>16384:raise ValueError('Invalid app context')
    try:
        data=base64.b64decode(encoded+'='*(-len(encoded)%4),altchars=b'-_',validate=True)
        cursor=0
        def read(count):
            nonlocal cursor
            if count<0 or cursor+count>len(data):raise ValueError('Truncated context')
            result=data[cursor:cursor+count];cursor+=count;return result
        iv=read(int.from_bytes(read(1),'little'))
        aad=read(int.from_bytes(read(2),'little'))
        ciphertext=read(int.from_bytes(read(4),'little'))
        tag=read(16)
        if cursor!=len(data) or len(iv)!=12:raise ValueError('Invalid context framing')
        decoded=AESGCM(hashlib.sha256(secret.encode()).digest()).decrypt(iv,ciphertext+tag,aad)
        context=json.loads(decoded)
        now=time.time() if now is None else now
        expiry=float(context['exp'])
        if expiry>1e12:expiry/=1000
        if not math.isfinite(expiry) or expiry<=now:raise ValueError('Expired context')
        if context.get('iss')!='marketplace.zoom.us' or context.get('aud')!=client_id:
            raise ValueError('Wrong context issuer or audience')
        for key in ('mid','uid'):
            if not isinstance(context.get(key),str) or not context[key] or len(context[key])>256:
                raise ValueError('Meeting/user context required')
        return {'meeting_uuid':context['mid'],'user_id':context['uid'],'expires_at':expiry}
    except Exception:
        raise ValueError('Invalid or expired Zoom app context') from None
