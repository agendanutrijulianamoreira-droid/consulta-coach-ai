import { describe, expect, test } from "bun:test";
import { calculateDerivedLabResults, canonicalAnalyteCode, type LabResultValue } from "./lab-calculations";

const confirmed = (analyte_code: string, analyte_name: string, value: number, unit: string): LabResultValue => ({
  id: analyte_code,
  analyte_code,
  analyte_name,
  value,
  unit,
  review_status: "confirmed",
  input_method: "manual",
});

describe("laboratory canonicalization", () => {
  test("normalizes common Brazilian analyte names", () => {
    expect(canonicalAnalyteCode("Glicemia de jejum")).toBe("glucose");
    expect(canonicalAnalyteCode("Triglicérides")).toBe("triglycerides");
    expect(canonicalAnalyteCode("TGO")).toBe("ast");
  });
});

describe("HOMA calculations", () => {
  test("calculates HOMA-IR and HOMA-beta only from confirmed fasting values", () => {
    const results = calculateDerivedLabResults([
      confirmed("glucose", "Glicemia", 97.2, "mg/dL"),
      confirmed("insulin", "Insulina", 10, "µUI/mL"),
    ], { age: 40, sex: "female", weightKg: 70 });
    expect(results.find((r) => r.analyte_code === "homa_ir")?.value).toBe(2.4);
    expect(results.find((r) => r.analyte_code === "homa_beta")?.value).toBe(105.3);
  });

  test("does not use pending imported values in derived calculations", () => {
    const results = calculateDerivedLabResults([
      { ...confirmed("glucose", "Glicemia", 97.2, "mg/dL"), review_status: "pending" },
      confirmed("insulin", "Insulina", 10, "µUI/mL"),
    ], { age: 40, sex: "female", weightKg: 70 });
    expect(results.some((r) => r.analyte_code === "homa_ir")).toBe(false);
  });
});

describe("renal calculations", () => {
  test("calculates race-free CKD-EPI 2021 and Cockcroft-Gault separately", () => {
    const results = calculateDerivedLabResults([
      confirmed("creatinine", "Creatinina", 1, "mg/dL"),
    ], { age: 60, sex: "female", weightKg: 65 });
    expect(results.find((r) => r.analyte_code === "egfr_ckd_epi_2021")?.value).toBe(64.5);
    expect(results.find((r) => r.analyte_code === "creatinine_clearance_cg")?.value).toBe(61.4);
  });

  test("does not calculate Cockcroft-Gault without weight", () => {
    const results = calculateDerivedLabResults([
      confirmed("creatinine", "Creatinina", 1, "mg/dL"),
    ], { age: 60, sex: "female", weightKg: null });
    expect(results.some((r) => r.analyte_code === "egfr_ckd_epi_2021")).toBe(true);
    expect(results.some((r) => r.analyte_code === "creatinine_clearance_cg")).toBe(false);
  });
});

describe("calculated free testosterone", () => {
  test("uses total testosterone, SHBG and albumin with Vermeulen constants", () => {
    const results = calculateDerivedLabResults([
      confirmed("testosterone_total", "Testosterona total", 20, "nmol/L"),
      confirmed("shbg", "SHBG", 30, "nmol/L"),
      confirmed("albumin", "Albumina", 4.3, "g/dL"),
    ], { age: 35, sex: "male", weightKg: 80 });
    expect(results.find((r) => r.analyte_code === "free_testosterone_calculated")?.value).toBe(443.9);
  });
});

describe("derived relations", () => {
  test("calculates common same-collection ratios", () => {
    const results = calculateDerivedLabResults([
      confirmed("triglycerides", "Triglicérides", 150, "mg/dL"),
      confirmed("hdl", "HDL", 50, "mg/dL"),
      confirmed("ldl", "LDL", 100, "mg/dL"),
      confirmed("total_cholesterol", "Colesterol total", 200, "mg/dL"),
      confirmed("ast", "TGO", 20, "U/L"),
      confirmed("alt", "TGP", 25, "U/L"),
      confirmed("neutrophils", "Neutrófilos", 4000, "/mm³"),
      confirmed("lymphocytes", "Linfócitos", 2000, "/mm³"),
    ], { age: 40, sex: "female", weightKg: 70 });
    expect(results.find((r) => r.analyte_code === "tg_hdl_ratio")?.value).toBe(3);
    expect(results.find((r) => r.analyte_code === "ct_hdl_ratio")?.value).toBe(4);
    expect(results.find((r) => r.analyte_code === "ldl_hdl_ratio")?.value).toBe(2);
    expect(results.find((r) => r.analyte_code === "ast_alt_ratio")?.value).toBe(0.8);
    expect(results.find((r) => r.analyte_code === "nlr")?.value).toBe(2);
  });
});
