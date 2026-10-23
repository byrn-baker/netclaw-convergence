#!/usr/bin/env python3
"""Preview/apply the spec-124 voice authentication configuration migration."""
import argparse
import hashlib
import json
import getpass
import os
from pathlib import Path
import re
import secrets
import shlex
import stat
import tempfile
from urllib.parse import urlsplit

KEYS = ('TWILIO_AUTH_TOKEN', 'VOICE_ALERT_TOKEN', 'VOICE_WEBHOOK_URL')
# Shared literal dotenv codec also accepts legacy shell-quoted assignments.
import importlib.util
_codec_spec = importlib.util.spec_from_file_location('netclaw_env_codec', Path(__file__).with_name('write-env.py'))
_codec = importlib.util.module_from_spec(_codec_spec)
_codec_spec.loader.exec_module(_codec)
ASSIGNMENT = _codec.ASSIGNMENT
values = _codec.values
quote = _codec.quote


def public_origin(value):
    url = urlsplit(value)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError('Public webhook URL must be HTTPS without credentials, query or fragment')
    _ = url.port  # validate port syntax/range
    return f'https://{url.netloc}'


def regular_file(path):
    if path.is_symlink() or (path.exists() and not stat.S_ISREG(path.stat().st_mode)):
        raise ValueError('Environment and backup paths must be regular files, not symlinks')


def write_atomic(path, data):
    fd, temporary = tempfile.mkstemp(prefix='.voice-auth-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def write_migrated(path, data, backup):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    journal = backup.with_name(backup.name + '.state.json')
    regular_file(journal)
    if journal.exists():
        raise ValueError('Recovery journal already exists; preserve and inspect it before reapplying')
    # Reserve the journal privately before changing any existing environment.
    descriptor = os.open(journal, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(json.dumps({'schema': 1, 'after_sha256': hashlib.sha256(data).hexdigest()}).encode())
        stream.flush()
        os.fsync(stream.fileno())
    write_atomic(path, data)


def restore_backup(path, backup, apply=False):
    regular_file(path)
    regular_file(backup)
    if not backup.is_file():
        raise ValueError('No migration backup')
    original = backup.read_bytes()
    current = path.read_bytes() if path.exists() else b''
    if current != original:
        journal = backup.with_name(backup.name + '.state.json')
        regular_file(journal)
        try:
            state = json.loads(journal.read_text())
        except (OSError, ValueError) as exc:
            raise ValueError('Legacy or missing recovery journal; compare backup and current file manually') from exc
        if (not isinstance(state, dict) or state.get('schema') != 1 or
                state.get('after_sha256') != hashlib.sha256(current).hexdigest()):
            raise ValueError('Environment changed after migration; preserve and merge later edits before restoring')
    if apply:
        write_atomic(path, original)


def migrate(path, public_url=None, apply=False, restore=False):
    path = Path(path).absolute()
    backup = path.with_name(path.name + '.pre-voice-auth')
    regular_file(path)
    regular_file(backup)
    original = path.read_bytes() if path.exists() else b''
    if restore:
        restore_backup(path, backup, apply)
        if not apply:
            print('Preview: restore the saved environment file; no writes performed.')
            return
        print('Environment restored with mode 0600. Restart the secured webhook service.')
        return
    text = original.decode('utf-8')
    current = values(text)
    origin_value = public_url or current.get('VOICE_WEBHOOK_URL') or current.get('TWILIO_WEBHOOK_URL')
    origin = public_origin(origin_value) if origin_value else None
    missing = [key for key in KEYS if not current.get(key)]
    print('Missing settings: ' + (', '.join(missing) or 'none'))
    if not current.get('OPENCLAW_GATEWAY_TOKEN'):
        print('OPENCLAW_GATEWAY_TOKEN also needs local configuration; shared fallback credentials are no longer used.')
    if not apply:
        print('Preview only. Apply preserves unrelated settings, creates a private backup, and writes mode 0600.')
        return
    if not origin: raise ValueError('Provide --public-url https://HOST before applying')
    auth_token = current.get('TWILIO_AUTH_TOKEN') or os.environ.get('TWILIO_AUTH_TOKEN')
    if not auth_token:
        auth_token = getpass.getpass('Twilio account Auth Token (hidden): ')
    alert_token = current.get('VOICE_ALERT_TOKEN') or secrets.token_urlsafe(32)
    updates = dict(zip(KEYS, (auth_token, alert_token, origin)))
    if any(not value or '\n' in value or '\r' in value for value in updates.values()):
        raise ValueError('Authentication settings must be nonempty single-line values')
    if all(current.get(key) == value for key, value in updates.items()):
        os.chmod(path, 0o600)
        print('Configuration already migrated; values and file contents unchanged.')
        return
    changed = set(key for key, value in updates.items() if current.get(key) != value)
    lines = []
    for line in text.splitlines(keepends=True):
        match = ASSIGNMENT.match(line.strip())
        if match and match[1] in changed: continue
        lines.append(line)
    new_text = ''.join(lines)
    if new_text and not new_text.endswith('\n'): new_text += '\n'
    new_text += '\n# Voice authentication migration (spec 124)\n'
    new_text += ''.join(f'{key}={quote(updates[key])}\n' for key in KEYS if key in changed)
    if path.exists():
        # Exclusive creation prevents replacing a prior recovery point.
        fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(original)
            stream.flush()
            os.fsync(stream.fileno())
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    write_migrated(path, new_text.encode(), backup)
    print('Applied. Secrets were not printed. Keep the private backup; restart the webhook service.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', default='.env')
    parser.add_argument('--public-url')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--restore', action='store_true')
    args = parser.parse_args()
    try:
        migrate(args.env_file, args.public_url, args.apply, args.restore)
    except (OSError, ValueError, EOFError) as error:
        # Do not echo values from parsing or filesystem errors.
        print(f'Migration stopped ({type(error).__name__}). No secret values were printed.')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
