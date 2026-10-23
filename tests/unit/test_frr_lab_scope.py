import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def test_lab_setup_and_teardown_do_not_mutate_unrelated_bridges_or_routes(tmp_path):
    log = tmp_path / 'calls.jsonl'
    shim = '''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
name = Path(sys.argv[0]).name
args = sys.argv[1:]
with open(os.environ['FIXTURE_LOG'], 'a') as stream:
    stream.write(json.dumps([name, *args]) + '\\n')
if name == 'docker' and args[:2] == ['network', 'inspect']:
    print('0123456789abcdef')
elif name == 'docker' and args[:1] == ['inspect']:
    print('1234')
elif name == 'ip' and args[:4] == ['-o', 'link', 'show', 'type']:
    print('1: unrelated-production-bridge: <UP>')
elif name == 'ip' and args[:3] == ['-6', 'route', 'show']:
    print('fd00:dc:ee::/64 dev br-0123456789ab')
'''
    for name in ('ip', 'docker', 'nsenter'):
        path = tmp_path / name
        path.write_text(shim)
        path.chmod(0o700)
    env = {**os.environ, 'PATH': str(tmp_path) + ':' + os.environ['PATH'], 'FIXTURE_LOG': str(log)}
    for name in ('setup-gre.sh', 'teardown-gre.sh'):
        subprocess.run(['bash', str(ROOT / 'lab/frr-testbed/scripts' / name)], env=env,
                       capture_output=True, text=True, check=True)
    calls = [json.loads(line) for line in log.read_text().splitlines()]
    assert not any('unrelated-production-bridge' in call for call in calls)
    removals = [call for call in calls if call[:4] == ['ip', '-6', 'route', 'del']]
    assert len(removals) == 5
    assert all(call[-2:] == ['dev', 'gre-netclaw'] for call in removals)
