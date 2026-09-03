import { supabase } from "@/integrations/supabase/client";
import * as db from "./repository";

const PLAN_FAVORITE_KEY = "meal_plan_favorite";
const FAVORITE_MEALS_KEY = "favorite_meals";

export type FavoriteMealItem = {
  food_id?: string;
  name: string;
  grams?: number;
  household_measure?: string;
};

export type FavoriteMeal = {
  key: string;
  sourcePlanId: string;
  sourceConsultationId: string;
  slot: string;
  label: string;
  items: FavoriteMealItem[];
  totals: Record<string, number>;
  savedAt: string;
  patientName?: string;
  consultationDate?: string;
};

export type FavoritePlan = {
  id: string;
  consultationId: string;
  patientId: string;
  patientName: string;
  consultationDate: string;
  meals: Array<{
    slot: string;
    label: string;
    items: FavoriteMealItem[];
    totals: Record<string, number>;
  }>;
  totals: Record<string, number>;
  rationale: string | null;
};

export async function listFavoritePlans(): Promise<FavoritePlan[]> {
  const records = await supabase.from("records").select("consultation_id, sections");
  if (records.error) throw new Error(records.error.message);

  const favoriteConsultationIds = (records.data ?? [])
    .filter((row) => {
      const sections = (row.sections ?? {}) as Record<string, unknown>;
      return sections[PLAN_FAVORITE_KEY] === "true";
    })
    .map((row) => row.consultation_id);

  if (!favoriteConsultationIds.length) return [];

  const [plansResult, consultationsResult] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("id, consultation_id, meals, totals, rationale, created_at")
      .in("consultation_id", favoriteConsultationIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("consultations")
      .select("id, patient_id, consultation_date")
      .in("id", favoriteConsultationIds),
  ]);
  if (plansResult.error) throw new Error(plansResult.error.message);
  if (consultationsResult.error) throw new Error(consultationsResult.error.message);

  const latestPlanByConsultation = new Map<string, (typeof plansResult.data)[number]>();
  for (const plan of plansResult.data ?? []) {
    if (!latestPlanByConsultation.has(plan.consultation_id)) {
      latestPlanByConsultation.set(plan.consultation_id, plan);
    }
  }

  const consultations = consultationsResult.data ?? [];
  const patientIds = Array.from(new Set(consultations.map((item) => item.patient_id)));
  const patientsResult = patientIds.length
    ? await supabase.from("patients").select("id, name").in("id", patientIds)
    : { data: [], error: null };
  if (patientsResult.error) throw new Error(patientsResult.error.message);
  const patientNames = new Map((patientsResult.data ?? []).map((patient) => [patient.id, patient.name]));

  return consultations
    .map((consultation) => {
      const plan = latestPlanByConsultation.get(consultation.id);
      if (!plan) return null;
      return {
        id: plan.id,
        consultationId: consultation.id,
        patientId: consultation.patient_id,
        patientName: patientNames.get(consultation.patient_id) ?? "Paciente",
        consultationDate: consultation.consultation_date,
        meals: normalizeMeals(plan.meals),
        totals: normalizeTotals(plan.totals),
        rationale: plan.rationale,
      } satisfies FavoritePlan;
    })
    .filter((plan): plan is FavoritePlan => plan !== null)
    .sort((a, b) => b.consultationDate.localeCompare(a.consultationDate));
}

