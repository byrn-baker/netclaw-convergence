"""Exercise the actual SSH registration with fixture work and a real denial."""
import asyncio
import importlib.util
import inspect
from pathlib import Path
import threading

from fastmcp import Client
from fastmcp_tasks import call_tool_task
import pytest

ROOT=Path(__file__).resolve().parents[2]


@pytest.fixture
def ssh(monkeypatch):
    directory=ROOT/'mcp-servers/multivendor-cli-mcp'
    monkeypatch.syspath_prepend(str(directory))
    spec=importlib.util.spec_from_file_location('tasks_multivendor_fixture',directory/'server.py')
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.asyncio
async def test_threaded_ssh_handle_and_foreground_responsiveness(ssh,monkeypatch):
    entered=threading.Event();released=threading.Event()
    def fixture_read(device,command,timeout_s=None):
        entered.set()
        assert released.wait(5),'fixture work was never released'
        return {'status':'success','output':'fixture output'}
    monkeypatch.setattr(ssh.raw_tools,'run_command',fixture_read)
    assert not inspect.iscoroutinefunction(ssh.run_command), 'direct Python contract changed'
    async with Client(ssh.mcp,mode='2026-07-28') as client:
        task=await call_tool_task(client,'run_command',{'device':'fixture','command':'show version'})
        try:
            assert task.task_id
            assert await asyncio.to_thread(entered.wait,2)
            assert not released.is_set()
            assert (await task.status()).status=='working'
            policy=await asyncio.wait_for(client.call_tool('check_command_policy',{'command':'reload'}),1)
            assert policy.data['allowed'] is False
        finally:released.set()
        result=await task.result()
        assert result.data=={'status':'success','output':'fixture output'}


@pytest.mark.asyncio
async def test_legacy_ssh_fallback_and_denial(ssh,monkeypatch):
    from types import SimpleNamespace
    device=SimpleNamespace(platform='mikrotik_routeros')
    monkeypatch.setattr(ssh.raw_tools.inv,'resolve',lambda:SimpleNamespace(devices=[device],source=SimpleNamespace(value='fixture')))
    monkeypatch.setattr(ssh.raw_tools.inv,'find',lambda devices,name:device)
    def refuse_credentials(*args,**kwargs):raise AssertionError('denial must precede credentials and connections')
    monkeypatch.setattr(ssh.raw_tools,'resolve_credential',refuse_credentials)
    for mode in ('legacy','2026-07-28'):
        async with Client(ssh.mcp,mode=mode) as client:
            result=await client.call_tool('run_command',{'device':'nonexistent-fixture','command':'reload'})
            assert result.data['status']=='denied'
