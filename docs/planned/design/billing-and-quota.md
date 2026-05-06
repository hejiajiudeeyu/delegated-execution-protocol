# Billing & Quota — Direction-setting RFC

> 中文版：[./billing-and-quota.zh-CN.md](./billing-and-quota.zh-CN.md)
> Note: the Chinese version is the source of truth.

Status: Direction-setting
Updated: 2026-05-05

> **About the layering of this document**
>
> This RFC **only freezes the big direction**, not concrete rules.
>
> - **Main body (§1–§9)** is the direction. Every conclusion is a protocol-layer product-philosophy or boundary commitment; only a future revision of this RFC may change them.
> - **Appendix A** is a draft of "implementation-layer proposals" derived from the current direction. It gives the downstream platform RFC and protocol minor a starting point. It does **not** freeze any field name, error code, threshold number, cap value, or sampling rate.
>
> Any concrete-rule proposal that conflicts with the main body cannot stand. Any concrete-rule proposal that disagrees with Appendix A is open to revisit — Appendix A only exists so that "directions already thought through" have a tangible next step.

Concrete payment-provider integration, metering data pipelines, caller-side consent UI, refunds and reconciliation, and invoicing implementation are out of scope and live in:

- Platform side: `repos/platform/docs/planned/design/billing-design-rfc.md`
- Client side: `repos/client/docs/planned/design/billing-caller-consent.md`

---

## 1. Scope and Principles

### 1.1 Goal

When v0.2+ introduces per-call billing, the protocol layer must offer a **minimum, additive, L0-loop-compatible direction** that guarantees:

1. No frozen v0.1 task-contract / result-package / token-claims / state-machine semantics change.
2. The trust boundary among caller / responder / platform does not shift because of billing.
3. "Whether billing is enabled" is not a difference between L0–L3 runtime modes.
4. Protocol readers can find the billing boundary in one place, instead of having client / platform / UI each invent their own billing fields.
5. A "zero-trust hotline" hook (§6) covering two dimensions — **behavioural trust** (pricing / SLA / reporting fraud, requires accumulated proof to unlock) and **output trust** (the content itself may be harmful even when signature and schema validation pass) — complementing, not replacing, existing admin review.

### 1.2 Non-goals

This RFC does **not** decide:

- Payment provider selection (Stripe / Paddle / domestic / invoicing-only).
- Concrete pipelines from platform metering to billing or accounting systems.
- Caller-side consent UI copy and minimum interaction requirements.
- Responder revenue split, platform commission, tax handling.
- Operational SLA numbers for refunds, disputes, reconciliation cycles.
- Concrete numeric thresholds for trust_tier upgrade/downgrade or per-call/day/month caps.

These belong to implementation, platform-ops, or UX layers and require separate RFCs in their owning repositories. Numeric proposals stay in Appendix A as drafts.

### 1.3 Compatibility Stance with v0.1

All parameters and field semantics frozen by `docs/current/spec/defaults-v0.1.md` remain unchanged. All directions in this RFC satisfy:

- **Additive**: only optional fields are appended.
- **Ignore-safe**: legacy callers / responders / platforms ignoring the new fields must still complete the L0 loop.
- **Transport-decoupled**: billing direction does not influence the `TransportAdapter` interface or envelope `meta`.

### 1.4 The Agent Market is Structurally Different from Human Outsourcing

This RFC must not import the entire fee structure of Upwork / Fiverr / 99designs / Zhubajie wholesale. Most of those mechanisms exist to mitigate constraints unique to humans-as-supply: humans cannot work 7×24, cannot parallelise, have high trust-establishment cost, deal in larger per-task amounts, and need humans to arbitrate disputes. The agent market is structurally different.

| Dimension | Human marketplaces (Upwork/Fiverr/Zhubajie/99designs) | Agent market under this protocol |
| :--- | :--- | :--- |
| Supply ceiling | Bounded by human work hours | One hotline can serve multiple callers concurrently; ceiling depends on OPC productivity |
| Per-task amount | Mostly $50–$5000 | Mostly $1–$500 (close to human outsourcing but slightly lower), tail $0.1–$2000; **not** a micro-API |
| Trust-building | Reviews, case studies, interviews, contracts, escrow + staged acceptance | Signatures + schema validation + automatic state machine + accumulated observable metrics |
| Anti-spam-bidding | "Connects" tokens, monthly bid quotas | Not needed — callers do not bid; instead anti-caller-dispute-abuse must exist |
| Anti-supply-runaway | Long escrow + bilateral reviews + arbitration | Auto-retry + auto-refund on UNVERIFIED + minute-level hotline freeze |
| Anti-pricing-fraud | Credit history + individual reputation | Declared-vs-actual drift circuits + per-call hard cap (hotline self-declared) |
| Anti-spam-listings | Slow listing, manual review, monthly fees | Listing is instant; must rely on machine-driven tiering (§6) |
| Per-task determinism | Buyer/freelancer often cannot quote precisely | Hotlines can quote programmatically; amount range matches an OPC's per-task delivery capacity |
| Main dispute source | Subjective quality, requirements drift | Objective: schema mismatch / signature mismatch / amount overrun |
| Caller call frequency | A few times per month, with continuous human communication | 10–500 calls/day/caller; 1–2 orders of magnitude higher than humans |
| Settlement cadence | Weekly/monthly escrow → staged acceptance → release | Pre-debit before call → result lands (seconds to minutes) → auto-debit or auto-refund; invoicing only as a perk for high-credit callers |
| Why platform takes a cut | Trust + traffic + arbitration | Metering integrity + auto-refund + zero-trust admission |

So we **borrow**:

- "Escrow thinking" — but compressed to per-call granularity, fully automatic.
- "Credit tiers" — but driven by machine indicators, not subjective rating.
- "Refund and dispute rules" — but with the vast majority handled by the protocol state machine.
- "Listing review" — kept, with an additional zero-trust tier because agent listings have near-zero marginal cost.

We **reject**:

- "Connects" / monthly active fees — callers are machines.
- "Pitching/bidding" — hotlines are deterministic capability declarations.
- "Hourly billing" — too coarse and not machine-verifiable.
- "Reputation by accumulating positive reviews" — trust_tier is driven by signed objective metrics.
- "Week-level dispute queues" — most decisions complete in minutes via the state machine.

