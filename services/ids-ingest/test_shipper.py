"""Exercise the durable live/history spool used by the sensor delivery loop."""
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import time

import pytest


spec = importlib.util.spec_from_file_location('ids_shipper',
    Path(__file__).resolve().parents[2]/'deploy/convergence/ids/shipper.py')
shipper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shipper)


def records(path, count, label):
    path.write_text(''.join(json.dumps({'event_type': 'flow', 'label': label, 'n': n})+'\n'
                            for n in range(count)))


@pytest.fixture
def spool(tmp_path):
    (tmp_path/'logs').mkdir()
    old = tmp_path/'logs/eve-old.json'
    live = tmp_path/'logs/eve-live.json'
    records(old, 1000, 'old')
    records(live, 2000, 'live')
    os.utime(old, (time.time()-3*86400,)*2)
    state = sqlite3.connect(tmp_path/'shipper.sqlite')
    try:
        yield shipper.EveSpool(tmp_path, state, live_tail_bytes=1024), state, old, live
    finally:
        state.close()


def test_live_delivery_does_not_advance_history_and_retries_until_ack(spool):
    queue, state, old, live = spool
    batch = queue.next_batch()
    assert batch['events'][0]['label'] == 'live'
    assert batch['events'][0]['n'] > 0
    assert queue.next_batch()['events'] == batch['events'], 'No advance before ACK'
    queue.acknowledge(batch)
    assert state.execute('SELECT count(*) FROM cursors').fetchone()[0] == 0
    assert state.execute('SELECT offset FROM live_cursors').fetchone()[0] == batch['consumed']
    # No new live data: the untouched historical prefix is delivered next.
    history = queue.next_batch()
    assert history['events'][0] == {'event_type': 'flow', 'label': 'old', 'n': 0}
    assert old.exists(), 'Unacknowledged old evidence must never be pruned'


def test_continuous_live_traffic_still_replays_history(spool):
    queue, state, old, live = spool
    channels = []
    for _ in range(5):
        with live.open('a') as stream:
            stream.write(json.dumps({'event_type': 'flow', 'label': 'new'})+'\n')
        batch = queue.next_batch()
        channels.append(batch['channel'])
        queue.acknowledge(batch)
    assert channels == ['live']*4+['history']


def test_restart_preserves_live_ack_and_original_history_cursor(spool):
    queue, state, old, live = spool
    batch = queue.next_batch()
    queue.acknowledge(batch)
    with live.open('a') as stream:
        stream.write('{"event_type":"stats","marker":"after-restart"}\n')
    restarted = shipper.EveSpool(live.parent.parent, state, live_tail_bytes=1024)
    assert restarted.next_batch()['events'] == [{'event_type': 'stats', 'marker': 'after-restart'}]
    history = restarted._history_batch([old, live])
    restarted.acknowledge(history)
    again = shipper.EveSpool(live.parent.parent, state, live_tail_bytes=1024)
    assert again._history_batch([old, live])['events'][0]['n'] == 128


def test_rotation_keeps_unacknowledged_live_tail_and_history(spool):
    queue, state, old, live = spool
    first = queue.next_batch()
    queue.acknowledge(first)
    with live.open('a') as stream:
        stream.write('{"event_type":"flow","marker":"rotation-tail"}\n')
    rotated = live.parent/'eve-new.json'
    records(rotated, 1, 'rotated')
    os.utime(rotated, (time.time()+1,)*2)
    batch = queue.next_batch()
    assert batch['events'][0]['label'] == 'rotated'
    queue.acknowledge(batch)
    assert queue.next_batch()['events'][0]['marker'] == 'rotation-tail'
    assert old.exists() and live.exists()


def test_only_fully_acknowledged_history_can_be_pruned(spool):
    queue, state, old, live = spool
    st = old.stat()
    with state:
        state.execute('INSERT INTO live_cursors VALUES(?,?,?)', (st.st_dev, st.st_ino, st.st_size))
    queue._history_batch([old])
    assert old.exists(), 'A live ACK cannot authorize history deletion'
    with state:
        state.execute('INSERT INTO cursors VALUES(?,?,?)', (st.st_dev, st.st_ino, st.st_size))
    assert queue._history_batch([old]) is None
    assert not old.exists()
    assert state.execute('SELECT count(*) FROM live_cursors').fetchone()[0] == 0


def test_live_resume_waits_for_partial_line_and_detects_truncation(spool):
    queue, state, old, live = spool
    queue.acknowledge(queue.next_batch())
    with live.open('a') as stream:
        stream.write('{"event_type":"flow"')
    assert queue.next_batch()['channel'] == 'history'
    with live.open('a') as stream:
        stream.write('}\n')
    assert queue.next_batch()['events'] == [{'event_type': 'flow'}]
    live.write_text('')
    with pytest.raises(RuntimeError, match='truncated'):
        queue.next_batch()


def test_initial_live_tail_does_not_checkpoint_inside_unfinished_record(spool):
    queue, state, old, live = spool
    live.write_text('{"event_type":"flow","padding":"'+'x'*2000)
    # Tail starts in an unfinished line: history retains it and live waits.
    batch = queue.next_batch()
    assert batch['channel'] == 'history'
    assert state.execute('SELECT count(*) FROM live_cursors').fetchone()[0] == 0
    with live.open('a') as stream:
        stream.write('"}\n{"event_type":"stats","marker":"new-boundary"}\n')
    assert queue.next_batch()['events'] == [{'event_type': 'stats', 'marker': 'new-boundary'}]


def test_existing_history_cursor_is_preserved_on_upgrade(spool):
    queue, state, old, live = spool
    history = queue._history_batch([old])
    queue.acknowledge(history)
    state.execute('DROP TABLE live_cursors')
    upgraded = shipper.EveSpool(live.parent.parent, state, live_tail_bytes=1024)
    upgraded.acknowledge(upgraded.next_batch())
    assert upgraded._history_batch([old])['events'][0]['n'] == 128
