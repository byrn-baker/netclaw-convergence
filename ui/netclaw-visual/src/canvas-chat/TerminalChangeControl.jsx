import React, { useEffect, useId, useState } from 'react';

const controlStyle = { background: '#0D1722', color: '#DAE6EF', border: '1px solid #3C5264', borderRadius: 5, padding: 7, width: '100%', fontSize: 11 };
export default function TerminalChangeControl({ devices, value, onChange, busy }) {
  const modeId = useId();
  const [policy, setPolicy] = useState(null), [selected, setSelected] = useState([]);
  const [confirmed, setConfirmed] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  async function load() {
    try {
      const response = await fetch('/api/terminal/intent/change-policy');
      if (response.status === 404) throw new Error('Restart the NetClaw API, then reload these settings to enable Local/Lab change control.');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Restart the API to enable Change control.');
      setPolicy(data); setSelected(data.devices.map(d => d.id));
      onChange({ ...value, policyRevision: data.revision }); setError('');
    } catch (err) { setError(err.message || 'Change control unavailable.'); }
  }
  useEffect(() => { void load(); }, []);
  async function save(enabled) {
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/terminal/intent/change-policy', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: policy.revision, enabled, deviceIds: selected, confirmLab: confirmed }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save policy.');
      setPolicy(data); setConfirmed(false);
      onChange({ mode: enabled ? 'local-lab' : 'production', policyRevision: data.revision, targetDeviceIds: enabled ? selected : [] });
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  const disabled = busy || saving;
  return <section aria-label="Intent change control" style={{ border: '1px solid #3C5264', borderRadius: 7, padding: 10, fontSize: 11, color: '#C3D1DE', lineHeight: 1.5 }}>
    <label htmlFor={modeId} style={{ fontWeight: 750 }}>Change control</label>
    <select id={modeId} aria-label="Change control mode" value={value.mode} disabled={disabled || !policy}
      onChange={e => onChange({ ...value, mode: e.target.value })} style={{ ...controlStyle, marginTop: 6 }}>
      <option value="production">Production · ServiceNow approval</option>
      <option value="local-lab">Local / Lab · local change record</option>
    </select>
    {value.mode === 'production' ? <p>Production approval requirements remain in effect.</p> : <>
      <p style={{ color: '#F1C47C' }}>Lab devices only. Your explicit change request authorizes the stated task; NetClaw records baseline, rollback and verification locally.</p>
      {policy?.enabled && <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: '8px 0' }}>
        <legend>Devices for this request</legend>
        {policy.devices.map(d => <label key={d.id} style={{ display: 'block', marginTop: 5 }}>
          <input type="checkbox" disabled={!d.valid} checked={value.targetDeviceIds.includes(d.id)} onChange={e => onChange({ ...value, targetDeviceIds: e.target.checked ? [...value.targetDeviceIds, d.id] : value.targetDeviceIds.filter(id => id !== d.id) })} />
          {' '}{d.name} · {d.host}{!d.valid ? ' — endpoint changed; reauthorize' : ''}
        </label>)}
      </fieldset>}
      {!policy?.enabled && <p>No lab devices authorized yet. Set them below before submitting.</p>}
    </>}
    <details>
      <summary style={{ cursor: 'pointer' }}>Manage lab authorization</summary>
      <p>Only these selected SSH endpoints can use Local/Lab mode. This does not change collector permissions or authorize background configuration.</p>
      <fieldset disabled={disabled || !policy} style={{ maxHeight: 170, overflowY: 'auto', border: '1px solid #304455', padding: 6 }}>
        <legend>Designated lab devices</legend>
        {devices.filter(d => d.supported).map(d => <label key={d.id} style={{ display: 'block', margin: '5px 0' }}>
          <input type="checkbox" checked={selected.includes(d.id)} onChange={e => { setConfirmed(false); setSelected(e.target.checked ? [...selected, d.id] : selected.filter(id => id !== d.id)); }} />
          {' '}{d.alias || d.name || d.id} · {d.host}:{d.port}
        </label>)}
      </fieldset>
      <label style={{ display: 'block', margin: '9px 0' }}><input type="checkbox" checked={confirmed} disabled={disabled} onChange={e => setConfirmed(e.target.checked)} /> I own/administer these lab devices and authorize local change control for them.</label>
      <button type="button" disabled={disabled || !policy || !confirmed || !selected.length} onClick={() => save(true)} style={controlStyle}>Save lab authorization</button>
      <button type="button" disabled={disabled || !policy?.enabled} onClick={() => save(false)} style={{ ...controlStyle, marginTop: 6 }}>Disable lab changes</button>
    </details>
    {error && <p role="alert" style={{ color: '#EF8B92' }}>{error}</p>}
    <button type="button" disabled={disabled} onClick={load} style={{ ...controlStyle, marginTop: 7 }}>Reload settings</button>
  </section>;
}
