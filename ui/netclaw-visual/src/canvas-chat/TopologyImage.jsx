import { randomId } from '../shared/random-id.js';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { validateTopologyImage } from './topology-image-store.js';
import { loadDeviceTopology, updateDeviceTopology, subscribeTopologyImages } from './topology-image-library.js';
import { fittedImageRect, topologyMarkers, validDevicePoints } from './topology-image-markers.js';
import './TopologyImage.css';

export function TopologyDiagram({ url, record, address, markers = [], editing = false, points = [], selected, onPlace, actualSize = false }) {
  const host = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const update = () => setSize({ width: host.current.clientWidth, height: host.current.clientHeight });
    update();
    const observer = new ResizeObserver(update); observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const rect = fittedImageRect(size.width, size.height, record.width, record.height);
  const visible = editing ? validDevicePoints(points).map(p => ({ ...p, role: p.deviceId === selected ? 'selected' : 'mapped', label: `Mapped device: ${p.deviceId}` })) : markers;
  return <div ref={host} className="topology-diagram" data-editing={editing}
    style={actualSize ? { width: record.width, height: record.height, flex: 'none', margin: 'auto' } : undefined}
    onClick={editing ? e => {
      const box = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - box.left) * size.width / box.width - rect.left) / rect.width;
      const y = ((e.clientY - box.top) * size.height / box.height - rect.top) / rect.height;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onPlace?.(x, y);
    } : undefined}>
    <img src={url} alt={`Topology for ${address}: ${record.name}`} draggable="false" />
    {visible.map(marker => <span key={marker.deviceId} className={`topology-device-light topology-device-light--${marker.role}`}
      role="img" aria-label={marker.label} title={marker.label}
      style={{ left: rect.left + marker.x * rect.width, top: rect.top + marker.y * rect.height, visibility: rect.width > 0 ? 'visible' : 'hidden' }}>
      <span className="topology-device-light-label">{editing ? marker.deviceId : marker.label}</span>
    </span>)}
  </div>;
}

function TopologyImageViewer({ url, record, address, onClose, devices, markers, startMapping, onSave, busy, error }) {
  const [actualSize, setActualSize] = useState(false);
  const [editing, setEditing] = useState(startMapping);
  const [points, setPoints] = useState(() => validDevicePoints(record.points));
  const [mappingRevision, setMappingRevision] = useState(record.revision);
  const [selected, setSelected] = useState(devices[0]?.id || '');
  const selectedPoint = points.find(p => p.deviceId === selected);
  const place = (x, y) => { if (selected) setPoints(old => [...old.filter(p => p.deviceId !== selected), { deviceId: selected, x, y }]); };
  const panel = useRef(null), closeButton = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    closeButton.current?.focus();
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key === 'Tab') {
        const controls = [...panel.current.querySelectorAll('button:not(:disabled), select, input')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); previous?.focus?.({ preventScroll: true }); };
  }, [onClose]);
  return createPortal(<div className="topology-image-viewer" data-topology-image-viewer
    onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
    <section ref={panel} role="dialog" aria-modal="true" aria-label={`Expanded topology for ${address}`}>
      <header><div><strong>Network topology · {address}</strong><span>{record.name} · {record.width} × {record.height}</span></div>
        <button aria-pressed={!actualSize} onClick={() => setActualSize(false)}>Fit to window</button>
        <button aria-pressed={actualSize} onClick={() => setActualSize(true)}>Actual size (100%)</button>
        {!editing && <button onClick={() => { setPoints(validDevicePoints(record.points)); setMappingRevision(record.revision); setEditing(true); }}>Map devices</button>}
        <button ref={closeButton} onClick={onClose} aria-label="Close expanded topology image">Close ×</button>
      </header>
      {editing && <div className="topology-map-controls">
        <label>Device <select value={selected} onChange={e => setSelected(e.target.value)}>
          {devices.map(d => <option key={d.id} value={d.id}>{d.alias || d.name || d.id} ({d.id})</option>)}
        </select></label>
        <span>Select a device, then click its symbol in the image. Or position it with these controls:</span>
        <label>Horizontal % <input type="range" min="0" max="100" step="0.1" value={(selectedPoint?.x ?? .5) * 100} onChange={e => place(Number(e.target.value) / 100, selectedPoint?.y ?? .5)} /></label>
        <label>Vertical % <input type="range" min="0" max="100" step="0.1" value={(selectedPoint?.y ?? .5) * 100} onChange={e => place(selectedPoint?.x ?? .5, Number(e.target.value) / 100)} /></label>
        <button disabled={!selectedPoint || busy} onClick={() => setPoints(old => old.filter(p => p.deviceId !== selected))}>Remove point</button>
        <button disabled={busy} onClick={async () => { if (await onSave(points, mappingRevision)) setEditing(false); }}>{busy ? 'Saving…' : 'Save mappings'}</button>
        <button disabled={busy} onClick={() => setEditing(false)}>Cancel mapping</button>
        {error && <span role="alert">{error}</span>}
      </div>}
      <div className="topology-image-viewer-body" data-actual-size={actualSize}>
        <TopologyDiagram {...{ url, record, address, markers, editing, points, selected, actualSize }} onPlace={place} />
      </div>
      <footer>Green: current terminal router · Blinking red: closest reporting device · Not health indicators. {editing ? 'Positions are manually confirmed, not AI guesses. Closing discards unsaved mappings.' : 'Escape to close.'}</footer>
    </section>
  </div>, document.body);
}

