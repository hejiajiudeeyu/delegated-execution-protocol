# Private Capability Network MVP Architecture Decisions (A-01 – A-04) and the Four-Axis State Model

> Chinese version: [mvp-architecture-decisions.zh-CN.md](mvp-architecture-decisions.zh-CN.md)
> Note: the Chinese document is the source of truth.

- Status: **owner approved** (2026-07-31) as the MVP baseline
- Source PRD: `CALL ANYTHING next-stage product requirements v1.0` (strategy-frozen 2026-07-16)
- Approval record: workspace `.trellis/tasks/07-17-call-anything-private-capability-network-mvp/decisions.md`
- Milestones: M1 (A-01/A-02/A-03), M1–M3 (A-04)
- This document defines only the semantics **Client and Platform must both understand**. Field names, table names, API paths and storage technology are not frozen here; they remain owning-repo implementation details.

## Why these decisions belong at the protocol layer

None of the four can be decided by one side alone: artifact descriptors cross repositories, the Provider connection model decides who initiates, restart reconciliation needs both sides to interpret "unknown" identically, and the state axes decide which semantics are shared truth. Letting these grow inside implementations produces two incompatible implicit contracts — exactly how today's single `request.status` ended up conflating execution, delivery, acceptance and money.

---

## A-01 Artifact data path

**Decision**: Platform manages artifact **metadata and authorization**; bytes live in **S3-compatible object storage**, and the official Compose may bundle MinIO. The protocol carries descriptors only — never bucket keys or presigned URLs.

**Minimum descriptor semantics carried by the protocol**:

| Semantic | Purpose |
|---|---|
| artifact identity | stable within a Call, referenceable by Delivery |
| role | `input` / `output` / `evidence` |
| media type and size | receiver-side pre-checks and limits |
| checksum | algorithm + value; **a failed checksum must never be marked delivered** (NFR-R03) |
| expiry | authorization window; an expired descriptor no longer redeems bytes |
| lifecycle state | allocated / committed / expired / deleted (tombstone retained after byte deletion) |

**Explicitly not in the protocol**: bucket names, object keys, presigned URLs, storage backend type, chunked-retransmission strategy. These are Platform-private; encoding them in the protocol would weld storage choice into a cross-repo contract.

**Recommended flow**: allocate a scoped slot → direct upload → commit hash/size → Relay carries only the descriptor → receiver downloads under scoped authorization → output takes the reverse path → Delivery Integrity becomes `verified` only after every check passes.

**Rationale**: pushing bytes through Relay would make the message channel own large-file transfer and retransmission semantics — the bottleneck named in PRD risk R2 — and Relay currently has no authentication at all.

---

## A-02 Provider connection model

**Decision**: an **authenticated Relay Inbox with Provider-initiated HTTPS long polling**, using visibility leases, idempotent lease ACK, backoff and jitter.

**Key points**:

- Providers open **no inbound port**, so devices behind NAT or an office network can still join. This is the precondition for "public cross-device".
- **Connection presence is not health**: long polling does not replace heartbeat (FR-003). Capacity, maintenance windows and version still arrive via heartbeat.
- Lease semantics: a claimed message enters an invisibility window; ACK is idempotent; an un-ACKed lease becomes visible again. **Visible again does not mean safe to re-run** — that is A-03's recoverability class.

**Hard security precondition**: the six transport-relay routes are unauthenticated, and the public edge used to proxy them directly (withdrawn on both Caddy and production nginx on 2026-07-31, health probe only). **No private document or evidence may enter that channel before relay authentication lands.** M1 real-data testing is gated on it.

**Rationale**: Platform-initiated push requires inbound-reachable devices, which contradicts the private-device scenario. A persistent WebSocket is no simpler for reconnect and idempotency, and adds edge-proxy complexity.

---

## A-03 Restart and reconciliation

**Decision**: the **HotlineVersion declares a recoverability class**, and Platform derives money and terminal state from it:

| Class | Semantics | Behavior after restart |
|---|---|---|
| `non_recoverable` (default) | not safe to re-run | move to an explicit failure terminal state and refund; **never auto re-run** |
| `restartable` | safe to re-run from the start | idempotently redeliver the same Call without a second hold |
| `checkpointed` | resumable from a checkpoint | resume via the local journal; P0 requires only safe closure, resumption is P1 |

**Core constraint**: **a RUNNING task whose result is unknown must never auto-settle and never be blindly re-run** (PRD Flow E). Unknown must converge to either recovery or an explicit terminal state; permanent silent pending is forbidden (NFR-R01).

**Recovery proof (MVP form)**: the Provider keeps an append-only local task journal (`attempt_id`, `boot_id`, transition sequence, checkpoint/output-manifest digest) and submits a **signed reconciliation report** after restart. TPM or remote attestation is out of scope for this stage.

