#!/usr/bin/env python3
"""Pinned, passive, selected-platform inspection. No gateway or account setup.

The installer owns typed writes and pairing effects separately. This helper
never calls a plugin's installer, adapter factory, setup_fn or is_connected.
"""
import contextlib
import hashlib
import io
import importlib.metadata
import importlib
import json
import os
from pathlib import Path
import stat
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts/lib'))
from setup_comms_hermes import CONTRACTS, hydrate, SDK_CHANNELS

PIN='818c13be1dc4fd28987e1e881a9408224afd4535'
PLUGINS=frozenset(('telegram','discord','slack','google_chat','whatsapp','sms','email',
    'mattermost','matrix','dingtalk','feishu','wecom','photon','teams','line','ntfy','simplex','raft','irc','buzz','homeassistant'))
ALIASES={'wecom_callback':'wecom'}
BUILTINS={'whatsapp_cloud':'whatsapp_cloud','signal':'signal','weixin':'weixin',
          'bluebubbles':'bluebubbles','qqbot':'qqbot','yuanbao':'yuanbao'}
CANONICAL={record['native']:channel for channel,record in CONTRACTS.items()}


def locked_dependencies(channel,manifest_path):
    """Observe every applicable exact dependency pin without lazy installation."""
    from packaging.requirements import Requirement
    requirements=Path(__file__).resolve().parent/'hermes'/(channel+'.txt')
    lock=read_file(requirements,1024*1024)
    comms=json.loads(read_file(manifest_path.parent/'components/comms.json',4*1024*1024))
    record=next(e for e in comms['entries'] if e['id']=='hermes-'+channel)
    if not record['setup']['dependencies'] or record['setup']['dependencies'][0]['integrity']!='sha256-'+hashlib.sha256(lock).hexdigest():
        return False
    for line in lock.decode().splitlines():
        if not line or line[0].isspace() or line.startswith('#'):continue
        requirement=Requirement(line.removesuffix('\\').strip())
        if requirement.marker and not requirement.marker.evaluate():continue
        try:version=importlib.metadata.version(requirement.name)
        except importlib.metadata.PackageNotFoundError:return False
        if not requirement.specifier.contains(version,prereleases=True):return False
    return True


def read_file(path,limit=8*1024*1024,private=False):
    if path.resolve()!=path:raise ValueError('aliased_input')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        info=os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size>limit or info.st_uid!=os.getuid() or private and info.st_mode&0o077:
            raise ValueError('invalid_input')
        with os.fdopen(fd,'rb',closefd=False) as stream:return stream.read(limit+1)
    finally:os.close(fd)


