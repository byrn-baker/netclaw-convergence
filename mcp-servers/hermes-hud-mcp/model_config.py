"""Non-executable model configuration projected into the protected profile."""
import re
from urllib.parse import urlsplit
from ledger import HudError

MODES={'chat_completions','codex_responses','anthropic_messages'}


def protected_model(config):
    model=config.get('model') or {}
    if isinstance(model,str):return {'model':model}
    if not isinstance(model,dict):raise HudError('configuration_invalid')
    model={k:v for k,v in model.items() if k in ('default','model','provider','base_url','context_length','api_mode')}
    if 'api_mode' in model and model['api_mode'] not in MODES:raise HudError('capability_unsupported')
    result={'model':model}
    provider=model.get('provider','')
    if isinstance(provider,str) and provider.startswith('custom:'):
        name=provider[7:]
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}',name):raise HudError('configuration_invalid')
        entry=(config.get('providers') or {}).get(name)
        # Never copy commands, plugins, headers, literal API keys or alternate
        # model routers into the protected process.
        if not isinstance(entry,dict) or set(entry)-{'base_url','api_mode','default_model','key_env'}:raise HudError('capability_unsupported')
        try:
            url=urlsplit(entry['base_url'])
            if url.scheme not in ('http','https') or not url.hostname or url.username or url.password or url.query or url.fragment:raise ValueError()
            if entry.get('api_mode') not in MODES:raise ValueError()
            if 'key_env' in entry and entry['key_env'] not in ('NETCLAW_MODEL_API_KEY',):raise ValueError()
            if entry.get('default_model')!=model.get('default'):raise ValueError()
        except (KeyError,TypeError,ValueError):raise HudError('configuration_invalid')
        result['providers']={name:dict(entry)}
    return result
