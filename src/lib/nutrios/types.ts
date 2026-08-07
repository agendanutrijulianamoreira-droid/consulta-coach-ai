/**
 * Tipos de domínio compartilhados do NutriOS.
 * Mantidos livres de dependências de UI, banco ou IA para serem reutilizáveis
 * por qualquer módulo (consulta, plano, prontuário, relatórios).
 */

export type MealSlot = "cafe" | "lanche_manha" | "almoco" | "lanche_tarde" | "jantar" | "ceia";

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  cafe: "Café da manhã",
  lanche_manha: "Lanche da manhã",
  almoco: "Almoço",
  lanche_tarde: "Lanche da tarde",
  jantar: "Jantar",
  ceia: "Ceia",
};

/** Mapeia o slot da refeição para a etiqueta usada na base de alimentos. */
export const SLOT_TO_FOOD_TAG: Record<MealSlot, string> = {
  cafe: "cafe",
  lanche_manha: "lanche",
  almoco: "almoco",
  lanche_tarde: "lanche",
  jantar: "jantar",
  ceia: "ceia",
};

export interface Food {
  id: string;
  name: string;
  group_name: string;
  category: string;
  portion_grams: number;
  household_measure: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  glycemic_index: number | null;
  cost_level: number;
  prep_minutes: number;
  tags: string[];
  meal_slots: string[];
}

export interface Recipe {
  id: string;
  name: string;
  meal_slots: string[];
  ingredients: { name: string; amount: string }[];
  steps: string;
  prep_minutes: number;
  yield_label: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  tags: string[];
}

export interface Macros {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
}

export interface MealPlanItem {
  food_id: string;
  name: string;
  grams: number;
  household_measure: string;
  category: string;
  group_name: string;
  macros: Macros;
  substitutions: { food_id: string; name: string; grams: number; household_measure: string }[];
}

export interface PlannedMeal {
  slot: MealSlot;
  label: string;
  target_kcal: number;
  items: MealPlanItem[];
  totals: Macros;
}

export interface ShoppingGroup {
  category: string;
  items: { name: string; grams: number }[];
}

export interface MealPlan {
  meals: PlannedMeal[];
  totals: Macros;
  shopping_list: ShoppingGroup[];
  recipes: Recipe[];
}

export interface ConductInput {
  phase: string | null;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  meals_count: number;
  goal: string | null;
  preferences: string[];
  restrictions: string[];
}

/** Campos da anamnese extraídos automaticamente da transcrição. */
export const ANAMNESIS_FIELDS = [
  { key: "queixa_principal", label: "Queixa principal" },
  { key: "historia_doenca", label: "História da doença" },
  { key: "sintomas", label: "Sintomas" },
  { key: "medicamentos", label: "Uso de medicamentos" },
  { key: "suplementos", label: "Suplementos" },
  { key: "exames", label: "Exames" },
  { key: "doencas", label: "Doenças" },
  { key: "alergias", label: "Alergias" },
  { key: "intolerancias", label: "Intolerâncias" },
  { key: "rotina", label: "Rotina" },
  { key: "sono", label: "Sono" },
  { key: "estresse", label: "Estresse" },
  { key: "exercicio", label: "Exercício" },
  { key: "agua", label: "Água" },
  { key: "evacuacao", label: "Evacuação" },
  { key: "objetivos", label: "Objetivos" },
  { key: "motivacao", label: "Motivação" },
  { key: "preferencias", label: "Preferências" },
  { key: "restricoes_alimentares", label: "Restrições alimentares" },
] as const;

export type AnamnesisKey = (typeof ANAMNESIS_FIELDS)[number]["key"];

/** Estado de revisão de cada campo sugerido pela IA. */
export type SuggestionStatus = "sugerido" | "aceito" | "editado" | "recusado";

export interface AnamnesisField {
  value: string;
  status: SuggestionStatus;
  source?: string;
}

export type AnamnesisFields = Partial<Record<AnamnesisKey, AnamnesisField>>;

export interface RecallItem {
  id: string;
  time_label: string | null;
  foods: string | null;
  amount: string | null;
  preparation: string | null;
  notes: string | null;
  position: number;
}

export const RESTRICTION_OPTIONS = [
  { value: "sem_gluten", label: "Sem glúten" },
  { value: "sem_lactose", label: "Sem lactose" },
  { value: "vegetariano", label: "Vegetariano" },
  { value: "vegano", label: "Vegano" },
  { value: "low_carb", label: "Low carb" },
];