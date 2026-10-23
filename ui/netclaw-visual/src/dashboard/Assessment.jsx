import React from 'react';
import { age, money, text } from './model.js';
const show = value => value == null ? 'Not returned' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
export function Assessment({ record, title = 'Assessment' }) {
  if (!record) return <p className="empty">No authorized assessment available.</p>;
  return <article className="assessment">
    <div className="section-heading"><div><span className="eyebrow">{title}</span><h3>{text(record.purpose).replaceAll('_', ' ')}</h3></div><span className="badge">{text(record.status)}</span></div>
    <dl className="facts"><div><dt>Model</dt><dd>{text(record.model)}</dd></div><div><dt>Provider</dt><dd>{text(record.provider, 'Not recorded')}</dd></div><div><dt>Assessed</dt><dd>{text(record.created_at)} · {age(record.created_at)}</dd></div><div><dt>Reported cost</dt><dd>{money(record.cost_usd)}</dd></div><div><dt>Charge state</dt><dd>{text(record.charge_status)}{record.reserved_cost_usd != null && ` · reserved ${money(record.reserved_cost_usd)}`}</dd></div></dl>
    {Object.entries(record.questions || {}).map(([id, question]) => {
      const answer = record.answers?.[id] || {};
      return <section className="question" key={id}><div className="question-head"><span className="eyebrow">{question.type}</span><code>{id}</code></div><h4>{show(question.instructions)}</h4>
        {question.criteria && <details open><summary>{question.type === 'score' ? 'Ordered rubric' : 'Answer labels'}</summary><pre>{show(question.criteria)}</pre></details>}
        <div className="answer-grid"><div><span>{question.type === 'score' ? 'Rubric position' : question.type === 'noul' ? 'Answer / probability' : 'Selected answer'}</span><strong>{show(answer.noul ?? answer.choice ?? answer.score ?? answer.value ?? answer.answer ?? answer.probability)}</strong></div><div><span>{question.type === 'noul' ? 'Returned confidence / probability' : 'Returned confidence'}</span><strong>{question.type === 'noul' ? 'Noul is a probability' : show(answer.confidence)}</strong></div></div>
        {(answer.probabilities || answer.distribution) && <details><summary>Returned distribution</summary><pre>{show(answer.probabilities || answer.distribution)}</pre></details>}
        {question.type === 'score' && <p className="muted">Rubric position is not network health. Confidence does not establish correctness.</p>}
      </section>;
    })}
    <section className="influence"><span className="eyebrow">Border's interpretation</span><h4>{text(record.influence?.status, 'Not recorded')}</h4><p>{text(record.influence?.explanation, 'No Border-authored interpretation is linked to this assessment.')}</p></section>
    <details><summary>Evidence, provenance & usage</summary>{Array.isArray(record.evidence_metadata) && <ul>{record.evidence_metadata.map((e,i) => <li key={i}>{text(e.source || e.source_ref, 'Source not recorded')} · {text(e.observed_at || e.timestamp, 'Observation time not recorded')} · {age(e.observed_at || e.timestamp)}</li>)}</ul>}<pre>{show({ assessment_id: record.assessment_id, parent: record.reconsideration_of, evidence: record.evidence_metadata, digest: record.request_digest, usage: record.usage, budget_scope: record.budget_scope })}</pre></details>
  </article>;
}
export default function AssessmentView({ records = [], loading, error, audit }) {
  if (loading) return <p role="status">Loading authorized assessment…</p>;
  if (error) return <p className="notice" role="status">{error}</p>;
  if (!records.length) return <div className="empty"><h3>No assessment linked</h3><p>Open Science Officer evidence from its originating conversation. Older or imported messages remain unbound until ownership can be verified.</p></div>;
  return <>{audit && <p className="muted">GAIT read audit: {audit.status}{audit.commit ? ` · ${audit.commit}` : ' · read could not be recorded'}</p>}<div className={records.length > 1 ? 'assessment-compare' : ''}>{records.slice(0, 2).map((record, i) => <Assessment key={record.assessment_id} record={record} title={i ? 'One reconsideration' : 'Original assessment'} />)}</div></>;
}
