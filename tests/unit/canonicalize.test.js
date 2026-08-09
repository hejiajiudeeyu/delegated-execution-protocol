import { describe, expect, it } from "vitest";

import { canonicalizeResultPackageForSignature } from "@delexec/contracts";

describe("canonicalizeResultPackageForSignature (extended)", () => {
  it("returns empty object for undefined input", () => {
    expect(canonicalizeResultPackageForSignature()).toEqual({});
  });

  it("returns empty object for empty object input", () => {
    expect(canonicalizeResultPackageForSignature({})).toEqual({});
  });

  it("includes error field when present", () => {
    const result = canonicalizeResultPackageForSignature({
      request_id: "req_1",
      status: "error",
      error: { code: "AUTH_TOKEN_EXPIRED", message: "expired" }
    });

    expect(result).toEqual({
      request_id: "req_1",
      status: "error",
      error: { code: "AUTH_TOKEN_EXPIRED", message: "expired" }
    });
  });

  it("includes usage field when present", () => {
    const result = canonicalizeResultPackageForSignature({
      request_id: "req_1",
      status: "ok",
      output: { summary: "done" },
      usage: { tokens_in: 42, tokens_out: 24 }
    });

    expect(result.usage).toEqual({ tokens_in: 42, tokens_out: 24 });
  });

  it("preserves only canonical keys and ignores all others", () => {
    const result = canonicalizeResultPackageForSignature({
      request_id: "req_1",
      result_version: "0.1.0",
      responder_id: "s1",
      hotline_id: "a1",
      status: "ok",
      output: {},
      message_type: "remote_hotline_result",
      verification: { display_code: "CODE123" },
      artifacts: [{ name: "report.pdf", sha256: "abc" }],
      error: null,
      timing: { elapsed_ms: 5 },
      usage: { tokens_in: 1, tokens_out: 1 },
      signature_algorithm: "Ed25519",
      signature_base64: "xxx",
      signature_valid: true,
      schema_valid: true,
      extra: true
    });

    expect(Object.keys(result).sort()).toEqual(
      ["artifacts", "error", "hotline_id", "message_type", "output", "request_id", "responder_id", "result_version", "status", "timing", "usage", "verification"]
    );
  });

  it("handles result with only request_id", () => {
    const result = canonicalizeResultPackageForSignature({
      request_id: "req_1"
    });
    expect(result).toEqual({ request_id: "req_1" });
  });

  it("preserves nested objects by reference", () => {
    const output = { nested: { deep: true } };
    const result = canonicalizeResultPackageForSignature({
      request_id: "req_1",
      status: "ok",
      output
    });
    expect(result.output).toBe(output);
  });

  // FR-040: a signed result used to say which hotline it came from but never
  // which CONTRACT it claims to satisfy, so a result produced under v1 was
  // cryptographically indistinguishable from one produced under v2.
  describe("hotline_version (M3)", () => {
    it("signs over the contract version the result claims to satisfy", () => {
      const hotlineVersion = { hotline_id: "a1", version: 2, digest: "sha256:abc" };
      const result = canonicalizeResultPackageForSignature({
        request_id: "req_1",
        responder_id: "s1",
        hotline_id: "a1",
        hotline_version: hotlineVersion,
        status: "ok",
        output: { markdown: "#" }
      });

      expect(result.hotline_version).toEqual(hotlineVersion);
    });

    it("signs the same bytes as before for a result that does not carry one", () => {
      // The back-compat guarantee, as bytes rather than as a promise: a
      // Responder that predates this field is absent from the canonical form,
      // so its existing signatures still verify. It simply carries less to
      // check — a lower integrity grade, not an invalid signature. Refusing to
      // verify every older Responder would be this change breaking delivery in
      // order to describe it better.
      const preM3Result = {
        message_type: "remote_hotline_result",
        request_id: "req_1",
        result_version: "0.1.0",
        responder_id: "s1",
        hotline_id: "a1",
        status: "ok",
        output: { markdown: "#" }
      };

      expect(JSON.stringify(canonicalizeResultPackageForSignature(preM3Result))).toBe(
        '{"message_type":"remote_hotline_result","request_id":"req_1","result_version":"0.1.0","responder_id":"s1","hotline_id":"a1","status":"ok","output":{"markdown":"#"}}'
      );
    });

    it("keeps hotline_version next to hotline_id, so key order is stable for both shapes", () => {
      const withVersion = canonicalizeResultPackageForSignature({
        request_id: "req_1",
        hotline_id: "a1",
        hotline_version: { hotline_id: "a1", version: 2, digest: "sha256:abc" },
        status: "ok",
        output: {}
      });

      expect(Object.keys(withVersion)).toEqual([
        "request_id",
        "hotline_id",
        "hotline_version",
        "status",
        "output"
      ]);
    });
  });
});
