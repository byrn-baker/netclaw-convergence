import importlib.util
from pathlib import Path
import plistlib

spec=importlib.util.spec_from_file_location('bundle_gate',Path(__file__).resolve().parents[2]/'scripts/check-mobile-bundle.py')
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)

def bundle(path, identifier, version='1.2.3', build='7'):
    path.mkdir(parents=True)
    data={'CFBundleIdentifier':identifier,'CFBundleShortVersionString':version,'CFBundleVersion':build}
    (path/'Info.plist').write_bytes(plistlib.dumps(data))

def test_valid_app_watch_extension_metadata(tmp_path):
    root=tmp_path/'Runner.app';bundle(root,'example.app')
    bundle(root/'Watch/Watch.app','example.app.watch')
    bundle(root/'PlugIns/Widget.appex','example.app.widget')
    result=gate.inspect(root)
    assert not result['errors'] and len(result['bundles'])==3

def test_mismatch_and_duplicate_are_rejected(tmp_path):
    root=tmp_path/'Runner.app';bundle(root,'example.app')
    bundle(root/'PlugIns/Widget.appex','example.app',build='1')
    errors=gate.inspect(root)['errors']
    assert any('duplicate' in error for error in errors)
    assert any('differs' in error for error in errors)

def test_missing_bundle_or_version_is_rejected(tmp_path):
    assert gate.inspect(tmp_path/'missing.app')['errors']
    root=tmp_path/'Runner.app';bundle(root,'example.app',version='')
    assert gate.inspect(root)['errors']
