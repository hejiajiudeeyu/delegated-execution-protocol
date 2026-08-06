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

import crypto from 'node:crypto';

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
  // A digest is optional in the ref, but a malformed one must not pass: a ref
  // carrying an unverifiable digest is worse than one carrying none, because
  // it looks like the binding was checked.
  if (ref.digest !== undefined && ref.digest !== null) {
    pushIf(errors, !isHotlineVersionDigest(ref.digest), 'hotline_version.digest must be sha256:<64 hex chars>');
  }
  return { valid: errors.length === 0, errors };
}

// ------------------------------------------------- immutable HotlineVersion
//
// FR-014 says a Call pins an immutable HotlineVersion. `validateHotlineVersionRef`
// above describes the pointer; this section describes the thing pointed at and,
// more importantly, makes its immutability CHECKABLE rather than promised.
//
// Why a digest and not just a version number: the platform stores versions in
// the same mutable snapshot as everything else. A number alone cannot tell you
// whether the record behind it was edited after a Call bound to it — and "the
// contract changed under a running call" is precisely the failure FR-014 names.
// With a content digest, both parties can ask the question and get an answer.

export const HOTLINE_VERSION_DIGEST_ALGORITHM = 'sha256';

// The fields that constitute the published promise. A version freezes the whole
// published document rather than a chosen "semantic" subset: arguing about
// which field is semantic is how a field that mattered ends up outside the
// freeze. Anything not listed here is platform-private or identity, not contract.
export const HOTLINE_VERSION_CONTRACT_FIELDS = Object.freeze([
  'hotline_id',
  'display_name',
  'description',
  'summary',
  'task_types',
  'service_id',
  'tags',
  'input_schema',
  'output_schema',
  'input_attachments',
  'output_attachments',
  'input_examples',
  'output_examples',
  'input_summary',
  'output_summary',
  'recommended_for',
  'not_recommended_for',
  'limitations',
  'pricing_hint',
  'recoverability'
]);

const HEX64 = /^[0-9a-f]{64}$/;

export function isHotlineVersionDigest(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const [algorithm, hex] = value.split(':');
  return algorithm === HOTLINE_VERSION_DIGEST_ALGORITHM && HEX64.test(hex || '');
}

/**
 * Deterministic JSON: object keys sorted at every depth, `undefined` dropped.
 *
 * Plain JSON.stringify preserves insertion order, so two services holding the
 * same contract can produce different bytes and therefore different digests.
 * A digest that depends on who computed it cannot answer "is this the same
 * contract", which is the only question it exists to answer.
 */
