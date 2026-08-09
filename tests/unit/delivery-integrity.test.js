// FR-040: whether an output actually satisfies the contract the Call pinned.
//
// Before M3, `schema_valid` was whatever the executor wrote into its own result
// object. The party being paid was the only party judging whether the work was
// done, and the platform settled on that judgement. This is the check that can
// fail — so the thing these tests care about most is that it CAN, and that it
// never reports a pass it did not actually establish.
import { describe, expect, it } from "vitest";

import { DELIVERY_INTEGRITY_CODE, validateDeliveredOutput } from "@delexec/contracts";

function contract(overrides = {}) {
  return {
    output_schema: {
      type: "object",
      required: ["markdown_sha256", "block_count"],
      additionalProperties: false,
      properties: {
        markdown_sha256: { type: "string", minLength: 64, maxLength: 64 },
        block_count: { type: "integer", minimum: 0 },
        backend: { type: "string", enum: ["pipeline", "vlm"] }
      }
    },
    ...overrides
  };
}

function okResult(overrides = {}) {
  return {
    status: "ok",
    output: { markdown_sha256: "a".repeat(64), block_count: 131 },
    ...overrides
  };
}

describe("validateDeliveredOutput", () => {
  it("accepts an output that satisfies the pinned output_schema", () => {
    const result = validateDeliveredOutput(contract(), okResult());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("names the offending field rather than only reporting that something was wrong", () => {
    const result = validateDeliveredOutput(
      contract(),
      okResult({ output: { markdown_sha256: "too short", block_count: 131 } })
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe("markdown_sha256");
    expect(result.errors[0].code).toBe(DELIVERY_INTEGRITY_CODE.OUTPUT_SCHEMA_VIOLATION);
  });

  it("names a required field that is absent", () => {
    const result = validateDeliveredOutput(contract(), okResult({ output: { block_count: 1 } }));

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === "markdown_sha256")).toBe(true);
  });

  it("rejects a success that carries no output at all", () => {
    const result = validateDeliveredOutput(contract(), { status: "ok" });

    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe(DELIVERY_INTEGRITY_CODE.OUTPUT_MISSING);
  });

  it("blames the contract, not the delivery, when the schema itself is unusable", () => {
    const result = validateDeliveredOutput(contract({ output_schema: { type: "not-a-type" } }), okResult());

    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe(DELIVERY_INTEGRITY_CODE.SCHEMA_UNUSABLE);
  });

  // The two honest non-answers. Reporting either as a violation would fail
  // every hotline published before the publication gate existed; reporting
  // either as verified would be a lie. They are neither, and the caller has to
  // be able to tell which happened.
  describe("what it declines to judge", () => {
    it("cannot check an output against a contract that declares no output_schema", () => {
      const result = validateDeliveredOutput({}, okResult());

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.unchecked).toContainEqual(
        expect.objectContaining({ aspect: "output_schema" })
      );
    });

    it("does not judge a failure by whether it looks like a success", () => {
      const result = validateDeliveredOutput(contract(), {
        status: "error",
        error: { code: "EXEC_TIMEOUT", message: "killed at hard timeout", retryable: true }
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    // An error result must not be gradeable as a verified delivery: M3 unit 2
    // opens the acceptance window on verified delivery, and nothing was
    // delivered here.
    it("marks a failure as unjudged rather than as a passing delivery", () => {
      const result = validateDeliveredOutput(contract(), {
        status: "error",
        error: { code: "EXEC_TIMEOUT", message: "killed at hard timeout", retryable: true }
      });

      expect(result.unchecked).toContainEqual(expect.objectContaining({ aspect: "output_schema" }));
    });
  });

  // The contract may require a file, not just well-formed JSON. Result
  // artifacts declare which contract role they fill in `contract_role`; the
  // `role` on an artifact DESCRIPTOR is a different vocabulary entirely
  // (input/output/evidence, ARTIFACT_ROLE) and must not be confused with it.
  describe("required output attachments", () => {
    const withRequiredFile = contract({
      output_attachments: {
        includes_files: true,
        file_roles: [
          { role: "mineru_markdown", required: true },
          { role: "extracted_image", required: false }
        ]
      }
    });

    it("accepts a delivery carrying the required contract role", () => {
      const result = validateDeliveredOutput(
        withRequiredFile,
        okResult({
          artifacts: [
            { artifact_id: "mineru_markdown", contract_role: "mineru_markdown", sha256: "a".repeat(64) }
          ]
        })
      );

      expect(result.valid).toBe(true);
    });

    it("does not require the optional roles", () => {
      const result = validateDeliveredOutput(
        withRequiredFile,
        okResult({ artifacts: [{ artifact_id: "md", contract_role: "mineru_markdown" }] })
      );

      expect(result.valid).toBe(true);
    });

    it("rejects a success that carries no artifacts when the contract requires one", () => {
      const result = validateDeliveredOutput(withRequiredFile, okResult({ artifacts: [] }));

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(DELIVERY_INTEGRITY_CODE.REQUIRED_ARTIFACT_MISSING);
      expect(result.errors[0].message).toContain("mineru_markdown");
    });

    it("names the missing role when other roles were delivered", () => {
      const result = validateDeliveredOutput(
        withRequiredFile,
        okResult({ artifacts: [{ artifact_id: "img_1", contract_role: "extracted_image" }] })
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(DELIVERY_INTEGRITY_CODE.REQUIRED_ARTIFACT_MISSING);
      expect(result.errors[0].field).toBe("artifacts.mineru_markdown");
    });

    // The shape every Responder produces today: artifacts with ids and
    // checksums but no statement of which contract role they fill. Failing
    // these would fail the only hotline on the network that has ever done real
    // work, on deliveries that are in fact complete. Passing them silently
    // would let any Responder skip the check forever by declining to answer.
    it("declines to judge artifacts that do not say which role they fill", () => {
      const result = validateDeliveredOutput(
        withRequiredFile,
        okResult({ artifacts: [{ artifact_id: "mineru_markdown", sha256: "a".repeat(64) }] })
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.unchecked).toContainEqual(
        expect.objectContaining({ aspect: "required_artifacts" })
      );
    });

    it("checks nothing about artifacts when the contract requires no files", () => {
      const result = validateDeliveredOutput(contract(), okResult({ artifacts: [] }));

      expect(result.valid).toBe(true);
      expect(result.unchecked).toEqual([]);
    });
  });

  it("reports every aspect it checked as checked, so a pass means something", () => {
    const result = validateDeliveredOutput(
      contract({
        output_attachments: { file_roles: [{ role: "mineru_markdown", required: true }] }
      }),
      okResult({ artifacts: [{ artifact_id: "md", contract_role: "mineru_markdown" }] })
    );

    expect(result).toEqual({ valid: true, errors: [], unchecked: [] });
  });
});
