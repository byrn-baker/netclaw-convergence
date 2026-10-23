import asyncio
import base64
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import pytest
import websockets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from panel_auth import verify_context
import panel_feed


def token(**overrides):
    data=dict(iss='marketplace.zoom.us',aud='fixture-id',mid='meeting-a',uid='viewer-a',exp=(time.time()+60)*1000)
    data.update(overrides);iv=os.urandom(12);aad=b'fixture-aad'
    enc=AESGCM(hashlib.sha256(b'fixture-secret').digest()).encrypt(iv,json.dumps(data).encode(),aad)
    wire=bytes([12])+iv+len(aad).to_bytes(2,'little')+aad+(len(enc)-16).to_bytes(4,'little')+enc
    return base64.urlsafe_b64encode(wire).decode().rstrip('=')

@pytest.fixture(autouse=True)
def settings(monkeypatch):
    monkeypatch.setenv('ZOOM_CLIENT_ID','fixture-id');monkeypatch.setenv('ZOOM_CLIENT_SECRET','fixture-secret')

def test_context_crypto_and_claim_validation():
    assert verify_context(token())['meeting_uuid']=='meeting-a'
    for altered in (dict(exp=0),dict(aud='other-app'),dict(iss='other-issuer'),dict(mid=''),dict(uid='')):
        with pytest.raises(ValueError):verify_context(token(**altered))
    original=token()
    damaged=bytearray(base64.urlsafe_b64decode(original+'='*(-len(original)%4)));damaged[-1]^=1
    with pytest.raises(ValueError):verify_context(base64.urlsafe_b64encode(damaged).decode())
    with pytest.raises(ValueError):verify_context('garbage')
    with pytest.raises(ValueError):verify_context(original+'AAAA')

def test_context_requires_configured_credentials(monkeypatch):
    value=token();monkeypatch.delenv('ZOOM_CLIENT_SECRET')
    with pytest.raises(ValueError):verify_context(value)

def test_real_websocket_meeting_isolation_and_cleanup():
    async def run():
        async with websockets.serve(panel_feed._handler,'127.0.0.1',0) as server:
            url=f'ws://127.0.0.1:{server.sockets[0].getsockname()[1]}'
            async with websockets.connect(url) as bad:
                await bad.send(json.dumps({'type':'identify_by_active_meeting'}))
                with pytest.raises(websockets.exceptions.ConnectionClosedError):await bad.recv()
            async with websockets.connect(url) as good:
                await good.send(json.dumps({'type':'authenticate','context':token()}))
                assert json.loads(await good.recv())['meeting_uuid']=='meeting-a'
                await panel_feed._broadcast('meeting-a',{'type':'test','value':'own result'})
                assert json.loads(await good.recv())['value']=='own result'
                await good.send(json.dumps({'type':'viewer_joined','meeting_uuid':'meeting-b'}))
                with pytest.raises(websockets.exceptions.ConnectionClosedError):await good.recv()
            await asyncio.sleep(.01)
            assert not panel_feed._connections and not panel_feed._participant_sockets
    asyncio.run(run())
