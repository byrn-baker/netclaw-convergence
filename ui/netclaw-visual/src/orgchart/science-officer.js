/** Jev is an advisory service, never an enrolled/routable member or health vote. */
const money = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const short = (value) => typeof value === 'string' ? value.slice(0, 200) : null;
const escape = (value) => String(value ?? '—').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

/** Explicit allowlist: no endpoint, credentials, evidence, questions or answers leave the server. */
export function scienceOfficer(snapshot, configuredEnabled = false, now = Date.now()) {
  const valid = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot);
  const enabled = valid && typeof snapshot.enabled === 'boolean' ? snapshot.enabled : configuredEnabled;
  if (!enabled) return null;
  const updatedAt = valid ? short(snapshot.updated_at) : null;
  const stamp = Date.parse(updatedAt);
  const stale = !Number.isFinite(stamp) || now - stamp > 5 * 60 * 1000 || stamp > now + 60 * 1000;
  const budgets = valid && snapshot.budgets && typeof snapshot.budgets === 'object' ? snapshot.budgets : {};
  const latest = valid && snapshot.latest_assessment && typeof snapshot.latest_assessment === 'object'
    ? snapshot.latest_assessment : {};
  return {
    advisor_id: 'jev-science-officer', display_name: 'Jev · Science Officer',
    node_type: 'advisor', advisory_only: true, read_only: true, routable: false,
    status: !valid ? 'not assessed' : stale ? 'stale snapshot' : snapshot.ready === true ? 'configured' : 'unavailable',
    model: valid ? short(snapshot.model) : null, updated_at: updatedAt,
    case_scope: valid && typeof snapshot.task_id === 'string'
      ? snapshot.task_id === 'unscoped' ? 'shared unbound case' : 'operator-bound case' : 'unknown case',
    budgets: Object.fromEntries(['daily_limit_usd', 'case_limit_usd', 'daily_used_usd', 'case_used_usd']
      .map((key) => [key, money(budgets[key])])),
    latest_assessment: short(latest.assessment_id) ? {
      assessment_id: short(latest.assessment_id), created_at: short(latest.created_at),
      purpose: short(latest.purpose), status: short(latest.status),
    } : null,
  };
}

/** Render an explicitly separate RISK advisor card; no member count/certificate implication. */
export function renderScienceOfficer(advisors) {
  const advisor = Array.isArray(advisors) ? advisors.find((a) => a.advisor_id === 'jev-science-officer') : null;
  if (!advisor) return '';
  const usd = (value) => money(value) === null ? 'unknown' : `$${value.toFixed(4)}`;
  const b = advisor.budgets || {};
  const latest = advisor.latest_assessment;
  return `<div class="n2n-section science-officer"><h4>Jev · Science Officer</h4>
    <p>Advisory service · read-only · Border retains decision authority.</p>
    <div class="detail-row"><span>Status snapshot</span><strong>${escape(advisor.status)}</strong></div>
    <div class="detail-row"><span>Model</span><strong>${escape(advisor.model)}</strong></div>
    <div class="detail-row"><span>Snapshot time</span><span>${escape(advisor.updated_at)}</span></div>
    <div class="detail-row"><span>UTC daily spend / limit</span><span>${usd(b.daily_used_usd)} / ${usd(b.daily_limit_usd)}</span></div>
    <div class="detail-row"><span>Case spend / limit</span><span>${usd(b.case_used_usd)} / ${usd(b.case_limit_usd)}</span></div>
    <div class="detail-row"><span>Budget scope</span><span>${escape(advisor.case_scope)}</span></div>
    ${latest ? `<p>Latest assessment: ${escape(latest.purpose)} · ${escape(latest.status)}<br>${escape(latest.created_at)}</p>`
      : '<p class="n2n-muted">No recorded assessment available.</p>'}
    <p class="n2n-muted">Availability is not provider health. See the task summary for Jev’s influence; model support is not proof.</p>
  </div>`;
}
