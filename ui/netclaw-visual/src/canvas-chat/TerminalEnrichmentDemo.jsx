import React, { useCallback, useRef, useState } from "react";
import TerminalEnrichmentPopover, { useTerminalEnrichmentHover } from "./TerminalEnrichmentPopover.jsx";
import "./TerminalEnrichmentDemo.css";

// Deliberately isolated fixtures: this component never reads a live terminal,
// fetches integration data, or persists its example aliases.
const EXAMPLES = {
  branch: {
    value: "198.51.100.0/24", kind: "Route / network", name: "Example branch users",
    summary: "A route becomes a network record, with its owner and related service issues alongside it.",
    preview: "NetBox: Example Branch · ServiceNow: 1 simulated incident",
    netbox: [["Record", "DEMO-PREFIX-101"], ["Site / VRF", "Example Branch / CORP"], ["Role", "User access network"], ["Owner / VLAN", "Example Workplace IT / 120"], ["Match", "Exact prefix + VRF"]],
    snow: [["Configuration item", "DEMO-CI-BRANCH-NET"], ["Business service", "Example branch connectivity"], ["Incident", "DEMO-INC-001 · P3 · Investigating"], ["Issue", "Intermittent branch latency"], ["Change", "DEMO-CHG-001 · Scheduled"]],
    alias: "Example Branch — user LAN", dns: "Network prefix: a PTR lookup does not describe this whole subnet.",
    observations: [["DEMO-EDGE-01", "OSPF via 192.0.2.2 · metric 20"], ["DEMO-CORE-02", "Connected · GigabitEthernet0/2"]],
    inference: "The two invented routing records suggest DEMO-CORE-02 originates this network. This is an example inference, not a verified path or topology.",
  },
  transit: {
    value: "192.0.2.0/24", kind: "Route / network", name: "Example transit segment",
    summary: "A directly connected route can be matched to an inventory prefix and the service that depends on it.",
    preview: "NetBox: Example transit segment · ServiceNow: simulated maintenance",
    netbox: [["Record", "DEMO-PREFIX-102"], ["Site / VRF", "Example Campus / CORP"], ["Role", "Router transit network"], ["Owner / VLAN", "Example Network Operations / 210"], ["Match", "Exact prefix + VRF"]],
    snow: [["Configuration item", "DEMO-CI-TRANSIT-NET"], ["Business service", "Example campus routing"], ["Incident", "No open incidents in this fixture"], ["Change", "DEMO-CHG-002 · Scheduled"], ["Scope", "Example transit-link maintenance"]],
    alias: "Example campus transit", dns: "Network prefix: inventory and aliases supply the network context.",
    observations: [["DEMO-EDGE-01", "Connected · GigabitEthernet0/1"], ["DEMO-CORE-02", "Connected · GigabitEthernet0/1"]],
    inference: "Both invented routers report this connected subnet. That is a simulated shared-subnet correlation; it does not prove a physical cable between them.",
  },
  nexthop: {
    value: "192.0.2.2", kind: "Next-hop address", name: "Example core router",
    summary: "A next-hop address links to its device, interface and related operational records.",
    preview: "NetBox: DEMO-CORE-02 / Gi0/1 · ServiceNow: simulated router CI",
    netbox: [["Record", "DEMO-IP-202"], ["Device", "DEMO-CORE-02"], ["Interface / VRF", "GigabitEthernet0/1 / CORP"], ["Site / role", "Example Campus / Core router"], ["Match", "Exact interface address + VRF"]],
    snow: [["Configuration item", "DEMO-CI-CORE-02"], ["Support group", "Example Network Operations"], ["Incident", "DEMO-INC-001 · Related service"], ["Change", "DEMO-CHG-002 · Scheduled"], ["Match", "Mock inventory-to-CI association"]],
    alias: "Example core — no DNS entry", dns: "Simulated DNS result: no PTR record. The example alias supplies a readable label.",
    observations: [["DEMO-EDGE-01", "Uses 192.0.2.2 as a route next hop"], ["DEMO-CORE-02", "Owns 192.0.2.2 on GigabitEthernet0/1"]],
    inference: "The next-hop address matches an interface address in another invented router snapshot. This illustrates cross-router correlation, not a live discovery result.",
  },
  services: {
    value: "203.0.113.0/24", kind: "Route / network", name: "Example application services",
    summary: "A service network can surface business ownership and a scheduled change directly from a route.",
    preview: "NetBox: Example application services · ServiceNow: simulated change",
    netbox: [["Record", "DEMO-PREFIX-103"], ["Site / VRF", "Example Data Center / CORP"], ["Role", "Application network"], ["Owner / VLAN", "Example Platform Team / 330"], ["Match", "Exact prefix + VRF"]],
    snow: [["Configuration item", "DEMO-CI-APP-NET"], ["Business service", "Example internal applications"], ["Incident", "No open incidents in this fixture"], ["Change", "DEMO-CHG-003 · Scheduled"], ["Scope", "Example application migration"]],
    alias: "Example shared applications", dns: "Network prefix: use its recorded purpose instead of inventing a hostname.",
    observations: [["DEMO-EDGE-01", "Static via 192.0.2.2"], ["DEMO-CORE-02", "OSPF via 192.0.2.3 · metric 10"]],
    inference: "These invented snapshots show different route sources for the same prefix. A real integration would retain both observations and their collection times.",
  },
};

