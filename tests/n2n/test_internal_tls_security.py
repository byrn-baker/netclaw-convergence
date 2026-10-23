"""Real TLS enrollment and rejection of cross-channel possession proofs."""
import asyncio
import ssl
from types import SimpleNamespace
import pytest
from bgp.federation import certs, internal_security
from bgp.federation.channel import RpcError
from test_internal_transport import _service


def test_transport_policy(monkeypatch):
    for key in ('N2N_IN2N_TLS_CERT','N2N_IN2N_TLS_KEY','N2N_IN2N_CA_FILE','N2N_IN2N_TLS'):
        monkeypatch.delenv(key,raising=False)
    assert internal_security.server_context('127.0.0.1') is None
    assert internal_security.client_context('127.0.0.1') is None
    with pytest.raises(ValueError):internal_security.server_context('0.0.0.0')
    remote=internal_security.client_context('border.example.test')
    assert remote.verify_mode==ssl.CERT_REQUIRED and remote.check_hostname
    writer=SimpleNamespace(get_extra_info=lambda k:None if k=='ssl_object' else ('192.0.2.2',1234))
    with pytest.raises(ValueError):internal_security.channel_binding(writer)
    writer=SimpleNamespace(get_extra_info=lambda k:SimpleNamespace(get_channel_binding=lambda _:None))
    with pytest.raises(ValueError):internal_security.channel_binding(writer)


def test_real_tls_enrollment_reconnect_and_altered_binding(tmp_path):
    async def run():
        ca,key=certs.create_risk_ca('transport-test')
        crt,pkey=certs.issue_cert(ca,key,'localhost',san='localhost')
        for name,value in [('ca.pem',ca),('cert.pem',crt),('key.pem',pkey)]:
            p=tmp_path/name;p.write_text(value);p.chmod(0o600)
        server_ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);server_ctx.load_cert_chain(tmp_path/'cert.pem',tmp_path/'key.pem')
        client_ctx=ssl.create_default_context(cafile=str(tmp_path/'ca.pem'))
        border=_service(tmp_path/'border',65001,'4.4.4.4','Border')
        member=_service(tmp_path/'member',65001,'4.4.4.4','Member')
        border.risk.set_role('border',risk_name='risk',enabled_stacks='in2n')
        member.risk.set_role('member',risk_name='risk',self_member_id='risk/test')
        async def accept(reader,writer):await border.accept_internal(reader,writer)
        server=await asyncio.start_server(accept,'127.0.0.1',0,ssl=server_ctx)
        port=server.sockets[0].getsockname()[1]
        try:
            token=border.risk.issue_token()['token']
            with pytest.raises(ssl.SSLCertVerificationError):
                await member.dial_border('localhost',port,enrollment_token=token,ssl_context=ssl.create_default_context())
            result=await member.dial_border('localhost',port,enrollment_token=token,ssl_context=client_ctx)
            assert result['pinned'] and member.border_channel.trusted
            assert border.member_channels['risk/test'].auth_binding
            await member.border_channel.close();await asyncio.sleep(.05)
            result=await member.dial_border('localhost',port,ssl_context=client_ctx)
            assert result['trusted']
            await member.border_channel.close();await asyncio.sleep(.05)
            sign=member.risk.self_sign
            member.risk.self_sign=lambda nonce,binding=b'':sign(nonce,b'other TLS channel')
            with pytest.raises(RpcError):await member.dial_border('localhost',port,ssl_context=client_ctx)
        finally:
            for ch in list(border.member_channels.values()):await ch.close()
            if member.border_channel:await member.border_channel.close()
            server.close();await server.wait_closed()
            border.manager.close();member.manager.close()
    asyncio.run(run())
