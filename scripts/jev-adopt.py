#!/usr/bin/env python3
"""Preview/apply a Jev registration to an existing OpenClaw mcp.servers registry.

Does not install dependencies, enable inference, edit credentials, restart services,
or replace an existing custom Jev registration. Retains a private recovery original.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path

_spec = importlib.util.spec_from_file_location('jev_adoption_recovery', Path(__file__).with_name('migrate-voice-auth.py'))
helpers = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(helpers)


def safe_file(path):
    for item in (path, *path.parents):
        if item.is_symlink():
            raise ValueError('Symlink paths require operator review')
    helpers.regular_file(path)


def adopt(config, env_file, repo, apply=False, restore=False):
    config = Path(config).expanduser().absolute()
    backup = config.with_name(config.name+'.pre-jev-registration')
    safe_file(config)
    safe_file(backup)
    safe_file(backup.with_name(backup.name+'.state.json'))
    if restore:
        helpers.restore_backup(config, backup, apply)
        print('Jev registration original restored; restart the affected MCP.' if apply else 'Preview: restore retained registration original; no files changed.')
        return
    repo = Path(repo).expanduser().absolute()
    env_file = Path(env_file).expanduser().absolute()
    safe_file(env_file)
    if not env_file.is_file():
        raise ValueError('Selected runtime environment file is missing; run Jev setup with --env-file first')
    original = config.read_bytes()
    data = json.loads(original)
    if not isinstance(data, dict) or 'mcpServers' in data or not isinstance(data.get('mcp'), dict) or not isinstance(data['mcp'].get('servers'), dict):
        raise ValueError('Expected an existing OpenClaw mcp.servers registry. Confirm the active runtime/config; legacy or ambiguous shapes need manual review')
    python = repo/'mcp-servers/jev-mcp/.venv/bin/python'
    server = repo/'mcp-servers/jev-mcp/server.py'
    if not python.is_file() or not os.access(python, os.X_OK) or not server.is_file():
        raise ValueError('Install Jev dependencies in this checkout before adoption')
    entry = {'command':str(python), 'args':['-u',str(server),'--env-file',str(env_file)], 'cwd':str(repo)}
    existing = data['mcp']['servers'].get('jev-mcp')
    if existing == entry:
        print('Jev registration already current; no files changed.')
        return
    if existing is not None:
        raise ValueError('Existing Jev registration differs; preserve and review it instead of replacing customization')
    print(('Apply: ' if apply else 'Preview: ')+'add only mcp.servers.jev-mcp; environment loaded as data from selected file; no inference or service restart.')
    if not apply:
        return
    if backup.exists():
        raise ValueError('A previous recovery original exists; retain and review it before reapplying')
    if config.read_bytes() != original:
        raise ValueError('Configuration changed during preview; rerun adoption')
    data['mcp']['servers']['jev-mcp'] = entry
    descriptor = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(original)
        stream.flush()
        os.fsync(stream.fileno())
    helpers.write_migrated(config, (json.dumps(data, indent=2)+'\n').encode(), backup)
    print('Private original and digest journal retained beside config. Validate config, then restart the affected gateway/MCP and verify tool discovery.')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True, type=Path, help='Discovered active Border OpenClaw config')
    parser.add_argument('--env-file', type=Path, help='Chosen runtime env file; required except restore')
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--restore', action='store_true')
    args = parser.parse_args(argv)
    if not args.restore and args.env_file is None:
        parser.error('--env-file is required for adoption')
    try:
        adopt(args.config, args.env_file, args.repo, args.apply, args.restore)
        return 0
    except (ValueError, OSError, TypeError, AttributeError) as exc:
        # JSON content, environment values and launch credentials are never printed.
        print('Jev adoption refused: '+(str(exc) if type(exc) is ValueError else type(exc).__name__))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
