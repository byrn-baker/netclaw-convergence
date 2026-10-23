"""Disconnected phones must not replay expired messages without another enqueue."""
import sqlite3
from types import SimpleNamespace
from bgp.federation import edge_queue


def test_expiry_enforced_on_replay_and_counts_without_new_write(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(edge_queue.time, 'time', lambda: clock[0])
    conn = sqlite3.connect(':memory:')
    try:
        queue = edge_queue.EdgeQueue(SimpleNamespace(_conn=conn))
        queue.ttl_seconds = 10
        queue.enqueue('phone', {'message': 'expired'})
        clock[0] += 8
        queue.enqueue('phone', {'message': 'current'})
        clock[0] += 3
        assert [row['payload']['message'] for row in queue.pending('phone')] == ['current']
        assert queue.depth('phone') == 1
        assert queue.depths() == {'phone': 1}
        clock[0] += 10
        assert queue.pending('phone') == []
        assert queue.depth('phone') == 0
        assert queue.depths() == {}
    finally:
        conn.close()
