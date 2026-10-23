#!/usr/bin/env python3
"""Operator-only Jev setup, budgets and scoped disclosure grants. Never an MCP tool."""
import argparse
import getpass
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('jev_env_writer', ROOT / 'scripts/write-env.py')
writer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(writer)


def money(value):
    result = float(value)
    if not math.isfinite(result) or result < 0:
        raise argparse.ArgumentTypeError('Amount must be finite and nonnegative')
    return result


def endpoint(value):
    parsed = urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('Endpoint must be an HTTP(S) URL without credentials, query or fragment')
    if parsed.scheme == 'http' and parsed.hostname not in ('localhost', '127.0.0.1', '::1'):
        raise ValueError('Remote endpoints require HTTPS')
    return value.rstrip('/')


def refresh_status(env_path, data_dir=None):
    """Refresh the local HUD snapshot without provider traffic or secret output."""
    sys.path.insert(0, str(ROOT/'mcp-servers/jev-mcp'))
    from core import Config, status
    values = dict(os.environ)
    if env_path.exists():
        values.update(writer.values(env_path.read_text()))
    if data_dir is not None:
        values['JEV_DATA_DIR'] = str(data_dir)
    return status(Config.from_env(values))


def setup(env_path, data_dir=None):
    current = writer.values(env_path.read_text()) if env_path.exists() else {}
    print('Jev offers advisory judgments. Hosted calls send sanitized evidence to the chosen provider.')
    if input('Enable Jev? [y/N] ').strip().lower() not in ('y', 'yes'):
        writer.update(env_path, 'JEV_ENABLED', 'false')
        print('Jev disabled.')
        return
    base = endpoint(input('Provider base URL [https://api.typesafe.ai]: ').strip() or 'https://api.typesafe.ai')
    hosted = base in ('https://api.typesafe.ai', 'https://api.typesafe.ai/v1/systemone')
    prompt = ('Hosted API key (blank preserves existing hosted key): ' if hosted else
              'Compatible endpoint API key (blank preserves only a key bound to this exact endpoint; optional locally): ')
    key = getpass.getpass(prompt).strip()
    if hosted and not (key or current.get('TYPESAFE_API_KEY') or current.get('JEV_API_KEY') or os.getenv('TYPESAFE_API_KEY') or os.getenv('JEV_API_KEY')):
        raise ValueError('Hosted Jev requires an API key')
    daily = money(input('Daily budget USD [5]: ').strip() or '5')
    case = money(input('Per-use-case budget USD [0.25]: ').strip() or '0.25')
    price = money(input('Input price USD per million tokens [0.042]: ').strip() or '0.042') if hosted else money(input('Compatible endpoint input price USD per million tokens (0 for free local): ').strip())
    model = input('Model [jev-1.13.0]: ').strip() or 'jev-1.13.0'
    updates = {'JEV_BASE_URL':base, 'JEV_MODEL':model, 'JEV_DAILY_LIMIT_USD':str(daily), 'JEV_CASE_LIMIT_USD':str(case), 'JEV_INPUT_PRICE_PER_MILLION':str(price)}
    if hosted:
        if key:
            updates['TYPESAFE_API_KEY'] = key
    else:
        # Never forward a hosted key to a compatible service, or reuse another
        # service's key after switching destinations.
        normalized = base if urlsplit(base).path else base+'/v1/systemone'
        previous_binding = current.get('JEV_COMPATIBLE_KEY_ENDPOINT')
        saved_key = current.get('JEV_COMPATIBLE_API_KEY', '') if previous_binding == normalized else ''
        updates['JEV_COMPATIBLE_API_KEY'] = key or saved_key
        updates['JEV_COMPATIBLE_KEY_ENDPOINT'] = normalized
    for name, value in updates.items():
        writer.update(env_path, name, value)
    # Existing operator overrides outrank environment defaults in the running server.
    # Reconfiguration must update those caps too, while preserving task-specific caps.
    settings_dir = (data_dir or Path(os.getenv('JEV_DATA_DIR') or current.get('JEV_DATA_DIR') or '~/.openclaw/jev')).expanduser()
    settings_path = settings_dir/'settings.json'
    if settings_path.exists():
        overrides = json.loads(settings_path.read_text())
        overrides.update(daily_limit_usd=daily, case_limit_usd=case)
        writer.write_private(settings_path, json.dumps(overrides, indent=2)+'\n')
    # Activation is last, after validation and credential/config writes succeed.
    writer.update(env_path, 'JEV_ENABLED', 'true')
    print('Jev enabled. Restart its MCP process to load environment changes. No evaluation was sent.')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, default=Path.home()/'.openclaw/.env')
    parser.add_argument('--data-dir', type=Path)
    subs = parser.add_subparsers(dest='command', required=True)
    subs.add_parser('setup')
    subs.add_parser('disable')
    subs.add_parser('status', help='Show local status without provider calls')
    bind = subs.add_parser('task', help='Bind an originating task without resetting spending')
    bind.add_argument('task_id')
    limits = subs.add_parser('limits', help='Set operator overrides; changes apply to subsequent calls')
    limits.add_argument('--daily', type=money)
    limits.add_argument('--case', type=money)
    limits.add_argument('--task', help='Bind --case override to this trusted runtime task ID')
    grant = subs.add_parser('approve-disclosure', help='Approve the exact previewed request for one use')
    grant.add_argument('digest')
    grant.add_argument('--endpoint', required=True)
    grant.add_argument('--task', required=True)
    grant.add_argument('--expires-in', type=int, default=300)
    args = parser.parse_args(argv)
    try:
        if args.command == 'setup':
            setup(args.env_file.expanduser(), args.data_dir)
            refresh_status(args.env_file.expanduser(), args.data_dir)
            return 0
        if args.command == 'disable':
            writer.update(args.env_file.expanduser(), 'JEV_ENABLED', 'false')
            refresh_status(args.env_file.expanduser(), args.data_dir)
            print('Jev disabled; restart its MCP process to load environment changes.')
            return 0
        env = writer.values(args.env_file.expanduser().read_text()) if args.env_file.expanduser().exists() else {}
        data_dir = (args.data_dir or Path(os.getenv('JEV_DATA_DIR') or env.get('JEV_DATA_DIR') or '~/.openclaw/jev')).expanduser()
        if args.command == 'status':
            print(json.dumps(refresh_status(args.env_file.expanduser(), data_dir), indent=2))
        elif args.command == 'task':
            if not re.fullmatch(r'[A-Za-z0-9_.:/-]{1,128}', args.task_id):
                raise ValueError('Task ID must be 1–128 letters, digits or characters _.:/-')
            path = data_dir/'settings.json'
            settings = json.loads(path.read_text()) if path.exists() else {}
            settings['task_id'] = args.task_id
            writer.write_private(path, json.dumps(settings, indent=2)+'\n')
            refresh_status(args.env_file.expanduser(), data_dir)
            print('Jev task binding updated; existing spending is retained. A runtime JEV_TASK_ID takes precedence.')
        elif args.command == 'limits':
            if args.daily is None and args.case is None:
                raise ValueError('Provide --daily or --case')
            if args.task and args.case is None:
                raise ValueError('--task requires --case')
            path = data_dir/'settings.json'
            settings = json.loads(path.read_text()) if path.exists() else {}
            if args.daily is not None:
                settings['daily_limit_usd'] = args.daily
            if args.case is not None:
                if args.task:
                    settings.setdefault('case_overrides', {})[args.task] = args.case
                else:
                    settings['case_limit_usd'] = args.case
            writer.write_private(path, json.dumps(settings, indent=2)+'\n')
            refresh_status(args.env_file.expanduser(), data_dir)
            print('Jev budget settings updated; existing spending is retained.')
        else:
            if not re.fullmatch('[0-9a-f]{64}', args.digest):
                raise ValueError('Digest must be the SHA-256 digest from prepare_only preview')
            if not 1 <= args.expires_in <= 3600:
                raise ValueError('Grant expiry must be between 1 and 3600 seconds')
            target = endpoint(args.endpoint)
            sys.path.insert(0, str(ROOT/'mcp-servers/jev-mcp'))
            from core import Ledger
            Ledger(data_dir).approve(args.digest, args.task, target, expires_in=args.expires_in)
            print('One-use scoped disclosure approval recorded. No evaluation was sent.')
        return 0
    except (ValueError, OSError, EOFError, sqlite3.Error, argparse.ArgumentTypeError) as error:
        # Neither credentials nor environment contents appear in errors.
        print('Jev settings failed: ' + str(error) if isinstance(error, (ValueError, argparse.ArgumentTypeError)) else 'Jev settings failed: '+type(error).__name__, file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
