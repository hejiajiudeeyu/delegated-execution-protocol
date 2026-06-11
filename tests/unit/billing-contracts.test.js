import { describe, expect, it } from "vitest";

import {
  BILLING_ERROR_CODE,
  BILLING_EVENT,
  PRICING_MODEL,
  TRUST_TIER,
  isKnownErrorCode,
  isRetryableErrorCode,
  validateBillingUsage,
  validatePricingHint,
  validateTaskBillingClaims,
  validateResultPackage
} from "@delexec/contracts";

describe("billing and pricing protocol contracts", () => {
  const fixedPricingHint = () => ({
    pricing_model: PRICING_MODEL.FIXED_PRICE,
    currency: "PTS",
    fixed_price_cents: 500,
    base_price_cents: null,
    variable_unit: null,
    variable_unit_description: null,
    variable_unit_price_cents: null,
    max_total_cents: 500,
    free_tier: { calls_per_month: 1 },
    billing_disclosure_url: "https://callanything.xyz/marketplace/responders/foxlab",
    trust_tier: TRUST_TIER.UNTRUSTED
  });

  it("exports additive pricing, trust, error, and event constants", () => {
    expect(Object.values(PRICING_MODEL)).toEqual(["fixed_price", "base_plus_duration", "base_plus_tokens"]);
    expect(Object.values(TRUST_TIER)).toEqual(expect.arrayContaining(["untrusted", "trusted", "verified"]));
    expect(BILLING_ERROR_CODE.BILLING_CONSENT_REQUIRED).toBe("ERR_BILLING_CONSENT_REQUIRED");
    expect(BILLING_ERROR_CODE.PREPAID_BALANCE_INSUFFICIENT).toBe("ERR_PREPAID_BALANCE_INSUFFICIENT");
    expect(BILLING_EVENT.REQUEST_BILLING_HELD).toBe("caller.request.billing_held");
    expect(BILLING_EVENT.REQUEST_REFUNDED_FAILED).toBe("caller.request.refunded_failed");
  });

  it("registers billing error retryability for downstream callers", () => {
    expect(isKnownErrorCode(BILLING_ERROR_CODE.BILLING_CONSENT_REQUIRED)).toBe(true);
    expect(isRetryableErrorCode(BILLING_ERROR_CODE.BILLING_CONSENT_REQUIRED)).toBe(false);
    expect(isKnownErrorCode(BILLING_ERROR_CODE.PREPAID_BALANCE_INSUFFICIENT)).toBe(true);
    expect(isRetryableErrorCode(BILLING_ERROR_CODE.PREPAID_BALANCE_INSUFFICIENT)).toBe(true);
  });

  it("validates fixed-price hotline pricing hints", () => {
    const result = validatePricingHint(fixedPricingHint());
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects fixed-price hints whose cap is below the fixed price", () => {
    const result = validatePricingHint({
      ...fixedPricingHint(),
      max_total_cents: 499
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("pricing_hint.max_total_cents must be >= fixed_price_cents");
  });

  it("validates base-plus-tokens pricing hints with described hotline-defined units", () => {
    const result = validatePricingHint({
      pricing_model: PRICING_MODEL.BASE_PLUS_TOKENS,
      currency: "PTS",
      base_price_cents: 100,
      variable_unit: "token",
      variable_unit_description: "1 token = 1 PDF page processed",
      variable_unit_price_cents: 25,
      max_total_cents: 600,
      trust_tier: TRUST_TIER.UNTRUSTED
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("validates caller billing claims against the hotline pricing hint", () => {
    const result = validateTaskBillingClaims(
      {
        acknowledged: true,
        pricing_model: PRICING_MODEL.FIXED_PRICE,
        currency: "PTS",
        max_charge_cents: 500,
        consent_at: "2026-06-12T00:00:00Z",
        trust_tier_seen: TRUST_TIER.UNTRUSTED
      },
      fixedPricingHint()
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects unacknowledged paid-call billing claims", () => {
    const result = validateTaskBillingClaims(
      {
        acknowledged: false,
        pricing_model: PRICING_MODEL.FIXED_PRICE,
        currency: "PTS",
        max_charge_cents: 500,
        trust_tier_seen: TRUST_TIER.UNTRUSTED
      },
      fixedPricingHint()
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("billing.acknowledged must be true");
  });

  it("rejects caller max-charge claims below the hotline cap", () => {
    const result = validateTaskBillingClaims(
      {
        acknowledged: true,
        pricing_model: PRICING_MODEL.FIXED_PRICE,
        currency: "PTS",
        max_charge_cents: 499,
        trust_tier_seen: TRUST_TIER.UNTRUSTED
      },
      fixedPricingHint()
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("billing.max_charge_cents must be >= pricing_hint.max_total_cents");
  });

  it("validates fixed-price result usage against frozen pricing and billing claims", () => {
    const result = validateBillingUsage(
      {
        pricing_model: PRICING_MODEL.FIXED_PRICE,
        total_cents: 500
      },
      fixedPricingHint(),
      {
        acknowledged: true,
        pricing_model: PRICING_MODEL.FIXED_PRICE,
        currency: "PTS",
        max_charge_cents: 500,
        trust_tier_seen: TRUST_TIER.UNTRUSTED
      }
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("validates variable result usage math and cap", () => {
    const pricingHint = {
      pricing_model: PRICING_MODEL.BASE_PLUS_TOKENS,
      currency: "PTS",
      base_price_cents: 100,
      variable_unit: "token",
      variable_unit_description: "1 token = 1 PDF page processed",
      variable_unit_price_cents: 25,
      max_total_cents: 600,
      trust_tier: TRUST_TIER.UNTRUSTED
    };
    const billing = {
      acknowledged: true,
      pricing_model: PRICING_MODEL.BASE_PLUS_TOKENS,
      currency: "PTS",
      max_charge_cents: 600,
      trust_tier_seen: TRUST_TIER.UNTRUSTED
    };

    const result = validateBillingUsage(
      {
        pricing_model: PRICING_MODEL.BASE_PLUS_TOKENS,
        base_price_cents: 100,
        variable_unit: "token",
        variable_units: 8,
        variable_unit_price_cents: 25,
        variable_subtotal_cents: 200,
        total_cents: 300
      },
      pricingHint,
      billing
    );

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects billing usage that exceeds caller max charge", () => {
    const result = validateBillingUsage(
      {
        pricing_model: PRICING_MODEL.FIXED_PRICE,
        total_cents: 501
      },
      fixedPricingHint(),
      {
        acknowledged: true,
        pricing_model: PRICING_MODEL.FIXED_PRICE,
        currency: "PTS",
        max_charge_cents: 500,
        trust_tier_seen: TRUST_TIER.UNTRUSTED
      }
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("usage.total_cents must be <= billing.max_charge_cents");
  });

  it("keeps non-billing informational usage compatible with result-package validation", () => {
    const result = validateResultPackage({
      request_id: "req_legacy_usage",
      responder_id: "responder_legacy",
      hotline_id: "legacy.free.hotline.v1",
      status: "ok",
      output: { summary: "done" },
      usage: { tokens_in: 100, tokens_out: 50 },
      timing: { elapsed_ms: 123 }
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });
});
