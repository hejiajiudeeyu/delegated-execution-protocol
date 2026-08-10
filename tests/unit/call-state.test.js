import { describe, expect, it } from "vitest";

import {
  ACCEPTANCE_STATUS,
  ARTIFACT_LIFECYCLE,
  ARTIFACT_ROLE,
  CALL_EVENT,
  CALL_STATE_AXIS,
  DELIVERY_INTEGRITY,
  EXECUTION_STATUS,
  OBSERVATIONAL_REQUEST_EVENT,
  RECOVERABILITY_CLASS,
  REQUEST_PROGRESS_MESSAGE_MAX_LENGTH,
  REQUEST_PROGRESS_STAGE,
  SETTLEMENT_STATUS,
  canTransition,
  initialCallState,
  isCallTerminal,
  isExecutionTerminal,
  legalTransitionsFor,
  mayAutoRerun,
  recoverabilityOf,
  validateArtifactDescriptor,
  validateCallState,
  validateCallStateTransition,
  validateDeliveryArtifacts,
  validateHotlineVersionRef,
  validateReconciliationReport,
  validateRequestProgress
} from "@delexec/contracts";

describe("call state axes", () => {
  it("starts a call with all four axes at their opening value", () => {
    expect(initialCallState()).toEqual({
      execution: EXECUTION_STATUS.SUBMITTED,
      delivery_integrity: DELIVERY_INTEGRITY.PENDING,
      acceptance: ACCEPTANCE_STATUS.NOT_STARTED,
      settlement: SETTLEMENT_STATUS.NONE
    });
  });

  it("allows the normal execution path and refuses to skip acceptance", () => {
    expect(canTransition(CALL_STATE_AXIS.EXECUTION, EXECUTION_STATUS.SUBMITTED, EXECUTION_STATUS.ACCEPTED)).toBe(true);
    expect(canTransition(CALL_STATE_AXIS.EXECUTION, EXECUTION_STATUS.EXECUTING, EXECUTION_STATUS.DELIVERED)).toBe(true);
    // delivered is terminal on this axis: nothing moves after it
    expect(canTransition(CALL_STATE_AXIS.EXECUTION, EXECUTION_STATUS.DELIVERED, EXECUTION_STATUS.EXECUTING)).toBe(false);
    expect(legalTransitionsFor(CALL_STATE_AXIS.EXECUTION, EXECUTION_STATUS.DELIVERED)).toEqual([]);
  });

  it("refuses to skip straight from submitted to delivered", () => {
    const result = validateCallStateTransition(
      CALL_STATE_AXIS.EXECUTION,
      EXECUTION_STATUS.SUBMITTED,
      EXECUTION_STATUS.DELIVERED
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/cannot move from submitted to delivered/);
  });

  it("treats a self-transition as legal so replayed events stay idempotent", () => {
    expect(canTransition(CALL_STATE_AXIS.EXECUTION, EXECUTION_STATUS.EXECUTING, EXECUTION_STATUS.EXECUTING)).toBe(true);
    expect(canTransition(CALL_STATE_AXIS.SETTLEMENT, SETTLEMENT_STATUS.SETTLED, SETTLEMENT_STATUS.SETTLED)).toBe(true);
  });

  it("makes settled and refunded final so money cannot move twice", () => {
    expect(canTransition(CALL_STATE_AXIS.SETTLEMENT, SETTLEMENT_STATUS.SETTLED, SETTLEMENT_STATUS.REFUNDED)).toBe(false);
    expect(canTransition(CALL_STATE_AXIS.SETTLEMENT, SETTLEMENT_STATUS.REFUNDED, SETTLEMENT_STATUS.SETTLED)).toBe(false);
    expect(canTransition(CALL_STATE_AXIS.SETTLEMENT, SETTLEMENT_STATUS.HELD, SETTLEMENT_STATUS.SETTLED)).toBe(true);
  });

  it("returns a revision to a fresh acceptance window", () => {
    expect(
      canTransition(CALL_STATE_AXIS.ACCEPTANCE, ACCEPTANCE_STATUS.PENDING, ACCEPTANCE_STATUS.REVISION_REQUESTED)
    ).toBe(true);
    expect(
      canTransition(CALL_STATE_AXIS.ACCEPTANCE, ACCEPTANCE_STATUS.REVISION_REQUESTED, ACCEPTANCE_STATUS.PENDING)
    ).toBe(true);
  });

  it("rejects unknown axes and unknown states", () => {
    expect(validateCallStateTransition("mood", "happy", "sad").valid).toBe(false);
    const unknown = validateCallStateTransition(CALL_STATE_AXIS.EXECUTION, "spinning", EXECUTION_STATUS.DELIVERED);
    expect(unknown.valid).toBe(false);
    expect(unknown.errors[0]).toMatch(/no state spinning/);
  });
});