const DEFAULT_ALIASES = Object.fromEntries(Object.entries(EXAMPLES).map(([key, item]) => [key, item.alias]));

function SourceCard({ title, tone, children, provenance }) {
  return <section className={`ted-source-card ted-source-${tone}`}>
    <header><h4>{title}</h4><span className="ted-fake-tag">FAKE DATA</span></header>
    {children}
    <p className="ted-provenance">{provenance}</p>
  </section>;
}

function Fields({ fields }) {
  return <dl className="ted-fields">{fields.map(([label, value]) => <React.Fragment key={label}>
    <dt>{label}</dt><dd>{value}</dd>
  </React.Fragment>)}</dl>;
}

export default function TerminalEnrichmentDemo({ onReturnToTerminal }) {
  const workspaceRef = useRef(null);
  const sampleRef = useRef(null);
  const getContentRight = useCallback(() => sampleRef.current?.getBoundingClientRect().right, []);
  const hover = useTerminalEnrichmentHover();
  const selected = hover.card?.data.key;
  const [aliases, setAliases] = useState(DEFAULT_ALIASES);
  const [draft, setDraft] = useState(DEFAULT_ALIASES.branch);
  const [aliasNotice, setAliasNotice] = useState("");
  const item = EXAMPLES[selected || "branch"];

  const show = (key, event, pin = false) => {
    if (hover.card?.pinned && !pin) return;
    if (selected !== key) {
      setDraft(aliases[key]);
      setAliasNotice("");
    }
    hover.open({ key }, event.currentTarget, { pin });
  };
  const reset = () => {
    setAliases({ ...DEFAULT_ALIASES });
    hover.close();
    setDraft(DEFAULT_ALIASES.branch);
    setAliasNotice("Demo reset. All example labels have been restored.");
  };
  const token = (key) => <button type="button"
    className={`ted-token${selected === key ? " ted-token-selected" : ""}`}
    aria-haspopup="dialog" aria-expanded={selected === key}
    aria-label={`Show fake enrichment for ${EXAMPLES[key].value}`}
    onMouseEnter={(event) => show(key, event)} onMouseLeave={hover.scheduleClose}
    onFocus={(event) => show(key, event)} onBlur={hover.scheduleClose}
    onClick={(event) => show(key, event, true)}>{EXAMPLES[key].value}</button>;

  return <section className="terminal-enrichment-demo" aria-label="NetBox and ServiceNow synthetic integration demonstration"
    onMouseDown={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}>
    <div className="ted-banner" role="note">
      <div><strong>FAKE DATA — DEMONSTRATION ONLY</strong>
        <p>NetBox and ServiceNow (SNOW) examples are entirely synthetic. No live integrations, devices or tickets are queried or changed.</p>
      </div>
      <div className="ted-banner-actions">
        <button type="button" onClick={reset}>Reset demo</button>
        {onReturnToTerminal && <button type="button" onClick={onReturnToTerminal}>Back to terminal</button>}
      </div>
    </div>

    <div className="ted-scroll">
      <div className="ted-intro">
        <h3>A route with context</h3><span>Hover for details · wide windows dock them on the right · click to pin</span>
      </div>
      <div className="ted-workspace" ref={workspaceRef}>
        <div className="ted-sample-column" ref={sampleRef}>
          <section className="ted-cli" aria-label="Fake route output">
            <header><span>SIMULATED TERMINAL OUTPUT</span><span className="ted-fake-tag">FAKE DATA</span></header>
            <div className="ted-cli-output">
              <div className="ted-cli-command">DEMO-EDGE-01# show ip route vrf CORP</div>
              <div className="ted-cli-muted">Routing Table: CORP</div>
              <div>O {token("branch")} [110/20]<br /><span className="ted-indent">via {token("nexthop")}, GigabitEthernet0/1</span></div>
              <div>C {token("transit")} is directly connected,<br /><span className="ted-indent">GigabitEthernet0/1</span></div>
              <div>S {token("services")} [1/0]<br /><span className="ted-indent">via {token("nexthop")}, GigabitEthernet0/1</span></div>
            </div>
          </section>
          <div className="ted-quick-preview">
            <strong>Explore a route without leaving the output</strong>
            <span>Hover a highlighted prefix or next hop to open the NetBox, ServiceNow, router and alias tiles. Move into the popover to scroll. Click an address to keep it open; Escape closes it.</span>
          </div>
        </div>
      </div>
      <p className="ted-footer">All addresses, labels, devices, ownership, incidents, changes and relationships are invented for demonstration. This tab does not establish a NetBox or ServiceNow connection.</p>
    </div>

    {hover.card && <TerminalEnrichmentPopover {...hover.popoverProps}
      dockRef={workspaceRef} getContentRight={getContentRight}
      title={item.value} subtitle={`${item.kind} · ${aliases[selected] || item.name}`} demo>
        <div className="terminal-enrichment-demo ted-popover-content">
          <p className="ted-summary">{item.summary}</p>
          <div className="ted-source-grid">
            <SourceCard title="NetBox" tone="netbox" provenance="Source: bundled mock NetBox inventory · no API connection.">
              <Fields fields={item.netbox} />
            </SourceCard>
            <SourceCard title="ServiceNow / SNOW" tone="snow" provenance="Source: bundled mock ServiceNow CMDB / ITSM records · no API connection.">
              <Fields fields={item.snow} />
            </SourceCard>
            <SourceCard title="Across routers" tone="routers" provenance="Source: two authored CLI fixtures · simulated observations, not collected telemetry.">
              <div className="ted-observations">{item.observations.map(([device, observation]) => <div key={device}>
                <strong>{device}</strong><span>{observation}</span>
              </div>)}</div>
              <p className="ted-inference"><strong>Simulated inference:</strong> {item.inference}</p>
            </SourceCard>
            <SourceCard title="Local alias" tone="alias" provenance="Source: this demo only · resets when you leave the demo · never saved to your real aliases.">
              <p className="ted-dns-note">{item.dns}</p>
              <form className="ted-alias-form" onSubmit={(event) => {
                event.preventDefault();
                const label = draft.trim();
                if (!label) return;
                setAliases((previous) => ({ ...previous, [selected]: label }));
                setAliasNotice("Example label applied inside this demo only.");
              }}>
                <label>Try an example label
                  <input aria-label="Demo-only local alias" value={draft} maxLength={120}
                    onChange={(event) => { setDraft(event.target.value); setAliasNotice(""); }} />
                </label>
                <button type="submit" disabled={!draft.trim()}>Apply in demo</button>
              </form>
              <span className="ted-alias-notice" role="status">{aliasNotice}</span>
            </SourceCard>
          </div>
        </div>
    </TerminalEnrichmentPopover>}
  </section>;
}
