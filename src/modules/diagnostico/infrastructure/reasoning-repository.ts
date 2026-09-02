import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { EMPTY_REASONING, normalizeReasoning, type ClinicalReasoning } from "../domain/clinical-reasoning";

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
const json = (value: unknown) => value as Json;

export async function getClinicalReasoning(consultationId: string): Promise<ClinicalReasoning> {
  const { data, error } = await clinicalSupabase
    .from("diagnoses")
    .select("reasoning, hypotheses, recall_flags")
    .eq("consultation_id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return EMPTY_REASONING;

  const raw = data.reasoning as unknown;
  const normalized = normalizeReasoning(raw, {
    hypotheses: Array.isArray(data.hypotheses) ? data.hypotheses.map(String) : [],
    flags: Array.isArray(data.recall_flags) ? data.recall_flags.map(String) : [],
  });
  return normalized;
}

export async function saveClinicalReasoning(consultationId: string, reasoning: ClinicalReasoning) {
  const { error } = await clinicalSupabase.from("diagnoses").upsert({
    consultation_id: consultationId,
    reasoning: json(reasoning),
  }, { onConflict: "consultation_id" });
  if (error) throw new Error(error.message);
}
