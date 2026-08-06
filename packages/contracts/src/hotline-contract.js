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

  return { valid: errors.length === 0, errors };
}
