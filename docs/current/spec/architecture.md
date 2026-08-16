# Remote Hotline Protocol — Architecture

> This file is the repository's **architecture truth source**: system boundaries,
> role responsibilities, mode invariants, versioning and the trust model.
> Chinese source: [architecture.zh-CN.md](architecture.zh-CN.md). That file is
> authoritative; this one is derived from it and must be updated in the same change.

## 0. What this document is, and is not

**Is**: why the system has the shape it has, and which properties no single
implementation is allowed to change.

**Is not**: field tables, endpoint lists, error code registries. Those move, and
copying them here is how a document rots. The previous version of this file was
last touched on 2026-04-01. It carried a full set of contract and result-package
field tables — and by 2026-08 it mentioned `service_tier`, `execution_budget_s`,
`acceptance_window_s`, `delivery_integrity`, settlement and trust tiers exactly
zero times. The document claiming to define the system's invariants predated the
entire contract model the system now runs on. It also listed several paths that
no longer existed as truth sources.

So this version states invariants only, and points at the truth sources for
everything else.

### Truth source layering

**Runtime truth sources** — the running code and its tests decide

- `packages/contracts/src/*.js`: contract structure, version digests, and the
  machine-decidable definitions of state and error
- `tests/unit/*`, `tests/integration/*`: behavioural verification of the above
- `docs/templates/hotlines/*/`: capability declaration templates and examples,
  mechanically validated by `tests/unit/schema-validation.test.js`
- `apps/*/src` and the integration tests in the platform and client repositories:
  runtime API behaviour, auth branches, state transitions

**Architecture truth source**: this file.

**Normative derivatives** — must match the runtime

- `platform-api-v0.1.md`: the external API specification
- `defaults-v0.1.md`: frozen defaults and value bounds
- `remote-hotline-scope.md`: what counts as a remote hotline
- `../guides/integration-playbook.md`: end-to-end integration handbook

**Descriptive derivatives**: `README*.md`, `../diagrams/*`, `../testing/*`.

Maintenance rules: descriptive documents must not invent fields, state enums or
error codes; where a normative document and the runtime disagree, fix the code or
the test first and then the document; where a diagram and a normative document
disagree, the document wins and the diagram is fixed in the same change.

## 1. Scope and principles

### 1.1 Goal

Let an agent reliably delegate a piece of work to an executor **outside its own
trust boundary**, and afterwards be able to tell whether that work was actually
done as agreed.

"Remote" names the **execution and trust boundary**, not physical distance. A
single machine (`L0`), a local network (`L2`) and an external channel (`L3`) are
all valid operating modes of this protocol.

The current shape is a **single-operator, self-hosted private capability
network**: one operator runs one network and approves the responders and hotlines
that join it. The protocol assumes no public marketplace, rating or
recommendation system.

### 1.2 Non-goals

- No real-time low-latency channel guarantee (asynchronous by default)
- No peripheral business systems unrelated to closing the loop
- No subjective-rating-driven display, scoring or recommendation

### 1.3 Invariants

No implementation may change these:

1. **Contract first.** Every interaction can be expressed as structured JSON.
2. **The contract follows the worker.** A hotline's declaration comes from the
   program that serves it. The platform does not guess, does not fill in, does
   not complete from a template — missing reads as missing (§3).
3. **Idempotence first.** `request_id` runs through the whole path.
4. **Minimum trust.** Short-lived tokens and signed results; the platform holds
   no long-lived keys.
5. **Portability.** Transport is a `TransportAdapter` abstraction, decoupled from
   the business state machine.
6. **Modes are decoupled.** `L0`–`L3` differ only in the communication topology
   and runtime boundary between controllers. They must **not** change protocol
   semantics, request/result structure, state machine transitions or idempotence
   rules.
7. **Minimum local control-plane exposure.** The console front end never holds a
   long-lived API key directly; sensitive capabilities are reached through a
   local session, an encrypted secret store, and a gateway/supervisor proxy.

## 2. Roles and boundaries

- **Caller** — delegates. Handles input and output only, and never carries the
  executor's dependencies.
- **Responder** — the executing device. Holds the worker and the signing key, and
  declares to the platform which hotlines it serves.
- **Platform** — the minimal control plane: catalogue, tokens, delivery metadata,
  events, metrics. It **executes nothing**.
- **Transport Adapter** — the channel between caller and responder (local relay,
  email, and so on).
- **Operator** — the person who approves responders and hotlines. Approval is the
  one judgement in this protocol made by a human.

The trust boundary falls between caller and responder. The platform is a third
party neither side fully trusts, which is why it holds no long-lived keys and
never states a fact on either side's behalf.

## 3. Hotlines and hotline versions

A **hotline** is a local program plus a **contract**: what it takes, what it
returns, what it is not for, how long it needs, and what it costs.

### 3.1 The declaration comes from the worker

The platform used to fill in missing schemas from a template, and once described
a PDF parser to the public as a text summariser. It does not guess any more: with
no declaration it says `contract_declared: false`.

Which means **silence must be distinguishable from an answer**. A process-adapter
worker answering `--contract` must carry `contract_version` — a worker that does
not implement the flag still prints valid JSON (it thinks you sent it a task),
and without that positive signal the noise is mistaken for a declaration.

### 3.2 A version is frozen by digest

Approval freezes a **hotline version**: the canonicalized content of a set of
contract fields, and their content digest. `HOTLINE_VERSION_CONTRACT_FIELDS` in
`packages/contracts/src/call-state.js` is the single list of those fields.

