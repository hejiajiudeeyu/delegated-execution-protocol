import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const BUNDLED_TEMPLATES_ROOT = path.join(PACKAGE_ROOT, 'templates');
const BUNDLED_PROTOCOL_DOCS_ROOT = path.join(PACKAGE_ROOT, 'protocol-docs');
const BUNDLED_TEMPLATE_MANIFEST_PATH = path.join(BUNDLED_TEMPLATES_ROOT, 'manifest.json');

export const REQUEST_STATUS = {
  CREATED: 'CREATED',
  SENT: 'SENT',
  ACKED: 'ACKED',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  UNVERIFIED: 'UNVERIFIED',
  TIMED_OUT: 'TIMED_OUT'
};

export const ERROR_DOMAIN = {
  AUTH: 'AUTH',
  CONTRACT: 'CONTRACT',
  EXEC: 'EXEC',
  RESULT: 'RESULT',
  DELIVERY: 'DELIVERY',
  TEMPLATE: 'TEMPLATE',
  PLATFORM: 'PLATFORM',
  CATALOG: 'CATALOG',
  REQUEST: 'REQUEST',
  RESPONDER: 'RESPONDER',
  USER: 'USER',
  HOTLINE: 'HOTLINE',
  EXECUTOR: 'EXECUTOR',
  TRANSPORT: 'TRANSPORT',
  SIGNER: 'SIGNER',
  TASK: 'TASK',
  CALLER: 'CALLER',
  RELAY: 'RELAY',
  OPS: 'OPS',
  ERR: 'ERR'
};

export const PRICING_MODEL = Object.freeze({
  FIXED_PRICE: 'fixed_price',
  BASE_PLUS_DURATION: 'base_plus_duration',
  BASE_PLUS_TOKENS: 'base_plus_tokens'
});

export const TRUST_TIER = Object.freeze({
  UNTRUSTED: 'untrusted',
  TRUSTED: 'trusted',
  VERIFIED: 'verified'
});

export const BILLING_ERROR_CODE = Object.freeze({
  BILLING_CONSENT_REQUIRED: 'ERR_BILLING_CONSENT_REQUIRED',
  BILLING_PRICING_MODEL_MISMATCH: 'ERR_BILLING_PRICING_MODEL_MISMATCH',
  BILLING_MAX_CHARGE_TOO_LOW: 'ERR_BILLING_MAX_CHARGE_TOO_LOW',
  PREPAID_BALANCE_INSUFFICIENT: 'ERR_PREPAID_BALANCE_INSUFFICIENT',
  BILLING_CURRENCY_UNSUPPORTED: 'ERR_BILLING_CURRENCY_UNSUPPORTED',
  TRUST_TIER_LIMIT_EXCEEDED: 'ERR_TRUST_TIER_LIMIT_EXCEEDED'
});

export const BILLING_EVENT = Object.freeze({
  REQUEST_BILLING_HELD: 'caller.request.billing_held',
  REQUEST_BILLING_CAPPED: 'caller.request.billing_capped',
  REQUEST_REFUNDED_UNVERIFIED: 'caller.request.refunded_unverified',
  REQUEST_REFUNDED_TIMEOUT: 'caller.request.refunded_timeout',
  REQUEST_REFUNDED_FAILED: 'caller.request.refunded_failed',
  REQUEST_REFUNDED_HOTLINE_FROZEN: 'caller.request.refunded_hotline_frozen'
});