def inspect(channel,mode):
    if mode not in ('inspect','readback') or channel not in PLUGINS|ALIASES.keys()|BUILTINS.keys():raise ValueError('scope')
    home=Path(os.environ['HERMES_HOME'])
    if not home.is_absolute() or home.resolve()!=home or home.stat().st_mode&0o077:raise ValueError('private_home')
    marker=json.loads(read_file(home/'.netclaw-setup-owner.json',16384,True))
    if not marker.get('runId') or not marker.get('installationId'):raise ValueError('owner')
    # Derive the installed source from the selected private interpreter, never
    # an input module path or the operator's default Hermes installation.
    source=Path(sys.executable).parents[2]/'source'
    manifest_path=Path(__file__).resolve().parents[2]/'config/hermes-hud-compatibility.json'
    compatibility=json.loads(read_file(manifest_path,4*1024*1024))
    if compatibility['revision']!=PIN or compatibility['release']!='v0.21.6':raise ValueError('pin')
    for relative,digest in compatibility['files'].items():
        path=source/relative
        if not path.is_relative_to(source) or '..' in Path(relative).parts or hashlib.sha256(read_file(path)).hexdigest()!=digest:
            raise ValueError('source_changed')
    selected_sources=json.loads(read_file(Path(__file__).resolve().parent/'hermes/platform-sources.json',1024*1024))
    if selected_sources.get('source')!=PIN:raise ValueError('platform_source_pin')
    for relative,digest in selected_sources['plugins'].get(ALIASES.get(channel,channel),{}).items():
        path=source/relative
        if not path.is_relative_to(source) or '..' in Path(relative).parts or hashlib.sha256(read_file(path)).hexdigest()!=digest:
            raise ValueError('platform_source_changed')
    # This is an inspection process, not a sandbox for an interactive wizard.
    # Passive probes may import SDKs, but cannot install, connect, listen or
    # persist backups. The process exits after returning bounded metadata.
    def audit(event,args):
        if event in ('socket.bind','socket.connect','subprocess.Popen','os.system','os.mkdir','os.remove','os.rename'):
            raise PermissionError('effect_refused_during_inspection')
        if event=='open':
            mode,flags=args[1:3]
            if isinstance(mode,str) and any(c in mode for c in 'wax+') or isinstance(flags,int) and flags&(os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC):
                raise PermissionError('write_refused_during_inspection')
    sys.dont_write_bytecode=True
    sys.addaudithook(audit)
    # Resolve the verified sibling source before editable-install finders. An
    # interpreter copied for an isolated test must not import another home's
    # checkout merely because an old editable finder still names that path.
    sys.path.insert(0,str(source))
    from hermes_cli.config import require_readable_config_before_write
    from hermes_cli.plugins_discovery import suppress_plugin_discovery,gate_manifest
    config_path=home/'config.yaml'
    read_file(config_path,4*1024*1024,True)
    raw=require_readable_config_before_write(config_path)
    result={'schema':1,'channel':channel,'source':PIN,'adapter':False,'configured':False,
            'dependencies':False,'requiredSettings':[],'nativeSetup':False}
    with suppress_plugin_discovery():
        from gateway.config import PlatformConfig
        selected=raw.get('platforms',{}).get(channel,{})
        parsed=PlatformConfig.from_dict(selected)
        if channel in BUILTINS:
            if channel=='whatsapp_cloud':
                from gateway.platforms.whatsapp_cloud import check_whatsapp_cloud_requirements
                from gateway.config import Platform,_PLATFORM_CONNECTED_CHECKERS
                required=['WHATSAPP_CLOUD_PHONE_NUMBER_ID','WHATSAPP_CLOUD_ACCESS_TOKEN',
                    'WHATSAPP_CLOUD_APP_SECRET','WHATSAPP_CLOUD_VERIFY_TOKEN']
                result.update(adapter=True,dependencies=bool(check_whatsapp_cloud_requirements()),requiredSettings=required)
                if mode=='readback':
                    parsed.extra.update(phone_number_id=os.environ.get(required[0]),access_token=os.environ.get(required[1]))
                    # Upstream's checker establishes local fields only; it
                    # must never be represented as a connected channel.
                    result['configured']=bool(parsed.enabled and all(os.environ.get(k) for k in required) and
                        _PLATFORM_CONNECTED_CHECKERS[Platform.WHATSAPP_CLOUD](parsed) and
                        parsed.extra.get('dm_policy')=='allowlist' and parsed.extra.get('group_policy')=='disabled' and
                        parsed.extra.get('webhook_host')=='127.0.0.1')
                return result
            probes={'signal':('signal','check_signal_requirements'),'weixin':('weixin','check_weixin_requirements'),
                'bluebubbles':('bluebubbles','check_bluebubbles_requirements'),'qqbot':('qqbot','check_qq_requirements')}
            module=importlib.import_module('gateway.platforms.'+channel)
            deps=bool(getattr(module,probes[channel][1])()) if channel in probes else bool(module.WEBSOCKETS_AVAILABLE)
            canonical=CANONICAL[channel]
            result.update(adapter=True,dependencies=deps,requiredSettings=[f[0] for f in CONTRACTS[canonical]['fields'] if f[3]])
            if canonical in SDK_CHANNELS and deps:result['dependencies']=locked_dependencies(canonical,manifest_path)
            if mode=='readback':
                from gateway.config import Platform,_PLATFORM_CONNECTED_CHECKERS
                checked=hydrate(canonical,selected,os.environ,home=home)
                result['configured']=bool(checked and _PLATFORM_CONNECTED_CHECKERS[Platform(channel)](PlatformConfig.from_dict(checked)))
            return result
        from hermes_cli.plugins_manifest import parse_manifest_file,manifest_key,requires_hermes_error
        from hermes_cli.plugins import PluginManager
        from gateway.platform_registry import platform_registry
        external=channel=='homeassistant'
        if external:
            from setup_comms_hermes_native import observe_homeassistant
            if not observe_homeassistant(home,Path(__file__).resolve().parents[2]):return result
        directory=home/'plugins/homeassistant' if external else source/'plugins/platforms'/ALIASES.get(channel,channel)
        manifest=parse_manifest_file(directory/'plugin.yaml',directory,'user' if external else 'bundled','' if external else 'platforms')
        if (not manifest or manifest.kind!='platform' or Path(manifest.path)!=directory or
            manifest_key(manifest)!=('homeassistant' if external else 'platforms/'+directory.name) or requires_hermes_error(manifest)):raise ValueError('manifest')
        settings=raw.get('plugins',{})
        verdict=gate_manifest(manifest,set(settings.get('disabled',[])),set(settings['enabled']) if 'enabled' in settings else None)
        if verdict.action!=('load' if external else 'defer'):raise ValueError('plugin_disabled')
        manager=PluginManager(scope_key=str(home))
        if external:
            # The native isolation policy's default config reader initializes
            # home directories/backups. Pass the already validated selected
            # config to that exact native policy instead; host isolation is
            # still honored (and subprocess creation refused by the audit).
            from hermes_cli import plugin_isolation
            native_policy=plugin_isolation.isolation_mode
            plugin_isolation.isolation_mode=lambda config=None: native_policy(raw if config is None else config)
            try:manager._load_plugin(manifest)
            finally:plugin_isolation.isolation_mode=native_policy
        else:manager._load_plugin(manifest)
        loaded=manager.list_plugins()
        if len(loaded)!=1 or loaded[0].get('key')!=manifest_key(manifest) or loaded[0].get('error'):raise ValueError('selected_plugin_failed')
        entry=platform_registry.get(channel)
        if not entry or entry.name!=channel or entry.plugin_name!=manifest.name:raise ValueError('selected_registration')
        allowed={channel,'wecom','wecom_callback'} if directory.name=='wecom' else {channel}
        if not manager._plugin_platform_names<=allowed:raise ValueError('unselected_platform')
        result.update(adapter=True,dependencies=bool(entry.check_fn()),
            requiredSettings=[k for k in entry.required_env if isinstance(k,str)],nativeSetup=entry.setup_fn is not None)
        if channel=='sms':
            # Upstream check_fn mixes dependency presence with credentials.
            # Report those independently without constructing its adapter.
            result['dependencies']=bool(entry.check_fn.__globals__.get('AIOHTTP_AVAILABLE')) and importlib.metadata.version('aiohttp')=='3.14.4'
        # These upstream passive gates include credentials or permission to
        # install. Dependency presence is a different observation.
        if channel in ('email','irc'):result['dependencies']=True
        if channel=='ntfy':result['dependencies']=bool(entry.check_fn.__globals__.get('HTTPX_AVAILABLE'))
        if channel=='simplex':
            try:importlib.import_module('websockets');result['dependencies']=True
            except ImportError:result['dependencies']=False
        if channel in ('photon','whatsapp','raft'):
            from setup_comms_hermes_native import observe_bridge,pairing_ready,observe_raft_profile
            result['dependencies']=observe_bridge(home,Path(__file__).resolve().parents[2],channel)
        if channel=='buzz':
            from setup_comms_hermes_native import observe_buzz
            result['dependencies']=observe_buzz(home,os.environ)
        if channel=='teams' and result['dependencies']:
            bindings=entry.check_fn.__globals__
            # Import the actual SDK symbols with third-party dotenv loading
            # suppressed. Do not call ensure_deps_fn or instantiate App.
            with bindings['_suppress_third_party_dotenv']():
                for module,names in bindings['_SDK_IMPORTS'].items():
                    sdk=importlib.import_module(module)
                    if any(not hasattr(sdk,name) for name in names):result['dependencies']=False
        canonical=CANONICAL.get(channel,channel)
        if channel in ('discord','slack','telegram','teams') or canonical in SDK_CHANNELS and result['dependencies']:
            result['dependencies']=locked_dependencies(canonical,manifest_path) and result['dependencies']
        if mode=='readback':
            # validate_config is individually enabled only for the six typed
            # contracts. Other channels retain unverified configuration.
            if channel in ('discord','slack','telegram','teams','sms','google_chat'):
                valid=entry.validate_config(parsed) if entry.validate_config else all(os.environ.get(k) for k in entry.required_env)
                result['configured']=bool(parsed.enabled and valid)
            if channel=='teams':
                result['configured']=bool(result['configured'] and parsed.extra.get('host')=='127.0.0.1' and
                    parsed.extra.get('require_mention') is True and os.environ.get('TEAMS_HOST')=='127.0.0.1' and
                    os.environ.get('TEAMS_ALLOW_ALL_USERS')=='false')
            if channel=='sms':
                result['configured']=bool(result['configured'] and os.environ.get('SMS_WEBHOOK_URL') and
                    os.environ.get('SMS_WEBHOOK_HOST')=='127.0.0.1' and os.environ.get('SMS_INSECURE_NO_SIGNATURE')=='false' and
                    os.environ.get('SMS_ALLOW_ALL_USERS')=='false')
            if channel in CANONICAL:
                checked=hydrate(canonical,selected,os.environ,home=home)
                if checked:
                    native_parsed=PlatformConfig.from_dict(checked)
                    result['configured']=bool(entry.validate_config(native_parsed) if entry.validate_config else
                        all(os.environ.get(k) for k in entry.required_env))
                else:result['configured']=False
                if channel=='whatsapp':result['configured']=result['configured'] and pairing_ready(home)
                if channel=='raft':result['configured']=result['configured'] and observe_raft_profile(home,os.environ)
                if channel=='buzz':result['configured']=result['configured'] and result['dependencies']
        return result


def main():
    if len(sys.argv)!=3:raise ValueError('arguments')
    # Upstream diagnostics are not the installer protocol or an export surface.
    with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
        result=inspect(sys.argv[1],sys.argv[2])
    print(json.dumps(result,sort_keys=True))


if __name__=='__main__':
    try:main()
    except Exception:
        print('Selected Comms inspection did not verify.',file=sys.stderr)
        raise SystemExit(8)
