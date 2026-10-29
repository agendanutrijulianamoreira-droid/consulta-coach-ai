/**
 * Infraestrutura de acesso a dados (Lovable Cloud).
 * Concentra todas as consultas para que os módulos de UI não conheçam o banco.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AnamnesisFields, Food, MealPlan, RecallItem, Recipe } from "./types";

/** Payloads JSONB são tipados no domínio; o cliente gerado exige o tipo Json. */
const json = (value: unknown) => value as never;

export interface Patient {
  id: string;
  name: string;
  birth_date: string | null;
  sex: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  cpf: string | null;
  is_pregnant: boolean;
  pregnancy_weeks: number | null;
  tags: string[];
  photo_consent_at: string | null;
  created_at: string;
}

export interface Consultation {
  id: string;
  patient_id: string;
  status: string;
  current_step: string;
  consultation_date: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  clinical_summary: string | null;
  observations: string | null;
  record_kind: "attendance" | "module";
  visible_in_history: boolean;
  created_at: string;
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  content: string;
  offset_seconds: number;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function listPatients() {
  return unwrap(
    await supabase.from("patients").select("*").order("created_at", { ascending: false }),
  ) as unknown as Patient[];
}

export type PatientInput = {
  name: string;
  birth_date?: string | null;
  sex?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  cpf?: string | null;
  is_pregnant?: boolean;
  pregnancy_weeks?: number | null;
  tags?: string[];
};

export async function createPatient(input: PatientInput) {
  return unwrap(
    await supabase.from("patients").insert(input).select().single(),
  ) as unknown as Patient;
}

export async function updatePatient(id: string, input: PatientInput) {
  return unwrap(
    await supabase.from("patients").update(input).eq("id", id).select().single(),
  ) as unknown as Patient;
}

/** Remove o paciente. Falha se já existirem consultas vinculadas (integridade clínica). */
export async function deletePatient(id: string) {
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) {
    if (error.message.includes("foreign key") || error.message.includes("violates")) {
      throw new Error("Este paciente possui consultas registradas e não pode ser excluído.");
    }
    throw new Error(error.message);
  }
}

