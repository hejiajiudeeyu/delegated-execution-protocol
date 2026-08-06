// FR-014: a Call pins an immutable HotlineVersion.
//
// The version number alone cannot answer "is this still the contract the Call
// bound to" — the platform keeps versions in the same mutable snapshot as
// everything else, so a record edited in place keeps its number. These tests
// pin the property that makes immutability checkable instead of promised.
import { describe, expect, it } from "vitest";

import {
  HOTLINE_VERSION_CONTRACT_FIELDS,
  canonicalJsonString,
  canonicalizeHotlineVersion,
  hotlineVersionDigest,
  hotlineVersionRefOf,
  isHotlineVersionDigest,
  RECOVERABILITY_CLASS,
  validateHotlineVersion,
  validateHotlineVersionRef,
  verifyHotlineVersionDigest
} from "@delexec/contracts";

function contract(overrides = {}) {
  return {
    hotline_id: "local.mineru.pdf.parse.v1",
    display_name: "MinerU PDF parse",
    input_schema: { type: "object", required: ["document"], properties: { document: { type: "string" } } },
    output_schema: { type: "object", properties: { markdown: { type: "string" } } },
    recoverability: RECOVERABILITY_CLASS.RESTARTABLE,
    ...overrides
  };
}

function frozen(overrides = {}) {
  const body = contract(overrides.contract || {});
  return {
    hotline_id: body.hotline_id,
    version: "3",
    published_at: "2026-08-06T00:00:00.000Z",
    contract: body,
    digest: hotlineVersionDigest(body),
    ...("digest" in overrides ? { digest: overrides.digest } : {}),
    ...("version" in overrides ? { version: overrides.version } : {})
  };
}

describe("canonicalJsonString", () => {
  it("sorts keys at every depth so two producers agree", () => {
    const a = { b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } };
    const b = { a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 };
    expect(canonicalJsonString(a)).toBe(canonicalJsonString(b));
  });

  it("drops undefined rather than emitting it", () => {
    expect(canonicalJsonString({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it("preserves array order, which is meaningful", () => {
    expect(canonicalJsonString([2, 1])).not.toBe(canonicalJsonString([1, 2]));
  });
});

describe("hotlineVersionDigest", () => {
  it("is stable across key ordering", () => {
    const one = contract();
    const two = {};
    for (const key of Object.keys(one).reverse()) {
      two[key] = one[key];
    }
    expect(hotlineVersionDigest(two)).toBe(hotlineVersionDigest(one));
  });

  it("changes when any contract field changes", () => {
    const base = hotlineVersionDigest(contract());
    expect(hotlineVersionDigest(contract({ limitations: "no scanned PDFs" }))).not.toBe(base);
    expect(hotlineVersionDigest(contract({ output_schema: { type: "object" } }))).not.toBe(base);
    expect(hotlineVersionDigest(contract({ display_name: "renamed" }))).not.toBe(base);
  });

  it("ignores fields outside the contract, which are identity or platform-private", () => {
    const base = hotlineVersionDigest(contract());
    expect(hotlineVersionDigest({ ...contract(), responder_id: "rsp_1", status: "enabled" })).toBe(base);
    expect(HOTLINE_VERSION_CONTRACT_FIELDS).not.toContain("responder_id");
    expect(HOTLINE_VERSION_CONTRACT_FIELDS).not.toContain("task_delivery_address");
  });

  it("produces a well-formed algorithm-tagged digest", () => {
    expect(isHotlineVersionDigest(hotlineVersionDigest(contract()))).toBe(true);
    expect(isHotlineVersionDigest("deadbeef")).toBe(false);
    expect(isHotlineVersionDigest("md5:" + "a".repeat(64))).toBe(false);
    expect(isHotlineVersionDigest("sha256:" + "a".repeat(63))).toBe(false);
  });
});

describe("canonicalizeHotlineVersion", () => {
  it("keeps only declared contract fields", () => {
    const canonical = canonicalizeHotlineVersion({ ...contract(), responder_id: "rsp_1", secret: "x" });
    expect(canonical.responder_id).toBeUndefined();
    expect(canonical.secret).toBeUndefined();
    expect(canonical.input_schema).toBeDefined();
  });
});

describe("validateHotlineVersion", () => {
  it("accepts a well-formed frozen version", () => {
    expect(validateHotlineVersion(frozen())).toEqual({ valid: true, errors: [] });
  });

  it("rejects a version whose digest does not match its own content", () => {
    const tampered = frozen();
    tampered.contract.limitations = "quietly added after publication";
    const result = validateHotlineVersion(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("digest does not match contract content");
  });

  it("requires identity, publication time and both schemas", () => {
    expect(validateHotlineVersion({}).valid).toBe(false);
    const noVersion = frozen();
    delete noVersion.version;
    expect(validateHotlineVersion(noVersion).errors).toContain("version is required");
    const noPublishedAt = frozen();
    delete noPublishedAt.published_at;
    expect(validateHotlineVersion(noPublishedAt).errors).toContain("published_at is required");
    const noOutput = frozen();
    delete noOutput.contract.output_schema;
    expect(validateHotlineVersion(noOutput).errors).toContain("contract.output_schema is required");
  });

  it("rejects a contract that claims a different hotline than its version record", () => {
    const mismatched = frozen();
    mismatched.contract.hotline_id = "someone.elses.hotline";
    expect(validateHotlineVersion(mismatched).errors).toContain("contract.hotline_id must match hotline_id");
  });

  it("rejects an unsupported recoverability class", () => {
    const bad = frozen({ contract: { recoverability: "probably-fine" } });
    expect(validateHotlineVersion(bad).valid).toBe(false);
  });
});

describe("verifyHotlineVersionDigest", () => {
  it("detects a version edited in place after publication", () => {
    const version = frozen();
    expect(verifyHotlineVersionDigest(version).valid).toBe(true);
    version.contract.pricing_hint = { base_price_cents: 1 };
    const result = verifyHotlineVersionDigest(version);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/digest mismatch/);
  });

  it("refuses to call an unverifiable record valid", () => {
    expect(verifyHotlineVersionDigest(null).valid).toBe(false);
    expect(verifyHotlineVersionDigest({ contract: contract() }).valid).toBe(false);
  });
});

describe("hotlineVersionRefOf", () => {
  it("derives the pointer a Call stores, and it validates as a ref", () => {
    const version = frozen();
    const ref = hotlineVersionRefOf(version);
    expect(ref).toMatchObject({
      hotline_id: version.hotline_id,
      version: "3",
      digest: version.digest,
      recoverability: RECOVERABILITY_CLASS.RESTARTABLE
    });
    expect(validateHotlineVersionRef(ref)).toEqual({ valid: true, errors: [] });
  });

  it("defaults recoverability to non_recoverable when the contract does not declare one", () => {
    const version = frozen();
    delete version.contract.recoverability;
    expect(hotlineVersionRefOf(version).recoverability).toBe(RECOVERABILITY_CLASS.NON_RECOVERABLE);
  });
});

describe("validateHotlineVersionRef with a digest", () => {
  it("rejects a malformed digest rather than ignoring it", () => {
    const result = validateHotlineVersionRef({ hotline_id: "h", version: "1", digest: "sha256:nope" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("hotline_version.digest must be sha256:<64 hex chars>");
  });

  it("still accepts a ref with no digest, which is the M1 shape", () => {
    expect(validateHotlineVersionRef({ hotline_id: "h", version: "1" }).valid).toBe(true);
  });
});