**Ownership**: Client owns the local journal and recovery execution; Platform owns reconciliation judgement and financial blocking/refund.

---

## A-04 Shared state boundary (protocol truth vs platform-private)

**Decision**: the protocol defines the **four orthogonal state axes, their legal transitions, cross-repo objects/events and financial error semantics**; Platform stores append-only Call events and projections.

**Protocol truth**: the four axes and their legal transitions, cross-repo identity and binding of Call / HotlineVersion / Artifact / Delivery, terminal-state definitions, financial error-code semantics (insufficient balance, duplicate operation, invariant conflict).

**Platform-private**: relay leases, scheduler jobs, retry counters, object storage keys, Console filters and pagination, audit projections, UI state.

### The four-axis state model (canonical)

The PRD's central insight: **execution success ≠ verified delivery ≠ Caller acceptance ≠ a settled ledger.** These are orthogonal and must not be collapsed into one status.

| Axis | Values |
|---|---|
| Execution | `submitted` / `accepted` / `rejected` / `queued` / `executing` / `delivered` / `failed` / `timed_out` / `canceled` |
| Delivery Integrity | `pending` / `verified` / `invalid` |
| Acceptance | `not_started` / `pending` / `accepted` / `revision_requested` / `disputed` / `auto_accepted` |
| Settlement | `none` / `held` / `blocked` / `settled` / `refunded` |

### Normalization rulings (resolving PRD-internal conflicts)

The source PRD deliberately leaves fields open, but these conflicts must be ruled on explicitly rather than encoded by accident:

1. **`delivered` is narrowed**: on the Execution axis it means **only "the Responder submitted result bytes"**, never that delivery is valid. Validity lives on the Delivery Integrity axis. Merging the two is the most dangerous reading of FR-030.
2. **Placing `submitted` / `rejected`**: `submitted` is the Execution axis's initial state; `rejected` is a **pre-execution refusal** (FR-021) and is not interchangeable with Delivery Integrity's `invalid`.
3. **Acceptance clock start**: the acceptance window starts **only when Delivery Integrity becomes `verified`** (FR-044), not when a Responder submits bytes. It restarts after the single revision.
4. **Terminal definition**: Execution is terminal at `rejected` / `failed` / `timed_out` / `canceled` / (`delivered` with Acceptance concluded). **Every Call must reach a terminal state within timeout + grace** (NFR-R01 and the guardrail metrics).

### Legal transitions (Execution axis)

```
submitted ─→ accepted ─→ queued ─→ executing ─→ delivered
    │           │           │          │
    │           │           │          └─→ failed / timed_out / canceled
    │           │           └─→ failed / timed_out / canceled
    │           └─→ canceled
    └─→ rejected
```

- `rejected` is reachable only from `submitted` and **produces no hold** (FR-050).
- After `delivered` there are no further Execution transitions; everything else happens on the Delivery/Acceptance/Settlement axes.
- Which phases allow cancellation is Platform policy, but **a `delivered` Call cannot be canceled** — it goes through acceptance or dispute.

### Cross-axis coupling (financial transition matrix)

| Trigger | Delivery | Acceptance | Settlement |
|---|---|---|---|
| pre-execution reject | — | — | `none` (never held) |
| task accepted | `pending` | `not_started` | `held` |
| verification failed | `invalid` | not started | `refunded` |
| verification passed | `verified` | `pending` (clock starts) | `held` |
| Caller accepts | `verified` | `accepted` | `settled` |
| window expires | `verified` | `auto_accepted` | `settled` |
| revision requested | `verified` | `revision_requested` | `held` (original hold reused, no new hold) |
| dispute raised | `verified` | `disputed` | `blocked` |
| dispute resolved | `verified` | `accepted` or dispute concluded | `settled` or `refunded` |
| unrecoverable failure / timeout | `pending` or `invalid` | not started | `refunded` |

**Exactly-once requirement** (NFR-R04): `held` / `settled` / `refunded` occur at most once per Call. Implementation needs idempotency-key scope, event identity, replay/conflict behavior and a transaction boundary — the phrase itself is not a design, and M3 must supply one with crash/retry tests.

---

## Gap against today (input for M1 decomposition)

| Today | Gap |
|---|---|
| single `request.status` plus billing events | split into four independent axes and event projections |
| result signature and output checksum implemented | missing frozen-schema validation and a separately persisted Delivery Integrity state |
| relay inbox/outbox with dedupe and ACK | missing authentication, visibility leases, capacity and maintenance state |
| output artifact hash and attachment binding | missing cross-device input upload, lifecycle authorization, resumable transfer |
| settlement follows execution completion | missing acceptance gate, dispute freeze, revision economics, crash-safe multi-entry transaction |

## Not frozen here

Tier pricing, concrete acceptance-window values, concrete retention periods and commission rules are product policy — see the platform repository's `docs/planned/design/mvp-policy-decisions.md` (A-05/A-06/A-07).
