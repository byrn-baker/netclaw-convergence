#!/usr/bin/env python3
"""Build the helper in upstream's pinned graph; no installed chunk-name imports.

The supplied checkout is a dedicated private build input with frozen pnpm
dependencies already acquired. It must not be a running/source-development
checkout. Build output remains local; this command does not publish a package.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess

PIN='0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c'
HERE=Path(__file__).resolve().parent

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True)
    parser.add_argument('--pnpm',type=Path,required=True);args=parser.parse_args()
    source=args.source.resolve();os.umask(0o077)
    if subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()!=PIN:raise ValueError('source pin')
    if subprocess.check_output(['git','-C',str(source),'diff','--name-only']).strip():raise ValueError('source changed')
    config=source/'tsdown.config.ts';original=config.read_bytes()
    marker=b'function buildCoreDistEntries(): Record<string, string> {\n  return {'
    if original.count(marker)!=1:raise ValueError('build graph changed')
    files={source/'src/netclaw-comms-helper.ts':(HERE/'entry.ts').read_bytes(),
           source/'src/netclaw-comms-acquire.ts':(HERE/'acquire.ts').read_bytes(),
           source/'src/netclaw-comms-register.ts':(HERE/'register.ts').read_bytes(),
           source/'src/netclaw-comms-contract.mjs':(HERE/'contract.mjs').read_bytes()}
    if any(p.exists() or p.is_symlink() for p in files):raise ValueError('build entry occupied')
    changed=original.replace(marker,marker+b'\n    "netclaw-comms-helper": "src/netclaw-comms-helper.ts",\n    "netclaw-comms-acquire": "src/netclaw-comms-acquire.ts",\n    "netclaw-comms-register": "src/netclaw-comms-register.ts",')
    try:
        for p,data in files.items():p.write_bytes(data)
        config.write_bytes(changed)
        env={**os.environ,'OPENCLAW_RUN_NODE_SKIP_DTS_BUILD':'1','NODE_ENV':'production'}
        subprocess.run([str(args.pnpm),'exec','tsdown'],cwd=source,env=env,check=True)
        # The graph alone omits plugin manifests and SDK compatibility aliases.
        # Use the pin's own postbuild before testing/packing the helper.
        subprocess.run(['node','scripts/runtime-postbuild.mjs'],cwd=source,env=env,check=True)
        output=source/'dist/netclaw-comms-helper.js'
        if not output.is_file():raise ValueError('helper artifact missing')
        evidence={'schema':1,'upstreamCommit':PIN,'hostVersion':'2026.7.1-2',
            'helperSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
            'acquireSha256':hashlib.sha256((source/'dist/netclaw-comms-acquire.js').read_bytes()).hexdigest(),
            'registerSha256':hashlib.sha256((source/'dist/netclaw-comms-register.js').read_bytes()).hexdigest(),
            'inputSha256':hashlib.sha256(b''.join(files.values())).hexdigest()}
        (source/'dist/netclaw-comms-build.json').write_text(json.dumps(evidence,indent=2)+'\n')
    finally:
        if config.read_bytes()==changed:config.write_bytes(original)
        for p,data in files.items():
            if p.exists() and p.read_bytes()==data:p.unlink()

if __name__=='__main__':main()