export async function listFavoriteMeals(): Promise<FavoriteMeal[]> {
  const records = await supabase.from("records").select("consultation_id, sections");
  if (records.error) throw new Error(records.error.message);

  const meals: FavoriteMeal[] = [];
  for (const row of records.data ?? []) {
    const sections = (row.sections ?? {}) as Record<string, unknown>;
    const saved = sections[FAVORITE_MEALS_KEY];
    if (!Array.isArray(saved)) continue;
    for (const item of saved) {
      if (!item || typeof item !== "object") continue;
      const meal = item as Partial<FavoriteMeal>;
      if (!meal.key || !meal.label || !meal.sourcePlanId) continue;
      meals.push({
        key: meal.key,
        sourcePlanId: meal.sourcePlanId,
        sourceConsultationId: meal.sourceConsultationId ?? row.consultation_id,
        slot: meal.slot ?? "refeicao",
        label: meal.label,
        items: Array.isArray(meal.items) ? meal.items : [],
        totals: meal.totals ?? {},
        savedAt: meal.savedAt ?? "",
      });
    }
  }

  if (!meals.length) return [];
  const consultationIds = Array.from(new Set(meals.map((meal) => meal.sourceConsultationId)));
  const consultationsResult = await supabase
    .from("consultations")
    .select("id, patient_id, consultation_date")
    .in("id", consultationIds);
  if (consultationsResult.error) throw new Error(consultationsResult.error.message);
  const consultations = new Map((consultationsResult.data ?? []).map((item) => [item.id, item]));
  const patientIds = Array.from(new Set((consultationsResult.data ?? []).map((item) => item.patient_id)));
  const patientsResult = patientIds.length
    ? await supabase.from("patients").select("id, name").in("id", patientIds)
    : { data: [], error: null };
  if (patientsResult.error) throw new Error(patientsResult.error.message);
  const patientNames = new Map((patientsResult.data ?? []).map((patient) => [patient.id, patient.name]));

  return meals
    .map((meal) => {
      const consultation = consultations.get(meal.sourceConsultationId);
      return {
        ...meal,
        patientName: consultation ? patientNames.get(consultation.patient_id) ?? "Paciente" : undefined,
        consultationDate: consultation?.consultation_date,
      };
    })
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function saveFavoriteMeal(plan: FavoritePlan, meal: FavoritePlan["meals"][number]) {
  const record = await db.getRecord(plan.consultationId);
  const sections = { ...(record.sections ?? {}) } as Record<string, unknown>;
  const current = Array.isArray(sections[FAVORITE_MEALS_KEY])
    ? [...(sections[FAVORITE_MEALS_KEY] as unknown[])]
    : [];
  const key = `${plan.id}:${meal.slot}`;
  const nextMeal: FavoriteMeal = {
    key,
    sourcePlanId: plan.id,
    sourceConsultationId: plan.consultationId,
    slot: meal.slot,
    label: meal.label,
    items: meal.items,
    totals: meal.totals,
    savedAt: new Date().toISOString(),
  };
  const withoutExisting = current.filter((item) => {
    if (!item || typeof item !== "object") return true;
    return (item as { key?: unknown }).key !== key;
  });
  sections[FAVORITE_MEALS_KEY] = [...withoutExisting, nextMeal];
  await db.saveRecord(plan.consultationId, sections);
}

export async function removeFavoriteMeal(meal: FavoriteMeal) {
  const record = await db.getRecord(meal.sourceConsultationId);
  const sections = { ...(record.sections ?? {}) } as Record<string, unknown>;
  const current = Array.isArray(sections[FAVORITE_MEALS_KEY])
    ? (sections[FAVORITE_MEALS_KEY] as unknown[])
    : [];
  sections[FAVORITE_MEALS_KEY] = current.filter((item) => {
    if (!item || typeof item !== "object") return true;
    return (item as { key?: unknown }).key !== meal.key;
  });
  await db.saveRecord(meal.sourceConsultationId, sections);
}

function normalizeMeals(value: unknown): FavoritePlan["meals"] {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    const meal = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const rawItems = Array.isArray(meal["items"]) ? meal["items"] : [];
    return {
      slot: typeof meal["slot"] === "string" ? meal["slot"] : `refeicao-${index + 1}`,
      label: typeof meal["label"] === "string" ? meal["label"] : `Refeição ${index + 1}`,
      items: rawItems.map((rawItem) => {
        const item = rawItem && typeof rawItem === "object" ? (rawItem as Record<string, unknown>) : {};
        return {
          ...(typeof item["food_id"] === "string" ? { food_id: item["food_id"] } : {}),
          name: typeof item["name"] === "string" ? item["name"] : "Item",
          ...(typeof item["grams"] === "number" ? { grams: item["grams"] } : {}),
          ...(typeof item["household_measure"] === "string" ? { household_measure: item["household_measure"] } : {}),
        };
      }),
      totals: normalizeTotals(meal["totals"]),
    };
  });
}

function normalizeTotals(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const output: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const number = Number(raw);
    if (Number.isFinite(number)) output[key] = number;
  }
  return output;
}
