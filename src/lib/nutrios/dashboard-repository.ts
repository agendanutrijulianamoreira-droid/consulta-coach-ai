import { supabase } from "@/integrations/supabase/client";

export type RecentMealPlan = {
  id: string;
  consultationId: string;
  patientId: string;
  patientName: string;
  consultationDate: string;
  createdAt: string;
  kcal: number | null;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
};

type PlanRow = {
  id: string;
  consultation_id: string;
  totals: unknown;
  created_at: string;
};

type ConsultationRow = {
  id: string;
  patient_id: string;
  consultation_date: string;
  patients: { name: string } | null;
};

export async function listRecentMealPlans(limit = 6): Promise<RecentMealPlan[]> {
  const plansResult = await supabase
    .from("meal_plans")
    .select("id, consultation_id, totals, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (plansResult.error) throw new Error(plansResult.error.message);
  const plans = (plansResult.data ?? []) as PlanRow[];
  if (!plans.length) return [];

  const consultationIds = plans.map((plan) => plan.consultation_id);
  const consultationsResult = await supabase
    .from("consultations")
    .select("id, patient_id, consultation_date, patients(name)")
    .in("id", consultationIds);

  if (consultationsResult.error) throw new Error(consultationsResult.error.message);
  const consultations = (consultationsResult.data ?? []) as unknown as ConsultationRow[];
  const consultationMap = new Map(consultations.map((consultation) => [consultation.id, consultation]));

  return plans.flatMap((plan) => {
    const consultation = consultationMap.get(plan.consultation_id);
    if (!consultation) return [];
    const totals = asTotals(plan.totals);
    return [{
      id: plan.id,
      consultationId: plan.consultation_id,
      patientId: consultation.patient_id,
      patientName: consultation.patients?.name ?? "Paciente",
      consultationDate: consultation.consultation_date,
      createdAt: plan.created_at,
      kcal: totals.kcal,
      proteinG: totals.proteinG,
      carbG: totals.carbG,
      fatG: totals.fatG,
    }];
  });
}

function asTotals(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    kcal: numberOrNull(source["kcal"]),
    proteinG: numberOrNull(source["protein_g"] ?? source["proteinG"]),
    carbG: numberOrNull(source["carb_g"] ?? source["carbG"]),
    fatG: numberOrNull(source["fat_g"] ?? source["fatG"]),
  };
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
