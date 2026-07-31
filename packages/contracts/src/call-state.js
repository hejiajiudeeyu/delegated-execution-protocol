// Minimal M1 shared slice: the semantics Client and Platform must both
// understand for a Call. Frozen by the owner-approved decision A-04 and the
// canonical state model in docs/planned/design/mvp-architecture-decisions.md.
//
// The central rule this module encodes: execution success, verified delivery,
// Caller acceptance and a settled ledger are FOUR INDEPENDENT axes. Collapsing
// them into one status is how the current `request.status` ended up meaning
// four different things at once.
//
// What deliberately stays out: relay leases, scheduler jobs, retry counters,
// object-storage keys, UI filters. Those are platform-private.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

function pushIf(errors, condition, message) {
  if (condition) {
    errors.push(message);
  }
}

// ---------------------------------------------------------------- axes

export const EXECUTION_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  QUEUED: 'queued',
  EXECUTING: 'executing',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  TIMED_OUT: 'timed_out',
  CANCELED: 'canceled'
});

export const DELIVERY_INTEGRITY = Object.freeze({
  PENDING: 'pending',
  VERIFIED: 'verified',
  INVALID: 'invalid'
});

export const ACCEPTANCE_STATUS = Object.freeze({
  NOT_STARTED: 'not_started',
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REVISION_REQUESTED: 'revision_requested',
  DISPUTED: 'disputed',
  AUTO_ACCEPTED: 'auto_accepted'
});

export const SETTLEMENT_STATUS = Object.freeze({
  NONE: 'none',
  HELD: 'held',
  BLOCKED: 'blocked',
  SETTLED: 'settled',
  REFUNDED: 'refunded'
});

export const CALL_STATE_AXIS = Object.freeze({
  EXECUTION: 'execution',
  DELIVERY_INTEGRITY: 'delivery_integrity',
  ACCEPTANCE: 'acceptance',
  SETTLEMENT: 'settlement'
});

// How a HotlineVersion says its work may be treated after an interruption.
// Default is the conservative one: unknown work is never silently re-run.
export const RECOVERABILITY_CLASS = Object.freeze({
  NON_RECOVERABLE: 'non_recoverable',
  RESTARTABLE: 'restartable',
  CHECKPOINTED: 'checkpointed'
});

export const ARTIFACT_ROLE = Object.freeze({
  INPUT: 'input',
  OUTPUT: 'output',
  EVIDENCE: 'evidence'
});

export const ARTIFACT_LIFECYCLE = Object.freeze({
  ALLOCATED: 'allocated',
  COMMITTED: 'committed',
  EXPIRED: 'expired',
  DELETED: 'deleted'
});

export const CALL_EVENT = Object.freeze({
  SUBMITTED: 'call.submitted',
  ACCEPTED: 'call.accepted',
  REJECTED: 'call.rejected',
  QUEUED: 'call.queued',
  EXECUTION_STARTED: 'call.execution_started',
  DELIVERED: 'call.delivered',
  DELIVERY_VERIFIED: 'call.delivery_verified',
  DELIVERY_INVALID: 'call.delivery_invalid',
  FAILED: 'call.failed',
  TIMED_OUT: 'call.timed_out',
  CANCELED: 'call.canceled',
  RECONCILED: 'call.reconciled'
});

// ------------------------------------------------------- legal transitions

