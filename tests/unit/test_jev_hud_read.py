"""Real stdio assessment mediation: fixed task, no network and no inference."""
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / 'mcp-servers/jev-mcp/server.py'


def test_read_task_process_cannot_evaluate_or_read_foreign_task(tmp_path):
    spec = importlib.util.spec_from_file_location('jev_hud_read_core', SERVER.with_name('core.py'))
    core = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = core
    spec.loader.exec_module(core)
    ledger = core.Ledger(tmp_path / 'jev')
    record = {'assessment_id': 'fixture1', 'status': 'ok', 'task_id': 'owned', 'reconsideration_of': None,
              'questions': {'q': {'type': 'noul', 'instructions': 'Synthetic question'}},
              'answers': {'q': {'type': 'noul', 'noul': .8}}}
    with ledger.connect() as db:
        db.execute('INSERT INTO calls VALUES (?,?,?,?,?,?,?,?)', ('fixture1','2026-09-28','owned',0,None,'digest','ok',json.dumps(record)))
    envfile = tmp_path / 'fixture.env'
    envfile.write_text(f'JEV_DATA_DIR={ledger.directory}\nJEV_TASK_ID=foreign\n')
    async def run():
        params = StdioServerParameters(command=sys.executable, args=[str(SERVER), '--env-file', str(envfile), '--read-task-id', 'owned'], env={'PATH':os.environ['PATH'], 'HOME':str(tmp_path)})
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool('jev_assessment', {'assessment_id':'fixture1'})
                assert json.loads(result.content[0].text)['assessment_id'] == 'fixture1'
                denied = await session.call_tool('jev_assessment', {'assessment_id':'foreign'})
                assert json.loads(denied.content[0].text)['status'] == 'not_found'
                evaluation = await session.call_tool('jev_evaluate', {'state':'synthetic','questions':{'q':{'type':'noul','instructions':'Synthetic?'}},'purpose':'diagnostic_advice','evidence_metadata':[]})
                assert json.loads(evaluation.content[0].text)['status'] == 'unavailable'
    asyncio.run(run())
    with ledger.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM calls').fetchone()[0] == 1
