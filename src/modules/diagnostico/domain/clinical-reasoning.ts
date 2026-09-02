export type ReviewStatus = "suggested" | "accepted" | "edited" | "rejected";
export type ClinicalSource = "anamnese" | "antropometria" | "calculos" | "recordatorio" | "exames" | "transcricao";

export interface ClinicalFinding {
  id: string;
  label: string;
  source: ClinicalSource;
  detail: string;
}

export interface ClinicalHypothesis {
  id: string;
  title: string;
  rationale: string;
  evidence: string[];
  status: ReviewStatus;
}

export interface ClinicalPriority {
  id: string;
  rank: number;
  title: string;
  rationale: string;
  status: ReviewStatus;
}

export interface ClinicalDirection {
  id: string;
  title: string;
  rationale: string;
  status: ReviewStatus;
}

export interface ClinicalReasoning {
  findings: ClinicalFinding[];
  flags: string[];
  hypotheses: ClinicalHypothesis[];
  priorities: ClinicalPriority[];
  directions: ClinicalDirection[];
  version: string;
}

export const EMPTY_REASONING: ClinicalReasoning = {
  findings: [],
  flags: [],
  hypotheses: [],
  priorities: [],
  directions: [],
  version: "clinical-reasoning-v1",
};

const slug = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
export const clinicalId = (prefix: string, value: string) => `${prefix}-${slug(value) || crypto.randomUUID()}`;

function normalizeStatus(value: unknown): ReviewStatus {
  return value === "accepted" || value === "edited" || value === "rejected" ? value : "suggested";
}

export function normalizeReasoning(value: unknown, legacy?: { hypotheses?: string[]; flags?: string[] }): ClinicalReasoning {
  const raw = value && typeof value === "object" ? value as Partial<ClinicalReasoning> : {};
  const legacyHypotheses = legacy?.hypotheses ?? [];
  const hypotheses = Array.isArray(raw.hypotheses) && raw.hypotheses.length
    ? raw.hypotheses.filter(Boolean).map((item) => ({
        id: String(item.id || clinicalId("hyp", item.title || "hipotese")),
        title: String(item.title || ""),
        rationale: String(item.rationale || ""),
        evidence: Array.isArray(item.evidence) ? item.evidence.map(String) : [],
        status: normalizeStatus(item.status),
      })).filter((item) => item.title.trim())
    : legacyHypotheses.map((title) => ({ id: clinicalId("hyp", title), title, rationale: "Registro legado da consulta.", evidence: [], status: "accepted" as const }));

  return {
    findings: Array.isArray(raw.findings) ? raw.findings.filter(Boolean).map((item) => ({ id: String(item.id || clinicalId("finding", item.label || "achado")), label: String(item.label || ""), source: item.source || "anamnese", detail: String(item.detail || "") })).filter((item) => item.label.trim()) : [],
    flags: Array.isArray(raw.flags) ? raw.flags.map(String).filter(Boolean) : (legacy?.flags ?? []),
    hypotheses,
    priorities: Array.isArray(raw.priorities) ? raw.priorities.filter(Boolean).map((item, index) => ({ id: String(item.id || clinicalId("priority", item.title || String(index))), rank: Number(item.rank) || index + 1, title: String(item.title || ""), rationale: String(item.rationale || ""), status: normalizeStatus(item.status) })).filter((item) => item.title.trim()).sort((a, b) => a.rank - b.rank) : [],
    directions: Array.isArray(raw.directions) ? raw.directions.filter(Boolean).map((item) => ({ id: String(item.id || clinicalId("direction", item.title || "direcao")), title: String(item.title || ""), rationale: String(item.rationale || ""), status: normalizeStatus(item.status) })).filter((item) => item.title.trim()) : [],
    version: String(raw.version || "clinical-reasoning-v1"),
  };
}

function key(value: string) { return slug(value); }

export function mergeClinicalReasoning(current: ClinicalReasoning, suggestion: ClinicalReasoning): ClinicalReasoning {
  const reviewedHypotheses = new Map(current.hypotheses.filter((item) => item.status !== "suggested").map((item) => [key(item.title), item]));
  const reviewedPriorities = new Map(current.priorities.filter((item) => item.status !== "suggested").map((item) => [key(item.title), item]));
  const reviewedDirections = new Map(current.directions.filter((item) => item.status !== "suggested").map((item) => [key(item.title), item]));

  const merge = <T extends { title: string }>(suggested: T[], reviewed: Map<string, T>) => {
    const result = suggested.map((item) => reviewed.get(key(item.title)) ?? item);
    for (const item of reviewed.values()) if (!result.some((existing) => key(existing.title) === key(item.title))) result.push(item);
    return result;
  };

  return {
    ...suggestion,
    hypotheses: merge(suggestion.hypotheses, reviewedHypotheses),
    priorities: merge(suggestion.priorities, reviewedPriorities).sort((a, b) => a.rank - b.rank),
    directions: merge(suggestion.directions, reviewedDirections),
    version: "clinical-reasoning-v1",
  };
}

export function acceptedClinicalContext(reasoning: ClinicalReasoning) {
  const accepted = <T extends { status: ReviewStatus }>(items: T[]) => items.filter((item) => item.status === "accepted" || item.status === "edited");
  return {
    findings: reasoning.findings,
    flags: reasoning.flags,
    hypotheses: accepted(reasoning.hypotheses),
    priorities: accepted(reasoning.priorities),
    directions: accepted(reasoning.directions),
  };
}
