import { describe, expect, test } from "bun:test";
import { extractResponseText, parseLabExtraction } from "./lab-extraction-response";

describe("lab extraction response parsing", () => {
  test("reads a top-level output_text response", () => {
    expect(extractResponseText({ output_text: '{"results":[]}' })).toBe('{"results":[]}');
  });

  test("reads output_text from Responses API output content", () => {
    expect(extractResponseText({
      output: [{ content: [{ type: "output_text", text: '{"results":[{"analyte_name":"Glicemia"}]}' }] }],
    })).toBe('{"results":[{"analyte_name":"Glicemia"}]}');
  });

  test("rejects an extraction with zero laboratory results", () => {
    let message = "";
    try {
      parseLabExtraction('{"collection_date":null,"laboratory_name":null,"results":[]}');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message.includes("Nenhum resultado laboratorial")).toBe(true);
  });

  test("keeps valid extracted results", () => {
    const parsed = parseLabExtraction(JSON.stringify({
      collection_date: "2026-09-01",
      laboratory_name: "Laboratório Teste",
      results: [{
        analyte_name: "Glicemia",
        analyte_code: "glucose",
        value: 97,
        value_text: null,
        unit: "mg/dL",
        reference_min: 70,
        reference_max: 99,
        reference_text: null,
      }],
    }));
    expect(parsed.results.length).toBe(1);
    expect(parsed.results[0]?.value).toBe(97);
  });
});
