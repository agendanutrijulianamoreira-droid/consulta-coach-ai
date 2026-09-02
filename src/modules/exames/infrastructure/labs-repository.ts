import { supabase } from "@/integrations/supabase/client";
import type { LabResultValue } from "@/modules/exames/domain/lab-calculations";

const json = (value: unknown) => value as never;

export interface LabAssessment {
  consultation_id: string;
  collection_date: string | null;
  laboratory_name: string | null;
  notes: string | null;
}

export interface StoredLabResult extends LabResultValue {
  id: string;
  consultation_id: string;
  created_at?: string;
}

export interface LabReferenceTarget {
  id?: string;
  analyte_code: string;
  analyte_name: string;
  unit: string | null;
  sex: string | null;
  age_min: number | null;
  age_max: number | null;
  target_min: number | null;
  target_max: number | null;
  interpretation_below: string | null;
  interpretation_in_range: string | null;
  interpretation_above: string | null;
  source_label: string | null;
  source_version: string | null;
  active: boolean;
}

export interface LabEvolutionPoint {
  consultation_id: string;
  consultation_date: string;
  collection_date: string | null;
  analyte_code: string;
  analyte_name: string;
  value: number;
  unit: string | null;
  is_derived: boolean;
  calculation_version: string | null;
}

export async function getLabAssessment(consultationId: string) {
  const { data, error } = await supabase
    .from("lab_assessments")
    .select("consultation_id, collection_date, laboratory_name, notes")
    .eq("consultation_id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? { consultation_id: consultationId, collection_date: null, laboratory_name: null, notes: null }) as LabAssessment;
}

export async function saveLabAssessment(assessment: LabAssessment) {
  const { error } = await supabase.from("lab_assessments").upsert(assessment, { onConflict: "consultation_id" });
  if (error) throw new Error(error.message);
}

export async function listLabResults(consultationId: string) {
  const { data, error } = await supabase
    .from("lab_results")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("is_derived", { ascending: true })
    .order("analyte_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as StoredLabResult[];
}

export async function upsertLabResult(consultationId: string, result: LabResultValue & { id?: string }) {
  const payload = { ...result, consultation_id: consultationId, dependencies: json(result.dependencies ?? []) };
  const { data, error } = await supabase.from("lab_results").upsert(json(payload)).select("*").single();
  if (error) throw new Error(error.message);
  return data as unknown as StoredLabResult;
}

export async function deleteLabResult(id: string) {
  const { error } = await supabase.from("lab_results").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function replaceDerivedResults(consultationId: string, results: LabResultValue[]) {
  const { error: deleteError } = await supabase.from("lab_results").delete().eq("consultation_id", consultationId).eq("is_derived", true);
  if (deleteError) throw new Error(deleteError.message);
  if (!results.length) return;
  const rows = results.map((result) => ({ ...result, consultation_id: consultationId, dependencies: json(result.dependencies ?? []) }));
  const { error } = await supabase.from("lab_results").insert(json(rows));
  if (error) throw new Error(error.message);
}

export async function listLabReferenceTargets() {
  const { data, error } = await supabase
    .from("lab_reference_targets")
    .select("id, analyte_code, analyte_name, unit, sex, age_min, age_max, target_min, target_max, interpretation_below, interpretation_in_range, interpretation_above, source_label, source_version, active")
    .eq("active", true)
    .order("analyte_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as LabReferenceTarget[];
}

export async function saveLabReferenceTarget(target: LabReferenceTarget) {
  const { data, error } = await supabase
    .from("lab_reference_targets")
    .upsert(json(target))
    .select("id, analyte_code, analyte_name, unit, sex, age_min, age_max, target_min, target_max, interpretation_below, interpretation_in_range, interpretation_above, source_label, source_version, active")
    .single();
  if (error) throw new Error(error.message);
  return data as LabReferenceTarget;
}

/** Série longitudinal de todos os resultados confirmados do paciente. */
export async function listPatientLabEvolution(patientId: string) {
  const { data: consultations, error: consultationError } = await supabase
    .from("consultations")
    .select("id, consultation_date")
    .eq("patient_id", patientId)
    .order("consultation_date", { ascending: true });
  if (consultationError) throw new Error(consultationError.message);
  const ids = (consultations ?? []).map((item) => item.id);
  if (!ids.length) return [] as LabEvolutionPoint[];

  const [{ data: results, error: resultError }, { data: assessments, error: assessmentError }] = await Promise.all([
    supabase
      .from("lab_results")
      .select("consultation_id, analyte_code, analyte_name, value, unit, is_derived, calculation_version")
      .in("consultation_id", ids)
      .eq("review_status", "confirmed")
      .not("value", "is", null),
    supabase.from("lab_assessments").select("consultation_id, collection_date").in("consultation_id", ids),
  ]);
  if (resultError) throw new Error(resultError.message);
  if (assessmentError) throw new Error(assessmentError.message);
  const dateByConsultation = new Map((consultations ?? []).map((item) => [item.id, item.consultation_date]));
  const collectionByConsultation = new Map((assessments ?? []).map((item) => [item.consultation_id, item.collection_date]));
  return (results ?? []).map((row) => ({
    consultation_id: row.consultation_id,
    consultation_date: dateByConsultation.get(row.consultation_id) ?? "",
    collection_date: collectionByConsultation.get(row.consultation_id) ?? null,
    analyte_code: row.analyte_code,
    analyte_name: row.analyte_name,
    value: Number(row.value),
    unit: row.unit,
    is_derived: row.is_derived,
    calculation_version: row.calculation_version,
  })) as LabEvolutionPoint[];
}
