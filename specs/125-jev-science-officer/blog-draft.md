# Captain Kirk Gets a Science Officer: Bringing Jev into NetClaw

*Draft for John Capobianco — publication copy. The CML scenarios below describe the intended demonstration, not a completed deployment.*

NetClaw's Border Claw is Captain Kirk: it understands the mission, coordinates the crew, weighs the evidence and communicates the decision. Its specialist members do the work across the network.

I wanted a Spock beside that captain. A dedicated Science Officer who can examine the evidence and offer a structured judgment before a recommendation becomes action.

Spec125 adds that role through an optional Jev integration. Border can consult the Science Officer, show what it learned and explain whether the assessment supported, challenged or changed its recommendation. The human still knows who made the decision and what evidence supports it.

## What the Science Officer actually does

Jev is TypeSafe's System One model. It evaluates typed questions against supplied text or structured state. Noul gives a probability of yes, Choice gives a distribution over labeled alternatives, and Score places the input against descriptive ordered levels. Questions can be mixed in one request and evaluated against the same evidence. Border supplies the questions and writes the explanation. [TypeSafe introduction](https://docs.typesafe.ai/introduction)

That interface fits network operations. A member can return observations, Border can identify the material uncertainties, and Jev can evaluate focused questions about them. The useful output is a judgment that can be inspected alongside the evidence and the exact wording of the question.

NetClaw now has six advisory workflows:

- Evidence review: how well observations support a particular claim.
- Specialist advice: which eligible capability fits the current request.
- Answer review: whether the proposed response addresses the request without overstating its evidence.
- Diagnostic advice: which hypothesis or read-only observation deserves attention next.
- Change-plan review: where impact analysis, rollback or verification needs more work.
- Incident triage: how the observed impact relates to the operator's escalation policy.

There is no static question library. Border invents the questions from the human's objective, member findings and current gaps. A newly discovered fact should change what the Science Officer is asked.

## From a clean CML lab to a defensible result

Picture a CML demonstration after I have manually reset the intended lab configuration while preserving the management access NetClaw needs. I ask NetClaw to discover what is actually connected, design router-on-a-stick VLAN routing, OSPF, BGP and STP where the topology supports them, and build a verification plan.

Border delegates the device work. The Science Officer reviews the proposed design against the discovered evidence. It might support the routing plan while finding that the rollback assumptions or application tests are weak. Border can improve the plan before presenting it or proceeding within existing approval policy.

After deployment, NetClaw must still check actual state: VLANs and trunks, STP roles, OSPF neighbors, BGP sessions and route policy, plus relevant end-to-end traffic. Jev can review the resulting claims, but a favorable probability cannot turn a missing traffic test into a passing one.

The resulting diagram should depict what was observed. The summary should distinguish configuration intent, measured results and remaining uncertainty. If the Science Officer disagrees materially, Border gets one bounded reconsideration with additional evidence or a revised draft. Any remaining disagreement stays visible.

That is the demonstration I want the community to see: a complete engineering workflow with a visible second assessment, rather than a configuration dump followed by an unsupported success claim.

## What we have actually tested

The first real provider test was deliberately small and synthetic. The observation said a link was up but no application response had been measured. The proposed claim preserved that distinction.

In one request, Jev returned:

| Judgment | Returned result |
| --- | --- |
| Is the qualified claim supported? | Noul: 0.95 |
| Which observation addresses the application evidence gap? | Application probe: 0.99; neither option: 0.01; repeat link status: 0.00 |
| How complete is the application-response evidence? | Score: 0 on a descriptive 0–2 rubric; all probability on “no application response measurement exists” |

