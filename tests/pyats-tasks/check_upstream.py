"""Run the pinned pyATS SDK/HTTP fixtures without installing device SDKs."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('pyats_setup',ROOT/'scripts/setup-pyats-runtime.py')
setup=importlib.util.module_from_spec(spec);spec.loader.exec_module(setup)
with tempfile.TemporaryDirectory(prefix='netclaw-pyats-task-contract-') as temporary:
    source=Path(temporary)/'source'
    subprocess.run(['git','clone','--quiet','--no-checkout',setup.REPOSITORY,str(source)],check=True)
    subprocess.run(['git','-C',str(source),'checkout','--quiet','--detach',setup.REVISION],check=True)
    revision=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()
    assert revision==setup.REVISION
    print('Testing reviewed pyATS source:',revision,flush=True)
    subprocess.run([sys.executable,'-m','pytest','test_pyats_mcp_server.py','test_pyats_tasks.py','-q'],cwd=source,check=True)
