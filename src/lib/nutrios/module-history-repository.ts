import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import * as db from "./repository";

export type ClinicalModuleKey =
  | "consulta"
  | "anamnese"
  | "antropometria"
  | "calculos"
  | "recordatorio"
  | "diagnostico"
  | "plano"
  | "parecer";

type DiagnosisBase = Database["public"]["Tables"]["diagnoses"];
type ExtendedDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "diagnoses"> & {
      diagnoses: {
        Row: DiagnosisBase["Row"] & { reasoning: Json };
        Insert: DiagnosisBase["Insert"] & { reasoning?: Json };
        Update: DiagnosisBase["Update"] & { reasoning?: Json };
        Relationships: DiagnosisBase["Relationships"];
      };
    };
  };
};

const clinicalSupabase = supabase as unknown as SupabaseClient<ExtendedDatabase>;
const json = (value: unknown) => value as never;
const FAVORITE_SECTION_KEY = "meal_plan_favorite";

export type ClinicalModuleHistory = {
  consultations: db.Consultation[];
  transcriptCount: Record<string, number>;
  anamnesisCount: Record<string, number>;
  anthro: Record<string, Record<string, string | undefined>>;
  calculations: Record<string, { kcal: number | null; energy: Record<string, unknown> }>;
  recallCount: Record<string, number>;
  diagnoses: Record<string, { hypotheses: number; priorities: number }>;
  plans: Record<string, {
    id: string;
    kcal?: number | undefined;
    protein_g?: number | undefined;
    carb_g?: number | undefined;
    fat_g?: number | undefined;
    isFavorite: boolean;
  }>;
  reports: Record<string, string>;
};

export async function getClinicalModuleHistory(patientId: string): Promise<ClinicalModuleHistory> {
  const consultations = await db.listPatientConsultations(patientId);
  const ids = consultations.map((item) => item.id);
  const empty: ClinicalModuleHistory = {
    consultations,
    transcriptCount: {},
    anamnesisCount: {},
    anthro: {},
    calculations: {},
    recallCount: {},
    diagnoses: {},
    plans: {},
    reports: {},
  };
  if (!ids.length) return empty;

  const [segments, anamnesis, anthro, conducts, recall, diagnoses, plans, records] = await Promise.all([
    supabase.from("transcript_segments").select("consultation_id, id").in("consultation_id", ids),
    supabase.from("anamnesis").select("consultation_id, fields").in("consultation_id", ids),
    supabase.from("anthropometry").select("consultation_id, data").in("consultation_id", ids),
    supabase.from("conducts").select("consultation_id, kcal, energy").in("consultation_id", ids),
    supabase.from("food_recall_items").select("consultation_id, id").in("consultation_id", ids),
    clinicalSupabase.from("diagnoses").select("consultation_id, hypotheses, reasoning").in("consultation_id", ids),
    supabase.from("meal_plans").select("id, consultation_id, totals, created_at").in("consultation_id", ids).order("created_at", { ascending: false }),
    supabase.from("records").select("consultation_id, report, sections").in("consultation_id", ids),
  ]);

  for (const result of [segments, anamnesis, anthro, conducts, recall, diagnoses, plans, records]) {
    if (result.error) throw new Error(result.error.message);
  }

  const favoriteByConsultation: Record<string, boolean> = {};
  for (const row of records.data ?? []) {
    const sections = (row.sections ?? {}) as Record<string, unknown>;
    favoriteByConsultation[row.consultation_id] = sections[FAVORITE_SECTION_KEY] === "true";
    if (row.report) empty.reports[row.consultation_id] = row.report;
  }
  for (const row of segments.data ?? []) {
    empty.transcriptCount[row.consultation_id] = (empty.transcriptCount[row.consultation_id] ?? 0) + 1;
  }
  for (const row of anamnesis.data ?? []) {
    const fields = (row.fields ?? {}) as Record<string, unknown>;
    empty.anamnesisCount[row.consultation_id] = Object.values(fields).filter((value) => {
      if (!value || typeof value !== "object") return false;
      const field = value as { value?: unknown; status?: unknown };
      return Boolean(field.value) && field.status !== "recusado";
    }).length;
  }
  for (const row of anthro.data ?? []) {
    empty.anthro[row.consultation_id] = (row.data ?? {}) as Record<string, string | undefined>;
  }
  for (const row of conducts.data ?? []) {
    empty.calculations[row.consultation_id] = {
      kcal: row.kcal,
      energy: (row.energy ?? {}) as Record<string, unknown>,
    };
  }
  for (const row of recall.data ?? []) {
    empty.recallCount[row.consultation_id] = (empty.recallCount[row.consultation_id] ?? 0) + 1;
  }
  for (const row of diagnoses.data ?? []) {
    const reasoning = (row.reasoning ?? {}) as Record<string, unknown>;
    const priorityItems = reasoning["priorities"];
    const priorities = Array.isArray(priorityItems) ? priorityItems.length : 0;
    empty.diagnoses[row.consultation_id] = {
      hypotheses: Array.isArray(row.hypotheses) ? row.hypotheses.length : 0,
      priorities,
    };
  }
  for (const row of plans.data ?? []) {
    if (empty.plans[row.consultation_id]) continue;
    const totals = (row.totals ?? {}) as Record<string, unknown>;
    empty.plans[row.consultation_id] = {
      id: row.id,
      kcal: numberOrUndefined(totals["kcal"]),
      protein_g: numberOrUndefined(totals["protein_g"]),
      carb_g: numberOrUndefined(totals["carb_g"]),
      fat_g: numberOrUndefined(totals["fat_g"]),
      isFavorite: favoriteByConsultation[row.consultation_id] ?? false,
    };
  }
  return empty;
}

