// What makes a declared Hotline a contract (FR-010, FR-013).
//
// Until now the platform would publish a hotline that declared nothing at all:
// input_schema and output_schema were optional, examples were an opaque array
// nobody checked, and "what this is not for" had no status. An audit of
// production on 2026-08-06 found exactly that shape — the four demo hotlines
// carried schemas and valid examples, while the ONLY hotline that had ever done
// real work declared no schemas, no examples and no limits. It was callable
// because nothing ever required otherwise.
//
// Two failures follow from that, and both are quiet:
//
//   - a Caller cannot tell what to send or what they will get back, so the
//     contract exists only in whoever wrote the adapter's head;
//   - an example that its own schema rejects is worse than no example. Someone
//     copies it, the call fails, and the contract still looks fine.
//
// So: examples are checked against the schemas they claim to illustrate, and a
// contract has to say what it is NOT for. The second is not decoration — a
// hotline with no stated limits is one that will be blamed for everything it
// was never meant to do, and M3 has to adjudicate those cases.

import Ajv from 'ajv/dist/2020.js';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

function pushIf(errors, condition, message) {
  if (condition) {
    errors.push(message);
  }
}

function hasStatedScope(value) {
  if (isNonEmptyString(value)) {
    return true;
  }
  return Array.isArray(value) && value.some((item) => isNonEmptyString(item));
}

// `strict: false` because hotline schemas legitimately carry annotations ajv
// does not recognise (`format: uri`, vendor keywords). Rejecting a schema for
// an unknown annotation would fail contracts that are perfectly usable.
function compileSchema(schema) {
  try {
    return { validate: new Ajv({ strict: false, allErrors: true }).compile(schema), error: null };
  } catch (error) {
    return { validate: null, error: error.message };
  }
}

/**
 * Examples are `{ title, input }` / `{ title, output }` envelopes — the shape
 * every existing declaration uses. The payload is what gets validated; the
 * title is what a human reads in the catalogue.
 */