const EXECUTION_TRANSITIONS = Object.freeze({
  [EXECUTION_STATUS.SUBMITTED]: [
    EXECUTION_STATUS.ACCEPTED,
    EXECUTION_STATUS.REJECTED,
    EXECUTION_STATUS.CANCELED
  ],
  [EXECUTION_STATUS.ACCEPTED]: [
    EXECUTION_STATUS.QUEUED,
    EXECUTION_STATUS.EXECUTING,
    EXECUTION_STATUS.CANCELED,
    EXECUTION_STATUS.FAILED,
    EXECUTION_STATUS.TIMED_OUT
  ],
  [EXECUTION_STATUS.QUEUED]: [
    EXECUTION_STATUS.EXECUTING,
    EXECUTION_STATUS.CANCELED,
    EXECUTION_STATUS.FAILED,
    EXECUTION_STATUS.TIMED_OUT
  ],
  [EXECUTION_STATUS.EXECUTING]: [
    EXECUTION_STATUS.DELIVERED,
    EXECUTION_STATUS.FAILED,
    EXECUTION_STATUS.TIMED_OUT,
    EXECUTION_STATUS.CANCELED
  ],
  // Terminal: everything after delivery happens on the other three axes.
  [EXECUTION_STATUS.DELIVERED]: [],
  [EXECUTION_STATUS.REJECTED]: [],
  [EXECUTION_STATUS.FAILED]: [],
  [EXECUTION_STATUS.TIMED_OUT]: [],
  [EXECUTION_STATUS.CANCELED]: []
});

const DELIVERY_TRANSITIONS = Object.freeze({
  [DELIVERY_INTEGRITY.PENDING]: [DELIVERY_INTEGRITY.VERIFIED, DELIVERY_INTEGRITY.INVALID],
  // Verification is decided once; a re-delivery after a revision is a new
  // delivery record rather than a second verdict on this one.
  [DELIVERY_INTEGRITY.VERIFIED]: [],
  [DELIVERY_INTEGRITY.INVALID]: []
});

const ACCEPTANCE_TRANSITIONS = Object.freeze({
  [ACCEPTANCE_STATUS.NOT_STARTED]: [ACCEPTANCE_STATUS.PENDING],
  [ACCEPTANCE_STATUS.PENDING]: [
    ACCEPTANCE_STATUS.ACCEPTED,
    ACCEPTANCE_STATUS.AUTO_ACCEPTED,
    ACCEPTANCE_STATUS.REVISION_REQUESTED,
    ACCEPTANCE_STATUS.DISPUTED
  ],
  // The one revision returns to a fresh acceptance window.
  [ACCEPTANCE_STATUS.REVISION_REQUESTED]: [ACCEPTANCE_STATUS.PENDING],
  [ACCEPTANCE_STATUS.DISPUTED]: [ACCEPTANCE_STATUS.ACCEPTED, ACCEPTANCE_STATUS.AUTO_ACCEPTED],
  [ACCEPTANCE_STATUS.ACCEPTED]: [],
  [ACCEPTANCE_STATUS.AUTO_ACCEPTED]: []
});

const SETTLEMENT_TRANSITIONS = Object.freeze({
  [SETTLEMENT_STATUS.NONE]: [SETTLEMENT_STATUS.HELD],
  [SETTLEMENT_STATUS.HELD]: [
    SETTLEMENT_STATUS.SETTLED,
    SETTLEMENT_STATUS.REFUNDED,
    SETTLEMENT_STATUS.BLOCKED
  ],
  [SETTLEMENT_STATUS.BLOCKED]: [SETTLEMENT_STATUS.SETTLED, SETTLEMENT_STATUS.REFUNDED],
  // settled/refunded are final: exactly-once money means no second move.
  [SETTLEMENT_STATUS.SETTLED]: [],
  [SETTLEMENT_STATUS.REFUNDED]: []
});

const TRANSITIONS_BY_AXIS = Object.freeze({
  [CALL_STATE_AXIS.EXECUTION]: EXECUTION_TRANSITIONS,
  [CALL_STATE_AXIS.DELIVERY_INTEGRITY]: DELIVERY_TRANSITIONS,
  [CALL_STATE_AXIS.ACCEPTANCE]: ACCEPTANCE_TRANSITIONS,
  [CALL_STATE_AXIS.SETTLEMENT]: SETTLEMENT_TRANSITIONS
});

const EXECUTION_TERMINAL = Object.freeze([
  EXECUTION_STATUS.DELIVERED,
  EXECUTION_STATUS.REJECTED,
  EXECUTION_STATUS.FAILED,
  EXECUTION_STATUS.TIMED_OUT,
  EXECUTION_STATUS.CANCELED
]);