export const ERROR_REGISTRY = Object.freeze({
  AUTH_UNAUTHORIZED: { retryable: false },
  AUTH_SCOPE_FORBIDDEN: { retryable: false },
  AUTH_RESOURCE_FORBIDDEN: { retryable: false },
  AUTH_TOKEN_INVALID: { retryable: true },
  AUTH_TOKEN_EXPIRED: { retryable: false },
  AUTH_INTROSPECT_FAILED: { retryable: true },
  AUTH_TOKEN_NOT_FOUND: { retryable: false },
  AUTH_AUDIENCE_MISMATCH: { retryable: false },
  AUTH_CREDENTIALS_MISSING: { retryable: false },
  AUTH_INVALID_CREDENTIALS: { retryable: false },
  AUTH_INVALID_PASSPHRASE: { retryable: false },
  AUTH_SECRET_STORE_EXISTS: { retryable: false },
  AUTH_SECRET_STORE_MISSING: { retryable: false },
  AUTH_SESSION_REQUIRED: { retryable: false },
  AUTH_BOOTSTRAP_FORBIDDEN: { retryable: false },
  AUTH_KEY_NOT_FOUND: { retryable: false },

  CONTRACT_INVALID_JSON: { retryable: false },
  CONTRACT_INVALID_REGISTER_BODY: { retryable: false },
  CONTRACT_INVALID_RESPONDER_REGISTER_BODY: { retryable: false },
  CONTRACT_INVALID_RESULT_DELIVERY: { retryable: false },
  CONTRACT_INVALID_TOKEN_REQUEST: { retryable: false },
  CONTRACT_INVALID_DELIVERY_META_REQUEST: { retryable: false },
  CONTRACT_INVALID_ACK_REQUEST: { retryable: false },
  CONTRACT_INVALID_REQUEST_EVENT: { retryable: false },
  CONTRACT_INVALID_METRIC_EVENT: { retryable: false },
  CONTRACT_INVALID_ROLE_GRANT: { retryable: false },
  CONTRACT_INVALID_API_KEY_REVOKE: { retryable: false },
  CONTRACT_INVALID_PREPARE_REQUEST: { retryable: false },
  CONTRACT_INVALID_REMOTE_REQUEST: { retryable: false },
  CONTRACT_INVALID_POLL_REQUEST: { retryable: false },
  CONTRACT_INVALID_PEEK_REQUEST: { retryable: false },
  CONTRACT_INVALID_SEND_REQUEST: { retryable: false },
  CONTRACT_INVALID_BATCH_REQUEST: { retryable: false },
  CONTRACT_INVALID_SIGNING_KEY_ROTATION: { retryable: false },
  CONTRACT_INVALID_TIMEOUT: { retryable: false },
  CONTRACT_TIMEOUT_EXCEEDS_RESPONDER_LIMIT: { retryable: false },
  CONTRACT_TASK_TYPE_UNSUPPORTED: { retryable: false },
  CONTRACT_REJECTED: { retryable: false },
  CONTRACT_UNSUPPORTED_VERSION: { retryable: false },
  CONTRACT_INVALID_TRANSPORT_BODY: { retryable: false },
  CONTRACT_INVALID_TRANSPORT_TYPE: { retryable: false },
  CONTRACT_INVALID_SERVICE_RESOLUTION_REQUEST: { retryable: false },
  CONTRACT_INVALID_SERVICE_RESOLUTION_RESPONSE: { retryable: false },

  EXEC_TIMEOUT: { retryable: true },
  EXEC_TIMEOUT_HARD: { retryable: false },
  EXEC_TIMEOUT_MANUAL_STOP: { retryable: false },
  EXEC_INTERNAL_ERROR: { retryable: true },
  EXEC_UNKNOWN: { retryable: true },
  EXECUTOR_RUNTIME_ERROR: { retryable: false },
  EXECUTOR_INVALID_RESULT: { retryable: false },
  EXEC_IN_PROGRESS: { retryable: true },
  EXEC_QUEUE_FULL: { retryable: true },

  RESULT_CONTEXT_MISMATCH: { retryable: false },
  RESULT_SIGNATURE_INVALID: { retryable: false },
  RESULT_SCHEMA_INVALID: { retryable: false },
  RESULT_ARTIFACT_INVALID: { retryable: false },
  RESULT_BODY_INVALID_JSON: { retryable: false },
  RESULT_ARTIFACT_TOO_LARGE: { retryable: false },
  RESULT_DELIVERY_KIND_NOT_IMPLEMENTED: { retryable: false },
  RESULT_NOT_READY: { retryable: true },

  DELIVERY_OR_ACCEPTANCE_TIMEOUT: { retryable: true },
  DELIVERY_FAILED: { retryable: true },
  DELIVERY_DUPLICATE: { retryable: false },
  DELIVERY_PARSE_FAILED: { retryable: false },
  DELIVERY_RATE_LIMITED: { retryable: true },

  TEMPLATE_NOT_FOUND: { retryable: false },
  TEMPLATE_REF_MISMATCH: { retryable: false },

  PLATFORM_NOT_CONFIGURED: { retryable: false },
  PLATFORM_RATE_LIMITED: { retryable: true },
  PLATFORM_API_INTERNAL_ERROR: { retryable: true },
  PLATFORM_REVIEW_TRANSPORT_NOT_CONFIGURED: { retryable: false },
  PLATFORM_REVIEW_TEST_UNSUPPORTED: { retryable: false },

  CATALOG_HOTLINE_NOT_FOUND: { retryable: false },
  CATALOG_SERVICE_NOT_FOUND: { retryable: false },

  REQUEST_NOT_FOUND: { retryable: false },
  REQUEST_BINDING_MISMATCH: { retryable: false },
  REQUEST_ALREADY_TERMINAL: { retryable: false },

  RESPONDER_NOT_FOUND: { retryable: false },
  RESPONDER_NOT_APPROVED: { retryable: false },
  RESPONDER_NOT_ENABLED: { retryable: false },
  RESPONDER_PLATFORM_REGISTER_FAILED: { retryable: true },
  RESPONDER_RUNTIME_INTERNAL_ERROR: { retryable: true },

  USER_NOT_FOUND: { retryable: false },

  HOTLINE_ID_ALREADY_EXISTS: { retryable: false },
  HOTLINE_QUOTA_EXCEEDED: { retryable: false },
  HOTLINE_NOT_APPROVED: { retryable: false },
  HOTLINE_INVALID_RESULT: { retryable: false },
  HOTLINE_PROCESS_EXITED: { retryable: false },
  HOTLINE_PROCESS_INVALID_JSON: { retryable: false },
  HOTLINE_HTTP_INVALID_JSON: { retryable: false },
  HOTLINE_HTTP_FAILED: { retryable: false },
  HOTLINE_NOT_CONFIGURED: { retryable: false },
  HOTLINE_ID_REQUIRED: { retryable: false },
  HOTLINE_INVALID_INPUT: { retryable: false },
  HOTLINE_NOT_FOUND: { retryable: false },

  TRANSPORT_NOT_CONFIGURED: { retryable: false },
  TRANSPORT_SEND_NOT_AVAILABLE: { retryable: false },
  TRANSPORT_POLL_NOT_AVAILABLE: { retryable: false },
  TRANSPORT_CONNECTION_FAILED: { retryable: true },

  SIGNER_BINDING_MISMATCH: { retryable: false },

  TASK_NOT_FOUND: { retryable: false },

  CALLER_PLATFORM_REGISTER_FAILED: { retryable: true },
  CALLER_PLATFORM_CATALOG_FAILED: { retryable: true },
  CALLER_PLATFORM_RESPONDER_REGISTER_FAILED: { retryable: true },
  CALLER_PLATFORM_TOKEN_FAILED: { retryable: true },
  CALLER_PLATFORM_DELIVERY_META_FAILED: { retryable: true },
  CALLER_PLATFORM_EVENTS_FAILED: { retryable: true },
  CALLER_PLATFORM_EVENTS_BATCH_FAILED: { retryable: true },
  CALLER_PLATFORM_METRIC_FAILED: { retryable: true },
  CALLER_PLATFORM_PREPARE_FAILED: { retryable: true },
  CALLER_REMOTE_REQUEST_FAILED: { retryable: true },
  CALLER_CONTROLLER_INTERNAL_ERROR: { retryable: true },
  CALLER_NOT_REGISTERED: { retryable: false },

  RELAY_INTERNAL_ERROR: { retryable: true },

  OPS_SUPERVISOR_INTERNAL_ERROR: { retryable: true },

  [BILLING_ERROR_CODE.BILLING_CONSENT_REQUIRED]: { retryable: false },
  [BILLING_ERROR_CODE.BILLING_PRICING_MODEL_MISMATCH]: { retryable: false },
  [BILLING_ERROR_CODE.BILLING_MAX_CHARGE_TOO_LOW]: { retryable: false },
  [BILLING_ERROR_CODE.PREPAID_BALANCE_INSUFFICIENT]: { retryable: true },
  [BILLING_ERROR_CODE.BILLING_CURRENCY_UNSUPPORTED]: { retryable: false },
  [BILLING_ERROR_CODE.TRUST_TIER_LIMIT_EXCEEDED]: { retryable: false }
});

