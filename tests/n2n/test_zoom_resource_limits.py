import asyncio
from types import SimpleNamespace
import pytest
from bgp.federation.zoom_channel import ZoomChannel, ZoomInvestigationManager, RpcError


def test_pending_cleaned_on_send_failure_and_cancellation():
    async def run():
        channel=ZoomChannel(None,None)
        async def fail(_):raise OSError('synthetic send failure')
        channel._send=fail
        with pytest.raises(OSError):await channel.call('test',{})
        assert not channel._pending
        async def sent(_):pass
        channel._send=sent
        task=asyncio.create_task(channel.call('test',{}));await asyncio.sleep(0)
        assert channel._pending
        task.cancel()
        with pytest.raises(asyncio.CancelledError):await task
        assert not channel._pending
    asyncio.run(run())


def test_investigation_limit_duplicate_and_cleanup():
    async def run():
        manager=ZoomInvestigationManager(SimpleNamespace())
        event=asyncio.Event()
        async def pending(*args):await event.wait()
        manager._run_investigation=pending
        params={'request_id':'one','meeting_uuid':'meeting','raw_text':'Check routing state'}
        assert (await manager.handle_investigate(None,params))['accepted']
        with pytest.raises(RpcError):await manager.handle_investigate(None,params)
        for n in range(7):await manager.handle_investigate(None,dict(params,request_id=str(n)))
        with pytest.raises(RpcError):await manager.handle_investigate(None,dict(params,request_id='ninth'))
        assert len(manager._tasks)==8
        event.set();await asyncio.gather(*manager._tasks);await asyncio.sleep(0)
        assert not manager._tasks and not manager._channels_by_request
        with pytest.raises(RpcError):await manager.handle_investigate(None,dict(params,raw_text='x'*16001))
        assert not manager._tasks
    asyncio.run(run())