The pinned model was `jev-1.13.0`. The call used 465 input tokens and 71 output tokens. At the configured input price, the cost was **$0.00001953**. The measured **0.927 seconds** included MCP handling and a successful GAIT audit write; it is not an isolated model-inference benchmark. [NetClaw's live test evidence](evidence/live-jev.json)

TypeSafe currently lists $0.042 per million input tokens, with output tokens free. Pricing can change, so NetClaw records usage and uses an explicit configured rate. [TypeSafe model reference](https://docs.typesafe.ai/models)

The implementation also passed offline tests for typed responses, credential handling, single-use disclosure consent, concurrent spending limits, failure accounting and the reconsideration boundary. The initial integrated verification included 563 passing unit tests, 542 federation tests and 230 HUD tests. Additional upgrade-path checks are recorded in the accompanying verification report. Those counts describe software checks; they are not a production accuracy percentage.

## How this moves NetClaw closer to autonomy

The step toward autonomy is a better review loop inside the task. Border can ask for a judgment without waiting for a person to inspect every intermediate draft. It can recognize weak support, request an authorized read-only observation, revise a recommendation and explain the change.

This can reduce the amount of routine interpretation a human must perform. More significantly, it makes the moments that deserve human attention easier to see: conflicting evidence, ambiguous options, missing rollback detail or an assessment that could not be obtained.

Spec125 deliberately keeps Jev advisory. Border retains responsibility; existing authorization and change-management gates retain control. Jev does not push configuration, approve a change, quarantine an endpoint or promote a member's permissions. Automatic consultation is instructed through Border's persona and skills; we have not implemented a deterministic guarantee that every consequential model turn will invoke it.

If a more capable autonomous system is going to earn greater responsibility, this is useful groundwork: make its questions, evidence, uncertainty and decision changes observable before granting it broader authority.

## How much production trust does it add?

It adds concrete controls and another opportunity to catch a reasoning error. It does **not** yet establish a measured reduction in production incidents, a reliability percentage or a safe threshold for autonomous writes.

There are two different kinds of confidence here. We can test whether the software blocks an unapproved disclosure or keeps concurrent requests within its configured budget. Separately, we must measure whether Jev's judgments agree with competent human review on real network cases. Passing the first category does not establish the second.

A second model also receives the same imperfect evidence. If both models see stale telemetry or an incomplete topology, they can agree and still be wrong. Agreement is not independent evidence. Repeated agreement and multiple questions over shared state must not be multiplied into an invented certainty score.

Choice/Score confidence reflects the distribution of the model's answers. It is not a guarantee that the selected answer is correct. A high Score is a position on its specific rubric, not a probability that a production change will succeed. [TypeSafe confidence documentation](https://docs.typesafe.ai/confidence)

The production value is therefore specific: an additional advisory assessment, explicit uncertainty, visible disagreement, traceable questions and decisions, and unchanged execution gates. Operators get more information on which to base trust. We have not demonstrated that they can safely dispense with the existing controls.

The next meaningful validation is a human-reviewed network dataset: successful and failed changes, stale or contradictory observations, missing rollback steps, wrong-specialist choices, and convincing but unsupported summaries. Compare Border alone with Border plus Jev. Measure harmful false passes, useful corrections, missed problems, latency and cost. Keep the model and evaluation criteria identifiable so an update can be tested against the same cases.

Early external judge experiments are encouraging, but the LangChain example used five distinct weather-agent responses with repeated evaluations. It supports further investigation; it does not validate production routing changes. [LangChain's experiment](https://www.langchain.com/blog/jev-agent-evals-langsmith)

## Practical controls around the Science Officer

Jev is optional. A key alone does not enable calls. Default spending limits are **$5 per UTC day** and **$0.25 per originating task**, configurable by the operator. Reservations persist across processes; an ambiguous provider failure keeps its possible charge accounted for. When a trusted task binding is unavailable, a conservative shared case prevents the agent from creating new task IDs to reset its allowance.

Hosted evaluation uses sanitized, permitted evidence by default. Additional private disclosure needs an expiring, single-use approval tied to the exact request, destination and task. Credentials remain excluded. Compatible endpoints use separate credentials bound to their destination, avoiding accidental forwarding of a hosted Jev key. These are operator-controlled boundaries; they do not protect against an agent already given unrestricted operator filesystem privileges.

A timeout or exhausted budget becomes “assessment unavailable.” It never becomes a positive judgment, and it never loosens the existing permission checks.

The current RISK view has basic Science Officer status wiring. Detailed assessment views are reserved for Adam's reusable context/chat canvas as part of the upcoming function-first HUD redesign. The WSL installation still needs its own adoption and end-to-end acceptance; a successful Mac test does not certify that deployment.

The captain remains accountable. The Science Officer makes it easier to ask a better question, expose an unsupported assumption and show the human why the recommendation deserves attention. That is a practical step toward more capable—and more inspectable—network autonomy.
