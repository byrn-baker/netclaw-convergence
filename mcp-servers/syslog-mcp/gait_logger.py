"""Bounded local GAIT persistence for telemetry; enqueue is not a commit."""
import fcntl
import json
import logging
import os
import queue
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class GAITLogger:
    """Batch events on one writer, with visible overload and persistence failures."""

    def __init__(self, service_name: str, gait_endpoint: Optional[str] = None,
                 enabled: bool = True, *, audit_root=None, queue_size=1024):
        if gait_endpoint:
            raise ValueError('Remote GAIT endpoints are unsupported; use the local audit store')
        if not re.fullmatch(r'[a-zA-Z0-9_-]+', service_name) or queue_size < 1:
            raise ValueError('Invalid telemetry audit service or queue size')
        self.service_name = service_name
        self.gait_endpoint = None
        self.enabled = enabled
        self.root = Path(audit_root or Path.home() / '.openclaw' / 'telemetry-audit') / service_name
        self.log_count = 0
        self.error_count = 0
        self.persisted_count = 0
        self.last_commit = None
        self.last_error = None
        self._queue = queue.Queue(maxsize=queue_size)
        self._lock = threading.Lock()
        self._closed = threading.Event()
        self._worker = None

    def log_event(self, event_type: str, source_ip: str, data: Dict[str, Any],
                  metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Return True only for queue admission, never as proof of persistence."""
        with self._lock:
            if not self.enabled or self._closed.is_set():
                return False
            self.log_count += 1
            try:
                payload = json.dumps({
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'service': self.service_name, 'event_type': event_type,
                    'source_ip': source_ip, 'data': data,
                    'metadata': metadata or {}, 'sequence': self.log_count,
                }, ensure_ascii=True)
                if len(payload) > 16384:
                    raise ValueError('Audit event exceeds 16KiB')
                self._queue.put_nowait(payload)
            except (TypeError, ValueError, queue.Full) as exc:
                self.error_count += 1
                self.last_error = type(exc).__name__
                return False
            if self._worker is None:
                self._worker = threading.Thread(target=self._run,
                    name=f'{self.service_name}-audit', daemon=True)
                self._worker.start()
            return True

    def _persist(self, records):
        from gait.repo import GaitRepo
        from gait.schema import Turn
        self.root.mkdir(parents=True, mode=0o700, exist_ok=True)
        if self.root.is_symlink() or self.root.stat().st_uid != os.getuid():
            raise PermissionError('Unsafe audit directory')
        self.root.chmod(0o700)
        descriptor = os.open(self.root / '.writer.lock',
                             os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, 'a') as lock_file:
            fcntl.flock(lock_file, fcntl.LOCK_EX)
            repo = GaitRepo(self.root)
            repo.init()
            turn = Turn.v0(user_text=f'{self.service_name} telemetry batch',
                           assistant_text='[' + ','.join(records) + ']',
                           visibility='private')
            _, commit = repo.record_turn(turn, message=f'{len(records)} telemetry audit events')
            return commit

    def _run(self):
        while not self._closed.is_set() or not self._queue.empty():
            try:
                records = [self._queue.get(timeout=0.1)]
            except queue.Empty:
                continue
            while len(records) < 64:
                try:
                    records.append(self._queue.get_nowait())
                except queue.Empty:
                    break
            try:
                commit = self._persist(records)
                with self._lock:
                    self.persisted_count += len(records)
                    self.last_commit = commit
            except Exception as exc:
                with self._lock:
                    first_failure = self.last_error is None
                    self.error_count += len(records)
                    self.last_error = type(exc).__name__
                if first_failure:
                    logger.warning('Telemetry GAIT persistence unavailable for %s (%s)',
                                   self.service_name, type(exc).__name__)
            finally:
                for _ in records:
                    self._queue.task_done()

    def close(self, timeout=5.0):
        """Stop admission and allow a bounded wait for queued persistence."""
        with self._lock:
            self._closed.set()
            worker = self._worker
        if worker:
            worker.join(timeout=timeout)
        return self.get_stats()

    def get_stats(self) -> Dict[str, Any]:
        with self._lock:
            pending = self.log_count - self.persisted_count - self.error_count
            return {
                'enabled': self.enabled, 'service_name': self.service_name,
                'mode': 'local_gait', 'log_count': self.log_count,
                'persisted_count': self.persisted_count,
                'pending_count': pending, 'error_count': self.error_count,
                'last_commit': self.last_commit, 'last_error': self.last_error,
                'closed': self._closed.is_set(),
            }

    def log_syslog_received(
        self,
        source_ip: str,
        message_id: str,
        severity: int,
        facility: int,
        message_preview: str
    ) -> bool:
        """Log a received syslog message."""
        return self.log_event(
            event_type='syslog_received',
            source_ip=source_ip,
            data={
                'message_id': message_id,
                'severity': severity,
                'facility': facility,
                'message_preview': message_preview[:100]  # Truncate for audit
            }
        )

    def log_trap_received(
        self,
        source_ip: str,
        trap_id: str,
        trap_oid: str,
        version: str
    ) -> bool:
        """Log a received SNMP trap."""
        return self.log_event(
            event_type='trap_received',
            source_ip=source_ip,
            data={
                'trap_id': trap_id,
                'trap_oid': trap_oid,
                'version': version
            }
        )

    def log_flow_received(
        self,
        exporter_ip: str,
        flow_id: str,
        src_ip: str,
        dst_ip: str,
        protocol: int
    ) -> bool:
        """Log a received flow record."""
        return self.log_event(
            event_type='flow_received',
            source_ip=exporter_ip,
            data={
                'flow_id': flow_id,
                'src_ip': src_ip,
                'dst_ip': dst_ip,
                'protocol': protocol
            }
        )

    def log_receiver_started(self, port: int, bind_address: str) -> bool:
        """Log receiver startup."""
        return self.log_event(
            event_type='receiver_started',
            source_ip='localhost',
            data={
                'port': port,
                'bind_address': bind_address
            }
        )

    def log_receiver_stopped(self, port: int, messages_received: int) -> bool:
        """Log receiver shutdown."""
        return self.log_event(
            event_type='receiver_stopped',
            source_ip='localhost',
            data={
                'port': port,
                'messages_received': messages_received
            }
        )
