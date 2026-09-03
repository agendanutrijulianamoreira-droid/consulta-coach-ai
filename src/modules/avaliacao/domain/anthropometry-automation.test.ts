import { describe, expect, test } from "bun:test";
import { applyAnthropometryInput, applyEstimatedWeight, estimateBedriddenWeight } from "./anthropometry-automation";

const female = { age: 72, sex: "feminino" };

describe("bedridden weight estimation", () => {
  test("requires every Chumlea measurement", () => {
    const result = estimateBedriddenWeight({ altura_joelho: "52" }, female);
    expect(result.weight).toBe(null);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  test("calculates female Chumlea weight", () => {
    const result = estimateBedriddenWeight(
      {
        altura_joelho: "52",
        c_braco_relaxado: "30",
        c_panturrilha: "34",
        d_subescapular: "20",
      },
      female,
    );
    expect(result.weight).toBe(63.5);
  });

  test("marks applied estimate for traceability", () => {
    const result = applyEstimatedWeight({}, 63.5);
    expect(result["peso"]).toBe("63.5");
    expect(result["weight_source"]).toBe("estimated_chumlea");
  });
});

describe("bidirectional bioimpedance", () => {
  test("percent fat fills fat mass and derives lean mass", () => {
    const result = applyAnthropometryInput({ peso: "80" }, "bia_gordura_pct", "30");
    expect(result["bia_massa_gorda"]).toBe("24");
    expect(result["bia_mlg"]).toBe("56");
    expect(result["bia_mlg_source"]).toBe("derived_weight_minus_fat_mass");
    expect(result["bia_fat_source"]).toBe("percent");
  });

  test("fat mass fills fat percent and derives lean mass", () => {
    const result = applyAnthropometryInput({ peso: "80" }, "bia_massa_gorda", "24");
    expect(result["bia_gordura_pct"]).toBe("30");
    expect(result["bia_mlg"]).toBe("56");
    expect(result["bia_fat_source"]).toBe("mass");
  });

  test("percent muscle fills muscle mass", () => {
    const result = applyAnthropometryInput({ peso: "80" }, "bia_musculo_pct", "35");
    expect(result["bia_musculo"]).toBe("28");
  });

  test("muscle mass fills muscle percent", () => {
    const result = applyAnthropometryInput({ peso: "80" }, "bia_musculo", "28");
    expect(result["bia_musculo_pct"]).toBe("35");
  });

  test("weight changes preserve the last entered source and refresh lean mass", () => {
    const withFatMass = applyAnthropometryInput({ peso: "80" }, "bia_massa_gorda", "24");
    const afterWeight = applyAnthropometryInput(withFatMass, "peso", "60");
    expect(afterWeight["bia_massa_gorda"]).toBe("24");
    expect(afterWeight["bia_gordura_pct"]).toBe("40");
    expect(afterWeight["bia_mlg"]).toBe("36");
  });
});
