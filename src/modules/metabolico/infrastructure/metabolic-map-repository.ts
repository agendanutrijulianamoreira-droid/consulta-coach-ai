import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type {
  MetabolicDomain,
  MetabolicSource,
  ReviewStatus,
} from "@/modules/metabolico/domain/metabolic-map";

const json = (value: unknown) => value as Json;

type AssessmentRow = {
  id: string;
  consultation_id: string;
  review_status: "draft" | "in_review" | "approved";
  clinical_summary: string | null;
  patient_summary: string | null;
  created_at: string;
  updated_at: string;
};
type ContextRow = {
  id: string;
  assessment_id: string;
  domain: MetabolicDomain;
  label: string;
  value: string;
  source_kind: MetabolicSource;
  source_date: string | null;
  method: string | null;
  review_status: ReviewStatus;
  evidence_source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
type CapacityRow = {
  id: string;
  assessment_id: string;
  right_grip_kgf: number | null;
  left_grip_kgf: number | null;
  grip_protocol: string | null;
  grip_measured_at: string | null;
  span_value: number | null;
  span_unit: "cm" | "m" | "in" | null;
  span_method: string | null;
  span_purpose: string | null;
  notes: string | null;
  source_kind: MetabolicSource;
  review_status: ReviewStatus;
  updated_at: string;
};
type EnergyRow = {
  id: string;
  assessment_id: string;
  measurement_kind: "estimated" | "measured";
  kcal: number;
  unit: string;
  formula: string | null;
  inputs: Json;
  equipment: string | null;
  conditions: string | null;
  measured_at: string | null;
  source_kind: MetabolicSource;
  review_status: ReviewStatus;
  evidence_source: string | null;
  updated_at: string;
};
type GeneticRow = {
  id: string;
  assessment_id: string;
  report_file_name: string | null;
  report_reference: string | null;
  laboratory: string | null;
  test_date: string | null;
  variant: string | null;
  result_genotype: string | null;
  evidence_level: string | null;
  source: string | null;
  review_status: ReviewStatus;
  notes: string | null;
  updated_at: string;
};

type TableDef<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};
type MetabolicTables = {
  metabolic_assessments: TableDef<
    AssessmentRow,
    Partial<AssessmentRow> & { consultation_id: string }
  >;
  metabolic_context_entries: TableDef<
    ContextRow,
    Partial<ContextRow> & {
      assessment_id: string;
      domain: MetabolicDomain;
      label: string;
      value: string;
    }
  >;
  metabolic_capacity_measurements: TableDef<
    CapacityRow,
    Partial<CapacityRow> & { assessment_id: string }
  >;
  metabolic_energy_measurements: TableDef<
    EnergyRow,
    Partial<EnergyRow> & {
      assessment_id: string;
      measurement_kind: "estimated" | "measured";
      kcal: number;
    }
  >;
  metabolic_genetic_findings: TableDef<GeneticRow, Partial<GeneticRow> & { assessment_id: string }>;
};
type MetabolicDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & MetabolicTables;
  };
};
const metabolicSupabase = supabase as unknown as SupabaseClient<MetabolicDatabase>;

export type MetabolicAssessment = Omit<AssessmentRow, "created_at" | "updated_at"> & {
  context: ContextRow[];
  capacity: CapacityRow | null;
  energy: EnergyRow[];
  genetics: GeneticRow[];
};
export type MetabolicHistoryRow = {
  consultationId: string;
  date: string;
  mapStatus: AssessmentRow["review_status"] | null;
  anthropometry: Record<string, unknown>;
  energyKcal: number | null;
  labCount: number;
};

