import { describe, expect, test } from "bun:test";
import { EMPTY_REASONING, mergeClinicalReasoning, normalizeReasoning, type ClinicalReasoning } from "./clinical-reasoning";

describe("clinical reasoning normalization", () => {
  test("keeps legacy hypotheses and flags readable", () => {
    const normalized = normalizeReasoning(null, { hypotheses: ["Baixa ingestão proteica"], flags: ["Poucos vegetais"] });
    expect(normalized.hypotheses[0]?.title).toBe("Baixa ingestão proteica");
    expect(normalized.hypotheses[0]?.status).toBe("accepted");
    expect(normalized.flags).toEqual(["Poucos vegetais"]);
  });
});

describe("clinical reasoning merge", () => {
  test("never overwrites a reviewed hypothesis", () => {
    const current: ClinicalReasoning = {
      ...EMPTY_REASONING,
      hypotheses: [{ id: "h1", title: "Resistência à insulina", rationale: "Revisado pela nutricionista", evidence: ["HOMA-IR"], status: "edited" }],
    };
    const suggestion: ClinicalReasoning = {
      ...EMPTY_REASONING,
      hypotheses: [{ id: "h2", title: "Resistência à insulina", rationale: "Texto novo da IA", evidence: ["Insulina"], status: "suggested" }],
    };
    const merged = mergeClinicalReasoning(current, suggestion);
    expect(merged.hypotheses[0]?.rationale).toBe("Revisado pela nutricionista");
    expect(merged.hypotheses[0]?.status).toBe("edited");
  });

  test("keeps a reviewed item even when a new analysis no longer suggests it", () => {
    const current: ClinicalReasoning = {
      ...EMPTY_REASONING,
      directions: [{ id: "d1", title: "Regularidade alimentar", rationale: "Mantido clinicamente", status: "accepted" }],
    };
    const merged = mergeClinicalReasoning(current, EMPTY_REASONING);
    expect(merged.directions).toHaveLength(1);
    expect(merged.directions[0]?.title).toBe("Regularidade alimentar");
  });
});
