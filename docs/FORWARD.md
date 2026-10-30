# Forward Networks (official MCP)

NetClaw connects to [Forward Networks](https://www.forwardnetworks.com/) through
the MCP server that Forward itself serves at `<your-forward-host>/api/mcp`. It
works on SaaS and self-hosted Forward. There is nothing to build, clone or run
locally: NetClaw registers the endpoint by URL and sends a Forward API token as
HTTP Basic credentials.

Every tool Forward exposes over MCP is **read-only**. None can change the
network, its configuration, or Forward's own state.

> Moving from the community `forward-mcp` server? See
> [Migrating from forward-mcp](#migrating-from-forward-mcp). The official MCP
> is smaller, so some workflows no longer exist.

## What you need

- A Forward network, and its **network ID**. The MCP has no tool to list
  networks or snapshots, so you must know the ID in advance.
- A Forward **API token** (access key and secret), minted at
  **Settings > Account > API tokens**. The token belongs to a real user and
  carries that user's organization and per-network permissions.
- The MCP server enabled for your organization. It is on by default. On
  self-hosted Forward an admin can turn it off under **Settings > System >
  Org preferences > Experimental features > Enable MCP server**; on SaaS, ask
  Forward support.

## Enable it

```bash
./scripts/forward-enable.sh
```

The script asks for your Forward base URL (for example `https://fwd.app`, no
path), the token's access key, and its secret. It stores two values in
`~/.openclaw/.env`, then runs a smoke test (an MCP `initialize` followed by
`tools/list`) and fails if Forward rejects the credentials.

| Variable | Meaning |
|----------|---------|
| `FORWARD_URL` | Forward base URL, no path. NetClaw appends `/api/mcp` |
| `FORWARD_AUTH_BASE64` | Base64 of `accessKey:secret` |

To set them by hand:

```bash
echo -n 'accessKey:secret' | base64     # value for FORWARD_AUTH_BASE64
```

`FORWARD_AUTH_BASE64` decodes to the API token's secret. Treat it as a secret:
keep it in `~/.openclaw/.env`, never in repository files, tickets or chat.

The installer path (`./scripts/install.sh`, component `forward`) registers the
server and prints how to set those two variables. It does not prompt for
credentials; run `./scripts/forward-enable.sh` to store and verify them.

## How NetClaw registers it

`config/openclaw.json` declares a remote server:

```json
"forward-official-mcp": {
  "url": "${FORWARD_URL}/api/mcp",
  "headers": { "Authorization": "Basic ${FORWARD_AUTH_BASE64}" }
}
```

Forward does not implement the OAuth 2.1 authorization flow. Clients that only
support OAuth connectors (for example claude.ai custom connectors) cannot
connect; clients that can set a static `Authorization` header can.

## Tools

`tools/list` is the source of truth: Forward can add tools, and the list is
narrowed by your license and by whether your organization has Forward AI
enabled.

| Tool | Returns | Needs AI |
|------|---------|----------|
| `get_paths` | Traces packet paths through the network | No |
| `get_device` | Details for a device | No |
| `get_interface` | Details for an interface | No |
| `get_vlan` | A VLAN and the interfaces on it | No |
| `get_vrf` | A VRF, its devices and its interfaces | No |
| `get_host` | Details for a host | No |
| `get_cloud_object` | Details for a cloud object | No |
| `get_subnet_locations` | Where a subnet is located | No |
| `get_device_vulnerabilities` | Vulnerabilities on a device, sorted by severity | No |
| `get_vulnerability` | Details for a specific CVE | No |
| `get_network_complexity` | Inventory summary: device counts by vendor, type, model and OS version, plus VLANs, VRFs, ACLs, links and flows | No |
| `nqe` | Generates and runs an NQE query and returns a summary | Yes |
| `generate_nqe_query` | Generates an NQE query from a description without running it | Yes |
| `search_docs` | NQE documentation for syntax, functions and the data model | Yes |

The list does not reflect per-network permissions. Those are checked when a
tool runs, so a listed tool can still be denied for one network.

## Calling a tool

Every call carries:

- **`networkId`** (required): the network to run against.
- **`snapshotId`** (optional): a specific snapshot. When omitted, the tool uses
  the network's latest processed snapshot.

plus the tool's own arguments:

| Tool | Own arguments |
|------|---------------|
| `get_paths` | `dstIp` (required) and `srcIp` or `fromDevice` (one is required); optional `srcPort`, `dstPort`, `ipProto` |
| `get_device`, `get_device_vulnerabilities` | `deviceName` |
| `get_interface` | `deviceName`, `interfaceName` |
| `get_vlan` | `vlanId` (integer) |
| `get_vrf` | `vrfName` |
| `get_host` | `hostSpecifier` (name, cloud host ID, IP or MAC) |
| `get_cloud_object` | `objectId` |
| `get_subnet_locations` | `subnetAddress` |
| `get_vulnerability` | `cveId` |
| `get_network_complexity` | none |
| `nqe`, `generate_nqe_query` | `prompt` (natural language) |
| `search_docs` | `query` (natural language) |

For example, a path trace with `get_paths`:

```json
{ "networkId": "123456", "srcIp": "10.1.1.10", "dstIp": "8.8.8.8" }
```

Required permissions: `get_paths` needs `VIEW_PATHS`; `nqe` and
`generate_nqe_query` need `USE_NQE`; the other tools need view access to the
network.

### What comes back

Results are JSON (text and structured content). Failures inside a tool are a
normal MCP result with `isError: true` and a plain-text message, not an HTTP
error.

- `get_paths` returns `forwardingOutcome`, `securityOutcome`, the `hops`,
  `totalHits`, `timedOut` and a `queryUrl` that opens the same trace in Forward.
- `get_network_complexity` returns exact counts and includes the `snapshotId` used.
- `get_device_vulnerabilities` lists every CVE checked, each with a `result`; only
  `VULNERABLE` means the device is exposed, `NOT_VULNERABLE` rows are clear.
- A lookup that finds nothing (for example `get_vlan` or `get_host`) returns an
  empty list, not an error.
- `nqe` returns the generated `query`, a `summary`, a `status` and, on success,
  an `executionKey`. Forward generates the query, so it can be invalid: then
  `status` is `INVALID_QUERY`, an `errors` field explains why, and the call is
  not an `isError` result. The summary is written by a model and can be
  approximate; use the `get_*` tools for exact numbers.

## Limits

- **Read-only.** No tool changes the network, its configuration or Forward.
- **No discovery.** No tool lists networks or snapshots. Supply the `networkId`.
- **Capped results.** `nqe` reads at most 100 rows per query and returns the
  query, a summary and a result key instead of the rows. `search_docs` returns
  at most two documentation chunks, and `get_paths` returns a single path
  result.
- **Snapshots, not live state.** Answers describe a collected snapshot.
- **Generated NQE.** `nqe` and `generate_nqe_query` use a model to write the query, so review the returned `query`.

## Verify

```bash
FORWARD_URL=https://fwd.app FORWARD_AUTH_BASE64=... python3 scripts/forward-mcp-check.py
```

It performs the MCP handshake, prints the server name and the tool names Forward
offers to your token, and never prints the credential. Run against a live Forward,
it listed all 14 tools above.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| HTTP 403 on every request (body: `MCP is not enabled for this organization`) | An admin disabled **Enable MCP server**, or the license is expired or inactive | Re-enable it (self-hosted admin) or contact Forward support |
| HTTP 400 or 404 on a call after connecting | The endpoint is session-based: the call carried no MCP session id (400) or an unknown one (404) | Reconnect (`initialize` again) and retry; a standard MCP client does this itself |
| HTTP 401 | Wrong or revoked token | Mint a new token and rerun `./scripts/forward-enable.sh` |
| A tool is missing from `tools/list` | Not in your license, or AI is not enabled for the org | Ask your Forward admin to check the license and whether Forward AI is enabled for the org |
| `No processed snapshot for network N` | The network has no processed snapshot, or the ID does not exist (Forward gives the same message for both; the token may also lack access) | Check the ID and the token's access |
| `nqe` returns `status: INVALID_QUERY` | The generated query did not compile | Retry with a clearer, more specific `prompt`, or use `generate_nqe_query` and `search_docs` |
| Error for one network only | The token's user lacks the permission (for example `VIEW_PATHS`), or the network has no processed snapshot they can reach | Fix the user's role, or pick a network with a snapshot |
| `Cannot reach ...` from the check script | Wrong `FORWARD_URL`, or no network route to Forward | Check the URL and your network path to the host |

## Migrating from forward-mcp

NetClaw previously built the community `forward-mcp` Go server
(`mcp-servers/forward-mcp`). It is no longer used.

1. Remove the `forward-mcp` block from `~/.openclaw/openclaw.json` and add
   `forward-official-mcp` (copy it from `config/openclaw.json`).
2. Run `./scripts/forward-enable.sh`. The old `FORWARD_API_BASE_URL`,
   `FORWARD_API_KEY` and `FORWARD_API_SECRET` variables are replaced by
   `FORWARD_URL` and `FORWARD_AUTH_BASE64`; delete the old ones, and the other
   `FORWARD_*` cache and lock variables, from `~/.openclaw/.env`.
3. Delete `mcp-servers/forward-mcp` and `~/.openclaw/forward` if present.

The official MCP does not provide these `forward-mcp` capabilities, so NetClaw
no longer offers them through this integration: listing networks and
snapshots, snapshot diffs, NQE query library search and saved-query runs,
predefined checks, configuration search and diffs, hardware/OS lifecycle,
collection and source management, and the local semantic cache and
knowledge-graph memory. The new skill says so rather than approximating them.
