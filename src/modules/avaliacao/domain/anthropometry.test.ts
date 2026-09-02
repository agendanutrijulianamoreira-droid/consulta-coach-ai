import { describe, expect, test } from "bun:test";
import {
  analyzeAnthropometry,
  biologicalSex,
  bodyFatByFormula,
  selectedCompositionMethod,
  skinfoldEligibility,
  validateAnthropometry,
  visceralFatClass,
  type AnthroData,
  type PatientProfile,
} from "./anthropometry";

const female: PatientProfile = { age: 35, sex: "feminino" };

describe("anthropometry safety", () => {
  test("does not assume a biological sex when the cadastro is ambiguous", () => {
    expect(biologicalSex(null)).toBe(null);
    expect(biologicalSex("não informado")).toBe(null);
    expect(biologicalSex("feminino")).toBe("female");
    expect(biologicalSex("masculino")).toBe("male");
  });

  test("blocks age-dependent skinfold formulas when age is missing", () => {
    const data: AnthroData = {
      d_tricipital: "20",
      d_suprailiaca: "18",
      d_coxa: "25",
    };
    const profile: PatientProfile = { age: null, sex: "feminino" };

    expect(skinfoldEligibility(data, profile, "pollock3").eligible).toBe(false);
    expect(bodyFatByFormula(data, profile, "pollock3")).toBe(null);
  });

  test("blocks sex-dependent skinfold formulas when sex is missing", () => {
    const data: AnthroData = {
      d_tricipital: "20",
      d_suprailiaca: "18",
      d_coxa: "25",
    };
    const profile: PatientProfile = { age: 35, sex: null };

    expect(skinfoldEligibility(data, profile, "pollock3").eligible).toBe(false);
    expect(bodyFatByFormula(data, profile, "pollock3")).toBe(null);
  });

  test("uses the explicitly selected composition method", () => {
    const data: AnthroData = {
      peso: "80",
      composition_method: "bioimpedance",
      bia_gordura_pct: "30",
      d_tricipital: "12",
      d_suprailiaca: "15",
      d_coxa: "18",
    };

    const result = analyzeAnthropometry(data, female, "pollock3");
    expect(selectedCompositionMethod(data)).toBe("bioimpedance");
    expect(result.compositionMethod).toBe("bioimpedance");
    expect(result.bodyFatPercent).toBe(30);
    expect(result.fatMass).toBe(24);
    expect(result.leanMass).toBe(56);
  });

  test("never estimates bone mass as a fixed percentage of lean mass", () => {
    const result = analyzeAnthropometry(
      {
        peso: "80",
        altura: "170",
        composition_method: "skinfolds",
        d_tricipital: "12",
        d_suprailiaca: "15",
        d_coxa: "18",
      },
      female,
      "pollock3",
    );

    expect(result.boneMass).toBe(null);
  });

  test("flags impossible bioimpedance relationships", () => {
    const issues = validateAnthropometry({ peso: "70", bia_massa_gorda: "75", bia_mlg: "72" }, female);
    expect(issues.some((issue) => issue.severity === "error" && issue.field === "bia_massa_gorda")).toBe(true);
    expect(issues.some((issue) => issue.severity === "error" && issue.field === "bia_mlg")).toBe(true);
  });
});

describe("Omron visceral fat scale", () => {
  test("uses the clinic Omron ranges exactly", () => {
    expect(visceralFatClass(6.99, "omron")).toContain("Normal");
    expect(visceralFatClass(7, "omron")).toContain("Aumentado");
    expect(visceralFatClass(9.99, "omron")).toContain("Aumentado");
    expect(visceralFatClass(10, "omron")).toContain("Alto");
    expect(visceralFatClass(12, "omron")).toContain("Alto");
    expect(visceralFatClass(13, "omron")).toContain("Muito alto");
    expect(visceralFatClass(30, "omron")).toContain("Muito alto");
  });
});
