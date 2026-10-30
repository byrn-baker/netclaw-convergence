"""Run with the pinned Specify environment after installing the preset."""
import hashlib
from importlib.metadata import version
import json
from pathlib import Path
import sys
import yaml
from specify_cli.presets import PresetResolver

def verify(workspace,preset,clients):
    if version('specify-cli')!='0.7.1':raise ValueError('specify_version_changed')
    manifest=yaml.safe_load((preset/'preset.yml').read_text());resolver=PresetResolver(workspace)
    checked=[]
    for entry in manifest['provides']['templates']:
        resolved=resolver.resolve_with_source(entry['name'],entry['type'])
        expected=hashlib.sha256((preset/entry['file']).read_bytes()).hexdigest()
        if not resolved or resolved['source']!='netclaw-claw v1.0.0' or hashlib.sha256(Path(resolved['path']).read_bytes()).hexdigest()!=expected:
            raise ValueError('effective_template_displaced')
        checked.append(entry['name'])
        if entry['type']=='command':
            name=entry['name'].removeprefix('speckit.')
            for client in clients:
                file=workspace/('.agents/skills/speckit-'+name+'/SKILL.md' if client=='codex' else '.claude/skills/speckit-'+name+'/SKILL.md' if client=='claude' else '.github/agents/speckit.'+name+'.agent.md')
                text=file.read_text()
                if 'NETCLAW_DEPLOYMENT_PRESET_153_V1' not in text or 'Native secret entry returns presence only' not in text:raise ValueError('client_command_displaced')
                if client=='copilot' and not (workspace/('.github/prompts/speckit.'+name+'.prompt.md')).is_file():raise ValueError('client_prompt_missing')
    return {'schema':1,'specify':'0.7.1','templates':len(checked),'clients':clients,'effective':True}

if __name__=='__main__':
    try:print(json.dumps(verify(Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3:])))
    except Exception:print('{"effective":false,"code":"preset_verification_failed"}');sys.exit(2)
