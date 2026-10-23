import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ObservabilityContext.css';

async function api(path, body, signal) {
  const response = await fetch(`/api/observability/${path}`, { signal, ...(body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : {}) });
  if (response.status === 404) throw new Error('Restart the NetClaw API to load observability integrations.');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Observability service unavailable.');
  return data;
}
const date = value => value ? new Date(value).toLocaleString() : 'Not collected';
const defaults = {
  infoblox: { endpoint: '', scope: 'default' },
  thousandeyes: { endpoint: 'https://api.thousandeyes.com/v7', scope: '' },
  kubernetes: { endpoint: '', scope: 'default' },
  otel: { endpoint: 'http://localhost:4318/v1/metrics', scope: '' },
};
const scopeLabels = { infoblox: 'NIOS network view', thousandeyes: 'Existing network test IDs (up to five, comma-separated)', kubernetes: 'Namespace (one only)' };
function ProviderForm({ provider, onChange }) {
  const [form, setForm] = useState(() => ({ intervalSeconds: 300, ...defaults[provider.id], ...provider.config, username: '', secret: '', authorized: false }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const patch = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const save = async disable => {
    setBusy(true); setError(''); controller.current = new AbortController();
    try {
      const data = await api(provider.id, disable ? { enabled: false } : { ...form, enabled: true }, controller.current.signal);
      setForm(previous => ({ ...previous, secret: '', authorized: false })); onChange(data);
    } catch (e) { if (e.name !== 'AbortError') setError(e.message); }
    finally { setBusy(false); }
  };
  if (!provider.available) return <p>{provider.description}</p>;
  return <form onSubmit={event => { event.preventDefault(); save(false); }}>
    <p>{provider.description}</p>
    {['infoblox', 'thousandeyes'].includes(provider.id) && <label className="obs-check"><input type="checkbox" name="useExisting" checked={Boolean(form.useExisting)} onChange={patch} />Use existing NetClaw environment credentials {provider.id === 'infoblox' ? 'and WAPI URL' : '(TE_TOKEN)'}</label>}
    <div className="obs-fields">
      <label>Endpoint<input name="endpoint" value={form.endpoint} onChange={patch} required disabled={form.useExisting && provider.id === 'infoblox'} placeholder={provider.id === 'infoblox' ? 'https://grid.example/wapi/v2.13/' : 'https://api.example:6443'} /></label>
      {scopeLabels[provider.id] && <label>{scopeLabels[provider.id]}<input name="scope" value={form.scope} onChange={patch} required /></label>}
      {provider.id === 'thousandeyes' && <label>Account group ID (optional)<input name="accountId" value={form.accountId || ''} onChange={patch} inputMode="numeric" /></label>}
      {provider.id !== 'otel' && <label>Site / VRF context label (optional)<input name="context" value={form.context || ''} onChange={patch} placeholder="Example: Atlanta / CORP — manually mapped" /></label>}
      {provider.id === 'infoblox' && !form.useExisting && <label>Read-only username<input name="username" value={form.username} onChange={patch} required autoComplete="off" /></label>}
      {!form.useExisting && <label>{provider.id === 'infoblox' ? 'Password' : 'Bearer token'}{provider.id === 'otel' ? ' (optional)' : ''}<input name="secret" type="password" value={form.secret} onChange={patch} required={provider.id !== 'otel'} autoComplete="new-password" placeholder="Session only — not saved to disk" /></label>}
      <label>{provider.id === 'otel' ? 'Export' : 'Poll'} interval (seconds)<input name="intervalSeconds" type="number" min="60" max="3600" value={form.intervalSeconds} onChange={patch} required /></label>
    </div>
    {provider.id !== 'otel' && <p className="obs-note">Context labels are annotations, not verified VRF mappings. Matching an address does not prove ownership. First-page coverage is explicitly labeled if capped.</p>}
    <label className="obs-check obs-consent"><input name="authorized" type="checkbox" checked={form.authorized} onChange={patch} />{provider.id === 'otel'
      ? 'I authorize sending NetClaw integration-health counts to this endpoint now and periodically until disabled or the API restarts.'
      : 'I authorize scoped read-only API requests now and periodically until disabled or the API restarts. Use a least-privilege credential.'}</label>
    <p className="obs-error" role="alert">{error || provider.error}</p>
    <div className="obs-actions"><button type="submit" disabled={busy || !form.authorized}>{busy ? 'Applying…' : provider.status === 'disabled' ? 'Authorize and connect' : 'Update and reconnect'}</button>
      <button type="button" disabled={busy || provider.status === 'disabled'} onClick={() => save(true)}>Disable and clear cache</button></div>
  </form>;
}

export function ObservabilitySettings({ onClose }) {
  const [status, setStatus] = useState(null), [error, setError] = useState('');
  const [active, setActive] = useState('infoblox');
  const panel = useRef(null);
  useEffect(() => {
    const abort = new AbortController(); let timer;
    const refresh = async () => {
      try { setStatus(await api('status', null, abort.signal)); setError(''); }
      catch (e) { if (!abort.signal.aborted) setError(e.message); }
      if (!abort.signal.aborted) timer = setTimeout(refresh, 5000);
    };
    refresh(); return () => { abort.abort(); clearTimeout(timer); };
  }, []);
  useEffect(() => {
    const previous = document.activeElement; panel.current?.focus();
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key === 'Tab') {
        const items = [...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')];
        if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === panel.current)) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('keydown', key, true); previous?.focus?.(); };
  }, [onClose]);
  const provider = status?.providers.find(p => p.id === active);
  return createPortal(<div className="obs-backdrop" onMouseDown={e => e.stopPropagation()}><section className="obs-settings" role="dialog" aria-modal="true" aria-labelledby="obs-title" tabIndex={-1} ref={panel}>
    <header><div><h2 id="obs-title">Observability integrations</h2><p>Your CLI stays unchanged. Add read-only context where you work.</p></div><button onClick={onClose}>Close</button></header>
    <div className="obs-body">
      <p className="obs-session">Session-only authorization and credentials. Nothing connects by default. API restart disables these integrations; closing this window does not. Kubernetes is optional.</p>
      {error && <p role="alert" className="obs-error">{error}</p>}
      <nav aria-label="Observability providers">{status?.providers.map(p => <button key={p.id} aria-pressed={active === p.id} onClick={() => setActive(p.id)}>{p.name}<small>{p.status}{p.stale ? ' · stale' : ''}</small></button>)}</nav>
      {provider && <div className="obs-provider"><h3>{provider.name} <span className="obs-badge">{provider.status === 'ready' ? 'Verified API response' : provider.status}</span></h3>
        {provider.updatedAt && <p>Last successful {active === 'otel' ? 'export' : 'collection'}: {date(provider.updatedAt)}{active !== 'otel' && ` · ${provider.count} cached records`}{provider.partial && ' · PARTIAL COVERAGE (first page / cap)'}</p>}
        <ProviderForm key={active} provider={provider} onChange={setStatus} />
      </div>}
    </div>
    <footer>HTTPS verification stays on. Hover reads the cache; it never runs extra commands or vendor requests.</footer>
  </section></div>, document.body);
}

