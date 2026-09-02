import {
  ANAMNESIS_FIELDS,
  ANAMNESIS_SECTIONS,
  type AnamnesisField,
  type AnamnesisFields,
  type AnamnesisKey,
} from "@/lib/nutrios/types";

/**
 * Mescla uma nova extração da IA sem destruir revisão profissional.
 * Campos aceitos, editados ou recusados pelo nutricionista são imutáveis
 * para extrações subsequentes. Apenas campos vazios/sugeridos podem receber
 * informação nova da transcrição.
 */
export function mergeAnamnesisSuggestions(
  current: AnamnesisFields,
  extracted: Partial<Record<AnamnesisKey, string | null | undefined>>,
): AnamnesisFields {
  const next: AnamnesisFields = { ...current };

  for (const { key } of ANAMNESIS_FIELDS) {
    const existing = current[key];
    const value = extracted[key]?.trim();

    if (!value) continue;
    if (existing && existing.status !== "sugerido") continue;
    if (existing?.value.trim() === value) continue;

    next[key] = {
      value,
      status: "sugerido",
      source: "transcrição",
    };
  }

  return next;
}

export function anamnesisCompletion(fields: AnamnesisFields) {
  const total = ANAMNESIS_FIELDS.filter((field) => field.required).length;
  const completed = ANAMNESIS_FIELDS.filter((field) => {
    if (!field.required) return false;
    const item = fields[field.key];
    return Boolean(item?.value.trim()) && item?.status !== "recusado";
  }).length;

  const reviewed = ANAMNESIS_FIELDS.filter((field) => {
    const item = fields[field.key];
    return item && item.status !== "sugerido";
  }).length;

  const suggested = ANAMNESIS_FIELDS.filter(
    (field) => fields[field.key]?.status === "sugerido" && Boolean(fields[field.key]?.value.trim()),
  ).length;

  return {
    total,
    completed,
    reviewed,
    suggested,
    percent: total ? Math.round((completed / total) * 100) : 100,
  };
}

export function sectionCompletion(fields: AnamnesisFields, sectionId: string) {
  const section = ANAMNESIS_SECTIONS.find((item) => item.id === sectionId);
  if (!section) return { filled: 0, total: 0 };

  const requiredKeys = section.fields.filter((key) => {
    const definition = ANAMNESIS_FIELDS.find((field) => field.key === key);
    return definition?.required;
  });

  const filled = requiredKeys.filter((key) => {
    const item = fields[key];
    return Boolean(item?.value.trim()) && item?.status !== "recusado";
  }).length;

  return { filled, total: requiredKeys.length };
}

export function updateAnamnesisField(
  fields: AnamnesisFields,
  key: AnamnesisKey,
  patch: Partial<AnamnesisField>,
): AnamnesisFields {
  const current = fields[key] ?? { value: "", status: "editado" as const };
  return { ...fields, [key]: { ...current, ...patch } };
}
