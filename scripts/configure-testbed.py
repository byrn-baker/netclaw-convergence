#!/usr/bin/env python3
"""Configure selected-runtime inventory policy without fetching or activating it."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from pyats_testbeds import policy, catalog, TestbedError
from setup_state import guarded_read

spec=importlib.util.spec_from_file_location('testbed_dotenv',ROOT/'scripts/write-env.py')
dotenv=importlib.util.module_from_spec(spec);spec.loader.exec_module(dotenv)


def configure(path,mode,sources,static_path=None):
    chosen=policy({'mode':mode,'sources':sources})
    path=Path(path).absolute()
    try:original=guarded_read(path,1024*1024).decode()
    except FileNotFoundError:original=''
    changes={'NETCLAW_TESTBED_MODE':chosen['mode'],'NETCLAW_TESTBED_SOURCES':','.join(chosen['sources']),
             'PYATS_MCP_DYNAMIC_ONLY':'1' if mode=='dynamic' else '0'}
    if mode=='static' and static_path is not None:
        if not Path(static_path).is_absolute() or any(c in static_path for c in '\r\n\0'):
            raise TestbedError('absolute_static_path_required')
        changes['PYATS_TESTBED_PATH']=static_path
    # Preserve credentials, comments and the operator's old static path. Dynamic
    # child launch unsets that path; returning to static is always explicit.
    lines=[line for line in original.splitlines() if not ((m:=dotenv.ASSIGNMENT.match(line.strip())) and m[1] in changes)]
    lines.extend(k+'='+dotenv.quote(v) for k,v in changes.items())
    dotenv.write_private(path,'\n'.join(lines)+'\n')
    return chosen


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env',type=Path)
    parser.add_argument('--mode',choices=['static','dynamic'])
    parser.add_argument('--sources',default='')
    parser.add_argument('--static-path')
    parser.add_argument('--list-sources',action='store_true')
    parser.add_argument('--show-mode',action='store_true')
    parser.add_argument('--show-path',action='store_true')
    parser.add_argument('--validate',action='store_true')
    args=parser.parse_args()
    try:
        if args.list_sources:
            for source in catalog():print(source['id']+' · '+source['label']+' · '+source['help'])
            return 0
        if args.show_mode or args.show_path:
            try:values=dotenv.values(guarded_read(args.env,1024*1024).decode())
            except FileNotFoundError:values={}
            print(values.get('NETCLAW_TESTBED_MODE','static') if args.show_mode else values.get('PYATS_TESTBED_PATH',''))
            return 0
        sources=args.sources.replace(',',' ').split()
        chosen=policy({'mode':args.mode,'sources':sources})
        if not args.validate:
            if not args.env:raise TestbedError('selected_runtime_env_required')
            configure(args.env,args.mode,sources,args.static_path)
        print(json.dumps(chosen))
        return 0
    except (ValueError,OSError,TypeError):
        print('Testbed policy not changed: check mode, source IDs and selected runtime path.',file=sys.stderr)
        return 1


if __name__=='__main__':raise SystemExit(main())
