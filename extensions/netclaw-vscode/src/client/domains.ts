import { HudClient, scrub, Json } from "./hud";
export const domains = {
  overview: {
    title: "Overview",
    route: "/api/runtime",
    group: "estate",
    icon: "dashboard",
  },
  estate: {
    title: "Risk / iN2N",
    route: "/api/n2n",
    keys: ["available", "identity", "risk", "members", "generatedAt"],
    group: "estate",
    icon: "organization",
  },
  peers: {
    title: "External peers / eN2N",
    route: "/api/n2n",
    keys: ["available", "identity", "peers", "posture", "generatedAt"],
    group: "estate",
    icon: "globe",
  },
  mobile: {
    title: "Mobile & edge",
    route: "/api/n2n",
    keys: ["available", "edgeNodes", "recentPushes", "generatedAt"],
    group: "estate",
    icon: "device-mobile",
  },
  science: {
    title: "Science Officer",
    route: "/api/n2n",
    keys: ["available", "advisors", "generatedAt"],
    group: "knowledge",
    icon: "beaker",
  },
  network: {
    title: "Testbed inventory",
    route: "/api/graph",
    keys: ["devices", "generatedAt"],
    group: "estate",
    icon: "type-hierarchy",
  },
  topology: {
    title: "BGP sessions & topology",
    route: "/api/bgp",
    group: "estate",
    icon: "git-merge",
  },
  operations: {
    title: "Federation work",
    route: "/api/n2n",
    keys: ["available", "replicationJobs", "approvals", "generatedAt"],
    group: "operations",
    icon: "tasklist",
  },
  gait: {
    title: "GAIT federation audit",
    route: "/api/n2n",
    keys: ["available", "gait", "generatedAt"],
    group: "operations",
    icon: "history",
  },
  integrations: {
    title: "MCP integrations",
    route: "/api/graph",
    keys: ["integrations", "categories", "stats", "generatedAt"],
    group: "integrations",
    icon: "plug",
  },
  skills: {
    title: "Installed skills",
    route: "/api/graph",
    keys: ["skills", "generatedAt"],
    group: "integrations",
    icon: "tools",
  },
  settings: {
    title: "Provider & harness",
    route: "/api/hud/runtime",
    group: "integrations",
    icon: "settings-gear",
  },
  configuration: {
    title: "Environment configuration",
    route: "/api/hud/configuration",
    group: "integrations",
    icon: "key",
  },
  tokenomics: {
    title: "Tokenomics",
    route: "/api/hud/tokenomics",
    group: "operations",
    icon: "graph",
  },
  budget: {
    title: "Budget",
    route: "/api/budget/config",
    group: "operations",
    icon: "credit-card",
  },
  security: {
    title: "DefenseClaw controls",
    route: "/api/hud/security",
    group: "security",
    icon: "shield",
  },
  openshell: {
    title: "OpenShell",
    route: "/api/hud/openshell",
    group: "security",
    icon: "lock",
  },
  knowledge: {
    title: "Knowledge collections",
    route: "/api/rag/stats",
    group: "knowledge",
    icon: "library",
  },
  documentation: {
    title: "Documentation",
    route: "/api/hud/documentation",
    group: "help",
    icon: "book",
  },
  reference: {
    title: "CLI & API reference",
    route: "/api/hud/reference",
    group: "help",
    icon: "code",
  },
  logs: {
    title: "Installation log sources",
    route: "/api/hud/logs",
    group: "operations",
    icon: "output",
  },
  intent: {
    title: "Terminal endpoint profiles",
    route: "/api/terminal/devices",
    group: "operations",
    icon: "terminal",
  },
} as const;
export type Domain = keyof typeof domains;
export async function inspect(client: HudClient, kind: Domain): Promise<Json> {
  if (!Object.hasOwn(domains, kind)) throw Error("Unknown inspection domain.");
  const d = domains[kind];
  const data = await client.request(
    "GET",
    d.route,
    undefined,
    kind === "knowledge" ? 90000 : 20000,
  );
  const projected =
    "keys" in d
      ? Object.fromEntries(
          [...d.keys, "error", "reason", "code"]
            .filter((key) => Object.hasOwn(data, key))
            .map((key) => [key, data[key]]),
        )
      : data;
  return {
    source: d.route,
    installationId: client.runtime?.installationId,
    observedAt: new Date().toISOString(),
    ...("keys" in d
      ? {
          note: "Missing information is shown as not reported.",
        }
      : {}),
    data: scrub(projected),
  };
}