describe("terminal detection", () => {
  it("counts every execution end state as terminal", () => {
    for (const status of [
      EXECUTION_STATUS.DELIVERED,
      EXECUTION_STATUS.REJECTED,
      EXECUTION_STATUS.FAILED,
      EXECUTION_STATUS.TIMED_OUT,
      EXECUTION_STATUS.CANCELED
    ]) {
      expect(isExecutionTerminal(status), status).toBe(true);
    }
    expect(isExecutionTerminal(EXECUTION_STATUS.EXECUTING)).toBe(false);
  });

  it("does not call a delivered call finished until acceptance and money conclude", () => {
    const delivered = {
      execution: EXECUTION_STATUS.DELIVERED,
      delivery_integrity: DELIVERY_INTEGRITY.VERIFIED,
      acceptance: ACCEPTANCE_STATUS.PENDING,
      settlement: SETTLEMENT_STATUS.HELD
    };
    expect(isCallTerminal(delivered)).toBe(false);
    expect(
      isCallTerminal({ ...delivered, acceptance: ACCEPTANCE_STATUS.ACCEPTED, settlement: SETTLEMENT_STATUS.SETTLED })
    ).toBe(true);
    expect(
      isCallTerminal({ ...delivered, acceptance: ACCEPTANCE_STATUS.AUTO_ACCEPTED, settlement: SETTLEMENT_STATUS.SETTLED })
    ).toBe(true);
  });

  it("treats a rejected call as finished once no funds are outstanding", () => {
    expect(
      isCallTerminal({
        execution: EXECUTION_STATUS.REJECTED,
        delivery_integrity: DELIVERY_INTEGRITY.PENDING,
        acceptance: ACCEPTANCE_STATUS.NOT_STARTED,
        settlement: SETTLEMENT_STATUS.NONE
      })
    ).toBe(true);
    // a failed call still holding funds is not finished
    expect(
      isCallTerminal({
        execution: EXECUTION_STATUS.FAILED,
        delivery_integrity: DELIVERY_INTEGRITY.PENDING,
        acceptance: ACCEPTANCE_STATUS.NOT_STARTED,
        settlement: SETTLEMENT_STATUS.HELD
      })
    ).toBe(false);
  });
});

