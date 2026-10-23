import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TOPOLOGY_SCOPES } from '../../topology-scope.js';
import { identitySourceLabel, closestSourceLabel, destinationContext, routeLearningLabel } from './topology-evidence-labels.js';
import './TopologyContext.css';

async function request(url, body, signal) {
  const response = await fetch(url, { signal, ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  if (response.status === 404) throw new Error('Restart the NetClaw API to load automatic topology collection, then reopen this panel.');
  const result = await response.json().catch(() => ({ error: 'Topology service returned an unreadable response.' }));
  if (!response.ok) throw new Error(result.error || 'Topology service is unavailable.');
  return result;
}
const time = value => value ? new Date(value).toLocaleString() : 'Not collected yet';

export function TopologySettings({ onClose }) {
  const [status, setStatus] = useState(null);
  const [selected, setSelected] = useState({});
  const [interval, setIntervalValue] = useState(30);
  const [scopes, setScopes] = useState(TOPOLOGY_SCOPES.map(scope => scope.id));
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [logins, setLogins] = useState({});
  const [loginForms, setLoginForms] = useState({});
  const [loginPending, setLoginPending] = useState(null);
  const loginController = useRef(null);
  const devicePanels = useRef(new Map());
  const initialized = useRef(false);
  const panelRef = useRef(null);
  const scopeUnavailable = status && scopes.some(id => !status.availableScopes?.some(scope => scope.id === id));
  useEffect(() => () => loginController.current?.abort(), []);
  const testLogin = async (id, challenge) => {
    const controller = new AbortController();
    loginController.current = controller;
    setLoginPending(id);
    const form = loginForms[id] || {};
    try {
      const next = await request('/api/topology/login', { device: id, legacy: selected[id]?.legacy === true,
        ...(form.username || form.password ? { credentials: { username: form.username || '', password: form.password || '' } } : {}),
        ...(challenge ? { challenge } : {}) }, controller.signal);
      setLogins(previous => ({ ...previous, [id]: next }));
      if (next.status === 'ready') setLoginForms(previous => ({ ...previous, [id]: {} }));
      else devicePanels.current.get(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return next.status === 'ready';
    } catch (e) {
      if (!controller.signal.aborted) {
        setLogins(previous => ({ ...previous, [id]: { status: 'error', error: e.message } }));
        devicePanels.current.get(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      return false;
    } finally { if (!controller.signal.aborted) setLoginPending(null); }
  };
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    const refresh = async () => {
      try {
        const next = await request('/api/topology/status', null, controller.signal);
        if (controller.signal.aborted) return;
        setLoadError('');
        setStatus(next);
        if (!initialized.current) {
          initialized.current = true;
          setSelected(Object.fromEntries(next.devices.map(device => [device.id, { legacy: device.legacy }])));
          setIntervalValue(next.intervalSeconds);
          if (next.enabled) setScopes(next.scopes?.length ? next.scopes : ['routes']);
        }
      } catch (e) { if (!controller.signal.aborted) setLoadError(e.message); }
      if (!controller.signal.aborted) timer = window.setTimeout(refresh, 5000);
    };
    refresh();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, []);
  useEffect(() => {
    const previous = document.activeElement;
    panelRef.current?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key === 'Tab') {
        const controls = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => { document.removeEventListener('keydown', handleKey, true); previous?.focus?.(); };
  }, [onClose]);
  const save = async revoke => {
    if (!revoke && (scopeUnavailable || !status || loadError)) {
      setError('Restart the NetClaw API and reopen this panel before authorizing these collection categories.');
      return;
    }
    setBusy(true); setError('');
    try {
      if (!revoke) {
        for (const id of Object.keys(selected)) {
          if (logins[id]?.status !== 'ready' && !(await testLogin(id))) {
            setError('Complete the login or host-key approval shown for the selected device, then authorize collection again.');
            return;
          }
        }
      }
      const next = await request(revoke ? '/api/topology/revoke' : '/api/topology/authorize', revoke ? {} : {
        authorized, scopes, intervalSeconds: Number(interval), devices: Object.entries(selected).map(([id, settings]) => ({ id, ...settings })),
      });
      setStatus(previous => ({ ...previous, ...next }));
      setAuthorized(false);
      if (revoke) { setSelected({}); setLogins({}); setLoginForms({}); }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return createPortal(<div className="topology-backdrop" onMouseDown={e => e.stopPropagation()}>
    <section className="topology-settings" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="topology-settings-title">
      <header><div><h2 id="topology-settings-title">Automatic topology context</h2><p>Authorize once. NetClaw collects and correlates in the background.</p></div>
        <button onClick={onClose} aria-label="Close topology settings">Close</button></header>
      <div className="topology-settings-body">
        <p>Log in below using a username/password or existing testbed credentials. Unknown or changed SSH keys are verified here. A separate session reads each selected device; your interactive terminal is untouched. Nothing is sent to an AI provider.</p>
        <div className="topology-notice"><strong>IOS / IOS-XE · IPv4 · read-only polling</strong>
          <p>Collects the categories you authorize below and associates identifiers with an IP, prefix, interface or MAC. Disables paging only for its own session. No configuration, credentials or full running-config are collected.</p>
          <p>Profiles with an unknown OS are identified with <code>show version</code> first. Routing collection proceeds only if IOS/IOS-XE is recognized.</p>
          <p>This is near-real-time polling, not streaming telemetry. Matching VRF names are treated as the same routing context within this authorized testbed; inferred relationships are labeled.</p>
        </div>
        <h3>Information to collect</h3>
        {scopeUnavailable && <p className="topology-error" role="alert">The running API does not support these collection categories yet. Restart NetClaw and reopen this panel.</p>}
        <p>Existing routing-only authorization stays routing-only until you explicitly authorize additional categories.</p>
        <div className="topology-scope-list">{TOPOLOGY_SCOPES.map(scope => <label key={scope.id} className="topology-scope">
          <input type="checkbox" checked={scopes.includes(scope.id)} disabled={busy || scope.id === 'routes'}
            onChange={event => { setAuthorized(false); setScopes(previous => event.target.checked ? [...previous, scope.id] : previous.filter(id => id !== scope.id)); }} />
          <span><strong>{scope.label}{scope.id === 'routes' ? ' (required)' : ''}</strong><span>{scope.description}</span><code>{scope.commands.join(' · ')}</code></span>
        </label>)}</div>
        <h3>Authorized devices</h3>
        {!status && <p>Loading collection status…</p>}
        {status?.availableDevices?.length === 0 && <p>No testbed profiles found. Add devices through Edit Testbed first.</p>}
        <div className="topology-device-list">{status?.availableDevices?.map(device => {
          const state = status.devices.find(value => value.id === device.id);
          const login = logins[device.id];
          const form = loginForms[device.id] || {};
          const loginBusy = loginPending === device.id;
          const changeCredential = (field, value) => {
            setAuthorized(false);
            setLoginForms(previous => ({ ...previous, [device.id]: { ...previous[device.id], [field]: value } }));
            setLogins(previous => ({ ...previous, [device.id]: null }));
          };
          return <div className="topology-device" key={device.id} ref={element => { if (element) devicePanels.current.set(device.id, element); else devicePanels.current.delete(device.id); }}>
            <label><input type="checkbox" checked={Boolean(selected[device.id])} disabled={!device.eligible || busy || Boolean(loginPending)}
              onChange={event => { setAuthorized(false); setSelected(previous => {
                const next = { ...previous }; if (event.target.checked) next[device.id] = { legacy: false }; else delete next[device.id]; return next;
              }); }} /> <strong>{device.alias || device.id}</strong> <span>{device.id} · {device.os === 'unknown' ? 'Automatic IOS detection' : device.os}</span></label>
            {!device.eligible ? <p>Unsupported profile: this collector requires IOS/IOS-XE over SSH.</p> : <>
              {selected[device.id] && <label className="topology-legacy"><input type="checkbox" checked={selected[device.id].legacy} disabled={busy || Boolean(loginPending)}
                onChange={event => { setAuthorized(false); setLogins(previous => ({ ...previous, [device.id]: null })); setSelected(previous => ({ ...previous, [device.id]: { legacy: event.target.checked } })); }} /> Allow legacy DH group14/SHA-1 for this device</label>}
              {selected[device.id] && <div className="topology-login">
                <div className="topology-login-fields">
                  <label>Username<input aria-label={`${device.id} SSH username`} autoComplete="off" value={form.username || ''} disabled={busy || Boolean(loginPending)}
                    onChange={event => changeCredential('username', event.target.value)} /></label>
                  <label>Password<input aria-label={`${device.id} SSH password`} type="password" autoComplete="new-password" value={form.password || ''} disabled={busy || Boolean(loginPending)}
                    onChange={event => changeCredential('password', event.target.value)} /></label>
                </div>
                <p>Leave both blank to use saved credentials or this API session's verified login. Entered passwords stay in server memory until revocation or API restart.</p>
                <button disabled={busy || Boolean(loginPending)} onClick={() => testLogin(device.id)}>{loginBusy ? 'Checking login…' : login?.status === 'ready' ? 'Test login again' : 'Log in / test credentials'}</button>
                {login?.status === 'ready' && <p role="status">Login verified. {login.sessionCredentials ? 'Password held for this API session only.' : 'Using saved testbed credentials.'}</p>}
                {login?.error && <p className="topology-error" role="alert">{login.error}</p>}
                {login?.status === 'host-key' && <div className="topology-host-key" role="alert">
                  <strong>{login.changed ? 'Warning: SSH host key changed' : 'Verify this device’s SSH host key'}</strong>
                  <p>{login.host}:{login.port} · {login.keyType}</p><code>{login.fingerprint}</code>
                  {login.previousFingerprint && <p>Previously trusted: <code>{login.previousFingerprint}</code></p>}
                  <p>Compare this fingerprint with the device console or a trusted administrator. Do not approve an unexpected change. Your password is not sent until the key is approved.</p>
                  <button disabled={busy || Boolean(loginPending)} onClick={() => testLogin(device.id, login.challenge)}>Trust this key and test login</button>
                  <button disabled={busy || Boolean(loginPending)} onClick={() => { setLogins(previous => ({ ...previous, [device.id]: null })); setLoginForms(previous => ({ ...previous, [device.id]: {} })); }}>Cancel</button>
                </div>}
              </div>}
              <p>{state ? `${state.phase} · ${state.stale ? 'No fresh observation' : 'Current observation'} · Last success: ${time(state.lastSuccess)}` : 'Not authorized'}</p>
              {state?.error && <p className="topology-error">{state.error}</p>}
              {state?.warning && <p>{state.warning}</p>}
              {state?.datasets?.length > 0 && <details><summary>Collected sources</summary>{state.datasets.map(source => <p key={source.id}>{source.label}: {source.failed ? 'unavailable / stale' : `${source.count} records`} · {time(source.observedAt)}</p>)}</details>}
            </>}
          </div>;
        })}</div>
        <label className="topology-interval">Poll each device after each completed collection: <select value={interval} disabled={busy}
          onChange={event => { setAuthorized(false); setIntervalValue(Number(event.target.value)); }}>
          {[15, 30, 60, 120, 300].map(value => <option key={value} value={value}>{value} seconds</option>)}
        </select></label>
        <p>At most two devices collect concurrently. Unreachable devices back off; authentication/key failures pause that device until reauthorized. Newly added devices are never authorized automatically.</p>
        <label className="topology-consent"><input type="checkbox" checked={authorized} disabled={busy} onChange={event => setAuthorized(event.target.checked)} />
          I authorize continuing read-only SSH collection of the selected information categories from these devices until I revoke it. After API restart, saved testbed credentials can resume automatically; passwords entered here must be re-entered.</label>
        <p>Authorization metadata is saved locally; device observations stay in server memory and are recollected after restart. Closing this window does not stop collection.</p>
        {(error || loadError || status?.storageError) && <p className="topology-error" role="alert">{error || loadError || status.storageError}</p>}
        {status?.audit?.length > 0 && <details><summary>Recent authorization history</summary>{status.audit.map((entry, i) => <p key={i}>{time(entry.at)} · {entry.action} · {entry.devices.join(', ') || 'all stopped'}</p>)}</details>}
      </div>
      <footer><button disabled={busy || Boolean(loginPending) || (!status?.enabled && !Object.keys(logins).length)} onClick={() => save(true)}>Stop and revoke all</button>
        <button className="topology-primary" disabled={busy || Boolean(loginPending) || !status || Boolean(loadError) || scopeUnavailable || !authorized || !Object.keys(selected).length} onClick={() => save(false)}>{busy ? 'Checking / saving…' : 'Authorize automatic collection'}</button></footer>
    </section>
  </div>, document.body);
}

const CONTEXT_GROUPS = [
  ['identities', 'Source-device identity / hardware', [['hostname','Source hostname'],['model','Source model'],['softwareVersion','Software'],['serialNumber','Source serial'],['name','Inventory item'],['description','Description'],['productId','Product ID'],['hardwareRevision','Hardware revision'],['uptime','Uptime']]],
  ['interfaces', 'Interface identifiers and health', [['interface','Interface'],['address','Address'],['description','Description'],['state','Link state'],['protocol','Line protocol'],['mtu','MTU'],['bandwidthKbps','Bandwidth (Kbps)'],['inputBitsPerSecond','Input (bits/s)'],['outputBitsPerSecond','Output (bits/s)'],['rateWindow','Rate window'],['inputErrors','Input errors'],['crcErrors','CRC errors'],['outputErrors','Output errors'],['resets','Resets']]],
  ['arp', 'IP → MAC observations', [['address','IP'],['mac','MAC'],['complete','Resolved'],['interface','Interface'],['vrf','VRF'],['ageMinutes','ARP age (minutes)']]],
  ['switching', 'MAC → VLAN / switch-port associations', [['address','IP'],['mac','MAC'],['vlan','VLAN'],['vlanName','VLAN name'],['interface','Observed port'],['type','Learning type'],['arpDevice','ARP source']]],
  ['neighbors', 'Advertised neighbor identity', [['neighbor','Neighbor device ID'],['chassisId','Neighbor chassis ID'],['managementAddress','Advertised management IP'],['interface','Source device port'],['remotePort','Neighbor port'],['platform','Neighbor platform'],['capabilities','Capabilities'],['protocol','Discovery protocol']]],
  ['routingPeers', 'Routing protocol peers', [['address','Peer IP'],['routerId','Router ID'],['remoteAs','Remote AS'],['protocol','Protocol'],['state','State'],['interface','Interface'],['vrf','VRF'],['uptime','Up/down'],['receivedPrefixes','Received prefixes']]],
];

function IdentifierContext({ context, unavailable, closest }) {
  if (!context) return null;
  return <div className="topology-identifiers">{CONTEXT_GROUPS.map(([key, label, fields]) => context[key]?.length > 0 && <section key={key}>
    <h4>{label}</h4><div className="topology-fact-grid">{context[key].map((row, index) => <div className="topology-observation" key={`${row.deviceId}:${index}`}>
      <strong>{key === 'identities' ? identitySourceLabel(row) : closestSourceLabel(row, closest, unavailable)}: {row.device}</strong>
      <span className={row.stale || unavailable ? 'topology-stale' : 'topology-current'}>{row.stale || unavailable ? 'STALE EVIDENCE' : 'OBSERVED'}</span>
      <dl>{fields.filter(([field]) => row[field] != null && row[field] !== '').map(([field, title]) => <React.Fragment key={field}><dt>{title}</dt><dd>{String(row[field])}</dd></React.Fragment>)}</dl>
      {row.match && <p>{row.match}</p>}
      {row.associationStale && <p className="topology-stale">The route/address evidence linking this record is stale.</p>}
      {row.arpObservedAt && <p>ARP source observed: {time(row.arpObservedAt)}</p>}
      {row.vlanName && <p>VLAN name observed: {time(row.vlanObservedAt)}{row.vlanStale ? ' · stale' : ''}</p>}
      <p className="tep-provenance">Collected from {row.deviceId} · {row.command} · {time(row.observedAt)}</p>
    </div>)}</div>
  </section>)}
    {context.truncated && <p>Showing at most 100 records per identifier category.</p>}
    {context.sources?.length > 0 && <details><summary>Source freshness and coverage</summary>{context.sources.map((source, i) => <p key={i}>{source.device} · {source.source}: {source.stale || unavailable ? 'unavailable / stale' : `${source.count} records`} · {time(source.observedAt)}{source.error ? ` · ${source.error}` : ''}</p>)}</details>}
  </div>;
}

export function TopologyRouteContext({ token, onOpenSettings, activeDeviceId, onContextChange }) {
  const queryKey = JSON.stringify([activeDeviceId, token.type, token.value, token.vrf || null]);
  const [snapshot, setResult] = useState(null);
  const rawResult = snapshot?.key === queryKey ? snapshot.result : null;
  const result = destinationContext(rawResult, activeDeviceId);
  const [error, setError] = useState('');
  useEffect(() => {
    onContextChange?.({ key: queryKey, result: rawResult, unavailable: Boolean(error) });
  }, [queryKey, rawResult, error, onContextChange]);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    setResult(null); setError('');
    const refresh = async () => {
      try {
        const next = await request('/api/topology/lookup', { type: token.type, value: token.value, vrf: token.vrf || null }, controller.signal);
        if (!controller.signal.aborted) { setResult({ key: queryKey, result: next }); setError(''); }
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
      if (!controller.signal.aborted) timer = window.setTimeout(refresh, 3000);
    };
    refresh();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [token.type, token.value, token.vrf, activeDeviceId]);
  const collection = result?.collection;
  return <section className="tep-tile topology-context">
    <div className="tep-section-header"><h4>Device observations</h4>
    <button className="topology-manage" onClick={onOpenSettings}>Manage authorization</button></div>
    {error ? <p role="alert">Collection service unavailable. Any previously shown observations below are not current.</p>
      : !result ? <p>Checking topology observations…</p>
        : !collection.enabled ? <p>Automatic collection is off. Authorize testbed devices to populate this context automatically.</p>
          : <p className="tep-note">Read-only collection · {collection.intervalSeconds}s polling · automatic refresh</p>}
    {result?.unsupported && <p>Automatic correlation currently supports IPv4 only.</p>}
    {collection?.enabled && <>
      <p>VRF: {token.vrf || 'unknown in transcript — results are labeled by VRF'}.</p>
      <p>{collection.devices.filter(d => !d.stale).length}/{collection.devices.length} devices have fresh observations.</p>
      {collection.scopes?.length === 1 && <p>Only routing tables are authorized. Use Manage authorization to add identity, interface, MAC/VLAN and neighbor sources.</p>}
      {result.omittedCurrentLearned && <p className="tep-note">The current router’s learned routes are omitted from destination reports. Only its local or directly connected routes are shown here.</p>}
      {!result.observations.length && !result.unsupported && <p>{result.omittedCurrentLearned ? 'No local/connected route on this router or matching route from another collected router is available.' : 'No matching routing observations yet.'} Identifier evidence may still appear below.</p>}
    </>}
    {result && <div className="topology-closest" aria-label="Closest reporting device">
      <h4>Closest reporting device{result.closest?.candidates?.length > 1 ? 's / candidates' : ''}</h4>
      {error ? <p>Undetermined — collection service unavailable.</p>
        : !result.closest ? <p>Restart the NetClaw API to enable closest-device correlation.</p>
          : !result.closest.candidates.length ? <p>Undetermined — {result.closest.reason}</p>
            : <>
              {result.closest.candidates.map(row => <div key={`${row.deviceId}:${row.vrf}:${row.kind}`}>
                <strong>{row.device}</strong><span className="topology-current">{row.kind === 'known-frontier' ? 'INFERRED' : row.kind === 'local-address' ? 'IP ON DEVICE' : row.kind === 'interface-address' ? 'VRF UNVERIFIED' : 'DIRECTLY CONNECTED'}</span>
                <p>{row.reason}</p>
                <p className="tep-provenance">{row.interface ? `${row.interface} · ` : ''}{row.prefix ? `${row.prefix} · ` : ''}VRF: {row.vrf || 'unknown'} · {time(row.observedAt)}</p>
              </div>)}
              <p className="tep-note">{result.closest.reason}</p>
              {result.closest.unresolvedVrfs?.length > 0 && <p>Undetermined in VRF: {result.closest.unresolvedVrfs.join(', ')}.</p>}
            </>}
    </div>}
    <IdentifierContext context={result?.context} unavailable={Boolean(error)} closest={result?.closest} />
    {result?.observations.length > 0 && <h4>Routing evidence</h4>}
    {result?.observations.map((row, index) => <div className="topology-observation" key={`${row.deviceId}:${row.vrf}:${index}`}>
      <strong>{closestSourceLabel(row, result?.closest, Boolean(error)).replace(/^Reporting device$/, 'Reporting router')}: {row.device}</strong><span className={row.stale || error ? 'topology-stale' : 'topology-current'}>{row.stale || error ? 'STALE / UNAVAILABLE' : 'OBSERVED'}</span>
      <p>{row.prefix} · VRF {row.vrf} · {routeLearningLabel(row)}</p>
      <p>{row.nextHop ? `Next hop ${row.nextHop}` : 'No next-hop address reported'}{row.interface ? ` · ${row.interface}` : ''}{row.metric != null ? ` · distance/metric ${row.distance}/${row.metric}` : ''}</p>
      <p className="tep-provenance">Source: {row.deviceId} · read-only SSH routing table · {time(row.observedAt)}</p>
    </div>)}
    {result?.relationships.map((row, index) => <div className="topology-observation" key={`relation:${index}`}>
      <strong>{row.from} → {row.to}</strong><p>{row.nextHop} · VRF {row.vrf}{row.stale || error ? ' · stale evidence' : ''}</p>
      <p>Correlation: {row.evidence}</p><p className="tep-provenance">Oldest supporting observation: {time(row.observedAt)}</p>
    </div>)}
    {result?.truncated && <p>Only the first 200 observations / relationships are displayed.</p>}
    {collection?.devices.some(d => d.stale || d.warning) && <details><summary>Collection gaps</summary>{collection.devices.filter(d => d.stale || d.warning).map(d => <p key={d.id}>{d.alias || d.id}: {d.error || d.warning || d.phase}</p>)}</details>}
  </section>;
}