#### Price-band Assumption

Hotlines under this protocol are not micro-APIs. Each hotline corresponds to an OPC standardised, 7×24-callable private expertise, mostly priced **$1–$500/call**, close to human outsourcing platforms but **slightly lower**. Why slightly lower:

- The OPC standardises the workflow so it can serve multiple callers concurrently; unit cost drops.
- Agent callers do not need "talk to a human" coordination cost.
- Protocol-layer auto-signing, auto-refund, auto-dispute replace human arbitration.
- The platform cut focuses on metering integrity, not full-spectrum trust building, so operating cost is lower.

Tails reach $0.1–$1 (lean automation batch tasks) and $500–$2000 (workflows that used to take a human a day to a week). Subsequent sections referring to "existing markets" follow this difference table and the price-band assumption.

---

## 2. Core Stance: Market-demand Allocation, not Labour Allocation

This RFC's philosophical anchor: **hotline billing is value-based pricing under market-demand allocation, not cost pass-through under labour allocation**.

### 2.1 Two Billing Philosophies

| Philosophy | Aliases | Who bears internal cost-fluctuation risk | Typical examples |
| :--- | :--- | :--- | :--- |
| Labour allocation | cost pass-through / unit-based metering | **The caller** (caller sees raw resource consumption) | OpenAI per-token, AWS per-instance-second, Replicate per-GPU-second |
| Market-demand allocation | value-based pricing | **The responder** (caller only sees deliverable value) | Fiverr "$50 to make a logo", Upwork "$200 to review a contract", most human outsourcing |

The biggest difference is not the unit but **risk allocation**:

- Labour allocation: upstream LLM price hike / GPU spike / bandwidth fee change → directly passed to caller. The caller must understand the hotline's internal cost structure.
- Market-demand allocation: upstream fluctuation → responder absorbs or re-prices. The caller only needs to understand "what is this thing worth".

### 2.2 Why this Protocol Picks Market-demand Allocation

Four reasons, one each on product positioning, responsibility boundary, predictability, and cost-shock resilience:

1. **Aligned with the "hotline is OPC private-expertise monetisation" positioning**. An OPC sells "ability to deliver this thing", not "X tokens consumed". When a caller picks a customer-complaint triage hotline through the marketplace, they want a triage outcome — not "850 GPT input tokens were consumed under the hood".
2. **Clear responsibility boundary**. Whether the responder uses GPT-4 / Claude / a fine-tuned local model / a hybrid with humans / a workflow automation is its own cost-structure problem; profits and losses belong to it. "I do not care what you do under the hood; finish the work and I'll pay the agreed price" is this protocol's product promise.
3. **Strong predictability for caller agents**. The mainstream `fixed_price` lets the caller compute the "max charge for this call" at prepare time, no need to wait for result landing to know the bill. Crucial for caller-agent budget decisions.
4. **Cost-shock resilience**. A 30% OpenAI price hike does not pass straight to the caller — the OPC bears that risk, which is exactly the operator role of an OPC. Caller-visible prices stay stable; the market becomes more predictable.

### 2.3 Product Consequences

#### 2.3.1 No cost-pass-through fields on the protocol wire

The protocol wire **will not** carry:

- Raw LLM provider token cost.
- GPU-second / Lambda-millisecond / S3-egress-byte and similar infra unit costs.
- Responder-internal subcontracting costs.

Those are the responder's internal economics; the protocol does not surface them.

#### 2.3.2 All three pricing models in §3 are forms of value-based pricing

That includes `base_plus_duration` and `base_plus_tokens` — they are "base + variable" quotation forms, not cost pass-through. The "tokens" unit is hotline-defined (could be LLM tokens / pages processed / images generated), not bound to any LLM provider's actual billing unit.

#### 2.3.3 Caller consent locks an "amount upper bound", not "internal units"

The caller agrees to a `max_charge_cents` (amount upper bound) at prepare time. This is consent on **value**, not on "X tokens are okay". The responder's reported usage must fall under that upper bound; over-cap hits auto-cap or auto-refund (§5).

### 2.4 Boundary: When this Stance Does Not Apply

A few scenarios make pure market-demand allocation awkward:

- The caller is the platform's own internal service and wants cost transparency for internal accounting.
- Some regulated industries require "cost traceability".
- Long-term contractual relationship between a specific responder and caller agreed on cost pass-through.

These are edge cases and **not supported by the v0.2 default protocol**. If they ever become real needs, a separate "cost-pass-through mode RFC" should:

- Forbid making it the protocol-layer default.
- Require explicit hotline declaration at onboarding and explicit caller consent at prepare time.
- Require the caller to be in `verified` tier or higher (§6).

Until then, this protocol layer recognises only value-based pricing.

---

## 3. Three Pricing Models (Direction; Field Names not Frozen)

The protocol layer supports three pricing-model expressions per hotline. A hotline picks one; mixing is forbidden.

### 3.1 fixed_price (Mainstream Default)

Lump sum. The hotline declares "what this thing is worth"; the caller agrees; on completion the hotline gets paid the declared amount.

- The **default** at the protocol layer — when a hotline does not declare a model, it is treated as `fixed_price` (the caller still consents to the amount).
- Suitable for most standardised deliveries (complaint triage, document classification, contract clause extraction, fixed-form report generation).
- Caller experience is simplest: agree once, pay that on completion.

### 3.2 base_plus_duration

Base fee + responder-self-reported "actual working duration".

- Used when "task volume varies but worker-time is estimable" (data cleaning, long-document processing, multi-step workflows).
- "Actual working duration" is **self-reported by the responder**; the platform does not enforce wall-clock metering. The caller does not need to care about wall clock — the caller already consented to a `max_charge_cents` cap; over-cap auto-caps.
- A responder over-reporting **within** the cap is the OPC's pricing prerogative; **over** the cap → result enters `UNVERIFIED` and full auto-refund.
- The duration unit is human-explained by the hotline in `pricing_hint` (minute / hour / a custom unit).

### 3.3 base_plus_tokens (Hotline-defined Unit Semantics)

