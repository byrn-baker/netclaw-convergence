import React, { useEffect, useState } from 'react';
import { intentActivity } from './intent-activity.js';

export default function TerminalIntentActivity({ phase, error, message, connected, executionEnabled = false }) {
  const activity = intentActivity({ phase, error, message, connected, executionEnabled });
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    if (!activity.busy) return;
    const start = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [phase, activity.busy]);
  const color = activity.tone === 'error' ? '#EF8B92' : activity.tone === 'review' ? '#F5C06A' : '#7FDBCA';
  return <section aria-label="Intent workflow status" style={{ padding: 11, border: `1px solid ${color}66`, borderRadius: 7, background: '#111B26', lineHeight: 1.5 }}>
    <div role="status" aria-live="polite" style={{ fontSize: 12, fontWeight: 750, color }}>{activity.title}</div>
    {activity.busy && <div aria-live="off" style={{ color: '#CBD5E1', fontSize: 11, marginTop: 5 }}>Elapsed in this step: {elapsed}s</div>}
    <p style={{ margin: '7px 0 0', color: '#BAC8D8', fontSize: 11 }}>{activity.detail}</p>
    {activity.busy && elapsed >= 30 && <p style={{ margin: '7px 0 0', color: '#F5C06A', fontSize: 11 }}>
      {phase === 'capture'
        ? 'Still waiting for terminal output. No configuration is being sent. Do not submit the command again while this capture is active.'
        : 'Taking longer than usual. This request is still pending, but the interface cannot tell whether the provider is progressing. No need to submit it twice.'}
    </p>}
  </section>;
}
