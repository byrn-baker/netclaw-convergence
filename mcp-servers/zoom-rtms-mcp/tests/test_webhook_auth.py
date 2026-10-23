import hashlib
import hmac
import http.client
import json
from pathlib import Path
import sys
import threading
import time
import pytest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import webhook

@pytest.fixture
def endpoint(monkeypatch):
    calls=[]
    monkeypatch.setattr(webhook,'SECRET_TOKEN','synthetic-secret')
    monkeypatch.setattr(webhook,'process_webhook_event',lambda body:calls.append(body) or {})
    server=webhook.http.server.HTTPServer(('127.0.0.1',0),webhook._Handler)
    thread=threading.Thread(target=server.serve_forever);thread.start()
    yield server.server_port,calls
    server.shutdown();server.server_close();thread.join()

def post(endpoint,body=b'{"event":"meeting.rtms_started","payload":{"meeting_uuid":"fixture"}}',stamp=None,signed=True,headers=None):
    stamp=str(int(time.time()) if stamp is None else stamp)
    hs={'x-zm-request-timestamp':stamp}
    if signed:hs['x-zm-signature']='v0='+hmac.new(b'synthetic-secret',b'v0:'+stamp.encode()+b':'+body,hashlib.sha256).hexdigest()
    hs.update(headers or {})
    client=http.client.HTTPConnection('127.0.0.1',endpoint[0],timeout=3)
    client.request('POST','/webhooks/zoom/rtms',body=body,headers=hs)
    response=client.getresponse();response.read();client.close();return response.status

def test_valid_signed_exact_bytes_dispatch(endpoint):
    assert post(endpoint)==200;assert len(endpoint[1])==1

@pytest.mark.parametrize('kwargs',[{'signed':False},{'stamp':0},{'headers':{'x-zm-signature':'v0=wrong'}},{'headers':{'x-zm-request-timestamp':'invalid'}}])
def test_rejected_auth_never_dispatches(endpoint,kwargs):
    assert post(endpoint,**kwargs)==403;assert not endpoint[1]

def test_missing_secret_fail_closed(endpoint,monkeypatch):
    monkeypatch.setattr(webhook,'SECRET_TOKEN','')
    assert post(endpoint)==503;assert not endpoint[1]

@pytest.mark.parametrize('body',[b'[]',b'{',b'{"payload":null}',b'{"event":"meeting.rtms_started","payload":{}}'])
def test_bad_event_rejected(endpoint,body):
    assert post(endpoint,body=body)==400;assert not endpoint[1]

def test_size_limit_before_read(endpoint):
    assert post(endpoint,headers={'Content-Length':str(1024*1024+1)})==413
    assert not endpoint[1]
