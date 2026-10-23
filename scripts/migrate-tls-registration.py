#!/usr/bin/env python3
"""Preview/apply/restore known legacy MCP TLS registrations; preserve credentials."""
import argparse
import importlib.util
import json
import os
from pathlib import Path

spec = importlib.util.spec_from_file_location('migration_helpers', Path(__file__).with_name('migrate-voice-auth.py'))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def migrate(path, repo, apply=False, restore=False):
    path = Path(path).absolute()
    backup = path.with_name(path.name + '.pre-tls-registration')
    helpers.regular_file(path)
    helpers.regular_file(backup)
    if restore:
        if not backup.is_file():
            raise ValueError('No retained original')
        helpers.restore_backup(path, backup, apply)
        print('Restored registration.' if apply else 'Preview: restore retained registration.')
        return
    original = path.read_bytes()
    data = json.loads(original)
    wrapper = Path(repo).absolute() / 'scripts/zabbix-stdio.py'
    if not wrapper.is_file():
        raise ValueError('Missing TLS-safe Zabbix launcher')
    changed = []
    for servers in (data.get('mcpServers', {}), data.get('mcp', {}).get('servers', {})):
        if not isinstance(servers, dict):
            raise ValueError('Invalid MCP registration')
        for name, key in [('redfish-mcp', 'REDFISH_VERIFY_TLS'), ('cml-mcp', 'CML_VERIFY_SSL')]:
            entry = servers.get(name, {})
            env = entry.get('env', {})
            if env.get(key) == '${' + key + ':-false}':
                env[key] = '${' + key + ':-true}'
                changed.append(name)
        entry = servers.get('zabbix-mcp')
        if entry:
            args = entry.get('args')
            if args == ['-m', 'zabbix_mcp_server.server']:
                entry['args'] = ['-u', str(wrapper)]
                changed.append('zabbix-mcp')
            elif args not in (['-u', str(wrapper)], ['-u', 'scripts/zabbix-stdio.py']):
                raise ValueError('Custom Zabbix launch command requires manual review')
    print(('Apply: ' if apply else 'Preview: ') + (', '.join(changed) or 'already current'))
    if not apply or not changed:
        return
    fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(original)
        stream.flush()
        os.fsync(stream.fileno())
    helpers.write_migrated(path, (json.dumps(data, indent=2) + '\n').encode(), backup)
    print('Saved private original and recovery journal. Restart affected MCPs; no provider contacted.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', default=str(Path.home() / '.openclaw/openclaw.json'))
    parser.add_argument('--repo', default=str(Path(__file__).resolve().parent.parent))
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--restore', action='store_true')
    args = parser.parse_args()
    try:
        migrate(args.config, args.repo, args.apply, args.restore)
    except (OSError, ValueError, TypeError, AttributeError):
        parser.exit(1, 'Migration refused; check registration shape, path, retained original and recovery conflicts. No credential values printed.\n')


if __name__ == '__main__':
    main()
