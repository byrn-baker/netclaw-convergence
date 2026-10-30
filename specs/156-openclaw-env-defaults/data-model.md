# Data Model

`mcp-env-defaults.json`: schemaVersion 1, servers mapping integration ID to source variable name → literal string fallback. Values are nonsecret, including empty optional credentials. Every entry must correspond to a bare reference in that server template. Multiple destination fields may reference one variable.

Resolution: explicit nonempty value → original native reference; absent/empty optional value → literal fallback; missing required value → unresolved bare reference (configure later, never fake credentials). No evaluation or recursive substitution of operator values.

Legacy migration: exact recognized `${NAME:-fallback}` → current prepared value; ordinary/custom values retain precedence. Historical Nautobot lab=true expressions migrate to default false unless explicitly supplied by operator. No new runtime storage or credentials.
