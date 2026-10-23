# Research

2026-10-04: PyPI JSON reports fastmcp 4.0.11 and mcp 2.3.0, both Python >=3.10. GitHub latest web snapshot lagged at 4.0.10; package metadata is the installation authority.

Sources:
- https://pypi.org/pypi/fastmcp/json
- https://pypi.org/pypi/mcp/json
- https://gofastmcp.com/getting-started/upgrading/from-fastmcp-3
- https://gofastmcp.com/getting-started/upgrading/from-fastmcp-2
- https://gofastmcp.com/getting-started/upgrading/from-mcp-sdk-v1

SDK-v1's bundled FastMCP is not standalone FastMCP, even when both distributions are installed. FastMCP4 supports the modern sessionless protocol and legacy clients. Its dependency changes require isolated resolution. Application HTTP clients need not migrate from httpx unless passed to framework transports/providers. Existing application tasks and audit/persistence mechanisms remain authoritative.

Repository baseline: clean main e89ffcb at session entry. Existing installer already isolates component runtimes, retains shared legacy bounds, and selects component bounds when present. UML already uses an isolated MCP2/FastMCP4 runtime. pyATS is an adjacent SDK2 HTTP server behind a stdio bridge, not a FastMCP import. Local inventory tool attempt pending/result recorded in verification.


Additional evidence:
- https://pypi.org/project/fastmcp/4.0.11/ and https://pypi.org/project/mcp/2.3.0/
- https://github.com/PrefectHQ/fastmcp/blob/main/docs/servers/providers/proxy.mdx — a gateway can bridge older backends, but it does not upgrade their native dependencies or preserve every cross-era feature. No gateway was silently substituted for the requested native ports.
- https://github.com/PagerDuty/pagerduty-mcp-server — archived local server; remote replacement changes authentication and deployment.
- https://pypi.org/pypi/mcp-atlassian/0.23.1/json
- https://pypi.org/pypi/mcp-for-blender/2.1.3/json
- https://pypi.org/pypi/awslabs.cost-explorer-mcp-server/0.0.21/json
- https://pypi.org/pypi/awslabs.aws-diagram-mcp-server/1.0.23/json

Published wheel imports were inspected as well as installed clones: a package's lack of an explicit `fastmcp` dependency does not exclude SDK1's bundled FastMCP. Broad package-name matches in `installer-package-audit.json` include names that happen to exist on PyPI but are not this repository's selected source; `fleet-disposition.json` is the final classification, not that exploratory lookup.

The initial `pagerduty-mcp` wheel AST scan stopped on newer Python syntax in the host parser. Direct source inspection confirmed the SDK1 import; this is a discovery limitation rather than evidence of absence. The latest `blender-mcp` package is a wrapper; its transitive `mcp-for-blender` package is the relevant source.