export async function toggleMealPlanFavorite(consultationId: string, isFavorite: boolean) {
  const current = await db.getRecord(consultationId);
  const sections = {
    ...(current.sections ?? {}),
    [FAVORITE_SECTION_KEY]: isFavorite ? "true" : "false",
  };
  await db.saveRecord(consultationId, sections);
}

export async function createModuleRecord(patientId: string, consultationDate: string) {
  return db.createConsultation(patientId, consultationDate, undefined, "module");
}

export async function duplicateClinicalModule(
  patientId: string,
  sourceConsultationId: string,
  module: ClinicalModuleKey,
  consultationDate: string,
) {
  const target = await db.createConsultation(patientId, consultationDate, undefined, "module");
  try {
    if (module === "consulta") {
      await copyTranscript(sourceConsultationId, target.id);
      await copyAnamnesis(sourceConsultationId, target.id);
      await copyAnthropometry(sourceConsultationId, target.id);
      await copyConduct(sourceConsultationId, target.id);
      await copyRecall(sourceConsultationId, target.id);
      await copyDiagnosis(sourceConsultationId, target.id);
      await copyPlan(sourceConsultationId, target.id);
      await copyReport(sourceConsultationId, target.id);
    } else if (module === "anamnese") await copyAnamnesis(sourceConsultationId, target.id);
    else if (module === "antropometria") await copyAnthropometry(sourceConsultationId, target.id);
    else if (module === "calculos") await copyConduct(sourceConsultationId, target.id);
    else if (module === "recordatorio") await copyRecall(sourceConsultationId, target.id);
    else if (module === "diagnostico") await copyDiagnosis(sourceConsultationId, target.id);
    else if (module === "plano") {
      await copyConduct(sourceConsultationId, target.id);
      await copyPlan(sourceConsultationId, target.id);
    } else if (module === "parecer") await copyReport(sourceConsultationId, target.id);
    return target;
  } catch (error) {
    await supabase.from("consultations").delete().eq("id", target.id);
    throw error;
  }
}

async function copyTranscript(sourceId: string, targetId: string) {
  const { data, error } = await supabase
    .from("transcript_segments")
    .select("speaker, content, offset_seconds")
    .eq("consultation_id", sourceId)
    .order("offset_seconds");
  if (error) throw new Error(error.message);
  if (!data?.length) return;
  const inserted = await supabase.from("transcript_segments").insert(
    data.map((row) => ({ ...row, consultation_id: targetId })),
  );
  if (inserted.error) throw new Error(inserted.error.message);
}

async function copyAnamnesis(sourceId: string, targetId: string) {
  const { data, error } = await supabase.from("anamnesis").select("fields").eq("consultation_id", sourceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const inserted = await supabase.from("anamnesis").insert({ consultation_id: targetId, fields: data.fields });
  if (inserted.error) throw new Error(inserted.error.message);
}

async function copyAnthropometry(sourceId: string, targetId: string) {
  const { data, error } = await supabase.from("anthropometry").select("data, interpretation").eq("consultation_id", sourceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const inserted = await supabase.from("anthropometry").insert({ consultation_id: targetId, data: data.data, interpretation: data.interpretation });
  if (inserted.error) throw new Error(inserted.error.message);
}

async function copyConduct(sourceId: string, targetId: string) {
  const { data, error } = await supabase.from("conducts").select("phase, kcal, protein_g, carb_g, fat_g, meals_count, goal, preferences, restrictions, notes, energy").eq("consultation_id", sourceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const inserted = await supabase.from("conducts").insert({ ...data, consultation_id: targetId });
  if (inserted.error) throw new Error(inserted.error.message);
}

async function copyRecall(sourceId: string, targetId: string) {
  const { data, error } = await supabase.from("food_recall_items").select("time_label, foods, amount, preparation, notes, position").eq("consultation_id", sourceId).order("position");
  if (error) throw new Error(error.message);
  if (!data?.length) return;
  const inserted = await supabase.from("food_recall_items").insert(data.map((row) => ({ ...row, consultation_id: targetId })));
  if (inserted.error) throw new Error(inserted.error.message);
}

async function copyDiagnosis(sourceId: string, targetId: string) {
  const { data, error } = await clinicalSupabase.from("diagnoses").select("hypotheses, recall_flags, reasoning").eq("consultation_id", sourceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const inserted = await clinicalSupabase.from("diagnoses").insert({ ...data, consultation_id: targetId });
  if (inserted.error) throw new Error(inserted.error.message);
}

async function copyPlan(sourceId: string, targetId: string) {
  const { data, error } = await supabase.from("meal_plans").select("meals, totals, shopping_list, recipes, rationale").eq("consultation_id", sourceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const inserted = await supabase.from("meal_plans").insert({ ...data, consultation_id: targetId });
  if (inserted.error) throw new Error(inserted.error.message);
}

async function copyReport(sourceId: string, targetId: string) {
  const { data, error } = await supabase.from("records").select("sections, report").eq("consultation_id", sourceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const copiedSections = { ...((data.sections ?? {}) as Record<string, unknown>) };
  delete copiedSections[FAVORITE_SECTION_KEY];
  const inserted = await supabase.from("records").insert(json({
    consultation_id: targetId,
    sections: copiedSections,
    report: data.report,
  }));
  if (inserted.error) throw new Error(inserted.error.message);
}

function numberOrUndefined(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
