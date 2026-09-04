import { describe, expect, test } from "bun:test";
import { normalizeMethod, upsertMethod, type ClinicMethod } from "./method-store";

function method(id: string, name: string): ClinicMethod {
  return {
    id,
    name,
    description: "",
    status: "draft",
    phases: [{ id: `${id}-phase`, title: "Fase 1", objective: "", goals: [], materials: [] }],
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
  };
}

describe("clinic method persistence", () => {
  test("keeps multiple methods without overwriting an existing one", () => {
    const first = method("first", "Primeiro método");
    const second = method("second", "Segundo método");

    expect(upsertMethod(upsertMethod([], first), second)).toEqual([second, first]);
  });

  test("edits a saved method in place and preserves the other methods", () => {
    const first = method("first", "Primeiro método");
    const second = method("second", "Segundo método");
    const edited = { ...first, name: "Primeiro método editado" };

    expect(upsertMethod([second, first], edited)).toEqual([second, edited]);
  });

  test("removes unsupported legacy selections while preserving recipes and favorite materials", () => {
    const legacy = method("legacy", "Método antigo");
    legacy.phases[0]!.materials = [
      { id: "food", type: "food", label: "Alimento antigo" },
      { id: "meal", type: "meal", label: "Refeição antiga" },
      { id: "plan", type: "plan", label: "Plano antigo" },
      { id: "recipe", type: "recipe", label: "Receita" },
      { id: "material", type: "material", label: "Guia" },
    ] as unknown as ClinicMethod["phases"][number]["materials"];

    expect(normalizeMethod(legacy).phases[0]!.materials).toEqual([
      { id: "recipe", type: "recipe", label: "Receita" },
      { id: "material", type: "material", label: "Guia" },
    ]);
  });
});
