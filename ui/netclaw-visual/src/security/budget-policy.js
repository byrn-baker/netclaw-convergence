// Keep display semantics aligned with src/netclaw_tokens/budget_policy.py.
function number(value, fallback, integer = false) {
  if (typeof value === 'boolean' || value === null || value === undefined
      || !['number', 'string'].includes(typeof value)
      || (typeof value === 'string' && !value.trim())) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && (!integer || Number.isInteger(parsed))
    ? parsed : fallback;
}

export function resolveBudgetPolicy(config, env = process.env) {
  const defaults = config?.agents?.defaults || {};
  const budget = defaults.budget || {};
  const numeric = (camel, snake, fallback, integer = false) =>
    number(budget[snake], number(budget[camel], fallback, integer), integer);
  const boolean = (v, fallback) => typeof v === 'boolean' ? v : typeof v === 'string'
    && ['true', 'false'].includes(v.toLowerCase()) ? v.toLowerCase() === 'true' : fallback;
  return {
    sessionBudgetUsd: number(env.NETCLAW_SESSION_BUDGET_USD,
      numeric('sessionBudgetUsd', 'session_budget_usd', 5)),
    maxToolCallsPerTurn: numeric('maxToolCallsPerTurn', 'max_tool_calls_per_turn', 20, true),
    contextWarningTokens: numeric('contextWarningTokens', 'context_warning_tokens', 100000, true),
    allowOverride: boolean(budget.allow_override, boolean(budget.allowOverride, true)),
    overrideIncrementUsd: numeric('overrideIncrementUsd', 'override_increment_usd', 2),
    model: null,
    interfaceDefaults: defaults.interfaceDefaults || {},
  };
}