export async function listConsultations() {
  return unwrap(
    await supabase
      .from("consultations")
      .select("*, patients(name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ) as (Consultation & { patients: { name: string } | null })[];
}

export async function createConsultation(
  patientId: string,
  consultationDate?: string,
  observations?: string,
  recordKind: Consultation["record_kind"] = "attendance",
) {
  const payload: {
    patient_id: string;
    consultation_date?: string;
    observations?: string | null;
    record_kind: Consultation["record_kind"];
  } = {
    patient_id: patientId,
    record_kind: recordKind,
  };
  if (consultationDate) payload.consultation_date = consultationDate;
  if (observations !== undefined) payload.observations = observations.trim() || null;
  return unwrap(
    await supabase.from("consultations").insert(payload).select().single(),
  ) as Consultation;
}

/** Oculta somente o registro administrativo; o prontuário clínico permanece intacto. */
export async function hideConsultationFromHistory(id: string) {
  const { error } = await supabase
    .from("consultations")
    .update({ visible_in_history: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type ConsultationReportRow = Pick<
  Consultation,
  "id" | "patient_id" | "status" | "consultation_date" | "observations" | "created_at"
> & { patients: { name: string } | null };

/** Fonte única do relatório operacional exibido em Meu Consultório. */
export async function listConsultationReport() {
  return unwrap(
    await supabase
      .from("consultations")
      .select("id, patient_id, status, consultation_date, observations, created_at, patients(name)")
      .eq("record_kind", "attendance")
      .eq("visible_in_history", true)
      .order("consultation_date", { ascending: false }),
  ) as unknown as ConsultationReportRow[];
}

export async function getPatient(id: string) {
  return unwrap(
    await supabase.from("patients").select("*").eq("id", id).single(),
  ) as unknown as Patient;
}

/** Consentimento explícito da paciente para registro de fotos de evolução. */
export async function setPhotoConsent(patientId: string) {
  const { error } = await supabase
    .from("patients")
    .update({ photo_consent_at: new Date().toISOString() } as never)
    .eq("id", patientId);
  if (error) throw new Error(error.message);
}

/** Histórico completo de consultas de um paciente (ordem cronológica inversa). */
export async function listPatientConsultations(patientId: string) {
  return unwrap(
    await supabase
      .from("consultations")
      .select("*")
      .eq("patient_id", patientId)
      .order("consultation_date", { ascending: false }),
  ) as Consultation[];
}

/** Datas de todas as consultas — base dos indicadores de volume (dia/semana/mês/ano). */
export async function listConsultationDates() {
  return unwrap(
    await supabase
      .from("consultations")
      .select("consultation_date")
      .order("consultation_date", { ascending: false }),
  ) as { consultation_date: string }[];
}

export async function getConsultation(id: string) {
  return unwrap(
    await supabase.from("consultations").select("*, patients(*)").eq("id", id).single(),
  ) as Consultation & { patients: Patient };
}

/**
 * Dossiê do paciente: histórico de consultas + materiais gerados (antropometria,
 * parecer e cardápio) em uma única leitura, para a ficha personalizada.
 */
export async function getPatientDossier(patientId: string) {
  const consultations = await listPatientConsultations(patientId);
  const ids = consultations.map((c) => c.id);
  const empty = { consultations, anthro: {}, reports: {}, plans: {} } as {
    consultations: Consultation[];
    anthro: Record<string, Record<string, string | undefined>>;
    reports: Record<string, string>;
    plans: Record<string, { kcal?: number }>;
  };
  if (!ids.length) return empty;
  const [anthroRows, recordRows, planRows] = await Promise.all([
    supabase.from("anthropometry").select("consultation_id, data").in("consultation_id", ids),
    supabase.from("records").select("consultation_id, report").in("consultation_id", ids),
    supabase.from("meal_plans").select("consultation_id, totals").in("consultation_id", ids),
  ]);
  for (const row of (anthroRows.data ?? []) as { consultation_id: string; data: unknown }[]) {
    empty.anthro[row.consultation_id] = (row.data ?? {}) as Record<string, string | undefined>;
  }
  for (const row of (recordRows.data ?? []) as {
    consultation_id: string;
    report: string | null;
  }[]) {
    if (row.report) empty.reports[row.consultation_id] = row.report;
  }
  for (const row of (planRows.data ?? []) as { consultation_id: string; totals: unknown }[]) {
    empty.plans[row.consultation_id] = (row.totals ?? {}) as { kcal?: number };
  }
  return empty;
}

export async function updateConsultation(id: string, patch: Partial<Consultation>) {
  const { error } = await supabase.from("consultations").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listSegments(consultationId: string) {
  return unwrap(
    await supabase
      .from("transcript_segments")
      .select("id, speaker, content, offset_seconds")
      .eq("consultation_id", consultationId)
      .order("offset_seconds", { ascending: true })
      .order("created_at", { ascending: true }),
  ) as TranscriptSegment[];
}

export async function insertSegments(
  consultationId: string,
  segments: { speaker: string; content: string; offset_seconds: number; client_id: string }[],
) {
  const { error } = await supabase.from("transcript_segments").upsert(
    segments.map((s) => ({ ...s, consultation_id: consultationId })),
    { onConflict: "consultation_id,client_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export async function getAnamnesis(consultationId: string) {
  const { data, error } = await supabase
    .from("anamnesis")
    .select("fields")
    .eq("consultation_id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.fields ?? {}) as AnamnesisFields;
}

export async function saveAnamnesis(consultationId: string, fields: AnamnesisFields) {
  const { error } = await supabase
    .from("anamnesis")
    .upsert(
      { consultation_id: consultationId, fields: json(fields) },
      { onConflict: "consultation_id" },
    );
  if (error) throw new Error(error.message);
}

/** Medidas da avaliação: chaves definidas em ANTHRO_SECTIONS, valores como texto. */
export type AnthropometryData = Record<string, string | undefined>;

export async function getAnthropometry(consultationId: string) {
  const { data, error } = await supabase
    .from("anthropometry")
    .select("data, interpretation")
    .eq("consultation_id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    data: (data?.data ?? {}) as AnthropometryData,
    interpretation: (data?.interpretation ?? "") as string,
  };
}

export async function saveAnthropometry(
  consultationId: string,
  data: AnthropometryData,
  interpretation: string,
) {
  const { error } = await supabase
    .from("anthropometry")
    .upsert(
      { consultation_id: consultationId, data: json(data), interpretation },
      { onConflict: "consultation_id" },
    );
  if (error) throw new Error(error.message);
}

export async function listRecall(consultationId: string) {
  return unwrap(
    await supabase
      .from("food_recall_items")
      .select("*")
      .eq("consultation_id", consultationId)
      .order("position", { ascending: true }),
  ) as RecallItem[];
}

export async function upsertRecallItem(
  consultationId: string,
  item: Partial<RecallItem> & { id?: string },
) {
  const payload = { ...item, consultation_id: consultationId };
  const { error } = await supabase.from("food_recall_items").upsert(json(payload));
  if (error) throw new Error(error.message);
}

export async function deleteRecallItem(id: string) {
  const { error } = await supabase.from("food_recall_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getDiagnoses(consultationId: string) {
  const { data, error } = await supabase
    .from("diagnoses")
    .select("hypotheses, recall_flags")
    .eq("consultation_id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    hypotheses: (data?.hypotheses ?? []) as string[],
    recall_flags: (data?.recall_flags ?? []) as string[],
  };
}

export async function saveDiagnoses(
  consultationId: string,
  hypotheses: string[],
  recall_flags: string[],
) {
  const { error } = await supabase.from("diagnoses").upsert(
    {
      consultation_id: consultationId,
      hypotheses: json(hypotheses),
      recall_flags: json(recall_flags),
    },
    { onConflict: "consultation_id" },
  );
  if (error) throw new Error(error.message);
}

export interface ConductRow {
  phase: string | null;
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  meals_count: number;
  goal: string | null;
  preferences: string[];
  restrictions: string[];
  notes: string | null;
  energy?: Record<string, unknown>;
}

export async function getConduct(consultationId: string) {
  const { data, error } = await supabase
    .from("conducts")
    .select(
      "phase, kcal, protein_g, carb_g, fat_g, meals_count, goal, preferences, restrictions, notes, energy",
    )
    .eq("consultation_id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ConductRow | null;
}

export async function saveConduct(consultationId: string, conduct: ConductRow) {
  const { error } = await supabase
    .from("conducts")
    .upsert(json({ consultation_id: consultationId, ...conduct }), {
      onConflict: "consultation_id",
    });
  if (error) throw new Error(error.message);
}

export async function listFoods() {
  return unwrap(await supabase.from("foods").select("*").order("name")) as Food[];
}

export async function createFood(food: Partial<Food>) {
  return unwrap(await supabase.from("foods").insert(json(food)).select().single()) as Food;
}

export async function updateFood(id: string, food: Partial<Food>) {
  return unwrap(
    await supabase.from("foods").update(json(food)).eq("id", id).select().single(),
  ) as Food;
}

export async function deleteFood(id: string) {
  const { error } = await supabase.from("foods").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listRecipes() {
  return unwrap(await supabase.from("recipes").select("*").order("name")) as unknown as Recipe[];
}

export async function getMealPlan(consultationId: string) {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, meals, totals, shopping_list, recipes, rationale")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id as string,
    plan: {
      meals: data.meals,
      totals: data.totals,
      shopping_list: data.shopping_list,
      recipes: data.recipes,
    } as unknown as MealPlan,
    rationale: (data.rationale ?? "") as string,
  };
}

export async function saveMealPlan(consultationId: string, plan: MealPlan, rationale: string) {
  const payload = {
    meals: json(plan.meals),
    totals: json(plan.totals),
    shopping_list: json(plan.shopping_list),
    recipes: json(plan.recipes),
    rationale,
  };
  const existing = await supabase
    .from("meal_plans")
    .select("id")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) {
    const { error } = await supabase.from("meal_plans").update(payload).eq("id", existing.data.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from("meal_plans")
    .insert({ consultation_id: consultationId, ...payload });
  if (error) throw new Error(error.message);
}

export async function getRecord(consultationId: string) {
  const { data, error } = await supabase
    .from("records")
    .select("sections, report")
    .eq("consultation_id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    sections: (data?.sections ?? null) as Record<string, string> | null,
    report: ((data as { report?: string | null } | null)?.report ?? "") as string,
  };
}

export async function saveRecord(consultationId: string, sections: Record<string, string>) {
  const { error } = await supabase
    .from("records")
    .upsert(
      { consultation_id: consultationId, sections: json(sections) },
      { onConflict: "consultation_id" },
    );
  if (error) throw new Error(error.message);
}

/** Guarda o parecer nutricional final (markdown) do prontuário. */
export async function saveReport(consultationId: string, report: string) {
  const { error } = await supabase
    .from("records")
    .upsert(json({ consultation_id: consultationId, report }), { onConflict: "consultation_id" });
  if (error) throw new Error(error.message);
}
/** Guarda o documento do parecer (JSON) dentro das seções do prontuário. */
export async function saveParecer(consultationId: string, doc: unknown) {
  const current = await getRecord(consultationId);
  const sections = { ...(current.sections ?? {}), parecer: JSON.stringify(doc) };
  const { error } = await supabase
    .from("records")
    .upsert(json({ consultation_id: consultationId, sections }), { onConflict: "consultation_id" });
  if (error) throw new Error(error.message);
}

/** Lê o documento do parecer salvo, quando existir. */
export async function getParecer<T>(consultationId: string): Promise<T | null> {
  const current = await getRecord(consultationId);
  const raw = current.sections?.["parecer"];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
