#!/usr/bin/env python3
"""Fixed scoped setup enrollment/observation helper; no provider requests."""
import argparse
import json
import os
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts/lib'),str(ROOT/'mcp-servers/protocol-mcp')]
from setup_state import guarded_read
from setup_schema import loads
from setup_enrollment import materialize,observe

def main():
    parser=argparse.ArgumentParser();parser.add_argument('operation',choices=['materialize','observe']);parser.add_argument('--record',type=Path,required=True)
    args=parser.parse_args();os.umask(0o077)
    record=loads(guarded_read(args.record,65536,private=True))
    if args.record!=Path(record['claw']['runtimeHome'])/'.setup/risk-input.json':raise ValueError()
    ok=(materialize if args.operation=='materialize' else observe)(record)
    print(json.dumps({'schema':1,'enrolled':ok}));return 0 if ok else 8

if __name__=='__main__':
    try:sys.exit(main())
    except Exception:sys.exit(8)
