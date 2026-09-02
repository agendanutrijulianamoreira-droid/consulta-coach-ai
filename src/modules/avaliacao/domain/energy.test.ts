import { describe, expect, test } from "bun:test";
import { DEFAULT_ENERGY, basalEstimates, calculateEnergy, eerEstimate, type EnergyInputs } from "./energy";

const female: EnergyInputs = {
  ...DEFAULT_ENERGY,
  weight: 70,
  height: 165,
  age: 40,
  sex: "female",
};

const male: EnergyInputs = {
  ...DEFAULT_ENERGY,
  weight: 80,
  height: 180,
  age: 35,
  sex: "male",
};

describe("energy formula safety", () => {
  test("does not infer female sex when sex is missing", () => {
    const input: EnergyInputs = { ...female, sex: null };
    const mifflin = basalEstimates(input).find((item) => item.key === "mifflin");
    expect(mifflin?.kcal).toBe(null);
  });

  test("Mifflin follows the published adult equation", () => {
    const femaleMifflin = basalEstimates(female).find((item) => item.key === "mifflin");
    const maleMifflin = basalEstimates(male).find((item) => item.key === "mifflin");
    expect(femaleMifflin?.kcal).toBe(1370);
    expect(maleMifflin?.kcal).toBe(1755);
  });

  test("Cunningham can calculate without sex when lean mass exists", () => {
    const input: EnergyInputs = { ...female, sex: null, leanMass: 50, formula: "cunningham" };
    const result = calculateEnergy(input);
    expect(result.bmr).toBe(1600);
  });
});

describe("activity accounting", () => {
  test("activity-factor mode does not also add MET calories", () => {
    const result = calculateEnergy({ ...female, exerciseMode: "activity_factor", activityFactor: 1.2, met: 8, metMinutes: 60 });
    expect(result.metKcal).toBe(0);
    expect(result.maintenanceKcal).toBe(Math.round(1370 * 1.2));
  });

  test("MET mode adds only exercise above resting cost", () => {
    const result = calculateEnergy({ ...female, exerciseMode: "met", met: 6, metMinutes: 60 });
    expect(result.metKcal).toBe(350);
    expect(result.maintenanceKcal).toBe(Math.round(1370 * 1.2 + 350));
  });

  test("EER is total energy and is not multiplied by the generic activity factor", () => {
    const input: EnergyInputs = { ...female, formula: "eer", eerActivity: "sedentary", activityFactor: 1.9, exerciseMode: "activity_factor" };
    const eer = eerEstimate(input);
    const result = calculateEnergy(input);
    expect(result.maintenanceKcal).toBe(eer.kcal);
    expect(result.bmr).toBe(null);
  });
});

describe("maintenance versus prescription", () => {
  test("keeps maintenance expenditure separate from calorie prescription", () => {
    const result = calculateEnergy({ ...female, activityFactor: 1.2, manualAdjust: -300 });
    expect(result.maintenanceKcal).toBe(Math.round(1370 * 1.2));
    expect(result.targetKcal).toBe(Math.round(1370 * 1.2) - 300);
    expect(result.tee).toBe(result.targetKcal);
  });

  test("blocks pregnancy additions when biological sex is not female", () => {
    const result = calculateEnergy({ ...male, pregnancy: "gest_2" });
    expect(result.maintenanceKcal).toBe(null);
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
  });
});