const ACCEPTANCE_CONCLUDED = Object.freeze([ACCEPTANCE_STATUS.ACCEPTED, ACCEPTANCE_STATUS.AUTO_ACCEPTED]);
const SETTLEMENT_FINAL = Object.freeze([SETTLEMENT_STATUS.SETTLED, SETTLEMENT_STATUS.REFUNDED]);

export function legalTransitionsFor(axis, from) {
  const table = TRANSITIONS_BY_AXIS[axis];
  if (!table) {
    return null;
  }
  return table[from] ? [...table[from]] : null;
}

/**
 * May this axis move from `from` to `to`?
 * A self-transition is allowed and idempotent: replaying an event must not be
 * an error, which is what makes at-least-once delivery safe to build on.
 */
export function canTransition(axis, from, to) {
  const allowed = legalTransitionsFor(axis, from);
  if (allowed === null) {
    return false;
  }
  if (from === to) {
    return true;
  }
  return allowed.includes(to);
}

export function validateCallStateTransition(axis, from, to) {
  const errors = [];
  if (!Object.values(CALL_STATE_AXIS).includes(axis)) {
    return { valid: false, errors: [`unknown state axis ${axis}`] };
  }
  if (legalTransitionsFor(axis, from) === null) {
    errors.push(`${axis} has no state ${from}`);
  }
  if (legalTransitionsFor(axis, to) === null) {
    errors.push(`${axis} has no state ${to}`);
  }
  if (errors.length === 0 && !canTransition(axis, from, to)) {
    errors.push(`${axis} cannot move from ${from} to ${to}`);
  }
  return { valid: errors.length === 0, errors };
}

export function isExecutionTerminal(status) {
  return EXECUTION_TERMINAL.includes(status);
}

/**
 * Has this Call finished in every sense that matters?
 * Reaching a terminal execution state is not enough — a delivered Call is only
 * done once acceptance concluded and the money moved. NFR-R01 requires every
 * Call to reach this within timeout + grace.
 */
export function isCallTerminal(state = {}) {
  if (!isExecutionTerminal(state.execution)) {
    return false;
  }
  if (state.execution !== EXECUTION_STATUS.DELIVERED) {
    // Nothing was delivered, so the only open question is the money.
    return state.settlement === SETTLEMENT_STATUS.NONE || SETTLEMENT_FINAL.includes(state.settlement);
  }
  return ACCEPTANCE_CONCLUDED.includes(state.acceptance) && SETTLEMENT_FINAL.includes(state.settlement);
}

/**
 * Check a four-axis combination for coherence.
 *
 * The per-axis transition tables cannot catch cross-axis nonsense such as
 * "settled but never accepted" or "acceptance running on an unverified
 * delivery", and those are exactly the states that cost money when they slip
 * through.
 */
export function validateCallState(state = {}) {
  const errors = [];
  if (!isObject(state)) {
    return { valid: false, errors: ['call state must be an object'] };
  }

  const { execution, delivery_integrity: delivery, acceptance, settlement } = state;
  pushIf(errors, !Object.values(EXECUTION_STATUS).includes(execution), 'execution status is unsupported');
  pushIf(errors, !Object.values(DELIVERY_INTEGRITY).includes(delivery), 'delivery_integrity status is unsupported');
  pushIf(errors, !Object.values(ACCEPTANCE_STATUS).includes(acceptance), 'acceptance status is unsupported');
  pushIf(errors, !Object.values(SETTLEMENT_STATUS).includes(settlement), 'settlement status is unsupported');
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // The acceptance clock starts only at verified delivery (A-05, FR-044).
  pushIf(
    errors,
    acceptance !== ACCEPTANCE_STATUS.NOT_STARTED && delivery !== DELIVERY_INTEGRITY.VERIFIED,
    'acceptance cannot start before delivery_integrity is verified'
  );

  // Nothing can be accepted that was never delivered.
  pushIf(
    errors,
    acceptance !== ACCEPTANCE_STATUS.NOT_STARTED && execution !== EXECUTION_STATUS.DELIVERED,
    'acceptance requires a delivered execution'
  );

  // Money never settles without a concluded acceptance.
  pushIf(
    errors,
    settlement === SETTLEMENT_STATUS.SETTLED && !ACCEPTANCE_CONCLUDED.includes(acceptance),
    'settlement cannot be settled before acceptance concludes'
  );

  // A pre-execution rejection must never have taken funds (FR-050).
  pushIf(
    errors,
    execution === EXECUTION_STATUS.REJECTED && settlement !== SETTLEMENT_STATUS.NONE,
    'a rejected call must not hold or move funds'
  );

  // Invalid delivery cannot be settled: a failed checksum is never a sale.
  pushIf(
    errors,
    delivery === DELIVERY_INTEGRITY.INVALID && settlement === SETTLEMENT_STATUS.SETTLED,
    'invalid delivery cannot be settled'
  );

  // Blocking funds is what a dispute does; it should not appear without one.
  pushIf(
    errors,
    settlement === SETTLEMENT_STATUS.BLOCKED && acceptance !== ACCEPTANCE_STATUS.DISPUTED,
    'settlement is blocked only while a dispute is open'
  );

  return { valid: errors.length === 0, errors };
}

