#!/usr/bin/env python3
"""Audit explicit task adoption, exact dependencies and recorded real catalogs."""
import argparse
import ast
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]


def contract(value):
    # Descriptive metadata can depend on optional docstring parser versions.
    # Keep every structural input/output/schema and annotation field.
    if isinstance(value, dict):
        return {k:contract(v) for k,v in value.items() if k not in ('description','title')}
    if isinstance(value, list):return [contract(v) for v in value]
    return value


def audit(root=ROOT, catalogs=None):
    failures=[]
    manifest=json.loads((root/'config/mcp-task-tools.json').read_text())
    baseline=json.loads((root/'specs/141-fastmcp-stateless-upgrade/upgraded-catalogs.json').read_text())
    names=[row['server'] for row in manifest['servers']]
    if len(names)!=len(set(names)) or set(names)!=set(baseline):
        failures.append('Owned server inventory differs from framework migration baseline')
    files=subprocess.check_output(['git','-C',str(root),'ls-files','mcp-servers'],text=True).splitlines()
    for row in manifest['servers']:
        server=row['server']; selected={t['name'] for t in row['tools'] if t['task']}
        if {t['name'] for t in row['tools']}!={t['name'] for t in baseline[server]['tools']}:
            failures.append(server+': tool disposition inventory differs')
        if bool(selected)!=(row['status']=='enabled'):
            failures.append(server+': inconsistent task disposition')
        if selected:
            directory=root/'mcp-servers'/server
            deps='\n'.join(p.read_text() for p in (directory/'requirements.txt',directory/'pyproject.toml') if p.exists())
            if 'fastmcp-tasks==4.0.11' not in deps:failures.append(server+': extension dependency missing')
            extensions=[]
            for file in files:
                if not file.startswith('mcp-servers/'+server+'/') or not file.endswith('.py') or '/vendor/' in file:continue
                tree=ast.parse((root/file).read_text())
                extensions.extend(n for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='TasksExtension')
            if len(extensions)!=1:failures.append(server+': expected one extension registration')
            else:
                keywords={k.arg:ast.literal_eval(k.value) for k in extensions[0].keywords}
                if keywords.get('name')!='netclaw-'+server or keywords.get('concurrency')!=1:
                    failures.append(server+': queue identity or concurrency changed; review acceptance')
        if catalogs is not None:
            actual=catalogs.get(server,{})
            if actual.get('status')!='pass':failures.append(server+': real discovery did not pass');continue
            if set(actual.get('task_tools',[]))!=selected:failures.append(server+': runtime task eligibility differs')
            if contract(actual['tools'])!=contract(baseline[server]['tools']):failures.append(server+': modern catalog differs from pre-task baseline')
    return failures


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalogs',type=Path,help='fresh check-fastmcp-compat.py JSON evidence')
    args=parser.parse_args()
    failures=audit(catalogs=json.loads(args.catalogs.read_text()) if args.catalogs else None)
    for item in failures:print('FAIL:',item)
    print('Tasks adoption:', 'FAIL' if failures else 'PASS')
    return bool(failures)


if __name__=='__main__':raise SystemExit(main())