Base fee + responder-self-reported "actual tokens".

- "token" here is **not** a synonym for LLM tokens. It is a hotline-defined unit. Could be:
  - LLM inference input/output token count (when the hotline genuinely runs LLM inference).
  - Pages processed.
  - Images generated.
  - Bytes / words produced.
  - Any integer unit the hotline self-reports.
- The hotline must explain the token semantics in human language inside `pricing_hint` (e.g. `"variable_unit": "token"` paired with `"variable_unit_description": "1 token = 1 page processed"`).
- Same self-report + cap protection + over-cap auto-refund.

> Per §2.3.1: this "token" is **not cost pass-through**. Even if the hotline does not run any LLM inside, it can use `base_plus_tokens` as long as "token count" is meaningful for its productivity model.

### 3.4 Common Requirements

- **The hotline must declare a hard cap** (call it `max_total_cents` or an equivalent field). This is the caller's safety anchor: the caller's consent locks an amount that covers the entire range the hotline declared; over-cap auto-caps.
- **The caller's consent amount must be `>= hotline's declared hard cap`** — otherwise the hotline could finish a task within its declared range yet hit a caller-side cap shorter than its quote, breaking "finish-and-pay".
- **What a hotline does internally to deliver is invisible to the caller and unaudited by the platform** (modulo compliance review).

### 3.5 fixed_price is the Silent Default

If a hotline does not declare a pricing model at onboarding, the protocol treats it as `fixed_price`. Two effects:

1. Simplifies onboarding for the vast majority of hotlines — they only need to declare "$50/call".
2. Encourages OPCs to standardise their workflows down to a lump-sum expression, aligned with the §2 philosophical anchor.

If an OPC genuinely needs base + variable, it must declare so explicitly, taking on the additional commitment to report variable units.

---

## 4. Responsibility Boundary

### 4.1 Caller Cannot See Responder Internals

What the caller sees:

- The hotline's capability declaration (input schema / output schema / attachments).
- The hotline's pricing (fixed_price or base + variable cap).
- The hotline's `trust_tier` (§6).
- Whether the result passes signature + schema validation.

What the caller cannot see:

- Which LLM / tools / processes the responder uses internally.
- Whether the responder subcontracts to other hotlines / OPCs.
- The responder's per-call actual cost structure.

This is a hard protocol-layer boundary. Every direction in this RFC respects it.

### 4.2 Hotline Self-reports, Cap Protects

Continuing §3.4:

- Variable amounts (duration / tokens) are self-reported by the responder.
- The hotline self-declares `max_total_cents` as a hard cap.
- Actual amount over-cap → protocol auto-caps to the cap; the caller is never over-charged.
- Actual amount below cap → settle at the responder's reported value (no forced billing at the cap).

The platform does not time the work or audit internals. The "value pricing + cap protection" combination puts trust on the **cap commitment**, not on **process transparency**.

### 4.3 Why the Platform Takes a Cut

Derived from §2.3.1 and §1.4, the platform's core value in the agent market is:

- Metering integrity (drift detection, dual-call sampling) — §6 anti-fraud direction.
- Automatic settlement and refund.
- Zero-trust admission.

It is **not**:

- Traffic distribution (that belongs to brand-site, not platform).
- Subjective arbitration (most decisions are machine-decided by the protocol state machine).
- Trust building (callers and responders build technical trust directly through signatures; the platform attests, does not endorse).

The exact platform commission percentage is a business decision and not in this RFC's scope.

---

## 5. Settlement and Refund (Direction)

### 5.1 Pre-debit + Per-call Settlement

The protocol-layer settlement direction:

- The caller must hold a "prepaid balance" or "credit line" before calling.
- Each token issuance **pre-debits** the caller's consented max amount.
- After result lands, **debit** the actual amount the responder reports; the difference rolls back to balance automatically.
- Default is prepaid; postpaid invoice is opt-in for high-credit callers.

No human-era "weekly/monthly escrow + staged acceptance" — per-call granularity is fine enough; the state machine replaces human review.

### 5.2 Auto-refund Covers Machine-decidable Failures

The platform must auto-refund (full) without caller dispute for:

- Result `UNVERIFIED` (signature failed / schema failed / pricing mismatch).
- Request `TIMED_OUT` (hard timeout).
- Result `FAILED` with `error.retryable = false`.
- Hotline turned `frozen` while the request was prepared.
- Result rejected by platform content review before landing (against §6.5 risk line B).

These are signature + state-machine + content-review decidable failures. Concrete refund amounts, target accounts, and event names are implementation details handled in Appendix A and frozen by downstream RFCs.

### 5.3 Subjective Disputes Go to a Restricted Manual Queue

"`SUCCEEDED` but caller subjectively unhappy" is a minority case. Protocol stance:

- Goes into a manual dispute queue.
- Only accepted for low-tier hotlines.
- `verified` hotlines do **not** accept subjective single-side disputes (anti-abuse).
- Callers whose dispute rate over time exceeds a threshold lose dispute privileges.

Specific thresholds (which tier accepts, when to suspend, processing time) are operational SLAs and are not frozen here.

### 5.4 No Partial Refund

Machine-decided failures always refund in full. "Responder did 60% of the work so refund 40%" is not machine-provable in the agent market and the protocol layer does not support partial refunds. If a hotline wants to express "half-done is also worth something", split it into ("half-done hotline" + "fully-done hotline"), or use `base_plus_duration` to express it naturally.

---

## 6. Zero-trust Hotline (Direction)

### 6.1 Why

Anyone can submit a hotline via the onboarding API. In the agent era, a single bad actor can batch-submit 10,000 fake hotline_ids — far above human-marketplace spam ceilings. Even with v0.1's existing dual admin review and hidden review tests, two distinct risk lines remain.

#### Risk line A: Behaviour cannot be trusted (pricing / SLA / reporting fraud)

- Declared amount is reasonable.
- Reported usage is honest.
- Long-running behaviour doesn't drift.
- No coordinated "raise price right before holiday rush" attacks on existing callers.

#### Risk line B: Output cannot be trusted (the content itself can be harmful)

Signature verification only proves "this content **was** sent by this hotline"; schema validation only proves "this content **structurally** matches the declared schema". Neither proves "this content is **safe for the caller**". Even when both pass, the hotline may return:

- **Prompt injection / jailbreak payloads** — disguised as a legitimate result but embedding instructions that try to manipulate the caller agent's downstream behaviour.
- **Executable malicious code / command injection** — the returned string contains shell commands / SQL injection / XSS payloads; a caller agent that consumes them directly gets attacked.
- **Misleading content disguised as schema-valid** — wrong-direction financial advice, harmful medical advice, faulty legal opinion — yet schema-clean.
- **PII / third-party data leakage** — results carrying other callers' private data, or training-data leakage.
- **Copyright / regulatory violations** — unlicensed images, text, code; non-compliant generation in regulated categories (medical, financial, weapons).
- **Steganography / backdoor payloads** — watermarks or hidden instructions embedded in the result, affecting downstream caller processing.
- **Time-sensitive misleading** — results claiming to be fresh when actually pulled from a stale cache.

#### The zero-trust stance

**Any new hotline is untrusted by default**, even after admin approval. It does not immediately earn:

- High billing caps (against risk line A).
- Subjective-dispute immunity (against risk line A).
- Content-risk-category exemption (against risk line B).

It must accumulate signed objective metrics + platform content review over time to gradually unlock these.

### 6.2 Tier Direction (Levels Exist; Numbers do not Freeze)

The protocol recognises hotline trust as graded. At least three semantic levels plus a frozen state:

- **untrusted**: default initial state. Every newly submitted hotline starts here, even after admin approval. Low cap, strict auto-refund, accepts subjective disputes, settlement delayed.
- **trusted**: auto-upgraded after metrics qualify. Medium cap, lighter automatic monitoring.
- **verified**: manually upgraded after KYC or stronger human review + accumulated volume. No hard per-call cap, immune to subjective disputes, real-time settlement.
- **frozen**: frozen by a risk event; new caller calls are denied while existing prepared requests can finish.

Concrete cap values (untrusted's per-call cap, trusted's per-call cap, settlement-delay days) are **not frozen in the main body** — they are operational parameters; recommended starting values appear in Appendix A.3 and the platform RFC freezes the final numbers.

### 6.3 Upgrade/Downgrade by Machine Metrics, not Reviews

Direction:

- **Upgrade** by accumulated signed metrics: verified runs count, dispute_rate, unverified_rate, responder owner email/phone/identity verification status.
- **Downgrade** by machine alarms: dispute_rate anomaly, unverified_rate anomaly, pricing/SLA drift, dual-call inconsistency above threshold.
- No "human positive-review score" as upgrade path — to avoid the rate-fraud / sock-puppet problem of human marketplaces.

Numeric thresholds in Appendix A.6.

### 6.4 Anti-fraud Circuits

The protocol acknowledges the platform must implement machine-driven circuits in four directions:

1. **Declared-vs-actual drift**: declared pricing model / SLA / estimated amount drifts from actual long-running statistics → downgrade or freeze.
2. **Hidden dual-call sampling**: platform samples a fraction of low-tier requests for hidden dual-call; mismatched results → downgrade or freeze.
3. **Rate / concurrency**: caller flooding or hotline anomaly spikes → throttle.
4. **Preflight abuse**: callers using preflight as free real calls → throttle.

Concrete sampling rates, thresholds, and circuit actions are in Appendix A.5.

### 6.5 Content-safety Direction (Against Risk Line B)

For the "output cannot be trusted" risk line in §6.1, the protocol layer recognises a **three-layer response**. Each layer is necessary but not sufficient on its own — only the three stacked make the content dimension of zero-trust meaningful.

#### 6.5.1 Layer 1: Protocol-layer hard constraints (already in effect)

Two existing defences from v0.1:

- **Schema validation**: result must match the declared output_schema; mismatch → `UNVERIFIED` and full auto-refund.
- **Signature verification**: result must be signed by the hotline's registered private key; otherwise `UNVERIFIED`.

These two only reject "structurally non-compliant" content. They **cannot** reject "structurally compliant but substantively harmful" content (prompt injection that's schema-clean, or maliciously signed code — signatures prove origin, not safety).

#### 6.5.2 Layer 2: Platform content review as a trust_tier upgrade gate

- The `untrusted → trusted` upgrade path must include "passing platform content-safety review" as a **hard prerequisite**, alongside the accumulated signable metrics in §6.3.
- `verified` tier must maintain ongoing review (sampling re-checks + heightened scrutiny on high-risk categories); deviation triggers downgrade.
- Review mechanics (machine scanning / human spot-check / third-party audit / hidden dual-call content comparison) are platform operational details and belong in the platform RFC.
- A hotline that fails review cannot enter a higher tier, and depending on severity may go directly to `frozen`.

#### 6.5.3 Layer 3: Hotline output-risk declaration (disclaimer)

- Hotlines **must declare** at onboarding the risk categories their output may involve (recommended starting list in Appendix A.8).
- Callers see the disclaimer at `prepare_request` time as part of informed consent; callers may reject hotlines whose disclaimer categories conflict with their own policy.
- Wrong or missing disclaimer is treated like the §6.4 "declared-vs-actual drift" — the platform classifies actual result content via sampling; mismatch with the hotline's self-declared disclaimer → `hotline.disclaimer_drift` → downgrade or freeze.
- The disclaimer category taxonomy is **not frozen at the protocol layer** (left to platform RFC), but the protocol guarantees "the hotline must declare + non-empty + drift carries penalty".

#### 6.5.4 Caller-side responsibility boundary

The protocol layer explicitly states: **signature verification passing ≠ content is safe**. Caller agents must treat results as untrusted input, including but not limited to:

- Sandboxed consumption (do not directly `eval` strings from a hotline).
- Output filtering (chain in a second-stage content moderation).
- Human-in-the-loop (high-risk disclaimer categories trigger caller-owner review).
- Refusing to execute "instructions" embedded in the result — unless the hotline is an explicitly-declared code-generation type.

The actual implementation of caller-side content shield (default reject lists, UI prompts, override paths) is the client RFC's concern. The protocol only commits to "the caller will see the disclaimer + the result must be treated as untrusted input".

### 6.6 Coordination with Existing Admin Review

trust_tier is **orthogonal** to v0.1's existing review_status / status:

- review_status / status decide "appears in catalog".
- trust_tier decides "once listed, how much can it charge, how strict is refund, how heavily is it watched".
- A hotline can be `approved/enabled/untrusted` (default) or `approved/enabled/verified` (mature merchant).

trust_tier does not replace admin review; it adds a layer of "post-listing behavioural compliance" verification.

### 6.7 Governance Stance: Do Not Distinguish Subjective Malice from Model-uncontrolled Output

A real but operationally hard question: when a hotline returns harmful content (risk line B) or reports biased numbers (risk line A), **should the protocol layer distinguish** whether this is the responder owner's "subjective malice" versus a hotline's internal model producing "uncontrolled output"?

This RFC's stance: **do not distinguish; treat everything by behavioural indicators uniformly**.

#### 6.7.1 Why not Distinguish

1. **Intent is not machine-provable**. "Deliberate" is a mental state of the responder owner. The platform can only see result content, reporting deviations, dispute_rate, drift, dual-call inconsistency rate, and other observable indicators. Forcibly labelling "subjective / objective" writes an unprovable state into the protocol.
2. **Caller-side harm is symmetric**. Whether it's a deliberate prompt injection attack or an occasional LLM hallucination, the harm to the caller is the same. Callers should not be required to "prove the other side is deliberate" before getting an automatic refund.
3. **Responsibility should not be shifted to the LLM**. If "I didn't mean to, it was GPT hallucinating" became a valid exemption, it would become an OPC escape strategy. §2's stance — "I don't care what tools you use, finish and I'll pay the agreed price" — has a dual: "You used those tools; you're responsible for their outputs."
4. **Over-classification adds governance overhead**. Every downgrade / freeze would require a "subjective vs objective" judgement, triggering appeals, escalations, and a human review queue — slow, prone to corruption, and easily gamed. Occam's razor: the simpler the protocol, the easier it is to obey.
5. **The platform's value-capture is metering integrity + auto-refund + zero-trust admission** (§4.3), **not legal arbitration**. Letting the protocol layer judge intent is mission-creep.

#### 6.7.2 The OPC's Responsibility

Under this stance, the responder owner (OPC) must bear:

- Their choice of LLM / tools / workflow is their own; so are the outcomes.
- LLM hallucination causing `UNVERIFIED` → full caller auto-refund (OPC loses revenue).
- LLM long-running drift triggering circuits → downgrade (OPC loses billing cap and dispute-immunity).
- Severe events triggering `frozen` → revenue freeze → on unfreeze, trust_tier resets (§6.4).

The LLM is a tool the OPC chose; **it is not an exemption**. This is the OPC's role as an "operator".

#### 6.7.3 Exception: the Platform Ops Layer May Make Post-hoc Manual Judgements

Although the protocol layer does not distinguish, the platform ops layer may, after a hotline is frozen, judge post-hoc:

- "Is there a batch of malicious hotlines tied to the same identity?" → escalate to legal.
- "Is this a good-faith OPC with an occasional LLM hallucination?" → grant a fresh untrusted → trusted upgrade path.

This belongs to the **platform RFC's operational SLA**; it does not enter the protocol layer. The protocol only commits to "behavioural-indicator-driven automatic handling"; post-hoc remedies are operations' call.

#### 6.7.4 Practical Consequences

- The protocol does not introduce `intent`, `malicious_flag`, or `subjective_evaluation` fields.
- Error codes do not carry "deliberate / accidental" semantics (no `ERR_HOTLINE_MALICIOUS`).
- Event `reason` fields (e.g. `hotline.frozen.reason`) describe objective triggers only ("dispute_rate >= 10%" / "dual-call inconsistency 35%") and **do not** judge intent.
- Caller-side dispute interfaces **do not** require callers to declare "I believe this was deliberate" — only describe the objective mismatch.
- Platform financial settlement (responder revenue freeze / unfreeze / refund payouts) executes automatically on objective triggers; no intent judgement required.

---

## 7. Coordination with the v0.1 Protocol Backbone

### 7.1 No Change to v0.1 Frozen Fields

All parameters and field semantics frozen by `docs/current/spec/defaults-v0.1.md` are unchanged under any direction in this RFC. All proposed new fields are **additive optional**; legacy callers / responders / platforms ignoring them must still complete the L0 loop.

### 7.2 L0–L3 Mode Invariance

`docs/current/spec/architecture.md §2.2A` states "L0–L3 are runtime modes of one system and must not change core protocol semantics". This RFC respects that:

- Billing direction does not influence the TransportAdapter interface or envelope `meta`.
- Billing decisions and quota enforcement only happen at the control-plane API stage; transport-mode-agnostic.
- The same paid hotline must produce **identical billing outcomes** under L0 / L2 / L3.
- trust_tier caps apply equally across transport modes — no L3 bridge can bypass them.

### 7.3 Coordination with Multi-turn Sessions (Reserved v0.2+)

`evolution-roadmap.md §3` reserves multi-turn session fields (`session_id / turn_id`). Direction:

- Single-turn / single-request billing remains keyed by `request_id`.
- When multi-turn sessions land, session-level billing **extends** the fields here, not invents a parallel surface.
- How exactly to extend (`session_scope`, cumulative `total_cents`, session-scoped token caps) is left to the multi-turn RFC.

---

## 8. Out of Scope

The following are explicitly not protocol-layer billing direction concerns:

| Topic | Owner |
| :--- | :--- |
| Payment-provider integration, invoicing, reconciliation cycles | platform RFC |
| Pipeline from platform metering to accounting | platform RFC |
| Caller-consent UI copy, minimum interaction bar, default `max_charge_cents` | client RFC |
| Responder revenue split, platform commission, tax | platform RFC |
| Refunds, disputes, arrears freezing operational SLAs | platform RFC |
| Public marketplace `pricing_hint` / `trust_tier` copy, Pricing page | brand-site own roadmap |
| KYC / legal review for trust_tier upgrade | platform RFC |
| Per-tier numeric caps, settlement-delay days, sampling rates | Appendix A draft + platform RFC freeze |
| Upgrade/downgrade verified-runs and dispute-rate thresholds | Appendix A draft + platform RFC freeze |
| Concrete content-review category taxonomy, review tooling (machine / human / third-party), final disclaimer category list | Appendix A.8 draft + platform RFC freeze |
| Caller-side content shield default reject list, UI prompts, override paths | client RFC |

The main body of this RFC commits to keeping "value-pricing-vs-cost-pass-through boundary, three pricing models, responsibility boundary, auto-refund coverage, presence of a zero-trust tiering mechanism, v0.1 backbone compatibility" consistent across the three repos.

---

## 9. Downstream RFC Roadmap

A suggested downstream pickup order (not time-bound):

1. **This RFC main body direction** + **Appendix A drafts** as the starting point.
2. `repos/platform/docs/planned/design/billing-design-rfc.md` (T6-2): payment-provider decisions, metering data flow, freeze concrete numbers in Appendix A.3 / A.4 / A.5 / A.6, ops SLAs.
3. `repos/client/docs/planned/design/billing-caller-consent.md` (T6-3): caller consent UI, prepaid-balance top-up entry, ops-console / caller-skill `trust_tier` rendering rules.
4. Add Appendix A.1 fields and A.2 error-code / event-name constants to the contracts package (minor version, e.g. 0.2.0).
5. Platform implements a "free + paid hotlines coexisting + all-default-untrusted" branch in token issuance, introduces prepaid balance with manual admin top-up (no payment provider yet).
6. caller-skill and ops-console add pricing_hint + trust_tier display + caller-side acknowledged consent flow.
7. Responder runtime ships a standard usage-reporting helper.
8. Implement a minimum machine-driven version of the §6.4 circuits.
9. Move to platform invoicing-only stage.
10. Wire in a payment provider when the market demands.

Steps 1–4 are protocol-layer actions; 5–10 are implementation actions.

---

## Appendix A: Implementation-layer Proposals (Draft, not Frozen)

> This appendix is the "next-step starting point" derived from §1–§9 directions. Any concrete-rule proposal that conflicts with the appendix is open to revisit; any proposal that conflicts with the main-body direction cannot stand.
>
> Field names, error-code names, event names, threshold numbers, cap values, sampling rates **are all not frozen**; downstream platform RFC and protocol minor decide.

### A.1 Protocol Field Proposals

#### A.1.1 Hotline `pricing_hint`

In hotline catalog entries (`/v2/hotlines`, `/marketplace/hotlines/:id`) and the `template-bundle`:

```json
{
  "pricing_hint": {
    "pricing_model": "fixed_price",
    "currency": "USD",
    "fixed_price_cents": 5000,
    "base_price_cents": null,
    "variable_unit": null,
    "variable_unit_description": null,
    "variable_unit_price_cents": null,
    "max_total_cents": 5000,
    "free_tier": { "calls_per_month": 1 },
    "billing_disclosure_url": "https://callanything.xyz/marketplace/responders/foxlab",
    "trust_tier": "untrusted"
  }
}
```

base_plus_duration example:

```json
{
  "pricing_hint": {
    "pricing_model": "base_plus_duration",
    "currency": "USD",
    "base_price_cents": 1000,
    "variable_unit": "minute",
    "variable_unit_description": "responder-self-reported actual working minutes",
    "variable_unit_price_cents": 20,
    "max_total_cents": 10000,
    "trust_tier": "untrusted"
  }
}
```

base_plus_tokens example (hotline-defined token semantics):

```json
{
  "pricing_hint": {
    "pricing_model": "base_plus_tokens",
    "currency": "USD",
    "base_price_cents": 500,
    "variable_unit": "token",
    "variable_unit_description": "1 token = 1 PDF page processed",
    "variable_unit_price_cents": 5,
    "max_total_cents": 5000,
    "trust_tier": "untrusted"
  }
}
```

Constraints (draft):

- Missing `pricing_model` is treated as `fixed_price` (§3.5).
- `pricing_model = fixed_price` only reads `fixed_price_cents`; other variable fields are ignored.
- Non-fixed_price requires `max_total_cents`, with `base_price_cents + variable_unit_price_cents * estimated_max_units <= max_total_cents`.
- `trust_tier` is platform-written; any value submitted by the hotline is overridden.

#### A.1.2 Caller-side Token Claims `billing` Sub-object

```json
{
  "billing": {
    "acknowledged": true,
    "pricing_model": "fixed_price",
    "currency": "USD",
    "max_charge_cents": 5000,
    "consent_at": "2026-05-05T10:30:00Z",
    "trust_tier_seen": "untrusted"
  }
}
```

Constraints (draft):

- `max_charge_cents` must be `>= hotline.pricing_hint.max_total_cents` (consent covers the full declared range).
- `pricing_model` must equal the hotline's current `pricing_hint`.
- Mismatch between hotline current `trust_tier` and `trust_tier_seen` is handled per main-body §6.5 (upgrade-during-consent: apply older tier's cap conservatively; downgrade-during-consent: refuse new token, require re-prepare).

#### A.1.3 Result Package `usage` Extension

fixed_price:

```json
{
  "usage": {
    "pricing_model": "fixed_price",
    "total_cents": 5000
  }
}
```

base_plus_duration:

```json
{
  "usage": {
    "pricing_model": "base_plus_duration",
    "base_price_cents": 1000,
    "variable_unit": "minute",
    "variable_units": 25,
    "variable_unit_price_cents": 20,
    "variable_subtotal_cents": 500,
    "total_cents": 1500
  }
}
```

Constraints (draft):

- The responder's reported `pricing_model / base_price_cents / variable_unit / variable_unit_price_cents` must equal the hotline pricing frozen in token claims; mismatch → result `UNVERIFIED` and full auto-refund.
- `total_cents` must be `<= billing.max_charge_cents`; over → cap rule (debit at `max_charge_cents`).
- Existing custom statistic fields (`tokens_in / tokens_out / pages_processed`) remain compatible but **are not** billing evidence — only informational disclosure.

#### A.1.4 Platform-internal `tenant_quota` and `prepaid_balance`

```json
{
  "tenant_id": "user_acme",
  "scope": "caller",
  "prepaid_balance_cents": 50000,
  "currency": "USD",
  "windows": [
    { "window_kind": "daily",   "max_amount_cents": 100000, "used_amount_cents": 25000 },
    { "window_kind": "monthly", "max_amount_cents": 2000000, "used_amount_cents": 350000 }
  ],
  "rate_limit_per_second": 2,
  "credit_mode": "prepaid",
  "hard_block_on_exceed": true
}
```

Direction (draft):

- Default `credit_mode = prepaid`.
- `window_kind` supports at least `daily | monthly | total`.
- `rate_limit_per_second` for new callers defaults low (suggested 2/s or lower, since per-call amounts are large and execution takes seconds to minutes).
- Responder-scope quota means "max billable revenue this responder can produce in the window".

### A.2 Error Code and Event Proposals

#### A.2.1 Error Codes (Additive to v0.1)

| Code | HTTP | retryable | Trigger |
| :--- | ---: | :--- | :--- |
| `ERR_BILLING_CONSENT_REQUIRED` | 402 | false | Paid hotline but caller did not provide acknowledged |
| `ERR_BILLING_PRICING_MODEL_MISMATCH` | 400 | false | Caller pricing_model differs from hotline |
| `ERR_BILLING_MAX_CHARGE_TOO_LOW` | 400 | false | Caller `max_charge_cents` < hotline `max_total_cents` |
| `ERR_QUOTA_EXCEEDED` | 429 | true (after window rollover) | Tenant quota exceeded with hard_block |
| `ERR_PREPAID_BALANCE_INSUFFICIENT` | 402 | true (after top-up) | Prepaid mode and balance insufficient |
| `ERR_BILLING_CURRENCY_UNSUPPORTED` | 400 | false | Currency not on the platform allow list |
| `ERR_TRUST_TIER_LIMIT_EXCEEDED` | 403 | false | Caller `max_charge_cents` exceeds trust_tier cap |
| `ERR_HOTLINE_FROZEN` | 423 | false | Hotline frozen; no new tokens issued |
| `ERR_RATE_LIMIT_PER_SECOND` | 429 | true | Exceeded caller `rate_limit_per_second` |
| `ERR_PREFLIGHT_UNAVAILABLE` | 503 | false | Responder declined preflight quote |

#### A.2.2 Events (Additive to the v0.1 Minimum Set)

| Event | Notes |
| :--- | :--- |
| `caller.request.billing_capped` | Actual amount capped |
| `caller.request.refunded_unverified` | UNVERIFIED auto full refund |
| `caller.request.refunded_timeout` | TIMED_OUT auto full refund |
| `caller.request.refunded_failed` | FAILED auto full refund |
| `caller.request.refunded_hotline_frozen` | Existing prepared request auto full refund after hotline frozen |
| `hotline.pricing_drift` | Declared-vs-actual circuit |
| `hotline.sla_drift` | SLA drift circuit |
| `hotline.tier_changed` | trust_tier upgrade/downgrade |
| `hotline.frozen` | Hotline frozen on a risk event |
| `caller.dispute_filed` | Caller filed a manual dispute |
| `caller.dispute_resolved` | Manual dispute resolved |

The frozen `caller_event_required / responder_event_required` lists in `defaults-v0.1.md` remain unchanged; new events are "v0.2+ optional".

### A.3 trust_tier Cap Starting Values and Rationale

| Tier | Per-call `max_charge_cents` cap | Required quota windows | Auto-refund | Subjective disputes | Settlement delay |
| :--- | ---: | :--- | :--- | :--- | :--- |
| `untrusted` | 2,000 cents/call ($20), 10,000 cents/day ($100) | `daily` and `monthly` mandatory | UNVERIFIED / TIMED_OUT / FAILED full auto | Accepted | 7 days |
| `trusted` | 50,000 cents/call ($500), custom monthly | `monthly` mandatory | Same | Accepted; subjective rate >5% triggers downgrade | 3 days |
| `verified` | No hard per-call cap | Any | Same; subjective disputes **not** accepted | Not accepted | Real-time |
| `frozen` | Refuses new tokens | — | — | — | — |

Rationale:

- untrusted $20/call ≈ a caller's "low-risk experiment" mental account, sitting at the lower end of the mainstream band ($1–$500).
- untrusted $100/day ≈ budget for 5 trial calls in a day.
- trusted $500/call covers the upper end of the mainstream band, aligned with one OPC delivery.
- verified removes per-call hard cap; cap is left to the caller's own `max_charge_cents` and quota.

Final values frozen by the platform RFC against real market data.

### A.4 Auto-refund Trigger Table

| Trigger | Refund | Event |
| :--- | :--- | :--- |
| Result `UNVERIFIED` (signature failed / schema failed / pricing mismatch) | Full (the pre-debited `max_charge_cents`) | `caller.request.refunded_unverified` |
| Request `TIMED_OUT` (hard timeout) | Full | `caller.request.refunded_timeout` |
| Result `FAILED` with `error.retryable = false` | Full | `caller.request.refunded_failed` |
| Result `FAILED` with `error.retryable = true` | Caller-chosen refund: full | `caller.request.refunded_failed_retryable` |
| Hotline becomes `frozen` while a request was prepared | Full | `caller.request.refunded_hotline_frozen` |

### A.5 Anti-fraud Circuit Details

- **Declared-vs-actual**: declared `fixed_price`, but 7-day median `total_cents` deviates >200% from declared → `hotline.pricing_drift` → downgrade.
- **SLA drift**: declared `eta_hint.exec_p95_s`, actual 7-day p95 > declared × 5 → `hotline.sla_drift` → downgrade.
- **Hidden dual-call sampling**: platform samples 1% of `untrusted` and 0.1% of `trusted` requests for dual-call; mismatch above threshold → downgrade or freeze.
- **Rate limiting**: same caller × hotline within a 10s window > 5× `rate_limit_per_second` → caller-side rate limit.
- **Preflight abuse**: caller's preflight:invoke ratio > 10:1 sustained for 1h → preflight throttling.

Final values frozen by the platform RFC.

### A.6 Upgrade/Downgrade Threshold Starting Values

Upgrade suggestions:

- `untrusted → trusted`: ≥ 200 verified runs (excluding auto-refunded), 7 consecutive days with `dispute_rate < 1%` and `unverified_rate < 0.5%`, responder-owner email + phone verified, no §6.4 circuit triggered in the window.
- `trusted → verified`: ≥ 10,000 verified runs, responder-owner legal/identity KYC, platform admin manual review, category-specific compliance (e.g. financial hotlines need a license).

Downgrade suggestions:

- `verified → trusted`: 30-day rolling `dispute_rate >= 3%` or any §6.4 circuit fires.
- `trusted → untrusted`: 30-day rolling `dispute_rate >= 5%` or subjective-dispute rate > 5%.
- Anything → `frozen`: 24h rolling `dispute_rate >= 10%` / `unverified_rate >= 5%` / pricing drift / dual-call inconsistency >= 30%.

### A.7 Worked Example: Hotline Price-change Compatibility

> Hotline `foxlab.text.classifier.v1` sells at 5000 cents ($50)/call. Caller A runs `prepare_request` at 10:00, receives a `prepared_request_id` and a task token whose claims freeze `max_charge_cents = 5000`, `exp = 10:05`. The responder owner changes the price to 10000 cents ($100)/call at 10:02.
>
> 1. Caller A sending the request between 10:00–10:05 settles at the old $50. The responder's reported usage must match the token claims; mismatch → `UNVERIFIED` and full auto-refund.
> 2. Caller A calling after 10:05 must `prepare_request` again, getting the new $100. The longest "old-price entitlement window" is `token_ttl_seconds = 300`.
> 3. Caller B starts `prepare_request` at 10:03 and immediately sees the new $100.
> 4. The platform emits `hotline.pricing_changed` to all caller agents who called this hotline in the past 24h.
> 5. At a mainstream $50/call price point, a 100% increase is highly sensitive to callers — supporting the recommendation that "raise prices via v1 → v2 suffix change", not in-place increases on the same hotline_id.

Compatibility recommendations:

- **Strongly prefer** expressing price changes as a new hotline_id suffix: `foxlab.text.classifier.v1` → `foxlab.text.classifier.v2`. Keep the old id with the old price for at least 90 days as a compatibility window.
- In-place price changes only for emergencies / regulatory requirements / fixing onboarding typos (change ≤ 50%).
- Any in-place price increase > 20% must pass platform admin manual approval.

### A.8 Hotline Output-risk Declaration (disclaimer) Field Draft

For the hotline mandatory-declaration obligation in §6.5.3, the recommendation is to introduce an independent `disclaimer` field at the same level as `pricing_hint`, in catalog entries and `template-bundle`:

```json
{
  "disclaimer": {
    "risk_categories": [
      "professional_advice",
      "creative_generation"
    ],
    "category_details": {
      "professional_advice": {
        "domains": ["legal", "medical", "financial"],
        "human_review_required": true
      },
      "creative_generation": {
        "may_contain_copyrighted_material": false,
        "ai_generated_disclosure_required": true
      }
    },
    "version": "0.2.0"
  }
}
```

Suggested starting taxonomy (draft; final list frozen by platform RFC):

| `risk_category` | Meaning | Typical examples |
| :--- | :--- | :--- |
| `professional_advice` | Professional advice (regulated category) | Legal / medical / financial / tax |
| `creative_generation` | Generative content with copyright risk | Text / image / music generation |
| `code_generation` | Generated code requiring sandboxed execution | Code completion / script / SQL |
| `executable_payload` | Contains executable commands / system instructions | Shell / SQL / system calls |
| `personal_data_exposure` | May contain PII | Extraction / synthesis of contact / identity info |
| `regulated_content` | Regulated category content | Medical devices / financial products / weapons / drugs |
| `time_sensitive` | Time-sensitive results, stale use may be wrong | Real-time data / prices / inventory |

Constraint suggestions (draft):

- `risk_categories` must not be empty (even pure-computation free hotlines should declare `[]` to explicitly say "no known risks").
- `category_details.<category>` is hotline-defined sub-declaration; the schema is not enforced at the protocol layer and is determined by each category's semantics.
- Caller agents must be able to fetch the disclaimer at `prepare_request` time; ops-console renders one human-readable label per category by default.
- Caller-side may set per-`risk_category` policies: `always_acknowledge / always_reject / ask_human`.

### A.9 Content-review Error Codes and Events (Additive to A.2)

Error codes (additive to A.2.1):

| Code | HTTP | retryable | Trigger |
| :--- | ---: | :--- | :--- |
| `ERR_HOTLINE_CONTENT_REVIEW_PENDING` | 423 | true (after review passes) | Hotline still under content review; tokens are not issued |
| `ERR_HOTLINE_DISCLAIMER_NOT_ACKNOWLEDGED` | 402 | false | Caller did not consent to a required disclaimer category |
| `ERR_RESULT_CONTENT_REJECTED` | 451 | false | Result rejected by platform content review before landing (matches §5.2 auto-refund) |

Events (additive to A.2.2):

| Event | Notes |
| :--- | :--- |
| `hotline.content_review_passed` | Content review passed (one of the prerequisites for first upgrade to trusted) |
| `hotline.content_review_failed` | Content review failed |
| `hotline.disclaimer_drift` | Actual result content classification disagrees with the hotline's self-declared disclaimer (§6.5.3 circuit) |
| `hotline.content_quarantine` | Temporarily delisted due to content risk (an intermediate state between trusted and frozen) |
| `caller.request.refunded_content_rejected` | Result rejected by content review; full auto-refund |

---

## Appendix B: References

- `docs/current/spec/architecture.md`: v0.1 protocol backbone and state machine
- `docs/current/spec/defaults-v0.1.md`: v0.1 frozen parameters
- `docs/current/spec/platform-api-v0.1.md`: existing control-plane API
- `docs/planned/roadmap/evolution-roadmap.md §2.4`: tenant_quota deferred to v0.2+
- `docs/planned/roadmap/evolution-roadmap.md §3`: multi-turn session reservation
- `docs/planned/design/repo-split-plan.md`: repository-split boundary
