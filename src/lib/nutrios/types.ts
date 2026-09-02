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

/**
 * Campos da anamnese clínica. Chaves antigas permanecem para garantir
 * compatibilidade com prontuários já gravados em JSONB.
 */
export const ANAMNESIS_FIELDS = [
  { key: "objetivo_consulta", label: "Objetivo da consulta", required: true },
  { key: "queixa_principal", label: "Queixa principal", required: true },
  { key: "historia_doenca", label: "História clínica atual", required: false },
  { key: "sintomas", label: "Sintomas e queixas atuais", required: true },
  { key: "doencas", label: "Patologias / diagnósticos", required: true },
  { key: "historico_familiar", label: "Histórico familiar", required: false },
  { key: "cirurgias_internacoes", label: "Cirurgias / internações", required: false },
  { key: "medicamentos", label: "Medicamentos em uso", required: true },
  { key: "suplementos", label: "Suplementos", required: false },
  { key: "exames", label: "Exames recentes / alterações", required: false },
  { key: "alergias", label: "Alergias", required: true },
  { key: "intolerancias", label: "Intolerâncias", required: true },
  { key: "rotina", label: "Rotina / trabalho / horários", required: true },
  { key: "sono", label: "Sono", required: true },
  { key: "estresse", label: "Estresse / saúde emocional", required: false },
  { key: "exercicio", label: "Exercício / atividade física", required: true },
  { key: "tabagismo", label: "Tabagismo", required: false },
  { key: "alcool", label: "Consumo de álcool", required: false },
  { key: "agua", label: "Hidratação", required: true },
  { key: "evacuacao", label: "Evacuação / hábito intestinal", required: true },
  { key: "sintomas_gastrointestinais", label: "Sintomas gastrointestinais", required: false },
  { key: "antibioticos_probioticos", label: "Antibióticos / probióticos recentes", required: false },
  { key: "refeicoes_padrao", label: "Padrão de refeições", required: true },
  { key: "frutas", label: "Consumo de frutas", required: false },
  { key: "lacteos", label: "Consumo de lácteos", required: false },
  { key: "preferencias", label: "Preferências alimentares", required: false },
  { key: "aversoes", label: "Aversões / alimentos que não gosta", required: false },
  { key: "restricoes_alimentares", label: "Restrições alimentares", required: true },
  { key: "fome_saciedade", label: "Fome / saciedade", required: false },
  { key: "compulsao_desejos", label: "Compulsão / desejos alimentares", required: false },
  { key: "fim_de_semana", label: "Fim de semana / refeições livres", required: false },
  { key: "saude_hormonal", label: "Saúde hormonal / sintomas associados", required: false },
  { key: "ciclo_menstrual_climaterio", label: "Ciclo menstrual / climatério / menopausa", required: false },
  { key: "gestacao_lactacao", label: "Gestação / lactação", required: false },
  { key: "objetivos", label: "Resultados desejados", required: true },
  { key: "motivacao", label: "Motivação / prontidão", required: false },
  { key: "dificuldades", label: "Dificuldades / barreiras", required: true },
  { key: "metas", label: "Metas combinadas", required: false },
] as const;

export type AnamnesisKey = (typeof ANAMNESIS_FIELDS)[number]["key"];

export const ANAMNESIS_SECTIONS: {
  id: string;
  title: string;
  description: string;
  fields: AnamnesisKey[];
}[] = [
  {
    id: "motivo",
    title: "Motivo e objetivo",
    description: "O que trouxe o paciente e o que ele espera alcançar.",
    fields: ["objetivo_consulta", "queixa_principal", "objetivos", "motivacao", "dificuldades", "metas"],
  },
  {
    id: "clinico",
    title: "Histórico clínico",
    description: "Patologias, sintomas, antecedentes, medicamentos e exames.",
    fields: [
      "historia_doenca",
      "sintomas",
      "doencas",
      "historico_familiar",
      "cirurgias_internacoes",
      "medicamentos",
      "suplementos",
      "exames",
      "alergias",
      "intolerancias",
    ],
  },
  {
    id: "estilo_vida",
    title: "Estilo de vida",
    description: "Rotina, sono, atividade física, hidratação e hábitos.",
    fields: ["rotina", "sono", "estresse", "exercicio", "tabagismo", "alcool", "agua"],
  },
  {
    id: "intestinal",
    title: "Saúde gastrointestinal",
    description: "Funcionamento intestinal e sintomas digestivos relevantes.",
    fields: ["evacuacao", "sintomas_gastrointestinais", "antibioticos_probioticos"],
  },
  {
    id: "alimentar",
    title: "Comportamento e rotina alimentar",
    description: "Padrão alimentar, preferências, restrições e comportamento.",
    fields: [
      "refeicoes_padrao",
      "frutas",
      "lacteos",
      "preferencias",
      "aversoes",
      "restricoes_alimentares",
      "fome_saciedade",
      "compulsao_desejos",
      "fim_de_semana",
    ],
  },
  {
    id: "hormonal",
    title: "Saúde hormonal e reprodutiva",
    description: "Preencher quando aplicável ao contexto clínico do paciente.",
    fields: ["saude_hormonal", "ciclo_menstrual_climaterio", "gestacao_lactacao"],
  },
];

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