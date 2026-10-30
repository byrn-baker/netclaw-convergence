#!/usr/bin/env python3
"""Private engine-to-child certificate transport; never a terminal key printer."""
import argparse
import importlib.metadata
import os
from pathlib import Path
import stat
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_schema import loads,canonical
from setup_state import guarded_read

def main():
    parser=argparse.ArgumentParser();parser.add_argument('operation',choices=['generate-private','observe']);parser.add_argument('--record',type=Path,required=True)
    args=parser.parse_args();os.umask(0o077)
    if importlib.metadata.version('cryptography')!='46.0.5':return 8
    binding=loads(guarded_read(args.record,16384,private=True));home=Path(binding['home'])
    if args.record!=home/'.setup/certificate-input.json' or ROOT!=home/'.setup/source':return 8
    from setup_certificate_material import generate,validate
    if args.operation=='generate-private':
        # This pipe belongs to the engine's bounded in-memory capture. Refuse
        # terminals and redirected files; raw material never becomes an event.
        if not stat.S_ISFIFO(os.fstat(sys.stdout.fileno()).st_mode):return 8
        result=generate(binding)
    else:
        value=loads(guarded_read(home/'.setup/claw-certificate.json',65536,private=True))
        validate(value,binding);result={'schema':1,'valid':True}
    sys.stdout.buffer.write(canonical(result));sys.stdout.buffer.flush();return 0

if __name__=='__main__':
    try:sys.exit(main())
    except Exception:sys.exit(8)