export async function getMetabolicAssessment(
  consultationId: string,
): Promise<MetabolicAssessment | null> {
  const { data: assessment, error } = await metabolicSupabase
    .from("metabolic_assessments")
    .select("*")
    .eq("consultation_id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!assessment) return null;
  const [context, capacity, energy, genetics] = await Promise.all([
    metabolicSupabase
      .from("metabolic_context_entries")
      .select("*")
      .eq("assessment_id", assessment.id)
      .order("created_at", { ascending: true }),
    metabolicSupabase
      .from("metabolic_capacity_measurements")
      .select("*")
      .eq("assessment_id", assessment.id)
      .maybeSingle(),
    metabolicSupabase
      .from("metabolic_energy_measurements")
      .select("*")
      .eq("assessment_id", assessment.id)
      .order("measured_at", { ascending: false }),
    metabolicSupabase
      .from("metabolic_genetic_findings")
      .select("*")
      .eq("assessment_id", assessment.id)
      .order("test_date", { ascending: false }),
  ]);
  for (const result of [context, capacity, energy, genetics])
    if (result.error) throw new Error(result.error.message);
  return {
    ...(assessment as AssessmentRow),
    context: (context.data ?? []) as ContextRow[],
    capacity: (capacity.data ?? null) as CapacityRow | null,
    energy: (energy.data ?? []) as EnergyRow[],
    genetics: (genetics.data ?? []) as GeneticRow[],
  };
}

export async function createMetabolicAssessment(consultationId: string) {
  const { data, error } = await metabolicSupabase
    .from("metabolic_assessments")
    .upsert({ consultation_id: consultationId }, { onConflict: "consultation_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AssessmentRow;
}

export async function saveMetabolicAssessment(
  consultationId: string,
  patch: Pick<AssessmentRow, "review_status" | "clinical_summary" | "patient_summary">,
) {
  const { error } = await metabolicSupabase
    .from("metabolic_assessments")
    .upsert({ consultation_id: consultationId, ...patch }, { onConflict: "consultation_id" });
  if (error) throw new Error(error.message);
}

export async function upsertMetabolicContext(
  assessmentId: string,
  entry: Partial<ContextRow> & Pick<ContextRow, "domain" | "label" | "value">,
) {
  const { data, error } = await metabolicSupabase
    .from("metabolic_context_entries")
    .upsert({ ...entry, assessment_id: assessmentId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContextRow;
}

export async function updateMetabolicContextReview(id: string, review_status: ReviewStatus) {
  const { error } = await metabolicSupabase
    .from("metabolic_context_entries")
    .update({ review_status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteMetabolicContext(id: string) {
  const { error } = await metabolicSupabase.from("metabolic_context_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function saveMetabolicCapacity(assessmentId: string, capacity: Partial<CapacityRow>) {
  const { error } = await metabolicSupabase
    .from("metabolic_capacity_measurements")
    .upsert({ ...capacity, assessment_id: assessmentId }, { onConflict: "assessment_id" });
  if (error) throw new Error(error.message);
}

export async function addMetabolicEnergy(
  assessmentId: string,
  measurement: Omit<EnergyRow, "id" | "assessment_id" | "updated_at" | "inputs"> & {
    inputs?: unknown;
  },
) {
  const { error } = await metabolicSupabase.from("metabolic_energy_measurements").insert({
    ...measurement,
    assessment_id: assessmentId,
    inputs: json(measurement.inputs ?? {}),
  });
  if (error) throw new Error(error.message);
}

export async function addMetabolicGenetic(
  assessmentId: string,
  finding: Omit<GeneticRow, "id" | "assessment_id" | "updated_at">,
) {
  const { error } = await metabolicSupabase
    .from("metabolic_genetic_findings")
    .insert({ ...finding, assessment_id: assessmentId });
  if (error) throw new Error(error.message);
}

export async function uploadGeneticReport(assessmentId: string, file: File) {
  const path = `${assessmentId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage
    .from("clinical-documents")
    .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message);
  return path;
}

export async function updateGeneticReview(id: string, review_status: ReviewStatus) {
  const { error } = await metabolicSupabase
    .from("metabolic_genetic_findings")
    .update({ review_status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listMetabolicHistory(patientId: string): Promise<MetabolicHistoryRow[]> {
  const { data: consultations, error: consultationError } = await metabolicSupabase
    .from("consultations")
    .select("id, consultation_date")
    .eq("patient_id", patientId)
    .order("consultation_date", { ascending: true });
  if (consultationError) throw new Error(consultationError.message);
  const ids = (consultations ?? []).map((row) => row.id);
  if (!ids.length) return [];
  const [maps, anthro, conducts, labs] = await Promise.all([
    metabolicSupabase
      .from("metabolic_assessments")
      .select("consultation_id, review_status")
      .in("consultation_id", ids),
    metabolicSupabase
      .from("anthropometry")
      .select("consultation_id, data")
      .in("consultation_id", ids),
    metabolicSupabase
      .from("conducts")
      .select("consultation_id, kcal, energy")
      .in("consultation_id", ids),
    metabolicSupabase
      .from("lab_results")
      .select("consultation_id, id")
      .in("consultation_id", ids)
      .eq("review_status", "confirmed"),
  ]);
  for (const result of [maps, anthro, conducts, labs])
    if (result.error) throw new Error(result.error.message);
  return (consultations ?? []).map((consultation) => ({
    consultationId: consultation.id,
    date: consultation.consultation_date,
    mapStatus: ((maps.data ?? []).find((row) => row.consultation_id === consultation.id)
      ?.review_status ?? null) as MetabolicHistoryRow["mapStatus"],
    anthropometry: ((anthro.data ?? []).find((row) => row.consultation_id === consultation.id)
      ?.data ?? {}) as Record<string, unknown>,
    energyKcal:
      Number((conducts.data ?? []).find((row) => row.consultation_id === consultation.id)?.kcal) ||
      null,
    labCount: (labs.data ?? []).filter((row) => row.consultation_id === consultation.id).length,
  }));
}
