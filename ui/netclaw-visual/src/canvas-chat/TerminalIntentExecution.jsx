import React, { useEffect, useRef, useState } from 'react';

export function TerminalIntentLiveActivity({ run }) {
  const log = useRef(null);
  const [follow, setFollow] = useState(true);
  const events = run.activity || [];
  const active = ['submitting', 'running'].includes(run.status);
  useEffect(() => { if (follow && log.current) log.current.scrollTop = log.current.scrollHeight; }, [events.length, events.at(-1)?.id, follow]);
  return <section aria-label="Live execution activity" style={{ flexShrink: 0, minWidth: 0, border: '1px solid #335663', borderRadius: 9, background: '#0E1822', color: '#D5E3EE', overflow: 'hidden' }}>
    <header style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '12px 14px', borderBottom: '1px solid #2A3D4D' }}>
      <strong style={{ flex: 1, fontSize: 13 }}>Live execution activity</strong>
      <span style={{ color: '#85CCC5', fontSize: 11 }}>{active ? 'Updating automatically' : 'Activity record'}</span>
      <label style={{ fontSize: 11 }}><input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)} /> Follow latest</label>
    </header>
    <div style={{ padding: '10px 14px', color: '#A7BBCD', fontSize: 11, lineHeight: 1.5 }}>
      {run.activityStatus === 'connected' ? 'Showing observed tool calls and returned output for this request.' :
        run.activityStatus === 'waiting' ? 'Connecting to this request’s activity stream. No tool activity observed yet.' :
          'Detailed tool activity is unavailable. Actual submission events and agent reports are still shown below.'}
      {' '}Output previews are filtered and bounded. Internal reasoning is not displayed. A tool returning output is not proof of success.
    </div>
    {run.activityDropped > 0 && <p style={{ padding: '0 14px', fontSize: 11, color: '#F5C06A' }}>{run.activityDropped} older events omitted; showing the latest {events.length} within the activity size limit.</p>}
    <div ref={log} role="log" aria-label="Intent tool activity" aria-live="off" onScroll={() => {
      const el = log.current;
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 40) setFollow(false);
    }} style={{ maxHeight: 420, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 14px 14px' }}>
      {!events.length && <p style={{ fontSize: 12 }}>No execution events received yet.</p>}
      {events.map(event => <article key={event.id} style={{ borderLeft: `2px solid ${event.kind === 'tool-error' ? '#EF8B92' : event.source === 'gateway-transcript' ? '#58BDB3' : '#66819B'}`, marginTop: 12, padding: '3px 0 3px 12px', overflowWrap: 'anywhere' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <time dateTime={event.at} style={{ color: '#91A8BB', font: '10px monospace' }}>{new Date(event.at).toLocaleTimeString()}</time>
          <strong style={{ fontSize: 12, color: event.kind === 'tool-error' ? '#EF8B92' : '#D5E3EE' }}>{event.title}</strong>
        </div>
        <div style={{ marginTop: 3, fontSize: 10, color: '#91A8BB' }}>{event.source === 'gateway-transcript' ? 'Observed Gateway tool activity' : event.kind === 'report' ? 'Agent-reported evidence' : 'NetClaw execution status'}</div>
        {event.detail && (event.detail.length > 900 ? <details style={{ marginTop: 7 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11 }}>View returned output ({event.detail.length.toLocaleString()} characters)</summary>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11, lineHeight: 1.6 }}>{event.detail}</pre>
        </details> : <pre style={{ margin: '7px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11, lineHeight: 1.6 }}>{event.detail}</pre>)}
      </article>)}
    </div>
  </section>;
}

export function executionResultText(run) {
  const report = run?.report || {};
  return [report.summary, report.question && `Question: ${report.question}`,
    ...(report.actions || []).map(a => `${a.kind === 'configuration' ? 'Configuration' : 'Check'} on ${a.device}: ${a.summary}`),
    ...(report.verification || []).map(v => `Verification on ${v.device}: ${v.summary}`),
    report.response,
  ].filter(Boolean).join('\n\n');
}

export default function TerminalIntentExecution({ run }) {
  const [now, setNow] = useState(Date.now());
  const active = ['submitting', 'running'].includes(run.status);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [run.id, active]);
  const title = {
    submitting: 'Submitting your request', running: 'NetClaw is working on your request',
    needs_input: 'NetClaw needs your answer', blocked: 'Execution blocked',
    completed: 'Agent reports the requested outcome complete',
    incomplete: 'Stopped before completion', uncertain: 'Execution outcome uncertain',
  }[run.status] || 'Execution status unavailable';
  return <section aria-label="NetClaw execution status" style={{ border: '1px solid #58BDB366', borderRadius: 7, background: '#111B26', padding: 11, fontSize: 11, lineHeight: 1.5 }}>
    <div role="status" style={{ color: active ? '#7FDBCA' : run.status === 'completed' ? '#9DE1B5' : '#F5C06A', fontWeight: 750, fontSize: 12 }}>{title}</div>
    {run.changeControl?.mode === 'local-lab' && <p style={{ color: '#F1C47C' }}>Local/Lab record: <a style={{ color: 'inherit' }} href={`/api/terminal/intent/changes/${encodeURIComponent(run.id)}`} target="_blank" rel="noreferrer">{run.id.slice(0, 8)}</a><br />Phase: {run.changeControl.phase === 'apply' ? 'Apply and verify' : 'Read-only preparation'} · no ServiceNow required.<br />{run.changeControl.devices?.map(d => d.name || d.id).join(', ')}</p>}
    {active && <>
      <p aria-live="off">Elapsed: {Math.max(0, Math.floor((now - Date.parse(run.startedAt)) / 1000))}s · work segment {run.segment || 1}</p>
      <p>Follow the live execution activity in this conversation for tool requests, returned output and verification reports. Quiet periods mean no new activity has been received, not that the request is complete.</p>
      <p>Keep this request running. Closing this pane does not cancel the agent. Do not submit a duplicate.</p>
    </>}
    {run.report?.summary && <p style={{ whiteSpace: 'pre-wrap' }}>{run.report.summary}</p>}
    {run.report?.question && <p style={{ color: '#F5C06A', whiteSpace: 'pre-wrap' }}>{run.report.question}</p>}
    {['needs_input', 'blocked'].includes(run.status) && <p>Answer below or resolve the stated prerequisite. You do not need to request a separate CLI proposal.</p>}
    {run.status === 'completed' && <p>Review the agent's actions and verification evidence in the conversation. This is the agent's report, not an independent UI verification.</p>}
    {!!run.steps?.length && <details><summary>Agent progress ({run.steps.length} reports)</summary>
      {run.steps.map((step, i) => <p key={i} style={{ whiteSpace: 'pre-wrap' }}>{i + 1}. {step.summary}</p>)}
    </details>}
  </section>;
}