export function canonicalJsonString(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJsonString(item) ?? 'null').join(',')}]`;
  }
  const parts = [];
  for (const key of Object.keys(value).sort()) {
    const encoded = canonicalJsonString(value[key]);
    if (encoded !== undefined) {
      parts.push(`${JSON.stringify(key)}:${encoded}`);
    }
  }
  return `{${parts.join(',')}}`;
}

/** The contract fields of a published hotline, in canonical form. */
export function canonicalizeHotlineVersion(contract = {}) {
  const canonical = {};
  for (const field of HOTLINE_VERSION_CONTRACT_FIELDS) {
    if (contract[field] !== undefined) {
      canonical[field] = contract[field];
    }
  }
  return canonical;
}

export function hotlineVersionDigest(contract = {}) {
  const canonical = canonicalJsonString(canonicalizeHotlineVersion(contract)) ?? '{}';
  const hex = crypto.createHash(HOTLINE_VERSION_DIGEST_ALGORITHM).update(canonical, 'utf8').digest('hex');
  return `${HOTLINE_VERSION_DIGEST_ALGORITHM}:${hex}`;
}

/**
 * Validate a frozen HotlineVersion document.
 *
 * `version` is a string because the protocol must not care how a platform
 * numbers its versions; it must only care that the value is stable and that
 * the digest matches the content it claims to describe.
 */
export function validateHotlineVersion(version) {
  const errors = [];
  if (!isObject(version)) {
    return { valid: false, errors: ['hotline_version document must be an object'] };
  }
  pushIf(errors, !isNonEmptyString(version.hotline_id), 'hotline_id is required');
  pushIf(errors, !isNonEmptyString(version.version), 'version is required');
  pushIf(errors, !isNonEmptyString(version.published_at), 'published_at is required');
  pushIf(errors, !isObject(version.contract), 'contract is required');

  if (isObject(version.contract)) {
    pushIf(
      errors,
      version.contract.hotline_id !== undefined && version.contract.hotline_id !== version.hotline_id,
      'contract.hotline_id must match hotline_id'
    );
    pushIf(errors, !isObject(version.contract.input_schema), 'contract.input_schema is required');
    pushIf(errors, !isObject(version.contract.output_schema), 'contract.output_schema is required');
    if (version.contract.recoverability !== undefined && version.contract.recoverability !== null) {
      pushIf(
        errors,
        !Object.values(RECOVERABILITY_CLASS).includes(version.contract.recoverability),
        'contract.recoverability is unsupported'
      );
    }
  }

  if (!isHotlineVersionDigest(version.digest)) {
    errors.push('digest must be sha256:<64 hex chars>');
  } else if (isObject(version.contract) && hotlineVersionDigest(version.contract) !== version.digest) {
    // The whole point: a version whose digest does not match its own content
    // is not a frozen contract, it is an edited one wearing a version number.
    errors.push('digest does not match contract content');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Does this frozen version still describe the contract it claims to?
 * Callers use it to detect a version record edited in place after a Call bound
 * to it — the tamper case a version number alone cannot see.
 */
export function verifyHotlineVersionDigest(version) {
  if (!isObject(version) || !isObject(version.contract) || !isHotlineVersionDigest(version.digest)) {
    return { valid: false, errors: ['hotline_version document is not verifiable'] };
  }
  const actual = hotlineVersionDigest(version.contract);
  return actual === version.digest
    ? { valid: true, errors: [] }
    : { valid: false, errors: [`digest mismatch: content hashes to ${actual}`] };
}

/** The pointer a Call stores, derived from the frozen version it bound to. */
export function hotlineVersionRefOf(version) {
  if (!isObject(version)) {
    return null;
  }
  return {
    hotline_id: version.hotline_id,
    version: version.version,
    digest: version.digest,
    recoverability: recoverabilityOf(version.contract || {})
  };
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

// ------------------------------------------- observational request events

// Wire-level events a Responder may append to a Call it is executing, beyond
// the terminal COMPLETED/FAILED pair. These are observations, not state
// transitions — deliberately NOT part of CALL_EVENT, because progress is not
// a fifth axis and must never feed the execution projection or settlement.
export const OBSERVATIONAL_REQUEST_EVENT = Object.freeze({
  PROGRESS: 'PROGRESS',
  SOFT_TIMEOUT: 'SOFT_TIMEOUT'
});

export const REQUEST_PROGRESS_STAGE = Object.freeze({
  INPUT_FETCHING: 'input_fetching',
  EXECUTING: 'executing',
  OUTPUT_UPLOADING: 'output_uploading'
});

export const REQUEST_PROGRESS_MESSAGE_MAX_LENGTH = 280;
const REQUEST_PROGRESS_ATTEMPT_ID_MAX_LENGTH = 128;

// Everything a progress payload may carry. Unknown keys are rejected rather
// than passed through: an open detail bag on an unauthenticated-feeling
// "just telemetry" path is how side channels are born.
const REQUEST_PROGRESS_ALLOWED_KEYS = Object.freeze(['seq', 'stage', 'percent', 'message', 'attempt_id']);

export function validateRequestProgress(progress) {
  const errors = [];
  if (!isObject(progress)) {
    return { valid: false, errors: ['progress must be an object'] };
  }

  pushIf(errors, !isNonNegativeInteger(progress.seq), 'progress.seq must be a non-negative integer');
  pushIf(
    errors,
    !Object.values(REQUEST_PROGRESS_STAGE).includes(progress.stage),
    `progress.stage must be one of ${Object.values(REQUEST_PROGRESS_STAGE).join(', ')}`
  );

  if (progress.percent !== undefined && progress.percent !== null) {
    pushIf(
      errors,
      typeof progress.percent !== 'number' || Number.isNaN(progress.percent) || progress.percent < 0 || progress.percent > 100,
      'progress.percent must be a number between 0 and 100'
    );
  }

  if (progress.message !== undefined && progress.message !== null) {
    pushIf(errors, typeof progress.message !== 'string', 'progress.message must be a string');
    pushIf(
      errors,
      typeof progress.message === 'string' && progress.message.length > REQUEST_PROGRESS_MESSAGE_MAX_LENGTH,
      `progress.message must be at most ${REQUEST_PROGRESS_MESSAGE_MAX_LENGTH} characters`
    );
  }

  if (progress.attempt_id !== undefined && progress.attempt_id !== null) {
    pushIf(
      errors,
      !isNonEmptyString(progress.attempt_id) || progress.attempt_id.length > REQUEST_PROGRESS_ATTEMPT_ID_MAX_LENGTH,
      `progress.attempt_id must be a non-empty string of at most ${REQUEST_PROGRESS_ATTEMPT_ID_MAX_LENGTH} characters`
    );
  }

  for (const key of Object.keys(progress)) {
    pushIf(
      errors,
      !REQUEST_PROGRESS_ALLOWED_KEYS.includes(key),
      `progress.${key} is not an allowed field`
    );
  }

  return { valid: errors.length === 0, errors };
}