export default function TopologyImage({ address, temporary = false, onEngage, activeDeviceId, devices = [], token = { type: 'ip', value: address }, context }) {
  const [record, setRecord] = useState(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(!temporary);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [startMapping, setStartMapping] = useState(false);
  const [sharing, setSharing] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMode, setShareMode] = useState('selected');
  const [shareTargets, setShareTargets] = useState([]);
  const [replaceShared, setReplaceShared] = useState(false);
  const [notice, setNotice] = useState('');
  const closeViewer = React.useCallback(() => setExpanded(false), []);
  const input = useRef(null), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    let sequence = 0;
    let initial = true;
    const refresh = async () => {
      const request = ++sequence;
      try {
        const next = await loadDeviceTopology(activeDeviceId);
        if (!cancelled && request === sequence) { setRecord(next.record); setSharing(next); }
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled && initial) { initial = false; setBusy(false); } }
    };
    const unsubscribe = temporary ? () => {} : subscribeTopologyImages(refresh);
    if (!temporary) void refresh();
    return () => { cancelled = true; alive.current = false; unsubscribe(); };
  }, [activeDeviceId, temporary]);
  useEffect(() => {
    if (!record?.file) { setUrl(''); return; }
    const next = URL.createObjectURL(record.file); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [record?.file]);
  const lights = topologyMarkers({ activeDeviceId, devices, token, context, points: record?.points });
  const update = async action => {
    const next = await updateDeviceTopology({ ...action, deviceId: activeDeviceId });
    if (alive.current) { setRecord(next.record); setSharing(next); }
    return next;
  };
  const saveMappings = async (points, revision) => {
    setBusy(true); setError('');
    try {
      const next = { ...record, points: validDevicePoints(points) };
      if (!temporary) await update({ kind: 'points', imageId: sharing.imageId, revision, points: next.points });
      else if (alive.current) setRecord(next);
      return true;
    } catch (e) { if (alive.current) setError(e.message); return false; }
    finally { if (alive.current) setBusy(false); }
  };
  const upload = async file => {
    if (!file) return;
    setBusy(true); setError(''); setConfirmRemove(false);
    try {
      await validateTopologyImage(file);
      let bitmap;
      try { bitmap = await createImageBitmap(file); }
      catch { throw new Error('This image could not be decoded. Choose another image.'); }
      const { width, height } = bitmap; bitmap.close();
      if (width * height > 24000000 || width > 12000 || height > 12000) throw new Error('Image is too large: use at most 24 megapixels and 12,000 pixels per side.');
      const next = { file, name: file.name, width, height, savedAt: Date.now() };
      if (!temporary) await update({ kind: 'upload', id: randomId(), record: next });
      else if (alive.current) setRecord(next);
      if (alive.current) { setShareOpen(false); setNotice('Image applies to every interface, IP, route and VRF on this device.'); }
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError('');
    try {
      if (!temporary) {
        await update({ kind: 'detach' });
      }
      if (alive.current) { setRecord(null); setConfirmRemove(false); }
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  };
  const share = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const ids = shareMode === 'network' && replaceShared ? devices.map(d => d.id) : shareMode === 'selected' ? shareTargets : [];
      await update({ kind: 'share', imageId: sharing.imageId, revision: record.revision,
        deviceIds: ids, network: shareMode === 'network', replace: replaceShared });
      if (alive.current) { setShareOpen(false); setNotice(shareMode === 'network' ? 'Network default saved. Device-specific images remain unless replacement was selected.' : 'Sharing saved. Existing device images were preserved unless replacement was selected.'); }
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  };
  const changeAssignment = async kind => {
    setBusy(true); setError('');
    try { await update({ kind, imageId: sharing?.imageId }); }
    catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  };
  return <section className="topology-image" aria-label={`Topology image for ${address}`}>
    <div className="topology-image-heading"><h4>Network topology</h4><span>{temporary ? 'Preview only' : 'Browser-local'}</span></div>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload network topology image" hidden
      onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void upload(file); }} />
    {url ? <figure><TopologyDiagram {...{ url, record, address }} markers={lights.markers} />
      <figcaption>{record.name} · {record.width} × {record.height}</figcaption></figure>
      : <button className="topology-image-placeholder" disabled={busy} onClick={() => { onEngage?.(); input.current.click(); }}>
        <span aria-hidden="true">＋</span><strong>{busy ? 'Loading topology…' : 'Upload a topology image'}</strong>
        <span>For {address} · PNG, JPEG or WebP · up to 5 MB</span>
      </button>}
    {record && <div className="topology-image-actions">
      <button disabled={busy || !url} onClick={() => { onEngage?.(); setStartMapping(false); setExpanded(true); }}>Expand image</button>
      <button disabled={busy || !url || !devices.length} onClick={() => { onEngage?.(); setStartMapping(true); setExpanded(true); }}>Map devices</button>
      <button disabled={busy || temporary} title={temporary ? 'Sharing is disabled in the temporary demo.' : 'Share this image and its device mappings with other device views.'}
        onClick={() => { onEngage?.(); setShareTargets([]); setReplaceShared(false); setShareOpen(!shareOpen); }}>Share topology</button>
      <button disabled={busy} onClick={() => { onEngage?.(); input.current.click(); }}>{busy ? 'Saving…' : 'Replace image'}</button>
      <button disabled={busy} onClick={() => { onEngage?.(); setConfirmRemove(true); }}>Remove from this device</button>
    </div>}
    {confirmRemove && <div className="topology-image-actions" role="group" aria-label="Confirm removal">
      <span>Remove from this device across all IPs, interfaces and VRFs? Other devices using this topology and your original file stay untouched.</span>
      <button disabled={busy} onClick={remove}>Confirm remove</button><button disabled={busy} onClick={() => setConfirmRemove(false)}>Cancel</button>
    </div>}
    {shareOpen && record && <div className="topology-sharing" role="group" aria-label="Share topology">
      <h4>Share topology</h4>
      <p>One shared image and mapping set. Changes to mappings appear in every linked device view. Green/red lights still follow each terminal’s context.</p>
      <label>Share with <select value={shareMode} disabled={busy} onChange={e => setShareMode(e.target.value)}>
        <option value="selected">Selected devices</option><option value="network">Network-wide default</option>
      </select></label>
      {shareMode === 'selected' ? <div className="topology-sharing-devices">{devices.filter(d => d.id !== activeDeviceId).map(d => <label key={d.id}>
        <input type="checkbox" disabled={busy} checked={shareTargets.includes(d.id)} onChange={e => setShareTargets(old => e.target.checked ? [...old, d.id] : old.filter(id => id !== d.id))} />{d.alias || d.name || d.id} ({d.id})
      </label>)}</div> : <p>Default for all device views without their own image, including devices added later. Replaces any previous network default.</p>}
      <label><input type="checkbox" disabled={busy} checked={replaceShared} onChange={e => setReplaceShared(e.target.checked)} />Replace existing images on {shareMode === 'network' ? 'all currently listed devices' : 'the selected devices'} (including devices that opted out).</label>
      <p>Browser-local sharing only. No router uploads, other-user synchronization or RBAC publishing.</p>
      <div className="topology-image-actions"><button disabled={busy || (shareMode === 'selected' && !shareTargets.length)} onClick={share}>Apply sharing</button>
        <button disabled={busy} onClick={() => setShareOpen(false)}>Cancel</button>
        {sharing?.network && <button disabled={busy} onClick={() => changeAssignment('stop-network')}>Stop using as network default</button>}
      </div>
    </div>}
    {sharing?.networkAvailable && !sharing.inherited && <div className="topology-image-actions"><button disabled={busy} onClick={() => { onEngage?.(); void changeAssignment('inherit'); }}>Use network default for this device</button></div>}
    {record && sharing && <p className="topology-image-note">{sharing.inherited ? 'Using network default.' : 'Device-wide topology.'} {sharing.network ? 'Also the network-wide default. ' : ''}{sharing.linkedDevices.length > 1 ? `Linked to ${sharing.linkedDevices.length} device views. ` : ''}Replacing the image affects only this device; use Share topology to distribute the replacement.</p>}
    {notice && <p role="status" className="topology-image-note">{notice}</p>}
    {record && <div className="topology-image-legend"><span>● Green: current terminal</span><span>● Red (blinking): closest reporter</span>
      <p>{lights.note}</p>{lights.missing.length > 0 && <p>Use Map devices to place: {lights.missing.join(', ')}.</p>}
      {lights.markers.map(m => <p key={m.deviceId}>{m.label}</p>)}</div>}
    <p className="topology-image-note">{temporary ? 'Preview only — cleared when this pane closes.' : 'Applies to all interfaces, IPs seen on this device, routes and VRFs. Saved in this browser only.'} Not sent to the router or AI. Lights indicate roles, not health or alarms.</p>
    {error && <p role="alert" className="topology-image-error">{error}</p>}
    {expanded && url && record && <TopologyImageViewer key={sharing?.imageId || record.savedAt} {...{ url, record, address, devices, startMapping, busy, error }} markers={lights.markers} onSave={saveMappings} onClose={closeViewer} />}
  </section>;
}