export function initialCallState() {
  return {
    execution: EXECUTION_STATUS.SUBMITTED,
    delivery_integrity: DELIVERY_INTEGRITY.PENDING,
    acceptance: ACCEPTANCE_STATUS.NOT_STARTED,
    settlement: SETTLEMENT_STATUS.NONE
  };
}

// ------------------------------------------------- hotline version binding

/**
 * A Call pins an immutable HotlineVersion. Without this, changing a hotline
 * silently changes what an in-flight Call promised (FR-014).
 */
export function validateHotlineVersionRef(ref) {
  const errors = [];
  if (!isObject(ref)) {
    return { valid: false, errors: ['hotline_version must be an object'] };
  }
  pushIf(errors, !isNonEmptyString(ref.hotline_id), 'hotline_version.hotline_id is required');
  pushIf(errors, !isNonEmptyString(ref.version), 'hotline_version.version is required');
  if (ref.recoverability !== undefined && ref.recoverability !== null) {
    pushIf(
      errors,
      !Object.values(RECOVERABILITY_CLASS).includes(ref.recoverability),
      'hotline_version.recoverability is unsupported'
    );
  }
  return { valid: errors.length === 0, errors };
}

export function recoverabilityOf(ref) {
  const value = ref?.recoverability;
  return Object.values(RECOVERABILITY_CLASS).includes(value) ? value : RECOVERABILITY_CLASS.NON_RECOVERABLE;
}

/**
 * After an interruption, may this work be re-run automatically?
 * Only an explicitly restartable class may. Anything else must be reconciled
 * to an explicit terminal state instead — unknown work is never re-run and
 * never auto-settled (A-03, PRD Flow E).
 */
export function mayAutoRerun(ref) {
  return recoverabilityOf(ref) === RECOVERABILITY_CLASS.RESTARTABLE;
}

// -------------------------------------------------------- artifacts

// Storage locators must never cross the protocol: the descriptor travels, the
// bytes are fetched through scoped authorization (A-01). Rejecting these keys
// keeps a convenient shortcut from quietly becoming the contract.
const FORBIDDEN_ARTIFACT_KEYS = Object.freeze([
  'bucket',
  'bucket_name',
  'object_key',
  'storage_key',
  'presigned_url',
  'signed_url',
  'url',
  'local_path',
  'absolute_path'
]);

const CHECKSUM_ALGORITHMS = Object.freeze(['sha256', 'sha512']);

