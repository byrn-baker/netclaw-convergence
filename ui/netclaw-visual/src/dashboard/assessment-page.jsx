import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AssessmentView from './Assessment.jsx';
import './dashboard.css';
function EvidencePage() {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const controller = new AbortController(), query = new URLSearchParams(location.search);
    const task = query.get('task'), id = query.get('assessment');
    if (!task || !id) { setState({ error: 'No trusted assessment reference supplied.' }); return; }
    fetch(`/api/hud/tasks/${encodeURIComponent(task)}/assessments/${encodeURIComponent(id)}`, { signal: controller.signal, cache: 'no-store' }).then(async response => { if (!response.ok) throw Error(); setState(await response.json()); }).catch(error => { if (error.name !== 'AbortError') setState({ error: 'Assessment unavailable. Its session and task ownership must be verified.' }); });
    return () => controller.abort();
  }, []);
  return <main><a href="/canvas.html">← Canvas</a><div className="page-heading"><h1>Science Officer evidence<span className="title-dot">.</span></h1></div><p>Jev advises. Border retains decision authority. These records do not authorize execution.</p><AssessmentView {...state}/></main>;
}
createRoot(document.getElementById('root')).render(<EvidencePage/>);
