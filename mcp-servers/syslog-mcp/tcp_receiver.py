"""Bounded asyncio TCP syslog receiver using newline-delimited framing.

Octet-counted RFC 6587 framing is not supported by this receiver.
"""
import asyncio
import logging
from datetime import datetime
from typing import Awaitable, Callable, Optional, Set, Tuple

logger = logging.getLogger(__name__)
MessageHandler = Callable[[bytes, Tuple[str, int]], Awaitable[None]]


class TCPSyslogProtocol(asyncio.Protocol):
    """Keep per-client frames and pending dispatch work bounded."""

    def __init__(self, message_handler: MessageHandler,
                 client_addr: Tuple[str, int],
                 on_disconnect: Optional[Callable[[Tuple[str, int]], None]] = None,
                 *, max_frame_bytes: int = 65536, max_pending: int = 128,
                 on_connect=None):
        if max_frame_bytes <= 0 or max_pending <= 0:
            raise ValueError('TCP syslog limits must be positive')
        self.message_handler = message_handler
        self.client_addr = client_addr
        self.on_disconnect = on_disconnect
        self.on_connect = on_connect
        self.max_frame_bytes = max_frame_bytes
        self.max_pending = max_pending
        self.transport = None
        self.buffer = b''
        self.pending: Set[asyncio.Task] = set()
        self.messages_received = 0
        self.closed = False

    def connection_made(self, transport):
        self.transport = transport
        peer = transport.get_extra_info('peername')
        if peer:
            self.client_addr = (peer[0], peer[1])
        if self.on_connect and not self.on_connect(self):
            self.close()
            return
        logger.info('TCP syslog connection from %s', self.client_addr)

    def close(self):
        if not self.closed:
            self.closed = True
            self.buffer = b''
            if self.transport:
                self.transport.close()
        for task in tuple(self.pending):
            task.cancel()

    async def shutdown(self):
        self.close()
        if self.pending:
            await asyncio.gather(*tuple(self.pending), return_exceptions=True)
        self.pending.clear()

    def data_received(self, data: bytes):
        if self.closed:
            return
        # Scan in place: never concatenate an unbounded received chunk or create
        # a list of every line before checking frame and admission limits.
        offset = 0
        while offset < len(data):
            end = data.find(b'\n', offset)
            stop = len(data) if end < 0 else end
            if len(self.buffer) + stop - offset > self.max_frame_bytes:
                logger.warning('Closing oversized TCP syslog frame from %s', self.client_addr)
                self.close()
                return
            self.buffer += data[offset:stop]
            if end < 0:
                return
            line, self.buffer = self.buffer, b''
            offset = end + 1
            if not line:
                continue
            if len(self.pending) >= self.max_pending:
                logger.warning('Closing overloaded TCP syslog client %s', self.client_addr)
                self.close()
                return
            self.messages_received += 1
            task = asyncio.create_task(self._handle_message(line))
            self.pending.add(task)
            task.add_done_callback(self.pending.discard)

    async def _handle_message(self, data):
        try:
            await self.message_handler(data, self.client_addr)
        except Exception as exc:
            logger.error('TCP syslog handler failed for %s: %s',
                         self.client_addr, type(exc).__name__)

    def connection_lost(self, exc):
        # Normal peer disconnect must not cancel already accepted messages.
        # Explicit shutdown/overload calls close() and cancels owned work.
        self.closed = True
        self.buffer = b''
        if self.on_disconnect:
            self.on_disconnect(self.client_addr)


class TCPReceiver:
    """Own connected transports and their tasks as well as the listening socket."""

    def __init__(self, message_handler: MessageHandler, host='0.0.0.0', port=1514,
                 *, max_connections=64, max_frame_bytes=65536, max_pending=128):
        if min(max_connections, max_frame_bytes, max_pending) <= 0:
            raise ValueError('TCP syslog limits must be positive')
        self.message_handler = message_handler
        self.host = host
        self.port = port
        self.max_connections = max_connections
        self.max_frame_bytes = max_frame_bytes
        self.max_pending = max_pending
        self.server = None
        self.is_running = False
        self.started_at = None
        self.clients = set()
        self.protocols = set()
        self.total_connections = 0
        self.total_messages = 0

    def _client_factory(self, client_addr=('unknown', 0)):
        def on_connect(protocol):
            if not self.is_running or len(self.protocols) >= self.max_connections:
                return False
            self.protocols.add(protocol)
            self.clients.add(protocol.client_addr)
            self.total_connections += 1
            return True

        def on_disconnect(addr):
            self.clients.discard(addr)
            if not protocol.pending:
                self.protocols.discard(protocol)
            else:
                # Keep disconnected work owned and counted until it finishes.
                def completed(_):
                    if not protocol.pending:
                        self.protocols.discard(protocol)
                for task in tuple(protocol.pending):
                    task.add_done_callback(completed)

        protocol = TCPSyslogProtocol(
            self.message_handler, client_addr, on_disconnect,
            max_frame_bytes=self.max_frame_bytes, max_pending=self.max_pending,
            on_connect=on_connect)
        return protocol

    async def start(self):
        if self.is_running:
            return
        self.server = await asyncio.get_running_loop().create_server(
            self._client_factory, self.host, self.port, reuse_address=True,
            start_serving=False)
        self.is_running = True
        try:
            await self.server.start_serving()
        except BaseException:
            await self.stop()
            raise
        self.started_at = datetime.utcnow()
        logger.info('TCP syslog receiver started on %s:%s', self.host, self.port)

    async def stop(self):
        self.is_running = False
        server, self.server = self.server, None
        if server:
            server.close()
        await asyncio.gather(*(p.shutdown() for p in tuple(self.protocols)))
        if server:
            await server.wait_closed()
        self.protocols.clear()
        self.clients.clear()

    def get_status(self):
        return {
            'is_running': self.is_running, 'host': self.host, 'port': self.port,
            'protocol': 'tcp',
            'bound_port': self.server.sockets[0].getsockname()[1] if self.server and self.server.sockets else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'active_connections': len(self.protocols),
            'total_connections': self.total_connections,
            'max_connections': self.max_connections,
            'max_frame_bytes': self.max_frame_bytes,
            'max_pending_per_connection': self.max_pending,
        }
