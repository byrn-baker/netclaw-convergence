"""TCP telemetry limits and lifecycle, without network appliances."""
import asyncio
import functools
import importlib.util
from pathlib import Path
from unittest.mock import Mock

import pytest

path = Path(__file__).resolve().parents[2] / 'mcp-servers/syslog-mcp/tcp_receiver.py'
spec = importlib.util.spec_from_file_location('audit_syslog_tcp', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def async_test(fn):
    @functools.wraps(fn)
    def run():
        return asyncio.run(fn())
    return run


@async_test
async def test_unterminated_frame_is_bounded():
    async def handler(data, addr):
        pytest.fail('oversized frame dispatched')
    protocol = module.TCPSyslogProtocol(handler, ('fixture', 1))
    transport = Mock()
    transport.get_extra_info.return_value = ('127.0.0.1', 1234)
    protocol.connection_made(transport)
    protocol.data_received(b'x' * (65536 + 1))
    transport.close.assert_called_once()
    assert len(protocol.buffer) <= 65536


@async_test
async def test_pending_handlers_bounded_and_cancelled():
    entered = asyncio.Event()
    async def handler(data, addr):
        entered.set()
        await asyncio.Event().wait()
    protocol = module.TCPSyslogProtocol(handler, ('fixture', 1))
    transport = Mock()
    transport.get_extra_info.return_value = ('127.0.0.1', 1234)
    protocol.connection_made(transport)
    protocol.data_received(b'x\n' * 129)
    transport.close.assert_called_once()
    assert len(protocol.pending) <= 128
    await protocol.shutdown()
    assert not protocol.pending


@async_test
async def test_real_peer_delivery_admission_and_stop():
    seen = []
    delivered = asyncio.Event()
    async def handler(data, addr):
        seen.append((data, addr))
        delivered.set()
    receiver = module.TCPReceiver(handler, host='127.0.0.1', port=0, max_connections=1)
    await receiver.start()
    port = receiver.server.sockets[0].getsockname()[1]
    reader, writer = await asyncio.open_connection('127.0.0.1', port)
    try:
        writer.write(b'<13>first'); await writer.drain()
        writer.write(b' line\n'); await writer.drain()
        await asyncio.wait_for(delivered.wait(), 2)
        assert seen == [(b'<13>first line', writer.get_extra_info('sockname'))]
        assert receiver.get_status()['active_connections'] == 1
        other_reader, other_writer = await asyncio.open_connection('127.0.0.1', port)
        try:
            assert await asyncio.wait_for(other_reader.read(), 2) == b''
        finally:
            other_writer.close(); await other_writer.wait_closed()
        await asyncio.wait_for(receiver.stop(), 2)
        assert await asyncio.wait_for(reader.read(), 2) == b''
        assert not receiver.clients
    finally:
        writer.close(); await writer.wait_closed()
        await asyncio.wait_for(receiver.stop(), 2)


@async_test
async def test_normal_disconnect_keeps_accepted_work_until_shutdown():
    started = asyncio.Event()
    cancelled = asyncio.Event()
    async def handler(data, addr):
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()
    receiver = module.TCPReceiver(handler)
    receiver.is_running = True
    protocol = receiver._client_factory()
    transport = Mock()
    transport.get_extra_info.return_value = ('127.0.0.1', 4444)
    protocol.connection_made(transport)
    protocol.data_received(b'accepted\n')
    await asyncio.wait_for(started.wait(), 2)
    protocol.connection_lost(None)
    await asyncio.sleep(0)
    assert not cancelled.is_set()
    assert protocol in receiver.protocols
    await asyncio.wait_for(receiver.stop(), 2)
    assert cancelled.is_set()
    assert not protocol.pending
