import importlib.util
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('literal_writer', ROOT / 'scripts/write-env.py')
writer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(writer)


def test_setup_prompts_never_evaluate_and_env_round_trips(tmp_path):
    source = (ROOT / 'scripts/setup.sh').read_text()
    helpers = source[source.index('prompt() {'):source.index('section() {')]
    sentinel = tmp_path / 'executed'
    value = f'literal $(touch {sentinel}) & pipe| apostrophe\' quote"x" dollar$ slash\\ tail'
    envfile = tmp_path / '.env'
    envfile.write_text('TEST_TOKEN=previous\nUNRELATED=keep\n')
    script = 'set -eu\nsource scripts/lib/common.sh\nRUNTIME_ENV="$FIXTURE_ENV"\nOPENCLAW_ENV="$FIXTURE_ENV"\n' + helpers + '\nprompt_secret TOKEN label\nset_env TEST_TOKEN "$TOKEN"\n'
    proc = subprocess.run(['bash', '-c', script], cwd=ROOT, env={**os.environ,'FIXTURE_ENV':str(envfile)}, input=value+'\n',text=True,capture_output=True)
    assert not sentinel.exists()
    assert proc.returncode == 0, proc.stderr
    assert writer.values(envfile.read_text()) == {'UNRELATED':'keep','TEST_TOKEN':value}
    assert envfile.stat().st_mode & 0o777 == 0o600
