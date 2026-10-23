import asyncio
import os
from pathlib import Path
import signal
import sys
import pytest
from bgp.federation import acme


def alive(pid):
    try:os.kill(pid,0);return True
    except ProcessLookupError:return False


@pytest.mark.parametrize('cancel',[False,True])
def test_acme_stops_and_reaps_child_on_timeout_or_cancel(tmp_path,cancel):
    pidfile=tmp_path/'pid'
    code='import os,time,pathlib,sys;pathlib.Path(sys.argv[1]).write_text(str(os.getpid()));time.sleep(30)'
    async def run():
        task=asyncio.create_task(acme._run([sys.executable,'-c',code,str(pidfile)],timeout_s=0.25 if not cancel else 30))
        for _ in range(100):
            if pidfile.exists():break
            await asyncio.sleep(.01)
        assert pidfile.exists()
        if cancel:task.cancel()
        with pytest.raises(asyncio.CancelledError if cancel else asyncio.TimeoutError):await task
        assert not alive(int(pidfile.read_text()))
    try:asyncio.run(run())
    finally:
        if pidfile.exists() and alive(int(pidfile.read_text())):os.kill(int(pidfile.read_text()),signal.SIGKILL)


def test_acme_success_and_nonzero_output_retained():
    for rc in [0,3]:
        result=asyncio.run(acme._run([sys.executable,'-c',f'print("fixture");raise SystemExit({rc})'],timeout_s=3))
        assert result==(rc,'fixture\n')