export function validateHotlineExamples(contract = {}) {
  const errors = [];

  for (const [schemaField, examplesField, payloadKey] of [
    ['input_schema', 'input_examples', 'input'],
    ['output_schema', 'output_examples', 'output']
  ]) {
    const examples = contract[examplesField];
    if (examples === undefined || examples === null) {
      continue;
    }
    if (!Array.isArray(examples)) {
      errors.push(`${examplesField} must be an array`);
      continue;
    }
    const schema = contract[schemaField];
    if (!isObject(schema)) {
      pushIf(errors, examples.length > 0, `${examplesField} cannot be checked because ${schemaField} is not declared`);
      continue;
    }
    const compiled = compileSchema(schema);
    if (!compiled.validate) {
      errors.push(`${schemaField} is not a usable JSON Schema: ${compiled.error}`);
      continue;
    }
    examples.forEach((example, index) => {
      const label = `${examplesField}[${index}]`;
      if (!isObject(example)) {
        errors.push(`${label} must be an object with a ${payloadKey} payload`);
        return;
      }
      if (!(payloadKey in example)) {
        errors.push(`${label} is missing its ${payloadKey} payload`);
        return;
      }
      if (!compiled.validate(example[payloadKey])) {
        const detail = (compiled.validate.errors || [])
          .slice(0, 3)
          .map((item) => `${item.instancePath || '/'} ${item.message}`)
          .join('; ');
        errors.push(`${label} does not satisfy ${schemaField}: ${detail}`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// ------------------------------------ service tier, privacy, fulfillment mode
//
// FR-011 / FR-012 and owner decision D8.2, all three declared on the contract
// and snapshotted into a Call. M2 only makes them SAYABLE and freezes them into
// the version; the acceptance window they imply does not start enforcing
// anything until M3, where there is finally something for it to fail.
//
// All three are optional, and absent means the default. That is not laziness:
// the publication gate does not re-validate an already-approved hotline, so a
// new required field would divide the catalogue into records that can be
// re-published and records that cannot, without anyone choosing that.

export const SERVICE_TIER = Object.freeze({
  QUICK: 'quick',
  STANDARD: 'standard',
  DEEP: 'deep'
});

export const DEFAULT_SERVICE_TIER = SERVICE_TIER.STANDARD;

/** A-05 provisional defaults, approved under D2. Owner may change any of them. */
export const SERVICE_TIER_ACCEPTANCE_WINDOW_S = Object.freeze({
  [SERVICE_TIER.QUICK]: 24 * 60 * 60,
  [SERVICE_TIER.STANDARD]: 72 * 60 * 60,
  [SERVICE_TIER.DEEP]: 7 * 24 * 60 * 60
});

/** Network bounds an explicit per-version window must sit inside (A-05). */
export const ACCEPTANCE_WINDOW_BOUNDS_S = Object.freeze({
  MIN: 24 * 60 * 60,
  MAX: 7 * 24 * 60 * 60
});

// `sealed` is named here on purpose even though nothing can run it. A mode this
// deployment cannot honour is a different fact from a mode that does not exist,
// and a publisher who declares it deserves to be told which one it is.
export const PRIVACY_MODE = Object.freeze({
  SUPERVISED: 'supervised',
  SEALED: 'sealed'
});

export const SUPPORTED_PRIVACY_MODES = Object.freeze([PRIVACY_MODE.SUPERVISED]);
export const DEFAULT_PRIVACY_MODE = PRIVACY_MODE.SUPERVISED;

/**
 * D8.2. Whether a hotline may be called by a machine on its own, or needs the
 * calling side to confirm first. Before this the question could not be asked in
 * the protocol at all, and `prepare_request` answered it with a hardcoded
 * "not required" for every hotline in existence.
 */
export const FULFILLMENT_MODE = Object.freeze({
  AUTO: 'auto',
  CONFIRM: 'confirm'
});

export const DEFAULT_FULFILLMENT_MODE = FULFILLMENT_MODE.AUTO;

export function serviceTierOf(contract = {}) {
  const tier = contract?.service_tier;
  return Object.values(SERVICE_TIER).includes(tier) ? tier : DEFAULT_SERVICE_TIER;
}

export function privacyModeOf(contract = {}) {
  const mode = contract?.privacy_mode;
  return Object.values(PRIVACY_MODE).includes(mode) ? mode : DEFAULT_PRIVACY_MODE;
}

export function fulfillmentModeOf(contract = {}) {
  const mode = contract?.fulfillment_mode;
  return Object.values(FULFILLMENT_MODE).includes(mode) ? mode : DEFAULT_FULFILLMENT_MODE;
}

/**
 * The window a Call snapshots: an explicit per-version value if the contract
 * declared one, otherwise the tier's default.
 *
 * Explicit wins over tier because a publisher who wrote a number meant it; the
 * tier is the shorthand, not the authority. Both are still bounded by the
 * network min/max, which is checked at publication rather than silently
 * clamped here — a window quietly moved is a promise quietly changed.
 */
export function acceptanceWindowSecondsOf(contract = {}) {
  const explicit = contract?.acceptance_window_s;
  if (Number.isInteger(explicit) && explicit > 0) {
    return explicit;
  }
  return SERVICE_TIER_ACCEPTANCE_WINDOW_S[serviceTierOf(contract)];
}

/** The service terms a Call freezes alongside the contract digest. */
export function serviceTermsOf(contract = {}) {
  return {
    service_tier: serviceTierOf(contract),
    acceptance_window_s: acceptanceWindowSecondsOf(contract),
    privacy_mode: privacyModeOf(contract),
    fulfillment_mode: fulfillmentModeOf(contract)
  };
}

function validateServiceTerms(contract) {
  const errors = [];

  if (contract.service_tier !== undefined && contract.service_tier !== null) {
    pushIf(
      errors,
      !Object.values(SERVICE_TIER).includes(contract.service_tier),
      `service_tier must be one of: ${Object.values(SERVICE_TIER).join(', ')}`
    );
  }

  if (contract.acceptance_window_s !== undefined && contract.acceptance_window_s !== null) {
    if (!Number.isInteger(contract.acceptance_window_s) || contract.acceptance_window_s <= 0) {
      errors.push('acceptance_window_s must be a positive integer number of seconds');
    } else if (
      contract.acceptance_window_s < ACCEPTANCE_WINDOW_BOUNDS_S.MIN ||
      contract.acceptance_window_s > ACCEPTANCE_WINDOW_BOUNDS_S.MAX
    ) {
      errors.push(
        `acceptance_window_s must be between ${ACCEPTANCE_WINDOW_BOUNDS_S.MIN} and ${ACCEPTANCE_WINDOW_BOUNDS_S.MAX} seconds`
      );
    }
  }

  if (contract.privacy_mode !== undefined && contract.privacy_mode !== null) {
    if (!Object.values(PRIVACY_MODE).includes(contract.privacy_mode)) {
      errors.push(`privacy_mode must be one of: ${Object.values(PRIVACY_MODE).join(', ')}`);
    } else if (!SUPPORTED_PRIVACY_MODES.includes(contract.privacy_mode)) {
      // Refused, not downgraded. Accepting `sealed` and then running the call
      // supervised would tell a publisher their data was isolated when it was
      // not — the one failure in this area that must never be quiet.
      errors.push(
        `privacy_mode "${contract.privacy_mode}" is not supported in this deployment and will not be run as ${DEFAULT_PRIVACY_MODE}`
      );
    }
  }

  if (contract.fulfillment_mode !== undefined && contract.fulfillment_mode !== null) {
    pushIf(
      errors,
      !Object.values(FULFILLMENT_MODE).includes(contract.fulfillment_mode),
      `fulfillment_mode must be one of: ${Object.values(FULFILLMENT_MODE).join(', ')}`
    );
  }

  return { valid: errors.length === 0, errors };
}

export { validateServiceTerms as validateHotlineServiceTerms };

/**
 * Is this declaration publishable?
 *
 * Checked when a hotline becomes callable rather than when it is submitted, so
 * a device can still enroll and the operator is told, in one list, exactly what
 * the declaration is missing.
 */
export function validateHotlineContract(contract = {}) {
  const errors = [];
  if (!isObject(contract)) {
    return { valid: false, errors: ['hotline contract must be an object'] };
  }

  for (const field of ['input_schema', 'output_schema']) {
    if (!isObject(contract[field])) {
      errors.push(`${field} is required: without it a caller cannot know what to send or what comes back`);
      continue;
    }
    const compiled = compileSchema(contract[field]);
    if (!compiled.validate) {
      errors.push(`${field} is not a usable JSON Schema: ${compiled.error}`);
    }
  }

  for (const [field, payloadKey] of [
    ['input_examples', 'input'],
    ['output_examples', 'output']
  ]) {
    const examples = contract[field];
    if (!Array.isArray(examples) || examples.length === 0) {
      errors.push(`${field} must contain at least one worked ${payloadKey} example`);
    }
  }

  // FR-010: the scope a hotline does NOT cover is part of the contract. A
  // declaration that only says what it is good at leaves every out-of-scope
  // request looking like a failure to deliver.
  if (!hasStatedScope(contract.not_recommended_for) && !hasStatedScope(contract.limitations)) {
    errors.push('not_recommended_for or limitations must state what this hotline is not for');
  }

  errors.push(...validateHotlineExamples(contract).errors);
  errors.push(...validateServiceTerms(contract).errors);

  return { valid: errors.length === 0, errors };
}
