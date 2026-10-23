import math
from pathlib import Path
import sys
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'src'))
from netclaw_tokens import CostEstimate, TokenCount
from netclaw_tokens.cost_calculator import calculate_cost, get_pricing
from netclaw_tokens.session_ledger import SessionLedger


@pytest.mark.parametrize('raw', ['[]', 'null', '42', '{"opus": null}', '{"opus":{"input":NaN}}', '{"opus":{"input":-1}}', '{"opus":{"cache_discount":101}}', '{"opus":{"input":true}}'])
def test_invalid_optional_price_override_uses_default(monkeypatch, raw):
    monkeypatch.setenv('NETCLAW_TOKEN_PRICING_OVERRIDE', raw)
    pricing = get_pricing('opus')
    assert pricing.input_price_per_1m == 5
    assert pricing.cache_discount_pct == 90
    assert math.isfinite(calculate_cost(100, 100).total_cost)


@pytest.mark.parametrize('value', [float('nan'), float('inf'), -1.0, True, '0'])
def test_invalid_usage_halts_without_poisoning_ledger(value):
    ledger = SessionLedger()
    with pytest.raises(ValueError):
        ledger.record('tool', TokenCount(input_tokens=1), CostEstimate(total_cost=value))
    assert ledger.total_cost == 0
    assert ledger.total_call_count == 0
    assert ledger.check_budget() == (True, 'invalid_cost')
    assert 'incomplete' in ledger.get_halt_message()
    with pytest.raises(RuntimeError, match='accounting'):
        ledger.override_budget()


def test_valid_zero_and_positive_costs_are_preserved(monkeypatch):
    monkeypatch.setenv('NETCLAW_TOKEN_PRICING_OVERRIDE', '{"opus":{"input":0,"output":2,"cache_discount":100}}')
    assert calculate_cost(1000000, 1000000, 'opus').total_cost == 2
    ledger = SessionLedger()
    ledger.record('tool', TokenCount(input_tokens=1), CostEstimate(total_cost=0))
    ledger.record('tool', TokenCount(input_tokens=1), CostEstimate(total_cost=2))
    assert ledger.total_cost == 2
    assert ledger.check_budget() == (False, None)
