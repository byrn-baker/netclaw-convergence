import React, { useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import TerminalEnrichmentPopover, { useTerminalEnrichmentHover } from '../src/canvas-chat/TerminalEnrichmentPopover.jsx';

// Browser-only synthetic fixture: no API calls, credentials, or SSH sessions.
function Fixture() {
  const [mode, setMode] = useState('wide');
  const terminal = useRef(null);
  const hover = useTerminalEnrichmentHover();
  const contentRight = useCallback(() => terminal.current.getBoundingClientRect().left + 300, []);
  return <main style={{ fontFamily: 'system-ui', padding: 20 }}>
    <h1>Terminal containment test — synthetic data only</h1>
    <label>Window size <select value={mode} onChange={e => setMode(e.target.value)}>
      <option value="wide">Wide</option><option value="narrow">Narrow</option>
      <option value="clipped">Clipped / scrolled</option><option value="scaled">Canvas zoom</option>
    </select></label>
    <div data-testid="clip" style={{ marginTop: 30, height: mode === 'clipped' ? 400 : 650, overflow: 'hidden', border: '3px solid teal', width: mode === 'narrow' ? 500 : 1100, maxWidth: '95vw' }}>
      <div style={{ transform: mode === 'scaled' ? 'scale(.65)' : undefined, transformOrigin: 'top left' }}>
        <div style={{ padding: 14, background: '#faf8f0' }}>Terminal menu — details must stay below here</div>
        <div ref={terminal} data-testid="terminal" style={{ position: 'relative', height: mode === 'narrow' ? 270 : 590, overflow: 'hidden', background: '#090e14', color: '#dcecf4', padding: 12, boxSizing: 'border-box', marginTop: mode === 'clipped' ? -15 : 0 }}>
          <p>DEMO-R1# show ip route</p>
          <button onClick={e => hover.open({ value: '198.51.100.0/24' }, e.currentTarget, { pin: true })}>198.51.100.0/24</button>
          <p>All device data in this test is fake.</p>
        </div>
      </div>
    </div>
    <TerminalEnrichmentPopover {...hover.popoverProps} dockRef={terminal} getContentRight={contentRight}
      title="198.51.100.0/24" subtitle="Synthetic test data">
      {Array.from({ length: 20 }, (_, i) => <section className="tep-tile" key={i}><h4>Reporting router: DEMO-{i + 1}</h4><p>Fake observation for scroll testing.</p></section>)}
    </TerminalEnrichmentPopover>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
