import { describe, expect, test } from "bun:test";
import {
  buildReviewableSynthesis,
  compareLongitudinal,
  convertSpanToCm,
  getDomainStatus,
  validateEnergyMeasurement,
  validateGrip,
} from "./metabolic-map";

describe("metabolic map domain", () => {
  test("keeps a domain pending until it has data", () => {
    expect(getDomainStatus([{ present: false }]).status).toBe("pending");
  });

  test("marks AI data for confirmation without changing completeness", () => {
    const status = getDomainStatus([
      { present: true, reviewStatus: "pending", updatedAt: "2026-10-01" },
    ]);
    expect(status.status).toBe("complete");
    expect(status.pendingReview).toBe(1);
  });

  test("detects stale clinical data", () => {
    const status = getDomainStatus(
      [{ present: true, updatedAt: "2024-01-01", staleAfterDays: 180 }],
      new Date("2026-10-08"),
    );
    expect(status.status).toBe("stale");
  });

  test("converts span units and rejects impossible grip", () => {
    expect(convertSpanToCm(1.72, "m")).toBe(172);
    expect(convertSpanToCm(70, "in")).toBe(177.8);
    expect(validateGrip(160) === null).toBe(false);
    expect(validateGrip(32)).toBe(null);
  });

  test("compares only ordered longitudinal points", () => {
    const result = compareLongitudinal([
      { date: "2026-10-08", value: 70, unit: "kg", source: "measured" },
      { date: "2026-01-08", value: 74, unit: "kg", source: "measured" },
    ]);
    expect(result.delta).toBe(-4);
    expect(result.direction).toBe("down");
  });

  test("separates measured and estimated energy requirements", () => {
    expect(
      validateEnergyMeasurement({ kind: "estimated", kcal: 1800, formula: "Mifflin" }),
    ).toEqual([]);
    expect(
      validateEnergyMeasurement({
        kind: "measured",
        kcal: 1800,
        equipment: "Quark RMR",
        conditions: "Jejum",
      }),
    ).toEqual([]);
    expect(validateEnergyMeasurement({ kind: "measured", kcal: 1800 }).length).toBe(2);
  });

  test("creates editable draft synthesis with safety disclaimer", () => {
    const synthesis = buildReviewableSynthesis({
      priorities: ["Fibra"],
      approaches: ["Distribuir vegetais"],
      discussWithDoctor: ["Revisar sintomas"],
      evidence: ["Anamnese · 2026-10-08"],
    });
    expect(synthesis.priorities[0]?.status).toBe("draft");
    expect(synthesis.disclaimer).toContain("Não é diagnóstico");
  });
});