export function getErrorDomain(code = '') {
  return String(code).split('_', 1)[0] || null;
}

export function isKnownErrorCode(code) {
  return Object.prototype.hasOwnProperty.call(ERROR_REGISTRY, code);
}

export function isRetryableErrorCode(code, fallback = false) {
  return isKnownErrorCode(code) ? ERROR_REGISTRY[code].retryable === true : fallback;
}

export function buildStructuredError(code, message, options = {}) {
  const { retryable, ...extra } = options;
  return {
    error: {
      code,
      message,
      retryable: retryable ?? isRetryableErrorCode(code, false)
    },
    ...extra
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isValidIsoDateTime(value) {
  if (value === undefined || value === null) {
    return true;
  }
  if (!isNonEmptyString(value)) {
    return false;
  }
  const time = Date.parse(value);
  return Number.isFinite(time);
}

function pushIf(errors, condition, message) {
  if (condition) {
    errors.push(message);
  }
}

function pricingModelOf(pricingHint) {
  return pricingHint?.pricing_model || PRICING_MODEL.FIXED_PRICE;
}

function maxTotalCentsOf(pricingHint) {
  if (Number.isSafeInteger(pricingHint?.max_total_cents)) {
    return pricingHint.max_total_cents;
  }
  if (pricingModelOf(pricingHint) === PRICING_MODEL.FIXED_PRICE) {
    return pricingHint?.fixed_price_cents;
  }
  return pricingHint?.max_total_cents;
}

export function validatePricingHint(pricingHint) {
  const errors = [];
  if (!isObject(pricingHint)) {
    return { valid: false, errors: ['pricing_hint must be an object'] };
  }

  const model = pricingModelOf(pricingHint);
  pushIf(errors, !Object.values(PRICING_MODEL).includes(model), 'pricing_hint.pricing_model is unsupported');
  pushIf(errors, !isNonEmptyString(pricingHint.currency), 'pricing_hint.currency is required');
  pushIf(errors, pricingHint.trust_tier !== undefined && !Object.values(TRUST_TIER).includes(pricingHint.trust_tier), 'pricing_hint.trust_tier is unsupported');

  if (model === PRICING_MODEL.FIXED_PRICE) {
    pushIf(errors, !isNonNegativeInteger(pricingHint.fixed_price_cents), 'pricing_hint.fixed_price_cents must be a non-negative integer');
    pushIf(errors, !isNonNegativeInteger(pricingHint.max_total_cents), 'pricing_hint.max_total_cents must be a non-negative integer');
    if (isNonNegativeInteger(pricingHint.fixed_price_cents) && isNonNegativeInteger(pricingHint.max_total_cents)) {
      pushIf(errors, pricingHint.max_total_cents < pricingHint.fixed_price_cents, 'pricing_hint.max_total_cents must be >= fixed_price_cents');
    }
  }

  if (model === PRICING_MODEL.BASE_PLUS_DURATION || model === PRICING_MODEL.BASE_PLUS_TOKENS) {
    pushIf(errors, !isNonNegativeInteger(pricingHint.base_price_cents), 'pricing_hint.base_price_cents must be a non-negative integer');
    pushIf(errors, !isNonEmptyString(pricingHint.variable_unit), 'pricing_hint.variable_unit is required');
    pushIf(errors, !isNonEmptyString(pricingHint.variable_unit_description), 'pricing_hint.variable_unit_description is required');
    pushIf(errors, !isNonNegativeInteger(pricingHint.variable_unit_price_cents), 'pricing_hint.variable_unit_price_cents must be a non-negative integer');
    pushIf(errors, !isNonNegativeInteger(pricingHint.max_total_cents), 'pricing_hint.max_total_cents must be a non-negative integer');
    if (isNonNegativeInteger(pricingHint.base_price_cents) && isNonNegativeInteger(pricingHint.max_total_cents)) {
      pushIf(errors, pricingHint.max_total_cents < pricingHint.base_price_cents, 'pricing_hint.max_total_cents must be >= base_price_cents');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateTaskBillingClaims(billing, pricingHint) {
  const errors = [];
  if (!isObject(billing)) {
    return { valid: false, errors: ['billing must be an object'] };
  }

  const pricing = validatePricingHint(pricingHint);
  errors.push(...pricing.errors);
  if (!pricing.valid) {
    return { valid: false, errors };
  }

  const pricingModel = pricingModelOf(pricingHint);
  const maxTotalCents = maxTotalCentsOf(pricingHint);
  pushIf(errors, billing.acknowledged !== true, 'billing.acknowledged must be true');
  pushIf(errors, billing.pricing_model !== pricingModel, 'billing.pricing_model must match pricing_hint.pricing_model');
  pushIf(errors, billing.currency !== pricingHint.currency, 'billing.currency must match pricing_hint.currency');
  pushIf(errors, !isNonNegativeInteger(billing.max_charge_cents), 'billing.max_charge_cents must be a non-negative integer');
  if (isNonNegativeInteger(billing.max_charge_cents) && isNonNegativeInteger(maxTotalCents)) {
    pushIf(errors, billing.max_charge_cents < maxTotalCents, 'billing.max_charge_cents must be >= pricing_hint.max_total_cents');
  }
  pushIf(errors, billing.trust_tier_seen !== undefined && pricingHint.trust_tier !== undefined && billing.trust_tier_seen !== pricingHint.trust_tier, 'billing.trust_tier_seen must match pricing_hint.trust_tier');
  pushIf(errors, !isValidIsoDateTime(billing.consent_at), 'billing.consent_at must be an ISO datetime string');

  return { valid: errors.length === 0, errors };
}

export function validateBillingUsage(usage, pricingHint, billing) {
  const errors = [];
  if (!isObject(usage)) {
    return { valid: false, errors: ['usage must be an object'] };
  }

  const claims = validateTaskBillingClaims(billing, pricingHint);
  errors.push(...claims.errors);
  if (!claims.valid) {
    return { valid: false, errors };
  }

  const pricingModel = pricingModelOf(pricingHint);
  pushIf(errors, usage.pricing_model !== pricingModel, 'usage.pricing_model must match pricing_hint.pricing_model');
  pushIf(errors, !isNonNegativeInteger(usage.total_cents), 'usage.total_cents must be a non-negative integer');
  if (isNonNegativeInteger(usage.total_cents)) {
    pushIf(errors, usage.total_cents > billing.max_charge_cents, 'usage.total_cents must be <= billing.max_charge_cents');
  }

  if (pricingModel === PRICING_MODEL.FIXED_PRICE) {
    if (isNonNegativeInteger(usage.total_cents) && isNonNegativeInteger(pricingHint.fixed_price_cents)) {
      pushIf(errors, usage.total_cents !== pricingHint.fixed_price_cents, 'usage.total_cents must equal pricing_hint.fixed_price_cents');
    }
    return { valid: errors.length === 0, errors };
  }

  pushIf(errors, usage.base_price_cents !== pricingHint.base_price_cents, 'usage.base_price_cents must match pricing_hint.base_price_cents');
  pushIf(errors, usage.variable_unit !== pricingHint.variable_unit, 'usage.variable_unit must match pricing_hint.variable_unit');
  pushIf(errors, !isNonNegativeInteger(usage.variable_units), 'usage.variable_units must be a non-negative integer');
  pushIf(errors, usage.variable_unit_price_cents !== pricingHint.variable_unit_price_cents, 'usage.variable_unit_price_cents must match pricing_hint.variable_unit_price_cents');
  pushIf(errors, !isNonNegativeInteger(usage.variable_subtotal_cents), 'usage.variable_subtotal_cents must be a non-negative integer');

  if (isNonNegativeInteger(usage.variable_units) && isNonNegativeInteger(pricingHint.variable_unit_price_cents) && isNonNegativeInteger(usage.variable_subtotal_cents)) {
    const expectedSubtotal = usage.variable_units * pricingHint.variable_unit_price_cents;
    pushIf(errors, usage.variable_subtotal_cents !== expectedSubtotal, 'usage.variable_subtotal_cents must equal variable_units * variable_unit_price_cents');
  }
  if (isNonNegativeInteger(pricingHint.base_price_cents) && isNonNegativeInteger(usage.variable_subtotal_cents) && isNonNegativeInteger(usage.total_cents)) {
    pushIf(errors, usage.total_cents !== pricingHint.base_price_cents + usage.variable_subtotal_cents, 'usage.total_cents must equal base_price_cents + variable_subtotal_cents');
  }

  return { valid: errors.length === 0, errors };
}

export function canonicalizeResultPackageForSignature(result = {}) {
  const canonical = {};

  for (const key of [
    'message_type',
    'request_id',
    'result_version',
    'responder_id',
    'hotline_id',
    'verification',
    'status',
    'output',
    'artifacts',
    'error',
    'timing',
    'usage',
    'human_summary'
  ]) {
    if (key in result) {
      canonical[key] = result[key];
    }
  }

  return canonical;
}

/**
 * Validate a wire-level result package against the protocol §4.2 requirements.
 * Returns { valid: boolean, errors: string[] }.
 */
export function validateResultPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') {
    return { valid: false, errors: ['result package must be an object'] };
  }
  const errors = [];
  if (!pkg.request_id) errors.push('missing request_id');
  if (!pkg.responder_id) errors.push('missing responder_id');
  if (!pkg.hotline_id) errors.push('missing hotline_id');
  if (!['ok', 'error'].includes(pkg.status)) {
    errors.push('status must be "ok" or "error"');
  }
  if (pkg.status === 'ok' && !pkg.output) {
    errors.push('status=ok requires output');
  }
  if (pkg.status === 'error') {
    if (!pkg.error || typeof pkg.error !== 'object') {
      errors.push('status=error requires error object');
    } else {
      if (!pkg.error.code) errors.push('error.code is required');
      if (!pkg.error.message) errors.push('error.message is required');
      if (pkg.error.retryable === undefined || pkg.error.retryable === null) {
        errors.push('error.retryable is required');
      }
    }
  }
  if (!pkg.timing || typeof pkg.timing !== 'object') {
    errors.push('timing is required');
  } else if (pkg.timing.elapsed_ms === undefined || pkg.timing.elapsed_ms === null) {
    errors.push('timing.elapsed_ms is required');
  }
  return { valid: errors.length === 0, errors };
}

export function validateServiceResolutionRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return { valid: false, errors: ['service resolution request must be an object'] };
  }

  const errors = [];
  pushIf(errors, !isNonEmptyString(request.request_id), 'missing request_id');
  pushIf(errors, !isNonEmptyString(request.service_id) && !isNonEmptyString(request.capability), 'service_id or capability is required');
  pushIf(errors, request.service_id !== undefined && !isNonEmptyString(request.service_id), 'service_id must be a non-empty string');
  pushIf(errors, request.capability !== undefined && !isNonEmptyString(request.capability), 'capability must be a non-empty string');
  pushIf(errors, request.task_type !== undefined && !isNonEmptyString(request.task_type), 'task_type must be a non-empty string');

  if (request.constraints !== undefined && !isObject(request.constraints)) {
    errors.push('constraints must be an object');
  }
  if (request.constraints?.availability_status !== undefined && !['healthy', 'degraded', 'offline'].includes(request.constraints.availability_status)) {
    errors.push('constraints.availability_status is unsupported');
  }
  if (request.constraints?.max_queue_depth !== undefined && !isNonNegativeInteger(request.constraints.max_queue_depth)) {
    errors.push('constraints.max_queue_depth must be a non-negative integer');
  }
  if (request.result_delivery !== undefined && !isObject(request.result_delivery)) {
    errors.push('result_delivery must be an object');
  }

  return { valid: errors.length === 0, errors };
}

export function validateServiceResolutionResponse(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return { valid: false, errors: ['service resolution response must be an object'] };
  }

  const errors = [];
  const selected = response.selected;
  if (!isObject(selected)) {
    errors.push('selected must be an object');
  } else {
    pushIf(errors, !isNonEmptyString(selected.responder_id), 'selected.responder_id is required');
    pushIf(errors, !isNonEmptyString(selected.hotline_id), 'selected.hotline_id is required');
    pushIf(errors, selected.service_id !== undefined && !isNonEmptyString(selected.service_id), 'selected.service_id must be a non-empty string');
    pushIf(errors, selected.selection_reason !== undefined && !isNonEmptyString(selected.selection_reason), 'selected.selection_reason must be a non-empty string');
  }
  pushIf(errors, !isNonEmptyString(response.task_token), 'task_token is required');
  if (!isObject(response.claims)) {
    errors.push('claims must be an object');
  }
  if (!isObject(response.delivery_meta)) {
    errors.push('delivery_meta must be an object');
  }
  if (isObject(selected) && isObject(response.claims)) {
    pushIf(errors, response.claims.responder_id !== selected.responder_id, 'claims.responder_id must match selected.responder_id');
    pushIf(errors, response.claims.hotline_id !== selected.hotline_id, 'claims.hotline_id must match selected.hotline_id');
  }
  if (isObject(selected) && isObject(response.delivery_meta)) {
    pushIf(errors, response.delivery_meta.responder_id !== selected.responder_id, 'delivery_meta.responder_id must match selected.responder_id');
    pushIf(errors, response.delivery_meta.hotline_id !== selected.hotline_id, 'delivery_meta.hotline_id must match selected.hotline_id');
  }

  return { valid: errors.length === 0, errors };
}

export function getBundledTemplatesRoot() {
  return BUNDLED_TEMPLATES_ROOT;
}

export function getBundledProtocolDocsRoot() {
  return BUNDLED_PROTOCOL_DOCS_ROOT;
}

export function hasBundledProtocolAssets() {
  return fs.existsSync(BUNDLED_TEMPLATE_MANIFEST_PATH);
}

export function loadBundledTemplateManifest() {
  if (!hasBundledProtocolAssets()) {
    throw new Error('contracts_bundled_assets_missing');
  }
  return JSON.parse(fs.readFileSync(BUNDLED_TEMPLATE_MANIFEST_PATH, 'utf8'));
}

export function resolveBundledTemplatePath(relativePath = '') {
  return path.join(BUNDLED_TEMPLATES_ROOT, relativePath);
}

export function resolveBundledProtocolDocPath(relativePath = '') {
  return path.join(BUNDLED_PROTOCOL_DOCS_ROOT, relativePath);
}
