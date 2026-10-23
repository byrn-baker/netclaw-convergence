"""Actual transport pending-map and close behavior, no external peers."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
import pytest
from bgp.federation.channel import FederationChannel
from bgp.federation.edge import EdgeChannel


def transport(kind):
    if kind == 'edge':
        obj = EdgeChannel(SimpleNamespace(close=AsyncMock()), local_identity='fixture')
        name = '_send'
    else:
        obj = FederationChannel(None, SimpleNamespace(close=Mock()),
            local_identity='fixture', peer_as=65000, peer_router_id='127.0.0.1',
            manager=None, is_initiator=True)
        name = '_send_frames'
    return obj, name


@pytest.mark.parametrize('kind', ['edge', 'federation'])
@pytest.mark.parametrize('failure', ['send', 'cancel', 'timeout', 'close', 'success'])
def test_rpc_cleanup(kind, failure):
    async def scenario():
        channel, name = transport(kind)
        entered = asyncio.Event()
        async def send(message):
            entered.set()
            if failure == 'send':
                raise OSError('synthetic send failure')
            if failure == 'timeout':
                await asyncio.Event().wait()
            if failure == 'success':
                channel._pending[message['id']].set_result({'result':{'ok':True}})
        setattr(channel, name, send)
        task = asyncio.create_task(channel.call('fixture', {}, timeout=0.05))
        await entered.wait()
        if failure == 'cancel':
            task.cancel()
            with pytest.raises(asyncio.CancelledError): await task
        elif failure == 'close':
            await channel.close()
            with pytest.raises(ConnectionError, match='outcome'): await task
        elif failure == 'success':
            assert await task == {'ok':True}
        else:
            with pytest.raises(Exception, match='timed out|synthetic'): await task
        assert channel._pending == {}
        await channel.close()
        with pytest.raises(ConnectionError, match='closed'):
            await channel.call('fixture', {})
    asyncio.run(scenario())


def test_edge_reader_can_complete_its_own_close():
    async def scenario():
        channel, _ = transport('edge')
        channel._read_task = asyncio.current_task()
        called = []
        channel.on_close = lambda _: called.append(True)
        await channel.close()
        assert called == [True]
        assert not asyncio.current_task().cancelling()
    asyncio.run(scenario())


def test_dispatch_admission_shared_across_connections_and_released(monkeypatch):
    from bgp.federation import channel as implementation
    async def scenario():
        assert not implementation._DISPATCH_RESERVATIONS
        monkeypatch.setattr(implementation, '_MAX_DISPATCH_TASKS', 2)
        monkeypatch.setattr(implementation, '_MAX_DISPATCH_BYTES', 8)
        first, _ = transport('federation'); second, _ = transport('federation')
        released = asyncio.Event()
        async def blocked(_): await released.wait()
        first._dispatch = second._dispatch = blocked
        assert first._dispatch_task(b'1234')
        assert not second._dispatch_task(b'12345'), 'aggregate byte cap must precede task creation'
        assert second._dispatch_task(b'1234')
        assert not first._dispatch_task(b'1'), 'new channel shares the same task cap'
        assert len(implementation._DISPATCH_RESERVATIONS) == 2
        await first.close()
        assert len(implementation._DISPATCH_RESERVATIONS) == 2, 'disconnect does not free slots for unfinished work'
        released.set()
        await asyncio.gather(*tuple(implementation._DISPATCH_RESERVATIONS))
        await asyncio.sleep(0)
        assert not implementation._DISPATCH_RESERVATIONS
        assert second._dispatch_task(b'next')
        await asyncio.gather(*tuple(implementation._DISPATCH_RESERVATIONS))
        await asyncio.sleep(0)
        assert not implementation._DISPATCH_RESERVATIONS
        await second.close()
    asyncio.run(scenario())
