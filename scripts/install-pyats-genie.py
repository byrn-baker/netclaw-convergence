#!/usr/bin/env python3
"""Install an isolated, user-owned Genie runtime. No device/network CLI access."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import venv

MARKER = '.netclaw-pyats-installer.json'
DEFAULT_VERSION = '26.8'
SMOKE_TEST = r"""
import contextlib, io, json
from importlib.metadata import version
with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
    from genie.conf.base import Device
    def offline(*args, **kwargs):
        raise RuntimeError('Network operations are forbidden in this test')
    device = Device(name='synthetic-install-check', os='iosxe')
    device.connect = device.execute = device.configure = offline
    data = device.parse('show ip interface brief', output='''Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0      192.0.2.1       YES manual up                    up
Loopback0              198.51.100.1    YES manual up                    up
''')
    encoded = json.dumps(data, allow_nan=False)
    assert isinstance(data, dict) and data and '192.0.2.1' in encoded
print(json.dumps({'pyats': version('pyats'), 'genie': version('genie'), 'parser': version('genie.libs.parser'), 'synthetic_parse': 'passed'}))
"""


def clean_environment():
    # Do not inherit another virtualenv or Python module search overrides.
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(('PYTHON', 'PIP_')) and k != 'VIRTUAL_ENV'}
    env['PYTHONNOUSERSITE'] = '1'
    env['PIP_CONFIG_FILE'] = os.devnull
    return env


def run(arguments, capture=False):
    return subprocess.run(arguments, check=True, text=True, env=clean_environment(),
                          capture_output=capture, timeout=120 if capture else 1800)


def smoke(python):
    result = json.loads(run([str(python), '-I', '-c', SMOKE_TEST], capture=True).stdout)
    if result.get('synthetic_parse') != 'passed':
        raise RuntimeError('Genie did not pass the synthetic parser check.')
    return result


def check_platform():
    if sys.platform not in ('linux', 'darwin'):
        raise RuntimeError('Native Windows pyATS is not supported. Run this script in an existing Linux/WSL or macOS Python environment. On Windows, use Install-NetClaw-pyATS.ps1. No Windows features will be enabled automatically.')
    if sys.version_info < (3, 10):
        raise RuntimeError('Use Python 3.10 or newer with available pyATS wheels (Python 3.12 is a suitable starting point).')


def target_path(value):
    path = Path(value).expanduser().absolute()
    if path.is_symlink():
        raise RuntimeError('Choose a real directory, not a symlink, for the managed environment.')
    path = path.resolve()
    if path in (Path(path.anchor), Path.home().resolve(), Path.cwd().resolve()):
        raise RuntimeError('Choose a dedicated subdirectory for the environment, not a root, home, or working directory.')
    return path


def is_managed(target):
    try:
        marker = target / MARKER
        if marker.is_symlink():
            return False
        return json.loads(marker.read_text()) == {'owner': 'netclaw-pyats-installer', 'format': 1}
    except (OSError, ValueError):
        return False


def install(args):
    check_platform()
    target = target_path(args.venv)
    python = target / 'bin' / 'python'
    if args.check_only:
        if not (target / 'pyvenv.cfg').is_file() or not python.is_file():
            raise RuntimeError(f'No Python virtual environment found at {target}. Nothing was installed.')
        result = smoke(python)
    else:
        if target.exists() and not is_managed(target):
            raise RuntimeError(f'Refusing to modify existing unmanaged directory: {target}. Choose a new --venv path, or use --check-only to validate an existing virtualenv.')
        print(f'Python: {sys.executable}\nEnvironment: {target}\nPackages: pyats[full]=={args.version}, genie=={args.version}', flush=True)
        print('Downloads packages from PyPI into this environment only. No sudo, router connections, OS features, or NetClaw settings changes.', flush=True)
        if not args.yes and (not sys.stdin.isatty() or input('Install/repair this dedicated environment? [y/N] ').strip().lower() != 'y'):
            raise RuntimeError('Installation cancelled. Use --yes for an explicitly approved unattended installation.')
        result = None
        if python.is_file() and (target / 'pyvenv.cfg').is_file() and not args.upgrade:
            try:
                result = smoke(python)
                if any(result.get(key) != args.version for key in ('pyats', 'genie')):
                    raise RuntimeError('This environment has another release. Use --upgrade to explicitly change it, or choose a new --venv directory.')
            except (subprocess.SubprocessError, ValueError):
                result = None
        if result is None or args.upgrade:
            target.mkdir(parents=True, exist_ok=True)
            if not (target / MARKER).exists():
                with (target / MARKER).open('x') as marker:
                    json.dump({'owner': 'netclaw-pyats-installer', 'format': 1}, marker)
            print('[1/3] Preparing virtual environment…', flush=True)
            if not python.is_file() or not (target / 'pyvenv.cfg').is_file():
                venv.EnvBuilder(with_pip=True).create(target)
            print('[2/3] Installing pyATS and Genie (this may take several minutes)…', flush=True)
            pip = [str(python), '-I', '-m', 'pip', '--isolated', '--disable-pip-version-check']
            run(pip + ['install', '--no-user', '--prefix', str(target), '--index-url', 'https://pypi.org/simple', '--upgrade', 'pip'])
            run(pip + ['install', '--no-user', '--prefix', str(target), '--index-url', 'https://pypi.org/simple',
                       f'pyats[full]=={args.version}', f'genie=={args.version}'])
            run(pip + ['check'])
            print('[3/3] Verifying an offline Genie parse with synthetic data…', flush=True)
            result = smoke(python)
    print('READY: ' + json.dumps(result), flush=True)
    print(f'PYATS_PYTHON="{python}"', flush=True)
    print('Use this path only where that environment is reachable. A Windows API can use a WSL path; a remote VM additionally needs a parser transport (not provided by this installer).', flush=True)
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--venv', default=str(Path.home() / '.netclaw' / 'pyats-venv'))
    parser.add_argument('--version', default=DEFAULT_VERSION, help='Exact pyATS/Genie release (default: %(default)s)')
    parser.add_argument('--yes', action='store_true', help='Approve package installation without a prompt')
    parser.add_argument('--upgrade', action='store_true', help='Explicitly allow changing the managed environment release')
    parser.add_argument('--check-only', action='store_true', help='Validate an existing environment without installing anything')
    args = parser.parse_args(argv)
    if not re.fullmatch(r'\d+\.\d+(?:\.\d+)?', args.version):
        parser.error('--version must be an exact numeric release, for example 26.8')
    try:
        return install(args)
    except (OSError, RuntimeError, subprocess.SubprocessError, ValueError) as error:
        print(f'NOT READY: {error}', file=sys.stderr)
        print('No system packages were changed. A partial managed environment is retained for retry. For a missing venv/ensurepip module, ask your administrator to install the matching Python venv support.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
