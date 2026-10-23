"""Local-only triage. Never executes skills/servers or emits credential values."""
import ast
from collections import Counter, defaultdict
import importlib.util
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys
import yaml

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
paths = subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')
tools = defaultdict(list)
parse_errors = []
scanned = []
spec = importlib.util.spec_from_file_location('local_mcp_scan', ROOT/'scripts/scan-all-mcp-source.py')
scan = importlib.util.module_from_spec(spec);sys.modules[spec.name]=scan;spec.loader.exec_module(scan)
triage = []
for relative in paths:
    if not relative.startswith('mcp-servers/') or not relative.endswith('.py'): continue
    path = ROOT/relative
    scanned.append(relative)
    for finding in scan.scan_file(path):
        triage.append({'path':relative,'line':finding.line_num,'rule':finding.rule_id,'candidate_severity':finding.severity})
    try: tree=ast.parse(path.read_text())
    except Exception as exc:
        parse_errors.append({'path':relative,'error_type':type(exc).__name__});continue
    for node in ast.walk(tree):
        if not isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)):continue
        decorators=[ast.unparse(d) for d in node.decorator_list]
        if not any(re.search(r'\.tool(?:\(|$)',d) for d in decorators):continue
        name=node.name
        for d in node.decorator_list:
            if isinstance(d,ast.Call):
                for kw in d.keywords:
                    if kw.arg=='name' and isinstance(kw.value,ast.Constant):name=kw.value.value
        args=node.args
        all_args=args.posonlyargs+args.args
        required=[a.arg for a in all_args[:len(all_args)-len(args.defaults)]]
        required += [a.arg for a,d in zip(args.kwonlyargs,args.kw_defaults) if d is None]
        tools[name].append({'path':relative,'line':node.lineno,'parameters':[a.arg for a in all_args+args.kwonlyargs], 'required':required,'kwargs':args.kwarg is not None})
skills=[]
for relative in paths:
    if not relative.startswith('workspace/skills/') or not relative.endswith('/SKILL.md'):continue
    text=(ROOT/relative).read_text()
    report={'path':relative,'frontmatter_errors':[],'literal_tool_examples':[],'schema_candidates':[]}
    m=re.match(r'^---\s*\n(.*?)\n---\s*\n',text,re.S)
    if not m:report['frontmatter_errors'].append('missing frontmatter')
    else:
        try:
            front=yaml.safe_load(m.group(1))
            for key in ('name','description'):
                if not isinstance(front,dict) or not front.get(key):report['frontmatter_errors'].append(f'missing {key}')
        except yaml.YAMLError: report['frontmatter_errors'].append('invalid YAML')
    for line in text.replace('\\\n',' ').splitlines():
        if '$MCP_CALL' not in line:continue
        try: parts=shlex.split(line)
        except ValueError:continue
        if len(parts)<5 or parts[1] not in ('$MCP_CALL','${MCP_CALL}'):continue
        tool=parts[3]
        try:arguments=json.loads(parts[4])
        except (json.JSONDecodeError,TypeError):continue
        if not isinstance(arguments,dict):continue
        report['literal_tool_examples'].append(tool)
        definitions=tools.get(tool,[])
        if len(definitions)!=1:continue # transport/upstream/dynamic contracts need manual inspection
        definition=definitions[0]
        missing=set(definition['required'])-arguments.keys()
        extra=set(arguments)-set(definition['parameters']) if not definition['kwargs'] else set()
        if missing or extra:
            report['schema_candidates'].append({'tool':tool,'definition':definition['path'],'missing':sorted(missing),'unexpected':sorted(extra)})
    skills.append(report)
report={'limitations':['Regex security hits are unconfirmed candidates, not vulnerabilities.','Static tool extraction omits dynamic/external schemas; absence is not a defect.','No semantic or live review completion is implied.'], 'mcp_files_scanned':scanned,'python_parse_errors':parse_errors,'security_candidates':triage,'static_tool_definitions':tools,'skills':skills}
(OUT/'skill-mcp-static-review.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'mcp_python_files':len(scanned),'static_tool_names':len(tools),'skills':len(skills),'python_parse_errors':parse_errors,'frontmatter_errors':[s for s in skills if s['frontmatter_errors']],'schema_candidates':[s for s in skills if s['schema_candidates']],'security_candidate_rules':dict(Counter(f['rule'] for f in triage))},indent=2))
