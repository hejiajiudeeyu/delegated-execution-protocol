// FR-011 / FR-012 and D8.2: the terms a hotline commits to, not just the shape
// of its payloads.
//
// Three questions that could not be asked in the protocol at all before this:
// how long the caller has to accept (tier), whether the work runs under
// supervision or sealed, and whether a machine may call it unattended. M2 makes
// them sayable and freezes them into the version; the acceptance window starts
// enforcing in M3, where there is finally something for it to fail.
import { describe, expect, it } from "vitest";

import {
  ACCEPTANCE_WINDOW_BOUNDS_S,
  DEFAULT_FULFILLMENT_MODE,
  DEFAULT_PRIVACY_MODE,
  DEFAULT_SERVICE_TIER,
  FULFILLMENT_MODE,
  HOTLINE_VERSION_CONTRACT_FIELDS,
  PRIVACY_MODE,
  SERVICE_TIER,
  SERVICE_TIER_ACCEPTANCE_WINDOW_S,
  acceptanceWindowSecondsOf,
  canonicalizeHotlineVersion,
  fulfillmentModeOf,
  hotlineVersionDigest,
  privacyModeOf,
  serviceTermsOf,
  serviceTierOf,
  validateHotlineContract,
  validateHotlineServiceTerms
} from "@delexec/contracts";

const HOUR = 60 * 60;

function contract(overrides = {}) {
  return {
    hotline_id: "test.parse.v1",
    input_schema: {
      type: "object",
      required: ["document"],
      additionalProperties: false,
      properties: { document: { type: "string" } }
    },
    output_schema: {
      type: "object",
      required: ["markdown"],
      additionalProperties: false,
      properties: { markdown: { type: "string" } }
    },
    input_examples: [{ title: "Parse a document", input: { document: "artifact:art_1" } }],
    output_examples: [{ title: "Parsed", output: { markdown: "# heading" } }],
    limitations: ["no scanned documents"],
    ...overrides
  };
}

describe("service tier and acceptance window (FR-011, A-05)", () => {
  it("maps each tier to its acceptance window", () => {
    expect(SERVICE_TIER_ACCEPTANCE_WINDOW_S[SERVICE_TIER.QUICK]).toBe(24 * HOUR);
    expect(SERVICE_TIER_ACCEPTANCE_WINDOW_S[SERVICE_TIER.STANDARD]).toBe(72 * HOUR);
    expect(SERVICE_TIER_ACCEPTANCE_WINDOW_S[SERVICE_TIER.DEEP]).toBe(7 * 24 * HOUR);
  });

  it("falls back to standard when a contract says nothing", () => {
    expect(serviceTierOf(contract())).toBe(DEFAULT_SERVICE_TIER);
    expect(acceptanceWindowSecondsOf(contract())).toBe(72 * HOUR);
  });

  it("lets an explicit window outrank the tier default", () => {
    // The tier is shorthand; a publisher who wrote a number meant it.
    const declared = contract({ service_tier: SERVICE_TIER.QUICK, acceptance_window_s: 48 * HOUR });
    expect(acceptanceWindowSecondsOf(declared)).toBe(48 * HOUR);
    expect(validateHotlineContract(declared).valid).toBe(true);
  });

  it("refuses a window outside the network bounds instead of clamping it", () => {
    // A window quietly moved is a promise quietly changed.
    const tooShort = validateHotlineContract(contract({ acceptance_window_s: ACCEPTANCE_WINDOW_BOUNDS_S.MIN - 1 }));
    expect(tooShort.valid).toBe(false);
    expect(tooShort.errors.join("\n")).toContain("acceptance_window_s must be between");

    const tooLong = validateHotlineContract(contract({ acceptance_window_s: ACCEPTANCE_WINDOW_BOUNDS_S.MAX + 1 }));
    expect(tooLong.valid).toBe(false);

    expect(validateHotlineContract(contract({ acceptance_window_s: 0 })).errors.join("\n")).toContain(
      "positive integer"
    );
    expect(validateHotlineContract(contract({ acceptance_window_s: 36 * HOUR + 0.5 })).valid).toBe(false);
    expect(validateHotlineContract(contract({ acceptance_window_s: "48h" })).valid).toBe(false);
  });

  it("refuses a tier it does not have a window for", () => {
    const result = validateHotlineContract(contract({ service_tier: "instant" }));
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("service_tier must be one of");
  });
});