export function validateArtifactDescriptor(descriptor) {
  const errors = [];
  if (!isObject(descriptor)) {
    return { valid: false, errors: ['artifact descriptor must be an object'] };
  }

  pushIf(errors, !isNonEmptyString(descriptor.artifact_id), 'artifact.artifact_id is required');
  pushIf(errors, !Object.values(ARTIFACT_ROLE).includes(descriptor.role), 'artifact.role is unsupported');
  pushIf(errors, !isNonEmptyString(descriptor.media_type), 'artifact.media_type is required');
  pushIf(errors, !isNonNegativeInteger(descriptor.size_bytes), 'artifact.size_bytes must be a non-negative integer');

  const lifecycle = descriptor.lifecycle_state;
  pushIf(errors, !Object.values(ARTIFACT_LIFECYCLE).includes(lifecycle), 'artifact.lifecycle_state is unsupported');

  // A committed artifact must be verifiable; an allocated slot has no bytes yet.
  if (lifecycle === ARTIFACT_LIFECYCLE.COMMITTED || lifecycle === ARTIFACT_LIFECYCLE.DELETED) {
    const checksum = descriptor.checksum;
    if (!isObject(checksum)) {
      errors.push('artifact.checksum is required once bytes are committed');
    } else {
      pushIf(
        errors,
        !CHECKSUM_ALGORITHMS.includes(checksum.algorithm),
        `artifact.checksum.algorithm must be one of ${CHECKSUM_ALGORITHMS.join(', ')}`
      );
      pushIf(errors, !isNonEmptyString(checksum.value), 'artifact.checksum.value is required');
    }
  }

  if (descriptor.expires_at !== undefined && descriptor.expires_at !== null) {
    pushIf(
      errors,
      !isNonEmptyString(descriptor.expires_at) || Number.isNaN(Date.parse(descriptor.expires_at)),
      'artifact.expires_at must be an ISO timestamp'
    );
  }

  for (const key of FORBIDDEN_ARTIFACT_KEYS) {
    pushIf(
      errors,
      Object.prototype.hasOwnProperty.call(descriptor, key),
      `artifact descriptors must not carry ${key}; bytes are fetched through scoped authorization`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * A delivery may only be treated as verified when every required artifact is
 * committed with a matching checksum. NFR-R03: a failed checksum must never
 * become `delivered`.
 */
export function validateDeliveryArtifacts(artifacts = [], { requiredRoles = [] } = {}) {
  const errors = [];
  if (!Array.isArray(artifacts)) {
    return { valid: false, errors: ['artifacts must be an array'] };
  }

  artifacts.forEach((artifact, index) => {
    const result = validateArtifactDescriptor(artifact);
    for (const error of result.errors) {
      errors.push(`artifacts[${index}]: ${error}`);
    }
    pushIf(
      errors,
      result.valid && artifact.lifecycle_state !== ARTIFACT_LIFECYCLE.COMMITTED,
      `artifacts[${index}]: delivery requires committed artifacts, saw ${artifact.lifecycle_state}`
    );
  });

  for (const role of requiredRoles) {
    pushIf(
      errors,
      !artifacts.some((artifact) => artifact?.role === role && artifact?.lifecycle_state === ARTIFACT_LIFECYCLE.COMMITTED),
      `a committed ${role} artifact is required`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ------------------------------------------------------- reconciliation

/**
 * Validate a Provider's post-restart reconciliation report (A-03).
 * The report is what lets the platform close out work whose outcome the
 * platform could not observe; it must identify the attempt and the boot it
 * belongs to, or it cannot be trusted to describe this execution at all.
 */
export function validateReconciliationReport(report) {
  const errors = [];
  if (!isObject(report)) {
    return { valid: false, errors: ['reconciliation report must be an object'] };
  }
  pushIf(errors, !isNonEmptyString(report.call_id), 'reconciliation.call_id is required');
  pushIf(errors, !isNonEmptyString(report.attempt_id), 'reconciliation.attempt_id is required');
  pushIf(errors, !isNonEmptyString(report.boot_id), 'reconciliation.boot_id is required');
  pushIf(
    errors,
    !Object.values(EXECUTION_STATUS).includes(report.observed_execution),
    'reconciliation.observed_execution is unsupported'
  );
  pushIf(
    errors,
    report.observed_execution !== undefined && !isExecutionTerminal(report.observed_execution),
    'reconciliation must report a terminal execution status'
  );
  return { valid: errors.length === 0, errors };
}