describe("cross-axis coherence", () => {
  const verifiedDelivery = {
    execution: EXECUTION_STATUS.DELIVERED,
    delivery_integrity: DELIVERY_INTEGRITY.VERIFIED,
    acceptance: ACCEPTANCE_STATUS.PENDING,
    settlement: SETTLEMENT_STATUS.HELD
  };

  it("accepts the states a normal call actually passes through", () => {
    expect(validateCallState(initialCallState()).valid).toBe(true);
    expect(validateCallState(verifiedDelivery).valid).toBe(true);
    expect(
      validateCallState({
        ...verifiedDelivery,
        acceptance: ACCEPTANCE_STATUS.ACCEPTED,
        settlement: SETTLEMENT_STATUS.SETTLED
      }).valid
    ).toBe(true);
  });

  it("refuses to start the acceptance clock before delivery is verified", () => {
    const result = validateCallState({ ...verifiedDelivery, delivery_integrity: DELIVERY_INTEGRITY.PENDING });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("acceptance cannot start before delivery_integrity is verified");
  });

  it("refuses to settle before acceptance concludes", () => {
    const result = validateCallState({ ...verifiedDelivery, settlement: SETTLEMENT_STATUS.SETTLED });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("settlement cannot be settled before acceptance concludes");
  });

  it("refuses to settle an invalid delivery", () => {
    const result = validateCallState({
      execution: EXECUTION_STATUS.DELIVERED,
      delivery_integrity: DELIVERY_INTEGRITY.INVALID,
      acceptance: ACCEPTANCE_STATUS.NOT_STARTED,
      settlement: SETTLEMENT_STATUS.SETTLED
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("invalid delivery cannot be settled");
  });

  it("refuses to take funds on a pre-execution rejection", () => {
    const result = validateCallState({
      execution: EXECUTION_STATUS.REJECTED,
      delivery_integrity: DELIVERY_INTEGRITY.PENDING,
      acceptance: ACCEPTANCE_STATUS.NOT_STARTED,
      settlement: SETTLEMENT_STATUS.HELD
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("a rejected call must not hold or move funds");
  });

  it("blocks funds only while a dispute is open", () => {
    expect(
      validateCallState({ ...verifiedDelivery, acceptance: ACCEPTANCE_STATUS.DISPUTED, settlement: SETTLEMENT_STATUS.BLOCKED })
        .valid
    ).toBe(true);
    const result = validateCallState({ ...verifiedDelivery, settlement: SETTLEMENT_STATUS.BLOCKED });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("settlement is blocked only while a dispute is open");
  });

  it("rejects unsupported values on any axis", () => {
    const result = validateCallState({ ...initialCallState(), execution: "vibing" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("execution status is unsupported");
  });
});

describe("hotline version binding and recoverability", () => {
  it("requires an id and a version", () => {
    expect(validateHotlineVersionRef({ hotline_id: "h.v1", version: "3" }).valid).toBe(true);
    expect(validateHotlineVersionRef({ hotline_id: "h.v1" }).errors).toContain("hotline_version.version is required");
    expect(validateHotlineVersionRef(null).valid).toBe(false);
  });

  it("defaults to the conservative recoverability class", () => {
    expect(recoverabilityOf({})).toBe(RECOVERABILITY_CLASS.NON_RECOVERABLE);
    expect(recoverabilityOf({ recoverability: "something-else" })).toBe(RECOVERABILITY_CLASS.NON_RECOVERABLE);
    expect(recoverabilityOf({ recoverability: RECOVERABILITY_CLASS.CHECKPOINTED })).toBe(
      RECOVERABILITY_CLASS.CHECKPOINTED
    );
  });

  it("only auto-reruns work explicitly declared restartable", () => {
    expect(mayAutoRerun({ recoverability: RECOVERABILITY_CLASS.RESTARTABLE })).toBe(true);
    expect(mayAutoRerun({ recoverability: RECOVERABILITY_CLASS.CHECKPOINTED })).toBe(false);
    expect(mayAutoRerun({})).toBe(false);
    expect(mayAutoRerun(undefined)).toBe(false);
  });

  it("rejects an unsupported recoverability class rather than guessing", () => {
    const result = validateHotlineVersionRef({ hotline_id: "h", version: "1", recoverability: "maybe" });
    expect(result.valid).toBe(false);
  });
});

describe("artifact descriptors", () => {
  const committed = () => ({
    artifact_id: "art_1",
    role: ARTIFACT_ROLE.OUTPUT,
    media_type: "application/pdf",
    size_bytes: 1024,
    lifecycle_state: ARTIFACT_LIFECYCLE.COMMITTED,
    checksum: { algorithm: "sha256", value: "a".repeat(64) },
    expires_at: "2026-08-30T00:00:00.000Z"
  });

  it("accepts a well-formed committed descriptor", () => {
    expect(validateArtifactDescriptor(committed()).valid).toBe(true);
  });

  it("requires a checksum once bytes are committed", () => {
    const { checksum, ...withoutChecksum } = committed();
    const result = validateArtifactDescriptor(withoutChecksum);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("artifact.checksum is required once bytes are committed");
    expect(checksum).toBeTruthy();
  });

  it("allows an allocated slot to have no checksum yet", () => {
    const { checksum, ...allocated } = committed();
    expect(validateArtifactDescriptor({ ...allocated, lifecycle_state: ARTIFACT_LIFECYCLE.ALLOCATED }).valid).toBe(true);
    expect(checksum).toBeTruthy();
  });

  it("refuses storage locators so bytes stay behind scoped authorization", () => {
    for (const key of ["bucket", "object_key", "presigned_url", "url", "local_path"]) {
      const result = validateArtifactDescriptor({ ...committed(), [key]: "some-value" });
      expect(result.valid, key).toBe(false);
      expect(result.errors.some((error) => error.includes(key))).toBe(true);
    }
  });

  it("rejects an unsupported checksum algorithm", () => {
    const result = validateArtifactDescriptor({
      ...committed(),
      checksum: { algorithm: "md5", value: "x".repeat(32) }
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a malformed expiry rather than ignoring it", () => {
    const result = validateArtifactDescriptor({ ...committed(), expires_at: "next tuesday" });
    expect(result.valid).toBe(false);
  });
});

describe("delivery artifact checks", () => {
  const committedOutput = {
    artifact_id: "art_out",
    role: ARTIFACT_ROLE.OUTPUT,
    media_type: "application/json",
    size_bytes: 12,
    lifecycle_state: ARTIFACT_LIFECYCLE.COMMITTED,
    checksum: { algorithm: "sha256", value: "b".repeat(64) }
  };

  it("passes when every required role is committed", () => {
    const result = validateDeliveryArtifacts([committedOutput], { requiredRoles: [ARTIFACT_ROLE.OUTPUT] });
    expect(result.valid).toBe(true);
  });

  it("fails when a required role is missing", () => {
    const result = validateDeliveryArtifacts([committedOutput], {
      requiredRoles: [ARTIFACT_ROLE.OUTPUT, ARTIFACT_ROLE.EVIDENCE]
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("a committed evidence artifact is required");
  });

  it("refuses an artifact that is still only allocated", () => {
    const result = validateDeliveryArtifacts([{ ...committedOutput, lifecycle_state: ARTIFACT_LIFECYCLE.ALLOCATED }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("requires committed artifacts"))).toBe(true);
  });

  it("reports the index of each bad artifact", () => {
    const result = validateDeliveryArtifacts([committedOutput, { role: "nonsense" }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.startsWith("artifacts[1]"))).toBe(true);
  });
});

describe("reconciliation reports", () => {
  const report = () => ({
    call_id: "call_1",
    attempt_id: "attempt_1",
    boot_id: "boot_1",
    observed_execution: EXECUTION_STATUS.FAILED
  });

  it("accepts a report that identifies the attempt and its boot", () => {
    expect(validateReconciliationReport(report()).valid).toBe(true);
  });

  it("requires attempt and boot identity", () => {
    const { attempt_id, ...withoutAttempt } = report();
    expect(validateReconciliationReport(withoutAttempt).errors).toContain("reconciliation.attempt_id is required");
    expect(attempt_id).toBeTruthy();
    const { boot_id, ...withoutBoot } = report();
    expect(validateReconciliationReport(withoutBoot).errors).toContain("reconciliation.boot_id is required");
    expect(boot_id).toBeTruthy();
  });

  it("refuses a report that leaves the call still running", () => {
    const result = validateReconciliationReport({ ...report(), observed_execution: EXECUTION_STATUS.EXECUTING });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("reconciliation must report a terminal execution status");
  });
});

describe("observational request events", () => {
  const progress = (overrides = {}) => ({
    seq: 3,
    stage: REQUEST_PROGRESS_STAGE.EXECUTING,
    percent: 40,
    message: "page 4 of 10",
    attempt_id: "attempt_abc",
    ...overrides
  });

  it("keeps observational events out of the CALL_EVENT transition vocabulary", () => {
    // Progress is an observation, not a fifth axis: nothing here may ever be
    // read back into the execution projection.
    for (const value of Object.values(OBSERVATIONAL_REQUEST_EVENT)) {
      expect(Object.values(CALL_EVENT)).not.toContain(value);
    }
  });

  it("accepts a full and a minimal progress payload", () => {
    expect(validateRequestProgress(progress()).valid).toBe(true);
    expect(validateRequestProgress({ seq: 0, stage: REQUEST_PROGRESS_STAGE.INPUT_FETCHING }).valid).toBe(true);
  });

  it("requires a non-negative integer seq and a known stage", () => {
    expect(validateRequestProgress(progress({ seq: -1 })).errors).toContain(
      "progress.seq must be a non-negative integer"
    );
    expect(validateRequestProgress(progress({ seq: 1.5 })).valid).toBe(false);
    const { seq, ...withoutSeq } = progress();
    expect(validateRequestProgress(withoutSeq).valid).toBe(false);
    expect(seq).toBeDefined();
    expect(validateRequestProgress(progress({ stage: "reticulating" })).valid).toBe(false);
  });

  it("bounds percent to 0-100 and message to the declared maximum", () => {
    expect(validateRequestProgress(progress({ percent: 101 })).valid).toBe(false);
    expect(validateRequestProgress(progress({ percent: -0.1 })).valid).toBe(false);
    expect(validateRequestProgress(progress({ percent: 100 })).valid).toBe(true);
    expect(
      validateRequestProgress(progress({ message: "x".repeat(REQUEST_PROGRESS_MESSAGE_MAX_LENGTH + 1) })).valid
    ).toBe(false);
    expect(
      validateRequestProgress(progress({ message: "x".repeat(REQUEST_PROGRESS_MESSAGE_MAX_LENGTH) })).valid
    ).toBe(true);
  });

  it("rejects unknown fields so progress cannot become an open side channel", () => {
    const result = validateRequestProgress(progress({ output_preview: "base64..." }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("progress.output_preview is not an allowed field");
  });
});

// FR-025. `queued` and `executing` have been distinct since M1 and the whole
// test tree never mentioned either — a state defined but never asserted is a
// state nobody has checked the shape of. M3 unit 6 is the platform's first use
// of them, so the table it is about to rely on gets pinned first.
describe("queued execution (FR-025)", () => {
  it("lets an accepted call wait before it runs", () => {
    expect(canTransition(CALL_STATE_AXIS.EXECUTION, EXECUTION_STATUS.ACCEPTED, EXECUTION_STATUS.QUEUED)).toBe(true);
    expect(canTransition(CALL_STATE_AXIS.EXECUTION, EXECUTION_STATUS.QUEUED, EXECUTION_STATUS.EXECUTING)).toBe(true);
  });

  // The distinction the state exists to make: waiting is not working. A queued
  // call that reports delivery has skipped the only step that could have
  // produced something to deliver.
  it("does not let a queued call deliver without executing", () => {
    expect(canTransition(CALL_STATE_AXIS.EXECUTION, EXECUTION_STATUS.QUEUED, EXECUTION_STATUS.DELIVERED)).toBe(false);
  });

  it("lets a queued call be canceled, fail or time out without ever running", () => {
    for (const target of [EXECUTION_STATUS.CANCELED, EXECUTION_STATUS.FAILED, EXECUTION_STATUS.TIMED_OUT]) {
      expect(canTransition(CALL_STATE_AXIS.EXECUTION, EXECUTION_STATUS.QUEUED, target)).toBe(true);
    }
  });

  it("treats re-reporting queued as idempotent rather than illegal", () => {
    expect(canTransition(CALL_STATE_AXIS.EXECUTION, EXECUTION_STATUS.QUEUED, EXECUTION_STATUS.QUEUED)).toBe(true);
  });

  it("is not a terminal state — a queued call is still owed an outcome", () => {
    expect(isExecutionTerminal(EXECUTION_STATUS.QUEUED)).toBe(false);
    expect(isExecutionTerminal(EXECUTION_STATUS.EXECUTING)).toBe(false);
  });

  it("names both wire events, so a responder can report waiting and starting", () => {
    expect(CALL_EVENT.QUEUED).toBe("call.queued");
    expect(CALL_EVENT.EXECUTION_STARTED).toBe("call.execution_started");
  });

  // The reason a progress beat cannot stand in for the transition: observations
  // are deliberately outside CALL_EVENT and must never feed the execution
  // projection, so "stage: executing" in a PROGRESS event is not the responder
  // saying it started.
  it("keeps the progress beat out of the execution vocabulary", () => {
    expect(Object.values(CALL_EVENT)).not.toContain(OBSERVATIONAL_REQUEST_EVENT.PROGRESS);
  });
});
