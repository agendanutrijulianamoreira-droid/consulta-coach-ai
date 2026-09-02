import { describe, expect, test } from "bun:test";
import type { RecallItem } from "@/lib/nutrios/types";
import { analyzeRecall, mergeRecallSuggestions, parseRecallTime, sortRecall } from "./recall";

const item = (overrides: Partial<RecallItem>): RecallItem => ({
  id: crypto.randomUUID(),
  time_label: null,
  foods: null,
  amount: null,
  preparation: null,
  notes: null,
  position: 0,
  ...overrides,
});

describe("recall parsing", () => {
  test("parses objective Brazilian time formats", () => {
    expect(parseRecallTime("07:30")).toBe(450);
    expect(parseRecallTime("12h")).toBe(720);
    expect(parseRecallTime("19h15")).toBe(1155);
  });

  test("does not invent time from vague labels", () => {
    expect(parseRecallTime("de manhã")).toBe(null);
    expect(parseRecallTime("depois do trabalho")).toBe(null);
  });

  test("sorts known times chronologically and preserves unknowns afterwards", () => {
    const sorted = sortRecall([
      item({ id: "b", time_label: "19:00", foods: "jantar", position: 0 }),
      item({ id: "c", time_label: null, foods: "ceia", position: 1 }),
      item({ id: "a", time_label: "07:00", foods: "café", position: 2 }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });
});

describe("AI suggestion merge", () => {
  test("never overwrites an existing reviewed meal", () => {
    const existing = [item({ id: "manual", time_label: "08:00", foods: "2 ovos e café", amount: "2 unidades", position: 0 })];
    const merged = mergeRecallSuggestions(existing, [
      { time_label: "08:00", foods: "2 ovos e café", amount: "3 unidades", preparation: "frito" },
    ]);
    expect(merged).toEqual(existing);
  });

  test("adds genuinely new meals and ignores blank suggestions", () => {
    const existing = [item({ id: "cafe", time_label: "08:00", foods: "café com leite", position: 0 })];
    const merged = mergeRecallSuggestions(existing, [
      { time_label: "12:30", foods: "arroz, feijão e frango", amount: "1 prato", preparation: "grelhado" },
      { time_label: "", foods: "", amount: "", preparation: "" },
    ]);
    expect(merged.length).toBe(2);
    expect(merged[1]?.foods).toBe("arroz, feijão e frango");
  });
});

describe("recall quality", () => {
  test("flags missing quantities without turning it into a diagnosis", () => {
    const analysis = analyzeRecall([
      item({ id: "1", time_label: "08:00", foods: "pão e café", amount: null }),
      item({ id: "2", time_label: "13:00", foods: "arroz e frango", amount: "1 prato" }),
    ]);
    expect(analysis.meals).toBe(2);
    expect(analysis.withAmount).toBe(1);
    expect(analysis.issues.some((issue) => issue.itemId === "1")).toBe(true);
  });

  test("surfaces long intervals only as a completeness check", () => {
    const analysis = analyzeRecall([
      item({ id: "1", time_label: "07:00", foods: "café", amount: "1 xícara" }),
      item({ id: "2", time_label: "14:00", foods: "almoço", amount: "1 prato" }),
    ]);
    expect(analysis.longestGapMinutes).toBe(420);
    expect(analysis.issues.some((issue) => issue.message.includes("Confirme"))).toBe(true);
  });
});
