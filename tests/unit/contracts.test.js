import { describe, expect, it } from "vitest";

import { canonicalizeResultPackageForSignature, ERROR_DOMAIN, REQUEST_STATUS, validateResultPackage } from "@delexec/contracts";

describe("@delexec/contracts", () => {
  it("contains MVP request statuses", () => {
    expect(REQUEST_STATUS).toMatchObject({
      CREATED: "CREATED",
      ACKED: "ACKED",
      SUCCEEDED: "SUCCEEDED",
      TIMED_OUT: "TIMED_OUT",
      UNVERIFIED: "UNVERIFIED"
    });
  });

  it("contains stable error domains", () => {
    expect(Object.values(ERROR_DOMAIN)).toEqual(
      expect.arrayContaining(["AUTH", "CONTRACT", "EXEC", "RESULT", "DELIVERY", "TEMPLATE", "PLATFORM"])
    );
  });

  it("canonicalizes only signable result fields", () => {
    expect(
      canonicalizeResultPackageForSignature({
        message_type: "remote_hotline_result",
        request_id: "req_1",
        result_version: "0.1.0",
        responder_id: "responder_foxlab",
        hotline_id: "foxlab.text.classifier.v1",
        verification: { display_code: "CODE123" },
        status: "ok",
        output: { summary: "done" },
        artifacts: [{ name: "report.pdf", sha256: "abc" }],
        timing: { elapsed_ms: 10 },
        signature_algorithm: "Ed25519",
        signature_base64: "x",
        extra_field: true
      })
    ).toEqual({
      message_type: "remote_hotline_result",
      request_id: "req_1",
      result_version: "0.1.0",
      responder_id: "responder_foxlab",
      hotline_id: "foxlab.text.classifier.v1",
      verification: { display_code: "CODE123" },
      status: "ok",
      output: { summary: "done" },
      artifacts: [{ name: "report.pdf", sha256: "abc" }],
      timing: { elapsed_ms: 10 }
    });
  });

  it("canonicalize includes human_summary when present", () => {
    const result = canonicalizeResultPackageForSignature({
      request_id: "req_2",
      responder_id: "r",
      hotline_id: "h",
      status: "ok",
      output: { label: "x" },
      timing: { elapsed_ms: 50 },
      human_summary: "分类完成",
      extra_field: true
    });
    expect(result.human_summary).toBe("分类完成");
    expect(result.extra_field).toBeUndefined();
  });

  describe("validateResultPackage", () => {
    const minimalOk = () => ({
      request_id: "req_1",
      responder_id: "responder_test",
      hotline_id: "test.hotline.v1",
      status: "ok",
      output: { answer: "hello" },
      timing: { elapsed_ms: 100 }
    });

    const minimalError = () => ({
      request_id: "req_2",
      responder_id: "responder_test",
      hotline_id: "test.hotline.v1",
      status: "error",
      error: { code: "EXEC_TIMEOUT", message: "timed out", retryable: true },
      timing: { elapsed_ms: 30000 }
    });

    it("accepts a valid ok result package", () => {
      const { valid, errors } = validateResultPackage(minimalOk());
      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it("accepts a valid error result package", () => {
      const { valid, errors } = validateResultPackage(minimalError());
      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it("accepts ok package with optional fields", () => {
      const pkg = {
        ...minimalOk(),
        human_summary: "分类完成",
        usage: { tokens_in: 100, tokens_out: 50 },
        timing: { accepted_at: "2026-01-01T00:00:00Z", finished_at: "2026-01-01T00:00:01Z", elapsed_ms: 1000 }
      };
      const { valid } = validateResultPackage(pkg);
      expect(valid).toBe(true);
    });

    it("rejects missing request_id", () => {
      const pkg = { ...minimalOk(), request_id: undefined };
      const { valid, errors } = validateResultPackage(pkg);
      expect(valid).toBe(false);
      expect(errors).toContain("missing request_id");
    });

    it("rejects missing responder_id", () => {
      const pkg = { ...minimalOk(), responder_id: undefined };
      const { valid, errors } = validateResultPackage(pkg);
      expect(valid).toBe(false);
      expect(errors).toContain("missing responder_id");
    });

    it("rejects invalid status value", () => {
      const pkg = { ...minimalOk(), status: "SUCCEEDED" };
      const { valid, errors } = validateResultPackage(pkg);
      expect(valid).toBe(false);
      expect(errors.some(e => e.includes("status"))).toBe(true);
    });

    it("rejects ok status without output", () => {
      const pkg = { ...minimalOk(), output: undefined };
      const { valid, errors } = validateResultPackage(pkg);
      expect(valid).toBe(false);
      expect(errors).toContain("status=ok requires output");
    });

    it("rejects error status without error object", () => {
      const pkg = { ...minimalError(), error: undefined };
      const { valid, errors } = validateResultPackage(pkg);
      expect(valid).toBe(false);
      expect(errors.some(e => e.includes("error"))).toBe(true);
    });

    it("rejects error status with missing error.code", () => {
      const pkg = { ...minimalError(), error: { message: "oops", retryable: false } };
      const { valid, errors } = validateResultPackage(pkg);
      expect(valid).toBe(false);
      expect(errors).toContain("error.code is required");
    });

    it("rejects missing timing", () => {
      const pkg = { ...minimalOk(), timing: undefined };
      const { valid, errors } = validateResultPackage(pkg);
      expect(valid).toBe(false);
      expect(errors.some(e => e.includes("timing"))).toBe(true);
    });

    it("rejects timing without elapsed_ms", () => {
      const pkg = { ...minimalOk(), timing: { accepted_at: "2026-01-01T00:00:00Z" } };
      const { valid, errors } = validateResultPackage(pkg);
      expect(valid).toBe(false);
      expect(errors).toContain("timing.elapsed_ms is required");
    });

    it("accepts timing.elapsed_ms of 0", () => {
      const pkg = { ...minimalOk(), timing: { elapsed_ms: 0 } };
      const { valid } = validateResultPackage(pkg);
      expect(valid).toBe(true);
    });

    it("rejects non-object input", () => {
      const { valid, errors } = validateResultPackage(null);
      expect(valid).toBe(false);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
