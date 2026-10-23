"""Tests for the opt-in NETCLAW_TABULAR_FORMAT=bpp override.

The default (unset / "gcf") must leave serializer output unchanged. With
"bpp", only payloads that would use the GCF generic profile are affected, and
any failure falls back to GCF generic.
"""

import importlib
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

FLAT = {
    "nsg_name": "prod-web-nsg",
    "rules": [
        {"name": f"Rule-{i:03d}", "priority": 100 + i * 10, "access": "Allow",
         "description": f"Allow traffic for service-{i}", "enabled": i % 2 == 0}
        for i in range(10)
    ],
    "count": 10,
}

GRAPH = {
    "devices": [{"hostname": f"rtr-{i}", "role": "spine"} for i in range(5)],
    "links": [{"source": "rtr-0", "target": "rtr-1", "state": "up"}],
}


def reload_serializer(mode="full", tabular=None):
    os.environ["NETCLAW_GCF_MODE"] = mode
    if tabular is None:
        os.environ.pop("NETCLAW_TABULAR_FORMAT", None)
    else:
        os.environ["NETCLAW_TABULAR_FORMAT"] = tabular
    import netclaw_tokens.gcf_serializer as gs
    importlib.reload(gs)
    gs.get_session_manager().reset()
    return gs


@pytest.fixture(autouse=True)
def _restore_env():
    yield
    os.environ.pop("NETCLAW_TABULAR_FORMAT", None)
    os.environ["NETCLAW_GCF_MODE"] = "full"
    import netclaw_tokens.gcf_serializer as gs
    importlib.reload(gs)


def test_default_is_unchanged_gcf_generic():
    gs = reload_serializer()
    r = gs.serialize_response(FLAT)
    assert r["profile_used"] == "generic"
    assert r["encoded_data"] == gs._lossless_generic(FLAT)


def test_explicit_gcf_matches_default():
    default = reload_serializer().serialize_response(FLAT)
    explicit = reload_serializer(tabular="gcf").serialize_response(FLAT)
    assert explicit == default


def test_unknown_value_falls_back_to_gcf():
    gs = reload_serializer(tabular="yaml")
    assert gs.serialize_response(FLAT)["profile_used"] == "generic"


def test_bpp_used_for_flat_data_and_is_lossless():
    bpp = pytest.importorskip("bpp")
    gs = reload_serializer(tabular="bpp")
    r = gs.serialize_response(FLAT)
    assert r["profile_used"] == "bpp"
    assert r["fallback_used"] is False
    assert bpp.loads(r["encoded_data"]) == FLAT


def test_bpp_does_not_touch_graph_payloads():
    pytest.importorskip("bpp")
    gs = reload_serializer(tabular="bpp")
    r = gs.serialize_response(GRAPH)
    assert r["profile_used"] in ("graph", "graph+session")


def test_bpp_respects_mode_off():
    pytest.importorskip("bpp")
    gs = reload_serializer(mode="off", tabular="bpp")
    assert gs.serialize_response(FLAT)["profile_used"] == "json"


def test_missing_bpp_package_falls_back_to_gcf(monkeypatch):
    gs = reload_serializer(tabular="bpp")
    monkeypatch.setitem(sys.modules, "bpp", None)  # makes `import bpp` fail
    r = gs.serialize_response(FLAT)
    assert r["profile_used"] == "generic"
    assert r["encoded_data"] == gs._lossless_generic(FLAT)


def test_lossy_bpp_round_trip_falls_back_to_gcf(monkeypatch):
    bpp = pytest.importorskip("bpp")
    gs = reload_serializer(tabular="bpp")
    monkeypatch.setattr(bpp, "loads", lambda text: {"changed": True})
    r = gs.serialize_response(FLAT)
    assert r["profile_used"] == "generic"
