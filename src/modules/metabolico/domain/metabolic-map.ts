export type MetabolicDomain =
  | "contexto_clinico"
  | "saude_da_mulher"
  | "antropometria"
  | "capacidade_fisica"
  | "energia"
  | "exames"
  | "genetica"
  | "rotina";

export type MetabolicSource =
  "manual" | "informed" | "ai_extracted" | "calculated" | "measured" | "imported";
export type ReviewStatus = "pending" | "confirmed" | "rejected";
export type MetabolicStatus = "complete" | "partial" | "pending" | "stale";

export type DomainPoint = {
  present: boolean;
  updatedAt?: string | null;
  reviewStatus?: ReviewStatus | null;
  staleAfterDays?: number;
};

export type DomainStatus = {
  status: MetabolicStatus;
  label: string;
  pendingReview: number;
  lastUpdated: string | null;
};

export type LongitudinalPoint = {
  date: string;
  value: number;
  unit: string;
  source: MetabolicSource;
};

const STATUS_LABELS: Record<MetabolicStatus, string> = {
  complete: "Completo",
  partial: "Parcial",
  pending: "Pendente",
  stale: "Desatualizado",
};

export function getDomainStatus(points: DomainPoint[], now = new Date()): DomainStatus {
  const present = points.filter((point) => point.present);
  const pendingReview = present.filter((point) => point.reviewStatus === "pending").length;
  const dates = present
    .map((point) => point.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const lastUpdated = dates.at(-1) ?? null;
  const stale =
    present.length > 0 &&
    present.some((point) => {
      if (!point.updatedAt) return false;
      const age = (now.getTime() - new Date(point.updatedAt).getTime()) / 86_400_000;
      return Number.isFinite(age) && age > (point.staleAfterDays ?? 180);
    });
  const status: MetabolicStatus = !present.length
    ? "pending"
    : stale
      ? "stale"
      : present.length < points.length
        ? "partial"
        : "complete";
  return { status, label: STATUS_LABELS[status], pendingReview, lastUpdated };
}

export function compareLongitudinal(points: LongitudinalPoint[]) {
  const comparable = points
    .filter((point) => Number.isFinite(point.value) && point.unit.trim() !== "")
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = comparable[0]?.value ?? null;
  const last = comparable.at(-1)?.value ?? null;
  return {
    points: comparable,
    delta: first !== null && last !== null && comparable.length > 1 ? round(last - first, 2) : null,
    direction:
      first === null || last === null || comparable.length < 2
        ? "stable"
        : last > first
          ? "up"
          : last < first
            ? "down"
            : "stable",
  } as const;
}

export function convertSpanToCm(value: number, unit: "cm" | "m" | "in") {
  if (!Number.isFinite(value) || value <= 0) return null;
  const converted = unit === "m" ? value * 100 : unit === "in" ? value * 2.54 : value;
  return round(converted, 2);
}

export function validateGrip(value: number | null) {
  if (value === null || value === undefined || value === 0) return null;
  if (!Number.isFinite(value) || value <= 0 || value > 150)
    return "A força de preensão deve estar entre 0 e 150 kgf.";
  return null;
}

export function validateEnergyMeasurement(input: {
  kind: "estimated" | "measured";
  kcal: number | null;
  formula?: string | null;
  equipment?: string | null;
  conditions?: string | null;
}) {
  const issues: string[] = [];
  if (input.kcal === null || !Number.isFinite(input.kcal) || input.kcal <= 0)
    issues.push("Informe uma energia positiva.");
  if (input.kind === "estimated" && !input.formula?.trim())
    issues.push("A estimativa precisa registrar a fórmula.");
  if (input.kind === "measured" && !input.equipment?.trim())
    issues.push("A calorimetria medida precisa registrar o equipamento.");
  if (input.kind === "measured" && !input.conditions?.trim())
    issues.push("Registre as condições do teste de calorimetria.");
  return issues;
}

export function buildReviewableSynthesis(input: {
  priorities: string[];
  approaches: string[];
  discussWithDoctor: string[];
  evidence: string[];
}) {
  return {
    priorities: input.priorities.map((value) => ({ value, status: "draft" as const })),
    approaches: input.approaches.map((value) => ({ value, status: "draft" as const })),
    discussWithDoctor: input.discussWithDoctor.map((value) => ({
      value,
      status: "draft" as const,
    })),
    evidence: input.evidence,
    disclaimer:
      "Rascunho para revisão profissional. Não é diagnóstico, prescrição ou conduta médica.",
  };
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
