import asyncio
from types import SimpleNamespace
import pytest
from bgp.federation.channel import RpcError
from bgp.federation.manager import FederationManager, peer_identity
from bgp.federation.service import FederationService


def setup(tmp_path):
    svc=FederationService(local_as=65001,router_id='4.4.4.4',display_name='fixture',manager=FederationManager(base_dir=str(tmp_path)))
    channels=[]
    for asn,rid in [(65007,'7.7.7.7'),(65008,'8.8.8.8')]:
        svc.manager.local_consent(asn,rid);svc.manager.remote_consent(asn,rid)
        ident=peer_identity(asn,rid);svc.manager.set_chat_enabled(ident,True)
        channels.append(SimpleNamespace(peer_identity=ident,attestation='possession'))
    return svc,channels


@pytest.mark.parametrize('session_id',['../escape','/tmp/escape','a/b','a\\b','..'])
def test_inbound_open_rejects_path_ids(tmp_path,session_id):
    svc,channels=setup(tmp_path)
    try:
        result=asyncio.run(svc.chat.handle_chat_open(channels[0],{'session_id':session_id}))
        assert result['accepted'] is False
        assert svc.chat.list_sessions()==[]
    finally:svc.manager.close()


def test_messages_require_owned_received_session(tmp_path):
    svc,channels=setup(tmp_path);calls=[]
    async def gateway(*args,**kwargs):calls.append(args);return 'reply',1
    svc.chat._ask_gateway=gateway
    async def run():
        opened=await svc.chat.handle_chat_open(channels[0],{'session_id':'owned'})
        assert opened['accepted']
        for channel,ident in [(channels[1],'owned'),(channels[0],'missing'),(channels[0],None)]:
            with pytest.raises(RpcError):await svc.chat.handle_chat_message(channel,{'session_id':ident,'text':'untrusted'})
        duplicate=await svc.chat.handle_chat_open(channels[1],{'session_id':'owned'})
        assert not duplicate['accepted']
    try:asyncio.run(run());assert calls==[]
    finally:svc.manager.close()


def test_transcript_link_cannot_write_outside(tmp_path):
    svc,_=setup(tmp_path);outside=tmp_path/'outside.txt';outside.write_text('preserve')
    (svc.chat.chats_dir/'linked.txt').symlink_to(outside)
    try:
        with pytest.raises((OSError,ValueError,RpcError)):svc.chat._append('linked','untrusted')
        assert outside.read_text()=='preserve'
    finally:svc.manager.close()


def test_chat_reserves_allowance_before_gateway_await(tmp_path):
    svc,channels=setup(tmp_path);svc.authz.daily_requests=1;calls=[]
    async def run():
        release=asyncio.Event()
        async def gateway(*args,**kwargs):calls.append(args);await release.wait();return 'reply',2
        svc.chat._ask_gateway=gateway
        await svc.chat.handle_chat_open(channels[0],{'session_id':'budget'})
        one=asyncio.create_task(svc.chat.handle_chat_message(channels[0],{'session_id':'budget','text':'one'}))
        await asyncio.sleep(0)
        two=asyncio.create_task(svc.chat.handle_chat_message(channels[0],{'session_id':'budget','text':'two'}))
        await asyncio.sleep(0);release.set()
        results=await asyncio.gather(one,two,return_exceptions=True)
        assert len(calls)==1
        assert sum(isinstance(result,RpcError) for result in results)==1
    try:asyncio.run(run())
    finally:svc.manager.close()


def test_outbound_refuses_remote_path_id_before_message(tmp_path):
    svc,channels=setup(tmp_path);calls=[]
    class Remote:
        async def call(self,method,params,**kwargs):
            calls.append(method)
            return {'accepted':True,'session_id':'../escape'}
    svc.channels[channels[0].peer_identity]=Remote()
    try:
        with pytest.raises(RpcError):asyncio.run(svc.chat.open_and_send(channels[0].peer_identity,'hello'))
        assert calls==['n2n/chat/open'] and svc.chat.list_sessions()==[]
    finally:svc.manager.close()


def test_transcript_is_private_and_cannot_forge_lines(tmp_path):
    svc,_=setup(tmp_path)
    try:
        svc.chat._append('safe','peer\n[local] forged')
        path=svc.chat.chats_dir/'safe.txt'
        assert path.stat().st_mode&0o777==0o600
        assert len(path.read_text().splitlines())==1
        assert '\\n[local]' in path.read_text()
    finally:svc.manager.close()
