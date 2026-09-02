import type { RecallItem } from "@/lib/nutrios/types";

export interface RecallSuggestion {
  time_label: string;
  foods: string;
  amount: string;
  preparation: string;
}

export interface RecallIssue {
  severity: "info" | "warning";
  itemId?: string | undefined;
  message: string;
}

export interface RecallAnalysis {
  meals: number;
  withTime: number;
  withAmount: number;
  withPreparation: number;
  completeness: number;
  firstTime: string | null;
  lastTime: string | null;
  longestGapMinutes: number | null;
  issues: RecallIssue[];
}

export function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Converte horários objetivos do relato para minutos; não inventa horário quando a fala é vaga. */
export function parseRecallTime(value: string | null | undefined): number | null {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return null;
  const match = text.match(/\b([01]?\d|2[0-3])\s*[:h]\s*([0-5]\d)?\b/) ?? text.match(/^([01]?\d|2[0-3])$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  return hour * 60 + minute;
}

export function sortRecall(items: RecallItem[]) {
  return [...items]
    .sort((a, b) => {
      const ta = parseRecallTime(a.time_label);
      const tb = parseRecallTime(b.time_label);
      if (ta !== null && tb !== null && ta !== tb) return ta - tb;
      if (ta !== null && tb === null) return -1;
      if (ta === null && tb !== null) return 1;
      return a.position - b.position;
    })
    .map((item, index) => ({ ...item, position: index }));
}

function suggestionFingerprint(suggestion: RecallSuggestion) {
  return `${normalizeText(suggestion.time_label)}|${normalizeText(suggestion.foods)}`;
}

function itemFingerprint(item: RecallItem) {
  return `${normalizeText(item.time_label)}|${normalizeText(item.foods)}`;
}

/**
 * Nova extração nunca sobrescreve o que já está no recordatório.
 * Apenas acrescenta refeições realmente novas; a revisão profissional permanece soberana.
 */
export function mergeRecallSuggestions(existing: RecallItem[], suggestions: RecallSuggestion[]): RecallItem[] {
  const fingerprints = new Set(existing.map(itemFingerprint));
  const next = [...existing];

  for (const suggestion of suggestions) {
    if (!normalizeText(suggestion.foods)) continue;
    const fingerprint = suggestionFingerprint(suggestion);
    if (fingerprints.has(fingerprint)) continue;
    fingerprints.add(fingerprint);
    next.push({
      id: crypto.randomUUID(),
      time_label: suggestion.time_label.trim() || null,
      foods: suggestion.foods.trim() || null,
      amount: suggestion.amount.trim() || null,
      preparation: suggestion.preparation.trim() || null,
      notes: null,
      position: next.length,
    });
  }

  return sortRecall(next);
}

export function analyzeRecall(items: RecallItem[]): RecallAnalysis {
  const meaningful = items.filter((item) => normalizeText(item.foods));
  const withTime = meaningful.filter((item) => parseRecallTime(item.time_label) !== null).length;
  const withAmount = meaningful.filter((item) => normalizeText(item.amount)).length;
  const withPreparation = meaningful.filter((item) => normalizeText(item.preparation)).length;
  const issues: RecallIssue[] = [];

  for (const item of meaningful) {
    if (!normalizeText(item.amount)) issues.push({ severity: "warning", itemId: item.id, message: "Quantidade não informada nesta refeição." });
    if (!normalizeText(item.time_label)) issues.push({ severity: "info", itemId: item.id, message: "Horário não informado nesta refeição." });
  }

  const timed = meaningful
    .map((item) => ({ item, minutes: parseRecallTime(item.time_label) }))
    .filter((entry): entry is { item: RecallItem; minutes: number } => entry.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes);

  let longestGapMinutes: number | null = null;
  for (let index = 1; index < timed.length; index += 1) {
    const gap = timed[index]!.minutes - timed[index - 1]!.minutes;
    longestGapMinutes = longestGapMinutes === null ? gap : Math.max(longestGapMinutes, gap);
  }

  if (longestGapMinutes !== null && longestGapMinutes >= 360) {
    issues.push({ severity: "info", message: `Há um intervalo de ${Math.floor(longestGapMinutes / 60)}h${longestGapMinutes % 60 ? ` ${longestGapMinutes % 60}min` : ""} entre refeições registradas. Confirme se o relato está completo.` });
  }
  if (meaningful.length > 0 && withAmount === 0) {
    issues.push({ severity: "warning", message: "Nenhuma refeição possui quantidade registrada; isso limita análises quantitativas posteriores." });
  }

  const possible = meaningful.length * 3;
  const completed = meaningful.length + withTime + withAmount;
  const completeness = possible > 0 ? Math.round((completed / possible) * 100) : 0;

  return {
    meals: meaningful.length,
    withTime,
    withAmount,
    withPreparation,
    completeness,
    firstTime: timed.length ? timed[0]!.item.time_label : null,
    lastTime: timed.length ? timed[timed.length - 1]!.item.time_label : null,
    longestGapMinutes,
    issues,
  };
}
