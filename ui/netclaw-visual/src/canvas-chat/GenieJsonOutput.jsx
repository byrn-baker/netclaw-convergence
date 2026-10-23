import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { capturedGenieOutput, genieArtifact } from './genie-output.js';
import './GenieJsonOutput.css';

const OS_NAMES = ['ios', 'iosxe', 'iosxr', 'nxos', 'junos', 'eos', 'asa', 'aireos', 'linux'];
export default function GenieJsonOutput({ source, deviceId, deviceLabel, deviceOs, onParsed }) {
  const captured = useMemo(() => capturedGenieOutput(source), [source]);
  const [command, setCommand] = useState(captured.command);
  const [os, setOs] = useState(OS_NAMES.includes(deviceOs) ? deviceOs : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [artifact, setArtifact] = useState(null);
  const requestRef = useRef(null);
  const callback = useRef(onParsed);
  callback.current = onParsed;
  const invalidate = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setBusy(false); setArtifact(null); setError(''); callback.current(null);
  };
  useLayoutEffect(() => {
    invalidate();
    setCommand(captured.command);
    setOs(OS_NAMES.includes(deviceOs) ? deviceOs : '');
    return () => { requestRef.current?.abort(); callback.current(null); };
  }, [source, deviceId, deviceOs]);

  const parse = async (event) => {
    event.preventDefault();
    invalidate();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    try {
      const response = await fetch('/api/terminal/parse/genie', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, os, output: captured.output }), signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 404
        ? 'Restart the NetClaw API to enable the new Genie parser endpoint.'
        : result.error || 'Genie parsing failed.');
      const next = genieArtifact(result, deviceLabel);
      if (controller.signal.aborted) return;
      setArtifact(next);
      callback.current({ source, deviceId, artifact: next, parsedSource: captured.output });
    } catch (e) { if (!controller.signal.aborted) setError(e.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <section className="genie-json" aria-label="Genie JSON output">
    <form onSubmit={parse} className="genie-controls">
      <label>Parser command<input aria-label="Genie parser command" value={command} placeholder="show ip route"
        onChange={e => { invalidate(); setCommand(e.target.value); }} /></label>
      <label>Device OS<select aria-label="Genie device OS" value={os} onChange={e => { invalidate(); setOs(e.target.value); }}>
        <option value="">Choose OS</option>{OS_NAMES.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <button type="submit" disabled={busy || !os || !command.trim() || !captured.output.trim()}>{busy ? 'Parsing…' : 'Parse with Genie'}</button>
    </form>
    <p className="genie-note">Local pyATS / Genie · no AI or API key · no commands executed.
      {captured.latest ? ' Using the latest captured show/display response.' : ' Enter the full command that produced the selected output.'}</p>
    {error && <p role="alert" className="genie-error">{error}</p>}
    {artifact ? <>
      <p className="genie-note">Genie {artifact.parserVersion} · {artifact.command} · {artifact.os} · JSON validated</p>
      <pre aria-label="Validated Genie JSON preview">{artifact.content}</pre>
    </> : <div className="genie-empty">{busy ? 'Parsing captured output and validating the result…' : 'Choose Parse with Genie to produce native structured JSON. Unsupported output will not be replaced with locally generated nesting.'}</div>}
    <details className="genie-setup"><summary>Parser setup / input</summary>
      <p>This reuses NetClaw’s pyATS / Genie libraries via its existing <code>PYATS_PYTHON</code> setting (default: python3). It does not require an API key or a second pyATS installation. For a Windows-hosted API with Linux pyATS, WSL Ubuntu must be running; <code>PYATS_WSL_DISTRO</code> can select your existing distribution. Restart the API after changing its runtime settings.</p>
      <p>Use a complete, unfiltered command response. Genie parser availability depends on the OS, command and installed parser version. Schema validation does not verify the current device state.</p>
      <pre aria-label="Captured input for Genie">{captured.output || 'No command output captured.'}</pre>
    </details>
  </section>;
}
