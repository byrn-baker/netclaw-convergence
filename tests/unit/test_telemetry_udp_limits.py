"""Verify actual receiver admission and shutdown without external appliances."""
import asyncio
import importlib.util
from pathlib import Path
from unittest.mock import Mock

import pytest


@pytest.mark.parametrize('name', ['syslog', 'snmptrap', 'ipfix'])
def test_udp_admission_delivery_and_shutdown(name):
    path = Path(__file__).resolve().parents[2] / f'mcp-servers/{name}-mcp/udp_receiver.py'
    spec = importlib.util.spec_from_file_location(f'udp_{name}', path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    async def scenario():
        seen = []
        async def handler(data, addr):
            seen.append((data, addr))
            await asyncio.Event().wait()
        receiver = module.UDPReceiver(handler)
        protocol = module.UDPReceiverProtocol(handler)
        transport = Mock()
        receiver.transport, receiver.protocol, receiver.is_running = transport, protocol, True
        protocol.connection_made(transport)
        for _ in range(257):
            protocol.datagram_received(b'synthetic', ('127.0.0.1', 1234))
        assert len(protocol.pending) == 256
        assert protocol.get_stats()['dropped_datagrams'] == 1
        await asyncio.sleep(0)
        assert seen == [(b'synthetic', ('127.0.0.1', 1234))] * 256
        await asyncio.wait_for(receiver.stop(), 2)
        transport.close.assert_called_once()
        assert not protocol.pending
        protocol.datagram_received(b'late', ('127.0.0.1', 1234))
        assert protocol.get_stats()['dropped_datagrams'] == 2
        assert not protocol.pending
        assert receiver.get_status()['pending_handlers'] == 0
    asyncio.run(scenario())
