// FR-010 / FR-013: a published Hotline has to actually be a contract.
//
// The production audit that motivated this (2026-08-06) found the only hotline
// that had ever done real work declaring no schemas, no examples and no limits
// — callable because nothing required otherwise.
import { describe, expect, it } from "vitest";

import { validateHotlineContract, validateHotlineExamples } from "@delexec/contracts";

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

describe("validateHotlineExamples", () => {
  it("accepts examples that satisfy the schemas they illustrate", () => {
    expect(validateHotlineExamples(contract())).toEqual({ valid: true, errors: [] });
  });

  it("rejects an example its own schema would reject", () => {
    const result = validateHotlineExamples(
      contract({ input_examples: [{ title: "Wrong", input: { documnet: "typo in the key" } }] })
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("input_examples[0] does not satisfy input_schema");
  });

  it("names the example that fails, not just that one did", () => {
    const result = validateHotlineExamples(
      contract({
        input_examples: [
          { title: "Fine", input: { document: "ok" } },
          { title: "Broken", input: {} }
        ]
      })
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("input_examples[1]");
  });

  it("requires the example envelope to carry its payload", () => {
    const missing = validateHotlineExamples(contract({ input_examples: [{ title: "No payload" }] }));
    expect(missing.errors[0]).toContain("missing its input payload");

    const notAnObject = validateHotlineExamples(contract({ output_examples: ["just a string"] }));
    expect(notAnObject.errors[0]).toContain("must be an object with a output payload");
  });

  it("says examples cannot be checked when the schema is absent, rather than passing them", () => {
    const result = validateHotlineExamples({ input_examples: [{ title: "x", input: {} }] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("cannot be checked because input_schema is not declared");
  });

  it("reports an unusable schema instead of treating it as permissive", () => {
    const result = validateHotlineExamples(contract({ input_schema: { type: "object", required: "not-an-array" } }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("is not a usable JSON Schema");
  });

  it("tolerates annotations a strict validator would reject", () => {
    // Real declarations carry `format: uri` and similar. Failing a contract for
    // an annotation ajv does not recognise would reject perfectly usable ones.
    const result = validateHotlineExamples(
      contract({
        input_schema: {
          type: "object",
          required: ["document"],
          properties: { document: { type: "string", format: "uri" } },
          "x-vendor-note": "kept"
        },
        input_examples: [{ title: "ok", input: { document: "https://example.test/a.pdf" } }]
      })
    );
    expect(result.valid).toBe(true);
  });

  it("has nothing to say when no examples are declared", () => {
    const { input_examples, output_examples, ...rest } = contract();
    expect(input_examples && output_examples).toBeTruthy();
    expect(validateHotlineExamples(rest)).toEqual({ valid: true, errors: [] });
  });
});

describe("validateHotlineContract", () => {
  it("accepts a complete declaration", () => {
    expect(validateHotlineContract(contract())).toEqual({ valid: true, errors: [] });
  });

  it("refuses a declaration with no schemas — the shape production was actually in", () => {
    const result = validateHotlineContract({ hotline_id: "local.mineru.pdf.parse.v1" });
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("input_schema is required");
    expect(result.errors.join("\n")).toContain("output_schema is required");
  });

  it("requires at least one worked example in each direction", () => {
    expect(validateHotlineContract(contract({ input_examples: [] })).errors.join("\n")).toContain(
      "input_examples must contain at least one worked input example"
    );
    expect(validateHotlineContract(contract({ output_examples: undefined })).errors.join("\n")).toContain(
      "output_examples must contain at least one worked output example"
    );
  });

  it("requires the declaration to say what it is not for", () => {
    const result = validateHotlineContract(contract({ limitations: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("must state what this hotline is not for");
  });

  it("accepts not_recommended_for as that statement", () => {
    const result = validateHotlineContract(contract({ limitations: [], not_recommended_for: ["legal advice"] }));
    expect(result.valid).toBe(true);
  });

  it("treats an empty-string scope as unstated", () => {
    expect(validateHotlineContract(contract({ limitations: ["   "] })).valid).toBe(false);
    expect(validateHotlineContract(contract({ limitations: "" })).valid).toBe(false);
  });

  it("reports every problem at once so the operator fixes one round of them", () => {
    const result = validateHotlineContract({ hotline_id: "bare" });
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });

  it("still fails a complete-looking declaration whose examples do not hold", () => {
    const result = validateHotlineContract(
      contract({ output_examples: [{ title: "Broken", output: { markdown: 42 } }] })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("output_examples[0] does not satisfy output_schema");
  });
});