describe("privacy mode (FR-012)", () => {
  it("defaults to supervised", () => {
    expect(privacyModeOf(contract())).toBe(DEFAULT_PRIVACY_MODE);
    expect(DEFAULT_PRIVACY_MODE).toBe(PRIVACY_MODE.SUPERVISED);
  });

  it("refuses sealed rather than running it supervised", () => {
    // The failure this prevents is the quiet one: accepting the declaration and
    // then executing under supervision would tell a publisher their data was
    // isolated when it was not.
    const result = validateHotlineContract(contract({ privacy_mode: PRIVACY_MODE.SEALED }));
    expect(result.valid).toBe(false);
    const message = result.errors.join("\n");
    expect(message).toContain("not supported in this deployment");
    expect(message).toContain("will not be run as supervised");
  });

  it("tells an unsupported mode apart from a nonexistent one", () => {
    // `sealed` is a real mode this deployment cannot honour; `open` is not a
    // mode at all. A publisher deserves to know which mistake they made.
    const unsupported = validateHotlineContract(contract({ privacy_mode: "sealed" })).errors.join("\n");
    const unknown = validateHotlineContract(contract({ privacy_mode: "open" })).errors.join("\n");
    expect(unsupported).toContain("not supported in this deployment");
    expect(unknown).toContain("privacy_mode must be one of");
    expect(unknown).not.toContain("not supported in this deployment");
  });

  it("accepts supervised", () => {
    expect(validateHotlineContract(contract({ privacy_mode: PRIVACY_MODE.SUPERVISED })).valid).toBe(true);
  });
});

describe("fulfillment mode (D8.2)", () => {
  it("defaults to auto so an existing contract is not suddenly unpublishable", () => {
    expect(fulfillmentModeOf(contract())).toBe(DEFAULT_FULFILLMENT_MODE);
    expect(DEFAULT_FULFILLMENT_MODE).toBe(FULFILLMENT_MODE.AUTO);
    expect(validateHotlineContract(contract()).valid).toBe(true);
  });

  it("carries confirm through", () => {
    const declared = contract({ fulfillment_mode: FULFILLMENT_MODE.CONFIRM });
    expect(fulfillmentModeOf(declared)).toBe("confirm");
    expect(validateHotlineContract(declared).valid).toBe(true);
  });

  it("refuses a mode nobody implements", () => {
    const result = validateHotlineContract(contract({ fulfillment_mode: "human_only" }));
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("fulfillment_mode must be one of");
  });
});

describe("the terms a Call freezes", () => {
  it("resolves every term, declared or defaulted", () => {
    expect(serviceTermsOf(contract({ service_tier: SERVICE_TIER.DEEP, fulfillment_mode: "confirm" }))).toEqual({
      service_tier: "deep",
      acceptance_window_s: 7 * 24 * HOUR,
      privacy_mode: "supervised",
      fulfillment_mode: "confirm"
    });
  });

  it("is part of the frozen contract, not metadata beside it", () => {
    for (const field of ["service_tier", "acceptance_window_s", "privacy_mode", "fulfillment_mode"]) {
      expect(HOTLINE_VERSION_CONTRACT_FIELDS).toContain(field);
    }
    const before = hotlineVersionDigest(contract());
    const after = hotlineVersionDigest(contract({ service_tier: SERVICE_TIER.QUICK }));
    expect(after).not.toBe(before);
  });

  it("does not move the digest of a version frozen before these fields existed", () => {
    // The trap this guards: if the platform wrote defaults onto existing
    // records, every Call already bound to one would start reporting
    // digest_mismatch. Absent stays absent.
    const legacy = contract();
    expect(Object.keys(canonicalizeHotlineVersion(legacy))).not.toContain("service_tier");
    expect(Object.keys(canonicalizeHotlineVersion(legacy))).not.toContain("fulfillment_mode");
    // Resolution happens on read, and reading must not mutate.
    expect(serviceTermsOf(legacy).fulfillment_mode).toBe("auto");
    expect(legacy.fulfillment_mode).toBeUndefined();
    expect(hotlineVersionDigest(legacy)).toBe(hotlineVersionDigest(contract()));
  });
});

describe("validateHotlineServiceTerms on its own", () => {
  it("passes a declaration that says nothing", () => {
    expect(validateHotlineServiceTerms({})).toEqual({ valid: true, errors: [] });
  });

  it("reports every bad term at once", () => {
    const result = validateHotlineServiceTerms({
      service_tier: "instant",
      acceptance_window_s: 5,
      privacy_mode: "sealed",
      fulfillment_mode: "human_only"
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(4);
  });
});