Two rules follow:

- **The digest decides a resubmission.** One that hashes to the published version
  keeps its approval; anything that moves the digest — including a changed
  display name — re-enters review. Silence about a field carries it forward
  rather than clearing it.
- **Defaults are resolved on read and never written to the record.** Writing a
  default onto an existing version record changes its content, and every call
  already bound to that version starts reporting `digest_mismatch`. This is also
  why adding a name to the field list is digest-safe.

### 3.3 A declaration has to reach the catalogue

This is where this repository keeps failing, so it is written down as an
invariant.

A declaration must travel **worker → registration draft → submission body →
frozen version → public catalogue**. A field dropped at any hop raises no error:
the catalogue looks complete, and one line on it is wrong. It has happened four
times — attachment declarations hardcoded to null; the two fields a price consent
must name dropped by a catalogue projection; the worker's declared service tier
overwritten by a guessed default; and then, after that was fixed, dropped again
by the draft builder and the submission body, live in production on a priced
hotline.

Therefore: **every contract field must be proven to complete the journey**,
rather than depending on whoever adds the next field remembering four call sites.
`tools/contract-conformance.mjs` in the workspace repository drives that
assertion from the protocol's own field list — add a name to the list and the
check fails until somebody classifies it as proven-carried, as something a worker
must not decide, or as not provable today.

## 4. Service terms and two clocks

A hotline declares its **service tier**, and the tier decides two things at once:

- **acceptance window** `acceptance_window_s` — how long the caller has to accept
- **execution budget** `execution_budget_s` — the span the platform judges the
  execution by

Every clock in the system derives from these two numbers. A model loading cold
can take minutes; when the work needs longer, declare `execution_budget_s`
explicitly rather than hoping the tier default happens to fit.

**Out-of-bounds values are refused, not clamped.** A budget quietly moved is a
promise quietly changed. The bounds live in
`packages/contracts/src/hotline-contract.js` and `defaults-v0.1.md`.

Two further mode fields:

- `privacy_mode` — how data is treated at the executor. `sealed` is named even
  though nothing can currently honour it: **a mode this deployment cannot serve
  is a different fact from a mode that does not exist**, and a publisher who
  declares it deserves to be told which.
- `fulfillment_mode` — `auto` means a machine may call on its own; `confirm`
  means the calling side must confirm first. This is not a promise, it is a
  **safeguard**: dropping `confirm` to `auto` lets agents bypass the human
  confirmation the publisher required.

## 5. Delivery integrity

A call binds to a specific hotline version, and its delivery is judged against
**that version**, not against whatever the catalogue says now.

Three outcomes, which must stay distinguishable:

- `verified` — the output was checked against the contract this call pinned, and
  everything was checkable
- `unchecked` — something could not be judged; `reason` names what. This is
  **weaker**, not failed
- failed — definitively does not conform

Output files must carry `contract_role`. That is a different vocabulary from an
artifact descriptor's `role` (`input`/`output`/`evidence`, the direction bytes
travel) — do not mix them. A missing role raises no error; it silently downgrades
the delivery to `unchecked`.

## 6. Acceptance and settlement

Money on a priced hotline moves **hold → accept → settle**.

**Consent must name the listing it consents to.** Besides
`billing.max_charge_cents`, the caller must state `pricing_hint_version` and
`trust_tier_seen`. Agreeing to "20 PTS" without saying which published listing
said 20 is not agreement to anything checkable, and the platform refuses it. It
follows that a resubmission advances the listing version and invalidates consent
given against the old one — correctly.

`trust_tier` is the trust grading the caller saw when consenting. It is part of
the consent, not decoration.

## 7. Tokens and signatures

- Task tokens are short-lived and bound to `request_id`, responder and hotline
- Results are signed by the responder and verified by the caller against its
  public key
- The platform holds no long-lived keys; public key rotation has its own protocol
- A change of responder public key, delivery address or responder identity
  re-enters review even when the contract digest is unchanged — an identical
  contract served by something that has been swapped is precisely the
  substitution an operator must see

Details in `platform-api-v0.1.md`.

## 8. State machine, idempotence and timeouts

The request state machine has a projection for the caller, the responder and the
platform, but **one semantics**: `request_id` decides what counts as the same
piece of work, a repeated delivery does not produce a second execution, and a
finished result is replayed rather than recomputed.

Timeouts must be attributed by layer, or a bottleneck cannot be located:

```
T_total = T_delivery + T_queue + T_exec + T_accept
```

`T_exec` is bounded by `execution_budget_s` and `T_accept` by
`acceptance_window_s` (§4). These two layers are not operational tuning
parameters; they are promises the hotline made about itself.

## 9. Versioning and compatibility

- Protocol version, contract version and package version are three different
  things and must not stand in for one another
- The contract field list grows; existing names do not change meaning. Additions
  are digest-safe for versions already frozen (§3.2)
- A breaking change takes a new version number and is frozen in step in
  `defaults-v0.1.md` and `platform-api-v0.1.md`

## 10. Maintaining this file

- This file states **invariants**. When you want to add a field table here, that
  table belongs in `platform-api-v0.1.md` or in the code.
- Update `architecture.zh-CN.md` in the same change; it is the source.
- Where this file and the runtime disagree, the runtime wins and this file is
  corrected immediately. A document that calls itself the architecture truth
  source while being out of date is worse than no document, because anyone
  building a mental model from it is missing a whole layer.
