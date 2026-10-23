#!/usr/bin/env python3
"""Audit owned FastMCP coverage; optionally discover real catalogs in offline subprocesses.

The worker has no operator environment or persistent HOME, refuses network connects,
uses fixture credentials, and never calls a vendor tool. Discovery is not live validation.
"""
from __future__ import annotations
import argparse
import ast
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
FRAMEWORK = '4.0.11'
SDK = '2.3.0'


def owned_servers(root=ROOT):
    files = subprocess.check_output(['git', '-C', str(root), 'ls-files', '--', 'mcp-servers'], text=True).splitlines()
    found = {}
    for name in files:
        path = root / name
        if path.suffix != '.py' or 'tests' in path.parts:
            continue
        tree = ast.parse(path.read_text())
        imports = [n.module for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)
                   and n.module and (n.module == 'fastmcp' or n.module.startswith('mcp.server.fastmcp'))]
        if imports:
            server = Path(name).parts[1]
            found.setdefault(server, []).append((name, imports))
    return found


def audit(root=ROOT):
    failures = []
    for server, sources in owned_servers(root).items():
        for path, imports in sources:
            if any(x.startswith('mcp.server.fastmcp') for x in imports):
                failures.append(f'{path}: obsolete SDK1 FastMCP import')
        directory = root / 'mcp-servers' / server
        manifests = [p for p in (directory/'requirements.txt', directory/'pyproject.toml') if p.exists()]
        source = '\n'.join(p.read_text() for p in manifests)
        for dep in (f'fastmcp=={FRAMEWORK}', f'mcp=={SDK}'):
            if dep not in source:
                failures.append(f'{server}: missing tested dependency {dep}')
    return failures


def entrypoint(server, sources):
    if server == 'eve-ng-mcp-server':
        return 'mcp-servers/eve-ng-mcp-server/eve_ng_mcp_server.py'
    return sources[0][0]


def fixture_env(directory):
    return {'PATH': os.environ.get('PATH', ''), 'HOME': str(directory),
            'PYTHON_DOTENV_DISABLED': '1', 'FASTMCP_CHECK_FOR_UPDATES': 'off',
            'MEMORY_DATA_DIR': str(directory/'memory'), 'RAG_DATA_DIR': str(directory/'rag'),
            'JEV_DATA_DIR': str(directory/'jev'), 'HF_HUB_OFFLINE': '1', 'TRANSFORMERS_OFFLINE': '1',
            'CLAROTY_API_TOKEN': 'fixture-only', 'NAUTOBOT_TOKEN': 'fixture-only',
            'NAUTOBOT_URL': 'https://fixture.invalid', 'SUZIEQ_API_URL': 'https://fixture.invalid',
            'SUZIEQ_API_KEY': 'fixture-only', 'GNMI_TARGETS': '{}',
            'ANONYMIZED_TELEMETRY': 'False'}


def probe(path):
    import asyncio
    import importlib.util
    import importlib.metadata
    path = Path(path).resolve()
    def offline(event, args):
        if event in ('socket.connect', 'socket.getaddrinfo'):
            raise RuntimeError('catalog probe refuses network access')
    sys.addaudithook(offline)
    sys.path.insert(0, str(path.parent))
    sys.path.insert(1, str(ROOT/'src'))
    try:
        if 'zabbix-mcp' in path.parts:
            sys.path.insert(0, str(path.parent.parent))
            module = __import__('zabbix_mcp_server.server', fromlist=['mcp'])
        else:
            spec = importlib.util.spec_from_file_location(path.stem, path)
            module = importlib.util.module_from_spec(spec)
            sys.modules[path.stem] = module
            spec.loader.exec_module(module)
        if path.parent.name == 'jev-mcp':
            from fastmcp import FastMCP
            captured = []
            original = FastMCP.run
            try:
                FastMCP.run = lambda self, **kwargs: captured.append(self)
                module.serve()
            finally:
                FastMCP.run = original
            server = captured[0]
        else:
            server = module.mcp
        async def catalog():
            from fastmcp import Client
            catalogs = []
            for mode in ('legacy', '2026-07-28'):
                async with Client(server, mode=mode) as client:
                    tools = await client.list_tools()
                    catalogs.append(sorted([t.model_dump(by_alias=True, exclude_none=True)
                                            for t in tools], key=lambda t: t['name']))
            # FastMCP emits legacy execution.taskSupport hints only in legacy mode.
            # The modern extension is negotiated per request, not through that hint.
            legacy = []
            for tool in catalogs[0]:
                tool = dict(tool)
                execution = tool.get('execution')
                if execution == {'taskSupport': 'optional'}:
                    tool.pop('execution')
                legacy.append(tool)
            if legacy != catalogs[1]:
                raise AssertionError('legacy and modern tool contracts differ beyond optional task hints')
            return catalogs[1], sorted(t.name for t in await server.list_tools()
                                        if t.task_config.supports_tasks())
        tools, task_tools = asyncio.run(catalog())
        return {'status': 'pass', 'task_tools': task_tools, 'fastmcp': importlib.metadata.version('fastmcp'),
                'mcp': importlib.metadata.version('mcp'), 'protocols': ['legacy', '2026-07-28'], 'tools': tools}
    except BaseException as exc:
        return {'status': 'error', 'error': f'{type(exc).__name__}: {exc}'}


def catalogs(python=sys.executable, root=ROOT):
    def one(item):
        server, sources = item
        entry = entrypoint(server, sources)
        with tempfile.TemporaryDirectory(prefix='netclaw-mcp-catalog-') as directory:
            try:
                result = subprocess.run([python, str(Path(__file__).resolve()), '--probe', str(root/entry)],
                                        cwd=directory, env=fixture_env(Path(directory)),
                                        capture_output=True, text=True, timeout=60)
                value = json.loads(result.stdout.splitlines()[-1])
            except Exception as exc:
                value = {'status': 'error', 'error': f'{type(exc).__name__}: {exc}'}
        value['entrypoint'] = entry
        return server, value
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        return dict(pool.map(one, sorted(owned_servers(root).items())))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalogs', type=Path, help='Run offline discovery and write evidence JSON')
    parser.add_argument('--python', default=sys.executable)
    parser.add_argument('--probe', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.probe:
        print(json.dumps(probe(args.probe), default=str))
        return 0
    failures = audit()
    if args.catalogs:
        results = catalogs(args.python)
        args.catalogs.write_text(json.dumps(results, indent=2)+'\n')
        for server, result in results.items():
            print(f'{server}: {result["status"]}; {len(result.get("tools", []))} tools')
            if result['status'] != 'pass':
                failures.append(f'{server}: {result["error"]}')
    for failure in failures:
        print(f'FAIL: {failure}', file=sys.stderr)
    print(f'{len(owned_servers())} owned FastMCP servers; {len(failures)} failures')
    return int(bool(failures))


if __name__ == '__main__':
    raise SystemExit(main())
