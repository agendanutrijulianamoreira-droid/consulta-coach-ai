import { describe, expect, test } from "bun:test";
import {
  anamnesisCompletion,
  mergeAnamnesisSuggestions,
  updateAnamnesisField,
} from "./anamnesis";
import type { AnamnesisFields, SuggestionStatus } from "@/lib/nutrios/types";

describe("mergeAnamnesisSuggestions", () => {
  test("fills an empty field from the transcript", () => {
    const result = mergeAnamnesisSuggestions({}, { agua: "2 litros ao dia" });

    expect(result.agua).toEqual({
      value: "2 litros ao dia",
      status: "sugerido",
      source: "transcrição",
    });
  });

  test("updates a field that is still only an AI suggestion", () => {
    const current: AnamnesisFields = {
      sono: { value: "dorme mal", status: "sugerido", source: "transcrição" },
    };

    const result = mergeAnamnesisSuggestions(current, {
      sono: "dorme 5 horas e acorda duas vezes à noite",
    });

    expect(result.sono?.value).toBe("dorme 5 horas e acorda duas vezes à noite");
    expect(result.sono?.status).toBe("sugerido");
  });

  const reviewedStatuses: SuggestionStatus[] = ["aceito", "editado", "recusado"];
  for (const status of reviewedStatuses) {
    test(`never overwrites a ${status} field reviewed by the professional`, () => {
      const current: AnamnesisFields = {
        medicamentos: { value: "Metformina 500 mg à noite", status, source: "profissional" },
      };

      const result = mergeAnamnesisSuggestions(current, {
        medicamentos: "Metformina 850 mg duas vezes ao dia",
      });

      expect(result.medicamentos).toEqual(current.medicamentos);
    });
  }

  test("ignores null, blank and whitespace-only extraction values", () => {
    const current: AnamnesisFields = {
      alergias: { value: "Sem alergias relatadas", status: "aceito" },
    };

    const result = mergeAnamnesisSuggestions(current, {
      alergias: null,
      suplementos: "   ",
    });

    expect(result).toEqual(current);
  });
});

describe("anamnesisCompletion", () => {
  test("counts required fields filled and not refused", () => {
    const fields: AnamnesisFields = {
      objetivo_consulta: { value: "Emagrecimento", status: "aceito" },
      queixa_principal: { value: "Cansaço", status: "editado" },
      sintomas: { value: "Sem outras queixas", status: "recusado" },
    };

    const completion = anamnesisCompletion(fields);

    expect(completion.completed).toBe(2);
    expect(completion.total).toBeGreaterThan(2);
    expect(completion.reviewed).toBe(3);
  });

  test("reports outstanding AI suggestions separately", () => {
    const fields: AnamnesisFields = {
      agua: { value: "1 litro ao dia", status: "sugerido", source: "transcrição" },
      sono: { value: "7 horas", status: "aceito" },
    };

    expect(anamnesisCompletion(fields).suggested).toBe(1);
  });
});

describe("updateAnamnesisField", () => {
  test("allows professional editing of an empty field without losing metadata", () => {
    const result = updateAnamnesisField({}, "dificuldades", {
      value: "Falta de planejamento",
      status: "editado",
      source: "profissional",
    });

    expect(result.dificuldades).toEqual({
      value: "Falta de planejamento",
      status: "editado",
      source: "profissional",
    });
  });
});
