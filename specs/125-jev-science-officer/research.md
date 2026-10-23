# Research and decisions

Research completed 2026-09-27 before implementation.

- [TypeSafe introduction](https://docs.typesafe.ai/introduction): typed mixed questions share state and execute independently. Compose dependent investigation in Border, not within a pretend joint answer.
- [Models](https://docs.typesafe.ai/models): currently jev-1.13.0, $0.042/M input, free output; 64k total and 32k state+longest question. Pin version; reserve conservatively; custom pricing explicit.
- [Confidence](https://docs.typesafe.ai/confidence): confidence derived from distribution, not correctness. Preserve raw probabilities and their meaning.
- [Score](https://docs.typesafe.ai/primitives/score): descriptive levels, probability-weighted mean; numeric scale not risk probability.
- [SDK config](https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig): custom base URL supported; self-hosted weights not established.
- [Skill suggestion](https://docs.typesafe.ai/cookbooks/skill_suggestion): shortlist/recheck pattern useful, but user rejects fixed question packs. Border composes current questions over eligible candidates.
- [Judge experiment](https://www.langchain.com/blog/jev-agent-evals-langsmith): five distinct weather responses repeated; motivation only, not network accuracy evidence.
- Prior local `docs/jev-audit/findings.md`: disposable audit, no runtime integration. Request size, batch questions and real wall-clock timeout lessons retained; its code is not promoted to production.
- Existing RiskRouter is deterministic and eligibility-filtered; no probabilistic authorization replacement.
- Actual Border persona generated in scripts/in2n-border-workspace.py; gateway is a transport adapter, not an inner reasoning loop.
- Existing member homes assume conversational frontier model; dedicated advisor must be identified honestly as service, avoiding invented certificate/enrollment state.

Rejected: fixed static question library; replacing deterministic authorization with confidence; auto-calling provider when disabled; general model emitting fabricated probability JSON; caller-adjustable budgets; plaintext secret persistence in assessment metadata.
