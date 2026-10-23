"""Production guard admission checks actual local routing configuration."""
import asyncio
import json
from pathlib import Path
import pytest
from bgp.federation import controls, gateway


def setup(monkeypatch, tmp_path, model='defenseclaw/model'):
    monkeypatch.setenv('HOME', str(tmp_path))
    monkeypatch.setenv('N2N_RISK_MODE', 'production')
    config = tmp_path / 'runtime/openclaw.json'
    config.parent.mkdir()
    config.write_text(json.dumps({'agents': {'defaults': {'model': {'primary': model}}}, 'models': {'providers': {'defenseclaw': {'baseUrl': f'http://127.0.0.1:{controls.DEFENSECLAW_GUARD_PORT}/v1'}}}}))
    monkeypatch.setenv('OPENCLAW_CONFIG_PATH', str(config))
    security = tmp_path / '.openclaw/config/openclaw.json'
    security.parent.mkdir(parents=True)
    security.write_text(json.dumps({'security': {'mode': 'defenseclaw'}}))
    monkeypatch.setattr(controls.shutil, 'which', lambda _: '/fixture/defenseclaw')
    async def reachable(): return True
    monkeypatch.setattr(controls, '_guard_proxy_up', reachable)
    controls.invalidate_cache()
    return config, security


def test_disabled_guard_mode_refuses_even_with_reachable_proxy(monkeypatch, tmp_path):
    config, security = setup(monkeypatch, tmp_path)
    security.write_text('{"security":{"mode":"hobby"}}')
    assert asyncio.run(controls.defenseclaw_available())[0] is False


@pytest.mark.parametrize('model', ['anthropic/model', 'model'])
def test_direct_model_refuses(monkeypatch, tmp_path, model):
    setup(monkeypatch, tmp_path, model)
    assert asyncio.run(controls.defenseclaw_available())[0] is False


def test_guarded_route_accepts_but_explicit_direct_override_refuses(monkeypatch, tmp_path):
    setup(monkeypatch, tmp_path)
    assert asyncio.run(controls.defenseclaw_available())[0] is True
    with pytest.raises(gateway.EnforcementRefused):
        asyncio.run(gateway._apply_production_controls(['openclaw','agent','--local','--model','anthropic/model'], 'fixture'))


def test_direct_fallback_and_remote_proxy_refuse(monkeypatch, tmp_path):
    config, _ = setup(monkeypatch, tmp_path)
    data = json.loads(config.read_text())
    data['agents']['defaults']['model']['fallbacks'] = ['anthropic/direct']
    config.write_text(json.dumps(data))
    assert asyncio.run(controls.defenseclaw_available())[0] is False
    data['agents']['defaults']['model'].pop('fallbacks')
    data['models']['providers']['defenseclaw']['baseUrl'] = 'https://unguarded.invalid/v1'
    config.write_text(json.dumps(data))
    assert asyncio.run(controls.defenseclaw_available())[0] is False


def test_agent_override_cannot_hide_direct_default_fallback(monkeypatch, tmp_path):
    config, _ = setup(monkeypatch, tmp_path)
    data = json.loads(config.read_text())
    data['agents']['defaults']['model']['fallbacks'] = ['anthropic/direct']
    data['agents']['list'] = [{'id': 'main', 'model': 'defenseclaw/model'}]
    config.write_text(json.dumps(data))
    assert asyncio.run(controls.defenseclaw_available())[0] is False
