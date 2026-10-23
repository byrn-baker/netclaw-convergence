# Jev advisory contract

Transport: FastMCP stdio. No execution/configuration tools.

- `jev_status`: secret-free configuration, availability and budget snapshot. Does not call provider.
- `jev_evaluate`: state text/object, dynamically authored questions keyed by unique IDs, purpose (evidence_review, specialist_advice, answer_review, diagnostic_advice, change_review, incident_triage), evidence metadata, optional reconsideration parent and prepare-only flag. Task identity resolved from trusted runtime/config, never tool caller. Classify sanitized/private data explicitly; secret scanning is additional defense, not proof of sanitization.
- `jev_assessment`: local read-only lookup of recorded evaluation, if implemented; preserves task isolation.

Noul returns probability yes; Choice returns labeled distribution, choice and confidence; Score returns descriptive ordered levels, distribution, score and confidence. Reject nonfinite/out-of-range/missing/mismatched values. Questions authored now, never loaded from canned packs. Provider may not return generated recommendations as substitute.

Evaluation results identify advisory-only authority, assessment/request digest, model, evidence provenance, budget/cost and audit status. Disabled, unavailable, invalid_request, incompatible_provider, approval_required, budget_exhausted and timeout are distinguishable. No upstream response body or key echoed on errors. Human influence summary belongs to Border and must distinguish its interpretation from Jev output.

No redirects; TLS for remote services, explicit loopback HTTP compatibility. Request size bound and actual wall-clock deadline; no automatic retries. Every outbound attempt reserves worst-case supported input cost before send. Unknown charging retains reservation. Both concurrent daily and case caps enforced across processes.

Prepare-only computes exact payload/destination/task binding without sending. Operator CLI issues expiring single-use private disclosure consent; changed payload, endpoint or task invalidates it. Credentials are excluded despite consent. Operator settings alone raise budgets; model tools cannot. Defaults $5 UTC daily/$0.25 originating task, hosted $0.042/M input, default timeout5 seconds. Compatible services must explicitly configure price, including zero for free local service.

One reconsideration only per initial assessment; same task and recorded parent. Border may request additional read-only evidence through existing authorized tools but Jev never executes those tools. Eligibility and existing human approval gates remain unchanged.