export function ObservabilityContext({ token, onOpenSettings }) {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const value = token?.value;
  useEffect(() => {
    setData(null); setError('');
    if (!value) return undefined;
    const abort = new AbortController(); let timer;
    const refresh = async () => {
      try { setData(await api('lookup', { value }, abort.signal)); setError(''); }
      catch (e) { if (!abort.signal.aborted) setError(e.message); }
      if (!abort.signal.aborted) timer = setTimeout(refresh, 10000);
    };
    refresh(); return () => { abort.abort(); clearTimeout(timer); };
  }, [value]);
  return <section className="tep-tile obs-context"><div className="obs-heading tep-section-header"><h4>Observability & inventory</h4><button onClick={onOpenSettings}>Integrations</button></div>
    <p className="tep-note">Provider evidence — not proof of IP ownership. Verify site / VRF before correlating.</p>
    {error && <p role="status">{error}</p>}
    {!error && !data && <p>Reading cached context…</p>}
    {data && <>
      <p>{data.sources.filter(s => s.status !== 'disabled').map(s => `${s.name}: ${s.status}${s.partial ? ' (partial)' : ''}${s.stale ? ' (stale)' : ''}`).join(' · ') || 'Optional providers are disabled.'}</p>
      {!data.matches.length && <p>No matching records in the current cache. This is not proof that the address is unused.</p>}
      <div className="obs-evidence-grid">{data.matches.map((record, i) => <article key={`${record.provider}-${i}`}>
        <h4>{record.title} <span className="obs-badge">{record.stale ? 'STALE' : 'CACHED'}</span></h4>
        <p>{record.kind}</p><p><strong>{record.address}</strong> · {record.match}</p>
        <dl>{Object.entries(record.fields).map(([key, item]) => <React.Fragment key={key}><dt>{key}</dt><dd>{String(item)}</dd></React.Fragment>)}</dl>
        <p className="obs-note">Source: {record.provider} · scope: {record.scope}<br />Context: {record.context}<br />Collected: {date(record.collectedAt)}</p>
      </article>)}</div>
      {data.truncated && <p>Showing 40 of {data.total} matches. Select a narrower prefix for more focused context.</p>}
    </>}
  </section>;
}
