"""Real MCP handshake and provider HTTP fixture, with no external inference."""
import asyncio
from contextlib import contextmanager
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import sys
import threading

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / 'mcp-servers/jev-mcp/server.py'


@contextmanager
def provider():
    received = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            received.append(payload)
            answers = {}
            for key, question in payload['questions'].items():
                if question['type'] == 'noul':
                    answers[key] = {'type': 'noul', 'noul': .8}
                elif question['type'] == 'choice':
                    labels = list(question['criteria'])
                    answers[key] = {'type': 'choice', 'choice': labels[0], 'confidence': 1,
                                    'probabilities': {label: int(i == 0) for i, label in enumerate(labels)}}
                else:
                    criteria = question['criteria']
                    answers[key] = {'type': 'score', 'score': 1, 'confidence': 1,
                                    'legend': {str(i): v for i, v in enumerate(criteria)},
                                    'probabilities': {str(i): int(i == 1) for i in range(len(criteria))}}
            body = json.dumps({'model': 'fixture-1', 'answers': answers,
                               'usage': {'input_tokens': 100, 'output_tokens': 30}}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}', received
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def result_data(result):
    assert not result.model_dump(by_alias=True).get('isError', False)
    return json.loads(next(content.text for content in result.content if content.type == 'text'))


def test_real_stdio_mixed_batch_readback_and_disabled_no_send(tmp_path):
    with provider() as (endpoint, received):
        async def exercise(enabled):
            # Do not inherit private runtime configuration or provider keys.
            env = {'PATH': os.environ['PATH'], 'HOME': str(tmp_path), 'JEV_ENABLED': str(enabled).lower(),
                   'JEV_BASE_URL': endpoint, 'JEV_MODEL': 'fixture-1',
                   'JEV_INPUT_PRICE_PER_MILLION': '.042', 'JEV_DATA_DIR': str(tmp_path/'jev'),
                   'JEV_GAIT_ROOT': str(tmp_path), 'JEV_TASK_ID': 'synthetic-stdio',
                   'GAIT_VENV': str(tmp_path/'no-gait')}
            params = StdioServerParameters(command=sys.executable, args=[str(SERVER)], env=env, cwd=str(tmp_path))
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    names = {tool.name for tool in (await session.list_tools()).tools}
                    assert names == {'jev_status', 'jev_evaluate', 'jev_assessment'}
                    status = result_data(await session.call_tool('jev_status', {}))
                    assert status['enabled'] is enabled
                    args = {'state': {'observation': 'Synthetic link is up', 'missing': 'No application probe'},
                            'questions': {'link': {'type': 'noul', 'instructions': 'Does the observation report the link up?'},
                                          'next': {'type': 'choice', 'instructions': 'Which observation addresses the gap?',
                                                   'criteria': {'probe': 'Check application response', 'none': 'No suitable observation'}},
                                          'coverage': {'type': 'score', 'instructions': 'How complete is application evidence?',
                                                       'criteria': ['No observation supplied', 'An indirect observation exists', 'Application response measured']}},
                            'purpose': 'evidence_review', 'evidence_metadata': [{'source': 'synthetic-fixture'}]}
                    result = result_data(await session.call_tool('jev_evaluate', args))
                    if not enabled:
                        assert result['status'] == 'disabled'
                        return
                    assert result['status'] == 'ok', result
                    assert result['advisory_only'] is True
                    assert set(result['answers']) == set(args['questions'])
                    assert result['cost_usd'] == 100 * .042 / 1_000_000
                    stored = result_data(await session.call_tool('jev_assessment', {'assessment_id': result['assessment_id']}))
                    assert stored['questions'] == args['questions']
                    assert stored['answers'] == result['answers']
                    after = result_data(await session.call_tool('jev_status', {}))
                    assert after['budgets']['case_used_usd'] == result['cost_usd']
        asyncio.run(exercise(False))
        assert not received
        asyncio.run(exercise(True))
        assert len(received) == 1
