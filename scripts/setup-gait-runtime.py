#!/usr/bin/env python3
"""Build/verify a GAIT runtime before promotion; preserve an explicit rollback."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import uuid


def exists(path):
    return path.exists() or path.is_symlink()


def setup(target, python=sys.executable, restore=False, preview=False, rebuild=False):
    target = Path(target).expanduser().absolute()
    if target == Path(target.anchor) or target == Path.home() or target.name in ('', '.', '..'):
        raise ValueError('Refusing unsafe runtime destination')
    backup = target.with_name(target.name + '.previous')
    if preview:
        print('Preview:', 'restore saved runtime' if restore else 'verify current runtime or stage a replacement')
        print('Target:', target, '; recovery point:', backup)
        print('No files, packages or environment settings changed.')
        return
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if restore:
        if not exists(backup):
            raise ValueError('No previous runtime exists')
        retained = target.with_name(target.name + '.retained-' + uuid.uuid4().hex)
        had_target = exists(target)
        if had_target:
            target.rename(retained)
        try:
            backup.rename(target)
        except BaseException:
            if had_target:
                retained.rename(target)
            raise
        print('Previous runtime restored; replaced generation retained at:', retained)
        return
    if target.is_symlink() and (target / '.netclaw-gait-generation').is_file() and not rebuild:
        try:
            subprocess.run([str(target / 'bin/python'), '-c', "import gait, fastmcp; from importlib.metadata import version; assert version('fastmcp') == '4.0.11' and version('mcp') == '2.3.0'"], check=True)
        except subprocess.CalledProcessError:
            print('Managed runtime needs an upgrade; staging a replacement.')
        else:
            if (target / 'netclaw-source/mcp-servers/gait_mcp/gait_mcp.py').is_file():
                print('Current managed GAIT runtime verifies; unchanged. Use --rebuild for an explicit replacement.')
                return
    if exists(backup):
        raise ValueError('Previous runtime already retained; archive it deliberately before another rebuild')
    if exists(target) and not target.is_dir():
        raise ValueError('Existing runtime must be a directory or valid directory symlink')
    uv = shutil.which('uv')
    if not uv:
        raise ValueError('Install uv before creating the isolated GAIT runtime')
    # This is the final generation path: pip-generated scripts retain it.
    candidate = Path(tempfile.mkdtemp(prefix='.' + target.name + '-generation-', dir=target.parent))
    link = target.with_name('.' + target.name + '-promote-' + uuid.uuid4().hex)
    promoted = False
    try:
        subprocess.run([uv, 'venv', str(candidate), '--python', python], check=True)
        runtime_python = candidate / 'bin/python'
        subprocess.run([uv, 'pip', 'install', '--python', str(runtime_python),
                        'gait-ai', 'mcp==2.3.0', 'fastmcp==4.0.11'], check=True)
        subprocess.run([str(runtime_python), '-c', "import gait, fastmcp; from importlib.metadata import version; assert version('fastmcp') == '4.0.11' and version('mcp') == '2.3.0'"], check=True)
        # Bundle source with its interpreter: runtime rollback must also restore
        # the matching source, without rewriting the operator's checkout.
        root = Path(__file__).resolve().parents[1]
        source_root = candidate / 'netclaw-source'
        shutil.copytree(root / 'mcp-servers/gait_mcp', source_root / 'mcp-servers/gait_mcp',
                        ignore=shutil.ignore_patterns('.git', '.venv', '__pycache__', '*.pyc', '.env', '.env.*'))
        subprocess.run([sys.executable, str(root / 'scripts/apply-fastmcp-patches.py'),
                        '--root', str(source_root), '--component', 'gait'], check=True)
        subprocess.run([str(runtime_python), '-c',
                        "import sys, asyncio; sys.path.insert(0, sys.argv[1]); "
                        "from gait_mcp import mcp; "
                        "assert any(t.name == 'gait_log' for t in asyncio.run(mcp.list_tools()))",
                        str(source_root / 'mcp-servers/gait_mcp')], check=True)
        (candidate / '.netclaw-gait-generation').write_text('Verified GAIT generation; setup-gait-runtime.py\n')
        link.symlink_to(candidate, target_is_directory=True)
        had_target = exists(target)
        if had_target:
            target.rename(backup)
        try:
            os.replace(link, target)
        except BaseException:
            if had_target:
                backup.rename(target)
            raise
        promoted = True
        print('Verified isolated GAIT runtime ready:', target)
        if had_target:
            print('Previous runtime retained:', backup)
        print('No global Python packages changed. In-process importers need their own declared GAIT dependency.')
    finally:
        if link.is_symlink():
            link.unlink()
        if not promoted:
            # Only the candidate uniquely created above belongs to this invocation.
            shutil.rmtree(candidate)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--restore', action='store_true')
    parser.add_argument('--preview', action='store_true')
    parser.add_argument('--rebuild', action='store_true')
    parser.add_argument('--target', default=os.environ.get('GAIT_VENV', str(Path.home() / '.openclaw/gait-venv')))
    parser.add_argument('--python', default=os.environ.get('NETCLAW_PY', sys.executable))
    args = parser.parse_args()
    try:
        setup(args.target, args.python, args.restore, args.preview, args.rebuild)
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print('GAIT setup stopped:', type(exc).__name__, str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
