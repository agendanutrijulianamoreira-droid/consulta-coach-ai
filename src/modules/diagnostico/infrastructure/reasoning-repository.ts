import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { EMPTY_REASONING, normalizeReasoning, type ClinicalReasoning } from "../domain/clinical-reasoning";

const json = (value: unknown) => value as Json;

type StoredEnvelope = { schema: "clinical-reasoning-v1"; reasoning: ClinicalReasoning };

export async function getClinicalReasoning(consultationId: string): Promise<ClinicalReasoning> {
  const { data, error } = await supabase
    .from("diagnoses")
    .select("hypotheses, recall_flags")
    .eq("consultation_id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return EMPTY_REASONING;

  const raw = data.hypotheses as unknown;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const envelope = raw as Partial<StoredEnvelope>;
    if (envelope.schema === "clinical-reasoning-v1" && envelope.reasoning) return normalizeReasoning(envelope.reasoning);
  }

  return normalizeReasoning(null, {
    hypotheses: Array.isArray(raw) ? raw.map(String) : [],
    flags: Array.isArray(data.recall_flags) ? data.recall_flags.map(String) : [],
  });
}

export async function saveClinicalReasoning(consultationId: string, reasoning: ClinicalReasoning) {
  const envelope: StoredEnvelope = { schema: "clinical-reasoning-v1", reasoning };
  const acceptedLegacyTitles = reasoning.hypotheses
    .filter((item) => item.status === "accepted" || item.status === "edited")
    .map((item) => item.title);
  const { error } = await supabase.from("diagnoses").upsert({
    consultation_id: consultationId,
    hypotheses: json(envelope),
    recall_flags: json(reasoning.flags),
  }, { onConflict: "consultation_id" });
  if (error) throw new Error(error.message);

  // Keep this variable intentionally materialized for migration/debug visibility.
  void acceptedLegacyTitles;
}
